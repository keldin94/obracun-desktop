(function () {
  const css = `
  #ob-desktop-update{position:fixed;bottom:18px;right:22px;z-index:75;display:flex;align-items:center;gap:9px;background:#182b41;color:white;border:1px solid #38546c;border-radius:11px;padding:8px 10px 8px 13px;box-shadow:0 8px 30px #10253635;font:12px 'Segoe UI',Arial,sans-serif}
  #ob-desktop-update .ob-version{color:#c3d7e3;font-size:11px}
  #ob-desktop-update button{border:1px solid #568e87;border-radius:7px;background:#3c877d;color:#fff;min-height:30px;padding:6px 10px;font-weight:600;cursor:pointer}
  #ob-desktop-update button:hover{background:#4d9d91}
  #ob-update-overlay{position:fixed;inset:0;z-index:110;display:none;align-items:center;justify-content:center;background:#111d2bd1;padding:15px;font:13px 'Segoe UI',Arial,sans-serif}
  #ob-update-overlay.open{display:flex}
  #ob-update-dialog{width:min(510px,100%);background:white;color:#243549;border-radius:15px;padding:24px;box-shadow:0 20px 90px #0005}
  #ob-update-dialog h2{font-size:19px;margin:0 0 5px}
  #ob-update-dialog p{font-size:13px;color:#607187;line-height:1.5}
  #ob-update-dialog label{display:block;font-size:12px;font-weight:700;margin:16px 0 7px}
  #ob-update-dialog input{width:100%;border:1px solid #cbd6df;border-radius:7px;padding:10px;font:13px 'Segoe UI',Arial,sans-serif}
  #ob-update-dialog .ob-buttons{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:18px}
  #ob-update-dialog button{border-radius:8px;border:1px solid #cbd8df;background:white;padding:10px 14px;cursor:pointer;font:600 12px 'Segoe UI',Arial,sans-serif}
  #ob-update-dialog .ob-primary{background:#192e46;color:white;border-color:#192e46}
  #ob-update-dialog .ob-green{background:#298d77;color:#fff;border-color:#298d77}
  #ob-update-dialog button:disabled{opacity:.5;cursor:not-allowed}
  #ob-status{background:#eef3f7;border-radius:9px;padding:12px;min-height:42px;margin-top:12px;white-space:pre-wrap;line-height:1.5}
  #ob-update-dialog .ob-note{font-size:11px;color:#8794a3;margin-top:14px}
  @media(max-width:650px){#ob-desktop-update{bottom:9px;right:9px;left:9px;justify-content:space-between}}
  `;
  const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);
  const widget=document.createElement('div');widget.id='ob-desktop-update';
  const platformLabel = navigator.platform.startsWith('Mac') ? 'macOS Intel' : 'Windows';
  widget.innerHTML='<span class="ob-version">OBRAČUN '+platformLabel+' <b id="ob-active-version">v0.3.9</b></span><button type="button" id="ob-open-update">Provjeri ažuriranja</button>';
  widget.style.display='none'; // Updates are available from Settings only.
  document.body.appendChild(widget);
  const overlay=document.createElement('div');overlay.id='ob-update-overlay';
  overlay.innerHTML=`<div id="ob-update-dialog" role="dialog" aria-modal="true" aria-labelledby="ob-heading">
  <h2 id="ob-heading">Ažuriranja aplikacije</h2>
  <p>OBRAČUN sam provjerava službena izdanja na GitHubu. Ne moraš ručno preuzimati niti mijenjati .exe datoteke.</p>

  <div id="ob-status" role="status">Provjeri dostupnost nove verzije.</div>
  <div class="ob-note">Windows ažuriranje instalira novu verziju u isti instalacijski folder. Mac aplikacija se ažurira u Applications. Podaci ostaju odvojeni od programa.</div>
  <div class="ob-buttons"><button type="button" id="ob-close">Zatvori</button><button class="ob-primary" type="button" id="ob-check">Provjeri</button><button class="ob-green" type="button" id="ob-install" disabled>Instaliraj novu verziju</button></div>
  </div>`;
  document.body.appendChild(overlay);
  const by=id=>document.getElementById(id);
  fetch('/api/health',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{
    if(j?.version && by('ob-active-version'))by('ob-active-version').textContent='v'+j.version;
  }).catch(()=>{});
  const status=m=>{by('ob-status').textContent=m};
  const setBusy=b=>{for(const id of ['ob-check'])by(id).disabled=b;by('ob-install').disabled=b || !available};
  let available=false,busy=false;
  async function api(path,opt){const r=await fetch('/api/update/'+path,{headers:{'Accept':'application/json','Content-Type':'application/json'},...opt});const j=await r.json();if(!r.ok)throw Error(j.error||'Greška pri provjeri.');return j;}
  async function check(){if(busy)return;busy=true;available=false;setBusy(true);status('Provjeravam objavljene verzije…');try{
    const j=await api('check');available=!!j.update;status(j.message+(j.version?'\nDostupno: '+j.version:''));
  }catch(e){status(e.message)}finally{busy=false;setBusy(false)}}
  async function install(){if(busy||!available)return;busy=true;setBusy(true);status('Preuzimam, provjeravam SHA-256 i pripremam instalaciju…');try{const j=await api('install',{method:'POST',body:'{}'});status(j.message+'\nProzor aplikacije će se ponovo otvoriti.');}catch(e){status('Ažuriranje nije uspjelo: '+e.message);busy=false;setBusy(false)}}
  by('ob-open-update').onclick=()=>{overlay.classList.add('open');check()};
  by('ob-close').onclick=()=>overlay.classList.remove('open');
  by('ob-check').onclick=check;by('ob-install').onclick=install;
  overlay.addEventListener('mousedown',e=>{if(e.target===overlay)overlay.classList.remove('open')});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')overlay.classList.remove('open')});
  window.OBR_UPDATES={open:()=>{overlay.classList.add('open');check();}};
})();