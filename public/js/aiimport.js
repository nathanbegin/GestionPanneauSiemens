// Ajout d'un panneau par photo ou fichier récapitulatif, avec lecture par IA (forfaits payants).
// Étapes : 1) photos / fichiers  2) lecture  3) identification à confirmer
//          4) construction pas à pas du panneau  5) « Est-ce bien la configuration en place ? »  6) création.
import {h,field,select,dialog,toast} from './dom.js';
import {api} from './api.js';
import {panelArt} from './panelart.js';
import {blank,resize,designation,sortCircuits,ampsList,panelKinds,voltages,slotPos} from '../model.js';
import {FAMILIES} from '../catalog.js';
import {AI_CONFIDENT} from '../aiscan.js';

const MAX_SIDE=2000,MAX_FILES=6,MAX_TOTAL=3*1024*1024;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const readAsDataUrl=file=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(Error('Lecture du fichier impossible.'));r.readAsDataURL(file);});
// Photo réduite à 2000 px (côté le plus long) en JPEG : lisible pour l'IA et légère à envoyer.
function shrinkImage(file){
 if(file.size>25*1024*1024)return Promise.reject(Error(`« ${file.name} » est trop lourd (25 Mo maximum).`));
 return new Promise((resolve,reject)=>{
  // Data URL plutôt que blob: (la politique de sécurité du site n'autorise que 'self' et data: pour les images).
  const img=new Image();
  img.onload=()=>{
   const r=Math.min(1,MAX_SIDE/Math.max(img.naturalWidth,img.naturalHeight));
   const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*r);c.height=Math.round(img.naturalHeight*r);
   const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);
   resolve(c.toDataURL('image/jpeg',.85));
  };
  img.onerror=()=>reject(Error(`« ${file.name} » : format d’image non lu par ce navigateur (essayez JPEG ou PNG).`));
  readAsDataUrl(file).then(u=>{img.src=u;},reject);
 });
}
async function prepare(file){
 if(file.type.startsWith('image/'))return {name:file.name,data:await shrinkImage(file),thumb:true};
 const type=file.type||(/\.csv$/i.test(file.name)?'text/csv':/\.(txt|md)$/i.test(file.name)?'text/plain':/\.json$/i.test(file.name)?'application/json':'');
 if(!/^(application\/pdf|text\/(plain|csv|tab-separated-values)|application\/json)$/.test(type))throw Error(`« ${file.name} » : type non pris en charge (photo, PDF, CSV ou texte).`);
 if(file.size>MAX_TOTAL)throw Error(`« ${file.name} » est trop lourd (3 Mo maximum).`);
 const data=(await readAsDataUrl(file)).replace(/^data:[^;]*;/,`data:${type};`);
 return {name:file.name,data,thumb:false};
}
const pct=v=>v==null?'—':Math.round(v*100)+' %';
const confClass=v=>v==null?'':v>=AI_CONFIDENT?'ok':v>=.5?'mid':'low';

export async function aiImportDialog({site,siblings=[],onCreated}){
 const stage=h('div',{class:'ai-stage'});
 const d=dialog({title:'Ajouter un panneau par photo',eyebrow:'Assistant IA · '+site.name,wide:true,body:[stage]});
 stage.append(h('p',{class:'muted',text:'Vérification de votre forfait…'}));
 let status;
 try{status=await api('/api/panels?action=scan');}catch(e){stage.replaceChildren(h('p',{class:'error',text:e.message}));return;}
 if(!status.configured){stage.replaceChildren(h('div',{class:'notice'},'L’analyse par IA n’est pas encore activée sur ce serveur. L’administrateur doit définir la variable OPENAI_API_KEY.'));return;}
 if(!status.allowed){stage.replaceChildren(h('div',{class:'ai-upsell'},h('h3',{text:'Inclus dans les forfaits payants'}),h('p',{text:'Photographiez le panneau ouvert ou téléversez un récapitulatif : l’IA lit la marque, le principal, le nombre de positions et chaque disjoncteur, puis construit le panneau avec vous.'}),h('a',{class:'btn primary',href:'#/abonnement',onclick:()=>d.close()},'Voir les forfaits')));return;}
 const files=[];
 photos();

 // ---------- 1. Photos et fichiers ----------
 function photos(err=''){
  const list=h('div',{class:'ai-files'});
  const errBox=h('p',{class:'error',role:'alert',text:err});
  const refresh=()=>{list.replaceChildren(...files.map((f,i)=>h('div',{class:'ai-file'},f.thumb?h('img',{src:f.data,alt:f.name}):h('span',{class:'ai-doc',text:'📄'}),h('span',{class:'small',text:f.name}),h('button',{type:'button',class:'ghost sm','aria-label':'Retirer '+f.name,onclick:()=>{files.splice(i,1);refresh();}},'✕'))));analyze.disabled=!files.length;};
  const add=async input=>{
   errBox.textContent='';
   for(const file of [...input.files]){
    if(files.length>=MAX_FILES){errBox.textContent=`${MAX_FILES} fichiers au maximum.`;break;}
    try{const p=await prepare(file);if(files.reduce((s,f)=>s+f.data.length*.75,0)+p.data.length*.75>MAX_TOTAL)throw Error('Total trop lourd : retirez un fichier.');files.push(p);}catch(e){errBox.textContent=e.message;}
   }
   input.value='';refresh();
  };
  const camera=h('input',{type:'file',accept:'image/*',capture:'environment',class:'sr-only',id:'aiCamera',onchange:e=>add(e.target)});
  const picker=h('input',{type:'file',multiple:true,accept:'image/*,application/pdf,.csv,.txt,.json',class:'sr-only',id:'aiFiles',onchange:e=>add(e.target)});
  const brand=h('input',{name:'brand',maxlength:60,placeholder:'Facultatif',list:'aiBrands'});
  const positions=h('input',{name:'positions',type:'number',min:2,max:84,step:2,placeholder:'Facultatif',inputmode:'numeric'});
  const note=h('input',{name:'note',maxlength:300,placeholder:'Ex. sous-panneau du garage, répertoire sur la 2e photo'});
  const analyze=h('button',{type:'button',class:'primary lg',disabled:true,onclick:()=>read({brand:brand.value.trim(),positions:Number(positions.value)||undefined,note:note.value.trim()})},'Analyser avec l’IA');
  stage.replaceChildren(
   h('div',{class:'ai-intro'},
    h('ol',{class:'ai-tips'},
     h('li',{text:'Ouvrez la porte du panneau et photographiez-le de face, en entier, bien éclairé.'}),
     h('li',{text:'Ajoutez une photo rapprochée de l’étiquette du fabricant (marque, numéro de catalogue, ampérage).'}),
     h('li',{text:'Ajoutez le répertoire de la porte s’il est lisible, ou un fichier récapitulatif (PDF, CSV, texte).'})),
    h('p',{class:'small muted',text:`Analyses ce mois-ci : ${status.used}${status.monthly!=null?' / '+status.monthly:''}. Ne retirez jamais le couvercle intérieur : la photo de la face avant suffit.`})),
   h('div',{class:'page-actions'},h('label',{class:'btn primary',for:'aiCamera'},'📷 Prendre une photo'),camera,h('label',{class:'btn',for:'aiFiles'},'📁 Choisir des fichiers'),picker),
   list,
   h('details',{class:'ai-hints'},h('summary',{text:'Indications pour l’IA (facultatif)'}),h('div',{class:'fields'},field('Marque',brand),field('Nombre de positions',positions),field('Note',note,{full:true})),
    h('datalist',{id:'aiBrands'},['Siemens','Square D','Eaton','Cutler-Hammer','Schneider Electric','Federal Pioneer','Stab-Lok','Westinghouse','Commander','GE','Leviton','Generac'].map(b=>h('option',{value:b})))),
   errBox,
   h('div',{class:'form-actions'},h('button',{type:'button',class:'ghost',onclick:()=>d.close()},'Annuler'),analyze));
  refresh();
 }

 // ---------- 2. Lecture par l'IA ----------
 async function read(hint){
  const msg=h('p',{class:'ai-wait-msg',text:'Lecture des photos…'});
  stage.replaceChildren(h('div',{class:'ai-wait'},h('div',{class:'spinner','aria-hidden':'true'}),msg,h('p',{class:'small muted',text:'Cela prend généralement de 10 à 40 secondes.'})));
  const steps=['Recherche de la marque et de l’étiquette du fabricant…','Comptage des positions…','Lecture des calibres sur les manettes…','Lecture du répertoire…'];
  let i=0;const timer=setInterval(()=>{msg.textContent=steps[i++%steps.length];},4500);
  try{
   const out=await api('/api/panels?action=scan',{method:'POST',body:{files:files.map(({name,data})=>({name,data})),hint}});
   status.used=out.used;
   if(out.notPanel)return photos('L’IA ne reconnaît pas de panneau électrique sur ces fichiers. '+(out.summary||''));
   identify(out.proposal);
  }catch(e){photos(e.message);}
  finally{clearInterval(timer);}
 }

 // ---------- 3. Identification ----------
 function identify(p){
  const det=p.meta.details;
  const highest=Math.max(2,...p.circuits.filter(c=>c.label||c.amps||c.vacant).flatMap(c=>c.slots.map(slotPos)));
  const posChoices=[];for(let n=Math.max(2,highest+highest%2);n<=84;n+=2)posChoices.push(n);
  const f={
   name:h('input',{value:p.meta.name,maxlength:100,required:true}),tag:h('input',{value:'',maxlength:24,placeholder:'Ex. P-1'}),
   kind:select('kind',panelKinds,p.meta.kind),location:h('input',{maxlength:140,placeholder:'Ex. Sous-sol, salle mécanique'}),
   brand:h('input',{value:det.brand,maxlength:60}),model:h('input',{value:det.model,maxlength:60}),
   mainAmps:h('input',{type:'number',min:15,max:1200,step:5,value:det.mainAmps??''}),
   positions:select('positions',posChoices.map(n=>[n,n+' positions']),p.positions),
   voltage:select('voltage',voltages,det.voltage),
   family:select('family',[['','— Autre / non précisée —'],...Object.entries(FAMILIES).filter(([k])=>k!=='generic').map(([k,x])=>[k,x.name])],det.family),
  };
  const conf=p.confidence;
  stage.replaceChildren(
   h('div',{class:'ai-step-head'},h('span',{class:'ai-step',text:'Étape 1 de 2'}),h('h3',{text:'Est-ce bien ce panneau ?'}),h('span',{class:'ai-conf '+confClass(conf),text:'Confiance '+pct(conf)})),
   det.notes&&h('p',{class:'small muted',text:det.notes}),
   p.warnings.length?h('div',{class:'notice'},h('b',{text:'À vérifier : '}),h('ul',{},p.warnings.slice(0,8).map(w=>h('li',{text:w})))):null,
   h('div',{class:'fields'},field('Nom du panneau',f.name),field('Étiquette',f.tag),field('Type',f.kind),field('Emplacement',f.location),
    field('Marque',f.brand),field('Gamme / modèle',f.model),field('Principal (A)',f.mainAmps),field('Nombre de positions',f.positions,{hint:'Ajustez si l’IA n’a pas vu tout le panneau.'}),field('Tension',f.voltage),field('Famille de produits',f.family,{hint:'Détermine le dessin des disjoncteurs.'})),
   h('div',{class:'form-actions'},h('button',{type:'button',class:'ghost',onclick:()=>photos()},'← Autres photos'),
    h('button',{type:'button',class:'primary',onclick:()=>{
     if(!f.name.value.trim())return f.name.focus();
     const positions=Number(f.positions.value);
     let circuits=p.circuits;
     try{if(positions!==p.positions)circuits=resize(circuits,positions);}catch(e){return toast(e.message);}
     build({...p,positions,circuits,meta:{name:f.name.value.trim(),tag:f.tag.value.trim(),kind:f.kind.value,location:f.location.value.trim(),
      details:{...det,brand:f.brand.value.trim(),model:f.model.value.trim(),mainAmps:f.mainAmps.value===''?null:Number(f.mainAmps.value),voltage:f.voltage.value,family:f.family.value}}});
    }},'Oui — construire le panneau →')));
 }

 // ---------- 4 et 5. Construction pas à pas, puis confirmation ----------
 async function build(p){
  const art=h('div',{class:'ai-art'});
  const log=h('ol',{class:'ai-log'});
  const head=h('div',{class:'ai-step-head'},h('span',{class:'ai-step',text:'Étape 2 de 2'}),h('h3',{text:'Construction du panneau…'}));
  stage.replaceChildren(head,h('div',{class:'ai-build'},art,log));
  const byId=new Map(p.circuits.map(c=>[c.id,c]));
  // Panneau vide aux formats finaux, puis on « pose » les disjoncteurs un à un.
  let shown=p.circuits.map(c=>({...c,label:'',amps:null,status:'À confirmer',protection:undefined,vacant:undefined,notes:''}));
  const draw=()=>art.replaceChildren(panelArt({panel:{name:p.meta.name,kind:p.meta.kind,positions:p.positions,details:p.meta.details,circuits:shown},showLabels:true}));
  draw();
  const delay=Math.max(60,Math.min(220,3500/Math.max(1,p.steps.length)));
  for(const id of p.steps){
   const c=byId.get(id);if(!c)continue;
   shown=shown.map(x=>x.id===id?c:x);draw();
   const r=p.review[id];
   log.append(h('li',{class:r?confClass(r.confidence):'muted'},h('b',{text:designation(c)}),' ',c.vacant?'espace inutilisé':`${c.amps?c.amps+' A':'? A'} · ${c.label||'sans désignation'}`,r&&r.confidence<AI_CONFIDENT?h('span',{class:'ai-flag',text:' à vérifier'}):null));
   log.scrollTop=log.scrollHeight;
   await wait(delay);
  }
  confirm(p);
 }
 function confirm(p){
  let circuits=p.circuits.map(c=>({...c}));
  const art=h('div',{class:'ai-art'});
  const draw=()=>art.replaceChildren(panelArt({panel:{name:p.meta.name,kind:p.meta.kind,positions:p.positions,details:p.meta.details,circuits},showLabels:true}));
  const rows=sortCircuits(circuits).filter(c=>c.label||c.amps||p.review[c.id]).map(c=>{
   const r=p.review[c.id];
   const amps=h('select',{'aria-label':'Calibre '+designation(c)},new Option('?',''),...ampsList.map(a=>new Option(a+' A',a)));amps.value=c.amps??'';
   const label=h('input',{value:c.label,maxlength:100,'aria-label':'Désignation '+designation(c),placeholder:'Désignation'});
   const upd=()=>{circuits=circuits.map(x=>x.id!==c.id?x:{...x,amps:amps.value===''?null:Number(amps.value),label:label.value.trim(),status:label.value.trim()&&x.status==='Identifié'?'Identifié':'À confirmer'});draw();};
   amps.addEventListener('change',upd);label.addEventListener('change',upd);
   return h('tr',{class:r?confClass(r.confidence):''},h('td',{text:designation(c)}),h('td',{},amps),h('td',{},label),h('td',{class:'small',text:pct(r?.confidence)}));
  });
  const errBox=h('p',{class:'error',role:'alert'});
  const create=h('button',{type:'button',class:'primary lg',onclick:async()=>{
   create.disabled=true;errBox.textContent='';
   try{
    const {panel}=await api('/api/panels',{method:'POST',body:{siteId:site.id,...p.meta,positions:p.positions,circuits}});
    d.close();toast('Panneau créé à partir de la lecture IA. Vérifiez les circuits marqués « À confirmer ».',7000);onCreated?.(panel);
   }catch(e){errBox.textContent=e.message;create.disabled=false;}
  }},'Oui, c’est la configuration en place — créer le panneau');
  stage.replaceChildren(
   h('div',{class:'ai-step-head'},h('span',{class:'ai-step',text:'Confirmation'}),h('h3',{text:'Est-ce bien la configuration en place ?'})),
   h('p',{class:'small muted',text:'Comparez avec le panneau réel. Corrigez un calibre ou une désignation directement dans le tableau. Les lignes orange sont à vérifier en priorité. Les circuits sans désignation fiable resteront « À confirmer ».'}),
   h('div',{class:'ai-build'},art,h('div',{class:'ai-table-wrap'},h('table',{class:'ai-table'},h('thead',{},h('tr',{},h('th',{text:'Pos.'}),h('th',{text:'Calibre'}),h('th',{text:'Désignation'}),h('th',{text:'Confiance'}))),h('tbody',{},rows.length?rows:[h('tr',{},h('td',{colspan:4,class:'muted',text:'Aucun disjoncteur lu : le panneau sera créé vide.'}))])))),
   errBox,
   h('div',{class:'form-actions'},h('button',{type:'button',class:'ghost',onclick:()=>identify(p)},'← Revenir à l’identification'),h('button',{type:'button',class:'ghost',onclick:()=>photos()},'Recommencer avec d’autres photos'),create));
  draw();
 }
}
