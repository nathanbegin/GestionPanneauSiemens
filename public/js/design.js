// Assistant de conception : bâtiment → gros appareils → calcul et modèle → résumé → panneau créé à l'étape « Conception ».
import {h,dialog,toast,field,select} from './dom.js';
import {api} from './api.js';
import {panelArt} from './panelart.js';
import {loadLibrary,suggestModels} from './library.js';
import {FAMILIES,familyOf} from '../catalog.js';
import {siteVolts,voltageLabel} from '../voltage.js';
import {DESIGN_APPLIANCES,designItems,designCalc,designDemand,mainFor,genericPositions,draftLayout} from '../design.js';

const kw=w=>(w/1000).toLocaleString((globalThis.MP_LOCALE||'fr-CA'),{maximumFractionDigits:1})+' kW';

/** onManual() : ouvre la création simple d'un panneau vide ; onCreated(panel) après création. */
export function designDialog({site,onCreated,onManual}){
 const S={name:'Panneau principal',tag:'P-1',location:'',livingArea:'',basementArea:'',picks:Object.fromEntries(DESIGN_APPLIANCES.map(a=>[a.id,a.def])),
  margin:0.2,family:'',choice:'generic',kind:'Principal'};
 let lib=null;
 const box=h('div',{class:'design-wizard'});
 const d=dialog({title:'Concevoir un panneau',eyebrow:'Étape 1 · Conception · '+site.name,wide:'xl',body:[box]});
 const put=(...k)=>box.replaceChildren(...k.flat().filter(x=>x!=null&&x!==false&&x!==''));
 const head=(n,title)=>h('div',{class:'ai-step-head'},h('span',{class:'ai-step',text:`Étape ${n} de 4`}),h('h3',{text:title}));
 const nav=(back,next,nextLabel='Continuer →')=>h('div',{class:'form-actions'},back&&h('button',{type:'button',class:'ghost',onclick:back},'← Retour'),next&&h('button',{type:'button',class:'primary',onclick:next},nextLabel));
 const areas=()=>({livingArea:Number(S.livingArea)||0,basementArea:Number(S.basementArea)||0});
 const compute=()=>{const vs=siteVolts(site);const items=designItems({...areas(),picks:S.picks,vs});return {items,calc:designCalc(items,{...areas(),vs}),demand:designDemand(items)};};

 // ---------- 1. Bâtiment ----------
 function step1(){
  const f={name:h('input',{value:S.name,maxlength:100,required:true}),tag:h('input',{value:S.tag,maxlength:24,placeholder:'Ex. P-1'}),location:h('input',{value:S.location,maxlength:140,placeholder:'Ex. Sous-sol, salle mécanique'}),
   living:h('input',{type:'number',min:0,max:10000,value:S.livingArea,inputmode:'numeric',placeholder:'Ex. 140'}),base:h('input',{type:'number',min:0,max:10000,value:S.basementArea,inputmode:'numeric',placeholder:'Ex. 80'})};
  put(head(1,'Le bâtiment'),
   h('p',{class:'muted',text:'La superficie habitable sert à calculer la charge de base et le nombre de circuits d’éclairage et de prises.'}),
   h('div',{class:'fields'},field('Nom du panneau',f.name),field('Étiquette',f.tag),field('Emplacement',f.location,{full:true}),
    field('Superficie hors sol (m²)',f.living,{hint:'Rez-de-chaussée et étages.'}),field('Superficie du sous-sol (m²)',f.base,{hint:'Compte à 75 %.'})),
   h('div',{class:'form-actions'},onManual&&h('button',{type:'button',class:'ghost',onclick:()=>{d.close();onManual();}},'Créer un panneau vide plutôt'),
    h('button',{type:'button',class:'primary',onclick:()=>{
     if(!f.name.value.trim())return f.name.focus();
     if(!(Number(f.living.value)>0))return toast('Indiquez la superficie hors sol.');
     Object.assign(S,{name:f.name.value.trim(),tag:f.tag.value.trim(),location:f.location.value.trim(),livingArea:f.living.value,basementArea:f.base.value});step2();
    }},'Continuer →')));
 }
 // ---------- 2. Appareils ----------
 function step2(){
  const inputs=DESIGN_APPLIANCES.map(a=>{const i=h('input',{type:'number',min:0,max:a.max||5,step:1,value:S.picks[a.id],'aria-label':a.label,class:'qty'});i.addEventListener('input',()=>{S.picks[a.id]=Number(i.value)||0;});return [a,i];});
  put(head(2,'Les gros appareils'),
   h('p',{class:'muted',text:'Indiquez combien de chaque appareil le panneau doit alimenter. Chacun reçoit son circuit dédié et compte dans le calcul de la charge. Les prises et l’éclairage sont prévus selon la superficie.'}),
   h('div',{class:'design-appliances'},...inputs.map(([a,i])=>h('label',{class:'design-row'},h('span',{},h('b',{text:a.label})),i,h('span',{class:'small muted',text:a.unit})))),
   nav(step1,step3));
 }
 // ---------- 3. Calcul et modèle ----------
 async function step3(){
  if(lib===null){try{lib=await loadLibrary();}catch{lib=false;}}
  const {items,calc,demand}=compute();
  const main=mainFor(calc.amps,S.margin);
  const sel=select('family',[['','Toutes les marques'],...Object.entries(FAMILIES).filter(([k])=>k!=='generic').map(([k,f])=>[k,f.name])],S.family);
  sel.addEventListener('change',()=>{S.family=sel.value;S.choice='generic';step3();});
  const mar=select('margin',[[0,'Aucune marge'],[0.2,'Marge de 20 %'],[0.3,'Marge de 30 %']],S.margin);
  mar.addEventListener('change',()=>{S.margin=Number(mar.value);S.choice='generic';step3();});
  const suggestions=lib?suggestModels(lib.panels,{circuits:demand.circuits,spaces:demand.spaces,margin:S.margin,family:S.family,mainAmps:main,limit:6}):[];
  const generic=genericPositions(items,{tandem:true,margin:S.margin});
  const opt=(value,title,text)=>h('label',{class:'design-opt'+(S.choice===value?' on':'')},h('input',{type:'radio',name:'model',checked:S.choice===value,onchange:()=>{S.choice=value;step3();}}),h('span',{},h('b',{text:title}),h('div',{class:'small muted',text})));
  put(head(3,'Le calcul et le modèle'),
   h('div',{class:'design-calc'},
    h('div',{},h('b',{text:`${calc.amps} A`}),h('span',{class:'small muted',text:`charge de calcul (${kw(calc.totalW)}, règle 8-200)`})),
    h('div',{},h('b',{text:`${main??'—'} A`}),h('span',{class:'small muted',text:`entrée recommandée${S.margin?` avec marge de ${Math.round(S.margin*100)} %`:''} · minimum du Code : ${calc.recommended??'—'} A`})),
    h('div',{},h('b',{text:`${demand.breakers} disjoncteurs`}),h('span',{class:'small muted',text:`${demand.circuits} circuits au sens du catalogue (A/B = 1, bipolaire = 2, principal exclu) · ${demand.spaces} espaces avec jumelés`}))),
   calc.warnings.length?h('p',{class:'notice small',text:calc.warnings.join(' ')}):null,
   h('div',{class:'fields'},field('Marge d’expansion',mar),field('Marque',sel)),
   h('h4',{text:'Modèles suggérés'}),
   lib?null:h('p',{class:'small muted',text:'La bibliothèque de modèles est incluse dans les forfaits Électricien. Vous pouvez créer un panneau générique de la bonne taille et choisir le modèle plus tard.'}),
   h('div',{class:'design-opts'},...suggestions.map(s=>opt('m:'+s.p.cat,`${s.p.cat} · ${familyOf(s.p.family).name}`,`${s.p.main?'Principal '+s.p.main+' A':'Cosses'} · ${s.p.espaces} espaces / ${s.p.circuits??s.p.espaces} circuits · ${s.tier==='marge'?'marge respectée':'juste suffisant'} · ${s.tandem?'jumelés requis':'sans jumelés'}`)),
    opt('generic',`Panneau générique de ${generic} positions`,`Principal ${main??'—'} A · jumelés acceptés · modèle à choisir plus tard.`)),
   suggestions.length===0&&lib?h('p',{class:'small muted',text:'Aucun modèle du catalogue ne convient à cette marque et cette taille : choisissez une autre marque ou le panneau générique.'}):null,
   nav(step2,step4));
 }
 // ---------- 4. Résumé et création ----------
 function plan(){
  const {items,calc,demand}=compute();
  const main=mainFor(calc.amps,S.margin);
  let positions,tandem,p=null;
  if(S.choice.startsWith('m:')&&lib){p=lib.panels.find(x=>x.cat===S.choice.slice(2));}
  if(p){positions=p.espaces;tandem=p.circuits!=null&&p.circuits>p.espaces;}
  else{tandem=true;positions=genericPositions(items,{tandem,margin:S.margin});}
  const layout=draftLayout(items,{positions,tandem});
  return {items,calc,demand,main,p,positions,tandem,...layout};
 }
 function step4(){
  const r=plan();
  const det=r.p?{modelId:r.p.cat,family:r.p.family,brand:familyOf(r.p.family).brand||'',mainAmps:r.p.main||r.main}:{mainAmps:r.main,family:S.family||''};
  const art=h('div',{class:'gd-art'},panelArt({panel:{name:S.name,kind:S.kind,positions:r.positions,details:{...det,family:det.family||''},circuits:r.circuits},showLabels:true}));
  const err=h('p',{class:'error',role:'alert'});
  const create=h('button',{type:'button',class:'primary lg',onclick:async()=>{
   create.disabled=true;err.textContent='';
   try{
    const {panel}=await api('/api/panels',{method:'POST',body:{siteId:site.id,name:S.name,tag:S.tag,kind:S.kind,location:S.location,positions:r.positions,circuits:r.circuits,
     details:{...det,voltage:voltageLabel(siteVolts(site).bi),livingArea:Number(S.livingArea)||null,basementArea:Number(S.basementArea)||null,stage:'conception',state:'Planifié',notes:`Panneau conçu avec l’assistant : charge de calcul ${r.calc.amps} A, entrée recommandée ${r.main??'—'} A.`}}});
    d.close();toast('Panneau créé en conception. Ajustez-le, puis passez au relevé une fois installé.',8000);onCreated?.(panel);
   }catch(e){err.textContent=e.message;create.disabled=false;}
  }},'Créer le panneau');
  put(head(4,'Résumé'),
   h('div',{class:'ai-build'},art,h('div',{},
    h('ul',{class:'design-summary'},h('li',{},h('b',{text:S.name}),S.tag?' · '+S.tag:''),h('li',{text:`${r.positions} positions · principal ${r.main??'—'} A${r.p?' · '+r.p.cat:' · modèle à choisir'}`}),
     h('li',{text:`${r.demand.breakers} circuits prévus (${r.demand.bipolar} bipolaires) · charge de calcul ${r.calc.amps} A`}),h('li',{text:`Éclairage et prises selon ${r.calc.area} m² habitables`})),
    r.unplaced.length?h('p',{class:'notice',text:`${r.unplaced.length} circuit(s) ne tiennent pas dans ce modèle (${r.unplaced.map(i=>i.label).join(', ')}). Choisissez un modèle plus grand.`}):null,
    h('p',{class:'small muted',text:'Ce plan est un point de départ : vous pourrez déplacer, retirer ou ajouter des disjoncteurs dans l’onglet Planification.'}),err)),
   h('div',{class:'form-actions'},h('button',{type:'button',class:'ghost',onclick:step3},'← Retour'),create));
 }
 step1();
}
