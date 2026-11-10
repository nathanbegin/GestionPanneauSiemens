// Sites (adresses) d'un utilisateur et résumé de leurs panneaux.
import {getSql} from './_lib/db.js';
import {route,body,HttpError,isUuid,check} from './_lib/http.js';
import {requireUser,newId} from './_lib/auth.js';
import {assertCanCreateSite} from './_lib/plans.js';
import {cleanSite} from '../public/model.js';
import {siteOut,panelSummary} from './_lib/serialize.js';
import {sharesFor,siteAccess,need} from './_lib/shares.js';

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
  // Sites et panneaux partagés par les membres de l'équipe.
  const sh=await sharesFor(sql,user.id);
  if(sh.length){
   const siteIds=[...new Set(sh.filter(s=>s.site_id).map(s=>s.site_id))],panelIds=[...new Set(sh.filter(s=>s.panel_id).map(s=>s.panel_id))];
   const sp=await sql`SELECT id,site_id,name,tag,kind,location,positions,details,circuits,updated_at FROM app_panels WHERE site_id=ANY(${siteIds}::uuid[]) OR id=ANY(${panelIds}::uuid[])`;
   const allSites=[...new Set([...siteIds,...sp.map(p=>p.site_id)])];
   const srows=await sql`SELECT s.*,(SELECT count(*)::int FROM app_panels p WHERE p.site_id=s.id) AS panel_count FROM app_sites s WHERE s.id=ANY(${allSites}::uuid[]) AND s.user_id<>${user.id}`;
   for(const r of srows){
    const whole=sh.filter(s=>s.site_id===r.id);
    const ps=sp.filter(p=>p.site_id===r.id&&(whole.length||panelIds.includes(p.id))).map(panelSummary);
    const by=(whole[0]||sh.find(s=>ps.some(p=>p.id===s.panel_id)))?.owner_name||'';
    out.push({...siteOut(r),panelCount:ps.length,shared:{by,scope:whole.length?'site':'panels',canEdit:whole.some(s=>s.can_edit)},panels:ps.map(p=>({id:p.id,name:p.name,tag:p.tag,kind:p.kind,progress:p.stats.progress}))});
   }
  }
  return res.status(200).json({sites:out});
 }
 if(req.method==='POST'){
  const site=check(()=>cleanSite(body(req)));
  const [{n}]=await sql`SELECT count(*)::int AS n FROM app_sites WHERE user_id=${user.id}`;
  if(n>=200)throw new HttpError(400,'Limite de 200 sites atteinte.');
  await assertCanCreateSite(sql,user.id);
  const [row]=await sql`INSERT INTO app_sites(id,user_id,name,client,street,city,province,postal_code,notes,bipolar_volts) VALUES(${newId()},${user.id},${site.name},${site.client},${site.street},${site.city},${site.province},${site.postalCode},${site.notes},${site.bipolarVolts}) RETURNING *`;
  return res.status(201).json({site:siteOut(row)});
 }
 if(!id)throw new HttpError(400,'Site manquant.');
 const acc=need(await siteAccess(sql,user.id,id),req.method==='PUT','Site');
 if(req.method==='DELETE'&&acc.role!=='owner')throw new HttpError(403,'Seul le propriétaire peut supprimer ce site.');
 const row=acc.site;
 if(req.method==='GET'){
  let panels=await sql`SELECT id,site_id,name,tag,kind,location,positions,details,circuits,updated_at FROM app_panels WHERE site_id=${id} ORDER BY created_at`;
  if(acc.role==='panels')panels=panels.filter(p=>acc.panelIds.includes(p.id));
  return res.status(200).json({site:{...siteOut(row),shared:acc.role==='owner'?null:{by:acc.by,role:acc.role}},panels:panels.map(panelSummary),access:acc.role});
 }
 if(req.method==='PUT'&&acc.role==='panels')throw new HttpError(403,'Seuls certains panneaux de ce site vous sont partagés.');
 if(req.method==='PUT'){
  const site=check(()=>cleanSite(body(req)));
  const [u]=await sql`UPDATE app_sites SET name=${site.name},client=${site.client},street=${site.street},city=${site.city},province=${site.province},postal_code=${site.postalCode},notes=${site.notes},bipolar_volts=${site.bipolarVolts},updated_at=now() WHERE id=${id} RETURNING *`;
  return res.status(200).json({site:siteOut(u)});
 }
 await sql`DELETE FROM app_sites WHERE id=${id} AND user_id=${user.id}`;
 return res.status(200).json({ok:true});
});
