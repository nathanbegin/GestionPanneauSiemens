// Sites (adresses) d'un utilisateur et résumé de leurs panneaux.
import {getSql} from './_lib/db.js';
import {route,body,HttpError,isUuid,check} from './_lib/http.js';
import {requireUser,newId} from './_lib/auth.js';
import {assertCanCreateSite} from './_lib/plans.js';
import {cleanSite} from '../public/model.js';
import {siteOut,panelSummary} from './_lib/serialize.js';

export default route(['GET','POST','PUT','DELETE'],async(req,res)=>{
 const sql=await getSql();
 const user=await requireUser(req,sql);
 const id=req.query?.id?String(req.query.id):'';
 if(id&&!isUuid(id))throw new HttpError(404,'Site introuvable.');
 if(req.method==='GET'&&!id){
  const rows=await sql`SELECT s.*,(SELECT count(*)::int FROM app_panels p WHERE p.site_id=s.id) AS panel_count FROM app_sites s WHERE s.user_id=${user.id} ORDER BY lower(s.name)`;
  const panels=await sql`SELECT id,site_id,name,tag,kind,location,positions,details,circuits,updated_at FROM app_panels WHERE user_id=${user.id}`;
  const out=rows.map(siteOut);
  for(const site of out){const mine=panels.filter(p=>p.site_id===site.id).map(panelSummary);site.panels=mine.map(p=>({id:p.id,name:p.name,tag:p.tag,kind:p.kind,progress:p.stats.progress}));}
  return res.status(200).json({sites:out});
 }
 if(req.method==='POST'){
  const site=check(()=>cleanSite(body(req)));
  const [{n}]=await sql`SELECT count(*)::int AS n FROM app_sites WHERE user_id=${user.id}`;
  if(n>=200)throw new HttpError(400,'Limite de 200 sites atteinte.');
  await assertCanCreateSite(sql,user.id);
  const [row]=await sql`INSERT INTO app_sites(id,user_id,name,client,street,city,province,postal_code,notes) VALUES(${newId()},${user.id},${site.name},${site.client},${site.street},${site.city},${site.province},${site.postalCode},${site.notes}) RETURNING *`;
  return res.status(201).json({site:siteOut(row)});
 }
 if(!id)throw new HttpError(400,'Site manquant.');
 const [row]=await sql`SELECT * FROM app_sites WHERE id=${id} AND user_id=${user.id}`;
 if(!row)throw new HttpError(404,'Site introuvable.');
 if(req.method==='GET'){
  const panels=await sql`SELECT id,site_id,name,tag,kind,location,positions,details,circuits,updated_at FROM app_panels WHERE site_id=${id} ORDER BY created_at`;
  return res.status(200).json({site:siteOut(row),panels:panels.map(panelSummary)});
 }
 if(req.method==='PUT'){
  const site=check(()=>cleanSite(body(req)));
  const [u]=await sql`UPDATE app_sites SET name=${site.name},client=${site.client},street=${site.street},city=${site.city},province=${site.province},postal_code=${site.postalCode},notes=${site.notes},updated_at=now() WHERE id=${id} AND user_id=${user.id} RETURNING *`;
  return res.status(200).json({site:siteOut(u)});
 }
 await sql`DELETE FROM app_sites WHERE id=${id} AND user_id=${user.id}`;
 return res.status(200).json({ok:true});
});
