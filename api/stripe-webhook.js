// Réception des événements Stripe (à configurer dans Stripe : https://VOTRE-DOMAINE/api/stripe-webhook).
// Événements : checkout.session.completed, customer.subscription.created|updated|deleted, invoice.payment_failed, charge.refunded.
import {getSql} from './_lib/db.js';
import {HttpError} from './_lib/http.js';
import {verifyWebhook,upsertSubscription,stripe} from './_lib/stripe.js';
import {grantCredits} from './_lib/plans.js';

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
     if(o.mode==='payment'&&o.metadata?.pack_id&&o.payment_status==='paid'){
      const [pack]=await sql`SELECT * FROM app_packs WHERE id=${o.metadata.pack_id}`;
      if(pack)await grantCredits(sql,{userId:o.metadata.user_id,packId:pack.id,panels:pack.panels,validityDays:pack.validity_days,source:'pack',reference:o.payment_intent||o.id});
     }else if(o.mode==='subscription'&&o.subscription){await upsertSubscription(sql,await stripe('GET','/subscriptions/'+o.subscription));}
     break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
     await upsertSubscription(sql,o);break;
    case 'invoice.payment_failed':
     if(o.subscription)await sql`UPDATE app_subscriptions SET status='past_due',updated_at=now() WHERE stripe_subscription=${o.subscription}`;
     break;
    case 'charge.refunded':
     // Remboursement complet d'un forfait de panneaux : les crédits restants sont retirés.
     if(o.refunded&&o.payment_intent)await sql`UPDATE app_credits SET remaining=0 WHERE reference=${o.payment_intent}`;
     break;
   }
  }catch(e){
   // Permet à Stripe de réessayer plus tard.
   await sql`DELETE FROM app_stripe_events WHERE id=${event.id}`;throw e;
  }
  return res.status(200).json({received:true});
 }catch(e){console.error('webhook',event?.type,e?.message);return res.status(e instanceof HttpError?e.status:500).json({error:'Traitement impossible.'});}
}
