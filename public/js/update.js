// Mise à jour de l'application : compare la version installée à /version.json (jamais mis en cache).
import {h,toast,confirmDialog} from './dom.js';
import {NATIVE,webUrl} from './api.js';
import {APP_VERSION} from '../model.js';

const VERSION_RE=/^\d+\.\d+\.\d+$/;
export const isNewer=(a,b)=>{const x=String(a).split('.').map(Number),y=String(b).split('.').map(Number);for(let i=0;i<3;i++){if((x[i]||0)!==(y[i]||0))return(x[i]||0)>(y[i]||0);}return false;};

let latest='';
async function swRegistration(){
 if(NATIVE||!('serviceWorker' in navigator))return null;
 try{return await navigator.serviceWorker.getRegistration();}catch{return null;}
}
function flag(available){if(available)document.documentElement.dataset.update='1';else delete document.documentElement.dataset.update;}

/** Retourne {current, latest, available} ; lève une erreur si le serveur est injoignable. */
export async function checkUpdate(){
 const reg=await swRegistration();
 try{await reg?.update();}catch{}
 const r=await fetch(webUrl('/version.json')+'?t='+Date.now(),{cache:'no-store',credentials:'omit'});
 if(!r.ok)throw Error('Réponse '+r.status);
 const v=(await r.json()).version;
 if(!VERSION_RE.test(v))throw Error('Version invalide');
 latest=v;
 const available=isNewer(v,APP_VERSION);
 flag(available);
 return {current:APP_VERSION,latest:v,available};
}

/** Vérification discrète au démarrage : n'affiche qu'un point sur le menu. */
export function checkUpdateQuietly(){checkUpdate().catch(()=>{});}

export async function applyUpdate(){
 if(NATIVE)return;
 if(document.querySelector('dialog[open]')&&!await confirmDialog('Un formulaire est ouvert : les données non enregistrées seront perdues.',{title:'Mettre à jour maintenant ?',confirm:'Mettre à jour'}))return;
 try{
  for(const r of await navigator.serviceWorker?.getRegistrations?.()||[])await r.unregister();
  if(window.caches)for(const k of await caches.keys())await caches.delete(k);
 }catch{}
 const u=new URL(location.href);u.searchParams.set('v',latest||Date.now());
 location.replace(u.toString());
}

/** Carte « Mise à jour » de la page Mon compte. */
export function updateCard(){
 const status=h('p',{class:'small muted',role:'status',text:'Vérification…'});
 const current=h('dd',{text:'v'+APP_VERSION}),newest=h('dd',{text:'—'});
 const apply=h('button',{type:'button',class:'primary',hidden:true,onclick:()=>applyUpdate()},'Mettre à jour maintenant');
 const check=h('button',{type:'button',onclick:()=>run(true)},'Vérifier');
 async function run(manual){
  check.disabled=true;status.textContent='Vérification…';apply.hidden=true;
  try{
   const s=await checkUpdate();newest.textContent='v'+s.latest;
   if(s.available){
    status.textContent=NATIVE?'Une nouvelle version est disponible : mettez l’application à jour depuis l’App Store ou Google Play.':'Une nouvelle version est disponible. Vos données sont conservées.';
    apply.hidden=NATIVE;
   }else{status.textContent='L’application est à jour.';if(manual)toast('L’application est à jour.');}
  }catch{newest.textContent='—';status.textContent='Impossible de vérifier la version (hors ligne ?).';}
  finally{check.disabled=false;}
 }
 const card=h('section',{class:'card form-card',id:'miseajour'},h('fieldset',{class:'form-section'},h('legend',{text:'Mise à jour de l’application'}),
  h('dl',{class:'facts'},h('dt',{text:'Version installée'}),current,h('dt',{text:'Dernière version'}),newest),status),
  h('div',{class:'form-actions'},check,apply));
 run(false);
 return card;
}
