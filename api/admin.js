// Console d'administration : forfaits, abonnés, crédits, remboursements, statistiques, journal.
// Accès : comptes dont le courriel figure dans ADMIN_EMAILS (séparés par des virgules).
import {getSql} from './_lib/db.js';
import {route,body,HttpError,isUuid} from './_lib/http.js';
import {requireUser,adminEmails} from './_lib/auth.js';
import {planOut,packOut,subOut,entitlement,grantCredits,QUOTA_TYPES,AUDIENCES,LIVE} from './_lib/plans.js';
import {stripeKeyType,STRIPE_VERSION} from './_lib/stripe.js';
import {stripe,stripeConfigured,stripeMode,syncPlanPrices,syncPackPrice,upsertSubscription} from './_lib/stripe.js';
import {FEEDBACK_STATUSES} from '../public/model.js';
import {loadPdfSettings,cleanPdfSettings} from './_lib/footers.js';
import {loadAiSettings,cleanAiSettings,aiModels,aiSource,imageDetail,modelOrder,deniedModels,aiConfigured,testModel,AI_CATALOG,IMAGE_DETAILS,DEFAULT_MODELS} from './_lib/ai.js';

const int=(v,{min=0,max=1e7,nullable=false}={})=>{if(nullable&&(v===''||v==null))return null;const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)throw new HttpError(400,'Valeur numérique invalide : '+v);return n;};
const text=(v,max)=>String(v??'').trim().slice(0,max);

async function audit(sql,admin,action,target,details={}){await sql`INSERT INTO app_admin_audit(admin_email,action,target,details) VALUES(${admin.email},${action},${target},${JSON.stringify(details)}::jsonb)`;}
async function loadUser(sql,id){if(!isUuid(id))throw new HttpError(400,'Utilisateur invalide.');const [u]=await sql`SELECT * FROM app_users WHERE id=${id}`;if(!u)throw new HttpError(404,'Utilisateur introuvable.');return u;}

export default route(['GET','POST'],async(req,res)=>{
 const sql=await getSql();
 const admin=await requireUser(req,sql);
 if(!adminEmails().includes(admin.email))throw new HttpError(403,'Accès réservé à l’administration.');
 const action=String(req.query?.action||'');
 const q=req.query||{};
 if(req.method==='GET'){
  if(action==='overview'){
   const [{users}]=await sql`SELECT count(*)::int AS users FROM app_users`;
   const [{new30}]=await sql`SELECT count(*)::int AS new30 FROM app_users WHERE created_at>now()-interval '30 days'`;
   const [{panels}]=await sql`SELECT count(*)::int AS panels FROM app_panels`;
   const byPlan=await sql`SELECT s.plan_id,s.status,s.interval,count(*)::int AS n,p.name,p.price_month,p.price_year FROM app_subscriptions s JOIN app_plans p ON p.id=s.plan_id GROUP BY 1,2,3,5,6,7`;
   let mrr=0,paying=0;
   for(const r of byPlan)if(['active','past_due'].includes(r.status)&&r.status!=='comp'){paying+=r.n;mrr+=r.n*(r.interval==='year'?(r.price_year||0)/12:(r.price_month||0));}
   const [{canceled30}]=await sql`SELECT count(*)::int AS canceled30 FROM app_subscriptions WHERE status='canceled' AND updated_at>now()-interval '30 days'`;
   const [{credits}]=await sql`SELECT coalesce(sum(panels),0)::int AS credits FROM app_credits WHERE source='pack' AND created_at>now()-interval '30 days'`;
   const [{feedbackNew}]=await sql`SELECT count(*)::int AS "feedbackNew" FROM app_feedback WHERE status='nouveau'`;
   return res.status(200).json({users,new30,panels,paying,mrr:Math.round(mrr),canceled30,packPanels30:credits,feedbackNew,byPlan,stripe:stripeMode(),stripeKey:stripeKeyType(),stripeVersion:STRIPE_VERSION,webhook:!!process.env.STRIPE_WEBHOOK_SECRET,tax:process.env.STRIPE_TAX==='1'});
  }
  if(action==='users'){
   const search='%'+text(q.q,100).toLowerCase()+'%',plan=text(q.plan,60),status=text(q.status,20),page=Math.max(0,int(q.page||0,{max:10000}));
   const rows=await sql`SELECT u.id,u.email,u.name,u.created_at,u.profile->>'accountType' AS account_type,s.plan_id,s.status,s.interval,s.current_period_end,s.source,s.cancel_at_period_end,
    (SELECT count(*)::int FROM app_panels p WHERE p.user_id=u.id) AS panels,(SELECT count(*)::int FROM app_sites x WHERE x.user_id=u.id) AS sites
    FROM app_users u LEFT JOIN app_subscriptions s ON s.user_id=u.id
    WHERE (lower(u.email) LIKE ${search} OR lower(u.name) LIKE ${search})
     AND (${plan}='' OR coalesce(s.plan_id,'gratuit')=${plan}) AND (${status}='' OR coalesce(s.status,'gratuit')=${status})
    ORDER BY u.created_at DESC LIMIT 50 OFFSET ${page*50}`;
   return res.status(200).json({users:rows});
  }
  if(action==='user'){
   const u=await loadUser(sql,String(q.id));
   const e=await entitlement(sql,u.id);
   const credits=await sql`SELECT id,pack_id,panels,remaining,expires_at,source,created_at FROM app_credits WHERE user_id=${u.id} ORDER BY created_at DESC`;
   const sites=await sql`SELECT s.id,s.name,s.city,(SELECT count(*)::int FROM app_panels p WHERE p.site_id=s.id) AS panels FROM app_sites s WHERE s.user_id=${u.id} ORDER BY s.name`;
   let charges=[];
   if(u.stripe_customer&&stripeConfigured()){try{charges=(await stripe('GET','/charges',{customer:u.stripe_customer,limit:20})).data.map(c=>({id:c.id,amount:c.amount,refunded:c.amount_refunded,currency:c.currency,created:c.created*1000,description:c.description,status:c.status,receipt:c.receipt_url}));}catch(x){charges=[{error:x.message}];}}
   const log=await sql`SELECT admin_email,action,details,at FROM app_admin_audit WHERE target=${u.id} ORDER BY at DESC LIMIT 30`;
   return res.status(200).json({user:{id:u.id,email:u.email,name:u.name,profile:u.profile,createdAt:u.created_at,stripeCustomer:u.stripe_customer},entitlement:e,credits,sites,charges,log});
  }
  if(action==='plans'){
   const plans=await sql`SELECT * FROM app_plans ORDER BY sort,id`;const packs=await sql`SELECT * FROM app_packs ORDER BY price`;
   const counts=await sql`SELECT plan_id,count(*)::int AS n FROM app_subscriptions WHERE status=ANY(${LIVE}) GROUP BY plan_id`;
   return res.status(200).json({plans:plans.map(p=>({...planOut(p),stripePriceMonth:p.stripe_price_month,stripePriceYear:p.stripe_price_year,subscribers:counts.find(c=>c.plan_id===p.id)?.n||0})),packs:packs.map(k=>({...packOut(k),stripePrice:k.stripe_price})),quotaTypes:QUOTA_TYPES,audiences:AUDIENCES});
  }
  if(action==='ai'){
   const settings=await loadAiSettings(sql);
   const usage=await sql`SELECT model,count(*) FILTER (WHERE ok)::int AS ok,count(*) FILTER (WHERE NOT ok)::int AS failed,coalesce(sum(input_tokens),0)::int AS input,coalesce(sum(output_tokens),0)::int AS output FROM app_ai_scans WHERE created_at>now()-interval '30 days' GROUP BY model ORDER BY 2 DESC`;
   return res.status(200).json({configured:aiConfigured(),settings,source:aiSource(settings),models:aiModels(settings),order:modelOrder(settings),detail:imageDetail(settings),denied:deniedModels(),
    envModel:process.env.OPENAI_MODEL||'',defaults:DEFAULT_MODELS,catalog:AI_CATALOG,details:IMAGE_DETAILS,usage});
  }
  if(action==='pdf')return res.status(200).json(await loadPdfSettings(sql));
  if(action==='site'){const [st]=await sql`SELECT value FROM app_settings WHERE key='site'`;return res.status(200).json({font:['manrope','inter','system'].includes(st?.value?.font)?st.value.font:'manrope'});}
  if(action==='feedback'){
   const status=text(q.status,20);
   const rows=await sql`SELECT id,user_id,email,name,category,message,page,app_version,client,status,admin_note,created_at,updated_at FROM app_feedback WHERE (${status}='' OR status=${status}) ORDER BY created_at DESC LIMIT 300`;
   const counts=await sql`SELECT status,count(*)::int AS n FROM app_feedback GROUP BY status`;
   return res.status(200).json({items:rows,counts:Object.fromEntries(counts.map(c=>[c.status,c.n])),statuses:FEEDBACK_STATUSES});
  }
  if(action==='audit'){const rows=await sql`SELECT a.*,u.email AS target_email FROM app_admin_audit a LEFT JOIN app_users u ON u.id::text=a.target ORDER BY at DESC LIMIT 200`;return res.status(200).json({log:rows});}
  throw new HttpError(404,'Action inconnue.');
 }
 const d=body(req);
 if(action==='site'){
  const font=String(d.font||'');
  if(!['manrope','inter','system'].includes(font))throw new HttpError(400,'Police invalide.');
  await sql`INSERT INTO app_settings(key,value,updated_by) VALUES('site',${JSON.stringify({font})}::jsonb,${admin.email}) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=now(),updated_by=EXCLUDED.updated_by`;
  await audit(sql,admin,'site-settings','site',{font});
  return res.status(200).json({font});
 }
 if(action==='pdf'){
  const clean=cleanPdfSettings(d);
  await sql`INSERT INTO app_settings(key,value,updated_by) VALUES('pdf',${JSON.stringify(clean)}::jsonb,${admin.email}) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=now(),updated_by=EXCLUDED.updated_by`;
  await audit(sql,admin,'pdf-settings','pdf',{footers:clean.footers.length});
  return res.status(200).json(clean);
 }
 if(action==='feedback-update'){
  const id=int(d.id,{min:1,max:1e12});
  const status=text(d.status,20);if(!FEEDBACK_STATUSES[status])throw new HttpError(400,'Statut invalide.');
  const note=text(d.note,2000);
  const [row]=await sql`UPDATE app_feedback SET status=${status},admin_note=${note},updated_at=now() WHERE id=${id} RETURNING id`;
  if(!row)throw new HttpError(404,'Suggestion introuvable.');
  await audit(sql,admin,'feedback','fb-'+id,{status});
  return res.status(200).json({ok:true});
 }
 if(action==='ai'){
  const clean=cleanAiSettings(d);
  await sql`INSERT INTO app_settings(key,value,updated_by) VALUES('ai',${JSON.stringify(clean)}::jsonb,${admin.email}) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=now(),updated_by=EXCLUDED.updated_by`;
  await audit(sql,admin,'ai-settings','ai',clean);
  return res.status(200).json({ok:true,settings:clean,models:aiModels(clean)});
 }
 if(action==='ai-test'){
  const model=text(d.model,64);
  return res.status(200).json({model,...await testModel(model)});
 }
 if(action==='plan'){
  const id=text(d.id,60).toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{1,59}$/.test(id))throw new HttpError(400,'Identifiant de forfait invalide (lettres minuscules, chiffres, tirets).');
  if(!QUOTA_TYPES[d.quotaType])throw new HttpError(400,'Type de quota invalide.');
  if(!AUDIENCES[d.audience])throw new HttpError(400,'Public cible invalide.');
  const name=text(d.name,80);if(!name)throw new HttpError(400,'Nom requis.');
  const p={name,audience:d.audience,description:text(d.description,300),pm:int(d.priceMonth,{nullable:true,max:1e6}),py:int(d.priceYear,{nullable:true,max:1e7}),qt:d.quotaType,limit:int(d.panelLimit,{nullable:true,max:100000}),sites:int(d.siteLimit,{nullable:true,max:100000}),seats:int(d.seats||1,{min:1,max:500}),trial:int(d.trialDays||0,{max:90}),sort:int(d.sort||0,{max:1000}),features:{planning:!!d.features?.planning,branding:!!d.features?.branding,team:!!d.features?.team,qr:!!d.features?.qr,...(d.features?.ai?{ai:true}:{}),...(d.features?.aiLite?{aiLite:true}:{}),...(Number.isInteger(d.features?.aiScans)&&d.features.aiScans>=0&&d.features.aiScans<=100000?{aiScans:d.features.aiScans}:{})}};
  if(id==='gratuit'&&(p.pm||p.py))throw new HttpError(400,'Le forfait gratuit doit rester à 0 $.');
  const [before]=await sql`SELECT * FROM app_plans WHERE id=${id}`;
  let [row]=await sql`INSERT INTO app_plans(id,name,audience,description,price_month,price_year,quota_type,panel_limit,site_limit,seats,features,trial_days,active,public,sort,updated_at)
   VALUES(${id},${p.name},${p.audience},${p.description},${p.pm},${p.py},${p.qt},${p.limit},${p.sites},${p.seats},${JSON.stringify(p.features)}::jsonb,${p.trial},${d.active!==false},${d.public!==false},${p.sort},now())
   ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,audience=EXCLUDED.audience,description=EXCLUDED.description,price_month=EXCLUDED.price_month,price_year=EXCLUDED.price_year,quota_type=EXCLUDED.quota_type,
   panel_limit=EXCLUDED.panel_limit,site_limit=EXCLUDED.site_limit,seats=EXCLUDED.seats,features=EXCLUDED.features,trial_days=EXCLUDED.trial_days,active=EXCLUDED.active,public=EXCLUDED.public,sort=EXCLUDED.sort,updated_at=now() RETURNING *`;
  if(id==='gratuit'&&!row.active)[row]=await sql`UPDATE app_plans SET active=true WHERE id='gratuit' RETURNING *`;
  let warning='';
  try{row=await syncPlanPrices(sql,row);}catch(x){warning='Enregistré, mais synchronisation Stripe impossible : '+x.message;}
  await audit(sql,admin,before?'plan.update':'plan.create',id,{before:before&&planOut(before),after:planOut(row)});
  return res.status(200).json({plan:planOut(row),warning,note:before&&(before.price_month!==row.price_month||before.price_year!==row.price_year)?'Nouveau prix appliqué aux nouveaux abonnements. Les abonnés actuels conservent leur prix.':''});
 }
 if(action==='pack'){
  const id=text(d.id,60).toLowerCase();if(!/^[a-z0-9][a-z0-9-]{1,59}$/.test(id))throw new HttpError(400,'Identifiant invalide.');
  let [row]=await sql`INSERT INTO app_packs(id,name,panels,price,validity_days,active,updated_at) VALUES(${id},${text(d.name,80)||id},${int(d.panels,{min:1,max:10000})},${int(d.price,{min:100,max:1e7})},${int(d.validityDays||365,{min:1,max:3650})},${d.active!==false},now())
   ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,panels=EXCLUDED.panels,price=EXCLUDED.price,validity_days=EXCLUDED.validity_days,active=EXCLUDED.active,updated_at=now() RETURNING *`;
  let warning='';try{row=await syncPackPrice(sql,row);}catch(x){warning='Enregistré, mais synchronisation Stripe impossible : '+x.message;}
  await audit(sql,admin,'pack.upsert',id,packOut(row));
  return res.status(200).json({pack:packOut(row),warning});
 }
 const u=await loadUser(sql,String(d.userId));
 const [sub]=await sql`SELECT * FROM app_subscriptions WHERE user_id=${u.id}`;
 const stripeLive=sub?.stripe_subscription&&LIVE.includes(sub.status)&&sub.status!=='comp';
 if(action==='set-plan'){
  // Forfait offert / attribué manuellement (sans paiement).
  const [plan]=await sql`SELECT id FROM app_plans WHERE id=${text(d.planId,60)}`;if(!plan)throw new HttpError(404,'Forfait introuvable.');
  if(stripeLive)throw new HttpError(409,'Cet abonné paie par Stripe : changez son forfait avec « Changer (Stripe) » ou annulez d’abord son abonnement.');
  const until=d.until?new Date(d.until+'T23:59:59'):null;if(until&&isNaN(until))throw new HttpError(400,'Date invalide.');
  await sql`INSERT INTO app_subscriptions(user_id,plan_id,status,source,current_period_start,current_period_end,note,updated_at) VALUES(${u.id},${plan.id},'comp','admin',now(),${until?.toISOString()||null},${text(d.note,300)},now())
   ON CONFLICT (user_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status='comp',source='admin',current_period_start=now(),current_period_end=EXCLUDED.current_period_end,note=EXCLUDED.note,cancel_at_period_end=false,updated_at=now()`;
  await audit(sql,admin,'subscription.comp',u.id,{planId:plan.id,until:d.until||null,note:d.note||''});
  return res.status(200).json({ok:true});
 }
 if(action==='stripe-change'){
  if(!stripeLive)throw new HttpError(400,'Aucun abonnement Stripe actif.');
  let [plan]=await sql`SELECT * FROM app_plans WHERE id=${text(d.planId,60)}`;if(!plan)throw new HttpError(404,'Forfait introuvable.');
  plan=await syncPlanPrices(sql,plan);
  const interval=d.interval==='year'?'year':'month',price=interval==='year'?plan.stripe_price_year:plan.stripe_price_month;
  if(!price)throw new HttpError(400,'Ce forfait n’a pas de prix '+(interval==='year'?'annuel':'mensuel')+'.');
  const cur=await stripe('GET','/subscriptions/'+sub.stripe_subscription);
  const upd=await stripe('POST','/subscriptions/'+sub.stripe_subscription,{items:[{id:cur.items.data[0].id,price}],proration_behavior:d.prorate===false?'none':'create_prorations',metadata:{user_id:u.id,plan_id:plan.id}});
  await upsertSubscription(sql,upd);
  await audit(sql,admin,'subscription.stripe-change',u.id,{planId:plan.id,interval});
  return res.status(200).json({ok:true});
 }
 if(action==='cancel'){
  if(stripeLive){
   const upd=d.immediate?await stripe('DELETE','/subscriptions/'+sub.stripe_subscription,{prorate:d.prorate?'true':undefined}):await stripe('POST','/subscriptions/'+sub.stripe_subscription,{cancel_at_period_end:true});
   await upsertSubscription(sql,upd);
  }else if(sub)await sql`UPDATE app_subscriptions SET status='canceled',updated_at=now() WHERE user_id=${u.id}`;
  await audit(sql,admin,'subscription.cancel',u.id,{immediate:!!d.immediate});
  return res.status(200).json({ok:true});
 }
 if(action==='resume'){
  if(!stripeLive||!sub.cancel_at_period_end)throw new HttpError(400,'Aucune annulation programmée.');
  await upsertSubscription(sql,await stripe('POST','/subscriptions/'+sub.stripe_subscription,{cancel_at_period_end:false}));
  await audit(sql,admin,'subscription.resume',u.id);return res.status(200).json({ok:true});
 }
 if(action==='override'){
  const limit=int(d.limit,{nullable:true,max:100000});
  if(!sub)await sql`INSERT INTO app_subscriptions(user_id,plan_id,status,source,limit_override) VALUES(${u.id},'gratuit','comp','admin',${limit})`;
  else await sql`UPDATE app_subscriptions SET limit_override=${limit},updated_at=now() WHERE user_id=${u.id}`;
  await audit(sql,admin,'subscription.override',u.id,{limit});return res.status(200).json({ok:true});
 }
 if(action==='credits'){
  const panels=int(d.panels,{min:1,max:10000}),days=int(d.days||365,{min:1,max:3650});
  await grantCredits(sql,{userId:u.id,panels,validityDays:days,source:'admin'});
  await audit(sql,admin,'credits.grant',u.id,{panels,days,note:text(d.note,300)});return res.status(200).json({ok:true});
 }
 if(action==='refund'){
  if(!u.stripe_customer)throw new HttpError(400,'Aucun paiement Stripe pour cet utilisateur.');
  const charge=await stripe('GET','/charges/'+text(d.charge,80));
  if(charge.customer!==u.stripe_customer)throw new HttpError(400,'Ce paiement n’appartient pas à cet utilisateur.');
  const amount=d.amount===''||d.amount==null?undefined:int(d.amount,{min:1,max:charge.amount-charge.amount_refunded});
  const refund=await stripe('POST','/refunds',{charge:charge.id,amount,reason:'requested_by_customer',metadata:{admin:admin.email,note:text(d.note,300)}},{idempotencyKey:`refund-${charge.id}-${amount||'all'}-${charge.amount_refunded}`});
  await audit(sql,admin,'payment.refund',u.id,{charge:charge.id,amount:refund.amount,note:text(d.note,300)});
  return res.status(200).json({ok:true,amount:refund.amount});
 }
 throw new HttpError(404,'Action inconnue.');
});
