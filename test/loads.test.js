import test from 'node:test';import assert from 'node:assert/strict';
import {blank,reshape,validate,cleanPanelMeta} from '../public/model.js';
import {circuitLoad,phaseBalance,dwellingCalc,panelReport,suggestions,materials,legOf,wireFor,nextBreaker} from '../public/loadcalc.js';
import {loadById,FAMILIES} from '../public/catalog.js';

const L=(id,qty=1)=>{const l=loadById(id);return {id,name:l.name,w:l.w,v:l.v,qty,cat:l.cat,cont:l.cont};};

test('phases alternées par rangée',()=>{assert.equal(legOf(1),'L1');assert.equal(legOf(2),'L1');assert.equal(legOf(3),'L2');assert.equal(legOf(4),'L2');assert.equal(legOf(6),'L1');assert.equal(legOf(7),'L2');});
test('fils et disjoncteurs normalisés',()=>{assert.equal(wireFor(40),'8 AWG');assert.equal(wireFor(15),'14 AWG');assert.equal(nextBreaker(37.5),40);assert.equal(nextBreaker(9.6*1.25),15);});
test('borne 32 A : disjoncteur de 40 A exigé (80 %)',()=>{
 let d=reshape(blank(24),'1','double',24);const c=d.find(x=>x.id==='1');c.loads=[L('ev-l2-32')];c.amps=30;
 let r=circuitLoad(c);assert.equal(r.amps,32);assert.equal(r.minBreaker,40);assert.ok(r.issues.some(i=>i.level==='error'));
 c.amps=40;c.wire={gauge:'10 AWG'};r=circuitLoad(c);assert.ok(r.issues.some(i=>/trop petit/.test(i.text)));
 c.wire={gauge:'8 AWG'};r=circuitLoad(c);assert.equal(r.issues.filter(i=>i.level==='error').length,0);assert.equal(r.percent,80);
});
test('appareil 240 V sur unipolaire refusé',()=>{const c=blank(4)[0];c.loads=[L('dryer')];c.amps=30;assert.ok(circuitLoad(c).issues.some(i=>/bipolaire/.test(i.text)));});
test('cuisinière 12 kW sur 40 A acceptée (facteur de demande)',()=>{const c=reshape(blank(8),'1','double',8).find(x=>x.id==='1');c.loads=[L('range-12')];c.amps=40;c.wire={gauge:'8 AWG'};assert.equal(circuitLoad(c).issues.filter(i=>i.level!=='info').length,0);});
test('équilibre des phases',()=>{const d=blank(8);d[0].loads=[{name:'A',w:1200,v:120,qty:1,cat:'basic',cont:false}];d[2].loads=[{name:'B',w:600,v:120,qty:1,cat:'basic',cont:false}];const b=phaseBalance(d);assert.equal(b.L1,10);assert.equal(b.L2,5);assert.equal(b.imbalance,50);});
test('calcul 8-200 : maison de 150 m² avec cuisinière, sécheuse, chauffe-eau, plinthes 14 kW et borne',()=>{
 const d=blank(40);
 d[0].loads=[L('range-12')];d[1].loads=[L('dryer')];d[2].loads=[L('wh-4500')];d[3].loads=[L('bb-2000',7)];d[4].loads=[L('ev-l2-30')];
 const r=dwellingCalc(d,{livingArea:150});
 // base 6000 + chauffage 10000+0,75×4000=13000 + cuisinière 6000 + borne 7200 + 25 % × (5600+4500)=2525
 assert.equal(r.totalW,6000+13000+6000+7200+2525);assert.equal(r.amps,144.7);assert.equal(r.recommended,150);
});
test('rapport, suggestions et matériel',()=>{
 let d=reshape(blank(24),'1','double',24);d.find(x=>x.id==='1').loads=[L('ev-l2-30')];d.find(x=>x.id==='1').amps=40;d.find(x=>x.id==='1').label='Borne';d.find(x=>x.id==='1').breakerRef='Q240';
 const panel={kind:'Principal',positions:24,details:{mainAmps:100,livingArea:100,modelId:'EQL24125D',family:'SIE',maxCircuits:48,tandem:true,modelInfo:'Siemens EQL'},circuits:d};
 const rep=panelReport(panel);assert.ok(rep.percent>0);assert.equal(rep.model.id,'EQL24125D');
 assert.ok(suggestions(rep).length>2);
 const m=materials(panel);assert.equal(m.items[0].ref,'Q240');
});
test('familles publiques',()=>{for(const id of ['QO','HOM','SIE','BR','CH','LEV','CBM'])assert.ok(FAMILIES[id].pitch);});
test('validation des charges, fils et métadonnées',()=>{
 const d=blank(4);d[0].loads=[L('ev-l2-32')];d[0].wire={gauge:'8 AWG',type:'NMD90 (Loomex)',length:12};d[0].breakerRef='Q240';validate(d,{positions:4});
 d[0].loads=[{name:'x',w:-1,v:240,qty:1,cat:'ev',cont:true}];assert.throws(()=>validate(d,{positions:4}));
 d[0].loads=[];d[0].wire={gauge:'9 AWG'};assert.throws(()=>validate(d,{positions:4}));
 const m=cleanPanelMeta({name:'P',details:{modelId:'CQO140M200PC',family:'QO',livingArea:'140',state:'Planifié'}});assert.equal(m.details.livingArea,140);assert.equal(m.details.family,'QO');
 assert.throws(()=>cleanPanelMeta({name:'P',details:{modelId:'mauvais modèle !'}}));assert.throws(()=>cleanPanelMeta({name:'P',details:{family:'XYZ'}}));
});
test('note de calcul : sous-sol à 75 %, étapes, exclusions',()=>{
 const d=blank(20);
 d[0].loads=[L('bb-2000',3)];d[1].loads=[L('hp-3t')];d[2].loads=[L('fridge')];d[3].loads=[{name:'Chauffe-plat',w:2400,v:120,qty:1,cat:'basic',cont:false}];
 const r=dwellingCalc(d,{livingArea:100,basementArea:80,panelTag:'P-1'});
 assert.equal(r.area,160);
 const basic=r.steps.find(s=>s.id==='basic');assert.equal(basic.w,6000);assert.ok(basic.items.some(i=>i.name==='Réfrigérateur'));
 const heat=r.steps.find(s=>s.id==='heat');assert.equal(heat.w,6000);assert.equal(heat.excluded.length,1);
 assert.ok(r.warnings.some(w=>/Chauffe-plat/.test(w)));
 assert.equal(r.items.find(i=>i.name==='Réfrigérateur').where,'P-1 · 3');
});

import {serviceCheck,serviceAmpacity} from '../public/catalog.js';
test('conducteurs d’entrée : vérification et validation',()=>{
 assert.equal(serviceAmpacity('3/0 AWG','Cuivre'),200);
 assert.equal(serviceAmpacity('4/0 AWG','Aluminium'),180);
 assert.equal(serviceCheck({serviceGauge:'3/0 AWG',serviceMaterial:'Cuivre',mainAmps:200}).status,'ok');
 assert.equal(serviceCheck({serviceGauge:'2 AWG',serviceMaterial:'Aluminium',mainAmps:200}).status,'warn');
 assert.equal(serviceCheck({}),null);
 const m=cleanPanelMeta({name:'P',details:{mainAmps:200,serviceGauge:'4/0 AWG',serviceMaterial:'Aluminium',serviceRoute:'Aérienne — mât'}});
 assert.equal(m.details.serviceGauge,'4/0 AWG');assert.equal(m.details.serviceRoute,'Aérienne — mât');
 assert.throws(()=>cleanPanelMeta({name:'P',details:{serviceGauge:'99 AWG'}}));
});
