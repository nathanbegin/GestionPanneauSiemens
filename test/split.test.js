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

import {mergeScanned} from '../public/model.js';
import {scanToPanel} from '../public/aiscan.js';
test('garnir un panneau existant avec une lecture IA',()=>{
 const scan={is_panel:true,brand:'Siemens',series:'',catalog_number:'',family:'',main_amps:200,bus_amps:200,positions:30,voltage:'120/240 V monophasé',panel_kind:'Principal',
  breakers:[
   {position:1,poles:1,half:'A',spans_next:false,amps:15,label:'Micro-ondes',label_source:'directory',protection:'Standard',confidence:.9},
   {position:1,poles:1,half:'B',spans_next:true,amps:15,label:'Comptoirs',label_source:'directory',protection:'Standard',confidence:.9},
   {position:2,poles:1,half:'',spans_next:false,amps:20,label:'Salon',label_source:'directory',protection:'Standard',confidence:.9},
   {position:4,poles:2,half:'',spans_next:false,amps:40,label:'Cuisinière',label_source:'directory',protection:'Standard',confidence:.9},
   {position:30,poles:1,half:'',spans_next:false,amps:15,label:'Garage',label_source:'directory',protection:'Standard',confidence:.9},
  ],empty_positions:[],confidence:.8,warnings:[],summary:''};
 const scanned=scanToPanel(scan);
 // Panneau existant de 20 positions : le circuit 2 est déjà décrit.
 let ex=blank(20).map(c=>c.slots[0]==='2A'?{...c,label:'Chambre',amps:15,status:'Identifié'}:c);
 const r=mergeScanned(ex,scanned.circuits,20);
 const at=s=>r.circuits.find(c=>c.slots.includes(s));
 assert.equal(at('1A').label,'Micro-ondes');assert.deepEqual(at('1B').slots,['1B','3A']);assert.equal(at('1B').label,'Comptoirs');
 assert.equal(at('2A').label,'Chambre','circuit déjà décrit conservé');
 assert.equal(at('4A').label,'Cuisinière');assert.equal(at('4A').amps,40);
 assert.equal(r.applied,3);
 assert.deepEqual(r.skipped.map(s=>s.reason).sort(),['déjà décrit','hors du panneau'],'Salon (déjà décrit) et Garage (position 30 hors du panneau)');
 validate(r.circuits,{positions:20});
 // remplacement demandé
 const r2=mergeScanned(ex,scanned.circuits,20,{replace:true});
 assert.equal(r2.circuits.find(c=>c.slots.includes('2A')).label,'Salon');
 // panneau vide : tout est appliqué
 const r3=mergeScanned(blank(30),scanned.circuits,30);
 assert.equal(r3.applied,5);assert.equal(r3.skipped.length,0);
});

import {promoteAnswered} from '../public/guided.js';
test('les disjoncteurs confirmés par une réponse passent à « Identifié »',()=>{
 let c=blank(30);const id=x=>c.find(y=>y.slots.includes(x)).id;
 c=reshape(c,id('1A'),'tandem',30);c=reshape(c,id('3A'),'tandem',30);c=groupCircuits(c,id('1B'),id('3A'),30);
 c=c.map(x=>x.slots[0]==='1A'?{...x,label:'Micro-ondes',amps:15}:x.slots[0]==='1B'?{...x,label:'Comptoirs',amps:15}:x.slots[0]==='3B'?{...x,label:'Chambre',amps:15}:x.slots[0]==='5A'?{...x,label:'Salon',amps:20}:x);
 const st={...newGuided({positions:30}),circuits:validate(c,{positions:30}),done:[1,3,5]};
 const st2=answerPosition(st,3,{format:'single',amps:15,label:'Chambre'});
 const out=promoteAnswered(st2,new Map([[3,'single'],[5,'unknown'],[7,'empty']]));
 const status=slot=>out.find(x=>x.slots[0]===slot).status;
 assert.equal(status('3B'),'Identifié','moitié répondue');
 assert.equal(status('1B'),'À confirmer','le disjoncteur lié n’a pas été répondu');
 assert.equal(status('1A'),'À confirmer');assert.equal(status('5A'),'À confirmer','« je ne sais pas » ne confirme rien');
 const out2=promoteAnswered(st2,new Map([[1,'single']]));
 assert.equal(out2.find(x=>x.slots[0]==='1A').status,'Identifié');assert.equal(out2.find(x=>x.slots[0]==='1B').status,'À confirmer');
 const out3=promoteAnswered(st2,new Map([[5,'single']]));assert.equal(out3.find(x=>x.slots[0]==='5A').status,'Identifié');
});
