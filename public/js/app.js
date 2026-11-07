// Application Mon Panneau : routeur, authentification, sites, compte.
import {brandingCard} from './branding.js';
import {aiImportDialog} from './aiimport.js';
import {guidedDialog} from './guided.js';
import {feedbackDialog} from './feedback.js';
import {h,toast,confirmDialog,fmtRelative,field} from './dom.js';
import {api,setToken,handleAuthLost,openDocument,NATIVE,webUrl} from './api.js';
import {siteAddress,panelTitle,APP_VERSION} from '../model.js';
import {siteDialog,panelDialog,siteFields,formData} from './forms.js';
import {panelView} from './panel.js';
import {billingView} from './billing.js';
import {adminView} from './admin.js';

const view=document.getElementById('view'),topbar=document.getElementById('topbar');
const state={user:null,features:{}};
const publicRoutes=['connexion','inscription','mot-de-passe-oublie','reinitialiser'];
let renderToken=0;

// ---------- Barre supérieure ----------
function crumbs(items){
 const nav=h('nav',{class:'crumbs','aria-label':'Fil d’Ariane'});
 items.forEach(([label,href],i)=>{if(i)nav.append(h('i',{'aria-hidden':'true',text:'›'}));nav.append(href&&i<items.length-1?h('a',{href,text:label}):h('span',{text:label,'aria-current':i===items.length-1?'page':null}));});
 const brand=h('a',{class:'brand',href:state.user||NATIVE?'#/sites':'/','aria-label':'Mon Panneau — accueil'},h('span',{class:'brand-icon','aria-hidden':'true',text:'ϟ'}),h('span',{text:'MON PANNEAU'}));
 const parts=[brand,nav];
 if(state.user){
  const menu=h('div',{class:'menu',role:'menu'},
   h('div',{class:'who'},h('b',{text:state.user.name}),state.user.email),
   h('a',{href:'#/sites',role:'menuitem'},'🏠 Mes sites'),
   h('a',{href:'#/compte',role:'menuitem'},'👤 Mon compte'),
   h('a',{href:'#/abonnement',role:'menuitem'},'⭐ Mon abonnement'),
   state.user.isAdmin&&h('a',{href:'#/admin',role:'menuitem'},'🛠 Administration'),
   h('a',{href:webUrl('/fonctionnement'),role:'menuitem',target:NATIVE?'_blank':null},'❓ Fonctionnement'),
   h('button',{type:'button',role:'menuitem',onclick:()=>feedbackDialog()},'💡 Suggérer une amélioration'),
   h('hr'),
   h('button',{type:'button',role:'menuitem',onclick:logout},'↩ Se déconnecter'));
  const btn=h('button',{type:'button',class:'ghost','aria-haspopup':'menu','aria-expanded':'false'},h('span',{class:'avatar',text:(state.user.name||'?').trim().charAt(0).toUpperCase()}),h('span',{class:'uname',text:state.user.name.split(' ')[0]}));
  btn.onclick=e=>{e.stopPropagation();const open=menu.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));};
  parts.push(h('div',{class:'user-menu'},btn,menu));
 }else parts.push(h('a',{class:'btn sm',href:webUrl('/fonctionnement'),target:NATIVE?'_blank':null},'Fonctionnement'));
 topbar.replaceChildren(...parts);
 document.title=(items.at(-1)?.[0]||'Mon espace')+' · Mon Panneau';
}
document.addEventListener('click',()=>document.querySelectorAll('.menu.open').forEach(m=>{m.classList.remove('open');m.previousElementSibling?.setAttribute('aria-expanded','false');}));
const ctx={crumbs,get features(){return state.features;},get user(){return state.user;}};

async function logout(){
 try{await api('/api/auth?action=logout',{method:'POST',body:{}});}catch{}
 setToken('');state.user=null;location.hash='#/connexion';toast('Vous êtes déconnecté.');
}
handleAuthLost(()=>{state.user=null;setToken('');if(!publicRoutes.includes(location.hash.split('/')[1]))location.hash='#/connexion';});

// ---------- Authentification ----------
function authCard(title,sub,form,alt){
 crumbs([[title]]);
 return h('div',{class:'container auth-wrap'},h('div',{class:'card auth-card'},h('div',{class:'eyebrow',text:'Mon Panneau'}),h('h1',{text:title}),sub&&h('p',{class:'muted',text:sub}),form,alt&&h('p',{class:'alt'},alt)));
}
function authForm(fields,submitLabel,onSubmit){
 const e=h('p',{class:'error',role:'alert'});
 const btn=h('button',{type:'submit',class:'primary lg',text:submitLabel});
 const form=h('form',{class:'stack',novalidate:true},fields,e,btn);
 form.addEventListener('submit',async ev=>{ev.preventDefault();e.textContent='';btn.disabled=true;try{await onSubmit(formData(form),form);}catch(x){e.textContent=x.message;}finally{btn.disabled=false;}});
 return form;
}
async function afterAuth(out,welcome){
 setToken(out.token);state.user=out.user;
 const redirect=sessionStorage.getItem('mp_after_login');sessionStorage.removeItem('mp_after_login');
 location.hash=redirect||'#/sites';toast(welcome);
}
function loginView(){
 const form=authForm([
  field('Courriel',h('input',{name:'email',type:'email',autocomplete:'email',required:true,inputmode:'email'})),
  field('Mot de passe',h('input',{name:'password',type:'password',autocomplete:'current-password',required:true})),
  h('a',{href:'#/mot-de-passe-oublie',class:'small',text:'Mot de passe oublié ?'})],'Se connecter',async f=>{
  const out=await api('/api/auth?action=login',{method:'POST',body:f});await afterAuth(out,'Bon retour, '+out.user.name.split(' ')[0]+' !');});
 return authCard('Connexion','Retrouvez vos sites et vos panneaux.',form,['Pas encore de compte ? ',h('a',{href:'#/inscription',text:'Créer un compte gratuit'})]);
}
function signupView(){
 const radio=(v,title,desc,checked)=>h('label',{},h('input',{type:'radio',name:'accountType',value:v,checked}),h('span',{},h('b',{text:title}),h('span',{text:desc})));
 const form=authForm([
  field('Nom complet',h('input',{name:'name',autocomplete:'name',required:true,maxlength:100})),
  field('Courriel',h('input',{name:'email',type:'email',autocomplete:'email',required:true,inputmode:'email'})),
  field('Mot de passe',h('input',{name:'password',type:'password',autocomplete:'new-password',required:true,minlength:10}),{hint:'Au moins 10 caractères.'}),
  h('div',{class:'radio-cards',role:'radiogroup','aria-label':'Type de compte'},radio('particulier','Particulier','Ma maison, mon chalet…',true),radio('pro','Électricien / entrepreneur','Rapports à mon nom, plusieurs clients')),
  h('label',{class:'check'},h('input',{type:'checkbox',name:'acceptTerms',value:'1'}),h('span',{},'J’accepte les ',h('a',{href:webUrl('/conditions'),target:'_blank',text:'conditions d’utilisation et la politique de confidentialité'}),'.'))],'Créer mon compte',async f=>{
  const out=await api('/api/auth?action=signup',{method:'POST',body:{...f,acceptTerms:!!f.acceptTerms}});await afterAuth(out,'Bienvenue, '+out.user.name.split(' ')[0]+' ! Ajoutez votre premier site.');});
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

// ---------- Sites ----------
async function sitesView(){
 crumbs([['Mes sites']]);
 const [{sites},usage]=await Promise.all([api('/api/sites'),api('/api/billing').catch(()=>null)]);
 const chip=usage&&h('a',{class:'usage-chip',href:'#/abonnement'},h('b',{text:usage.plan.name}),usage.limit==null?`${usage.used} panneaux`:`${usage.used} / ${usage.limit} panneaux${usage.plan.quotaType==='monthly'?' ce mois-ci':''}`,usage.credits?` · +${usage.credits} prépayés`:'',usage.canCreatePanel?'':' · Augmenter →');
 const create=()=>siteDialog(null,async f=>{const {site}=await api('/api/sites',{method:'POST',body:f});toast('Site créé. Ajoutez maintenant un panneau.');location.hash='#/sites/'+site.id;});
 const first=state.user.name.split(' ')[0];
 if(!sites.length)return h('div',{class:'container'},h('div',{class:'card empty-state'},
  h('div',{class:'ico',text:'🏠'}),h('h2',{text:`Bienvenue, ${first} !`}),h('p',{text:'Commencez par ajouter un site : l’adresse d’une maison, d’un chalet ou d’un client. Vous y ajouterez ensuite ses panneaux électriques.'}),
  h('div',{class:'onboard'},h('div',{},h('b',{text:'1. Un site'}),h('span',{text:'Une adresse (maison, chalet, client).'})),h('div',{},h('b',{text:'2. Ses panneaux'}),h('span',{text:'Principal, sous-panneau du garage…'})),h('div',{},h('b',{text:'3. Les circuits'}),h('span',{text:'Touchez chaque disjoncteur et décrivez-le.'}))),
  h('button',{type:'button',class:'primary lg',onclick:create},'+ Ajouter mon premier site'),
  h('p',{class:'small muted mt'},'Forfait gratuit : 5 panneaux. ',h('a',{href:'#/abonnement',text:'Voir les forfaits'}),'.'),
  h('p',{class:'small muted mt'},'Vous utilisiez l’ancienne version avec une clé d’accès ? ',h('a',{href:'#/compte',text:'Importez vos panneaux'}),'.')));
 return h('div',{class:'container'},
  h('div',{class:'page-head'},h('div',{},h('div',{class:'eyebrow',text:`Bonjour ${first}`}),h('h1',{text:'Mes sites'}),h('div',{class:'sub',text:`${sites.length} site${sites.length>1?'s':''} · ${sites.reduce((n,s)=>n+s.panelCount,0)} panneau(x)`})),h('div',{class:'page-actions'},chip,h('button',{type:'button',class:'primary',onclick:create},'+ Nouveau site'))),
  h('div',{class:'cards'},...sites.map(s=>h('a',{class:'card site-card',href:'#/sites/'+s.id},
   h('div',{},h('h2',{text:s.name}),h('div',{class:'addr',text:siteAddress(s)||'Adresse à préciser'}),s.client&&h('div',{class:'addr',text:'Client : '+s.client})),
   h('div',{class:'chips'},s.panels.length?s.panels.map(p=>h('span',{class:'badge '+(p.progress===100?'ok':''),text:`${p.tag||p.name} · ${p.progress} %`})):h('span',{class:'badge warn',text:'Aucun panneau'})),
   h('div',{class:'small muted',text:'Modifié '+fmtRelative(s.updatedAt)}))),
   h('button',{type:'button',class:'add-card',onclick:create},'+ Ajouter un site')));
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
 const addPanel=()=>panelDialog({siblings:panels,library,onSave:async f=>{const {panel}=await api('/api/panels',{method:'POST',body:{siteId:site.id,...f}});toast('Panneau créé. Touchez un disjoncteur pour commencer.');location.hash='#/panneaux/'+panel.id;}});
 const edit=()=>siteDialog(site,async f=>{await api('/api/sites?id='+site.id,{method:'PUT',body:f});toast('Site modifié.');route();});
 const remove=async()=>{if(!await confirmDialog(`Supprimer « ${site.name} », ses ${panels.length} panneau(x) et tous leurs circuits ? Cette action est irréversible.`,{title:'Supprimer le site',confirm:'Supprimer définitivement',danger:true}))return;await api('/api/sites?id='+site.id,{method:'DELETE'});toast('Site supprimé.');location.hash='#/sites';};
 const report=async()=>{try{toast('Génération du rapport du site…');await openDocument({site:site.id,kind:'report'});}catch(e){toast(e.message);}};
 const panelCards=panels.map(p=>h('a',{class:'card panel-card',href:'#/panneaux/'+p.id},
  h('div',{class:'row'},h('span',{class:'badge tag',text:p.tag||'—'}),h('span',{text:p.kind})),
  h('div',{},h('h2',{text:p.name}),h('div',{class:'loc',text:'📍 '+(p.location||'Emplacement à préciser')+(p.details?.building?' · '+p.details.building:'')})),
  h('div',{class:'progress','aria-label':`Avancement ${p.stats.progress} %`},h('i',{style:{width:p.stats.progress+'%'}})),
  h('div',{class:'row'},h('span',{text:`${p.stats.identified} identifiés · ${p.stats.toConfirm} à confirmer`}),h('span',{text:`${p.positions} pos.${p.details?.mainAmps?' · '+p.details.mainAmps+' A':''}`}))));
 return h('div',{class:'container'},
  h('div',{class:'page-head'},
   h('div',{},h('div',{class:'eyebrow',text:'Site'}),h('h1',{text:site.name}),h('div',{class:'sub',text:siteAddress(site)||'Adresse à préciser'}),site.client&&h('div',{class:'sub',text:'Client : '+site.client})),
   h('div',{class:'page-actions'},h('button',{type:'button',onclick:edit},'Modifier'),panels.length?h('button',{type:'button',onclick:report},'📄 Rapport PDF du site'):null,h('button',{type:'button',onclick:addGuided},'🧭 Mode guidé'),h('button',{type:'button',onclick:addByPhoto},'📷 Ajouter par photo (IA)'),h('button',{type:'button',class:'primary',onclick:addPanel},'+ Ajouter un panneau'))),
  h('div',{class:'split'},
   h('section',{'aria-label':'Panneaux'},
    panels.length?h('div',{class:'cards'},...panelCards,h('button',{type:'button',class:'add-card',onclick:addPanel},'+ Ajouter un panneau'))
     :h('div',{class:'card empty-state'},h('div',{class:'ico',text:'▦'}),h('h2',{text:'Aucun panneau pour l’instant'}),h('p',{text:'Ajoutez le panneau principal. Vous pourrez ensuite ajouter les sous-panneaux (garage, atelier, logement…) et indiquer lequel alimente l’autre.'}),h('div',{class:'page-actions center'},h('button',{type:'button',class:'primary lg',onclick:addPanel},'+ Ajouter le panneau principal'),h('button',{type:'button',class:'lg',onclick:addGuided},'🧭 Mode guidé (questions)'),h('button',{type:'button',class:'lg',onclick:addByPhoto},'📷 Par photo (IA)')))),
   h('aside',{class:'stack'},
    panels.length>0&&h('div',{class:'card side-card'},h('h3',{text:'Hiérarchie d’alimentation'}),tree(panels)),
    h('div',{class:'card side-card'},h('h3',{text:'Informations'}),h('dl',{class:'facts'},h('dt',{text:'Adresse'}),h('dd',{text:siteAddress(site)||'—'}),h('dt',{text:'Client'}),h('dd',{text:site.client||'—'}),h('dt',{text:'Panneaux'}),h('dd',{text:String(panels.length)}),h('dt',{text:'Modifié'}),h('dd',{text:fmtRelative(site.updatedAt)})),site.notes&&h('p',{class:'small muted mt',text:site.notes})),
    h('button',{type:'button',class:'danger',onclick:remove},'Supprimer ce site'))));
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
  h('fieldset',{class:'form-section'},h('legend',{text:'Informations professionnelles (rapports PDF)'}),proBox),e1,
  h('div',{class:'form-actions'},h('button',{type:'submit',class:'primary'},'Enregistrer le profil')));
 const syncPro=()=>{proBox.closest('fieldset').hidden=profile.elements.accountType.value!=='pro';};
 profile.addEventListener('change',syncPro);syncPro();
 profile.addEventListener('submit',async ev=>{ev.preventDefault();e1.textContent='';const f=formData(profile);try{const out=await api('/api/account',{method:'PUT',body:{name:f.name,profile:f}});state.user=out.user;toast('Profil enregistré.');crumbs([['Mes sites','#/sites'],['Mon compte']]);}catch(x){e1.textContent=x.message;}});

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
  field('Mot de passe pour confirmer',h('input',{name:'password',type:'password',autocomplete:'current-password'}))),e4,
  h('div',{class:'form-actions'},h('button',{type:'submit',class:'danger'},'Supprimer mon compte')));
 del.addEventListener('submit',async ev=>{ev.preventDefault();e4.textContent='';if(!await confirmDialog('Supprimer définitivement votre compte et toutes vos données ?',{title:'Dernière confirmation',confirm:'Supprimer mon compte',danger:true}))return;try{await api('/api/account',{method:'DELETE',body:formData(del)});setToken('');state.user=null;toast('Compte supprimé.');location.hash='#/inscription';}catch(x){e4.textContent=x.message;}});

 return h('div',{class:'container'},h('div',{class:'page-head'},h('div',{},h('div',{class:'eyebrow',text:'Paramètres'}),h('h1',{text:'Mon compte'}))),
  h('div',{class:'stack'},profile,brandingCard(),pwd,legacy,del,h('p',{class:'small muted',text:`Mon Panneau v${APP_VERSION}`})));
}

// ---------- Routeur ----------
async function route(){
 const token=++renderToken;
 const [,name='',id='',sub='',extra='']=(location.hash||'#/').replace(/^#/,'').split('/');
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
  else if(name==='compte')node=accountView();
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
let lastPath='';
window.addEventListener('hashchange',()=>{
 // Changer d'onglet d'un panneau ne recharge pas toute la vue.
 const path=location.hash.split('/').slice(0,3).join('/');
 if(path===lastPath&&location.hash.startsWith('#/panneaux/'))return;
 lastPath=path;route();
});

async function boot(){
 try{const me=await api('/api/auth');state.user=me.user;state.features=me.features||{};}
 catch(e){if(!state.user&&e.offline){view.replaceChildren(h('div',{class:'container'},h('div',{class:'card empty-state'},h('div',{class:'ico',text:'📡'}),h('h2',{text:'Hors ligne'}),h('p',{text:e.message}),h('button',{type:'button',class:'primary',onclick:()=>location.reload()},'Réessayer'))));return;}}
 lastPath=location.hash.split('/').slice(0,3).join('/');
 route();
}
if('serviceWorker' in navigator&&!NATIVE)navigator.serviceWorker.register('sw.js').catch(()=>{});
boot();
