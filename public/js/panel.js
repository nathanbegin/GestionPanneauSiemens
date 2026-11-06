// Vue d'un panneau : face avant, nomenclature, documents et fiche.
import {h,toast,confirmDialog,fmtRelative} from './dom.js';
import {api,openDocument} from './api.js';
import {designation,sortCircuits,stats,fold,searchable,allTags,tagGroups,slotPos,slotOrder,panelTitle,siteAddress,states} from '../model.js';
import {circuitEditor,panelFields,panelPayload} from './forms.js';
import {panelReport,suggestions,materials,circuitLoad,legOf} from '../loadcalc.js';
import {EV_GUIDE,LOADS_SOURCES,familyOf} from '../catalog.js';
import {panelArt,isEmptySlot} from './panelart.js';
import {loadLibrary,breakerPalette,validStarts,compatibility} from './library.js';
import {placeBreaker} from '../model.js';

const statusClass=c=>c.status==='Identifié'?'identified':c.status==='Libre'?'free':'unknown';
const tabNames={panel:'▦ Panneau',list:'☷ Nomenclature',plan:'⚡ Planification et charges',docs:'📄 Documents et étiquettes',info:'⚙ Fiche du panneau'};

export async function panelView({id,tab='panel',ctx}){
 const [data,ent]=await Promise.all([api('/api/panels?id='+encodeURIComponent(id)),api('/api/billing').catch(()=>null)]);
 let {panel,site,siblings,children=[]}=data;
 // Planification : forfaits Électricien (et administrateurs).
 const planning=!!(ent?.plan?.features?.planning||ctx.user?.isAdmin);
 // Bibliothèque de produits (abonnés seulement).
 const lib=planning?await loadLibrary().catch(()=>null):null;
 let saving=Promise.resolve();
 const state={tab:tabNames[tab]?tab:'panel',q:'',status:'',tag:'',place:null};
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

 function renderHead(){
  const s=stats(panel.circuits),det=panel.details||{};
  const fed=siblings.find(x=>x.id===det.fedFrom);
  head.replaceChildren(h('div',{class:'page-head'},
   h('div',{},
    h('div',{class:'panel-hero'},panel.tag&&h('span',{class:'badge tag',text:panel.tag}),h('h1',{text:panel.name})),
    h('div',{class:'sub'},[panel.kind,panel.location||'Emplacement à préciser',det.building].filter(Boolean).join(' · ')),
    h('div',{class:'progress-line'},h('div',{class:'progress','aria-hidden':'true'},h('i',{style:{width:s.progress+'%'}})),h('span',{text:`${s.identified} identifiés · ${s.free} libres · ${s.toConfirm} à confirmer`})),
    fed&&h('div',{class:'sub small'},'Alimenté par ',h('a',{href:'#/panneaux/'+fed.id,text:panelTitle(fed)}),det.fedFromCircuit?` (circuit ${det.fedFromCircuit})`:'')),
   h('div',{class:'page-actions'},saveState,
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
  const order=sortCircuits(panel.circuits).map(c=>c.id);
  const editor=circuitEditor({panel,id:cid,order,planning,lib,onSave:async circuits=>{
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
   return h('button',{type:'button',class:'circuit-card card '+statusClass(c),onclick:()=>openCircuit(c.id)},
    h('span',{class:'pos',text:designation(c)}),
    h('span',{class:'txt'},h('strong',{text:c.status==='Libre'?'Libre':c.label||'À identifier — touchez pour décrire'}),h('small',{text:[c.room,c.usage!=='Autre'?c.usage:'',c.protection].filter(Boolean).join(' · ')||'—'}),c.exceptions&&h('span',{class:'ex',text:'⚠ '+c.exceptions})),
    meta);
  }):[h('p',{class:'empty-state muted',text:'Aucun circuit ne correspond à la recherche.'})]));
 }
 function cabinet(){
  const det=panel.details||{};
  const grid=h('div',{class:'breakers'});
  grid.style.gridTemplateRows=`repeat(${panel.positions},16px)`;
  const match=filtered(),filtering=!!(state.q||state.status||state.tag);
  const showLoads=planning&&state.tab==='plan';
  for(const c of panel.circuits){
   const start=c.slots[0],n=slotPos(start),side=n%2===0?2:1;
   const linked=c.slots.length>2;
   const b=h('button',{type:'button',class:`breaker ${statusClass(c)}${side===2?' even':''}${linked?' linked':''}${filtering?(match(c)?' match':' dimmed'):''}`,'aria-label':`${designation(c)} : ${c.label||'à identifier'}, ${c.amps??'?'} A`,onclick:()=>openCircuit(c.id)},
    h('span',{class:'num',text:designation(c)}),h('span',{class:'lever',text:c.amps??'?'}),h('span',{class:'short',text:c.status==='Libre'?'Libre':c.label||'—'}),h('i',{class:'dot'}));
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
   h('div',{class:'panel-caption'},h('span',{text:'VUE DE FACE'}),h('span',{text:`1 — ${panel.positions}`})),
   h('div',{class:'cabinet'},
    h('div',{class:'manufacturer'},h('b',{text:det.brand||'Panneau'}),h('span',{text:[det.model,panel.tag].filter(Boolean).join(' · ')||panel.kind})),
    h('div',{class:'main-breaker'},h('span',{text:'PRINCIPAL'}),h('div',{class:'main-switch'},h('b',{text:det.mainAmps||'—'}),h('span',{text:'A'}))),
    h('div',{class:'rail-labels'},h('span',{text:'IMPAIRS'}),h('span',{text:'PAIRS'})),
    grid,
    h('div',{class:'panel-foot'},h('span',{text:(det.voltage||'').toUpperCase()}),h('span',{text:panel.positions+' POSITIONS'}))),
   h('p',{class:'panel-tip',text:'Touchez un disjoncteur pour ouvrir sa fiche.'}));
 }
 const legend=()=>h('div',{class:'legend'},h('span',{},h('i',{style:{background:'#659972'}}),'Identifié'),h('span',{},h('i',{style:{background:'#c6a66f'}}),'À confirmer'),h('span',{},h('i',{style:{background:'#adb5a8'}}),'Libre'));

 function renderBody(){
  if(state.tab==='panel'){
   const listBox=h('div',{class:'circuit-list'});
   const cabBox=h('div');
   const refresh=()=>{cabBox.replaceChildren(cabinet());circuitList(listBox);};
   body.replaceChildren(h('div',{class:'workspace'},cabBox,h('section',{'aria-label':'Liste des circuits'},filters(refresh),listBox,legend())));
   refresh();
  }else if(state.tab==='list'){
   const listBox=h('div',{class:'circuit-list'});
   body.replaceChildren(h('div',{class:'list-wide'},filters(()=>circuitList(listBox)),listBox,legend()));
   circuitList(listBox);
  }else if(state.tab==='plan')renderPlan();
  else if(state.tab==='docs')renderDocs();
  else renderInfo();
 }

 function renderDocs(){
  const fmt=()=>h('select',{'aria-label':'Format du papier'},new Option('Lettre 8½ × 11','letter'),new Option('Légal 8½ × 14','legal'));
  const f1=fmt(),f2=fmt();
  const skip=h('input',{type:'checkbox'});
  const cards=[
   h('article',{class:'card doc-card'},h('div',{class:'ico',text:'🗒'}),h('h3',{text:'Aide-mémoire de porte'}),h('p',{text:'Une page : tous les circuits en deux colonnes, comme sur le panneau. À fixer à l’intérieur de la porte.'}),h('div',{class:'opts'},f1),h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'door',format:f1.value})},'Générer le PDF')),
   h('article',{class:'card doc-card'},h('div',{class:'ico',text:'📘'}),h('h3',{text:'Rapport complet'}),h('p',{text:'Informations du site et du panneau, répertoire, tableau détaillé avec notes et exceptions, préparé par et signature.'}),h('div',{class:'opts'},f2),h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'report',format:f2.value})},'Générer le PDF')),
   planning&&h('article',{class:'card doc-card'},h('div',{class:'ico',text:'⚡'}),h('h3',{text:'Bilan de charges et matériel'}),h('p',{text:'Liste de charges par circuit, phases L1/L2, capacité du panneau, calcul selon la règle 8-200, alertes et liste de disjoncteurs.'}),h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'loads'})},'Générer le PDF')),
   h('article',{class:'card doc-card'},h('div',{class:'ico',text:'🏷'}),h('h3',{text:'Étiquettes autocollantes'}),h('p',{text:'Feuille Lettre Avery 5160 / 8160 (30 étiquettes 2⅝ × 1 po) : repère du panneau puis un circuit par étiquette. Imprimez à 100 %.'}),h('label',{class:'opts'},skip,'Ignorer les positions libres'),h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'labels',skipFree:skip.checked})},'Générer les étiquettes')),
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

 // ---------- Onglet Planification ----------
 function renderPlan(){
  const rep=panelReport(panel,{children});
  const statusText={ok:'Bonne marge',medium:'Marge correcte',high:'Au-delà de 80 %',over:'Surcharge',unknown:'À compléter'}[rep.status];
  const kw=w=>(w/1000).toLocaleString('fr-CA',{maximumFractionDigits:1})+' kW';
  // Panneau réaliste + placement depuis la palette.
  const free=c=>isEmptySlot(c)||(c.status==='Libre'&&!c.label&&!c.notes);
  const targets=state.place?validStarts(panel,state.place,free):null;
  const art=panelArt({panel,breakersByCat:lib?.byCat||new Map(),highlight:targets,
   onCircuit:id=>{if(state.place)return toast('Touchez une position en surbrillance pour placer le disjoncteur, ou terminez le placement.');openCircuit(id);},
   onPosition:async pos=>{
    try{const circuits=placeBreaker(panel.circuits,pos,{...state.place,cat:state.place.cat},panel.positions);await persist({circuits});toast(`${state.place.cat} placé en position ${pos}.`);renderHead();renderBody();}
    catch(e){toast(e.message,7000);}
   }});
  const banner=state.place&&h('div',{class:'place-banner'},h('span',{},'Placement : ',h('b',{text:state.place.cat}),` · ${state.place.label} — ${targets.size?'touchez une position en surbrillance.':'aucun espace libre suffisant.'}`),h('button',{type:'button',class:'sm',onclick:()=>{state.place=null;renderBody();}},'Terminer'));
  const cabBox=h('div',{class:'stack'},banner,art);
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
  const calcCard=h('div',{class:'card side-card'},h('h3',{text:'Calcul de charge du logement (règle 8-200)'}),
   panel.kind!=='Principal'?h('p',{class:'small muted',text:'S’applique au panneau principal d’un logement.'}):!panel.details?.livingArea?h('p',{class:'small muted'},'Indiquez la superficie habitable dans ',h('a',{href:'#',onclick:e=>{e.preventDefault();go('info');},text:'la fiche du panneau'}),' pour activer ce calcul.'):null,
   h('div',{class:'table-wrap'},h('table',{class:'data'},h('tbody',{},calc.lines.map(l=>h('tr',{},h('td',{text:l.label}),h('td',{text:kw(l.w)}))),h('tr',{},h('td',{},h('b',{text:'Charge calculée'})),h('td',{},h('b',{text:`${kw(calc.totalW)} · ${calc.amps} A`})))))),
   h('p',{class:'small muted mt',text:`Entrée minimale : ${calc.minService} A · recommandée selon le calcul : ${calc.recommended??'—'} A. Calcul simplifié inspiré du CCÉ : à valider par un maître électricien.`}));
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
   h('div',{class:'page-actions'},h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'loads'})},'📄 PDF bilan de charges et matériel'),h('button',{type:'button',onclick:()=>go('info')},rep.model?'Changer de modèle':'Choisir un modèle du catalogue')),
   h('p',{class:'small muted',text:'Choisissez un disjoncteur dans la bibliothèque, puis touchez une position en surbrillance pour le placer. Touchez un disjoncteur installé pour décrire ses charges.'}),
   h('div',{class:'workspace mt plan-workspace'},cabBox,h('div',{class:'stack'},palette,gauge,issues,sugg)),
   h('div',{class:'stack mt'},table,calcCard,matCard,ev));
 }

 renderHead();renderTabs();renderBody();
 return root;
}
