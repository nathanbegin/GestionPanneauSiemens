// Comptes, sessions et liens signés.
import {scrypt,randomBytes,createHash,createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
import {HttpError} from './http.js';
const scryptAsync=promisify(scrypt);
export const COOKIE='mp_session';
const SESSION_DAYS=30;
const sha=v=>createHash('sha256').update(String(v)).digest('hex');
const SCRYPT={N:16384,r:8,p:1,maxmem:64*1024*1024};

export async function hashPassword(password){
 const salt=randomBytes(16);
 const key=await scryptAsync(password.normalize('NFKC'),salt,64,SCRYPT);
 return ['scrypt',SCRYPT.N,SCRYPT.r,SCRYPT.p,salt.toString('base64'),key.toString('base64')].join('$');
}
export async function verifyPassword(password,stored){
 const [algo,N,r,p,salt,hash]=String(stored||'').split('$');
 if(algo!=='scrypt'||!salt||!hash)return false;
 const expected=Buffer.from(hash,'base64');
 const key=await scryptAsync(String(password).normalize('NFKC'),Buffer.from(salt,'base64'),expected.length,{N:+N,r:+r,p:+p,maxmem:SCRYPT.maxmem});
 return timingSafeEqual(key,expected);
}
export function checkPassword(password){
 if(typeof password!=='string'||password.length<10)throw new HttpError(400,'Le mot de passe doit contenir au moins 10 caractères.');
 if(password.length>200)throw new HttpError(400,'Mot de passe trop long.');
}
export function checkEmail(email){
 const e=String(email||'').trim().toLowerCase();
 if(e.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))throw new HttpError(400,'Adresse courriel invalide.');
 return e;
}
export const newId=()=>randomUUID();
export async function createSession(sql,userId,client='web'){
 const token=randomBytes(32).toString('base64url');
 await sql`INSERT INTO app_sessions(id,user_id,expires_at,client) VALUES(${sha(token)},${userId},now()+make_interval(days=>${SESSION_DAYS}),${client})`;
 return token;
}
export async function destroySession(sql,token){if(token)await sql`DELETE FROM app_sessions WHERE id=${sha(token)}`;}
function cookieToken(req){
 const raw=req.headers.cookie||'';
 for(const part of raw.split(';')){const [k,...v]=part.trim().split('=');if(k===COOKIE)return decodeURIComponent(v.join('='));}
 return '';
}
export function readToken(req){
 const bearer=String(req.headers.authorization||'').match(/^Bearer\s+(.+)$/i)?.[1];
 if(bearer)return {token:bearer.trim(),via:'bearer'};
 const c=cookieToken(req);return c?{token:c,via:'cookie'}:{token:'',via:''};
}
const secureCookie=req=>!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(String(req.headers.host||''));
export function setSessionCookie(req,res,token){
 res.setHeader('Set-Cookie',`${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS*86400}${secureCookie(req)?'; Secure':''}`);
}
export function clearSessionCookie(req,res){
 res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie(req)?'; Secure':''}`);
}
export const adminEmails=()=>String(process.env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
export const publicUser=u=>({id:u.id,email:u.email,name:u.name,profile:u.profile||{},createdAt:u.created_at,isAdmin:adminEmails().includes(u.email)});
export async function currentUser(req,sql){
 const {token,via}=readToken(req);
 if(!token)return null;
 // Protection CSRF : une écriture authentifiée par témoin doit porter l'en-tête applicatif.
 if(via==='cookie'&&req.method!=='GET'&&!req.headers['x-mp-client'])throw new HttpError(403,'Requête refusée.');
 const [u]=await sql`SELECT u.* FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.id=${sha(token)} AND s.expires_at>now()`;
 return u||null;
}
export async function requireUser(req,sql){
 const u=await currentUser(req,sql);
 if(!u)throw new HttpError(401,'Session expirée. Connectez-vous de nouveau.',{auth:true});
 return u;
}
// Limitation simple des tentatives (connexion, inscription, réinitialisation).
export async function rateLimit(sql,key,max,minutes){
 const [{n}]=await sql`SELECT count(*)::int AS n FROM app_rate WHERE key=${key} AND at>now()-make_interval(mins=>${minutes})`;
 if(n>=max)throw new HttpError(429,'Trop de tentatives. Patientez quelques minutes avant de réessayer.');
}
export async function recordAttempt(sql,key){
 await sql`INSERT INTO app_rate(key) VALUES(${key})`;
 if(Math.random()<0.05)await sql`DELETE FROM app_rate WHERE at<now()-interval '1 day'`;
}
export async function createResetToken(sql,userId){
 const token=randomBytes(32).toString('base64url');
 await sql`INSERT INTO app_resets(id,user_id,expires_at) VALUES(${sha(token)},${userId},now()+interval '1 hour')`;
 return token;
}
export async function consumeResetToken(sql,token){
 const [row]=await sql`UPDATE app_resets SET used=true WHERE id=${sha(token)} AND used=false AND expires_at>now() RETURNING user_id`;
 return row?.user_id||null;
}
// Liens de téléchargement signés et temporaires (PDF ouverts dans un navigateur ou depuis l'app mobile).
const secret=()=>process.env.APP_SECRET||sha('mon-panneau:'+(process.env.DATABASE_URL||''));
const canonical=params=>Object.entries(params).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('&');
export function sign(params,ttlSeconds=600){
 const exp=Math.floor(Date.now()/1000)+ttlSeconds;
 return {exp,sig:createHmac('sha256',secret()).update(canonical({...params,exp})).digest('base64url')};
}
export function verifySignature(params,sig){
 if(!sig||!params.exp||+params.exp<Date.now()/1000)return false;
 const expected=createHmac('sha256',secret()).update(canonical(params)).digest();
 const given=Buffer.from(String(sig),'base64url');
 return given.length===expected.length&&timingSafeEqual(given,expected);
}
