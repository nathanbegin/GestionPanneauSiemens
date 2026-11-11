// Corbeille : un site ou un panneau supprimé est conservé 30 jours (copie JSON) avant d'être effacé pour de bon.
// Le site / panneau est réellement supprimé des tables principales : aucune autre requête n'a à l'ignorer.
import {newId} from './auth.js';
import {entitlement} from './plans.js';
import {HttpError} from './http.js';
export const TRASH_DAYS=30;

export async function purgeExpired(sql){await sql`DELETE FROM app_trash WHERE expires_at<now()`;}
const put=(sql,{userId,kind,refId,title,data})=>sql`INSERT INTO app_trash(id,user_id,kind,ref_id,title,data,expires_at) VALUES(${newId()},${userId},${kind},${refId},${title},${JSON.stringify(data)}::jsonb,now()+make_interval(days=>${TRASH_DAYS}))`;

// L'historique des versions (20 dernières) suit le panneau dans la corbeille.
const historyOf=(sql,panelId)=>sql`SELECT user_id,at,revision,initial,snap FROM app_panel_history WHERE panel_id=${panelId} ORDER BY id DESC LIMIT 20`;
export async function trashPanel(sql,userId,panelRow){
 await put(sql,{userId,kind:'panel',refId:panelRow.id,title:(panelRow.tag?panelRow.tag+' · ':'')+panelRow.name,data:{panel:panelRow,history:{[panelRow.id]:await historyOf(sql,panelRow.id)}}});
}
export async function trashSite(sql,userId,siteRow,panelRows){
 const history={};for(const p of panelRows)history[p.id]=await historyOf(sql,p.id);
 await put(sql,{userId,kind:'site',refId:siteRow.id,title:siteRow.name,data:{site:siteRow,panels:panelRows,history}});
}
async function restoreHistory(sql,history={}){
 for(const [panelId,rows] of Object.entries(history))for(const h of [...rows].reverse())
  await sql`INSERT INTO app_panel_history(panel_id,user_id,at,revision,initial,snap) VALUES(${panelId},${h.user_id},${h.at},${h.revision},${h.initial},${JSON.stringify(h.snap)}::jsonb)`;
}
export async function listTrash(sql,userId){
 await purgeExpired(sql);
 const rows=await sql`SELECT id,kind,title,deleted_at,expires_at,data FROM app_trash WHERE user_id=${userId} ORDER BY deleted_at DESC`;
 return rows.map(r=>({id:r.id,kind:r.kind,title:r.title,deletedAt:r.deleted_at,expiresAt:r.expires_at,panels:r.kind==='site'?(r.data.panels||[]).length:undefined,siteName:r.kind==='panel'?undefined:undefined}));
}
export async function purgeTrash(sql,userId,id){await sql`DELETE FROM app_trash WHERE id=${id} AND user_id=${userId}`;}

const insertPanel=(sql,p)=>sql`INSERT INTO app_panels(id,user_id,site_id,name,tag,kind,location,positions,details,circuits,revision,created_at,updated_at)
 VALUES(${p.id},${p.user_id},${p.site_id},${p.name},${p.tag||''},${p.kind},${p.location||''},${p.positions},${JSON.stringify(p.details||{})}::jsonb,${JSON.stringify(p.circuits||[])}::jsonb,${(p.revision||0)+1},${p.created_at},now())`;

// Restaure un site (avec ses panneaux) ou un panneau (le site doit exister). Respecte les limites du forfait.
export async function restoreTrash(sql,userId,id){
 const [t]=await sql`SELECT * FROM app_trash WHERE id=${id} AND user_id=${userId}`;
 if(!t)throw new HttpError(404,'Élément introuvable dans la corbeille (peut-être expiré).');
 const ent=await entitlement(sql,userId);
 if(t.kind==='panel'){
  const p=t.data.panel;
  const [site]=await sql`SELECT id FROM app_sites WHERE id=${p.site_id} AND user_id=${userId}`;
  if(!site)throw new HttpError(409,'Le site de ce panneau n’existe plus : restaurez d’abord le site depuis la corbeille.');
  const [dup]=await sql`SELECT 1 FROM app_panels WHERE id=${p.id}`;
  if(dup)throw new HttpError(409,'Ce panneau existe déjà.');
  if(!ent.canCreatePanel)throw new HttpError(402,'Limite de panneaux atteinte : libérez de la place ou changez de forfait pour restaurer ce panneau.',{quota:true});
  await insertPanel(sql,p);
  await restoreHistory(sql,t.data.history);
 }else{
  const {site,panels=[]}=t.data;
  const [dup]=await sql`SELECT 1 FROM app_sites WHERE id=${site.id}`;
  if(dup)throw new HttpError(409,'Ce site existe déjà.');
  if(!ent.canCreateSite)throw new HttpError(402,'Limite de sites atteinte : libérez de la place ou changez de forfait pour restaurer ce site.',{quota:true});
  if(ent.limit!=null&&ent.credits<=0&&ent.used+panels.length>ent.limit)throw new HttpError(402,`Ce site contient ${panels.length} panneau(x) : la limite de votre forfait serait dépassée.`,{quota:true});
  await sql`INSERT INTO app_sites(id,user_id,name,client,street,city,province,postal_code,notes,bipolar_volts,created_at,updated_at) VALUES(${site.id},${userId},${site.name},${site.client||''},${site.street||''},${site.city||''},${site.province||'QC'},${site.postal_code||''},${site.notes||''},${site.bipolar_volts||240},${site.created_at},now())`;
  for(const p of panels)await insertPanel(sql,p);
  await restoreHistory(sql,t.data.history);
 }
 await sql`DELETE FROM app_trash WHERE id=${id}`;
 return {kind:t.kind,title:t.title,refId:t.ref_id};
}
