// Étape « Vérification » : électroménagers qui consomment le plus, reliés au bon circuit.
// Un électroménager relié est une charge du circuit (circuit.loads) : il alimente le calcul de charge.
// Un électroménager pas encore relié reste dans la fiche du panneau (details.appliances).
import {h,dialog,toast,field,select} from './dom.js';
import {api,apiProgress} from './api.js';
import {aiProgress} from './aiprogress.js';
import {prepare} from './aiimport.js';
import {LOAD_LIBRARY,LOAD_CATEGORIES,VOLTAGES} from '../catalog.js';
import {designation} from '../model.js';
import {voltsOf} from '../voltage.js';
import {panelReport} from '../loadcalc.js';
import {listAppliances,suggestCircuits,addAppliance,moveAppliance,removeAppliance,updateAppliance,inferLoad} from '../appliances.js';
export {listAppliances,suggestCircuits,addAppliance,moveAppliance,removeAppliance,updateAppliance,inferLoad};

const fmtW=w=>w>=1000?(w/1000).toLocaleString((globalThis.MP_LOCALE||'fr-CA'),{maximumFractionDigits:2})+' kW':w+' W';

/**
 * Onglet « Électroménagers ». save({circuits, appliances}) enregistre et retourne le panneau à jour ; onChange() redessine.
 */
export function appliancesView({panel,children=[],save,onChange,canEdit=true}){
 const rows=listAppliances(panel);
 let rep=null;try{rep=panelReport(panel,{children});}catch{}
 const circuitOptions=(app,current)=>{
  const sug=suggestCircuits(panel,app),best=new Set(sug.filter(s=>s.score>=3).slice(0,3).map(s=>s.circuit.id));
  const opts=[['','— Pas encore relié à un circuit —']];
  for(const s of sug)opts.push([s.circuit.id,`${best.has(s.circuit.id)?'★ ':''}${designation(s.circuit)} · ${s.circuit.label||'sans désignation'}${s.circuit.amps?' · '+s.circuit.amps+' A':''}`]);
  const sel=select('circuit',opts,current||'');return sel;
 };
 const apply=async fn=>{try{const next=fn();await save(next);onChange();}catch(e){toast(e.message,7000);}};
 const table=rows.length?h('div',{class:'cmp-scroll'},h('table',{class:'cmp-table app-table'},
  h('thead',{},h('tr',{},h('th',{text:'Électroménager'}),h('th',{text:'Puissance'}),h('th',{text:'Circuit'}),h('th'))),
  h('tbody',{},rows.map(r=>{
   const sel=circuitOptions(r,r.circuitId);sel.disabled=!canEdit;
   sel.addEventListener('change',()=>apply(()=>moveAppliance(panel,r.id,sel.value||null)));
   return h('tr',{class:r.pending?'cmp-diff':''},
    h('td',{},h('b',{text:r.name}),r.qty>1&&h('span',{class:'small muted',text:' × '+r.qty}),r.model&&h('div',{class:'small app-model',text:'Modèle : '+r.model}),inferLoad(r.name,r.w).cat==='range'&&r.cat!=='range'&&h('div',{class:'app-warn'},'⚠ ',h('span',{class:'long',text:'Catégorie à corriger : « Cuisinière » (touchez ✎) pour appliquer la règle 8-300.'}),h('span',{class:'short',text:'Catégorie à corriger ✎'})),h('div',{class:'small muted',text:r.v+' V'})),
    h('td',{text:fmtW(r.total)}),h('td',{},h('span',{class:'app-lbl',text:'Relier au circuit'}),sel,r.pending&&h('div',{class:'app-warn'},'⚠ ',h('span',{class:'long',text:'À relier à un circuit pour compter dans le calcul.'}),h('span',{class:'short',text:'À relier'}))),
    h('td',{class:'app-actions'},canEdit&&h('button',{type:'button',class:'ghost sm','aria-label':'Modifier '+r.name,title:'Modifier',onclick:()=>addDialog({panel,save,onChange,edit:r})},'✎'),canEdit&&h('button',{type:'button',class:'ghost sm','aria-label':'Retirer '+r.name,title:'Retirer',onclick:()=>apply(()=>removeAppliance(panel,r.id))},'✕')));
  }))))
  :h('div',{class:'card empty-state'},h('div',{class:'ico',text:'🔌'}),h('h3',{text:'Aucun électroménager inscrit'}),h('p',{text:'Inscrivez les appareils qui consomment le plus (cuisinière, sécheuse, chauffe-eau, thermopompe, borne…) et reliez-les au bon circuit. Vous pouvez photographier leur plaque signalétique : l’IA lit la puissance.'}));
 const gauge=rep&&h('div',{class:'card side-card'},h('h3',{text:'Charge du panneau'}),
  h('div',{class:'gauge '+rep.status},h('div',{class:'big',text:rep.percent!=null?rep.percent+' %':'—'}),h('div',{},h('b',{text:{ok:'Bonne marge',medium:'Marge correcte',high:'Marge réduite (> 80 %)',over:'Surcharge',unknown:'À compléter'}[rep.status]}),
   h('div',{class:'small muted',text:rep.mainAmps?`${(Number(rep.designAmps)).toLocaleString(globalThis.MP_LOCALE||'fr-CA',{maximumFractionDigits:1})} A sur un principal de ${rep.mainAmps} A`:'Indiquez le principal dans la fiche du panneau pour obtenir le pourcentage.'}))),
  h('p',{class:'small muted mt',text:`Charge branchée : ${fmtW(Math.round(rep.connectedW))} · seuls les appareils reliés à un circuit comptent.`}));
 const pending=rows.filter(r=>r.pending).length;
 return h('div',{class:'container-narrow'},
  h('div',{class:'cmp-head'},h('h2',{text:'Électroménagers qui consomment le plus'}),canEdit&&h('button',{type:'button',class:'primary',onclick:()=>addDialog({panel,save,onChange})},'＋ Ajouter un électroménager')),
  pending?h('p',{class:'notice small app-notice'},h('span',{class:'long',text:`${pending} appareil(s) pas encore relié(s) à un circuit : choisissez le circuit dans la liste.`}),h('span',{class:'short',text:`${pending} à relier à un circuit`})):null,
  gauge,table);
}

/** Fenêtre d'ajout : plaque signalétique (IA) ou liste d'appareils usuels. */
export async function addDialog({panel,save,onChange,edit=null}){
 let status={allowed:false,configured:false};
 try{status=await api('/api/panels?action=scan');}catch{}
 const f={name:h('input',{maxlength:80,placeholder:'Ex. Sécheuse',required:true,value:edit?.name||''}),w:h('input',{type:'number',min:0,max:200000,step:10,placeholder:'Watts',value:edit?.w??''}),
  v:select('v',VOLTAGES.map(v=>[v,v+' V']),edit?.v||voltsOf(panel.details).bi),model:h('input',{maxlength:60,placeholder:'Lu sur la plaque (facultatif)',value:edit?.model||''}),qty:h('input',{type:'number',min:1,max:100,step:1,value:edit?.qty||1}),cont:h('input',{type:'checkbox',checked:!!edit?.cont}),cat:select('cat',Object.entries(LOAD_CATEGORIES),edit?.cat||'other')};
 // Catégorie et caractère continu : déduits du nom tant que l'utilisateur n'y a pas touché.
 let catTouched=!!edit;
 const autoCat=()=>{if(catTouched)return;const g=inferLoad(f.name.value,Number(f.w.value)||0);f.cat.value=g.cat;f.cont.checked=g.cont;};
 f.cat.addEventListener('change',()=>{catTouched=true;});f.cont.addEventListener('change',()=>{catTouched=true;});
 for(const el of [f.name,f.w])el.addEventListener('input',autoCat);
 let source=edit?.source||'manuel';
 // Circuit choisi : en modification, le circuit actuel ; sinon la meilleure suggestion tant que rien n'est choisi à la main.
 let chosen=edit?(edit.circuitId||''):null;
 const note=h('p',{class:'small muted',role:'status'});
 const circuitBox=h('div');
 const drawCircuit=()=>{const app={name:f.name.value,w:Number(f.w.value)||0,v:Number(f.v.value),qty:Number(f.qty.value)||1};const sel=select('circuit',[['','— Pas encore relié à un circuit —'],...suggestCircuits(panel,app).map((s,i)=>[s.circuit.id,`${s.score>=3&&i<3?'★ ':''}${designation(s.circuit)} · ${s.circuit.label||'sans désignation'}${s.circuit.amps?' · '+s.circuit.amps+' A':''}`])],'');
  if(chosen!==null)sel.value=chosen;else{const first=suggestCircuits(panel,app)[0];if(first&&first.score>=3)sel.value=first.circuit.id;}
  sel.addEventListener('change',()=>{chosen=sel.value;});
  circuitBox.replaceChildren(field('Relier au circuit',sel,{hint:'★ = suggestion selon le nom, la tension et le calibre.'}));};
 for(const el of [f.name,f.w,f.v,f.qty])el.addEventListener('change',drawCircuit);
 const lib=select('lib',[['','— Choisir dans la liste —'],...LOAD_LIBRARY.map(l=>[l.id,`${l.g} · ${l.name}`])],'');
 lib.addEventListener('change',()=>{const l=LOAD_LIBRARY.find(x=>x.id===lib.value);if(!l)return;f.name.value=l.name;f.w.value=l.w;f.v.value=String(l.v);f.cont.checked=!!l.cont;f.cat.value=l.cat;catTouched=true;source='liste';note.textContent='Valeur typique : vérifiez la plaque de votre appareil.';drawCircuit();});
 const photo=h('input',{type:'file',accept:'image/*',capture:'environment',class:'sr-only',id:'plateFile'});
 const progBox=h('div',{class:'ai-prog-box'});
 photo.addEventListener('change',async()=>{
  const file=photo.files[0];if(!file)return;
  note.textContent='';
  const prog=aiProgress({steps:['Préparation de la photo','Envoi de la photo','Lecture de la plaque par l’IA','Remplissage des champs'],weights:[10,20,55,15],analysisIndex:2,expectedMs:12000,
   details:['Recherche de la plaque signalétique…','Lecture du nom, de la marque et du modèle…','Lecture de la puissance et de la tension…']});
  progBox.replaceChildren(h('b',{text:'Analyse de la plaque'}),prog.el);
  try{
   prog.stage(0,0);
   const p=await prepare(file);
   prog.stage(1,0);
   const out=await apiProgress('/api/panels?action=nameplate',{method:'POST',body:{files:[{name:p.name,data:p.data}]},onUpload:fr=>prog.stage(fr>=1?2:1,fr>=1?0:fr)});
   const r=out.plate;
   if(!r.is_nameplate){prog.stop();progBox.replaceChildren();note.textContent='Plaque non reconnue : prenez la photo plus près, bien éclairée, ou saisissez la puissance à la main.';return;}
   prog.stage(3,0);
   await prog.results([r.name&&`Appareil : ${[r.name,r.brand].filter(Boolean).join(' · ')}`,r.model&&`Modèle : ${r.model}`,r.watts&&`Puissance : ${r.watts} W`,[120,208,240,347,600].includes(r.volts)&&`Tension : ${r.volts} V`].filter(Boolean),{delay:260});
   if(r.name)f.name.value=[r.name,r.brand].filter(Boolean).join(' · ').slice(0,80);
   if(r.model)f.model.value=String(r.model).slice(0,60);
   if(r.watts)f.w.value=r.watts;
   if([120,208,240,347,600].includes(r.volts))f.v.value=String(r.volts);
   source='plaque';autoCat();
   prog.finish();setTimeout(()=>progBox.replaceChildren(),2500);
   note.textContent=`Lu par l’IA (confiance ${Math.round((r.confidence||0)*100)} %)${r.model?' · modèle '+r.model:''}${r.watts?'':' · puissance illisible : saisissez-la'}. ${r.notes||''} Vérifiez avant d’enregistrer.`;
   drawCircuit();
  }catch(e){prog.stop();progBox.replaceChildren();note.textContent=e.message;}
  finally{photo.value='';}
 });
 const photoBlock=status.allowed&&status.configured
  ?h('div',{class:'page-actions'},h('label',{class:'btn primary',for:'plateFile'},'📷 Photographier la plaque signalétique'),photo,h('span',{class:'small muted',text:`Compte pour 1 analyse IA${status.monthly!=null?` (${status.used}/${status.monthly} ce mois-ci)`:''}.`}))
  :h('p',{class:'small muted',text:'La lecture de plaque par IA est incluse dans les forfaits payants. Vous pouvez saisir la puissance à la main ou choisir dans la liste.'});
 const d=dialog({title:edit?'Modifier l’électroménager':'Ajouter un électroménager',eyebrow:'Étape Vérification · '+(panel.tag||panel.name),form:true,wide:true,
  body:[photoBlock,progBox,h('div',{class:'fields'},field('Ou choisir dans la liste',lib,{full:true}),field('Nom',f.name,{full:true}),field('Numéro de modèle',f.model,{full:true,hint:'Détecté par l’IA sur la plaque signalétique, modifiable.'}),field('Puissance (W)',f.w),field('Tension',f.v),field('Quantité',f.qty),field('Catégorie de charge',f.cat,{full:true,hint:'Détermine le calcul : « Cuisinière » applique la règle 8-300 au circuit (8 000 W + 40 %) et 6 000 W + 40 % à l’entrée.'}),h('label',{class:'check full'},f.cont,' Charge continue (3 heures ou plus) : disjoncteur ≥ 125 %')),note,circuitBox],
  actions:[{label:'Annuler',kind:'ghost'},{label:'Enregistrer',kind:'primary',submit:true}]});
 drawCircuit();
 d.form.addEventListener('submit',async ev=>{
  ev.preventDefault();
  const w=Number(f.w.value);if(!f.name.value.trim())return toast('Donnez un nom à l’appareil.');if(!Number.isFinite(w)||w<=0)return toast('Indiquez la puissance en watts.');
  try{
   const app={name:f.name.value.trim().slice(0,80),model:f.model.value.trim().slice(0,60),w:Math.round(w),v:Number(f.v.value),qty:Math.max(1,Number(f.qty.value)||1),cont:f.cont.checked,cat:f.cat.value,source};
   const circuit=d.form.elements.circuit.value||null;
   const next=edit?updateAppliance(panel,edit.id,app,circuit):addAppliance(panel,app,circuit);
   await save(next);d.close();onChange();toast(edit?'Électroménager modifié.':'Électroménager enregistré.');
  }catch(e){toast(e.message,7000);}
 });
}
