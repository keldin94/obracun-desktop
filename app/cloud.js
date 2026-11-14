/* OBRAČUN Cloud Sync — Supabase Auth + revision-protected snapshots + private proof storage.
   No keys, passwords or user data are embedded in releases. Requires separate Supabase setup. */
(() => {
  'use strict';
  const CONFIG_KEY='obracun-cloud-config-v1', SESSION_KEY='obracun-cloud-session-v1';
  const SCHEMA='obracun_snapshots', BUCKET='obracun-dokaznice';
  let config={}, session=null, callbacks=null, syncing=false, timer=null, pending=null;
  let message='Cloud nije povezan', phase='offline', dialog=null;
  const read=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
  const write=(key,value)=>{if(value)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key)};
  const normalize=url=>String(url||'').trim().replace(/\/+$/,'');
  config=read(CONFIG_KEY)||{};session=read(SESSION_KEY);
  const active=()=>!!(config.url&&config.key&&session?.access_token&&session?.user?.id);
  const notify=(next,level)=>{message=String(next);phase=level||(active()?'connected':'offline');callbacks?.status?.({message,phase,email:session?.user?.email||''});refreshDialog();};
  const payload=(state)=>({projects:state.projects||[],items:state.items||[],entries:state.entries||[],proofs:state.proofs||[],schemaVersion:state.schemaVersion||2});
  const hasData=p=>(p.projects?.length||0)+(p.items?.length||0)+(p.entries?.length||0)+(p.proofs?.length||0)>0;
  const hash=p=>{let h=2166136261;const s=JSON.stringify(p);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)+'-'+s.length};
  const metaKey=()=>`obracun-cloud-sync-v1:${config.url}:${session?.user?.id||'none'}`;
  const metadata=()=>read(metaKey());
  const saveMeta=(revision,state)=>write(metaKey(),{revision,hash:hash(payload(state))});
  const mergeLocal=(incoming)=>{const old=callbacks.getState();return {...old,...incoming,selectedProject:incoming.projects?.some(p=>p.id===old.selectedProject)?old.selectedProject:(incoming.projects?.[0]?.id||null),selectedMonth:old.selectedMonth}};
  const selectProof=(id)=>callbacks?.getProof?.(id);
  async function request(path,opts={},authenticated=true){
    if(!config.url||!config.key)throw Error('Unesi Supabase URL i public anon/publishable key.');
    let token=authenticated?session?.access_token:config.key;
    if(authenticated&&session?.expires_at&&Date.now()/1000>session.expires_at-60)await refresh();
    if(authenticated)token=session?.access_token;
    const headers={'apikey':config.key,'Authorization':`Bearer ${token||config.key}`,...opts.headers};
    const response=await fetch(config.url+path,{...opts,headers,cache:'no-store'});
    if(!response.ok){let msg='HTTP '+response.status;try{const j=await response.json();msg=j.msg||j.message||j.error_description||j.error||msg}catch{};throw Error(msg)}
    if(response.status===204)return null;
    if(opts.raw)return response.blob();
    return response.json();
  }
  async function refresh(){if(!session?.refresh_token)throw Error('Prijava je istekla. Prijavi se ponovo.');
    const j=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})},false);
    session={...j,expires_at:Math.floor(Date.now()/1000)+(j.expires_in||3600)};write(SESSION_KEY,session);return session;
  }
  async function login(email,password,signup=false){
    if(!email||!password)throw Error('Upiši e-mail i lozinku.');
    const path=signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password';
    const j=await request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})},false);
    if(!j.access_token){notify('Registracija je poslana. Potvrdi e-mail, zatim se prijavi.','pending');return}
    session={...j,expires_at:Math.floor(Date.now()/1000)+(j.expires_in||3600)};write(SESSION_KEY,session);
    notify('Prijavljen: '+(session.user?.email||email),'connected');await sync('auto');
  }
  async function logout(){session=null;write(SESSION_KEY,null);clearTimeout(pending);notify('Odjavljen. Lokalni obračuni ostaju na ovom uređaju.','offline');}
  const userId=()=>session?.user?.id;
  async function remote(){const rows=await request(`/rest/v1/${SCHEMA}?select=revision,payload,updated_at&user_id=eq.${encodeURIComponent(userId())}&limit=1`);return rows?.[0]||null}
  async function uploadProofs(state){for(const proof of state.proofs||[]){const blob=await selectProof(proof.id);if(!blob)continue;const path=`/storage/v1/object/${BUCKET}/${encodeURIComponent(userId())}/${encodeURIComponent(proof.id)}`;
      await request(path,{method:'POST',headers:{'x-upsert':'true','Content-Type':blob.type||proof.mime||'application/octet-stream'},body:blob});
  }}
  async function push(state,expectedRev){const rec={user_id:userId(),revision:expectedRev+1,payload:payload(state),updated_at:new Date().toISOString()};
    let rows;
    if(expectedRev===0){rows=await request(`/rest/v1/${SCHEMA}`,{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(rec)});}
    else{rows=await request(`/rest/v1/${SCHEMA}?user_id=eq.${encodeURIComponent(userId())}&revision=eq.${expectedRev}`,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({revision:expectedRev+1,payload:rec.payload,updated_at:rec.updated_at})});}
    if(!rows?.length)throw Error('Cloud je promijenjen na drugom uređaju. Nije prepisan. Odaberi način rješavanja razlika.');
    saveMeta(rows[0].revision,state);notify('Sinhronizovano · '+new Date().toLocaleTimeString('bs-BA',{hour:'2-digit',minute:'2-digit'}),'connected');
  }
  async function pull(record){if(!record||!record.payload)throw Error('Nema cloud podataka.');
    const state=mergeLocal(record.payload);saveMeta(record.revision,state);callbacks.setState(state);notify('Podaci su preuzeti iz clouda.','connected');
  }
  async function sync(mode='auto'){
    if(!active())return notify('Cloud nije povezan.','offline');
    if(syncing)return;
    syncing=true;notify('Provjeravam izmjene između uređaja…','busy');
    try{
      const snapshot=callbacks?.getState?.();if(!snapshot)throw Error('Aplikacija još nije spremna.');
      const local=payload(snapshot), localHash=hash(local), m=metadata(), row=await remote();
      if(mode==='download'){
        if(!row)throw Error('Cloud nema podataka.');
        await pull(row);return;
      }
      if(mode==='upload'){
        await uploadProofs(snapshot);await push(snapshot,row?.revision||0);return;
      }
      if(!row){
        if(hasData(local))return notify('Cloud je prazan. Klikni „Pošalji lokalne podatke“ za prvi prijenos.','pending');
        return notify('Cloud je prazan. Dodaj gradilište da započneš.','connected');
      }
      if(!m){
        if(hasData(local))return notify('Na ovom uređaju već postoje lokalni podaci. Odaberi „Preuzmi cloud“ ili „Spoji podatke“; ništa nije prepisano.','conflict');
        await pull(row);return;
      }
      if(row.revision!==m.revision){
        if(localHash===m.hash){await pull(row);return}
        return notify('Različite izmjene na dva uređaja! Automatsko prepisivanje je zaustavljeno. Napravi backup i riješi sukob.','conflict');
      }
      if(localHash!==m.hash){await uploadProofs(snapshot);await push(snapshot,m.revision);return}
      notify('Sve je sinhronizovano.','connected');
    }catch(e){notify('Sinhronizacija nije uspjela: '+e.message,'error')}
    finally{syncing=false}
  }
  const byId=id=>document.getElementById(id);
  const field=id=>byId('ob-cloud-'+id);
  function refreshDialog(){if(!dialog)return;const x=field('status');if(x)x.textContent=message;const id=field('identity');if(id)id.textContent=active()?'Prijavljen: '+(session.user?.email||''):'Nisi prijavljen';const connected=active();for(const b of ['pull','push','merge','sync','logout'])if(field(b))field(b).disabled=!connected||syncing;}
  function ui(){
    if(dialog){dialog.style.display='flex';refreshDialog();return}
    const box=document.createElement('div');box.id='ob-cloud-overlay';box.innerHTML=`<div class="ob-cloud-box" role="dialog" aria-modal="true" aria-labelledby="ob-cloud-title">
      <div class="ob-cloud-head"><div><h2 id="ob-cloud-title">Cloud sinhronizacija</h2><p>Jedan nalog za Windows, Mac i buduće mobilne aplikacije.</p></div><button id="ob-cloud-close" type="button" aria-label="Zatvori">×</button></div>
      <div class="ob-cloud-body">
      <label>Supabase Project URL<input id="ob-cloud-url" type="url" placeholder="https://projekat.supabase.co" spellcheck="false"/></label>
      <label>Publishable / anon key<input id="ob-cloud-key" type="password" placeholder="sb_publishable_... ili anon ključ" spellcheck="false"/></label>
      <button class="ob-cloud-button" id="ob-cloud-config" type="button">Sačuvaj cloud postavke</button>
      <div class="ob-cloud-rule"></div>
      <label>E-mail<input id="ob-cloud-email" type="email" autocomplete="username"/></label>
      <label>Lozinka<input id="ob-cloud-password" type="password" autocomplete="current-password"/></label>
      <div class="ob-cloud-actions"><button class="ob-cloud-button primary" id="ob-cloud-login" type="button">Prijava</button><button class="ob-cloud-button" id="ob-cloud-signup" type="button">Registracija</button><button class="ob-cloud-button" id="ob-cloud-logout" type="button">Odjava</button></div>
      <div id="ob-cloud-identity"></div><div id="ob-cloud-status" role="status"></div>
      <div class="ob-cloud-rule"></div><p class="ob-cloud-hint">Izmjene se automatski sinhronizuju nakon prve veze. Kada oba uređaja imaju različite podatke, aplikacija neće ništa prepisati bez tvoje potvrde. Prvo napravi backup u Postavkama.</p>
      <div class="ob-cloud-actions"><button class="ob-cloud-button primary" id="ob-cloud-sync" type="button">Sinhronizuj sada</button><button class="ob-cloud-button" id="ob-cloud-pull" type="button">Preuzmi cloud</button><button class="ob-cloud-button" id="ob-cloud-push" type="button">Pošalji lokalne podatke</button><button class="ob-cloud-button" id="ob-cloud-merge" type="button">Spoji podatke</button></div>
      <p class="ob-cloud-hint">Cloud zahtijeva postavljene <code>obracun_snapshots</code> i privatni bucket <code>obracun-dokaznice</code> sa sigurnosnim pravilima (RLS).</p>
      </div></div>`;
    document.body.appendChild(box);dialog=box;
    field('url').value=config.url||'';field('key').value=config.key||'';
    byId('ob-cloud-close').onclick=()=>box.style.display='none';box.addEventListener('click',e=>{if(e.target===box)box.style.display='none'});
    field('config').onclick=()=>{const url=normalize(field('url').value),key=field('key').value.trim();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key){notify('Neispravan Supabase URL ili ključ.','error');return}if(config.url&&config.url!==url){session=null;write(SESSION_KEY,null)}config={url,key};write(CONFIG_KEY,config);notify('Cloud postavke su spremljene. Prijavi se.','pending');};
    const action=async fn=>{try{await fn()}catch(e){notify('Greška: '+e.message,'error')}};
    field('login').onclick=()=>action(()=>login(field('email').value.trim(),field('password').value,false));
    field('signup').onclick=()=>action(()=>login(field('email').value.trim(),field('password').value,true));
    field('logout').onclick=()=>action(logout);
    field('sync').onclick=()=>action(()=>sync('auto'));
    field('pull').onclick=()=>action(async()=>{if(!confirm('Ovo zamjenjuje lokalnu bazu podacima iz clouda. Napravi backup u Postavkama prije nastavka. Nastaviti?'))return;await sync('download')});
    field('push').onclick=()=>action(async()=>{if(!confirm('Ovo zamjenjuje cloud podatke tvojim trenutnim lokalnim podacima! Na drugom uređaju možeš izgubiti novije izmjene. Nastaviti?'))return;await sync('upload')});
    field('merge').onclick=()=>action(async()=>{const row=await remote();if(!row){await sync('upload');return}const local=callbacks.getState();const merged={...local};for(const fieldName of ['projects','items','entries','proofs']){const map=new Map((row.payload[fieldName]||[]).map(x=>[x.id,x]));for(const item of local[fieldName]||[])map.set(item.id,item);merged[fieldName]=[...map.values()]};if(!confirm('Spojit ćemo zapise po ID-u (lokalni imaju prednost ako imaju isti ID). Izbrisani zapisi mogu se vratiti. Napravi backup prije nastavka. Nastaviti?'))return;callbacks.setState(merged);await uploadProofs(merged);await push(merged,row.revision)});
    refreshDialog();
  }
  const css=`#ob-cloud-overlay{position:fixed;inset:0;z-index:500;background:#0f1d30af;display:flex;align-items:center;justify-content:center;padding:15px;font:13px 'Segoe UI',Arial,sans-serif}.ob-cloud-box{max-width:620px;width:100%;max-height:92vh;overflow:auto;background:#fff;color:#1c2c41;border-radius:15px;box-shadow:0 24px 80px #0004}.ob-cloud-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #e4ebf3;padding:22px 24px}.ob-cloud-head h2{margin:0 0 5px;font-size:19px}.ob-cloud-head p{margin:0;color:#657488}.ob-cloud-head button{border:0;background:transparent;font-size:28px;cursor:pointer}.ob-cloud-body{padding:20px 24px}.ob-cloud-body label{display:block;color:#394b60;font-weight:650;margin:0 0 11px;font-size:12px}.ob-cloud-body input{display:block;width:100%;padding:10px;margin-top:5px;border:1px solid #cbd6e1;border-radius:8px;font-size:13px}.ob-cloud-rule{height:1px;background:#e7edf3;margin:17px 0}.ob-cloud-actions{display:flex;flex-wrap:wrap;gap:8px}.ob-cloud-button{border:1px solid #cbd6e1;color:#263b4f;background:#fff;padding:9px 12px;border-radius:8px;font-weight:650;cursor:pointer}.ob-cloud-button.primary{background:#15344f;color:#fff;border-color:#15344f}.ob-cloud-button:disabled{opacity:.5;cursor:not-allowed}.ob-cloud-hint{color:#6d7d90;font-size:12px;line-height:1.5}.ob-cloud-body code{font-size:11px}#ob-cloud-identity{font-weight:650;margin-top:14px}#ob-cloud-status{margin-top:9px;padding:11px;background:#edf4f6;border-radius:8px;color:#243a52;white-space:pre-wrap}`;
  document.head.appendChild(Object.assign(document.createElement('style'),{textContent:css}));
  async function downloadProof(id){if(!active())return null;try{return await request(`/storage/v1/object/authenticated/${BUCKET}/${encodeURIComponent(userId())}/${encodeURIComponent(id)}`,{raw:true})}catch(e){notify('Dokaznica nije dostupna u cloudu: '+e.message,'error');return null}}
  const api={
    attach(impl){callbacks=impl;notify(active()?'Cloud nalog je prijavljen.':'Lokalna verzija');if(active())setTimeout(()=>sync('auto'),350);if(!timer)timer=setInterval(()=>{if(active())sync('auto')},30000);},
    onLocalChange(){if(!active()||syncing)return;clearTimeout(pending);pending=setTimeout(()=>sync('auto'),1600)},
    open:ui,
    downloadProof,
    status:()=>({message,phase,email:session?.user?.email||''}),
    configured:()=>!!(config.url&&config.key),
  };
  window.OB_CLOUD=api;
})();