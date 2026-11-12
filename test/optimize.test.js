import test from 'node:test';import assert from 'node:assert/strict';
import {blank,validate} from '../public/model.js';
import {optimizeLayout,layoutStats} from '../public/optimize.js';
// Panneau de 12 positions : on remplace des cases par des disjoncteurs décrits.
const mk=(spec,positions=12)=>{
 const cs=blank(positions);
 for(const [pos,label,amps,span=1] of spec){
  const i=cs.findIndex(c=>c.slots[0]===pos+'A');
  const slots=Array.from({length:span},(_,k)=>[`${pos+k*2}A`,`${pos+k*2}B`]).flat();
  cs.splice(i,1,{...cs[i],id:String(pos),slots,label,amps,status:'Identifié'});
  for(let k=1;k<span;k++){const j=cs.findIndex(c=>c.slots[0]===(pos+k*2)+'A');cs.splice(j,1);}
 }
 return {positions,details:{},circuits:validate(cs,{positions})};
};
test('jumelage : libère des espaces et reste valide',()=>{
 const p=mk([[1,'Prise A',15],[2,'Prise B',15],[3,'Prise C',15],[4,'Prise D',20],[5,'Cuisinière',40,2]]);
 const r=optimizeLayout(p,{pair:true});
 assert.ok(!r.error,r.error);validate(r.circuits,{positions:12});
 assert.equal(r.tandems,2);
 assert.equal(r.before.used,6);assert.equal(r.after.used,4);   // 4 unipolaires → 2 espaces ; bipolaire = 2
 assert.equal(r.circuits.filter(c=>c.slots.length===1&&c.label).length,4);
});
test('panneau sans jumelés : aucun jumelage',()=>{
 const p=mk([[1,'A',15],[2,'B',15]]);p.details.tandem=false;
 const r=optimizeLayout(p,{pair:true});assert.equal(r.tandems,0);assert.match(r.notes[0],/n’accepte pas/);
});
test('tri croissant et décroissant par ampérage',()=>{
 const p=mk([[1,'Gros',30],[2,'Petit',15],[3,'Moyen',20]]);
 const asc=optimizeLayout(p,{sort:'asc'});
 assert.deepEqual(asc.circuits.filter(c=>c.label).map(c=>c.amps),[15,20,30]);
 const desc=optimizeLayout(p,{sort:'desc'});
 assert.deepEqual(desc.circuits.filter(c=>c.label).map(c=>c.amps),[30,20,15]);
});
test('espaces réservés : derniers espaces libres, jamais écrasés',()=>{
 const p=mk([[1,'A',15],[2,'B',20]]);
 const r=optimizeLayout(p,{reserve:3});
 const res=r.circuits.filter(c=>c.reserved);assert.equal(res.length,3);
 assert.ok(res.every(c=>c.vacant&&/expansion/.test(c.notes)));
 assert.equal(r.after.reserved,3);assert.equal(r.after.used,2);
 assert.equal(layoutStats(r.circuits,12).free,7);
});
test('le panneau d’origine n’est pas modifié et trop de réserve est signalé',()=>{
 const p=mk([[1,'A',15]]);const snap=JSON.stringify(p.circuits);
 const r=optimizeLayout(p,{reserve:99,sort:'asc'});
 assert.equal(JSON.stringify(p.circuits),snap);
 assert.equal(r.after.reserved,11);assert.ok(r.notes.some(n=>/Seulement/.test(n)));
});
test('bipolaire conservé sur deux positions de la même colonne',()=>{
 const p=mk([[1,'A',15],[3,'Chauffe-eau',30,2],[2,'B',20]]);
 const r=optimizeLayout(p,{sort:'asc'});validate(r.circuits,{positions:12});
 const w=r.circuits.find(c=>c.label==='Chauffe-eau');assert.equal(w.slots.length,4);
});
