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

import {suggestModels,fits,spacesNeeded,catalogCircuits} from '../public/js/library.js';
import {normalizePanel} from '../api/_lib/library.js';
import catalogue from '../api/_data/catalogue.js';
test('suggestion de modèles selon les circuits et la marque',()=>{
 const panels=catalogue.panneaux.map(normalizePanel);
 assert.equal(spacesNeeded(28,0,false),28);assert.equal(spacesNeeded(28,4,true),8+12);
 const s=suggestModels(panels,{circuits:28,bipolar:4,margin:.2,family:'SIE'});
 assert.ok(s.length>=1&&s.length<=6);
 for(const x of s){assert.equal(x.p.family,'SIE');assert.ok(x.p.main==null||x.p.main>=100,'pas de petit principal');assert.ok(fits(x.p,28,4).ok);assert.ok(x.p.designable);}
 assert.equal(s[0].tier,'marge');
 assert.ok(s.every((x,i)=>i===0||x.tier!=='marge'||s[i-1].tier==='marge'),'marges d’abord');
 const m=suggestModels(panels,{circuits:28,bipolar:4,margin:.2});
 const per={};for(const x of m)per[x.p.family]=(per[x.p.family]||0)+1;
 assert.ok(Object.keys(per).length>=3,'plusieurs marques sans filtre');assert.ok(Object.values(per).every(n=>n<=2));
 assert.deepEqual(suggestModels(panels,{circuits:0}),[]);
 assert.deepEqual(suggestModels(panels,{circuits:500,family:'SIE'}),[],'trop de circuits');
 // trop petit sans jumelés, mais loge avec jumelés
 const small={cat:'X',family:'SIE',espaces:12,circuits:24,designable:true,statut:'Catalogue'};
 assert.equal(fits(small,20,0).tandem,true);assert.equal(fits(small,10,0).tandem,false);assert.equal(fits(small,30,0).ok,false);
 assert.equal(catalogCircuits(28,4),32,'bipolaire = 2 circuits');
 assert.equal(fits(small,19,2).ok,false,'4 espaces de bipolaires + 9 = 13 > 12');
 assert.equal(fits(small,18,2).ok,true,'20 circuits catalogue, 4 + 8 = 12 espaces');
});
test('principal demandé',()=>{
 const panels=catalogue.panneaux.map(normalizePanel);
 const s=suggestModels(panels,{circuits:28,bipolar:4,family:'SIE',mainAmps:200});
 assert.ok(s.length>0&&s.every(x=>x.p.main===200||(x.p.main==null&&x.p.bus>=200)));
});

import {compareTable} from '../public/js/library.js';
test('comparaison côte à côte de modèles suggérés',()=>{
 const panels=catalogue.panneaux.map(normalizePanel);
 const s=suggestModels(panels,{circuits:28,bipolar:4,family:'SIE',mainAmps:200});
 const t=compareTable(s.slice(0,3));
 assert.equal(t.length,12);assert.ok(t.every(r=>r.values.length===Math.min(3,s.length)));
 const byLabel=Object.fromEntries(t.map(r=>[r.label,r]));
 assert.equal(byLabel['Principal'].values[0],s[0].p.main?s[0].p.main+' A':'Cosses (sans principal)');
 assert.equal(byLabel['Espaces'].differs,new Set(s.slice(0,3).map(x=>x.p.espaces)).size>1);
});
