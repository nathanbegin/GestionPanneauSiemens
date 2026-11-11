// Remise du dossier à un client : accès en consultation (révocable) ou copie indépendante.
import {h,toast,dialog,confirmDialog,field,fmtRelative} from './dom.js';
import {api} from './api.js';

const STATUS={pending:'En attente',accepted:'Acceptée',declined:'Refusée',expired:'Expirée'};
const KIND={access:'Accès en consultation',transfer:'Copie du dossier'};

export function handoffDialog({site}){
 const email=h('input',{type:'email',name:'email',required:true,placeholder:'courriel du client',autocomplete:'off',inputmode:'email'});
 const kinds=[['access','Accès en consultation (lecture seule)','Le client voit le dossier dans son compte, sans rejoindre votre équipe. Vous pouvez retirer l’accès en tout temps.'],
  ['transfer','Copie du dossier','Le client reçoit sa propre copie, qui lui appartient. Vous gardez la vôtre : les deux copies ne se synchronisent pas, la suppression de l’une n’efface pas l’autre, et la suppression du compte du client n’efface pas votre copie.']];
 let kind='access';
 const desc=h('p',{class:'small muted',text:kinds[0][2]});
 const radios=kinds.map(([v,t,d],i)=>h('label',{class:'stage-opt'},h('input',{type:'radio',name:'kind',value:v,checked:i===0,onchange:()=>{kind=v;desc.textContent=d;}}),h('span',{},h('b',{text:t}))));
 const auth=h('input',{type:'checkbox',name:'authorized'});
 const err=h('p',{class:'error',role:'alert'}),result=h('div'),list=h('div',{class:'handoff-list'});
 // Lien d'invitation toujours affiché et copiable (pour l'envoyer par une autre application : texto, messagerie…).
 function showLink(out){
  result.replaceChildren(h('div',{class:'notice info'},out.sent?`Invitation envoyée par courriel (valide ${out.days} jours). Vous pouvez aussi transmettre ce lien par une autre application :`:`Courriel non envoyé : copiez ce lien et transmettez-le vous-même (valide ${out.days} jours).`,
   h('input',{readonly:true,value:out.url,'aria-label':'Lien d’invitation',onfocus:e=>e.target.select(),style:{width:'100%',marginTop:'6px'}}),
   h('button',{type:'button',class:'sm',onclick:async()=>{try{await navigator.clipboard.writeText(out.url);toast('Lien copié.');}catch{toast(out.url,8000);}}},'Copier le lien')));
 }
 async function refresh(){
  try{
   const {items}=await api('/api/sites?action=handoff&siteId='+site.id);
   list.replaceChildren(items.length?h('div',{},h('h3',{text:'Remises effectuées'}),...items.map(it=>h('div',{class:'trash-row card'},
    h('div',{},h('b',{text:it.email}),h('div',{class:'small muted',text:`${KIND[it.kind]} · ${STATUS[it.status]||it.status}${it.acceptedName?' par '+it.acceptedName:''} · ${fmtRelative(it.createdAt)}`})),
    it.status==='pending'&&h('button',{type:'button',class:'sm',onclick:async()=>{try{showLink(await api('/api/sites?action=handoff-create',{method:'POST',body:{siteId:site.id,kind:it.kind,email:it.email,authorized:true}}));refresh();}catch(e){err.textContent=e.message;}}},'Nouveau lien à copier'),
    (it.kind==='access'&&['pending','accepted'].includes(it.status)||it.kind==='transfer'&&it.status==='pending')&&h('button',{type:'button',class:'danger sm',onclick:async()=>{if(!await confirmDialog(it.kind==='access'?`Retirer l’accès de ${it.email} ?`:'Annuler cette invitation ?',{title:'Retirer',confirm:'Retirer',danger:true}))return;await api('/api/sites?action=handoff-revoke&hid='+it.id,{method:'DELETE'});refresh();}},it.kind==='access'?'Retirer l’accès':'Annuler l’invitation')))):'');
  }catch{list.replaceChildren();}
 }
 const d=dialog({title:'Remettre au client',eyebrow:site.name,form:true,wide:true,dirty:()=>!!email.value.trim(),body:[
  h('div',{class:'stage-opts'},radios),desc,
  field('Courriel du client',email,{hint:'Le client doit se connecter (ou créer un compte) avec cette adresse pour accepter.'}),
  h('label',{class:'check'},auth,h('span',{text:'Je confirme être autorisé à transmettre les renseignements de ce dossier à cette personne.'})),
  err,result,list],actions:[{label:'Fermer',kind:'ghost'},{label:'Envoyer l’invitation',kind:'primary',submit:true}]});
 d.form.addEventListener('submit',async ev=>{
  ev.preventDefault();err.textContent='';result.replaceChildren();
  try{
   const out=await api('/api/sites?action=handoff-create',{method:'POST',body:{siteId:site.id,kind,email:email.value,authorized:auth.checked}});
   showLink(out);
   email.value='';auth.checked=false;refresh();
  }catch(e){err.textContent=e.message;}
 });
 refresh();
}

// Page ouverte par le destinataire (#/remise/<jeton>).
export async function handoffView({token,onDone}){
 const wrap=h('div',{class:'container auth-wrap'});
 let p;
 try{p=await api('/api/sites?action=handoff-preview&token='+encodeURIComponent(token));}
 catch(e){wrap.append(h('div',{class:'card auth-card'},h('h1',{text:'Invitation indisponible'}),h('p',{class:'muted',text:e.message}),h('a',{class:'btn primary',href:'#/sites'},'Mes sites')));return wrap;}
 const err=h('p',{class:'error',role:'alert'});
 const isCopy=p.kind==='transfer';
 const act=async(name,body)=>{try{return await api('/api/sites?action='+name,{method:'POST',body});}catch(e){err.textContent=e.message;}};
 const canAnswer=p.status==='pending'&&p.forYou;
 wrap.append(h('div',{class:'card auth-card'},
  h('div',{class:'eyebrow',text:isCopy?'Copie d’un dossier':'Accès à un dossier'}),h('h1',{text:p.site}),
  h('p',{class:'muted',text:`${p.from} ${isCopy?'vous remet une copie de ce dossier':'vous donne un accès en consultation (lecture seule) à ce dossier'} — ${p.panels} panneau(x).`}),
  isCopy?h('div',{class:'notice info'},'Après acceptation, la copie vous appartient. ',p.from,' garde sa propre copie : les deux copies ne se synchronisent pas, la suppression de l’une n’efface pas l’autre.'):
   h('div',{class:'notice info'},'Vous ne rejoignez pas son équipe. ',p.from,' peut retirer cet accès en tout temps.'),
  p.status==='accepted'?h('p',{class:'notice',text:'Cette invitation a déjà été acceptée.'}):p.status==='expired'?h('p',{class:'notice',text:'Cette invitation a expiré : demandez-en une nouvelle.'}):
  !p.forYou?h('p',{class:'notice',text:`Cette invitation a été envoyée à ${p.email}. Connectez-vous avec cette adresse pour l’accepter.`}):null,
  err,
  canAnswer&&h('div',{class:'form-actions'},
   h('button',{type:'button',class:'ghost',onclick:async()=>{if(await act('handoff-decline',{token})){toast('Invitation refusée.');location.hash='#/sites';}}},'Refuser'),
   h('button',{type:'button',class:'primary lg',onclick:async()=>{const r=await act('handoff-accept',{token});if(r){toast(isCopy?'Copie ajoutée à votre compte.':'Accès ajouté à vos sites.');onDone?.();location.hash='#/sites/'+r.siteId;}}},isCopy?'Accepter la copie':'Accepter l’accès'))));
 return wrap;
}
