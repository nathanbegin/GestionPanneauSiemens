// Accès base de données : Neon (HTTP) en production, PostgreSQL local (pg) en développement.
import {neon} from '@neondatabase/serverless';
let cached,schemaReady;
// Version du schéma : les migrations ne s'exécutent qu'une fois par version (au lieu de ~35 requêtes à chaque démarrage à froid).
// Augmenter ce nombre quand on ajoute une table, une colonne ou un index à runMigrations.
export const SCHEMA_VERSION=2;
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
 await sql`CREATE TABLE IF NOT EXISTS app_schema_version(id integer PRIMARY KEY DEFAULT 1, version integer NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
 const [row]=await sql`SELECT version FROM app_schema_version WHERE id=1`;
 if((row?.version||0)>=SCHEMA_VERSION)return;
 await runMigrations(sql);
 await sql`INSERT INTO app_schema_version(id,version) VALUES(1,${SCHEMA_VERSION}) ON CONFLICT (id) DO UPDATE SET version=GREATEST(app_schema_version.version,EXCLUDED.version),updated_at=now()`;
}
// Toutes les migrations (idempotentes). Exécutées par ensureSchema quand la version change, ou à la main : npm run migrate.
export async function runMigrations(sql){
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
 await sql`ALTER TABLE app_sites ADD COLUMN IF NOT EXISTS bipolar_volts integer NOT NULL DEFAULT 240`;
 await sql`CREATE INDEX IF NOT EXISTS app_sites_user ON app_sites(user_id)`;
 await sql`CREATE TABLE IF NOT EXISTS app_panels(
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES app_sites(id) ON DELETE CASCADE,
  name text NOT NULL, tag text NOT NULL DEFAULT '', kind text NOT NULL DEFAULT 'Principal', location text NOT NULL DEFAULT '',
  positions integer NOT NULL DEFAULT 32, details jsonb NOT NULL DEFAULT '{}'::jsonb, circuits jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE INDEX IF NOT EXISTS app_panels_site ON app_panels(site_id)`;
 // ---- Remise au client : accès en consultation ou copie du dossier, avec acceptation ----
 await sql`CREATE TABLE IF NOT EXISTS app_handoffs(
  id uuid PRIMARY KEY, kind text NOT NULL, owner_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  site_id uuid REFERENCES app_sites(id) ON DELETE CASCADE, site_name text NOT NULL DEFAULT '', email text NOT NULL, token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  accepted_by uuid REFERENCES app_users(id) ON DELETE CASCADE, accepted_at timestamptz, new_site_id uuid)`;
 await sql`CREATE INDEX IF NOT EXISTS app_handoffs_site ON app_handoffs(site_id)`;
 await sql`CREATE INDEX IF NOT EXISTS app_handoffs_user ON app_handoffs(accepted_by)`;
 // ---- Corbeille (30 jours) et historique des versions d'un panneau ----
 await sql`CREATE TABLE IF NOT EXISTS app_trash(
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, kind text NOT NULL, ref_id uuid NOT NULL, title text NOT NULL DEFAULT '',
  data jsonb NOT NULL, deleted_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL)`;
 await sql`CREATE INDEX IF NOT EXISTS app_trash_user ON app_trash(user_id)`;
 await sql`CREATE TABLE IF NOT EXISTS app_panel_history(
  id bigserial PRIMARY KEY, panel_id uuid NOT NULL REFERENCES app_panels(id) ON DELETE CASCADE, user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  at timestamptz NOT NULL DEFAULT now(), revision integer NOT NULL DEFAULT 0, initial boolean NOT NULL DEFAULT false, snap jsonb NOT NULL)`;
 await sql`CREATE INDEX IF NOT EXISTS app_panel_history_panel ON app_panel_history(panel_id,id)`;
 // ---- Abonnements (v2.1) ----
 await sql`CREATE TABLE IF NOT EXISTS app_plans(
  id text PRIMARY KEY, name text NOT NULL, audience text NOT NULL, description text NOT NULL DEFAULT '',
  price_month integer, price_year integer, quota_type text NOT NULL DEFAULT 'active', panel_limit integer,
  site_limit integer, seats integer NOT NULL DEFAULT 1, features jsonb NOT NULL DEFAULT '{}'::jsonb,
  trial_days integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true, public boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0, stripe_product text, stripe_price_month text, stripe_price_year text,
  updated_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE TABLE IF NOT EXISTS app_packs(
  id text PRIMARY KEY, name text NOT NULL, panels integer NOT NULL, price integer NOT NULL, validity_days integer NOT NULL DEFAULT 365,
  active boolean NOT NULL DEFAULT true, stripe_price text, updated_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE TABLE IF NOT EXISTS app_subscriptions(
  user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE, plan_id text NOT NULL REFERENCES app_plans(id),
  status text NOT NULL, interval text, source text NOT NULL DEFAULT 'stripe',
  stripe_customer text, stripe_subscription text UNIQUE, current_period_start timestamptz, current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false, limit_override integer, note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE TABLE IF NOT EXISTS app_credits(
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, pack_id text, panels integer NOT NULL,
  remaining integer NOT NULL, expires_at timestamptz NOT NULL, source text NOT NULL, reference text UNIQUE, created_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE TABLE IF NOT EXISTS app_panel_events(user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, panel_id uuid NOT NULL, source text NOT NULL DEFAULT 'plan', created_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE INDEX IF NOT EXISTS app_panel_events_user ON app_panel_events(user_id, created_at)`;
 await sql`CREATE TABLE IF NOT EXISTS app_stripe_events(id text PRIMARY KEY, type text NOT NULL, received_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE TABLE IF NOT EXISTS app_admin_audit(id bigserial PRIMARY KEY, admin_email text NOT NULL, action text NOT NULL, target text NOT NULL DEFAULT '', details jsonb NOT NULL DEFAULT '{}'::jsonb, at timestamptz NOT NULL DEFAULT now())`;
 await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stripe_customer text`;
 await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS branding jsonb NOT NULL DEFAULT '{}'::jsonb`;
 await sql`CREATE TABLE IF NOT EXISTS app_ai_scans(id bigserial PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, model text NOT NULL, input_tokens integer NOT NULL DEFAULT 0, output_tokens integer NOT NULL DEFAULT 0, ok boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE INDEX IF NOT EXISTS app_ai_scans_user ON app_ai_scans(user_id, created_at)`;
 await sql`CREATE TABLE IF NOT EXISTS app_feedback(id bigserial PRIMARY KEY, user_id uuid REFERENCES app_users(id) ON DELETE SET NULL, email text NOT NULL DEFAULT '', name text NOT NULL DEFAULT '', category text NOT NULL, message text NOT NULL, page text NOT NULL DEFAULT '', app_version text NOT NULL DEFAULT '', client text NOT NULL DEFAULT 'web', status text NOT NULL DEFAULT 'nouveau', admin_note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE INDEX IF NOT EXISTS app_feedback_status ON app_feedback(status, created_at)`;
 // ---- Équipes (forfaits avec la fonction « team ») ----
 await sql`CREATE TABLE IF NOT EXISTS app_team_members(user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE, owner_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE INDEX IF NOT EXISTS app_team_members_owner ON app_team_members(owner_id, status)`;
 await sql`CREATE TABLE IF NOT EXISTS app_team_invites(id text PRIMARY KEY, owner_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, email text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, used_by uuid, used_at timestamptz, revoked boolean NOT NULL DEFAULT false)`;
 await sql`CREATE TABLE IF NOT EXISTS app_shares(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, team_owner uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, site_id uuid REFERENCES app_sites(id) ON DELETE CASCADE, panel_id uuid REFERENCES app_panels(id) ON DELETE CASCADE, target_user uuid REFERENCES app_users(id) ON DELETE CASCADE, can_edit boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE INDEX IF NOT EXISTS app_shares_team ON app_shares(team_owner)`;
 await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS team_public boolean NOT NULL DEFAULT false`;
 await sql`CREATE TABLE IF NOT EXISTS app_settings(key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now(), updated_by text NOT NULL DEFAULT '')`;
 // ---- Index de performance (v2) : recherches par utilisateur, Stripe, partages, invitations ----
 await sql`CREATE INDEX IF NOT EXISTS app_panels_user ON app_panels(user_id, updated_at DESC)`;
 await sql`CREATE INDEX IF NOT EXISTS app_users_stripe_customer ON app_users(stripe_customer) WHERE stripe_customer IS NOT NULL`;
 await sql`CREATE INDEX IF NOT EXISTS app_subscriptions_stripe ON app_subscriptions(stripe_subscription) WHERE stripe_subscription IS NOT NULL`;
 await sql`CREATE INDEX IF NOT EXISTS app_credits_user ON app_credits(user_id, expires_at)`;
 await sql`CREATE INDEX IF NOT EXISTS app_shares_owner ON app_shares(owner_id)`;
 await sql`CREATE INDEX IF NOT EXISTS app_shares_target ON app_shares(target_user)`;
 await sql`CREATE INDEX IF NOT EXISTS app_team_invites_owner ON app_team_invites(owner_id)`;
 await sql`CREATE INDEX IF NOT EXISTS app_handoffs_email ON app_handoffs(lower(email), status)`;
 await sql`CREATE INDEX IF NOT EXISTS app_panel_events_plan ON app_panel_events(user_id, source, created_at)`;
 const {seedPlans}=await import('./plans.js');
 await seedPlans(sql);
}
