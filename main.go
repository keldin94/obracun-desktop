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
 "strconv"
 "strings"
 "sync"
 "time"
)

const (
 appVersion = "0.1.1"
 addr = "127.0.0.1:17861"
 defaultRepo = "keldin94/obracun-desktop"
 exeAsset = "Obracun-Windows.exe"
)

//go:embed app/index.html app/desktop.js
var files embed.FS

type config struct { Repo string `json:"repo"` }
type asset struct {
 Name string `json:"name"`
 URL string `json:"browser_download_url"`
 Size int64 `json:"size"`
}
type release struct {
 Tag string `json:"tag_name"`
 Assets []asset `json:"assets"`
}
type update struct {
 Tag string
 Binary string
 Digest string
 Size int64
 New bool
}
type service struct {
 mu sync.Mutex
 conf config
 selected update
 http *http.Client
 dir string
}
var repositoryPattern=regexp.MustCompile("^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$")
var digestPattern=regexp.MustCompile("(?i)^[a-f0-9]{64}\\b")

func dataDir() string {
 if a:=os.Getenv("LOCALAPPDATA");a!="" {return filepath.Join(a,"Keldin Obracun")}
 a,e:=os.UserConfigDir();if e!=nil{return "."}
 return filepath.Join(a,"Keldin Obracun")
}
func allowedRedirect(req *http.Request, via []*http.Request) error {
 if len(via)>8 || req.URL.Scheme!="https" {return errors.New("Nepouzdano preusmjeravanje")}
 switch strings.ToLower(req.URL.Hostname()) {
 case "github.com","api.github.com","objects.githubusercontent.com","release-assets.githubusercontent.com","github-releases.githubusercontent.com":
  return nil
 }
 return errors.New("Nepoznata domena za preuzimanje")
}
func newService() *service {
 dir:=dataDir();_ = os.MkdirAll(dir,0700)
 s:=&service{dir:dir,conf:config{Repo:defaultRepo},http:&http.Client{Timeout:150*time.Second,CheckRedirect:allowedRedirect}}
 if b,e:=os.ReadFile(filepath.Join(dir,"settings.json"));e==nil {
  var c config
  if json.Unmarshal(b,&c)==nil && validRepo(c.Repo){s.conf=c}
 }
 return s
}
func validRepo(r string) bool{return repositoryPattern.MatchString(r)&&!strings.Contains(r,"..")}
func reply(w http.ResponseWriter,n int,v any) {
 w.Header().Set("Content-Type","application/json; charset=utf-8")
 w.Header().Set("Cache-Control","no-store")
 w.WriteHeader(n);_ = json.NewEncoder(w).Encode(v)
}
func failure(w http.ResponseWriter,n int,e string){reply(w,n,map[string]string{"error":e})}
func postAllowed(w http.ResponseWriter,r *http.Request) bool {
 if r.Method!="POST" {failure(w,405,"Nedopuštena metoda");return false}
 if r.Header.Get("Origin")!="http://"+addr {failure(w,403,"Neispravno porijeklo zahtjeva");return false}
 if !strings.HasPrefix(r.Header.Get("Content-Type"),"application/json"){failure(w,415,"Potreban JSON zahtjev");return false}
 return true
}
func (s *service) settings(w http.ResponseWriter,r *http.Request){
 if r.Method=="GET" {s.mu.Lock();c:=s.conf;s.mu.Unlock();reply(w,200,c);return}
 if !postAllowed(w,r){return}
 var c config
 if e:=json.NewDecoder(io.LimitReader(r.Body,2048)).Decode(&c);e!=nil{failure(w,400,"Neispravan JSON");return}
 c.Repo=strings.TrimSpace(c.Repo)
 if !validRepo(c.Repo){failure(w,400,"Repo mora biti vlasnik/naziv");return}
 b,_:=json.Marshal(c)
 s.mu.Lock()
 e:=os.WriteFile(filepath.Join(s.dir,"settings.json"),b,0600)
 if e==nil{s.conf=c;s.selected=update{}}
 s.mu.Unlock()
 if e!=nil{failure(w,500,e.Error());return}
 reply(w,200,c)
}
func parts(v string) ([3]int,bool){
 var out [3]int
 ss:=strings.Split(strings.TrimPrefix(v,"v"),".")
 if len(ss)!=3{return out,false}
 for i,p:=range ss {
  x,e:=strconv.Atoi(p)
  if e!=nil||x<0||x>100000||p==""{return out,false}
  out[i]=x
 }
 return out,true
}
func newer(v string)bool{
 a,ok:=parts(appVersion);b,ok2:=parts(v)
 if !ok||!ok2{return false}
 for i:=0;i<3;i++{if b[i]>a[i]{return true};if b[i]<a[i]{return false}}
 return false
}
func (s *service) latest(ctx context.Context)(update,error){
 s.mu.Lock();repo:=s.conf.Repo;s.mu.Unlock()
 req,e:=http.NewRequestWithContext(ctx,"GET","https://api.github.com/repos/"+repo+"/releases/latest",nil)
 if e!=nil{return update{},e}
 req.Header.Set("Accept","application/vnd.github+json")
 req.Header.Set("User-Agent","Obracun-Windows/"+appVersion)
 res,e:=s.http.Do(req);if e!=nil{return update{},e};defer res.Body.Close()
 if res.StatusCode==404{return update{},errors.New("U repozitoriju još nema objavljenog izdanja")}
 if res.StatusCode!=200{return update{},fmt.Errorf("GitHub HTTP %d",res.StatusCode)}
 var rel release
 if e=json.NewDecoder(io.LimitReader(res.Body,1024*1024)).Decode(&rel);e!=nil{return update{},e}
 u:=update{Tag:rel.Tag,New:newer(rel.Tag)}
 for _,a:=range rel.Assets{
  if a.Name==exeAsset{u.Binary=a.URL;u.Size=a.Size}
  if a.Name==exeAsset+".sha256"{u.Digest=a.URL}
 }
 if u.New&&(u.Binary==""||u.Digest==""||u.Size<1||u.Size>120*1024*1024){
  return update{},errors.New("Nova verzija nema ispravne EXE i SHA-256 priloge")
 }
 return u,nil
}
func(s *service)check(w http.ResponseWriter,r *http.Request){
 if r.Method!="GET"{failure(w,405,"Nedopuštena metoda");return}
 ctx,cancel:=context.WithTimeout(r.Context(),45*time.Second);defer cancel()
 u,e:=s.latest(ctx);if e!=nil{failure(w,502,e.Error());return}
 s.mu.Lock();s.selected=u;s.mu.Unlock()
 if !u.New{reply(w,200,map[string]any{"update":false,"message":"Koristiš najnoviju verziju (v"+appVersion+")."});return}
 reply(w,200,map[string]any{"update":true,"version":u.Tag,"message":"Dostupna je nova verzija."})
}
func(s *service)download(ctx context.Context,url string,max int64)([]byte,error){
 if !strings.HasPrefix(url,"https://github.com/"){return nil,errors.New("Neispravna GitHub adresa")}
 req,e:=http.NewRequestWithContext(ctx,"GET",url,nil);if e!=nil{return nil,e}
 req.Header.Set("User-Agent","Obracun-Windows/"+appVersion)
 res,e:=s.http.Do(req);if e!=nil{return nil,e};defer res.Body.Close()
 if res.StatusCode!=200{return nil,fmt.Errorf("Preuzimanje: HTTP %d",res.StatusCode)}
 b,e:=io.ReadAll(io.LimitReader(res.Body,max+1))
 if e!=nil{return nil,e}
 if int64(len(b))>max{return nil,errors.New("Datoteka je prevelika")}
 return b,nil
}
func(s *service)install(w http.ResponseWriter,r *http.Request){
 if !postAllowed(w,r){return}
 s.mu.Lock();u:=s.selected;s.mu.Unlock()
 if !u.New{failure(w,409,"Prvo provjeri ažuriranja");return}
 ctx,cancel:=context.WithTimeout(r.Context(),130*time.Second);defer cancel()
 fresh,e:=s.latest(ctx)
 if e!=nil{failure(w,502,e.Error());return}
 if !fresh.New||fresh.Tag!=u.Tag||fresh.Binary!=u.Binary||fresh.Digest!=u.Digest{failure(w,409,"Izdanje se promijenilo. Ponovi provjeru.");return}
 h,e:=s.download(ctx,u.Digest,8192)
 if e!=nil{failure(w,502,"SHA-256: "+e.Error());return}
 expected:=strings.ToLower(digestPattern.FindString(strings.TrimSpace(string(h))))
 if len(expected)!=64{failure(w,422,"SHA-256 datoteka nije ispravna");return}
 exe,e:=s.download(ctx,u.Binary,120*1024*1024)
 if e!=nil{failure(w,502,e.Error());return}
 sum:=sha256.Sum256(exe)
 if hex.EncodeToString(sum[:])!=expected{failure(w,422,"SHA-256 provjera nije uspjela");return}
 current,e:=os.Executable();if e!=nil{failure(w,500,e.Error());return}
 dir:=filepath.Join(s.dir,"updates");if e=os.MkdirAll(dir,0700);e!=nil{failure(w,500,e.Error());return}
 candidate:=filepath.Join(dir,"Obracun-Pending.exe")
 if e=os.WriteFile(candidate,exe,0700);e!=nil{failure(w,500,e.Error());return}
 cmd:=exec.Command(candidate,"--apply-update",current)
 if runtime.GOOS=="windows"{setHiddenWindow(cmd)}
 if e=cmd.Start();e!=nil{failure(w,500,e.Error());return}
 reply(w,200,map[string]string{"message":"Provjera je prošla. Instalacija i ponovno pokretanje su pokrenuti."})
 go func(){time.Sleep(1200*time.Millisecond);os.Exit(0)}()
}
func applyUpdate(target string){
 target,e:=filepath.Abs(target);if e!=nil{return}
 self,e:=os.Executable();if e!=nil{return}
 b,e:=os.ReadFile(self);if e!=nil{return}
 staged:=target+".update-new";backup:=target+".previous"
 for i:=0;i<45;i++{
  _=os.Remove(staged)
  if os.WriteFile(staged,b,0700)==nil {
   _=os.Remove(backup)
   if os.Rename(target,backup)==nil{
    if os.Rename(staged,target)==nil{
     cmd:=exec.Command(target);if runtime.GOOS=="windows"{setHiddenWindow(cmd)}
     _=cmd.Start()
     return
    }
    _=os.Rename(backup,target)
   }
  }
  time.Sleep(500*time.Millisecond)
 }
}
func openWindow(){
 url:="http://"+addr+"/"
 profile:=filepath.Join(dataDir(),"BrowserProfile")
 _=os.MkdirAll(profile,0700)
 candidates:=[]string{"msedge.exe"}
 if runtime.GOOS=="windows"{
  for _,root:=range []string{os.Getenv("ProgramFiles(x86)"),os.Getenv("ProgramFiles"),os.Getenv("LOCALAPPDATA")}{
   if root!=""{candidates=append([]string{filepath.Join(root,"Microsoft","Edge","Application","msedge.exe")},candidates...)}
  }
 }else{candidates=[]string{"chromium","google-chrome","microsoft-edge"}}
 for _,p:=range candidates{
  cmd:=exec.Command(p,"--app="+url,"--user-data-dir="+profile,"--no-first-run")
  if cmd.Start()==nil{
   go func(){_=cmd.Wait();time.Sleep(time.Second);os.Exit(0)}()
   return
  }
 }
 var cmd *exec.Cmd
 if runtime.GOOS=="windows"{cmd=exec.Command("rundll32.exe","url.dll,FileProtocolHandler",url)}else{cmd=exec.Command("xdg-open",url)}
 _=cmd.Start()
}
func main(){
 if len(os.Args)==3&&os.Args[1]=="--apply-update"{applyUpdate(os.Args[2]);return}
 s:=newService()
 mux:=http.NewServeMux()
 mux.HandleFunc("/",func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path!="/"{http.NotFound(w,r);return}
  b,e:=files.ReadFile("app/index.html");if e!=nil{http.Error(w,e.Error(),500);return}
  w.Header().Set("Content-Type","text/html; charset=utf-8");w.Header().Set("Cache-Control","no-store");_,_=w.Write(b)
 })
 mux.HandleFunc("/desktop.js",func(w http.ResponseWriter,r *http.Request){
  b,_:=files.ReadFile("app/desktop.js");w.Header().Set("Content-Type","text/javascript; charset=utf-8");_,_=w.Write(b)
 })
 mux.HandleFunc("/api/health",func(w http.ResponseWriter,r *http.Request){
  w.Header().Set("X-Obracun-Instance","desktop");reply(w,200,map[string]string{"status":"ready","version":appVersion})
 })
 mux.HandleFunc("/api/update/settings",s.settings)
 mux.HandleFunc("/api/update/check",s.check)
 mux.HandleFunc("/api/update/install",s.install)
 listener,e:=net.Listen("tcp",addr)
 if e!=nil{
  c:=http.Client{Timeout:1500*time.Millisecond}
  res,er:=c.Get("http://"+addr+"/api/health")
  if er==nil{ok:=res.Header.Get("X-Obracun-Instance")=="desktop";_=res.Body.Close();if ok{openWindow()}}
  return
 }
 server:=&http.Server{Handler:mux,ReadHeaderTimeout:10*time.Second}
 go func(){_=server.Serve(listener)}()
 if os.Getenv("OBRACUN_TEST_NO_WINDOW")!="1"{openWindow()}
 select{}
}
