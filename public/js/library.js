// Bibliothèque de produits (abonnés) : chargement, sélecteur visuel de modèle, palette de disjoncteurs.
import {h,dialog,toast} from './dom.js';
import {api} from './api.js';
import {familyOf,FAMILIES} from '../catalog.js';
import {brandBadge,panelArt} from './panelart.js';
import {blank} from '../model.js';

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
 if(det.family&&b.family!==det.family)issues.push({level:'error',text:`Famille ${b.family} : incompatible avec un panneau ${det.family}.`});
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

// ---------- Sélecteur visuel de modèle ----------
export async function modelPicker({current,onPick}){
 let lib;
 try{lib=await loadLibrary();}catch(e){toast(e.message,7000);return;}
 const state={family:current?.family||'',type:'',q:'',bus:'',showOld:false};
 const grid=h('div',{class:'model-grid'});
 const count=h('span',{class:'small muted'});
 const fams=lib.families.map(f=>f.id);
 const chips=h('div',{class:'brand-chips'});
 const drawChips=()=>chips.replaceChildren(h('button',{type:'button',class:'chip'+(state.family?'':' on'),onclick:()=>{state.family='';drawChips();draw();}},'Toutes'),
  ...fams.map(id=>{const b=h('button',{type:'button',class:'chip'+(state.family===id?' on':''),onclick:()=>{state.family=id;drawChips();draw();}},brandBadge(id,{size:'xs'}),h('span',{text:lib.familyInfo[id]?.gamme?.split(' (')[0]||id}));return b;}));
 const types=[...new Set(lib.panels.filter(p=>p.designable).map(p=>p.type))];
 const typeSel=h('select',{'aria-label':'Type de panneau',onchange:e=>{state.type=e.target.value;draw();}},new Option('Tous les types',''),...types.map(t=>new Option(t,t)));
 const busSel=h('select',{'aria-label':'Ampérage',onchange:e=>{state.bus=e.target.value;draw();}},new Option('Tous les ampérages',''),...[...new Set(lib.panels.filter(p=>p.designable).map(p=>p.main||p.bus))].filter(Boolean).sort((a,b)=>a-b).map(a=>new Option(a+' A',a)));
 const search=h('input',{type:'search',placeholder:'Numéro de catalogue (ex. CQO140M200PC)…',oninput:e=>{state.q=e.target.value.trim().toUpperCase();draw();}});
 const old=h('label',{class:'check small'},h('input',{type:'checkbox',onchange:e=>{state.showOld=e.target.checked;draw();}}),'Inclure les générations précédentes');
 let d;
 function card(p){
  const fam=familyOf(p.family),info=lib.familyInfo[p.family];
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
  const list=lib.panels.filter(p=>p.designable&&(!state.family||p.family===state.family)&&(!state.type||p.type===state.type)&&(!state.bus||String(p.main||p.bus)===state.bus)&&(!state.q||p.cat.includes(state.q))&&(state.showOld||p.statut!=='Génération précédente'))
   .sort((a,b)=>(a.family+a.cat).localeCompare(b.family+b.cat));
  count.textContent=`${list.length} modèle(s)`;
  grid.replaceChildren(...list.slice(0,60).map(card));
  if(list.length>60)grid.append(h('p',{class:'small muted',text:`… ${list.length-60} autres : précisez la recherche.`}));
  if(!list.length)grid.append(h('p',{class:'muted',text:'Aucun modèle ne correspond.'}));
 }
 drawChips();
 d=dialog({title:'Bibliothèque de panneaux',eyebrow:`${lib.panels.filter(p=>p.designable).length} modèles · catalogues canadiens des fabricants`,wide:true,
  body:[chips,h('div',{class:'toolbar-row mt'},h('label',{class:'search'},h('span',{'aria-hidden':'true',text:'⌕'}),search),typeSel,busSel),h('div',{class:'row-between'},old,count),grid,
   h('p',{class:'small muted mt',text:'Données tirées des catalogues des fabricants (voir les sources dans la fiche de chaque produit). Vérifiez toujours l’étiquette du panneau installé.'})],
  actions:[{label:'Fermer',kind:'ghost'}]});
 d.el.classList.add('picker');
 draw();
}

// ---------- Palette de disjoncteurs ----------
const KIND_LABEL={single:'Unipolaires',double:'Bipolaires',triple:'Tripolaires',tandem:'Jumelés',quad:'Quads'};
export function breakerPalette({lib,det,selected,onSelect}){
 const fam=det.family;
 const all=lib.breakers.filter(b=>!fam||b.family===fam);
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
  h('p',{class:'small muted',text:fam?`${all.length} produits ${familyOf(fam).name}. Choisissez un disjoncteur, puis touchez une position en surbrillance sur le panneau.`:'Choisissez d’abord un modèle de panneau pour filtrer les disjoncteurs compatibles.'}),
  h('label',{class:'search'},h('span',{'aria-hidden':'true',text:'⌕'}),search),
  h('div',{class:'palette-filters'},kindSel,protSel,ampsSel),list);
}
export const familyName=id=>FAMILIES[id]?.name||id;
