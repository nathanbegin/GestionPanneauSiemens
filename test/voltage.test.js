import test from 'node:test';import assert from 'node:assert/strict';
import {voltsOf,voltageLabel,siteBipolar,siteVolts,DEFAULT_VOLTS} from '../public/voltage.js';
import {cleanSite} from '../public/model.js';
import {circuitLoad,circuitVolts,phaseBalance,panelReport,suggestions} from '../public/loadcalc.js';
import {blank,reshape} from '../public/model.js';
import {designItems,designCalc,mainFor} from '../public/design.js';

test('réseaux : 120/240 V par défaut, 208 V en option',()=>{
 assert.deepEqual(voltsOf({}),{uni:120,bi:240});
 assert.deepEqual(voltsOf({voltage:'120/240 V monophasé'}),{uni:120,bi:240});
 assert.deepEqual(voltsOf({voltage:'120/208 V triphasé'}),{uni:120,bi:208});
 assert.deepEqual(voltsOf({voltage:'347/600 V triphasé'}),{uni:347,bi:600});
 assert.equal(voltageLabel(208),'120/208 V triphasé');assert.equal(voltageLabel(240),'120/240 V monophasé');assert.equal(voltageLabel(undefined),'120/240 V monophasé');
 assert.equal(siteBipolar({}),240);assert.equal(siteBipolar({bipolarVolts:208}),208);assert.equal(siteBipolar({bipolarVolts:'208'}),208);assert.equal(siteBipolar({bipolarVolts:999}),240);assert.equal(siteBipolar(undefined),240);
 assert.deepEqual(siteVolts({bipolarVolts:208}),{uni:120,bi:208});assert.deepEqual(siteVolts({}),DEFAULT_VOLTS);
});
test('charge d’un circuit selon la tension du réseau',()=>{
 let c=blank(30);const id=x=>c.find(y=>y.slots.includes(x)).id;c=reshape(c,id('1A'),'double',30);
 const circ=c.find(x=>x.slots[0]==='1A');
 const load={name:'Sécheuse',w:5600,v:240,qty:1,cat:'other',cont:false};
 const bip={...circ,amps:30,loads:[load]};
 const r240=circuitLoad(bip),r208=circuitLoad(bip,{uni:120,bi:208});
 assert.equal(r240.volts,240);assert.equal(r208.volts,208);
 assert.equal(r240.demandAmps,23.3);assert.equal(r208.demandAmps,26.9);
 assert.ok(r208.issues.some(i=>i.level==='info'&&/208 V/.test(i.text)));assert.ok(!r240.issues.some(i=>/208/.test(i.text)));
 assert.equal(circuitVolts(bip),240);assert.equal(circuitVolts(bip,{uni:120,bi:208}),208);
 // appareil 240 V sur un unipolaire : erreur quelle que soit la tension du réseau
 const single=c.find(x=>x.slots[0]==='5A');
 assert.ok(circuitLoad({...single,amps:15,loads:[{...load,w:1000}]},{uni:120,bi:208}).issues.some(i=>i.level==='error'&&/bipolaire/.test(i.text)));
 // répartition L1 / L2 : un bipolaire charge les deux phases à la tension du réseau
 const b240=phaseBalance([bip]),b208=phaseBalance([bip],{uni:120,bi:208});
 assert.equal(b240.L1,23.3);assert.equal(b208.L1,26.9);
});
test('bilan d’un panneau 120/208 V',()=>{
 let c=blank(30);const id=x=>c.find(y=>y.slots.includes(x)).id;c=reshape(c,id('1A'),'double',30);
 c=c.map(x=>x.slots[0]==='1A'?{...x,label:'Chauffage',amps:40,loads:[{id:'l',name:'Plinthes',w:9000,v:208,qty:1,cat:'heating',cont:true}]}:x);
 const base={name:'P',tag:'P-1',kind:'Principal',positions:30,circuits:c};
 const a=panelReport({...base,details:{mainAmps:100,livingArea:100}});
 const b=panelReport({...base,details:{mainAmps:100,livingArea:100,voltage:'120/208 V triphasé'}});
 assert.deepEqual(a.vs,{uni:120,bi:240});assert.deepEqual(b.vs,{uni:120,bi:208});
 assert.ok(b.designAmps>a.designAmps,'plus de courant à 208 V pour la même puissance');
 assert.ok(Array.isArray(suggestions(b)));
});
test('conception à 208 V',()=>{
 const input={livingArea:140,basementArea:0,picks:{'range-12':1,dryer:1}};
 const i240=designItems(input),i208=designItems({...input,vs:{uni:120,bi:208}});
 assert.equal(i240.find(i=>/Cuisinière/.test(i.label)).loads[0].v,240);assert.equal(i208.find(i=>/Cuisinière/.test(i.label)).loads[0].v,208);
 assert.equal(i208.find(i=>/Laveuse|Éclairage/.test(i.label)).poles,1);
 const c240=designCalc(i240,input),c208=designCalc(i208,{...input,vs:{uni:120,bi:208}});
 assert.ok(c208.amps>c240.amps);assert.ok(mainFor(c208.amps,0.2)>=mainFor(c240.amps,0.2));
});

test('réglage de tension d’un site',()=>{
 assert.equal(cleanSite({name:'Maison'}).bipolarVolts,240);
 assert.equal(cleanSite({name:'Maison',bipolarVolts:'208'}).bipolarVolts,208);
 assert.equal(cleanSite({name:'Maison',bipolarVolts:'480'}).bipolarVolts,240,'valeur inconnue : 240 V');
});
