// Vue d'un panneau : face avant, nomenclature, documents et fiche.
import {h,toast,confirmDialog,fmtRelative,dialog} from './dom.js';
import {api,openDocument,NATIVE,webUrl} from './api.js';
import {qrMatrix,qrSvg,panelLink,qrAllowed} from '../qr.js';
import {designation,sortCircuits,stats,fold,searchable,allTags,tagGroups,slotPos,slotOrder,panelTitle,siteAddress,states} from '../model.js';
import {circuitEditor,panelFields,panelPayload} from './forms.js';
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

const statusClass=c=>c.vacant?'free vacant':c.status==='Identifié'?'identified':c.status==='Libre'?'free':'unknown';
const shortText=c=>c.vacant?'Espace inutilisé':c.status==='Libre'?'Libre':c.label||'';
const tabNames={panel:'▦ Panneau',list:'☷ Nomenclature',plan:'⚡ Planification et charges',docs:'📄 Documents et étiquettes',info:'⚙ Fiche du panneau'};

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
 const state={tab:tabNames[tab]?tab:'panel',q:'',status:'',tag:'',place:null,select:null};
 // Vue du panneau : schéma (par défaut) ou réaliste ; préférence gardée sur l'appareil.
 const pref=k=>{try{return localStorage.getItem(k);}catch{return null;}};
 const setPref=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
 state.view=pref('mp_panel_view')==='reel'?'reel':'schema';
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
   saveState.textContent='Enregistrement…';
   try{
    const out=await api('/api/panels?id='+panel.id,{method:'PUT',body:{revision:panel.revision,...update}});
    panel=out.panel;saveState.textContent='✓ Enregistré';
    return panel;
   }catch(e){
    saveState.textContent='⚠ Non enregistré';
    if(e.status===409){toast(e.message,8000);}
    throw e;
   }
  });
  saving=run.catch(()=>{});
  return run;
 }

 // Code QR : ouvre ce panneau dans l'application (connexion requise).
 function qrDialog(){
  const url=panelLink(NATIVE?webUrl(''):location.origin,panel.id);
  const svgText=qrSvg(url);
  const node=new DOMParser().parseFromString(svgText,'image/svg+xml').documentElement;node.setAttribute('class','qr-svg');
  const save=(blob,name)=>{const a=h('a',{href:URL.createObjectURL(blob),download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);};
  const fname='qr-'+(panel.tag||panel.name).normalize('NFD').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'');
  const png=()=>{const m=qrMatrix(url),n=m.length,s=12,q=4,W=(n+2*q)*s,cv=document.createElement('canvas');cv.width=cv.height=W;const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,W);g.fillStyle='#000';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(m[r][c])g.fillRect((c+q)*s,(r+q)*s,s,s);cv.toBlob(b=>b&&save(b,fname+'.png'));};
  const print=()=>{const box=h('div',{id:'qrPrint'},h('h2',{text:panelTitle(panel)}),node.cloneNode(true),h('p',{text:'Scannez pour ouvrir ce panneau dans Mon Panneau (connexion requise).'}),h('p',{class:'small',text:url}));document.body.append(box);window.print();setTimeout(()=>box.remove(),500);};
  const copy=async()=>{try{await navigator.clipboard.writeText(url);toast('Lien copié.');}catch{toast(url,8000);}};
  dialog({title:'Code QR · '+panelTitle(panel),eyebrow:'Ouvre ce panneau dans l’application',body:[h('div',{class:'qr-box'},node),h('p',{class:'small muted',text:'Collez-le sur la porte du panneau. Le lien ouvre ce panneau seulement pour les personnes connectées à un compte qui y a accès (vous, votre équipe, ou les personnes avec qui il est partagé).'}),h('input',{class:'qr-url',readOnly:true,value:url,'aria-label':'Lien du code QR',onfocus:e=>e.target.select()}),h('div',{class:'page-actions'},h('button',{type:'button',onclick:copy},'Copier le lien'),h('button',{type:'button',onclick:()=>save(new Blob([svgText],{type:'image/svg+xml'}),fname+'.svg')},'Télécharger SVG'),h('button',{type:'button',onclick:png},'Télécharger PNG'),h('button',{type:'button',class:'primary',onclick:print},'Imprimer'))],actions:[{label:'Fermer',kind:'ghost'}]});
 }
 // Garnir le panneau existant avec des photos analysées par l'IA.
 const garnir=()=>aiImportDialog({site,siblings,target:panel,onApplied:p=>{panel=p;renderHead();renderBody();}});
 function renderHead(){
  const s=stats(panel.circuits),det=panel.details||{};
  const fed=siblings.find(x=>x.id===det.fedFrom);
  const ro=data.access==='view'?h('p',{class:'notice info',text:`Panneau partagé en lecture seule par ${data.sharedBy} : vous pouvez le consulter et générer ses documents, mais pas le modifier.`}):null;
  const empty=data.access!=='view'&&!panel.circuits.some(c=>c.label||c.amps!=null||c.vacant);
  head.replaceChildren(ro||'',empty?h('div',{class:'notice info'},h('b',{text:'Panneau vide. '}),'Prenez en photo le panneau ouvert (et son répertoire) : l’IA lit les disjoncteurs et garnit ce panneau pour vous. ',h('button',{type:'button',class:'primary sm',onclick:garnir},'📷 Garnir par photos (IA)')):'',h('div',{class:'page-head'},
   h('div',{},
    h('div',{class:'panel-hero'},panel.tag&&h('span',{class:'badge tag',text:panel.tag}),h('h1',{text:panel.name})),
    h('div',{class:'sub'},[panel.kind,panel.location||'Emplacement à préciser',det.building].filter(Boolean).join(' · ')),
    h('div',{class:'progress-line'},h('div',{class:'progress','aria-hidden':'true'},h('i',{style:{width:s.progress+'%'}})),h('span',{text:`${s.identified} identifiés · ${s.free} libres · ${s.toConfirm} à confirmer`})),
    fed&&h('div',{class:'sub small'},'Alimenté par ',h('a',{href:'#/panneaux/'+fed.id,text:panelTitle(fed)}),det.fedFromCircuit?` (circuit ${det.fedFromCircuit})`:'')),
   h('div',{class:'page-actions'},saveState,
    data.access&&data.access!=='owner'?h('span',{class:'badge shared',text:`👥 Partagé par ${data.sharedBy} · ${data.access==='edit'?'modification':'lecture seule'}`}):h('button',{type:'button',onclick:()=>shareDialog({panelId:panel.id,title:panelTitle(panel)})},'👥 Partager'),
    data.access!=='view'&&h('button',{type:'button',onclick:garnir},'📷 Garnir par photos (IA)'),
    qr&&h('button',{type:'button',onclick:qrDialog},'▦ Code QR'),
    h('button',{type:'button',onclick:()=>doc({kind:'door'})},'📄 Aide-mémoire PDF'),
    h('button',{type:'button',class:'primary',onclick:()=>go('docs')},'Rapports et étiquettes'))));
 }
 function renderTabs(){
  tabs.replaceChildren(...Object.entries(tabNames).map(([k,label])=>h('button',{type:'button',role:'tab','aria-selected':String(state.tab===k),onclick:()=>go(k)},label)));
 }
 function go(t){state.tab=t;history.replaceState(null,'',`#/panneaux/${panel.id}/${t}`);renderTabs();renderBody();}
 const doc=async params=>{try{toast('Génération du PDF…');await openDocument({panel:panel.id,...params});}catch(e){toast(e.message);}};

 function filtered(){
  const q=fold(state.q);
  return c=>(!state.status||c.status===state.status||(state.status==='À confirmer'&&c.status==='Non visible'))&&(!q||searchable(c).includes(q))&&(!state.tag||allTags(c).includes(state.tag));
 }
 function openCircuit(cid){
  if(state.select){state.select.has(cid)?state.select.delete(cid):state.select.add(cid);renderBody();return;}
  const order=sortCircuits(panel.circuits).map(c=>c.id);
  const editor=circuitEditor({panel,id:cid,order,planning,lib,feeds:{siblings,createSubpanel,onChange:()=>{renderBody();}},onSave:async circuits=>{
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
 function circuitList(container){
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
   h('div',{class:'real-wrap'},sized(panelReal({panel,crop:state.rzoom==='circuits',labels:state.realLabels,match:filtering?filtered():null,selected:state.select,onCircuit:openCircuit}))),
   h('p',{class:'panel-tip',text:state.select?'Touchez les disjoncteurs à inclure dans la sélection.':'Touchez un disjoncteur pour ouvrir sa fiche. DDFT : bouton TEST blanc et fil témoin ; anti-arc : bouton TEST bleu.'}));
 }
 function cabinet(){
  if(state.tab==='panel'&&state.view==='reel')return realCabinet();
  const det=panel.details||{};
  const grid=h('div',{class:'breakers'});
  grid.style.gridTemplateRows=`repeat(${panel.positions},16px)`;
  const match=filtered(),filtering=!!(state.q||state.status||state.tag);
  const showLoads=planning&&state.tab==='plan';
  for(const c of panel.circuits){
   const start=c.slots[0],n=slotPos(start),side=n%2===0?2:1;
   const linked=c.slots.length>2;
   const b=h('button',{type:'button',class:`breaker ${statusClass(c)}${side===2?' even':''}${linked?' linked':''}${filtering?(match(c)?' match':' dimmed'):''}${state.select?.has(c.id)?' selected':''}`,'aria-label':`${designation(c)} : ${c.label||'à identifier'}, ${c.amps??'?'} A`,onclick:()=>openCircuit(c.id)},
    h('span',{class:'num',text:designation(c)}),h('span',{class:'lever',text:c.amps??'?'}),h('span',{class:'short',text:shortText(c)||'—'}),h('i',{class:'dot'}));
   if(showLoads){
    // Phase et taux de charge du circuit.
    const r=circuitLoad(c);
    const leg=r.volts===240?'L1+L2':legOf(n);
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
   refresh();
  }else if(state.tab==='list'){
   const listBox=h('div',{class:'circuit-list'});
   body.replaceChildren(h('div',{class:'list-wide'},bulkBar(),filters(()=>circuitList(listBox)),listBox,legend()));
   circuitList(listBox);
  }else if(state.tab==='plan')renderPlan();
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
   planning&&h('article',{class:'card doc-card'},h('div',{class:'ico',text:'🧮'}),h('h3',{text:'Note de calcul de charge'}),h('p',{text:'Calcul de l’entrée électrique étape par étape, en langage clair, avec les règles du Code, les appareils comptés et exclus, et le verdict sur le principal installé.'}),h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'calc'})},'Générer le PDF')),
   planning&&h('article',{class:'card doc-card'},h('div',{class:'ico',text:'⚡'}),h('h3',{text:'Bilan de charges et matériel'}),h('p',{text:'Liste de charges par circuit, phases L1/L2, capacité du panneau, calcul selon la règle 8-200, alertes et liste de disjoncteurs.'}),h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'loads'})},'Générer le PDF')),
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
  const data={schema:3,app:'Mon Panneau',exportedAt:new Date().toISOString(),panel:panel.name,tag:panel.tag,kind:panel.kind,location:panel.location,positions:panel.positions,details:panel.details,site:{name:site.name,address:siteAddress(site)},circuits:panel.circuits};
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
  body.replaceChildren(form,h('p',{class:'small muted mt',text:`Créé le ${new Date(panel.createdAt).toLocaleDateString('fr-CA')} · modifié ${fmtRelative(panel.updatedAt)} · révision ${panel.revision}`}));
 }
 async function remove(){
  if(!await confirmDialog(`Supprimer définitivement « ${panelTitle(panel)} » et ses ${panel.circuits.length} circuits ? Cette action est irréversible.`,{title:'Supprimer le panneau',confirm:'Supprimer',danger:true}))return;
  try{await api('/api/panels?id='+panel.id,{method:'DELETE'});toast('Panneau supprimé.');location.hash='#/sites/'+site.id;}catch(e){toast(e.message);}
 }

 // Création d'un sous-panneau pré-relié à un circuit de ce panneau (sans quitter la page).
 function createSubpanel(initial){
  return new Promise(resolve=>{
   panelDialog({siblings,library:planning,initial,title:'Nouveau sous-panneau',eyebrow:`Alimenté par ${panelTitle(panel)} · circuit ${initial.details?.fedFromCircuit||''}`,
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
  const statusText={ok:'Bonne marge',medium:'Marge correcte',high:'Au-delà de 80 %',over:'Surcharge',unknown:'À compléter'}[rep.status];
  const kw=w=>(w/1000).toLocaleString('fr-CA',{maximumFractionDigits:1})+' kW';
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
   h('p',{class:'small muted mt',text:`Charge branchée : ${kw(rep.connectedW)}${children.length?` (dont ${children.length} sous-panneau(x))`:''} · ${rep.free} position(s) libre(s)${rep.remainingAmps!=null?` · marge avant 80 % : ${rep.remainingAmps} A`:''}`}),
   rep.model&&h('p',{class:'small muted',text:`Modèle : ${rep.model.id} — ${rep.model.label}`}),
   h('div',{class:'legs mt'},h('div',{class:'leg'},h('span',{class:'small muted',text:'Phase L1'}),h('b',{text:rep.balance.L1+' A'})),h('div',{class:'leg'},h('span',{class:'small muted',text:'Phase L2'}),h('b',{text:rep.balance.L2+' A'}))),
   h('p',{class:'small muted',text:`Déséquilibre : ${rep.balance.imbalance} %`}));
  const issues=h('div',{class:'card side-card'},h('h3',{text:`Alertes (${rep.issues.length})`}),rep.issues.length?rep.issues.map(i=>h('p',{class:'issue '+i.level,text:(i.circuit?`Circuit ${i.circuit} : `:'')+i.text})):h('p',{class:'issue info',text:'Aucune alerte. Ajoutez les charges de chaque circuit pour un bilan complet.'}));
  const sugg=h('div',{class:'card side-card'},h('h3',{text:'Suggestions'}),h('ul',{class:'small'},suggestions(rep).map(t=>h('li',{text:t}))));
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
    h('tbody',{},loadRows.length?loadRows.map(({c,r})=>h('tr',{class:'click',onclick:()=>openCircuit(c.id)},h('td',{text:designation(c)}),h('td',{text:c.label||'—'}),h('td',{class:'small',text:(c.loads||[]).map(l=>(l.qty>1?l.qty+' × ':'')+l.name).join(', ')||'—'}),h('td',{text:r.watts?(r.watts/1000).toLocaleString('fr-CA',{maximumFractionDigits:2}):'—'}),h('td',{text:r.watts?r.demandAmps:'—'}),h('td',{text:c.amps?c.amps+' A':'—'}),h('td',{class:r.percent>100?'st-unknown':'',text:r.percent!=null?r.percent+' %':'—'}),h('td',{class:'small',text:c.wire?.gauge||(r.suggestedWire?'≈ '+r.suggestedWire:'—')}))):h('tr',{},h('td',{colspan:8,class:'muted',text:'Touchez un disjoncteur et ajoutez ses charges dans la section « Planification » de la fiche.'}))))));
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
 return root;
}
