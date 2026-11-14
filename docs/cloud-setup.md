# OBRAČUN — Jednostavni cloud za više firmi

## Namjena

Korisnici vide samo **Registracija / Prijava → Firma → Gradilišta**.
Nijedan krajnji korisnik ne unosi Supabase URL ili API ključ.

## Aktivacija jednom, od strane vlasnika softvera

1. Napraviti **zaseban Supabase projekt** za OBRAČUN (ne koristiti bazu druge aplikacije).
2. U SQL Editoru pokrenuti `supabase/002_organizations.sql`.
3. U `app/cloud-config.json` unijeti **Project URL** i **publishable key**. Ključ je javan/publishable; nikad ne stavljati `service_role` ili `secret` ključ u aplikaciju.
4. Objaviti novu verziju Windows i macOS aplikacije.

Do završetka 1–4 cloud je **isključen**. Lokalni obračuni ostaju dostupni.

## Tok korisnika

- Prvi korisnik registruje e-mail i kreira firmu te postaje **vlasnik**.
- Vlasnik/administrator kreira pozivnicu s e-mail adresom, ulogom i pristupom svim ili odabranim gradilištima.
- Novi korisnik registruje svoj e-mail, potvrdi ga i prihvati jednokratni pozivni kod (vrijedi 7 dana). Pozivnice se trenutno **ne šalju automatski e-mailom**.
- Uloge: `owner`, `admin`, `editor`, `viewer`; dozvole se provjeravaju i u Postgres RLS politici.
- Svako gradilište se pohranjuje kao zasebni snapshot sa revizijom; simultane izmjene ne prepisuju se ako se obje strane razlikuju.

## Migracija s lokalnih uređaja

Prije prve prijave izvesti **Postavke → Izvezi backup** na računaru koji ima podatke.
Pri prvom otvaranju firme korisnik bira **Prenesi lokalne obračune** ili **Otvori cloud**.
Automatsko brisanje starih podataka nije dozvoljeno; aplikacija dodatno čuva lokalnu kopiju. Priloge treba provjeriti nakon prvog prijenosa.

## Ograničenja i obavezni testovi prije produkcije

- SQL migraciju, RLS izolaciju (2 firme, 4 uloge, više gradilišta) i registraciju treba izvršiti na stvarnom Supabase projektu prije puštanja clouda u upotrebu.
- Trenutni model koristi snapshot po gradilištu i optimističke revizije. To nije Google-Docs live collaborative editing; konkurentni unosi na istoj poziciji mogu zahtijevati ručno rješavanje konflikta.
- Lokalni podaci ostaju na uređaju: nakon uklanjanja prava korisniku treba razmotriti politiku brisanja offline keša i zaštitu šifrovanjem za zajedničke uređaje.
- Prije prodaje: e-mail slanje pozivnica, revizijski dnevnik, automatski backup i vraćanje, oporavak naloga, digitalno potpisivanje aplikacija i nezavisno testiranje RLS.
