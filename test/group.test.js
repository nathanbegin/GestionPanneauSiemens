import test from 'node:test';import assert from 'node:assert/strict';
import {blank,validate,reshape,nextSlot,prevSlot,groupCandidates,groupCircuits,ungroupCircuit,isLinkedPair,suggestLinks,designation,formatOf} from '../public/model.js';
import {scanToPanel} from '../public/aiscan.js';
import {SCAN_SCHEMA} from '../api/_lib/ai.js';

const base=()=>{let c=blank(30);c=c.map(x=>x.slots.length===2&&x.slots[0]==='5A'||x.slots[0]==='7A'?x:x);return c;};
test('adjacence des demi-emplacements',()=>{
 assert.equal(nextSlot('5A'),'5B');assert.equal(nextSlot('5B'),'7A');assert.equal(nextSlot('6B'),'8A');
 assert.equal(prevSlot('7A'),'5B');assert.equal(prevSlot('5B'),'5A');assert.equal(prevSlot('1A'),null);assert.equal(prevSlot('2A'),null);
});
test('grouper 5B + 7A : candidats, fusion et dissociation',()=>{
 let c=blank(30);
 c=reshape(c,c.find(x=>x.slots[0]==='5A').id,'tandem',30);c=reshape(c,c.find(x=>x.slots[0]==='7A').id,'tandem',30);
 const five=c.find(x=>x.slots[0]==='5B'),seven=c.find(x=>x.slots[0]==='7A');
 const cand=groupCandidates(c,five.id);
 assert.deepEqual(cand.map(x=>x.slot).sort(),['5A','7A']);
 const next=c.map(x=>x.id===five.id?{...x,label:'Chauffage',amps:25}:x);
 const g=groupCircuits(next,five.id,seven.id,30);
 const grp=g.find(x=>x.slots.includes('5B'));
 assert.deepEqual(grp.slots,['5B','7A']);assert.equal(grp.label,'Chauffage');assert.equal(grp.amps,25);assert.ok(isLinkedPair(grp));
 assert.equal(designation(grp),'5B / 7A');assert.equal(formatOf(grp),'double');
 assert.equal(g.filter(x=>x.slots.some(s=>s==='7A'||s==='5B')).length,1);
 validate(g,{positions:30});
 // deux fiches remplies : refus sans force
 const both=next.map(x=>x.id===seven.id?{...x,label:'Autre'}:x);
 assert.throws(()=>groupCircuits(both,five.id,seven.id,30),/déjà une fiche/);
 assert.deepEqual(groupCircuits(both,five.id,seven.id,30,{force:true}).find(x=>x.slots.includes('5B')).label,'Chauffage');
 // une fiche vide absorbe la fiche remplie voisine
 const rev=groupCircuits(next,seven.id,five.id,30).find(x=>x.slots.includes('7A'));assert.equal(rev.label,'Chauffage');
 // dissociation
 const u=ungroupCircuit(g,grp.id,30);
 assert.deepEqual(u.find(x=>x.slots[0]==='5B').slots,['5B']);assert.deepEqual(u.find(x=>x.slots[0]==='7A').slots,['7A']);assert.equal(u.find(x=>x.slots[0]==='5B').label,'Chauffage');
 assert.throws(()=>ungroupCircuit(u,u[0].id,30),/pas un groupe/);
 // colonne différente : pas de candidat
 assert.ok(!groupCandidates(c,five.id).some(x=>/^6|^8/.test(x.slot)));
});
test('lecture IA : disjoncteur sur 5B + 7A (spans_next) et suggestion par ressemblance',()=>{
 const scan={is_panel:true,brand:'Siemens',series:'',catalog_number:'',family:'',main_amps:200,bus_amps:200,positions:30,voltage:'120/240 V monophasé',panel_kind:'Principal',
  breakers:[
   {position:5,poles:1,half:'B',spans_next:true,amps:25,label:'Chauffage',label_source:'directory',protection:'Standard',confidence:.9},
   {position:7,poles:1,half:'A',spans_next:false,amps:25,label:'Chauffage',label_source:'directory',protection:'Standard',confidence:.9},
   {position:9,poles:1,half:'B',spans_next:false,amps:20,label:'Salon',label_source:'directory',protection:'Standard',confidence:.9},
   {position:11,poles:1,half:'A',spans_next:false,amps:20,label:'salon',label_source:'directory',protection:'Standard',confidence:.9},
  ],empty_positions:[],confidence:.8,warnings:[],summary:''};
 const p=scanToPanel(scan);
 const grp=p.circuits.find(c=>c.slots.includes('5B'));
 assert.deepEqual(grp.slots,['5B','7A']);assert.equal(grp.amps,25);
 assert.ok(p.warnings.some(w=>/5B \+ 7A/.test(w)&&/vérifier/.test(w)));
 assert.ok(!p.warnings.some(w=>/ignoré/.test(w)),'le 2e demi-emplacement n’est pas signalé comme conflit');
 assert.deepEqual(p.links.map(l=>l.slots),[['9B','11A']]);
 assert.ok(p.warnings.some(w=>/9B et 11A/.test(w)));
 validate(p.circuits,{positions:p.positions});
});
test('schéma IA : spans_next requis',()=>{assert.ok(SCAN_SCHEMA.properties.breakers.items.required.includes('spans_next'));assert.equal(SCAN_SCHEMA.properties.breakers.items.properties.spans_next.type,'boolean');});
