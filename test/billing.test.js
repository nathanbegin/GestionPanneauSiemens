import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {encode,verifyWebhook} from '../api/_lib/stripe.js';
test('encodage des paramètres Stripe imbriqués',()=>{
 const s=encode({mode:'subscription',line_items:[{price:'price_1',quantity:1}],metadata:{user_id:'u'},automatic_tax:{enabled:false},skip:undefined}).toString();
 assert.equal(decodeURIComponent(s),'mode=subscription&line_items[0][price]=price_1&line_items[0][quantity]=1&metadata[user_id]=u&automatic_tax[enabled]=false');
});
test('signature des webhooks Stripe',()=>{
 const raw=JSON.stringify({id:'evt_1',type:'x'}),t=Math.floor(Date.now()/1000);
 const sig=createHmac('sha256','whsec_a').update(`${t}.${raw}`).digest('hex');
 assert.equal(verifyWebhook(raw,`t=${t},v1=${sig}`,'whsec_a').id,'evt_1');
 assert.throws(()=>verifyWebhook(raw,`t=${t},v1=${sig}`,'whsec_b'));
 assert.throws(()=>verifyWebhook(raw,`t=${t-1000},v1=${sig}`,'whsec_a'));
 assert.throws(()=>verifyWebhook(raw+' ',`t=${t},v1=${sig}`,'whsec_a'));
});
import {parsePromoCodes,findPromo} from '../api/_lib/plans.js';
test('codes promo',()=>{
 const codes=parsePromoCodes('NATHAN2026, essai-pro:electricien-solo:90,abc');
 assert.equal(codes.length,2);
 assert.deepEqual(findPromo(' nathan2026 ',codes),{code:'NATHAN2026',plan:'acces-complet',days:null});
 assert.equal(findPromo('ESSAI-PRO',codes).days,90);
 assert.equal(findPromo('faux',codes),null);assert.equal(findPromo('',codes),null);
 assert.equal(parsePromoCodes('').length,0);
});

import {stripeMode,stripeKeyType,invoiceSubscription,integrationId,STRIPE_VERSION} from '../api/_lib/stripe.js';
test('Stripe : clés, versions d’API et formes d’objets',()=>{
 assert.equal(stripeMode('rk_live_x'),'live');assert.equal(stripeMode('sk_live_x'),'live');assert.equal(stripeMode('rk_test_x'),'test');assert.equal(stripeMode(''),'off');
 assert.equal(stripeKeyType('rk_test_x'),'restricted');assert.equal(stripeKeyType('sk_test_x'),'secret');
 // Ancienne forme (avant 2025-03-31) et nouvelle forme des factures.
 assert.equal(invoiceSubscription({subscription:'sub_old'}),'sub_old');
 assert.equal(invoiceSubscription({parent:{subscription_details:{subscription:'sub_new'}}}),'sub_new');
 assert.equal(invoiceSubscription({lines:{data:[{parent:{subscription_item_details:{subscription:'sub_line'}}}]}}),'sub_line');
 assert.equal(invoiceSubscription({}),null);
 assert.match(STRIPE_VERSION,/^\d{4}-\d{2}-\d{2}/);
 const id=integrationId('abonnement').integration_identifier;
 assert.match(id,/-[a-z]{8}$/,'suffixe de 8 lettres');
});
