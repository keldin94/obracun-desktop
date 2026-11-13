(() => {
const style=document.createElement("style");
style.textContent="#ob-update-fab{position:fixed;right:20px;bottom:18px;z-index:75;border:1px solid #3e6278;background:#162b42;color:white;border-radius:11px;padding:11px 15px;box-shadow:0 7px 26px #0015;font:600 12px Segoe UI,Arial;cursor:pointer}#ob-update-modal{display:none;position:fixed;inset:0;z-index:100;background:#0d2033cc;align-items:center;justify-content:center;padding:15px;font:13px Segoe UI,Arial}#ob-update-modal.open{display:flex}#ob-update-card{background:white;color:#213548;max-width:490px;width:100%;border-radius:14px;padding:24px;box-shadow:0 20px 80px #0004}#ob-update-card h3{font-size:19px;margin:0 0 9px}#ob-update-card p{line-height:1.5;color:#58697b}#ob-update-card label{font-size:12px;font-weight:600;display:block;margin:16px 0 7px}#ob-update-repo{width:100%;padding:10px;border:1px solid #b7c5d4;border-radius:7px}#ob-update-status{white-space:pre-wrap;margin-top:14px;padding:11px;min-height:36px;border-radius:8px;background:#f0f4f7}#ob-update-controls{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin-top:16px}#ob-update-controls button{cursor:pointer;border-radius:7px;border:1px solid #b7c5d4;background:white;padding:9px 12px}#ob-update-controls .primary{background:#234960;color:white;border-color:#234960}#ob-update-controls .install{background:#318572;color:white;border-color:#318572}#ob-update-controls button:disabled{opacity:.5;cursor:default}";
document.head.appendChild(style);
const open=document.createElement("button");
open.id="ob-update-fab";
open.textContent="OBRAČUN v0.1.1 · Provjeri ažuriranja";
document.body.appendChild(open);
const modal=document.createElement("div");
modal.id="ob-update-modal";
modal.innerHTML='<div id="ob-update-card" role="dialog" aria-modal="true"><h3>Ažuriranja aplikacije</h3><p>Provjeri ima li nove Windows verzije. Tvoji obračuni i dokaznice ostaju sačuvani u lokalnom profilu.</p><label for="ob-update-repo">GitHub repozitorij</label><input id="ob-update-repo" placeholder="keldin94/obracun-desktop" spellcheck="false"><div id="ob-update-status" role="status">Spremno za provjeru.</div><div id="ob-update-controls"><button type="button" id="ob-update-close">Zatvori</button><button type="button" id="ob-update-save">Spremi</button><button type="button" class="primary" id="ob-update-check">Provjeri</button><button type="button" class="install" id="ob-update-install" disabled>Instaliraj</button></div></div>';
document.body.appendChild(modal);
const by=id=>document.getElementById(id), status=message=>by("ob-update-status").textContent=message;
let busy=false,available=false;
function setBusy(value){busy=value;by("ob-update-save").disabled=value;by("ob-update-check").disabled=value;by("ob-update-install").disabled=value||!available}
async function api(path,options){
 const res=await fetch("/api/update/"+path,{headers:{"Accept":"application/json","Content-Type":"application/json"},...options});
 const value=await res.json();
 if(!res.ok)throw new Error(value.error||"Greška pri provjeri");
 return value;
}
async function load(){
 try{const config=await api("settings");by("ob-update-repo").value=config.repo||"keldin94/obracun-desktop"}
 catch(e){status(e.message)}
}
async function save(){
 if(busy)return;
 setBusy(true);
 try{const result=await api("settings",{method:"POST",body:JSON.stringify({repo:by("ob-update-repo").value.trim()})});by("ob-update-repo").value=result.repo;available=false;status("Postavka je spremljena.")}
 catch(e){status(e.message)}
 finally{setBusy(false)}
}
async function check(){
 if(busy)return;
 available=false;setBusy(true);status("Provjeravam GitHub izdanja…");
 try{
  await api("settings",{method:"POST",body:JSON.stringify({repo:by("ob-update-repo").value.trim()})});
  const result=await api("check");
  available=!!result.update;
  status(result.message+(result.version?"\nNova verzija: "+result.version:""));
 }catch(e){status(e.message)}
 finally{setBusy(false)}
}
async function install(){
 if(busy||!available)return;
 setBusy(true);status("Preuzimam novu verziju i provjeravam SHA-256…");
 try{const result=await api("install",{method:"POST",body:"{}"});status(result.message+"\nProgram će se ponovo pokrenuti.")}
 catch(e){status("Ažuriranje nije uspjelo: "+e.message);setBusy(false)}
}
open.addEventListener("click",()=>{modal.classList.add("open");load()});
by("ob-update-close").addEventListener("click",()=>modal.classList.remove("open"));
by("ob-update-save").addEventListener("click",save);
by("ob-update-check").addEventListener("click",check);
by("ob-update-install").addEventListener("click",install);
modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open")});
document.addEventListener("keydown",e=>{if(e.key==="Escape")modal.classList.remove("open")});
})();
