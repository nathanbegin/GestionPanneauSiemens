// Mode interactif d'attribution des modèles de disjoncteurs à un panneau existant.
// Un à un (assistant) ou par groupe de disjoncteurs identiques (format, calibres, protection).
import {h,dialog,toast} from './dom.js';
import {breakerUnits,matchBreakers,applyModel,clearModel} from '../units.js';
import {familyOf} from '../catalog.js';
import {brandBadge} from './panelart.js';
import {subpanelLink} from './feeds.js';

export function miniBreaker(fam,unit){
 const f=familyOf(fam);
 const chip=h('span',{class:'mini-breaker'+(unit.kind==='tandem'||unit.kind==='quad'?' split':'')+(['double','triple','quad'].includes(unit.kind)?' tall':'')});
 chip.style.setProperty('--body',f.body);chip.style.setProperty('--handle',f.handle);chip.style.setProperty('--ink',f.ink);
 chip.append(h('i',{text:unit.amps.map(a=>a??'?').join('/')}));
 return chip;
}
const kindLabel={single:'Unipolaire',double:'Bipolaire',triple:'Tripolaire',tandem:'Jumelé',quad:'Quad',other:'Format particulier'};

/**
 * opts : {getPanel() → panel courant, lib, siblings, save(circuits) → Promise<panel>, createSubpanel, onClose}
 */
export function assignDialog({getPanel,lib,siblings,save,createSubpanel,onClose}){
 const state={mode:'one',all:false,index:0,group:null,selected:new Set(),showOther:false};
 const body=h('div',{class:'assign'});
 const det=()=>getPanel().details||{};
 const units=()=>breakerUnits(getPanel().circuits);
 let busy=false;

 async function assign(targets,breaker){
  if(busy)return false;busy=true;
  try{
   let circuits=getPanel().circuits;
   for(const u of targets)circuits=applyModel(circuits,u,breaker);
   await save(circuits);
   toast(targets.length>1?`${breaker.cat} attribué à ${targets.length} disjoncteurs.`:`${breaker.cat} attribué (${targets[0].designation}).`);
   return true;
  }catch(e){toast(e.message,7000);return false;}
  finally{busy=false;}
 }
 const progress=()=>{const u=units().filter(x=>x.kind!=='other');const done=u.filter(x=>x.ref).length;return {done,total:u.length};};

 function suggestionList(unit,onPick){
  const {exact,other}=matchBreakers(unit,lib.breakers,det());
  const item=b=>h('button',{type:'button',class:'palette-item'+(unit.ref===b.cat?' on':''),onclick:()=>onPick(b)},
   miniBreaker(b.family,unit),h('span',{class:'pi-text'},h('b',{text:b.cat}),h('span',{text:`${b.label} · ${b.protection==='Standard'?b.type:b.protection}${b.neutre&&b.neutre!=='—'?' · '+b.neutre:''} · ${b.kA} kA${b.smart?' · intelligent':''}`}),b.note?h('span',{class:'pi-warn info',text:b.note}):null));
  if(unit.kind==='other')return h('p',{class:'issue warn',text:'Format particulier (demi-emplacement isolé ou combinaison inhabituelle) : ajustez le format dans la fiche du circuit.'});
  if(unit.amps.some(a=>a==null))return h('p',{class:'issue warn',text:'Calibre à préciser dans la fiche du circuit avant d’attribuer un modèle.'});
  if(!exact.length&&!other.length)return h('p',{class:'issue warn',text:`Aucun modèle ${familyOf(det().family).name} de ce format et de ce calibre dans la bibliothèque.`});
  return h('div',{class:'stack'},
   exact.length?h('div',{class:'palette-list'},exact.map(item)):h('p',{class:'small muted',text:`Aucun modèle avec la protection « ${unit.protection} » : voir les autres protections.`}),
   other.length?h('details',{open:!exact.length||state.showOther,ontoggle:e=>{state.showOther=e.target.open;}},h('summary',{class:'small',text:`Autres protections (${other.length})`}),h('div',{class:'palette-list mt'},other.map(item))):null);
 }

 // ---------- Un à un ----------
 function drawOne(){
  const list=units().filter(u=>state.all||!u.ref);
  if(!list.length){body.replaceChildren(h('div',{class:'empty-state'},h('div',{class:'ico',text:'✅'}),h('h2',{text:'Tous les disjoncteurs ont un modèle'}),h('p',{text:'Cochez « Inclure ceux qui ont déjà un modèle » pour les revoir.'})));return;}
  state.index=Math.min(state.index,list.length-1);
  const unit=list[state.index];
  const panel=getPanel();
  const feedCircuit=unit.ids.map(id=>panel.circuits.find(c=>c.id===id)).find(c=>c?.usage==='Sous-panneau');
  const next=()=>{state.index=Math.min(state.index+(state.all?1:0),Math.max(0,units().filter(u=>state.all||!u.ref).length-1));draw();};
  body.replaceChildren(...[
   h('div',{class:'assign-unit card'},
    miniBreaker(det().family,unit),
    h('div',{class:'pi-text'},h('b',{text:`Position ${unit.designation} · ${unit.label}${unit.protection!=='Standard'?' · '+unit.protection:''}`}),
     h('span',{text:unit.labels.join(' · ')||'Sans description'}),
     h('span',{class:'small',text:unit.ref?`Modèle actuel : ${unit.ref}`:'Aucun modèle attribué'})),
    h('span',{class:'badge',text:`${state.index+1} / ${list.length}`})),
   feedCircuit&&h('div',{class:'card side-card'},h('h3',{text:'Alimentation de sous-panneau'}),subpanelLink({panel,circuit:feedCircuit,siblings,createSubpanel,onChange:()=>{}})),
   h('h3',{class:'mt',text:'Choisissez le modèle installé'}),
   suggestionList(unit,async b=>{if(await assign([unit],b))next();}),
   h('div',{class:'form-actions'},
    h('button',{type:'button',class:'ghost',disabled:state.index===0,onclick:()=>{state.index--;draw();}},'‹ Précédent'),
    unit.ref&&h('button',{type:'button',class:'ghost',onclick:async()=>{try{await save(clearModel(getPanel().circuits,unit));toast('Modèle retiré.');draw();}catch(e){toast(e.message);}}},'Retirer le modèle'),
    h('button',{type:'button',onclick:()=>{if(state.index<list.length-1){state.index++;draw();}else toast('Dernier disjoncteur de la liste.');}},'Passer ›'))].filter(Boolean));
 }

 // ---------- Par groupe ----------
 function drawGroups(){
  const all=units().filter(u=>u.kind!=='other');
  const groups=new Map();for(const u of all){if(!groups.has(u.signature))groups.set(u.signature,[]);groups.get(u.signature).push(u);}
  const rows=[...groups.entries()].sort((a,b)=>b[1].filter(u=>!u.ref).length-a[1].filter(u=>!u.ref).length||b[1].length-a[1].length);
  const odd=units().filter(u=>u.kind==='other');
  if(state.group&&!groups.has(state.group))state.group=null;
  const card=([sig,us])=>{
   const u0=us[0],open=state.group===sig,todo=us.filter(u=>!u.ref).length;
   const head=h('button',{type:'button',class:'group-head',onclick:()=>{state.group=open?null:sig;state.selected=new Set(us.filter(u=>!u.ref).map(u=>u.key));draw();}},
    miniBreaker(det().family,u0),h('span',{class:'pi-text'},h('b',{text:`${u0.label}${u0.protection!=='Standard'?' · '+u0.protection:''}`}),h('span',{text:`${us.length} disjoncteur(s) · ${todo?todo+' sans modèle':'tous attribués'}`})),h('span',{class:'badge '+(todo?'warn':'ok'),text:todo?todo:'✓'}));
   if(!open)return h('div',{class:'card group'},head);
   const checks=us.map(u=>h('label',{class:'check small'},h('input',{type:'checkbox',checked:state.selected.has(u.key),onchange:e=>{e.target.checked?state.selected.add(u.key):state.selected.delete(u.key);countEl.textContent=`${state.selected.size} sélectionné(s)`;}}),
    h('span',{},h('b',{text:u.designation}),` ${u.labels.join(' · ')||'—'}`,u.ref?h('em',{class:'muted',text:` · ${u.ref}`}):'')));
   const countEl=h('span',{class:'small muted',text:`${state.selected.size} sélectionné(s)`});
   return h('div',{class:'card group open'},head,
    h('div',{class:'group-body'},
     h('div',{class:'row-between'},h('div',{class:'page-actions'},
      h('button',{type:'button',class:'sm',onclick:()=>{state.selected=new Set(us.map(u=>u.key));draw();}},'Tout sélectionner'),
      h('button',{type:'button',class:'sm',onclick:()=>{state.selected=new Set(us.filter(u=>!u.ref).map(u=>u.key));draw();}},'Sans modèle seulement'),
      h('button',{type:'button',class:'sm ghost',onclick:()=>{state.selected=new Set();draw();}},'Aucun')),countEl),
     h('div',{class:'group-checks'},checks),
     h('h3',{class:'mt',text:'Modèle à attribuer aux disjoncteurs sélectionnés'}),
     suggestionList(u0,async b=>{const targets=us.filter(u=>state.selected.has(u.key));if(!targets.length)return toast('Sélectionnez au moins un disjoncteur.');if(await assign(targets,b)){state.selected=new Set();draw();}})));
  };
  body.replaceChildren(h('div',{class:'stack'},...rows.map(card),
   odd.length?h('p',{class:'small muted',text:`${odd.length} disjoncteur(s) au format particulier non regroupés (${odd.map(u=>u.designation).join(', ')}) : utilisez le mode un à un ou la fiche du circuit.`}):null));
 }

 const modeBar=h('div',{class:'row-between'});
 const progressEl=h('div',{class:'progress-line'});
 function draw(){
  const {done,total}=progress();
  progressEl.replaceChildren(h('div',{class:'progress'},h('i',{style:{width:(total?Math.round(done/total*100):0)+'%'}})),h('span',{text:`${done} / ${total} disjoncteurs avec un modèle`}));
  modeBar.replaceChildren(
   h('div',{class:'tabs',role:'tablist'},
    h('button',{type:'button',role:'tab','aria-selected':String(state.mode==='one'),onclick:()=>{state.mode='one';draw();}},'Un à un'),
    h('button',{type:'button',role:'tab','aria-selected':String(state.mode==='group'),onclick:()=>{state.mode='group';draw();}},'Par groupe identique')),
   state.mode==='one'?h('label',{class:'check small'},h('input',{type:'checkbox',checked:state.all,onchange:e=>{state.all=e.target.checked;state.index=0;draw();}}),'Inclure ceux qui ont déjà un modèle'):h('span',{}));
  if(!det().family){body.replaceChildren(h('p',{class:'issue warn',text:'Choisissez d’abord le modèle du panneau (fiche du panneau) pour proposer les disjoncteurs compatibles.'}));return;}
  state.mode==='one'?drawOne():drawGroups();
 }
 const d=dialog({title:'Attribuer les modèles de disjoncteurs',eyebrow:`${getPanel().tag?getPanel().tag+' · ':''}${getPanel().name}`,wide:true,
  body:[h('div',{class:'row-between'},brandBadge(det().family,{size:'sm'}),progressEl),modeBar,body],actions:[{label:'Terminé',kind:'primary'}],onClose});
 d.el.classList.add('picker');
 draw();
}
