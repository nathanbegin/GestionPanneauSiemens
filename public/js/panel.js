// Vue d'un panneau : face avant, nomenclature, documents et fiche.
import {h,toast,confirmDialog,fmtRelative,fmtDate,dialog} from './dom.js';
import {api,openDocument,NATIVE,webUrl} from './api.js';
import {qrMatrix,qrSvg,panelLink,qrAllowed} from '../qr.js';
import {voltsOf} from '../voltage.js';
import {calcFingerprint,CODE_EDITION,designation,sortCircuits,stats,fold,searchable,allTags,tagGroups,slotPos,slotOrder,panelTitle,siteAddress,states} from '../model.js';
import {circuitEditor,panelFields,panelPayload} from './forms.js';
import {historyDialog} from './history.js';
import {buildChecklist} from './checklist.js';
import {panelReport,suggestions,materials,circuitLoad,legOf} from '../loadcalc.js';
import {EV_GUIDE,LOADS_SOURCES,familyOf} from '../catalog.js';
import {GUIDE_STEPS,GUIDE_DISCLAIMER} from '../loadguide.js';
import {panelArt,isEmptySlot} from './panelart.js';
import {panelReal} from './panelreal.js';
import {loadLibrary,breakerPalette,validStarts,compatibility} from './library.js';
import {placeBreaker,bulkApply,ampsList,protections,usages} from '../model.js';
import {assignDialog} from './assign.js';
import {linkedChild} from './feeds.js';
import {breakerUnits} from '../units.js';
import {panelDialog} from './forms.js';
import {shareDialog} from './team.js';
import {aiImportDialog} from './aiimport.js';
import {appliancesView} from './appliances.js';
import {PANEL_STAGES,STAGE_IDS,stageFromState} from '../catalog.js';

const statusClass=c=>c.vacant?'free vacant':c.status==='Identifié'?'identified':c.status==='Libre'?'free':'unknown';
const shortText=c=>c.vacant?'Espace inutilisé':c.status==='Libre'?'Libre':c.label||'';
const tabNames={panel:'▦ Panneau',list:'☷ Nomenclature',plan:'⚡ Planification et charges',appliances:'🔌 Électroménagers',docs:'📄 Documents et étiquettes',info:'⚙ Fiche du panneau'};
// Onglets de chaque étape du projet (l'onglet ouvert reste toujours accessible).

export async function panelView({id,tab='panel',ctx}){
 const [data,ent]=await Promise.all([api('/api/panels?id='+encodeURIComponent(id)),api('/api/billing').catch(()=>null)]);
 let {panel,site,siblings,children=[]}=data;
 // Planification : forfaits Électricien (et administrateurs).
 const planning=!!(ent?.plan?.features?.planning||ctx.user?.isAdmin);
 // Code QR du panneau : forfaits qui l'incluent (Gestionnaire, Électricien) et administrateurs.
 const qr=qrAllowed(ent?.plan?.features,ctx.user?.isAdmin);
 // Bibliothèque de produits (abonnés seulement).
 const lib=planning?await loadLibrary().catch(()=>null):null;
 let saving=Promise.resolve();
 const stageOf=()=>panel.details?.stage||stageFromState(panel.details?.state);
 const isMobile=()=>typeof matchMedia==='function'&&matchMedia('(max-width:720px)').matches;
 const defaultTab=()=>({conception:planning?'plan':'panel',releve:isMobile()?'list':'panel',verification:'appliances'}[stageOf()]);
 const state={tab:tabNames[tab]?tab:defaultTab(),q:'',status:'',tag:'',place:null,select:null};
 // Vue du panneau : schéma (par défaut) ou réaliste ; préférence gardée sur l'appareil.
 const pref=k=>{try{return localStorage.getItem(k);}catch{return null;}};
 const setPref=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
 state.view=pref('mp_panel_view')==='reel'?'reel':'schema';
 // Arrivée depuis la recherche globale : schéma réaliste, circuit en évidence et fiche ouverte.
 let gotoCircuit=null;
 try{gotoCircuit=sessionStorage.getItem('mp_goto_circuit');sessionStorage.removeItem('mp_goto_circuit');}catch{}
 if(gotoCircuit&&panel.circuits.some(c=>c.id===gotoCircuit)){state.tab='panel';state.view='reel';}else gotoCircuit=null;
 try{const gq=sessionStorage.getItem('mp_goto_q');if(gq){state.q=gq;state.tab='list';sessionStorage.removeItem('mp_goto_q');}}catch{}
 // Désignations à côté du panneau réaliste : désactivées par défaut (la liste des circuits les montre déjà).
 state.realLabels=pref('mp_panel_real_labels')==='1';state.rzoom=pref('mp_panel_zoom')==='circuits'?'circuits':'full';state.rmult=[1,1.25,1.5,2,3].includes(Number(pref('mp_panel_mult')))?Number(pref('mp_panel_mult')):1;
 ctx.crumbs([['Mes sites','#/sites'],[site.name,'#/sites/'+site.id],[panelTitle(panel)]]);

 const root=h('div',{class:'container'});
 const head=h('div');
 const tabs=h('div',{class:'tabs',role:'tablist','aria-label':'Sections du panneau'});
 const body=h('div');
 const saveState=h('span',{class:'save-state',role:'status'});
 root.append(head,tabs,body);

 async function persist(update){
  // Sérialise les écritures pour garder les numéros de révision cohérents.
  const run=saving.then(async()=>{
   saveState.className='save-state busy';saveState.textContent='Enregistrement…';
   try{
    const out=await api('/api/panels?id='+panel.id,{method:'PUT',body:{revision:panel.revision,...update}});
    panel=out.panel;saveState.className='save-state ok';saveState.textContent='✓ Enregistré';
    return panel;
   }catch(e){
    saveState.className='save-state fail';
    // Échec : le bouton relance l'enregistrement avec les mêmes données (sauf conflit de révision).
    if(e.status===409)saveState.textContent='⚠ Non enregistré';
    else saveState.replaceChildren('⚠ Échec — ',h('button',{type:'button',class:'link',onclick:()=>persist(update).then(()=>{renderHead();renderBody();}).catch(()=>{})},'Réessayer'));
    if(e.status===409){toast(e.message,8000);}
    throw e;
   }
  });
  saving=run.catch(()=>{});
  return run;
 }

 // ---------- Étapes du projet : conception, relevé, vérification ----------
 const metaWith=details=>({name:panel.name,tag:panel.tag,kind:panel.kind,location:panel.location,details:{...panel.details,...details}});
 async function setStage(next,{keepTab=false}={}){
  try{
   const details={stage:next};
   const st=panel.details?.state;if(next==='conception'&&st==='Existant')details.state='Planifié';else if(next==='releve'&&st==='Planifié')details.state='Existant';
   await persist({meta:metaWith(details)});
   if(!keepTab)state.tab=defaultTab();
   history.replaceState(null,'',`#/panneaux/${panel.id}/${state.tab}`);
   renderHead();renderTabs();renderBody();
  }catch(e){toast(e.message,7000);}
 }
 // Copie du relevé en projet de conception (agrandissement, remplacement) : le panneau existant reste intact.
 async function conceptionCopy(){
  if(!await confirmDialog(`Créer une copie de « ${panel.name} » en conception ? Vous pourrez y planifier l’agrandissement sans toucher au relevé.`,{title:'Planifier un agrandissement',confirm:'Créer la copie'}))return;
  try{
   const meta=metaWith({stage:'conception',state:'Planifié'});meta.name=(panel.name+' — projet').slice(0,100);
   const {details:{appliances,...det},...rest}=meta;
   const out=await api('/api/panels',{method:'POST',body:{siteId:site.id,...rest,details:det,positions:panel.positions,copyFrom:panel.id}});
   toast('Copie créée : concevez-y votre agrandissement.');location.hash='#/panneaux/'+out.panel.id;
  }catch(e){toast(e.message,8000);}
 }
 // Avancement du projet (indicateur), distinct de la navigation entre les outils (onglets) : consulter un outil ne le modifie pas.
 function stageDialog(){
  const cur=stageOf();let pick=cur;
  const radios=STAGE_IDS.map(k=>{const st=PANEL_STAGES[k];return h('label',{class:'stage-opt'},h('input',{type:'radio',name:'stage',value:k,checked:k===cur,onchange:()=>{pick=k;}}),h('span',{},h('b',{text:st.n+'. '+st.label}),h('small',{class:'muted',text:st.hint})));});
  dialog({title:'Étape du projet',eyebrow:panelTitle(panel),body:[h('p',{class:'muted',text:'L’étape indique où en est le projet. Elle ne modifie ni vos circuits ni vos calculs, et tous les outils restent accessibles dans les onglets.'}),h('div',{class:'stage-opts'},radios)],actions:[{label:'Annuler',kind:'ghost'},{label:'Enregistrer',kind:'primary',onClick:async()=>{if(pick!==cur)await setStage(pick,{keepTab:true});}}]});
 }
 // Étape du projet : simple pastille (les détails s'ouvrent au clic).
 function stageChip(){
  const cur=stageOf(),canEdit=data.access!=='view';
  return h(canEdit?'button':'span',{type:canEdit?'button':null,class:'stage-chip',title:'Étape du projet : '+PANEL_STAGES[cur].hint,onclick:canEdit?stageDialog:null},`${PANEL_STAGES[cur].n}. ${PANEL_STAGES[cur].label}${canEdit?' ▾':''}`);
 }
 // Code QR : ouvre ce panneau dans l'application (connexion requise).
 function qrDialog(){
  const url=panelLink(NATIVE?webUrl(''):location.origin,panel.id);
  const svgText=qrSvg(url);
  const node=new DOMParser().parseFromString(svgText,'image/svg+xml').documentElement;node.setAttribute('class','qr-svg');
  const save=(blob,name)=>{const a=h('a',{href:URL.createObjectURL(blob),download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);};
  const fname='qr-'+(panel.tag||panel.name).normalize('NFD').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'');
  const png=()=>{const m=qrMatrix(url),n=m.length,s=12,q=4,W=(n+2*q)*s,cv=document.createElement('canvas');cv.width=cv.height=W;const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,W);g.fillStyle='#000';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(m[r][c])g.fillRect((c+q)*s,(r+q)*s,s,s);cv.toBlob(b=>b&&save(b,fname+'.png'));};
  const print=()=>{const box=h('div',{id:'qrPrint'},h('h2',{text:panelTitle(panel)}),node.cloneNode(true),h('p',{text:'Scannez pour ouvrir ce panneau dans Disjonio (connexion requise).'}),h('p',{class:'small',text:url}));document.body.append(box);window.print();setTimeout(()=>box.remove(),500);};
  const copy=async()=>{try{await navigator.clipboard.writeText(url);toast('Lien copié.');}catch{toast(url,8000);}};
  dialog({title:'Code QR · '+panelTitle(panel),eyebrow:'Ouvre ce panneau dans l’application',body:[h('div',{class:'qr-box'},node),h('p',{class:'small muted',text:'Collez-le sur la porte du panneau. Le lien ouvre ce panneau seulement pour les personnes connectées à un compte qui y a accès (vous, votre équipe, ou les personnes avec qui il est partagé).'}),h('input',{class:'qr-url',readOnly:true,value:url,'aria-label':'Lien du code QR',onfocus:e=>e.target.select()}),h('div',{class:'page-actions'},h('button',{type:'button',onclick:copy},'Copier le lien'),h('button',{type:'button',onclick:()=>save(new Blob([svgText],{type:'image/svg+xml'}),fname+'.svg')},'Télécharger SVG'),h('button',{type:'button',onclick:png},'Télécharger PNG'),h('button',{type:'button',class:'primary',onclick:print},'Imprimer'))],actions:[{label:'Fermer',kind:'ghost'}]});
 }
 // Garnir le panneau existant avec des photos analysées par l'IA.
 const garnir=()=>aiImportDialog({site,siblings,target:panel,onApplied:p=>{panel=p;renderHead();renderBody();}});
 // Une action principale selon l'étape ; partage, photos, QR et exports sont regroupés dans « Plus d'actions ».
 // « À terminer » : points manquants ou incertains, avec accès direct à chaque correction.
 function todoItems(){let rep=null;try{rep=panelReport(panel,{children});}catch{}return buildChecklist(panel,{report:rep});}
 function runAction(a){
  if(a.circuit)openCircuit(a.circuit);
  else if(a.circuitPos){const c=panel.circuits.find(x=>designation(x)===a.circuitPos);c?openCircuit(c.id):go('plan');}
  else if(a.tab)go(a.tab);
 }
 function checklistDialog(){
  const items=todoItems();let d;
  d=dialog({title:'À terminer',eyebrow:panelTitle(panel),wide:true,body:[items.length?h('ul',{class:'todo-list'},...items.map(it=>h('li',{class:it.level},
    h('div',{},h('span',{text:it.text}),it.more&&h('div',{class:'todo-more'},...it.more.map(m=>h('button',{type:'button',class:'link',onclick:()=>{d.close();runAction(m.action);}},m.label)))),
    h('button',{type:'button',class:'sm',onclick:()=>{d.close();runAction(it.action);}},'Corriger')))):h('p',{class:'notice info',text:'✓ Rien à terminer : toutes les informations essentielles sont renseignées.'})],actions:[{label:'Fermer',kind:'ghost'}]});
 }
 function primaryAction(){
  const cur=stageOf(),todo=panel.circuits.filter(c=>!c.vacant&&c.status==='À confirmer'&&!c.label).length;
  if(data.access!=='view'&&cur==='releve'&&panel.circuits.some(c=>c.status==='À confirmer'&&!c.vacant)){
   const first=sortCircuits(panel.circuits).find(c=>c.status==='À confirmer'&&!c.vacant);
   return h('button',{type:'button',class:'primary',onclick:()=>openCircuit(first.id)},'Identifier les circuits'+(todo?` (${todo})`:''));
  }
  if(cur==='verification')return h('button',{type:'button',class:'primary',onclick:()=>go('appliances')},'🔌 Électroménagers');
  return h('button',{type:'button',class:'primary',onclick:()=>go('docs')},'Rapports et étiquettes');
 }
 function moreMenu(){
  const item=(label,fn)=>h('button',{type:'button',role:'menuitem',onclick:fn},label);
  const menu=h('div',{class:'menu',role:'menu'},
   data.access&&data.access!=='owner'?h('div',{class:'who',text:`👥 Partagé par ${data.sharedBy} · ${data.access==='edit'?'modification':'lecture seule'}`}):item('👥 Partager',()=>shareDialog({panelId:panel.id,title:panelTitle(panel)})),
   data.access!=='view'&&item('📷 Garnir par photos (IA)',garnir),
   qr&&item('▦ Code QR',qrDialog),
   data.access!=='view'&&stageOf()==='releve'&&item('✏️ Planifier un agrandissement (copie)',conceptionCopy),
   item('📄 Aide-mémoire PDF',()=>doc({kind:'door'})),
   data.access!=='view'&&item('🕘 Historique',()=>historyDialog({panel,persist,onDone:()=>{renderHead();renderBody();}})),
   item('🖨 Rapports et étiquettes',()=>go('docs')));
  const btn=h('button',{type:'button','aria-haspopup':'menu','aria-expanded':'false'},'⋯ Plus d’actions');
  btn.onclick=e=>{e.stopPropagation();const open=menu.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));};
  return h('div',{class:'user-menu more-menu'},btn,menu);
 }
 function renderHead(){
  const s=stats(panel.circuits),det=panel.details||{};
  ctx.remember?.({id:panel.id,name:panel.name,tag:panel.tag,site:site.name,siteId:site.id,toConfirm:s.toConfirm});
  const fed=siblings.find(x=>x.id===det.fedFrom);
  const ro=data.access==='view'?h('p',{class:'notice info',text:`Panneau partagé en lecture seule par ${data.sharedBy} : vous pouvez le consulter et générer ses documents, mais pas le modifier.`}):null;
  const empty=data.access!=='view'&&!panel.circuits.some(c=>c.label||c.amps!=null||c.vacant);
  head.replaceChildren(ro||'',empty&&stageOf()==='releve'?h('div',{class:'notice info'},h('b',{text:'Panneau vide. '}),'Prenez en photo le panneau ouvert (et son répertoire) : l’IA lit les disjoncteurs et garnit ce panneau pour vous. ',h('button',{type:'button',class:'primary sm',onclick:garnir},'📷 Garnir par photos (IA)')):'',h('div',{class:'page-head'},
   h('div',{},
    saveState,
    h('div',{class:'panel-hero'},panel.tag&&h('span',{class:'badge tag',text:panel.tag}),h('h1',{text:panel.name}),stageChip()),
    h('div',{class:'sub'},[panel.kind,panel.location||'Emplacement à préciser',det.building].filter(Boolean).join(' · ')),
    h('div',{class:'progress-line'},h('div',{class:'progress','aria-hidden':'true'},h('i',{style:{width:s.progress+'%'}})),h('span',{text:`${s.identified} identifiés · ${s.free} libres · ${s.toConfirm} à confirmer`})),
    fed&&h('div',{class:'sub small'},'Alimenté par ',h('a',{href:'#/panneaux/'+fed.id,text:panelTitle(fed)}),det.fedFromCircuit?` (circuit ${det.fedFromCircuit})`:'')),
   h('div',{class:'page-actions'},data.access!=='view'&&(n=>n?h('button',{type:'button',onclick:checklistDialog},`✅ À terminer (${n})`):null)(todoItems().length),primaryAction(),moreMenu())));
 }
 const mobile=()=>typeof matchMedia==='function'&&matchMedia('(max-width:720px)').matches;
 function renderTabs(){
  // Mobile : trois accès (Circuits · Vue du panneau · Plus) au lieu d'onglets défilants.
  if(mobile()){
   const more=['plan','appliances','docs','info'],inMore=more.includes(state.tab);
   const t=(k,label)=>h('button',{type:'button',role:'tab','aria-selected':String(state.tab===k),onclick:()=>go(k)},label);
   const moreBtn=h('button',{type:'button',role:'tab','aria-selected':String(inMore),'aria-haspopup':'dialog',onclick:()=>{
    const d=dialog({title:'Plus',eyebrow:panelTitle(panel)+(inMore?' · '+tabNames[state.tab].replace(/^\S+\s/,''):''),body:[h('div',{class:'more-list'},...more.map(k=>h('button',{type:'button',class:state.tab===k?'on':'',onclick:()=>{d.close();go(k);}},tabNames[k])))],actions:[{label:'Fermer',kind:'ghost'}]});}},'⋯ Plus');
   tabs.className='tabs tabs-3';tabs.replaceChildren(t('list','☷ Circuits'),t('panel','▦ Panneau'),moreBtn);return;
  }
  tabs.className='tabs';
  // Tous les outils sont accessibles quelle que soit l'étape (l'étape n'est qu'un indicateur d'avancement).
 const keys=['panel','list','plan','appliances','docs','info'];
  tabs.replaceChildren(...keys.map(k=>h('button',{type:'button',role:'tab','aria-selected':String(state.tab===k),onclick:()=>go(k)},tabNames[k])));
 }
 function go(t){state.tab=t;history.replaceState(null,'',`#/panneaux/${panel.id}/${t}`);renderTabs();renderBody();}
 const doc=async params=>{try{toast('Génération du PDF…');await openDocument({panel:panel.id,...params});}catch(e){toast(e.message);}};

 function filtered(){
  const q=fold(state.q);
  return c=>(!state.status||c.status===state.status||(state.status==='À confirmer'&&c.status==='Non visible'))&&(!q||searchable(c).includes(q))&&(!state.tag||allTags(c).includes(state.tag));
 }
 // Circuit en cours d'édition : contour distinct des couleurs de statut, centré dans la zone du panneau.
 function markActive(center){
  body.querySelectorAll('.breaker.active,.rp-slot.act,.pa-item.act').forEach(e=>e.classList.remove('active','act'));
  if(!state.activeId)return;
  const el=[...body.querySelectorAll('[data-id]')].find(e=>e.getAttribute('data-id')===state.activeId&&e.matches('.breaker,.rp-slot,.pa-item'));
  if(!el)return;
  el.classList.add(el.matches('.breaker')?'active':'act');
  if(center)el.scrollIntoView({block:center==='nearest'?'nearest':'center',inline:center==='nearest'?'nearest':'center',behavior:'smooth'});
 }
 // Pendant l'édition (bureau), le cadrage « Circuits » est privilégié ; l'état précédent est rétabli à la fermeture.
 function setActive(id){
  const was=state.activeId;state.activeId=id||null;
  if(id&&!was&&state.view==='reel'&&state.rzoom==='full'&&document.body.classList.contains('has-side')){state.prevZoom='full';state.rzoom='circuits';renderBody();}
  else if(!id&&state.prevZoom){state.rzoom=state.prevZoom;state.prevZoom=null;renderBody();}
  markActive(id?'nearest':false);
 }
 // Téléphone : aperçu temporaire du panneau complet, puis retour à la fiche sans perdre la saisie.
 function showPanelOverlay(activeId,goTo){
  const wrap=h('div',{class:'panel-overlay'});
  const real=panelReal({panel,activeId,crop:true,labels:false,onCircuit:async cid=>{d.close();await goTo(cid);}});
  wrap.append(real);
  const d=dialog({title:'Panneau',eyebrow:panelTitle(panel),wide:'xl',body:[wrap,h('p',{class:'small muted',text:'Touchez un disjoncteur pour passer à sa fiche.'})],actions:[{label:'Retour à la fiche',kind:'primary'}]});
  setTimeout(()=>real.querySelector('.rp-slot.act')?.scrollIntoView({block:'center',inline:'center'}),50);
 }
 function openCircuit(cid){
  if(state.select){state.select.has(cid)?state.select.delete(cid):state.select.add(cid);renderBody();return;}
  const order=sortCircuits(panel.circuits).map(c=>c.id);
  const editor=circuitEditor({panel,id:cid,order,planning,lib,onCurrent:setActive,onShowPanel:showPanelOverlay,feeds:{siblings,createSubpanel,onChange:()=>{renderBody();}},onSave:async circuits=>{
   const p=await persist({circuits});
   editor.setPanel(p,sortCircuits(p.circuits).map(c=>c.id));
   renderHead();renderBody();
  }});
 }
 function filters(onChange){
  const tagsList=[...new Set(panel.circuits.flatMap(allTags))].sort((a,b)=>a.localeCompare(b,'fr'));
  const search=h('input',{type:'search',placeholder:'Rechercher : pièce, appareil, numéro…','aria-label':'Rechercher un circuit',value:state.q,oninput:e=>{state.q=e.target.value;onChange();}});
  const st=h('select',{'aria-label':'Filtrer par statut',onchange:e=>{state.status=e.target.value;onChange();}},new Option('Tous les statuts',''),...states.slice(0,3).map(s=>new Option(s,s)));st.value=state.status;
  const row=h('div',{class:'toolbar-row'},h('label',{class:'search'},h('span',{'aria-hidden':'true',text:'⌕'}),search),st);
  if(tagsList.length){const tg=h('select',{'aria-label':'Filtrer par tag',onchange:e=>{state.tag=e.target.value;onChange();}},new Option('Tous les tags',''),...tagsList.map(t=>new Option(t,t)));tg.value=state.tag;row.append(tg);}
  return row;
 }
 // Nomenclature éditable : désignation, pièce et statut directement dans les lignes (la fiche complète reste pour les détails).
 async function saveField(id,patch){
  try{const next=structuredClone(panel.circuits);const c=next.find(x=>x.id===id);if(!c)return;Object.assign(c,patch);await persist({circuits:next});renderHead();}
  catch(e){toast(e.message,7000);renderBody();}
 }
 function editableList(container){
  const list=sortCircuits(panel.circuits).filter(filtered());
  const rooms=[...new Set(panel.circuits.map(c=>c.room).filter(Boolean))];
  const rowOf=c=>{
   if(c.vacant)return h('div',{class:'erow vacant'},h('span',{class:'pos',text:designation(c)}),h('span',{class:'muted',text:'Espace inutilisé'}));
   const label=h('input',{value:c.label||'','aria-label':'Désignation du circuit '+designation(c),maxlength:100,placeholder:'À identifier…',onchange:e=>saveField(c.id,{label:e.target.value.trim()})});
   const room=h('input',{value:c.room||'','aria-label':'Pièce du circuit '+designation(c),maxlength:80,list:'erRooms',placeholder:'Pièce',onchange:e=>saveField(c.id,{room:e.target.value.trim()})});
   const st=h('select',{'aria-label':'Statut du circuit '+designation(c),class:'st-'+statusClass(c),onchange:e=>saveField(c.id,{status:e.target.value})},...states.map(x=>new Option(x,x)));st.value=c.status;
   return h('div',{class:'erow '+statusClass(c)},h('span',{class:'pos',text:designation(c)}),label,room,st,h('span',{class:'amps',text:c.amps?c.amps+' A':'— A'}),h('button',{type:'button',class:'ghost sm','aria-label':'Ouvrir la fiche complète du circuit '+designation(c),onclick:()=>openCircuit(c.id)},'Fiche ›'));
  };
  container.replaceChildren(list.length?h('div',{class:'etable'},h('div',{class:'erow ehead'},h('span',{text:'Pos.'}),h('span',{text:'Désignation'}),h('span',{text:'Pièce'}),h('span',{text:'Statut'}),h('span',{text:'Calibre'}),h('span')),...list.map(rowOf),h('datalist',{id:'erRooms'},rooms.map(r=>h('option',{value:r})))):h('p',{class:'empty-state muted',text:'Aucun circuit ne correspond à la recherche.'}));
 }
 function circuitList(container,editable=false){
  if(editable&&data.access!=='view'&&!state.select&&!isMobile())return editableList(container);
  const match=filtered();
  const list=sortCircuits(panel.circuits).filter(match);
  container.replaceChildren(...(list.length?list.map(c=>{
   const meta=h('span',{class:'meta'},c.amps?c.amps+' A':'— A',h('small',{class:'st-'+statusClass(c),text:c.status}));
   return h('button',{type:'button',class:'circuit-card card '+statusClass(c)+(state.select?.has(c.id)?' selected':''),'aria-pressed':state.select?String(state.select.has(c.id)):null,onclick:()=>openCircuit(c.id)},
    h('span',{class:'pos',text:designation(c)}),
    h('span',{class:'txt'},h('strong',{text:shortText(c)||'À identifier — touchez pour décrire'}),h('small',{text:[c.room,c.usage!=='Autre'?c.usage:'',c.protection,c.breakerRef].filter(Boolean).join(' · ')||'—'}),c.exceptions&&h('span',{class:'ex',text:'⚠ '+c.exceptions}),(()=>{const ch=linkedChild(panel,c,siblings);return ch?h('span',{class:'feeds-tag',text:'⚡ Alimente '+panelTitle(ch)}):c.usage==='Sous-panneau'?h('span',{class:'feeds-tag todo',text:'⚡ Sous-panneau à lier'}):null;})()),
    meta);
  }):[h('p',{class:'empty-state muted',text:'Aucun circuit ne correspond à la recherche.'})]));
 }
 function viewSwitch(){
  return h('div',{class:'view-switch',role:'group','aria-label':'Affichage du panneau'},
   h('button',{type:'button','aria-pressed':String(state.view==='schema'),class:state.view==='schema'?'on':'',onclick:()=>{state.view='schema';setPref('mp_panel_view','schema');renderBody();}},'Schéma'),
   h('button',{type:'button','aria-pressed':String(state.view==='reel'),class:state.view==='reel'?'on':'',onclick:()=>{state.view='reel';setPref('mp_panel_view','reel');renderBody();}},'Réaliste'));
 }

 const MULTS=[1,1.25,1.5,2,3];
 function sized(svg){if(state.rmult>1){svg.style.width=state.rmult*100+'%';svg.style.maxWidth='none';svg.style.maxHeight='none';svg.style.margin='0';}return svg;}
 function zoomControls(){
  const setZ=v=>{state.rzoom=v;setPref('mp_panel_zoom',v);renderBody();};
  const setM=d=>{const i=Math.min(MULTS.length-1,Math.max(0,MULTS.indexOf(state.rmult)+d));state.rmult=MULTS[i];setPref('mp_panel_mult',String(state.rmult));renderBody();};
  return h('div',{class:'zoom-bar'},
   h('div',{class:'view-switch',role:'group','aria-label':'Cadrage du panneau'},
    h('button',{type:'button','aria-pressed':String(state.rzoom==='full'),class:state.rzoom==='full'?'on':'',onclick:()=>setZ('full')},'Entier'),
    h('button',{type:'button','aria-pressed':String(state.rzoom==='circuits'),class:state.rzoom==='circuits'?'on':'',title:'Agrandir sur la zone des circuits',onclick:()=>setZ('circuits')},'Circuits')),
   h('div',{class:'view-switch',role:'group','aria-label':'Ajustement'},
    h('button',{type:'button',title:'Afficher tout le panneau dans la fenêtre',onclick:()=>{state.rzoom='full';state.rmult=1;setPref('mp_panel_zoom','full');setPref('mp_panel_mult','1');renderBody();}},'Ajuster'),
    state.activeId&&h('button',{type:'button',title:'Centrer sur le circuit sélectionné',onclick:()=>markActive('center')},'Centrer')),
   h('div',{class:'view-switch',role:'group','aria-label':'Zoom'},
    h('button',{type:'button','aria-label':'Réduire le zoom',disabled:state.rmult===MULTS[0],onclick:()=>setM(-1)},'−'),
    h('button',{type:'button','aria-label':'Réinitialiser le zoom',title:'Réinitialiser',onclick:()=>{state.rmult=1;setPref('mp_panel_mult','1');renderBody();}},'×'+String(state.rmult).replace('.',',')),
    h('button',{type:'button','aria-label':'Augmenter le zoom',disabled:state.rmult===MULTS.at(-1),onclick:()=>setM(1)},'+')));
 }
 function realCabinet(){
  const filtering=!!(state.q||state.status||state.tag);
  const labels=h('label',{class:'check small'},h('input',{type:'checkbox',checked:state.realLabels,onchange:e=>{state.realLabels=e.target.checked;setPref('mp_panel_real_labels',e.target.checked?'1':'0');renderBody();}}),'Désignations');
  return h('section',{class:'panel-area real'+(state.realLabels?' wide':''),'aria-label':'Vue réaliste du panneau'},
   h('div',{class:'panel-caption'},viewSwitch(),zoomControls(),labels),
   h('div',{class:'real-wrap'},sized(panelReal({panel,crop:state.rzoom==='circuits',activeId:state.activeId,labels:state.realLabels,match:filtering?filtered():null,selected:state.select,onCircuit:openCircuit}))),
   h('p',{class:'panel-tip',text:state.select?'Touchez les disjoncteurs à inclure dans la sélection.':'Touchez un disjoncteur pour ouvrir sa fiche. DDFT : bouton TEST blanc et fil témoin ; anti-arc : bouton TEST bleu.'}));
 }
 function cabinet(){
  if(state.tab==='panel'&&state.view==='reel')return realCabinet();
  const det=panel.details||{};
  const grid=h('div',{class:'breakers'});
  grid.style.gridTemplateRows=`repeat(${panel.positions},var(--row,16px))`;grid.style.setProperty('--pos',panel.positions);
  const match=filtered(),filtering=!!(state.q||state.status||state.tag);
  const showLoads=planning&&state.tab==='plan';
  for(const c of panel.circuits){
   const start=c.slots[0],n=slotPos(start),side=n%2===0?2:1;
   const linked=c.slots.length>2;
   const b=h('button',{type:'button','data-id':c.id,class:`breaker ${statusClass(c)}${side===2?' even':''}${linked?' linked':''}${filtering?(match(c)?' match':' dimmed'):''}${state.select?.has(c.id)?' selected':''}`,'aria-label':`${designation(c)} : ${c.label||'à identifier'}, ${c.amps??'?'} A`,onclick:()=>openCircuit(c.id)},
    h('span',{class:'num',text:designation(c)}),h('span',{class:'lever',text:c.amps??'?'}),h('span',{class:'short',text:shortText(c)||'—'}),h('i',{class:'dot'}));
   if(showLoads){
    // Phase et taux de charge du circuit.
    const r=circuitLoad(c,voltsOf(panel.details));
    const leg=r.volts===voltsOf(panel.details).bi?'L1+L2':legOf(n);
    const tag=h('span',{class:'leg-tag',text:leg});tag.style[side===2?'left':'right']='3px';b.append(tag);
    if(r.percent!=null){const bar=h('i',{class:r.percent>100?'over':r.percent>80?'high':''});bar.style.width=Math.min(100,r.percent)+'%';b.append(h('span',{class:'load-bar'},bar));}
   }
   b.style.gridColumn=String(side);
   b.style.gridRow=`${slotOrder(start)+1} / span ${c.slots.length}`;
   grid.append(b);
  }
  return h('section',{class:'panel-area','aria-label':'Face avant du panneau'},
   h('div',{class:'panel-caption'},state.tab==='panel'?viewSwitch():h('span',{text:'VUE DE FACE'}),h('span',{text:`1 — ${panel.positions}`})),
   h('div',{class:'cabinet'},
    h('div',{class:'manufacturer'},h('b',{text:det.brand||'Panneau'}),h('span',{text:[det.model,panel.tag].filter(Boolean).join(' · ')||panel.kind})),
    h('div',{class:'main-breaker'},h('span',{text:'PRINCIPAL'}),h('div',{class:'main-switch'},h('b',{text:det.mainAmps||'—'}),h('span',{text:'A'}))),
    h('div',{class:'rail-labels'},h('span',{text:'IMPAIRS'}),h('span',{text:'PAIRS'})),
    grid,
    h('div',{class:'panel-foot'},h('span',{text:(det.voltage||'').toUpperCase()}),h('span',{text:panel.positions+' POSITIONS'}))),
   h('p',{class:'panel-tip',text:state.select?'Touchez les disjoncteurs à inclure dans la sélection.':'Touchez un disjoncteur pour ouvrir sa fiche.'}));
 }
 const legend=()=>h('div',{class:'legend'},h('span',{},h('i',{style:{background:'#659972'}}),'Identifié'),h('span',{},h('i',{style:{background:'#c6a66f'}}),'À confirmer'),h('span',{},h('i',{style:{background:'#adb5a8'}}),'Libre'));

 function renderBody(){
  if(state.tab==='panel'){
   const listBox=h('div',{class:'circuit-list'});
   // Vue réaliste avec désignations : le panneau occupe toute la largeur, la liste passe dessous.
   const cabBox=h('div',{class:'sticky-col'+(state.view==='reel'&&state.realLabels?' span-all':'')});
   const refresh=()=>{cabBox.replaceChildren(cabinet());circuitList(listBox);};
   body.replaceChildren(h('div',{class:'workspace'},cabBox,h('section',{'aria-label':'Liste des circuits'},bulkBar(),filters(refresh),listBox,legend())));
   refresh();markActive(false);
  }else if(state.tab==='list'){
   const listBox=h('div',{class:'circuit-list'});
   body.replaceChildren(h('div',{class:'list-wide'},bulkBar(),filters(()=>circuitList(listBox,true)),listBox,legend()));
   circuitList(listBox,true);
  }else if(state.tab==='appliances')body.replaceChildren(appliancesView({panel,children,canEdit:data.access!=='view',onChange:()=>{renderHead();renderBody();},
   save:async({circuits,appliances})=>{await persist({circuits,meta:metaWith({appliances})});}}));
  else if(state.tab==='plan')renderPlan();
  else if(state.tab==='docs')renderDocs();
  else renderInfo();
 }

 // ---------- Actions groupées ----------
 function bulkBar(){
  if(!state.select)return h('div',{class:'bulk-toggle'},h('button',{type:'button',onclick:()=>{state.select=new Set();renderBody();}},'☑ Sélection multiple'),h('span',{class:'small muted',text:'Modifier plusieurs circuits d’un coup (espaces inutilisés, libres, calibre, pièce…).'}));
  const sel=state.select,n=sel.size;
  const pick=(label,fn)=>h('button',{type:'button',class:'ghost small-btn',onclick:()=>{fn();renderBody();}},label);
  const visible=()=>sortCircuits(panel.circuits).filter(filtered());
  const chooser=(label,options,key,map=v=>v)=>{const s=h('select',{'aria-label':label,disabled:!n,onchange:async e=>{if(e.target.value==='')return;const v=map(e.target.value);e.target.value='';await apply({type:'set',patch:{[key]:v}},`${label} : ${v??'—'}`);}},new Option(label+'…',''),...options.map(o=>Array.isArray(o)?new Option(o[1],o[0]):new Option(o,o)));return s;};
  const room=h('input',{type:'text',maxlength:80,placeholder:'Pièce…','aria-label':'Pièce pour la sélection',disabled:!n,list:'bulkRooms'});
  const rooms=[...new Set(panel.circuits.map(c=>c.room).filter(Boolean))];
  return h('div',{class:'bulk-bar card',role:'region','aria-label':'Actions groupées'},
   h('div',{class:'bulk-head'},h('b',{text:n?`${n} circuit${n>1?'s':''} sélectionné${n>1?'s':''}`:'Aucun circuit sélectionné'}),
    h('div',{class:'bulk-pick'},pick('Tout (filtrés)',()=>visible().forEach(c=>sel.add(c.id))),pick('Positions vides',()=>panel.circuits.filter(isEmptySlot).forEach(c=>sel.add(c.id))),pick('À confirmer',()=>panel.circuits.filter(c=>c.status==='À confirmer'&&!c.vacant).forEach(c=>sel.add(c.id))),pick('Aucun',()=>sel.clear()),
     h('button',{type:'button',onclick:()=>{state.select=null;renderBody();}},'Terminer'))),
   h('div',{class:'bulk-actions'},
    h('button',{type:'button',disabled:!n,onclick:()=>apply({type:'vacant'},'Espace inutilisé (aucun disjoncteur)',true)},'▭ Espace inutilisé'),
    h('button',{type:'button',disabled:!n,onclick:()=>apply({type:'free'},'Disjoncteur libre',true)},'○ Disjoncteur libre'),
    chooser('Statut',states,'status'),
    chooser('Calibre',[['none','— Aucun'],...ampsList.map(a=>[a,a+' A'])],'amps',v=>v==='none'?null:Number(v)),
    chooser('Protection',protections,'protection'),
    chooser('Usage',usages,'usage'),
    h('span',{class:'bulk-room'},room,h('datalist',{id:'bulkRooms'},rooms.map(r=>h('option',{value:r}))),h('button',{type:'button',disabled:!n,onclick:()=>{const v=room.value.trim();if(v)apply({type:'set',patch:{room:v}},'Pièce : '+v);}},'Appliquer')),
    h('button',{type:'button',class:'danger',disabled:!n,onclick:()=>apply({type:'clear'},'Effacer les fiches',true)},'Effacer')));
 }
 async function apply(action,label,destructive){
  const ids=[...state.select];if(!ids.length)return;
  const touched=panel.circuits.filter(c=>state.select.has(c.id)&&(c.label||c.loads?.length||c.notes));
  if(destructive&&touched.length&&!await confirmDialog(`${label} pour ${ids.length} circuit(s) ? ${touched.length} fiche(s) contiennent déjà une description ou des charges, qui seront effacées.`,{title:'Action groupée',confirm:'Appliquer',danger:action.type==='clear'}))return;
  try{const circuits=bulkApply(panel.circuits,ids,action);await persist({circuits});toast(`${label} — ${ids.length} circuit(s) mis à jour.`);state.select=new Set();renderHead();renderBody();}
  catch(e){toast(e.message);}
 }
 function renderDocs(){
  const fmt=()=>h('select',{'aria-label':'Format du papier'},new Option('Lettre 8½ × 11','letter'),new Option('Légal 8½ × 14','legal'));
  const f1=fmt(),f2=fmt();
  const skip=h('input',{type:'checkbox'});
  const cards=[
   h('article',{class:'card doc-card'},h('div',{class:'ico',text:'🗒'}),h('h3',{text:'Aide-mémoire de porte'}),h('p',{text:'Une page : tous les circuits en deux colonnes, comme sur le panneau. À fixer à l’intérieur de la porte.'}),h('div',{class:'opts'},f1),h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'door',format:f1.value})},'Générer le PDF')),
   h('article',{class:'card doc-card'},h('div',{class:'ico',text:'📘'}),h('h3',{text:'Rapport complet'}),h('p',{text:'Informations du site et du panneau, répertoire, tableau détaillé avec notes et exceptions, préparé par et signature.'}),h('div',{class:'opts'},f2),h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'report',format:f2.value})},'Générer le PDF')),
   (planning||panel.details?.calcRecord)&&h('article',{class:'card doc-card'},h('div',{class:'ico',text:'🧮'}),h('h3',{text:'Note de calcul de charge'}),h('p',{text:'Calcul de l’entrée électrique étape par étape, en langage clair, avec les règles du Code, les appareils comptés et exclus, et le verdict sur le principal installé.'}),h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'calc'})},'Générer le PDF')),
   (planning||panel.details?.calcRecord)&&h('article',{class:'card doc-card'},h('div',{class:'ico',text:'⚡'}),h('h3',{text:'Bilan de charges et matériel'}),h('p',{text:'Liste de charges par circuit, phases L1/L2, capacité du panneau, calcul selon la règle 8-200, alertes et liste de disjoncteurs.'}),h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'loads'})},'Générer le PDF')),
   h('article',{class:'card doc-card'},h('div',{class:'ico',text:'🏷'}),h('h3',{text:'Étiquettes autocollantes'}),h('p',{text:'Feuille Lettre Avery 5160 / 8160 (30 étiquettes 2⅝ × 1 po) : repère du panneau'+(qr?', code QR du panneau':'')+' puis un circuit par étiquette. Imprimez à 100 %.'}),h('label',{class:'opts'},skip,'Ignorer les positions libres'),h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'labels',skipFree:skip.checked})},'Générer les étiquettes')),
  ];
  if(ctx.features.zebra)cards.push(h('article',{class:'card doc-card'},h('div',{class:'ico',text:'🖨'}),h('h3',{text:'Imprimante ZebraHD'}),h('p',{text:'Envoie les circuits à ZebraHD pour imprimer des étiquettes sur imprimante thermique.'}),h('button',{type:'button',onclick:zebra},'Envoyer à ZebraHD')));
  cards.push(h('article',{class:'card doc-card'},h('div',{class:'ico',text:'💾'}),h('h3',{text:'Sauvegarde JSON'}),h('p',{text:'Exportez une copie complète du panneau, réimportable lors de la création d’un nouveau panneau.'}),h('button',{type:'button',onclick:exportJson},'Exporter le fichier')));
  body.replaceChildren(h('div',{class:'docs'},cards),h('p',{class:'notice mt',text:'Les documents reflètent la dernière version enregistrée. Le rapport du site entier (tous les panneaux) se génère depuis la page du site.'}));
 }
 async function zebra(){
  const win=window.open('','_blank');
  try{const out=await api('/api/etiquettes',{method:'POST',body:{panelId:panel.id}});const url=new URL(out.url);if(url.origin!=='https://zebra.nathanbegin.xyz')throw Error('Adresse ZebraHD inattendue.');if(win)win.location.replace(url.href);else window.open(url.href,'_blank');toast((out.count??panel.circuits.length)+' circuits transmis à ZebraHD.');}
  catch(e){win?.close();toast(e.message);}
 }
 function exportJson(){
  const data={schema:3,app:'Disjonio',exportedAt:new Date().toISOString(),panel:panel.name,tag:panel.tag,kind:panel.kind,location:panel.location,positions:panel.positions,details:panel.details,site:{name:site.name,address:siteAddress(site)},circuits:panel.circuits};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=h('a',{href:url,download:`${(panel.tag||panel.name).replace(/[^\p{L}\p{N}-]+/gu,'-')}.json`});document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 function renderInfo(){
  const e=h('p',{class:'error',role:'alert'});
  const form=h('form',{class:'card form-card',novalidate:true},...panelFields(panel,siblings,{library:planning}),e,
   h('div',{class:'form-actions'},h('button',{type:'button',class:'danger',onclick:remove},'Supprimer ce panneau'),h('button',{type:'submit',class:'primary'},'Enregistrer la fiche')));
  form.addEventListener('submit',async ev=>{
   ev.preventDefault();e.textContent='';
   const p=panelPayload(form);
   if(p.positions<panel.positions&&!await confirmDialog(`Réduire le panneau à ${p.positions} positions ? Les positions retirées doivent être vides.`))return;
   try{await persist(p);toast('Fiche du panneau enregistrée.');ctx.crumbs([['Mes sites','#/sites'],[site.name,'#/sites/'+site.id],[panelTitle(panel)]]);renderHead();}
   catch(x){e.textContent=x.message;}
  });
  body.replaceChildren(form,h('p',{class:'small muted mt',text:`Créé le ${new Date(panel.createdAt).toLocaleDateString((globalThis.MP_LOCALE||'fr-CA'))} · modifié ${fmtRelative(panel.updatedAt)} · révision ${panel.revision}`}));
 }
 async function remove(){
  if(!await confirmDialog(`Supprimer « ${panelTitle(panel)} » et ses ${panel.circuits.length} circuits ? Il sera placé dans la corbeille pendant 30 jours : vous pourrez le restaurer.`,{title:'Supprimer le panneau',confirm:'Mettre à la corbeille',danger:true}))return;
  try{await api('/api/panels?id='+panel.id,{method:'DELETE'});toast('Panneau placé dans la corbeille (30 jours).');location.hash='#/sites/'+site.id;}catch(e){toast(e.message);}
 }

 // Création d'un sous-panneau pré-relié à un circuit de ce panneau (sans quitter la page).
 function createSubpanel(initial){
  return new Promise(resolve=>{
   panelDialog({siblings,library:planning,defaultBipolar:site.bipolarVolts,initial,title:'Nouveau sous-panneau',eyebrow:`Alimenté par ${panelTitle(panel)} · circuit ${initial.details?.fedFromCircuit||''}`,
    onSave:async f=>{const {panel:p}=await api('/api/panels',{method:'POST',body:{siteId:site.id,...f}});resolve({id:p.id,name:p.name,tag:p.tag,kind:p.kind,fedFrom:p.details?.fedFrom||'',fedFromCircuit:p.details?.fedFromCircuit||''});}});
  });
 }
 function openAssign(){
  if(!lib)return toast('Bibliothèque de produits indisponible (forfaits Électricien).');
  assignDialog({getPanel:()=>panel,lib,siblings,createSubpanel,save:async circuits=>{const p=await persist({circuits});renderHead();return p;},onClose:()=>{renderHead();renderBody();}});
 }
 // ---------- Onglet Planification ----------
 function renderPlan(){
  const rep=panelReport(panel,{children});
  const statusText={ok:'Bonne marge',medium:'Marge correcte',high:'Marge réduite (> 80 %)',over:'Surcharge',unknown:'À compléter'}[rep.status];
  const kw=w=>(w/1000).toLocaleString((globalThis.MP_LOCALE||'fr-CA'),{maximumFractionDigits:1})+' kW';
  // Panneau réaliste + placement depuis la palette.
  const free=c=>isEmptySlot(c)||(c.status==='Libre'&&!c.label&&!c.notes);
  const targets=state.place?validStarts(panel,state.place,free):null;
  // Même représentation que l'onglet Panneau (schéma ou réaliste), avec placement depuis la palette.
  const artOpts={panel,breakersByCat:lib?.byCat||new Map(),highlight:targets,
   onCircuit:id=>{if(state.place)return toast('Touchez une position en surbrillance pour placer le disjoncteur, ou terminez le placement.');openCircuit(id);},
   onPosition:async pos=>{
    try{const circuits=placeBreaker(panel.circuits,pos,{...state.place,cat:state.place.cat},panel.positions);await persist({circuits});toast(`${state.place.cat} placé en position ${pos}.`);renderHead();renderBody();}
    catch(e){toast(e.message,7000);}
   }};
  const art=h('div',{class:'plan-art'},h('div',{class:'panel-caption'},viewSwitch(),state.view==='reel'&&zoomControls()),state.view==='reel'?h('div',{class:'real-wrap'},sized(panelReal({...artOpts,labels:false,crop:state.rzoom==='circuits'}))):panelArt(artOpts));
  const banner=state.place&&h('div',{class:'place-banner'},h('span',{},'Placement : ',h('b',{text:state.place.cat}),` · ${state.place.label} — ${targets.size?'touchez une position en surbrillance.':'aucun espace libre suffisant.'}`),h('button',{type:'button',class:'sm',onclick:()=>{state.place=null;renderBody();}},'Terminer'));
  const cabBox=h('div',{class:'stack sticky-col'},banner,art);
  const palette=lib?breakerPalette({lib,det:panel.details||{},selected:state.place?.cat,onSelect:(b,issues)=>{
   if(!b){toast(issues.map(i=>i.text).join(' ')||'Ce produit ne peut pas être placé.',7000);return;}
   const warn=issues.filter(i=>i.level==='warn');if(warn.length)toast(warn.map(i=>i.text).join(' '),7000);
   state.place=state.place?.cat===b.cat?null:b;renderBody();
  }}):h('div',{class:'card side-card'},h('h3',{text:'Bibliothèque de produits'}),h('p',{class:'small muted',text:'Bibliothèque indisponible pour le moment.'}));
  const gauge=h('div',{class:'card side-card'},h('h3',{text:'Capacité du panneau'}),
   h('div',{class:'gauge '+rep.status},h('div',{class:'big',text:rep.percent!=null?rep.percent+' %':'—'}),h('div',{},h('b',{text:statusText}),h('div',{class:'small muted',text:rep.mainAmps?`${rep.designAmps} A sur un principal de ${rep.mainAmps} A (${rep.isDwelling?'calcul 8-200':'phase la plus chargée'})`:'Indiquez le calibre principal dans la fiche du panneau.'}))),
   rep.percent!=null&&h('div',{class:'progress mt'+(rep.percent>100?' over':rep.percent>80?' high':'')},h('i',{style:{width:Math.min(100,rep.percent)+'%'}})),
   h('p',{class:'small muted mt',text:`Charge branchée : ${kw(rep.connectedW)}${children.length?` (dont ${children.length} sous-panneau(x))`:''} · ${rep.free} position(s) libre(s)${rep.remainingAmps!=null?` · marge de prudence (80 %) : ${rep.remainingAmps} A`:''}`}),
   rep.model&&h('p',{class:'small muted',text:`Modèle : ${rep.model.id} — ${rep.model.label}`}),
   h('div',{class:'legs mt'},h('div',{class:'leg'},h('span',{class:'small muted',text:'Phase L1 (estimée)'}),h('b',{text:rep.balance.L1+' A'})),h('div',{class:'leg'},h('span',{class:'small muted',text:'Phase L2 (estimée)'}),h('b',{text:rep.balance.L2+' A'}))),
   h('p',{class:'small muted',text:rep.balance.index==null?'Écart L1/L2 : non applicable (courant moyen nul).':`Écart L1/L2 : ${rep.balance.diff} A · indice de déséquilibre : ${rep.balance.index} % · courant du neutre ≈ ${rep.balance.neutral} A`}),
   h('p',{class:'small muted',text:'Valeurs estimées à partir des charges saisies (ce ne sont pas des mesures). Aucun seuil réglementaire de déséquilibre ne s’applique à une résidence monophasée 120/240 V ; une répartition plus équilibrée reste souhaitable.'}));
  const issues=h('div',{class:'card side-card'},h('h3',{text:`Alertes (${rep.issues.length})`}),
   rep.issues.length?rep.issues.map(i=>h('p',{class:'issue '+i.level,text:(i.circuit?`Circuit ${i.circuit} : `:'')+i.text})):h('p',{class:'issue info',text:'Aucune alerte. Ajoutez les charges de chaque circuit pour un bilan complet.'}),
   ...(rep.notes||[]).map(n=>h('p',{class:'issue info',text:'ℹ '+n.text})));
  const sugg=h('div',{class:'card side-card'},h('h3',{text:'Suggestions'}),h('ul',{class:'small'},suggestions(rep).map(t=>h('li',{text:t}))));
  if(!planning&&panel.details?.calcRecord){
   // Forfait sans calculs payants (ex. après annulation) : le dernier résultat reste consultable et exportable.
   const rec=panel.details.calcRecord,changed=calcFingerprint(panel,children)!==rec.fingerprint,sm=rec.summary||{};
   body.replaceChildren(h('div',{class:'card'},h('h2',{text:'Résultat de calcul conservé'}),
    h('p',{class:'notice '+(changed?'':'info'),text:changed?'Résultat historique — panneau modifié depuis ce calcul.':'Résultat historique — calcul conservé tel qu’il a été établi.'}),
    h('dl',{class:'facts'},h('dt',{text:'Date du calcul'}),h('dd',{text:fmtDate(rec.at)}),h('dt',{text:'Version'}),h('dd',{text:'Disjonio v'+rec.version}),h('dt',{text:'Édition du code'}),h('dd',{text:rec.edition||CODE_EDITION}),
     h('dt',{text:'Charge calculée'}),h('dd',{text:`${sm.designAmps??'—'} A${sm.mainAmps?` sur un principal de ${sm.mainAmps} A`:''}${sm.percent!=null?` (${sm.percent} %)`:''}`}),h('dt',{text:'Charge branchée'}),h('dd',{text:kw(sm.connectedW||0)})),
    h('p',{class:'small muted',text:'Les données d’origine sont conservées avec le résultat. Pour refaire un calcul à jour, un forfait avec planification est nécessaire.'}),
    h('div',{class:'page-actions'},h('button',{type:'button',onclick:()=>doc({kind:'calc'})},'🧮 Note de calcul (PDF)'),h('button',{type:'button',onclick:()=>doc({kind:'loads'})},'⚡ Bilan de charges (PDF)'),h('a',{class:'btn primary',href:'#/abonnement'},'Voir les forfaits'))));
   return;
  }
  if(!planning){
   body.replaceChildren(h('div',{class:'card empty-state'},h('div',{class:'ico',text:'⚡'}),h('h2',{text:'Planification et calcul de charges'}),
    h('p',{text:'Construisez le panneau pièce par pièce à partir du catalogue, ajoutez les charges de chaque circuit (bornes de recharge, thermopompes, chauffe-eau, piscine…), vérifiez la règle des 80 %, l’équilibre L1/L2 et la capacité du panneau, puis générez le bilan de charges et la liste de matériel.'}),
    h('p',{class:'small muted',text:`Aperçu : charge branchée ${kw(rep.connectedW)}${rep.percent!=null?`, ${rep.percent} % du principal`:''}.`}),
    h('a',{class:'btn primary lg',href:'#/abonnement'},'Inclus dans les forfaits Électricien — voir les forfaits')));
   return;
  }
  const calc=rep.calc;
  // Calcul de charge détaillé : chaque étape s'ouvre pour voir l'explication, les appareils comptés et exclus.
  const stepView=st=>{const g=GUIDE_STEPS[st.id]||{};
   return h('details',{class:'calc-step'},
    h('summary',{},h('b',{text:st.title}),h('span',{class:'badge',text:st.id==='area'?st.value+' m²':kw(st.w)})),
    h('p',{class:'small',text:st.formula}),
    g.plain&&h('p',{class:'why',text:'Pourquoi : '+g.plain}),
    st.items?.length?h('div',{},h('b',{class:'small',text:st.id==='basic'?'Appareils couverts par la charge de base (non additionnés) :':'Appareils comptés :'}),h('ul',{},st.items.map(i=>h('li',{text:`${i.name} — ${kw(i.w)} (${i.where})`})))):null,
    st.itemsNote&&h('p',{class:'small muted',text:st.itemsNote}),
    st.excluded?.length?h('div',{},h('b',{class:'small',text:'Exclu du total :'}),h('ul',{},st.excluded.map(i=>h('li',{text:`${i.name} — ${kw(i.w)}`})))):null,
    h('p',{class:'small muted',text:'Règle : '+st.rule}));};
  const calcCard=h('div',{class:'card side-card'},
   h('div',{class:'row-between'},h('h3',{text:'Calcul de charge du logement (règle 8-200)'}),h('a',{href:'/calcul-de-charge',target:'_blank',class:'small',text:'Comprendre le calcul ↗'})),
   panel.kind!=='Principal'?h('p',{class:'small muted',text:'S’applique au panneau principal d’un logement (les sous-panneaux y sont additionnés).'}):!calc.area?h('p',{class:'small muted'},'Indiquez la superficie (hors sol et sous-sol) dans ',h('a',{href:'#',onclick:e=>{e.preventDefault();go('info');},text:'la fiche du panneau'}),' pour activer ce calcul.'):null,
   ...calc.warnings.map(w=>h('p',{class:'issue warn',text:w})),
   ...calc.steps.map(stepView),
   h('div',{class:'calc-step'},h('div',{class:'row-between'},h('b',{text:'Total'}),h('b',{text:`${kw(calc.totalW)} ÷ 240 V = ${calc.amps} A`}))),
   h('p',{class:'small muted mt',text:`Entrée minimale du Code : ${calc.minService} A · recommandée selon le calcul : ${calc.recommended??'—'} A.`}),
   h('div',{class:'page-actions'},h('button',{type:'button',class:'primary sm',onclick:()=>doc({kind:'calc'})},'📄 Note de calcul PDF')),
   h('p',{class:'small muted',text:GUIDE_DISCLAIMER}));
  const loadRows=rep.rows.filter(x=>x.r.watts||x.c.amps);
  const table=h('div',{class:'card side-card'},h('h3',{text:'Liste de charges par circuit'}),
   h('div',{class:'table-wrap'},h('table',{class:'data'},h('thead',{},h('tr',{},['Pos.','Circuit','Charges','kW','A','Disj.','%','Fil'].map(t=>h('th',{text:t})))),
    h('tbody',{},loadRows.length?loadRows.map(({c,r})=>h('tr',{class:'click',onclick:()=>openCircuit(c.id)},h('td',{text:designation(c)}),h('td',{text:c.label||'—'}),h('td',{class:'small',text:(c.loads||[]).map(l=>(l.qty>1?l.qty+' × ':'')+l.name).join(', ')||'—'}),h('td',{text:r.watts?(r.watts/1000).toLocaleString((globalThis.MP_LOCALE||'fr-CA'),{maximumFractionDigits:2}):'—'}),h('td',{text:r.watts?Number(r.demandAmps).toLocaleString((globalThis.MP_LOCALE||'fr-CA'),{maximumFractionDigits:1}):'—'}),h('td',{text:c.amps?c.amps+' A':'—'}),h('td',{class:r.percent>100?'st-unknown':'',text:r.percent!=null?r.percent+' %':'—'}),h('td',{class:'small',text:c.wire?.gauge||(r.suggestedWire?'≈ '+r.suggestedWire:'—')}))):h('tr',{},h('td',{colspan:8,class:'muted',text:'Touchez un disjoncteur et ajoutez ses charges dans la section « Planification » de la fiche.'}))))));
  const mat=materials(panel);
  const matCard=h('div',{class:'card side-card'},h('h3',{text:'Liste de matériel'}),h('p',{class:'small muted',text:'Famille : '+mat.family+' · numéros de catalogue de la bibliothèque (vérifiez la disponibilité auprès du distributeur).'}),
   mat.items.length?h('table',{class:'data'},h('thead',{},h('tr',{},['Qté','Disjoncteur','Référence'].map(t=>h('th',{text:t})))),h('tbody',{},mat.items.map(i=>h('tr',{},h('td',{text:i.qty}),h('td',{text:`${i.tandem?'Jumelé 2 × ':i.poles===3?'Tripolaire ':i.poles===2?'Bipolaire ':'Unipolaire '}${i.amps} A${i.protection!=='Standard'?' · '+i.protection:''}`}),h('td',{text:i.ref||'—'}))))):h('p',{class:'small muted',text:'Aucun disjoncteur avec calibre.'}));
  const ev=h('details',{class:'card side-card'},h('summary',{},h('b',{text:'Guide des bornes de recharge (niveaux 1, 2 et 3)'})),
   h('div',{class:'table-wrap mt'},h('table',{class:'data ev-guide'},h('thead',{},h('tr',{},['Niveau','Alimentation','Puissance','Disjoncteur','Recharge','Usage'].map(t=>h('th',{text:t})))),h('tbody',{},EV_GUIDE.map(g=>h('tr',{},[g.level,g.supply,g.power,g.breaker,g.range,g.use].map(t=>h('td',{text:t}))))))),
   h('p',{class:'small muted',text:'Une borne est une charge continue (section 86) : disjoncteur ≥ 125 % du courant de la borne, circuit dédié. Un gestionnaire de charge (EVEMS) peut éviter d’augmenter l’entrée électrique.'}),
   h('p',{class:'small muted',text:'Sources : '+LOADS_SOURCES.join(' · ')}));
  body.replaceChildren(
   h('div',{class:'page-actions'},(()=>{const us=breakerUnits(panel.circuits).filter(u=>u.kind!=='other');const done=us.filter(u=>u.ref).length;
     return h('button',{type:'button',class:'primary',onclick:openAssign},`🔧 Attribuer les modèles (${done}/${us.length})`);})(),
    h('button',{type:'button',onclick:()=>doc({kind:'loads'})},'📄 PDF bilan de charges et matériel'),h('button',{type:'button',onclick:()=>go('info')},rep.model?'Changer de modèle':'Choisir un modèle du catalogue')),
   h('p',{class:'small muted',text:'Choisissez un disjoncteur dans la bibliothèque, puis touchez une position en surbrillance pour le placer. Touchez un disjoncteur installé pour décrire ses charges.'}),
   h('div',{class:'workspace mt plan-workspace'},cabBox,h('div',{class:'stack'},palette,gauge,issues,sugg)),
   h('div',{class:'stack mt'},table,calcCard,matCard,ev));
 }

 renderHead();renderTabs();renderBody();
 if(gotoCircuit)setTimeout(()=>openCircuit(gotoCircuit),0);
 // Lien direct vers les électroménagers : le projet passe à l'étape Vérification.
 return root;
}
