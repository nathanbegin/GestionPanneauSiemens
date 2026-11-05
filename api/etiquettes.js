// Envoi d'un panneau vers ZebraHD (impression d'étiquettes) depuis le serveur.
// v2 : session utilisateur + identifiant de panneau. v1 : clé PANEL_ACCESS_KEY + circuits (ancienne interface).
import {createHash,timingSafeEqual} from 'node:crypto';
import {normalize,panelTitle,MAX_POSITIONS} from '../public/model.js';
import {getSql} from './_lib/db.js';
import {route,body,HttpError,isUuid} from './_lib/http.js';
import {requireUser} from './_lib/auth.js';

const ZEBRA_ORIGIN='https://zebra.nathanbegin.xyz';
const MAX_BYTES=400000;
const equal=(a,b)=>{const hash=s=>createHash('sha256').update(String(s)).digest();return timingSafeEqual(hash(a),hash(b));};

async function send(payload,zebraKey){
 if(Buffer.byteLength(JSON.stringify(payload),'utf8')>MAX_BYTES)throw new HttpError(400,'Données trop volumineuses.');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),15000);
 let response;
 try{response=await fetch(ZEBRA_ORIGIN+'/api/panels',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':zebraKey},body:JSON.stringify(payload),signal:controller.signal});}
 catch(e){throw new HttpError(502,e.name==='AbortError'?'ZebraHD ne répond pas assez rapidement.':'Impossible de joindre ZebraHD.');}
 finally{clearTimeout(timeout);}
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result?.ok||result.id!==payload.id)throw new HttpError(502,result?.error||'Envoi à ZebraHD impossible.',{upstreamStatus:response.status});
 return {ok:true,count:result.count,url:ZEBRA_ORIGIN+'/etiquettes.html#panel='+encodeURIComponent(result.id)};
}

export default route(['POST'],async(req,res)=>{
 const zebraKey=process.env.PANELS_API_KEY||process.env.ETIQUETTES_API_KEY||process.env.ZEBRAHD_API_KEY;
 if(!zebraKey)throw new HttpError(503,'L’intégration ZebraHD n’est pas configurée sur ce serveur (PANELS_API_KEY).');
 const data=body(req);
 if(data.panelId){
  if(!isUuid(data.panelId))throw new HttpError(400,'Panneau invalide.');
  const sql=await getSql();
  const user=await requireUser(req,sql);
  const [p]=await sql`SELECT id,name,tag,positions,details,circuits FROM app_panels WHERE id=${data.panelId} AND user_id=${user.id}`;
  if(!p)throw new HttpError(404,'Panneau introuvable.');
  const payload={id:p.id.toLowerCase(),schema:2,panel:panelTitle(p).slice(0,100),mainAmps:p.details?.mainAmps||null,visiblePositions:p.positions,circuits:p.circuits};
  return res.status(200).json(await send(payload,zebraKey));
 }
 // Ancienne interface (v1.x).
 const panelKey=process.env.PANEL_ACCESS_KEY;
 const provided=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!panelKey||!equal(provided,panelKey))throw new HttpError(401,'Connectez-vous au panneau avant de créer les étiquettes.');
 if(!Array.isArray(data.circuits))throw new HttpError(400,'Circuits manquants.');
 let circuits;try{circuits=normalize(data.circuits,{positions:MAX_POSITIONS});}catch(e){throw new HttpError(400,e.message);}
 const id=data.id||'siemens-eq';if(typeof id!=='string'||!/^([a-z0-9][a-z0-9-]{0,79})$/.test(id))throw new HttpError(400,'UID de panneau invalide.');
 const name=typeof data.panel==='string'&&data.panel.trim()?data.panel.trim().slice(0,100):'Siemens EQ';
 return res.status(200).json(await send({id,schema:2,panel:name,mainAmps:200,visiblePositions:32,circuits},zebraKey));
});
