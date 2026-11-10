// Étape « Vérification » : électroménagers qui consomment le plus, reliés au bon circuit.
// Un électroménager relié est une charge du circuit (circuit.loads) : il alimente le calcul de charge.
// Un électroménager pas encore relié reste dans la fiche du panneau (details.appliances).
import {h,dialog,toast,field,select} from './dom.js';
import {api} from './api.js';
import {prepare} from './aiimport.js';
import {LOAD_LIBRARY,VOLTAGES} from '../catalog.js';
import {designation} from '../model.js';
import {voltsOf} from '../voltage.js';
import {panelReport} from '../loadcalc.js';
import {listAppliances,suggestCircuits,addAppliance,moveAppliance,removeAppliance} from '../appliances.js';
export {listAppliances,suggestCircuits,addAppliance,moveAppliance,removeAppliance};

const fmtW=w=>w>=1000?(w/1000).toLocaleString('fr-CA',{maximumFractionDigits:2})+' kW':w+' W';

/**
 * Onglet « Électroménagers ». save({circuits, appliances}) enregistre et retourne le panneau à jour ; onChange() redessine.
 */
export function appliancesView({panel,children=[],save,onChange,canEdit=true}){
 const rows=listAppliances(panel);
 let rep=null;try{rep=panelReport(panel,{children});}catch{}
 const circuitOptions=(app,current)=>{
  const sug=suggestCircuits(panel,app),best=new Set(sug.filter(s=>s.score>=3).slice(0,3).map(s=>s.circuit.id));
  const opts=[['','— Pas encore relié à un circuit —']];
  for(const s of sug)opts.push([s.circuit.id,`${best.has(s.circuit.id)?'★ ':''}${designation(s.circuit)} · ${s.circuit.label||'sans désignation'}${s.circuit.amps?' · '+s.circuit.amps+' A':''}${s.why&&best.has(s.circuit.id)?' ('+s.why+')':''}`]);
  const sel=select('circuit',opts,current||'');return sel;
 };
 const apply=async fn=>{try{const next=fn();await save(next);onChange();}catch(e){toast(e.message,7000);}};
 const table=rows.length?h('div',{class:'cmp-scroll'},h('table',{class:'cmp-table app-table'},
  h('thead',{},h('tr',{},h('th',{text:'Électroménager'}),h('th',{text:'Puissance'}),h('th',{text:'Circuit'}),h('th'))),
  h('tbody',{},rows.map(r=>{
   const sel=circuitOptions(r,r.circuitId);sel.disabled=!canEdit;
   sel.addEventListener('change',()=>apply(()=>moveAppliance(panel,r.id,sel.value||null)));
   return h('tr',{class:r.pending?'cmp-diff':''},
    h('td',{},h('b',{text:r.name}),r.qty>1&&h('span',{class:'small muted',text:' × '+r.qty}),h('div',{class:'small muted',text:r.v+' V'})),
    h('td',{text:fmtW(r.total)}),h('td',{},sel,r.pending&&h('div',{class:'small',text:'⚠ À relier à un circuit pour compter dans le calcul.'})),
    h('td',{},canEdit&&h('button',{type:'button',class:'ghost sm','aria-label':'Retirer '+r.name,onclick:()=>apply(()=>removeAppliance(panel,r.id))},'✕')));
  }))))
  :h('div',{class:'card empty-state'},h('div',{class:'ico',text:'🔌'}),h('h3',{text:'Aucun électroménager inscrit'}),h('p',{text:'Inscrivez les appareils qui consomment le plus (cuisinière, sécheuse, chauffe-eau, thermopompe, borne…) et reliez-les au bon circuit. Vous pouvez photographier leur plaque signalétique : l’IA lit la puissance.'}));
 const gauge=rep&&h('div',{class:'card side-card'},h('h3',{text:'Charge du panneau'}),
  h('div',{class:'gauge '+rep.status},h('div',{class:'big',text:rep.percent!=null?rep.percent+' %':'—'}),h('div',{},h('b',{text:{ok:'Bonne marge',medium:'Marge correcte',high:'Au-delà de 80 %',over:'Surcharge',unknown:'À compléter'}[rep.status]}),
   h('div',{class:'small muted',text:rep.mainAmps?`${rep.designAmps} A sur un principal de ${rep.mainAmps} A`:'Indiquez le principal dans la fiche du panneau pour obtenir le pourcentage.'}))),
  h('p',{class:'small muted mt',text:`Charge branchée : ${fmtW(Math.round(rep.connectedW))} · seuls les appareils reliés à un circuit comptent.`}));
 const pending=rows.filter(r=>r.pending).length;
 return h('div',{class:'container-narrow'},
  h('div',{class:'cmp-head'},h('h2',{text:'Électroménagers qui consomment le plus'}),canEdit&&h('button',{type:'button',class:'primary',onclick:()=>addDialog({panel,save,onChange})},'＋ Ajouter un électroménager')),
  pending?h('p',{class:'notice small',text:`${pending} appareil(s) pas encore relié(s) à un circuit : choisissez le circuit dans la liste.`}):null,
  gauge,table);
}

/** Fenêtre d'ajout : plaque signalétique (IA) ou liste d'appareils usuels. */
export async function addDialog({panel,save,onChange}){
 let status={allowed:false,configured:false};
 try{status=await api('/api/panels?action=scan');}catch{}
 const f={name:h('input',{maxlength:80,placeholder:'Ex. Sécheuse',required:true}),w:h('input',{type:'number',min:0,max:200000,step:10,placeholder:'Watts'}),
  v:select('v',VOLTAGES.map(v=>[v,v+' V']),voltsOf(panel.details).bi),qty:h('input',{type:'number',min:1,max:100,step:1,value:1}),cont:h('input',{type:'checkbox'})};
 let source='manuel';
 const note=h('p',{class:'small muted',role:'status'});
 const circuitBox=h('div');
 const drawCircuit=()=>{const app={name:f.name.value,w:Number(f.w.value)||0,v:Number(f.v.value),qty:Number(f.qty.value)||1};const sel=select('circuit',[['','— Pas encore relié à un circuit —'],...suggestCircuits(panel,app).map((s,i)=>[s.circuit.id,`${s.score>=3&&i<3?'★ ':''}${designation(s.circuit)} · ${s.circuit.label||'sans désignation'}${s.circuit.amps?' · '+s.circuit.amps+' A':''}`])],'');
  const first=suggestCircuits(panel,app)[0];if(first&&first.score>=3)sel.value=first.circuit.id;
  circuitBox.replaceChildren(field('Relier au circuit',sel,{hint:'★ = suggestion selon le nom, la tension et le calibre.'}));};
 for(const el of [f.name,f.w,f.v,f.qty])el.addEventListener('change',drawCircuit);
 const lib=select('lib',[['','— Choisir dans la liste —'],...LOAD_LIBRARY.map(l=>[l.id,`${l.g} · ${l.name}`])],'');
 lib.addEventListener('change',()=>{const l=LOAD_LIBRARY.find(x=>x.id===lib.value);if(!l)return;f.name.value=l.name;f.w.value=l.w;f.v.value=String(l.v);f.cont.checked=!!l.cont;source='liste';note.textContent='Valeur typique : vérifiez la plaque de votre appareil.';drawCircuit();});
 const photo=h('input',{type:'file',accept:'image/*',capture:'environment',class:'sr-only',id:'plateFile'});
 photo.addEventListener('change',async()=>{
  const file=photo.files[0];if(!file)return;
  note.textContent='Lecture de la plaque…';
  try{
   const p=await prepare(file);
   const out=await api('/api/panels?action=nameplate',{method:'POST',body:{files:[{name:p.name,data:p.data}]}});
   const r=out.plate;
   if(!r.is_nameplate){note.textContent='Plaque non reconnue : prenez la photo plus près, bien éclairée, ou saisissez la puissance à la main.';return;}
   if(r.name)f.name.value=[r.name,r.brand].filter(Boolean).join(' · ').slice(0,80);
   if(r.watts)f.w.value=r.watts;
   if([120,208,240,347,600].includes(r.volts))f.v.value=String(r.volts);
   source='plaque';
   note.textContent=`Lu par l’IA (confiance ${Math.round((r.confidence||0)*100)} %)${r.model?' · modèle '+r.model:''}${r.watts?'':' · puissance illisible : saisissez-la'}. ${r.notes||''} Vérifiez avant d’enregistrer.`;
   drawCircuit();
  }catch(e){note.textContent=e.message;}
  finally{photo.value='';}
 });
 const photoBlock=status.allowed&&status.configured
  ?h('div',{class:'page-actions'},h('label',{class:'btn primary',for:'plateFile'},'📷 Photographier la plaque signalétique'),photo,h('span',{class:'small muted',text:`Compte pour 1 analyse IA${status.monthly!=null?` (${status.used}/${status.monthly} ce mois-ci)`:''}.`}))
  :h('p',{class:'small muted',text:'La lecture de plaque par IA est incluse dans les forfaits payants. Vous pouvez saisir la puissance à la main ou choisir dans la liste.'});
 const d=dialog({title:'Ajouter un électroménager',eyebrow:'Étape Vérification · '+(panel.tag||panel.name),form:true,wide:true,
  body:[photoBlock,h('div',{class:'fields'},field('Ou choisir dans la liste',lib,{full:true}),field('Nom',f.name,{full:true}),field('Puissance (W)',f.w),field('Tension',f.v),field('Quantité',f.qty),h('label',{class:'check full'},f.cont,' Fonctionne en continu (3 h ou plus)')),note,circuitBox],
  actions:[{label:'Annuler',kind:'ghost'},{label:'Enregistrer',kind:'primary',submit:true}]});
 drawCircuit();
 d.form.addEventListener('submit',async ev=>{
  ev.preventDefault();
  const w=Number(f.w.value);if(!f.name.value.trim())return toast('Donnez un nom à l’appareil.');if(!Number.isFinite(w)||w<=0)return toast('Indiquez la puissance en watts.');
  try{
   const next=addAppliance(panel,{name:f.name.value.trim().slice(0,80),w:Math.round(w),v:Number(f.v.value),qty:Math.max(1,Number(f.qty.value)||1),cont:f.cont.checked,source},d.form.elements.circuit.value||null);
   await save(next);d.close();onChange();toast('Électroménager enregistré.');
  }catch(e){toast(e.message,7000);}
 });
}
