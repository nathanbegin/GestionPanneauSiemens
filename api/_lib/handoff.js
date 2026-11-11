// Remise d'un dossier (site) à un client :
//  - « access » : accès en consultation (lecture seule), distinct de l'équipe, révocable en tout temps ;
//  - « transfer » : copie indépendante du site et de ses panneaux dans le compte du destinataire (après acceptation).
import {randomBytes,createHash} from 'node:crypto';
import {newId} from './auth.js';
import {entitlement} from './plans.js';
import {HttpError} from './http.js';
import {sendMail,mailConfigured,appUrl} from './mail.js';
import {mailText} from './mail-text.js';

const DAYS=14;
const sha=v=>createHash('sha256').update(String(v)).digest('hex');
const normEmail=v=>String(v||'').trim().toLowerCase();
export const KINDS=['access','transfer'];

export async function createHandoff(sql,req,user,{siteId,kind,email,authorized}){
 if(!KINDS.includes(kind))throw new HttpError(400,'Type de remise invalide.');
 const mail=normEmail(email);
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail))throw new HttpError(400,'Adresse courriel invalide.');
 if(authorized!==true)throw new HttpError(400,'Confirmez que vous êtes autorisé à transmettre ces renseignements.');
 const [site]=await sql`SELECT id,name FROM app_sites WHERE id=${siteId} AND user_id=${user.id}`;
 if(!site)throw new HttpError(404,'Seul le propriétaire du site peut le remettre.');
 if(mail===normEmail(user.email))throw new HttpError(400,'Indiquez l’adresse de la personne à qui remettre le dossier.');
 // Une seule invitation ou un seul accès actif par personne et par type.
 await sql`UPDATE app_handoffs SET status='revoked' WHERE site_id=${siteId} AND owner_id=${user.id} AND kind=${kind} AND lower(email)=${mail} AND status IN ('pending','accepted')`;
 const token=randomBytes(32).toString('base64url');
 await sql`INSERT INTO app_handoffs(id,kind,owner_id,site_id,site_name,email,token_hash,expires_at) VALUES(${newId()},${kind},${user.id},${site.id},${site.name},${mail},${sha(token)},now()+make_interval(days=>${DAYS}))`;
 const url=`${appUrl(req)}/app#/remise/${token}`;
 let sent=false;
 if(mailConfigured()){try{await sendMail({to:mail,...mailText(kind==='access'?'handoffAccess':'handoffTransfer',user.profile?.lang,{who:user.name,site:site.name,url,days:DAYS})});sent=true;}catch(e){console.error('handoff mail',e?.message);}}
 return {url,sent,days:DAYS};
}
export async function listHandoffs(sql,userId,siteId){
 const rows=await sql`SELECT h.id,h.kind,h.email,h.status,h.created_at,h.expires_at,h.accepted_at,u.name AS accepted_name FROM app_handoffs h LEFT JOIN app_users u ON u.id=h.accepted_by WHERE h.site_id=${siteId} AND h.owner_id=${userId} AND h.status<>'revoked' ORDER BY h.created_at DESC`;
 return rows.map(r=>({id:r.id,kind:r.kind,email:r.email,status:r.status==='pending'&&new Date(r.expires_at)<new Date()?'expired':r.status,createdAt:r.created_at,acceptedAt:r.accepted_at,acceptedName:r.accepted_name||''}));
}
export async function revokeHandoff(sql,userId,hid){
 // Le propriétaire retire l'accès ; la personne qui l'a reçu peut aussi y renoncer. Une copie déjà remise reste à son destinataire.
 await sql`UPDATE app_handoffs SET status='revoked' WHERE id=${hid} AND (owner_id=${userId} OR accepted_by=${userId}) AND kind='access'`;
 await sql`UPDATE app_handoffs SET status='revoked' WHERE id=${hid} AND owner_id=${userId} AND kind='transfer' AND status='pending'`;
}
// Invitations en attente adressées à l'utilisateur (même courriel que son compte) : notification dans l'application.
export async function inboxFor(sql,user){
 const rows=await sql`SELECT h.id,h.kind,h.site_name,h.created_at,h.expires_at,u.name AS owner_name,(SELECT count(*)::int FROM app_panels p WHERE p.site_id=h.site_id) AS panels
  FROM app_handoffs h JOIN app_users u ON u.id=h.owner_id WHERE lower(h.email)=${normEmail(user.email)} AND h.status='pending' AND h.expires_at>now() AND h.owner_id<>${user.id} ORDER BY h.created_at DESC`;
 return rows.map(r=>({id:r.id,kind:r.kind,site:r.site_name,from:r.owner_name,panels:r.panels,createdAt:r.created_at,expiresAt:r.expires_at}));
}
const byRef=async(sql,{token,hid})=>{
 if(hid){const [h]=await sql`SELECT h.*,u.name AS owner_name,(SELECT count(*)::int FROM app_panels p WHERE p.site_id=h.site_id) AS panels FROM app_handoffs h JOIN app_users u ON u.id=h.owner_id WHERE h.id=${hid}`;return h||null;}
 return byToken(sql,token);
};
const byToken=async(sql,token)=>{
 const [h]=await sql`SELECT h.*,u.name AS owner_name,(SELECT count(*)::int FROM app_panels p WHERE p.site_id=h.site_id) AS panels FROM app_handoffs h JOIN app_users u ON u.id=h.owner_id WHERE h.token_hash=${sha(token)}`;
 return h||null;
};
export async function previewHandoff(sql,user,token){
 const h=await byToken(sql,token);
 if(!h||h.status==='revoked')throw new HttpError(404,'Invitation introuvable ou retirée.');
 const expired=h.status==='pending'&&new Date(h.expires_at)<new Date();
 return {kind:h.kind,from:h.owner_name,site:h.site_name,panels:h.panels,status:expired?'expired':h.status,forYou:normEmail(user.email)===normEmail(h.email),email:h.email};
}
// Accès en consultation : sites accessibles à l'utilisateur à ce titre.
export const clientSiteIds=async(sql,userId)=>(await sql`SELECT site_id FROM app_handoffs WHERE kind='access' AND status='accepted' AND accepted_by=${userId} AND site_id IS NOT NULL`).map(r=>r.site_id);
export async function clientAccessOf(sql,userId,siteId){
 const [h]=await sql`SELECT u.name AS owner_name FROM app_handoffs h JOIN app_users u ON u.id=h.owner_id WHERE h.kind='access' AND h.status='accepted' AND h.accepted_by=${userId} AND h.site_id=${siteId} LIMIT 1`;
 return h?{by:h.owner_name}:null;
}

export async function acceptHandoff(sql,user,ref){
 const h=await byRef(sql,typeof ref==='string'?{token:ref}:ref);
 if(!h||h.status==='revoked')throw new HttpError(404,'Invitation introuvable ou retirée.');
 if(h.status==='accepted')throw new HttpError(409,'Cette invitation a déjà été acceptée.');
 if(h.status!=='pending'||new Date(h.expires_at)<new Date())throw new HttpError(410,'Cette invitation a expiré : demandez-en une nouvelle.');
 if(normEmail(user.email)!==normEmail(h.email))throw new HttpError(403,`Cette invitation a été envoyée à ${h.email} : connectez-vous avec cette adresse.`);
 if(h.owner_id===user.id)throw new HttpError(400,'Vous ne pouvez pas accepter votre propre invitation.');
 if(h.kind==='access'){
  await sql`UPDATE app_handoffs SET status='accepted',accepted_by=${user.id},accepted_at=now() WHERE id=${h.id}`;
  return {kind:'access',siteId:h.site_id};
 }
 // Copie : nouveau site et nouveaux panneaux (identifiants neufs), indépendants de l'original.
 const [site]=await sql`SELECT * FROM app_sites WHERE id=${h.site_id}`;
 if(!site)throw new HttpError(404,'Le dossier n’existe plus.');
 const panels=await sql`SELECT * FROM app_panels WHERE site_id=${h.site_id} ORDER BY created_at`;
 const ent=await entitlement(sql,user.id);
 if(!ent.canCreateSite)throw new HttpError(402,'Limite de sites atteinte : changez de forfait ou libérez de la place pour recevoir ce dossier.',{quota:true});
 if(ent.limit!=null&&ent.credits<=0&&ent.used+panels.length>ent.limit)throw new HttpError(402,`Ce dossier contient ${panels.length} panneau(x) : la limite de votre forfait serait dépassée.`,{quota:true});
 const newSite=newId(),idMap=new Map(panels.map(p=>[p.id,newId()]));
 await sql`INSERT INTO app_sites(id,user_id,name,client,street,city,province,postal_code,notes,bipolar_volts) VALUES(${newSite},${user.id},${site.name},${site.client||''},${site.street||''},${site.city||''},${site.province||'QC'},${site.postal_code||''},${site.notes||''},${site.bipolar_volts||240})`;
 for(const p of panels){
  const details={...(p.details||{})};
  if(details.fedFrom)details.fedFrom=idMap.get(details.fedFrom)||'';
  await sql`INSERT INTO app_panels(id,user_id,site_id,name,tag,kind,location,positions,details,circuits) VALUES(${idMap.get(p.id)},${user.id},${newSite},${p.name},${p.tag||''},${p.kind},${p.location||''},${p.positions},${JSON.stringify(details)}::jsonb,${JSON.stringify(p.circuits||[])}::jsonb)`;
  await sql`INSERT INTO app_panel_events(user_id,panel_id,source) VALUES(${user.id},${idMap.get(p.id)},'plan')`;
 }
 await sql`UPDATE app_handoffs SET status='accepted',accepted_by=${user.id},accepted_at=now(),new_site_id=${newSite} WHERE id=${h.id}`;
 return {kind:'transfer',siteId:newSite};
}
export async function declineHandoff(sql,user,ref){
 const h=await byRef(sql,typeof ref==='string'?{token:ref}:ref);
 if(!h||normEmail(user.email)!==normEmail(h.email))throw new HttpError(404,'Invitation introuvable.');
 if(h.status==='pending')await sql`UPDATE app_handoffs SET status='declined' WHERE id=${h.id}`;
}
