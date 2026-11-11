// « À terminer » : ce qui manque ou reste incertain dans un panneau, avec un accès direct à chaque correction.
import {designation,sortCircuits} from '../model.js';

const live=c=>!c.vacant&&c.status!=='Libre';
// Retourne des points {id,level,text,count?,action}; action : {circuit:id} ou {tab:'info'|'appliances'|…}.
export function buildChecklist(panel,{report=null}={}){
 const d=panel.details||{},items=[];
 const cs=sortCircuits(panel.circuits||[]).filter(live);
 const noLabel=cs.filter(c=>c.status==='À confirmer'&&!c.label);
 const toVerify=cs.filter(c=>c.status==='À confirmer'&&c.label);
 const noAmps=cs.filter(c=>(c.label||c.status==='Identifié')&&c.amps==null);
 const circuits=(list,text,level)=>list.length&&items.push({id:text,level,text:`${list.length} ${text}`,more:list.slice(0,6).map(c=>({label:'Circuit '+designation(c)+(c.label?' · '+c.label:''),action:{circuit:c.id}})),action:{circuit:list[0].id}});
 circuits(noLabel,noLabel.length>1?'circuits sans description':'circuit sans description','todo');
 circuits(toVerify,toVerify.length>1?'circuits décrits mais à vérifier sur place':'circuit décrit mais à vérifier sur place','todo');
 circuits(noAmps,noAmps.length>1?'circuits sans calibre':'circuit sans calibre','todo');
 const fiche=[];
 if(!d.mainAmps)fiche.push('calibre du principal');
 if(!d.brand&&!d.model&&!d.modelId)fiche.push('marque et modèle');
 if(!panel.location)fiche.push('emplacement du panneau');
 if(!d.surveyDate)fiche.push('date du relevé');
 if(fiche.length)items.push({id:'fiche',level:'todo',text:'Fiche du panneau à compléter : '+fiche.join(', '),action:{tab:'info'}});
 const pending=(d.appliances||[]).length;
 if(pending)items.push({id:'appliances',level:'warn',text:`${pending} appareil${pending>1?'s':''} à relier à un circuit`,action:{tab:'appliances'}});
 for(const i of (report?.issues||[]).slice(0,6))items.push({id:'issue:'+i.text,level:i.level==='error'?'error':'warn',text:(i.circuit?`Circuit ${i.circuit} : `:'')+i.text,action:i.circuit?{circuitPos:i.circuit}:{tab:'plan'}});
 return items;
}
