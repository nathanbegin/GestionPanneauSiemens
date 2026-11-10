import test from 'node:test';import assert from 'node:assert/strict';
import {designItems,designCalc,designDemand,mainFor,genericPositions,draftLayout,DESIGN_APPLIANCES} from '../public/design.js';
import {validate,formatOf} from '../public/model.js';

const input={livingArea:140,basementArea:80,picks:{'range-12':1,dryer:1,'wh-4500':1,dishwasher:1,washer:1,'bb-1500':5,'ev-l2-30':1}};
test('circuits à prévoir',()=>{
 const items=designItems(input);
 // superficie 140 + 0,75 × 80 = 200 m² → 10 circuits d'éclairage et de prises + 2 comptoirs + salle de bain
 assert.equal(items.filter(i=>/Éclairage et prises/.test(i.label)).length,10);
 assert.equal(items.filter(i=>/comptoir/.test(i.label)).length,2);
 assert.equal(items.find(i=>/Salle de bain/.test(i.label)).protection,'DDFT');
 // 5 plinthes → 3 circuits (2 + 2 + 1), bipolaires
 const bb=items.filter(i=>/Plinthes/.test(i.label));assert.equal(bb.length,3);assert.ok(bb.every(i=>i.poles===2&&i.amps===20));
 assert.deepEqual(bb.map(i=>i.loads[0].qty),[2,2,1]);
 // appareils 240 V → bipolaires ; laveuse et lave-vaisselle → unipolaires
 assert.equal(items.find(i=>/Cuisinière/.test(i.label)).poles,2);assert.equal(items.find(i=>/Laveuse/.test(i.label)).poles,1);
 assert.equal(items.find(i=>/Chauffe-eau/.test(i.label)).usage,'Chauffe-eau');
 assert.equal(designItems({livingArea:50,picks:{}}).filter(i=>/Éclairage/.test(i.label)).length,6,'au moins 6');
 assert.deepEqual(designItems({livingArea:100,picks:{'range-12':0}}).filter(i=>i.loads).length,0);
});
test('calcul de la charge, entrée et besoin en circuits',()=>{
 const items=designItems(input);
 const calc=designCalc(items,input);
 assert.ok(calc.amps>100&&calc.amps<160);assert.equal(calc.recommended,150);
 assert.equal(mainFor(calc.amps,0),150);assert.equal(mainFor(calc.amps,0.2),200);assert.equal(mainFor(900),null);
 const d=designDemand(items);
 assert.equal(d.breakers,items.length);assert.equal(d.circuits,items.length+d.bipolar,'bipolaire = 2 circuits');
 assert.equal(d.spaces,2*d.bipolar+Math.ceil((items.length-d.bipolar)/2));
 assert.ok(genericPositions(items)>=20&&genericPositions(items)%2===0);
 assert.ok(genericPositions(items,{tandem:false})>genericPositions(items,{tandem:true}));
});
test('disposition des circuits',()=>{
 const items=designItems(input);
 const pos=genericPositions(items,{tandem:true});
 const r=draftLayout(items,{positions:pos,tandem:true});
 assert.equal(r.unplaced.length,0);
 validate(r.circuits,{positions:pos});
 const placed=r.circuits.filter(c=>c.label);
 assert.equal(placed.length,items.length);
 // bipolaires à gauche, sur deux positions
 const range=placed.find(c=>/Cuisinière/.test(c.label));assert.equal(formatOf(range),'double');assert.equal(range.slots[0],'1A');assert.equal(range.loads[0].w,12000);
 assert.ok(placed.every(c=>c.status==='Identifié'&&c.amps>0));
 assert.equal(placed.find(c=>/Salle de bain/.test(c.label)).protection,'DDFT');
 // sans jumelés : un circuit par position, trop petit → circuits non placés
 const r2=draftLayout(items,{positions:20,tandem:false});
 assert.ok(r2.unplaced.length>0);validate(r2.circuits,{positions:20});
 const big=draftLayout(items,{positions:genericPositions(items,{tandem:false}),tandem:false});assert.equal(big.unplaced.length,0);
 assert.ok(DESIGN_APPLIANCES.every(a=>a.id&&a.label));
});
