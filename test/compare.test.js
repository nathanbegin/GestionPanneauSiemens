import test from 'node:test';import assert from 'node:assert/strict';
import {blank,reshape} from '../public/model.js';
import {summarize,diffCircuits} from '../public/js/compare.js';

const panel=(name,edit)=>{let c=blank(30);c=edit(c);return {name,kind:'Principal',positions:30,details:{brand:'Siemens',mainAmps:200,voltage:'120/240 V monophasé'},circuits:c};};
const at=(c,slot)=>c.find(x=>x.slots.includes(slot)).id;
const set=(c,slot,patch)=>c.map(x=>x.id===at(c,slot)?{...x,...patch}:x);

test('résumé d’un panneau',()=>{
 const p=panel('A',c=>{c=set(c,'1A',{label:'Cuisinière',amps:40,status:'Identifié'});c=reshape(c,at(c,'1A'),'double',30);return set(c,'2A',{label:'Chambre',amps:15,protection:'Anti-arc',status:'Identifié'});});
 const s=summarize(p,{name:'Maison'});
 assert.equal(s.site,'Maison');assert.equal(s.used,2);assert.equal(s.sumAmps,55);assert.equal(s.bipolar,1);assert.equal(s.afci,1);assert.equal(s.gfci,0);assert.equal(s.mainAmps,200);assert.equal(s.identified,2);
});
test('comparaison circuit par circuit',()=>{
 const a=panel('A',c=>{c=set(c,'1A',{label:'Cuisine',amps:15});c=set(c,'2A',{label:'Salon',amps:15});c=set(c,'4A',{label:'Garage',amps:20});return c;});
 const b=panel('B',c=>{c=set(c,'1A',{label:'cuisine',amps:15});c=set(c,'2A',{label:'Salon',amps:20});c=set(c,'6A',{label:'Piscine',amps:30});return c;});
 const d=diffCircuits(a,b);
 const st=k=>d.find(r=>r.key===k).state;
 assert.equal(st('1A'),'same','casse et accents ignorés');assert.equal(st('2A'),'diff','calibre différent');assert.equal(st('4A'),'onlyA');assert.equal(st('6A'),'onlyB');
 assert.deepEqual(d.map(r=>r.key),['1A','2A','4A','6A'],'ordre par emplacement');
 assert.equal(diffCircuits(a,a).every(r=>r.state==='same'),true);
});
