// Rapports PDF (panneau, aide-mémoire, site complet) et étiquettes.
// POST (authentifié) → lien signé valable 10 minutes ; GET avec signature ou session → PDF.
import {getSql} from './_lib/db.js';
import {route,body,HttpError,isUuid} from './_lib/http.js';
import {requireUser,sign,verifySignature} from './_lib/auth.js';
import {siteOut,panelOut} from './_lib/serialize.js';
import {buildReport,buildLabels,buildLoads,buildCalcNote} from './_lib/pdf.js';
import {entitlement} from './_lib/plans.js';
import {adminEmails} from './_lib/auth.js';
import {APP_VERSION,panelTitle} from '../public/model.js';
import {panelLink,qrAllowed} from '../public/qr.js';
import {appUrl} from './_lib/mail.js';
import {loadPdfSettings,resolveFooter} from './_lib/footers.js';
import {siteAccess,panelAccess} from './_lib/shares.js';

const KINDS=['report','door','labels','loads','calc'],FORMATS=['letter','legal'];
function params(src){
 const p={kind:String(src.kind||'report'),format:String(src.format||'letter'),panel:src.panel?String(src.panel):'',site:src.site?String(src.site):''};
 if(!KINDS.includes(p.kind)||!FORMATS.includes(p.format))throw new HttpError(400,'Type de document invalide.');
 if(p.panel&&!isUuid(p.panel)||p.site&&!isUuid(p.site)||!p.panel&&!p.site)throw new HttpError(400,'Panneau ou site manquant.');
 if(['labels','loads','calc'].includes(p.kind)&&!p.panel)throw new HttpError(400,'Ce document se génère pour un panneau.');
 if(src.skipFree)p.skipFree='1';
 return p;
}
const slug=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'panneau';

export default route(['GET','POST'],async(req,res)=>{
 const sql=await getSql();
 if(req.method==='POST'){
  const user=await requireUser(req,sql);
  const p=params(body(req));
  const {exp,sig}=sign({...p,uid:user.id});
  const q=new URLSearchParams({...p,uid:user.id,exp:String(exp),sig});
  return res.status(200).json({url:`${appUrl(req)}/api/report?${q}`});
 }
 const q=req.query||{};
 const p=params(q);
 let userId;
 if(q.sig){
  const {sig,...rest}=q;
  const signed=Object.fromEntries(Object.entries(rest).map(([k,v])=>[k,String(v)]));
  if(!verifySignature(signed,sig))throw new HttpError(403,'Lien expiré. Générez de nouveau le document depuis l’application.');
  userId=String(q.uid);
 }else userId=(await requireUser(req,sql)).id;
 const [user]=await sql`SELECT * FROM app_users WHERE id=${userId}`;
 if(!user)throw new HttpError(404,'Compte introuvable.');
 let siteRow,rows;
 if(p.panel){
  const panel=(await panelAccess(sql,userId,p.panel))?.panel;
  if(!panel)throw new HttpError(404,'Panneau introuvable.');
  [siteRow]=await sql`SELECT * FROM app_sites WHERE id=${panel.site_id}`;
  rows=[panel];
 }else{
  const sa=await siteAccess(sql,userId,p.site);
  siteRow=sa?.site;
  if(!siteRow)throw new HttpError(404,'Site introuvable.');
  rows=await sql`SELECT * FROM app_panels WHERE site_id=${p.site} ORDER BY created_at`;
  if(sa.role==='panels')rows=rows.filter(r=>sa.panelIds.includes(r.id));
  if(!rows.length)throw new HttpError(400,'Ce site ne contient encore aucun panneau.');
 }
 const site=siteOut(siteRow);
 const all=await sql`SELECT id,name,tag FROM app_panels WHERE site_id=${siteRow.id}`;
 const label=id=>{const f=all.find(x=>x.id===id);return f?panelTitle(f):'';};
 const panels=rows.map(r=>{const panel=panelOut(r);return {panel,fedFromLabel:label(panel.details?.fedFrom)};});
 if(p.kind==='loads'||p.kind==='calc'){
  const e=await entitlement(sql,userId);
  if(!e.plan.features?.planning&&!adminEmails().includes(user.email))throw new HttpError(402,'Le bilan de charges est inclus dans les forfaits Électricien.',{quota:true});
 }
 // Image de marque de l'entreprise : forfaits avec la fonction « branding » (et administrateurs).
 let brand=null;
 if(user.branding&&Object.keys(user.branding).length){const e=await entitlement(sql,userId);if(e.plan.features?.branding||adminEmails().includes(user.email))brand=user.branding;}
 // Pied de page : mention de la console pour tous ; modèle ou texte de l'entreprise si personnalisation permise.
 const pdfSet=await loadPdfSettings(sql);const foot=resolveFooter(brand||{},pdfSet);
 brand={...(brand||{}),footer:brand?foot.footer:'',legal:foot.legal};
 let children=[];
 if(p.kind==='loads'||p.kind==='calc'){const sitePanels=await sql`SELECT id,name,tag,kind,details,circuits FROM app_panels WHERE site_id=${siteRow.id}`;const q=[rows[0].id],seen=new Set(q);while(q.length){const parent=q.shift();for(const x of sitePanels)if(x.details?.fedFrom===parent&&!seen.has(x.id)){seen.add(x.id);q.push(x.id);children.push(x);}}}
 // Code QR sur les étiquettes : forfaits qui l'incluent (et administrateurs).
 let qrUrl='';
 if(p.kind==='labels'){const e=await entitlement(sql,userId);if(qrAllowed(e.plan.features,adminEmails().includes(user.email)))qrUrl=panelLink(appUrl(req),panels[0].panel.id);}
 const bytes=p.kind==='calc'?await buildCalcNote({user,site,...panels[0],children,version:APP_VERSION,brand}):p.kind==='loads'?await buildLoads({user,site,...panels[0],children,version:APP_VERSION,brand}):p.kind==='labels'
  ?await buildLabels({site,...panels[0],skipFree:p.skipFree==='1',brand,qrUrl})
  :await buildReport({kind:p.kind,format:p.format,user,site,panels,version:APP_VERSION,brand});
 const name={report:'rapport',door:'aide-memoire',labels:'etiquettes',loads:'bilan-charges',calc:'note-de-calcul'}[p.kind]+'-'+slug(p.panel?panelTitle(panels[0].panel):site.name)+'.pdf';
 res.setHeader('Content-Type','application/pdf');
 res.setHeader('Content-Disposition',`inline; filename="${name}"`);
 res.setHeader('Content-Length',bytes.length);
 return res.status(200).send(Buffer.from(bytes));
});
