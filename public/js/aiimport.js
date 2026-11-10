// Ajout d'un panneau par photo ou fichier récapitulatif, avec lecture par IA (forfaits payants).
// Étapes : 1) photos / fichiers  2) lecture  3) identification à confirmer
//          4) construction pas à pas du panneau  5) « Est-ce bien la configuration en place ? »  6) création.
import {h,field,select,dialog,toast} from './dom.js';
import {api} from './api.js';
import {panelArt} from './panelart.js';
import {blank,resize,mergeScanned,designation,sortCircuits,ampsList,panelKinds,voltages,slotPos,isLinkedPair,groupCandidates,groupCircuits,ungroupCircuit,suggestLinks} from '../model.js';
import {FAMILIES} from '../catalog.js';
import {AI_CONFIDENT} from '../aiscan.js';
import {positionQuiz} from './guided.js';
import {promoteAnswered} from '../guided.js';

const MAX_SIDE=2000,MAX_FILES=6,MAX_TOTAL=3*1024*1024;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const norm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
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

/** `target` : panneau existant à garnir (au lieu de créer un nouveau panneau) ; `onApplied(panel)` après enregistrement. */
export async function aiImportDialog({site,siblings=[],onCreated,target=null,onApplied}){
 const stage=h('div',{class:'ai-stage'});
 // replaceChildren natif écrit « null » pour une valeur nulle : on filtre.
 const put=(...kids)=>stage.replaceChildren(...kids.flat().filter(k=>k!=null&&k!==false&&k!==''));
 let replaceExisting=false;
 const d=dialog({title:target?'Garnir le panneau par photos':'Ajouter un panneau par photo',eyebrow:'Assistant IA · '+(target?[target.tag,target.name].filter(Boolean).join(' · '):site.name),wide:'xl',body:[stage]});
 stage.append(h('p',{class:'muted',text:'Vérification de votre forfait…'}));
 let status;
 try{status=await api('/api/panels?action=scan');}catch(e){put(h('p',{class:'error',text:e.message}));return;}
 if(!status.configured){put(h('div',{class:'notice'},'L’analyse par IA n’est pas encore activée sur ce serveur. L’administrateur doit définir la variable OPENAI_API_KEY.'));return;}
 if(!status.allowed){put(h('div',{class:'ai-upsell'},h('h3',{text:'Inclus dans les forfaits payants'}),h('p',{text:'Photographiez le panneau ouvert ou téléversez un récapitulatif : l’IA lit la marque, le principal, le nombre de positions et chaque disjoncteur, puis construit le panneau avec vous.'}),h('a',{class:'btn primary',href:'#/abonnement',onclick:()=>d.close()},'Voir les forfaits')));return;}
 const files=[];
 let usedModel='';
 photos();

 // ---------- 1. Photos et fichiers ----------
 function photos(err=''){
  const list=h('div',{class:'ai-files'});
  const errBox=h('p',{class:'error',role:'alert',text:err});
  const refresh=()=>{list.replaceChildren(...files.map((f,i)=>h('div',{class:'ai-file'},f.thumb?h('img',{src:f.data,alt:f.name}):h('span',{class:'ai-doc',text:'📄'}),h('span',{class:'small',text:f.name}),h('button',{type:'button',class:'ghost sm','aria-label':'Retirer '+f.name,onclick:()=>{files.splice(i,1);refresh();}},'✕'))));analyze.disabled=!files.length;};
  const add=async input=>{
   errBox.textContent='';
   for(const file of [...input.files]){
    const max=status.maxFiles||MAX_FILES;
    if(files.length>=max){errBox.textContent=`${max} fichiers au maximum${status.lite?' (analyse allégée du forfait gratuit)':''}.`;break;}
    try{const p=await prepare(file);if(files.reduce((s,f)=>s+f.data.length*.75,0)+p.data.length*.75>MAX_TOTAL)throw Error('Total trop lourd : retirez un fichier.');files.push(p);}catch(e){errBox.textContent=e.message;}
   }
   input.value='';refresh();
  };
  const camera=h('input',{type:'file',accept:'image/*',capture:'environment',class:'sr-only',id:'aiCamera',onchange:e=>add(e.target)});
  const picker=h('input',{type:'file',multiple:true,accept:'image/*,application/pdf,.csv,.txt,.json',class:'sr-only',id:'aiFiles',onchange:e=>add(e.target)});
  const brand=h('input',{name:'brand',maxlength:60,placeholder:'Facultatif',list:'aiBrands',value:target?.details?.brand||''});
  const positions=h('input',{name:'positions',type:'number',min:2,max:84,step:2,placeholder:'Facultatif',inputmode:'numeric',value:target?.positions||''});
  const note=h('input',{name:'note',maxlength:300,placeholder:'Ex. sous-panneau du garage, répertoire sur la 2e photo'});
  const analyze=h('button',{type:'button',class:'primary lg',disabled:true,onclick:()=>read({brand:brand.value.trim(),positions:Number(positions.value)||undefined,note:note.value.trim()})},'Analyser avec l’IA');
  put(
   h('div',{class:'ai-intro'},
    h('ol',{class:'ai-tips'},
     h('li',{text:'Ouvrez la porte du panneau et photographiez-le de face, en entier, bien éclairé.'}),
     h('li',{text:'Ajoutez une photo rapprochée de l’étiquette du fabricant (marque, numéro de catalogue, ampérage).'}),
     h('li',{text:'Ajoutez le répertoire de la porte s’il est lisible, ou un fichier récapitulatif (PDF, CSV, texte).'})),
    status.lite?h('p',{class:'notice info small',text:`Analyse allégée (forfait gratuit) : ${status.maxFiles} photos au maximum par analyse et pas de photos de précision. Les forfaits payants ajoutent plus d’analyses et les photos de précision.`}):null,
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
  put(h('div',{class:'ai-wait'},h('div',{class:'spinner','aria-hidden':'true'}),msg,h('p',{class:'small muted',text:'Cela prend généralement de 10 à 40 secondes.'})));
  const steps=['Recherche de la marque et de l’étiquette du fabricant…','Comptage des positions…','Lecture des calibres sur les manettes…','Lecture du répertoire…'];
  let i=0;const timer=setInterval(()=>{msg.textContent=steps[i++%steps.length];},4500);
  try{
   const out=await api('/api/panels?action=scan',{method:'POST',body:{files:files.map(({name,data})=>({name,data})),hint}});
   status.used=out.used;usedModel=out.model||'';
   if(out.notPanel)return photos('L’IA ne reconnaît pas de panneau électrique sur ces fichiers. '+(out.summary||''));
   if(target)build(out.proposal);else identify(out.proposal);
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
  put(
   h('div',{class:'ai-step-head'},h('span',{class:'ai-step',text:'Étape 1 de 2'}),h('h3',{text:'Est-ce bien ce panneau ?'}),h('span',{class:'ai-conf '+confClass(conf),text:'Confiance '+pct(conf)}),usedModel&&h('span',{class:'small muted',text:'Lu par '+usedModel})),
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
  put(head,h('div',{class:'ai-build'},art,log));
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
 // state : {circuits, edited:Set (corrigés à la main), changed:Map id→'nouveau'|'modifié', note}
 function confirm(p,state={}){
  let circuits=(state.circuits||p.circuits).map(c=>({...c}));
  const edited=new Set(state.edited||[]),changed=state.changed||new Map();
  const art=h('div',{class:'ai-art'});
  const draw=()=>art.replaceChildren(panelArt({panel:{name:p.meta.name,kind:p.meta.kind,positions:p.positions,details:p.meta.details,circuits},showLabels:true}));
  const rows=sortCircuits(circuits).filter(c=>c.label||c.amps||c.vacant||p.review[c.id]||changed.has(c.id)).map(c=>{
   const r=p.review[c.id];
   const amps=h('select',{'aria-label':'Calibre '+designation(c)},new Option('?',''),...ampsList.map(a=>new Option(a+' A',a)));amps.value=c.amps??'';
   const label=h('input',{value:c.vacant?'':c.label,maxlength:100,'aria-label':'Désignation '+designation(c),placeholder:c.vacant?'Espace inutilisé':'Désignation'});
   const upd=()=>{edited.add(c.id);circuits=circuits.map(x=>x.id!==c.id?x:{...x,vacant:undefined,amps:amps.value===''?null:Number(amps.value),label:label.value.trim(),status:label.value.trim()?'Identifié':'À confirmer'});draw();};
   amps.addEventListener('change',upd);label.addEventListener('change',upd);
   // Grouper avec un emplacement adjacent (jumelé / bipolaire à cheval sur deux positions) ou dissocier.
   const cands=groupCandidates(circuits,c.id);
   const apply=(fn,note)=>{try{const next=fn();edited.add(c.id);confirm(p,{circuits:next,edited,changed,note});}catch(e){toast(e.message);}};
   const grpBox=cands.length||isLinkedPair(c)?h('details',{class:'ai-grp'},
    h('summary',{class:isLinkedPair(c)?'linked':'',text:isLinkedPair(c)?`🔗 ${c.slots.join(' + ')} · un seul disjoncteur`:'⛓ Grouper…'}),
    h('div',{class:'ai-grp-actions'},
     ...cands.map(x=>h('button',{type:'button',class:'sm',onclick:()=>apply(()=>groupCircuits(circuits,c.id,x.id,p.positions,{force:!x.hasData||norm(x.label)===norm(c.label)}),`Emplacements ${c.slots.join(' + ')} + ${x.slot} groupés en un seul disjoncteur.`)},`Grouper avec ${x.slot}${x.label?' · '+x.label:' (libre)'}`)),
     isLinkedPair(c)&&h('button',{type:'button',class:'sm',onclick:()=>apply(()=>ungroupCircuit(circuits,c.id,p.positions),'Disjoncteur dissocié.')},'Dissocier'))):null;
   const ch=changed.get(c.id);
   return h('tr',{class:[r?confClass(r.confidence):'',ch?'changed':''].join(' ')},h('td',{},designation(c),ch?h('span',{class:'ai-new',text:ch}):null),h('td',{},amps),h('td',{class:'ai-label'},label,grpBox),h('td',{class:'small',text:pct(r?.confidence)}));
  });
  // Positions incertaines : confiance faible ou disjoncteur sans désignation (hors corrections de l'utilisateur).
  const uncertain=()=>[...new Set(circuits.filter(c=>!c.vacant&&!edited.has(c.id)&&(c.amps!=null||c.label||p.review[c.id])&&((p.review[c.id]&&p.review[c.id].confidence<AI_CONFIDENT)||!c.label)).map(c=>slotPos(c.slots[0])))].sort((a,b)=>a-b);
  const links=suggestLinks(circuits);
  const errBox=h('p',{class:'error',role:'alert'});
  const create=h('button',{type:'button',class:'primary lg',onclick:async()=>{
   create.disabled=true;errBox.textContent='';
   try{
    if(target){
     const merged=mergeScanned(target.circuits,circuits,target.positions,{replace:replaceExisting});
     // Complète la fiche du panneau (marque, gamme, principal…) seulement là où elle est vide.
     const det=target.details||{},rd=p.meta.details||{},fill={};
     for(const k of ['brand','model','mainAmps','family'])if((det[k]==null||det[k]==='')&&rd[k])fill[k]=rd[k];
     const body={revision:target.revision,circuits:merged.circuits};
     if(Object.keys(fill).length)body.meta={name:target.name,tag:target.tag,kind:target.kind,location:target.location,details:{...det,...fill}};
     const out=await api('/api/panels?id='+target.id,{method:'PUT',body});
     d.close();
     toast(`${merged.applied} circuit(s) ajouté(s) au panneau${merged.skipped.length?` · ${merged.skipped.length} ignoré(s) (déjà décrits ou hors du panneau)`:''}. Vérifiez les circuits « À confirmer ».`,8000);
     onApplied?.(out.panel);return;
    }
    const {panel}=await api('/api/panels',{method:'POST',body:{siteId:site.id,...p.meta,positions:p.positions,circuits}});
    d.close();toast('Panneau créé à partir de la lecture IA. Vérifiez les circuits marqués « À confirmer ».',7000);onCreated?.(panel);
   }catch(e){errBox.textContent=e.message;create.disabled=false;}
  }},target?'Oui — garnir le panneau avec cette lecture':'Oui, c’est la configuration en place — créer le panneau');
  put(
   h('div',{class:'ai-step-head'},h('span',{class:'ai-step',text:'Confirmation'}),h('h3',{text:'Est-ce bien la configuration en place ?'}),usedModel&&h('span',{class:'small muted',text:'Lu par '+usedModel})),
   state.note?h('div',{class:'notice info'},state.note):null,
   links.length?h('div',{class:'notice'},h('b',{text:'Un seul disjoncteur sur deux emplacements ? '}),'Ces emplacements voisins ont le même calibre et la même désignation :',
    h('div',{class:'form-actions'},links.map(l=>h('button',{type:'button',class:'sm',onclick:()=>{try{const next=groupCircuits(circuits,l.a,l.b,p.positions,{force:true});edited.add(l.a);confirm(p,{circuits:next,edited,changed,note:`${l.slots.join(' + ')} groupés : un seul disjoncteur de ${l.amps} A.`});}catch(e){toast(e.message);}}},`Grouper ${l.slots.join(' + ')} · ${l.amps} A · ${l.label}`)))):null,
   h('p',{class:'small muted',text:'Comparez avec le panneau réel. Corrigez un calibre ou une désignation directement dans le tableau. Les lignes orange sont à vérifier en priorité. Il manque quelque chose ? Ajoutez des photos rapprochées pour préciser.'}),
   h('div',{class:'ai-build'},art,h('div',{class:'ai-table-wrap'},h('table',{class:'ai-table'},h('thead',{},h('tr',{},h('th',{text:'Pos.'}),h('th',{text:'Calibre'}),h('th',{text:'Désignation'}),h('th',{text:'Confiance'}))),h('tbody',{},rows.length?rows:[h('tr',{},h('td',{colspan:4,class:'muted',text:'Aucun disjoncteur lu : ajoutez des photos pour préciser, ou créez le panneau vide.'}))])))),
   target?h('div',{class:'notice info small'},h('b',{text:'Garnir « '+target.name+' » : '}),'seuls les emplacements encore vides sont remplis ; vos circuits déjà décrits sont conservés.',
    h('label',{class:'check small'},h('input',{type:'checkbox',checked:replaceExisting,onchange:e=>{replaceExisting=e.target.checked;}}),' Remplacer aussi les circuits déjà décrits par la lecture IA')):null,
   errBox,
   h('div',{class:'form-actions'},
    target?null:h('button',{type:'button',class:'ghost',onclick:()=>identify(p)},'← Revenir à l’identification'),
    h('button',{type:'button',class:'ghost',onclick:()=>photos()},'Recommencer'),
    uncertain().length?h('button',{type:'button',onclick:()=>quiz(p,{circuits,edited,changed})},`🧭 Questions sur les points incertains (${uncertain().length})`):null,
    status.lite?null:h('button',{type:'button',onclick:()=>clarify(p,{circuits,edited})},'📷 Ajouter des photos pour préciser'),
    create));
  draw();
 }

 // ---------- Questions sur les points incertains (mode guidé appliqué aux doutes de l'IA) ----------
 function quiz(p,state){
  const list=[...new Set(state.circuits.filter(c=>!c.vacant&&!state.edited.has(c.id)&&(c.amps!=null||c.label||p.review[c.id])&&((p.review[c.id]&&p.review[c.id].confidence<AI_CONFIDENT)||!c.label)).map(c=>slotPos(c.slots[0])))].sort((a,b)=>a-b);
  let st={positions:p.positions,circuits:state.circuits,done:[...new Set(state.circuits.filter(c=>c.label||c.amps!=null||c.vacant).map(c=>slotPos(c.slots[0])))]};
  const qBox=h('div',{class:'gd-question'}),artBox=h('div',{class:'gd-art'});
  put(h('div',{class:'gd-wrap'},qBox,artBox));
  const draw=n=>artBox.replaceChildren(panelArt({panel:{name:p.meta.name,kind:p.meta.kind,positions:p.positions,details:p.meta.details,circuits:st.circuits},showLabels:true,highlight:new Set([n])}));
  const answered=new Map();
  positionQuiz(qBox,{getState:()=>st,setState:x=>{st=x;},list,art:draw,onAnswer:(n,format)=>answered.set(n,format),
   onBack:()=>confirm(p,state),finishLabel:'Valider et revenir à la confirmation',
   onFinish:()=>{
    const edited=new Set(state.edited),changed=new Map(state.changed||[]);
    // Un disjoncteur confirmé par une réponse passe de « À confirmer » à « Identifié ».
    const confirmed=promoteAnswered(st,answered);
    for(const c of confirmed)if(list.includes(slotPos(c.slots[0]))){edited.add(c.id);changed.set(c.id,'répondu');}
    confirm(p,{circuits:confirmed,edited,changed,note:`${list.length} point(s) incertain(s) vérifié(s) par vos réponses.`});
   }});
 }

 // ---------- Photos de précision : l'IA complète la configuration déjà établie ----------
 function clarify(p,state,err=''){
  const extra=[];
  const list=h('div',{class:'ai-files'});
  const errBox=h('p',{class:'error',role:'alert',text:err});
  const go=h('button',{type:'button',class:'primary',disabled:true},'Analyser les photos supplémentaires');
  const refresh=()=>{list.replaceChildren(...extra.map((f,i)=>h('div',{class:'ai-file'},f.thumb?h('img',{src:f.data,alt:f.name}):h('span',{class:'ai-doc',text:'📄'}),h('span',{class:'small',text:f.name}),h('button',{type:'button',class:'ghost sm','aria-label':'Retirer '+f.name,onclick:()=>{extra.splice(i,1);refresh();}},'✕'))));go.disabled=!extra.length;};
  const add=async input=>{
   errBox.textContent='';
   for(const file of [...input.files]){
    if(extra.length>=MAX_FILES){errBox.textContent=`${MAX_FILES} fichiers au maximum.`;break;}
    try{const f=await prepare(file);if(extra.reduce((s,x)=>s+x.data.length*.75,0)+f.data.length*.75>MAX_TOTAL)throw Error('Total trop lourd : retirez un fichier.');extra.push(f);}catch(e){errBox.textContent=e.message;}
   }
   input.value='';refresh();
  };
  const note=h('input',{maxlength:300,placeholder:'Ex. gros plan des positions 21 à 32, répertoire de la porte, étiquette du fabricant'});
  go.addEventListener('click',()=>readMore(p,state,extra,note.value.trim()));
  put(
   h('div',{class:'ai-step-head'},h('span',{class:'ai-step',text:'Précision'}),h('h3',{text:'Ajouter des photos pour préciser'})),
   h('p',{class:'muted',text:'Photographiez de près ce qui manque ou semble incorrect : une rangée de disjoncteurs, des calibres peu lisibles, le répertoire de la porte. L’IA garde ce qui est déjà établi (et vos corrections), puis complète.'}),
   h('div',{class:'ai-extra'},
    h('div',{class:'page-actions'},h('label',{class:'btn primary',for:'aiCamera2'},'📷 Prendre une photo'),h('input',{type:'file',accept:'image/*',capture:'environment',class:'sr-only',id:'aiCamera2',onchange:e=>add(e.target)}),
     h('label',{class:'btn',for:'aiFiles2'},'📁 Choisir des fichiers'),h('input',{type:'file',multiple:true,accept:'image/*,application/pdf,.csv,.txt,.json',class:'sr-only',id:'aiFiles2',onchange:e=>add(e.target)})),
    list,
    field('Que montrent ces photos ? (facultatif)',note)),
   errBox,
   h('div',{class:'form-actions'},h('button',{type:'button',class:'ghost',onclick:()=>confirm(p,state)},'← Retour à la confirmation'),go));
  refresh();
 }
 async function readMore(p,state,extra,note){
  const msg=h('p',{class:'ai-wait-msg',text:'Lecture des photos de précision…'});
  put(h('div',{class:'ai-wait'},h('div',{class:'spinner','aria-hidden':'true'}),msg,h('p',{class:'small muted',text:'L’IA complète la configuration déjà établie.'})));
  const current=state.circuits;
  // Configuration actuelle transmise à l'IA (les corrections de l'utilisateur sont marquées).
  const previous=current.filter(c=>c.label||c.amps||c.vacant).map(c=>({position:slotPos(c.slots[0]),half:c.slots.length===1||isLinkedPair(c)?c.slots[0].slice(-1):'',poles:isLinkedPair(c)?1:new Set(c.slots.map(slotPos)).size,spans_next:isLinkedPair(c),amps:c.amps??null,label:c.label||'',vacant:!!c.vacant,user_confirmed:state.edited.has(c.id)}));
  const det=p.meta.details;
  try{
   const out=await api('/api/panels?action=scan',{method:'POST',body:{files:extra.map(({name,data})=>({name,data})),hint:{note,previous,brand:det.brand,series:det.model,mainAmps:det.mainAmps??undefined,positions:p.positions}}});
   status.used=out.used;usedModel=out.model||usedModel;
   if(out.notPanel)return clarify(p,state,'L’IA ne reconnaît pas d’éléments de panneau sur ces photos. '+(out.summary||''));
   const np=out.proposal;
   let circuits=np.circuits,positions=np.positions;
   if(positions<p.positions){circuits=resize(circuits,p.positions);positions=p.positions;}
   // Les corrections de l'utilisateur sont réappliquées si le disjoncteur occupe les mêmes positions.
   const key=c=>c.slots.join(',');
   const mine=new Map(current.filter(c=>state.edited.has(c.id)).map(c=>[key(c),c]));
   const edited=new Set();
   circuits=circuits.map(c=>{const m=mine.get(key(c));if(!m)return c;edited.add(c.id);return {...c,label:m.label,amps:m.amps,status:m.status,vacant:m.vacant};});
   // Ce qui a changé par rapport à la configuration précédente.
   const before=new Map(current.map(c=>[key(c),c]));
   const changed=new Map();
   for(const c of circuits){
    const b=before.get(key(c));
    const has=c.label||c.amps||c.vacant;
    if(!b){if(has)changed.set(c.id,'nouveau');continue;}
    if(has&&(b.label!==c.label||b.amps!==c.amps||!!b.vacant!==!!c.vacant))changed.set(c.id,(b.label||b.amps||b.vacant)?'modifié':'nouveau');
   }
   const np2={...p,positions,circuits,review:{...np.review},steps:np.steps,warnings:np.warnings};
   const note2=`${changed.size} circuit(s) ajouté(s) ou modifié(s) grâce aux photos de précision.`+(np.warnings.length?' À vérifier : '+np.warnings.slice(0,4).join(' · '):'');
   confirm(np2,{circuits,edited,changed,note:note2});
  }catch(e){clarify(p,state,e.message);}
 }
}
