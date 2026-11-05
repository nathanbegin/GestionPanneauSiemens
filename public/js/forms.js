// Formulaires : site, panneau, fiche de circuit.
import {h,field,select,dialog,toast,confirmDialog} from './dom.js';
import {usageOrder,states,ampsList,protections,panelKinds,voltages,breakerFormats,designation,formatOf,reshape,validate,tagGroups,panelTitle,MAX_POSITIONS} from '../model.js';

const input=(name,value,attrs={})=>h('input',{name,value:value??'',...attrs});
const area=(name,value,attrs={})=>{const t=h('textarea',{name,rows:3,...attrs});t.value=value??'';return t;};
const err=()=>h('p',{class:'error',role:'alert'});
// Affiche une erreur ; un dépassement de forfait propose de voir les forfaits.
export function showError(el,x){el.replaceChildren(x.message);if(x.status===402)el.append(' ',h('a',{href:'#/abonnement',onclick:()=>el.closest('dialog')?.close(),text:'Voir les forfaits →'}));}

export function siteFields(site={}){
 return h('div',{class:'fields'},
  field('Nom du site',input('name',site.name,{required:true,maxlength:100,placeholder:'Ex. Maison, Chalet du lac, Client Tremblay',autocomplete:'off'}),{full:true}),
  field('Adresse',input('street',site.street,{maxlength:160,placeholder:'123, rue des Érables',autocomplete:'street-address'}),{full:true}),
  field('Ville',input('city',site.city,{maxlength:80,autocomplete:'address-level2'})),
  field('Province',input('province',site.province||'QC',{maxlength:40,autocomplete:'address-level1'})),
  field('Code postal',input('postalCode',site.postalCode,{maxlength:12,autocomplete:'postal-code'})),
  field('Client',input('client',site.client,{maxlength:120,placeholder:'Facultatif'}),{hint:'Utile pour les électriciens : figure sur le rapport.'}),
  field('Notes',area('notes',site.notes,{maxlength:2000,placeholder:'Accès, entrée électrique, compteur…'}),{full:true}));
}
export const formData=form=>Object.fromEntries(new FormData(form));

export function siteDialog(site,onSave){
 const e=err();
 const d=dialog({title:site?'Modifier le site':'Nouveau site',eyebrow:site?site.name:'Étape 1 · une adresse',form:true,body:[siteFields(site||{}),e],actions:[{label:'Annuler',kind:'ghost'},{label:site?'Enregistrer':'Créer le site',kind:'primary',submit:true}]});
 d.form.addEventListener('submit',async ev=>{
  ev.preventDefault();const btn=ev.submitter;btn&&(btn.disabled=true);e.textContent='';
  try{await onSave(formData(d.form));d.close();}catch(x){showError(e,x);}finally{btn&&(btn.disabled=false);}
 });
 d.form.elements.name.focus();
}

const POSITION_CHOICES=[12,16,20,24,30,32,40,42,48,54,60,66,72,84];
export function panelFields(panel={},siblings=[]){
 const d=panel.details||{};
 const positions=panel.positions||32;
 const choices=[...new Set([...POSITION_CHOICES,positions])].sort((a,b)=>a-b);
 const fed=select('fedFrom',[['','Entrée électrique (réseau)'],...siblings.filter(s=>s.id!==panel.id).map(s=>[s.id,panelTitle(s)])],d.fedFrom||'');
 return [
  h('fieldset',{class:'form-section'},h('legend',{text:'Identification'}),h('div',{class:'fields'},
   field('Nom du panneau',input('name',panel.name,{required:true,maxlength:100,placeholder:'Ex. Panneau principal'})),
   field('Étiquette / repère',input('tag',panel.tag,{maxlength:24,placeholder:'Ex. P-1, SP-GAR'}),{hint:'Code court inscrit sur le panneau et les documents.'}),
   field('Type',select('kind',panelKinds,panel.kind||'Principal')),
   field('Bâtiment',input('building',d.building,{maxlength:80,placeholder:'Ex. Maison, Garage détaché'})),
   field('Emplacement précis',input('location',panel.location,{maxlength:140,placeholder:'Ex. Sous-sol, salle mécanique, mur nord'}),{full:true,hint:'Où trouver le panneau rapidement.'}))),
  h('fieldset',{class:'form-section'},h('legend',{text:'Caractéristiques'}),h('div',{class:'fields'},
   field('Nombre de positions',select('positions',choices.map(n=>[n,n+' positions']),positions),{hint:'Emplacements numérotés du panneau.'}),
   field('Calibre principal (A)',input('mainAmps',d.mainAmps??'',{type:'number',min:15,max:1200,step:5,inputmode:'numeric',placeholder:'Ex. 200'})),
   field('Marque',input('brand',d.brand,{maxlength:60,placeholder:'Ex. Siemens, Square D, Eaton',list:'brands'})),
   field('Modèle',input('model',d.model,{maxlength:60,placeholder:'Ex. EQ, QO, BR'})),
   field('Tension',select('voltage',voltages,d.voltage||voltages[0])),
   h('datalist',{id:'brands'},['Siemens','Square D','Eaton','Cutler-Hammer','Schneider Electric','Federal Pioneer','Stab-Lok','Westinghouse','Commander','GE','Leviton'].map(b=>h('option',{value:b}))))),
  h('fieldset',{class:'form-section'},h('legend',{text:'Alimentation'}),h('div',{class:'fields'},
   field('Alimenté par',fed),
   field('Circuit d’alimentation',input('fedFromCircuit',d.fedFromCircuit,{maxlength:40,placeholder:'Ex. 14/16'}),{hint:'Position du disjoncteur dans le panneau source.'}))),
  h('fieldset',{class:'form-section'},h('legend',{text:'Relevé'}),h('div',{class:'fields'},
   field('Date du relevé',input('surveyDate',d.surveyDate,{type:'date'})),
   field('Relevé effectué par',input('surveyedBy',d.surveyedBy,{maxlength:100,placeholder:'Nom de la personne'})),
   field('Notes sur le panneau',area('notes',d.notes,{maxlength:2000,placeholder:'État, particularités, mise à la terre…'}),{full:true}))),
 ];
}
export function panelPayload(form){
 const f=formData(form);
 return {meta:{name:f.name,tag:f.tag,kind:f.kind,location:f.location,details:{building:f.building,brand:f.brand,model:f.model,mainAmps:f.mainAmps===''?null:Number(f.mainAmps),voltage:f.voltage,fedFrom:f.fedFrom,fedFromCircuit:f.fedFromCircuit,surveyDate:f.surveyDate,surveyedBy:f.surveyedBy,notes:f.notes}},positions:Number(f.positions)};
}
export function panelDialog({siblings=[],onSave}){
 const e=err();
 const fileInput=h('input',{type:'file',accept:'application/json,.json',class:'sr-only',id:'importJson'});
 let imported=null;
 const importNote=h('p',{class:'small muted'});
 fileInput.addEventListener('change',async()=>{
  const file=fileInput.files[0];if(!file)return;
  try{if(file.size>400000)throw Error('Fichier trop volumineux.');const data=JSON.parse(await file.text());if(!Array.isArray(data.circuits))throw Error('Fichier non reconnu.');imported=data.circuits;importNote.textContent=`✓ ${file.name} : ${data.circuits.length} circuits seront importés.`;
   if(data.panel&&!d.form.elements.name.value)d.form.elements.name.value=String(data.panel).slice(0,100);}
  catch(x){imported=null;importNote.textContent='⚠ '+x.message;}
 });
 const d=dialog({title:'Nouveau panneau',eyebrow:'Étape 2 · un panneau dans ce site',form:true,wide:true,body:[...panelFields({},siblings),
  h('div',{class:'notice info'},'Vous avez une sauvegarde JSON (ancienne version ou export) ? ',h('label',{for:'importJson',class:'btn sm',text:'Importer un fichier'}),fileInput,importNote),e],
  actions:[{label:'Annuler',kind:'ghost'},{label:'Créer le panneau',kind:'primary',submit:true}]});
 d.form.addEventListener('submit',async ev=>{
  ev.preventDefault();const btn=ev.submitter;btn&&(btn.disabled=true);e.textContent='';
  try{const p=panelPayload(d.form);await onSave({...p.meta,positions:p.positions,...(imported?{circuits:imported}:{})});d.close();}catch(x){showError(e,x);}finally{btn&&(btn.disabled=false);}
 });
 d.form.elements.name.focus();
}

// Fiche d'un circuit avec navigation précédent / suivant.
export function circuitEditor({panel,id,order,onSave}){
 let current=id;
 const e=err();
 const body=h('div');
 let d;
 const render=()=>{
  const c=panel.circuits.find(x=>x.id===current);
  const idx=order.indexOf(current);
  const fmt=formatOf(c);
  body.replaceChildren(
   h('div',{class:'fields'},
    field('Désignation — ce que le circuit alimente',input('label',c.label,{maxlength:100,placeholder:'Ex. Prises du salon',autocomplete:'off'}),{full:true}),
    field('Pièce / zone',input('room',c.room,{maxlength:80,placeholder:'Ex. Cuisine, Sous-sol',list:'rooms'})),
    field('Type d’usage',select('usage',usageOrder,c.usage)),
    field('Calibre',select('amps',[['','À confirmer'],...ampsList.map(a=>[a,a+' A'])],c.amps??'')),
    field('Protection',select('protection',protections,c.protection||'Standard'),{hint:'DDFT : différentiel (salle de bain, extérieur). Anti-arc : chambres, aires habitables.'}),
    field('Statut',select('status',states,c.status)),
    field('Format du disjoncteur',select('format',Object.entries(breakerFormats),fmt),{hint:'Bipolaire = 240 V (cuisinière, sécheuse…).'}),
    h('datalist',{id:'rooms'},[...new Set(panel.circuits.map(x=>x.room).filter(Boolean))].map(r=>h('option',{value:r}))),
    h('details',{class:'full'},h('summary',{class:'small',text:'Tags, exceptions et notes'}),h('div',{class:'fields'},
     field('Tags · emplacements',input('locations',(c.tags?.locations||[]).join(', '),{placeholder:'Sous-sol, Cinéma'}),{hint:'Séparez par des virgules.'}),
     field('Tags · fonctions',input('functions',(c.tags?.functions||[]).join(', '),{placeholder:'Prises, Réseau'})),
     field('Tags · appareils desservis',input('devices',(c.tags?.devices||[]).join(', '),{placeholder:'Routeur, Téléviseur'}),{full:true}),
     field('Exceptions et détails',area('exceptions',c.exceptions,{maxlength:2000,placeholder:'Ex. Prise près de la fenêtre non desservie'}),{full:true}),
     field('Notes',area('notes',c.notes,{maxlength:2000,placeholder:'Prises desservies, repères…'}),{full:true}),
     c.originalLabel?h('p',{class:'small muted full',text:'Description originale du relevé : '+c.originalLabel}):null))),
   e);
  d.el.querySelector('.dlg-head h2').textContent='Circuit '+designation(c);
  d.el.querySelector('.dlg-head .eyebrow').textContent=`Fiche ${idx+1} sur ${order.length} · ${panelTitle(panel)}`;
  prevBtn.disabled=idx<=0;nextBtn.disabled=idx>=order.length-1;
  if(c.slots.length===1&&c.slots[0].endsWith('B'))body.querySelector('[name=format]').disabled=true;
  if(d.el.open)setTimeout(()=>body.querySelector('[name=label]').focus(),0);
 };
 const collect=()=>{
  const f=new FormData(d.form);
  let next=structuredClone(panel.circuits);
  const c=next.find(x=>x.id===current);
  Object.assign(c,{label:f.get('label').trim(),room:f.get('room').trim(),usage:f.get('usage'),amps:f.get('amps')===''?null:Number(f.get('amps')),status:f.get('status'),notes:(f.get('notes')||'').trim(),exceptions:(f.get('exceptions')||'').trim()});
  const prot=f.get('protection');if(prot==='Standard')delete c.protection;else c.protection=prot;
  const tags=Object.fromEntries(tagGroups.map(k=>[k,[...new Set(String(f.get(k)||'').split(',').map(t=>t.trim()).filter(Boolean))]]));
  if(Object.values(tags).some(a=>a.length)||c.tags)c.tags=tags;
  // Un circuit décrit passe automatiquement à « Identifié » s'il était « À confirmer » et que l'utilisateur n'a pas touché au statut.
  if(c.label&&c.status==='À confirmer'&&!statusTouched)c.status='Identifié';
  const format=f.get('format');
  if(format&&format!==formatOf(c))next=reshape(next,current,format,panel.positions);
  return validate(next,{positions:panel.positions});
 };
 let statusTouched=false,dirty=false;
 const save=async(move)=>{
  e.textContent='';
  try{
   if(dirty){const next=collect();await onSave(next);}
   dirty=false;statusTouched=false;
   if(move){const idx=order.indexOf(current)+move;if(order[idx]){current=order[idx];render();return false;}}
   return true;
  }catch(x){e.textContent=x.message;return false;}
 };
 const prevBtn=h('button',{type:'button',class:'ghost',text:'‹ Précédent'});
 const nextBtn=h('button',{type:'button',text:'Enregistrer et suivant ›'});
 d=dialog({title:'Circuit',eyebrow:' ',form:true,wide:true,body:[body],actions:[{label:'Fermer',kind:'ghost',left:true,onClick:async()=>{if(dirty&&!await confirmDialog('Fermer sans enregistrer les modifications de cette fiche ?',{confirm:'Fermer sans enregistrer'}))return false;}},{label:'Enregistrer',kind:'primary',submit:true}]});
 d.el.querySelector('.dlg-foot .right').prepend(prevBtn,nextBtn);
 prevBtn.onclick=async()=>{const ok=await save(0);if(ok!==false){const idx=order.indexOf(current)-1;if(order[idx]){current=order[idx];render();}}};
 nextBtn.onclick=()=>save(1);
 d.form.addEventListener('input',ev=>{dirty=true;if(ev.target.name==='status')statusTouched=true;});
 d.form.addEventListener('change',ev=>{dirty=true;if(ev.target.name==='status')statusTouched=true;});
 d.form.addEventListener('submit',async ev=>{ev.preventDefault();if(await save(0))d.close();});
 // Le panneau peut être remplacé après une sauvegarde (nouvelle révision, ids réorganisés).
 const api={setPanel(p,nextOrder){panel=p;order=nextOrder;if(!panel.circuits.some(x=>x.id===current))current=order[0];}};
 render();
 return api;
}
