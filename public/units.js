// Disjoncteurs physiques d'un panneau : regroupe les circuits (fiches) en appareils réels
// pour l'attribution des modèles de la bibliothèque.
import {slotPos,sortCircuits,designation} from './model.js';

const amountsLabel=(kind,amps)=>{
 const a=amps.map(x=>x??'?');
 return kind==='tandem'?`Jumelé ${a.join('/')} A`:kind==='quad'?`Quad ${a[0]} + 2P${a[1]} + ${a[2]} A`:kind==='triple'?`Tripolaire ${a[0]} A`:kind==='double'?`Bipolaire ${a[0]} A`:kind==='single'?`Unipolaire ${a[0]} A`:'Format particulier';
};
/** Retourne [{key, kind, ids:[...], amps:[...], protection, ref, pos, label, signature, designation}] */
export function breakerUnits(circuits){
 const list=sortCircuits(circuits).filter(c=>c.amps||c.breakerRef||c.label||(c.loads&&c.loads.length));
 const bySlot=new Map();for(const c of circuits)for(const s of c.slots)bySlot.set(s,c);
 const used=new Set(),units=[];
 const push=(kind,cs,amps)=>{
  cs.forEach(c=>used.add(c.id));
  const refs=[...new Set(cs.map(c=>c.breakerRef||''))];
  const protection=cs.map(c=>c.protection||'Standard').find(p=>p!=='Standard')||'Standard';
  units.push({key:cs.map(c=>c.id).join('+'),kind,ids:cs.map(c=>c.id),amps,protection,ref:refs.length===1?refs[0]:'',mixedRefs:refs.length>1,
   pos:slotPos(cs[0].slots[0]),designation:cs.map(designation).join(' · '),labels:cs.map(c=>c.label).filter(Boolean),
   label:amountsLabel(kind,amps),signature:`${kind}|${amps.join('/')}|${protection}`});
 };
 for(const c of list){
  if(used.has(c.id))continue;
  const s=c.slots,n=slotPos(s[0]);
  const fullPositions=s.length%2===0&&s[0].endsWith('A');
  if(fullPositions){push(s.length===2?'single':s.length===4?'double':s.length===6?'triple':'other',[c],[c.amps]);continue;}
  // Demi-emplacements : jumelé (nA + nB) ou quad (nA + bipolaire nB/(n+2)A + (n+2)B).
  if(s.length===1&&s[0].endsWith('A')){
   const b=bySlot.get(`${n}B`);
   if(b&&b.slots.length===2&&b.slots[1]===`${n+2}A`){
    const c3=bySlot.get(`${n+2}B`);
    if(c3&&c3.slots.length===1&&!used.has(b.id)&&!used.has(c3.id)){push('quad',[c,b,c3],[c.amps,b.amps,c3.amps]);continue;}
   }
   if(b&&b.slots.length===1&&!used.has(b.id)){push('tandem',[c,b],[c.amps,b.amps]);continue;}
   push('other',[c],[c.amps]);continue;
  }
  if(s.length===1&&s[0].endsWith('B')){
   // Moitié B seule (la moitié A est vide) : traitée comme un jumelé dont une moitié est libre.
   const a=bySlot.get(`${n}A`);
   if(a&&a.slots.length===1&&!used.has(a.id)){push('tandem',[a,c],[a.amps,c.amps]);continue;}
   push('other',[c],[c.amps]);continue;
  }
  if(s.length===2&&s[0].endsWith('B')){
   // Bipolaire sur demi-emplacements (nB/(n+2)A) : partie centrale d'un quad.
   const a=bySlot.get(`${n}A`),c3=bySlot.get(`${n+2}B`);
   if(a&&c3&&a.slots.length===1&&c3.slots.length===1&&!used.has(a.id)&&!used.has(c3.id)){push('quad',[a,c,c3],[a.amps,c.amps,c3.amps]);continue;}
   push('other',[c],[c.amps]);continue;
  }
  push('other',[c],[c.amps]);
 }
 return units.sort((x,y)=>x.pos-y.pos);
}

const sameSet=(a,b)=>a.length===b.length&&[...a].sort((x,y)=>x-y).every((v,i)=>v===[...b].sort((x,y)=>x-y)[i]);
// Modèles de la bibliothèque compatibles avec un disjoncteur : même format et mêmes calibres ;
// d'abord la même protection, puis les autres protections.
export function matchBreakers(unit,breakers,det={}){
 if(unit.kind==='other'||unit.amps.some(a=>a==null))return {exact:[],other:[]};
 const fam=det.family;
 const okFam=det.accepts?.length?det.accepts:fam?[fam]:null;
 const pool=breakers.filter(b=>b.kind===unit.kind&&(!okFam||okFam.includes(b.family))&&!(b.neutre==='PoN'&&det.pon===false));
 const ampsOk=b=>unit.kind==='quad'?b.amps[1]===unit.amps[1]&&sameSet([b.amps[0],b.amps[2]],[unit.amps[0],unit.amps[2]]):unit.kind==='tandem'?sameSet(b.amps,unit.amps):b.amps[0]===unit.amps[0];
 const fits=pool.filter(ampsOk);
 // Neutre enfichable en premier si le panneau en a une barre, sinon les modèles à fil.
 const rank=b=>(det.pon?(b.neutre==='PoN'?0:1):(b.neutre==='PoN'?1:0))+(b.smart?.5:0);
 const exact=fits.filter(b=>b.protection===unit.protection).sort((a,b)=>rank(a)-rank(b));
 const other=fits.filter(b=>b.protection!==unit.protection).sort((a,b)=>rank(a)-rank(b));
 return {exact,other};
}
// Applique un modèle à un disjoncteur : référence sur chaque fiche, protection alignée sur le modèle.
export function applyModel(circuits,unit,breaker){
 const next=structuredClone(circuits);
 for(const id of unit.ids){
  const c=next.find(x=>x.id===id);if(!c)continue;
  c.breakerRef=breaker.cat;
  if(breaker.protection&&breaker.protection!=='Standard')c.protection=breaker.protection;else delete c.protection;
 }
 return next;
}
export function clearModel(circuits,unit){
 const next=structuredClone(circuits);
 for(const id of unit.ids){const c=next.find(x=>x.id===id);if(c)delete c.breakerRef;}
 return next;
}
