// Inscription, connexion, session courante, déconnexion et mot de passe oublié.
import {getSql} from './_lib/db.js';
import {route,body,HttpError,clientIp} from './_lib/http.js';
import {hashPassword,verifyPassword,checkPassword,checkEmail,newId,createSession,destroySession,readToken,setSessionCookie,clearSessionCookie,publicUser,currentUser,rateLimit,recordAttempt,createResetToken,consumeResetToken} from './_lib/auth.js';
import {sendMail,mailConfigured,appUrl} from './_lib/mail.js';
import {mailText} from './_lib/mail-text.js';
import {termsRecord} from './_lib/terms.js';
import {handleSso} from './_lib/sso/index.js'; // SSO

// Empreinte factice pour garder un temps de réponse comparable quand le compte n'existe pas.
const DUMMY='scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$'+Buffer.alloc(64).toString('base64');

async function startSession(req,res,sql,user,status=200){
 const client=req.headers['x-mp-client']==='native'?'native':'web';
 const token=await createSession(sql,user.id,client);
 setSessionCookie(req,res,token);
 return res.status(status).json({user:publicUser(user),token:client==='native'?token:undefined});
}

export default route(['GET','POST'],async(req,res)=>{
 const sql=await getSql();
 const action=String(req.query?.action||(req.method==='GET'?'me':''));
 {const r=await handleSso(req,res,sql,action);if(r!==false)return r;} // SSO
 if(req.method==='GET'){
  if(action!=='me')throw new HttpError(404,'Action inconnue.');
  const u=await currentUser(req,sql);
  const zebra=!!(process.env.PANELS_API_KEY||process.env.ETIQUETTES_API_KEY||process.env.ZEBRAHD_API_KEY);
  return res.status(200).json({user:u?publicUser(u):null,features:{mail:mailConfigured(),zebra}});
 }
 if(!req.headers['x-mp-client'])throw new HttpError(403,'Requête refusée.');
 const data=body(req),ip=clientIp(req);
 if(action==='signup'){
  await rateLimit(sql,'signup:'+ip,10,60);
  const email=checkEmail(data.email);checkPassword(data.password);
  const name=String(data.name||'').trim().slice(0,100);
  if(!name)throw new HttpError(400,'Indiquez votre nom.');
  if(!data.acceptTerms)throw new HttpError(400,'Vous devez accepter les conditions d’utilisation.');
  const accountType=data.accountType==='pro'?'pro':'particulier';
  const lang=data.lang==='en'?'en':'fr';
  await recordAttempt(sql,'signup:'+ip);
  const [exists]=await sql`SELECT 1 FROM app_users WHERE email=${email}`;
  if(exists)throw new HttpError(409,'Un compte existe déjà avec cette adresse. Connectez-vous ou réinitialisez votre mot de passe.');
  const id=newId(),hash=await hashPassword(data.password);
  const [user]=await sql`INSERT INTO app_users(id,email,password_hash,name,profile) VALUES(${id},${email},${hash},${name},${JSON.stringify({accountType,lang,...termsRecord()})}::jsonb) RETURNING *`;
  return startSession(req,res,sql,user,201);
 }
 if(action==='login'){
  const email=checkEmail(data.email);
  await rateLimit(sql,'login:'+email,8,15);await rateLimit(sql,'login-ip:'+ip,30,15);
  const [user]=await sql`SELECT * FROM app_users WHERE email=${email}`;
  const ok=await verifyPassword(String(data.password||''),user?.password_hash||DUMMY);
  if(!user||!ok){await recordAttempt(sql,'login:'+email);await recordAttempt(sql,'login-ip:'+ip);throw new HttpError(401,'Courriel ou mot de passe incorrect.');}
  return startSession(req,res,sql,user);
 }
 if(action==='logout'){
  await destroySession(sql,readToken(req).token);clearSessionCookie(req,res);
  return res.status(200).json({ok:true});
 }
 if(action==='forgot'){
  const email=checkEmail(data.email);
  await rateLimit(sql,'forgot:'+ip,5,60);await recordAttempt(sql,'forgot:'+ip);
  if(!mailConfigured())throw new HttpError(503,'La réinitialisation par courriel n’est pas encore activée sur ce serveur. Contactez l’administrateur.');
  const [user]=await sql`SELECT id,email,name FROM app_users WHERE email=${email}`;
  if(user){
   const token=await createResetToken(sql,user.id);
   await sendMail({to:user.email,...mailText('reset',user.profile?.lang,{name:user.name,url:`${appUrl(req)}/app#/reinitialiser/${token}`})});
  }
  return res.status(200).json({ok:true});
 }
 if(action==='reset'){
  checkPassword(data.password);
  await rateLimit(sql,'reset:'+ip,10,60);await recordAttempt(sql,'reset:'+ip);
  const userId=await consumeResetToken(sql,String(data.token||''));
  if(!userId)throw new HttpError(400,'Lien expiré ou déjà utilisé. Faites une nouvelle demande.');
  const hash=await hashPassword(data.password);
  const [user]=await sql`UPDATE app_users SET password_hash=${hash},updated_at=now() WHERE id=${userId} RETURNING *`;
  await sql`DELETE FROM app_sessions WHERE user_id=${userId}`;
  return startSession(req,res,sql,user);
 }
 throw new HttpError(404,'Action inconnue.');
});
