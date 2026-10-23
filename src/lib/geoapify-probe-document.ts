// Temporary standalone document: no product navigation or private group reads.
export function probeDocument(nonce: string, release: string, jobs: readonly unknown[], studyId: string, maxCalls: number, maxCredits: number) {
  const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Geoapify sökprov · Matrundan</title>
<style>*{box-sizing:border-box}body{font:16px/1.5 system-ui,sans-serif;margin:0;color:#24332d;background:#f5f5ef}main{max-width:1150px;margin:auto;padding:24px}h1{font-size:28px}h2{font-size:21px}p{max-width:80ch}button,a{min-height:44px}button{font:inherit;padding:10px 16px;border:1px solid #355747;border-radius:6px;background:#355747;color:white;cursor:pointer}button:disabled{opacity:.45;cursor:default}a{color:#26573e}code{font-size:12px;overflow-wrap:anywhere}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #e0a84a;outline-offset:3px}.controls{display:flex;flex-wrap:wrap;gap:10px}.panel{background:white;border:1px solid #d5dbd2;padding:18px;border-radius:8px;margin:18px 0}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #ddd}td:nth-child(3){min-width:160px;max-width:330px}summary{cursor:pointer;min-height:44px;padding:8px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}.muted{color:#55655b}#state{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:500px){main{padding:16px}h1{font-size:24px}.controls button{width:100%}td,th{padding:8px}}</style>
<main><p class="muted">Tillfällig diagnostik · ska inte mergas</p><h1>Geoapify sökprov</h1><p>Bred undersökning av alla 43 befintliga sökval i sex svenska områden, kompletterat med kategorijämförelser och 10/25 km-radier. Identiska leverantörsanrop delas inom varje område. Försöken reserveras och sparas i IndexedDB före respektive efter anropet. Inga Geoapify-anrop sker vid sidladdning och osäkra försök körs aldrig om automatiskt.</p><p>Version: <code id="release">${release}</code></p>
<div class="panel"><h2>1. Kontrollera åtkomsten</h2><p>Logga vid behov in med det befintliga staging-agentkontot i <a href="/" target="_blank" rel="noopener">vanliga appen</a>, och återvänd hit. Endast en uttryckligen låst operatör får förbruka API-anrop.</p><div class="controls"><button id="status">Kontrollera åtkomst och lagring · 0 API-anrop</button></div><p id="access-result" role="status" aria-live="polite" class="muted">Ingen åtkomstkontroll utförd.</p></div>
<div class="panel"><h2>2. Kör jämförelsen</h2><p>Samtliga befintliga sökval i sex områden vid 2 km, plus alternativa strategier och större radier. Första sidorna körs först; därefter begränsad paginering. Högst ${maxCalls} nya försök och ${maxCredits} konservativt reserverade krediter. Lämna fliken öppen under körning; du kan stoppa och fortsätta senare på samma branchpreview.</p><div class="controls"><button id="start" disabled>Starta eller fortsätt undersökningen</button><button id="stop" disabled>Stoppa efter pågående anrop</button></div></div>
<div class="panel"><h2>Status och export</h2><p id="state" role="status" aria-live="polite">Inga nya API-anrop gjorda. Laddar tidigare delresultat…</p><div class="controls"><button id="json">Exportera JSON</button><button id="csv">Exportera CSV</button></div><p class="muted">Resultat sparas i IndexedDB på just denna previewdomän och överlever omladdning. Exportera JSON även om du avbryter. De 15 senaste mätningarna syns på skärmen. Starta inte samtidigt på flera enheter; budgeten kan inte garanteras globalt mellan Cloudflare-instanser. Krediterna är uppskattade reservationer, inte faktisk leverantörsdebitering. Offentliga OSM-taggar är inte menyverifiering. Tidigare undersökningar finns i separata exporter.</p></div>
<h2>Uppmätta resultat</h2><div class="table-wrap"><table><thead><tr><th>Område / scenario</th><th>Kategorier / villkor</th><th>Faktiska matställen</th><th>Mätning</th></tr></thead><tbody id="rows"></tbody></table></div>
<details><summary>Återstående testmatris</summary><pre id="plan"></pre></details><details><summary>Exportdata för granskning</summary><pre id="evidence"></pre></details></main>
<script nonce="${nonce}">

const release=${safeJson(release)};const jobs=${safeJson(jobs)};const studyId=${safeJson(studyId)};
const MAX_CALLS=${maxCalls},MAX_CREDITS=${maxCredits},LIMIT=100;
const el=id=>document.getElementById(id);
el('release').textContent=release;
el('plan').textContent=JSON.stringify({studyId,plannedJobs:jobs.length,jobs},null,2);
const keyPrefix='matrundan-geoapify-probe-wide-v1';
const lockName='matrundan-geoapify-probe-wide-v1';
let active=false,stopping=false,authorized=false;
let dbPromise;
function openDb(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(new Error('IndexedDB saknas'));return}
  const req=indexedDB.open(keyPrefix,1);
  req.onupgradeneeded=()=>{req.result.createObjectStore('entries',{keyPath:'key'})};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||new Error('Lagring misslyckades'));
 });
 return dbPromise;
}
async function put(item){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('entries','readwrite');
  tx.objectStore('entries').put(item);
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error('Kan inte spara provresultatet'));
 });
}
async function all(){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('entries','readonly');
  const req=tx.objectStore('entries').getAll();
  req.onsuccess=()=>resolve(req.result.filter(e=>e.studyId===studyId&&Number.isInteger(e.index)&&Number.isInteger(e.offset)));
  req.onerror=()=>reject(req.error||new Error('Kan inte läsa sparade prov'));
 });
}
async function preflightStore(){
 const test={key:'__storage_test__',studyId:'test'};
 await put(test);
 const db=await openDb();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('entries','readwrite');
  tx.objectStore('entries').delete(test.key);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });
 // Fliklåset väljs separat; vissa mobila webbläsare saknar navigator.locks.
}
const localKey=(idx,offset)=>studyId+':'+idx+':'+offset;
function usage(entries){
 return {calls:entries.filter(e=>e.state!=='ignored').length,
  credits:entries.filter(e=>e.state!=='ignored').reduce((n,e)=>n+(e.reservedCredits||5),0),
  done:entries.filter(e=>e.state==='done'&&e.row?.status===200&&!e.row.error).length,
  uncertain:entries.filter(e=>e.state!=='done').length};
}
function state(message,stats){
 el('state').textContent=message+'\\nTotalt reserverade anrop i detta andra prov: '+stats.calls+'/'+MAX_CALLS+
  ' · reserverade krediter: '+stats.credits+'/'+MAX_CREDITS+
  '\\nNya sparade svar: '+stats.done+' · osäkra försök: '+stats.uncertain+
  '\\nÄldre prover ligger i tidigare exporter; denna mätning har en egen anropsbudget.';
}
async function render(message){
 const records=(await all()).filter(e=>e.key!=='__storage_test__');
 const stats=usage(records);
 state(message,stats);
 const container=el('rows');container.replaceChildren();
 const recent=records.slice(-15).reverse();
 for(const entry of recent){
  const tr=document.createElement('tr');
  const add=text=>{const td=document.createElement('td');td.textContent=String(text);tr.append(td);return td};
  const job=jobs[entry.index];
  add((job?.area?.label||'')+' / '+(job?.strategy||'')+' / '+entry.offset);
  add((job?.categories||[]).join(', ')+' '+(job?.conditions||[]).join(', '));
  const td=add('');
  if(entry.state==='done'&&entry.row){
   const details=document.createElement('details');
   const summary=document.createElement('summary');
   summary.textContent=entry.row.count+' träffar'+(entry.row.capped?' · fullt':'');
   details.append(summary);
   details.addEventListener('toggle',()=>{
    if(!details.open||details.querySelector('ul'))return;
    const list=document.createElement('ul');
    for(const p of entry.row.places||[]){
     const li=document.createElement('li');li.textContent=(p.name||'(namn saknas)')+' · '+p.address+' · '+JSON.stringify(p.osm||{});
     list.append(li);
    }
    details.append(list);
   });
   td.append(details);
  }else td.textContent='Osäkert försök – körs inte om automatiskt';
  add(entry.state==='done'?(entry.row?.status||'Inget HTTP-svar')+' · '+(entry.row?.durationMs||0)+' ms':entry.error||entry.state);
  container.append(tr);
 }
 return {records,stats};
}
async function api(input){
 let token;
 try{const saved=localStorage.getItem('sb-wpihfmwbubvdiaavtpia-auth-token');if(saved)token=JSON.parse(saved).access_token}catch{}
 const response=await fetch(location.pathname,{method:'POST',
  headers:{'content-type':'application/json',...(token?{'authorization':'Bearer '+token}:{})},
  body:JSON.stringify(input),cache:'no-store'});
 const data=await response.json().catch(()=>{throw new Error('Ogiltigt eller avbrutet HTTP-svar')});
 if(!response.ok)throw new Error(data.error||'HTTP '+response.status);
 return data;
}
function nextTask(records){
 const byKey=new Map(records.map(e=>[e.key,e]));
 for(let index=0;index<jobs.length;index++){
  const k=localKey(index,0);
  if(!byKey.has(k))return {index,offset:0,key:k};
 }
 for(let index=0;index<jobs.length;index++){
  for(let offset=LIMIT;offset<jobs[index].maxPages*LIMIT;offset+=LIMIT){
   const prev=byKey.get(localKey(index,offset-LIMIT));
   if(!prev||prev.state!=='done'||!prev.row?.capped||prev.row?.error)break;
   const k=localKey(index,offset);
   if(!byKey.has(k))return {index,offset,key:k};
  }
 }
 return null;
}
el('status').onclick=async()=>{
 el('status').disabled=true;el('start').disabled=true;authorized=false;
 const result=el('access-result');result.textContent='Kontrollerar agentkontot på servern…';
 try{
  const r=await api({action:'status'});
  if(r.release!==release||r.studyId!==studyId||r.jobCount!==jobs.length)throw new Error('Previewns serverversion eller testmatris matchar inte sidan. Ladda om.');
  if(!r.configured)throw new Error('Geoapify-nyckeln saknas i previewmiljön.');
  if(!r.authenticated)throw new Error('Ingen giltig agentsession på den här previewdomänen. Logga in via vanliga appen på samma adress.');
  if(!r.authorized)throw new Error('Inloggat konto är inte tillåtet staging-agentkonto.');
  result.textContent='Agentkontot är godkänt. Kontrollerar webbläsarens lagring…';
  await preflightStore();
  authorized=true;el('start').disabled=false;
  result.textContent='Åtkomst och lagring fungerar. '+(navigator.locks?.request?'Inbyggt fliklås.':'IndexedDB-fliklås.');
  await render('Åtkomst och lagring verifierade. Starta eller fortsätt undersökningen.');
 }catch(e){
  const msg=e?.message||String(e);result.textContent='Kontrollen stoppades: '+msg;
  await render('Stopp: '+msg).catch(()=>{el('state').textContent=msg});
 }finally{el('status').disabled=false}
};

// Atomic cross-tab lease for Android browsers without navigator.locks.
// This never changes the authenticated server-side operator restriction.
async function withSingleTabLock(task){
 if(navigator.locks?.request){
  return navigator.locks.request(lockName,{ifAvailable:true},async lock=>{
   if(!lock)throw new Error('En annan flik kör redan provet.');
   return task();
  });
 }
 const db=await openDb(),key='__active_run__',owner=crypto.randomUUID();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries');
  const request=store.get(key);
  request.onsuccess=()=>{
   const other=request.result;
   if(other&&Date.now()-other.touchedAt<120000){tx.abort();return}
   store.put({key,owner,release:'lock',touchedAt:Date.now()});
  };
  tx.oncomplete=resolve;
  tx.onabort=()=>reject(new Error('En annan flik kör provet. Använd bara en flik.'));
  tx.onerror=()=>reject(tx.error||new Error('Felliknade fliklås'));
 });
 const heartbeat=setInterval(()=>{
  const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries');
  const req=store.get(key);
  req.onsuccess=()=>{if(req.result?.owner===owner)store.put({...req.result,touchedAt:Date.now()})};
 },10000);
 try{return await task()}finally{
  clearInterval(heartbeat);
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries');
   const req=store.get(key);
   req.onsuccess=()=>{if(req.result?.owner===owner)store.delete(key)};
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
 }
}

el('start').onclick=async()=>{
 if(active||!authorized)return;
 active=true;stopping=false;el('start').disabled=true;el('stop').disabled=false;
 try{
  await withSingleTabLock(async()=>{
   while(!stopping){
    const current=await all();
    const stats=usage(current);
    if(stats.calls>=MAX_CALLS||stats.credits+5>MAX_CREDITS){
     await render('Budgetgränsen nådd. Inga fler API-anrop skickas.');break;
    }
    const task=nextTask(current);
    if(!task){await render('Alla tillåtna scenarier som ryms är klara. Exportera JSON.');break}
    // Reserve and persist BEFORE making the outbound request.
    const pending={key:task.key,release,studyId,index:task.index,offset:task.offset,state:'started',
      reservedCredits:5,at:new Date().toISOString()};
    await put(pending);
    await render('Pågår: '+jobs[task.index].area.label+' / '+jobs[task.index].strategy+
      ', sida '+(1+task.offset/LIMIT));
    try{
     const result=await api({action:'query',index:task.index,offset:task.offset});
     if(!result.row||result.row.status==null)throw new Error(result.row?.error||'Geoapify-svar saknas');
     await put({...pending,state:'done',row:result.row});
     if([401,403,429].includes(result.row.status)||result.row.status>=500){
      await render('Geoapify svarade HTTP '+result.row.status+'. Körningen stoppas utan automatiska återförsök. Exportera underlaget.');break;
     }
     if(task.offset===0||task.offset%200===0)await render('Mätningen sparad. Fortsätter…');
    }catch(e){
     await put({...pending,state:'unknown',error:String(e.message||e)});
     await render('Avbrutet eller osäkert svar: '+e.message+
       '. Resultatet sparat som osäkert och körs inte om automatiskt. Tryck fortsätt för övriga scenarier.');
     break;
    }
   }
  });
 }catch(e){await render('Stopp: '+e.message).catch(()=>{})}
 finally{active=false;el('stop').disabled=true;el('start').disabled=!authorized}
};
el('stop').onclick=()=>{stopping=true;el('stop').disabled=true};
function download(name,content,type){
 const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
el('json').onclick=async()=>{
 try{
  const entries=await all(),stats=usage(entries);
  const documentData={release,studyId,createdAt:new Date().toISOString(),plannedJobs:jobs.length,limits:{calls:MAX_CALLS,credits:MAX_CREDITS},
   calls:stats.calls,reservedCreditsUpperBound:stats.credits,creditsVerified:false,
   completed:stats.done,unknown:stats.uncertain,rows:entries.filter(e=>e.state==='done').map(e=>e.row),
   uncertainJobs:entries.filter(e=>e.state!=='done').map(e=>({index:e.index,offset:e.offset,error:e.error||e.state})),
   limitations:['Ingen menyverifiering','Inget kontoavläst kreditutfall','Globalt kvottak inte garanterat över olika Worker-instanser']};
  download('matrundan-geoapify-komplettering.json',JSON.stringify(documentData,null,2),'application/json');
 }catch(e){el('state').textContent='Exportfel: '+e.message}
};
el('csv').onclick=async()=>{
 try{
  const entries=(await all()).filter(e=>e.state==='done');
  const q=v=>{let s=String(v??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};
  const rows=[['area','scenario','offset','http','ms','count','place_id','name','address','osm']];
  for(const e of entries)for(const p of e.row?.places?.length?e.row.places:[{}]){
   rows.push([jobs[e.index].area.label,jobs[e.index].strategy,e.offset,e.row.status,e.row.durationMs,e.row.count,p.id,p.name,p.address,JSON.stringify(p.osm||{})]);
  }
  download('matrundan-geoapify-komplettering.csv',rows.map(r=>r.map(q).join(',')).join('\\r\\n'),'text/csv;charset=utf-8');
 }catch(e){el('state').textContent='Exportfel: '+e.message}
};
render('Tidigare resultat läses från beständig lagring. Kontrollera åtkomsten innan körning.')
 .catch(e=>{el('state').textContent='Lagringen fungerar inte: '+e.message});
// Access preflight uses Supabase authentication, but makes zero Geoapify calls.
el('status').click();

</script></html>`;
}
