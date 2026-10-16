import {neon} from '@neondatabase/serverless';
import {createHash,timingSafeEqual} from 'node:crypto';
import {normalize} from '../public/model.js';
const PANEL_UID='siemens-eq';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Méthode non permise.'});}
 if(req.query?.id!==PANEL_UID)return res.status(404).json({error:'Panneau introuvable.'});
 if(!process.env.PANEL_ACCESS_KEY||!process.env.DATABASE_URL)return res.status(503).json({error:'Configuration indisponible.'});
 const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 const digest=x=>createHash('sha256').update(x).digest();
 if(!supplied||!timingSafeEqual(digest(supplied),digest(process.env.PANEL_ACCESS_KEY)))return res.status(401).json({error:'Clé du panneau incorrecte.'});
 try{
  const sql=neon(process.env.DATABASE_URL);
  const rows=await sql`SELECT circuits,revision,updated_at FROM panel_state WHERE id=1`;
  if(!rows.length)return res.status(404).json({error:'Aucun panneau enregistré.'});
  const row=rows[0];
  return res.status(200).json({id:PANEL_UID,schema:2,panel:'Siemens EQ',mainAmps:200,visiblePositions:32,revision:row.revision,updatedAt:row.updated_at,circuits:normalize(row.circuits)});
 }catch{return res.status(503).json({error:'Lecture du panneau indisponible.'});}
}
