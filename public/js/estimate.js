// Estimation des coûts d'un panneau (sur demande, par IA avec recherche web) : prix indicatifs en $ CAD, avant taxes.
import {h,toast,dialog,money} from './dom.js';
import {api} from './api.js';
import {materials} from '../loadcalc.js';

const cad=v=>new Intl.NumberFormat((globalThis.MP_LOCALE||'fr-CA'),{style:'currency',currency:'CAD',maximumFractionDigits:v<100?2:0}).format(v);
const okUrl=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:null;}catch{return null;}};

// Articles à estimer : le centre de charge puis chaque type de disjoncteur (quantité regroupée).
export function estimateItems(panel){
 const det=panel.details||{};const mat=materials(panel);
 const items=[];
 const model=det.modelInfo||`${mat.family} ${det.mainAmps?det.mainAmps+' A':''} ${panel.positions} espaces`.trim();
 items.push({description:`Centre de charge / panneau : ${model}`,qty:1});
 for(const i of mat.items){
  const kind=i.tandem?'jumelé (2 circuits dans 1 espace)':i.poles===3?'tripolaire':i.poles===2?'bipolaire':'unipolaire';
  items.push({description:`Disjoncteur ${kind} ${i.amps} A${i.protection&&i.protection!=='Standard'?' '+i.protection:''}${i.ref?' réf. '+i.ref:` (${mat.family})`}`,qty:i.qty});
 }
 return {items,context:{family:mat.family,model,mainAmps:det.mainAmps||null,positions:panel.positions,province:'QC'}};
}

export function estimateDialog({panel}){
 const input=estimateItems(panel);
 const body=h('div',{class:'est-body'});
 let result=null;
 const start=h('button',{type:'button',class:'primary',onclick:()=>run()},'💲 Lancer l’estimation');
 const intro=()=>body.replaceChildren(
  h('p',{class:'muted',text:'L’IA cherche les prix actuels du matériel de ce panneau chez des détaillants et grossistes (Home Depot, Rona, Canac, Patrick Morin, Lumen, Guillevin…). Cela prend 30 à 60 secondes et compte pour une analyse IA de votre forfait.'}),
  h('ul',{class:'small'},...input.items.map(i=>h('li',{text:`${i.qty} × ${i.description}`}))),
  h('p',{class:'small muted',text:'Prix indicatifs en dollars canadiens, avant taxes. Ce n’est pas une soumission : confirmez les prix et la disponibilité auprès du magasin.'}),
  h('div',{class:'form-actions'},start));
 const show=(r,live)=>{
  result=r;
  const rows=r.items.map(i=>{const lo=i.unit_low*i.qty,hi=i.unit_high*i.qty;return {...i,lo,hi};});
  const tl=rows.reduce((n,r)=>n+r.lo,0),th=rows.reduce((n,r)=>n+r.hi,0);
  const url=u=>{const x=u&&okUrl(u);return x?h('a',{href:x,target:'_blank',rel:'noopener noreferrer',text:'Voir'}):'';};
  body.replaceChildren(
   h('div',{class:'est-total',role:'status'},h('div',{class:'small muted',text:'Estimation du matériel (avant taxes)'}),h('b',{text:`${cad(tl)} – ${cad(th)}`})),
   !live?h('p',{class:'notice warn',text:'Recherche web indisponible : fourchettes générales, non vérifiées dans les magasins.'}):'',
   h('div',{class:'table-wrap'},h('table',{class:'data est-table'},
    h('thead',{},h('tr',{},['Qté','Article','Prix unitaire','Total','Magasin','Fiabilité'].map(t=>h('th',{text:t})))),
    h('tbody',{},rows.map(i=>h('tr',{},h('td',{text:i.qty}),h('td',{},h('div',{text:i.description}),i.note?h('div',{class:'small muted',text:i.note}):''),
     h('td',{text:i.unit_low===i.unit_high?cad(i.unit_low):`${cad(i.unit_low)} – ${cad(i.unit_high)}`}),h('td',{text:`${cad(i.lo)} – ${cad(i.hi)}`}),
     h('td',{},i.store||'—',' ',url(i.url)),h('td',{},h('span',{class:'badge '+(i.confidence==='high'?'ok':i.confidence==='low'?'warn':''),text:{high:'Prix vu',medium:'Équivalent',low:'Estimé'}[i.confidence]||i.confidence})))))),),
   r.stores_checked?.length?h('p',{class:'small muted',text:'Magasins consultés : '+r.stores_checked.join(', ')+'.'}):'',
   ...(r.warnings||[]).map(w=>h('p',{class:'small muted',text:'ℹ '+w})),
   h('p',{class:'small muted',text:'Estimation générée par IA à titre indicatif. Les prix changent, certains articles ne se vendent qu’en grossiste, et la main-d’œuvre, les fils, les taxes et les permis ne sont pas inclus.'}),
   h('div',{class:'form-actions'},h('button',{type:'button',onclick:csv},'⬇ Télécharger (CSV)'),h('button',{type:'button',onclick:run},'Refaire l’estimation')));
 };
 const csv=()=>{
  if(!result)return;
  const cell=v=>{let t=String(v??'');if(/^[=+\-@\t\r]/.test(t))t="'"+t;return /[",;\n\r]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t;};
  const lines=[['Qté','Article','Prix unitaire min ($)','Prix unitaire max ($)','Magasin','Lien','Fiabilité','Note'],...result.items.map(i=>[i.qty,i.description,i.unit_low,i.unit_high,i.store,okUrl(i.url)||'',i.confidence,i.note])].map(l=>l.map(cell).join(','));
  const a=h('a',{href:URL.createObjectURL(new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'})),download:'estimation-'+(panel.tag||'panneau')+'.csv'});document.body.append(a);a.click();a.remove();
 };
 async function run(){
  body.replaceChildren(h('div',{class:'est-wait',role:'status'},h('div',{class:'spinner','aria-hidden':'true'}),h('p',{text:'Recherche des prix en cours… (30 à 60 secondes)'})));
  try{
   const r=await api('/api/panels?action=estimate-costs',{method:'POST',body:{...input,lang:globalThis.MP_LANG||document.documentElement.lang||'fr'}});
   show(r.estimate,r.live);
  }catch(e){body.replaceChildren(h('p',{class:'notice warn',text:e.message}),h('div',{class:'form-actions'},h('button',{type:'button',onclick:intro},'Retour')));}
 }
 intro();
 return dialog({title:'Estimation des coûts',eyebrow:(panel.tag?panel.tag+' · ':'')+panel.name,wide:true,body:[body],actions:[{label:'Fermer',kind:'ghost'}]});
}
