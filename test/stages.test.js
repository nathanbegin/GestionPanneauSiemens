import test from 'node:test';import assert from 'node:assert/strict';
import {blank,reshape,validate,cleanPanelMeta} from '../public/model.js';
import {stageFromState,PANEL_STAGES,STAGE_IDS} from '../public/catalog.js';
import {listAppliances,suggestCircuits,addAppliance,moveAppliance,removeAppliance} from '../public/js/appliances.js';

const panel=()=>{
 let c=blank(30);const id=x=>c.find(y=>y.slots.includes(x)).id;
 c=reshape(c,id('1A'),'double',30);c=reshape(c,id('5A'),'tandem',30);
 c=c.map(x=>x.slots[0]==='1A'?{...x,label:'Cuisinière',amps:40}:x.slots[0]==='5A'?{...x,label:'Chambre',amps:15}:x.slots[0]==='5B'?{...x,label:'Salon',amps:15}:x);
 return {id:'p1',name:'Principal',tag:'P-1',kind:'Principal',positions:30,details:{},circuits:validate(c,{positions:30})};
};
test('étapes du projet',()=>{
 assert.deepEqual(STAGE_IDS,['conception','releve','verification']);assert.equal(PANEL_STAGES.releve.n,2);
 assert.equal(stageFromState('Planifié'),'conception');assert.equal(stageFromState('Vérifié'),'verification');assert.equal(stageFromState('Existant'),'releve');
 const base={name:'X',kind:'Principal',details:{}};
 assert.equal(cleanPanelMeta(base).details.stage,'releve');
 assert.equal(cleanPanelMeta({...base,details:{state:'Planifié'}}).details.stage,'conception');
 assert.equal(cleanPanelMeta({...base,details:{stage:'verification'}}).details.stage,'verification');
 assert.throws(()=>cleanPanelMeta({...base,details:{stage:'autre'}}),/Étape/);
 assert.equal(cleanPanelMeta(base).details.appliances,undefined,'liste absente : conservée côté serveur');
 const m=cleanPanelMeta({...base,details:{appliances:[{name:'Sécheuse',w:5600,v:240,qty:1,source:'plaque'}]}});
 assert.equal(m.details.appliances.length,1);assert.equal(m.details.appliances[0].source,'plaque');assert.ok(m.details.appliances[0].id);
 assert.throws(()=>cleanPanelMeta({...base,details:{appliances:[{name:'X',w:-1,v:240}]}}),/Puissance/);
 assert.throws(()=>cleanPanelMeta({...base,details:{appliances:[{name:'X',w:100,v:999}]}}),/Tension/);
});
test('électroménagers : relier à un circuit, détacher, retirer',()=>{
 const p=panel();
 const cuis=p.circuits.find(c=>c.label==='Cuisinière');
 // Cuisinière 12 kW → circuit bipolaire « Cuisinière » suggéré en premier
 const s=suggestCircuits(p,{name:'Cuisinière Whirlpool',w:9600,v:240,qty:1});
 assert.equal(s[0].circuit.id,cuis.id);assert.ok(s[0].score>=3);
 // Appareil 120 V : pas de circuit bipolaire en tête
 const s2=suggestCircuits(p,{name:'Aspirateur central',w:1500,v:120,qty:1});assert.notEqual(s2[0].circuit.id,cuis.id);
 // ajout relié
 let r=addAppliance(p,{name:'Cuisinière',w:9600,v:240,qty:1,source:'plaque'},cuis.id);
 const p2={...p,circuits:r.circuits,details:{...p.details,appliances:r.appliances}};
 assert.equal(p2.circuits.find(c=>c.id===cuis.id).loads.length,1);validate(p2.circuits,{positions:30});
 // ajout non relié
 r=addAppliance(p2,{name:'Sécheuse',w:5600,v:240,qty:1,source:'liste'},null);
 const p3={...p2,circuits:r.circuits,details:{...p2.details,appliances:r.appliances}};
 let rows=listAppliances(p3);
 assert.deepEqual(rows.map(x=>x.name),['Cuisinière','Sécheuse'],'du plus gros au plus petit');
 assert.equal(rows[0].circuitId,cuis.id);assert.equal(rows[1].pending,true);
 // relier la sécheuse à un autre circuit puis la détacher
 const dryer=rows[1];
 r=moveAppliance(p3,dryer.id,cuis.id);
 const p4={...p3,circuits:r.circuits,details:{...p3.details,appliances:r.appliances}};
 assert.equal(listAppliances(p4).filter(x=>x.circuitId===cuis.id).length,2);assert.equal(p4.details.appliances.length,0);validate(p4.circuits,{positions:30});
 const dryer2=listAppliances(p4).find(x=>x.name==='Sécheuse');
 r=moveAppliance(p4,dryer2.id,null);
 assert.equal(r.appliances.length,1);assert.equal(r.circuits.find(c=>c.id===cuis.id).loads.length,1);
 // retrait : le circuit sans charge perd sa liste
 const only=removeAppliance({...p2},p2.circuits.find(c=>c.id===cuis.id).loads[0].id);
 assert.equal(only.circuits.find(c=>c.id===cuis.id).loads,undefined);
 assert.throws(()=>removeAppliance(p,'inconnu'),/introuvable/);
 assert.throws(()=>addAppliance(p,{name:'X',w:1,v:120},'zzz'),/Circuit introuvable/);
});

import {buildLoads,buildReport} from '../api/_lib/pdf.js';
test('les électroménagers sont dans le bilan de charges et le rapport PDF',async()=>{
 const p=panel();
 const cuis=p.circuits.find(c=>c.label==='Cuisinière');
 let r=addAppliance(p,{name:'Cuisinière',w:9600,v:240,qty:1},cuis.id);
 const p2={...p,circuits:r.circuits,details:{...p.details,mainAmps:200,appliances:[]}};
 r=addAppliance(p2,{name:'Sécheuse',w:5600,v:240,qty:1},null);
 const full={...p2,details:{...p2.details,appliances:r.appliances},revision:1,circuits:p2.circuits};
 const site={name:'Maison'};
 const user={name:'Nathan',email:'n@x.ca'};
 const without=await buildLoads({user,site,panel:{...p2,details:{...p2.details,appliances:[]},circuits:p.circuits},fedFromLabel:'',version:'t'});
 const withApp=await buildLoads({user,site,panel:full,fedFromLabel:'',version:'t'});
 assert.ok(withApp.length>without.length,'la section ajoute du contenu au bilan');
 const rep0=await buildReport({user,site,panels:[{panel:{...p,circuits:p.circuits},fedFromLabel:''}],version:'t'});
 const rep1=await buildReport({user,site,panels:[{panel:full,fedFromLabel:''}],version:'t'});
 assert.ok(rep1.length>rep0.length,'la section ajoute du contenu au rapport');
});
