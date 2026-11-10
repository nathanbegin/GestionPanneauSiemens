// Électroménagers d'un panneau : liste, suggestion de circuit, ajout, déplacement. Sans DOM (partagé navigateur / serveur PDF).
import {designation,formatOf,fold} from './model.js';
import {APPLIANCES} from './guided.js';

/**
 * Catégorie de charge (calcul de l'entrée) et caractère continu d'après le nom de l'appareil et sa puissance.
 * Sert de valeur par défaut, toujours modifiable : cuisinière → « range » (règle 8-300 sur le circuit), plinthes → chauffage, etc.
 */
export function inferLoad(name='',w=0){
 const n=String(name).toLowerCase();
 const has=re=>re.test(n);
 let cat='other';
 if(has(/cuisini[èe]re|table de cuisson|plaque de cuisson|cooktop|\brange\b/))cat='range';
 else if(has(/borne|recharge|v[ée]hicule|\bev\b/))cat='ev';
 else if(has(/instantan|chauffe[- ]?piscine|\bspa\b|bain (de )?vapeur/))cat='water100';
 else if(has(/fournaise|accumulateur|chaudi[èe]re/))cat='heating100';
 else if(has(/plinthe|convecteur|a[ée]rotherme|plancher chauffant|chauffage/))cat='heating';
 else if(has(/thermopompe|climati|\bclim\b/))cat='cooling';
 else if(Number(w)<=1500)cat='basic';
 // Continu : chauffage, borne, chauffe-eau, sécheuse, spa… ; non continu : cuisson, micro-ondes, grille-pain, lave-vaisselle.
 const cont=has(/borne|recharge|chauffe[- ]?eau|plinthe|convecteur|a[ée]rotherme|fournaise|thermopompe|climati|\bspa\b|piscine|plancher chauffant|s[ée]cheuse|chauffage/)&&cat!=='range';
 return {cat,cont};
}
const newId=()=>'a'+Math.random().toString(36).slice(2,10);
const occupied=c=>!c.vacant&&(c.label||c.amps!=null);

/** Tous les électroménagers du panneau (reliés ou non), du plus gros au plus petit. */
export function listAppliances(panel){
 const rows=[];
 for(const c of panel.circuits)for(const l of c.loads||[])rows.push({id:l.id||'',name:l.name,cat:l.cat,source:l.source||'manuel',model:l.model||'',w:l.w,v:l.v,qty:l.qty||1,total:l.w*(l.qty||1),cont:!!l.cont,circuitId:c.id,circuit:designation(c),circuitLabel:c.label||''});
 for(const a of panel.details?.appliances||[])rows.push({id:a.id,name:a.name,cat:a.cat||inferLoad(a.name,a.w).cat,source:a.source||'manuel',model:a.model||'',w:a.w,v:a.v,qty:a.qty||1,total:a.w*(a.qty||1),cont:!!a.cont,circuitId:null,circuit:'',circuitLabel:'',pending:true});
 return rows.sort((a,b)=>b.total-a.total);
}
/** Circuits suggérés pour un appareil (nom, tension, calibre) : [{circuit, score, why}], meilleurs d'abord. */
export function suggestCircuits(panel,app){
 const words=fold(app.name||'').split(/[^a-z0-9]+/).filter(w=>w.length>3);
 const kind=APPLIANCES.find(a=>a.re.test(app.name||''));
 const out=[];
 for(const c of panel.circuits.filter(occupied)){
  let score=0;const why=[];
  const label=fold(c.label||'');
  if(kind&&kind.re.test(c.label||'')){score+=4;why.push('désignation correspondante');}
  else if(words.some(w=>label.includes(w))){score+=3;why.push('désignation proche');}
  const bipolar=formatOf(c)==='double';
  if(app.v>=208&&bipolar){score+=2;why.push('bipolaire (240 V)');}
  else if(app.v<=120&&!bipolar){score+=1;}
  else if(app.v<=120&&bipolar){score-=2;}
  else if(app.v>=208&&!bipolar){score-=3;}
  if(c.amps&&app.w&&app.v){const cap=c.amps*app.v*0.8;if(cap>=app.w*(app.qty||1)){score+=1;why.push('calibre suffisant');}else{score-=1;why.push('calibre juste');}}
  out.push({circuit:c,score,why:why.join(' · ')});
 }
 return out.sort((a,b)=>b.score-a.score);
}
const loadOf=a=>{const g=inferLoad(a.name,a.w);return {id:a.id||newId(),name:a.name,...(a.model?{model:a.model}:{}),...(a.source&&a.source!=='manuel'?{source:a.source}:{}),w:a.w,v:a.v,qty:a.qty||1,cat:a.cat||g.cat,cont:a.cont!==undefined&&a.cont!==null?!!a.cont:g.cont};};
/** Ajoute un électroménager (relié au circuit, ou en attente). Retourne {circuits, appliances}. */
export function addAppliance(panel,app,circuitId=null){
 const a={...app,id:app.id||newId()};
 if(!circuitId)return {circuits:panel.circuits,appliances:[...(panel.details?.appliances||[]),{id:a.id,name:a.name,...(a.model?{model:a.model}:{}),w:a.w,v:a.v,qty:a.qty||1,source:a.source||'manuel',cat:a.cat||inferLoad(a.name,a.w).cat,cont:a.cont!==undefined&&a.cont!==null?!!a.cont:inferLoad(a.name,a.w).cont}]};
 if(!panel.circuits.some(c=>c.id===circuitId))throw Error('Circuit introuvable.');
 return {circuits:panel.circuits.map(c=>c.id===circuitId?{...c,loads:[...(c.loads||[]),loadOf(a)]}:c),appliances:panel.details?.appliances||[]};
}
/** Retire un électroménager (de son circuit ou de la liste en attente) et le retourne avec le reste. */
function take(panel,id){
 let found=null;
 const circuits=panel.circuits.map(c=>{const l=(c.loads||[]).find(x=>x.id===id);if(!l)return c;found={name:l.name,model:l.model||'',source:l.source||'manuel',cat:l.cat,w:l.w,v:l.v,qty:l.qty||1,cont:!!l.cont,id:l.id};const loads=c.loads.filter(x=>x!==l);const {loads:_,...rest}=c;return loads.length?{...c,loads}:rest;});
 let appliances=panel.details?.appliances||[];
 if(!found){const a=appliances.find(x=>x.id===id);if(a){found={...a};appliances=appliances.filter(x=>x!==a);}}
 return {found,circuits,appliances};
}
export function removeAppliance(panel,id){const t=take(panel,id);if(!t.found)throw Error('Électroménager introuvable.');return {circuits:t.circuits,appliances:t.appliances};}
/** Modifie un électroménager (nom, puissance, tension, quantité…) et le relie à `circuitId` (null = non relié). */
export function updateAppliance(panel,id,patch,circuitId=null){
 const t=take(panel,id);if(!t.found)throw Error('Électroménager introuvable.');
 const next={...t.found,...patch,id:t.found.id};
 return addAppliance({...panel,circuits:t.circuits,details:{...panel.details,appliances:t.appliances}},next,circuitId);
}
/** Relie (ou détache, circuitId = null) un électroménager existant. */
export function moveAppliance(panel,id,circuitId){
 const t=take(panel,id);if(!t.found)throw Error('Électroménager introuvable.');
 return addAppliance({...panel,circuits:t.circuits,details:{...panel.details,appliances:t.appliances}},t.found,circuitId);
}
