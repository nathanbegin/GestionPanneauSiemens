// Connexion avec Google / Microsoft (interface). Module autonome : retirer ce fichier et les lignes « SSO » de app.js (voir README).
import {h,toast} from './dom.js';
import {api,NATIVE} from './api.js';

// Logos officiels (inline : la politique de sécurité n'autorise que 'self' et data:).
const NS='http://www.w3.org/2000/svg';
const LOGOS={
 google:[['#4285F4','M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z'],['#34A853','M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z'],['#FBBC05','M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z'],['#EA4335','M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z']],
 microsoft:[['#F25022','M1 1h10v10H1z'],['#7FBA00','M13 1h10v10H13z'],['#00A4EF','M1 13h10v10H1z'],['#FFB900','M13 13h10v10H13z']],
};
function logo(id){
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','20');svg.setAttribute('height','20');svg.setAttribute('aria-hidden','true');svg.classList.add('sso-logo');
 for(const [fill,d] of LOGOS[id]||[]){const p=document.createElementNS(NS,'path');p.setAttribute('fill',fill);p.setAttribute('d',d);svg.append(p);}
 return svg;
}

let providers;
async function list(){
 if(NATIVE)return []; // l'application native n'offre pas encore ces connexions
 if(!providers)providers=api('/api/auth?action=sso-providers').then(r=>r.providers||[]).catch(()=>[]);
 return providers;
}
const href=(id,mode)=>`/api/auth?action=sso-start&provider=${id}&mode=${mode}&lang=${globalThis.MP_LANG==='en'?'en':'fr'}`;

// Boutons « Continuer avec… » (connexion / inscription). Retourne null si aucun fournisseur n'est actif.
export async function ssoButtons(){
 const ps=await list();if(!ps.length)return null;
 return h('div',{class:'sso'},
  h('div',{class:'sso-btns'},...ps.map(p=>h('a',{class:'btn sso-btn',href:href(p.id,'login'),'data-provider':p.id},logo(p.id),h('span',{text:'Continuer avec '+p.label})))),
  h('p',{class:'small muted'},'En continuant, vous acceptez les ',h('a',{href:'/conditions',target:'_blank',text:'conditions d’utilisation'}),' et la ',h('a',{href:'/confidentialite',target:'_blank',text:'politique de confidentialité'}),'.'),
  h('div',{class:'sso-or',text:'ou par courriel'}));
}

// Carte « Mon compte » : connexions liées, ajout et retrait.
export async function ssoCard(){
 const ps=await list();if(!ps.length)return null;
 const card=h('div',{class:'card form-card'});
 async function draw(){
  let info;try{info=await api('/api/auth?action=sso-identities');}catch{return card.replaceChildren();}
  const linked=new Map(info.identities.map(i=>[i.provider,i]));
  const rows=ps.map(p=>{
   const i=linked.get(p.id);
   return h('div',{class:'sso-row'},logo(p.id),h('b',{text:p.label}),
    i?h('span',{class:'muted small',text:i.email||'Connecté'}):h('span',{class:'muted small',text:'Non connecté'}),
    i?h('button',{type:'button',class:'ghost',onclick:async()=>{try{await api('/api/auth?action=sso-unlink&provider='+p.id,{method:'POST',body:{}});toast('Connexion retirée.');draw();}catch(e){toast(e.message);}}},'Retirer')
     :h('a',{class:'btn',href:href(p.id,'link')},'Connecter'));
  });
  card.replaceChildren(h('fieldset',{class:'form-section'},h('legend',{text:'Connexions externes'}),
   h('p',{class:'small muted',text:'Connectez-vous avec Google ou Microsoft sans mot de passe. Votre compte et vos données restent les mêmes.'}),...rows));
 }
 await draw();return card;
}

// Message au retour du fournisseur (?sso=… ou ?sso_error=…), puis nettoyage de l'adresse.
const ERRORS={unavailable:'Cette connexion n’est pas activée.',denied:'Connexion annulée.',state:'La connexion a expiré. Réessayez.',session:'Session expirée. Connectez-vous d’abord.',
 taken:'Ce compte externe est déjà lié à un autre compte Disjonio.',no_email:'Le fournisseur n’a pas communiqué de courriel.',
 unverified_exists:'Un compte existe déjà avec ce courriel. Connectez-vous avec votre mot de passe, puis ajoutez la connexion dans « Mon compte ».',
 unverified:'Le fournisseur n’a pas confirmé votre courriel.',rate:'Trop de tentatives. Patientez quelques minutes.',failed:'La connexion externe a échoué. Réessayez.'};
export function handleSsoReturn(){
 const q=new URLSearchParams(location.search),ok=q.get('sso'),err=q.get('sso_error');
 if(!ok&&!err)return;
 q.delete('sso');q.delete('sso_error');
 history.replaceState(null,'',location.pathname+(q.toString()?'?'+q:'')+location.hash);
 if(err)setTimeout(()=>toast(ERRORS[err]||ERRORS.failed,7000),300);
 else if(ok==='linked')setTimeout(()=>toast('Connexion ajoutée à votre compte.'),300);
 else setTimeout(()=>toast(ok==='new'?'Bienvenue ! Ajoutez votre premier site.':'Bon retour !'),300);
}
