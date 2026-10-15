export const usages=['Éclairage','Prises','Électroménager','Chauffage','Extérieur','Autre'];
export const states=['À confirmer','Identifié','Libre','Non visible'];
export const blank=()=>Array.from({length:32},(_,i)=>({id:String(i+1),slots:[`${i+1}A`,`${i+1}B`],label:'',room:'',usage:'Autre',amps:null,status:'À confirmer',notes:'',exceptions:''}));
const validSlot=s=>typeof s==='string'&&/^(?:[1-9]|[12][0-9]|3[0-9]|40)[AB]$/.test(s);
export function validate(data){
 if(!Array.isArray(data)||!data.length||data.length>80)throw Error('Répertoire invalide.');
 const ids=new Set(),used=new Set();
 for(const c of data){
 if(!c||typeof c.id!=='string'||ids.has(c.id)||c.id.length>30)throw Error('Identifiant invalide.');ids.add(c.id);
 if(!Array.isArray(c.slots)||!c.slots.length||c.slots.length>4)throw Error('Emplacements invalides.');
 let previous;
 for(const s of c.slots){if(!validSlot(s)||used.has(s))throw Error('Emplacement invalide ou occupé : '+s);used.add(s);const n=parseInt(s),order=Math.floor((n-1)/2)*2+(s.endsWith('B')?1:0);if(previous&&(n%2!==previous.parity||order!==previous.order+1))throw Error('Les emplacements doivent être consécutifs dans la même colonne.');previous={parity:n%2,order};}
 for(const [k,max] of [['label',100],['room',80],['notes',2000]])if(typeof c[k]!=='string'||c[k].length>max)throw Error('Champ invalide : '+k);
 if(c.exceptions!==undefined&&(typeof c.exceptions!=='string'||c.exceptions.length>2000))throw Error('Champ invalide : exceptions');
 if(c.tags!==undefined){if(!c.tags||typeof c.tags!=='object'||Array.isArray(c.tags))throw Error('Tags invalides.');for(const k of ['locations','functions','devices']){const a=c.tags[k];if(!Array.isArray(a)||a.length>30||a.some(t=>typeof t!=='string'||!t.trim()||t.length>80))throw Error('Tags invalides : '+k);}}
 for(const k of ['originalLabel','originalNotes','surveyDate'])if(c[k]!==undefined&&(typeof c[k]!=='string'||c[k].length>3000))throw Error('Historique invalide.');
 if(!usages.includes(c.usage)||!states.includes(c.status)||!(c.amps===null||[15,20,25,30,40,50,60,70,80,90,100,125].includes(c.amps)))throw Error('Caractéristiques invalides.');
 }
 return data;
}
export function normalize(data){
 if(!Array.isArray(data))throw Error('Répertoire invalide.');
 if(data[0]?.slots)return validate(data.map(c=>({...c,exceptions:c.exceptions??''})));
 const claimed=new Set(data.filter(c=>c.poles===2).map(c=>c.position+2));
 return validate(data.filter(c=>!claimed.has(c.position)).map(c=>({id:String(c.position),slots:[`${c.position}A`,`${c.position}B`,...(c.poles===2?[`${c.position+2}A`,`${c.position+2}B`]:[])],label:c.label,room:c.room,usage:c.usage,amps:c.amps,status:c.status==='À identifier'?'À confirmer':c.status,notes:c.notes,exceptions:''})));
}
export const designation=c=>c.slots.join(' / ');

export const tagGroups=['locations','functions','devices'];
export const fold=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
export const allTags=c=>tagGroups.flatMap(k=>c.tags?.[k]||[]);
export const searchable=c=>fold([c.id,...c.slots,c.label,c.room,c.usage,c.notes,c.exceptions,...allTags(c)].join(' '));
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
