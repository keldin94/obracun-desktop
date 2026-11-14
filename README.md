# OBRAČUN – Windows i macOS Intel v0.1.4

Desktop aplikacija za građevinske popise, obračunske listove i dokaznice. Jedan izvorni kod; dva paketa u istom GitHub izdanju.

## Windows (10/11, x64)

Preuzmi `Obracun-Windows.exe` iz GitHub Releases. Spremi ga u trajni folder i pokreni. Koristi instalirani Microsoft Edge u zasebnom prozoru. Nije potreban dodatni softver niti internet za rad s lokalnim podacima.

## macOS Intel (MacBook Pro 2016/2017, Intel i7)

1. Preuzmi `Obracun-macOS-Intel.zip` iz GitHub Releases.
2. Raspakuj i prevuci `Obracun.app` u `~/Applications` (preporučeno, jer ažuriranje zahtijeva pravo upisa u folder aplikacije). Alternativa je `/Applications` ako imaš dozvolu za izmjenu datoteka.
3. Pokreni `Obracun.app`. Ako macOS blokira nepotpisanu aplikaciju, klikni desnim klikom > **Open** ili koristi **System Settings → Privacy & Security → Open Anyway**, samo ako vjeruješ izvoru.
4. Za zaseban prozor bez adresne trake koristi Chrome / Microsoft Edge / Brave. Bez njih, aplikacija otvara macOS zadani preglednik (npr. Safari).

Pakirana aplikacija je Go server + lokalni UI preko browsera. Nije nativna SwiftUI aplikacija, ali je standardni `.app` paket za pokretanje iz Findera. Internet treba samo za preuzimanje i ažuriranje.

**Upozorenje:** `.app` nije digitalno potpisana niti Apple notarizovana. Nismo provjerili pokretanje na stvarnom macOS računaru; macOS Gatekeeper može blokirati izvršavanje. Bez Apple Developer ID certifikata nije moguća uobičajena notarizacija.

## Ažuriranja

Unutar aplikacije izaberi **Provjeri ažuriranja**. Windows preuzima `Obracun-Windows.exe`, a macOS Intel `Obracun-macOS-Intel`. Obje datoteke se provjeravaju s odgovarajućim `.sha256` kontrolnim zbrojem iz GitHub Releases. Zamjena se izvršava iz pomoćnog procesa. Kod macOS-a aplikacija mora biti u folderu u koji korisnik može pisati; AppTranslocation / read-only lokacije su blokirane.

SHA-256 štiti od slučajne korupcije, ali ne zamjenjuje potpisivanje izvoda i zaštitu objavljivanja verzija. Prije javne distribucije dodati potpisivanje i notarizaciju.

## Lokalni podaci

- Windows: `%LOCALAPPDATA%\Keldin Obracun\BrowserProfile` (Edge podaci i IndexedDB)
- macOS Chrome/Edge/Brave: `~/Library/Application Support/Keldin Obracun/BrowserProfile` (na macOS Safari fallback koristi Safari podatke)
- Podaci se ne sinhronizuju automatski između Windowsa i macOS-a.
- Napravi backup unutar aplikacije prije prvog ažuriranja.

## Izrada

U repozitoriju `.github/workflows/windows-release.yml` kompajlira i testira Go program na GitHub Actions, izrađuje oba paketa i GitHub Release na novoj oznaci verzije. `GOOS=darwin GOARCH=amd64 CGO_ENABLED=0` generiše Mac Intel izvršni program; `Info.plist` se nalazi u `packaging/macos`.

Za novu verziju promijeni `appVersion` u `main.go` i prikazanu verziju u `app/desktop.js`, pa pošalji izmjene u `main`. GitHub Action objavljuje zajedničko izdanje za oba sistema.

## Trenutna ograničenja

Nema cloud sinhronizacije, digitalnih potpisa, MSI/DMG instalera, niti nativnog macOS WebKit prozora. PDF se sprema kroz dijalog za ispis. PDF dokaznice se navode, ali se još ne spajaju fizički u jedan PDF.