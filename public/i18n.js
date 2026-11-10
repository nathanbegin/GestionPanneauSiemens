// Langue de l'interface : français (par défaut) ou anglais. Le texte de l'application est écrit en français ;
// en anglais, chaque texte affiché est traduit à la volée d'après les dictionnaires i18n-en*.js (texte, placeholder, title, aria-label…).
// Les données saisies par l'utilisateur ne sont pas touchées : seuls les textes connus des dictionnaires changent.
import {makeTranslator} from './i18n-core.js';
import EN from './i18n-en.js';
import {readyDictionaries} from './i18n-load.js';

const KEY='mp_lang';
function detect(){
 try{const s=localStorage.getItem(KEY);if(s==='fr'||s==='en')return s;}catch{}
 return /^en/i.test((navigator.languages&&navigator.languages[0])||navigator.language||'')?'en':'fr';
}
export const lang=detect();
export const locale=lang==='en'?'en-CA':'fr-CA';
globalThis.MP_LANG=lang;globalThis.MP_LOCALE=locale;
let translate=lang==='en'?makeTranslator(EN):s=>s;
/** Traduit un texte français (sans effet en français). */
export const t=s=>translate(s);
/** Mémorise la langue sans recharger. */
export function storeLang(l){try{localStorage.setItem(KEY,l==='en'?'en':'fr');}catch{}}
/** Change la langue puis recharge l'application. */
export function setLang(l){storeLang(l);location.reload();}
/** Aligne la langue de l'appareil sur celle du compte (préférence enregistrée) ; recharge une seule fois. */
export function followAccountLang(profile){
 const want=profile?.lang==='en'?'en':profile?.lang==='fr'?'fr':'';
 if(!want||want===lang)return false;
 try{if(sessionStorage.getItem('mp_lang_synced')===want)return false;sessionStorage.setItem('mp_lang_synced',want);}catch{}
 setLang(want);return true;
}
document.documentElement.lang=lang==='en'?'en':'fr-CA';

if(lang==='en'){
 const ATTRS=['placeholder','title','aria-label','alt'];
 const SKIP=new Set(['SCRIPT','STYLE','TEXTAREA','CODE','PRE','NOSCRIPT']);
 const INLINE=new Set(['A','SPAN','STRONG','EM','B','I','SMALL','BR','CODE','ABBR','SUP','SUB','MARK']);
 const BLOCKS=new Set(['P','LI','H1','H2','H3','H4','TD','TH','DT','DD','SUMMARY','LABEL','DIV','SPAN','A','SMALL','BUTTON','FIGCAPTION']);
 const isStatic=!document.documentElement.classList.contains('app')&&!document.body?.classList.contains('app');
 const skipped=el=>el.closest?.('[data-i18n-skip],[contenteditable="true"]');
 const normHtml=h=>h.replace(/&nbsp;/g,' ').replace(/\s+/g,' ').replace(/\s*\/>/g,'>').trim();
 function text(node){const v=node.nodeValue;const o=translate(v);if(o!==v)node.nodeValue=o;}
 function attrs(el){
  for(const a of ATTRS){const v=el.getAttribute?.(a);if(v){const o=translate(v);if(o!==v)el.setAttribute(a,o);}}
  if(el.tagName==='INPUT'&&/^(button|submit|reset)$/i.test(el.type)){const v=el.value;const o=translate(v);if(o!==v)el.value=o;}
  if(el.tagName==='META'&&el.getAttribute('name')==='description'){const v=el.getAttribute('content');const o=v&&translate(v);if(o&&o!==v)el.setAttribute('content',o);}
 }
 // Pages publiques : un bloc qui mêle texte et balises (« page <a>Tarifs</a>. ») se traduit d'un seul tenant.
 function block(el){
  if(!isStatic||!BLOCKS.has(el.tagName)||!el.firstElementChild)return false;
  for(const c of el.children)if(!INLINE.has(c.tagName))return false;
  const key=normHtml(el.innerHTML),out=translate.exact?.(key);
  if(out&&out!==key){el.innerHTML=out;return true;}
  return false;
 }
 function walk(node){
  if(node.nodeType===3){if(!node.parentNode||(!SKIP.has(node.parentNode.nodeName)&&!skipped(node.parentNode)))text(node);return;}
  if(node.nodeType!==1||skipped(node))return;
  attrs(node);
  if(SKIP.has(node.nodeName))return;
  if(block(node))return;
  for(let c=node.firstChild;c;c=c.nextSibling)walk(c);
 }
 const obs=new MutationObserver(muts=>{
  for(const m of muts){
   if(m.type==='childList')m.addedNodes.forEach(walk);
   else if(m.type==='characterData'){if(m.target.parentNode&&!SKIP.has(m.target.parentNode.nodeName)&&!skipped(m.target.parentNode))text(m.target);}
   else if(m.type==='attributes'&&m.target.nodeType===1&&!skipped(m.target))attrs(m.target);
  }
  obs.takeRecords(); // écarte les mutations provoquées par la traduction elle-même
 });
 const pass=()=>{walk(document.documentElement);obs.takeRecords();};
 const observe=()=>obs.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:[...ATTRS,'value']});
 const start=()=>{
  // Pages publiques : on attend tous les dictionnaires (les blocs mêlant texte et balises doivent être traduits avant leurs enfants).
  // Application : premier passage immédiat, puis dictionnaires secondaires (PDF, guide, administration).
  if(isStatic){readyDictionaries().then(extra=>{translate=makeTranslator([...EN,...extra]);pass();observe();}).catch(()=>{pass();observe();});return;}
  pass();observe();
  readyDictionaries().then(extra=>{translate=makeTranslator([...EN,...extra]);pass();}).catch(()=>{});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
 // Boîtes de dialogue natives.
 const {alert:a,confirm:c,prompt:p}=window;
 window.alert=m=>a.call(window,translate(String(m)));
 window.confirm=m=>c.call(window,translate(String(m)));
 window.prompt=(m,d)=>p.call(window,translate(String(m)),d);
}
// Pages publiques : bouton FR / EN dans l'en-tête (dans l'application, il est dans la barre du haut).
if(!document.documentElement.classList.contains('app')){
 const addSwitch=()=>{
  if(document.body?.classList.contains('app')||document.querySelector('.lang-switch'))return;
  const host=document.querySelector('.site-header .container');if(!host)return;
  const b=document.createElement('button');b.type='button';b.className='ghost lang-switch';b.setAttribute('data-i18n-skip','');
  b.textContent=lang==='en'?'FR':'EN';b.title=lang==='en'?'Français':'English';b.setAttribute('aria-label',lang==='en'?'Passer en français':'Switch to English');
  b.addEventListener('click',()=>setLang(lang==='en'?'fr':'en'));host.append(b);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addSwitch);else addSwitch();
}
