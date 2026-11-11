// OpenID Connect : flux « code d'autorisation » avec PKCE et validation du jeton d'identité (sans dépendance).
import {createHash,createPublicKey,randomBytes,verify} from 'node:crypto';
import {HttpError} from '../http.js';

const b64u=b=>Buffer.from(b).toString('base64url');
export const newState=()=>({state:randomBytes(24).toString('base64url'),verifier:randomBytes(48).toString('base64url'),nonce:randomBytes(24).toString('base64url')});
export const challengeOf=verifier=>createHash('sha256').update(verifier).digest('base64url');

export function authorizeUrl(provider,client,{redirectUri,state,nonce,verifier}){
 const u=new URL(provider.endpoints().authorize);
 const q={client_id:client.id,redirect_uri:redirectUri,response_type:'code',scope:provider.scope,state,nonce,code_challenge:challengeOf(verifier),code_challenge_method:'S256',...(provider.extraAuthParams||{})};
 for(const [k,v] of Object.entries(q))u.searchParams.set(k,v);
 return u.toString();
}

const jwksCache=new Map();
async function loadJwks(url,fetchImpl,force){
 const hit=jwksCache.get(url);
 if(hit&&!force&&Date.now()-hit.at<600000)return hit.keys;
 const r=await fetchImpl(url);if(!r.ok)throw new HttpError(502,'Clés du fournisseur indisponibles.');
 const keys=(await r.json()).keys||[];jwksCache.set(url,{keys,at:Date.now()});return keys;
}

// Valide signature (RS256), émetteur, audience, expiration et nonce. Retourne les revendications.
export async function verifyIdToken(idToken,{provider,client,nonce,fetchImpl=fetch,now=Date.now()}){
 const parts=String(idToken||'').split('.');
 if(parts.length!==3)throw new HttpError(400,'Jeton invalide.');
 let header,claims;
 try{header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{throw new HttpError(400,'Jeton invalide.');}
 if(header.alg!=='RS256')throw new HttpError(400,'Algorithme de jeton refusé.');
 const url=provider.endpoints().jwks;
 let jwk=(await loadJwks(url,fetchImpl)).find(k=>k.kid===header.kid);
 if(!jwk)jwk=(await loadJwks(url,fetchImpl,true)).find(k=>k.kid===header.kid);
 if(!jwk)throw new HttpError(400,'Clé de signature inconnue.');
 const ok=verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url'));
 if(!ok)throw new HttpError(400,'Signature du jeton invalide.');
 const aud=[].concat(claims.aud||[]);
 if(!aud.includes(client.id))throw new HttpError(400,'Jeton destiné à une autre application.');
 if(!provider.issuerOk(claims))throw new HttpError(400,'Émetteur du jeton refusé.');
 if(!claims.exp||claims.exp*1000<now-60000)throw new HttpError(400,'Jeton expiré.');
 if(claims.nbf&&claims.nbf*1000>now+60000)throw new HttpError(400,'Jeton pas encore valide.');
 if(!claims.nonce||claims.nonce!==nonce)throw new HttpError(400,'Jeton rejoué ou invalide.');
 if(!claims.sub)throw new HttpError(400,'Jeton sans identifiant.');
 return claims;
}

export async function exchangeCode(provider,client,{code,redirectUri,verifier},fetchImpl=fetch){
 const r=await fetchImpl(provider.endpoints().token,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',accept:'application/json'},
  body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri,client_id:client.id,client_secret:client.secret,code_verifier:verifier}).toString()});
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.id_token)throw new HttpError(400,'Le fournisseur a refusé la connexion.');
 return data.id_token;
}
