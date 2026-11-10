import test from 'node:test';import assert from 'node:assert/strict';
import {blank,reshape,groupCircuits} from '../public/model.js';
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

import {suggestModels,fits,panelDemand,compareTable} from '../public/js/library.js';
import {normalizePanel} from '../api/_lib/library.js';
import catalogue from '../api/_data/catalogue.js';
const PANELS=catalogue.panneaux.map(normalizePanel);
test('besoin d’un panneau : A/B = 1 circuit, bipolaire = 2, liés = 2 demi-emplacements',()=>{
 let c=blank(30);
 const id=x=>c.find(y=>y.slots.includes(x)).id;
 c=reshape(c,id('1A'),'tandem',30);c=reshape(c,id('3A'),'tandem',30);c=reshape(c,id('5A'),'tandem',30);
 const set=(slot,patch)=>{c=c.map(x=>x.slots[0]===slot?{...x,...patch}:x);};
 set('1A',{label:'Micro-ondes',amps:15});set('1B',{label:'Comptoirs',amps:15});
 c=groupCircuits(c,id('1B'),id('3A'),30);
 set('3B',{label:'Chambre',amps:15});
 c=reshape(c,id('9A'),'double',30);c=c.map(x=>x.slots[0]==='9A'?{...x,label:'Cuisinière',amps:40}:x);
 const d=panelDemand(c);
 // 1A (1) + 1B/3A lié (2) + 3B (1) + double 9/11 (2) = 6 circuits ; emplacements : 1+2+1+4 = 8 → 4 espaces
 assert.equal(d.breakers,4);assert.equal(d.circuits,6);assert.equal(d.spaces,4);
});
test('suggestion de modèles selon les circuits et la marque',()=>{
 const s=suggestModels(PANELS,{circuits:47,spaces:24,margin:.2,family:'SIE'});
 assert.ok(s.length>=1&&s.length<=6);
 for(const x of s){assert.equal(x.p.family,'SIE');assert.ok(x.p.main==null||x.p.main>=100);assert.ok(fits(x.p,47,24).ok);assert.ok(x.p.designable);}
 assert.equal(s[0].tier,'marge');
 assert.ok(s.every(x=>x.p.espaces>=29&&(x.p.circuits??x.p.espaces)>=57),'47 × 1,2 circuits et 24 × 1,2 espaces');
 assert.ok(s.every((x,i)=>i===0||x.tier!=='marge'||s[i-1].tier==='marge'),'marges d’abord');
 const m=suggestModels(PANELS,{circuits:47,spaces:24,margin:.2});
 const per={};for(const x of m)per[x.p.family]=(per[x.p.family]||0)+1;
 assert.ok(Object.keys(per).length>=3,'plusieurs marques sans filtre');assert.ok(Object.values(per).every(n=>n<=2));
 assert.deepEqual(suggestModels(PANELS,{circuits:0}),[]);
 assert.deepEqual(suggestModels(PANELS,{circuits:500,family:'SIE'}),[],'trop de circuits');
 // 12 espaces / 24 circuits
 const small={cat:'X',family:'SIE',espaces:12,circuits:24,designable:true,statut:'Catalogue'};
 assert.deepEqual(fits(small,20,10),{ok:true,tandem:true,spare:2});
 assert.equal(fits(small,10,5).tandem,false,'10 circuits : un espace chacun suffit');
 assert.equal(fits(small,25,13).ok,false,'plus de circuits que le maximum');
 assert.equal(fits(small,20,13).ok,false,'13 espaces > 12');
 const sans={cat:'Y',family:'SIE',espaces:12,circuits:12,designable:true,statut:'Catalogue'};
 assert.equal(fits(sans,13,7).ok,false,'sans jumelés, chaque circuit prend un espace');
 // le calcul n'exige plus 2 espaces pour un bipolaire lié (2 demi-emplacements)
 assert.ok(suggestModels(PANELS,{circuits:47,spaces:24,family:'SIE',margin:0}).some(x=>x.p.espaces<38),'moins de 38 espaces suffisent');
});
test('principal demandé',()=>{
 const s=suggestModels(PANELS,{circuits:47,spaces:24,family:'SIE',mainAmps:200});
 assert.ok(s.length>0&&s.every(x=>x.p.main===200||(x.p.main==null&&x.p.bus>=200)));
});
test('comparaison côte à côte de modèles suggérés',()=>{
 const s=suggestModels(PANELS,{circuits:47,spaces:24,family:'SIE',mainAmps:200});
 const t=compareTable(s.slice(0,3));
 assert.equal(t.length,12);assert.ok(t.every(r=>r.values.length===Math.min(3,s.length)));
 const byLabel=Object.fromEntries(t.map(r=>[r.label,r]));
 assert.equal(byLabel['Principal'].values[0],s[0].p.main?s[0].p.main+' A':'Cosses (sans principal)');
});
