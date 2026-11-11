// Historique d'un panneau : qui a changé quoi, valeur précédente, restauration d'un circuit ou de tout le panneau.
import {h,toast,dialog,confirmDialog,fmtDate} from './dom.js';
import {api} from './api.js';
import {designation} from '../model.js';

const FIELDS=[['label','Désignation'],['room','Pièce'],['amps','Calibre'],['status','Statut'],['usage','Usage'],['protection','Protection'],['notes','Notes'],['exceptions','Exceptions']];
const val=v=>v==null||v===''?'—':String(v);
// Différences entre deux listes de circuits (par identifiant).
export function diffCircuits(prev=[],next=[]){
 const before=new Map(prev.map(c=>[c.id,c])),out=[];
 for(const c of next){
  const p=before.get(c.id);
  if(!p){out.push({id:c.id,pos:designation(c),added:true,changes:[]});continue;}
  const changes=FIELDS.filter(([k])=>val(p[k])!==val(c[k])).map(([k,label])=>({k,label,from:val(p[k]),to:val(c[k])}));
  const lp=(p.loads||[]).length,ln=(c.loads||[]).length;
  if(lp!==ln)changes.push({k:'loads',label:'Charges',from:String(lp),to:String(ln)});
  if((p.slots||[]).join('+')!==(c.slots||[]).join('+'))changes.push({k:'slots',label:'Position',from:(p.slots||[]).join(' + '),to:(c.slots||[]).join(' + ')});
  if(changes.length)out.push({id:c.id,pos:designation(c),changes});
 }
 for(const p of prev)if(!next.some(c=>c.id===p.id))out.push({id:p.id,pos:designation(p),removed:true,changes:[]});
 return out;
}

const when=v=>new Intl.DateTimeFormat((globalThis.MP_LOCALE||'fr-CA'),{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));

// persist(update) : enregistre comme une modification normale (elle devient donc une nouvelle version, rien n'est perdu).
export async function historyDialog({panel,persist,onDone}){
 const body=h('div',{class:'history'},h('p',{class:'muted',text:'Chargement…'}));
 const d=dialog({title:'Historique du panneau',eyebrow:panel.name,wide:true,body:[body],actions:[{label:'Fermer',kind:'ghost'}]});
 let versions;
 try{versions=(await api('/api/panels?id='+panel.id+'&action=history')).versions;}catch(e){body.replaceChildren(h('p',{class:'error',text:e.message}));return;}
 const detail=h('div',{class:'history-detail'});
 const restoreAll=async v=>{
  if(!await confirmDialog(`Restaurer le panneau tel qu’il était le ${when(v.at)} ? Les modifications faites depuis seront remplacées, mais cette restauration est elle-même enregistrée dans l’historique : vous pourrez revenir en arrière.`,{title:'Restaurer cette version',confirm:'Restaurer'}))return;
  try{
   const s=v.snapshot;
   await persist({circuits:s.circuits,positions:s.positions,meta:{name:s.name,tag:s.tag,kind:s.kind,location:s.location,details:s.details}});
   toast('Version restaurée.');d.close();onDone?.();
  }catch(e){toast(e.message,8000);}
 };
 const restoreCircuit=async(c,prevC)=>{
  try{
   const next=panel.circuits.map(x=>x.id===c.id?prevC:x);
   await persist({circuits:next});toast(`Circuit ${designation(prevC)} remis à son ancienne valeur.`);d.close();onDone?.();
  }catch(e){toast(e.message,8000);}
 };
 async function show(row){
  detail.replaceChildren(h('p',{class:'muted',text:'Chargement…'}));
  try{
   const v=await api(`/api/panels?id=${panel.id}&action=history&hid=${row.id}`);
   const diffs=v.previous?diffCircuits(v.previous.circuits,v.snapshot.circuits):[];
   const meta=['name','tag','kind','location'].filter(k=>v.previous&&val(v.previous[k])!==val(v.snapshot[k])).map(k=>({k,label:{name:'Nom du panneau',tag:'Repère',kind:'Type',location:'Emplacement'}[k],from:val(v.previous[k]),to:val(v.snapshot[k])}));
   const rows=diffs.slice(0,60).map(df=>{
    const prevC=v.previous?.circuits.find(c=>c.id===df.id),cur=panel.circuits.find(c=>c.id===df.id);
    return h('li',{},h('b',{text:'Circuit '+df.pos}),df.added?h('span',{class:'muted',text:' ajouté'}):df.removed?h('span',{class:'muted',text:' retiré'}):h('ul',{},...df.changes.map(x=>h('li',{text:`${x.label} : ${x.from} → ${x.to}`}))),
     prevC&&cur&&!df.added&&!df.removed&&h('button',{type:'button',class:'sm',onclick:()=>restoreCircuit(cur,prevC)},'Remettre l’ancienne valeur'));
   });
   detail.replaceChildren(
    h('h3',{text:row.initial?'Version initiale (avant le premier enregistrement suivi)':`Modifications du ${when(row.at)}${row.by?' par '+row.by:''}`}),
    row.initial?h('p',{class:'small muted',text:'État du panneau avant que les modifications soient suivies.'}):(rows.length||meta.length?h('ul',{class:'diff-list'},...meta.map(x=>h('li',{text:`${x.label} : ${x.from} → ${x.to}`})),...rows):h('p',{class:'small muted',text:'Aucune différence sur les circuits (autres réglages modifiés).'})),
    diffs.length>60&&h('p',{class:'small muted',text:`… et ${diffs.length-60} autres circuits.`}),
    h('div',{class:'page-actions'},h('button',{type:'button',class:'primary',onclick:()=>restoreAll(v)},'Restaurer tout le panneau à cette version')));
  }catch(e){detail.replaceChildren(h('p',{class:'error',text:e.message}));}
 }
 body.replaceChildren(
  versions.length?h('div',{class:'history-grid'},
   h('ol',{class:'history-list',role:'listbox','aria-label':'Versions'},...versions.map(r=>h('li',{},h('button',{type:'button',class:'ghost',onclick:ev=>{body.querySelectorAll('.history-list .on').forEach(x=>x.classList.remove('on'));ev.currentTarget.classList.add('on');show(r);}},h('b',{text:r.initial?'Version initiale':when(r.at)}),h('small',{class:'muted',text:r.initial?'':(r.by||'—')}))))),
   detail):h('p',{class:'muted',text:'Aucune version enregistrée pour l’instant. L’historique commence à la prochaine modification.'}));
}
