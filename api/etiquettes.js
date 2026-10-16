import {createHash,timingSafeEqual} from 'node:crypto';
import {normalize} from '../public/model.js';

const ZEBRA_ORIGIN='https://zebra.nathanbegin.xyz';
const PANEL_ID='siemens-eq';
const MAX_BYTES=400000;
const equal=(a,b)=>{const hash=s=>createHash('sha256').update(String(s)).digest();return timingSafeEqual(hash(a),hash(b));};

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Méthode non permise.'});}
 const panelKey=process.env.PANEL_ACCESS_KEY;
 const zebraKey=process.env.ETIQUETTES_API_KEY||process.env.ZEBRAHD_API_KEY;
 if(!panelKey||!zebraKey)return res.status(503).json({error:'Clé d’accès ou clé ZebraHD absente de Vercel. Vérifiez PANEL_ACCESS_KEY et ETIQUETTES_API_KEY.'});
 const provided=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!equal(provided,panelKey))return res.status(401).json({error:'Connectez-vous au panneau avant de créer les étiquettes.'});
 let payload;
 try{
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!body||typeof body!=='object'||!Array.isArray(body.circuits))throw Error('Circuits manquants.');
  const circuits=normalize(body.circuits);
  payload={id:PANEL_ID,schema:2,panel:'Siemens EQ',mainAmps:200,visiblePositions:32,circuits};
  if(Buffer.byteLength(JSON.stringify(payload),'utf8')>MAX_BYTES)throw Error('Données trop volumineuses.');
 }catch(e){return res.status(400).json({error:e.message||'Panneau invalide.'});}
 try{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  let response;
  try{response=await fetch(ZEBRA_ORIGIN+'/api/panels',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':zebraKey},body:JSON.stringify(payload),signal:controller.signal});}
  finally{clearTimeout(timeout);}
  const result=await response.json().catch(()=>null);
  if(!response.ok||!result?.ok||result.id!==PANEL_ID)return res.status(502).json({error:result?.error||'Envoi à ZebraHD impossible.',upstreamStatus:response.status});
  return res.status(200).json({ok:true,count:result.count,url:ZEBRA_ORIGIN+'/etiquettes.html#panel='+encodeURIComponent(result.id)});
 }catch(e){return res.status(502).json({error:e.name==='AbortError'?'ZebraHD ne répond pas assez rapidement.':'Impossible de joindre ZebraHD.'});}
}
