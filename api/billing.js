// Abonnements côté client : forfaits publics, droits, paiement (Stripe Checkout), changement de forfait, portail client.
import {getSql} from './_lib/db.js';
import {route,body,HttpError} from './_lib/http.js';
import {requireUser} from './_lib/auth.js';
import {planOut,packOut,entitlement,LIVE,AUDIENCES,QUOTA_TYPES} from './_lib/plans.js';
import {stripe,stripeConfigured,ensureCustomer,syncPlanPrices,syncPackPrice,upsertSubscription} from './_lib/stripe.js';
import {appUrl} from './_lib/mail.js';

export default route(['GET','POST'],async(req,res)=>{
 const sql=await getSql();
 const action=String(req.query?.action||'');
 if(req.method==='GET'&&action==='plans'){
  const plans=await sql`SELECT * FROM app_plans WHERE active AND public ORDER BY sort,id`;
  const packs=await sql`SELECT * FROM app_packs WHERE active ORDER BY price`;
  return res.status(200).json({plans:plans.map(planOut),packs:packs.map(packOut),billing:stripeConfigured(),audiences:AUDIENCES,quotaTypes:QUOTA_TYPES,currency:'CAD',taxNote:'Taxes en sus (TPS et TVQ).'});
 }
 const user=await requireUser(req,sql);
 if(req.method==='GET'){
  const e=await entitlement(sql,user.id);
  const credits=await sql`SELECT panels,remaining,expires_at,source FROM app_credits WHERE user_id=${user.id} AND remaining>0 AND expires_at>now() ORDER BY expires_at`;
  return res.status(200).json({...e,creditPacks:credits.map(c=>({panels:c.panels,remaining:c.remaining,expiresAt:c.expires_at,source:c.source})),billing:stripeConfigured(),hasCustomer:!!user.stripe_customer});
 }
 const data=body(req);
 const base=appUrl(req);
 if(action==='checkout'){
  const customer=await ensureCustomer(sql,user);
  if(data.pack){
   let [pack]=await sql`SELECT * FROM app_packs WHERE id=${String(data.pack)} AND active`;
   if(!pack)throw new HttpError(404,'Forfait de panneaux introuvable.');
   pack=await syncPackPrice(sql,pack);
   const s=await stripe('POST','/checkout/sessions',{mode:'payment',customer,locale:'fr-CA',line_items:[{price:pack.stripe_price,quantity:1}],
    automatic_tax:{enabled:process.env.STRIPE_TAX==='1'},customer_update:process.env.STRIPE_TAX==='1'?{address:'auto'}:undefined,
    metadata:{user_id:user.id,pack_id:pack.id},payment_intent_data:{metadata:{user_id:user.id,pack_id:pack.id}},invoice_creation:{enabled:true},
    success_url:base+'/app#/abonnement/merci',cancel_url:base+'/app#/abonnement'});
   return res.status(200).json({url:s.url});
  }
  const interval=data.interval==='year'?'year':'month';
  let [plan]=await sql`SELECT * FROM app_plans WHERE id=${String(data.plan||'')} AND active`;
  if(!plan)throw new HttpError(404,'Forfait introuvable.');
  const amount=interval==='year'?plan.price_year:plan.price_month;
  if(!(amount>0))throw new HttpError(400,'Ce forfait n’est pas offert avec cette périodicité.');
  const [sub]=await sql`SELECT * FROM app_subscriptions WHERE user_id=${user.id}`;
  if(sub?.stripe_subscription&&LIVE.includes(sub.status))throw new HttpError(409,'Vous avez déjà un abonnement. Utilisez « Changer de forfait ».',{hasSubscription:true});
  plan=await syncPlanPrices(sql,plan);
  const price=interval==='year'?plan.stripe_price_year:plan.stripe_price_month;
  const s=await stripe('POST','/checkout/sessions',{mode:'subscription',customer,locale:'fr-CA',line_items:[{price,quantity:1}],allow_promotion_codes:true,
   automatic_tax:{enabled:process.env.STRIPE_TAX==='1'},customer_update:process.env.STRIPE_TAX==='1'?{address:'auto'}:undefined,
   subscription_data:{metadata:{user_id:user.id,plan_id:plan.id},trial_period_days:plan.trial_days>0?plan.trial_days:undefined},
   metadata:{user_id:user.id,plan_id:plan.id},success_url:base+'/app#/abonnement/merci',cancel_url:base+'/app#/abonnement'});
  return res.status(200).json({url:s.url});
 }
 if(action==='change'){
  // Changement de forfait d'un abonnement existant, avec prorata.
  const [sub]=await sql`SELECT * FROM app_subscriptions WHERE user_id=${user.id}`;
  if(!sub?.stripe_subscription||!LIVE.includes(sub.status))throw new HttpError(400,'Aucun abonnement actif à modifier.');
  const interval=data.interval==='year'?'year':'month';
  let [plan]=await sql`SELECT * FROM app_plans WHERE id=${String(data.plan||'')} AND active`;
  if(!plan||!((interval==='year'?plan.price_year:plan.price_month)>0))throw new HttpError(404,'Forfait introuvable.');
  plan=await syncPlanPrices(sql,plan);
  const current=await stripe('GET','/subscriptions/'+sub.stripe_subscription);
  const updated=await stripe('POST','/subscriptions/'+sub.stripe_subscription,{items:[{id:current.items.data[0].id,price:interval==='year'?plan.stripe_price_year:plan.stripe_price_month}],proration_behavior:'create_prorations',cancel_at_period_end:false,metadata:{user_id:user.id,plan_id:plan.id}});
  await upsertSubscription(sql,updated);
  return res.status(200).json({ok:true});
 }
 if(action==='portal'){
  if(!user.stripe_customer)throw new HttpError(400,'Aucun historique de paiement pour ce compte.');
  const s=await stripe('POST','/billing_portal/sessions',{customer:user.stripe_customer,locale:'fr-CA',return_url:base+'/app#/abonnement'});
  return res.status(200).json({url:s.url});
 }
 throw new HttpError(404,'Action inconnue.');
});
