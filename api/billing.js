// Abonnements côté client : forfaits publics, droits, paiement (Stripe Checkout), changement de forfait, portail client.
import {getSql} from './_lib/db.js';
import {route,body,HttpError} from './_lib/http.js';
import {requireUser} from './_lib/auth.js';
import {planOut,packOut,entitlement,LIVE,AUDIENCES,QUOTA_TYPES,findPromo,parsePromoCodes} from './_lib/plans.js';
import {rateLimit,recordAttempt} from './_lib/auth.js';
import {clientIp} from './_lib/http.js';
import {stripe,stripeConfigured,ensureCustomer,syncPlanPrices,syncPackPrice,upsertSubscription,integrationId} from './_lib/stripe.js';
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
  return res.status(200).json({...e,promo:parsePromoCodes().length>0,creditPacks:credits.map(c=>({panels:c.panels,remaining:c.remaining,expiresAt:c.expires_at,source:c.source})),billing:stripeConfigured(),hasCustomer:!!user.stripe_customer});
 }
 const data=body(req);
 const base=appUrl(req);
 if(action==='checkout'){
  const customer=await ensureCustomer(sql,user);
  if(data.pack){
   let [pack]=await sql`SELECT * FROM app_packs WHERE id=${String(data.pack)} AND active`;
   if(!pack)throw new HttpError(404,'Forfait de panneaux introuvable.');
   pack=await syncPackPrice(sql,pack);
   const s=await stripe('POST','/checkout/sessions',{mode:'payment',customer,locale:'fr-CA',...integrationId('forfait-panneaux'),line_items:[{price:pack.stripe_price,quantity:1}],
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
  const s=await stripe('POST','/checkout/sessions',{mode:'subscription',customer,locale:'fr-CA',...integrationId('abonnement'),line_items:[{price,quantity:1}],allow_promotion_codes:true,
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
 if(action==='redeem'){
  // Code promo : attribue un forfait sans paiement (fonctionne même si Stripe n'est pas configuré).
  await rateLimit(sql,'promo:'+user.id,8,60);await rateLimit(sql,'promo-ip:'+clientIp(req),20,60);
  const promo=findPromo(data.code);
  if(!promo){await recordAttempt(sql,'promo:'+user.id);await recordAttempt(sql,'promo-ip:'+clientIp(req));throw new HttpError(400,'Code promo invalide.');}
  const [plan]=await sql`SELECT id,name FROM app_plans WHERE id=${promo.plan}`;
  if(!plan)throw new HttpError(500,'Le forfait associé à ce code n’existe pas. Vérifiez la variable PROMO_CODES.');
  const [sub]=await sql`SELECT * FROM app_subscriptions WHERE user_id=${user.id}`;
  if(sub?.stripe_subscription&&['active','trialing','past_due'].includes(sub.status))throw new HttpError(409,'Vous avez déjà un abonnement payant. Annulez-le avant d’utiliser un code promo, ou contactez-nous.');
  const until=promo.days?new Date(Date.now()+promo.days*86400000).toISOString():null;
  await sql`INSERT INTO app_subscriptions(user_id,plan_id,status,source,current_period_start,current_period_end,note,updated_at) VALUES(${user.id},${plan.id},'comp','promo',now(),${until},'Code promo',now())
   ON CONFLICT (user_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status='comp',source='promo',current_period_start=now(),current_period_end=EXCLUDED.current_period_end,note='Code promo',cancel_at_period_end=false,updated_at=now()`;
  await sql`INSERT INTO app_admin_audit(admin_email,action,target,details) VALUES(${'code promo'},'promo.redeem',${user.id},${JSON.stringify({plan:plan.id,days:promo.days})}::jsonb)`;
  return res.status(200).json({ok:true,plan:plan.name,until});
 }
 if(action==='portal'){
  if(!user.stripe_customer)throw new HttpError(400,'Aucun historique de paiement pour ce compte.');
  const s=await stripe('POST','/billing_portal/sessions',{customer:user.stripe_customer,locale:'fr-CA',return_url:base+'/app#/abonnement'});
  return res.status(200).json({url:s.url});
 }
 throw new HttpError(404,'Action inconnue.');
});
