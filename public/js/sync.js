// Synchronisation des modifications faites hors ligne (voir offline.js / merge.js).
import {listQueue,removeQueued} from './offline.js';
import {mergePanel,applyChoices} from '../merge.js';
import {dialog,h,toast} from './dom.js';
import {api} from './api.js';

let running=false;
const describe=x=>x.type==='circuit'?`Circuit ${x.id}`:({name:'Nom',tag:'Repère',kind:'Type',location:'Emplacement'}[x.key]||x.key.replace('details.','Fiche : '));
const show=v=>v===undefined?'(supprimé)':v&&typeof v==='object'&&'label' in v?`${v.label||'(sans désignation)'}${v.amps!=null?' · '+v.amps+' A':''}${v.vacant?' · libre':''}`:String(v??'(vide)');

function askConflicts(rec,conflicts){
 return new Promise(resolve=>{
  const choices={};const rows=conflicts.map(x=>{
   const key=x.type==='circuit'?'c:'+x.id:'m:'+x.key;choices[key]='server';
   const name='k'+Math.random().toString(36).slice(2);
   const opt=(val,label,text)=>h('label',{class:'conflict-opt'},h('input',{type:'radio',name,value:val,checked:val==='server',onchange:()=>{choices[key]=val;}}),h('span',{},h('b',{text:label}),h('br'),text));
   return h('div',{class:'conflict-row'},h('div',{class:'conflict-title',text:describe(x)}),opt('local','Ma version (hors ligne)',show(x.local)),opt('server','Version du serveur',show(x.server)));
  });
  dialog({title:'Modifications en conflit',eyebrow:rec.label,body:[h('p',{class:'muted',text:'Ces éléments ont été modifiés à la fois hors ligne et ailleurs depuis. Choisissez la version à garder ; tout le reste a été fusionné automatiquement.'}),...rows],
   actions:[{label:'Appliquer mes choix',kind:'primary',onClick:()=>resolve(choices)}],onClose:()=>resolve(choices)});
 });
}

// Synchronise chaque panneau de la file. Retourne {done, conflicts, failed}.
export async function syncPending(){
 if(running)return null;running=true;
 const out={done:0,conflicts:0,failed:0};
 try{
  for(const rec of await listQueue()){
   try{
    const {panel:server}=await api('/api/panels?id='+rec.panelId);
    const m=mergePanel(rec.base,rec.local,server);
    let result={circuits:m.circuits,meta:m.meta};
    if(m.conflicts.length){out.conflicts+=m.conflicts.length;result=applyChoices(m,m.conflicts,await askConflicts(rec,m.conflicts));}
    const res=await api('/api/panels?id='+rec.panelId,{method:'PUT',body:{revision:server.revision,circuits:result.circuits,meta:result.meta}});
    await api('/api/panels?id='+rec.panelId).catch(()=>{}); // rafraîchit la copie locale
    await removeQueued(rec.panelId);out.done++;
   }catch(e){
    if(e.offline){break;}
    out.failed++;
    if(e.status===404||e.status===403){await removeQueued(rec.panelId);toast(`« ${rec.label} » n’existe plus ou n’est plus modifiable : vos modifications hors ligne ont été abandonnées.`,9000);}
    else toast(`Synchronisation de « ${rec.label} » impossible : ${e.message}`,9000);
   }
  }
 }finally{running=false;try{globalThis.dispatchEvent(new CustomEvent('mp-queue'));}catch{}}
 if(out.done)toast(out.done>1?`${out.done} panneaux synchronisés (modifications faites hors ligne).`:'Panneau synchronisé (modifications faites hors ligne).',6000);
 return out;
}
