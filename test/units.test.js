import test from 'node:test';import assert from 'node:assert/strict';
import {blank,placeBreaker,reshape} from '../public/model.js';
import {breakerUnits,matchBreakers,applyModel} from '../public/units.js';
import {library} from '../api/_lib/library.js';

const L=library();
test('regroupement en disjoncteurs physiques',()=>{
 let c=blank(12);
 c=placeBreaker(c,1,{kind:'quad',amps:[15,20,15]},12);
 c=placeBreaker(c,2,{kind:'tandem',amps:[15,20]},12);
 c=placeBreaker(c,5,{kind:'double',amps:[40]},12);
 c=placeBreaker(c,6,{kind:'single',amps:[15]},12);
 const u=breakerUnits(c);
 assert.deepEqual(u.map(x=>x.kind),['quad','tandem','double','single']);
 assert.deepEqual(u[0].amps,[15,20,15]);assert.equal(u[0].ids.length,3);
 assert.deepEqual(u[1].amps,[15,20]);
});
test('bipolaire sur demi-emplacements reconnu comme quad (relevé existant « 1B / 3A »)',()=>{
 let c=reshape(blank(8),'1','tandem',8);c=reshape(c,'3','tandem',8);
 // fusionne 1B et 3A en un bipolaire, comme dans le panneau réel
 c=c.filter(x=>!['1B','3'].includes(x.id)&&x.slots.join()!=='3A');c.push({id:'q',slots:['1B','3A'],label:'Comptoirs',room:'',usage:'Prises',amps:15,status:'Identifié',notes:''});
 for(const x of c)if(x.slots.join()==='1A'||x.slots.join()==='3B'){x.amps=15;x.label='x';}
 const u=breakerUnits(c).filter(x=>x.kind==='quad');assert.equal(u.length,1);assert.deepEqual(u[0].amps,[15,15,15]);
});
test('modèles compatibles et attribution',()=>{
 let c=placeBreaker(blank(8),1,{kind:'single',amps:[20]},8);c.find(x=>x.amps===20).protection='Anti-arc';
 const unit=breakerUnits(c)[0];
 const m=matchBreakers(unit,L.breakers,{family:'QO',pon:true});
 assert.ok(m.exact.length&&m.exact.every(b=>b.family==='QO'&&b.amps[0]===20&&b.protection==='Anti-arc'));
 assert.equal(m.exact[0].neutre,'PoN');
 const noPon=matchBreakers(unit,L.breakers,{family:'QO',pon:false});assert.ok(noPon.exact.every(b=>b.neutre!=='PoN'));
 const t=breakerUnits(placeBreaker(blank(8),2,{kind:'tandem',amps:[20,15]},8))[0];
 assert.ok(matchBreakers(t,L.breakers,{family:'QO'}).exact.some(b=>b.cat==='QO1520CP'));
 const c2=applyModel(c,unit,m.exact[0]);assert.equal(c2.find(x=>x.amps===20).breakerRef,m.exact[0].cat);
});
