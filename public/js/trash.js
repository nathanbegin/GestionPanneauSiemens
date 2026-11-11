// Corbeille : sites et panneaux supprimés, récupérables pendant 30 jours.
import {h,toast,dialog,confirmDialog,fmtRelative} from './dom.js';
import {api} from './api.js';

export async function trashDialog({onRestored}={}){
 const list=h('div',{class:'trash-list'},h('p',{class:'muted',text:'Chargement…'}));
 const d=dialog({title:'Corbeille',eyebrow:'Récupérable pendant 30 jours',wide:true,body:[list],actions:[{label:'Fermer',kind:'ghost'}]});
 async function draw(){
  let items;try{items=(await api('/api/sites?action=trash')).items;}catch(e){list.replaceChildren(h('p',{class:'error',text:e.message}));return;}
  if(!items.length){list.replaceChildren(h('p',{class:'muted',text:'La corbeille est vide.'}));return;}
  list.replaceChildren(...items.map(it=>h('div',{class:'trash-row card'},
   h('div',{},h('b',{text:(it.kind==='site'?'🏠 ':'▦ ')+it.title}),h('div',{class:'small muted',text:`${it.kind==='site'?`Site · ${it.panels} panneau(x)`:'Panneau'} · supprimé ${fmtRelative(it.deletedAt)}`})),
   h('div',{class:'page-actions'},
    h('button',{type:'button',class:'primary sm',onclick:async()=>{try{await api('/api/sites?action=trash-restore&tid='+it.id,{method:'POST',body:{}});toast('« '+it.title+' » restauré.');onRestored?.();draw();}catch(e){toast(e.message,8000);}}},'Restaurer'),
    h('button',{type:'button',class:'danger sm',onclick:async()=>{if(!await confirmDialog(`Supprimer définitivement « ${it.title} » ? Cette action est irréversible.`,{title:'Supprimer définitivement',confirm:'Supprimer définitivement',danger:true}))return;try{await api('/api/sites?action=trash-purge&tid='+it.id,{method:'DELETE'});draw();}catch(e){toast(e.message);}}},'Supprimer définitivement')))));
 }
 draw();
 return d;
}
