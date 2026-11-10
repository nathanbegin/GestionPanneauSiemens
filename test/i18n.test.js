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
