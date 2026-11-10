import test from 'node:test';import assert from 'node:assert/strict';
import {circuitLoad,panelReport,suggestions} from '../public/loadcalc.js';
import {blank,reshape} from '../public/model.js';

const load=(name,w,v,cat,cont)=>({id:'l'+Math.random().toString(36).slice(2,6),name,w,v,qty:1,cat,cont});
const bip=(amps,loads)=>{let c=blank(30);const id=c.find(x=>x.slots.includes('1A')).id;c=reshape(c,id,'double',30);return {c,circ:{...c.find(y=>y.slots[0]==='1A'),amps,loads}};};
const panel=(kind,mainAmps,loads,extra={})=>{const {c,circ}=bip(60,loads);return {name:'P',tag:'P',kind,positions:30,circuits:c.map(x=>x.slots[0]==='1A'?circ:x),details:{mainAmps,livingArea:100,...extra}};};

test('principal d’une maison : jusqu’à 100 % de la charge calculée (8-200), 80 % = simple marge',()=>{
 const loads=[load('Cuisinière',12000,240,'range',false)]; // 6 000 (base) + 6 000 (cuisinière) = 12 000 W = 50 A
 const mk=m=>panelReport(panel('Principal',m,loads));
 const r45=mk(45);assert.equal(r45.designAmps,50);assert.ok(r45.issues.some(i=>i.level==='error'&&/entrée est insuffisante/.test(i.text)));
 const r55=mk(55);assert.ok(r55.percent>80&&r55.percent<=100);
 assert.ok(!r55.issues.some(i=>i.level==='warn'||i.level==='error'),'entre 80 et 100 % : aucune alerte');
 assert.ok(r55.notes.some(n=>n.level==='info'&&/permis jusqu’à 100 %/.test(n.text)));
 assert.equal(r55.status,'high');
 const r100=mk(100);assert.equal(r100.notes.length,0);assert.equal(r100.issues.length,0);
 assert.equal(r55.remaining100,5);assert.equal(r55.remainingAmps,-6,'marge de prudence (80 %) dépassée');
});
test('sous-panneau : charge continue × 1,25, charge non continue à 100 %',()=>{
 const cont=panelReport(panel('Sous-panneau',38,[load('Borne de recharge',7680,240,'ev',true)]));
 assert.equal(cont.designAmps,40,'32 A × 1,25');assert.ok(cont.issues.some(i=>i.level==='error'&&/× 1,25/.test(i.text)));
 const non=panelReport(panel('Sous-panneau',38,[load('Charge intermittente',7680,240,'other',false)]));
 assert.equal(non.designAmps,32);assert.ok(!non.issues.some(i=>i.level==='error'||i.level==='warn'),'32 A sur 38 A : permis');
 const n=panelReport(panel('Sous-panneau',45,[load('Borne de recharge',7680,240,'ev',true)]));
 assert.equal(n.percent,89);assert.ok(!n.issues.length&&n.notes.length===1);
});
test('circuit : charge continue ≠ non continue',()=>{
 const circ=(amps,l)=>bip(amps,[l]).circ;
 // 32 A continus sur 40 A : exactement 80 % → permis ; sur 35 A : 91 % → erreur (disjoncteur ≥ 125 %)
 assert.ok(!circuitLoad(circ(40,load('Borne',7680,240,'ev',true))).issues.some(i=>i.level==='error'||i.level==='warn'));
 assert.ok(circuitLoad(circ(35,load('Borne',7680,240,'ev',true))).issues.some(i=>i.level==='error'));
 // la même intensité non continue sur 35 A : permis (jusqu’à 100 %), simple note
 const non=circuitLoad(circ(35,load('Appareil intermittent',7680,240,'other',false)));
 assert.ok(!non.issues.some(i=>i.level==='error'||i.level==='warn'));assert.ok(non.issues.some(i=>i.level==='info'&&/100 %/.test(i.text)));
 // au-delà de 100 % : surcharge dans les deux cas
 assert.ok(circuitLoad(circ(30,load('Appareil intermittent',7680,240,'other',false))).issues.some(i=>i.level==='error'&&/supérieure au disjoncteur/.test(i.text)));
 // classement à vérifier
 const a=circuitLoad(circ(40,load('Borne de recharge',5000,240,'ev',false)));
 assert.ok(a.issues.some(i=>i.level==='info'&&/normalement une charge continue/.test(i.text)));
 const b=circuitLoad(circ(40,load('Micro-ondes',1500,120,'basic',true)));
 assert.ok(b.issues.some(i=>i.level==='info'&&/normalement une charge non continue/.test(i.text)));
 assert.ok(!circuitLoad(circ(40,load('Borne de recharge',5000,240,'ev',true))).issues.some(i=>/normalement une charge/.test(i.text)));
});
test('suggestions : projection avec les facteurs de demande, limite à 100 % du principal',()=>{
 const rep=panelReport(panel('Principal',100,[load('Cuisinière',12000,240,'range',false)]));
 const s=suggestions(rep);
 assert.ok(s.some(t=>/Borne de recharge/.test(t)&&/sans dépasser le principal/.test(t)),s.join(' | '));
 assert.ok(!s.some(t=>/sans dépasser 80 % du principal/.test(t)));
 // chauffe-eau de 4,5 kW : 25 % avec cuisinière → possible
 assert.ok(s.find(t=>/Chauffe-eau 60 gal/.test(t)).includes('✓ possible'));
 const small=suggestions(panelReport(panel('Principal',55,[load('Cuisinière',12000,240,'range',false)])));
 assert.ok(small.find(t=>/Spa 240 V/.test(t)).includes('✗ dépasserait le principal'));
});
