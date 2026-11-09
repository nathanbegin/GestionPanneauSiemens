// Profil, mot de passe, suppression du compte et import de l'ancienne version (clé d'accès unique).
import {createHash,timingSafeEqual} from 'node:crypto';
import {getSql} from './_lib/db.js';
import {route,body,HttpError,clientIp} from './_lib/http.js';
import {requireUser,publicUser,verifyPassword,hashPassword,checkPassword,newId,rateLimit,recordAttempt,clearSessionCookie,readToken} from './_lib/auth.js';
import {normalize,highestPosition,resize,FEEDBACK_CATEGORIES} from '../public/model.js';
import {decodeLogo} from './_lib/pdf.js';
import {entitlement} from './_lib/plans.js';
import {adminEmails} from './_lib/auth.js';
import {PDFDocument} from 'pdf-lib';
import {loadPdfSettings} from './_lib/footers.js';
import {teamAction} from './_lib/team.js';

const s=(v,max)=>String(v??'').trim().slice(0,max);
function cleanProfile(p={}){
 return {accountType:p.accountType==='pro'?'pro':'particulier',company:s(p.company,120),licence:s(p.licence,60),phone:s(p.phone,40),proEmail:s(p.proEmail,200),address:s(p.address,200)};
}
const same=(a,b)=>{const h=v=>createHash('sha256').update(String(v)).digest();return timingSafeEqual(h(a),h(b));};

export default route(['GET','PUT','POST','DELETE'],async(req,res)=>{
 const sql=await getSql();
 const user=await requireUser(req,sql);
 const action=String(req.query?.action||'');
 // Équipes (invitations, annuaire, demandes, gestion).
 if(action.startsWith('team')){const r=await teamAction(sql,req,res,user,action,req.method==='GET'?{}:body(req));if(r!==false)return r;}
 // Image de marque des PDF (logo, couleurs, pied de page).
 const canBrand=async()=>adminEmails().includes(user.email)||!!(await entitlement(sql,user.id)).plan.features?.branding;
 if(req.method==='GET'&&action==='branding'){const ps=await loadPdfSettings(sql);return res.status(200).json({branding:user.branding||{},allowed:await canBrand(),footers:(ps.footers||[]).map(({id,label,text})=>({id,label,text})),legal:ps.legal||''});}
 if(req.method==='GET')return res.status(200).json({user:publicUser(user)});
 const data=body(req);
 if(req.method==='PUT'&&action==='branding'){
  if(!await canBrand())throw new HttpError(402,'La personnalisation des documents est incluse dans les forfaits Électricien.',{quota:true});
  const color=v=>{const c=String(v||'').trim();if(!c)return '';if(!/^#[0-9a-fA-F]{6}$/.test(c))throw new HttpError(400,'Couleur invalide (format #RRVVBB).');return c.toLowerCase();};
  const branding={primary:color(data.primary),accent:color(data.accent),footer:s(data.footer,140),footerId:s(data.footerId,40)};
  if(branding.footerId){const ps=await loadPdfSettings(sql);if(!(ps.footers||[]).some(f=>f.id===branding.footerId))throw new HttpError(400,'Modèle de pied de page introuvable.');}
  if(data.logo){
   let l;try{l=decodeLogo(data.logo);}catch(e){throw new HttpError(400,e.message);}
   if(!l)throw new HttpError(400,'Le logo doit être une image PNG ou JPEG.');
   // Vérifie que l'image s'intègre réellement dans un PDF.
   try{const doc=await PDFDocument.create();l.type==='png'?await doc.embedPng(l.buf):await doc.embedJpg(l.buf);}catch{throw new HttpError(400,'Image du logo illisible.');}
   branding.logo=String(data.logo);
  }
  const [u]=await sql`UPDATE app_users SET branding=${JSON.stringify(branding)}::jsonb,updated_at=now() WHERE id=${user.id} RETURNING branding`;
  return res.status(200).json({branding:u.branding});
 }
 if(req.method==='PUT'&&action==='password'){
  await rateLimit(sql,'pwd:'+user.id,8,15);
  if(!await verifyPassword(String(data.current||''),user.password_hash)){await recordAttempt(sql,'pwd:'+user.id);throw new HttpError(400,'Mot de passe actuel incorrect.');}
  checkPassword(data.password);
  const hash=await hashPassword(data.password);
  await sql`UPDATE app_users SET password_hash=${hash},updated_at=now() WHERE id=${user.id}`;
  // Ferme les autres sessions.
  const current=createHash('sha256').update(readToken(req).token).digest('hex');
  await sql`DELETE FROM app_sessions WHERE user_id=${user.id} AND id<>${current}`;
  return res.status(200).json({ok:true});
 }
 if(req.method==='PUT'){
  const name=s(data.name,100);if(!name)throw new HttpError(400,'Indiquez votre nom.');
  const profile=cleanProfile(data.profile);
  const [u]=await sql`UPDATE app_users SET name=${name},profile=${JSON.stringify(profile)}::jsonb,updated_at=now() WHERE id=${user.id} RETURNING *`;
  return res.status(200).json({user:publicUser(u)});
 }
 if(req.method==='DELETE'){
  if(!await verifyPassword(String(data.password||''),user.password_hash))throw new HttpError(400,'Mot de passe incorrect. Le compte n’a pas été supprimé.');
  await sql`DELETE FROM app_users WHERE id=${user.id}`;
  clearSessionCookie(req,res);
  return res.status(200).json({ok:true});
 }
 if(req.method==='POST'&&action==='feedback'){
  // Suggestion d'amélioration : 10 envois par heure au maximum.
  await rateLimit(sql,'fb:'+user.id,10,60);
  const category=FEEDBACK_CATEGORIES.includes(data.category)?data.category:'Suggestion';
  const message=s(data.message,3000);
  if(message.length<5)throw new HttpError(400,'Décrivez votre suggestion en quelques mots.');
  const client=['web','ios','android'].includes(data.client)?data.client:'web';
  await recordAttempt(sql,'fb:'+user.id);
  await sql`INSERT INTO app_feedback(user_id,email,name,category,message,page,app_version,client) VALUES(${user.id},${user.email},${user.name},${category},${message},${s(data.page,200)},${s(data.version,20)},${client})`;
  return res.status(201).json({ok:true});
 }
 if(req.method==='POST'&&action==='legacy-import'){
  // Copie (sans rien supprimer) les panneaux de la version 1.x protégés par PANEL_ACCESS_KEY.
  await rateLimit(sql,'legacy:'+clientIp(req),6,30);
  if(!process.env.PANEL_ACCESS_KEY)throw new HttpError(404,'Aucune ancienne version n’est configurée sur ce serveur.');
  if(!same(String(data.key||''),process.env.PANEL_ACCESS_KEY)){await recordAttempt(sql,'legacy:'+clientIp(req));throw new HttpError(401,'Clé d’accès de l’ancienne version incorrecte.');}
  const panels=[];
  try{const [row]=await sql`SELECT circuits FROM panel_state WHERE id=1`;if(row)panels.push({name:'Panneau principal',kind:'Principal',circuits:row.circuits});}catch{}
  try{for(const r of await sql`SELECT name,circuits FROM panels_extra ORDER BY name`)panels.push({name:r.name,kind:'Sous-panneau',circuits:r.circuits});}catch{}
  if(!panels.length)throw new HttpError(404,'Aucun panneau trouvé dans l’ancienne version.');
  const siteId=newId();
  await sql`INSERT INTO app_sites(id,user_id,name,notes) VALUES(${siteId},${user.id},${s(data.siteName,100)||'Ma maison'},'Importé depuis la version 1.x.')`;
  for(const p of panels){
   let circuits=normalize(p.circuits),positions=Math.max(32,highestPosition(circuits));if(positions%2)positions++;
   circuits=resize(circuits,positions);
   await sql`INSERT INTO app_panels(id,user_id,site_id,name,kind,positions,details,circuits) VALUES(${newId()},${user.id},${siteId},${s(p.name,100)},${p.kind},${positions},${JSON.stringify({brand:'Siemens',model:'EQ',mainAmps:200,voltage:'120/240 V monophasé'})}::jsonb,${JSON.stringify(circuits)}::jsonb)`;
  }
  return res.status(201).json({siteId,count:panels.length});
 }
 throw new HttpError(404,'Action inconnue.');
});
