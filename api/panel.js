import {neon} from '@neondatabase/serverless';
import {createHash,timingSafeEqual} from 'node:crypto';
import {blank,validate} from '../public/model.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','PUT'].includes(req.method)){res.setHeader('Allow','GET, PUT');return res.status(405).json({error:'Méthode non permise.'});}
 if(!process.env.DATABASE_URL||!process.env.PANEL_ACCESS_KEY)return res.status(503).json({error:'La synchronisation sera disponible après la configuration de la base et de la clé d’accès.',setup:true});
 const supplied=req.headers.authorization?.replace(/^Bearer /,'')||'';
 const hash=v=>createHash('sha256').update(v).digest();
 if(!timingSafeEqual(hash(supplied),hash(process.env.PANEL_ACCESS_KEY)))return res.status(401).json({error:'Clé d’accès incorrecte.'});
 try{
 const sql=neon(process.env.DATABASE_URL);
 await sql`CREATE TABLE IF NOT EXISTS panel_state (id integer PRIMARY KEY CHECK(id=1), circuits jsonb NOT NULL, revision integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`;
 await sql`INSERT INTO panel_state(id,circuits) VALUES(1,${JSON.stringify(blank())}::jsonb) ON CONFLICT DO NOTHING`;
 if(req.method==='GET'){const [row]=await sql`SELECT circuits,revision,updated_at FROM panel_state WHERE id=1`;return res.status(200).json(row);}
 let data;try{data=typeof req.body==='string'?JSON.parse(req.body):req.body;validate(data?.circuits);if(!Number.isInteger(data.revision)||data.revision<0)throw Error('Révision invalide.');}catch(e){return res.status(400).json({error:e.message});}
 const rows=await sql`UPDATE panel_state SET circuits=${JSON.stringify(data.circuits)}::jsonb, revision=revision+1, updated_at=now() WHERE id=1 AND revision=${data.revision} RETURNING revision,updated_at`;
 if(!rows.length)return res.status(409).json({error:'Le panneau a été modifié ailleurs. Exportez vos modifications, puis rechargez les données.'});
 return res.status(200).json(rows[0]);
 }catch{ return res.status(500).json({error:'La base de données est indisponible. Vos modifications restent dans ce navigateur.'});}
}
