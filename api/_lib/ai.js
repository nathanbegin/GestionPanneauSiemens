// Lecture d'un panneau électrique par IA (OpenAI, API Responses, sortie JSON structurée).
// Variables : OPENAI_API_KEY (obligatoire), OPENAI_MODEL (facultatif : un modèle ou une liste séparée par des virgules ;
// défaut gpt-6.1-terra puis modèles de repli),
// OPENAI_IMAGE_DETAIL (défaut high ; « original » pour les étiquettes très petites).
import {HttpError} from './http.js';
import {FAMILY_IDS,FAMILIES} from '../../public/catalog.js';
import {voltages} from '../../public/model.js';

// Modèles essayés dans l'ordre : si le projet OpenAI n'a pas accès à l'un d'eux (model_not_found),
// on passe au suivant. OPENAI_MODEL peut contenir un modèle ou une liste séparée par des virgules.
export const DEFAULT_MODELS=['gpt-6.1-terra','gpt-6-astra','gpt-6-luna','gpt-6.1-sol','gpt-5.6-terra','gpt-5.4-mini'];
export const DEFAULT_MODEL=DEFAULT_MODELS[0];
// Modèles connus (affichés dans la console d'administration). Prix en $ US par million de jetons (entrée / sortie).
export const AI_CATALOG=[
 {id:'gpt-6.1-terra',label:'GPT-6.1 Terra',input:1,output:5,note:'Raisonnement visuel, rapide et économique (recommandé).'},
 {id:'gpt-6-astra',label:'GPT-6 Astra',input:10,output:50,note:'Le plus puissant : étiquettes difficiles, photos imparfaites.'},
 {id:'gpt-6.1-sol',label:'GPT-6.1 Sol',input:2,output:10,note:'Proche d’Astra, moins cher.'},
 {id:'gpt-6-luna',label:'GPT-6 Luna',input:0.1,output:0.5,note:'Très économique, moins précis pour les petits caractères.'},
 {id:'gpt-5.6-terra',label:'GPT-5.6 Terra',input:null,output:null,note:'Génération précédente.'},
 {id:'gpt-5.4-mini',label:'GPT-5.4 mini',input:0.75,output:4.5,note:'Génération précédente, économique.'},
];
export const IMAGE_DETAILS=['high','original','auto','low'];
export const MODEL_ID=/^[a-z0-9][a-z0-9._-]{1,63}$/i;
const parseList=v=>String(v||'').split(',').map(x=>x.trim()).filter(Boolean);
// Réglages enregistrés dans la console (table app_settings, clé « ai »). Priorité : console > OPENAI_MODEL > défaut.
export async function loadAiSettings(sql){
 try{const [r]=await sql`SELECT value FROM app_settings WHERE key='ai'`;return r?.value||{};}catch{return {};}
}
export function cleanAiSettings(input={}){
 const models=[...new Set((Array.isArray(input.models)?input.models:[]).map(m=>String(m).trim()).filter(Boolean))];
 if(models.length>8)throw new HttpError(400,'8 modèles au maximum.');
 for(const m of models)if(!MODEL_ID.test(m))throw new HttpError(400,'Identifiant de modèle invalide : '+m.slice(0,60));
 const detail=input.detail?String(input.detail):'';
 if(detail&&!IMAGE_DETAILS.includes(detail))throw new HttpError(400,'Niveau de détail invalide.');
 return {models,detail};
}
export const aiSource=(settings={})=>settings.models?.length?'console':parseList(process.env.OPENAI_MODEL).length?'variable':'defaut';
export const aiModels=(settings={})=>settings.models?.length?settings.models:parseList(process.env.OPENAI_MODEL).length?parseList(process.env.OPENAI_MODEL):DEFAULT_MODELS;
export const imageDetail=(settings={})=>settings.detail||process.env.OPENAI_IMAGE_DETAIL||'high';
export const deniedModels=(now=Date.now())=>[...deniedAt.keys()].filter(m=>isDenied(m,now));
// Modèles refusés récemment (model_not_found) : on les saute pendant 10 minutes, puis on les réessaie.
// Ainsi, un modèle qu'on vient d'autoriser dans le projet OpenAI est repris automatiquement dès qu'il est actif.
export const DENY_TTL_MS=10*60*1000;
const deniedAt=new Map();
export const resetModelCache=()=>deniedAt.clear();
const isDenied=(m,now=Date.now())=>deniedAt.has(m)&&now-deniedAt.get(m)<DENY_TTL_MS;
// Ordre d'essai : les modèles non refusés récemment d'abord (dans l'ordre préféré), puis les autres.
export const modelOrder=(settings={},now=Date.now())=>{const list=aiModels(settings);return [...list.filter(m=>!isDenied(m,now)),...list.filter(m=>isDenied(m,now))];};
export const aiModel=(settings={})=>modelOrder(settings)[0];
export const aiConfigured=()=>!!process.env.OPENAI_API_KEY;
export const MAX_FILES=6,MAX_BYTES=3*1024*1024; // ≈ 4 Mo une fois encodé en base64 (limite Vercel : 4,5 Mo).

const nullable=t=>({type:[t,'null']});
export const SCAN_SCHEMA={
 type:'object',additionalProperties:false,
 required:['is_panel','brand','series','catalog_number','family','main_amps','bus_amps','positions','voltage','panel_kind','breakers','empty_positions','confidence','warnings','summary'],
 properties:{
  is_panel:{type:'boolean',description:'Vrai si les documents montrent un panneau électrique ou son répertoire.'},
  brand:{type:'string',description:'Marque lue (Siemens, Square D, Eaton, Cutler-Hammer, Schneider Electric, Federal Pioneer, Stab-Lok, Westinghouse, Commander, GE, Leviton, Generac…). Vide si illisible.'},
  series:{type:'string',description:'Gamme ou série (ex. EQ, QO, Homeline, BR, CH). Vide si inconnue.'},
  catalog_number:{type:'string',description:'Numéro de catalogue lu sur l’étiquette du fabricant. Vide si illisible.'},
  family:{type:'string',enum:[...FAMILY_IDS,''],description:'Famille de produits correspondante dans la liste fournie, ou vide.'},
  main_amps:{...nullable('integer'),description:'Calibre du disjoncteur principal (A), null si absent ou illisible.'},
  bus_amps:{...nullable('integer'),description:'Calibre des barres omnibus (A) lu sur l’étiquette, null sinon.'},
  positions:{...nullable('integer'),description:'Nombre total de positions (espaces) du panneau, null si inconnu.'},
  voltage:{type:'string',enum:[...voltages,''],description:'Tension du panneau.'},
  panel_kind:{type:'string',enum:['Principal','Sous-panneau','Inconnu']},
  breakers:{type:'array',items:{type:'object',additionalProperties:false,
   required:['position','poles','half','spans_next','amps','label','label_source','protection','confidence'],
   properties:{
    position:{type:'integer',description:'Première position occupée (numérotation : impairs à gauche 1,3,5… de haut en bas ; pairs à droite 2,4,6…).'},
    poles:{type:'integer',enum:[1,2,3],description:'1 unipolaire, 2 bipolaire (positions n et n+2), 3 tripolaire.'},
    half:{type:'string',enum:['','A','B'],description:'Disjoncteur jumelé (tandem) : A = moitié du haut, B = moitié du bas. Vide sinon.'},
    spans_next:{type:'boolean',description:'true si ce disjoncteur occupe aussi le demi-emplacement suivant de la même colonne (ex. un 25 A sur 5B puis 7A) : donne alors half du premier. false sinon.'},
    amps:{...nullable('integer'),description:'Calibre lu sur la manette, null si illisible.'},
    label:{type:'string',description:'Désignation du circuit (répertoire de la porte ou étiquette), recopiée telle quelle. Vide si absente.'},
    label_source:{type:'string',enum:['breaker','directory','none']},
    protection:{type:'string',enum:['Standard','DDFT','Anti-arc','DDFT + anti-arc','Inconnue'],description:'DDFT (GFCI, bouton TEST), anti-arc (AFCI/CAFCI), ou Standard.'},
    confidence:{type:'number',description:'Confiance de 0 à 1 pour ce disjoncteur.'},
   }}},
  empty_positions:{type:'array',items:{type:'integer'},description:'Positions sans disjoncteur (obturateur ou espace vide).'},
  confidence:{type:'number',description:'Confiance globale de 0 à 1.'},
  warnings:{type:'array',items:{type:'string'},description:'Doutes et éléments à vérifier, en français.'},
  summary:{type:'string',description:'Résumé en une ou deux phrases, en français.'},
 },
};

// Photos de précision : configuration déjà établie (lecture précédente + corrections de l'utilisateur).
export function cleanPrevious(list){
 if(!Array.isArray(list))return [];
 return list.slice(0,200).filter(b=>Number.isInteger(b?.position)&&b.position>=1&&b.position<=84).map(b=>({
  position:b.position,half:b.half==='A'||b.half==='B'?b.half:'',poles:[1,2,3].includes(b.poles)?b.poles:1,spans_next:b.spans_next===true,
  amps:Number.isInteger(b.amps)?b.amps:null,label:String(b.label||'').slice(0,100),vacant:b.vacant===true,user_confirmed:b.user_confirmed===true}));
}
function previousPrompt(hint){
 const prev=cleanPrevious(hint.previous);
 if(!prev.length)return [];
 const panel={brand:String(hint.brand||'').slice(0,60),series:String(hint.series||'').slice(0,60),main_amps:Number.isInteger(hint.mainAmps)?hint.mainAmps:null,positions:Number.isInteger(hint.positions)?hint.positions:null};
 return [
  'PHOTOS DE PRÉCISION : une première lecture de ce panneau a déjà été faite. Les nouvelles photos sont des compléments (gros plans, autre angle, répertoire) pour préciser ce qui manquait ou était incertain.',
  'Renvoie la configuration COMPLÈTE du panneau : conserve les éléments déjà établis ci-dessous, ajoute ce qui manquait, et corrige seulement ce que les nouvelles photos montrent clairement. Ne modifie jamais un élément marqué user_confirmed: true (corrigé par l’utilisateur). Pour les éléments conservés sans nouvelle information, garde la même valeur et une confiance raisonnable.',
  'Panneau déjà identifié : '+JSON.stringify(panel),
  'Disjoncteurs déjà établis : '+JSON.stringify(prev),
 ];
}
export function scanPrompt(hint={}){
 const fams=Object.entries(FAMILIES).filter(([k])=>k!=='generic').map(([k,f])=>`${k} = ${f.name}`).join('; ');
 return [
  'Tu es un assistant pour maîtres électriciens au Québec. Analyse les photos et documents fournis d’un panneau de distribution résidentiel ou commercial léger (normes canadiennes).',
  'Objectif : reconstituer la configuration du panneau (marque, gamme, disjoncteur principal, nombre de positions, et chaque disjoncteur avec sa position, son nombre de pôles, son calibre et sa désignation).',
  'Numérotation canadienne habituelle : positions impaires dans la colonne de gauche (1, 3, 5… de haut en bas), paires à droite (2, 4, 6…). Un bipolaire occupe n et n+2 dans la même colonne ; donne sa première position. Un jumelé (tandem) loge deux demi-disjoncteurs dans une position : déclare-les séparément avec half A (haut) et B (bas). Vérifie chaque disjoncteur : un seul disjoncteur peut occuper deux demi-emplacements consécutifs à cheval sur deux positions, par exemple 5B et 7A (chauffage 25 A). Dans ce cas, déclare-le UNE seule fois avec half du premier demi-emplacement (B) et spans_next à true, sans déclarer le second séparément.',
  'Si les numéros sont imprimés sur le panneau ou le répertoire, ils ont priorité sur ta déduction.',
  'Le calibre est le nombre moulé sur la manette (15, 20, 30, 40…). Repère DDFT (bouton TEST, « GFCI »/« DDFT ») et anti-arc (« AFCI », « CAFCI », témoin).',
  'Les désignations viennent du répertoire collé sur la porte ou d’étiquettes : recopie-les telles quelles (français ou anglais), sans les traduire ni les inventer.',
  'Un fichier récapitulatif (PDF, CSV, texte, tableau) peut remplacer les photos : utilise ses colonnes (position, calibre, désignation).',
  'Ne devine jamais : mets null, une chaîne vide ou une confiance basse quand c’est illisible, et explique tes doutes dans warnings. N’inclus pas les positions que tu ne vois pas.',
  `Familles de produits connues : ${fams}. Choisis la famille seulement si la marque et la gamme correspondent.`,
  hint.brand?`Indication de l’utilisateur — marque : ${String(hint.brand).slice(0,60)}.`:'',
  hint.positions?`Indication de l’utilisateur — nombre de positions : ${Number(hint.positions)||''}.`:'',
  hint.note?`Note de l’utilisateur : ${String(hint.note).slice(0,300)}`:'',
  ...previousPrompt(hint),
 ].filter(Boolean).join('\n');
}

// Prépare les fichiers reçus (data URL) pour l'API Responses.
export function toInputParts(files,detail=process.env.OPENAI_IMAGE_DETAIL||'high'){
 if(!Array.isArray(files)||!files.length)throw new HttpError(400,'Ajoutez au moins une photo ou un fichier.');
 if(files.length>MAX_FILES)throw new HttpError(400,`${MAX_FILES} fichiers au maximum par analyse.`);
 let total=0;const parts=[];
 for(const f of files){
  const m=/^data:([a-z0-9.+\/-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(String(f?.data||''));
  if(!m)throw new HttpError(400,'Fichier illisible : '+String(f?.name||'').slice(0,60));
  const type=m[1].toLowerCase(),size=Math.floor(m[2].length*3/4);total+=size;
  if(total>MAX_BYTES)throw new HttpError(413,'Fichiers trop lourds : 3 Mo au total au maximum (les photos sont réduites automatiquement).');
  const name=String(f.name||'fichier').replace(/[^\p{L}\p{N}._ -]/gu,'').slice(0,80)||'fichier';
  if(/^image\/(jpeg|png|webp|gif)$/.test(type))parts.push({type:'input_image',image_url:`data:${type};base64,${m[2]}`,detail:['low','high','original','auto'].includes(detail)?detail:'high'});
  else if(type==='application/pdf')parts.push({type:'input_file',filename:name.endsWith('.pdf')?name:name+'.pdf',file_data:`data:application/pdf;base64,${m[2]}`});
  else if(/^(text\/(plain|csv|tab-separated-values)|application\/json)$/.test(type)){
   const text=Buffer.from(m[2],'base64').toString('utf8').slice(0,60000);
   parts.push({type:'input_text',text:`Contenu du fichier « ${name} » :\n${text}`});
  }
  else throw new HttpError(415,`Type de fichier non pris en charge : ${type}. Utilisez une photo (JPEG, PNG, WebP), un PDF, un CSV ou un fichier texte.`);
 }
 return parts;
}

// Extrait le texte JSON de la réponse brute de l'API Responses.
export function outputText(data){
 if(typeof data?.output_text==='string')return data.output_text;
 for(const item of data?.output||[])for(const c of item.content||[]){
  if(c.type==='refusal')throw new HttpError(422,'L’analyse a été refusée par le modèle : '+String(c.refusal||'').slice(0,200));
  if(c.type==='output_text')return c.text;
 }
 throw new HttpError(502,'Réponse de l’IA vide ou incomplète.');
}

export async function scanPanel({files,hint={},settings={}},{fetchImpl=fetch,timeoutMs=55000}={}){
 if(!aiConfigured())throw new HttpError(503,'L’analyse par IA n’est pas configurée sur ce serveur (OPENAI_API_KEY manquante).');
 const content=[{type:'input_text',text:scanPrompt(hint)},...toInputParts(files,imageDetail(settings))];
 const order=modelOrder(settings);
 const denied=[];
 const started=Date.now();
 for(const model of order){
  let res;
  try{
   res=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.OPENAI_API_KEY},
    body:JSON.stringify({model,input:[{role:'user',content}],store:false,
     text:{format:{type:'json_schema',name:'panneau_electrique',strict:true,schema:SCAN_SCHEMA}}}),
    signal:AbortSignal.timeout(Math.max(5000,timeoutMs-(Date.now()-started)))});
  }catch(e){throw new HttpError(504,e?.name==='TimeoutError'?'L’analyse a pris trop de temps. Réessayez avec moins de photos ou des photos plus nettes.':'Service d’IA injoignable. Réessayez dans un instant.');}
  const data=await res.json().catch(()=>({}));
  if(!res.ok){
   console.error('openai',model,res.status,data?.error?.code,data?.error?.message);
   // Modèle inexistant ou non autorisé pour ce projet OpenAI : on essaie le suivant.
   if(res.status===404||data?.error?.code==='model_not_found'){denied.push(model);deniedAt.set(model,Date.now());continue;}
   if(res.status===429)throw new HttpError(429,'Le service d’IA est très sollicité ou le crédit OpenAI est épuisé. Réessayez dans une minute.');
   if(res.status===401)throw new HttpError(503,'Clé OpenAI invalide : vérifiez la variable OPENAI_API_KEY.');
   throw new HttpError(502,'Le service d’IA n’a pas pu analyser ces fichiers.');
  }
  deniedAt.delete(model);
  console.log('openai ok',model,denied.length?'(repli après : '+denied.join(', ')+')':'');
  if(data.status==='incomplete')throw new HttpError(502,'Analyse incomplète : essayez avec moins de photos.');
  let scan;try{scan=JSON.parse(outputText(data));}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(502,'Réponse de l’IA illisible.');}
  return {scan,model,denied,usage:{input:data.usage?.input_tokens||0,output:data.usage?.output_tokens||0}};
 }
 throw new HttpError(503,`Votre projet OpenAI n’a accès à aucun de ces modèles : ${denied.join(', ')}. Autorisez-en un dans platform.openai.com (Settings → Project → Limits → modèles permis), ou choisissez un modèle accessible dans Administration → Intelligence artificielle.`);
}

// Test d'accès à un modèle (console d'administration) : petite requête texte, sans image.
export async function testModel(model,{fetchImpl=fetch}={}){
 if(!aiConfigured())return {ok:false,message:'OPENAI_API_KEY manquante.'};
 if(!MODEL_ID.test(model))return {ok:false,message:'Identifiant invalide.'};
 const t=Date.now();
 try{
  const res=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.OPENAI_API_KEY},
   body:JSON.stringify({model,input:'Réponds seulement : OK',max_output_tokens:16,store:false}),signal:AbortSignal.timeout(20000)});
  const data=await res.json().catch(()=>({}));
  if(res.ok){deniedAt.delete(model);return {ok:true,ms:Date.now()-t,message:'Accessible'};}
  if(res.status===404||data?.error?.code==='model_not_found'){deniedAt.set(model,Date.now());return {ok:false,status:res.status,message:'Non autorisé pour ce projet OpenAI (ou modèle inexistant).'};}
  if(res.status===401)return {ok:false,status:401,message:'Clé OpenAI invalide.'};
  if(res.status===429)return {ok:false,status:429,message:'Limite atteinte ou crédit épuisé.'};
  return {ok:false,status:res.status,message:String(data?.error?.message||'Erreur '+res.status).slice(0,200)};
 }catch(e){return {ok:false,message:e?.name==='TimeoutError'?'Délai dépassé.':'Service injoignable.'};}
}

// Droits : forfaits payants (abonnement actif hors forfait gratuit), fonction « ai » explicite, ou administrateurs.
// Quota mensuel : features.aiScans si défini, sinon 100 (forfaits Électricien) ou 20 (autres forfaits payants).
export function aiAllowance(e,isAdmin){
 if(isAdmin)return {allowed:true,monthly:null};
 const f=e.plan.features||{};
 const paid=e.live&&e.plan.id!=='gratuit';
 if(!(paid||f.ai))return {allowed:false,monthly:0};
 return {allowed:true,monthly:Number.isInteger(f.aiScans)?f.aiScans:f.planning?100:20};
}
