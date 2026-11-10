import test from 'node:test';import assert from 'node:assert/strict';
import {circuitLoad,rangeCircuitDemand,dwellingCalc} from '../public/loadcalc.js';
import {LOAD_LIBRARY,CONTINUOUS_FACTOR} from '../public/catalog.js';
import {blank,reshape} from '../public/model.js';

// Exemples du « Guide charges électriques résidentielles — Québec » (nov. 2026).
const circ=(amps,loads,poles=2)=>{let c=blank(30);const id=c.find(x=>x.slots.includes('1A')).id;if(poles===2)c=reshape(c,id,'double',30);const x=c.find(y=>y.slots[0]==='1A');return {...x,amps,loads};};
const load=(name,w,v,cat,cont,qty=1)=>({id:'l'+Math.random().toString(36).slice(2,6),name,w,v,qty,cat,cont});
const minB=l=>circuitLoad(circ(200,[l])).minBreaker;

test('tableau des calibres : charge continue ≤ 80 %',()=>{
 assert.equal(CONTINUOUS_FACTOR,0.8);
 const expected={15:12,20:16,25:20,30:24,40:32,50:40,60:48};
 for(const [b,c] of Object.entries(expected))assert.equal(+(Number(b)*CONTINUOUS_FACTOR).toFixed(1),c);
});
test('charges continues : disjoncteur ≥ 125 % (exemples du guide)',()=>{
 assert.equal(minB(load('Borne',7680,240,'ev',true)),40,'32 A × 1,25 = 40 A');
 assert.equal(minB(load('Chauffe-eau',4500,240,'other',true)),25,'18,75 A × 1,25 = 23,44 A → 25 A');
 assert.equal(minB(load('Sécheuse',5000,240,'other',true)),30,'20,83 A × 1,25 = 26,04 A → 30 A');
 assert.equal(minB(load('Plinthe',3000,240,'heating',true)),20,'12,5 A × 1,25 = 15,63 A → 20 A');
 const dryer=LOAD_LIBRARY.find(l=>l.id==='dryer');assert.equal(dryer.cont,true,'la sécheuse est une charge continue');
 // un disjoncteur trop petit pour une charge continue : erreur
 const r=circuitLoad(circ(35,[load('Borne',7680,240,'ev',true)]));
 assert.ok(r.issues.some(i=>i.level==='error'&&/125 %/.test(i.text)));
});
test('cuisinière : circuit (8-300) et entrée de la maison (8-200)',()=>{
 // Maytag YMES8800FZ1 : 13 300 W
 assert.equal(rangeCircuitDemand(13300),8520);
 const r=circuitLoad(circ(40,[load('Cuisinière',13300,240,'range',false)]));
 assert.equal(r.demandAmps,35.5);assert.equal(r.minBreaker,40);
 assert.ok(!r.issues.some(i=>i.level==='error'),'40 A convient');
 assert.ok(circuitLoad(circ(30,[load('Cuisinière',13300,240,'range',false)])).issues.some(i=>i.level==='error'),'30 A ne convient pas');
 const house=dwellingCalc([{id:'a',slots:['1A','1B'],label:'Cuisinière',loads:[load('Cuisinière',13300,240,'range',false)]}],{livingArea:100});
 assert.equal(house.steps.find(s=>s.id==='range').w,6520);
 // cuisinière de 12 kW : 8 000 W sur le circuit → 33,3 A → 40 A
 assert.equal(rangeCircuitDemand(12000),8000);assert.equal(circuitLoad(circ(40,[load('Cuisinière',12000,240,'range',false)])).demandAmps,33.3);
 assert.equal(rangeCircuitDemand(6000),6000,'jamais plus que la puissance de plaque');
});
test('exemple comparatif du guide : circuit et maison',()=>{
 const cs=[
  {id:'a',slots:['1A','1B'],label:'Cuisinière',loads:[load('Maytag',13300,240,'range',false)]},
  {id:'b',slots:['3A','3B'],label:'Chauffe-eau',loads:[load('Chauffe-eau',4500,240,'other',true)]},
  {id:'c',slots:['5A','5B'],label:'Borne',loads:[load('Borne VÉ',7680,240,'ev',true)]},
 ];
 const calc=dwellingCalc(cs,{livingArea:100});
 const w=id=>calc.steps.find(s=>s.id===id)?.w;
 assert.equal(w('range'),6520);assert.equal(w('other'),1125,'chauffe-eau à 25 % avec cuisinière');assert.equal(w('ev'),7680);
 // équivalent circuit du chauffe-eau : 4 500 × 1,25 = 5 625 W
 assert.equal(+(4500*1.25).toFixed(0),5625);
});
test('charge non continue : jamais d’avertissement orange entre 80 et 100 %',()=>{
 const r=circuitLoad(circ(15,[load('Micro-ondes',1500,120,'basic',false)],1));
 assert.ok(r.percent>80&&r.percent<=100);
 assert.ok(!r.issues.some(i=>i.level==='warn'||i.level==='error'),'non continue admissible jusqu’à 100 %');
 assert.ok(r.issues.some(i=>i.level==='info'&&/100 %/.test(i.text)));
 assert.ok(circuitLoad(circ(15,[load('Micro-ondes',2000,120,'basic',false)],1)).issues.some(i=>i.level==='error'),'au-delà de 100 % : erreur');
});
test('appareils à moteur : démarrage ≠ surcharge',()=>{
 const r=circuitLoad(circ(20,[load('Thermopompe centrale',3000,240,'cooling',true)]));
 assert.ok(r.issues.some(i=>i.level==='info'&&/démarrage/.test(i.text)&&/MCA/.test(i.text)));
 assert.ok(!circuitLoad(circ(20,[load('Plinthe',1500,240,'heating',true)])).issues.some(i=>/démarrage/.test(i.text)));
});
