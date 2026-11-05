// Accès base de données : Neon (HTTP) en production, PostgreSQL local (pg) en développement.
import {neon} from '@neondatabase/serverless';
let cached,schemaReady;
const isLocal=url=>/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
async function localSql(url){
 const {default:pg}=await import('pg');
 const pool=new pg.Pool({connectionString:url,max:4});
 const tag=async(strings,...values)=>{let text=strings[0];values.forEach((v,i)=>{text+='$'+(i+1)+strings[i+1];});return (await pool.query(text,values)).rows;};
 return tag;
}
export async function getSql(){
 const url=process.env.DATABASE_URL;
 if(!url)throw Object.assign(Error('Configuration du serveur incomplète (DATABASE_URL).'),{status:503});
 if(!cached)cached=isLocal(url)?await localSql(url):neon(url);
 if(!schemaReady)schemaReady=ensureSchema(cached).catch(e=>{schemaReady=null;throw e;});
 await schemaReady;
 return cached;
}
async function ensureSchema(sql){
 await sql`CREATE TABLE IF NOT EXISTS app_users(
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL, name text NOT NULL DEFAULT '',
  profile jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE TABLE IF NOT EXISTS app_sessions(
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, client text NOT NULL DEFAULT 'web')`;
 await sql`CREATE INDEX IF NOT EXISTS app_sessions_user ON app_sessions(user_id)`;
 await sql`CREATE TABLE IF NOT EXISTS app_resets(
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, used boolean NOT NULL DEFAULT false)`;
 await sql`CREATE TABLE IF NOT EXISTS app_rate(key text NOT NULL, at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE INDEX IF NOT EXISTS app_rate_key ON app_rate(key, at)`;
 await sql`CREATE TABLE IF NOT EXISTS app_sites(
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name text NOT NULL, client text NOT NULL DEFAULT '', street text NOT NULL DEFAULT '', city text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT 'QC', postal_code text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE INDEX IF NOT EXISTS app_sites_user ON app_sites(user_id)`;
 await sql`CREATE TABLE IF NOT EXISTS app_panels(
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES app_sites(id) ON DELETE CASCADE,
  name text NOT NULL, tag text NOT NULL DEFAULT '', kind text NOT NULL DEFAULT 'Principal', location text NOT NULL DEFAULT '',
  positions integer NOT NULL DEFAULT 32, details jsonb NOT NULL DEFAULT '{}'::jsonb, circuits jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE INDEX IF NOT EXISTS app_panels_site ON app_panels(site_id)`;
}
