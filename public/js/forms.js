// Formulaires : site, panneau, fiche de circuit.
import {h,field,select,dialog,toast,confirmDialog} from './dom.js';
import {FAMILIES,PANEL_STATES,LOAD_LIBRARY,LOAD_CATEGORIES,WIRE_TABLE,WIRE_TYPES,familyOf,wireAmps,SERVICE_CONDUCTORS,SERVICE_MATERIALS,SERVICE_ROUTES,serviceCheck} from '../catalog.js';
import {modelPicker} from './library.js';
import {brandBadge} from './panelart.js';
import {subpanelLink} from './feeds.js';
import {api} from './api.js';
import {circuitLoad,polesOf} from '../loadcalc.js';
import {usageOrder,states,ampsList,protections,panelKinds,voltages,breakerFormats,designation,formatOf,reshape,validate,isLinkedPair,groupCandidates,groupCircuits,ungroupCircuit,tagGroups,panelTitle,MAX_POSITIONS} from '../model.js';

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
export function panelFields(panel={},siblings=[],{library=false}={}){
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
  catalogFieldset(d,library,panel.circuits),
  h('fieldset',{class:'form-section'},h('legend',{text:'Caractéristiques'}),h('div',{class:'fields'},
   field('Nombre de positions',select('positions',choices.map(n=>[n,n+' positions']),positions),{hint:'Emplacements numérotés du panneau.'}),
   field('Calibre principal (A)',input('mainAmps',d.mainAmps??'',{type:'number',min:15,max:1200,step:5,inputmode:'numeric',placeholder:'Ex. 200'})),
   field('Marque',input('brand',d.brand,{maxlength:60,placeholder:'Ex. Siemens, Square D, Eaton',list:'brands'})),
   field('Modèle',input('model',d.model,{maxlength:60,placeholder:'Ex. EQ, QO, BR'})),
   field('Tension',select('voltage',voltages,d.voltage||voltages[0])),
   field('Superficie hors sol (m²)',input('livingArea',d.livingArea??'',{type:'number',min:0,max:10000,inputmode:'numeric',placeholder:'Ex. 140'}),{hint:'Rez-de-chaussée et étages, mesurés par l’extérieur (calcul de charge, règle 8-110).'}),
   field('Superficie du sous-sol (m²)',input('basementArea',d.basementArea??'',{type:'number',min:0,max:10000,inputmode:'numeric',placeholder:'Ex. 80'}),{hint:'Compte à 75 % (parties de plus de 1,8 m de hauteur).'}),
   field('État',select('state',PANEL_STATES,d.state||'Existant'),{hint:'Planifié : panneau à construire ou à modifier.'}),
   h('datalist',{id:'brands'},['Siemens','Square D','Eaton','Cutler-Hammer','Schneider Electric','Federal Pioneer','Stab-Lok','Westinghouse','Commander','GE','Leviton'].map(b=>h('option',{value:b}))))),
  h('fieldset',{class:'form-section'},h('legend',{text:'Alimentation'}),h('div',{class:'fields'},
   field('Alimenté par',fed),
   field('Circuit d’alimentation',fedCircuitInput(fed,d.fedFromCircuit),{hint:'Position du disjoncteur dans le panneau source (les circuits « Sous-panneau » sont proposés en premier).'}))),
  serviceFieldset(d,fed),
  h('fieldset',{class:'form-section'},h('legend',{text:'Relevé'}),h('div',{class:'fields'},
   field('Date du relevé',input('surveyDate',d.surveyDate,{type:'date'})),
   field('Relevé effectué par',input('surveyedBy',d.surveyedBy,{maxlength:100,placeholder:'Nom de la personne'})),
   field('Notes sur le panneau',area('notes',d.notes,{maxlength:2000,placeholder:'État, particularités, mise à la terre…'}),{full:true}))),
 ];
}
// Entrée électrique : conducteurs entre le point de raccordement d'Hydro-Québec (tête de mât)
// et le disjoncteur principal. Affiché seulement pour un panneau alimenté par le réseau.
function serviceFieldset(d,fed){
 const gauge=select('serviceGauge',[['','— Non précisé —'],...SERVICE_CONDUCTORS.map(w=>[w.gauge,w.gauge])],d.serviceGauge||'');
 const mat=select('serviceMaterial',SERVICE_MATERIALS,d.serviceMaterial||'Cuivre');
 const route=select('serviceRoute',[['','— Non précisé —'],...SERVICE_ROUTES],d.serviceRoute||'');
 const check=h('p',{class:'small full service-check'});
 const box=h('fieldset',{class:'form-section'},h('legend',{text:'Entrée électrique (Hydro-Québec → panneau)'}),
  h('p',{class:'small muted',text:'Conducteurs qui partent du point de raccordement d’Hydro-Québec (en haut du mât ou sur la façade), passent par l’embase du compteur et arrivent au disjoncteur principal. Ils appartiennent au propriétaire ; le branchement aérien jusqu’au mât appartient à Hydro-Québec.'}),
  h('div',{class:'fields'},
   field('Calibre des conducteurs d’entrée',gauge,{hint:'Inscrit sur la gaine du fil (ex. 3/0 AWG, 4/0 AWG).'}),
   field('Matériau',mat),
   field('Type d’entrée',route),
   field('Notes sur l’entrée',input('serviceNotes',d.serviceNotes,{maxlength:300,placeholder:'Ex. mât de 2 po, embase 200 A, conduit PVC'})),
   check));
 const refresh=()=>{
  box.hidden=!!fed.value;
  const f=box.closest('form');
  const r=serviceCheck({serviceGauge:gauge.value,serviceMaterial:mat.value,mainAmps:f?.elements.mainAmps?.value});
  check.textContent=r?.text||'';check.className='small full service-check '+(r?.status==='warn'?'warn':'muted');
 };
 for(const el of [gauge,mat,fed])el.addEventListener('change',refresh);
 queueMicrotask(()=>{refresh();box.closest('form')?.elements.mainAmps?.addEventListener('input',refresh);});
 return box;
}
// Modèle de la bibliothèque (abonnés) : remplit marque, gamme, calibre, positions et famille.
function catalogFieldset(d,library,circuits=[]){
 const used=circuits.filter(c=>!c.vacant&&(c.label||c.amps!=null));
 const hidden=h('input',{type:'hidden',name:'modelId',value:d.modelId||''});
 const fam=select('family',[['','— Autre / non précisée —'],...Object.entries(FAMILIES).filter(([k])=>k!=='generic').map(([k,f])=>[k,f.name])],d.family||d.breakerFamily||'');
 const summary=h('div',{class:'model-summary'});
 const show=(info,id,family)=>summary.replaceChildren(...(id?[brandBadge(family,{size:'sm'}),h('div',{},h('b',{text:id}),h('div',{class:'small muted',text:info||''}))]:[h('span',{class:'small muted',text:'Aucun modèle choisi : caractéristiques saisies à la main.'})]));
 show(d.modelInfo,d.modelId,d.family);
 const choose=h('button',{type:'button',class:library?'primary':'',onclick:()=>{
  if(!library){location.hash='#/abonnement';return;}
  modelPicker({current:{modelId:hidden.value,family:fam.value,circuits:used.length||'',bipolar:used.filter(c=>formatOf(c)==='double').length,mainAmps:hidden.closest('form')?.elements.mainAmps?.value},onPick:(p,lib)=>{
   const f=hidden.closest('form');const info=lib.familyInfo[p.family];
   hidden.value=p.cat;fam.value=p.family;
   f.elements.brand.value=familyOf(p.family).brand||info?.marque||'';f.elements.model.value=(info?.gamme||'').split(' (')[0];
   if(p.main)f.elements.mainAmps.value=p.main;
   if(!p.main&&f.elements.kind.value==='Principal')f.elements.kind.value='Sous-panneau';
   const pos=f.elements.positions;if(![...pos.options].some(o=>o.value===String(p.espaces)))pos.append(new Option(p.espaces+' positions',p.espaces));pos.value=String(p.espaces);
   show(`${p.type} · barres ${p.bus??'—'} A${p.main?' · principal '+p.main+' A':''} · ${p.espaces}/${p.circuits??'—'} · ${p.enveloppe||''}`,p.cat,p.family);
   f.dispatchEvent(new Event('change'));
  }});
 }},library?'Choisir dans la bibliothèque':'Bibliothèque : forfaits Électricien');
 const clear=h('button',{type:'button',class:'ghost',onclick:()=>{hidden.value='';show('','','');hidden.closest('form').dispatchEvent(new Event('change'));}},'Retirer le modèle');
 return h('fieldset',{class:'form-section'},h('legend',{text:'Modèle (bibliothèque de produits)'}),hidden,
  h('div',{class:'fields'},h('div',{class:'full model-pick'},summary,h('div',{class:'page-actions'},choose,d.modelId&&clear)),
   field('Famille de produits',fam,{hint:'Détermine le dessin du panneau et les disjoncteurs proposés.'})));
}
// Champ « Circuit d'alimentation » : propose les circuits du panneau source choisi.
function fedCircuitInput(fedSelect,value){
 const listId='fedc-'+Math.random().toString(36).slice(2,8);
 const dl=h('datalist',{id:listId});
 const inp=input('fedFromCircuit',value,{maxlength:40,placeholder:'Ex. 14/16',list:listId,autocomplete:'off'});
 const load=async()=>{
  dl.replaceChildren();if(!fedSelect.value)return;
  try{const {panel:src}=await api('/api/panels?id='+encodeURIComponent(fedSelect.value));
   const cs=[...src.circuits].filter(c=>c.label||c.amps).sort((a,b)=>(b.usage==='Sous-panneau')-(a.usage==='Sous-panneau'));
   dl.replaceChildren(...cs.map(c=>h('option',{value:designation(c),label:`${c.usage==='Sous-panneau'?'⚡ ':''}${c.label||'—'}${c.amps?' · '+c.amps+' A':''}`})));}
  catch{}
 };
 fedSelect.addEventListener('change',()=>{inp.value='';load();});
 load();
 return h('span',{class:'fed-circuit'},inp,dl);
}
export function panelPayload(form){
 const f=formData(form);
 return {meta:{name:f.name,tag:f.tag,kind:f.kind,location:f.location,details:{building:f.building,brand:f.brand,model:f.model,mainAmps:f.mainAmps===''?null:Number(f.mainAmps),voltage:f.voltage,fedFrom:f.fedFrom,fedFromCircuit:f.fedFromCircuit,surveyDate:f.surveyDate,surveyedBy:f.surveyedBy,notes:f.notes,modelId:f.modelId,family:f.family,livingArea:f.livingArea===''?null:Number(f.livingArea),basementArea:f.basementArea===''||f.basementArea==null?null:Number(f.basementArea),state:f.state,...(f.fedFrom?{}:{serviceGauge:f.serviceGauge,serviceMaterial:f.serviceMaterial,serviceRoute:f.serviceRoute,serviceNotes:f.serviceNotes})}},positions:Number(f.positions)};
}
export function panelDialog({siblings=[],onSave,library=false,initial={},title='Nouveau panneau',eyebrow='Étape 2 · un panneau dans ce site'}){
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
 const d=dialog({title,eyebrow,form:true,wide:true,body:[...panelFields(initial,siblings,{library}),
  h('div',{class:'notice info'},'Vous avez une sauvegarde JSON (ancienne version ou export) ? ',h('label',{for:'importJson',class:'btn sm',text:'Importer un fichier'}),fileInput,importNote),e],
  actions:[{label:'Annuler',kind:'ghost'},{label:'Créer le panneau',kind:'primary',submit:true}]});
 d.form.addEventListener('submit',async ev=>{
  ev.preventDefault();const btn=ev.submitter;btn&&(btn.disabled=true);e.textContent='';
  try{const p=panelPayload(d.form);await onSave({...p.meta,positions:p.positions,...(imported?{circuits:imported}:{})});d.close();}catch(x){showError(e,x);}finally{btn&&(btn.disabled=false);}
 });
 d.form.elements.name.focus();
}

// Fiche d'un circuit avec navigation précédent / suivant.
export function circuitEditor({panel,id,order,onSave,planning=false,lib=null,feeds=null}){
 let current=id;
 let plan=null;
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
    feeds&&h('div',{class:'full feed-slot'}),
    field('Calibre',select('amps',[['','À confirmer'],...ampsList.map(a=>[a,a+' A'])],c.amps??'')),
    field('Protection',select('protection',protections,c.protection||'Standard'),{hint:'DDFT : différentiel (salle de bain, extérieur). Anti-arc : chambres, aires habitables.'}),
    field('Statut',select('status',states,c.status)),
    field('Format du disjoncteur',select('format',Object.entries(breakerFormats),fmt),{hint:'Bipolaire = 240 V (cuisinière, sécheuse…).'}),
    h('div',{class:'full group-block'}),
    h('datalist',{id:'rooms'},[...new Set(panel.circuits.map(x=>x.room).filter(Boolean))].map(r=>h('option',{value:r}))),
    h('details',{class:'full'},h('summary',{class:'small',text:'Tags, exceptions et notes'}),h('div',{class:'fields'},
     field('Tags · emplacements',input('locations',(c.tags?.locations||[]).join(', '),{placeholder:'Sous-sol, Cinéma'}),{hint:'Séparez par des virgules.'}),
     field('Tags · fonctions',input('functions',(c.tags?.functions||[]).join(', '),{placeholder:'Prises, Réseau'})),
     field('Tags · appareils desservis',input('devices',(c.tags?.devices||[]).join(', '),{placeholder:'Routeur, Téléviseur'}),{full:true}),
     field('Exceptions et détails',area('exceptions',c.exceptions,{maxlength:2000,placeholder:'Ex. Prise près de la fenêtre non desservie'}),{full:true}),
     field('Notes',area('notes',c.notes,{maxlength:2000,placeholder:'Prises desservies, repères…'}),{full:true}),
     c.originalLabel?h('p',{class:'small muted full',text:'Description originale du relevé : '+c.originalLabel}):null)),
    (plan=planning?planningSection(c,panel,()=>{dirty=true;},body,lib):null)?.node),
   e);
  // Circuit qui alimente un sous-panneau : liaison avec un panneau du site.
  const slot=body.querySelector('.feed-slot');
  if(slot){
   const drawFeed=()=>{const usage=body.querySelector('[name=usage]').value;slot.replaceChildren(usage==='Sous-panneau'?subpanelLink({panel,circuit:c,siblings:feeds.siblings,createSubpanel:feeds.createSubpanel,onChange:feeds.onChange}):'');};
   body.querySelector('[name=usage]').addEventListener('change',drawFeed);drawFeed();
  }
  // Grouper deux demi-emplacements adjacents (jumelé / bipolaire à cheval sur deux positions) ou dissocier.
  const gb=body.querySelector('.group-block');
  if(gb){
   const cands=groupCandidates(panel.circuits,c.id),linked=isLinkedPair(c);
   const act=async fn=>{e.textContent='';try{const next=fn(dirty?collect():structuredClone(panel.circuits));await onSave(next);dirty=false;statusTouched=false;render();}catch(x){e.textContent=x.message;}};
   gb.replaceChildren(h('b',{class:'small',text:'Grouper avec un emplacement adjacent'}),
    h('p',{class:'small muted',text:'Pour un disjoncteur jumelé ou bipolaire qui occupe deux demi-emplacements voisins de la même colonne (ex. 5B + 7A). Choisissez l’emplacement voisin.'}),
    h('div',{class:'form-actions',style:{justifyContent:'flex-start'}},
     ...cands.map(x=>h('button',{type:'button',class:'sm',onclick:()=>act(n=>groupCircuits(n,c.id,x.id,panel.positions,{force:!x.hasData}))},`＋ ${x.slot}${x.label?' · '+x.label:' (libre)'}`)),
     linked&&h('button',{type:'button',class:'sm',onclick:()=>act(n=>ungroupCircuit(n,c.id,panel.positions))},'Dissocier '+c.slots.join(' + ')),
     !cands.length&&!linked&&h('span',{class:'small muted',text:'Aucun emplacement voisin à grouper.'})));
  }
  d.el.querySelector('.dlg-head h2').textContent='Circuit '+designation(c);
  d.el.querySelector('.dlg-head .eyebrow').textContent=`Fiche ${idx+1} sur ${order.length} · ${panelTitle(panel)}`;
  prevBtn.disabled=idx<=0;nextBtn.disabled=idx>=order.length-1;
  if((c.slots.length===1&&c.slots[0].endsWith('B'))||isLinkedPair(c))body.querySelector('[name=format]').disabled=true;
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
  if(plan){
   const loads=plan.loads();if(loads.length)c.loads=loads;else delete c.loads;
   const wire={gauge:f.get('wireGauge')||'',type:f.get('wireType')||'',length:f.get('wireLength')===''||f.get('wireLength')==null?null:Number(f.get('wireLength'))};
   if(wire.gauge||wire.type||wire.length!=null){if(wire.length==null)delete wire.length;c.wire=wire;}else delete c.wire;
   const ref=String(f.get('breakerRef')||'').trim();if(ref)c.breakerRef=ref;else delete c.breakerRef;
  }
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

// ---------- Planification : disjoncteur du catalogue, charges, conducteur, calcul en direct ----------
const FORMAT_POLES={single:1,double:2,triple:3,tandem:1};
function planningSection(c,panel,markDirty,root,lib){
 const fam=panel.details?.family||panel.details?.breakerFamily||'';
 let loads=structuredClone(c.loads||[]);
 const list=h('div',{class:'loads-list'});
 const live=h('div',{class:'load-live'});
 const form=()=>root.closest('form');
 // Disjoncteur du catalogue : règle format, calibre, protection et référence.
 // Disjoncteurs de la bibliothèque (famille du panneau), plaçables depuis la fiche : simple, bipolaire, tripolaire, jumelé.
 const KIND_FMT={single:'single',double:'double',triple:'triple',tandem:'tandem'};
 const okFam=panel.details?.accepts?.length?panel.details.accepts:fam?[fam]:null;
 const choices=lib?lib.breakers.filter(b=>(!okFam||okFam.includes(b.family))&&KIND_FMT[b.kind]):[];
 const pick=h('select',{'aria-label':'Disjoncteur du catalogue'},new Option(lib?'— Choisir dans la bibliothèque —':'Bibliothèque non disponible',''),...choices.map(b=>new Option(`${b.cat} · ${b.label}${b.protection!=='Standard'?' · '+b.protection:''}`,b.cat)));
 pick.disabled=!choices.length;
 if(c.breakerRef&&choices.some(b=>b.cat===c.breakerRef))pick.value=c.breakerRef;
 pick.addEventListener('change',()=>{
  const b=choices.find(x=>x.cat===pick.value);const f=form();if(!b||!f)return;
  f.elements.format.value=KIND_FMT[b.kind];
  f.elements.amps.value=String(b.amps[0]);f.elements.protection.value=b.protection;f.elements.breakerRef.value=b.cat;
  markDirty();refresh();
 });
 // Ajout d'une charge de la bibliothèque.
 const groups=new Map();for(const l of LOAD_LIBRARY)groups.set(l.g,[...(groups.get(l.g)||[]),l]);
 const add=h('select',{class:'add-load','aria-label':'Ajouter une charge'},new Option('+ Ajouter une charge…',''),...[...groups].map(([g,ls])=>{const og=h('optgroup',{label:g});ls.forEach(l=>og.append(new Option(`${l.name} — ${(l.w/1000).toLocaleString('fr-CA')} kW`,l.id)));return og;}),h('optgroup',{label:'Autre'},new Option('Charge personnalisée…','custom')));
 add.addEventListener('change',()=>{
  const id=add.value;add.value='';if(!id)return;
  if(id==='custom')loads.push({id:'custom',name:'Charge personnalisée',w:1000,v:120,qty:1,cat:'basic',cont:false});
  else{const l=LOAD_LIBRARY.find(x=>x.id===id);loads.push({id:l.id,name:l.name,w:l.w,v:l.v,qty:1,cat:l.cat,cont:l.cont});
   const f=form();if(f&&!f.elements.label.value)f.elements.label.value=l.name.replace(/ —.*$/,'').slice(0,100);
   if(l.note)live.dataset.note=l.note;}
  markDirty();drawLoads();refresh();
 });
 function drawLoads(){
  list.replaceChildren(...loads.map((l,i)=>{
   const upd=(k,v)=>{l[k]=v;markDirty();refresh();};
   const name=h('input',{value:l.name,maxlength:80,'aria-label':'Nom de la charge',oninput:e=>upd('name',e.target.value||'Charge')});
   const w=h('input',{type:'number',min:0,max:200000,step:50,value:l.w,'aria-label':'Puissance (W)',oninput:e=>upd('w',Math.max(0,Number(e.target.value)||0))});
   const v=select('',[[120,'120 V'],[208,'208 V'],[240,'240 V'],[347,'347 V'],[600,'600 V']],l.v);v.removeAttribute('name');v.onchange=e=>upd('v',Number(e.target.value));
   const q=h('input',{type:'number',min:1,max:100,value:l.qty,'aria-label':'Quantité',oninput:e=>upd('qty',Math.min(100,Math.max(1,parseInt(e.target.value)||1)))});
   const cat=select('',Object.entries(LOAD_CATEGORIES),l.cat);cat.removeAttribute('name');cat.onchange=e=>upd('cat',e.target.value);
   const cont=h('label',{class:'check small'},h('input',{type:'checkbox',checked:l.cont,onchange:e=>upd('cont',e.target.checked)}),'Continue');
   return h('div',{class:'load-row'},name,h('span',{class:'load-w'},w,' W'),v,h('span',{class:'load-q'},'× ',q),cat,cont,h('button',{type:'button',class:'sm ghost','aria-label':'Retirer',onclick:()=>{loads.splice(i,1);markDirty();drawLoads();refresh();}},'✕'));
  }));
  if(!loads.length)list.append(h('p',{class:'small muted',text:'Aucune charge. Ajoutez les appareils alimentés par ce circuit pour calculer sa charge.'}));
 }
 function draft(){
  const f=form();const fmt=f?.elements.format.value||formatOf(c);const poles=FORMAT_POLES[fmt]||1;
  const slots=poles===1?['1A','1B']:poles===2?['1A','1B','3A','3B']:['1A','1B','3A','3B','5A','5B'];
  const amps=f?.elements.amps.value?Number(f.elements.amps.value):null;
  return {slots,amps,loads,wire:{gauge:f?.elements.wireGauge?.value||''}};
 }
 function refresh(){
  const r=circuitLoad(draft());
  const note=live.dataset.note;
  live.replaceChildren(...[
   h('div',{class:'load-kpis'},
    h('span',{},h('b',{text:(r.watts/1000).toLocaleString('fr-CA',{maximumFractionDigits:2})+' kW'}),'charge'),
    h('span',{},h('b',{text:r.demandAmps+' A'}),`à ${r.volts} V`),
    h('span',{},h('b',{text:r.percent!=null?r.percent+' %':'—'}),'du disjoncteur'),
    h('span',{},h('b',{text:r.minBreaker?r.minBreaker+' A':'—'}),'disjoncteur min.'),
    h('span',{},h('b',{text:r.suggestedWire||(r.minBreaker?WIRE_TABLE.find(w=>w.amps>=r.minBreaker)?.gauge:'—')||'—'}),'fil suggéré')),
   r.percent!=null&&h('div',{class:'progress'+(r.percent>100?' over':r.percent>80?' high':'')},h('i',{style:{width:Math.min(100,r.percent)+'%'}})),
   ...r.issues.map(i=>h('p',{class:'issue '+i.level,text:(i.level==='error'?'⛔ ':i.level==='warn'?'⚠ ':'ℹ ')+i.text})),
   note&&h('p',{class:'small muted',text:'ℹ '+note}),
   r.watts>0&&h('button',{type:'button',class:'sm',onclick:()=>{
    const f=form();if(!f)return;const needs240=loads.some(l=>l.v>=208);
    if(needs240&&FORMAT_POLES[f.elements.format.value]<2)f.elements.format.value='double';
    const r2=circuitLoad(draft());if(r2.minBreaker){f.elements.amps.value=String(r2.minBreaker);}
    const r3=circuitLoad(draft());if(r3.suggestedWire)f.elements.wireGauge.value=r3.suggestedWire;
    const want={single:'single',double:'double',triple:'triple',tandem:'tandem'}[f.elements.format.value];const amps=Number(f.elements.amps.value);const match=choices.filter(b=>b.kind===want&&b.amps[0]===amps&&b.protection===f.elements.protection.value);const best=match.find(b=>b.neutre!=='PoN'||panel.details?.pon)||match[0];if(best){f.elements.breakerRef.value=best.cat;pick.value=best.cat;}
    markDirty();refresh();}},'Appliquer le disjoncteur et le fil suggérés')].flat().filter(x=>x!=null&&x!==false));
 }
 // Un seul écouteur par fiche : la section est recréée à chaque changement de circuit.
 root._planRefresh=refresh;
 if(!root._planListener){root._planListener=true;root.addEventListener('change',e=>{if(['amps','format','wireGauge','protection'].includes(e.target.name))root._planRefresh?.();});}
 drawLoads();
 const node=h('details',{class:'full plan-box',open:true},h('summary',{text:'⚡ Planification : disjoncteur, charges et conducteur'}),
  h('div',{class:'fields'},
   field('Disjoncteur de la bibliothèque',pick,{hint:fam?`Produits ${familyOf(fam).name} (catalogues des fabricants). Les quads se placent depuis la palette.`:'Choisissez un modèle de panneau pour filtrer les disjoncteurs.'}),
   field('Référence du disjoncteur',input('breakerRef',c.breakerRef||'',{maxlength:40,placeholder:'Ex. Q240'})),
   h('div',{class:'full'},h('div',{class:'small',text:'Charges alimentées'}),list,add),
   field('Calibre du fil',select('wireGauge',[['','—'],...WIRE_TABLE.map(w=>[w.gauge,`${w.gauge} (${w.amps} A)`])],c.wire?.gauge||'')),
   field('Type de câble',select('wireType',[['','—'],...WIRE_TYPES.map(t=>[t,t])],c.wire?.type||'')),
   field('Longueur (m)',input('wireLength',c.wire?.length??'',{type:'number',min:0,max:1000,step:1})),
   h('div',{class:'full'},live)));
 setTimeout(refresh,0);
 return {node,loads:()=>loads.map(l=>({...(l.id?{id:l.id}:{}),name:String(l.name).slice(0,80),w:Number(l.w)||0,v:Number(l.v),qty:Number(l.qty)||1,cat:l.cat,cont:!!l.cont}))};
}
