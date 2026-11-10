// Conversion d'une lecture par IA (photo ou fichier récapitulatif) en panneau Mon Panneau.
// Partagé navigateur / serveur : le serveur produit la proposition, le navigateur la construit
// pas à pas et la fait confirmer avant la création.
import {blank,reshape,validate,ampsList,protections,voltages,MIN_POSITIONS,MAX_POSITIONS,sortCircuits,slotPos,nextSlot,isLinkedPair,groupCircuits,suggestLinks} from './model.js';
import {FAMILY_IDS,FAMILIES} from './catalog.js';

export const AI_CONFIDENT=0.75;
const clampPositions=n=>{n=Math.max(MIN_POSITIONS,Math.min(MAX_POSITIONS,Math.ceil(n||0)));return n%2?n+1:n;};
// Calibre lu ramené au calibre normalisé le plus proche (écart de 5 A au plus).
export function snapAmps(a){
 if(a==null||!isFinite(a))return null;
 let best=null;for(const v of ampsList)if(best==null||Math.abs(v-a)<Math.abs(best-a))best=v;
 return Math.abs(best-a)<=5?best:null;
}
const str=(v,max)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);

/**
 * scan : objet renvoyé par le modèle (voir api/_lib/ai.js, SCAN_SCHEMA).
 * Retourne {meta, positions, circuits, review:{[circuitId]:{confidence,source}}, steps:[...], warnings:[...]}
 * steps : ordre de construction (un pas par disjoncteur), utilisé pour l'animation.
 */
export function scanToPanel(scan={}){
 const warnings=[...(Array.isArray(scan.warnings)?scan.warnings.map(w=>str(w,200)).filter(Boolean):[])];
 const breakers=(Array.isArray(scan.breakers)?scan.breakers:[]).filter(b=>Number.isInteger(b?.position)&&b.position>=1&&b.position<=MAX_POSITIONS)
  .map(b=>({...b,poles:[1,2,3].includes(b.poles)?b.poles:1,half:b.half==='A'||b.half==='B'?b.half:''}))
  .sort((a,b)=>a.position-b.position||(a.half<b.half?-1:1));
 const highest=Math.max(0,...breakers.map(b=>b.position+(b.poles-1)*2),...(scan.empty_positions||[]).filter(Number.isInteger));
 let positions=clampPositions(Math.max(Number.isInteger(scan.positions)?scan.positions:0,highest,MIN_POSITIONS));
 if(Number.isInteger(scan.positions)&&scan.positions<highest)warnings.push(`Le nombre de positions lu (${scan.positions}) est inférieur à la position la plus haute (${highest}) : ${positions} positions retenues.`);
 let circuits=blank(positions);
 const review={},steps=[];
 const idAt=(slot)=>circuits.find(c=>c.slots.includes(slot))?.id;
 for(const b of breakers){
  const n=b.position;
  // 2e demi-emplacement d'un disjoncteur déjà groupé (déclaré avec spans_next) : rien à refaire.
  const owner=b.half&&circuits.find(c=>c.slots.includes(`${n}${b.half}`));
  if(owner&&review[owner.id]&&isLinkedPair(owner))continue;
  try{
   let id=idAt(`${n}${b.half||'A'}`);
   if(!id)throw Error('position introuvable');
   // Position déjà occupée par un disjoncteur lu précédemment (ex. 2e pôle d'un bipolaire).
   const cur=circuits.find(c=>c.id===id);
   if(review[id]&&!(b.half&&cur.slots.length===2)||slotPos(cur.slots[0])!==n)throw Error(`position déjà occupée par le circuit ${cur.label||cur.id}`);
   if(b.half){circuits=reshape(circuits,id,'tandem',positions);id=idAt(`${n}${b.half}`);}
   else if(b.poles>1)circuits=reshape(circuits,id,b.poles===2?'double':'triple',positions);
   const conf=typeof b.confidence==='number'?Math.max(0,Math.min(1,b.confidence)):0.5;
   const label=b.label_source==='none'?'':str(b.label,100);
   const amps=snapAmps(b.amps);
   if(b.amps!=null&&amps==null)warnings.push(`Position ${n} : calibre lu (${b.amps} A) non standard, à vérifier.`);
   circuits=circuits.map(c=>c.id!==id?c:{...c,label,amps,
    status:label&&conf>=AI_CONFIDENT?'Identifié':'À confirmer',
    ...(protections.includes(b.protection)?{protection:b.protection}:{}),
    notes:`Relevé assisté par IA (confiance ${Math.round(conf*100)} %${label?', étiquette lue sur '+(b.label_source==='directory'?'le répertoire':'le disjoncteur'):''}).`});
   review[id]={confidence:conf,source:b.label_source||'none'};
   steps.push(id);
   // Disjoncteur sur deux demi-emplacements consécutifs (ex. chauffage 25 A sur 5B + 7A).
   if(b.half&&b.spans_next===true){
    const nx=nextSlot(`${n}${b.half}`);
    let other=circuits.find(c=>c.slots.includes(nx));
    // Position voisine encore entière (nA + nB) : on la sépare en demi-emplacements pour pouvoir en prendre la moitié.
    if(other&&other.slots.length===2&&slotPos(other.slots[0])===slotPos(other.slots[1])&&!review[other.id]){circuits=reshape(circuits,other.id,'tandem',positions);other=circuits.find(c=>c.slots.includes(nx));}
    if(other&&other.slots.length===1&&!review[other.id]){
     circuits=groupCircuits(circuits,id,other.id,positions);
     warnings.push(`Disjoncteur ${amps?amps+' A':''}${label?' « '+label+' »':''} sur deux emplacements (${n}${b.half} + ${nx}) : à vérifier sur le panneau.`);
    }else warnings.push(`Position ${n}${b.half} : l’IA indique un disjoncteur sur deux emplacements, mais ${nx} est déjà occupé ou introuvable.`);
   }
  }catch(e){
   warnings.push(`Position ${n}${b.half||''} : disjoncteur ignoré (${e.message.replace(/\.$/,'')}).`);
  }
 }
 for(const n of (scan.empty_positions||[]).filter(Number.isInteger)){
  const c=circuits.find(x=>x.slots.length===2&&slotPos(x.slots[0])===n&&!x.label&&x.amps==null);
  if(c){circuits=circuits.map(x=>x===c?{...x,status:'Libre',vacant:true}:x);steps.push(c.id);}
 }
 circuits=validate(sortCircuits(circuits),{positions});
 const links=suggestLinks(circuits);
 for(const l of links)warnings.push(`Emplacements ${l.slots[0]} et ${l.slots[1]} : même calibre (${l.amps} A) et même désignation « ${l.label} ». Un seul disjoncteur sur deux emplacements ? Vous pouvez les grouper à la confirmation.`);
 const family=FAMILY_IDS.includes(scan.family)?scan.family:'';
 const mainAmps=Number.isInteger(scan.main_amps)&&scan.main_amps>=15&&scan.main_amps<=1200?scan.main_amps:null;
 const kind=scan.panel_kind==='Sous-panneau'?'Sous-panneau':'Principal';
 const meta={
  name:kind==='Principal'?'Panneau principal':'Sous-panneau',
  tag:'',kind,location:'',
  details:{brand:str(scan.brand,60)||(family?FAMILIES[family].brand:''),model:str(scan.series,60),mainAmps,
   voltage:voltages.includes(scan.voltage)?scan.voltage:voltages[0],family,
   notes:str([scan.catalog_number&&'N° de catalogue lu : '+scan.catalog_number,scan.summary].filter(Boolean).join(' — '),2000)},
 };
 return {meta,positions,circuits,review,steps,warnings,links,confidence:typeof scan.confidence==='number'?scan.confidence:null};
}
