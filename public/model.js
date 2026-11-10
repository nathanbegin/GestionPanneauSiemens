// Modèle partagé navigateur / serveur / mobile.
// Un panneau comporte N positions numérotées (impaires à gauche, paires à droite).
// Chaque position a deux demi-emplacements A et B (disjoncteurs jumelés / tandem).
import {LOAD_CATEGORIES,VOLTAGES,WIRE_TABLE,WIRE_TYPES,FAMILY_IDS,PANEL_STATES,SERVICE_CONDUCTORS,SERVICE_MATERIALS,SERVICE_ROUTES} from './catalog.js';
export const APP_VERSION='2.16.0';
export const usages=['Éclairage','Prises','Électroménager','Chauffage','Extérieur','Autre','Chauffe-eau','Climatisation','Borne de recharge','Sous-panneau'];
export const usageOrder=['Éclairage','Prises','Électroménager','Chauffage','Chauffe-eau','Climatisation','Borne de recharge','Sous-panneau','Extérieur','Autre'];
export const states=['À confirmer','Identifié','Libre','Non visible'];
export const ampsList=[10,15,20,25,30,35,40,45,50,60,70,80,90,100,110,125,150,175,200,225];
export const protections=['Standard','DDFT','Anti-arc','DDFT + anti-arc','Protection équipement'];
export const panelKinds=['Principal','Sous-panneau','Distribution','Temporaire / chantier','Autre'];
export const voltages=['120/240 V monophasé','120/208 V triphasé','347/600 V triphasé','Autre'];
export const breakerFormats={single:'Unipolaire · 1 position',double:'Bipolaire · 2 positions (n et n+2)',triple:'Tripolaire · 3 positions',tandem:'Jumelé · 2 demi-positions A / B'};
export const MIN_POSITIONS=2,MAX_POSITIONS=84,LEGACY_POSITIONS=40;
// Suggestions d'amélioration envoyées par les utilisateurs (console d'administration → Suggestions).
export const FEEDBACK_CATEGORIES=['Suggestion','Problème','Question','Autre'];
export const FEEDBACK_STATUSES={nouveau:'Nouvelle','a-l-etude':'À l’étude',planifie:'Planifiée',fait:'Faite',refuse:'Refusée'};

const emptyCircuit=(id,slots)=>({id,slots,label:'',room:'',usage:'Autre',amps:null,status:'À confirmer',notes:'',exceptions:''});
export const blank=(positions=32)=>Array.from({length:positions},(_,i)=>emptyCircuit(String(i+1),[`${i+1}A`,`${i+1}B`]));
export const slotPos=s=>parseInt(s,10);
// Rang vertical d'un demi-emplacement dans sa colonne.
export const slotOrder=s=>{const n=slotPos(s);return Math.floor((n-1)/2)*2+(s.endsWith('B')?1:0);};
const validSlot=(s,max)=>typeof s==='string'&&/^[1-9][0-9]?[AB]$/.test(s)&&slotPos(s)<=max;

export function validate(data,{positions=LEGACY_POSITIONS}={}){
 if(!Number.isInteger(positions)||positions<MIN_POSITIONS||positions>MAX_POSITIONS)throw Error('Nombre de positions invalide.');
 if(!Array.isArray(data)||!data.length||data.length>Math.max(80,positions*2))throw Error('Répertoire invalide.');
 const ids=new Set(),used=new Set();
 for(const c of data){
  if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||c.id.length>30)throw Error('Identifiant invalide.');ids.add(c.id);
  if(!Array.isArray(c.slots)||!c.slots.length||c.slots.length>6)throw Error('Emplacements invalides.');
  let previous;
  for(const s of c.slots){
   if(!validSlot(s,positions)||used.has(s))throw Error('Emplacement invalide ou occupé : '+s);used.add(s);
   const n=slotPos(s),order=slotOrder(s);
   if(previous&&(n%2!==previous.parity||order!==previous.order+1))throw Error('Les emplacements doivent être consécutifs dans la même colonne.');
   previous={parity:n%2,order};
  }
  for(const [k,max] of [['label',100],['room',80],['notes',2000]])if(typeof c[k]!=='string'||c[k].length>max)throw Error('Champ invalide : '+k);
  if(c.exceptions!==undefined&&(typeof c.exceptions!=='string'||c.exceptions.length>2000))throw Error('Champ invalide : exceptions');
  if(c.protection!==undefined&&!protections.includes(c.protection))throw Error('Protection invalide.');
  if(c.tags!==undefined){if(!c.tags||typeof c.tags!=='object'||Array.isArray(c.tags))throw Error('Tags invalides.');for(const k of ['locations','functions','devices']){const a=c.tags[k];if(!Array.isArray(a)||a.length>30||a.some(t=>typeof t!=='string'||!t.trim()||t.length>80))throw Error('Tags invalides : '+k);}}
  if(c.loads!==undefined){
   if(!Array.isArray(c.loads)||c.loads.length>30)throw Error('Liste de charges invalide.');
   for(const l of c.loads){
    if(!l||typeof l!=='object'||typeof l.name!=='string'||!l.name.trim()||l.name.length>80)throw Error('Nom de charge invalide.');
    if(l.id!==undefined&&(typeof l.id!=='string'||l.id.length>40))throw Error('Charge invalide.');
    if(typeof l.w!=='number'||!isFinite(l.w)||l.w<0||l.w>200000)throw Error('Puissance invalide : '+l.name);
    if(!VOLTAGES.includes(l.v))throw Error('Tension invalide : '+l.name);
    if(!Number.isInteger(l.qty)||l.qty<1||l.qty>100)throw Error('Quantité invalide : '+l.name);
    if(!LOAD_CATEGORIES[l.cat]||typeof l.cont!=='boolean')throw Error('Catégorie de charge invalide : '+l.name);
   }
  }
  if(c.wire!==undefined){const w=c.wire;if(!w||typeof w!=='object'||(w.gauge&&!WIRE_TABLE.some(x=>x.gauge===w.gauge))||(w.type&&!WIRE_TYPES.includes(w.type))||(w.length!=null&&(typeof w.length!=='number'||w.length<0||w.length>1000)))throw Error('Conducteur invalide.');}
  if(c.vacant!==undefined&&typeof c.vacant!=='boolean')throw Error('Champ invalide : vacant');
  if(c.breakerRef!==undefined&&(typeof c.breakerRef!=='string'||c.breakerRef.length>40))throw Error('Référence de disjoncteur invalide.');
  for(const k of ['originalLabel','originalNotes','surveyDate'])if(c[k]!==undefined&&(typeof c[k]!=='string'||c[k].length>3000))throw Error('Historique invalide.');
  if(!usages.includes(c.usage)||!states.includes(c.status)||!(c.amps===null||ampsList.includes(c.amps)))throw Error('Caractéristiques invalides.');
 }
 return data;
}
export function normalize(data,opts){
 if(!Array.isArray(data))throw Error('Répertoire invalide.');
 if(data[0]?.slots)return validate(data.map(c=>({...c,exceptions:c.exceptions??''})),opts);
 // Format v1 : {position, poles}.
 const claimed=new Set(data.filter(c=>c.poles===2).map(c=>c.position+2));
 return validate(data.filter(c=>!claimed.has(c.position)).map(c=>({id:String(c.position),slots:[`${c.position}A`,`${c.position}B`,...(c.poles===2?[`${c.position+2}A`,`${c.position+2}B`]:[])],label:c.label,room:c.room,usage:c.usage,amps:c.amps,status:c.status==='À identifier'?'À confirmer':c.status,notes:c.notes,exceptions:''})),opts);
}
// Plus haute position utilisée par un répertoire (utile à l'import).
export const highestPosition=data=>Math.max(0,...data.flatMap(c=>(c.slots||[]).map(slotPos)));
export const designation=c=>{
 const s=c.slots,n=slotPos(s[0]);
 if(s.length===1)return s[0];
 if(s.length===2&&slotPos(s[1])===n)return String(n);
 const positions=[...new Set(s.map(slotPos))];
 return s.length%2===0&&s[0].endsWith('A')?positions.join('/'):s.join(' / ');
};
export const sortCircuits=list=>[...list].sort((a,b)=>slotPos(a.slots[0])*2+(a.slots[0].endsWith('B')?1:0)-(slotPos(b.slots[0])*2+(b.slots[0].endsWith('B')?1:0)));
export const hasData=c=>!!(c.label||c.room||c.notes||c.exceptions||c.status==='Identifié'||c.status==='Libre'||(c.tags&&Object.values(c.tags).some(a=>a.length)));
export const formatOf=c=>{
 if(c.slots.length===1)return 'tandem';
 const p=new Set(c.slots.map(slotPos)).size;
 return p>=3?'triple':p===2?'double':'single';
};
// Actions groupées sur plusieurs circuits (onglet Panneau).
// vacant : espace inutilisé, aucun disjoncteur installé (obturateur).
// free   : disjoncteur présent mais libre (aucune charge).
// set    : modifie les champs donnés (status, amps, protection, room, usage).
// clear  : remet la fiche à zéro (positions conservées).
export const BULK_FIELDS=['status','amps','protection','room','usage'];
export function bulkApply(circuits,ids,action={}){
 const sel=new Set(ids);
 return circuits.map(c=>{
  if(!sel.has(c.id))return c;
  const base=emptyCircuit(c.id,c.slots);
  if(action.type==='vacant')return {...base,status:'Libre',vacant:true,notes:c.notes||''};
  if(action.type==='clear')return base;
  if(action.type==='free'){const {vacant,loads,...rest}=c;return {...rest,label:'',usage:'Autre',status:'Libre'};}
  if(action.type==='set'){
   const out={...c};
   for(const k of BULK_FIELDS)if(action.patch&&action.patch[k]!==undefined){
    const v=action.patch[k];
    if(k==='status'&&!states.includes(v))throw Error('Statut invalide.');
    if(k==='amps'&&!(v===null||ampsList.includes(v)))throw Error('Calibre invalide.');
    if(k==='protection'&&!protections.includes(v))throw Error('Protection invalide.');
    if(k==='usage'&&!usages.includes(v))throw Error('Usage invalide.');
    if(k==='room'&&(typeof v!=='string'||v.length>80))throw Error('Pièce invalide.');
    out[k]=v;
   }
   if(out.vacant&&(out.amps||out.status!=='Libre'))delete out.vacant;
   return out;
  }
  throw Error('Action groupée inconnue.');
 }).map(c=>{const o={...c};for(const k of Object.keys(o))if(o[k]===undefined)delete o[k];return o;});
}
const freeId=(ids,base)=>{if(!ids.has(base))return base;for(let i=2;;i++)if(!ids.has(base+'-'+i))return base+'-'+i;};

// Change le format d'un disjoncteur en conservant sa fiche.
export function reshape(circuits,id,format,positions){
 const c=circuits.find(x=>x.id===id);if(!c)throw Error('Circuit introuvable.');
 const p=slotPos(c.slots[0]),half=c.slots.length===1?c.slots[0].slice(-1):'';
 const span={single:1,double:2,triple:3,tandem:1}[format];if(!span)throw Error('Format inconnu.');
 if(format==='tandem'&&half)return circuits;
 const target=[];
 for(let k=0;k<span;k++){const n=p+k*2;if(n>positions)throw Error(`La position ${n} n’existe pas sur ce panneau (${positions} positions).`);target.push(`${n}A`,`${n}B`);}
 const mine=format==='tandem'?[`${p}A`]:target;
 const ids=new Set(circuits.map(x=>x.id));
 const out=[];
 for(const other of circuits){
  if(other===c)continue;
  const overlap=other.slots.some(s=>target.includes(s));
  if(!overlap){out.push(other);continue;}
  // Le second demi-emplacement d'un jumelé reste en place si on garde le format jumelé.
  if(format==='tandem'&&other.slots.length===1&&other.slots[0]===`${p}B`){out.push(other);continue;}
  if(hasData(other))throw Error(`La position ${designation(other)} contient déjà « ${other.label||other.status} ». Videz cette fiche avant de la fusionner.`);
  ids.delete(other.id);
  for(const s of other.slots)if(!target.includes(s)){const nid=freeId(ids,'c'+s);ids.add(nid);out.push(emptyCircuit(nid,[s]));}
 }
 out.push({...c,slots:mine});
 if(format==='tandem'&&!out.some(x=>x.slots.includes(`${p}B`))){const nid=freeId(ids,p+'B');ids.add(nid);out.push(emptyCircuit(nid,[`${p}B`]));}
 // Libère les anciens emplacements.
 const freed=c.slots.filter(s=>!mine.includes(s)&&!out.some(x=>x.slots.includes(s)));
 const byPos=new Map();for(const s of freed){const n=slotPos(s);byPos.set(n,[...(byPos.get(n)||[]),s]);}
 for(const [n,slots] of byPos){
  if(slots.length===2){const nid=freeId(ids,String(n));ids.add(nid);out.push(emptyCircuit(nid,[`${n}A`,`${n}B`]));}
  else{const nid=freeId(ids,'c'+slots[0]);ids.add(nid);out.push(emptyCircuit(nid,slots));}
 }
 return validate(mergeHalves(sortCircuits(out)),{positions});
}
// ---------- Groupement de demi-emplacements adjacents (jumelé / bipolaire à cheval sur deux positions) ----------
// Demi-emplacement qui suit / précède dans la même colonne : 5A → 5B → 7A ; 7A → 5B → 5A.
export const nextSlot=s=>{const n=slotPos(s);return s.endsWith('A')?`${n}B`:`${n+2}A`;};
export const prevSlot=s=>{const n=slotPos(s);if(s.endsWith('B'))return `${n}A`;return n>2?`${n-2}B`:null;};
// Groupe de deux demi-emplacements sur deux positions différentes (ex. 5B + 7A).
export const isLinkedPair=c=>c.slots.length===2&&slotPos(c.slots[0])!==slotPos(c.slots[1]);
const meaningful=c=>!!(c.label||c.room||c.notes||c.exceptions||c.amps!=null||(c.tags&&Object.values(c.tags).some(a=>a.length))||c.loads?.length);
/** Voisins admissibles d'un circuit : demi-emplacements adjacents (même colonne) occupés par un circuit d'un seul emplacement. */
export function groupCandidates(circuits,id){
 const c=circuits.find(x=>x.id===id);if(!c||c.slots.length>=6)return [];
 const out=[];
 for(const [side,slot] of [['after',nextSlot(c.slots.at(-1))],['before',prevSlot(c.slots[0])]]){
  if(!slot)continue;
  const o=circuits.find(x=>x.slots.includes(slot));
  if(o&&o.id!==id&&o.slots.length===1)out.push({side,slot,id:o.id,label:o.label||'',hasData:meaningful(o)});
 }
 return out;
}
/** Fusionne deux circuits adjacents en un seul disjoncteur. Le circuit `id` est conservé ; sans `force`, refuse d'écraser deux fiches remplies. */
export function groupCircuits(circuits,id,otherId,positions,{force=false}={}){
 const c=circuits.find(x=>x.id===id),o=circuits.find(x=>x.id===otherId);
 if(!c||!o||c===o)throw Error('Circuit introuvable.');
 if(!force&&meaningful(c)&&meaningful(o))throw Error(`Les deux emplacements contiennent déjà une fiche (« ${c.label||'sans nom'} » et « ${o.label||'sans nom'} »). Videz l’une des deux avant de les grouper.`);
 const slots=[...c.slots,...o.slots].sort((a,b)=>slotOrder(a)-slotOrder(b));
 const keep=meaningful(c)||!meaningful(o)?c:o;
 const merged={...keep,id:c.id,slots};
 return validate(sortCircuits([...circuits.filter(x=>x!==c&&x!==o),merged]),{positions});
}
/** Sépare un groupe de deux demi-emplacements : le premier garde la fiche, le second redevient libre. */
export function ungroupCircuit(circuits,id,positions){
 const c=circuits.find(x=>x.id===id);
 if(!c||!isLinkedPair(c))throw Error('Ce circuit n’est pas un groupe de deux emplacements.');
 const [first,...rest]=c.slots;const ids=new Set(circuits.map(x=>x.id));
 const out=[...circuits.filter(x=>x!==c),{...c,slots:[first]}];
 for(const s of rest){const nid=freeId(ids,'c'+s);ids.add(nid);out.push(emptyCircuit(nid,[s]));}
 return validate(mergeHalves(sortCircuits(out)),{positions});
}
/** Paires de demi-emplacements adjacents (ex. 5B et 7A) qui ressemblent à un seul disjoncteur : même calibre et même désignation. */
export function suggestLinks(circuits){
 const norm=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const out=[];
 for(const a of circuits){
  if(a.slots.length!==1||a.vacant||a.amps==null||!a.label||!a.slots[0].endsWith('B'))continue;
  const b=circuits.find(x=>x.slots.length===1&&x.slots[0]===nextSlot(a.slots[0]));
  if(b&&!b.vacant&&b.amps===a.amps&&norm(b.label)===norm(a.label))out.push({a:a.id,b:b.id,slots:[a.slots[0],b.slots[0]],label:a.label,amps:a.amps});
 }
 return out;
}
// Regroupe deux demi-emplacements vides d'une même position en une position entière.
function mergeHalves(list){
 const out=[];
 for(const c of list){
  const prev=out.at(-1);
  if(prev&&prev.slots.length===1&&c.slots.length===1&&prev.slots[0].endsWith('A')&&c.slots[0]===slotPos(prev.slots[0])+'B'&&!hasData(prev)&&!hasData(c)&&prev.id.startsWith('c')&&c.id.startsWith('c')){out[out.length-1]={...prev,id:freeId(new Set(list.map(x=>x.id)),String(slotPos(prev.slots[0]))),slots:[prev.slots[0],c.slots[0]]};continue;}
  out.push(c);
 }
 return out;
}
// Une case peut recevoir un disjoncteur si elle n'a aucune description saisie (une case « Libre » vide compte comme libre).
const replaceable=c=>!(c.label||c.room||c.notes||c.exceptions||(c.loads&&c.loads.length)||(c.tags&&Object.values(c.tags).some(a=>a.length)));
const blankAt=(id,slots,extra={})=>({...emptyCircuit(id,slots),...extra});
// Place un disjoncteur de la bibliothèque à la position p.
// b : {kind:'single'|'double'|'triple'|'tandem'|'quad', amps:[...], protection, cat}
export function placeBreaker(circuits,p,b,positions){
 const span={single:1,double:2,triple:3,tandem:1,quad:2}[b.kind];
 if(!span)throw Error('Ce produit ne se place pas directement dans un espace (principal, accessoire ou format non pris en charge).');
 if(!Number.isInteger(p)||p<1||p+(span-1)*2>positions)throw Error(`Pas assez d’espaces à partir de la position ${p} (${span} espace${span>1?'s':''} requis dans la même colonne).`);
 const pos=Array.from({length:span},(_,k)=>p+k*2);
 const target=pos.flatMap(n=>[`${n}A`,`${n}B`]);
 const ids=new Set(circuits.map(c=>c.id));
 const out=[];
 for(const c of circuits){
  if(!c.slots.some(s=>target.includes(s))){out.push(c);continue;}
  if(!replaceable(c))throw Error(`La position ${designation(c)} est déjà utilisée par « ${c.label||c.status} ». Videz cette fiche ou choisissez un espace libre.`);
  ids.delete(c.id);
  for(const s of c.slots)if(!target.includes(s)){const nid=freeId(ids,'c'+s);ids.add(nid);out.push(emptyCircuit(nid,[s]));}
 }
 const a=b.amps||[];
 const extra=(amps)=>({amps:amps??null,...(b.protection&&b.protection!=='Standard'?{protection:b.protection}:{}),...(b.cat?{breakerRef:b.cat}:{})});
 const add=(base,slots,amps)=>{const nid=freeId(ids,base);ids.add(nid);out.push(blankAt(nid,slots,extra(amps)));};
 if(b.kind==='tandem'){add(`${p}A`,[`${p}A`],a[0]);add(`${p}B`,[`${p}B`],a[1]??a[0]);}
 else if(b.kind==='quad'){add(`${p}A`,[`${p}A`],a[0]);add(`${p}B`,[`${p}B`,`${p+2}A`],a[1]??a[0]);add(`${p+2}B`,[`${p+2}B`],a[2]??a[0]);}
 else add(String(p),target,a[0]);
 return validate(mergeHalves(sortCircuits(out)),{positions});
}
/**
 * Garnit un panneau existant avec les circuits lus par l'IA : ne remplit que les emplacements encore vides
 * (sauf `replace`, qui remplace aussi les circuits déjà décrits). Retourne {circuits, applied, skipped:[{slots,label,reason}]}.
 */
export function mergeScanned(existing,scanned,positions,{replace=false}={}){
 const protectedC=c=>hasData(c)||c.amps!=null||!!c.vacant||!!c.loads?.length;
 let out=existing.map(c=>({...c}));
 const ids=new Set(out.map(c=>c.id));
 let applied=0;const skipped=[];
 for(const sc of scanned.filter(c=>c.label||c.amps!=null||c.vacant)){
  if(sc.slots.some(s=>slotPos(s)>positions)){skipped.push({slots:sc.slots,label:sc.label||'',reason:'hors du panneau'});continue;}
  const hit=out.filter(c=>c.slots.some(s=>sc.slots.includes(s)));
  if(!replace&&hit.some(protectedC)){skipped.push({slots:sc.slots,label:sc.label||'',reason:'déjà décrit'});continue;}
  for(const c of hit)ids.delete(c.id);
  out=out.filter(c=>!hit.includes(c));
  for(const c of hit)for(const s of c.slots)if(!sc.slots.includes(s)){const nid=freeId(ids,'c'+s);ids.add(nid);out.push(emptyCircuit(nid,[s]));}
  const nid=freeId(ids,sc.id);ids.add(nid);out.push({...sc,id:nid});applied++;
 }
 return {circuits:validate(mergeHalves(sortCircuits(out)),{positions}),applied,skipped};
}
// Ajuste le nombre de positions d'un panneau.
export function resize(circuits,positions){
 if(!Number.isInteger(positions)||positions<MIN_POSITIONS||positions>MAX_POSITIONS||positions%2)throw Error(`Choisissez un nombre pair de positions entre ${MIN_POSITIONS} et ${MAX_POSITIONS}.`);
 const kept=[];
 for(const c of circuits){
  if(c.slots.every(s=>slotPos(s)<=positions)){kept.push(c);continue;}
  if(hasData(c))throw Error(`Le circuit ${designation(c)} (« ${c.label||c.status} ») dépasse ${positions} positions. Libérez-le d’abord.`);
  for(const s of c.slots.filter(s=>slotPos(s)<=positions))kept.push(emptyCircuit('c'+s,[s]));
 }
 const used=new Set(kept.flatMap(c=>c.slots)),ids=new Set(kept.map(c=>c.id));
 for(let n=1;n<=positions;n++){const a=`${n}A`,b=`${n}B`;
  if(!used.has(a)&&!used.has(b)){const id=freeId(ids,String(n));ids.add(id);kept.push(emptyCircuit(id,[a,b]));}
  else for(const s of [a,b])if(!used.has(s)){const id=freeId(ids,'c'+s);ids.add(id);kept.push(emptyCircuit(id,[s]));}
 }
 return validate(mergeHalves(sortCircuits(kept)),{positions});
}
export function stats(circuits){
 const total=circuits.length,identified=circuits.filter(c=>c.status==='Identifié').length,free=circuits.filter(c=>c.status==='Libre').length;
 const toConfirm=total-identified-free;
 return {total,identified,free,toConfirm,progress:total?Math.round((identified+free)/total*100):0};
}

export const tagGroups=['locations','functions','devices'];
export const fold=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLocaleLowerCase('fr');
export const allTags=c=>tagGroups.flatMap(k=>c.tags?.[k]||[]);
export const searchable=c=>fold([c.id,...c.slots,c.label,c.room,c.usage,c.notes,c.exceptions,c.protection||'',...allTags(c)].join(' '));

// Métadonnées d'un panneau.
const str=(v,max,name)=>{if(v==null)return '';if(typeof v!=='string')throw Error('Champ invalide : '+name);const t=v.trim();if(t.length>max)throw Error(`Le champ « ${name} » dépasse ${max} caractères.`);return t;};
export function cleanPanelMeta(input={}){
 const name=str(input.name,100,'Nom');if(!name)throw Error('Donnez un nom au panneau.');
 const kind=input.kind||'Principal';if(!panelKinds.includes(kind))throw Error('Type de panneau invalide.');
 const d=input.details||{};
 const mainAmps=d.mainAmps===''||d.mainAmps==null?null:Number(d.mainAmps);
 if(mainAmps!==null&&(!Number.isInteger(mainAmps)||mainAmps<15||mainAmps>1200))throw Error('Calibre principal invalide.');
 const voltage=d.voltage||voltages[0];if(!voltages.includes(voltage))throw Error('Tension invalide.');
 const surveyDate=str(d.surveyDate,10,'Date du relevé');if(surveyDate&&!/^\d{4}-\d{2}-\d{2}$/.test(surveyDate))throw Error('Date du relevé invalide.');
 const fedFrom=d.fedFrom==null||d.fedFrom===''?'':str(d.fedFrom,60,'Alimenté par');
 // Modèle choisi dans la bibliothèque : le serveur vérifie le numéro et réécrit l'instantané.
 const modelId=str(d.modelId,40,'Modèle du catalogue');if(modelId&&!/^[A-Za-z0-9][A-Za-z0-9.\-\/]{1,39}$/.test(modelId))throw Error('Numéro de modèle invalide.');
 const family=str(d.family||d.breakerFamily,12,'Famille');if(family&&!FAMILY_IDS.includes(family))throw Error('Famille de produits inconnue.');
 const maxCircuits=d.maxCircuits==null||d.maxCircuits===''?null:Number(d.maxCircuits);if(maxCircuits!==null&&(!Number.isInteger(maxCircuits)||maxCircuits<1||maxCircuits>200))throw Error('Nombre de circuits maximal invalide.');
 const modelInfo=str(d.modelInfo,160,'Description du modèle');
 const pon=d.pon===true?true:d.pon===false?false:null;
 const accepts=Array.isArray(d.accepts)?[...new Set(d.accepts.filter(x=>FAMILY_IDS.includes(x)))].slice(0,8):[];
 const livingArea=d.livingArea===''||d.livingArea==null?null:Number(d.livingArea);if(livingArea!==null&&(!Number.isFinite(livingArea)||livingArea<0||livingArea>10000))throw Error('Superficie invalide.');
 const basementArea=d.basementArea===''||d.basementArea==null?null:Number(d.basementArea);if(basementArea!==null&&(!Number.isFinite(basementArea)||basementArea<0||basementArea>10000))throw Error('Superficie du sous-sol invalide.');
 const state=d.state||'Existant';if(!PANEL_STATES.includes(state))throw Error('État du panneau invalide.');
 const serviceGauge=d.serviceGauge||'';if(serviceGauge&&!SERVICE_CONDUCTORS.some(w=>w.gauge===serviceGauge))throw Error('Calibre des conducteurs d’entrée invalide.');
 const serviceMaterial=serviceGauge?(d.serviceMaterial||'Cuivre'):'';if(serviceMaterial&&!SERVICE_MATERIALS.includes(serviceMaterial))throw Error('Matériau des conducteurs d’entrée invalide.');
 const serviceRoute=d.serviceRoute||'';if(serviceRoute&&!SERVICE_ROUTES.includes(serviceRoute))throw Error('Type d’entrée électrique invalide.');
 return {name,tag:str(input.tag,24,'Étiquette'),kind,location:str(input.location,140,'Emplacement'),
  details:{building:str(d.building,80,'Bâtiment'),brand:str(d.brand,60,'Marque'),model:str(d.model,60,'Modèle'),mainAmps,voltage,fedFrom,fedFromCircuit:str(d.fedFromCircuit,40,'Circuit d’alimentation'),surveyDate,surveyedBy:str(d.surveyedBy,100,'Relevé par'),notes:str(d.notes,2000,'Notes'),modelId,family,maxCircuits,tandem:d.tandem===false?false:maxCircuits==null?true:!!d.tandem,pon,accepts,modelInfo,livingArea,basementArea,state,serviceGauge,serviceMaterial,serviceRoute,serviceNotes:str(d.serviceNotes,300,'Notes sur l’entrée électrique')}};
}
export function cleanSite(input={}){
 const name=str(input.name,100,'Nom du site');if(!name)throw Error('Donnez un nom au site.');
 const postalCode=str(input.postalCode,12,'Code postal').toUpperCase();
 return {name,client:str(input.client,120,'Client'),street:str(input.street,160,'Adresse'),city:str(input.city,80,'Ville'),province:str(input.province,40,'Province')||'QC',postalCode,notes:str(input.notes,2000,'Notes')};
}
export const siteAddress=s=>[s.street,[s.city,s.province].filter(Boolean).join(' (')+(s.city&&s.province?')':''),s.postalCode].filter(Boolean).join(', ');
export const panelTitle=p=>(p.tag?p.tag+' · ':'')+p.name;

export function mergeSurvey(current,config){
 const byId=new Map(config.baseline.map(c=>[c.id,c]));const proposed=new Map(config.circuits.map(c=>[c.id,c]));
 return current.map(c=>{
 const base=byId.get(c.id),next=proposed.get(c.id);if(!base||!next||JSON.stringify(c.slots)!==JSON.stringify(base.slots))return c;
 const out={...c};
 // Do not replace tags or naming edited since the supplied snapshot.
 const unchanged=c.label===base.label&&c.notes===base.notes&&c.room===base.room&&c.usage===base.usage;
 if(c.label===base.label)out.label=next.label;
 if(c.notes===base.notes)out.notes=next.notes;
 if((c.exceptions||'')===(base.exceptions||''))out.exceptions=next.exceptions||'';
 if(unchanged&&!c.tags)out.tags=next.tags;
 if(!c.originalLabel)out.originalLabel=base.label;
 if(!c.originalNotes)out.originalNotes=base.notes;
 if(!c.surveyDate)out.surveyDate=next.surveyDate;
 return out;
 });
}
