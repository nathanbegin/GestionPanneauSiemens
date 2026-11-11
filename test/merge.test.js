import test from 'node:test';import assert from 'node:assert/strict';
import {mergePanel,applyChoices} from '../public/merge.js';
const c=(id,label,amps=15)=>({id,label,amps,slots:[id]});
const base={name:'P',tag:'P-1',kind:'Principal',location:'',details:{brand:'X'},circuits:[c('1','A'),c('2','B'),c('3','C')]};
test('modifications sur des circuits différents : tout est conservé',()=>{
 const local={...base,circuits:[c('1','A hors ligne'),c('2','B'),c('3','C')]};
 const server={...base,circuits:[c('1','A'),c('2','B serveur'),c('3','C')]};
 const m=mergePanel(base,local,server);
 assert.equal(m.conflicts.length,0);
 assert.deepEqual(m.circuits.map(x=>x.label),['A hors ligne','B serveur','C']);
});
test('même circuit modifié des deux côtés : conflit, serveur par défaut, choix possible',()=>{
 const local={...base,circuits:[c('1','local'),c('2','B'),c('3','C')]};
 const server={...base,circuits:[c('1','serveur'),c('2','B'),c('3','C')]};
 const m=mergePanel(base,local,server);
 assert.equal(m.conflicts.length,1);assert.equal(m.circuits[0].label,'serveur');
 const r=applyChoices(m,m.conflicts,{'c:1':'local'});assert.equal(r.circuits[0].label,'local');
});
test('fiche : champs différents fusionnés, même champ en conflit',()=>{
 const local={...base,name:'Neuf',details:{brand:'X',mainAmps:200}};
 const server={...base,location:'Sous-sol',details:{brand:'Y'}};
 const m=mergePanel(base,local,server);
 assert.equal(m.meta.name,'Neuf');assert.equal(m.meta.location,'Sous-sol');
 assert.equal(m.meta.details.mainAmps,200);assert.equal(m.meta.details.brand,'Y');
 const s2={...base,name:'Autre'};const m2=mergePanel(base,local,s2);
 assert.equal(m2.conflicts.some(x=>x.key==='name'),true);
});
test('circuit supprimé par le serveur et non touché localement : supprimé',()=>{
 const server={...base,circuits:[c('1','A'),c('3','C')]};
 const m=mergePanel(base,{...base},server);assert.deepEqual(m.circuits.map(x=>x.id),['1','3']);
});
