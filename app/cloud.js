/* OBRAČUN multi-tenant sync v0.2: separate companies, roles and site-scoped snapshots.
   Public Supabase URL/key are installed at release build time. NO service secrets here. */
(()=>{'use strict';
const SS='obracun-session-v2', CS='obracun-company-v2', CACHE='obracun-cache-v2:', META='obracun-revision-v2:', BUCKET='obracun-site-proofs';
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}},write=(k,v)=>v==null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const blank=()=>({projects:[],items:[],entries:[],proofs:[],selectedProject:null,selectedMonth:new Date().toISOString().slice(0,7),schemaVersion:2});
const anyData=s=>!!(['projects','items','entries','proofs'].some(k=>(s?.[k]||[]).length));
const payload=s=>({projects:s.projects||[],items:s.items||[],entries:s.entries||[],proofs:s.proofs||[]});
let conf=null,session=read(SS),cid=read(CS),memberships=[],users=[],callbacks=null,modal=null;
let applying=false,syncing=false,importPending=null,configured=false,status='Lokalna verzija',phase='offline',newInvite='',debounce,shadowState=null;
const uid=()=>session?.user?.id||'',org=()=>memberships.find(c=>c.id===cid),admin=()=>['owner','admin'].includes(org()?.role);
const canEdit=id=>!cid||admin()||(org()?.role==='editor'&&(org()?.all_sites||org()?.sites?.includes(id)));
const metaKey=()=>META+uid()+':'+cid,cacheKey=()=>CACHE+uid()+':'+cid;
function notice(m,p){status=m;phase=p||(configured?'connected':'offline');callbacks?.status?.({message:status,phase,company:org()?.name||'',email:session?.user?.email||''});const el=document.querySelector('#ob-account-status');if(el)el.textContent=status;}
function hash(x){let n=2166136261,s=JSON.stringify(x);for(const c of s){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return (n>>>0).toString(16)+':'+s.length}
function siteData(s,p){return {project:p,items:s.items.filter(i=>i.projectId===p.id),entries:s.entries.filter(i=>i.projectId===p.id),proofs:s.proofs.filter(i=>i.projectId===p.id)}}
function replaceSite(state,id,p){const s={...state};for(const k of ['projects','items','entries','proofs']){s[k]=state[k].filter(x=>(k==='projects'?x.id:x.projectId)!==id).concat(k==='projects'?(p.project?[p.project]:[]):p[k]||[])}if(!s.projects.find(x=>x.id===s.selectedProject))s.selectedProject=s.projects[0]?.id||null;return s}
function putState(s){shadowState=s;applying=true;callbacks?.setState?.(s);setTimeout(()=>{applying=false;shadowState=null},750)}
function backup(tag){const s=callbacks?.getState?.();if(!s)return;try{write('obracun-safety-'+tag+'-'+Date.now(),s)}catch{throw Error('Backup nije moguće pohraniti. Izvezi sigurnosnu kopiju iz Postavki.') }}
async function api(path,options={},auth=true,refreshing=false){if(!conf)throw Error('Cloud baza još nije aktivirana.');if(auth&&!refreshing&&session?.expires_at<Date.now()/1000+75)await refresh();const h={'apikey':conf.key,...options.headers};h.Authorization='Bearer '+(auth?session?.access_token:conf.key);if(auth&&!session?.access_token)throw Error('Prijavi se.');const r=await fetch(conf.url+path,{...options,headers:h,cache:'no-store'});if(options.binary){if(!r.ok)throw Error('HTTP '+r.status);return r.blob()}const t=await r.text();let j;try{j=t?JSON.parse(t):null}catch{j=t}if(!r.ok)throw Error(j?.message||j?.msg||j?.error_description||j?.error||'Server HTTP '+r.status);return j}
const post=(path,data,auth=true)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)},auth);
async function refresh(){if(!session?.refresh_token)throw Error('Prijava je istekla.');const j=await post('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token},false);session={...j,expires_at:Math.floor(Date.now()/1000)+(j.expires_in||3600)};write(SS,session)}
async function signin(email,password,signup){if(!email.trim()||password.length<8)throw Error('Upiši e-mail i lozinku (najmanje 8 znakova).');const j=await post(signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password',{email:email.trim(),password},false);if(!j.access_token){notice('Provjeri e-mail da potvrdiš registraciju, zatim se prijavi.','pending');return}session={...j,expires_at:Math.floor(Date.now()/1000)+(j.expires_in||3600)};write(SS,session);cid=null;write(CS,null);await loadCompanies();notice('Prijavljen','connected')}
async function loadCompanies(){const ms=await api('/rest/v1/obracun_members?select=company_id,role,all_sites');const cs=await api('/rest/v1/obracun_companies?select=id,name&order=name.asc');const gs=await api('/rest/v1/obracun_site_grants?select=company_id,site_id,user_id&user_id=eq.'+encodeURIComponent(uid()));memberships=ms.map(m=>({id:m.company_id,role:m.role,all_sites:m.all_sites,name:cs.find(x=>x.id===m.company_id)?.name||'Firma',sites:gs.filter(x=>x.company_id===m.company_id).map(x=>x.site_id)}));if(cid&&!org()){cid=null;write(CS,null)}if(!cid&&memberships.length===1)await selectCompany(memberships[0].id);else if(cid)await selectCompany(cid);else notice('Kreiraj firmu ili prihvati pozivnicu','pending')}
async function createCompany(name){const id=await post('/rest/v1/rpc/obracun_create_company',{p_name:name});await loadCompanies();await selectCompany(id)}
async function acceptCode(code){const id=await post('/rest/v1/rpc/obracun_accept_invite',{p_token:code});await loadCompanies();await selectCompany(id)}
async function selectCompany(id){if(!memberships.some(x=>x.id===id))throw Error('Nemaš pristup firmi.');if(cid&&cid!==id)write(cacheKey(),shadowState||callbacks.getState());const old=callbacks?.getState?.()||blank();cid=id;write(CS,id);const cache=read(cacheKey());if(cache){importPending=null;putState(cache);await sync()}else if(anyData(old)){importPending=structuredClone(old);notice('Pronađeni lokalni obračuni. Odaberi prijenos ili cloud.','pending')}else{importPending=null;putState(blank());await sync()}render()}
async function cloudOnly(){backup('before-cloud');importPending=null;putState(blank());await sync();render()}
async function importLocal(){if(!admin())throw Error('Samo administrator može uvesti gradilišta.');if(!importPending)return;const remote=await api('/rest/v1/obracun_sites?select=site_id&company_id=eq.'+encodeURIComponent(cid));const ids=new Set(remote.map(x=>x.site_id));for(const p of importPending.projects)if(ids.has(p.id))throw Error('Gradilište '+p.name+' već postoji u cloudu. Prijenos zaustavljen.');backup('before-import');const p=importPending;importPending=null;putState(p);await sync();render()}
async function signout(){if(cid)write(cacheKey(),callbacks.getState());backup('logout');session=null;write(SS,null);cid=null;write(CS,null);memberships=[];users=[];importPending=null;putState(blank());notice('Odjavljen','offline');render()}
async function proofUpload(p){const file=await callbacks?.getProof?.(p.id);if(!file)return;const path='/storage/v1/object/'+BUCKET+'/'+encodeURIComponent(cid)+'/'+encodeURIComponent(p.projectId)+'/'+encodeURIComponent(p.id);const r=await fetch(conf.url+path,{method:'POST',headers:{apikey:conf.key,Authorization:'Bearer '+session.access_token,'x-upsert':'true','Content-Type':file.type||p.mime||'application/octet-stream'},body:file});if(!r.ok)throw Error('Dokaznica '+p.filename+' nije prenesena: HTTP '+r.status)}
async function proofDownload(id){if(!cid||!session)return null;const p=callbacks?.getState?.()?.proofs.find(x=>x.id===id);if(!p)return null;try{if(session.expires_at<Date.now()/1000+75)await refresh();return await api('/storage/v1/object/authenticated/'+BUCKET+'/'+encodeURIComponent(cid)+'/'+encodeURIComponent(p.projectId)+'/'+encodeURIComponent(id),{binary:true})}catch(e){notice('Dokaznica: '+e.message,'error');return null}}
async function saveSite(p,rev){for(const proof of p.proofs)await proofUpload(proof);let rows;if(rev===0){rows=await api('/rest/v1/obracun_sites',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({company_id:cid,site_id:p.project.id,payload:p,revision:1,updated_by:uid()})})}else{rows=await api('/rest/v1/obracun_sites?company_id=eq.'+encodeURIComponent(cid)+'&site_id=eq.'+encodeURIComponent(p.project.id)+'&revision=eq.'+rev,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({revision:rev+1,updated_by:uid(),updated_at:new Date().toISOString(),payload:p})})}if(!rows?.length)throw Error('Istovremena izmjena na drugom uređaju: '+p.project.name);return rows[0]}
async function sync(){if(!cid||!session||syncing||importPending)return;syncing=true;notice('Sinhronizacija…','busy');try{let state=(shadowState||callbacks.getState()),metadata=read(metaKey())||{},next={...metadata},rows=await api('/rest/v1/obracun_sites?select=site_id,revision,payload&company_id=eq.'+encodeURIComponent(cid)),rowMap=new Map(rows.map(x=>[x.site_id,x])),errors=[];for(const p of state.projects){const local=siteData(state,p),h=hash(local),remote=rowMap.get(p.id),saved=metadata[p.id];if(!remote){if(saved){errors.push(p.name+' (uklonjeno u cloudu)');continue}if(!admin()){errors.push(p.name+' (nema dozvole za novo gradilište)');continue}const r=await saveSite(local,0);next[p.id]={revision:r.revision,hash:h};continue}if(!saved){if(h!==hash(remote.payload)){errors.push(p.name+' (lokalni i cloud podaci se razlikuju)');continue}next[p.id]={revision:remote.revision,hash:h};continue}const rc=remote.revision!==saved.revision,lc=h!==saved.hash;if(rc&&lc){errors.push(p.name+' (izmijenjeno na dva uređaja)');continue}if(rc){state=replaceSite(state,p.id,remote.payload);next[p.id]={revision:remote.revision,hash:hash(remote.payload)}}else if(lc){if(!canEdit(p.id)){errors.push('Nema dozvole za '+p.name);continue}const r=await saveSite(local,remote.revision);next[p.id]={revision:r.revision,hash:h}}}
for(const row of rows)if(!state.projects.some(p=>p.id===row.site_id)){state=replaceSite(state,row.site_id,row.payload);next[row.site_id]={revision:row.revision,hash:hash(row.payload)}}write(metaKey(),next);write(cacheKey(),state);if(JSON.stringify(payload(state))!==JSON.stringify(payload(shadowState||callbacks.getState())))putState(state);notice(errors.length?'Konflikt: '+errors.join('; ')+'. Podaci nisu prepisani.':'Sinhronizovano · '+new Date().toLocaleTimeString('bs-BA',{hour:'2-digit',minute:'2-digit'}),errors.length?'conflict':'connected')}catch(e){notice('Cloud greška: '+e.message,'error')}finally{syncing=false;render()}}
async function listUsers(){if(!admin())throw Error('Nemaš dozvolu.');users=await post('/rest/v1/rpc/obracun_list_users',{p_company:cid});render()}
async function invite(email,role,all,ids){newInvite=await post('/rest/v1/rpc/obracun_create_invite',{p_company:cid,p_email:email,p_role:role,p_all_sites:all,p_sites:ids});render()}
async function editUser(id,role,all,ids){await post('/rest/v1/rpc/obracun_update_member',{p_company:cid,p_user:id,p_role:role,p_all_sites:all,p_sites:ids});await listUsers()}
async function removeUser(id){if(!confirm('Ukloniti korisnika?'))return;await post('/rest/v1/rpc/obracun_remove_member',{p_company:cid,p_user:id});await listUsers()}
function choices(prefix,checked=[]){return '<div class="ob-account-sites" id="'+prefix+'-sites">'+(callbacks?.getState?.()?.projects||[]).map(p=>'<label><input type="checkbox" value="'+esc(p.id)+'" '+(checked.includes(p.id)?'checked':'')+'> '+esc(p.name)+'</label>').join('')+'</div>'}
const CSS=`#ob-account-layer{position:fixed;inset:0;z-index:600;display:none;align-items:center;justify-content:center;padding:14px;background:#101c2ac0;font:13px 'Segoe UI',Arial,sans-serif}#ob-account-modal{max-height:94vh;overflow:auto;width:min(660px,100%);background:white;color:#213447;border-radius:15px;box-shadow:0 20px 70px #0004}#ob-account-modal header{display:flex;justify-content:space-between;align-items:center;padding:20px 23px;border-bottom:1px solid #dfe8f0}#ob-account-modal h2{font-size:19px;margin:0}#ob-account-modal header button{font-size:24px;border:0;background:none;cursor:pointer}#ob-account-body{padding:20px 23px}#ob-account-body h3{font-size:14px;margin:16px 0 6px}#ob-account-body p{color:#60758a;line-height:1.5}#ob-account-body label{display:block;font-weight:600;font-size:12px;margin:9px 0}#ob-account-body input:not([type=checkbox]),#ob-account-body select{display:block;width:100%;border:1px solid #c9d5df;border-radius:7px;padding:10px;margin-top:5px;font:inherit}#ob-account-body input[type=checkbox]{margin-right:6px}#ob-account-body .actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}#ob-account-body .action{border:1px solid #bbcbd9;background:#f3f7fa;color:#20364a;padding:9px 12px;border-radius:7px;font-weight:600;cursor:pointer}#ob-account-body .action.primary{background:#14364e;color:white;border-color:#14364e}#ob-account-body .box{padding:13px 15px;background:#f4f8fa;border:1px solid #e0e8ef;border-radius:8px;margin:12px 0}#ob-account-body .ob-account-sites{max-height:135px;overflow:auto;border:1px solid #dae5ef;border-radius:7px;padding:6px}#ob-account-body .ob-account-sites label{font-weight:400;margin:5px}#ob-account-body code{display:block;padding:11px;word-break:break-all;background:#e8f1f7;border-radius:6px}#ob-account-body .userrow{padding:12px 0;border-top:1px solid #dfe8f0}#ob-account-status{margin-top:15px;color:#315673;white-space:pre-wrap}`;
document.head.appendChild(Object.assign(document.createElement('style'),{textContent:CSS}));
function ensureModal(){if(modal)return;modal=document.createElement('div');modal.id='ob-account-layer';modal.innerHTML='<section id="ob-account-modal" role="dialog" aria-modal="true"><header><h2>OBRAČUN · Firma i korisnici</h2><button type="button" id="ob-account-close">×</button></header><div id="ob-account-body"></div></section>';document.body.appendChild(modal);document.getElementById('ob-account-close').onclick=()=>{modal.style.display='none'};modal.addEventListener('mousedown',e=>{if(e.target===modal)modal.style.display='none'});modal.addEventListener('click',async e=>{const btn=e.target.closest('[data-op]');if(!btn)return;try{btn.disabled=true;const val=id=>document.getElementById(id)?.value||'',checked=id=>!!document.getElementById(id)?.checked,ids=id=>Array.from(document.querySelectorAll('#'+id+'-sites input:checked')).map(x=>x.value);switch(btn.dataset.op){case 'login':case 'signup':await signin(val('ob-email'),val('ob-password'),btn.dataset.op==='signup');break;case 'create':await createCompany(val('ob-company-name'));break;case 'accept':await acceptCode(val('ob-invite-code'));break;case 'choose':await selectCompany(btn.dataset.id);break;case 'import':await importLocal();break;case 'cloudonly':await cloudOnly();break;case 'sync':await sync();break;case 'users':await listUsers();break;case 'invite':await invite(val('ob-email-invite'),val('ob-role-invite'),checked('ob-all-invite'),ids('ob-invite'));break;case 'edit':await editUser(btn.dataset.id,val('ob-role-'+btn.dataset.id),checked('ob-all-'+btn.dataset.id),ids('ob-'+btn.dataset.id));break;case 'remove':await removeUser(btn.dataset.id);break;case 'copy':await navigator.clipboard.writeText(newInvite);notice('Kopirano','connected');break;case 'logout':await signout();break}}catch(err){notice(err.message,'error')}finally{render()}})}
function render(){
 if(!modal || modal.style.display==='none')return;
 let out='';
 if(!configured){
   out='<div class="box"><h3>Cloud još nije aktiviran</h3><p>Korisnici ne unose API ključeve. Vlasnik softvera jednom poveže centralnu bazu. Do tada lokalni obračuni normalno rade.</p></div>';
 } else if(!session?.access_token){
   out='<p>Registracija i prijava bez tehničkih postavki.</p>'+
    '<label>E-mail<input type="email" id="ob-email" autocomplete="username"></label>'+
    '<label>Lozinka<input type="password" id="ob-password" autocomplete="current-password"></label>'+
    '<div class="actions"><button class="action primary" data-op="login">Prijava</button><button class="action" data-op="signup">Registracija</button></div>';
 } else {
   out='<div class="box"><b>'+esc(session.user?.email)+'</b><p>Prijavljen korisnik</p></div>';
   if(memberships.length){
     out+='<h3>Moje firme</h3><div class="actions">'+memberships.map(m=>
       '<button class="action '+(m.id===cid?'primary':'')+'" data-op="choose" data-id="'+esc(m.id)+'">'+esc(m.name)+' · '+esc(m.role)+'</button>'
     ).join('')+'</div>';
   }
   out+='<div class="box"><h3>Registruj firmu</h3><label>Naziv firme<input id="ob-company-name" placeholder="Naziv firme"></label><button class="action primary" data-op="create">Kreiraj firmu</button></div>';
   out+='<div class="box"><h3>Prihvati pozivnicu</h3><label>Kod pozivnice<input id="ob-invite-code"></label><button class="action" data-op="accept">Pridruži se firmi</button></div>';
   if(cid){
     out+='<h3>'+esc(org()?.name)+' · '+esc(org()?.role)+'</h3>';
     if(importPending){
       out+='<div class="box"><b>Pronađeni su lokalni obračuni.</b><p>Odaberi prijenos u firmu ili otvaranje clouda. Sigurnosna kopija ostaje na uređaju.</p><div class="actions">'+
         (admin()?'<button class="action primary" data-op="import">Prenesi lokalne obračune</button>':'')+
         '<button class="action" data-op="cloudonly">Otvori cloud</button></div></div>';
     } else {
       out+='<div class="actions"><button class="action primary" data-op="sync">Sinhronizuj sada</button>'+
         (admin()?'<button class="action" data-op="users">Korisnici i dozvole</button>':'')+'</div>';
     }
     if(admin()){
       out+='<div class="box"><h3>Pozovi korisnika</h3><label>E-mail<input type="email" id="ob-email-invite"></label>'+
         '<label>Uloga<select id="ob-role-invite">'+(org()?.role==='owner'?'<option value="admin">Administrator</option>':'')+
         '<option value="editor" selected>Editor</option><option value="viewer">Preglednik</option></select></label>'+
         '<label><input type="checkbox" id="ob-all-invite" checked> Sva gradilišta</label>'+choices('ob-invite')+
         '<button class="action primary" data-op="invite">Kreiraj pozivnicu</button><p>Kod vrijedi 7 dana. Korisnik ga unosi nakon registracije.</p></div>';
       if(newInvite){
         out+='<div class="box"><b>Kod pozivnice</b><code>'+esc(newInvite)+'</code><button class="action" data-op="copy">Kopiraj kod</button></div>';
       }
       if(users.length){
         out+='<div class="box"><h3>Korisnici firme</h3>';
         for(const u of users){
           out+='<div class="userrow"><b>'+esc(u.email)+'</b> · '+esc(u.role);
           if(u.role!=='owner'){
             out+='<label>Uloga<select id="ob-role-'+esc(u.user_id)+'">';
             out+=['admin','editor','viewer'].filter(r=>r!=='admin'||org()?.role==='owner').map(r=>
               '<option value="'+r+'" '+(r===u.role?'selected':'')+'>'+r+'</option>'
             ).join('')+'</select></label>';
             out+='<label><input type="checkbox" id="ob-all-'+esc(u.user_id)+'" '+(u.all_sites?'checked':'')+'> Sva gradilišta</label>'+
               choices('ob-'+u.user_id,u.site_ids||[])+
               '<div class="actions"><button class="action" data-op="edit" data-id="'+esc(u.user_id)+'">Spremi</button><button class="action" data-op="remove" data-id="'+esc(u.user_id)+'">Ukloni</button></div>';
           }
           out+='</div>';
         }
         out+='</div>';
       }
     }
   }
   out+='<div class="actions"><button class="action" data-op="logout">Odjava</button></div>';
 }
 document.getElementById('ob-account-body').innerHTML=out+'<div id="ob-account-status">'+esc(status)+'</div>';
 document.querySelectorAll('#ob-account-body .ob-account-sites').forEach(box=>{
   const check=document.getElementById(box.id.replace('-sites','-all'));
   if(check){
     box.style.display=check.checked?'none':'block';
     check.addEventListener('change',()=>box.style.display=check.checked?'none':'block');
   }
 });
}
function open(){ensureModal();modal.style.display='flex';render()}
async function bootstrap(){try{const r=await fetch('/api/cloud/config',{cache:'no-store'});if(!r.ok)throw Error('Konfiguracija nije dostupna');const v=await r.json();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(v.url||'')||!v.publishableKey)throw Error('Nije povezana centralna baza');conf={url:v.url,key:v.publishableKey};configured=true;notice('Cloud spreman za prijavu','pending');if(session?.access_token){try{await loadCompanies()}catch(e){session=null;write(SS,null);notice('Prijava je istekla: prijavi se ponovo','offline')}}}catch(e){configured=false;notice('Lokalna verzija · Cloud nije aktiviran','offline')}render()}
function attach(impl){callbacks=impl;notice('Lokalna verzija','offline');bootstrap();setInterval(()=>{if(cid&&session&&!importPending)sync()},30000)}
function onLocalChange(){if(!cid||!session||applying||syncing||importPending)return;clearTimeout(debounce);debounce=setTimeout(sync,1800)}
function authorizeChange(old,next){if(!cid||!session||admin())return true;if(org()?.role==='viewer')return JSON.stringify(payload(old))===JSON.stringify(payload(next));if(org()?.role==='editor'){if(JSON.stringify(old.projects)!==JSON.stringify(next.projects))return false;for(const k of ['items','entries','proofs']){const a=new Map(old[k].map(x=>[x.id,x])),b=new Map(next[k].map(x=>[x.id,x]));for(const [id,x] of b)if(JSON.stringify(x)!==JSON.stringify(a.get(id))&&!canEdit(x.projectId))return false;for(const [id,x] of a)if(!b.has(id)&&!canEdit(x.projectId))return false}}return true}
window.OB_CLOUD={attach,onLocalChange,open,downloadProof:proofDownload,canEdit,authorizeChange,status:()=>({message:status,phase}),configured:()=>configured};
})();