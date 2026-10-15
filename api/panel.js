import {neon} from '@neondatabase/serverless';
import {createHash,timingSafeEqual} from 'node:crypto';
import {blank,validate,normalize} from '../public/model.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','PUT','POST'].includes(req.method)){res.setHeader('Allow','GET, PUT, POST');return res.status(405).json({error:'Méthode non permise.'});}
 if(!process.env.DATABASE_URL||!process.env.PANEL_ACCESS_KEY)return res.status(503).json({error:'Configuration du serveur incomplète.',setup:true});
 const supplied=req.headers.authorization?.replace(/^Bearer /,'')||'';
 const hash=v=>createHash('sha256').update(v).digest();
 if(!timingSafeEqual(hash(supplied),hash(process.env.PANEL_ACCESS_KEY)))return res.status(401).json({error:'Clé d’accès incorrecte.'});
 try{
 const sql=neon(process.env.DATABASE_URL);
 const photo=process.env.PANEL_PHOTO_CONFIG?validate(JSON.parse(process.env.PANEL_PHOTO_CONFIG)):null;
 await sql`CREATE TABLE IF NOT EXISTS panel_state (id integer PRIMARY KEY CHECK(id=1), circuits jsonb NOT NULL, revision integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`;
 await sql`CREATE TABLE IF NOT EXISTS panel_history (id bigserial PRIMARY KEY, revision integer NOT NULL, circuits jsonb NOT NULL, saved_at timestamptz NOT NULL DEFAULT now())`;
 await sql`INSERT INTO panel_state(id,circuits) VALUES(1,${JSON.stringify(photo||blank())}::jsonb) ON CONFLICT DO NOTHING`;
 if(req.method==='GET'){
 let [row]=await sql`SELECT circuits,revision,updated_at FROM panel_state WHERE id=1`;
 // Only replace an untouched v1 placeholder; preserve every user-edited repertoire.
 if(photo&&row.circuits.length===40&&row.circuits.every((c,i)=>c.position===i+1&&c.label===''&&c.room===''&&c.notes===''&&c.amps===15&&c.poles===1&&c.status==='À identifier')){
 const old=JSON.stringify(row.circuits),next=JSON.stringify(photo);
 const results=await sql.transaction([
 sql`INSERT INTO panel_history(revision,circuits) SELECT revision,circuits FROM panel_state WHERE id=1 AND revision=${row.revision} AND circuits=${old}::jsonb`,
 sql`UPDATE panel_state SET circuits=${next}::jsonb,revision=revision+1,updated_at=now() WHERE id=1 AND revision=${row.revision} AND circuits=${old}::jsonb RETURNING circuits,revision,updated_at`
 ]);if(results[1].length)row=results[1][0];else [row]=await sql`SELECT circuits,revision,updated_at FROM panel_state WHERE id=1`;
 }
 return res.status(200).json({...row,circuits:normalize(row.circuits)});
 }
 let data,next;try{data=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!Number.isInteger(data?.revision)||data.revision<0)throw Error('Révision invalide.');if(req.method==='POST'){if(data.action!=='apply-photos'||!photo)throw Error('Configuration photo indisponible.');next=photo;}else next=validate(data.circuits);}catch(e){return res.status(400).json({error:e.message});}
 const results=await sql.transaction([
 sql`INSERT INTO panel_history(revision,circuits) SELECT revision,circuits FROM panel_state WHERE id=1 AND revision=${data.revision}`,
 sql`UPDATE panel_state SET circuits=${JSON.stringify(next)}::jsonb, revision=revision+1, updated_at=now() WHERE id=1 AND revision=${data.revision} RETURNING circuits,revision,updated_at`
 ]);
 if(!results[1].length)return res.status(409).json({error:'Le panneau a changé sur un autre appareil. Exportez vos modifications, puis reconnectez-vous.'});
 return res.status(200).json(results[1][0]);
 }catch{return res.status(500).json({error:'Base de données indisponible. Vos modifications restent dans ce navigateur.'});}
}
