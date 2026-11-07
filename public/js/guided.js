// Mode guidé : l'application pose des questions simples pour construire le panneau, position par position,
// avec le dessin du panneau qui se met à jour à chaque réponse.
import {h,field,select,dialog,toast,confirmDialog} from './dom.js';
import {api} from './api.js';
import {panelArt,brandBadge} from './panelart.js';
import {designation,sortCircuits,ampsList,usages,panelTitle,slotPos} from '../model.js';
import {FAMILIES} from '../catalog.js';
import {newGuided,answerPosition,nextPosition,prevPosition,coveredFrom,fillRestEmpty,currentAnswer,checkAppliances,assignAppliance,progress,canPlace,guessUsage,
 LABEL_SUGGESTIONS,APPLIANCES,FORMATS} from '../guided.js';

const COMMON_AMPS=[15,20,25,30,40,50,60];
const PROTECTIONS=[['Standard','Standard'],['DDFT','DDFT (bouton TEST)'],['Anti-arc','Anti-arc'],['DDFT + anti-arc','DDFT + anti-arc']];
const BRANDS=['Siemens','Square D','Eaton','Cutler-Hammer','Leviton','Generac','Federal Pioneer','Stab-Lok','Westinghouse','Commander','GE','Schneider Electric'];
const POSITION_CHOICES=[12,16,20,24,30,32,40,42,48,54,60];
const storeKey=id=>'mp_guided_'+id;
const load=id=>{try{return JSON.parse(localStorage.getItem(storeKey(id))||'null');}catch{return null;}};
const save=(id,v)=>{try{v?localStorage.setItem(storeKey(id),JSON.stringify(v)):localStorage.removeItem(storeKey(id));}catch{}};
const side=n=>n%2?'gauche':'droite';
const row=n=>Math.ceil(n/2);
const chip=(label,on,onclick,extra={})=>h('button',{type:'button',class:'gd-chip'+(on?' on':''),'aria-pressed':String(!!on),onclick,...extra},label);

// ---------- Questions sur les positions (réutilisées par l'assistant IA) ----------
// ctx : {getState, setState, list?:[positions], art(el, current), onFinish(), onBack?(), finishLabel}
export function positionQuiz(box,ctx){
 const order=()=>ctx.list||null;
 const first=()=>order()?order()[0]:1;
 const next=n=>{if(order()){const i=order().indexOf(n);return order()[i+1]??null;}return nextPosition(ctx.getState(),n);};
 const prev=n=>{if(order()){const i=order().indexOf(n);return i>0?order()[i-1]:null;}return prevPosition(ctx.getState(),n);};
 function ask(n){
  const st=ctx.getState();
  if(n==null)return ctx.onFinish();
  if(coveredFrom(st,n)&&!order())return ask(next(n));
  const cur=currentAnswer(st,n);
  let format=cur?.format||'';
  const err=h('p',{class:'error',role:'alert'});
  const detail=h('div',{class:'gd-detail'});
  const half=(title,init={})=>{
   const v={amps:init.amps??null,protection:init.protection||'',label:init.label||'',usage:init.usage||''};
   const ampsBox=h('div',{class:'gd-chips'});
   const other=h('select',{'aria-label':'Autre calibre'},new Option('Autre…',''),...ampsList.filter(a=>!COMMON_AMPS.includes(a)).map(a=>new Option(a+' A',a)));
   const drawAmps=()=>{ampsBox.replaceChildren(...COMMON_AMPS.map(a=>chip(a+' A',v.amps===a,()=>{v.amps=v.amps===a?null:a;other.value='';drawAmps();})),other);if(v.amps&&!COMMON_AMPS.includes(v.amps))other.value=v.amps;};
   other.addEventListener('change',()=>{v.amps=other.value?Number(other.value):null;drawAmps();});
   drawAmps();
   const protBox=h('div',{class:'gd-chips'});
   const drawProt=()=>protBox.replaceChildren(...PROTECTIONS.map(([k,l])=>chip(l,v.protection===k,()=>{v.protection=v.protection===k?'':k;drawProt();})));
   drawProt();
   const usageSel=select('usage',usages,v.usage||guessUsage(v.label));
   const label=h('input',{value:v.label,maxlength:100,list:'gdLabels',placeholder:'Ex. Cuisinière, Chambre principale, Plinthes salon…',autocomplete:'off'});
   label.addEventListener('input',()=>{v.label=label.value;if(!v.usage)usageSel.value=guessUsage(label.value);});
   usageSel.addEventListener('change',()=>{v.usage=usageSel.value;});
   const el=h('div',{class:'gd-half'},title&&h('h4',{text:title}),
    h('div',{class:'gd-q'},h('b',{text:'Quel chiffre est inscrit sur la manette ?'}),h('span',{class:'small muted',text:'C’est le calibre en ampères (A).'}),ampsBox),
    h('div',{class:'gd-q'},h('b',{text:'Que contrôle ce disjoncteur ?'}),h('span',{class:'small muted',text:'Ce qui s’éteint quand on le coupe, ou ce qui est écrit sur le répertoire.'}),label,h('label',{class:'small gd-usage'},'Catégorie : ',usageSel)),
    h('div',{class:'gd-q'},h('b',{text:'Y a-t-il un bouton TEST ou une mention particulière ?'}),protBox));
   return {el,value:()=>({amps:v.amps,label:v.label,protection:v.protection||undefined,usage:v.usage||undefined}),focus:()=>label.focus()};
  }
  let halves=[];
  const drawDetail=()=>{
   err.textContent='';
   if(!format||format==='empty'||format==='unknown'){detail.replaceChildren();return;}
   const msg=canPlace(st,n,format);if(msg){err.textContent=msg;detail.replaceChildren();return;}
   if(format==='tandem'){halves=[half('Moitié du haut',cur?.halves?.[0]),half('Moitié du bas',cur?.halves?.[1])];}
   else halves=[half('',cur&&cur.format===format?cur:{})];
   detail.replaceChildren(...halves.map(x=>x.el));
  };
  const formatBox=h('div',{class:'gd-formats'});
  const drawFormats=()=>formatBox.replaceChildren(...Object.entries(FORMATS).map(([k,f])=>h('button',{type:'button',class:'gd-format'+(format===k?' on':''),'aria-pressed':String(format===k),onclick:()=>{format=k;drawFormats();drawDetail();if(k==='empty'||k==='unknown')apply();else halves[0]?.focus();}},
   h('span',{class:'gd-ico gd-ico-'+k,'aria-hidden':'true'}),h('b',{text:f.label}),h('span',{class:'small muted',text:f.hint}))));
  drawFormats();drawDetail();
  function apply(){
   if(!format){err.textContent='Choisissez ce qu’il y a à cette position.';return;}
   try{
    const answer=format==='tandem'?{format,halves:halves.map(x=>x.value())}:{format,...(halves[0]?halves[0].value():{})};
    ctx.setState(answerPosition(ctx.getState(),n,answer));
    ask(next(n));
   }catch(e){err.textContent=e.message;}
  }
  const p=prev(n);
  const pr=progress(ctx.getState());
  box.replaceChildren(
   h('div',{class:'gd-head'},h('span',{class:'ai-step',text:order()?`Point à vérifier ${order().indexOf(n)+1} / ${order().length}`:`Position ${n} sur ${st.positions}`}),h('h3',{text:`Position ${n}`}),h('span',{class:'small muted',text:`Colonne de ${side(n)}, ${row(n)}${row(n)===1?'re':'e'} rangée à partir du haut`})),
   !order()&&h('div',{class:'progress gd-progress','aria-label':`${pr.percent} % des positions décrites`},h('i',{style:{width:pr.percent+'%'}})),
   h('p',{class:'gd-ask',text:'Qu’y a-t-il à cette position ?'}),
   formatBox,detail,err,
   h('datalist',{id:'gdLabels'},LABEL_SUGGESTIONS.map(l=>h('option',{value:l}))),
   h('div',{class:'form-actions gd-nav'},
    p!=null?h('button',{type:'button',class:'ghost',onclick:()=>ask(p)},'← Position précédente'):ctx.onBack?h('button',{type:'button',class:'ghost',onclick:ctx.onBack},'← Retour'):null,
    !order()&&h('button',{type:'button',class:'ghost',onclick:async()=>{if(await confirmDialog(`Toutes les positions à partir de ${n} sont-elles vides (aucun disjoncteur) ?`,{title:'Positions restantes',confirm:'Oui, elles sont vides'})){ctx.setState(fillRestEmpty(ctx.getState(),n));ctx.onFinish();}}},'Les positions restantes sont vides'),
    h('button',{type:'button',class:'primary',onclick:apply},next(n)==null?(ctx.finishLabel||'Valider et terminer'):'Valider et continuer →')));
  box.onkeydown=e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'&&e.target.type!=='checkbox'){e.preventDefault();apply();}};
  ctx.art(n);
 }
 ask(ctx.start??first());
 return {ask};
}

// ---------- Questionnaire complet ----------
export function guidedDialog({site,siblings=[],onCreated}){
 const qBox=h('div',{class:'gd-question'});
 const artBox=h('div',{class:'gd-art'});
 const d=dialog({title:'Construire le panneau en répondant à des questions',eyebrow:'Mode guidé · '+site.name,wide:'xl',body:[h('div',{class:'gd-wrap'},qBox,artBox)]});
 let S={step:'kind',meta:{kind:'Principal',name:'Panneau principal',tag:'',location:'',details:{brand:'',model:'',family:'',mainAmps:null,voltage:'120/240 V monophasé',fedFrom:'',fedFromCircuit:''}},st:null,pos:1,owned:[],fixes:[]};
 const persist=()=>save(site.id,S);
 const drawArt=current=>{
  if(!S.st){artBox.replaceChildren(h('div',{class:'gd-art-empty'},h('span',{class:'gd-big','aria-hidden':'true',text:'▦'}),h('p',{class:'muted',text:'Le dessin de votre panneau apparaîtra ici au fil de vos réponses.'})));return;}
  artBox.replaceChildren(panelArt({panel:{name:S.meta.name,kind:S.meta.kind,positions:S.st.positions,details:S.meta.details,circuits:S.st.circuits},showLabels:true,highlight:current?new Set([current]):null,
   onCircuit:id=>{const c=S.st.circuits.find(x=>x.id===id);if(c){S.step='pos';S.pos=slotPos(c.slots[0]);render();}},onPosition:p=>{S.step='pos';S.pos=p;render();}}),
   h('p',{class:'small muted gd-art-tip',text:'Touchez un disjoncteur du dessin pour revenir à sa question.'}));
 };
 const card=(title,help,body,nav)=>{qBox.replaceChildren(h('div',{class:'gd-head'},h('h3',{text:title})),help&&h('p',{class:'muted',text:help}),...[].concat(body),h('div',{class:'form-actions gd-nav'},...nav.filter(Boolean)));};
 const back=step=>h('button',{type:'button',class:'ghost',onclick:()=>{S.step=step;render();}},'← Retour');
 const choiceList=(items,current,onPick)=>h('div',{class:'gd-formats'},items.map(([v,label,hint,extra])=>h('button',{type:'button',class:'gd-format'+(current===v?' on':''),'aria-pressed':String(current===v),onclick:()=>onPick(v)},extra||null,h('b',{text:label}),hint?h('span',{class:'small muted',text:hint}):null)));

 function render(){
  persist();
  const det=S.meta.details;
  if(S.step==='kind'){
   drawArt();
   const fed=select('fedFrom',[['','— Choisir —'],...siblings.map(s=>[s.id,panelTitle(s)])],det.fedFrom||'');
   const fedCircuit=h('input',{value:det.fedFromCircuit||'',maxlength:40,placeholder:'Ex. 14/16'});
   const sub=h('div',{class:'fields gd-sub'},field('Quel panneau l’alimente ?',fed),field('Sur quel disjoncteur de ce panneau ? (facultatif)',fedCircuit));
   const sync=()=>{sub.hidden=S.meta.kind!=='Sous-panneau'||!siblings.length;};
   card('Quel panneau voulez-vous décrire ?','Le panneau principal reçoit l’entrée électrique d’Hydro-Québec. Un sous-panneau est alimenté par un disjoncteur d’un autre panneau (garage, atelier, logement…).',
    [choiceList([['Principal','Le panneau principal','Celui qui a le gros disjoncteur principal, près du compteur.'],['Sous-panneau','Un sous-panneau','Alimenté par un autre panneau de la maison.']],S.meta.kind,v=>{S.meta.kind=v;if(S.meta.name==='Panneau principal'||S.meta.name==='Sous-panneau')S.meta.name=v==='Principal'?'Panneau principal':'Sous-panneau';render();}),sub],
    [h('button',{type:'button',class:'primary',onclick:()=>{det.fedFrom=S.meta.kind==='Sous-panneau'?fed.value:'';det.fedFromCircuit=det.fedFrom?fedCircuit.value.trim():'';S.step='brand';render();}},'Continuer →')]);
   sync();
  }else if(S.step==='brand'){
   drawArt();
   card('Quelle marque est inscrite sur le panneau ?','Regardez sur la porte, à l’intérieur du couvercle ou sur l’étiquette du fabricant.',
    h('div',{class:'gd-brands'},[...BRANDS.map(b=>{const fam=Object.entries(FAMILIES).find(([k,f])=>f.brand===b&&k!=='generic');return chip(fam?h('span',{class:'gd-brand'},brandBadge(fam[0],{size:'sm'}),h('span',{text:b})):b,det.brand===b,()=>{det.brand=b;const fams=Object.entries(FAMILIES).filter(([k,f])=>f.brand===b&&k!=='generic');det.family=fams.length===1?fams[0][0]:'';det.model='';S.step=fams.length>1?'family':'main';render();});}),
     chip('Je ne sais pas / autre',det.brand==='',()=>{det.brand='';det.family='';S.step='main';render();})]),
    [back('kind')]);
  }else if(S.step==='family'){
   drawArt();
   const fams=Object.entries(FAMILIES).filter(([k,f])=>f.brand===det.brand&&k!=='generic');
   card(`Quelle gamme de ${det.brand} ?`,'Le nom de la gamme est souvent écrit sur l’étiquette ou sur les disjoncteurs (ex. QO, HomeLine, BR, CH).',
    choiceList([...fams.map(([k,f])=>[k,f.name,'',brandBadge(k,{size:'sm'})]),['','Je ne sais pas','Le dessin restera générique.']],det.family,v=>{det.family=v;det.model=v?FAMILIES[v].name.replace(/^.*?\s/,''):'';S.step='main';render();}),
    [back('brand')]);
  }else if(S.step==='main'){
   drawArt();
   const amps=[60,100,125,150,200,225,320,400];
   const other=h('input',{type:'number',min:15,max:1200,step:5,placeholder:'Autre',value:det.mainAmps&&!amps.includes(det.mainAmps)?det.mainAmps:''});
   card('Y a-t-il un gros disjoncteur en haut du panneau ?','C’est le disjoncteur principal : il coupe tout le panneau. Le chiffre inscrit dessus est le calibre de l’entrée (ex. 200).',
    [h('div',{class:'gd-chips'},...amps.map(a=>chip(a+' A',det.mainAmps===a,()=>{det.mainAmps=a;S.step='positions';render();})),other),
     h('div',{class:'gd-chips'},chip('Non, il n’y en a pas',det.mainAmps===null&&S.mainAnswered,()=>{det.mainAmps=null;S.mainAnswered=true;S.step='positions';render();}))],
    [back(det.family&&Object.values(FAMILIES).filter(f=>f.brand===det.brand).length>1?'family':'brand'),h('button',{type:'button',class:'primary',onclick:()=>{if(other.value){det.mainAmps=Number(other.value);}S.mainAnswered=true;S.step='positions';render();}},'Continuer →')]);
  }else if(S.step==='positions'){
   drawArt();
   const cur=S.st?.positions;
   const other=h('input',{type:'number',min:2,max:84,step:2,placeholder:'Autre',value:cur&&!POSITION_CHOICES.includes(cur)?cur:''});
   const pick=n=>{
    n=Math.max(2,Math.min(84,n+n%2));
    if(S.st&&S.st.positions!==n&&S.st.done.length){
     // Garde les réponses déjà données si elles tiennent dans le nouveau nombre de positions.
     let st=newGuided({positions:n});for(const p of [...S.st.done].sort((a,b)=>a-b)){const a=currentAnswer(S.st,p);if(a&&p<=n){try{st=answerPosition(st,p,a);}catch{}}}S.st=st;
    }else if(!S.st||S.st.positions!==n)S.st=newGuided({positions:n});
    S.pos=1;S.step='pos';render();
   };
   card('Combien de positions compte le panneau ?','Comptez les numéros imprimés de chaque côté des disjoncteurs (1, 3, 5… à gauche et 2, 4, 6… à droite), espaces vides compris. Le nombre est souvent aussi sur l’étiquette (ex. « 40 espaces »).',
    [h('div',{class:'gd-chips'},...POSITION_CHOICES.map(n=>chip(String(n),cur===n,()=>pick(n))),other),
     h('p',{class:'small muted',text:'Astuce : comptez les rangées dans la colonne de gauche et multipliez par 2.'})],
    [back('main'),h('button',{type:'button',class:'primary',onclick:()=>{const n=Number(other.value);if(!n)return toast('Choisissez ou saisissez un nombre de positions.');pick(n);}},'Continuer →')]);
  }else if(S.step==='pos'){
   positionQuiz(qBox,{getState:()=>S.st,setState:st=>{S.st=st;persist();},start:S.pos,art:n=>{S.pos=n;persist();drawArt(n);},
    onBack:()=>{S.step='positions';render();},onFinish:()=>{S.step='appliances';render();},finishLabel:'Valider et passer à la vérification →'});
  }else if(S.step==='appliances'){
   drawArt();
   const owned=new Set(S.owned);
   card('Vérification : quels appareils avez-vous ?','Cochez ceux qui existent chez vous. L’application vérifie que chacun a bien son disjoncteur, pour que rien ne soit oublié.',
    h('div',{class:'gd-checks'},APPLIANCES.map(a=>h('label',{class:'gd-check'},h('input',{type:'checkbox',checked:owned.has(a.id),onchange:e=>{e.target.checked?owned.add(a.id):owned.delete(a.id);S.owned=[...owned];persist();}}),h('span',{text:a.label})))),
    [h('button',{type:'button',class:'ghost',onclick:()=>{S.step='pos';S.pos=prevPosition(S.st,S.st.positions+1)||1;render();}},'← Revenir aux positions'),
     h('button',{type:'button',class:'primary',onclick:()=>{S.fixes=checkAppliances(S.st,S.owned).filter(f=>f.type==='missing').map(f=>f.appliance.id);S.step=S.fixes.length?'fix':'review';render();}},'Vérifier →')]);
  }else if(S.step==='fix'){
   const ap=APPLIANCES.find(a=>a.id===S.fixes[0]);
   if(!ap){S.step='review';return render();}
   drawArt();
   const cands=sortCircuits(S.st.circuits).filter(c=>!c.vacant);
   const pick=id=>{if(id)S.st=assignAppliance(S.st,id,ap);S.fixes=S.fixes.slice(1);S.step=S.fixes.length?'fix':'review';render();};
   card(`Quel disjoncteur alimente : ${ap.label.toLowerCase()} ?`,`Aucun disjoncteur ne porte ce nom pour l’instant.${ap.volts===240?' C’est normalement un disjoncteur double (deux manettes reliées).':''}${ap.typical?` Calibre habituel : ${ap.typical} A.`:''}`,
    h('div',{class:'gd-pick'},[...cands.map(c=>{const dbl=new Set(c.slots.map(slotPos)).size>1;return h('button',{type:'button',class:'gd-pick-item'+(ap.volts===240&&dbl?' likely':''),onclick:()=>pick(c.id)},h('b',{text:designation(c)}),h('span',{text:`${c.amps?c.amps+' A':'? A'}${dbl?' · double':''}`}),h('span',{class:'muted',text:c.label||'sans désignation'}));}),
     h('button',{type:'button',class:'gd-pick-item none',onclick:()=>pick(null)},h('b',{text:'Je ne sais pas'}),h('span',{class:'muted',text:'On passe : à vérifier plus tard.'}))]),
    [h('button',{type:'button',class:'ghost',onclick:()=>{S.step='appliances';render();}},'← Retour')]);
  }else if(S.step==='review'){
   drawArt();
   const warn=checkAppliances(S.st,S.owned);
   const counts={total:S.st.circuits.filter(c=>!c.vacant&&(c.label||c.amps)).length,unknown:S.st.circuits.filter(c=>!c.vacant&&!c.label).length,empty:S.st.circuits.filter(c=>c.vacant).length};
   const name=h('input',{value:S.meta.name,maxlength:100,required:true}),tag=h('input',{value:S.meta.tag,maxlength:24,placeholder:'Ex. P-1'}),location=h('input',{value:S.meta.location,maxlength:140,placeholder:'Ex. Sous-sol, salle mécanique'});
   const err=h('p',{class:'error',role:'alert'});
   const create=h('button',{type:'button',class:'primary lg',onclick:async()=>{
    if(!name.value.trim())return name.focus();
    create.disabled=true;err.textContent='';
    try{
     const {panel}=await api('/api/panels',{method:'POST',body:{siteId:site.id,name:name.value.trim(),tag:tag.value.trim(),kind:S.meta.kind,location:location.value.trim(),details:{...det,notes:'Panneau construit avec le mode guidé.'},positions:S.st.positions,circuits:S.st.circuits}});
     save(site.id,null);d.close();toast('Panneau créé. Les circuits sans désignation sont « À confirmer ».',6000);onCreated?.(panel);
    }catch(x){err.textContent=x.message;create.disabled=false;}
   }},'Oui, c’est mon panneau — le créer');
   card('Le dessin correspond-il à votre panneau ?','Comparez une dernière fois avec le panneau réel. Touchez un disjoncteur du dessin pour corriger sa réponse.',
    [h('ul',{class:'gd-summary'},h('li',{text:`${counts.total} disjoncteur(s) décrit(s)`}),h('li',{text:`${counts.unknown} sans désignation (resteront « À confirmer »)`}),h('li',{text:`${counts.empty} espace(s) vide(s)`})),
     warn.length?h('div',{class:'notice'},h('b',{text:'À vérifier : '}),h('ul',{},warn.map(w=>h('li',{},w.text,w.circuit?h('button',{type:'button',class:'ghost sm',onclick:()=>{const c=S.st.circuits.find(x=>x.id===w.circuit);S.step='pos';S.pos=slotPos(c.slots[0]);render();}},'Revoir'):null)))):null,
     h('div',{class:'fields'},field('Nom du panneau',name),field('Étiquette',tag),field('Emplacement',location,{full:true})),err],
    [h('button',{type:'button',class:'ghost',onclick:()=>{S.step='appliances';render();}},'← Vérification'),create]);
   for(const [el,k] of [[name,'name'],[tag,'tag'],[location,'location']])el.addEventListener('input',()=>{S.meta[k]=el.value;persist();});
  }
 }

 // Reprise d'un brouillon.
 const draft=load(site.id);
 if(draft?.st&&draft.st.done?.length){
  drawArt();
  card('Reprendre là où vous étiez ?',`Un panneau commencé avec le mode guidé a été trouvé (${draft.st.done.length} position(s) décrite(s) sur ${draft.st.positions}).`,[],
   [h('button',{type:'button',class:'ghost',onclick:()=>{save(site.id,null);render();}},'Recommencer à zéro'),h('button',{type:'button',class:'primary',onclick:()=>{S=draft;render();}},'Reprendre')]);
 }else render();
}
