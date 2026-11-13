# OBRAČUN – Windows v0.1.1

## Pokretanje na Windows 10 / 11 (64-bit)

1. Preuzmi `Obracun-Windows.exe` i spremi ga u trajni folder, npr. `Dokumenti\Obracun`.
2. Dvaput klikni EXE. Program otvara vlastiti prozor preko instaliranog Microsoft Edge preglednika (bez adresne trake i dodatnih kartica).
3. Ne treba instalirati Node, Python ili drugi razvojni alat. Internet nije potreban za obračune; samo za provjeru ažuriranja.
4. Podaci i prilozi ostaju u `%LOCALAPPDATA%\Keldin Obracun\BrowserProfile`, odvojeno od uobičajenog Edge profila i EXE datoteke.
5. U aplikaciji koristi **Postavke i sigurnosna kopija → Izvezi backup** za dodatnu zaštitu podataka.

Ovo je *prenosiva* (portable) EXE aplikacija, **nije MSI instalacijski paket**. Nije digitalno potpisana; Windows može prikazati upozorenje za nepoznatog izdavača. Nemoj ignorisati sigurnosna upozorenja ako ne vjeruješ porijeklu datoteke.

## Ažuriranja direktno iz aplikacije

Donji desni ugao → **Provjeri ažuriranja**. Aplikacija:

- Preuzima podatke o najnovijem izdanju iz GitHub Releases.
- Uspoređuje verzije (format `v0.1.2`, `v0.2.0` itd.).
- Preuzima `Obracun-Windows.exe` i datoteku `Obracun-Windows.exe.sha256`.
- Provjerava SHA-256 sažetak, priprema zamjenu EXE i ponovo pokreće aplikaciju.
- Ne briše korisnički Edge profil, obračune ni dokaznice pri updateu.

**Važno:** GitHub repozitorij `keldin94/obracun-desktop` je aktivan. Preuzmi instalacijsku datoteku iz odjeljka Releases nakon uspješnog builda.

SHA-256 provjera štiti integritet preuzetog EXE, ali ne zamjenjuje digitalno potpisivanje binarne datoteke. Prije javne distribucije preporučeno je Windows code signing.

## Funkcije

- Uvoz popisa `.xlsx`, `.xlsm`, `.csv`, ručno mapiranje kolona i dodavanje stavki.
- Obračunski listovi po postavci: formula, period, lokacija, historija, kumulativne količine.
- Dokaznice povezane sa postavkama: PDF / JPG / PNG / WebP.
- Ispis mjesečne knjige na PDF kroz Windows printer `Save as PDF` / `Spremi kao PDF`.
- Backup i povrat JSON podataka iz aplikacije.

**Trenutna ograničenja:** u ovoj prenosivoj verziji postojeći PDF prilozi su navedeni, ali nisu automatski fizički spojeni iza obračunskog PDF-a. Nema login sistema, cloud sinhronizacije, prava korisnika, niti zasebnog MSI instalera.

## Razvoj i izrada nove EXE verzije

Potreban Go 1.22+:

```powershell
$env:GOOS="windows"
$env:GOARCH="amd64"
$env:CGO_ENABLED="0"
go build -trimpath -ldflags="-s -w -H=windowsgui" -o Obracun-Windows.exe .
Get-FileHash .\Obracun-Windows.exe -Algorithm SHA256
```

Prije naredne objave promijeni `appVersion` u `main.go` i verziju u `app/desktop.js` / `app/index.html` (npr. `0.1.2`). Nakon izrade objavi `Obracun-Windows.exe` i tekstualni SHA256 fajl sa sadržajem `HASH  Obracun-Windows.exe` u GitHub Releases s tagom `v0.1.2`.

Aplikacija koristi jednu HTML/JS osnovu; za iOS, iPadOS, Android i macOS u narednim fazama može se koristiti drugi, prilagođen aplikacijski omotač, uz zadržavanje modela obračuna i UI-ja.

## Automatska objava novih verzija na GitHubu

`.github/workflows/windows-release.yml` pokreće Go testove pri svakom pushu
na `main`, gradi Windows x64 EXE, ZIP paket i SHA-256 datoteku. Ako nije objavljen GitHub
Release s oznakom trenutne verzije (npr. `v0.1.1`), automatski ga objavljuje.
Repozitorij mora imati uključen GitHub Actions i dozvolu `Read and write permissions`
za workflow (Settings → Actions → General).

Za novu verziju promijeni `appVersion` u `main.go` i tekst verzije u
`app/desktop.js` (npr. na 0.1.2), testiraj pa pošalji izmjene u `main`.
Release se tada automatski objavi, a korisnik vidi novu verziju pod
**Provjeri ažuriranja**. Ne treba ručno postavljati EXE ni SHA-256 asset.

Za produkcijsku distribuciju dodati test na stvarnom Windows računaru,
digitalno potpisivanje i zaštitu procesa izdavanja.
## GitHub

Izvorni kod: https://github.com/keldin94/obracun-desktop

Izdanje za preuzimanje: https://github.com/keldin94/obracun-desktop/releases/latest

Ova prva verzija nije testirana na stvarnom Windows računaru. Prije stvarne upotrebe redovno izvoziti rezervne kopije obračuna.
