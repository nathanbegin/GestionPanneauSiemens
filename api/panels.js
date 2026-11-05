// Panneaux électriques : création, lecture, modification (fiche, positions, circuits) et suppression.
import {getSql} from './_lib/db.js';
import {route,body,HttpError,isUuid,check} from './_lib/http.js';
import {requireUser,newId} from './_lib/auth.js';
import {consumePanelQuota} from './_lib/plans.js';
import {siteOut,panelOut} from './_lib/serialize.js';
import {blank,validate,normalize,resize,highestPosition,cleanPanelMeta,MIN_POSITIONS,MAX_POSITIONS} from '../public/model.js';

function checkPositions(v){
 const n=Number(v);
 if(!Number.isInteger(n)||n<MIN_POSITIONS||n>MAX_POSITIONS||n%2)throw new HttpError(400,`Choisissez un nombre pair de positions entre ${MIN_POSITIONS} et ${MAX_POSITIONS}.`);
 return n;
}
async function checkFedFrom(sql,meta,siteId,selfId){
 const f=meta.details.fedFrom;
 if(!f)return;
 if(!isUuid(f)||f===selfId)throw new HttpError(400,'Panneau d’alimentation invalide.');
 const [p]=await sql`SELECT id FROM app_panels WHERE id=${f} AND site_id=${siteId}`;
 if(!p)throw new HttpError(400,'Le panneau d’alimentation doit appartenir au même site.');
}

export default route(['GET','POST','PUT','DELETE'],async(req,res)=>{
 const sql=await getSql();
 const user=await requireUser(req,sql);
 const id=req.query?.id?String(req.query.id):'';
 if(id&&!isUuid(id))throw new HttpError(404,'Panneau introuvable.');
 if(req.method==='POST'){
  const data=body(req);
  if(!isUuid(data.siteId))throw new HttpError(400,'Site manquant.');
  const [site]=await sql`SELECT id FROM app_sites WHERE id=${data.siteId} AND user_id=${user.id}`;
  if(!site)throw new HttpError(404,'Site introuvable.');
  const [{n}]=await sql`SELECT count(*)::int AS n FROM app_panels WHERE site_id=${site.id}`;
  if(n>=50)throw new HttpError(400,'Limite de 50 panneaux par site atteinte.');
  const meta=check(()=>cleanPanelMeta(data));
  await checkFedFrom(sql,meta,site.id,null);
  let positions=checkPositions(data.positions??32),circuits;
  if(data.copyFrom){
   if(!isUuid(data.copyFrom))throw new HttpError(400,'Panneau source invalide.');
   const [src]=await sql`SELECT positions,circuits FROM app_panels WHERE id=${data.copyFrom} AND user_id=${user.id}`;
   if(!src)throw new HttpError(404,'Panneau source introuvable.');
   positions=src.positions;circuits=src.circuits;
  }else if(Array.isArray(data.circuits)){
   // Import d'un fichier JSON (schéma 1, 2 ou 3).
   circuits=check(()=>normalize(data.circuits,{positions:MAX_POSITIONS}));
   positions=Math.max(positions,highestPosition(circuits));if(positions%2)positions++;
   circuits=check(()=>resize(circuits,positions));
  }else circuits=blank(positions);
  const panelId=newId();
  await consumePanelQuota(sql,user.id,panelId);
  const [row]=await sql`INSERT INTO app_panels(id,user_id,site_id,name,tag,kind,location,positions,details,circuits) VALUES(${panelId},${user.id},${site.id},${meta.name},${meta.tag},${meta.kind},${meta.location},${positions},${JSON.stringify(meta.details)}::jsonb,${JSON.stringify(circuits)}::jsonb) RETURNING *`;
  await sql`UPDATE app_sites SET updated_at=now() WHERE id=${site.id}`;
  return res.status(201).json({panel:panelOut(row)});
 }
 if(!id)throw new HttpError(400,'Panneau manquant.');
 const [row]=await sql`SELECT * FROM app_panels WHERE id=${id} AND user_id=${user.id}`;
 if(!row)throw new HttpError(404,'Panneau introuvable.');
 if(req.method==='GET'){
  const [site]=await sql`SELECT * FROM app_sites WHERE id=${row.site_id}`;
  const all=await sql`SELECT id,name,tag,kind,details,circuits FROM app_panels WHERE site_id=${row.site_id} ORDER BY created_at`;
  const siblings=all.map(({id,name,tag,kind})=>({id,name,tag,kind}));
  // Sous-panneaux alimentés directement ou indirectement par ce panneau (pour le bilan de charge).
  const children=[],queue=[row.id],seen=new Set([row.id]);
  while(queue.length){const parent=queue.shift();for(const p of all)if(p.details?.fedFrom===parent&&!seen.has(p.id)){seen.add(p.id);queue.push(p.id);children.push({id:p.id,name:p.name,tag:p.tag,kind:p.kind,circuits:p.circuits});}}
  return res.status(200).json({panel:panelOut(row),site:siteOut(site),siblings,children});
 }
 if(req.method==='DELETE'){
  await sql`DELETE FROM app_panels WHERE id=${id} AND user_id=${user.id}`;
  // Les panneaux qui étaient alimentés par celui-ci perdent ce lien.
  await sql`UPDATE app_panels SET details=jsonb_set(details,'{fedFrom}','""'::jsonb) WHERE site_id=${row.site_id} AND details->>'fedFrom'=${id}`;
  return res.status(200).json({ok:true});
 }
 // PUT : mise à jour optimiste avec numéro de révision.
 const data=body(req);
 if(!Number.isInteger(data.revision))throw new HttpError(400,'Révision manquante.');
 let {name,tag,kind,location,details,positions,circuits}=row;
 if(data.meta){const m=check(()=>cleanPanelMeta(data.meta));await checkFedFrom(sql,m,row.site_id,id);({name,tag,kind,location,details}=m);}
 if(data.circuits!==undefined)circuits=check(()=>validate(normalize(data.circuits,{positions}),{positions}));
 if(data.positions!==undefined&&data.positions!==positions){positions=checkPositions(data.positions);circuits=check(()=>resize(circuits,positions));}
 const [u]=await sql`UPDATE app_panels SET name=${name},tag=${tag},kind=${kind},location=${location},details=${JSON.stringify(details)}::jsonb,positions=${positions},circuits=${JSON.stringify(circuits)}::jsonb,revision=revision+1,updated_at=now() WHERE id=${id} AND user_id=${user.id} AND revision=${data.revision} RETURNING *`;
 if(!u)throw new HttpError(409,'Ce panneau a été modifié ailleurs (autre appareil ou onglet). Rechargez la page pour voir la dernière version.',{conflict:true});
 await sql`UPDATE app_sites SET updated_at=now() WHERE id=${row.site_id}`;
 return res.status(200).json({panel:panelOut(u)});
});
