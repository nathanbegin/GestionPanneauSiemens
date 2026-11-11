// Persistance des connexions externes : une table à part, liée à app_users. Rien d'autre n'est modifié dans le schéma.
let ready;
export const ensureTable=sql=>ready||(ready=(async()=>{
 await sql`CREATE TABLE IF NOT EXISTS app_identities(
  provider text NOT NULL, subject text NOT NULL, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(provider,subject))`;
 await sql`CREATE INDEX IF NOT EXISTS app_identities_user ON app_identities(user_id)`;
})().catch(e=>{ready=null;throw e;}));

export async function userByIdentity(sql,provider,subject){
 const [u]=await sql`SELECT u.* FROM app_identities i JOIN app_users u ON u.id=i.user_id WHERE i.provider=${provider} AND i.subject=${subject}`;return u||null;
}
export async function userByEmail(sql,email){const [u]=await sql`SELECT * FROM app_users WHERE email=${email}`;return u||null;}
export async function addIdentity(sql,{provider,subject,userId,email}){
 await sql`INSERT INTO app_identities(provider,subject,user_id,email) VALUES(${provider},${subject},${userId},${email||''}) ON CONFLICT(provider,subject) DO NOTHING`;
}
export const listIdentities=(sql,userId)=>sql`SELECT provider,email,created_at FROM app_identities WHERE user_id=${userId} ORDER BY created_at`;
export const removeIdentity=(sql,userId,provider)=>sql`DELETE FROM app_identities WHERE user_id=${userId} AND provider=${provider}`;
// Compte créé par connexion externe : pas de mot de passe (valeur vide, jamais acceptée par verifyPassword).
export async function createUser(sql,{id,email,name,profile}){
 const [u]=await sql`INSERT INTO app_users(id,email,password_hash,name,profile) VALUES(${id},${email},'',${name},${JSON.stringify(profile)}::jsonb) RETURNING *`;return u;
}
