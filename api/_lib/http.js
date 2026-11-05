// Utilitaires HTTP communs aux fonctions Vercel.
export class HttpError extends Error{constructor(status,message,extra){super(message);this.status=status;this.extra=extra;}}
const nativeOrigins=['capacitor://localhost','https://localhost','http://localhost','ionic://localhost'];
export function cors(req,res){
 const origin=req.headers.origin;
 const extra=(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(origin&&(nativeOrigins.includes(origin)||extra.includes(origin))){
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-MP-Client');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Max-Age','600');
 }
}
export function body(req){
 const b=req.body;
 if(b==null||b==='')return {};
 if(typeof b==='string'){try{return JSON.parse(b);}catch{throw new HttpError(400,'Requête JSON invalide.');}}
 if(Buffer.isBuffer(b)){try{return JSON.parse(b.toString('utf8'));}catch{throw new HttpError(400,'Requête JSON invalide.');}}
 return b;
}
export const isUuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function route(methods,fn){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  cors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!methods.includes(req.method)){res.setHeader('Allow',methods.join(', '));return res.status(405).json({error:'Méthode non permise.'});}
  try{return await fn(req,res);}
  catch(e){
   if(e instanceof HttpError||e.status)return res.status(e.status).json({error:e.message,...(e.extra||{})});
   console.error('api',req.url,e?.message);
   return res.status(500).json({error:'Erreur du serveur. Réessayez dans un instant.'});
  }
 };
}
// Convertit une erreur de validation du modèle en 400.
export const check=fn=>{try{return fn();}catch(e){throw new HttpError(400,e.message);}};
export const clientIp=req=>String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0].trim()||'inconnu';
