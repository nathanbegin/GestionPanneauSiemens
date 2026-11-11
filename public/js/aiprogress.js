// Progression d'une analyse par IA : étapes, barre, temps écoulé, et résultats qui apparaissent au fur et à mesure.
// L'envoi est mesuré pour de vrai ; l'attente de l'IA est estimée (la durée réelle n'est pas connue d'avance).
import {h} from './dom.js';

// steps : libellés ; weights : part de la barre par étape ; analysisIndex : étape d'attente de l'IA (progression estimée) ;
// details : phrases qui défilent pendant l'attente ; expectedMs : durée typique de l'attente.
export function aiProgress({steps,weights,analysisIndex=1,details=[],expectedMs=25000}){
 const bar=h('i'),track=h('div',{class:'ai-bar',role:'progressbar','aria-valuemin':'0','aria-valuemax':'100','aria-label':'Progression de l’analyse'},bar);
 const items=steps.map(t=>h('li',{},h('span',{class:'dot','aria-hidden':'true'}),h('span',{text:t})));
 const list=h('ol',{class:'ai-steps'},...items);
 const detail=h('p',{class:'ai-detail small muted'}),clock=h('span',{class:'ai-clock small muted'}),pctLabel=h('b',{class:'ai-pct'});
 const feed=h('div',{class:'ai-feed','aria-live':'polite'});
 const el=h('div',{class:'ai-progress'},h('div',{class:'ai-head'},pctLabel,clock),track,list,detail,feed);
 const total=weights.reduce((a,b)=>a+b,0);
 let cur=-1,frac=0,tStage=Date.now(),t0=Date.now(),timer=0,di=0,done=false,shown=0;
 const value=()=>{
  if(done)return 100;
  if(cur<0)return 0;
  let p=0;for(let i=0;i<cur;i++)p+=weights[i];
  // Attente de l'IA : progression estimée ; autres étapes : mesure réelle (avec une légère avance continue pour que la barre reste vivante).
  const f=cur===analysisIndex?Math.min(.94,1-Math.exp(-(Date.now()-tStage)/(expectedMs*.55))):Math.max(frac,Math.min(.6,(Date.now()-tStage)/20000));
  return Math.min(99,(p+weights[cur]*f)/total*100);
 };
 const paint=()=>{
  const v=Math.max(shown,value());shown=v;
  bar.style.width=v.toFixed(1)+'%';track.setAttribute('aria-valuenow',String(Math.round(v)));pctLabel.textContent=Math.round(v)+' %';
  clock.textContent=Math.round((Date.now()-t0)/1000)+' s';
  items.forEach((li,i)=>li.className=done||i<cur?'done':i===cur?'on':'');
  if(cur===analysisIndex&&details.length&&Date.now()-tStage>di*4500){detail.textContent=details[di%details.length];di++;}
 };
 const start=()=>{if(!timer)timer=setInterval(paint,250);paint();};
 return {
  el,
  // Passe à l'étape i (fraction de l'étape déjà faite : 0..1).
  stage(i,f=0){if(i!==cur){cur=i;tStage=Date.now();di=0;if(i!==analysisIndex)detail.textContent='';}frac=f;start();},
  // Affiche des lignes de résultats une à une (ex. circuits lus) ; retourne quand terminé.
  async results(lines,{title='',delay=110,max=14}={}){
   feed.replaceChildren(title?h('p',{class:'small',text:title}):'');
   for(const l of lines.slice(0,max)){feed.append(h('div',{class:'ai-line',text:l}));feed.scrollTop=feed.scrollHeight;await new Promise(r=>setTimeout(r,delay));}
   if(lines.length>max)feed.append(h('div',{class:'ai-line muted',text:`… et ${lines.length-max} autre(s)`}));
  },
  finish(){done=true;cur=steps.length;paint();clearInterval(timer);timer=0;detail.textContent='';},
  stop(){clearInterval(timer);timer=0;},
 };
}
