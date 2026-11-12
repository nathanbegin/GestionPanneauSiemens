// Changement de marque : conversion des disjoncteurs vers les équivalents de la nouvelle famille.
import {h,toast,dialog} from './dom.js';
import {convertBreakers,applyModel,clearModel} from '../units.js';

// Ouvre la fenêtre s'il y a quelque chose à convertir. save(circuits) enregistre le panneau.
export function convertDialog({panel,lib,save,onDone}){
 const rows=convertBreakers(panel.circuits,lib.breakers,panel.details||{});
 if(!rows.length)return null;
 const chosen=new Set(rows.map((r,i)=>i));
 const list=h('div',{class:'conv-list'},...rows.map((r,i)=>h('label',{class:'conv-row'},
  h('input',{type:'checkbox',checked:true,onchange:e=>{e.target.checked?chosen.add(i):chosen.delete(i);}}),
  h('span',{},h('b',{text:r.designation}),' · ',h('span',{class:'muted',text:r.from}),' → ',
   r.to?h('b',{text:r.to.cat}):h('b',{class:'warn-text',text:'aucun équivalent'}),
   h('div',{class:'small muted',text:r.to?`${r.to.label} · ${r.to.protection==='Standard'?r.to.type:r.to.protection}${r.sameProtection?'':' — protection différente de l’original'}`:'La référence d’origine sera retirée ; le format et le calibre sont conservés.'})))));
 const d=dialog({title:'Convertir les disjoncteurs',eyebrow:panel.name,wide:true,
  body:[h('p',{class:'muted',text:`Le nouveau modèle de panneau n’accepte pas ${rows.length} des références actuelles. Voici les équivalents proposés (même format, mêmes calibres). Décochez ceux que vous voulez garder tels quels.`}),list,
   h('p',{class:'small muted',text:'Vérifiez chaque équivalent dans le catalogue du fabricant avant de commander ; l’historique du panneau permet de revenir en arrière.'})],
  actions:[{label:'Garder les références actuelles',kind:'ghost'},{label:'Convertir',kind:'primary',onClick:async()=>{
   try{
    let circuits=panel.circuits;
    rows.forEach((r,i)=>{if(!chosen.has(i))return;circuits=r.to?applyModel(circuits,r.unit,r.to):clearModel(circuits,r.unit);});
    await save(circuits);
    toast(`${chosen.size} disjoncteur(s) converti(s).`);onDone?.();
   }catch(e){toast(e.message,8000);return false;}
  }}]});
 return d;
}
