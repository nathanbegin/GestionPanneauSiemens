// Partage de sites et de panneaux entre membres d'une même équipe (forfait avec la fonction « team »).
// Un partage vaut seulement tant que la personne fait partie de l'équipe du partage (team_owner).
import {HttpError} from './http.js';
import {clientAccessOf} from './handoff.js';

// Propriétaire de l'équipe de l'utilisateur (lui-même s'il en a une), ou null.
export async function teamOwnerOf(sql,userId){
 const [m]=await sql`SELECT owner_id FROM app_team_members WHERE user_id=${userId} AND status='active'`;
 if(m)return m.owner_id;
 const [o]=await sql`SELECT 1 FROM app_team_members WHERE owner_id=${userId} AND status='active' LIMIT 1`;
 if(o)return userId;
 const [s]=await sql`SELECT 1 FROM app_subscriptions s JOIN app_plans p ON p.id=s.plan_id WHERE s.user_id=${userId} AND s.status IN ('active','trialing','past_due','comp') AND (p.features->>'team')::boolean IS TRUE`;
 return s?userId:null;
}
// Partages visibles par l'utilisateur (site ou panneau), avec le droit de modification.
export async function sharesFor(sql,userId){
 const team=await teamOwnerOf(sql,userId);
 if(!team)return [];
 return sql`SELECT sh.*,u.name AS owner_name FROM app_shares sh JOIN app_users u ON u.id=sh.owner_id
  WHERE sh.team_owner=${team} AND sh.owner_id<>${userId} AND (sh.target_user IS NULL OR sh.target_user=${userId})`;
}
const best=list=>list.length?(list.some(s=>s.can_edit)?'edit':'view'):null;
// Accès à un site : owner, edit, view, ou 'panels' (seulement certains panneaux partagés).
export async function siteAccess(sql,userId,siteId){
 const [site]=await sql`SELECT * FROM app_sites WHERE id=${siteId}`;
 if(!site)return null;
 if(site.user_id===userId)return {site,role:'owner'};
 const sh=await sharesFor(sql,userId);
 const r=best(sh.filter(s=>s.site_id===siteId));
 if(r)return {site,role:r,by:sh.find(s=>s.site_id===siteId).owner_name};
 const panels=sh.filter(s=>s.panel_id);
 if(panels.length){const ids=panels.map(s=>s.panel_id);const rows=await sql`SELECT id FROM app_panels WHERE site_id=${siteId} AND id=ANY(${ids}::uuid[])`;
  if(rows.length)return {site,role:'panels',panelIds:rows.map(r=>r.id),by:panels[0].owner_name};}
 // Accès client (consultation) remis par le propriétaire, distinct de l'équipe.
 const ca=await clientAccessOf(sql,userId,siteId);
 if(ca)return {site,role:'view',by:ca.by,client:true};
 return null;
}
export async function panelAccess(sql,userId,panelId){
 const [panel]=await sql`SELECT * FROM app_panels WHERE id=${panelId}`;
 if(!panel)return null;
 if(panel.user_id===userId)return {panel,role:'owner'};
 const sh=await sharesFor(sql,userId);
 const r=best(sh.filter(s=>s.panel_id===panelId||s.site_id===panel.site_id));
 if(r)return {panel,role:r,by:sh.find(s=>s.panel_id===panelId||s.site_id===panel.site_id).owner_name};
 const ca=await clientAccessOf(sql,userId,panel.site_id);
 return ca?{panel,role:'view',by:ca.by,client:true}:null;
}
export const canEdit=a=>a&&(a.role==='owner'||a.role==='edit');
export function need(a,write,what='Panneau'){
 if(!a)throw new HttpError(404,`${what} introuvable.`);
 if(write&&!canEdit(a))throw new HttpError(403,`${what} partagé en lecture seule : demandez au propriétaire le droit de modification.`);
 return a;
}

// ---------- Gestion des partages (propriétaire de la ressource) ----------
export async function shareAction(sql,req,res,user,action,data){
 const team=await teamOwnerOf(sql,user.id);
 const resource=async()=>{
  const siteId=data.siteId||req.query?.siteId,panelId=data.panelId||req.query?.panelId;
  if(siteId){const [s]=await sql`SELECT id,name FROM app_sites WHERE id=${String(siteId)} AND user_id=${user.id}`;if(!s)throw new HttpError(404,'Seul le propriétaire du site peut le partager.');return {siteId:s.id,panelId:null};}
  if(panelId){const [p]=await sql`SELECT id FROM app_panels WHERE id=${String(panelId)} AND user_id=${user.id}`;if(!p)throw new HttpError(404,'Seul le propriétaire du panneau peut le partager.');return {siteId:null,panelId:p.id};}
  throw new HttpError(400,'Site ou panneau manquant.');
 };
 if(action==='team-shares'){
  if(!team)return res.status(200).json({team:false,shares:[],members:[]});
  const r=await resource();
  const shares=await sql`SELECT sh.id,sh.target_user,sh.can_edit,u.name FROM app_shares sh LEFT JOIN app_users u ON u.id=sh.target_user WHERE sh.owner_id=${user.id} AND sh.team_owner=${team} AND sh.site_id IS NOT DISTINCT FROM ${r.siteId} AND sh.panel_id IS NOT DISTINCT FROM ${r.panelId}`;
  const members=await sql`SELECT u.id,u.name,u.email FROM app_users u WHERE u.id<>${user.id} AND (u.id=${team} OR u.id IN (SELECT user_id FROM app_team_members WHERE owner_id=${team} AND status='active')) ORDER BY u.name`;
  return res.status(200).json({team:true,shares:shares.map(s=>({id:s.id,target:s.target_user||'team',name:s.target_user?s.name:'Toute l’équipe',canEdit:s.can_edit})),members});
 }
 if(!team)throw new HttpError(402,'Le partage est inclus dans le forfait Électricien Équipe (vous et la personne devez faire partie de la même équipe).',{quota:true});
 if(action==='team-share'){
  const r=await resource();
  let target=null;
  if(data.target&&data.target!=='team'){
   const [m]=await sql`SELECT id FROM app_users WHERE id=${String(data.target)} AND (id=${team} OR id IN (SELECT user_id FROM app_team_members WHERE owner_id=${team} AND status='active'))`;
   if(!m||m.id===user.id)throw new HttpError(400,'Cette personne ne fait pas partie de votre équipe.');target=m.id;
  }
  await sql`DELETE FROM app_shares WHERE owner_id=${user.id} AND site_id IS NOT DISTINCT FROM ${r.siteId} AND panel_id IS NOT DISTINCT FROM ${r.panelId} AND target_user IS NOT DISTINCT FROM ${target}`;
  await sql`INSERT INTO app_shares(owner_id,team_owner,site_id,panel_id,target_user,can_edit) VALUES(${user.id},${team},${r.siteId},${r.panelId},${target},${!!data.canEdit})`;
  return res.status(200).json({ok:true});
 }
 if(action==='team-unshare'){
  await sql`DELETE FROM app_shares WHERE id=${String(data.id||'')}::uuid AND owner_id=${user.id}`;
  return res.status(200).json({ok:true});
 }
 return false;
}
