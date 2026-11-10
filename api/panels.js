// Panneaux électriques : création, lecture, modification (fiche, positions, circuits) et suppression.
import {getSql} from './_lib/db.js';
import {route,body,HttpError,isUuid,check} from './_lib/http.js';
import {requireUser,newId} from './_lib/auth.js';
import {consumePanelQuota,entitlement} from './_lib/plans.js';
import {library,findPanel,panelSnapshot} from './_lib/library.js';
import {adminEmails} from './_lib/auth.js';
import {siteOut,panelOut} from './_lib/serialize.js';
import {blank,validate,normalize,resize,highestPosition,cleanPanelMeta,MIN_POSITIONS,MAX_POSITIONS} from '../public/model.js';
import {siteAccess,panelAccess,need} from './_lib/shares.js';
import {scanPanel,scanNameplate,aiAllowance,aiConfigured,aiModel,loadAiSettings,LITE_MAX_FILES} from './_lib/ai.js';
import {scanToPanel} from '../public/aiscan.js';
import {rateLimit,recordAttempt} from './_lib/auth.js';

function checkPositions(v){
 const n=Number(v);
 if(!Number.isInteger(n)||n<MIN_POSITIONS||n>MAX_POSITIONS||n%2)throw new HttpError(400,`Choisissez un nombre pair de positions entre ${MIN_POSITIONS} et ${MAX_POSITIONS}.`);
 return n;
}
// Bibliothèque de produits réservée aux forfaits avec la fonction « planification » (et aux administrateurs).
async function hasLibrary(sql,user){
 if(adminEmails().includes(user.email))return true;
 const e=await entitlement(sql,user.id);return !!e.plan.features?.planning;
}
// Vérifie le modèle choisi et remplace l'instantané par les données officielles de la bibliothèque.
async function applyModel(sql,user,meta,previous){
 const id=meta.details.modelId;
 if(!id){Object.assign(meta.details,{family:meta.details.family||'',accepts:[],maxCircuits:null,tandem:true,pon:null,modelInfo:''});return;}
 if(previous?.modelId===id){Object.assign(meta.details,{family:previous.family,accepts:previous.accepts||[],maxCircuits:previous.maxCircuits??null,tandem:previous.tandem!==false,pon:previous.pon??null,modelInfo:previous.modelInfo||''});return;}
 if(!await hasLibrary(sql,user))throw new HttpError(402,'La bibliothèque de produits est incluse dans les forfaits Électricien.',{quota:true});
 const p=findPanel(id);
 if(!p||!p.designable)throw new HttpError(400,'Modèle introuvable dans la bibliothèque.');
 Object.assign(meta.details,panelSnapshot(p));
}
async function checkFedFrom(sql,meta,siteId,selfId){
 const f=meta.details.fedFrom;
 if(!f)return;
 if(!isUuid(f)||f===selfId)throw new HttpError(400,'Panneau d’alimentation invalide.');
 const sitePanels=await sql`SELECT id,details FROM app_panels WHERE site_id=${siteId}`;
 if(!sitePanels.some(p=>p.id===f))throw new HttpError(400,'Le panneau d’alimentation doit appartenir au même site.');
 if(selfId){const parentOf=new Map(sitePanels.map(p=>[p.id,p.details?.fedFrom||'']));for(let cur=f,i=0;cur&&i<60;cur=parentOf.get(cur),i++)if(cur===selfId)throw new HttpError(400,'Liaison impossible : elle créerait une boucle d’alimentation.');}
}

export default route(['GET','POST','PUT','DELETE'],async(req,res)=>{
 const sql=await getSql();
 const user=await requireUser(req,sql);
 if(req.method==='GET'&&req.query?.catalog){
  if(!await hasLibrary(sql,user))throw new HttpError(402,'La bibliothèque de produits est incluse dans les forfaits Électricien.',{quota:true});
  res.setHeader('Cache-Control','private, max-age=3600');
  return res.status(200).json(library());
 }
 // Ajout de panneau assisté par IA : statut (GET) et analyse de photos / fichiers (POST).
 if(req.query?.action==='scan'||req.query?.action==='nameplate'){
  const isPlate=req.query.action==='nameplate';
  const isAdmin=adminEmails().includes(user.email);
  const e=await entitlement(sql,user.id);
  const allow=aiAllowance(e,isAdmin);
  const [{n:used}]=await sql`SELECT count(*)::int AS n FROM app_ai_scans WHERE user_id=${user.id} AND ok AND created_at>=date_trunc('month',now())`;
  const settings=await loadAiSettings(sql);
  const status={configured:aiConfigured(),allowed:allow.allowed,monthly:allow.monthly,lite:allow.lite,maxFiles:allow.lite?LITE_MAX_FILES:null,used,model:aiModel(settings)};
  if(req.method==='GET')return res.status(200).json(status);
  if(req.method!=='POST')throw new HttpError(405,'Méthode non permise.');
  if(!allow.allowed)throw new HttpError(402,'L’ajout de panneau par photo (IA) est inclus dans les forfaits payants.',{quota:true});
  if(allow.monthly!=null&&used>=allow.monthly)throw new HttpError(402,`Vous avez utilisé vos ${allow.monthly} analyses par IA ce mois-ci.`,{quota:true});
  await rateLimit(sql,'ai:'+user.id,6,5);
  await recordAttempt(sql,'ai:'+user.id);
  const data=body(req);
  if(isPlate){
   // Plaque signalétique d'un appareil : puissance requise. Compte dans le quota d'analyses.
   let plate;
   try{plate=await scanNameplate({files:data.files,settings});}
   catch(x){await sql`INSERT INTO app_ai_scans(user_id,model,ok) VALUES(${user.id},${aiModel(settings)},false)`;throw x;}
   await sql`INSERT INTO app_ai_scans(user_id,model,input_tokens,output_tokens) VALUES(${user.id},${plate.model},${plate.usage.input},${plate.usage.output})`;
   return res.status(200).json({plate:plate.scan,model:plate.model,used:used+1,monthly:allow.monthly});
  }
  let out;
  try{out=await scanPanel({files:data.files,hint:data.hint||{},settings,lite:allow.lite});}
  catch(x){await sql`INSERT INTO app_ai_scans(user_id,model,ok) VALUES(${user.id},${aiModel(settings)},false)`;throw x;}
  await sql`INSERT INTO app_ai_scans(user_id,model,input_tokens,output_tokens) VALUES(${user.id},${out.model},${out.usage.input},${out.usage.output})`;
  if(!out.scan.is_panel)return res.status(200).json({notPanel:true,summary:out.scan.summary||'',warnings:out.scan.warnings||[],used:used+1,monthly:allow.monthly});
  const proposal=check(()=>scanToPanel(out.scan));
  return res.status(200).json({scan:out.scan,proposal,model:out.model,used:used+1,monthly:allow.monthly});
 }
 const id=req.query?.id?String(req.query.id):'';
 if(id&&!isUuid(id))throw new HttpError(404,'Panneau introuvable.');
 if(req.method==='POST'){
  const data=body(req);
  if(!isUuid(data.siteId))throw new HttpError(400,'Site manquant.');
  // Panneau ajouté dans son site ou dans un site partagé en modification (il appartient au propriétaire du site).
  const sa=await siteAccess(sql,user.id,data.siteId);
  if(!sa||!['owner','edit'].includes(sa.role))throw new HttpError(sa?403:404,sa?'Ce site vous est partagé en lecture seule.':'Site introuvable.');
  const site=sa.site,ownerId=site.user_id;
  const [{n}]=await sql`SELECT count(*)::int AS n FROM app_panels WHERE site_id=${site.id}`;
  if(n>=50)throw new HttpError(400,'Limite de 50 panneaux par site atteinte.');
  const meta=check(()=>cleanPanelMeta(data));
  await checkFedFrom(sql,meta,site.id,null);
  await applyModel(sql,user,meta,null);
  let positions=checkPositions(data.positions??32),circuits;
  if(data.copyFrom){
   if(!isUuid(data.copyFrom))throw new HttpError(400,'Panneau source invalide.');
   const src=(await panelAccess(sql,user.id,data.copyFrom))?.panel;
   if(!src)throw new HttpError(404,'Panneau source introuvable.');
   positions=src.positions;circuits=src.circuits;
  }else if(Array.isArray(data.circuits)){
   // Import d'un fichier JSON (schéma 1, 2 ou 3).
   circuits=check(()=>normalize(data.circuits,{positions:MAX_POSITIONS}));
   positions=Math.max(positions,highestPosition(circuits));if(positions%2)positions++;
   circuits=check(()=>resize(circuits,positions));
  }else circuits=blank(positions);
  const panelId=newId();
  await consumePanelQuota(sql,ownerId,panelId);
  const [row]=await sql`INSERT INTO app_panels(id,user_id,site_id,name,tag,kind,location,positions,details,circuits) VALUES(${panelId},${ownerId},${site.id},${meta.name},${meta.tag},${meta.kind},${meta.location},${positions},${JSON.stringify(meta.details)}::jsonb,${JSON.stringify(circuits)}::jsonb) RETURNING *`;
  await sql`UPDATE app_sites SET updated_at=now() WHERE id=${site.id}`;
  return res.status(201).json({panel:panelOut(row)});
 }
 if(!id)throw new HttpError(400,'Panneau manquant.');
 const pa=need(await panelAccess(sql,user.id,id),req.method==='PUT');
 if(req.method==='DELETE'&&pa.role!=='owner')throw new HttpError(403,'Seul le propriétaire peut supprimer ce panneau.');
 const row=pa.panel;
 if(req.method==='GET'){
  const [site]=await sql`SELECT * FROM app_sites WHERE id=${row.site_id}`;
  const all=await sql`SELECT id,name,tag,kind,details,circuits FROM app_panels WHERE site_id=${row.site_id} ORDER BY created_at`;
  const siblings=all.map(({id,name,tag,kind,details})=>({id,name,tag,kind,fedFrom:details?.fedFrom||'',fedFromCircuit:details?.fedFromCircuit||''}));
  // Sous-panneaux alimentés directement ou indirectement par ce panneau (pour le bilan de charge).
  const children=[],queue=[row.id],seen=new Set([row.id]);
  while(queue.length){const parent=queue.shift();for(const p of all)if(p.details?.fedFrom===parent&&!seen.has(p.id)){seen.add(p.id);queue.push(p.id);children.push({id:p.id,name:p.name,tag:p.tag,kind:p.kind,circuits:p.circuits});}}
  return res.status(200).json({panel:panelOut(row),site:siteOut(site),siblings,children,access:pa.role,sharedBy:pa.by||null});
 }
 if(req.method==='DELETE'){
  await sql`DELETE FROM app_panels WHERE id=${id} AND user_id=${row.user_id}`;
  // Les panneaux qui étaient alimentés par celui-ci perdent ce lien.
  await sql`UPDATE app_panels SET details=jsonb_set(details,'{fedFrom}','""'::jsonb) WHERE site_id=${row.site_id} AND details->>'fedFrom'=${id}`;
  return res.status(200).json({ok:true});
 }
 // PUT : mise à jour optimiste avec numéro de révision.
 const data=body(req);
 // Liaison d'alimentation seule (depuis la fiche du circuit qui alimente ce panneau) : met à jour
 // uniquement « Alimenté par » et « Circuit d'alimentation », sans toucher au reste de la fiche.
 if(data.feed!==undefined){
  const fedFrom=String(data.feed?.fedFrom||'');const fedFromCircuit=String(data.feed?.fedFromCircuit||'').trim().slice(0,40);
  if(fedFrom){
   if(!isUuid(fedFrom)||fedFrom===id)throw new HttpError(400,'Panneau d’alimentation invalide.');
   const sitePanels=await sql`SELECT id,details FROM app_panels WHERE site_id=${row.site_id}`;
   if(!sitePanels.some(p=>p.id===fedFrom))throw new HttpError(400,'Le panneau d’alimentation doit appartenir au même site.');
   // Pas de boucle : le panneau source ne peut pas être alimenté (directement ou non) par celui-ci.
   const parentOf=new Map(sitePanels.map(p=>[p.id,p.details?.fedFrom||'']));
   for(let cur=fedFrom,i=0;cur&&i<60;cur=parentOf.get(cur),i++)if(cur===id)throw new HttpError(400,'Liaison impossible : elle créerait une boucle d’alimentation.');
  }
  const [u]=await sql`UPDATE app_panels SET details=details||${JSON.stringify({fedFrom,fedFromCircuit:fedFrom?fedFromCircuit:''})}::jsonb,revision=revision+1,updated_at=now() WHERE id=${id} RETURNING *`;
  return res.status(200).json({panel:panelOut(u)});
 }
 if(!Number.isInteger(data.revision))throw new HttpError(400,'Révision manquante.');
 let {name,tag,kind,location,details,positions,circuits}=row;
 if(data.meta){const m=check(()=>cleanPanelMeta(data.meta));if(m.details.appliances===undefined&&row.details?.appliances)m.details.appliances=row.details.appliances;await checkFedFrom(sql,m,row.site_id,id);await applyModel(sql,user,m,row.details);({name,tag,kind,location,details}=m);}
 if(data.circuits!==undefined)circuits=check(()=>validate(normalize(data.circuits,{positions}),{positions}));
 if(data.positions!==undefined&&data.positions!==positions){positions=checkPositions(data.positions);circuits=check(()=>resize(circuits,positions));}
 const [u]=await sql`UPDATE app_panels SET name=${name},tag=${tag},kind=${kind},location=${location},details=${JSON.stringify(details)}::jsonb,positions=${positions},circuits=${JSON.stringify(circuits)}::jsonb,revision=revision+1,updated_at=now() WHERE id=${id} AND revision=${data.revision} RETURNING *`;
 if(!u)throw new HttpError(409,'Ce panneau a été modifié ailleurs (autre appareil ou onglet). Rechargez la page pour voir la dernière version.',{conflict:true});
 await sql`UPDATE app_sites SET updated_at=now() WHERE id=${row.site_id}`;
 return res.status(200).json({panel:panelOut(u)});
});
