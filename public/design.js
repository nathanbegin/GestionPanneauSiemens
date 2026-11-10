// Conception d'un panneau : à partir du bâtiment et des gros appareils, calcule l'entrée, le nombre de circuits
// (au sens du catalogue des fabricants) et dispose les disjoncteurs. Sans DOM : partagé navigateur / tests.
import {LOAD_LIBRARY,SERVICE_SIZES,STANDARD_BREAKERS} from './catalog.js';
import {dwellingCalc} from './loadcalc.js';
import {DEFAULT_VOLTS} from './voltage.js';
import {blank,reshape,validate,sortCircuits,usages} from './model.js';

const lib=id=>LOAD_LIBRARY.find(l=>l.id===id);
/** Gros appareils proposés (id de la liste d'appareils, quantité par défaut, ce que la quantité représente). */
export const DESIGN_APPLIANCES=[
 {id:'range-12',short:'Cuisinière',label:'Cuisinière électrique',def:1,unit:'cuisinière'},
 {id:'dryer',short:'Sécheuse',label:'Sécheuse électrique',def:1,unit:'sécheuse'},
 {id:'wh-4500',short:'Chauffe-eau',label:'Chauffe-eau électrique',def:1,unit:'chauffe-eau'},
 {id:'washer',short:'Laveuse',label:'Laveuse',def:1,unit:'laveuse'},
 {id:'dishwasher',short:'Lave-vaisselle',label:'Lave-vaisselle',def:1,unit:'lave-vaisselle'},
 {id:'bb-1500',short:'Plinthes',label:'Plinthes électriques (1 500 W chacune)',def:0,unit:'plinthe(s)',max:30},
 {id:'hp-3t',short:'Thermopompe',label:'Thermopompe centrale',def:0,unit:'thermopompe'},
 {id:'ev-l2-30',short:'Borne de recharge',label:'Borne de recharge niveau 2 (30 A)',def:0,unit:'borne'},
 {id:'spa',short:'Spa',label:'Spa 240 V',def:0,unit:'spa'},
];
const USAGE_BY_CAT={range:'Électroménager',heating:'Chauffage',heating100:'Chauffage',cooling:'Climatisation',ev:'Borne de recharge',water100:'Autre',other:'Autre',basic:'Électroménager'};
const usageOf=(l,fallback='Autre')=>{const u=l.id==='wh-4500'?'Chauffe-eau':USAGE_BY_CAT[l.cat]||fallback;return usages.includes(u)?u:fallback;};
const nextBreaker=a=>STANDARD_BREAKERS.find(b=>b>=a)||null;
// Un appareil 240 V est alimenté à la tension bipolaire du réseau (208 V en option) ; sa puissance nominale est conservée (prudent).
const loadOf=(l,qty=1,vs=DEFAULT_VOLTS)=>({id:'d-'+l.id,name:l.name,w:l.w,v:l.v>=208?vs.bi:vs.uni,qty,cat:l.cat,cont:!!l.cont});

/**
 * Circuits à prévoir. input : {livingArea, basementArea, picks:{[id d'appareil]: quantité}}.
 * Retourne [{label, amps, poles, usage, protection?, loads?}] : circuits généraux puis appareils.
 */
export function designItems({livingArea=0,basementArea=0,picks={},vs=DEFAULT_VOLTS}={}){
 const area=Math.max(0,Number(livingArea)||0)+0.75*Math.max(0,Number(basementArea)||0);
 const items=[];
 const general=Math.max(6,Math.ceil(area/20));
 for(let i=1;i<=general;i++)items.push({label:`Éclairage et prises — zone ${i}`,amps:15,poles:1,usage:'Prises'});
 items.push({label:'Prises de comptoir de cuisine — 1',amps:20,poles:1,usage:'Prises'},{label:'Prises de comptoir de cuisine — 2',amps:20,poles:1,usage:'Prises'});
 items.push({label:'Salle de bain (DDFT)',amps:15,poles:1,usage:'Prises',protection:'DDFT'});
 for(const a of DESIGN_APPLIANCES){
  const qty=Math.max(0,Math.floor(Number(picks[a.id])||0));if(!qty)continue;
  const l=lib(a.id);if(!l)continue;
  if(a.id==='bb-1500'){
   // Deux plinthes de 1 500 W par circuit de 240 V (20 A).
   for(let left=qty,n=1;left>0;n++){const k=Math.min(2,left);left-=k;items.push({label:`Plinthes électriques — circuit ${n}`,amps:20,poles:2,usage:'Chauffage',loads:[loadOf(l,k,vs)]});}
   continue;
  }
  for(let k=1;k<=qty;k++){
   const amps=l.b||nextBreaker(Math.ceil(l.w/l.v*1.25))||60;
   items.push({label:qty>1?`${a.short} ${k}`:a.short,amps,poles:l.v>=208?2:1,usage:usageOf(l),
    ...(a.id==='spa'?{protection:'DDFT'}:{}),loads:[loadOf(l,1,vs)]});
  }
 }
 return items;
}
/** Calcul de la charge du logement (CCÉ 8-200) sur les circuits prévus : {amps, recommended, totalW, ...}. */
export function designCalc(items,{livingArea=0,basementArea=0,vs=DEFAULT_VOLTS}={}){
 const circuits=items.filter(i=>i.loads?.length).map((i,k)=>({id:'d'+k,slots:[`${k*2+1}A`,`${k*2+1}B`],label:i.label,loads:i.loads}));
 return dwellingCalc(circuits,{livingArea,basementArea,vs});
}
/** Besoin en circuits au sens du catalogue (pôles ; A/B = 1, bipolaire = 2, principal exclu) et en espaces. */
export function designDemand(items){
 const poles=items.reduce((n,i)=>n+i.poles,0),bip=items.filter(i=>i.poles>=2).length,singles=items.length-bip;
 return {breakers:items.length,circuits:poles,bipolar:bip,spaces:2*bip+Math.ceil(singles/2),spacesPlain:poles};
}
/** Entrée de service à retenir : plus petit calibre normalisé ≥ la charge, avec la marge demandée (0,2 = 20 %). */
export const mainFor=(amps,margin=0)=>SERVICE_SIZES.find(s=>s>=amps*(1+margin))??null;
/** Nombre de positions pour un panneau générique (pair, au moins 20). */
export const genericPositions=(items,{tandem=true,margin=0.2}={})=>{const d=designDemand(items);const need=Math.ceil((tandem?d.spaces:d.spacesPlain)*(1+margin));return Math.max(20,need+need%2);};

/**
 * Dispose les circuits prévus sur un panneau de `positions` positions.
 * Bipolaires : colonne de gauche (1-3, 5-7…) puis colonne de droite. Les autres : jumelés (A puis B) si `tandem`, sinon une position chacun.
 * Retourne {circuits, unplaced:[items]}.
 */
export function draftLayout(items,{positions,tandem=true}){
 let c=blank(positions);
 const id=slot=>c.find(x=>x.slots.includes(slot))?.id;
 const covered=new Set();
 const apply=(slot,it)=>{c=c.map(x=>x.slots[0]===slot?{...x,label:it.label,amps:it.amps,usage:it.usage,status:'Identifié',notes:'Circuit prévu à la conception.',...(it.protection&&it.protection!=='Standard'?{protection:it.protection}:{}),...(it.loads?{loads:it.loads}:{})}:x);};
 const unplaced=[];
 const starts=[];for(let n=1;n+2<=positions;n+=4)starts.push(n);for(let n=2;n+2<=positions;n+=4)starts.push(n);
 const bips=items.filter(i=>i.poles>=2);
 for(const it of bips){
  const n=starts.shift();if(n==null){unplaced.push(it);continue;}
  c=reshape(c,id(`${n}A`),'double',positions);apply(`${n}A`,it);covered.add(n);covered.add(n+2);
 }
 const slots=[];
 for(let p=1;p<=positions;p++){
  if(covered.has(p))continue;
  if(tandem){slots.push(`${p}A`,`${p}B`);}else slots.push(`${p}A`);
 }
 const rest=items.filter(i=>i.poles<2);
 for(const [k,it] of rest.entries()){
  const slot=slots[k];if(!slot){unplaced.push(it);continue;}
  if(tandem&&slot.endsWith('A'))c=reshape(c,id(slot),'tandem',positions);
  apply(slot,it);
 }
 return {circuits:validate(sortCircuits(c),{positions}),unplaced};
}
