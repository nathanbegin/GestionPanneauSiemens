// Application Disjonio : routeur, authentification, sites, compte.
import {brandingCard} from './branding.js';
import {ssoButtons,ssoCard,handleSsoReturn} from './sso.js'; // SSO
import {trashDialog} from './trash.js';
import {watchIcons,icon} from './icons.js';
import {applyFont} from './sitefont.js';
import {handoffDialog,handoffView} from './handoff.js';
import {net,bindUser,clearOffline,listDownloads,getDownload,downloadSite,removeDownload} from './offline.js';
import {aiImportDialog} from './aiimport.js';
import {guidedDialog} from './guided.js';
import {feedbackDialog} from './feedback.js';
import {teamView,joinInviteView,shareDialog} from './team.js';
import {h,toast,confirmDialog,fmtRelative,fmtDate,field,dialog,select,hasUnsaved,discardUnsaved} from './dom.js';
import {api,setToken,handleAuthLost,openDocument,NATIVE,webUrl,demo} from './api.js';
import {siteAddress,panelTitle,APP_VERSION} from '../model.js';
import {siteDialog,panelDialog,siteFields,formData} from './forms.js';
import {panelView} from './panel.js';
import {billingView} from './billing.js';
import {updateCard,checkUpdateQuietly} from './update.js';
import {compareView} from './compare.js';
import {lang,setLang,storeLang,followAccountLang} from '../i18n.js';
import {designDialog} from './design.js';
import {adminView} from './admin.js';

const view=document.getElementById('view'),topbar=document.getElementById('topbar');
const state={user:null,features:{},inbox:0};
// Invitations reçues (remise au client) : pastille sur l'avatar et carte sur « Mes sites ».
async function refreshInbox(){
 if(!state.user||state.demo||net.offline){state.inbox=0;}
 else{try{state.inbox=(await api('/api/sites?action=handoff-inbox')).items.length;}catch{state.inbox=0;}}
 document.querySelector('.user-menu .avatar')?.classList.toggle('has-badge',state.inbox>0);
 return state.inbox;
}
const publicRoutes=['connexion','inscription','mot-de-passe-oublie','reinitialiser'];
let renderToken=0;

// ---------- Barre supérieure ----------
async function switchLang(){
 const next=lang==='en'?'fr':'en';
 if(state.user){try{await api('/api/account',{method:'PUT',body:{name:state.user.name,profile:{...(state.user.profile||{}),lang:next}}});}catch{}}
 setLang(next);
}
function crumbs(items){
 const nav=h('nav',{class:'crumbs','aria-label':'Fil d’Ariane'});
 items.forEach(([label,href],i)=>{if(i)nav.append(h('i',{'aria-hidden':'true',text:'›'}));nav.append(href&&i<items.length-1?h('a',{href,text:label}):h('span',{text:label,'aria-current':i===items.length-1?'page':null}));});
 const brand=h('a',{class:'brand',href:state.user||NATIVE?'#/sites':'/','aria-label':'Disjonio — accueil'},h('img',{class:'brand-logo',src:'/branding/disjonio/svg/outlined/disjonio-horizontal-no-tagline-on-light.svg',alt:'Disjonio',width:214,height:44}),h('img',{class:'brand-sym',src:'/branding/disjonio/svg/disjonio-symbol-simple-on-light.svg',alt:'',width:40,height:40}));
 const parts=[brand,nav];
 const isPro=state.user?.profile?.accountType==='pro';
 if(state.user&&!state.demo){
  const menu=h('div',{class:'menu',role:'menu'},
   h('a',{href:'#/sites',class:'menu-brand','aria-label':'Disjonio — accueil'},h('img',{src:'/branding/disjonio/svg/outlined/disjonio-horizontal-no-tagline-on-light.svg',alt:'Disjonio',width:160,height:33})),
   h('div',{class:'who'},h('b',{text:state.user.name}),state.user.email),
   h('a',{href:'#/sites',role:'menuitem'},'🏠 Mes sites'),
   h('a',{href:'#/compte',role:'menuitem'},'👤 Mon compte'),
   h('a',{href:'#/compte',role:'menuitem',onclick:()=>setTimeout(()=>document.getElementById('miseajour')?.scrollIntoView({behavior:'smooth'}),150)},'🔄 Mise à jour',h('i',{class:'update-dot','aria-label':'Nouvelle version disponible'})),
   !isPro&&h('a',{href:'#/comparer',role:'menuitem'},'⇄ Comparer des panneaux'),
   h('a',{href:'#/abonnement',role:'menuitem'},'⭐ Mon abonnement'),
   !isPro&&h('a',{href:'#/equipe',role:'menuitem'},'👥 Mon équipe'),
   state.user.isAdmin&&h('a',{href:'#/admin',role:'menuitem'},'🛠 Administration'),
   h('a',{href:webUrl('/fonctionnement'),role:'menuitem',target:NATIVE?'_blank':null},'❓ Fonctionnement'),
   h('button',{type:'button',role:'menuitem',onclick:()=>feedbackDialog()},'💡 Suggérer une amélioration'),
   h('hr'),
   h('button',{type:'button','data-i18n-skip':'',role:'menuitem',class:'menu-lang',onclick:switchLang},lang==='en'?'Français':'English'),
   h('button',{type:'button',role:'menuitem',onclick:logout},'↩ Se déconnecter'));
  const btn=h('button',{type:'button',class:'ghost','aria-haspopup':'menu','aria-expanded':'false'},h('span',{class:'avatar'+(state.inbox>0?' has-badge':''),title:state.inbox>0?`${state.inbox} invitation(s) en attente`:null,text:(state.user.name||'?').trim().charAt(0).toUpperCase()}),h('span',{class:'uname',text:state.user.name.split(' ')[0]}),h('span',{class:'burger'+(state.inbox>0?' has-badge':'')},icon('menu',26)));
  btn.onclick=e=>{e.stopPropagation();const open=menu.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));};
  parts.push(h('div',{class:'user-menu'},btn,menu));
 }else if(state.demo)parts.push(h('a',{class:'btn primary sm',href:'#/inscription',onclick:leaveDemo},'Créer mon compte gratuit'));
 else parts.push(h('a',{class:'btn sm',href:webUrl('/fonctionnement'),target:NATIVE?'_blank':null},'Fonctionnement'));
 // Langue : FR / EN (le bouton montre la langue vers laquelle on bascule).
 parts.push(h('button',{type:'button',class:'ghost lang-switch','data-i18n-skip':'',title:lang==='en'?'Français':'English','aria-label':lang==='en'?'Passer en français':'Switch to English',onclick:switchLang},lang==='en'?'FR':'EN'));
 // Navigation de travail des professionnels, dans l'en-tête, juste après le logo : Sites · Comparer · Équipe.
 document.getElementById('worknav')?.remove();
 if(state.user&&isPro&&!state.demo){
  const cur=location.hash.split('/')[1]||'';
  const link=(href,label,on)=>h('a',{href,class:on?'on':'','aria-current':on?'page':null,text:label});
  parts.splice(1,0,h('nav',{id:'worknav',class:'worknav','aria-label':'Navigation de travail'},link('#/sites','Sites',['sites','panneaux'].includes(cur)),link('#/comparer','Comparer',cur==='comparer'),link('#/equipe','Équipe',cur==='equipe')));
 }
 topbar.classList.toggle('has-menu',!!(state.user&&!state.demo));
 // Trois zones : logo + navigation de travail à gauche, fil d'Ariane réellement centré, profil + langue à droite.
 const left=parts.filter(el=>el===brand||el.id==='worknav');
 const right=parts.filter(el=>el!==nav&&el!==brand&&el.id!=='worknav');
 topbar.replaceChildren(h('div',{class:'tb-left'},...left),nav,h('div',{class:'tb-right'},...right));
 document.title=(items.at(-1)?.[0]||'Mon espace')+' · Disjonio';
 syncChrome();
}
document.addEventListener('click',()=>document.querySelectorAll('.menu.open').forEach(m=>{m.classList.remove('open');m.previousElementSibling?.setAttribute('aria-expanded','false');}));
// Derniers panneaux consultés (sur cet appareil) : alimente « Continuer » à l'accueil.
const RECENT='mp_recent';
const recents=()=>{try{return JSON.parse(localStorage.getItem(RECENT)||'[]').filter(r=>r&&r.uid===state.user?.id);}catch{return [];}};
function remember(r){try{const all=[{...r,uid:state.user?.id,at:Date.now()},...recents().filter(x=>x.id!==r.id)].slice(0,6);localStorage.setItem(RECENT,JSON.stringify(all));}catch{}}
const ctx={crumbs,remember,get features(){return state.features;},get user(){return state.user;}};

async function logout(){
 try{await api('/api/auth?action=logout',{method:'POST',body:{}});}catch{}
 await clearOffline();
 setToken('');state.user=null;location.hash='#/connexion';toast('Vous êtes déconnecté.');
}
handleAuthLost(()=>{state.user=null;setToken('');if(!publicRoutes.includes(location.hash.split('/')[1]))location.hash='#/connexion';});

// ---------- Authentification ----------
function authCard(title,sub,form,alt){
 crumbs([[title]]);
 return h('div',{class:'container auth-wrap'},h('div',{class:'card auth-card'},h('div',{class:'eyebrow',text:'Disjonio'}),h('h1',{text:title}),sub&&h('p',{class:'muted',text:sub}),form,alt&&h('p',{class:'alt'},alt)));
}
function authForm(fields,submitLabel,onSubmit){
 const e=h('p',{class:'error',role:'alert'});
 const btn=h('button',{type:'submit',class:'primary lg',text:submitLabel});
 const form=h('form',{class:'stack',novalidate:true},fields,e,btn);
 form.addEventListener('submit',async ev=>{ev.preventDefault();e.textContent='';btn.disabled=true;try{await onSubmit(formData(form),form);}catch(x){e.textContent=x.message;}finally{btn.disabled=false;}});
 return form;
}
async function afterAuth(out,welcome){
 setToken(out.token);state.user=out.user;bindUser(out.user.id);if(followAccountLang(out.user.profile))return;
 const redirect=sessionStorage.getItem('mp_after_login');sessionStorage.removeItem('mp_after_login');
 location.hash=redirect||'#/sites';toast(welcome);
}
function loginView(){
 const form=authForm([
  field('Courriel',h('input',{name:'email',type:'email',autocomplete:'email',required:true,inputmode:'email'})),
  field('Mot de passe',h('input',{name:'password',type:'password',autocomplete:'current-password',required:true})),
  h('a',{href:'#/mot-de-passe-oublie',class:'small',text:'Mot de passe oublié ?'})],'Se connecter',async f=>{
  const out=await api('/api/auth?action=login',{method:'POST',body:f});await afterAuth(out,'Bon retour, '+out.user.name.split(' ')[0]+' !');});
 ssoButtons().then(b=>b&&form.before(b)); // SSO
 return authCard('Connexion','Retrouvez vos sites et vos panneaux.',form,['Pas encore de compte ? ',h('a',{href:'#/inscription',text:'Créer un compte gratuit'}),' · ',h('a',{href:'#/demo',text:'Essayer la démonstration'})]);
}
function signupView(){
 const radio=(v,title,desc,checked)=>h('label',{},h('input',{type:'radio',name:'accountType',value:v,checked}),h('span',{},h('b',{text:title}),h('span',{text:desc})));
 const form=authForm([
  field('Nom complet',h('input',{name:'name',autocomplete:'name',required:true,maxlength:100})),
  field('Courriel',h('input',{name:'email',type:'email',autocomplete:'email',required:true,inputmode:'email'})),
  field('Mot de passe',h('input',{name:'password',type:'password',autocomplete:'new-password',required:true,minlength:10}),{hint:'Au moins 10 caractères.'}),
  field('Langue / Language',select('lang',[['fr','Français'],['en','English']],lang)),
  h('div',{class:'radio-cards',role:'radiogroup','aria-label':'Type de compte'},radio('particulier','Particulier','Ma maison, mon chalet…',true),radio('pro','Électricien / entrepreneur','Rapports à mon nom, plusieurs clients')),
  h('label',{class:'check'},h('input',{type:'checkbox',name:'acceptTerms',value:'1'}),h('span',{},'J’accepte les ',h('a',{href:webUrl('/conditions'),target:'_blank',text:'conditions d’utilisation'}),' et la ',h('a',{href:webUrl('/confidentialite'),target:'_blank',text:'politique de confidentialité'}),'.'))],'Créer mon compte',async f=>{
  storeLang(f.lang);const out=await api('/api/auth?action=signup',{method:'POST',body:{...f,acceptTerms:!!f.acceptTerms}});await afterAuth(out,'Bienvenue, '+out.user.name.split(' ')[0]+' ! Ajoutez votre premier site.');});
 ssoButtons().then(b=>b&&form.before(b)); // SSO
 return authCard('Créer un compte','Gratuit. Vos données restent privées.',form,['Déjà inscrit ? ',h('a',{href:'#/connexion',text:'Se connecter'})]);
}
function forgotView(){
 const form=authForm([field('Courriel du compte',h('input',{name:'email',type:'email',autocomplete:'email',required:true}))],'Recevoir un lien',async(f,el)=>{
  await api('/api/auth?action=forgot',{method:'POST',body:f});
  el.replaceWith(h('p',{class:'notice info',text:'Si un compte existe pour cette adresse, un lien de réinitialisation valable une heure vient d’être envoyé. Vérifiez aussi vos indésirables.'}));});
 return authCard('Mot de passe oublié','Nous vous enverrons un lien pour en choisir un nouveau.',form,[h('a',{href:'#/connexion',text:'← Retour à la connexion'})]);
}
function resetView(token){
 const form=authForm([field('Nouveau mot de passe',h('input',{name:'password',type:'password',autocomplete:'new-password',required:true,minlength:10}),{hint:'Au moins 10 caractères.'})],'Enregistrer et me connecter',async f=>{
  const out=await api('/api/auth?action=reset',{method:'POST',body:{token,password:f.password}});await afterAuth(out,'Mot de passe modifié.');});
 return authCard('Nouveau mot de passe',null,form);
}

// ---------- Affichage tuiles / liste (mémorisé sur l'appareil) ----------
const getPref=(k,d)=>{try{return localStorage.getItem(k)||d;}catch{return d;}};
const setPref=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
/** Bascule tuiles / liste sur `target` (élément « .cards »). */
function viewToggle(key,target){
 let mode=getPref(key,'grid')==='list'?'list':'grid';
 const apply=()=>{target.classList.toggle('list',mode==='list');for(const b of box.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode)),b.classList.toggle('on',b.dataset.mode===mode);};
 const mk=(m,label)=>h('button',{type:'button','data-mode':m,onclick:()=>{mode=m;setPref(key,m);apply();}},label);
 const box=h('div',{class:'view-switch',role:'group','aria-label':'Affichage : tuiles ou liste'},mk('grid','▦ Tuiles'),mk('list','☰ Liste'));
 apply();return box;
}
// ---------- Sites ----------
async function sitesView(){
 crumbs([['Mes sites']]);
 const [{sites:allSites},usage,inv]=await Promise.all([api('/api/sites'),api('/api/billing').catch(()=>null),api('/api/sites?action=handoff-inbox').catch(()=>({items:[]}))]);
 state.inbox=inv.items.length;document.querySelector('.user-menu .avatar')?.classList.toggle('has-badge',state.inbox>0);
 // Invitations reçues : accepter ou refuser sans passer par le lien du courriel.
 const answer=async(it,name,ok)=>{try{const r=await api('/api/sites?action='+name,{method:'POST',body:{hid:it.id}});toast(ok?(it.kind==='transfer'?'Copie ajoutée à votre compte.':'Accès ajouté à vos sites.'):'Invitation refusée.');await refreshInbox();ok?location.hash='#/sites/'+r.siteId:route();}catch(e){toast(e.message,8000);}};
 const inviteBox=inv.items.length?h('section',{class:'invites','aria-label':'Invitations reçues'},...inv.items.map(it=>h('div',{class:'card invite-card'},
  h('div',{},h('b',{text:`${it.from} ${it.kind==='transfer'?'vous remet une copie du dossier':'vous donne accès au dossier'} « ${it.site} »`}),h('div',{class:'small muted',text:it.kind==='transfer'?'Après acceptation, la copie vous appartient : les deux copies sont indépendantes.':'Accès en lecture seule, que la personne peut retirer en tout temps.'})),
  h('div',{class:'page-actions'},h('button',{type:'button',class:'ghost',onclick:()=>answer(it,'handoff-decline',false)},'Refuser'),h('button',{type:'button',class:'primary',onclick:()=>answer(it,'handoff-accept',true)},it.kind==='transfer'?'Accepter la copie':'Accepter l’accès'))))):null;
 // Hors ligne : seuls les sites téléchargés sont consultables.
 let sites=allSites;
 if(net.offline){const ok=new Set((await listDownloads()).map(d=>d.id));sites=allSites.filter(x=>ok.has(x.id));}
 const chip=usage&&h('a',{class:'usage-chip',href:'#/abonnement'},h('b',{text:usage.plan.name}),usage.limit==null?`${usage.used} panneaux`:`${usage.used} / ${usage.limit} panneaux${usage.plan.quotaType==='monthly'?' ce mois-ci':''}`,usage.credits?` · +${usage.credits} prépayés`:'',usage.canCreatePanel?'':' · Augmenter →');
 const create=()=>siteDialog(null,async f=>{const {site}=await api('/api/sites',{method:'POST',body:f});toast('Site créé. Ajoutez maintenant un panneau.');location.hash='#/sites/'+site.id;});
 const first=state.user.name.split(' ')[0];
 if(!sites.length)return h('div',{class:'container'},inviteBox||'',h('div',{class:'card empty-state'},
  h('div',{class:'ico',text:'🏠'}),h('h2',{text:`Bienvenue, ${first} !`}),h('p',{text:'Commencez par ajouter un site : l’adresse d’une maison, d’un chalet ou d’un client. Vous y ajouterez ensuite ses panneaux électriques.'}),
  h('div',{class:'onboard'},h('div',{},h('b',{text:'1. Un site'}),h('span',{text:'Une adresse (maison, chalet, client).'})),h('div',{},h('b',{text:'2. Ses panneaux'}),h('span',{text:'Principal, sous-panneau du garage…'})),h('div',{},h('b',{text:'3. Les circuits'}),h('span',{text:'Touchez chaque disjoncteur et décrivez-le.'}))),
  h('button',{type:'button',class:'primary lg',onclick:create},'+ Ajouter mon premier site'),
  h('p',{class:'small muted mt'},h('button',{type:'button',class:'link',onclick:()=>trashDialog({onRestored:route})},'🗑 Corbeille'),' (sites et panneaux supprimés, récupérables 30 jours)'),
  h('p',{class:'small muted mt'},'Forfait gratuit : 5 panneaux. ',h('a',{href:'#/abonnement',text:'Voir les forfaits'}),'.'),
  h('p',{class:'small muted mt'},'Vous utilisiez l’ancienne version avec une clé d’accès ? ',h('a',{href:'#/compte',text:'Importez vos panneaux'}),'.')));
 const resume=recents().filter(r=>sites.some(x=>x.panels.some(p=>p.id===r.id))).slice(0,3);
 const resumeBox=resume.length?h('section',{class:'resume','aria-label':'Reprendre le travail'},h('h2',{class:'resume-title',text:'Reprendre le travail'}),h('div',{class:'resume-cards'},...resume.map(r=>h('a',{class:'card resume-card',href:'#/panneaux/'+r.id},h('b',{text:(r.tag?r.tag+' · ':'')+r.name}),h('span',{class:'small muted',text:r.site}),h('span',{class:'resume-cta',text:r.toConfirm>0?`Continuer le relevé — ${r.toConfirm} circuit${r.toConfirm>1?'s':''} à confirmer`:'Rouvrir le panneau'}))))):null;
// Recherche sur l'ensemble des sites : site, client, panneau, circuit, appareil.
 const found=h('div',{class:'search-results',role:'region','aria-live':'polite'});let timer=0,seq=0;
 const gsearch=h('label',{class:'search global-search'},h('span',{'aria-hidden':'true',text:'⌕'}),h('input',{type:'search',placeholder:'Rechercher dans tous mes sites : chauffe-eau, client, SP-GAR…','aria-label':'Rechercher dans tous mes sites',oninput:e=>{
  clearTimeout(timer);const q=e.target.value.trim();
  if(q.length<2){found.replaceChildren();gridWrap.hidden=false;return;}
  timer=setTimeout(async()=>{const my=++seq;try{const r=await api('/api/sites?search='+encodeURIComponent(q));if(my!==seq)return;gridWrap.hidden=true;
   const icon={site:'🏠',panel:'▦',circuit:'⚡'};
   found.replaceChildren(r.results.length?h('div',{class:'result-list'},...r.results.map(x=>h('a',{class:'result card',href:x.panelId?'#/panneaux/'+x.panelId+(x.type==='circuit'?'/panel':''):'#/sites/'+x.siteId,onclick:()=>{if(x.type==='circuit'){try{sessionStorage.setItem('mp_goto_circuit',x.circuitId);}catch{}}}},h('span',{class:'ico','aria-hidden':'true',text:icon[x.type]}),h('span',{},h('b',{text:x.title}),h('small',{class:'muted',text:x.sub}))))):h('p',{class:'muted',text:'Aucun résultat.'}));
  }catch(err){if(my===seq)found.replaceChildren(h('p',{class:'error',text:err.message}));}},250);}}));
 const gridWrap=h('div');
 const grid=h('div',{class:'cards'},...sites.map(s=>h('a',{class:'card site-card',href:'#/sites/'+s.id},
   h('div',{},h('h2',{text:s.name}),s.shared&&h('span',{class:'badge shared',text:`👥 Partagé par ${s.shared.by}`}),h('div',{class:'addr',text:siteAddress(s)||'Adresse à préciser'}),s.client&&h('div',{class:'addr',text:'Client : '+s.client})),
   h('div',{class:'chips'},s.panels.length?s.panels.map(p=>h('span',{class:'badge '+(p.progress===100?'ok':''),text:`${p.tag||p.name} · ${p.progress} %`})):h('span',{class:'badge warn',text:'Aucun panneau'})),
   h('div',{class:'small muted',text:'Modifié '+fmtRelative(s.updatedAt)}))),
   h('button',{type:'button',class:'add-card',onclick:create},'+ Ajouter un site'));
 const bmS=sites.length>1&&!state.demo&&!net.offline?batchManage({grid,cardSel:'.site-card',items:sites,noun:'site',url:'/api/sites?id=',after:route}):null;
 return h('div',{class:'container'},
  h('div',{class:'page-head'},h('div',{},h('div',{class:'eyebrow',text:`${lang==="en"?"Hello":"Bonjour"} ${first}`}),h('h1',{text:'Mes sites'}),h('div',{class:'sub',text:`${sites.length} site${sites.length>1?'s':''} · ${sites.reduce((n,s)=>n+s.panelCount,0)} panneau(x)`})),h('div',{class:'page-actions'},chip,viewToggle('mp_sites_view',grid),bmS?.btn||'',h('button',{type:'button',onclick:()=>trashDialog({onRestored:route})},'🗑 Corbeille'),h('button',{type:'button',class:'primary',onclick:create},'+ Nouveau site'))),
  inviteBox||'',bmS?.bar||'',gsearch,found,(()=>{gridWrap.append(resumeBox||'',grid);return gridWrap;})());
}


// Sélection multiple pour supprimer plusieurs sites / panneaux d'un coup (corbeille 30 jours).
function batchManage({grid,cardSel,items,noun,url,after}){
 let on=false;const sel=new Set();
 const cards=[...grid.querySelectorAll(cardSel)];cards.forEach((c,i)=>{c.dataset.id=items[i].id;});
 const count=h('b',{text:'0'});
 const delBtn=h('button',{type:'button',class:'danger',disabled:true,onclick:async()=>{
  if(!sel.size)return;
  if(!await confirmDialog(`Mettre ${sel.size} ${noun}${sel.size>1?'s':''} à la corbeille ? Ils resteront récupérables pendant 30 jours.`,{title:'Suppression multiple',confirm:'Mettre à la corbeille',danger:true}))return;
  let ok=0,ko=0;for(const id of [...sel]){try{await api(url+encodeURIComponent(id),{method:'DELETE'});ok++;}catch{ko++;}}
  toast(`${ok} ${noun}${ok>1?'s':''} placé${ok>1?'s':''} dans la corbeille.`+(ko?` ${ko} n’a/ont pas pu être supprimé(s).`:''),6000);after();}},'Supprimer la sélection');
 const refresh=()=>{count.textContent=String(sel.size);delBtn.disabled=!sel.size;cards.forEach(c=>{const x=sel.has(c.dataset.id);c.classList.toggle('selected',x);c.setAttribute('aria-pressed',String(x));});};
 const all=h('button',{type:'button',onclick:()=>{const eligible=items.filter(i=>!i.shared).map(i=>i.id);if(sel.size===eligible.length)sel.clear();else eligible.forEach(i=>sel.add(i));refresh();}},'Tout sélectionner');
 const bar=h('div',{class:'batch-bar'},h('span',{},count,' sélectionné(s)'),all,delBtn);bar.hidden=true;
 grid.addEventListener('click',e=>{if(!on)return;const c=e.target.closest(cardSel);if(!c)return;e.preventDefault();const it=items.find(i=>i.id===c.dataset.id);if(!it||it.shared)return;sel.has(it.id)?sel.delete(it.id):sel.add(it.id);refresh();},true);
 const btn=h('button',{type:'button',onclick:()=>{on=!on;sel.clear();grid.classList.toggle('selecting',on);bar.hidden=!on;btn.textContent=on?'Terminer':'☑ Sélectionner';refresh();}},'☑ Sélectionner');
 return {btn,bar};
}

function tree(panels){
 const byParent=new Map();
 for(const p of panels){const k=panels.some(x=>x.id===p.details?.fedFrom)?p.details.fedFrom:'';byParent.set(k,[...(byParent.get(k)||[]),p]);}
 const seen=new Set();
 const branch=key=>{const kids=(byParent.get(key)||[]).filter(p=>!seen.has(p.id));if(!kids.length)return null;return h('ul',{},kids.map(p=>{seen.add(p.id);return h('li',{},h('a',{href:'#/panneaux/'+p.id,text:panelTitle(p)}),h('span',{class:'small muted',text:` · ${p.kind}${p.details?.fedFromCircuit?' · circuit '+p.details.fedFromCircuit:''}`}),branch(p.id));}));};
 return h('div',{class:'tree'},h('div',{class:'root',text:'⚡ Entrée électrique'}),branch(''));
}
async function siteView(id){
 const {site,panels}=await api('/api/sites?id='+encodeURIComponent(id));
 crumbs([['Mes sites','#/sites'],[site.name]]);
 const ent=await api('/api/billing').catch(()=>null);
 const library=!!(ent?.plan?.features?.planning||state.user.isAdmin);
 const addGuided=()=>guidedDialog({site,siblings:panels,library,onCreated:p=>{location.hash='#/panneaux/'+p.id;}});
 const addByPhoto=()=>aiImportDialog({site,siblings:panels,onCreated:p=>{location.hash='#/panneaux/'+p.id;}});
 const createPanel=(details={},title='Nouveau panneau')=>panelDialog({siblings:panels,library,defaultBipolar:site.bipolarVolts,title,initial:{details},onSave:async f=>{const {panel}=await api('/api/panels',{method:'POST',body:{siteId:site.id,...f}});toast('Panneau créé. Touchez un disjoncteur pour commencer.');location.hash='#/panneaux/'+panel.id;}});
 // Un projet de panneau passe par trois étapes : conception, relevé, vérification. On choisit par où commencer.
 const choice=(ico,title,text,onclick)=>h('button',{type:'button',class:'stage-choice',onclick},h('span',{class:'ico','aria-hidden':'true',text:ico}),h('b',{text:title}),h('span',{class:'small muted',text}));
 const releveChoices=()=>{const d=dialog({title:'Relever un panneau existant',eyebrow:site.name,wide:true,body:[h('div',{class:'stage-choices'},
   choice('📷','Par photo (IA)','Photographiez le panneau ouvert : l’IA lit les disjoncteurs.',()=>{d.close();addByPhoto();}),
   choice('🧭','Mode guidé','Répondez à des questions, position par position.',()=>{d.close();addGuided();}),
   choice('✍️','Saisie manuelle','Créez le panneau vide et décrivez chaque disjoncteur.',()=>{d.close();createPanel({stage:'releve',state:'Existant'},'Nouveau panneau à relever');}))],actions:[{label:'Retour',kind:'ghost'}]});};
 const verifyChoices=()=>{
  if(!panels.length){toast('Relevez d’abord un panneau : la vérification se base sur ses circuits.');return releveChoices();}
  const sel=select('p',panels.map(p=>[p.id,panelTitle(p)]),panels[0].id);
  const d=dialog({title:'Vérifier la charge d’un panneau',eyebrow:site.name,body:[h('p',{class:'muted',text:'Inscrivez les gros électroménagers (avec la plaque signalétique en photo) et reliez-les au bon circuit. Le calcul de charge se base sur le relevé déjà fait.'}),field('Panneau',sel)],actions:[{label:'Annuler',kind:'ghost'},{label:'Ouvrir la vérification',kind:'primary',onClick:()=>{location.hash=`#/panneaux/${sel.value}/appliances`;}}]});};
 // Une seule entrée « Ajouter un panneau » : panneau existant (relevé) ou projet de panneau (conception).
 // Restauration d'un panneau depuis une sauvegarde JSON (export « Sauvegarde JSON » d'un panneau, ou ancienne version).
 const restoreJson=()=>{
  const input=h('input',{type:'file',accept:'application/json,.json',class:'sr-only'});
  document.body.append(input);
  input.addEventListener('change',async()=>{
   const file=input.files[0];input.remove();if(!file)return;
   try{
    if(file.size>1500000)throw Error('Fichier trop volumineux.');
    const data=JSON.parse(await file.text());
    if(!Array.isArray(data.circuits)||!data.circuits.length)throw Error('Fichier non reconnu : ce n’est pas une sauvegarde de panneau Disjonio.');
    const maxPos=Math.max(...data.circuits.flatMap(c=>(c.slots||[]).map(x=>parseInt(x,10)||0)),0);
    const positions=Number.isInteger(data.positions)?data.positions:Math.max(8,Math.ceil(maxPos/2)*2);
    const name=String(data.panel||data.name||'Panneau restauré').slice(0,100);
    const used=data.circuits.filter(c=>c.label||c.amps).length;
    if(!await confirmDialog(`Restaurer « ${name} » (${positions} positions, ${used} circuit(s) décrit(s)) dans « ${site.name} » ? Un nouveau panneau sera créé avec ces données ; rien n’est remplacé.`,{title:'Restaurer une sauvegarde',confirm:'Restaurer'}))return;
    const meta={name,tag:String(data.tag||'').slice(0,24),kind:data.kind||'Principal',location:String(data.location||'').slice(0,140),details:(data.details&&typeof data.details==='object'?data.details:{})};
    const {panel}=await api('/api/panels',{method:'POST',body:{siteId:site.id,...meta,positions,circuits:data.circuits}});
    toast('Panneau restauré.');location.hash='#/panneaux/'+panel.id;
   }catch(e){toast(e.message,8000);}
  });
  input.click();
 };
 const addPanel=()=>{const d=dialog({title:'Ajouter un panneau',eyebrow:site.name,wide:true,body:[h('div',{class:'stage-choices'},
   choice('📋','Panneau existant','Il est déjà installé : le relever par photo (IA), par questions ou par saisie.',()=>{d.close();releveChoices();}),
   choice('💾','Restaurer une sauvegarde','Recréer un panneau à partir d’un fichier JSON exporté depuis Disjonio (ou de l’ancienne version).',()=>{d.close();restoreJson();}),
   choice('✏️','Projet de panneau','Il n’existe pas encore : concevoir un nouveau panneau ou un agrandissement.',()=>{d.close();designDialog({site,onCreated:p=>{location.hash='#/panneaux/'+p.id;},onManual:()=>createPanel({stage:'conception',state:'Planifié'},'Nouveau panneau à concevoir')});})),
   panels.length>0&&h('p',{class:'small'},h('button',{type:'button',class:'link',onclick:()=>{d.close();verifyChoices();}},'Vérifier la charge d’un panneau existant'),' (électroménagers et calcul).')],actions:[{label:'Annuler',kind:'ghost'}]});};
 // Disponible hors ligne : conserve le site et ses panneaux sur cet appareil (consultation sans réseau).
 const dlRec=await getDownload(site.id);
 const offlineBtn=net.offline?null:h('button',{type:'button',onclick:()=>{
  const run=async()=>{try{toast('Téléchargement du site…');const r=await downloadSite(site.id,p=>api(p));toast(`Site disponible hors ligne (${r.panels} panneau${r.panels>1?'x':''}).`);route();}catch(e){toast(e.message,7000);}};
  if(!dlRec)return run();
  const d=dialog({title:'Disponible hors ligne',eyebrow:site.name,body:[h('p',{class:'muted',text:`Copie enregistrée ${fmtRelative(dlRec.savedAt)} sur cet appareil. Les PDF, les photos et les modifications exigent une connexion.`})],actions:[{label:'Fermer',kind:'ghost'},{label:'Retirer de cet appareil',kind:'danger',onClick:async()=>{await removeDownload(site.id);toast('Copie hors ligne retirée.');route();}},{label:'Actualiser',kind:'primary',onClick:()=>{run();}}]});
 }},dlRec?'📥 Hors ligne ✓':'📥 Rendre disponible hors ligne');
 const handoff=()=>handoffDialog({site});
 const edit=()=>siteDialog(site,async f=>{await api('/api/sites?id='+site.id,{method:'PUT',body:f});toast('Site modifié.');route();});
 const remove=async()=>{if(!await confirmDialog(`Supprimer « ${site.name} », ses ${panels.length} panneau(x) et tous leurs circuits ? Il sera placé dans la corbeille pendant 30 jours : vous pourrez le restaurer.`,{title:'Supprimer le site',confirm:'Mettre à la corbeille',danger:true}))return;await api('/api/sites?id='+site.id,{method:'DELETE'});toast('Site placé dans la corbeille (30 jours).');location.hash='#/sites';};
 const report=async()=>{try{toast('Génération du rapport du site…');await openDocument({site:site.id,kind:'report'});}catch(e){toast(e.message);}};
 const panelCards=panels.map(p=>h('a',{class:'card panel-card',href:'#/panneaux/'+p.id},
  h('div',{class:'row'},h('span',{class:'badge tag',text:p.tag||'—'}),h('span',{text:p.kind})),
  h('div',{},h('h2',{text:p.name}),h('div',{class:'loc',text:'📍 '+(p.location||'Emplacement à préciser')+(p.details?.building?' · '+p.details.building:'')})),
  h('div',{class:'progress','aria-label':`Avancement ${p.stats.progress} %`},h('i',{style:{width:p.stats.progress+'%'}})),
  h('div',{class:'row'},h('span',{text:`${p.stats.identified} identifiés · ${p.stats.toConfirm} à confirmer`}),h('span',{text:`${p.positions} pos.${p.details?.mainAmps?' · '+p.details.mainAmps+' A':''}`}))));
 return h('div',{class:'container'},
  h('div',{class:'page-head'},
   h('div',{},h('div',{class:'eyebrow',text:'Site'}),h('h1',{text:site.name}),h('div',{class:'sub',text:siteAddress(site)||'Adresse à préciser'}),site.client&&h('div',{class:'sub',text:'Client : '+site.client})),
   h('div',{class:'page-actions'},site.shared?h('span',{class:'badge shared',text:`👥 Partagé par ${site.shared.by} · ${site.shared.role==='edit'?'modification':'lecture seule'}`}):h('button',{type:'button',onclick:()=>shareDialog({siteId:site.id,title:site.name})},'👥 Partager'),!site.shared||site.shared.role==='edit'?h('button',{type:'button',onclick:edit},'Modifier'):null,offlineBtn,!site.shared&&!net.offline&&!state.demo?h('button',{type:'button',onclick:handoff},'🤝 Remettre au client'):null,panels.length?h('button',{type:'button',onclick:report},'📄 Rapport PDF du site'):null,h('button',{type:'button',class:'primary',onclick:addPanel},'+ Ajouter un panneau'))),
  h('div',{class:'split'},
   h('section',{'aria-label':'Panneaux'},
    panels.length?(()=>{const g=h('div',{class:'cards'},...panelCards,h('button',{type:'button',class:'add-card',onclick:addPanel},'+ Ajouter un panneau'));const bm=panels.length>1&&!site.shared&&!state.demo&&!net.offline?batchManage({grid:g,cardSel:'.panel-card',items:panels,noun:'panneau',url:'/api/panels?id=',after:route}):null;return h('div',{},h('div',{class:'cards-toolbar'},bm?.btn||'',viewToggle('mp_panels_view',g)),bm?.bar||'',g);})()
     :h('div',{class:'card empty-state'},h('div',{class:'ico',text:'▦'}),h('h2',{text:'Aucun panneau pour l’instant'}),h('p',{text:'Ajoutez le panneau principal. Vous pourrez ensuite ajouter les sous-panneaux (garage, atelier, logement…) et indiquer lequel alimente l’autre.'}),h('div',{class:'page-actions center'},h('button',{type:'button',class:'primary lg',onclick:addPanel},'+ Ajouter le panneau principal')))),
   h('aside',{class:'stack'},
    panels.length>0&&h('div',{class:'card side-card'},h('h3',{text:'Hiérarchie d’alimentation'}),tree(panels)),
    h('div',{class:'card side-card'},h('h3',{text:'Informations'}),h('dl',{class:'facts'},h('dt',{text:'Adresse'}),h('dd',{text:siteAddress(site)||'—'}),h('dt',{text:'Client'}),h('dd',{text:site.client||'—'}),h('dt',{text:'Panneaux'}),h('dd',{text:String(panels.length)}),h('dt',{text:'Modifié'}),h('dd',{text:fmtRelative(site.updatedAt)})),site.notes&&h('p',{class:'small muted mt',text:site.notes})),
    panels.length>=2&&library&&h('a',{class:'btn',href:`#/comparer/${panels[0].id}/${panels[1].id}`},'⇄ Comparer des panneaux'),
    site.shared?null:h('button',{type:'button',class:'danger',onclick:remove},'Supprimer ce site'))));
}

// ---------- Compte ----------
function accountView(){
 crumbs([['Mes sites','#/sites'],['Mon compte']]);
 const u=state.user,p=u.profile||{};
 const proBox=h('div',{class:'fields'},
  field('Entreprise',h('input',{name:'company',value:p.company||'',maxlength:120,placeholder:'Électricité Exemple inc.'})),
  field('Licence RBQ',h('input',{name:'licence',value:p.licence||'',maxlength:60,placeholder:'0000-0000-00'})),
  field('Téléphone',h('input',{name:'phone',value:p.phone||'',maxlength:40,type:'tel',autocomplete:'tel'})),
  field('Courriel professionnel',h('input',{name:'proEmail',value:p.proEmail||'',maxlength:200,type:'email'})),
  field('Adresse de l’entreprise',h('input',{name:'address',value:p.address||'',maxlength:200}),{full:true}));
 const radio=(v,title,desc)=>h('label',{},h('input',{type:'radio',name:'accountType',value:v,checked:(p.accountType||'particulier')===v}),h('span',{},h('b',{text:title}),h('span',{text:desc})));
 const e1=h('p',{class:'error',role:'alert'});
 const profile=h('form',{class:'card form-card',novalidate:true},
  h('fieldset',{class:'form-section'},h('legend',{text:'Profil'}),h('div',{class:'fields'},field('Nom complet',h('input',{name:'name',value:u.name,required:true,maxlength:100,autocomplete:'name'})),field('Courriel de connexion',h('input',{value:u.email,readOnly:true,disabled:true})))),
  h('fieldset',{class:'form-section'},h('legend',{text:'Type de compte'}),h('div',{class:'radio-cards'},radio('particulier','Particulier','Rapports à votre nom.'),radio('pro','Électricien / entrepreneur','Entreprise, licence RBQ et coordonnées sur les rapports.'))),
  h('fieldset',{class:'form-section'},h('legend',{text:'Langue'}),h('div',{class:'fields'},field('Langue de l’application, des PDF et des courriels',select('lang',[['fr','Français'],['en','English']],p.lang||lang),{hint:'Language of the application, PDFs and emails.'}))),
  h('fieldset',{class:'form-section'},h('legend',{text:'Informations professionnelles (rapports PDF)'}),proBox),e1,
  h('div',{class:'form-actions'},h('button',{type:'submit',class:'primary'},'Enregistrer le profil')));
 const syncPro=()=>{proBox.closest('fieldset').hidden=profile.elements.accountType.value!=='pro';};
 profile.addEventListener('change',syncPro);syncPro();
 profile.addEventListener('submit',async ev=>{ev.preventDefault();e1.textContent='';const f=formData(profile);try{const out=await api('/api/account',{method:'PUT',body:{name:f.name,profile:f}});state.user=out.user;toast('Profil enregistré.');if((out.user.profile?.lang||'fr')!==lang)setLang(out.user.profile.lang);crumbs([['Mes sites','#/sites'],['Mon compte']]);}catch(x){e1.textContent=x.message;}});

 const e2=h('p',{class:'error',role:'alert'});
 const pwd=h('form',{class:'card form-card',novalidate:true},h('fieldset',{class:'form-section'},h('legend',{text:'Mot de passe'}),h('div',{class:'fields'},
  field('Mot de passe actuel',h('input',{name:'current',type:'password',autocomplete:'current-password'})),field('Nouveau mot de passe',h('input',{name:'password',type:'password',autocomplete:'new-password',minlength:10}),{hint:'Au moins 10 caractères. Vos autres appareils seront déconnectés.'}))),e2,
  h('div',{class:'form-actions'},h('button',{type:'submit'},'Changer le mot de passe')));
 pwd.addEventListener('submit',async ev=>{ev.preventDefault();e2.textContent='';try{await api('/api/account?action=password',{method:'PUT',body:formData(pwd)});pwd.reset();toast('Mot de passe modifié.');}catch(x){e2.textContent=x.message;}});

 const e3=h('p',{class:'error',role:'alert'});
 const legacy=h('form',{class:'card form-card',novalidate:true},h('fieldset',{class:'form-section'},h('legend',{text:'Ancienne version (clé d’accès)'}),
  h('p',{class:'small muted',text:'Copie les panneaux de l’ancienne application (GestionPanneauSiemens 1.x) dans un nouveau site de votre compte. Rien n’est supprimé.'}),
  h('div',{class:'fields'},field('Clé d’accès de l’ancienne version',h('input',{name:'key',type:'password',autocomplete:'off'})),field('Nom du nouveau site',h('input',{name:'siteName',value:'Ma maison',maxlength:100})))),e3,
  h('div',{class:'form-actions'},h('a',{class:'btn ghost',href:webUrl('/ancien/'),target:'_blank'},'Ouvrir l’ancienne interface'),h('button',{type:'submit'},'Importer mes panneaux')));
 legacy.addEventListener('submit',async ev=>{ev.preventDefault();e3.textContent='';try{const out=await api('/api/account?action=legacy-import',{method:'POST',body:formData(legacy)});toast(out.count+' panneau(x) importé(s).');location.hash='#/sites/'+out.siteId;}catch(x){e3.textContent=x.message;}});

 const e4=h('p',{class:'error',role:'alert'});
 const del=h('form',{class:'card form-card',novalidate:true},h('fieldset',{class:'form-section'},h('legend',{text:'Supprimer le compte'}),
  h('p',{class:'small muted',text:'Supprime définitivement votre compte, vos sites, vos panneaux et tous les circuits. Exportez d’abord ce que vous voulez garder.'}),
  field(state.user?.hasPassword===false?'Tapez SUPPRIMER pour confirmer':'Mot de passe pour confirmer',h('input',{name:'password',type:state.user?.hasPassword===false?'text':'password',autocomplete:'off'}))),e4,
  h('div',{class:'form-actions'},h('button',{type:'submit',class:'danger'},'Supprimer mon compte')));
 del.addEventListener('submit',async ev=>{ev.preventDefault();e4.textContent='';if(!await confirmDialog('Supprimer définitivement votre compte et toutes vos données ?',{title:'Dernière confirmation',confirm:'Supprimer mon compte',danger:true}))return;try{await api('/api/account',{method:'DELETE',body:formData(del)});setToken('');state.user=null;toast('Compte supprimé.');location.hash='#/inscription';}catch(x){e4.textContent=x.message;}});

 const ssoSlot=h('div'); ssoCard().then(c=>c&&ssoSlot.replaceChildren(c)); // SSO
 return h('div',{class:'container'},h('div',{class:'page-head'},h('div',{},h('div',{class:'eyebrow',text:'Paramètres'}),h('h1',{text:'Mon compte'}))),
  h('div',{class:'stack'},updateCard(),profile,ssoSlot,brandingCard(),pwd,legacy,del,h('p',{class:'small muted',text:`Disjonio v${APP_VERSION}`}),state.user.profile?.termsVersion&&h('p',{class:'small muted'},`Conditions acceptées : version du ${state.user.profile.termsVersion}, le ${fmtDate(state.user.profile.termsAcceptedAt)}. `,h('a',{href:webUrl('/conditions'),target:'_blank',text:'Conditions'}),' · ',h('a',{href:webUrl('/confidentialite'),target:'_blank',text:'Confidentialité'}))));
}

// ---------- Routeur ----------
function leaveDemo(){demo.active=false;demo.handler=null;state.user=null;state.demo=false;document.querySelector('.demo-bar')?.remove();}
async function route(){
 const token=++renderToken;
 const [,name='',id='',sub='',extra='']=(location.hash||'#/').replace(/^#/,'').split('/');
 // Démonstration sans inscription : faux serveur en mémoire, données fictives (voir demo.js).
 if(name==='demo'&&!state.user){
  const m=await import('./demo.js');demo.handler=m.createDemoApi();demo.active=true;state.user=m.DEMO_USER;state.demo=true;state.features={};
  document.body.prepend(h('div',{class:'demo-bar',role:'status'},'🎬 Démonstration — données fictives, rien n’est enregistré. ',h('a',{href:'#/inscription',onclick:leaveDemo,text:'Créer mon compte gratuit'})));
  location.replace('#/sites');return;
 }
 if(!state.user&&!publicRoutes.includes(name)){
  if(name&&name!=='sites')sessionStorage.setItem('mp_after_login',location.hash);
  location.replace('#/connexion');return;
 }
 if(state.user&&['connexion','inscription'].includes(name)){location.replace('#/sites');return;}
 view.replaceChildren(h('div',{class:'loading',text:'Chargement…'}));
 try{
  let node;
  if(name==='connexion')node=loginView();
  else if(name==='inscription')node=signupView();
  else if(name==='mot-de-passe-oublie')node=forgotView();
  else if(name==='reinitialiser')node=resetView(id);
  else if(name==='sites'&&id)node=await siteView(id);
  else if(name==='panneaux'&&id)node=await panelView({id,tab:sub,ctx});
  else if(name==='comparer')node=await compareView({ctx,a:id,b:sub});
  else if(name==='compte')node=accountView();
  else if(name==='equipe')node=await teamView({ctx});
  else if(name==='rejoindre'&&id)node=await joinInviteView({ctx,token:id});
  else if(name==='remise'&&id)node=await handoffView({token:id});
  else if(name==='abonnement')node=await billingView({ctx,sub:id,a:sub,b:extra});
  else if(name==='admin'&&state.user.isAdmin)node=await adminView({ctx,tab:id||'tableau',id:sub});
  else if(name===''||name==='sites')node=await sitesView();
  else{location.replace('#/sites');return;}
  if(token!==renderToken)return;
  view.replaceChildren(node);
  window.scrollTo(0,0);
 }catch(e){
  if(token!==renderToken)return;
  if(e.status===401)return;
  crumbs([['Mes sites','#/sites'],['Erreur']]);
  view.replaceChildren(h('div',{class:'container'},h('div',{class:'card empty-state'},h('div',{class:'ico',text:e.offline?'📡':'⚠️'}),h('h2',{text:e.status===404?'Introuvable':'Un problème est survenu'}),h('p',{text:e.message}),h('div',{class:'page-actions'},h('button',{type:'button',onclick:route},'Réessayer'),h('a',{class:'btn primary',href:'#/sites'},'Retour à mes sites')))));
 }
}
// Bandeau « hors ligne » : les lectures viennent de la copie locale, les modifications sont désactivées.
{const bar=h('div',{class:'offline-bar',role:'status',hidden:true,text:'📡 Hors ligne — vous consultez les sites téléchargés sur cet appareil. Les modifications, PDF et photos exigent une connexion.'});
 document.body.prepend(bar);
 globalThis.addEventListener('mp-offline',e=>{bar.hidden=!e.detail;document.body.classList.toggle('is-offline',!!e.detail);});
 globalThis.addEventListener('online',()=>{if(net.offline)route();});}
// Hauteur réelle de l'en-tête (barres hors ligne / démo comprises) : sert à positionner la fiche latérale et la zone du panneau.
function syncChrome(){
 const bars=[...document.querySelectorAll('.offline-bar,.demo-bar')].filter(b=>!b.hidden&&b.offsetHeight).reduce((n,b)=>n+b.offsetHeight,0);
 const head=document.querySelector('header.topbar');
 const r=document.documentElement.style;
 r.setProperty('--bars-h',bars+'px');
 if(head)r.setProperty('--chrome-h',Math.round(bars+head.offsetHeight)+'px');
}
if(typeof ResizeObserver==='function'){const ro=new ResizeObserver(syncChrome);ro.observe(document.body);}
globalThis.addEventListener('resize',syncChrome);globalThis.addEventListener('mp-offline',()=>setTimeout(syncChrome,0));
let lastPath='';
let settledHash=location.hash,guarding=false;
window.addEventListener('hashchange',async()=>{
 // Saisie non enregistrée : on revient en arrière et on demande confirmation avant de quitter la page.
 if(guarding){guarding=false;return;}
 if(hasUnsaved()){
  const target=location.hash;guarding=true;location.hash=settledHash;
  if(!await confirmDialog('Quitter cette page sans enregistrer vos modifications ?',{title:'Modifications non enregistrées',confirm:'Quitter sans enregistrer'}))return;
  discardUnsaved();guarding=false;location.hash=target;return;
 }
 settledHash=location.hash;
 // Changer d'onglet d'un panneau ne recharge pas toute la vue.
 const path=location.hash.split('/').slice(0,3).join('/');
 if(path===lastPath&&location.hash.startsWith('#/panneaux/'))return;
 lastPath=path;route();
});

async function boot(){
 try{const me=await api('/api/auth');applyFont(me.site?.font);state.user=me.user;state.features=me.features||{};if(me.user&&!net.offline){bindUser(me.user.id);refreshInbox().then(n=>{if(n)setTimeout(()=>toast(`Vous avez ${n} invitation${n>1?'s':''} en attente dans Mes sites.`,7000),800);});}followAccountLang(me.user?.profile);}
 catch(e){if(!state.user&&e.offline){view.replaceChildren(h('div',{class:'container'},h('div',{class:'card empty-state'},h('div',{class:'ico',text:'📡'}),h('h2',{text:'Hors ligne'}),h('p',{text:e.message}),h('button',{type:'button',class:'primary',onclick:()=>location.reload()},'Réessayer'))));return;}}
 lastPath=location.hash.split('/').slice(0,3).join('/');
 handleSsoReturn(); // SSO
 route();
}
watchIcons();
if('serviceWorker' in navigator&&!NATIVE)navigator.serviceWorker.register('sw.js').catch(()=>{});
checkUpdateQuietly();
boot();
