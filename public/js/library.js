// Bibliothèque de produits (abonnés) : chargement, sélecteur visuel de modèle, palette de disjoncteurs.
import {h,dialog,toast} from './dom.js';
import {api} from './api.js';
import {familyOf,FAMILIES} from '../catalog.js';
import {brandBadge,panelArt} from './panelart.js';
import {blank,formatOf} from '../model.js';

let cached=null;
export async function loadLibrary(){
 if(cached)return cached;
 const lib=await api('/api/panels?catalog=1');
 lib.byCat=new Map(lib.breakers.map(b=>[b.cat,b]));
 lib.familyInfo=Object.fromEntries(lib.families.map(f=>[f.id,f]));
 cached=lib;return lib;
}
export const sourceTitle=(lib,id)=>lib.sources?.[id]?.t||id||'';
export const sourceUrl=(lib,id)=>lib.sources?.[id]?.u||'';

// Compatibilité d'un disjoncteur avec le panneau (famille, neutre enfichable, jumelés).
export function compatibility(b,det){
 const issues=[];
 const ok=det.accepts?.length?det.accepts:det.family?[det.family]:null;
 if(ok&&!ok.includes(b.family))issues.push({level:'error',text:`Famille ${b.family} : incompatible avec ce panneau (accepte ${ok.join(', ')}).`});
 if(b.neutre==='PoN'&&det.pon===false)issues.push({level:'error',text:'Disjoncteur à neutre enfichable (PoN) : ce panneau n’a pas de barre PoN.'});
 if(b.neutre==='PoN'&&det.pon==null)issues.push({level:'warn',text:'Neutre enfichable (PoN) : vérifiez que le panneau possède une barre PoN.'});
 if((b.kind==='tandem'||b.kind==='quad')&&det.tandem===false)issues.push({level:'error',text:'Ce panneau n’accepte pas de disjoncteurs jumelés ou quad (circuits = espaces).'});
 if(!b.kind)issues.push({level:'info',text:b.why||'Non plaçable dans le constructeur.'});
 return issues;
}
// Positions de départ valides pour un disjoncteur (espaces libres consécutifs dans la même colonne).
export function validStarts(panel,b,isFree){
 const span={single:1,double:2,triple:3,tandem:1,quad:2}[b.kind]||0;
 const out=new Set();if(!span)return out;
 const freeSlots=new Set(panel.circuits.filter(isFree).flatMap(c=>c.slots));
 for(let p=1;p<=panel.positions;p++){
  let ok=true;
  for(let k=0;k<span;k++){const n=p+k*2;if(n>panel.positions||!freeSlots.has(n+'A')||!freeSlots.has(n+'B')){ok=false;break;}}
  if(ok)out.add(p);
 }
 return out;
}

// ---------- Suggestion de modèles selon le nombre de circuits ----------
/** Espaces nécessaires pour `circuits` disjoncteurs dont `bipolar` bipolaires (2 espaces chacun), avec ou sans jumelés. */
export const spacesNeeded=(circuits,bipolar,tandem)=>tandem?2*bipolar+Math.ceil((circuits-bipolar)/2):circuits+bipolar;
/** Le panneau `p` loge-t-il ces circuits ? Les jumelés ne sont possibles que si le modèle en accepte (circuits max > espaces). */
export function fits(p,circuits,bipolar){
 if(circuits>0&&bipolar>circuits)bipolar=circuits;
 const tandemOk=p.circuits!=null&&p.circuits>p.espaces;
 const plain=p.espaces>=spacesNeeded(circuits,bipolar,false);
 if(plain)return {ok:true,tandem:false,spare:p.espaces-spacesNeeded(circuits,bipolar,false)};
 if(tandemOk&&p.circuits>=circuits&&p.espaces>=spacesNeeded(circuits,bipolar,true))return {ok:true,tandem:true,spare:p.espaces-spacesNeeded(circuits,bipolar,true)};
 return {ok:false};
}
/**
 * Modèles suggérés. opts : {circuits, bipolar=0, margin=0.2, family='', mainAmps=null, limit=6}.
 * Avec une marque : les meilleurs de cette marque ; sans marque : les deux meilleurs de chaque marque.
 * Retourne [{p, tier:'marge'|'juste', tandem, spare, spareCircuits}] du plus ajusté au plus grand, avec marge d'abord.
 */
export function suggestModels(panels,{circuits,bipolar=0,margin=0.2,family='',mainAmps=null,limit=6}={}){
 if(!Number.isInteger(circuits)||circuits<1)return [];
 bipolar=Math.max(0,Math.min(bipolar||0,circuits));
 const cm=Math.ceil(circuits*(1+margin)),bm=Math.min(cm,Math.ceil(bipolar*(1+margin)));
 // Principal demandé : même calibre (ou cosses avec barres suffisantes) ; sinon on écarte les petits principaux (< 100 A) des sous-panneaux.
 const mainOk=p=>mainAmps?(p.main===mainAmps||(p.main==null&&(p.bus||0)>=mainAmps)):(p.main==null||p.main>=100);
 const pool=panels.filter(p=>p.designable&&mainOk(p)&&(!family||p.family===family)&&p.statut!=='Génération précédente'&&p.statut!=='À vérifier');
 const out=[];
 for(const p of pool){
  const wide=fits(p,cm,bm);
  const tight=wide.ok?wide:fits(p,circuits,bipolar);
  if(!tight.ok)continue;
  out.push({p,tier:wide.ok?'marge':'juste',tandem:tight.tandem,spare:tight.spare,spareCircuits:(p.circuits??p.espaces)-circuits});
 }
 out.sort((a,b)=>(a.tier==='marge'?0:1)-(b.tier==='marge'?0:1)||a.p.espaces-b.p.espaces||(a.p.main||0)-(b.p.main||0)||a.p.cat.localeCompare(b.p.cat));
 if(family)return out.slice(0,limit);
 const per=new Map(),res=[];
 for(const s of out){const n=per.get(s.p.family)||0;if(n<2){per.set(s.p.family,n+1);res.push(s);}}
 return res.slice(0,Math.max(limit,8));
}

// ---------- Sélecteur visuel de modèle ----------
export async function modelPicker({current,onPick}){
 let lib;
 try{lib=await loadLibrary();}catch(e){toast(e.message,7000);return;}
 const state={family:current?.family||'',type:'',q:'',bus:'',showOld:false,showInfo:false,circuits:current?.circuits||'',bipolar:current?.bipolar||0,margin:0.2,main:Number(current?.mainAmps)||0};
 const grid=h('div',{class:'model-grid'});
 const count=h('span',{class:'small muted'});
 const fams=lib.families.map(f=>f.id);
 const chips=h('div',{class:'brand-chips'});
 const drawChips=()=>chips.replaceChildren(h('button',{type:'button',class:'chip'+(state.family?'':' on'),onclick:()=>{state.family='';drawChips();draw();}},'Toutes'),
  ...fams.map(id=>{const b=h('button',{type:'button',class:'chip'+(state.family===id?' on':''),onclick:()=>{state.family=id;drawChips();draw();}},brandBadge(id,{size:'xs'}),h('span',{text:lib.familyInfo[id]?.gamme?.split(' (')[0]||id}));return b;}));
 const types=[...new Set(lib.panels.map(p=>p.type))];
 const typeSel=h('select',{'aria-label':'Type de panneau',onchange:e=>{state.type=e.target.value;draw();}},new Option('Tous les types',''),...types.map(t=>new Option(t,t)));
 const busSel=h('select',{'aria-label':'Ampérage',onchange:e=>{state.bus=e.target.value;draw();}},new Option('Tous les ampérages',''),...[...new Set(lib.panels.filter(p=>p.designable).map(p=>p.main||p.bus))].filter(Boolean).sort((a,b)=>a-b).map(a=>new Option(a+' A',a)));
 const search=h('input',{type:'search',placeholder:'Numéro de catalogue (ex. CQO140M200PC)…',oninput:e=>{state.q=e.target.value.trim().toUpperCase();draw();}});
 const old=h('div',{class:'page-actions'},h('label',{class:'check small'},h('input',{type:'checkbox',onchange:e=>{state.showOld=e.target.checked;draw();}}),'Inclure les générations précédentes'),
  h('label',{class:'check small'},h('input',{type:'checkbox',onchange:e=>{state.showInfo=e.target.checked;draw();}}),'Afficher aussi les produits sans espaces (inverseurs maison entière, boîtiers, trousses)'));
 let d;
 function card(p){
  const fam=familyOf(p.family),info=lib.familyInfo[p.family];
  if(!p.designable){
   return h('div',{class:'model-card info'},h('div',{class:'model-thumb noart'},brandBadge(p.family,{size:'sm'}),h('span',{class:'small',text:'Aucun espace de dérivation'})),
    h('div',{class:'model-info'},h('div',{class:'row'},brandBadge(p.family,{size:'xs'}),h('span',{class:'badge',text:'Information'})),h('b',{text:p.cat}),h('span',{class:'small',text:`${info?.gamme||fam.name} · ${p.type}`}),
     h('span',{class:'specs'},p.bus&&h('span',{text:`${p.bus} A`}),p.main&&h('span',{text:`Principal ${p.main} A`}),p.enveloppe&&h('span',{text:p.enveloppe})),p.note&&h('span',{class:'small muted',text:p.note})));
  }
  // Miniature : dessin réel du panneau vide.
  const thumb=panelArt({panel:{name:p.cat,kind:p.main?'Principal':'Sous-panneau',positions:p.espaces,details:{family:p.family,mainAmps:p.main,modelId:p.cat,maxCircuits:p.circuits,modelInfo:p.type},circuits:blank(p.espaces)},showLabels:false});
  thumb.classList.add('thumb');
  return h('button',{type:'button',class:'model-card'+(current?.modelId===p.cat?' current':''),onclick:()=>{d.close();onPick(p,lib);}},
   h('div',{class:'model-thumb'},thumb),
   h('div',{class:'model-info'},
    h('div',{class:'row'},brandBadge(p.family,{size:'xs'}),p.statut!=='Catalogue'&&h('span',{class:'badge warn',text:p.statut})),
    h('b',{text:p.cat}),
    h('span',{class:'small',text:`${info?.gamme||fam.name} · ${p.type}`}),
    h('span',{class:'specs'},h('span',{text:p.main?`Principal ${p.main} A`:'Cosses (sans principal)'}),h('span',{text:`Barres ${p.bus??'—'} A`}),h('span',{text:`${p.espaces} esp. / ${p.circuits??'—'} circ.`}),h('span',{text:p.enveloppe||''}),p.pon&&h('span',{text:'Neutre enfichable'})),
    p.note&&h('span',{class:'small muted',text:p.note})));
 }
 function draw(){
  drawSug();
  const list=lib.panels.filter(p=>(p.designable||state.showInfo)&&(!state.family||p.family===state.family)&&(!state.type||p.type===state.type)&&(!state.bus||String(p.main||p.bus)===state.bus)&&(!state.q||p.cat.includes(state.q))&&(state.showOld||p.statut!=='Génération précédente'))
   .sort((a,b)=>(b.designable-a.designable)||(a.family+a.cat).localeCompare(b.family+b.cat));
  count.textContent=`${list.length} modèle(s)`;
  grid.replaceChildren(...list.slice(0,60).map(card));
  if(list.length>60)grid.append(h('p',{class:'small muted',text:`… ${list.length-60} autres : précisez la recherche.`}));
  if(!list.length)grid.append(h('p',{class:'muted',text:'Aucun modèle ne correspond.'}));
 }
 // Suggestions selon le nombre de circuits et la marque choisie.
 const sugGrid=h('div',{class:'model-grid'}),sugNote=h('p',{class:'small muted'});
 const circIn=h('input',{type:'number',min:1,max:200,step:1,value:state.circuits,placeholder:'Ex. 28',oninput:e=>{state.circuits=Number(e.target.value)||'';drawSug();}});
 const bipIn=h('input',{type:'number',min:0,max:100,step:1,value:state.bipolar,oninput:e=>{state.bipolar=Number(e.target.value)||0;drawSug();}});
 const mainSel=h('select',{'aria-label':'Disjoncteur principal',onchange:e=>{state.main=Number(e.target.value)||0;drawSug();}},new Option('Principal : tous',''),...[100,125,150,200,225,400].map(a=>{const o=new Option(a+' A',a);o.selected=a===state.main;return o;}));
 const marSel=h('select',{'aria-label':'Marge d’expansion',onchange:e=>{state.margin=Number(e.target.value);drawSug();}},...[[0,'Aucune marge'],[0.2,'Marge de 20 %'],[0.3,'Marge de 30 %']].map(([v,t])=>{const o=new Option(t,v);o.selected=v===state.margin;return o;}));
 function drawSug(){
  const list=suggestModels(lib.panels,{circuits:Number(state.circuits),bipolar:state.bipolar,margin:state.margin,family:state.family,mainAmps:state.main||null});
  if(!Number(state.circuits)){sugNote.textContent='Entrez le nombre de circuits pour obtenir des modèles adaptés.';sugGrid.replaceChildren();return;}
  sugNote.textContent=list.length?`${list.length} modèle(s) adapté(s) à ${state.circuits} circuit(s)${state.bipolar?` dont ${state.bipolar} bipolaire(s)`:''}${state.family?` · ${lib.familyInfo[state.family]?.gamme?.split(' (')[0]||state.family}`:' · deux meilleurs par marque (choisissez une marque pour en voir plus)'} :`:'Aucun modèle du catalogue ne loge autant de circuits pour cette marque : choisissez une autre marque ou répartissez sur un sous-panneau.';
  sugGrid.replaceChildren(...list.map(s=>{
   const c=card(s.p);
   const why=h('span',{class:'small '+(s.tier==='marge'?'ok':'muted'),text:[s.tier==='marge'?`✔ Marge de ${Math.round(state.margin*100)} % respectée`:'Juste suffisant (sans marge)',s.tandem?'jumelés requis':'sans jumelés',s.spare>0?`${s.spare} espace(s) libre(s)`:'aucun espace libre'].join(' · ')});
   (c.querySelector('.model-info')||c).append(why);return c;}));
 }
 const suggest=h('details',{class:'suggest',open:true},h('summary',{text:'💡 Suggérer des modèles selon mes circuits'}),
  h('div',{class:'fields'},h('label',{class:'f'},h('span',{text:'Nombre de circuits'}),circIn),h('label',{class:'f'},h('span',{text:'Dont bipolaires (240 V)'}),bipIn),h('label',{class:'f'},h('span',{text:'Principal'}),mainSel),h('label',{class:'f'},h('span',{text:'Marge'}),marSel)),sugNote,sugGrid);
 drawChips();
 d=dialog({title:'Bibliothèque de panneaux',eyebrow:`${lib.panels.filter(p=>p.designable).length} modèles · catalogues canadiens des fabricants`,wide:true,
  body:[chips,suggest,h('div',{class:'toolbar-row mt'},h('label',{class:'search'},h('span',{'aria-hidden':'true',text:'⌕'}),search),typeSel,busSel),h('div',{class:'row-between'},old,count),grid,
   h('p',{class:'small muted mt',text:'Données tirées des catalogues des fabricants (voir les sources dans la fiche de chaque produit). Vérifiez toujours l’étiquette du panneau installé.'})],
  actions:[{label:'Fermer',kind:'ghost'}]});
 d.el.classList.add('picker');
 draw();
}

// ---------- Palette de disjoncteurs ----------
const KIND_LABEL={single:'Unipolaires',double:'Bipolaires',triple:'Tripolaires',tandem:'Jumelés',quad:'Quads'};
export function breakerPalette({lib,det,selected,onSelect}){
 const fam=det.family;
 const okFam=det.accepts?.length?det.accepts:fam?[fam]:null;
 const all=lib.breakers.filter(b=>!okFam||okFam.includes(b.family));
 const state={kind:'',prot:'',amps:'',q:''};
 const list=h('div',{class:'palette-list'});
 const prots=[...new Set(all.map(b=>b.protection))];
 const kindSel=h('select',{'aria-label':'Format',onchange:e=>{state.kind=e.target.value;draw();}},new Option('Tous les formats',''),...Object.entries(KIND_LABEL).filter(([k])=>all.some(b=>b.kind===k)).map(([k,t])=>new Option(t,k)),new Option('Non plaçables','none'));
 const protSel=h('select',{'aria-label':'Protection',onchange:e=>{state.prot=e.target.value;draw();}},new Option('Toutes les protections',''),...prots.map(p=>new Option(p,p)));
 const ampsSel=h('select',{'aria-label':'Calibre',onchange:e=>{state.amps=e.target.value;draw();}},new Option('Tous calibres',''),...[...new Set(all.flatMap(b=>b.amps))].sort((a,b)=>a-b).map(a=>new Option(a+' A',a)));
 const search=h('input',{type:'search',placeholder:'Numéro (ex. QO120CP)…',oninput:e=>{state.q=e.target.value.trim().toUpperCase();draw();}});
 function item(b){
  const issues=compatibility(b,det);
  const blocked=!b.kind||issues.some(i=>i.level==='error');
  const f=familyOf(b.family);
  const chip=h('span',{class:'mini-breaker'});chip.style.setProperty('--body',f.body);chip.style.setProperty('--handle',f.handle);chip.style.setProperty('--ink',f.ink);
  chip.append(h('i',{text:b.amps.join('/')||'—'}));
  if(b.protection!=='Standard')chip.append(h('em',{class:'p-'+(b.protection==='Anti-arc'?'af':b.protection==='DDFT'?'gf':b.protection==='DDFT + anti-arc'?'df':'ep')}));
  if(b.kind==='tandem'||b.kind==='quad')chip.classList.add('split');
  if(b.kind==='double'||b.kind==='triple'||b.kind==='quad')chip.classList.add('tall');
  return h('button',{type:'button',class:'palette-item'+(selected===b.cat?' on':'')+(blocked?' blocked':''),title:issues.map(i=>i.text).join(' ')||b.note,onclick:()=>onSelect(blocked?null:b,issues)},
   chip,h('span',{class:'pi-text'},h('b',{text:b.cat}),h('span',{text:`${b.label} · ${b.protection==='Standard'?b.type:b.protection}${b.neutre&&b.neutre!=='—'?' · '+b.neutre:''} · ${b.kA} kA`}),issues.length?h('span',{class:'pi-warn '+issues[0].level,text:issues[0].text}):null));
 }
 function draw(){
  const items=all.filter(b=>(!state.kind||(state.kind==='none'?!b.kind:b.kind===state.kind))&&(!state.prot||b.protection===state.prot)&&(!state.amps||b.amps.includes(Number(state.amps)))&&(!state.q||b.cat.includes(state.q)));
  list.replaceChildren(...items.slice(0,80).map(item));
  if(items.length>80)list.append(h('p',{class:'small muted',text:`… ${items.length-80} autres : filtrez par format, protection ou calibre.`}));
  if(!items.length)list.append(h('p',{class:'small muted',text:'Aucun disjoncteur.'}));
 }
 draw();
 return h('div',{class:'card side-card palette'},
  h('div',{class:'row-between'},h('h3',{text:'Bibliothèque de disjoncteurs'}),brandBadge(fam,{size:'xs'})),
  h('p',{class:'small muted',text:fam?`${all.length} produits ${(okFam||[fam]).map(f=>familyOf(f).name).join(', ')}. Choisissez un disjoncteur, puis touchez une position en surbrillance sur le panneau.`:'Choisissez d’abord un modèle de panneau pour filtrer les disjoncteurs compatibles.'}),
  h('label',{class:'search'},h('span',{'aria-hidden':'true',text:'⌕'}),search),
  h('div',{class:'palette-filters'},kindSel,protSel,ampsSel),list);
}
export const familyName=id=>FAMILIES[id]?.name||id;
