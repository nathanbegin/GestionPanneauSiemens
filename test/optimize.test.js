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
import {bulkApply} from '../public/model.js';
test('retirer un disjoncteur libère ses espaces (bipolaire = deux cases vides)',()=>{
 const p=mk([[1,'A',15],[3,'Chauffe-eau',30,2]]);
 const w=p.circuits.find(c=>c.label==='Chauffe-eau');
 const out=bulkApply(p.circuits,[w.id],{type:'remove'});validate(out,{positions:12});
 assert.equal(out.some(c=>c.label==='Chauffe-eau'),false);
 for(const s of ['3A','3B','5A','5B'])assert.ok(out.some(c=>c.slots.includes(s)&&!c.label&&c.amps==null),s);
 assert.equal(out.find(c=>c.label==='A').amps,15);
});
import {buildCatalog} from '../public/optimize.js';
test('catalogue : jumelés vérifiés par modèle ; quad ; panneau sans jumelés',()=>{
 const lib={panels:[{cat:'MODEL-T',family:'QO',tandem:true,circuits:24,espaces:12},{cat:'MODEL-N',family:'QO',tandem:false,circuits:12,espaces:12}],
  breakers:[{cat:'QO1515CP',family:'QO',kind:'tandem',amps:[15,15],protection:'Standard'},{cat:'QO1520CP',family:'QO',kind:'tandem',amps:[15,20],protection:'Standard'},
   {cat:'QOQ',family:'QO',kind:'quad',amps:[15,30,15],protection:'Standard'},{cat:'AUTRE',family:'BR',kind:'tandem',amps:[20,20],protection:'Standard'}]};
 const cat=buildCatalog(lib,{modelId:'MODEL-T'});
 assert.deepEqual([...cat.tandem.keys()].sort(),['15/15','15/20']);assert.equal(cat.quad.get('15/15|30'),'QOQ');assert.equal(cat.maxCircuits,24);
 assert.equal(buildCatalog(lib,{modelId:'MODEL-N'}).tandem.size,0);
  const p=mk([[1,'P15',15],[2,'P20a',20],[3,'P20b',20],[4,'P15b',15]]);p.details={modelId:'MODEL-T'};
 const r=optimizeLayout(p,{pair:true,catalog:cat});
 assert.equal(r.tandems,1); // 15+15 existe ; 20+20 n’existe pas pour cette famille
 assert.deepEqual([...new Set(r.circuits.filter(c=>c.breakerRef).map(c=>c.breakerRef))],['QO1515CP']);
 const none=optimizeLayout(p,{pair:true,catalog:buildCatalog(lib,{modelId:'MODEL-N'})});
 assert.equal(none.tandems,0);assert.match(none.notes[0],/Aucun disjoncteur jumelé/);
});
test('quad : 2 unipolaires + 1 bipolaire dans 2 espaces',()=>{
 const lib={panels:[],breakers:[{cat:'QOQ',family:'QO',kind:'quad',amps:[15,30,15],protection:'Standard'}]};
 const cat=buildCatalog(lib,{family:'QO'});
 const p=mk([[1,'A',15],[2,'B',15],[3,'Chauffe-eau',30,2]]);
 const r=optimizeLayout(p,{pair:true,catalog:cat});
 assert.equal(r.quads,1);validate(r.circuits,{positions:12});
 assert.equal(r.after.used,2);assert.equal(r.before.used,4);
 assert.equal(r.circuits.filter(c=>c.breakerRef==='QOQ').length,3);
});
test('ordre libre : les bipolaires sont posés d’abord et alignés',()=>{
 const p=mk([[1,'A',15],[2,'B',15],[3,'C',15],[5,'Dbl1',30,2],[6,'Dbl2',40,2]]);
 const r=optimizeLayout(p,{sort:'space'});validate(r.circuits,{positions:12});
 assert.ok(r.after.used<=r.before.used);
});
import {moveBreaker} from '../public/optimize.js';
test('déplacer : vers un espace libre, échange, bipolaire et refus',()=>{
 const p=mk([[1,'A',15],[2,'B',20],[3,'Dbl',30,2],[4,'C',15]]);
 const id=l=>p.circuits.find(c=>c.label===l).id;
 // A (pos 1) → pos 7 (libre) : delta +6
 let o=moveBreaker(p.circuits,id('A'),6,12);validate(o,{positions:12});
 assert.equal(o.find(c=>c.label==='A').slots[0],'7A');assert.ok(o.some(c=>c.slots.includes('1A')&&!c.label));
 // échange A (1) ↔ B (2) : delta +1
 o=moveBreaker(p.circuits,id('A'),1,12);
 assert.equal(o.find(c=>c.label==='A').slots[0],'2A');assert.equal(o.find(c=>c.label==='B').slots[0],'1A');
 // bipolaire (3,5) → (7,9)
 o=moveBreaker(p.circuits,id('Dbl'),4,12);validate(o,{positions:12});assert.equal(o.find(c=>c.label==='Dbl').slots.join(),'7A,7B,9A,9B');
 // refus : bipolaire sur un unipolaire (format différent)
 assert.throws(()=>moveBreaker(p.circuits,id('Dbl'),-2,12),/occupé/);
 assert.throws(()=>moveBreaker(p.circuits,id('A'),99,12),/hors du panneau/);
});
test('déplacer : refuse un espace réservé et déplace un jumelé complet',()=>{
 const r=optimizeLayout(mk([[1,'A',15],[2,'B',15],[3,'C',20]]),{pair:true,reserve:2});
 const t=r.circuits.find(c=>c.slots.length===1&&c.label);
 const o=moveBreaker(r.circuits,t.id,6,12);validate(o,{positions:12});
 assert.equal(o.filter(c=>c.slots.length===1&&c.label).length,2);
 assert.throws(()=>moveBreaker(r.circuits,t.id,10,12),/réservé|hors/);
});
