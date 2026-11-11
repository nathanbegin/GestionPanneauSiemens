import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {decide} from '../api/_lib/sso/decide.js';
import {PROVIDERS,enabledProviders} from '../api/_lib/sso/providers.js';
import {authorizeUrl,challengeOf,verifyIdToken,newState} from '../api/_lib/sso/oidc.js';

test('décision de connexion externe',()=>{
 const u={id:'a'},v={id:'b'};
 assert.equal(decide({identityUser:u,emailUser:u,emailVerified:true,hasEmail:true}).action,'login');
 assert.equal(decide({emailUser:u,emailVerified:true,hasEmail:true}).action,'link-login');
 assert.equal(decide({emailUser:u,emailVerified:false,hasEmail:true}).reason,'unverified_exists'); // anti prise de contrôle par courriel non vérifié
 assert.equal(decide({emailVerified:true,hasEmail:true}).action,'create');
 assert.equal(decide({emailVerified:false,hasEmail:true}).reason,'unverified');
 assert.equal(decide({emailVerified:true,hasEmail:false}).reason,'no_email');
 assert.equal(decide({identityUser:v,currentUserId:'a',hasEmail:true}).reason,'taken');
 assert.equal(decide({currentUserId:'a',hasEmail:false}).action,'link');
 assert.equal(decide({identityUser:u,currentUserId:'a'}).action,'noop-link');
});
test('fournisseurs actifs selon l’environnement',()=>{
 const keep={...process.env};
 for(const k of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','MICROSOFT_CLIENT_ID','MICROSOFT_CLIENT_SECRET'])delete process.env[k];
 assert.deepEqual(enabledProviders(),[]);
 process.env.GOOGLE_CLIENT_ID='g';assert.deepEqual(enabledProviders(),[]); // le secret manque
 process.env.GOOGLE_CLIENT_SECRET='s';assert.deepEqual(enabledProviders(),['google']);
 process.env.MICROSOFT_CLIENT_ID='m';process.env.MICROSOFT_CLIENT_SECRET='s';assert.deepEqual(enabledProviders(),['google','microsoft']);
 Object.assign(process.env,keep);for(const k of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','MICROSOFT_CLIENT_ID','MICROSOFT_CLIENT_SECRET'])if(!(k in keep))delete process.env[k];
});
test('URL d’autorisation avec PKCE',()=>{
 const s=newState();
 const u=new URL(authorizeUrl(PROVIDERS.google,{id:'cid'},{redirectUri:'https://x.ca/sso/callback/google',...s}));
 assert.equal(u.searchParams.get('code_challenge'),challengeOf(s.verifier));
 assert.equal(u.searchParams.get('code_challenge_method'),'S256');
 assert.equal(u.searchParams.get('state'),s.state);assert.equal(u.searchParams.get('nonce'),s.nonce);
 assert.equal(u.searchParams.get('response_type'),'code');
});

const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'k1',alg:'RS256',use:'sig'};
const other=generateKeyPairSync('rsa',{modulusLength:2048});
const fakeFetch=async()=>({ok:true,json:async()=>({keys:[jwk]})});
const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function token(claims,key=privateKey,header={alg:'RS256',kid:'k1'}){
 const data=b(header)+'.'+b(claims);
 return data+'.'+createSign('RSA-SHA256').update(data).sign(key).toString('base64url');
}
const now=Math.floor(Date.now()/1000);
const good={iss:'https://accounts.google.com',aud:'cid',sub:'123',nonce:'N',exp:now+600,email:'a@b.ca',email_verified:true};
const opts={provider:PROVIDERS.google,client:{id:'cid'},nonce:'N',fetchImpl:fakeFetch};
test('validation du jeton d’identité',async()=>{
 assert.equal((await verifyIdToken(token(good),opts)).sub,'123');
 await assert.rejects(verifyIdToken(token(good,other.privateKey),opts),/Signature/);
 await assert.rejects(verifyIdToken(token({...good,aud:'autre'}),opts),/autre application/);
 await assert.rejects(verifyIdToken(token({...good,iss:'https://evil.example'}),opts),/Émetteur/);
 await assert.rejects(verifyIdToken(token({...good,exp:now-3600}),opts),/expiré/);
 await assert.rejects(verifyIdToken(token({...good,nonce:'X'}),opts),/rejoué/);
 await assert.rejects(verifyIdToken(token(good,privateKey,{alg:'none',kid:'k1'}),opts),/Algorithme/);
 await assert.rejects(verifyIdToken(token(good,privateKey,{alg:'RS256',kid:'inconnue'}),opts),/inconnue/);
});
test('Microsoft : courriel vérifié seulement pour comptes personnels ou domaine attesté',()=>{
 const m=PROVIDERS.microsoft;
 assert.equal(m.emailVerified({tid:'9188040d-6c67-4c5b-b112-36a304b66dad'}),true);
 assert.equal(m.emailVerified({tid:'abc'}),false);
 assert.equal(m.emailVerified({tid:'abc',xms_edov:true}),true);
 assert.equal(m.issuerOk({tid:'abc',iss:'https://login.microsoftonline.com/abc/v2.0'}),true);
 assert.equal(m.issuerOk({tid:'abc',iss:'https://login.microsoftonline.com/zzz/v2.0'}),false);
});
