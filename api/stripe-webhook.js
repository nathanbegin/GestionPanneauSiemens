// Réception des événements Stripe (à configurer dans Stripe : https://VOTRE-DOMAINE/api/stripe-webhook).
// Événements à cocher : checkout.session.completed, checkout.session.async_payment_succeeded,
// checkout.session.async_payment_failed, customer.subscription.created|updated|deleted, invoice.paid,
// invoice.payment_failed, charge.refunded, charge.dispute.created, radar.early_fraud_warning.created.
import {getSql} from './_lib/db.js';
import {HttpError} from './_lib/http.js';
import {verifyWebhook,upsertSubscription,stripe,invoiceSubscription,userForCustomer} from './_lib/stripe.js';
import {grantCredits} from './_lib/plans.js';

// Litiges et alertes de fraude : consignés dans le journal de la console d'administration.
async function alertAdmin(sql,action,target,details){
 console.error('stripe',action,target,JSON.stringify(details));
 await sql`INSERT INTO app_admin_audit(admin_email,action,target,details) VALUES('stripe',${action},${target||''},${JSON.stringify(details)}::jsonb)`;
}
// Crédit du forfait de panneaux une fois le paiement réellement reçu (paiement immédiat ou différé).
async function fulfillPack(sql,o){
 if(o.mode!=='payment'||o.payment_status!=='paid'||!o.metadata?.pack_id)return;
 const [pack]=await sql`SELECT * FROM app_packs WHERE id=${o.metadata.pack_id}`;
 const userId=await userForCustomer(sql,o.customer,o.metadata?.user_id);
 if(pack&&userId)await grantCredits(sql,{userId,packId:pack.id,panels:pack.panels,validityDays:pack.validity_days,source:'pack',reference:(typeof o.payment_intent==='string'?o.payment_intent:o.payment_intent?.id)||o.id});
}

async function rawBody(req){
 if(typeof req.rawBody==='string')return req.rawBody;
 const chunks=[];for await(const c of req)chunks.push(typeof c==='string'?Buffer.from(c):c);
 return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Méthode non permise.'});}
 let event;
 try{event=verifyWebhook(await rawBody(req),req.headers['stripe-signature']);}
 catch(e){return res.status(e.status||400).json({error:e.message});}
 try{
  const sql=await getSql();
  // Idempotence : Stripe peut renvoyer un même événement.
  const [fresh]=await sql`INSERT INTO app_stripe_events(id,type) VALUES(${event.id},${event.type}) ON CONFLICT DO NOTHING RETURNING id`;
  if(!fresh)return res.status(200).json({received:true,duplicate:true});
  const o=event.data.object;
  try{
   switch(event.type){
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
     if(o.mode==='payment')await fulfillPack(sql,o);
     else if(o.mode==='subscription'&&o.subscription)await upsertSubscription(sql,await stripe('GET','/subscriptions/'+(o.subscription.id||o.subscription)));
     break;
    case 'checkout.session.async_payment_failed':
     await alertAdmin(sql,'stripe.paiement-echoue',o.metadata?.user_id||'',{session:o.id,pack:o.metadata?.pack_id||null});
     break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
     await upsertSubscription(sql,o);break;
    case 'invoice.paid':{
     // Renouvellement payé (ou paiement réussi après un échec) : l'état de l'abonnement est relu chez Stripe.
     const sub=invoiceSubscription(o);
     if(sub)await upsertSubscription(sql,await stripe('GET','/subscriptions/'+sub));
     break;}
    case 'invoice.payment_failed':{
     const sub=invoiceSubscription(o);
     if(sub)await sql`UPDATE app_subscriptions SET status='past_due',updated_at=now() WHERE stripe_subscription=${sub}`;
     break;}
    case 'charge.refunded':
     // Remboursement complet d'un forfait de panneaux : les crédits restants sont retirés.
     if(o.refunded&&o.payment_intent)await sql`UPDATE app_credits SET remaining=0 WHERE reference=${typeof o.payment_intent==='string'?o.payment_intent:o.payment_intent.id}`;
     break;
    case 'charge.dispute.created':
     await alertAdmin(sql,'stripe.litige','',{dispute:o.id,charge:typeof o.charge==='string'?o.charge:o.charge?.id,amount:o.amount,reason:o.reason,payment_intent:typeof o.payment_intent==='string'?o.payment_intent:o.payment_intent?.id||null});
     break;
    case 'radar.early_fraud_warning.created':
     await alertAdmin(sql,'stripe.alerte-fraude','',{warning:o.id,charge:typeof o.charge==='string'?o.charge:o.charge?.id,type:o.fraud_type});
     break;
   }
  }catch(e){
   // Permet à Stripe de réessayer plus tard.
   await sql`DELETE FROM app_stripe_events WHERE id=${event.id}`;throw e;
  }
  return res.status(200).json({received:true});
 }catch(e){console.error('webhook',event?.type,e?.message);return res.status(e instanceof HttpError?e.status:500).json({error:'Traitement impossible.'});}
}
