import test from 'node:test';import assert from 'node:assert/strict';
import {newGuided,answerPosition,nextPosition,prevPosition,coveredFrom,fillRestEmpty,currentAnswer,checkAppliances,assignAppliance,guessUsage,progress,canPlace} from '../public/guided.js';
import {validate,designation} from '../public/model.js';

test('mode guidé : construction position par position',()=>{
 let s=newGuided({positions:12});
 s=answerPosition(s,1,{format:'double',amps:40,label:'Cuisinière'});
 assert.equal(nextPosition(s,1),2);assert.ok(coveredFrom(s,3),'3 = 2e pôle de la cuisinière');
 s=answerPosition(s,2,{format:'tandem',halves:[{amps:15,label:'Chambre'},{amps:15,label:'Salle de bain',protection:'DDFT'}]});
 assert.equal(nextPosition(s,2),4,'4 n’est pas couverte');assert.equal(nextPosition(s,4),5,'3 sautée');
 s=answerPosition(s,4,{format:'single',amps:20,label:'Comptoir cuisine'});
 s=answerPosition(s,5,{format:'unknown'});
 s=fillRestEmpty(s,6);
 validate(s.circuits,{positions:12});
 const at=p=>s.circuits.filter(c=>parseInt(c.slots[0])===p);
 assert.equal(designation(at(1)[0]),'1/3');assert.equal(at(1)[0].usage,'Électroménager');assert.equal(at(1)[0].status,'Identifié');
 assert.equal(at(2).length,2);assert.equal(at(2)[1].protection,'DDFT');
 assert.equal(at(5)[0].status,'À confirmer');assert.equal(at(12)[0].vacant,true);
 assert.equal(progress(s).percent,100);
 assert.deepEqual(currentAnswer(s,1),{format:'double',amps:40,label:'Cuisinière',protection:undefined,usage:'Électroménager'});
 assert.equal(currentAnswer(s,2).format,'tandem');assert.equal(currentAnswer(s,12).format,'empty');
 assert.equal(prevPosition(s,5),4);
});

test('mode guidé : changer d’avis et limites',()=>{
 let s=newGuided({positions:6});
 s=answerPosition(s,1,{format:'single',amps:15,label:'Salon'});
 s=answerPosition(s,3,{format:'empty'});
 // Retour à 1 : devient un double, la position 3 (vide) est reprise.
 s=answerPosition(s,1,{format:'double',amps:30,label:'Sécheuse'});
 assert.ok(coveredFrom(s,3));assert.ok(!s.done.includes(3));
 // Revenir à un simple libère la position 3.
 s=answerPosition(s,1,{format:'single',amps:15,label:'Salon'});
 assert.ok(!coveredFrom(s,3));
 s=answerPosition(s,3,{format:'single',amps:20,label:'Garage'});
 assert.match(canPlace(s,1,'double'),/Garage/,'un vrai disjoncteur en dessous bloque');
 assert.match(canPlace(s,5,'double'),/n’existe pas/);
 assert.throws(()=>answerPosition(s,5,{format:'double'}));
 // Jumelé puis simple.
 s=answerPosition(s,2,{format:'tandem',halves:[{amps:15},{amps:20}]});
 s=answerPosition(s,2,{format:'single',amps:20,label:'Laveuse'});
 assert.equal(s.circuits.filter(c=>parseInt(c.slots[0])===2).length,1);
 validate(s.circuits,{positions:6});
});

test('mode guidé : vérification des appareils',()=>{
 let s=newGuided({positions:8});
 s=answerPosition(s,1,{format:'single',amps:30,label:'Sécheuse'});
 s=answerPosition(s,2,{format:'double',amps:30,label:'Chauffe-eau'});
 const f=checkAppliances(s,['dryer','water','range']);
 assert.ok(f.some(x=>x.type==='poles'&&x.appliance.id==='dryer'));
 assert.ok(f.some(x=>x.type==='missing'&&x.appliance.id==='range'));
 assert.ok(!f.some(x=>x.appliance.id==='water'));
 const range=f.find(x=>x.appliance.id==='range').appliance;
 const id=s.circuits.find(c=>parseInt(c.slots[0])===5).id;
 s=assignAppliance(s,id,range);
 assert.ok(!checkAppliances(s,['range']).some(x=>x.type==='missing'));
 assert.equal(guessUsage('Plinthes — chambres'),'Chauffage');assert.equal(guessUsage('Borne VÉ'),'Borne de recharge');assert.equal(guessUsage('Truc'),'Autre');
});

test('mode guidé : position couverte par un disjoncteur double',()=>{
 let s=newGuided({positions:8});
 s=answerPosition(s,2,{format:'double',amps:30,label:'Chauffe-eau'});
 assert.throws(()=>answerPosition(s,4,{format:'single',amps:15}),/fait partie du disjoncteur 2\/4/);
});
