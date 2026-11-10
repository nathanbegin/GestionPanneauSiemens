// Personnalisation des PDF à l'image de l'entreprise : logo, couleurs et pied de page.
import {h,field,toast} from './dom.js';
import {api} from './api.js';

const DEFAULTS={primary:'#183c32',accent:'#e4f7a8'};

// Redimensionne l'image choisie (600 × 200 px max) et la convertit en PNG, ou en JPEG si le PNG est trop lourd.
export function resizeLogo(file){
 return new Promise((resolve,reject)=>{
  if(!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type))return reject(Error('Choisissez une image PNG, JPEG, WebP ou SVG.'));
  if(file.size>8*1024*1024)return reject(Error('Image trop lourde (8 Mo maximum).'));
  const img=new Image(),reader=new FileReader();
  img.onload=()=>{
   const r=Math.min(1,600/img.naturalWidth,200/img.naturalHeight);
   const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*r));c.height=Math.max(1,Math.round(img.naturalHeight*r));
   c.getContext('2d').drawImage(img,0,0,c.width,c.height);
   let data=c.toDataURL('image/png');
   if(data.length>520000){const j=document.createElement('canvas');j.width=c.width;j.height=c.height;const g=j.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,j.width,j.height);g.drawImage(c,0,0);data=j.toDataURL('image/jpeg',.88);}
   resolve(data);
  };
  img.onerror=()=>reject(Error('Image illisible.'));
  // Data URL plutôt que blob: (politique de sécurité du site).
  reader.onload=()=>{img.src=reader.result;};reader.onerror=()=>reject(Error('Lecture de l’image impossible.'));reader.readAsDataURL(file);
 });
}

export function brandingCard(){
 const card=h('div',{class:'card form-card'},h('p',{class:'muted',text:'Chargement de la personnalisation…'}));
 api('/api/account?action=branding').then(({branding,allowed,footers,legal})=>render(branding||{},allowed,footers||[],legal)).catch(e=>card.replaceChildren(h('p',{class:'error',text:e.message})));
 function render(b,allowed,models=[],legal=''){
  if(!allowed){
   card.replaceChildren(h('fieldset',{class:'form-section'},h('legend',{text:'Documents à l’image de votre entreprise'}),
    h('p',{class:'muted',text:'Ajoutez votre logo, vos couleurs et un pied de page à tous les PDF (rapports, aide-mémoire, bilans, notes de calcul, étiquettes).'}),
    h('a',{class:'btn primary',href:'#/abonnement'},'Inclus dans les forfaits Électricien')));
   return;
  }
  let logo=b.logo||'';
  const primary=h('input',{type:'color',name:'primary',value:b.primary||DEFAULTS.primary});
  const tableHead=h('input',{type:'color',name:'tableHead',value:b.tableHead||b.primary||DEFAULTS.primary});
  const accent=h('input',{type:'color',name:'accent',value:b.accent||DEFAULTS.accent});
  const footer=h('input',{name:'footer',maxlength:140,value:b.footer||'',placeholder:'Ex. Merci de votre confiance — Électricité Exemple inc.'});
  const model=h('select',{name:'footerId'},new Option('Texte personnalisé (ci-dessous)',''),...models.map(m=>new Option(m.label,m.id)));model.value=b.footerId||'';
  const sync=()=>{footer.disabled=!!model.value;footer.placeholder=model.value?models.find(m=>m.id===model.value)?.text||'':'Ex. Merci de votre confiance — Électricité Exemple inc.';};
  model.addEventListener('change',sync);queueMicrotask(sync);
  const file=h('input',{type:'file',accept:'image/png,image/jpeg,image/webp,image/svg+xml',class:'sr-only',id:'brandLogo'});
  const err=h('p',{class:'error',role:'alert'});
  // Aperçu de l'en-tête des PDF.
  const pvLogo=h('img',{alt:'Logo de l’entreprise'}),pvLogoBox=h('div',{class:'bp-logo'},pvLogo),pvBar=h('i',{class:'bp-bar'});
  const pvOver=h('div',{class:'bp-over',text:'RAPPORT DE PANNEAU ÉLECTRIQUE'}),pvTitle=h('div',{class:'bp-title',text:'P-1 · Panneau principal'}),pvSub=h('div',{class:'bp-sub',text:'Sous-sol · 123, rue Exemple'});
  const preview=h('div',{class:'brand-preview','aria-label':'Aperçu de l’en-tête des PDF'},pvLogoBox,pvBar,h('div',{},pvOver,pvTitle,pvSub));
  const lum=hex=>{const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.03928?c/12.92:((c+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
  const refresh=()=>{
   preview.style.background=primary.value;const light=lum(primary.value)>.45;
   pvTitle.style.color=light?'#141414':'#fff';pvSub.style.color=light?'#404040':'rgba(255,255,255,.8)';
   pvOver.style.color=accent.value;pvBar.style.background=accent.value;
   pvLogoBox.hidden=!logo;if(logo)pvLogo.src=logo;
   removeBtn.hidden=!logo;
  };
  const removeBtn=h('button',{type:'button',class:'ghost',onclick:()=>{logo='';refresh();}},'Retirer le logo');
  file.addEventListener('change',async()=>{err.textContent='';const f=file.files[0];file.value='';if(!f)return;try{logo=await resizeLogo(f);refresh();}catch(e){err.textContent=e.message;}});
  for(const el of [primary,accent,tableHead])el.addEventListener('input',refresh);
  const form=h('form',{class:'',novalidate:true},
   h('fieldset',{class:'form-section'},h('legend',{text:'Documents à l’image de votre entreprise'}),
    h('p',{class:'small muted',text:'Votre logo et vos couleurs remplacent l’en-tête Mon Panneau sur tous les PDF. Le logo du fabricant du panneau reste affiché à droite.'}),
    preview,
    h('div',{class:'fields'},
     h('div',{class:'f'},h('span',{},'Logo'),h('div',{class:'page-actions'},h('label',{class:'btn',for:'brandLogo'},'Choisir une image…'),file,removeBtn),h('span',{class:'hint',text:'PNG avec fond transparent idéalement. Redimensionné automatiquement.'})),
     field('Couleur principale (en-tête)',primary),
     field('Couleur des en-têtes de tableau',tableHead,{hint:'Fond des titres de colonnes (texte noir ou blanc automatique).'}),
     field('Couleur d’accent',accent,{hint:'Barre et sur-titres de l’en-tête.'}),
     models.length?field('Modèle de pied de page',model,{full:true,hint:legal?'Suivi de la mention : '+legal:''}):null,
     field('Pied de page',footer,{full:true}))),
   err,
   h('div',{class:'form-actions'},
    h('button',{type:'button',class:'ghost',onclick:()=>{primary.value=DEFAULTS.primary;tableHead.value=DEFAULTS.primary;accent.value=DEFAULTS.accent;refresh();}},'Couleurs par défaut'),
    h('button',{type:'submit',class:'primary'},'Enregistrer la personnalisation')));
  form.addEventListener('submit',async ev=>{
   ev.preventDefault();err.textContent='';
   try{
    const custom=primary.value!==DEFAULTS.primary||accent.value!==DEFAULTS.accent;const th=tableHead.value!==(primary.value)&&!(tableHead.value===DEFAULTS.primary&&!custom);
    await api('/api/account?action=branding',{method:'PUT',body:{primary:custom?primary.value:'',accent:custom?accent.value:'',tableHead:th?tableHead.value:'',footer:footer.value,footerId:model.value,logo}});
    toast('Personnalisation enregistrée : elle s’applique aux prochains PDF.');
   }catch(e){err.textContent=e.message;}
  });
  card.replaceChildren(form);refresh();
 }
 return card;
}
