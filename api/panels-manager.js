import {neon} from '@neondatabase/serverless';
import {randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {blank,normalize,validate} from '../public/model.js';
const first='siemens-eq';
const uidOk=id=>typeof id==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(id);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST','PUT','DELETE'].includes(req.method))return res.status(405).json({error:'Méthode non permise.'});
 if(!process.env.DATABASE_URL||!process.env.PANEL_ACCESS_KEY)return res.status(503).json({error:'Configuration incomplète.'});
 const digest=s=>createHash('sha256').update(String(s)).digest();
 const supplied=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!supplied||!timingSafeEqual(digest(supplied),digest(process.env.PANEL_ACCESS_KEY)))return res.status(401).json({error:'Clé d’accès incorrecte.'});
 try{
  const sql=neon(process.env.DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS panels_extra(uid text PRIMARY KEY, name text NOT NULL, circuits jsonb NOT NULL, revision integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`;
  const uid=String(req.query?.uid||'');
  if(req.method==='GET'&&!uid){
   const panels=await sql`SELECT uid,name,revision,updated_at FROM panels_extra ORDER BY name`;
   return res.status(200).json({panels:[{uid:first,name:'Panneau principal · Siemens EQ',primary:true},...panels]});
  }
  if(!uidOk(uid)||uid===first)return res.status(400).json({error:'UID invalide ou réservé au panneau principal.'});
  if(req.method==='GET'){
   const [row]=await sql`SELECT uid,name,circuits,revision,updated_at FROM panels_extra WHERE uid=${uid}`;
   if(!row)return res.status(404).json({error:'Panneau introuvable.'});
   return res.status(200).json({...row,circuits:normalize(row.circuits)});
  }
  const data=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(req.method==='POST'){
   const name=String(data?.name||'').trim();
   if(!name||name.length>100)return res.status(400).json({error:'Nom invalide.'});
   const uidNew='eq-'+randomUUID();
   const circuits=data?.copy?normalize(data.copy):blank();
   const [row]=await sql`INSERT INTO panels_extra(uid,name,circuits) VALUES(${uidNew},${name},${JSON.stringify(circuits)}::jsonb) RETURNING uid,name,circuits,revision,updated_at`;
   return res.status(201).json(row);
  }
  if(req.method==='DELETE'){
   const result=await sql`DELETE FROM panels_extra WHERE uid=${uid} RETURNING uid`;
   return res.status(result.length?200:404).json(result.length?{ok:true}:{error:'Panneau introuvable.'});
  }
  if(!Number.isInteger(data?.revision)||data.revision<0)return res.status(400).json({error:'Révision invalide.'});
  const name=String(data?.name||'').trim();
  if(!name||name.length>100)return res.status(400).json({error:'Nom invalide.'});
  const circuits=normalize(data.circuits);
  validate(circuits);
  const [row]=await sql`UPDATE panels_extra SET name=${name},circuits=${JSON.stringify(circuits)}::jsonb,revision=revision+1,updated_at=now() WHERE uid=${uid} AND revision=${data.revision} RETURNING uid,name,circuits,revision,updated_at`;
  if(!row)return res.status(409).json({error:'Conflit de révision ou panneau introuvable. Rechargez le panneau.'});
  return res.status(200).json(row);
 }catch(e){console.error('panels-manager',e?.message);return res.status(500).json({error:'Impossible de gérer les panneaux.'});}
}
