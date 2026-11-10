import test from 'node:test';import assert from 'node:assert/strict';
import {blank,reshape,groupCircuits,validate} from '../public/model.js';
import {newGuided,isSplit,ownHalves,sharedHalf,coveredFrom,answerPosition,currentAnswer,nextPosition} from '../public/guided.js';

// 1A micro-ondes | 1B + 3A lié (comptoirs) | 3B chambre
const build=()=>{
 let c=blank(30);const id=x=>c.find(y=>y.slots.includes(x)).id;
 c=reshape(c,id('1A'),'tandem',30);c=reshape(c,id('3A'),'tandem',30);
 c=groupCircuits(c,id('1B'),id('3A'),30);
 c=c.map(x=>x.slots[0]==='1B'?{...x,label:'Comptoirs',amps:15,status:'Identifié'}:x.slots[0]==='3B'?{...x,label:'Chambre',amps:15}:x);
 return {...newGuided({positions:30}),circuits:validate(c,{positions:30}),done:[1]};
};
test('position partagée : 1B + 3A lié, 3B à part',()=>{
 const st=build();
 assert.equal(isSplit(st,3),true);assert.equal(isSplit(st,1),true);assert.equal(isSplit(st,5),false);
 assert.equal(coveredFrom(st,3),null,'3B démarre à la position 3 : pas « couverte »');
 assert.deepEqual(ownHalves(st,3).map(c=>c.slots[0]),['3B']);assert.deepEqual(ownHalves(st,1).map(c=>c.slots[0]),['1A']);
 assert.equal(sharedHalf(st,3).slot,'3A');assert.deepEqual(sharedHalf(st,3).circuit.slots,['1B','3A']);
 assert.equal(nextPosition(st,1),2,'la position 3 reste à décrire');
});
test('répondre pour la moitié libre sans toucher au disjoncteur lié',()=>{
 const st=build();
 const out=answerPosition(st,3,{format:'single',amps:20,label:'Ch. maîtres — prises',usage:'Prises'});
 const pair=out.circuits.find(c=>c.slots.includes('3A'));
 assert.deepEqual(pair.slots,['1B','3A']);assert.equal(pair.label,'Comptoirs');
 const b=out.circuits.find(c=>c.slots[0]==='3B');assert.equal(b.amps,20);assert.equal(b.label,'Ch. maîtres — prises');assert.equal(b.status,'Identifié');
 assert.ok(out.done.includes(3));
 assert.equal(currentAnswer(out,3).format,'single');assert.equal(currentAnswer(out,3).amps,20);
 // espace vide / je ne sais pas
 const e=answerPosition(st,3,{format:'empty'});assert.equal(e.circuits.find(c=>c.slots[0]==='3B').vacant,true);
 const u=answerPosition(st,3,{format:'unknown'});assert.equal(u.circuits.find(c=>c.slots[0]==='3B').label,'Chambre');
 // un double sur la moitié libre est refusé
 assert.throws(()=>answerPosition(st,3,{format:'double',amps:30,label:'X'}),/libre/);
 // 1A (l'autre cas : l'emplacement lié est 1B)
 const o=answerPosition(st,1,{format:'single',amps:15,label:'Micro-ondes'});
 assert.equal(o.circuits.find(c=>c.slots[0]==='1A').label,'Micro-ondes');assert.deepEqual(o.circuits.find(c=>c.slots.includes('1B')).slots,['1B','3A']);
});
test('un vrai double couvre toujours ses positions',()=>{
 let c=blank(30);c=reshape(c,'1','double',30);
 const st={...newGuided({positions:30}),circuits:c};
 assert.equal(isSplit(st,3),false);assert.ok(coveredFrom(st,3));
});
