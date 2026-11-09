// Forfaits, droits et quotas. Les forfaits par défaut sont insérés une seule fois :
// ensuite, ils se modifient dans la console d'administration.
import {randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {HttpError} from './http.js';

export const FREE_PLAN='gratuit';
export const QUOTA_TYPES={active:'Panneaux actifs',monthly:'Nouveaux panneaux par mois',yearly:'Nouveaux panneaux par année'};
export const AUDIENCES={gratuit:'Gratuit',proprietaire:'Propriétaire',gestionnaire:'Gestionnaire d’immeuble',electricien:'Électricien'};
// Prix en cents (CAD, taxes en sus).
const DEFAULT_PLANS=[
 {id:'gratuit',name:'Gratuit',audience:'gratuit',description:'Pour essayer : toutes les fonctions de base.',price_month:0,price_year:0,quota_type:'active',panel_limit:5,site_limit:2,seats:1,features:{},sort:0},
 {id:'proprietaire',name:'Propriétaire',audience:'proprietaire',description:'Maison, condo, chalet : plus de panneaux et de sites.',price_month:399,price_year:2900,quota_type:'active',panel_limit:10,site_limit:3,seats:1,features:{},sort:10},
 {id:'gestionnaire',name:'Gestionnaire d’immeuble',audience:'gestionnaire',description:'Copropriétés et immeubles : sites illimités et plusieurs utilisateurs.',price_month:2400,price_year:24000,quota_type:'active',panel_limit:150,site_limit:null,seats:3,features:{qr:true},sort:20},
 {id:'electricien-solo',name:'Électricien Solo',audience:'electricien',description:'Maître électricien : planification avancée et rapports à votre image.',price_month:3400,price_year:34000,quota_type:'monthly',panel_limit:25,site_limit:null,seats:1,features:{planning:true,branding:true},sort:30},
 {id:'electricien-equipe',name:'Électricien Équipe',audience:'electricien',description:'Entreprise : 5 utilisateurs et volume élevé.',price_month:8900,price_year:89000,quota_type:'monthly',panel_limit:120,site_limit:null,seats:5,features:{planning:true,branding:true,team:true},sort:40},
// Forfait caché attribué par code promo : toutes les fonctions, sans limite.
 {id:'acces-complet',name:'Accès complet',audience:'electricien',description:'Toutes les fonctionnalités, sans limite (code promo).',price_month:null,price_year:null,quota_type:'active',panel_limit:null,site_limit:null,seats:5,features:{planning:true,branding:true,team:true,qr:true},sort:90,public:false},
];
const DEFAULT_PACKS=[{id:'pack-10',name:'10 panneaux',panels:10,price:2900,validity_days:365}];

export async function seedPlans(sql){
 for(const p of DEFAULT_PLANS)await sql`INSERT INTO app_plans(id,name,audience,description,price_month,price_year,quota_type,panel_limit,site_limit,seats,features,sort,public) VALUES(${p.id},${p.name},${p.audience},${p.description},${p.price_month},${p.price_year},${p.quota_type},${p.panel_limit},${p.site_limit},${p.seats},${JSON.stringify(p.features)}::jsonb,${p.sort},${p.public!==false}) ON CONFLICT (id) DO NOTHING`;
 for(const k of DEFAULT_PACKS)await sql`INSERT INTO app_packs(id,name,panels,price,validity_days) VALUES(${k.id},${k.name},${k.panels},${k.price},${k.validity_days}) ON CONFLICT (id) DO NOTHING`;
}
export const planOut=p=>({id:p.id,name:p.name,audience:p.audience,description:p.description,priceMonth:p.price_month,priceYear:p.price_year,quotaType:p.quota_type,panelLimit:p.panel_limit,siteLimit:p.site_limit,seats:p.seats,features:p.features||{},trialDays:p.trial_days,active:p.active,public:p.public,sort:p.sort});
export const packOut=k=>({id:k.id,name:k.name,panels:k.panels,price:k.price,validityDays:k.validity_days,active:k.active});

// Un abonnement donne accès à son forfait s'il est actif, en essai, en retard de paiement (délai de grâce)
// ou offert (comp) et non expiré.
export const LIVE=['active','trialing','past_due','comp'];
function isLive(sub){
 if(!sub||!LIVE.includes(sub.status))return false;
 if(sub.status==='comp'&&sub.current_period_end&&new Date(sub.current_period_end)<new Date())return false;
 return true;
}
function periodStart(sub,quotaType){
 const now=new Date();
 if(quotaType==='monthly'){
  // Période de facturation Stripe si disponible, sinon mois civil.
  if(sub?.current_period_start&&sub.interval==='month')return new Date(sub.current_period_start);
  return new Date(now.getFullYear(),now.getMonth(),1);
 }
 if(quotaType==='yearly'){
  if(sub?.current_period_start&&sub.interval==='year')return new Date(sub.current_period_start);
  return new Date(now.getFullYear(),0,1);
 }
 return null;
}
// Équipe d'un utilisateur : propriétaire (abonné) et membres actifs. Un membre actif profite du forfait
// du propriétaire si ce forfait comprend la fonction « team » et que le membre n'a pas son propre forfait payant.
export async function teamIds(sql,ownerId){
 const rows=await sql`SELECT user_id FROM app_team_members WHERE owner_id=${ownerId} AND status='active'`;
 return [ownerId,...rows.map(r=>r.user_id)];
}
async function ownEntitlement(sql,userId,ids){
 const [sub]=await sql`SELECT * FROM app_subscriptions WHERE user_id=${userId}`;
 const live=isLive(sub);
 const planId=live?sub.plan_id:FREE_PLAN;
 let [plan]=await sql`SELECT * FROM app_plans WHERE id=${planId}`;
 if(!plan)[plan]=await sql`SELECT * FROM app_plans WHERE id=${FREE_PLAN}`;
 // Le quota d'un forfait d'équipe couvre tous ses membres.
 if(!ids)ids=plan.features?.team?await teamIds(sql,userId):[userId];
 const limit=live&&sub.limit_override!=null?sub.limit_override:plan.panel_limit;
 const since=periodStart(live?sub:null,plan.quota_type);
 const [{n:activePanels}]=await sql`SELECT count(*)::int AS n FROM app_panels WHERE user_id=ANY(${ids}::uuid[])`;
 const [{n:sites}]=await sql`SELECT count(*)::int AS n FROM app_sites WHERE user_id=${userId}`;
 let used=activePanels;
 if(since){const [{n}]=await sql`SELECT count(*)::int AS n FROM app_panel_events WHERE user_id=ANY(${ids}::uuid[]) AND source='plan' AND created_at>=${since.toISOString()}`;used=n;}
 const [{n:credits}]=await sql`SELECT coalesce(sum(remaining),0)::int AS n FROM app_credits WHERE user_id=${userId} AND remaining>0 AND expires_at>now()`;
 return {plan:planOut(plan),subscription:sub?subOut(sub):null,live,limit,used,activePanels,sites,credits,periodStart:since?.toISOString()||null,
  canCreatePanel:limit==null||used<limit||credits>0,canCreateSite:plan.site_limit==null||sites<plan.site_limit,seats:plan.seats||1,teamSize:ids.length};
}
export async function entitlement(sql,userId){
 const own=await ownEntitlement(sql,userId);
 if(own.live&&own.plan.id!==FREE_PLAN)return {...own,team:own.plan.features?.team?{role:'owner',ownerId:userId}:null};
 const [m]=await sql`SELECT owner_id FROM app_team_members WHERE user_id=${userId} AND status='active'`;
 if(m){
  const ids=await teamIds(sql,m.owner_id);
  const owner=await ownEntitlement(sql,m.owner_id,ids);
  if(owner.live&&owner.plan.features?.team){
   const [{n:sites}]=await sql`SELECT count(*)::int AS n FROM app_sites WHERE user_id=${userId}`;
   return {...owner,subscription:null,sites,credits:own.credits,canCreatePanel:owner.limit==null||owner.used<owner.limit||own.credits>0,
    canCreateSite:owner.plan.siteLimit==null||sites<owner.plan.siteLimit,team:{role:'member',ownerId:m.owner_id}};
  }
 }
 return {...own,team:null};
}
export const subOut=s=>({planId:s.plan_id,status:s.status,interval:s.interval,source:s.source,currentPeriodStart:s.current_period_start,currentPeriodEnd:s.current_period_end,cancelAtPeriodEnd:s.cancel_at_period_end,limitOverride:s.limit_override,note:s.note,hasStripe:!!s.stripe_subscription});

const quotaError=(e,what)=>new HttpError(402,what==='site'
 ?`Votre forfait ${e.plan.name} permet ${e.plan.siteLimit} site(s). Passez à un forfait supérieur pour en ajouter.`
 :`Vous avez atteint la limite de votre forfait ${e.plan.name} (${e.used}/${e.limit} ${e.plan.quotaType==='active'?'panneaux':e.plan.quotaType==='monthly'?'panneaux ce mois-ci':'panneaux cette année'}). Passez à un forfait supérieur ou achetez un forfait de panneaux.`,{quota:true});

export async function assertCanCreateSite(sql,userId){
 const e=await entitlement(sql,userId);
 if(!e.canCreateSite)throw quotaError(e,'site');
}
// Vérifie le quota puis enregistre la création. Utilise un crédit si le forfait est épuisé.
export async function consumePanelQuota(sql,userId,panelId){
 const e=await entitlement(sql,userId);
 if(e.limit==null||e.used<e.limit){await sql`INSERT INTO app_panel_events(user_id,panel_id,source) VALUES(${userId},${panelId},'plan')`;return 'plan';}
 // Crédit le plus ancien à expirer en premier ; mise à jour conditionnelle contre les doubles consommations.
 const [c]=await sql`UPDATE app_credits SET remaining=remaining-1 WHERE id=(SELECT id FROM app_credits WHERE user_id=${userId} AND remaining>0 AND expires_at>now() ORDER BY expires_at LIMIT 1) AND remaining>0 RETURNING id`;
 if(!c)throw quotaError(e,'panel');
 await sql`INSERT INTO app_panel_events(user_id,panel_id,source) VALUES(${userId},${panelId},'credit')`;
 return 'credit';
}
export async function grantCredits(sql,{userId,packId=null,panels,validityDays=365,source,reference=null}){
 await sql`INSERT INTO app_credits(id,user_id,pack_id,panels,remaining,expires_at,source,reference) VALUES(${randomUUID()},${userId},${packId},${panels},${panels},now()+make_interval(days=>${validityDays}),${source},${reference}) ON CONFLICT (reference) DO NOTHING`;
}

// Codes promo définis dans la variable PROMO_CODES (séparés par des virgules).
// Format : CODE  ou  CODE:forfait  ou  CODE:forfait:jours   (défaut : acces-complet, sans fin).
// Exemple : PROMO_CODES=NATHAN2026,ESSAI-PRO:electricien-solo:90
export function parsePromoCodes(raw=process.env.PROMO_CODES){
 return String(raw||'').split(',').map(s=>s.trim()).filter(Boolean).map(entry=>{
  const [code,plan,days]=entry.split(':').map(x=>x.trim());
  return {code,plan:plan||'acces-complet',days:days&&Number(days)>0?Math.floor(Number(days)):null};
 }).filter(p=>p.code.length>=4);
}
export function findPromo(input,codes=parsePromoCodes()){
 const given=String(input||'').trim().toUpperCase();
 if(!given)return null;
 // Comparaison à temps constant (empreintes de même longueur).
 const h=v=>createHash('sha256').update(v).digest();
 let found=null;
 for(const p of codes)if(timingSafeEqual(h(p.code.toUpperCase()),h(given)))found=p;
 return found;
}
