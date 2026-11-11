// Connexion avec Google / Microsoft. Module autonome : pour le retirer (ex. migration vers Neon Auth),
// supprimer ce dossier, public/js/sso.js et les 3 lignes marquées « SSO » (voir README).
import {randomUUID} from 'node:crypto';
import {HttpError,clientIp} from '../http.js';
import {createSession,setSessionCookie,currentUser,requireUser,rateLimit,recordAttempt,sign,verifySignature} from '../auth.js';
import {appUrl} from '../mail.js';
import {PROVIDERS,clientOf,enabledProviders} from './providers.js';
import {newState,authorizeUrl,exchangeCode,verifyIdToken} from './oidc.js';
import {decide} from './decide.js';
import * as store from './store.js';
import {termsRecord} from '../terms.js';

const CK='mp_sso';
const secure=req=>!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(String(req.headers.host||''));
const cookieStr=(req,v,age)=>`${CK}=${encodeURIComponent(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure(req)?'; Secure':''}`;
const addCookie=(res,c)=>{const p=res.getHeader('Set-Cookie');res.setHeader('Set-Cookie',[].concat(p||[],c));};
const redirect=(res,url)=>{res.statusCode=302;res.setHeader('Location',url);res.end();};
const redirectUri=(req,id)=>`${appUrl(req)}/sso/callback/${id}`;
const readCookie=req=>{for(const part of String(req.headers.cookie||'').split(';')){const [k,...v]=part.trim().split('=');if(k===CK)return decodeURIComponent(v.join('='));}return '';};

function packState(p){const {exp,sig}=sign(p,600);return Buffer.from(JSON.stringify(p)).toString('base64url')+'.'+exp+'.'+sig;}
function unpackState(raw){
 const [b,exp,sig]=String(raw||'').split('.');if(!b||!exp||!sig)return null;
 try{const p=JSON.parse(Buffer.from(b,'base64url'));return verifySignature({...p,exp},sig)?p:null;}catch{return null;}
}

export async function handleSso(req,res,sql,action){
 if(!action.startsWith('sso-'))return false;
 const id=String(req.query?.provider||'');
 if(action==='sso-providers'){return res.status(200).json({providers:enabledProviders().map(p=>({id:p,label:PROVIDERS[p].label}))});}
 if(action==='sso-identities'){
  const user=await requireUser(req,sql);await store.ensureTable(sql);
  return res.status(200).json({identities:await store.listIdentities(sql,user.id),hasPassword:!!user.password_hash});
 }
 if(action==='sso-unlink'){
  if(req.method!=='POST'||!req.headers['x-mp-client'])throw new HttpError(403,'Requête refusée.');
  const user=await requireUser(req,sql);await store.ensureTable(sql);
  const list=await store.listIdentities(sql,user.id);
  if(!user.password_hash&&list.length<2)throw new HttpError(400,'Ajoutez d’abord un mot de passe (« Mot de passe oublié ») ou une autre connexion : vous ne pourriez plus accéder au compte.');
  await store.removeIdentity(sql,user.id,String(req.query?.provider||''));
  return res.status(200).json({ok:true});
 }
 if(action==='sso-start'||action==='sso-callback'){
  if(req.method!=='GET')throw new HttpError(405,'Méthode non permise.');
  const base=appUrl(req);
  const fail=code=>{addCookie(res,cookieStr(req,'',0));return redirect(res,`${base}/app?sso_error=${code}#/connexion`);};
  try{
   if(!enabledProviders().includes(id))return fail('unavailable');
   const provider=PROVIDERS[id],client=clientOf(id);
   if(action==='sso-start'){
    await rateLimit(sql,'sso:'+clientIp(req),30,15);await recordAttempt(sql,'sso:'+clientIp(req));
    const link=req.query?.mode==='link';
    const user=link?await currentUser(req,sql):null;
    if(link&&!user)return fail('session');
    const s=newState();
    const p={p:id,s:s.state,v:s.verifier,n:s.nonce,m:link?'link':'login',u:user?.id||'',l:req.query?.lang==='en'?'en':'fr'};
    addCookie(res,cookieStr(req,packState(p),600));
    return redirect(res,authorizeUrl(provider,client,{redirectUri:redirectUri(req,id),state:s.state,nonce:s.nonce,verifier:s.verifier}));
   }
   // Retour du fournisseur
   const st=unpackState(readCookie(req));
   if(req.query?.error||!req.query?.code)return fail('denied');
   if(!st||st.p!==id||st.s!==req.query.state)return fail('state');
   const idToken=await exchangeCode(provider,client,{code:String(req.query.code),redirectUri:redirectUri(req,id),verifier:st.v});
   const claims=await verifyIdToken(idToken,{provider,client,nonce:st.n});
   const email=String(provider.email(claims)||'').trim().toLowerCase();
   await store.ensureTable(sql);
   const d=decide({
    identityUser:await store.userByIdentity(sql,id,claims.sub),
    emailUser:email?await store.userByEmail(sql,email):null,
    emailVerified:!!provider.emailVerified(claims),hasEmail:!!email,currentUserId:st.u||''});
   if(d.action==='refuse')return fail(d.reason);
   if(st.m==='link'){
    const user=await currentUser(req,sql);if(!user||user.id!==st.u)return fail('session');
    if(d.action==='link')await store.addIdentity(sql,{provider:id,subject:claims.sub,userId:user.id,email});
    addCookie(res,cookieStr(req,'',0));return redirect(res,`${base}/app?sso=linked#/compte`);
   }
   let user=d.user;
   if(d.action==='create'){
    const name=String(claims.name||email.split('@')[0]).trim().slice(0,100);
    user=await store.createUser(sql,{id:randomUUID(),email,name,profile:{accountType:'particulier',lang:st.l,...termsRecord(),signupVia:id}});
   }
   if(d.action==='create'||d.action==='link-login')await store.addIdentity(sql,{provider:id,subject:claims.sub,userId:user.id,email});
   const token=await createSession(sql,user.id,'web');
   setSessionCookie(req,res,token);
   const set=res.getHeader('Set-Cookie');res.setHeader('Set-Cookie',[].concat(set||[],cookieStr(req,'',0)));
   return redirect(res,`${base}/app?sso=${d.action==='create'?'new':'ok'}#/sites`);
  }catch(e){console.error('sso',action,e?.message);return fail(e instanceof HttpError&&e.status===429?'rate':'failed');}
 }
 return false;
}
