// Fournisseurs de connexion externes (OpenID Connect). Pour en ajouter un : une entrée ici, rien d'autre.
// Un fournisseur est actif seulement si son identifiant et son secret sont définis dans l'environnement.
const MSA_TENANT='9188040d-6c67-4c5b-b112-36a304b66dad'; // comptes Microsoft personnels

export const PROVIDERS={
 google:{
  label:'Google',
  env:['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'],
  endpoints:()=>({authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',jwks:'https://www.googleapis.com/oauth2/v3/certs'}),
  scope:'openid email profile',
  issuerOk:c=>c.iss==='https://accounts.google.com'||c.iss==='accounts.google.com',
  // Google atteste lui-même que le courriel est vérifié.
  emailVerified:c=>c.email_verified===true||c.email_verified==='true',
  email:c=>c.email,
  extraAuthParams:{prompt:'select_account'},
 },
 microsoft:{
  label:'Microsoft',
  env:['MICROSOFT_CLIENT_ID','MICROSOFT_CLIENT_SECRET'],
  endpoints:()=>{const t=process.env.MICROSOFT_TENANT||'common',b=`https://login.microsoftonline.com/${t}`;return {authorize:b+'/oauth2/v2.0/authorize',token:b+'/oauth2/v2.0/token',jwks:b+'/discovery/v2.0/keys'};},
  scope:'openid email profile',
  issuerOk:c=>!!c.tid&&c.iss===`https://login.microsoftonline.com/${c.tid}/v2.0`,
  // Le courriel d'un compte professionnel Microsoft n'est pas toujours vérifié (faille « nOAuth ») :
  // on ne s'y fie que pour les comptes personnels ou si le domaine est attesté (xms_edov).
  emailVerified:c=>c.tid===MSA_TENANT||c.xms_edov===true||c.xms_edov==='1',
  email:c=>c.email,
  extraAuthParams:{prompt:'select_account'},
 },
};

export const clientOf=id=>({id:process.env[PROVIDERS[id].env[0]],secret:process.env[PROVIDERS[id].env[1]]});
export const enabledProviders=()=>Object.keys(PROVIDERS).filter(id=>{const c=clientOf(id);return c.id&&c.secret;});
