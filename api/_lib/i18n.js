// Traduction côté serveur (PDF, courriels) : mêmes dictionnaires que l'application.
import {makeTranslator} from '../../public/i18n-core.js';
import EN from '../../public/i18n-en.js';
import DOCS from '../../public/i18n-en-docs.js';
let en;
export const normLang=l=>l==='en'?'en':'fr';
/** Traducteur français → langue demandée (identité en français). */
export function translatorFor(lang){if(normLang(lang)!=='en')return s=>s;en??=makeTranslator([...EN,...DOCS]);return en;}
export const localeFor=lang=>normLang(lang)==='en'?'en-CA':'fr-CA';
