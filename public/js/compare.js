// Comparaison de deux panneaux côte à côte (forfaits Électricien) : fiche, statistiques, charges et circuit par circuit.
import {h,select,toast} from './dom.js';
import {api} from './api.js';
import {designation,sortCircuits,slotOrder,panelTitle,formatOf,stats,isLinkedPair} from '../model.js';
import {panelReport} from '../loadcalc.js';

const occupied=c=>!!c&&!c.vacant&&(!!c.label||c.amps!=null);
const norm=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

/** Chiffres de comparaison d'un panneau. */
export function summarize(panel,site){
 const det=panel.details||{},cs=panel.circuits||[],used=cs.filter(occupied);
 const st=stats(cs);
 let rep=null;try{rep=panelReport(panel);}catch{}
 return {
  site:site?.name||'—',kind:panel.kind||'—',brand:[det.brand,det.model].filter(Boolean).join(' ')||'—',
  mainAmps:Number(det.mainAmps)||null,voltage:det.voltage||'—',positions:panel.positions,
  used:used.length,identified:st.identified,toConfirm:st.toConfirm,free:st.free,progress:st.progress,
  sumAmps:used.reduce((s,c)=>s+(c.amps||0),0),
  bipolar:used.filter(c=>formatOf(c)==='double').length,tandem:used.filter(c=>c.slots.length===1).length,
  gfci:used.filter(c=>/DDFT/.test(c.protection||'')).length,afci:used.filter(c=>/anti-arc/i.test(c.protection||'')).length,
  designAmps:rep?.designAmps??null,percent:rep?.percent??null,issues:rep?.issues?.length??null,
 };
}
const SUMMARY_ROWS=[
 ['Site','site'],['Type','kind'],['Marque · modèle','brand'],['Principal','mainAmps',v=>v?v+' A':'—'],['Tension','voltage'],['Positions','positions'],
 ['Circuits utilisés','used'],['Identifiés','identified'],['À confirmer','toConfirm'],['Libres','free'],['Avancement','progress',v=>v+' %'],
 ['Somme des calibres','sumAmps',v=>v+' A'],['Bipolaires','bipolar'],['Jumelés (demi-positions)','tandem'],['DDFT','gfci'],['Anti-arc','afci'],
 ['Charge de calcul','designAmps',v=>v==null?'—':v+' A'],['% du principal','percent',v=>v==null?'—':v+' %'],['Alertes de calcul','issues',v=>v==null?'—':String(v)],
];
const delta=(a,b)=>typeof a==='number'&&typeof b==='number'&&a!==b?` (${b-a>0?'+':''}${Math.round((b-a)*10)/10})`:'';

/** Alignement circuit par circuit sur le premier emplacement de chaque disjoncteur. */
export function diffCircuits(pa,pb){
 const start=list=>new Map(sortCircuits(list).filter(occupied).map(c=>[c.slots[0],c]));
 const A=start(pa.circuits),B=start(pb.circuits);
 const keys=[...new Set([...A.keys(),...B.keys()])].sort((x,y)=>slotOrder(x)-slotOrder(y));
 return keys.map(k=>{
  const a=A.get(k),b=B.get(k);
  let state='same';
  if(a&&!b)state='onlyA';else if(!a&&b)state='onlyB';
  else if(a.slots.join()!==b.slots.join()||a.amps!==b.amps||norm(a.label)!==norm(b.label)||(a.protection||'Standard')!==(b.protection||'Standard'))state='diff';
  return {key:k,a,b,state};
 });
}
const cell=c=>c?h('div',{class:'cmp-cell'},h('b',{text:c.label||'Sans désignation'}),h('small',{text:[c.amps?c.amps+' A':'? A',formatOf(c)==='double'?'bipolaire':c.slots.length===1?'jumelé':'',c.protection&&c.protection!=='Standard'?c.protection:'',isLinkedPair(c)?c.slots.join(' + '):''].filter(Boolean).join(' · ')})):h('span',{class:'muted',text:'—'});
const STATE_TXT={same:'Identique',diff:'Différent',onlyA:'Seulement A',onlyB:'Seulement B'};

export async function compareView({ctx,a='',b=''}){
 ctx.crumbs([['Mes sites','#/sites'],['Comparer des panneaux']]);
 const ent=await api('/api/billing').catch(()=>null);
 const pro=!!(ent?.plan?.features?.planning||ctx.user?.isAdmin);
 const head=h('div',{class:'page-head'},h('div',{},h('div',{class:'eyebrow',text:'Outil professionnel'}),h('h1',{text:'Comparer des panneaux'}),h('div',{class:'sub',text:'Deux panneaux côte à côte : caractéristiques, charges et circuit par circuit.'})));
 if(!pro)return h('div',{class:'container'},head,h('div',{class:'card empty-state'},h('div',{class:'ico',text:'⇄'}),h('h2',{text:'Réservé aux forfaits Électricien'}),h('p',{text:'La comparaison de panneaux est incluse dans les forfaits Électricien Solo et Équipe, avec la planification et les rapports à votre image.'}),h('a',{class:'btn primary',href:'#/abonnement',text:'Voir les forfaits'})));
 const {sites}=await api('/api/sites');
 const opts=[['','— Choisir un panneau —'],...sites.flatMap(s=>s.panels.map(p=>[p.id,`${s.name} — ${panelTitle(p)}`]))];
 const selA=select('a',opts,a),selB=select('b',opts,b);
 const go=()=>{location.hash=`#/comparer/${selA.value}/${selB.value}`;};
 selA.onchange=go;selB.onchange=go;
 const pickers=h('div',{class:'card cmp-pick'},h('label',{class:'f'},h('span',{text:'Panneau A'}),selA),h('button',{type:'button',class:'ghost',title:'Inverser A et B','aria-label':'Inverser A et B',onclick:()=>{location.hash=`#/comparer/${selB.value}/${selA.value}`;}},'⇄'),h('label',{class:'f'},h('span',{text:'Panneau B'}),selB));
 if(!a||!b||a===b)return h('div',{class:'container'},head,pickers,h('div',{class:'card empty-state'},h('p',{text:a&&a===b?'Choisissez deux panneaux différents.':'Choisissez deux panneaux (de n’importe lequel de vos sites) pour les comparer.'})));
 let da,db;
 try{[da,db]=await Promise.all([api('/api/panels?id='+encodeURIComponent(a)),api('/api/panels?id='+encodeURIComponent(b))]);}
 catch(e){toast(e.message);return h('div',{class:'container'},head,pickers,h('div',{class:'card empty-state'},h('p',{class:'error',text:e.message})));}
 const sa=summarize(da.panel,da.site),sb=summarize(db.panel,db.site);
 const rows=diffCircuits(da.panel,db.panel);
 const counts=rows.reduce((m,r)=>(m[r.state]=(m[r.state]||0)+1,m),{});
 let onlyDiff=false;
 const body=h('tbody');
 const draw=()=>body.replaceChildren(...rows.filter(r=>!onlyDiff||r.state!=='same').map(r=>h('tr',{class:'cmp-'+r.state},
  h('td',{text:r.a&&r.b&&r.a.slots.join()!==r.b.slots.join()?`${designation(r.a)} / ${designation(r.b)}`:designation(r.a||r.b)}),h('td',{},cell(r.a)),h('td',{},cell(r.b)),h('td',{},h('span',{class:'badge '+(r.state==='same'?'ok':'warn'),text:STATE_TXT[r.state]})))));
 draw();
 const filter=h('label',{class:'check small'},h('input',{type:'checkbox',onchange:e=>{onlyDiff=e.target.checked;draw();}}),' Différences seulement');
 const summary=h('table',{class:'cmp-table'},h('thead',{},h('tr',{},h('th'),h('th',{text:'A · '+panelTitle(da.panel)}),h('th',{text:'B · '+panelTitle(db.panel)}))),
  h('tbody',{},SUMMARY_ROWS.map(([label,k,fmt=v=>String(v)])=>h('tr',{class:sa[k]!==sb[k]?'cmp-diff':''},h('th',{scope:'row',text:label}),h('td',{text:fmt(sa[k])}),h('td',{text:fmt(sb[k])+delta(sa[k],sb[k])})))));
 return h('div',{class:'container'},head,pickers,
  h('section',{class:'card cmp-card','aria-label':'Caractéristiques'},h('h2',{text:'Caractéristiques'}),h('div',{class:'cmp-scroll'},summary)),
  h('section',{class:'card cmp-card','aria-label':'Circuit par circuit'},h('div',{class:'cmp-head'},h('h2',{text:'Circuit par circuit'}),
   h('span',{class:'small muted',text:`${counts.same||0} identiques · ${counts.diff||0} différents · ${counts.onlyA||0} seulement dans A · ${counts.onlyB||0} seulement dans B`}),filter),
   h('div',{class:'cmp-scroll'},h('table',{class:'cmp-table'},h('thead',{},h('tr',{},h('th',{text:'Pos.'}),h('th',{text:'A'}),h('th',{text:'B'}),h('th',{text:'Écart'}))),body)),
   h('p',{class:'small muted',text:'Les circuits sont alignés sur leur premier emplacement. Les emplacements vides ou inutilisés ne sont pas affichés.'})));
}
