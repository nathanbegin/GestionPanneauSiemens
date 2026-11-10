import test from 'node:test';import assert from 'node:assert/strict';
import {makeTranslator} from '../public/i18n-core.js';
import EN from '../public/i18n-en.js';

const tr=makeTranslator(EN);
test('traduction exacte et espaces conservés',()=>{
 assert.equal(tr('Mes sites'),'My sites');
 assert.equal(tr('  Mes sites  '),'  My sites  ');
 assert.equal(tr('Texte inconnu saisi par l’utilisateur'),'Texte inconnu saisi par l’utilisateur');
 assert.equal(tr(''),'');assert.equal(tr('   '),'   ');
 assert.equal(tr('Salon'),'Living room','pièces usuelles de la liste de suggestions');
});
test('valeurs variables et réordonnancement',()=>{
 assert.equal(tr('2 sites · 5 panneau(x)'),'2 sites · 5 panel(s)');
 assert.equal(tr('1 site · 1 panneau(x)'),'1 site · 1 panel(s)');
 assert.equal(tr('Supprimer « Maison », ses 3 panneau(x) et tous leurs circuits ? Cette action est irréversible.'),'Delete “Maison”, its 3 panel(s) and all their circuits? This action cannot be undone.');
 assert.equal(tr('Charge de 55,4 A supérieure au disjoncteur de 40 A.'),'Load of 55,4 A exceeds the 40 A breaker.');
 assert.equal(tr('Circuit 15/17 : Charge de 46.7 A supérieure au disjoncteur de 30 A.'),'Circuit 15/17: Load of 46.7 A exceeds the 30 A breaker.','préfixe + motif');
 assert.equal(tr('140 m² (rez-de-chaussée et étages) + 75 % × 80 m² (sous-sol) = 200 m²'),'140 m² (ground floor and upper floors) + 75 % × 80 m² (basement) = 200 m²');
});
test('préfixes : « Modifié » + durée',()=>{
 assert.equal(tr('Modifié il y a 8 h'),'Modified 8 h ago');
 assert.equal(tr('Modifié à l’instant'),'Modified just now');
});
test('dictionnaire cohérent',()=>{
 const seen=new Set();
 for(const [fr,en] of EN){
  assert.ok(typeof fr==='string'&&typeof en==='string'&&fr&&en,'entrée vide : '+fr);
  assert.ok(!seen.has(fr),'clé en double : '+fr);seen.add(fr);
  const n=fr.split('{}').length-1,ph=[...en.matchAll(/\{(\d*)\}/g)].map(m=>m[1]);
  assert.ok(ph.every(p=>p===''?true:Number(p)>=1&&Number(p)<=n),'marqueur invalide : '+fr+' → '+en);
  if(n&&ph.every(p=>p===''))assert.equal(ph.length,n,'nombre de {} différent : '+fr);
  assert.ok(!/[àâçéèêëîïôûùü]{1}.*\b(le|la|les|des|pour|avec)\b/.test(en)||/Mon Panneau|Hydro|Québec/.test(en),'traduction encore en français ? '+en);
 }
});

import DOCS from '../public/i18n-en-docs.js';
import ADMIN from '../public/i18n-en-admin.js';
import {translatorFor,localeFor} from '../api/_lib/i18n.js';
import {mailText} from '../api/_lib/mail-text.js';
import {buildLabels,buildLoads} from '../api/_lib/pdf.js';
import {blank} from '../public/model.js';

test('dictionnaires secondaires cohérents',()=>{
 for(const [name,dict] of [['docs',DOCS],['admin',ADMIN]]){
  const seen=new Set();
  for(const [fr,en] of dict){
   assert.ok(fr&&en,name+' : entrée vide');assert.ok(!seen.has(fr),name+' : clé en double '+fr);seen.add(fr);
   const n=fr.split('{}').length-1,ph=[...en.matchAll(/\{(\d*)\}/g)].map(m=>m[1]);
   assert.ok(ph.every(p=>p===''?true:Number(p)>=1&&Number(p)<=n),name+' : marqueur invalide '+fr);
  }
 }
 assert.ok(DOCS.length>500&&ADMIN.length>100);
});
test('traduction côté serveur et formats',()=>{
 const en=translatorFor('en'),fr=translatorFor('fr');
 assert.equal(en('Liste des électroménagers (3)'),'Appliance list (3)');
 assert.equal(fr('Liste des électroménagers (3)'),'Liste des électroménagers (3)','français : texte inchangé');
 assert.equal(en('Charge de base — 5000 W (90 premiers m²) = 6000 W').startsWith('Basic load — '),true);
 assert.equal(en('La règle des 80 % pour chaque circuit (8-104)'),'The 80 % rule for each circuit (8-104)');
 assert.equal(en('GFCI').length>0,true);
 assert.equal(localeFor('en'),'en-CA');assert.equal(localeFor('fr'),'fr-CA');assert.equal(localeFor(undefined),'fr-CA');
});
test('courriels dans la langue du compte',()=>{
 const r=mailText('reset','en',{name:'Nathan',url:'https://x/y'});
 assert.match(r.subject,/password reset/);assert.match(r.text,/Hello Nathan/);assert.match(r.text,/https:\/\/x\/y/);
 assert.match(mailText('reset','fr',{name:'Nathan',url:'u'}).subject,/réinitialisation/);
 assert.match(mailText('reset',undefined,{name:'N',url:'u'}).text,/Bonjour N/,'langue inconnue : français');
 const inv=mailText('invite','en',{who:'Ana',owner:'Elec Inc.',days:7,url:'u'});
 assert.match(inv.subject,/invites you/);assert.match(inv.text,/valid for 7 days/);
 assert.match(mailText('joinRequest','en',{name:'Bo',email:'b@x.ca',url:'u'}).subject,/asks to join/);
});
test('PDF dans la langue demandée',async()=>{
 const panel={id:'3f2b8c1e-4d5a-4b6c-9d7e-1a2b3c4d5e6f',name:'Principal',tag:'P-1',kind:'Principal',location:'',positions:30,details:{mainAmps:100,livingArea:100},circuits:blank(30).map((c,i)=>i<2?{...c,label:'X'+i,amps:15}:c)};
 const base={site:{name:'Maison'},panel,fedFromLabel:''};
 const fr=await buildLabels({...base,lang:'fr'}),en=await buildLabels({...base,lang:'en'});
 assert.ok(fr.length>1000&&en.length>1000);
 const L=lang=>buildLoads({user:{name:'N',email:'n@x.ca'},...base,version:'t',lang});
 const [a,b]=[await L('fr'),await L('en')];
 assert.notDeepEqual(Buffer.from(a),Buffer.from(b),'le PDF anglais diffère du français');
 // la locale ne reste pas bloquée en anglais pour un PDF français suivant
 assert.ok((await L('fr')).length>1000);
});
