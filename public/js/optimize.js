// « Optimiser la disposition » (étape Conception) : crée un NOUVEAU scénario (copie du panneau) ; le panneau d'origine reste intact.
import {h,toast,dialog,field} from './dom.js';
import {api} from './api.js';
import {optimizeLayout} from '../optimize.js';
import {panelTitle} from '../model.js';

const row=(label,a,b,fmt=v=>String(v))=>h('tr',{},h('th',{text:label}),h('td',{text:fmt(a)}),h('td',{text:fmt(b)}),h('td',{class:b<a?'good':b>a?'bad':'',text:b===a?'=':(b>a?'+':'−')+Math.abs(b-a)}));

export function optimizeDialog({panel,site,metaWith}){
 const opts={pair:true,sort:'',reserve:0};
 const result=h('div',{class:'opt-result',role:'status','aria-live':'polite'});
 const explain=h('div',{class:'opt-explain'});
 let current=null,busy=false;
 const compute=()=>{
  explain.replaceChildren();
  const r=optimizeLayout(panel,opts);current=r;
  if(r.error){result.replaceChildren(h('p',{class:'notice warn',text:r.error}));create.disabled=true;ask.disabled=true;return;}
  create.disabled=false;ask.disabled=false;
  const t=h('table',{class:'data opt-table'},h('thead',{},h('tr',{},['','Scénario de base','Scénario optimisé','Écart'].map(x=>h('th',{text:x})))),
   h('tbody',{},row('Espaces occupés',r.before.used,r.after.used),row('Espaces libres',r.before.free,r.after.free),row('Espaces réservés',r.before.reserved,r.after.reserved),row('Circuits en demi-espace (jumelés)',r.before.halves,r.after.halves)));
  result.replaceChildren(
   h('p',{class:'opt-reco',text:r.summary}),t,
   ...r.notes.map(n=>h('p',{class:'small muted',text:'ℹ '+n})),
   r.moves.length?h('details',{},h('summary',{text:`Voir les ${r.moves.length} déplacement(s)`}),h('ul',{class:'small opt-moves'},...r.moves.slice(0,60).map(m=>h('li',{text:`${m.label}${m.amps.length?' ('+m.amps.filter(a=>a!=null).join('/')+' A)':''} : ${m.from} → ${m.to}`})))):'');
 };
 const toggle=(label,key,hint)=>h('label',{class:'opt-opt'},h('input',{type:'checkbox',checked:!!opts[key],onchange:e=>{opts[key]=e.target.checked;compute();}}),h('span',{},h('b',{text:label}),h('small',{class:'muted',text:hint})));
 const sortSel=h('select',{onchange:e=>{opts.sort=e.target.value;compute();}},h('option',{value:'',text:'Ordre actuel'}),h('option',{value:'asc',text:'Du plus petit au plus grand ampérage'}),h('option',{value:'desc',text:'Du plus grand au plus petit ampérage'}));
 const reserveIn=h('input',{type:'number',min:0,max:panel.positions,value:0,oninput:e=>{opts.reserve=Math.max(0,parseInt(e.target.value,10)||0);compute();}});
 const create=h('button',{type:'button',class:'primary',onclick:async()=>{
  if(!current||current.error||busy)return;busy=true;
  try{
   const meta=metaWith({stage:'conception',state:'Planifié'});meta.name=(panel.name+' — scénario optimisé').slice(0,100);
   const {details:{appliances,calcRecord,...det},...rest}=meta;
   const out=await api('/api/panels',{method:'POST',body:{siteId:site.id,...rest,details:det,positions:panel.positions,circuits:current.circuits}});
   d.close();toast('Scénario optimisé créé : le panneau d’origine est inchangé.');location.hash='#/panneaux/'+out.panel.id;
  }catch(e){toast(e.message,9000);}finally{busy=false;}
 }},'Créer le scénario optimisé');
 const ask=h('button',{type:'button',onclick:async()=>{
  if(!current||current.error)return;ask.disabled=true;explain.replaceChildren(h('p',{class:'muted',text:'Analyse en cours…'}));
  try{
   const compare={panelType:panel.kind,family:panel.details?.family||panel.details?.brand||'',tandemAccepted:panel.details?.tandem!==false,options:opts,before:current.before,after:current.after,tandemsCreated:current.tandems,notes:current.notes,
    moves:current.moves.slice(0,40).map(m=>({label:m.label,amps:m.amps,from:m.from,to:m.to}))};
   const {explanation:x}=await api('/api/panels?action=explain-layout',{method:'POST',body:{compare,lang:globalThis.MP_LANG||document.documentElement.lang||'fr'}});
   explain.replaceChildren(h('h4',{text:'Explication (IA)'}),h('p',{text:x.summary}),
    x.advantages.length?h('div',{},h('b',{text:'Avantages'}),h('ul',{},...x.advantages.map(a=>h('li',{text:a})))):'',
    x.cautions.length?h('div',{},h('b',{text:'Points d’attention'}),h('ul',{},...x.cautions.map(a=>h('li',{text:a})))):'',
    h('p',{class:'small muted',text:'Explication générée par IA à titre indicatif : le calcul ci-dessus fait foi. À faire valider par un maître électricien.'}));
  }catch(e){explain.replaceChildren(h('p',{class:'notice warn',text:e.message}));}finally{ask.disabled=false;}
 }},'✨ Expliquer avec l’IA');
 const d=dialog({title:'Optimiser la disposition',eyebrow:panelTitle(panel),wide:true,
  body:[h('p',{class:'muted',text:'Un nouveau scénario est créé à côté de celui-ci ; « '+panel.name+' » reste intact et vous pouvez comparer les deux.'}),
   toggle('Optimiser l’espace (jumeler)','pair','Deux disjoncteurs unipolaires de 20 A ou moins partagent un espace, si le panneau accepte les jumelés.'),
   field('Ordre des disjoncteurs',sortSel),
   field('Espaces réservés à l’expansion',reserveIn,{hint:'Les derniers espaces libres sont marqués « Réservé (expansion) ».'}),
   result,explain],
  actions:[{label:'Fermer',kind:'ghost'},{label:'✨ Expliquer avec l’IA',kind:'ghost',onClick:()=>{ask.click();return false;}},{label:'Créer le scénario optimisé',kind:'primary',onClick:()=>{create.click();return false;}}]});
 compute();
 return d;
}
