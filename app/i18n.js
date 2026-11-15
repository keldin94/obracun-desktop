/* OBRAČUN UI localization.
 * Existing stored project/item names, quantities and formulas are never translated.
 * Translate fixed UI strings at React render time; cloud labels also use the same glossary.
 */
(function(){
'use strict';
const KEY='obracun-ui-language';
const lex={
'Unesi naziv projekta':'Vnesi naziv projekta',
'Gradilišta':'Gradbišča','Gradilište':'Gradbišče','Novo gradilište':'Novo gradbišče','Kreiraj gradilište':'Ustvari gradbišče',
'Promijeni gradilište':'Zamenjaj gradbišče','Podaci gradilišta':'Podatki gradbišča','Aktivno gradilište':'Aktivno gradbišče',
'AKTIVNO GRADILIŠTE':'AKTIVNO GRADBIŠČE','Nema gradilišta':'Ni gradbišč',
'Kreiraj prvo gradilište pa unesi podatke i uvezi njegov Excel popis.':'Najprej ustvari gradbišče, nato vnesi podatke in uvozi popis del iz Excela.',
'RADNI PROSTOR':'DELOVNI PROSTOR','GRADBENI LISTOVI':'GRADBENI OBRAČUNI',
'Pregled':'Pregled','Popis radova':'Popis del','Obračunski listovi':'Obračunski listi',
'Dokaznice':'Dokazila','Dokaznice i skice':'Dokazila in skice','Sve grupe':'Vse skupine',
'Novo gradilište':'Novo gradbišče','Postavke i backup':'Nastavitve in varnostne kopije',
'Postavke i sigurnosna kopija':'Nastavitve in varnostna kopija',
'Izvezi PDF':'Izvozi PDF','Uvezi Excel':'Uvozi Excel',
'Uvezi popis':'Uvozi popis','Nova postavka':'Nova postavka',
'OBRAČUNSKI LIST':'OBRAČUNSKI LIST','POSTAVKA / GRUPA':'POSTAVKA / SKUPINA',
'ŠIFRA':'ŠIFRA','PO POPISU':'PO POPISU','OVAJ MJESEC':'TA MESEC','KUMULATIVNO':'SKUPAJ',
'REALIZACIJA':'REALIZACIJA','postavki':'postavk','Realizacija po grupama radova':'Realizacija po skupinah del',
'Usporedba ugovorenih i obračunatih vrijednosti':'Primerjava pogodbenih in obračunanih vrednosti',
'obračunato':'obračunano','ugovoreno':'pogodbeno',
'Nema grupa. Uvezi popis radova.':'Ni skupin. Uvozi popis del.',
'Posljednje izmjere':'Zadnje izmere','Unosi za':'Vnosi za',
'Prikaži sve':'Prikaži vse','Za ovaj mjesec nema izmjera. Otvori postavku i dodaj prvu.':'Za ta mesec ni izmer. Odpri postavko in dodaj prvo.',
'Ovo je probna verzija s lokalnim spremanjem. Napravi backup prije promjene uređaja.':'Podatki se shranjujejo lokalno. Pred zamenjavo naprave izdelaj varnostno kopijo.',
'Sigurnosna kopija':'Varnostna kopija','Nema pronađenih postavki':'Ni najdenih postavk',
'Uvezi Excel popis radova ili dodaj postavku ručno.':'Uvozi popis del iz Excela ali ročno dodaj postavko.',
'Prikazano':'Prikazano',
'Otvaranjem postavke vidiš sve prethodne izmjere i dokaznice.':'Ko odpreš postavko, vidiš vse predhodne izmere in dokazila.',
'Priložene dokaznice':'Priložena dokazila','Fotografije, skice i PDF nacrti povezani s postavkama':'Fotografije, skice in načrti PDF, povezani s postavkami',
'Još nema dokaznica':'Dokazil še ni',
'Otvori obračunsku postavku i dodaj PDF nacrt, skicu ili fotografiju.':'Odpri obračunsko postavko in dodaj načrt PDF, skico ali fotografijo.',
'Otvori popis radova':'Odpri popis del','Otvori':'Odpri','Otkaži':'Prekliči','Otkazi':'Prekliči',
'Spremi':'Shrani','Spremi postavku':'Shrani postavko','Spremi izmjeru':'Shrani izmero',
'Kreiraj projekt':'Ustvari projekt','Izbriši gradilište':'Izbriši gradbišče','Obriši':'Izbriši',
'Osnovni popis':'Osnovni popis','Aneks / dodatna dela':'Aneks / dodatna dela',
'Razvrstaj postavke po stvarnim grupama. Možeš pojedinačno izabrati grupu ili označiti više pozicija i premjestiti ih odjednom.':'Razvrsti postavke po dejanskih skupinah. Lahko izbereš posamezno skupino ali premakneš več označenih postavk hkrati.',
'Zatvori':'Zapri','Odaberi jednu, više ili sve grupe radova':'Izberi eno, več ali vse skupine del',
'Pregled / Spremi PDF':'Predogled / Shrani PDF','Obračun / dimenzije':'Obračun / mere',
'Datum':'Datum','Lokacija / dio objekta':'Lokacija / del objekta','Opis radova':'Opis del',
'Šta je izmjereno?':'Kaj je izmerjeno?','Npr. etaža, os, polje':'Npr. etaža, os, polje',
'Nova izmjera':'Nova izmera','Uredi izmjeru':'Uredi izmero',
'Prethodno':'Prejšnje','Ovaj mjesec':'Ta mesec','Ukupno':'Skupaj',
'Ugovorena količina':'Pogodbena količina','Preostalo':'Preostalo',
'Ugovorena cijena':'Pogodbena cena','Izvezi ovaj list':'Izvozi ta list',
'Historija obračuna':'Zgodovina obračuna','unosa':'vnosov',
'Ova postavka još nema obračunskih unosa.':'Ta postavka še nima obračunskih vnosov.',
'priloga':'prilog','Dodaj nacrt, skicu ili fotografiju':'Dodaj načrt, skico ali fotografijo',
'PDF, JPG, PNG, WebP ili Ctrl+V zalijepljena slika':'PDF, JPG, PNG, WebP ali slika, prilepljena s Ctrl+V',
'Naziv na obračunskom listu':'Naziv na obračunskem listu','Rotacija slike (°)':'Zasuk slike (°)',
'Širina na listu':'Širina na listu','Maks. visina skice':'Največja višina skice',
'Firma koja izrađuje obračune':'Podjetje, ki pripravlja obračune',
'Naziv firme se automatski ispisuje kao Izvajalec na obračunskom listu ako gradilište nema drugi naziv izvođača.':
'Naziv podjetja se samodejno izpiše kot Izvajalec na obračunskem listu, če gradbišče nima navedenega drugega izvajalca.',
'Podaci projekta':'Podatki projekta','Uredi lokaciju, naziv i naručioca aktivnog projekta.':'Uredi lokacijo, naziv in naročnika izbranega projekta.',
'Podaci i priložene datoteke spremaju se u JSON datoteku. Možeš ih vratiti na drugi uređaj.':
'Podatki in priložene datoteke se shranijo v datoteko JSON. Lahko jih obnoviš na drugi napravi.',
'Ažuriranje programa':'Posodobitev programa',
'Provjeri dostupnost nove verzije i instaliraj je direktno u aplikaciji.':
'Preveri, ali je na voljo nova različica, in jo namesti neposredno v aplikaciji.',
'Provjeri ažuriranja':'Preveri posodobitve',
'Podaci se spremaju lokalno. Nakon povezivanja centralne baze korisnici se samo registruju ili prijavljuju, bez unosa API ključeva.':
'Podatki se shranjujejo lokalno. Ob povezavi s centralno zbirko se uporabniki samo registrirajo ali prijavijo, brez vnosa ključev API.',
'Firma i korisnici':'Podjetje in uporabniki',
'Izvezi backup':'Izvozi varnostno kopijo','Uvezi backup':'Uvozi varnostno kopijo',
'Odaberi gradilište':'Izberi gradbišče','Odaberi':'Izberi','Naručilac':'Naročnik',
'Lokacija nije unesena':'Lokacija ni vnesena','nije unesen':'ni vnesen',
'Broj postavki':'Število postavk','Mjesečni PDF obračun':'Mesečni obračun PDF',
'Koje radove želiš izvesti?':'Katere vrste del želiš izvoziti?',
'Sve grupe radova':'Vse skupine del','Sve postavke':'Vse postavke',
'Samo odabrana postavka':'Samo izbrana postavka',
'Naslovnica i rekapitulacija':'Naslovnica in rekapitulacija',
'Obračunski list svake postavke s prethodnim i novim količinama':'Obračunski list vsake postavke s prejšnjimi in novimi količinami',
'Poveži uređaje':'Poveži naprave',
'Lokalna verzija':'Lokalna različica',
'Podaci su lokalni':'Podatki so lokalni','Cloud povezan':'Oblak je povezan',
'Prijava':'Prijava','Registracija':'Registracija',
'Registruj firmu':'Registriraj podjetje','Kreiraj firmu':'Ustvari podjetje',
'Korisnici firme':'Uporabniki podjetja','Pozovi korisnika':'Povabi uporabnika',
'Prihvati pozivnicu':'Sprejmi povabilo','Pridruži se firmi':'Pridruži se podjetju',
'Pronađeni su lokalni obračuni.':'Najdeni so lokalni obračuni.',
'Odaberi prijenos u firmu ili otvaranje clouda. Sigurnosna kopija ostaje na uređaju.':
'Izberi prenos obračunov v podjetje ali odpiranje oblaka. Varnostna kopija ostane na napravi.',
'Prenesi lokalne obračune':'Prenesi lokalne obračune','Otvori cloud':'Odpri oblak',
'Sinhronizuj sada':'Sinhroniziraj zdaj','Korisnici i dozvole':'Uporabniki in dovoljenja',
'Kod pozivnice':'Koda povabila','Kreiraj pozivnicu':'Ustvari povabilo',
'Odjava':'Odjava','Nemaš dozvolu.':'Nimaš dovoljenja.','Nemaš pristup firmi.':'Nimaš dostopa do podjetja.',
'Cloud još nije aktiviran':'Oblak še ni aktiviran',
'Prijavljen korisnik':'Prijavljen uporabnik',
'Registracija i prijava bez tehničkih postavki.':'Registracija in prijava brez tehničnih nastavitev.',
'Samo administrator može uvesti gradilišta.':'Samo skrbnik lahko uvozi gradbišča.',
'Izmjera je spremljena.':'Izmera je shranjena.','Izmjera je izmijenjena.':'Izmera je spremenjena.',
'Postavka je dodana.':'Postavka je dodana.','Postavka je izmijenjena.':'Postavka je spremenjena.',
'Neispravan izraz. Primjer: 2 * 5,25 * 3':'Neveljaven izraz. Primer: 2 * 5,25 * 3',
'Spremanje nije uspjelo: provjeri memoriju preglednika.':'Shranjevanje ni uspelo: preveri prostor za podatke aplikacije.',
'Dimenzijski obračun':'Dimenzijski obračun','Obračun količina':'Obračun količin',
'Obračun armature (kg)':'Obračun armature (kg)',
'Izbriši postavku':'Izbriši postavko','Izbriši dokaznicu':'Izbriši dokazilo',
'Prezime':'Priimek','Ime':'Ime','Novi projekt':'Nov projekt',
'Opis postavke':'Opis postavke','Opombe / dodatni opis ispod postavke':'Opombe / dodatni opis pod postavko',
'Naziv radova iz popisa':'Naziv del iz popisa',
'Naziv firme / izvajalec':'Naziv podjetja / izvajalec',
'Uvoz Excela':'Uvoz Excela','Uvezi':'Uvozi','Potvrdi uvoz':'Potrdi uvoz',
'Pregled uvoza':'Predogled uvoza','Prvi red podataka':'Prva vrstica podatkov',
'Mapiranje kolona':'Preslikava stolpcev',
'Količina':'Količina','Cijena':'Cena',
'Promijeni grupu':'Spremeni skupino','Odaberi grupu':'Izberi skupino',
'Pregled postavki':'Pregled postavk','Prilozi':'Priloge','Opis radova':'Opis del',
'Postojeći unosi neće biti obrisani.':'Obstoječi vnosi ne bodo izbrisani.'
};
const reverse={};for(const [bs,sl] of Object.entries(lex))if(!Object.hasOwn(reverse,sl))reverse[sl]=bs;
const lang=()=>localStorage.getItem(KEY)||'sl';
const setLang=value=>{
 if(!['sl','bs'].includes(value))return;
 localStorage.setItem(KEY,value);
 location.reload();
};
const t=value=>{
 if(typeof value!=='string'||!value)return value;
 const source=lang()==='sl'?lex:reverse;
 const before=value.match(/^\s*/)[0],after=value.match(/\s*$/)[0];
 const key=value.trim();
 if(!key)return value;
 let translation=source[key];
 if(!translation&&key.includes('OBRAČUN · v0.'))translation=key.replace('Građevinski obračuni','Gradbeni obračuni');
 return translation==null?value:before+translation+after;
};
document.documentElement.lang=lang();
const orig=React.createElement;
React.createElement=function(tag,props,...children){
  const next=props?{...props}:{};
  if(next){
    for(const key of ['placeholder','title','aria-label','alt']){
      if(typeof next[key]==='string')next[key]=t(next[key]);
    }
    if(tag==='option' && next.value==null && typeof children[0]==='string'){
      next.value=children[0]; // preserve internal filter keys when visible label changes
    }
  }
  return orig.call(this,tag,next,...children.map(c=>typeof c==='string'?t(c):c));
};
function translateCloud(root){
 if(!root||lang()!=='sl')return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 const nodes=[];
 while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){
  if(node.parentElement?.closest('input,textarea,select,script,style,code'))continue;
  const text=t(node.nodeValue);
  if(text!==node.nodeValue)node.nodeValue=text;
 }
 root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el=>{
  for(const attr of ['placeholder','title','aria-label']){
   const raw=el.getAttribute(attr);
   if(raw){const result=t(raw);if(result!==raw)el.setAttribute(attr,result)}
  }
 });
}
const observer=new MutationObserver(records=>{
 const cloud=document.getElementById('ob-account-layer');
 if(!cloud||cloud.style.display==='none')return;
 // Translate only newly written cloud dialog markup; don't touch user data or typing.
 if(records.some(r=>cloud.contains(r.target)))translateCloud(cloud);
});
observer.observe(document.documentElement,{childList:true,subtree:true});
window.OB_I18N={language:lang,setLanguage:setLang,t};
})();
