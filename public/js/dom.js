// Petits utilitaires DOM sans dépendance.
export function h(tag,props,...kids){
 const el=document.createElement(tag);
 if(props&&(typeof props!=='object'||props instanceof Node||Array.isArray(props))){kids.unshift(props);props=null;}
 for(const [k,v] of Object.entries(props||{})){
  if(v==null||v===false)continue;
  if(k==='class')el.className=v;
  else if(k==='text')el.textContent=v;
  else if(k.startsWith('on')&&typeof v==='function')el.addEventListener(k.slice(2),v);
  else if(k==='dataset')Object.assign(el.dataset,v);
  else if(k==='style'&&typeof v==='object')Object.assign(el.style,v);
  else if(['value','checked','selected','disabled','hidden','required','multiple','readOnly'].includes(k))el[k]=v;
  else el.setAttribute(k,v===true?'':v);
 }
 append(el,kids);
 return el;
}
function append(el,kids){for(const k of kids.flat(Infinity)){if(k==null||k===false)continue;el.append(k instanceof Node?k:document.createTextNode(String(k)));}}
export const $=(sel,root=document)=>root.querySelector(sel);
export const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];

let toastTimer;
export function toast(message,ms=4500){
 const t=document.getElementById('toast');t.textContent=message;t.classList.add('show');
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),ms);
}

// Boîte de dialogue modale. actions : [{label, kind:'primary'|'danger'|'ghost', left, onClick(close) -> false pour garder ouvert}]
export function dialog({title,eyebrow,body=[],actions=[],onClose,form=false,wide=false}){
 const foot=h('div',{class:'dlg-foot'});
 const right=h('div',{class:'right'});
 const close=()=>{if(el.open)el.close();};
 for(const a of actions){
  const b=h('button',{type:a.submit?'submit':'button',class:a.kind||'',text:a.label});
  if(a.onClick)b.addEventListener('click',async e=>{if(a.submit)return;e.preventDefault();const r=await a.onClick(close,b);if(r!==false&&!a.keep)close();});
  (a.left?foot:right).append(b);
 }
 foot.append(right);
 const content=[h('div',{class:'dlg-head'},h('div',{},eyebrow&&h('div',{class:'eyebrow',text:eyebrow}),h('h2',{text:title})),h('button',{type:'button','aria-label':'Fermer',text:'✕',onclick:close})),h('div',{class:'dlg-body'},body),foot];
 const inner=form?h('form',{novalidate:true},content):content;
 const el=h('dialog',{},inner);
 if(wide)el.style.width='min(860px, calc(100vw - 24px))';
 el.addEventListener('close',()=>{el.remove();onClose?.();});
 document.body.append(el);el.showModal();
 return {el,close,form:form?inner:null};
}
export function confirmDialog(message,{title='Confirmer',confirm='Confirmer',danger=false}={}){
 return new Promise(resolve=>{
  let ok=false;
  dialog({title,body:[h('p',{text:message})],actions:[{label:'Annuler',kind:'ghost'},{label:confirm,kind:danger?'danger':'primary',onClick:()=>{ok=true;}}],onClose:()=>resolve(ok)});
 });
}
// Champ de formulaire étiqueté.
export function field(label,input,{hint,full}={}){
 return h('label',{class:'f'+(full?' full':'')},h('span',{},label),input,hint&&h('span',{class:'hint',text:hint}));
}
export function select(name,options,value){
 const s=h('select',{name});
 for(const o of options){const [v,t]=Array.isArray(o)?o:[o,o];s.append(new Option(t,v));}
 if(value!==undefined&&value!==null)s.value=String(value);
 return s;
}
export const fmtDate=v=>v?new Intl.DateTimeFormat('fr-CA',{dateStyle:'medium'}).format(new Date(v)):'';
export const fmtRelative=v=>{
 if(!v)return '';const s=(Date.now()-new Date(v))/1000;
 if(s<60)return 'à l’instant';if(s<3600)return `il y a ${Math.floor(s/60)} min`;if(s<86400)return `il y a ${Math.floor(s/3600)} h`;
 return fmtDate(v);
};
