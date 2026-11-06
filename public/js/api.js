// Client de l'API. Web : témoin de session HttpOnly. Mobile (Capacitor) : jeton Bearer.
const cfg=(typeof window!=='undefined'&&window.MP_CONFIG)||{};
export const API_BASE=(cfg.apiBase||'').replace(/\/$/,'');
export const NATIVE=!!cfg.native;
const TOKEN_KEY='mp_token';
let token='';
try{token=NATIVE?localStorage.getItem(TOKEN_KEY)||'':'';}catch{}
// Adresse absolue d'une page publique (dans l'app native, ouverte sur le serveur).
export const webUrl=path=>NATIVE?API_BASE+path:path;
export function setToken(t){if(!NATIVE)return;token=t||'';try{t?localStorage.setItem(TOKEN_KEY,t):localStorage.removeItem(TOKEN_KEY);}catch{}}
let onAuthLost=()=>{};
export const handleAuthLost=fn=>{onAuthLost=fn;};

export async function api(path,{method='GET',body}={}){
 const headers={'X-MP-Client':NATIVE?'native':'web'};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(token)headers.Authorization='Bearer '+token;
 let res;
 try{res=await fetch(API_BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:NATIVE?'omit':'same-origin',cache:'no-store'});}
 catch{throw Object.assign(Error('Connexion impossible. Vérifiez votre accès Internet.'),{offline:true});}
 let data={};
 try{data=await res.json();}catch{}
 if(!res.ok){
  if(res.status===401&&data.auth)onAuthLost();
  throw Object.assign(Error(data.error||'Erreur '+res.status),{status:res.status,data});
 }
 return data;
}

// Ouvre un PDF généré côté serveur via un lien signé temporaire.
export async function openDocument(params){
 // Sur le web, ouvrir l'onglet tout de suite évite le blocage des fenêtres surgissantes.
 const win=NATIVE?null:window.open('','_blank');
 try{
  try{if(win){win.document.title='Mon Panneau';win.document.body.textContent='Préparation du document…';}}catch{}
  const {url}=await api('/api/report',{method:'POST',body:params});
  const full=url.startsWith('http')?url:API_BASE+url;
  const browser=window.Capacitor?.Plugins?.Browser;
  if(NATIVE&&browser)await browser.open({url:full});
  else if(win)win.location.replace(full);
  else window.open(full,'_blank')||(location.href=full);
  return full;
 }catch(e){win?.close();throw e;}
}
