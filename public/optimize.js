// Optimisation de la disposition d'un panneau en conception : calcul déterministe (aucune IA).
// Produit un NOUVEAU répertoire de circuits (le panneau d'origine n'est pas touché) et un résumé comparatif.
//   opts : {pair:boolean (jumeler), sort:''|'asc'|'desc', reserve:number (espaces réservés à l'expansion), tandemMax:20, tandemOk:boolean}
import {breakerUnits} from './units.js';
import {slotPos,designation,formatOf,resize} from './model.js';

const letter=s=>s.slice(-1);
const isReserved=c=>!!c.vacant&&!!c.reserved;
// Fiche qui occupe réellement un disjoncteur (une case « Libre » vide n'en est pas une).
const live=c=>!c.vacant&&!!(c.label||c.room||c.notes||c.exceptions||c.status==='Identifié'||c.amps!=null||c.breakerRef||(c.loads&&c.loads.length)||(c.tags&&Object.values(c.tags).some(a=>a.length)));

// Regroupe les circuits en disjoncteurs physiques. Les cases vides sont ignorées (elles seront recréées) ;
// les obturateurs ordinaires disparaissent, les réservations existantes sont conservées.
function collectUnits(circuits){
 const byId=new Map(circuits.map(c=>[c.id,c]));
 const taken=new Set(),out=[];
 const add=(cs,kind,pinned=false)=>{
  cs.forEach(c=>taken.add(c.id));
  const p0=Math.min(...cs.flatMap(c=>c.slots.map(slotPos)));
  const cells=cs.map(c=>({c,cells:c.slots.map(s=>({dp:slotPos(s)-p0,l:letter(s)}))}));
  const offsets=[...new Set(cells.flatMap(x=>x.cells.map(y=>y.dp)))].sort((a,b)=>a-b);
  const amps=cs.map(c=>c.amps).filter(a=>a!=null);
  out.push({kind,p0,cells,offsets,amps,key:amps.length?Math.max(...amps):null,pinned,reserved:cs.every(isReserved)});
 };
 for(const u of breakerUnits(circuits)){
  const cs=u.ids.map(i=>byId.get(i)).filter(Boolean);
  if(!cs.length||cs.every(c=>c.vacant&&!c.reserved))continue;
  add(cs,u.kind,u.kind==='other'||u.mixedRefs);
 }
 // Fiches décrites mais sans disjoncteur reconnu (notes, pièce…) : conservées telles quelles.
 for(const c of circuits){
  if(taken.has(c.id))continue;
  if(isReserved(c)||live(c))add([c],formatOf(c)==='tandem'?'other':'single',formatOf(c)==='tandem');
 }
 return out;
}


const pairKey=(a,b)=>[a,b].sort((x,y)=>x-y).join('/');
const quadKey=(a,x,b)=>pairKey(a,b)+'|'+x;
const plain=u=>!u.reserved&&!u.pinned&&u.key!=null&&(!u.cells[0].c.protection||u.cells[0].c.protection==='Standard')&&!u.cells[0].c.vacant;
const eligibleSingle=u=>plain(u)&&u.kind==='single'&&u.cells.length===1&&u.cells[0].cells.length===2&&u.offsets.length===1;
const eligibleDouble=u=>plain(u)&&u.kind==='double'&&u.cells.length===1&&u.cells[0].cells.length===4&&u.offsets.length===2&&u.offsets[1]-u.offsets[0]===2;

/**
 * opts : {pair:boolean (jumeler : tandem et quad), sort:''|'asc'|'desc'|'space', reserve:number, tandemMax:20, tandemOk:boolean,
 *   catalog:null | {tandem:Map('15/20'→réf), quad:Map('15/20|30'→réf), maxCircuits:number|null, label:string}}
 * Avec `catalog` (bibliothèque de produits, déjà filtrée sur la famille et la compatibilité du panneau), seuls les jumelés et quads
 * qui existent réellement pour ce panneau sont proposés, avec leur référence. Sans catalogue : règle générale (≤ tandemMax A), non vérifiée.
 * sort 'space' : ordre libre pour gagner de l'espace (disjoncteurs multipolaires posés d'abord, alignés dans leur colonne).
 */
export function optimizeLayout(panel,opts={}){
 const {pair=false,sort='',reserve=0,tandemMax=20,catalog=null}=opts;
 const tandemOk=opts.tandemOk??panel.details?.tandem!==false;
 const N=panel.positions;
 const notes=[];
 let units=collectUnits(panel.circuits);
 const before=layoutStats(panel.circuits,N);
 const origin=new Map();units.forEach(u=>origin.set(u,u.cells.map(x=>x.c.slots.slice())));
 const products=new Map(); // unité → référence de disjoncteur

 let tandems=0,quads=0;
 if(pair){
  const used=new Set();
  const canTandem=catalog?catalog.tandem.size>0:tandemOk;
  const canQuad=catalog?catalog.quad.size>0:false;
  if(catalog&&!canTandem&&!canQuad)notes.push(`Aucun disjoncteur jumelé ni quad compatible avec ${catalog.label||'ce modèle de panneau'} dans la bibliothèque : aucun jumelage proposé.`);
  else if(!catalog&&!tandemOk)notes.push('Ce panneau n’accepte pas les disjoncteurs jumelés : aucun jumelage proposé.');
  // 1. Quads : deux unipolaires + un bipolaire dans 2 espaces (au lieu de 4).
  if(canQuad){
   const singles=units.filter(eligibleSingle).sort((a,b)=>a.key-b.key||a.p0-b.p0);
   for(const d of units.filter(eligibleDouble).sort((a,b)=>a.p0-b.p0)){
    const x=d.cells[0].c.amps;if(x==null)continue;
    let found=null;
    outer:for(let i=0;i<singles.length;i++){const a=singles[i];if(used.has(a))continue;
     for(let j=i+1;j<singles.length;j++){const b=singles[j];if(used.has(b))continue;
      const ref=catalog.quad.get(quadKey(a.key,x,b.key));if(ref){found=[a,b,ref];break outer;}}}
    if(!found)continue;
    const [a,b,ref]=found;used.add(a);used.add(b);used.add(d);
    const ca=a.cells[0].c,cc=d.cells[0].c,cb=b.cells[0].c;
    const q={kind:'quad',p0:Math.min(a.p0,b.p0,d.p0),offsets:[0,2],amps:[ca.amps,cc.amps,cb.amps],key:Math.max(ca.amps,cc.amps,cb.amps),pinned:false,reserved:false,
     cells:[{c:ca,cells:[{dp:0,l:'A'}]},{c:cc,cells:[{dp:0,l:'B'},{dp:2,l:'A'}]},{c:cb,cells:[{dp:2,l:'B'}]}]};
    origin.set(q,[ca.slots.slice(),cc.slots.slice(),cb.slots.slice()]);products.set(q,ref);units.push(q);quads++;
   }
  }
  // 2. Jumelés : deux unipolaires dans 1 espace.
  if(canTandem){
   const pool=units.filter(u=>eligibleSingle(u)&&!used.has(u)&&(catalog||u.key<=tandemMax)).sort((a,b)=>a.key-b.key||a.p0-b.p0);
   for(let i=0;i<pool.length;i++){
    const a=pool[i];if(used.has(a))continue;
    let mate=null,ref=null;
    for(let j=i+1;j<pool.length;j++){const b=pool[j];if(used.has(b))continue;
     if(catalog){ref=catalog.tandem.get(pairKey(a.key,b.key));if(!ref)continue;}
     mate=b;break;}
    if(!mate)continue;
    used.add(a);used.add(mate);
    const ca=a.cells[0].c,cb=mate.cells[0].c;
    const t={kind:'tandem',p0:Math.min(a.p0,mate.p0),offsets:[0],amps:[ca.amps,cb.amps],key:Math.max(ca.amps,cb.amps),pinned:false,reserved:false,
     cells:[{c:ca,cells:[{dp:0,l:'A'}]},{c:cb,cells:[{dp:0,l:'B'}]}]};
    origin.set(t,[ca.slots.slice(),cb.slots.slice()]);if(ref)products.set(t,ref);units.push(t);tandems++;
   }
  }
  units=units.filter(u=>!used.has(u));
  if(!tandems&&!quads&&(canTandem||canQuad))notes.push('Aucune combinaison de disjoncteurs jumelables dans ce panneau (calibres ou protections incompatibles).');
  if(tandems||quads){
   if(catalog)notes.push(`Références vérifiées dans la bibliothèque pour ${catalog.label||'ce modèle'} : ${[...products.values()].filter((v,i,a)=>a.indexOf(v)===i).join(', ')}. Les anciennes références de ces disjoncteurs sont remplacées dans le scénario.`);
   else notes.push('Compatibilité des jumelés non vérifiée (aucun modèle de panneau choisi ou bibliothèque non disponible) : vérifiez-la avec le fabricant.');
   notes.push('Certains panneaux limitent les positions où poser des jumelés ou des quads : confirmez avec la fiche du modèle.');
  }
  if(catalog?.maxCircuits!=null){
   const poles=panel.circuits.filter(c=>!c.vacant&&(c.label||c.amps!=null)).reduce((n,c)=>n+Math.max(1,new Set(c.slots.map(slotPos)).size),0);
   if(poles>catalog.maxCircuits)notes.push(`Ce panneau est limité à ${catalog.maxCircuits} circuits ; le répertoire en compte déjà environ ${poles}.`);
  }
 }

 // 3. Ordre de pose.
 const rank=u=>u.reserved?9:1;
 const cmpPos=(a,b)=>a.p0-b.p0;
 const keyOf=u=>u.key==null?(sort==='desc'?-1:1e9):u.key;
 const span=u=>u.offsets.length;
 units.sort((a,b)=>rank(a)-rank(b)||(sort==='asc'?keyOf(a)-keyOf(b)||cmpPos(a,b):sort==='desc'?keyOf(b)-keyOf(a)||cmpPos(a,b):sort==='space'?span(b)-span(a)||keyOf(a)-keyOf(b)||cmpPos(a,b):cmpPos(a,b)));

 // 4. Pose : les disjoncteurs spéciaux restent en place ; les autres sont placés au premier endroit libre.
 const free=new Array(N+1).fill(true);free[0]=false;
 const placed=[];
 const fits=(u,p)=>u.offsets.every(o=>{const n=p+o;return n>=1&&n<=N&&free[n];});
 const put=(u,p)=>{u.offsets.forEach(o=>{free[p+o]=false;});u.at=p;placed.push(u);};
 for(const u of units.filter(x=>x.pinned)){if(!fits(u,u.p0))return {error:`Le disjoncteur spécial en position ${u.p0} ne peut pas rester en place.`};put(u,u.p0);}
 for(const u of units.filter(x=>!x.pinned)){
  let p=1;while(p<=N&&!fits(u,p))p++;
  if(p>N)return {error:'Les disjoncteurs ne tiennent pas dans le panneau avec cette disposition. Essayez l’ordre libre (économie d’espace) ou moins d’espaces réservés.'};
  put(u,p);
 }
 // 5. Espaces réservés à l'expansion : les derniers espaces libres.
 let reserved=0;
 const want=Math.max(0,Math.min(reserve|0,N));
 for(let n=N;n>=1&&reserved<want;n--)if(free[n]){
  free[n]=false;reserved++;
  placed.push({kind:'reserve',at:n,offsets:[0],cells:[{c:{id:'r'+n,slots:[],label:'',room:'',usage:'Autre',amps:null,status:'Libre',notes:'Espace réservé pour une expansion future.',exceptions:'',vacant:true,reserved:true},cells:[{dp:0,l:'A'},{dp:0,l:'B'}]}]});
 }
 if(want&&reserved<want)notes.push(`Seulement ${reserved} espace(s) libre(s) ont pu être réservés (demandé : ${want}).`);

 // 6. Reconstruction des circuits aux nouvelles positions.
 const out=[];const moves=[];
 for(const u of placed){
  const ref=products.get(u);
  for(const {c,cells} of u.cells){
   const slots=cells.map(({dp,l})=>`${u.at+dp}${l}`);
   out.push({...c,slots,...(ref?{breakerRef:ref}:{})});
  }
  if(u.kind!=='reserve'){
   const was=origin.get(u);const nowSlots=u.cells.map(x=>x.cells.map(({dp,l})=>`${u.at+dp}${l}`));
   if(ref||JSON.stringify(was)!==JSON.stringify(nowSlots)){
    const d=u.cells.map((x,i)=>designation({slots:was[i]})).join(' + ');
    moves.push({label:u.cells.map(x=>x.c.label||'(sans désignation)').join(' + '),amps:u.amps,kind:u.kind,product:ref||'',from:d,to:u.cells.map((x,i)=>designation({slots:nowSlots[i]})).join(' + ')});
   }
  }
 }
 let circuits;
 try{circuits=resize(out,N);}catch(e){return {error:e.message};}
 const after=layoutStats(circuits,N);
 return {circuits,before,after,moves,tandems,quads,notes,summary:recommend({before,after,moves,tandems,quads,sort,reserved,pair})};
}

// Statistiques d'une disposition : espaces occupés, libres, réservés.
export function layoutStats(circuits,N){
 const occ=new Set(),res=new Set();let breakers=0,tandemSpaces=0;
 for(const c of circuits){
  if(c.vacant&&!c.reserved)continue;
  const pos=[...new Set(c.slots.map(slotPos))];
  if(c.reserved){pos.forEach(p=>res.add(p));continue;}
  if(!live(c))continue;
  pos.forEach(p=>occ.add(p));breakers++;
  if(c.slots.length===1)tandemSpaces++;
 }
 return {positions:N,used:occ.size,reserved:res.size,free:N-occ.size-res.size,breakers,halves:tandemSpaces};
}
function recommend({before,after,moves,tandems,quads,sort,reserved,pair}){
 const parts=[];
 const gained=before.free-after.free+ (before.reserved-after.reserved);
 const freed=after.free+after.reserved-(before.free+before.reserved);
 parts.push(`Espaces occupés : ${before.used} → ${after.used} sur ${after.positions}.`);
 if(pair)parts.push(tandems||quads?`${tandems} jumelé(s) et ${quads} quad(s) créé(s), ${freed>0?freed+' espace(s) libéré(s)':'aucun espace gagné'}.`:'Aucun jumelage possible.');
 if(sort==='space')parts.push('Ordre libre : disposition la plus compacte.');else if(sort)parts.push(`Disjoncteurs triés par ampérage ${sort==='asc'?'croissant':'décroissant'}.`);
 if(reserved)parts.push(`${reserved} espace(s) réservé(s) à l’expansion.`);
 parts.push(moves.length?`${moves.length} disjoncteur(s) déplacé(s).`:'Aucun déplacement nécessaire.');
 return parts.join(' ');
}

// Catalogue des jumelés et quads réellement utilisables dans ce panneau, d'après la bibliothèque de produits.
// Retourne null si on ne connaît ni le modèle ni la famille du panneau (règle générale non vérifiée).
export function buildCatalog(lib,det={}){
 if(!lib?.breakers)return null;
 const model=lib.panels?.find(p=>p.cat===det.modelId);
 const family=det.family||model?.family;
 const accepts=det.accepts?.length?det.accepts:model?.accepts?.length?model.accepts:family?[family]:null;
 if(!accepts)return null;
 const tandemAllowed=model?model.tandem:det.tandem!==false;
 const tandem=new Map(),quad=new Map();
 const ok=b=>accepts.includes(b.family)&&b.protection==='Standard'&&!b.smart&&!b.surge&&!(b.neutre==='PoN'&&det.pon===false);
 const better=(cur,b)=>!cur||(det.pon===true&&b.neutre==='PoN'&&cur.neutre!=='PoN');
 const tmp=new Map();
 for(const b of lib.breakers){
  if(!ok(b)||!tandemAllowed)continue;
  if(b.kind==='tandem'&&b.amps.length===2){const k='t'+pairKey(b.amps[0],b.amps[1]);if(better(tmp.get(k),b))tmp.set(k,b);}
  if(b.kind==='quad'&&b.amps.length===3){const k='q'+quadKey(b.amps[0],b.amps[1],b.amps[2]);if(better(tmp.get(k),b))tmp.set(k,b);}
 }
 for(const [k,b] of tmp)(k[0]==='t'?tandem:quad).set(k.slice(1),b.cat);
 return {tandem,quad,maxCircuits:det.maxCircuits??model?.circuits??null,label:det.modelId?`le modèle ${det.modelId}`:`la famille ${accepts.join('/')}`};
}
