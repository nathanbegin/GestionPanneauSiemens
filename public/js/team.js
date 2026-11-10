// Équipe : gestion par le propriétaire (forfait Électricien Équipe), adhésion par lien ou par l'annuaire.
import {h,field,toast,confirmDialog,dialog,select} from './dom.js';
import {api} from './api.js';

const fmt=d=>new Date(d).toLocaleDateString((globalThis.MP_LOCALE||'fr-CA'),{dateStyle:'medium'});
const copy=async t=>{try{await navigator.clipboard.writeText(t);toast('Lien copié.');}catch{prompt('Copiez ce lien :',t);}};

export async function teamView({ctx}){
 ctx.crumbs([['Mes sites','#/sites'],['Mon équipe']]);
 const root=h('div',{class:'container'});
 const memo={}; // dernier lien d'invitation créé (conservé lors du rafraîchissement)
 const load=async()=>{const d=await api('/api/account?action=team');render(d);};
 function render(d){
  const head=h('div',{class:'page-head'},h('div',{},h('div',{class:'eyebrow',text:'Équipe'}),h('h1',{text:'Mon équipe'})));
  if(d.role==='owner')return root.replaceChildren(head,ownerPanel(d,load,memo));
  if(d.role==='member')return root.replaceChildren(head,h('div',{class:'card form-card stack'},
   h('h2',{text:d.owner?.name||'Équipe'}),h('p',{},'Vous faites partie de cette équipe et profitez de son forfait ',h('b',{text:d.plan||''}),'.'),
   h('p',{class:'small muted',text:`Contact : ${d.owner?.contact||'—'}. Vos sites et panneaux restent les vôtres.`}),
   d.ownSubscription?doubleBilling(d.ownSubscription):null,
   h('div',{class:'form-actions'},h('button',{type:'button',class:'danger',onclick:async()=>{if(!await confirmDialog('Quitter cette équipe ? Vous reviendrez à votre propre forfait (gratuit si vous n’en avez pas).',{title:'Quitter l’équipe',confirm:'Quitter',danger:true}))return;await api('/api/account?action=team-leave',{method:'POST',body:{}});toast('Vous avez quitté l’équipe.');load();}},'Quitter l’équipe'))));
  root.replaceChildren(head,
   d.role==='pending'?h('div',{class:'notice info'},'Demande envoyée à ',h('b',{text:d.owner?.name||'l’électricien'}),' : vous serez ajouté dès qu’elle sera acceptée. ',
    h('button',{type:'button',class:'ghost sm',onclick:async()=>{await api('/api/account?action=team-leave',{method:'POST',body:{}});toast('Demande annulée.');load();}},'Annuler la demande')):null,
   joinPanel(load));
 }
 await load();
 return root;
}

// ---------- Rejoindre : lien d'invitation ou annuaire ----------
export function joinPanel(onDone){
 const link=h('input',{placeholder:'Collez le lien d’invitation reçu',autocomplete:'off'});
 const q=h('input',{type:'search',placeholder:'Nom de l’entreprise, de l’électricien ou ville',autocomplete:'off'});
 const results=h('div',{class:'stack'});
 let timer;
 const search=()=>{clearTimeout(timer);timer=setTimeout(async()=>{
  if(q.value.trim().length<2)return results.replaceChildren();
  try{const {results:r}=await api('/api/account?action=team-search&q='+encodeURIComponent(q.value.trim()));
   results.replaceChildren(...(r.length?r.map(o=>h('div',{class:'card side-card team-result'},h('div',{},h('b',{text:o.company}),h('div',{class:'small muted',text:[o.name,o.licence,o.address].filter(Boolean).join(' · ')})),
    h('button',{type:'button',class:'primary sm',onclick:async e=>{e.target.disabled=true;try{const out=await api('/api/account?action=team-request',{method:'POST',body:{ownerId:o.id}});toast(`Demande envoyée à ${out.owner}.`);onDone?.();}catch(x){toast(x.message,6000);e.target.disabled=false;}}},'Demander à rejoindre'))):
    [h('p',{class:'small muted',text:'Aucun électricien trouvé. Il doit avoir activé « Visible dans l’annuaire » dans son équipe ; sinon, demandez-lui un lien d’invitation.'})]));
  }catch(x){results.replaceChildren(h('p',{class:'error',text:x.message}));}
 },300);};
 q.addEventListener('input',search);
 return h('div',{class:'stack'},
  h('div',{class:'card form-card'},h('h2',{text:'Vous travaillez pour un électricien ?'}),
   h('p',{class:'muted',text:'Rejoignez son équipe pour profiter de son forfait Électricien Équipe, sans payer d’abonnement vous-même.'}),
   h('h3',{text:'1. Avec un lien d’invitation'}),
   h('div',{class:'inline-form'},link,h('button',{type:'button',class:'primary',onclick:()=>{const m=/rejoindre\/([A-Za-z0-9_-]{20,})/.exec(link.value)||/^([A-Za-z0-9_-]{20,})$/.exec(link.value.trim());if(!m)return toast('Lien d’invitation invalide.');location.hash='#/rejoindre/'+m[1];}},'Ouvrir')),
   h('h3',{class:'mt',text:'2. Ou cherchez votre électricien'}),
   h('label',{class:'search'},h('span',{'aria-hidden':'true',text:'⌕'}),q),results));
}

// ---------- Propriétaire ----------
function ownerPanel(d,reload,memo={}){
 const email=h('input',{type:'email',placeholder:'Courriel (facultatif)',maxlength:200});
 const linkBox=h('div');
 const full=d.used>=d.seats;
 const invite=async()=>{try{const r=await api('/api/account?action=team-invite',{method:'POST',body:{email:email.value.trim()}});email.value='';
  memo.last=r;await reload();}catch(x){toast(x.message,6000);}};
 if(memo.last){const r=memo.last;linkBox.replaceChildren(h('div',{class:'notice info stack'},h('b',{text:r.mailed?'Invitation envoyée par courriel. Vous pouvez aussi partager ce lien :':'Lien d’invitation (valide '+r.expiresDays+' jours, utilisable une fois) :'}),h('code',{class:'invite-link',text:r.url}),h('div',{},h('button',{type:'button',class:'sm',onclick:()=>copy(r.url)},'Copier le lien'))));}
 const respond=async(id,accept)=>{try{await api('/api/account?action=team-respond',{method:'POST',body:{userId:id,accept}});toast(accept?'Membre ajouté.':'Demande refusée.');reload();}catch(x){toast(x.message,6000);}};
 return h('div',{class:'stack'},
  h('div',{class:'card form-card'},
   h('div',{class:'row-between'},h('h2',{text:d.company}),h('span',{class:'badge '+(full?'warn':'ok'),text:`${d.used} / ${d.seats} places`})),
   h('p',{class:'small muted',text:`Forfait ${d.plan} : vous et vos membres partagez ses fonctions et son quota de panneaux. Chacun garde ses sites et peut les partager avec l’équipe.`}),
   quotaBlock(d),
   h('label',{class:'check'},h('input',{type:'checkbox',checked:d.public,onchange:async e=>{await api('/api/account?action=team-public',{method:'POST',body:{public:e.target.checked}});toast(e.target.checked?'Votre entreprise est visible dans l’annuaire.':'Votre entreprise n’apparaît plus dans l’annuaire.');}}),
    ' Visible dans l’annuaire (vos employés peuvent vous trouver et demander à rejoindre l’équipe)')),
  d.requests.length?h('div',{class:'card form-card'},h('h2',{text:`Demandes à traiter (${d.requests.length})`}),...d.requests.map(r=>h('div',{class:'row-between team-row'},h('div',{},h('b',{text:r.name}),h('div',{class:'small muted',text:`${r.email} · ${fmt(r.since)}`})),
   h('div',{class:'page-actions'},h('button',{type:'button',class:'ghost sm',onclick:()=>respond(r.id,false)},'Refuser'),h('button',{type:'button',class:'primary sm',disabled:full,onclick:()=>respond(r.id,true)},'Accepter'))))):null,
  h('div',{class:'card form-card'},h('h2',{text:`Membres (${d.members.length})`}),
   h('div',{class:'row-between team-row'},h('div',{},h('b',{text:`${d.ownerName} (propriétaire)`}),h('div',{class:'small muted',text:usageText(d.ownerUsage,d.quota)}))),
   d.members.length?d.members.map(m=>h('div',{class:'row-between team-row'},h('div',{},h('b',{text:m.name}),h('div',{class:'small muted',text:`${m.email} · ${usageText(m,d.quota)} · depuis le ${fmt(m.since)}`})),
    h('button',{type:'button',class:'ghost sm',onclick:async()=>{if(!await confirmDialog(`Retirer ${m.name} de l’équipe ? Ses sites lui restent ; il revient au forfait gratuit.`,{title:'Retirer un membre',confirm:'Retirer',danger:true}))return;await api('/api/account?action=team-remove',{method:'POST',body:{userId:m.id}});toast('Membre retiré.');reload();}},'Retirer'))):h('p',{class:'small muted',text:'Aucun membre pour l’instant.'})),
  h('div',{class:'card form-card'},h('h2',{text:'Inviter un membre'}),
   full?h('p',{class:'issue warn',text:'Toutes les places de votre forfait sont occupées.'}):h('div',{class:'inline-form'},email,h('button',{type:'button',class:'primary',onclick:invite},'Créer une invitation')),
   linkBox,
   d.invites.length?h('div',{class:'mt'},h('h3',{text:'Invitations en attente'}),...d.invites.map(i=>h('div',{class:'row-between team-row'},h('span',{class:'small',text:`${i.email||'Lien sans courriel'} · expire le ${fmt(i.expiresAt)}`}),
    h('button',{type:'button',class:'ghost sm',onclick:async()=>{await api('/api/account?action=team-invite-revoke',{method:'POST',body:{id:i.id}});toast('Invitation annulée.');reload();}},'Annuler')))):null));
}

// ---------- Accepter une invitation ----------
export async function joinInviteView({ctx,token}){
 ctx.crumbs([['Mes sites','#/sites'],['Invitation']]);
 const box=h('div',{class:'card form-card stack'});
 try{
  const i=await api('/api/account?action=team-invite&token='+encodeURIComponent(token));
  box.append(h('h2',{text:`Rejoindre l’équipe de ${i.owner}`}),h('p',{class:'muted',text:`${i.by} vous invite à rejoindre son équipe. Vous profiterez de son forfait Électricien Équipe ; vos sites et panneaux restent les vôtres.`}),
   h('div',{class:'form-actions'},h('a',{class:'btn ghost',href:'#/sites'},'Plus tard'),h('button',{type:'button',class:'primary',onclick:async e=>{e.target.disabled=true;try{const r=await api('/api/account?action=team-join',{method:'POST',body:{token}});toast(r.ownSubscription?`Bienvenue dans l’équipe ${r.owner} ! Pensez à annuler votre abonnement personnel pour ne pas payer en double.`:`Bienvenue dans l’équipe ${r.owner} !`,8000);location.hash='#/equipe';}catch(x){toast(x.message,7000);e.target.disabled=false;}}},'Rejoindre l’équipe')));
 }catch(x){box.append(h('h2',{text:'Invitation'}),h('p',{class:'error',text:x.message}),h('a',{class:'btn',href:'#/equipe'},'Chercher mon électricien'));}
 return h('div',{class:'container narrow'},box);
}

// Abonnement personnel encore actif alors que le membre profite du forfait de l'équipe.
export function doubleBilling(o){
 if(o.cancelAtPeriodEnd)return h('div',{class:'notice info'},`Votre abonnement personnel ${o.plan} est annulé : il ne sera pas renouvelé.`);
 return h('div',{class:'notice'},h('b',{text:'Évitez de payer en double : '}),`votre abonnement personnel ${o.plan} est toujours actif, alors que vous profitez maintenant du forfait de votre équipe. `,
  o.hasStripe?h('a',{href:'#/abonnement',text:'Annuler mon abonnement personnel'}):'Contactez-nous pour l’annuler.');
}

// ---------- Partager un site ou un panneau avec l'équipe ----------
export async function shareDialog({siteId,panelId,title}){
 const q=siteId?'siteId='+siteId:'panelId='+panelId;
 const body=h('div',{class:'stack'},h('p',{class:'muted',text:'Chargement…'}));
 const d=dialog({title:'Partager avec mon équipe',eyebrow:title,body:[body],actions:[{label:'Fermer',kind:'primary'}]});
 const load=async()=>{
  const r=await api('/api/account?action=team-shares&'+q).catch(e=>({error:e.message}));
  if(r.error)return body.replaceChildren(h('p',{class:'error',text:r.error}));
  if(!r.team)return body.replaceChildren(h('p',{class:'muted',text:'Le partage est réservé aux membres d’une équipe (forfait Électricien Équipe). '}),h('a',{href:'#/equipe',onclick:()=>d.close(),text:'Voir Mon équipe'}));
  const target=select('target',[['team','Toute l’équipe'],...r.members.map(m=>[m.id,m.name])],'team');
  const right=select('right',[['view','Lecture seule'],['edit','Modification']],'edit');
  body.replaceChildren(
   h('p',{class:'small muted',text:siteId?'Le site et tous ses panneaux (actuels et futurs) seront visibles par les personnes choisies. Vous restez propriétaire ; eux ne peuvent pas le supprimer.':'Seul ce panneau sera visible par les personnes choisies. Vous restez propriétaire.'}),
   r.shares.length?h('div',{},h('h3',{text:'Partagé avec'}),...r.shares.map(s=>h('div',{class:'row-between team-row'},h('span',{},h('b',{text:s.name}),' · ',s.canEdit?'modification':'lecture seule'),
    h('button',{type:'button',class:'ghost sm',onclick:async()=>{await api('/api/account?action=team-unshare',{method:'POST',body:{id:s.id}});toast('Partage retiré.');load();}},'Retirer')))):h('p',{class:'small',text:'Pas encore partagé.'}),
   h('div',{class:'fields'},field('Avec',target),field('Droit',right)),
   h('div',{class:'form-actions'},h('button',{type:'button',class:'primary',onclick:async()=>{try{await api('/api/account?action=team-share',{method:'POST',body:{siteId,panelId,target:target.value,canEdit:right.value==='edit'}});toast('Partagé.');load();}catch(e){toast(e.message,6000);}}},'Partager')));
 };
 load();
}

const periodWord=q=>q?.type==='monthly'?'ce mois-ci':q?.type==='yearly'?'cette année':'';
function usageText(u,q){return `${u?.panels||0} panneau(x) actif(s)`+(periodWord(q)?` · ${u?.period||0} créé(s) ${periodWord(q)}`:'');}
function quotaBlock(d){
 const q=d.quota||{};if(q.limit==null)return h('p',{class:'small',text:`Quota : illimité · ${q.used||0} panneau(x) ${q.type==='active'?'actif(s)':'créé(s) '+periodWord(q)} pour l’équipe.`});
 const pct=Math.min(100,Math.round((q.used||0)/q.limit*100));
 return h('div',{class:'mt'},h('div',{class:'row-between small'},h('b',{text:`Quota de l’équipe : ${q.used} / ${q.limit} panneaux ${q.type==='active'?'actifs':periodWord(q)}`}),h('span',{text:pct+' %'})),
  h('div',{class:'progress'+(pct>=100?' over':pct>80?' high':'')},h('i',{style:{width:pct+'%'}})));
}
