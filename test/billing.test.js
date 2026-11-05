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
