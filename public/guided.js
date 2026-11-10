// Mode guidé : logique du questionnaire qui construit un panneau position par position.
// Partagé navigateur / tests. Aucune dépendance au DOM.
import {blank,reshape,validate,sortCircuits,slotPos,designation,usages,ampsList,protections} from './model.js';

// Désignations proposées pendant la saisie.
export const LABEL_SUGGESTIONS=['Cuisinière','Sécheuse','Laveuse','Chauffe-eau','Réfrigérateur','Congélateur','Lave-vaisselle','Micro-ondes','Hotte','Comptoir cuisine','Îlot de cuisine',
 'Salle de bain','Chambre principale','Chambre','Salon','Salle à manger','Bureau','Sous-sol','Garage','Atelier','Entrée','Couloir','Escalier',
 'Éclairage extérieur','Prises extérieures','Plinthes','Plinthes — chambres','Plinthes — salon','Plancher chauffant','Fournaise','Thermopompe','Climatiseur',
 'Échangeur d’air','Pompe de puisard','Pompe à eau','Borne de recharge','Spa','Piscine','Ouvre-porte de garage','Détecteurs de fumée','Sous-panneau'];

// Usage déduit de la désignation (modifiable ensuite dans la fiche du circuit).
const RULES=[
 [/sous[- ]?panneau|panneau secondaire/i,'Sous-panneau'],[/borne|v[ée]hicule|recharge|\bVÉ\b|\bVE\b/i,'Borne de recharge'],
 [/chauffe[- ]?eau|eau chaude/i,'Chauffe-eau'],[/thermopompe|climati|\bclim\b|heat ?pump/i,'Climatisation'],
 [/plinthe|chauffage|fournaise|convecteur|plancher chauffant|aérotherme/i,'Chauffage'],
 [/cuisini[èe]re|s[ée]cheuse|laveuse|lave[- ]vaisselle|r[ée]frig|cong[ée]lateur|micro[- ]?ondes|hotte|four\b|plaque/i,'Électroménager'],
 [/ext[ée]rieur|piscine|spa\b|jardin|terrasse|patio/i,'Extérieur'],[/[ée]clairage|lumi[èe]re|lampe|plafonnier/i,'Éclairage'],
 [/prise|comptoir|îlot|ilot/i,'Prises'],
];
export function guessUsage(label){for(const [re,u] of RULES)if(re.test(label||''))return u;return 'Autre';}

// Appareils courants : vérifiés à la fin pour ne rien oublier.
// volts : 240 = normalement sur un disjoncteur double.
export const APPLIANCES=[
 {id:'range',label:'Cuisinière ou table de cuisson électrique',re:/cuisini|cuisson|four\b|plaque/i,volts:240,typical:40},
 {id:'dryer',label:'Sécheuse électrique',re:/s[ée]cheuse/i,volts:240,typical:30},
 {id:'water',label:'Chauffe-eau électrique',re:/chauffe[- ]?eau|eau chaude/i,volts:240,typical:30},
 {id:'baseboard',label:'Plinthes ou convecteurs électriques',re:/plinthe|convecteur|chauffage/i,volts:240,typical:null},
 {id:'furnace',label:'Fournaise électrique',re:/fournaise/i,volts:240,typical:null},
 {id:'heatpump',label:'Thermopompe ou climatiseur',re:/thermopompe|climati|\bclim\b/i,volts:240,typical:null},
 {id:'ev',label:'Borne de recharge pour véhicule',re:/borne|recharge|v[ée]hicule/i,volts:240,typical:40},
 {id:'pool',label:'Spa ou piscine',re:/spa\b|piscine/i,volts:null,typical:null},
 {id:'subpanel',label:'Sous-panneau (garage, atelier, logement…)',re:/sous[- ]?panneau/i,volts:240,typical:null},
 {id:'washer',label:'Laveuse',re:/laveuse/i,volts:120,typical:20},
 {id:'dishwasher',label:'Lave-vaisselle',re:/lave[- ]vaisselle/i,volts:120,typical:15},
];

export const FORMATS={single:{label:'Disjoncteur simple',hint:'Une seule manette, sur une position.'},
 double:{label:'Disjoncteur double (bipolaire)',hint:'Deux manettes reliées, sur cette position et celle juste en dessous (240 V : cuisinière, sécheuse, chauffe-eau…).'},
 tandem:{label:'Disjoncteur jumelé (tandem)',hint:'Deux petites manettes dans une seule position.'},
 triple:{label:'Disjoncteur triple',hint:'Trois manettes reliées (rare en résidentiel).'},
 empty:{label:'Espace vide',hint:'Aucun disjoncteur : obturateur ou ouverture.'},
 unknown:{label:'Je ne sais pas',hint:'La position restera « À confirmer ».'}};

export function newGuided({positions=32,meta={}}={}){
 const n=Math.max(2,Math.min(84,positions+positions%2));
 return {positions:n,meta,circuits:blank(n),done:[]};
}
// Circuit qui couvre la position n (démarre ici ou plus haut).
export const circuitAt=(state,n)=>state.circuits.find(c=>c.slots.some(s=>slotPos(s)===n));
// Position couverte par un disjoncteur commencé plus haut (2e pôle d'un double, par exemple).
// Une position dont une moitié appartient à un disjoncteur groupé (ex. 1B + 3A) mais dont l'autre moitié a son propre disjoncteur n'est pas « couverte » : voir isSplit.
export function coveredFrom(state,n){
 const c=circuitAt(state,n);
 if(!c||slotPos(c.slots[0])===n)return null;
 return state.circuits.some(x=>slotPos(x.slots[0])===n)?null:c;
}
const spansPositions=c=>new Set(c.slots.map(slotPos)).size>1;
const halfCircuit=(state,slot)=>state.circuits.find(c=>c.slots.includes(slot));
/** Position partagée : une moitié (A ou B) fait partie d'un disjoncteur à cheval sur deux positions (ex. 1B + 3A), l'autre est à part. */
export function isSplit(state,n){
 const a=halfCircuit(state,n+'A'),b=halfCircuit(state,n+'B');
 return !!a&&!!b&&a!==b&&(spansPositions(a)||spansPositions(b));
}
/** Moitiés de la position n qui ont leur propre disjoncteur (un seul emplacement) : seules ces moitiés se décrivent ici. */
export const ownHalves=(state,n)=>state.circuits.filter(c=>c.slots.length===1&&slotPos(c.slots[0])===n);
/** Moitié de la position n qui fait partie d'un disjoncteur groupé : {slot, circuit} ou null. */
export function sharedHalf(state,n){
 if(!isSplit(state,n))return null;
 const a=halfCircuit(state,n+'A'),b=halfCircuit(state,n+'B');
 const c=spansPositions(a)?a:b;
 return {slot:c===a?n+'A':n+'B',circuit:c};
}
// Prochaine position à décrire après n (les positions couvertes sont sautées). null à la fin.
export function nextPosition(state,n){for(let p=n+1;p<=state.positions;p++)if(!coveredFrom(state,p))return p;return null;}
export function prevPosition(state,n){for(let p=n-1;p>=1;p--)if(!coveredFrom(state,p))return p;return null;}
// Peut-on placer ce format à la position n ? (renvoie un message d'erreur ou '').
// Les positions du dessous déjà décrites avec un vrai disjoncteur bloquent ; un espace vide ou « je ne sais pas » est remplacé.
export function canPlace(state,n,format){
 const span={double:2,triple:3}[format]||1;
 const last=n+(span-1)*2;
 if(last>state.positions)return `Un disjoncteur ${format==='double'?'double':'triple'} à la position ${n} irait jusqu’à la position ${last}, qui n’existe pas sur ce panneau.`;
 for(let k=1;k<span;k++){
  const p=n+k*2,c=circuitAt(state,p);
  if(!c||slotPos(c.slots[0])===n)continue;
  const others=state.circuits.filter(x=>x.slots.some(s=>slotPos(s)===p));
  if(others.some(x=>x.label||x.amps!=null))return `La position ${p} contient déjà « ${others.find(x=>x.label||x.amps!=null).label||designation(others[0])} ». Revenez à cette position pour la changer d’abord.`;
 }
 return '';
}
const cleanAmps=v=>{const a=Number(v);return ampsList.includes(a)?a:null;};
const fields=a=>{
 const label=String(a?.label||'').trim().slice(0,100);
 return {label,amps:cleanAmps(a?.amps),usage:usages.includes(a?.usage)?a.usage:guessUsage(label),
  ...(protections.includes(a?.protection)?{protection:a.protection}:{}),
  status:label?'Identifié':'À confirmer'};
};
const blankFields=c=>({id:c.id,slots:c.slots,label:'',room:'',usage:'Autre',amps:null,status:'À confirmer',notes:'',exceptions:''});
// Remet la position n à un disjoncteur simple vierge (regroupe un jumelé, libère les pôles d'un double).
function resetPosition(circuits,n,positions){
 const here=circuits.filter(c=>slotPos(c.slots[0])===n);
 if(!here.length)return circuits;
 if(here.length===2||here[0].slots.length===1){
  const ids=new Set(here.map(c=>c.id));const keep=here.find(c=>c.slots[0].endsWith('A'))||here[0];
  circuits=circuits.filter(c=>!ids.has(c.id)||c===keep).map(c=>c===keep?blankFields({...c,slots:[`${n}A`,`${n}B`]}):c);
  return circuits;
 }
 const c=here[0];
 circuits=circuits.map(x=>x===c?blankFields(x):x);
 return reshape(circuits,c.id,'single',positions);
}
/**
 * Applique la réponse pour la position n.
 * answer : {format:'single'|'double'|'triple'|'tandem'|'empty'|'unknown', amps, label, protection, usage, halves:[{…A},{…B}]}
 * Remet d'abord la position à l'état vierge : on peut revenir en arrière et changer d'avis.
 */
export function answerPosition(state,n,answer){
 // Position partagée avec un disjoncteur groupé : on ne touche qu'à la moitié qui a son propre disjoncteur.
 if(isSplit(state,n)){
  const own=ownHalves(state,n);
  if(!own.length)throw Error(`Les deux moitiés de la position ${n} font partie de disjoncteurs groupés : modifiez ces disjoncteurs.`);
  if(!['single','tandem','empty','unknown'].includes(answer.format))throw Error(`Seule la moitié ${own.map(c=>c.slots[0]).join(' et ')} de la position ${n} est libre : choisissez un disjoncteur, un espace vide ou « je ne sais pas ».`);
  const patch=answer.format==='empty'?{status:'Libre',vacant:true}:answer.format==='unknown'?null:fields(answer.format==='tandem'?(answer.halves||[])[own[0].slots[0].endsWith('A')?0:1]:answer);
  const circuits=state.circuits.map(c=>own.includes(c)&&patch?{...c,...patch}:c);
  return {...state,circuits:validate(sortCircuits(circuits),{positions:state.positions}),done:[...state.done.filter(x=>x!==n),n]};
 }
 const cov=coveredFrom(state,n);if(cov)throw Error(`La position ${n} fait partie du disjoncteur ${designation(cov)}${cov.label?' ('+cov.label+')':''} : modifiez d’abord ce disjoncteur.`);
 const err=canPlace(state,n,answer.format);if(err)throw Error(err);
 const span={double:2,triple:3}[answer.format]||1;
 let circuits=resetPosition(state.circuits,n,state.positions);
 let done=state.done.filter(p=>p!==n);
 // Positions du dessous reprises par un double ou un triple : remises à zéro et retirées des réponses.
 for(let k=1;k<span;k++){const p=n+k*2;circuits=resetPosition(circuits,p,state.positions);done=done.filter(x=>x!==p);}
 const id=circuits.find(c=>slotPos(c.slots[0])===n).id;
 if(span>1)circuits=reshape(circuits,id,answer.format,state.positions);
 if(answer.format==='tandem'){
  circuits=reshape(circuits,id,'tandem',state.positions);
  const a=circuits.find(c=>c.slots[0]===`${n}A`),b=circuits.find(c=>c.slots[0]===`${n}B`);
  const [ha={},hb={}]=answer.halves||[];
  circuits=circuits.map(c=>c===a?{...c,...fields(ha)}:c===b?{...c,...fields(hb)}:c);
 }else if(answer.format==='empty'){
  circuits=circuits.map(c=>c.id===id?{...c,status:'Libre',vacant:true}:c);
 }else if(answer.format!=='unknown'){
  circuits=circuits.map(c=>c.id===id?{...c,...fields(answer)}:c);
 }
 circuits=validate(sortCircuits(circuits),{positions:state.positions});
 return {...state,circuits,done:[...done,n]};
}
/**
 * Passe à « Identifié » les disjoncteurs dont l'utilisateur a confirmé la position (réponse à une question de l'assistant IA).
 * answered : Map position → format de la réponse ; « je ne sais pas » et « espace vide » ne confirment rien.
 */
export function promoteAnswered(state,answered){
 const ids=new Set();
 for(const [n,fmt] of answered){
  if(fmt==='unknown'||fmt==='empty')continue;
  const cs=isSplit(state,n)?ownHalves(state,n):state.circuits.filter(c=>slotPos(c.slots[0])===n);
  for(const c of cs)if(!c.vacant&&(c.label||c.amps!=null))ids.add(c.id);
 }
 return state.circuits.map(c=>ids.has(c.id)&&c.status!=='Identifié'?{...c,status:'Identifié'}:c);
}
// Toutes les positions restantes (non décrites) deviennent des espaces vides.
export function fillRestEmpty(state,from){
 let s=state;
 for(let p=from;p&&p<=s.positions;p=nextPosition(s,p)){
  if(s.done.includes(p))continue;
  s=answerPosition(s,p,{format:'empty'});
 }
 return s;
}
// Réponse actuelle pour la position n (pour revenir en arrière avec les champs déjà remplis).
export function currentAnswer(state,n){
 if(isSplit(state,n)){
  const c=ownHalves(state,n)[0];
  if(!c||!state.done.includes(n))return null;
  if(c.vacant)return {format:'empty'};
  if(!c.label&&c.amps==null&&!c.protection)return {format:'unknown'};
  return {format:'single',amps:c.amps,label:c.label,protection:c.protection,usage:c.usage};
 }
 const cs=state.circuits.filter(c=>slotPos(c.slots[0])===n);
 if(!state.done.includes(n)||!cs.length)return null;
 if(cs.length===2&&cs.every(c=>c.slots.length===1)){const [a,b]=cs.sort((x,y)=>x.slots[0]<y.slots[0]?-1:1);return {format:'tandem',halves:[a,b].map(c=>({amps:c.amps,label:c.label,protection:c.protection,usage:c.usage}))};}
 const c=cs[0];
 if(c.vacant)return {format:'empty'};
 const poles=new Set(c.slots.map(slotPos)).size;
 const format=poles===3?'triple':poles===2?'double':'single';
 if(!c.label&&c.amps==null&&!c.protection&&format==='single')return {format:'unknown'};
 return {format,amps:c.amps,label:c.label,protection:c.protection,usage:c.usage};
}

// Vérifications finales : appareils déclarés sans disjoncteur, appareils 240 V sur un disjoncteur simple.
export function findCircuitFor(state,appliance){return state.circuits.filter(c=>appliance.re.test(c.label||''));}
export function checkAppliances(state,owned=[]){
 const out=[];
 for(const ap of APPLIANCES.filter(a=>owned.includes(a.id))){
  const found=findCircuitFor(state,ap);
  if(!found.length){out.push({type:'missing',appliance:ap,text:`${ap.label} : aucun disjoncteur ne porte ce nom.`});continue;}
  for(const c of found){
   const poles=new Set(c.slots.map(slotPos)).size;
   if(ap.volts===240&&poles<2&&c.slots.length>1)out.push({type:'poles',appliance:ap,circuit:c.id,text:`${ap.label} sur un disjoncteur simple (${designation(c)}) : ces appareils sont normalement alimentés en 240 V par un disjoncteur double. Vérifiez si la manette est reliée à sa voisine du dessous.`});
  }
 }
 return out;
}
// Attribue un appareil à un circuit (désignation ajoutée si vide).
export function assignAppliance(state,circuitId,appliance){
 const short=appliance.label.split(' ou ')[0].replace(/ électrique$/,'');
 const circuits=state.circuits.map(c=>c.id!==circuitId?c:{...c,label:c.label?`${c.label} + ${short}`.slice(0,100):short,usage:c.label?c.usage:guessUsage(short),status:'Identifié'});
 return {...state,circuits};
}
export function progress(state){
 let total=0,done=0;
 for(let p=1;p<=state.positions;p++){if(coveredFrom(state,p))continue;total++;if(state.done.includes(p))done++;}
 return {total,done,percent:total?Math.round(done/total*100):0};
}
