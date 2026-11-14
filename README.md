# OBRAČUN v0.2.1 — Windows i macOS Intel

## Windows instalacija (10/11 x64)

Preuzmi `Obracun-Setup-Windows.exe` iz [GitHub Releases](https://github.com/keldin94/obracun-desktop/releases/latest).
Zatvori sve stare prozore i pokrenute portable kopije OBRAČUNA, zatim pokreni instalacijski paket.
Instalira se bez administratorskih prava u `%LOCALAPPDATA%\Programs\Obracun`.

- **Start → OBRAČUN → OBRAČUN** i desktop prečica otvaraju *istu instaliranu* aplikaciju.
- **Settings → Apps → Installed apps** prikazuje OBRAČUN s opcijom deinstalacije.
- Svaki novi update preuzima `Obracun-Setup-Windows.exe` i SHA-256, zatvara staru aplikaciju, izvršava installer u tihom načinu te ponovo otvara instaliranu verziju.
- Deinstalacija ne briše obračune ni dokaznice iz korisničkog profila.
- `Obracun-Windows.exe` ostaje u izdanjima samo zbog kompatibilnosti sa ranijim prenosivim verzijama. **Za prvu instalaciju koristi Setup, a ne sam EXE.**

Lokalni podaci ostaju u `%LOCALAPPDATA%\Keldin Obracun\BrowserProfile` (Edge preglednik).
**Prije prve instalacije** napravi backup u aplikaciji: Postavke → Izvezi backup.
Ako je stara prenosiva verzija otvorena, zatvori je *prije* otvaranja instalirane aplikacije.

## macOS Intel (MacBook Pro 2016/2017)

Preuzmi `Obracun-macOS-Intel.dmg` (ili `Obracun-macOS-Intel.zip`).
Otvoriti disk image i prevući `Obracun.app` u Applications. Za automatske nadogradnje je preporučen `~/Applications`, gdje korisnik ima pravo upisa. Možeš aplikaciju staviti u Dock.
App se pokreće iz Launchpada, Spotlighta ili Applications, bez komandi.
`Provjeri ažuriranja` preuzima provjeren novi macOS Intel executable, zamjenjuje njegov sadržaj u `.app` i ponovo otvara app.

Mac aplikacija nije Apple Developer ID potpisana ni notarizovana. Prvo pokretanje može tražiti System Settings → Privacy & Security → Open Anyway.
Lokalni Chrome/Edge/Brave profil: `~/Library/Application Support/Keldin Obracun/BrowserProfile`.
Uz Safari fallback podaci su u Safarijevom zasebnom profilu/podacima za ovaj lokalni origin, pa ne mijenjaj preglednik bez backupa.

## Ažuriranja u aplikaciji

Pritisni **Provjeri ažuriranja**. Program provjerava verziju na GitHub Releases i, ako postoji novija, nudi **Instaliraj novu verziju**.
Oba sistema koriste zajednički kod. Izvorne datoteke se ne preuzimaju ručno.
GitHub Actions kreira Windows Setup i EXE, macOS Intel .app ZIP i DMG, te SHA-256 za preuzete pakete.
Novi installer je namijenjen ažuriranju instalirane Windows verzije; prva migracija s portable EXE-a na Setup je ručna.

Napomena: provjera SHA-256 štiti od oštećenog preuzimanja, ali ne zamjenjuje digitalni potpis. Instalaciju i update treba testirati i na korisničkim računarima.

## Cloud

Centralna cloud baza još nije aktivirana. Lokalni rad funkcioniše i bez interneta.
Projekt sadrži model registracije, firme, uloga i gradilišta te migraciju `supabase/002_organizations.sql`.
Prije uključivanja provjeriti Supabase Auth, RLS, odvojene firme i backup. Vidi `docs/cloud-setup.md`.

## Razvoj

`go test ./...` i `go vet ./...`. Workflow `.github/workflows/windows-release.yml` izrađuje i provjerava pakete.
`packaging/windows/installer.nsi` je NSIS installer. `packaging/macos/Info.plist` opisuje macOS app.
U nastavku zadržati korisničke podatke u istoj putanji i instalacijsku putanju stabilnom radi nadogradnji.
