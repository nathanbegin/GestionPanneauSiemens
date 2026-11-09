// Bibliothèque de produits : normalisation des données fournies (api/_data/catalogue.js) pour le concepteur.
// Réservée aux abonnés : n'est exposée que par /api/panels?catalog=1.
import data from '../_data/catalogue.js';
import generac from '../_data/generac.js';
import {ampsList} from '../../public/model.js';

const NOT_DESIGNABLE=['Spa','Insert (boîte à fusibles)','Boîtier de disjoncteur'];
const num=v=>Number(String(v).replace(/[^0-9.]/g,''));

// '15/20' → [15,20] ; '2×15' → [15,15] ; '2×15 + 2P20' → [15,20,15] ; '15 + 2P20 + 15' → [15,20,15].
export function parseAmps(a){
 if(a==null)return [];
 if(typeof a==='number')return [a];
 const s=String(a);
 if(s.includes('/'))return s.split('/').map(num);
 const parts=s.split('+').map(t=>t.trim());
 const outers=[],centers=[];
 for(const t of parts){
  const m=t.match(/^(\d+)\s*×\s*(\d+)$/);
  if(m){for(let i=0;i<+m[1];i++)outers.push(+m[2]);continue;}
  if(/^\d*P\d+/i.test(t)){centers.push(num(t.replace(/^\d*P/i,'')));continue;}
  outers.push(num(t));
 }
 if(centers.length>1)return centers;
 if(centers.length===1)return [outers[0],centers[0],outers[1]??outers[0]];
 return outers;
}
export function protectionOf(type){
 if(/double fonction/i.test(type))return 'DDFT + anti-arc';
 if(/CAFCI/i.test(type))return 'Anti-arc';
 if(/DDFT/i.test(type))return 'DDFT';
 if(/protection équipement/i.test(type))return 'Protection équipement';
 return 'Standard';
}
// Format dans le modèle de l'application (positions n, n+2… et demi-emplacements A/B).
export function kindOf(b,amps){
 const t=b.type||'';
 if(!b.espaces)return {kind:null,why:'Principal ou accessoire : ne se place pas dans un espace de dérivation.'};
 if(/quad/i.test(t)){
  if(/^2P\d+\s*\+\s*2P/i.test(String(b.amps)))return {kind:null,why:'Quad à deux circuits bipolaires : non représentable dans la grille (pôles non adjacents).'};
  return {kind:b.espaces===2?'quad':null,why:''};
 }
 if(b.espaces===1&&(amps.length===2||/tandem|twin/i.test(t)))return {kind:'tandem',why:''};
 if(b.espaces===1&&b.poles===1)return {kind:'single',why:''};
 if(b.espaces===2&&b.poles===2)return {kind:'double',why:''};
 if(b.espaces===3&&b.poles===3)return {kind:'triple',why:''};
 if(b.espaces===3&&b.poles===1)return {kind:null,why:'Disjoncteur commercial occupant 3 positions : non pris en charge par le constructeur.'};
 return {kind:null,why:`Occupe ${b.espaces} espaces : non pris en charge par le constructeur.`};
}
const labelOf=(kind,amps,poles)=>{
 const a=amps.join('/');
 return kind==='tandem'?`Jumelé ${a} A`:kind==='quad'?`Quad ${amps[0]} + 2P${amps[1]} + ${amps[2]} A`:kind==='triple'?`Tripolaire ${a} A`:kind==='double'?`Bipolaire ${a} A`:kind==='single'?`Unipolaire ${a} A`:`${poles||''}P ${a} A`.trim();
};
export function normalizeBreaker(b){
 const amps=parseAmps(b.amps);
 const {kind,why}=kindOf(b,amps);
 // Calibres absents de la liste de l'application : le disjoncteur reste consultable mais pas plaçable.
 const surge=/parasurtenseur/i.test(b.type||'');
 const ampsOk=(amps.length>0||surge)&&amps.every(a=>ampsList.includes(a));
 return {cat:b.cat,family:b.famille,type:b.type,poles:b.poles,amps,ampsText:b.amps==null?'—':String(b.amps),kA:b.kA,neutre:b.neutre,espaces:b.espaces,note:b.note||'',source:b.source,
  kind:kind&&ampsOk?kind:null,why:kind&&!ampsOk?'Calibre hors de la liste du constructeur.':why,protection:protectionOf(b.type||''),smart:/intelligent/i.test(b.type||''),surge:/parasurtenseur/i.test(b.type||''),
  label:labelOf(kind,amps,b.poles)};
}
export function normalizePanel(p){
 const designable=Number.isInteger(p.espaces)&&p.espaces>=2&&p.espaces<=84&&p.espaces%2===0&&!NOT_DESIGNABLE.includes(p.type);
 return {cat:p.cat,family:p.famille,type:p.type,bus:p.bus_A,main:p.principal_A,espaces:p.espaces,circuits:p.circuits,enveloppe:p.enveloppe,pon:p.pon,statut:p.statut,note:p.note||'',source:p.source,accepts:p.accepte||null,
  tandem:p.circuits!=null&&p.espaces!=null&&p.circuits>p.espaces,designable};
}
let cache;
export function library(){
 if(!cache){
  cache={genere:data.genere,sources:{...data.sources,...generac.sources},families:[...data.familles,generac.famille],
   panels:[...data.panneaux,...generac.panneaux].map(normalizePanel),breakers:data.disjoncteurs.map(normalizeBreaker),
   legacy:data.anciennes,generators:data.generatrices,holdDown:data.retenue,surge:data.parasurtenseurs};
 }
 return cache;
}
export const findPanel=cat=>library().panels.find(p=>p.cat===cat);
// Instantané enregistré dans la fiche du panneau quand un modèle est choisi.
export function panelSnapshot(p){
 const fam=library().families.find(f=>f.id===p.family);
 return {modelId:p.cat,family:p.family,accepts:p.accepts||[],maxCircuits:p.circuits??null,tandem:p.tandem,pon:p.pon,
  modelInfo:`${fam?.marque||''} ${fam?.gamme||''} · ${p.type} · barres ${p.bus??'—'} A${p.main?` · principal ${p.main} A`:''} · ${p.espaces}/${p.circuits??'—'} · ${p.enveloppe||''}`.replace(/\s+/g,' ').trim().slice(0,160)};
}
