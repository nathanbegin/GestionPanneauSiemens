// Page « Mon abonnement » : utilisation, forfaits, paiement et portail Stripe.
import {h,toast,money,fmtDate,confirmDialog} from './dom.js';
import {api,NATIVE,webUrl} from './api.js';
import {pricingGrid} from './pricing.js';

const STATUS={active:'Actif',trialing:'Période d’essai',past_due:'Paiement en retard',canceled:'Annulé',comp:'Offert',incomplete:'Paiement incomplet'};
async function redirect(path,body){
 const {url}=await api(path,{method:'POST',body});
 const browser=window.Capacitor?.Plugins?.Browser;
 if(NATIVE&&browser)await browser.open({url});else location.href=url;
}

export async function billingView({ctx,sub,a,b}){
 ctx.crumbs([['Mes sites','#/sites'],['Mon abonnement']]);
 const [me,catalog]=await Promise.all([api('/api/billing'),api('/api/billing?action=plans')]);
 const subscription=me.subscription;
 const hasStripeSub=subscription?.hasStripe&&['active','trialing','past_due'].includes(subscription.status);
 const used=me.limit==null?0:Math.min(100,Math.round(me.used/me.limit*100));
 const period=me.plan.quotaType==='active'?'panneaux actifs':me.plan.quotaType==='monthly'?'nouveaux panneaux ce mois-ci':'nouveaux panneaux cette année';

 async function choose(plan,interval){
  if(!plan.priceMonth&&!plan.priceYear){
   if(hasStripeSub)return manage();
   return toast('Vous utilisez déjà le forfait gratuit.');
  }
  if(NATIVE)return void window.open(webUrl('/app#/abonnement'),'_blank');
  try{
   if(hasStripeSub){
    if(!await confirmDialog(`Passer au forfait ${plan.name} (${interval==='year'?'annuel':'mensuel'}) ? La différence est calculée au prorata sur votre prochaine facture.`,{confirm:'Changer de forfait'}))return;
    await api('/api/billing?action=change',{method:'POST',body:{plan:plan.id,interval}});toast('Forfait modifié.');location.reload();return;
   }
   toast('Redirection vers le paiement sécurisé…');
   await redirect('/api/billing?action=checkout',{plan:plan.id,interval});
  }catch(e){toast(e.message,7000);}
 }
 async function buyPack(pack){
  if(NATIVE)return void window.open(webUrl('/app#/abonnement'),'_blank');
  try{toast('Redirection vers le paiement sécurisé…');await redirect('/api/billing?action=checkout',{pack:pack.id});}catch(e){toast(e.message,7000);}
 }
 async function manage(){try{await redirect('/api/billing?action=portal',{});}catch(e){toast(e.message,7000);}}

 const thanks=sub==='merci'&&h('div',{class:'notice info'},'Merci ! Votre paiement est confirmé. L’activation peut prendre quelques secondes : ',h('a',{href:'#/abonnement',onclick:()=>setTimeout(()=>location.reload(),50),text:'actualiser'}),'.');
 const usage=h('section',{class:'card usage'},
  h('div',{class:'row page-head'},h('div',{},h('div',{class:'eyebrow',text:'Forfait actuel'}),h('div',{class:'big',text:me.plan.name}),
    subscription&&me.live&&h('div',{class:'small muted'},[STATUS[subscription.status]||subscription.status,subscription.interval&&(subscription.interval==='year'?'annuel':'mensuel'),subscription.currentPeriodEnd&&(subscription.cancelAtPeriodEnd||subscription.status==='comp'?'jusqu’au ':'renouvellement le ')+fmtDate(subscription.currentPeriodEnd)].filter(Boolean).join(' · '))),
   h('div',{class:'page-actions'},me.hasCustomer&&!NATIVE&&h('button',{type:'button',onclick:manage},'Factures, carte et annulation'))),
  subscription?.status==='past_due'&&h('p',{class:'notice',text:'Le dernier paiement a échoué. Mettez à jour votre carte pour conserver votre forfait.'}),
  subscription?.cancelAtPeriodEnd&&h('p',{class:'notice',text:'Votre abonnement est annulé : il reste actif jusqu’à la fin de la période, puis votre compte reviendra au forfait gratuit.'}),
  h('div',{},h('div',{class:'progress-line'},h('div',{class:'progress'},h('i',{style:{width:used+'%'}})),h('span',{text:me.limit==null?`${me.used} ${period}`:`${me.used} / ${me.limit} ${period}`})),
   h('p',{class:'small muted mt',text:[`${me.activePanels} panneau(x) au total`,`${me.sites} site(s)${me.plan.siteLimit!=null?' sur '+me.plan.siteLimit:''}`,me.credits?`${me.credits} panneau(x) prépayé(s) disponible(s)`:null].filter(Boolean).join(' · ')})),
  me.creditPacks.length>0&&h('div',{class:'chips'},me.creditPacks.map(c=>h('span',{class:'badge',text:`${c.remaining}/${c.panels} panneaux · expire le ${fmtDate(c.expiresAt)}`}))));

 const billingOff=!catalog.billing&&h('p',{class:'notice',text:'Le paiement en ligne sera activé sous peu. Vous pouvez déjà consulter les forfaits; le forfait gratuit reste entièrement fonctionnel.'});
 const nativeNote=NATIVE&&h('p',{class:'notice info',text:'Les abonnements se gèrent sur le site web. Les boutons ouvrent la page dans votre navigateur.'});
 const grid=pricingGrid({plans:catalog.plans,packs:catalog.packs,currentPlan:me.plan.id,interval:b||'month',onChoose:choose,onPack:buyPack});
 // Lien direct depuis /tarifs : #/abonnement/choisir/:plan/:interval
 if(sub==='choisir'&&a){const p=catalog.plans.find(x=>x.id===a);if(p&&p.id!==me.plan.id&&catalog.billing)setTimeout(()=>choose(p,b==='year'?'year':'month'),0);history.replaceState(null,'','#/abonnement');}
 return h('div',{class:'container stack'},
  h('div',{class:'page-head'},h('div',{},h('div',{class:'eyebrow',text:'Compte'}),h('h1',{text:'Mon abonnement'}))),
  thanks,usage,billingOff,nativeNote,h('h2',{class:'mt',text:'Forfaits'}),grid);
}
