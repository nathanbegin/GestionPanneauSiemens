// Suggestions d'amélioration : envoi par l'utilisateur (menu du compte).
import {h,dialog,toast} from './dom.js';
import {api} from './api.js';
import {APP_VERSION,FEEDBACK_CATEGORIES} from '../model.js';

const HINTS={Suggestion:'Une idée pour rendre l’application plus simple ou plus utile.',Problème:'Quelque chose ne fonctionne pas ou s’affiche mal : décrivez ce que vous faisiez.',Question:'Une fonction que vous ne trouvez pas ou ne comprenez pas.',Autre:'Tout autre commentaire.'};

export function feedbackDialog(){
 const page=(location.hash||'#/').slice(0,200);
 let category='Suggestion';
 const hint=h('p',{class:'small muted',text:HINTS[category]});
 const chips=h('div',{class:'gd-chips'});
 const drawChips=()=>chips.replaceChildren(...FEEDBACK_CATEGORIES.map(c=>h('button',{type:'button',class:'gd-chip'+(c===category?' on':''),'aria-pressed':String(c===category),onclick:()=>{category=c;hint.textContent=HINTS[c];drawChips();}},c)));
 drawChips();
 const message=h('textarea',{maxlength:3000,rows:6,required:true,placeholder:'Ex. Pouvoir trier les circuits par pièce dans la nomenclature.'});
 const count=h('span',{class:'small muted',text:'0 / 3000'});
 message.addEventListener('input',()=>{count.textContent=`${message.value.length} / 3000`;});
 const err=h('p',{class:'error',role:'alert'});
 const platform=window.Capacitor?.getPlatform?.();
 const d=dialog({title:'Suggérer une amélioration',eyebrow:'Votre avis compte',form:true,
  body:[h('p',{class:'muted',text:'Votre message est transmis directement à l’équipe de Disjonio. Merci de nous aider à améliorer l’application !'}),
   h('div',{class:'f'},h('span',{},'Type de message'),chips,hint),
   h('label',{class:'f full'},h('span',{},'Votre message'),message,count),
   h('p',{class:'small muted',text:`Page jointe automatiquement : ${page} · version ${APP_VERSION}`}),err],
  actions:[{label:'Annuler',kind:'ghost'},{label:'Envoyer',kind:'primary',submit:true}]});
 d.form.addEventListener('submit',async ev=>{
  ev.preventDefault();err.textContent='';
  if(message.value.trim().length<5){err.textContent='Décrivez votre suggestion en quelques mots.';return message.focus();}
  const btn=ev.submitter;btn&&(btn.disabled=true);
  try{
   await api('/api/account?action=feedback',{method:'POST',body:{category,message:message.value.trim(),page,version:APP_VERSION,client:platform==='ios'||platform==='android'?platform:'web'}});
   d.close();toast('Merci ! Votre message a bien été transmis.',5000);
  }catch(e){err.textContent=e.message;}
  finally{btn&&(btn.disabled=false);}
 });
 message.focus();
}
