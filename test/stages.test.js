import test from 'node:test';import assert from 'node:assert/strict';
import {blank,reshape,validate,cleanPanelMeta} from '../public/model.js';
import {stageFromState,PANEL_STAGES,STAGE_IDS} from '../public/catalog.js';
import {listAppliances,suggestCircuits,addAppliance,moveAppliance,removeAppliance,updateAppliance} from '../public/js/appliances.js';

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

test('modifier un électroménager : valeurs et circuit',()=>{
 const p=panel();
 const cuis=p.circuits.find(c=>c.label==='Cuisinière'),chambre=p.circuits.find(c=>c.label==='Chambre');
 let r=addAppliance(p,{name:'Sécheuse',w:5000,v:240,qty:1,source:'liste'},null);
 let p2={...p,circuits:r.circuits,details:{...p.details,appliances:r.appliances}};
 const id=listAppliances(p2)[0].id;
 // modification des valeurs, toujours non relié
 r=updateAppliance(p2,id,{name:'Sécheuse Whirlpool',w:5600,qty:2,cont:true,source:'plaque'},null);
 p2={...p2,circuits:r.circuits,details:{...p2.details,appliances:r.appliances}};
 let row=listAppliances(p2)[0];
 assert.equal(row.name,'Sécheuse Whirlpool');assert.equal(row.w,5600);assert.equal(row.qty,2);assert.equal(row.total,11200);assert.equal(row.cont,true);assert.equal(row.pending,true);assert.equal(row.id,id);
 assert.equal(p2.details.appliances[0].source,'plaque');
 // relier à un circuit en modifiant
 r=updateAppliance(p2,id,{w:5600},cuis.id);
 p2={...p2,circuits:r.circuits,details:{...p2.details,appliances:r.appliances}};
 row=listAppliances(p2)[0];assert.equal(row.circuitId,cuis.id);assert.equal(p2.details.appliances.length,0);validate(p2.circuits,{positions:30});
 // changer de circuit
 r=updateAppliance(p2,id,{name:'Sécheuse'},chambre.id);
 p2={...p2,circuits:r.circuits,details:{...p2.details,appliances:r.appliances}};
 assert.equal(listAppliances(p2)[0].circuitId,chambre.id);assert.equal(p2.circuits.find(c=>c.id===cuis.id).loads,undefined);
 assert.throws(()=>updateAppliance(p2,'inconnu',{},null),/introuvable/);
});

test('numéro de modèle détecté : conservé avec l’appareil',()=>{
 const p=panel();const cuis=p.circuits.find(c=>c.label==='Cuisinière');
 let r=addAppliance(p,{name:'Lave-vaisselle · Bosch',model:'SHE3AR75UC',w:1800,v:120,qty:1,source:'plaque'},null);
 let p2={...p,circuits:r.circuits,details:{...p.details,appliances:r.appliances}};
 assert.equal(listAppliances(p2)[0].model,'SHE3AR75UC');
 assert.equal(cleanPanelMeta({name:'X',kind:'Principal',details:{appliances:p2.details.appliances}}).details.appliances[0].model,'SHE3AR75UC');
 assert.throws(()=>cleanPanelMeta({name:'X',kind:'Principal',details:{appliances:[{name:'Y',w:1,v:120,model:'x'.repeat(61)}]}}),/modèle/);
 // relié à un circuit : le modèle suit la charge
 const id=listAppliances(p2)[0].id;
 r=moveAppliance(p2,id,cuis.id);
 p2={...p2,circuits:r.circuits,details:{...p2.details,appliances:r.appliances}};
 assert.equal(p2.circuits.find(c=>c.id===cuis.id).loads[0].model,'SHE3AR75UC');validate(p2.circuits,{positions:30});
 assert.equal(listAppliances(p2)[0].model,'SHE3AR75UC');
 // modification : le modèle est modifiable
 r=updateAppliance(p2,id,{model:'SHE3AR76UC'},cuis.id);p2={...p2,circuits:r.circuits,details:{...p2.details,appliances:r.appliances}};
 assert.equal(listAppliances(p2)[0].model,'SHE3AR76UC');
});

test('PDF : la liste complète des électroménagers, du plus gros au plus petit',async()=>{
 const {buildLoads}=await import('../api/_lib/pdf.js');
 let p=panel();const cuis=p.circuits.find(c=>c.label==='Cuisinière');
 const apps=Array.from({length:30},(_,i)=>({name:'Appareil '+i,w:100+i*10,v:120,qty:1}));
 let appliances=[];
 for(const a of apps){const r=addAppliance({...p,details:{...p.details,appliances}},a,null);appliances=r.appliances;}
 p={...p,details:{...p.details,appliances,mainAmps:200}};
 const rows=listAppliances(p);
 assert.equal(rows.length,30);assert.ok(rows.every((r,i)=>i===0||rows[i-1].total>=r.total),'ordre décroissant');
 const few=await buildLoads({user:{name:'N',email:'n@x.ca'},site:{name:'M'},panel:{...p,details:{...p.details,appliances:appliances.slice(0,3)}},fedFromLabel:'',version:'t'});
 const all=await buildLoads({user:{name:'N',email:'n@x.ca'},site:{name:'M'},panel:p,fedFromLabel:'',version:'t'});
 assert.ok(all.length>few.length,'les 30 appareils sont imprimés (pas seulement les 14 premiers)');
});

import {inferLoad} from '../public/appliances.js';
import {circuitLoad} from '../public/loadcalc.js';
test('catégorie et caractère continu déduits du nom',()=>{
 assert.deepEqual(inferLoad('Cuisinière Maytag',13300),{cat:'range',cont:false});
 assert.deepEqual(inferLoad('Sécheuse',5600),{cat:'other',cont:true});
 assert.deepEqual(inferLoad('Chauffe-eau 60 gal',4500),{cat:'other',cont:true});
 assert.deepEqual(inferLoad('Borne de recharge',7200),{cat:'ev',cont:true});
 assert.deepEqual(inferLoad('Plinthe électrique',1500),{cat:'heating',cont:true});
 assert.deepEqual(inferLoad('Fournaise électrique',10000),{cat:'heating100',cont:true});
 assert.deepEqual(inferLoad('Thermopompe centrale',4200),{cat:'cooling',cont:true});
 assert.deepEqual(inferLoad('Spa',9600),{cat:'water100',cont:true});
 assert.deepEqual(inferLoad('Chauffe-eau instantané',18000),{cat:'water100',cont:true});
 assert.deepEqual(inferLoad('Lave-vaisselle',1200),{cat:'basic',cont:false});
 assert.deepEqual(inferLoad('Appareil inconnu',3000),{cat:'other',cont:false});
});
test('une cuisinière ajoutée par l’onglet Électroménagers suit la règle 8-300 (35,5 A, pas 55,4 A)',()=>{
 const p=panel();const cuis=p.circuits.find(c=>c.label==='Cuisinière');
 const r=addAppliance(p,{name:'Cuisinière Maytag',w:13300,v:240,qty:1,source:'plaque'},cuis.id);
 const circ=r.circuits.find(c=>c.id===cuis.id);
 assert.equal(circ.loads[0].cat,'range');assert.equal(circ.loads[0].cont,false);
 const res=circuitLoad({...circ,amps:40});
 assert.equal(res.demandAmps,35.5);assert.ok(!res.issues.some(i=>i.level==='error'),'pas d’erreur sur 40 A');
 // en attente puis reliée : la catégorie suit
 const pend=addAppliance(p,{name:'Cuisinière Maytag',w:13300,v:240,qty:1},null);
 assert.equal(pend.appliances[0].cat,'range');
 const p2={...p,details:{...p.details,appliances:pend.appliances}};
 const mv=moveAppliance(p2,pend.appliances[0].id,cuis.id);
 assert.equal(mv.circuits.find(c=>c.id===cuis.id).loads[0].cat,'range');
 // catégorie imposée par l'utilisateur : conservée
 assert.equal(addAppliance(p,{name:'Cuisinière',w:9000,v:240,cat:'other',cont:true},cuis.id).circuits.find(c=>c.id===cuis.id).loads[0].cat,'other');
 // ancienne charge « Cuisinière » en catégorie « other » : conseil
 const old=circuitLoad({...circ,amps:40,loads:[{id:'x',name:'Cuisinière Maytag',w:13300,v:240,qty:1,cat:'other',cont:false}]});
 assert.ok(old.issues.some(i=>i.level==='error'));assert.ok(old.issues.some(i=>i.level==='info'&&/choisissez la catégorie « Cuisinière »/.test(i.text)));
});
