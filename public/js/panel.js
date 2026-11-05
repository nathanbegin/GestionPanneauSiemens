// Vue d'un panneau : face avant, nomenclature, documents et fiche.
import {h,toast,confirmDialog,fmtRelative} from './dom.js';
import {api,openDocument} from './api.js';
import {designation,sortCircuits,stats,fold,searchable,allTags,tagGroups,slotPos,slotOrder,panelTitle,siteAddress,states} from '../model.js';
import {circuitEditor,panelFields,panelPayload} from './forms.js';

const statusClass=c=>c.status==='Identifié'?'identified':c.status==='Libre'?'free':'unknown';
const tabNames={panel:'▦ Panneau',list:'☷ Nomenclature',docs:'📄 Documents et étiquettes',info:'⚙ Fiche du panneau'};

export async function panelView({id,tab='panel',ctx}){
 const data=await api('/api/panels?id='+encodeURIComponent(id));
 let {panel,site,siblings}=data;
 let saving=Promise.resolve();
 const state={tab:tabNames[tab]?tab:'panel',q:'',status:'',tag:''};
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
  const editor=circuitEditor({panel,id:cid,order,onSave:async circuits=>{
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
  for(const c of panel.circuits){
   const start=c.slots[0],n=slotPos(start),side=n%2===0?2:1;
   const linked=c.slots.length>2;
   const b=h('button',{type:'button',class:`breaker ${statusClass(c)}${side===2?' even':''}${linked?' linked':''}${filtering?(match(c)?' match':' dimmed'):''}`,'aria-label':`${designation(c)} : ${c.label||'à identifier'}, ${c.amps??'?'} A`,onclick:()=>openCircuit(c.id)},
    h('span',{class:'num',text:designation(c)}),h('span',{class:'lever',text:c.amps??'?'}),h('span',{class:'short',text:c.status==='Libre'?'Libre':c.label||'—'}),h('i',{class:'dot'}));
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
  }else if(state.tab==='docs')renderDocs();
  else renderInfo();
 }

 function renderDocs(){
  const fmt=()=>h('select',{'aria-label':'Format du papier'},new Option('Lettre 8½ × 11','letter'),new Option('Légal 8½ × 14','legal'));
  const f1=fmt(),f2=fmt();
  const skip=h('input',{type:'checkbox'});
  const cards=[
   h('article',{class:'card doc-card'},h('div',{class:'ico',text:'🗒'}),h('h3',{text:'Aide-mémoire de porte'}),h('p',{text:'Une page : tous les circuits en deux colonnes, comme sur le panneau. À fixer à l’intérieur de la porte.'}),h('div',{class:'opts'},f1),h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'door',format:f1.value})},'Générer le PDF')),
   h('article',{class:'card doc-card'},h('div',{class:'ico',text:'📘'}),h('h3',{text:'Rapport complet'}),h('p',{text:'Informations du site et du panneau, répertoire, tableau détaillé avec notes et exceptions, préparé par et signature.'}),h('div',{class:'opts'},f2),h('button',{type:'button',class:'primary',onclick:()=>doc({kind:'report',format:f2.value})},'Générer le PDF')),
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
  const form=h('form',{class:'card form-card',novalidate:true},...panelFields(panel,siblings),e,
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

 renderHead();renderTabs();renderBody();
 return root;
}
