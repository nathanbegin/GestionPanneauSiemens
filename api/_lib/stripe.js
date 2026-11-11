// Intégration Stripe sans SDK (API REST). Inactive tant que STRIPE_SECRET_KEY n'est pas défini.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {HttpError} from './http.js';

// Version de l'API Stripe : la plus récente par défaut, modifiable sans redéploiement de code
// (variable STRIPE_API_VERSION) pour revenir en arrière au besoin.
export const STRIPE_LATEST='2026-10-28.endive';
export const STRIPE_VERSION=process.env.STRIPE_API_VERSION||STRIPE_LATEST;
const versionDate=v=>String(v).slice(0,10);
// STRIPE_SECRET_KEY accepte une clé restreinte (rk_…, recommandée) ou une clé secrète (sk_…).
export const stripeConfigured=()=>!!process.env.STRIPE_SECRET_KEY;
export const stripeMode=(key=process.env.STRIPE_SECRET_KEY)=>!key?'off':/^(sk|rk)_live_/.test(key)?'live':'test';
export const stripeKeyType=(key=process.env.STRIPE_SECRET_KEY)=>!key?'':key.startsWith('rk_')?'restricted':'secret';
// Étiquette des parcours Checkout (tableau de bord Stripe), disponible depuis l'API 2026-03-25.
export const integrationId=flow=>versionDate(STRIPE_VERSION)>='2026-03-25'?{integration_identifier:`mon-panneau-${flow}-${flow==='abonnement'?'qmzrtkwv':'hjdplxna'}`}:{};
// Mode de facturation flexible (recommandé par Stripe ; défaut depuis l'API 2025-09-30, disponible dès 2025-06-30).
export const billingMode=()=>versionDate(STRIPE_VERSION)>='2025-06-30'?{billing_mode:{type:'flexible'}}:{};
// Abonnement d'une facture, quelle que soit la version d'API de l'événement
// (invoice.subscription avant 2025-03-31, invoice.parent.subscription_details.subscription ensuite).
export const invoiceSubscription=inv=>inv?.subscription||inv?.parent?.subscription_details?.subscription||inv?.lines?.data?.find(l=>l.parent?.subscription_item_details?.subscription)?.parent?.subscription_item_details?.subscription||null;
const idOf=v=>typeof v==='string'?v:v?.id||null;
// Utilisateur associé à un client Stripe (graphe d'objets Stripe d'abord, métadonnées en secours).
export async function userForCustomer(sql,customer,fallbackUserId){
 const id=idOf(customer);
 if(id){const [u]=await sql`SELECT id FROM app_users WHERE stripe_customer=${id}`;if(u)return u.id;}
 if(fallbackUserId){const [u]=await sql`SELECT id FROM app_users WHERE id::text=${String(fallbackUserId)}`;if(u)return u.id;}
 return null;
}

// Encodage application/x-www-form-urlencoded avec objets et tableaux imbriqués (format Stripe).
export function encode(obj,prefix='',out=new URLSearchParams()){
 for(const [k,v] of Object.entries(obj)){
  if(v===undefined||v===null)continue;
  const key=prefix?`${prefix}[${k}]`:k;
  if(Array.isArray(v))v.forEach((item,i)=>typeof item==='object'?encode(item,`${key}[${i}]`,out):out.append(`${key}[${i}]`,String(item)));
  else if(typeof v==='object')encode(v,key,out);
  else out.append(key,String(v));
 }
 return out;
}
export async function stripe(method,path,params,{idempotencyKey}={}){
 if(!stripeConfigured())throw new HttpError(503,'Le paiement en ligne n’est pas encore activé. Revenez bientôt ou contactez-nous.',{billing:false});
 const headers={Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY,'Stripe-Version':STRIPE_VERSION};
 let url='https://api.stripe.com/v1'+path,body;
 if(params&&method==='GET')url+='?'+encode(params);
 else if(params){body=encode(params);headers['Content-Type']='application/x-www-form-urlencoded';}
 if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
 const r=await fetch(url,{method,headers,body});
 const data=await r.json().catch(()=>({}));
 if(!r.ok){console.error('stripe',path,r.status,data?.error?.message);throw new HttpError(r.status>=500?502:400,'Stripe : '+(data?.error?.message||'erreur '+r.status));}
 return data;
}
// Vérifie l'en-tête Stripe-Signature (t=…,v1=…) sur le corps brut.
export function verifyWebhook(raw,header,secret=process.env.STRIPE_WEBHOOK_SECRET,toleranceSec=300){
 if(!secret)throw new HttpError(503,'STRIPE_WEBHOOK_SECRET manquant.');
 const parts=Object.fromEntries(String(header||'').split(',').map(p=>p.split('=')).filter(p=>p.length===2).map(([k,v])=>[k.trim(),v]));
 const sigs=String(header||'').split(',').filter(p=>p.startsWith('v1=')).map(p=>p.slice(3));
 const t=Number(parts.t);
 if(!t||!sigs.length||Math.abs(Date.now()/1000-t)>toleranceSec)throw new HttpError(400,'Signature Stripe invalide.');
 const expected=createHmac('sha256',secret).update(`${t}.${raw}`).digest();
 const ok=sigs.some(s=>{const b=Buffer.from(s,'hex');return b.length===expected.length&&timingSafeEqual(b,expected);});
 if(!ok)throw new HttpError(400,'Signature Stripe invalide.');
 return JSON.parse(raw);
}
// Crée ou réutilise le client Stripe d'un utilisateur.
export async function ensureCustomer(sql,user){
 if(user.stripe_customer)return user.stripe_customer;
 const c=await stripe('POST','/customers',{email:user.email,name:user.name,preferred_locales:['fr-CA'],metadata:{user_id:user.id}},{idempotencyKey:'customer-'+user.id});
 await sql`UPDATE app_users SET stripe_customer=${c.id} WHERE id=${user.id}`;
 return c.id;
}
// Crée le produit et les prix Stripe d'un forfait si nécessaire. Un prix Stripe est immuable :
// un changement de prix crée un nouveau prix ; les abonnés existants gardent l'ancien.
export async function syncPlanPrices(sql,plan){
 if(!stripeConfigured()||!(plan.price_month>0||plan.price_year>0))return plan;
 let product=plan.stripe_product;
 if(!product){product=(await stripe('POST','/products',{name:'Disjonio — '+plan.name,metadata:{plan_id:plan.id}})).id;}
 else await stripe('POST','/products/'+product,{name:'Disjonio — '+plan.name});
 const updates={product,month:plan.stripe_price_month,year:plan.stripe_price_year};
 for(const [interval,amount,current] of [['month',plan.price_month,plan.stripe_price_month],['year',plan.price_year,plan.stripe_price_year]]){
  if(!(amount>0)){updates[interval]=null;continue;}
  if(current){const p=await stripe('GET','/prices/'+current);if(p.unit_amount===amount&&p.active)continue;await stripe('POST','/prices/'+current,{active:false});}
  updates[interval]=(await stripe('POST','/prices',{product,currency:'cad',unit_amount:amount,recurring:{interval},tax_behavior:'exclusive',metadata:{plan_id:plan.id}})).id;
 }
 const [row]=await sql`UPDATE app_plans SET stripe_product=${updates.product},stripe_price_month=${updates.month},stripe_price_year=${updates.year} WHERE id=${plan.id} RETURNING *`;
 return row;
}
export async function syncPackPrice(sql,pack){
 if(!stripeConfigured())return pack;
 if(pack.stripe_price){const p=await stripe('GET','/prices/'+pack.stripe_price);if(p.unit_amount===pack.price&&p.active)return pack;await stripe('POST','/prices/'+pack.stripe_price,{active:false});}
 const price=await stripe('POST','/prices',{currency:'cad',unit_amount:pack.price,tax_behavior:'exclusive',product_data:{name:'Disjonio — '+pack.name,metadata:{pack_id:pack.id}},metadata:{pack_id:pack.id}});
 const [row]=await sql`UPDATE app_packs SET stripe_price=${price.id} WHERE id=${pack.id} RETURNING *`;
 return row;
}
// Met à jour notre table à partir d'un objet subscription Stripe.
export async function upsertSubscription(sql,s){
 const userId=await userForCustomer(sql,s.customer,s.metadata?.user_id);
 if(!userId)return null;
 const item=s.items?.data?.[0];
 let planId=s.metadata?.plan_id;
 if(item?.price?.id){const [p]=await sql`SELECT id FROM app_plans WHERE stripe_price_month=${item.price.id} OR stripe_price_year=${item.price.id}`;if(p)planId=p.id;}
 if(!planId)planId=item?.price?.metadata?.plan_id;
 const [exists]=planId?await sql`SELECT id FROM app_plans WHERE id=${planId}`:[];
 if(!exists)return null;
 const status=s.status==='canceled'||s.status==='incomplete_expired'?'canceled':s.status==='unpaid'?'past_due':s.status;
 // Un événement tardif d'un ancien abonnement annulé ne doit pas écraser l'abonnement en cours.
 const [cur]=await sql`SELECT stripe_subscription,status FROM app_subscriptions WHERE user_id=${userId}`;
 if(cur&&cur.stripe_subscription&&cur.stripe_subscription!==s.id&&status==='canceled'&&cur.status!=='canceled')return userId;
 const ts=v=>v?new Date(v*1000).toISOString():null;
 const start=s.current_period_start??item?.current_period_start,end=s.current_period_end??item?.current_period_end;
 await sql`INSERT INTO app_subscriptions(user_id,plan_id,status,interval,source,stripe_customer,stripe_subscription,current_period_start,current_period_end,cancel_at_period_end,updated_at)
  VALUES(${userId},${planId},${status},${item?.price?.recurring?.interval||null},'stripe',${idOf(s.customer)},${s.id},${ts(start)},${ts(end)},${!!s.cancel_at_period_end},now())
  ON CONFLICT (user_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status=EXCLUDED.status,interval=EXCLUDED.interval,source='stripe',stripe_customer=EXCLUDED.stripe_customer,
  stripe_subscription=EXCLUDED.stripe_subscription,current_period_start=EXCLUDED.current_period_start,current_period_end=EXCLUDED.current_period_end,cancel_at_period_end=EXCLUDED.cancel_at_period_end,updated_at=now()`;
 return userId;
}
