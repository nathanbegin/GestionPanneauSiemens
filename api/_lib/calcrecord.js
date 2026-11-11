// Dossier de calcul d'un panneau : date, version, édition du code, empreinte des données et résultat,
// avec un instantané des données d'origine pour pouvoir relire le résultat même si le panneau change ensuite.
import {calcFingerprint,CODE_EDITION,APP_VERSION} from '../../public/model.js';
import {panelReport} from '../../public/loadcalc.js';

const meaningful=(panel)=>!!(Number(panel.details?.mainAmps)&&((panel.circuits||[]).some(c=>c.loads?.length)||Number(panel.details?.livingArea)));
const pickDetails=d=>Object.fromEntries(['mainAmps','livingArea','basementArea','voltage','family','modelId','maxCircuits','tandem','serviceGauge','serviceMaterial','serviceRoute','fedFrom','appliances','brand','model'].filter(k=>d?.[k]!==undefined).map(k=>[k,d[k]]));

// Retourne le nouveau dossier, ou l'ancien si les données d'entrée n'ont pas changé, ou null s'il n'y a rien à calculer.
export function makeCalcRecord({panel,children=[],prev=null,now=new Date()}){
 if(!meaningful(panel))return prev||null;
 const fingerprint=calcFingerprint(panel,children);
 if(prev&&prev.fingerprint===fingerprint)return prev;
 const rep=panelReport(panel,{children});
 return {at:now.toISOString(),version:APP_VERSION,edition:CODE_EDITION,fingerprint,
  summary:{connectedW:Math.round(rep.connectedW),designAmps:rep.designAmps,mainAmps:rep.mainAmps,percent:rep.percent,status:rep.status,issues:rep.issues.length},
  inputs:{name:panel.name,tag:panel.tag||'',kind:panel.kind,details:pickDetails(panel.details),circuits:panel.circuits,children:children.map(p=>({id:p.id,name:p.name,tag:p.tag||'',kind:p.kind,circuits:p.circuits}))}};
}
// Panneau reconstitué à partir de l'instantané (résultat historique).
export function panelFromRecord(panel,record){
 return {...panel,circuits:record.inputs.circuits,details:{...panel.details,...record.inputs.details}};
}
export const isHistoric=(panel,children,record)=>!!record&&calcFingerprint(panel,children)!==record.fingerprint;
