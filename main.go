package main

import (
	"context"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"
)

const (
	appVersion      = "0.3.10"
	listenAddress   = "127.0.0.1:17861"
	defaultRepo     = "keldin94/obracun-desktop"
	executableAsset = "Obracun-Windows.exe"
)

func updateAssetName() string {
	if runtime.GOOS == "darwin" {
		return "Obracun-macOS-Intel"
	}
	return "Obracun-Setup-Windows.exe"
}

//go:embed app/index.html app/desktop.js app/cloud.js app/engineering.js app/i18n.js app/measurement-editor.js app/periods.js app/report-v2.js app/signature-pad.js app/runtime.bundle.js branding/obracun-icon.svg app/cloud-config.json
var assets embed.FS

type settings struct {
	Repo string `json:"repo"`
}
type release struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
	Assets  []struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
		Size int64  `json:"size"`
	} `json:"assets"`
}
type updateDetails struct {
	Exists    bool
	Tag       string
	BinaryURL string
	DigestURL string
	Size      int64
}
type updater struct {
	mu       sync.Mutex
	settings settings
	dir      string
	http     *http.Client
	current  updateDetails
}

var repoRE = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)
var hexRE = regexp.MustCompile(`(?i)^[a-f0-9]{64}\b`)

func settingsDir() string {
	if s := os.Getenv("LOCALAPPDATA"); s != "" {
		return filepath.Join(s, "Keldin Obracun")
	}
	base, _ := os.UserConfigDir()
	if base == "" {
		base = "."
	}
	return filepath.Join(base, "Keldin Obracun")
}

func newUpdater() *updater {
	dir := settingsDir()
	_ = os.MkdirAll(dir, 0700)
	u := &updater{dir: dir, settings: settings{Repo: defaultRepo}, http: &http.Client{Timeout: 45 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) > 8 {
			return errors.New("Previše preusmjeravanja")
		}
		if req.URL.Scheme != "https" {
			return errors.New("Nesiguran download: nije HTTPS")
		}
		h := strings.ToLower(req.URL.Hostname())
		if h != "github.com" && h != "api.github.com" && h != "objects.githubusercontent.com" && h != "release-assets.githubusercontent.com" && h != "github-releases.githubusercontent.com" {
			return fmt.Errorf("Nepoznata domena preuzimanja: %s", h)
		}
		return nil
	}}}
	if f, err := os.ReadFile(filepath.Join(dir, "settings.json")); err == nil {
		var s settings
		if json.Unmarshal(f, &s) == nil && repoRE.MatchString(s.Repo) {
			u.settings = s
		}
	}
	return u
}

func sendJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, code int, msg string) {
	sendJSON(w, code, map[string]string{"error": msg})
}
func requiresPost(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != "POST" {
		fail(w, 405, "Metoda nije dopuštena")
		return false
	}
	if r.Header.Get("Content-Type") != "application/json" {
		fail(w, 415, "Očekivan JSON zahtjev")
		return false
	}
	origin := r.Header.Get("Origin")
	if origin != "http://"+listenAddress {
		fail(w, 403, "Zahtjev nije iz aplikacije")
		return false
	}
	return true
}
func (u *updater) persistLocked() error {
	b, e := json.MarshalIndent(u.settings, "", "  ")
	if e != nil {
		return e
	}
	temp := filepath.Join(u.dir, "settings.json.tmp")
	if e = os.WriteFile(temp, b, 0600); e != nil {
		return e
	}
	return os.Rename(temp, filepath.Join(u.dir, "settings.json"))
}
func (u *updater) updateSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		u.mu.Lock()
		s := u.settings
		u.mu.Unlock()
		sendJSON(w, 200, s)
		return
	}
	if !requiresPost(w, r) {
		return
	}
	var p settings
	if e := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&p); e != nil {
		fail(w, 400, "Neispravan unos")
		return
	}
	p.Repo = strings.TrimSpace(p.Repo)
	if !repoRE.MatchString(p.Repo) || strings.Contains(p.Repo, "..") || strings.HasPrefix(p.Repo, ".") {
		fail(w, 400, "Upiši GitHub repozitorij u obliku vlasnik/naziv.")
		return
	}
	u.mu.Lock()
	u.settings = p
	u.current = updateDetails{}
	e := u.persistLocked()
	u.mu.Unlock()
	if e != nil {
		fail(w, 500, "Ne mogu spremiti postavku: "+e.Error())
		return
	}
	sendJSON(w, 200, p)
}
func versionIsNewer(tag string) bool {
	parse := func(v string) ([3]int, bool) {
		var out [3]int
		v = strings.TrimPrefix(strings.TrimSpace(v), "v")
		a := strings.Split(v, ".")
		if len(a) != 3 {
			return out, false
		}
		for i, s := range a {
			if s == "" {
				return out, false
			}
			for _, c := range s {
				if c < '0' || c > '9' {
					return out, false
				}
				out[i] = out[i]*10 + int(c-'0')
				if out[i] > 100000 {
					return out, false
				}
			}
		}
		return out, true
	}
	cur, ok1 := parse(appVersion)
	v, ok2 := parse(tag)
	if !ok1 || !ok2 {
		return false
	}
	for i := 0; i < 3; i++ {
		if v[i] > cur[i] {
			return true
		}
		if v[i] < cur[i] {
			return false
		}
	}
	return false
}
func (u *updater) releaseInfo(ctx context.Context) (updateDetails, error) {
	u.mu.Lock()
	repo := u.settings.Repo
	u.mu.Unlock()
	req, e := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/repos/"+repo+"/releases/latest", nil)
	if e != nil {
		return updateDetails{}, e
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "Keldin-Obracun-Desktop/"+appVersion)
	res, e := u.http.Do(req)
	if e != nil {
		return updateDetails{}, fmt.Errorf("Nema veze s GitHubom: %w", e)
	}
	defer res.Body.Close()
	if res.StatusCode == 404 {
		return updateDetails{}, errors.New("Još nema objavljenih verzija u GitHub repozitoriju. Podesi repozitorij i objavi prvu verziju.")
	}
	if res.StatusCode != 200 {
		return updateDetails{}, fmt.Errorf("GitHub nije dostupan (HTTP %d)", res.StatusCode)
	}
	var rel release
	if e = json.NewDecoder(io.LimitReader(res.Body, 1024*1024)).Decode(&rel); e != nil {
		return updateDetails{}, e
	}
	ud := updateDetails{Tag: rel.TagName, Exists: versionIsNewer(rel.TagName)}
	for _, a := range rel.Assets {
		switch a.Name {
		case updateAssetName():
			ud.BinaryURL = a.URL
			ud.Size = a.Size
		case updateAssetName() + ".sha256":
			ud.DigestURL = a.URL
		}
	}
	if ud.Exists && (ud.BinaryURL == "" || ud.DigestURL == "") {
		return updateDetails{}, errors.New("Nova verzija nema izvršnu datoteku za ovaj sistem i SHA-256 kontrolni zbroj. Instalacija je blokirana.")
	}
	if ud.Exists && (ud.Size < 1 || ud.Size > 120*1024*1024) {
		return updateDetails{}, errors.New("Neispravna veličina datoteke ažuriranja.")
	}
	return ud, nil
}
func (u *updater) check(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		fail(w, 405, "Metoda nije dopuštena")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 40*time.Second)
	defer cancel()
	d, e := u.releaseInfo(ctx)
	if e != nil {
		fail(w, 502, e.Error())
		return
	}
	u.mu.Lock()
	u.current = d
	u.mu.Unlock()
	if !d.Exists {
		sendJSON(w, 200, map[string]any{"update": false, "message": "Koristiš najnoviju dostupnu verziju (v" + appVersion + ")."})
		return
	}
	sendJSON(w, 200, map[string]any{"update": true, "version": d.Tag, "message": "Dostupna je nova verzija. Možeš je preuzeti i instalirati direktno iz aplikacije."})
}
func (u *updater) download(ctx context.Context, url string, maxSize int64) ([]byte, error) {
	if !strings.HasPrefix(url, "https://github.com/") {
		return nil, errors.New("Neispravan GitHub download URL")
	}
	req, e := http.NewRequestWithContext(ctx, "GET", url, nil)
	if e != nil {
		return nil, e
	}
	req.Header.Set("User-Agent", "Keldin-Obracun-Desktop/"+appVersion)
	res, e := u.http.Do(req)
	if e != nil {
		return nil, e
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return nil, fmt.Errorf("Neuspješno preuzimanje (HTTP %d)", res.StatusCode)
	}
	b, e := io.ReadAll(io.LimitReader(res.Body, maxSize+1))
	if e != nil {
		return nil, e
	}
	if int64(len(b)) > maxSize {
		return nil, errors.New("Datoteka prelazi dopuštenu veličinu")
	}
	return b, nil
}
func (u *updater) install(w http.ResponseWriter, r *http.Request) {
	if !requiresPost(w, r) {
		return
	}
	u.mu.Lock()
	d := u.current
	u.mu.Unlock()
	if !d.Exists {
		fail(w, 409, "Prvo provjeri dostupnost nove verzije.")
		return
	}
	// Re-check latest tag before proceeding, so stale checks cannot install arbitrary files.
	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()
	fresh, e := u.releaseInfo(ctx)
	if e != nil {
		fail(w, 502, e.Error())
		return
	}
	if !fresh.Exists || fresh.Tag != d.Tag || fresh.BinaryURL != d.BinaryURL || fresh.DigestURL != d.DigestURL {
		fail(w, 409, "Izdanje se promijenilo. Ponovo provjeri ažuriranja.")
		return
	}
	hashData, e := u.download(ctx, d.DigestURL, 8192)
	if e != nil {
		fail(w, 502, "Ne mogu preuzeti SHA-256 kontrolni zbroj: "+e.Error())
		return
	}
	expected := strings.ToLower(hexRE.FindString(strings.TrimSpace(string(hashData))))
	if len(expected) != 64 {
		fail(w, 422, "Neispravna SHA-256 datoteka: ažuriranje je odbijeno.")
		return
	}
	binary, e := u.download(ctx, d.BinaryURL, 120*1024*1024)
	if e != nil {
		fail(w, 502, "Ne mogu preuzeti novu verziju: "+e.Error())
		return
	}
	sum := sha256.Sum256(binary)
	if hex.EncodeToString(sum[:]) != expected {
		fail(w, 422, "SHA-256 provjera nije prošla. Nova verzija nije instalirana.")
		return
	}
	// Validate the downloaded artifact for the current platform.
	if runtime.GOOS == "windows" && (len(binary) < 2 || string(binary[:2]) != "MZ") {
		fail(w, 422, "Preuzeta datoteka nije Windows installer. Ažuriranje je zaustavljeno.")
		return
	}

	if runtime.GOOS == "darwin" && (len(binary) < 4 || binary[0] != 0xcf || binary[1] != 0xfa || binary[2] != 0xed || binary[3] != 0xfe) {
		fail(w, 422, "Preuzeta datoteka nije macOS Intel program. Ažuriranje je zaustavljeno.")
		return
	}
	me, e := os.Executable()
	if e != nil {
		fail(w, 500, e.Error())
		return
	}
	// macOS app bundles can be translocated or stored in a read-only folder.
	if runtime.GOOS == "darwin" {
		path := filepath.ToSlash(me)
		if strings.Contains(path, "/AppTranslocation/") || !strings.Contains(path, ".app/Contents/MacOS/") {
			fail(w, 409, "Premjesti Obracun.app u folder Applications (ili ~/Applications) i otvori ga odatle prije ažuriranja.")
			return
		}
		probe, pe := os.CreateTemp(filepath.Dir(me), ".obracun-permission-test-*")
		if pe != nil {
			fail(w, 403, "Aplikacija nema dozvolu za izmjene na ovom mjestu. Premjesti Obracun.app u ~/Applications pa ponovi ažuriranje.")
			return
		}
		_ = probe.Close()
		_ = os.Remove(probe.Name())
	}
	// Preserve the old app and profile. Windows installs via the standard
	// Start-menu installer; macOS replaces its app-bundle executable.
	tempDir := filepath.Join(u.dir, "updates")
	if e = os.MkdirAll(tempDir, 0700); e != nil {
		fail(w, 500, e.Error())
		return
	}
	pending := "Obracun-Setup-Pending.exe"
	if runtime.GOOS == "darwin" {
		pending = "Obracun-Pending"
	}
	newPath := filepath.Join(tempDir, pending)
	if e = os.WriteFile(newPath, binary, 0700); e != nil {
		fail(w, 500, "Ne mogu zapisati ažuriranje: "+e.Error())
		return
	}
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		// Run a copy of this executable as a detached helper, so the
		// original executable is closed before the installer overwrites it.
		helper := filepath.Join(tempDir, fmt.Sprintf("Obracun-Update-Helper-%d.exe", time.Now().UnixNano()))
		if e = copyExecutable(me, helper); e != nil {
			fail(w, 500, "Ne mogu pripremiti update helper: "+e.Error())
			return
		}
		cmd = exec.Command(helper, "--apply-installer", newPath, me)
		setHiddenWindow(cmd)
	} else {
		cmd = exec.Command(newPath, "--apply-update", me)
	}
	if e = cmd.Start(); e != nil {
		fail(w, 500, "Ne mogu pokrenuti ažuriranje: "+e.Error())
		return
	}
	sendJSON(w, 200, map[string]string{"message": "Nova verzija je preuzeta i provjerena. Aplikacija se sada ponovo pokreće."})
	go func() { time.Sleep(1500 * time.Millisecond); os.Exit(0) }()
}
func logFile(message string) {
	dir := settingsDir()
	_ = os.MkdirAll(dir, 0700)
	f, e := os.OpenFile(filepath.Join(dir, "desktop.log"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if e != nil {
		return
	}
	defer f.Close()
	_, _ = fmt.Fprintf(f, "%s %s\n", time.Now().Format(time.RFC3339), message)
}
func copyExecutable(from, to string) error {
	in, e := os.Open(from)
	if e != nil {
		return e
	}
	defer in.Close()
	f, e := os.OpenFile(to, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0700)
	if e != nil {
		return e
	}
	_, e = io.Copy(f, in)
	if e1 := f.Sync(); e == nil {
		e = e1
	}
	if e1 := f.Close(); e == nil {
		e = e1
	}
	return e
}
// applyInstaller runs from a temporary helper executable. The installer is
// launched only once the previous local server has stopped.
func applyInstaller(installer, previousExecutable string) {
	if runtime.GOOS != "windows" {
		return
	}
	stopped := false
	for attempt := 0; attempt < 100; attempt++ {
		conn, err := net.DialTimeout("tcp", listenAddress, 200*time.Millisecond)
		if err != nil {
			stopped = true
			break
		}
		_ = conn.Close()
		time.Sleep(300 * time.Millisecond)
	}
	if !stopped {
		logFile("Update instalacija otkazana: prethodna verzija je i dalje pokrenuta.")
		return
	}
	cmd := exec.Command(installer, "/S")
	setHiddenWindow(cmd)
	if err := cmd.Run(); err != nil {
		logFile("Windows installer nije uspio: " + err.Error())
		return
	}
	// A previous portable copy is migrated to the persistent installed app.
	installed := filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "Obracun", "Obracun-Windows.exe")
	if _, err := os.Stat(filepath.Join(filepath.Dir(previousExecutable), "Uninstall.exe")); err == nil {
		installed = previousExecutable
	}
	if _, err := os.Stat(installed); err != nil {
		logFile("Ažuriranje je završeno, ali instalirana aplikacija nije pronađena: " + err.Error())
		return
	}
	cmd = exec.Command(installed)
	setHiddenWindow(cmd)
	if err := cmd.Start(); err != nil {
		logFile("Ne mogu otvoriti instalirani OBRAČUN: " + err.Error())
	}
}

// Update Finder's app version after successfully replacing the executable.
// User data lives in a separate browser profile and is never changed here.
func updateMacBundleVersion(target string) {
	contents := filepath.Dir(filepath.Dir(target))
	plist := filepath.Join(contents, "Info.plist")
	body, err := os.ReadFile(plist)
	if err != nil {
		logFile("macOS Info.plist: " + err.Error())
		return
	}
	rx := regexp.MustCompile("(<key>CFBundle(?:ShortVersionString|Version)</key>\\s*<string>)[^<]+(</string>)")
	changed := rx.ReplaceAllStringFunc(string(body), func(match string) string {
		parts := rx.FindStringSubmatch(match)
		if len(parts) != 3 {
			return match
		}
		return parts[1] + appVersion + parts[2]
	})
	if changed != string(body) {
		if err := os.WriteFile(plist, []byte(changed), 0644); err != nil {
			logFile("macOS Info.plist update: " + err.Error())
		}
	}
}

func applyUpdate(target string) {
	target, e := filepath.Abs(target)
	if e != nil {
		logFile("Neispravna putanja ažuriranja: " + e.Error())
		return
	}
	current, e := os.Executable()
	if e != nil {
		logFile(e.Error())
		return
	}
	staged := target + ".update-new"
	bak := target + ".previous"
	for i := 0; i < 40; i++ { // Wait for previous process to release the Windows executable lock.
		_ = os.Remove(staged)
		if e = copyExecutable(current, staged); e == nil {
			_ = os.Remove(bak)
			if e = os.Rename(target, bak); e == nil {
				if e = os.Rename(staged, target); e == nil {
					var cmd *exec.Cmd
					if runtime.GOOS == "darwin" {
						updateMacBundleVersion(target)
						bundle := filepath.Dir(filepath.Dir(filepath.Dir(target)))
						cmd = exec.Command("open", "-a", bundle)
					} else {
						cmd = exec.Command(target)
						if runtime.GOOS == "windows" {
							setHiddenWindow(cmd)
						}
					}
					if e = cmd.Start(); e != nil {
						logFile("Novi program nije pokrenut: " + e.Error())
					}
					return
				}
				_ = os.Rename(bak, target)
			}
		}
		time.Sleep(500 * time.Millisecond)
	}
	logFile("Ažuriranje nije uspjelo: " + fmt.Sprint(e))
}
func openAppWindow() {
	url := "http://" + listenAddress + "/"
	dir := filepath.Join(settingsDir(), "BrowserProfile")
	_ = os.MkdirAll(dir, 0700)
	candidates := []string{}
	if runtime.GOOS == "windows" {
		for _, root := range []string{os.Getenv("ProgramFiles(x86)"), os.Getenv("ProgramFiles"), os.Getenv("LOCALAPPDATA")} {
			if root != "" {
				candidates = append(candidates, filepath.Join(root, "Microsoft", "Edge", "Application", "msedge.exe"))
			}
		}
		candidates = append(candidates, "msedge.exe")
	} else if runtime.GOOS == "darwin" {
		home, _ := os.UserHomeDir()
		// Chromium-based browsers open an app-style window with a separate persistent profile.
		for _, dir := range []string{"/Applications", filepath.Join(home, "Applications")} {
			candidates = append(candidates,
				filepath.Join(dir, "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
				filepath.Join(dir, "Microsoft Edge.app", "Contents", "MacOS", "Microsoft Edge"),
				filepath.Join(dir, "Brave Browser.app", "Contents", "MacOS", "Brave Browser"),
				filepath.Join(dir, "Chromium.app", "Contents", "MacOS", "Chromium"))
		}
	} else {
		candidates = []string{"chromium", "google-chrome", "microsoft-edge"}
	}
	for _, p := range candidates {
		if _, e := os.Stat(p); e != nil && strings.Contains(p, string(filepath.Separator)) {
			continue
		}
		cmd := exec.Command(p, "--app="+url, "--user-data-dir="+dir, "--no-first-run", "--disable-features=TranslateUI,Translate")
		if e := cmd.Start(); e == nil {
			// Once the window is closed, stop the embedded local server as well.
			go func() { _ = cmd.Wait(); time.Sleep(2 * time.Second); os.Exit(0) }()
			return
		}
	}
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", url)
	} else if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", url)
	} else {
		cmd = exec.Command("xdg-open", url)
	}
	if e := cmd.Start(); e != nil {
		logFile("Nije moguće otvoriti prozor: " + e.Error())
	}
}
func main() {
	if len(os.Args) >= 4 && os.Args[1] == "--apply-installer" {
		applyInstaller(os.Args[2], os.Args[3])
		return
	}
	if len(os.Args) >= 3 && os.Args[1] == "--apply-update" {
		applyUpdate(os.Args[2])
		return
	}
	u := newUpdater()
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		b, e := assets.ReadFile("app/index.html")
		if e != nil {
			http.Error(w, e.Error(), 500)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Write(b)
	})
	mux.HandleFunc("/desktop.js", func(w http.ResponseWriter, r *http.Request) {
		b, _ := assets.ReadFile("app/desktop.js")
		w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Write(b)
	})
	mux.HandleFunc("/api/cloud/config", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		b, e := assets.ReadFile("app/cloud-config.json")
		if e != nil {
			http.Error(w, "Cloud configuration unavailable", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = w.Write(b)
	})
	mux.HandleFunc("/runtime.js", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet { w.WriteHeader(http.StatusMethodNotAllowed); return }
		b, e := assets.ReadFile("app/runtime.bundle.js")
		if e != nil { http.Error(w, "UI runtime unavailable", http.StatusInternalServerError); return }
		w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = w.Write(b)
	})
	mux.HandleFunc("/i18n.js", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {w.WriteHeader(http.StatusMethodNotAllowed);return}
		data, err := assets.ReadFile("app/i18n.js")
		if err != nil {http.Error(w,"UI component unavailable",http.StatusInternalServerError);return}
		w.Header().Set("Content-Type","text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control","no-store")
		_,_ = w.Write(data)
	})
	mux.HandleFunc("/periods.js",func(w http.ResponseWriter,r *http.Request){
		if r.Method!=http.MethodGet {w.WriteHeader(http.StatusMethodNotAllowed);return}
		b,err:=assets.ReadFile("app/periods.js")
		if err!=nil {http.Error(w,"UI unavailable",http.StatusInternalServerError);return}
		w.Header().Set("Content-Type","text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control","no-store")
		w.Header().Set("X-Content-Type-Options","nosniff")
		_,_=w.Write(b)
	})
	mux.HandleFunc("/report-v2.js",func(w http.ResponseWriter,r *http.Request){
		if r.Method!=http.MethodGet {w.WriteHeader(http.StatusMethodNotAllowed);return}
		b,err:=assets.ReadFile("app/report-v2.js")
		if err!=nil {http.Error(w,"UI unavailable",http.StatusInternalServerError);return}
		w.Header().Set("Content-Type","text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control","no-store")
		w.Header().Set("X-Content-Type-Options","nosniff")
		_,_=w.Write(b)
	})
	mux.HandleFunc("/signature-pad.js",func(w http.ResponseWriter,r *http.Request){
		if r.Method!=http.MethodGet {w.WriteHeader(http.StatusMethodNotAllowed);return}
		b,err:=assets.ReadFile("app/signature-pad.js")
		if err!=nil {http.Error(w,"UI unavailable",http.StatusInternalServerError);return}
		w.Header().Set("Content-Type","text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control","no-store")
		w.Header().Set("X-Content-Type-Options","nosniff")
		_,_=w.Write(b)
	})
	mux.HandleFunc("/measurement-editor.js", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {w.WriteHeader(http.StatusMethodNotAllowed);return}
		data, err := assets.ReadFile("app/measurement-editor.js")
		if err != nil {http.Error(w,"UI component unavailable",http.StatusInternalServerError);return}
		w.Header().Set("Content-Type","text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control","no-store")
		_,_ = w.Write(data)
	})
	mux.HandleFunc("/engineering.js", func(w http.ResponseWriter, r *http.Request) {
		b, e := assets.ReadFile("app/engineering.js")
		if e != nil { http.Error(w, "Engineering module unavailable", http.StatusInternalServerError); return }
		w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = w.Write(b)
	})
	mux.HandleFunc("/cloud.js", func(w http.ResponseWriter, r *http.Request) {
		b, _ := assets.ReadFile("app/cloud.js")
		w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Write(b)
	})
	mux.HandleFunc("/icon.svg", func(w http.ResponseWriter, r *http.Request) {
		b, _ := assets.ReadFile("branding/obracun-icon.svg")
		w.Header().Set("Content-Type", "image/svg+xml")
		w.Header().Set("Cache-Control", "public, max-age=3600")
		w.Write(b)
	})
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Obracun-Instance", "desktop")
		sendJSON(w, 200, map[string]string{"version": appVersion, "status": "ready"})
	})
	mux.HandleFunc("/api/update/settings", u.updateSettings)
	mux.HandleFunc("/api/update/check", u.check)
	mux.HandleFunc("/api/update/install", u.install)
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}
	ln, e := net.Listen("tcp", listenAddress)
	if e != nil {
		c := &http.Client{Timeout: 1500 * time.Millisecond}
		res, er := c.Get("http://" + listenAddress + "/api/health")
		if er != nil {
			logFile("Port nije dostupan: " + e.Error())
			return
		}
		valid := res.Header.Get("X-Obracun-Instance") == "desktop"
		var running struct {
			Version string `json:"version"`
		}
		_ = json.NewDecoder(io.LimitReader(res.Body, 4096)).Decode(&running)
		_ = res.Body.Close()
		if !valid {
			logFile("Port već koristi drugi program")
			return
		}
		if running.Version != appVersion {
			logFile("Druga verzija OBRAČUNA je već pokrenuta: " + running.Version)
			showRunningVersionAlert(running.Version)
			return
		}
		openAppWindow()
		return
	}
	go func() {
		if e := server.Serve(ln); e != nil && !errors.Is(e, http.ErrServerClosed) {
			logFile("HTTP server: " + e.Error())
		}
	}()
	if os.Getenv("OBRACUN_TEST_NO_WINDOW") != "1" {
		openAppWindow()
	}
	<-context.Background().Done() // Lifetime controlled by desktop window closing.
}