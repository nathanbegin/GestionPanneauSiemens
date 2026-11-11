// Petits utilitaires DOM sans dépendance.
export function h(tag,props,...kids){
 const el=document.createElement(tag);
 if(props&&(typeof props!=='object'||props instanceof Node||Array.isArray(props))){kids.unshift(props);props=null;}
 for(const [k,v] of Object.entries(props||{})){
  if(v==null||v===false)continue;
  if(k==='class')el.className=v;
  else if(k==='text')el.textContent=v;
  else if(k.startsWith('on')&&typeof v==='function')el.addEventListener(k.slice(2),v);
  else if(k==='dataset')Object.assign(el.dataset,v);
  else if(k==='style'&&typeof v==='object')Object.assign(el.style,v);
  else if(['value','checked','selected','disabled','hidden','required','multiple','readOnly'].includes(k))el[k]=v;
  else el.setAttribute(k,v===true?'':v);
 }
 // Clavier numérique pour les valeurs numériques (sans surcharger un choix explicite).
 if(tag==='input'&&el.type==='number'&&!el.hasAttribute('inputmode'))el.setAttribute('inputmode','decimal');
 append(el,kids);
 return el;
}
function append(el,kids){for(const k of kids.flat(Infinity)){if(k==null||k===false)continue;el.append(k instanceof Node?k:document.createTextNode(String(k)));}}
export const $=(sel,root=document)=>root.querySelector(sel);
export const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];

let toastTimer;
export function toast(message,ms=4500){
 const t=document.getElementById('toast');t.textContent=message;t.classList.add('show');
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),ms);
}

// Boîte de dialogue modale. actions : [{label, kind:'primary'|'danger'|'ghost', left, onClick(close) -> false pour garder ouvert}]
// Saisies non enregistrées : chaque fenêtre à formulaire (ou fournissant dirty()) s'inscrit ici, pour protéger
// la croix, Échap, la fermeture de l'onglet et la navigation (retour, changement de page).
const unsaved=new Set();
export const hasUnsaved=()=>[...unsaved].some(f=>f());
export function discardUnsaved(){document.querySelectorAll('dialog[open]').forEach(d=>d.close());unsaved.clear();}
let leaveHooked=false;
export function dialog({title,eyebrow,body=[],actions=[],onClose,form=false,wide=false,beforeClose,dirty,side=false}){
 const foot=h('div',{class:'dlg-foot'});
 const right=h('div',{class:'right'});
 const close=()=>{if(el.open)el.close();};
 // Sorties « douces » (croix, Échap) : beforeClose peut les refuser (ex. saisie non enregistrée).
 let touched=false;
 const isDirty=()=>dirty?!!dirty():touched;
 const guard=beforeClose||(async()=>{if(isDirty()&&!await confirmDialog('Fermer sans enregistrer les modifications ?',{confirm:'Fermer sans enregistrer'}))return false;});
 const tryClose=async()=>{if(await guard()===false)return;close();};
 for(const a of actions){
  const b=h('button',{type:a.submit?'submit':'button',class:a.kind||'',text:a.label});
  // Tout bouton sans « submit » ferme la boîte, après son action éventuelle (sauf si elle renvoie false).
  if(!a.submit)b.addEventListener('click',async e=>{e.preventDefault();const r=a.onClick?await a.onClick(close,b):undefined;if(r!==false&&!a.keep)close();});
  (a.left?foot:right).append(b);
 }
 foot.append(right);
 const content=[h('div',{class:'dlg-head'},h('div',{},eyebrow&&h('div',{class:'eyebrow',text:eyebrow}),h('h2',{text:title})),h('button',{type:'button','aria-label':'Fermer',text:'✕',onclick:tryClose})),h('div',{class:'dlg-body'},body),foot];
 const inner=form?h('form',{novalidate:true},content):content;
 const el=h('dialog',{},inner);
 // wide : true (860 px) ou 'xl' (presque toute la largeur de l'écran, pour voir un panneau en grand).
 if(wide==='xl')el.classList.add('xl');else if(wide)el.style.width='min(860px, calc(100vw - 24px))';
 el.addEventListener('cancel',ev=>{ev.preventDefault();tryClose();});
 if(form||dirty){unsaved.add(isDirty);if(form){inner.addEventListener('input',()=>{touched=true;});inner.addEventListener('change',()=>{touched=true;});}}
 if(!leaveHooked){leaveHooked=true;window.addEventListener('beforeunload',ev=>{if(hasUnsaved()){ev.preventDefault();ev.returnValue='';}});}
 el.addEventListener('close',()=>{unsaved.delete(isDirty);if(side)document.body.classList.remove('has-side');el.remove();onClose?.();});
 document.body.append(el);
 if(side){
  el.classList.add('side');document.body.classList.add('has-side');
  // Séparation redimensionnable entre le panneau et la fiche (largeur gardée sur l'appareil).
  try{const w=Number(localStorage.getItem('mp_side_w'));if(w>=320)document.documentElement.style.setProperty('--side-w',w+'px');}catch{}
  const grip=h('div',{class:'side-grip',role:'separator','aria-orientation':'vertical','aria-label':'Redimensionner la fiche',title:'Glisser pour redimensionner'});
  grip.addEventListener('pointerdown',ev=>{
   ev.preventDefault();grip.setPointerCapture(ev.pointerId);
   const move=e=>{const w=Math.round(Math.min(Math.max(320,innerWidth-e.clientX),innerWidth*0.65));document.documentElement.style.setProperty('--side-w',w+'px');try{localStorage.setItem('mp_side_w',String(w));}catch{}};
   const up=()=>{grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',up);};
   grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',up);
  });
  el.prepend(grip);el.show();
 }else el.showModal();
 return {el,close,form:form?inner:null};
}
export function confirmDialog(message,{title='Confirmer',confirm='Confirmer',danger=false}={}){
 return new Promise(resolve=>{
  let ok=false;
  dialog({title,body:[h('p',{text:message})],actions:[{label:'Annuler',kind:'ghost'},{label:confirm,kind:danger?'danger':'primary',onClick:()=>{ok=true;}}],onClose:()=>resolve(ok)});
 });
}
// Champ de formulaire étiqueté.
export function field(label,input,{hint,full}={}){
 return h('label',{class:'f'+(full?' full':'')},h('span',{},label),input,hint&&h('span',{class:'hint',text:hint}));
}
export function select(name,options,value){
 const s=h('select',{name});
 for(const o of options){const [v,t]=Array.isArray(o)?o:[o,o];s.append(new Option(t,v));}
 if(value!==undefined&&value!==null)s.value=String(value);
 return s;
}
export const fmtDate=v=>v?new Intl.DateTimeFormat((globalThis.MP_LOCALE||'fr-CA'),{dateStyle:'medium'}).format(new Date(v)):'';
export const fmtRelative=v=>{
 if(!v)return '';const s=(Date.now()-new Date(v))/1000;
 if(s<60)return 'à l’instant';if(s<3600)return `il y a ${Math.floor(s/60)} min`;if(s<86400)return `il y a ${Math.floor(s/3600)} h`;
 return fmtDate(v);
};
export const money=cents=>cents==null?'—':new Intl.NumberFormat((globalThis.MP_LOCALE||'fr-CA'),{style:'currency',currency:'CAD',minimumFractionDigits:cents%100?2:0}).format(cents/100);
export const quotaLabel=p=>p.panelLimit==null?'Panneaux illimités':p.quotaType==='active'?`${p.panelLimit} panneaux`:p.quotaType==='monthly'?`${p.panelLimit} nouveaux panneaux / mois`:`${p.panelLimit} nouveaux panneaux / an`;
export const planFeatures=p=>[quotaLabel(p),p.siteLimit==null?'Sites illimités':`${p.siteLimit} site${p.siteLimit>1?'s':''}`,p.seats>1?`${p.seats} utilisateurs (bientôt)`:null,'Rapports PDF et étiquettes',p.features?.planning?'Planification : catalogue, charges, 80 %, calcul 8-200, matériel':null,p.features?.branding?'Rapports à votre image (entreprise, RBQ)':null,p.features?.qr?'Codes QR pour les panneaux (bientôt)':null].filter(Boolean);
