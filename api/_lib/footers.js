// Pieds de page des PDF : mention par défaut et modèles définis dans la console (app_settings, clé « pdf »).
import {HttpError} from './http.js';
export async function loadPdfSettings(sql){try{const [r]=await sql`SELECT value FROM app_settings WHERE key='pdf'`;return r?.value||{};}catch{return {};}}
const t=(v,n)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
export function cleanPdfSettings(d={}){
 const footers=(Array.isArray(d.footers)?d.footers:[]).slice(0,20).map((f,i)=>({id:t(f.id,40).replace(/[^a-z0-9-]/gi,'')||'modele-'+(i+1),label:t(f.label,60),text:t(f.text,200)})).filter(f=>f.label&&f.text);
 if(new Set(footers.map(f=>f.id)).size!==footers.length)throw new HttpError(400,'Identifiants de modèles en double.');
 return {legal:t(d.legal,240),footers};
}
// Texte du pied de page d'une entreprise : modèle choisi, sinon texte personnalisé.
export function resolveFooter(branding={},settings={}){
 const m=branding.footerId&&(settings.footers||[]).find(f=>f.id===branding.footerId);
 return {footer:m?m.text:(branding.footer||''),legal:settings.legal||''};
}
