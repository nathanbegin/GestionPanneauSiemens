// Langue de l'interface : français (par défaut) ou anglais. Le texte de l'application est écrit en français ;
// en anglais, chaque texte affiché est traduit à la volée d'après le dictionnaire i18n-en.js (texte, placeholder, title, aria-label…).
// Les données saisies par l'utilisateur ne sont pas touchées : seuls les textes connus du dictionnaire changent.
import {makeTranslator} from './i18n-core.js';
import EN from './i18n-en.js';

const KEY='mp_lang';
function detect(){
 try{const s=localStorage.getItem(KEY);if(s==='fr'||s==='en')return s;}catch{}
 return /^en/i.test((navigator.languages&&navigator.languages[0])||navigator.language||'')?'en':'fr';
}
export const lang=detect();
export const locale=lang==='en'?'en-CA':'fr-CA';
globalThis.MP_LANG=lang;globalThis.MP_LOCALE=locale;
const translate=lang==='en'?makeTranslator(EN):s=>s;
/** Traduit un texte français (sans effet en français). */
export const t=s=>translate(s);
/** Change la langue puis recharge l'application. */
export function setLang(l){try{localStorage.setItem(KEY,l==='en'?'en':'fr');}catch{}location.reload();}
document.documentElement.lang=lang==='en'?'en':'fr-CA';

if(lang==='en'){
 const ATTRS=['placeholder','title','aria-label','alt'];
 const SKIP=new Set(['SCRIPT','STYLE','TEXTAREA','CODE','PRE','NOSCRIPT']);
 const skipped=el=>el.closest?.('[data-i18n-skip],[contenteditable="true"]');
 function text(node){const v=node.nodeValue;const o=translate(v);if(o!==v)node.nodeValue=o;}
 function attrs(el){
  for(const a of ATTRS){const v=el.getAttribute?.(a);if(v){const o=translate(v);if(o!==v)el.setAttribute(a,o);}}
  if(el.tagName==='INPUT'&&/^(button|submit|reset)$/i.test(el.type)){const v=el.value;const o=translate(v);if(o!==v)el.value=o;}
 }
 function walk(node){
  if(node.nodeType===3){if(!node.parentNode||(!SKIP.has(node.parentNode.nodeName)&&!skipped(node.parentNode)))text(node);return;}
  if(node.nodeType!==1||skipped(node))return;
  attrs(node);
  if(SKIP.has(node.nodeName))return;
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
 const start=()=>{walk(document.documentElement);obs.takeRecords();obs.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:[...ATTRS,'value']});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
 // Boîtes de dialogue natives.
 const {alert:a,confirm:c,prompt:p}=window;
 window.alert=m=>a.call(window,translate(String(m)));
 window.confirm=m=>c.call(window,translate(String(m)));
 window.prompt=(m,d)=>p.call(window,translate(String(m)),d);
}
