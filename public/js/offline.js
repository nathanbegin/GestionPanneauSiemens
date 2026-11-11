// Consultation hors ligne : réponses de l'API conservées dans IndexedDB (sur l'appareil seulement).
// - « Télécharger » un site conserve le site et tous ses panneaux pour les relire sans réseau.
// - L'identité, la liste des sites et le forfait sont aussi gardés pour que l'application s'ouvre hors ligne.
// - Tout est effacé à la déconnexion ou si un autre compte se connecte sur l'appareil.
// Les modifications hors ligne ne sont pas permises : l'enregistrement échoue avec « Connexion impossible ».
const DB='mp-offline';
const open=()=>new Promise((res,rej)=>{
 if(typeof indexedDB==='undefined')return rej(new Error('indexedDB indisponible'));
 const r=indexedDB.open(DB,1);
 r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('resp',{keyPath:'key'});d.createObjectStore('sites',{keyPath:'id'});};
 r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
});
async function run(store,mode,fn){
 try{
  const d=await open();
  return await new Promise((res,rej)=>{const t=d.transaction(store,mode),req=fn(t.objectStore(store));t.oncomplete=()=>{res(req?.result);d.close();};t.onerror=()=>{rej(t.error);d.close();};t.onabort=()=>{rej(t.error);d.close();};});
 }catch{return undefined;}
}
// Chemins mis en cache automatiquement à chaque lecture réussie (petits) ; les sites et panneaux le sont au téléchargement.
const ALWAYS=p=>p==='/api/auth'||p==='/api/sites'||p==='/api/billing';
const PER_SITE=p=>/^\/api\/(sites|panels)\?id=[0-9a-f-]{36}$/i.test(p);
export const cacheable=p=>ALWAYS(p)||PER_SITE(p);

export const saveResponse=(key,data)=>run('resp','readwrite',s=>s.put({key,data,at:Date.now()}));
export const readResponse=key=>run('resp','readonly',s=>s.get(key));
// Met à jour une réponse déjà conservée (site/panneau téléchargé) ou l'enregistre si elle est « toujours » conservée.
export async function remember(path,data){
 if(ALWAYS(path)){await saveResponse(path,data);return;}
 if(PER_SITE(path)&&await readResponse(path))await saveResponse(path,data);
}
export const listDownloads=async()=>(await run('sites','readonly',s=>s.getAll()))||[];
export const getDownload=id=>run('sites','readonly',s=>s.get(id));

// Télécharge un site et ses panneaux. get(path) lit l'API (api.js) ; retourne l'enregistrement.
export async function downloadSite(siteId,get){
 const sitePath='/api/sites?id='+siteId;
 const siteData=await get(sitePath);
 const panels=siteData.panels||[];
 const paths=[sitePath];
 await saveResponse(sitePath,siteData);
 for(const p of panels){const path='/api/panels?id='+p.id;await saveResponse(path,await get(path));paths.push(path);}
 // La liste des sites et le forfait sont nécessaires pour naviguer.
 for(const path of ['/api/auth','/api/sites','/api/billing']){try{await saveResponse(path,await get(path));}catch{}}
 const rec={id:siteId,name:siteData.site?.name||'',panels:panels.length,savedAt:Date.now(),paths};
 await run('sites','readwrite',s=>s.put(rec));
 return rec;
}
export async function removeDownload(siteId){
 const rec=await getDownload(siteId);
 for(const path of rec?.paths||[])await run('resp','readwrite',s=>s.delete(path));
 await run('sites','readwrite',s=>s.delete(siteId));
}
export async function clearOffline(){
 await run('resp','readwrite',s=>s.clear());await run('sites','readwrite',s=>s.clear());
 try{localStorage.removeItem('mp_offline_uid');}catch{}
}
// Un seul compte à la fois sur l'appareil : si l'identité change, les données conservées sont effacées.
export async function bindUser(uid){
 try{const prev=localStorage.getItem('mp_offline_uid');if(prev&&prev!==uid)await clearOffline();localStorage.setItem('mp_offline_uid',uid);}catch{}
}

// État réseau : « hors ligne » dès qu'une lecture est servie depuis la copie locale.
export const net={offline:false};
export function setOffline(v){if(net.offline===v)return;net.offline=v;try{globalThis.dispatchEvent(new CustomEvent('mp-offline',{detail:v}));}catch{}}
