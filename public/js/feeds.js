// Liaison entre un circuit d'alimentation et le sous-panneau qu'il alimente.
// La liaison est enregistrée sur le sous-panneau (« Alimenté par » + « Circuit d'alimentation »).
import {h,toast,confirmDialog} from './dom.js';
import {api} from './api.js';
import {designation,panelTitle} from '../model.js';

export const linkedChild=(panel,circuit,siblings)=>siblings.find(s=>s.id!==panel.id&&s.fedFrom===panel.id&&s.fedFromCircuit===designation(circuit));
// Panneaux pouvant être alimentés par ce panneau : pas lui-même, pas un de ses panneaux d'amont.
function candidates(panel,siblings){
 const parentOf=new Map(siblings.map(s=>[s.id,s.fedFrom]));
 const ancestors=new Set();for(let cur=parentOf.get(panel.id),i=0;cur&&i<60;cur=parentOf.get(cur),i++)ancestors.add(cur);
 return siblings.filter(s=>s.id!==panel.id&&!ancestors.has(s.id));
}

/** opts : {panel, circuit, siblings (modifié sur place), createSubpanel(initial) → Promise<sibling>, onChange()} */
export function subpanelLink({panel,circuit,siblings,createSubpanel,onChange}){
 const box=h('div',{class:'feed-box'});
 const pos=designation(circuit);
 const setFeed=async(childId,fedFrom)=>{
  const {panel:child}=await api('/api/panels?id='+childId,{method:'PUT',body:{feed:{fedFrom,fedFromCircuit:fedFrom?pos:''}}});
  const s=siblings.find(x=>x.id===childId);if(s){s.fedFrom=child.details?.fedFrom||'';s.fedFromCircuit=child.details?.fedFromCircuit||'';}
  draw();onChange?.();
 };
 function draw(){
  const child=linkedChild(panel,circuit,siblings);
  if(child){
   box.replaceChildren(h('div',{class:'feed-linked'},h('span',{},'⚡ Alimente ',h('a',{href:'#/panneaux/'+child.id,text:panelTitle(child)}),` (circuit ${pos})`),
    h('button',{type:'button',class:'sm ghost',onclick:async()=>{if(!await confirmDialog(`Délier « ${panelTitle(child)} » de ce circuit ?`,{confirm:'Délier'}))return;try{await setFeed(child.id,'');toast('Liaison retirée.');}catch(e){toast(e.message,7000);}}},'Délier')));
   return;
  }
  const list=candidates(panel,siblings);
  const sel=h('select',{'aria-label':'Sous-panneau alimenté'},new Option(list.length?'— Choisir un panneau du site —':'Aucun autre panneau sur ce site',''),...list.map(s=>new Option(panelTitle(s)+(s.fedFrom&&s.fedFrom!==panel.id?' (alimenté ailleurs)':s.fedFrom===panel.id?` (lié au circuit ${s.fedFromCircuit||'?'})`:''),s.id)));
  sel.disabled=!list.length;
  box.replaceChildren(
   h('p',{class:'small',text:`Ce circuit alimente un sous-panneau ? Liez-le pour suivre la hiérarchie d’alimentation et additionner ses charges.`}),
   h('div',{class:'inline-form'},sel,
    h('button',{type:'button',class:'sm',onclick:async()=>{if(!sel.value)return toast('Choisissez un panneau.');const s=siblings.find(x=>x.id===sel.value);
     if(s?.fedFrom&&!await confirmDialog(`« ${panelTitle(s)} » est déjà relié à une autre alimentation. Le relier plutôt à ce circuit (${pos}) ?`,{confirm:'Relier ici'}))return;
     try{await setFeed(sel.value,panel.id);toast('Sous-panneau relié.');}catch(e){toast(e.message,7000);}}},'Lier'),
    createSubpanel&&h('button',{type:'button',class:'sm primary',onclick:async()=>{try{const s=await createSubpanel({kind:'Sous-panneau',name:'Sous-panneau'+(circuit.room?' '+circuit.room.toLowerCase():''),location:circuit.room||'',details:{fedFrom:panel.id,fedFromCircuit:pos}});if(s){siblings.push(s);draw();onChange?.();toast('Sous-panneau créé et relié.');}}catch(e){toast(e.message,7000);}}},'+ Créer le sous-panneau')),
   h('p',{class:'small muted',text:`Ou plus tard : créez le sous-panneau dans le site, puis dans sa fiche choisissez « Alimenté par : ${panelTitle(panel)} » et le circuit ${pos}.`}));
 }
 draw();
 return box;
}
