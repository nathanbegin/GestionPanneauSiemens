// Équipes : invitations par lien, annuaire des électriciens, demandes d'adhésion, gestion des membres.
// Les places (seats) viennent du forfait du propriétaire, propriétaire compris.
import {randomBytes,createHash} from 'node:crypto';
import {HttpError} from './http.js';
import {entitlement,LIVE} from './plans.js';
import {sendMail,mailConfigured,appUrl} from './mail.js';
import {rateLimit,recordAttempt} from './auth.js';

const sha=v=>createHash('sha256').update(String(v)).digest('hex');
const INVITE_DAYS=14;
const ownerName=u=>u.profile?.company||u.name;

async function ownerContext(sql,user){
 const e=await entitlement(sql,user.id);
 if(e.team?.role!=='owner')throw new HttpError(402,'La gestion d’équipe est incluse dans le forfait Électricien Équipe.',{quota:true});
 return e;
}
async function seatsUsed(sql,ownerId){
 const [{n}]=await sql`SELECT count(*)::int AS n FROM app_team_members WHERE owner_id=${ownerId} AND status='active'`;
 return n+1; // propriétaire compris
}
// Vérifie qu'un utilisateur peut rejoindre l'équipe d'un propriétaire.
async function assertCanJoin(sql,user,owner){
 if(owner.id===user.id)throw new HttpError(400,'C’est votre propre équipe.');
 const [cur]=await sql`SELECT owner_id,status FROM app_team_members WHERE user_id=${user.id}`;
 if(cur?.status==='active'&&cur.owner_id!==owner.id)throw new HttpError(409,'Vous faites déjà partie d’une autre équipe. Quittez-la d’abord.');
 if(cur?.status==='active')throw new HttpError(409,'Vous faites déjà partie de cette équipe.');
 const [{n}]=await sql`SELECT count(*)::int AS n FROM app_team_members WHERE owner_id=${user.id} AND status='active'`;
 if(n)throw new HttpError(409,'Vous avez déjà votre propre équipe.');
}
async function ownerEntitlement(sql,ownerId){
 const e=await entitlement(sql,ownerId);
 if(e.team?.role!=='owner')throw new HttpError(410,'Cette équipe n’est plus active (forfait du propriétaire).');
 return e;
}

export async function teamAction(sql,req,res,user,action,data){
 // ---------- Lecture : mon équipe ----------
 if(req.method==='GET'&&action==='team'){
  const e=await entitlement(sql,user.id);
  const [mine]=await sql`SELECT owner_id,status FROM app_team_members WHERE user_id=${user.id}`;
  if(e.team?.role==='owner'){
   const members=await sql`SELECT m.user_id,m.status,m.created_at,u.name,u.email FROM app_team_members m JOIN app_users u ON u.id=m.user_id WHERE m.owner_id=${user.id} ORDER BY m.status,m.created_at`;
   const invites=await sql`SELECT id,email,created_at,expires_at FROM app_team_invites WHERE owner_id=${user.id} AND used_by IS NULL AND NOT revoked AND expires_at>now() ORDER BY created_at DESC`;
   return res.status(200).json({role:'owner',plan:e.plan.name,seats:e.seats,used:await seatsUsed(sql,user.id),public:!!user.team_public,company:ownerName(user),
    members:members.filter(m=>m.status==='active').map(m=>({id:m.user_id,name:m.name,email:m.email,since:m.created_at})),
    requests:members.filter(m=>m.status==='pending').map(m=>({id:m.user_id,name:m.name,email:m.email,since:m.created_at})),
    invites:invites.map(i=>({id:i.id.slice(0,10),email:i.email,expiresAt:i.expires_at}))});
  }
  if(mine){
   const [o]=await sql`SELECT id,name,email,profile FROM app_users WHERE id=${mine.owner_id}`;
   return res.status(200).json({role:mine.status==='active'?'member':'pending',owner:o?{id:o.id,name:ownerName(o),contact:o.profile?.proEmail||o.email}:null,plan:e.team?.role==='member'?e.plan.name:null,ownSubscription:e.ownSubscription||null});
  }
  return res.status(200).json({role:'none',plan:e.plan.name,canOwn:false});
 }
 // ---------- Propriétaire : invitations ----------
 if(req.method==='POST'&&action==='team-invite'){
  const e=await ownerContext(sql,user);
  if(await seatsUsed(sql,user.id)>=e.seats)throw new HttpError(400,`Toutes les places de votre forfait sont occupées (${e.seats}).`);
  await rateLimit(sql,'invite:'+user.id,30,60);await recordAttempt(sql,'invite:'+user.id);
  const email=String(data.email||'').trim().toLowerCase().slice(0,200);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(400,'Adresse courriel invalide.');
  const token=randomBytes(24).toString('base64url');
  await sql`INSERT INTO app_team_invites(id,owner_id,email,expires_at) VALUES(${sha(token)},${user.id},${email},now()+make_interval(days=>${INVITE_DAYS}))`;
  const url=`${appUrl(req)}/app#/rejoindre/${token}`;
  let mailed=false;
  if(email&&mailConfigured()){try{await sendMail({to:email,subject:`${ownerName(user)} vous invite dans son équipe sur Mon Panneau`,text:`Bonjour,\n\n${user.name} (${ownerName(user)}) vous invite à rejoindre son équipe sur Mon Panneau.\n\nOuvrez ce lien (valide ${INVITE_DAYS} jours), puis connectez-vous ou créez un compte gratuit :\n${url}\n\nMon Panneau`});mailed=true;}catch(x){console.error('invite mail',x?.message);}}
  return res.status(201).json({url,mailed,expiresDays:INVITE_DAYS});
 }
 if(req.method==='POST'&&action==='team-invite-revoke'){
  await ownerContext(sql,user);
  await sql`UPDATE app_team_invites SET revoked=true WHERE owner_id=${user.id} AND left(id,10)=${String(data.id||'').slice(0,10)}`;
  return res.status(200).json({ok:true});
 }
 if(req.method==='POST'&&action==='team-public'){
  await ownerContext(sql,user);
  await sql`UPDATE app_users SET team_public=${!!data.public} WHERE id=${user.id}`;
  return res.status(200).json({ok:true,public:!!data.public});
 }
 if(req.method==='POST'&&action==='team-respond'){
  const e=await ownerContext(sql,user);
  const id=String(data.userId||'');
  if(data.accept){
   if(await seatsUsed(sql,user.id)>=e.seats)throw new HttpError(400,`Toutes les places de votre forfait sont occupées (${e.seats}).`);
   const [r]=await sql`UPDATE app_team_members SET status='active',updated_at=now() WHERE user_id=${id} AND owner_id=${user.id} AND status='pending' RETURNING user_id`;
   if(!r)throw new HttpError(404,'Demande introuvable.');
  }else await sql`DELETE FROM app_team_members WHERE user_id=${id} AND owner_id=${user.id} AND status='pending'`;
  return res.status(200).json({ok:true});
 }
 if(req.method==='POST'&&action==='team-remove'){
  await ownerContext(sql,user);
  await sql`DELETE FROM app_team_members WHERE user_id=${String(data.userId||'')} AND owner_id=${user.id}`;
  return res.status(200).json({ok:true});
 }
 // ---------- Membre : rejoindre, demander, quitter ----------
 if(req.method==='GET'&&action==='team-invite'){
  const [i]=await sql`SELECT i.*,u.name,u.profile FROM app_team_invites i JOIN app_users u ON u.id=i.owner_id WHERE i.id=${sha(String(req.query?.token||''))}`;
  if(!i||i.revoked||i.used_by||new Date(i.expires_at)<new Date())throw new HttpError(404,'Invitation expirée ou déjà utilisée. Demandez un nouveau lien à votre électricien.');
  return res.status(200).json({owner:ownerName(i),by:i.name,expiresAt:i.expires_at});
 }
 if(req.method==='POST'&&action==='team-join'){
  await rateLimit(sql,'join:'+user.id,10,60);
  const [i]=await sql`SELECT * FROM app_team_invites WHERE id=${sha(String(data.token||''))}`;
  if(!i||i.revoked||i.used_by||new Date(i.expires_at)<new Date()){await recordAttempt(sql,'join:'+user.id);throw new HttpError(404,'Invitation expirée ou déjà utilisée. Demandez un nouveau lien à votre électricien.');}
  const [owner]=await sql`SELECT * FROM app_users WHERE id=${i.owner_id}`;
  await assertCanJoin(sql,user,owner);
  const oe=await ownerEntitlement(sql,owner.id);
  if(await seatsUsed(sql,owner.id)>=oe.seats)throw new HttpError(400,'L’équipe est complète. Demandez à votre électricien de libérer une place.');
  const [u]=await sql`UPDATE app_team_invites SET used_by=${user.id},used_at=now() WHERE id=${i.id} AND used_by IS NULL RETURNING id`;
  if(!u)throw new HttpError(409,'Invitation déjà utilisée.');
  await sql`INSERT INTO app_team_members(user_id,owner_id,status) VALUES(${user.id},${owner.id},'active') ON CONFLICT (user_id) DO UPDATE SET owner_id=EXCLUDED.owner_id,status='active',updated_at=now()`;
  const [s]=await sql`SELECT plan_id,status,source FROM app_subscriptions WHERE user_id=${user.id}`;
  return res.status(200).json({ok:true,owner:ownerName(owner),ownSubscription:!!(s&&LIVE.includes(s.status)&&s.plan_id!=='gratuit'&&s.source!=='promo')});
 }
 if(req.method==='GET'&&action==='team-search'){
  await rateLimit(sql,'tsearch:'+user.id,60,10);await recordAttempt(sql,'tsearch:'+user.id);
  const q=String(req.query?.q||'').trim().slice(0,80);
  if(q.length<2)return res.status(200).json({results:[]});
  const like='%'+q.toLowerCase()+'%';
  const rows=await sql`SELECT u.id,u.name,u.profile FROM app_users u JOIN app_subscriptions s ON s.user_id=u.id
   WHERE u.team_public AND s.status=ANY(${LIVE}::text[]) AND (lower(u.profile->>'company') LIKE ${like} OR lower(u.name) LIKE ${like} OR lower(u.profile->>'address') LIKE ${like}) LIMIT 20`;
  const out=[];
  for(const r of rows){const e=await entitlement(sql,r.id);if(e.team?.role==='owner')out.push({id:r.id,company:ownerName(r),name:r.name,address:r.profile?.address||'',licence:r.profile?.licence?'RBQ '+r.profile.licence:''});}
  return res.status(200).json({results:out});
 }
 if(req.method==='POST'&&action==='team-request'){
  await rateLimit(sql,'treq:'+user.id,10,60);await recordAttempt(sql,'treq:'+user.id);
  const [owner]=await sql`SELECT * FROM app_users WHERE id=${String(data.ownerId||'')} AND team_public`;
  if(!owner)throw new HttpError(404,'Électricien introuvable dans l’annuaire.');
  await assertCanJoin(sql,user,owner);await ownerEntitlement(sql,owner.id);
  await sql`INSERT INTO app_team_members(user_id,owner_id,status) VALUES(${user.id},${owner.id},'pending') ON CONFLICT (user_id) DO UPDATE SET owner_id=EXCLUDED.owner_id,status='pending',updated_at=now()`;
  if(mailConfigured()){try{await sendMail({to:owner.profile?.proEmail||owner.email,subject:`${user.name} demande à rejoindre votre équipe Mon Panneau`,text:`Bonjour,\n\n${user.name} (${user.email}) demande à rejoindre votre équipe.\nAcceptez ou refusez la demande dans Mon Panneau → Mon équipe :\n${appUrl(req)}/app#/equipe\n\nMon Panneau`});}catch{}}
  return res.status(200).json({ok:true,owner:ownerName(owner)});
 }
 if(req.method==='POST'&&action==='team-leave'){
  await sql`DELETE FROM app_team_members WHERE user_id=${user.id}`;
  return res.status(200).json({ok:true});
 }
 return false;
}
