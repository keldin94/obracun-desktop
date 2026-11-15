# OBRAČUN v0.3.7 — Windows i macOS Intel

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

## Obračunski listovi i grupe (v0.3.0)
- Jedan Excel sheet može sadržavati BETONSKA, TESARSKA i druge grupe; zaglavlja se prepoznaju, napomene i prazne (0/0) stavke se preskaču.
- Prije uvoza svakoj prepoznatoj poziciji možeš promijeniti grupu; poslije uvoza koristi **Organizuj grupe** za pojedinačne i grupne promjene.
- Naknadni uvoz podržava **Aneks** i uređivanje postojećih cijena/količina uz zapis prethodnih vrijednosti. Obračunski unosi ostaju sačuvani.
- Dimenzijski obračun po redovima A/B/C...: a,b,c,h,d,kos, odbici, plus/minus; puni decimalni proračun, formule i historija.
- Sliku iz clipboarda zalijepi sa Ctrl+V dok je otvorena postavka; fotografije i skice raspoređuju se automatski u A4 ispisu.
- Mjesečni PDF: pojedinačna postavka, jedna ili više grupa ili sve; opciona naslovnica/rekapitulacija i prazni listovi.
- **Ograničenje:** PNG/JPG slike su umetnute u ispis; dodatni PDF dokumenti su trenutno popisani, ne fizički spojeni s ispisom.
- Ažuriranja su premještena u **Postavke i backup → Provjeri ažuriranja**.
- Prije prvog nadograđivanja napravi backup. Stari obračuni ostaju sačuvani.

### Dodatna polja prema knjizi obračunskih izmera (v0.3.1)
U Podacima gradilišta možeš unijeti obračunski nacrt, stroškovno mjesto, izvođača, pripremio, predstavnika naručioca i odgovornog voditelja radova. Polja se ispisuju na A4 obračunskim listovima. Pojedinačne izmjere mogu imati oznaku materijala ili kvalitete betona. Nedovršena dimenzijska formula ne može se spremiti.

### Fix v0.3.7 — white startup screen
React 18, ReactDOM and Lucide icons are bundled into `app/runtime.bundle.js` at build time and served offline. The old embedded React 16 libraries (without hooks) were removed. GitHub Actions now runs a real Chromium UI smoke test before publishing an installer. To build from source, run `npm install && npm run build:runtime && go test ./... && go build .`. Existing user data stays in the same profile.

## v0.3.7 — Slobodni obračunski izrazi i izgled lista

- Slobodne formule po redu koriste simbole a,b,c,h,d,q,r,t,kos i dodatna slova s vrijednostima; znak x ili * označava množenje, a zagrade određuju redoslijed. Podržani su +,−,×,÷; izračun se čuva punom preciznošću.
- Posebno polje **Pozicije armature** ostaje uz izmjeru i ispisuje se u proračunu.
- U editoru postavke su **Opombe**, ispisane pod Opis del – Postavka.
- U **Postavke i backup** upiši naziv firme; koristi se kao Izvajalec ako za gradilište nije određen drugi izvođač.
- Dokaznice imaju slobodan naziv, rotaciju po stepenu i izbor veličine na papiru. Slike se rotiraju u canvasu pri ispisu, bez ručnog uređivanja izvornog nacrta.
- Na svakom listu su **Mesečna** (tekući mjesec) i **Skupna** (prethodno + tekući) desne kolone; PDF prikaz ostaje optimiziran za A4.
- Ako ima mnogo priloga/dimenzija, ispis može zahtijevati dodatnu stranicu kako bi sve ostalo čitljivo.

## OBRAČUN Cloud — v0.3.7

**Cloud je centralno povezan** s namjenskim Supabase projektom `obracun` u regiji Frankfurt. Korisnici ne unose URL ni API ključeve.

1. Na Windowsu prvo sačuvaj lokalni backup kroz **Postavke i backup → Izvezi backup**.
2. Otvori **Firma i korisnici**, registruj se e-mailom i lozinkom te potvrdi e-mail ako je potrebno.
3. Prijavi se i **kreiraj firmu**. Prvi korisnik postaje vlasnik.
4. Izaberi **Prenesi lokalne obračune**; provjeri poruku *Sinhronizovano* i otvaranje svih priloženih slika i PDF-ova.
5. Na Macu se prijavi istom e-mail adresom i lozinkom; odaberi istu firmu. Trebalo bi da se automatski učitaju ista gradilišta i obračuni.
6. Administrator kreira pozivnice za korisnike s ulogama owner/admin/editor/viewer i ograničenim pristupom gradilištima.

Promjene se spremaju lokalno i sinhronizuju automatski. Provjera novih podataka s drugog uređaja radi u intervalima do 30 sekundi. Ako se isti projekt izmijeni na dva uređaja odjednom, aplikacija zaustavlja prepisivanje i javlja konflikt, koji trenutno treba ručno riješiti.

**Ograničenja:** Supabase Free nema automatske dnevne backupove i može pauzirati projekt nakon neaktivnosti. Za poslovnu upotrebu redovno izvezi vlastite sigurnosne kopije. Cloud sinhronizacija stvarnog korisničkog naloga treba završnu provjeru na Windowsu i Macu.

## v0.3.7 – širši vnos izmer in jeziki
- Vnos posamezne postavke se odpre v širokem urejevalniku do 1180 px.
- Za kg: naziv dela, masa v kg, pozicije armature, po želji razdelitev po premerih Ø6–32 in razredi do vključno Ø12 / od Ø14.
- Za m³: a, b, c (ali a, b, h/d); za m²: a, b; za kos: število kosov. Dodatne mere in formule so na voljo po potrebi.
- Tipkovnica podpira spremenljivke, +, −, ×, ÷, oklepaje in potence (^2); izračunana formula se prikaže tudi v PDF obračunu.
- **Nastavitve → Jezik aplikacije**: Slovenščina (privzeto) ali Bosanski. Jezik je ločen od podatkov in se shrani na napravi. Številčni izrazi in projektna imena se ne prevajajo.
- Obstoječe izmere in projektna baza ostanejo nespremenjene; nove vrste izmer uporabljajo dodatna polja v obstoječem formatu.

**v0.3.7:** Posodobljena jezikovna pokritost; test v Chromiumu preveri tudi dejanski vnos kg in m³, oznake armature, široko okno in formulo s spremenljivkami. Podatki se ohranijo v obstoječem profilu.

## OBRAČUN v0.3.7 – obračunski listi in dvakrat mesečni obračuni

- Pri novem gradbišču nastavi **1 × mesečno** (privzeto) ali **2 × mesečno** (1.–15. in 16.–zadnji dan); stare izmere se razvrstijo glede na datum. Prikaz prejšnjega obdobja in vsota sta vezana na izbrano polovico meseca.
- Za vsako postavko se takoj odpre prazna vrstica. Nova vrstica se prikaže zgoraj, starejše se zaprejo; na obračunskem listu se vrstni red obrne v kronološko zaporedje. Gumb **Shrani izmero** zapre urejevalnik in vrne v popis.
- Številka **obračunskega lista** je vezana na izvirni položaj postavke v popisu gradbišča, ne na trenutno filtrirano postavko; dodatne strani imajo **Stran 2 / N**.
- Stolpci A/B/C/... se izpišejo le, če imajo vrednosti; ob vsakem zapisu je enotno prikazana numerična formula in končna količina. Za kg neposredno merjene armature se ne izpiše odvečna kolona `kos`.
- Spodnji seštevek kaže **Mesečna**; **Skupna** ostane v desnem stolpcu; odstranjen je podvojeni seštevek na dnu.
- V novem in obstoječem projektu lahko sam podpišeš polje **Sestavil** z modrim črnilom; osebni podpis ostane v podatkih projekta in se izpiše na vseh straneh obračuna. Podpisi naročnika in izvajalca se samodejno ne dodajajo.
- Iz posamezne postavke lahko izbereš tudi druge postavke za izvoz v isti PDF; vedno gre le za trenutno obračunsko obdobje. Levo spodaj je števec predvidenih strani za odprto postavko.

**Pozor:** število strani se načrtuje glede na vrstice in skice; pri izjemno dolgih opisih lahko tiskalnik/PDF upravljalnik dodatno prelomi stran. Pred oddajo vedno preveri predogled tiska. Stare podatkovne strukture niso izbrisane.

### OBRAČUN v0.3.8 — kompaktne vrstice in celostranski A4 obračun

- Ko je vrstica izmere skrčena, so vsa njena polja in formula res skrita. Ostane en sam vodoravni povzetek z nazivom, količino in puščico. **Odstrani vrstico** je vedno viden v glavi, ne glede na stanje vrstice.
- Pri odstranitvi trenutno odprte vrstice se samodejno odpre naslednja, če obstaja.
- A4 obračunski list ima vedno enako veliko območje **Skice, izmere, izračuni**, tudi brez skic. Območje se razteza do podpisov; podpisi so znova poravnani ob spodnjem robu uporabnega območja strani.
- Obračunski prikaz na zaslonu in pri tiskanju uporabljata iste dimenzije tiskalne površine A4: 186 × 277 mm pri robovih 12 mm levo/desno in 10 mm zgoraj/spodaj. Datum, račun, podpis in druge vrednosti ostanejo nespremenjene.
- Samodejni testi z brskalnikom preverjajo celotno skrčenje vrstice, razpoložljivost brisanja, višino okvirja, položaj podpisov ter ujemanje predogleda s tiskanim PDF.

### OBRAČUN v0.3.9 — tisk varno za vstavljanje v gradbeno knjigo

- Ob podatkih **Naročnik** in **Izvajalec** je izpis **Obračun za obdobje: November '26** oziroma **November '26/1** ali **November '26/2** za obračune dvakrat mesečno.
- Fizični list A4 ima **25 mm prostega prostora na levi za luknjanje in vpenjanje** ter **12 mm na desni, zgoraj in spodaj**. Predogled kaže celoten A4 (210 × 297 mm), tiskanje pa uporablja 173 × 273 mm uporabne površine brez dodatnih robov v vsebini.
- Na stičišču delovne površine in podpisov ostane samo ena ločilna črta pod **Mesečna**, brez praznega presledka ali dvojne obrobe.
- Za pravilne dimenzije tiskaj na A4 v merilu **100 % / Actual size**; ne vključi dodatnega prilagajanja velikosti. Testi preverjajo robove, enako velikost delovne površine v predogledu in tisku ter mejo med delovno površino in podpisi.
