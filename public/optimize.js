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

const spanOf=u=>u.offsets.length;
const eligibleForTandem=u=>u.kind==='single'&&u.cells.length===1&&u.cells[0].cells.length===2&&u.offsets.length===1&&!u.reserved&&!u.pinned
 &&u.key!=null&&!u.cells[0].c.breakerRef&&(!u.cells[0].c.protection||u.cells[0].c.protection==='Standard')&&!u.cells[0].c.vacant;

export function optimizeLayout(panel,opts={}){
 const {pair=false,sort='',reserve=0,tandemMax=20,tandemOk=panel.details?.tandem!==false}=opts;
 const N=panel.positions;
 const notes=[];
 let units=collectUnits(panel.circuits);
 const before=layoutStats(panel.circuits,N);
 const origin=new Map();units.forEach(u=>origin.set(u,u.cells.map(x=>x.c.slots.slice())));

 // 1. Jumelage : deux disjoncteurs unipolaires de petit calibre partagent un même espace.
 let tandems=0;
 if(pair){
  if(!tandemOk)notes.push('Ce panneau n’accepte pas les disjoncteurs jumelés : aucun jumelage proposé.');
  else{
   const pool=units.filter(u=>eligibleForTandem(u)&&u.key<=tandemMax).sort((a,b)=>a.key-b.key||a.p0-b.p0);
   const used=new Set();
   for(let i=0;i+1<pool.length;i+=2){
    const a=pool[i],b=pool[i+1];used.add(a);used.add(b);
    const ca=a.cells[0].c,cb=b.cells[0].c;
    const merged={kind:'tandem',p0:Math.min(a.p0,b.p0),offsets:[0],amps:[ca.amps,cb.amps],key:Math.max(ca.amps,cb.amps),pinned:false,reserved:false,
     cells:[{c:ca,cells:[{dp:0,l:'A'}]},{c:cb,cells:[{dp:0,l:'B'}]}]};
    origin.set(merged,[ca.slots.slice(),cb.slots.slice()]);
    units.push(merged);tandems++;
   }
   units=units.filter(u=>!used.has(u));
   if(tandems)notes.push('Vérifiez que le nombre total de circuits ne dépasse pas le maximum du modèle de panneau (les jumelés ajoutent des circuits dans le même espace).');
   else notes.push('Aucune paire de disjoncteurs unipolaires de '+tandemMax+' A ou moins à jumeler.');
  }
 }

 // 2. Ordre de pose.
 const rank=u=>u.reserved?2:1;
 const cmpPos=(a,b)=>a.p0-b.p0;
 const keyOf=u=>u.key==null?(sort==='desc'?-1:1e9):u.key;
 units.sort((a,b)=>rank(a)-rank(b)||(sort==='asc'?keyOf(a)-keyOf(b)||cmpPos(a,b):sort==='desc'?keyOf(b)-keyOf(a)||cmpPos(a,b):cmpPos(a,b)));

 // 3. Pose : les disjoncteurs spéciaux (« autre ») restent en place ; les autres sont placés au premier endroit libre.
 const free=new Array(N+1).fill(true);free[0]=false;
 const placed=[];
 const fits=(u,p)=>u.offsets.every(o=>{const n=p+o;return n>=1&&n<=N&&free[n];});
 const put=(u,p)=>{u.offsets.forEach(o=>{free[p+o]=false;});u.at=p;placed.push(u);};
 for(const u of units.filter(x=>x.pinned)){if(!fits(u,u.p0))return {error:`Le disjoncteur spécial en position ${u.p0} ne peut pas rester en place.`};put(u,u.p0);}
 for(const u of units.filter(x=>!x.pinned)){
  let p=1;while(p<=N&&!fits(u,p))p++;
  if(p>N)return {error:'Les disjoncteurs ne tiennent pas dans le panneau avec cette disposition. Essayez sans tri, ou avec moins d’espaces réservés.'};
  put(u,p);
 }
 // 4. Espaces réservés à l'expansion : les derniers espaces libres.
 let reserved=0;
 const want=Math.max(0,Math.min(reserve|0,N));
 for(let n=N;n>=1&&reserved<want;n--)if(free[n]){
  free[n]=false;reserved++;
  placed.push({kind:'reserve',at:n,offsets:[0],cells:[{c:{id:'r'+n,slots:[],label:'',room:'',usage:'Autre',amps:null,status:'Libre',notes:'Espace réservé pour une expansion future.',exceptions:'',vacant:true,reserved:true},cells:[{dp:0,l:'A'},{dp:0,l:'B'}]}]});
 }
 if(want&&reserved<want)notes.push(`Seulement ${reserved} espace(s) libre(s) ont pu être réservés (demandé : ${want}).`);

 // 5. Reconstruction des circuits aux nouvelles positions.
 const out=[];const moves=[];
 for(const u of placed){
  for(const {c,cells} of u.cells){
   const slots=cells.map(({dp,l})=>`${u.at+dp}${l}`);
   out.push({...c,slots});
  }
  if(u.kind!=='reserve'){
   const was=origin.get(u);const nowSlots=u.cells.map(x=>x.cells.map(({dp,l})=>`${u.at+dp}${l}`));
   if(JSON.stringify(was)!==JSON.stringify(nowSlots)){
    const d=u.cells.map((x,i)=>designation({slots:was[i]})).join(' + ');
    moves.push({label:u.cells.map(x=>x.c.label||'(sans désignation)').join(' + '),amps:u.amps,kind:u.kind,from:d,to:u.cells.map((x,i)=>designation({slots:nowSlots[i]})).join(' + ')});
   }
  }
 }
 let circuits;
 try{circuits=resize(out,N);}catch(e){return {error:e.message};}
 const after=layoutStats(circuits,N);
 return {circuits,before,after,moves,tandems,notes,summary:recommend({before,after,moves,tandems,sort,reserved,pair})};
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
function recommend({before,after,moves,tandems,sort,reserved,pair}){
 const parts=[];
 const gained=before.free-after.free+ (before.reserved-after.reserved);
 const freed=after.free+after.reserved-(before.free+before.reserved);
 parts.push(`Espaces occupés : ${before.used} → ${after.used} sur ${after.positions}.`);
 if(pair)parts.push(tandems?`${tandems} jumelé(s) créé(s), ${freed>0?freed+' espace(s) libéré(s)':'aucun espace gagné'}.`:'Aucun jumelage possible.');
 if(sort)parts.push(`Disjoncteurs unipolaires triés par ampérage ${sort==='asc'?'croissant':'décroissant'}.`);
 if(reserved)parts.push(`${reserved} espace(s) réservé(s) à l’expansion.`);
 parts.push(moves.length?`${moves.length} disjoncteur(s) déplacé(s).`:'Aucun déplacement nécessaire.');
 return parts.join(' ');
}
