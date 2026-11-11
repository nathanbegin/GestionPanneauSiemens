// Exécute les migrations de la base (idempotent). Usage : DATABASE_URL=… npm run migrate
import {getSql,runMigrations,SCHEMA_VERSION} from '../api/_lib/db.js';
const sql=await getSql();
await runMigrations(sql);
await sql`INSERT INTO app_schema_version(id,version) VALUES(1,${SCHEMA_VERSION}) ON CONFLICT (id) DO UPDATE SET version=GREATEST(app_schema_version.version,EXCLUDED.version),updated_at=now()`;
console.log('Migrations appliquées (version du schéma : '+SCHEMA_VERSION+').');
process.exit(0);
