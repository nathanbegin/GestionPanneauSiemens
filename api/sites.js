// Sites (adresses) d'un utilisateur et résumé de leurs panneaux.
import {getSql} from './_lib/db.js';
import {route,body,HttpError,isUuid,check} from './_lib/http.js';
import {requireUser,newId} from './_lib/auth.js';
import {assertCanCreateSite} from './_lib/plans.js';
import {cleanSite,designation,panelTitle} from '../public/model.js';
import {siteOut,panelSummary} from './_lib/serialize.js';
import {sharesFor,siteAccess,need} from './_lib/shares.js';
import {trashSite,listTrash,restoreTrash,purgeTrash} from './_lib/trash.js';

export default route(['GET','POST','PUT','DELETE'],async(req,res)=>{
 const sql=await getSql();
 const user=await requireUser(req,sql);
 const id=req.query?.id?String(req.query.id):'';
 if(id&&!isUuid(id))throw new HttpError(404,'Site introuvable.');
 // Corbeille : liste, restauration, suppression définitive.
 const action=String(req.query?.action||'');
 if(action==='trash'&&req.method==='GET')return res.status(200).json({items:await listTrash(sql,user.id)});
 if(action.startsWith('trash-')){
  const tid=String(req.query?.tid||'');if(!isUuid(tid))throw new HttpError(404,'Élément introuvable.');
  if(action==='trash-restore'&&req.method==='POST')return res.status(200).json({ok:true,...await restoreTrash(sql,user.id,tid)});
  if(action==='trash-purge'&&req.method==='DELETE'){await purgeTrash(sql,user.id,tid);return res.status(200).json({ok:true});}
 }
 // Recherche sur l'ensemble des sites de l'utilisateur : site, client, adresse, panneau, circuit.
 if(req.method==='GET'&&!id&&req.query?.search!==undefined){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const q=norm(String(req.query.search).slice(0,80)).trim();
  if(q.length<2)return res.status(200).json({results:[]});
  const has=(...v)=>v.some(x=>norm(x).includes(q));
  const sites=await sql`SELECT * FROM app_sites WHERE user_id=${user.id}`;
  const panels=await sql`SELECT id,site_id,name,tag,kind,location,details,circuits FROM app_panels WHERE user_id=${user.id}`;
  const byId=new Map(sites.map(x=>[x.id,x]));
  const out=[];
  for(const st of sites)if(has(st.name,st.client,st.street,st.city,st.notes))out.push({type:'site',siteId:st.id,title:st.name,sub:[st.client,st.city].filter(Boolean).join(' · ')});
  for(const p of panels){
   const st=byId.get(p.site_id);if(!st)continue;
   if(has(p.name,p.tag,p.location,p.details?.building,p.details?.brand,p.details?.model))out.push({type:'panel',siteId:st.id,panelId:p.id,title:panelTitle(p),sub:st.name+(p.location?' · '+p.location:'')});
   for(const c of p.circuits||[]){
    const tags=Object.values(c.tags||{}).flat();
    if(has(c.label,c.room,c.notes,c.exceptions,c.breakerRef,...tags))out.push({type:'circuit',siteId:st.id,panelId:p.id,title:(c.label||'Sans désignation'),sub:`${st.name} · ${panelTitle(p)} · circuit ${designation(c)}${c.room?' · '+c.room:''}`,q:String(req.query.search).slice(0,80)});
   }
  }
  return res.status(200).json({results:out.slice(0,40),more:out.length>40});
 }
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
 // Mise en corbeille (30 jours) avant la suppression : le site et ses panneaux sont récupérables.
 if(row.user_id===user.id){
  const prows=await sql`SELECT * FROM app_panels WHERE site_id=${id}`;
  await trashSite(sql,user.id,row,prows);
 }
 await sql`DELETE FROM app_sites WHERE id=${id} AND user_id=${user.id}`;
 return res.status(200).json({ok:true,trashed:true});
});
