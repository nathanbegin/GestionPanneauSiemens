import test from 'node:test';
import assert from 'node:assert/strict';
import {prorataRefund} from '../api/_lib/refund.js';
import {calcFingerprint,calcInputs} from '../public/model.js';
import {makeCalcRecord,panelFromRecord,isHistoric} from '../api/_lib/calcrecord.js';
import {buildCalcNote,buildLoads} from '../api/_lib/pdf.js';

const day=86400000;
test('remboursement au prorata de la période inutilisée',()=>{
 const start=Date.UTC(2026,0,1),end=start+30*day;
 // Moitié de la période écoulée : la moitié du montant payé (taxes comprises).
 assert.equal(prorataRefund({amountPaid:3910,periodStart:start,periodEnd:end,now:start+15*day}).cents,1955);
 // Aucun jour écoulé : tout est remboursable ; période terminée : rien.
 assert.equal(prorataRefund({amountPaid:3910,periodStart:start,periodEnd:end,now:start}).cents,3910);
 assert.equal(prorataRefund({amountPaid:3910,periodStart:start,periodEnd:end,now:end+day}).cents,0);
 // Jamais plus que le montant payé moins ce qui a déjà été remboursé ; arrondi vers le bas.
 assert.equal(prorataRefund({amountPaid:1000,alreadyRefunded:900,periodStart:start,periodEnd:end,now:start}).cents,100);
 assert.equal(prorataRefund({amountPaid:1001,periodStart:start,periodEnd:start+3*day,now:start+day}).cents,667);
 // Pas de paiement ou période invalide.
 assert.equal(prorataRefund({amountPaid:0,periodStart:start,periodEnd:end,now:start}).cents,0);
 assert.equal(prorataRefund({amountPaid:500,periodStart:end,periodEnd:start,now:start}).cents,0);
});

const circuits=n=>Array.from({length:n},(_,i)=>({id:'c'+i,slots:[String(i*2+1)+'A'],amps:i===0?40:15,usage:'Autre',status:'À confirmer',label:'',room:'',notes:'',exceptions:''}));
const panel=(extra={})=>({name:'Principal',tag:'P-1',kind:'Principal',positions:20,details:{mainAmps:200,livingArea:120,voltage:'120/240 V monophasé',...extra},circuits:circuits(4)});

test('empreinte : stable pour une simple description, sensible aux données de calcul',()=>{
 const a=panel(),b=structuredClone(a);
 b.circuits[1].label='Salon';b.circuits[1].room='Salon';b.circuits[1].status='Identifié';b.circuits[1].notes='x';
 assert.equal(calcFingerprint(a),calcFingerprint(b));
 const c=structuredClone(a);c.circuits[0].loads=[{name:'Chauffe-eau',watts:3000}];
 assert.notEqual(calcFingerprint(a),calcFingerprint(c));
 const d=structuredClone(a);d.details.mainAmps=100;
 assert.notEqual(calcFingerprint(a),calcFingerprint(d));
 assert.notEqual(calcFingerprint(a),calcFingerprint(a,[{id:'k',circuits:circuits(1)}]));
 assert.ok(calcInputs(a).c.length===4);
});

test('dossier de calcul : créé, conservé si rien ne change, relu même après modification',()=>{
 const p=panel();
 const rec=makeCalcRecord({panel:p,now:new Date('2026-11-11T12:00:00Z')});
 assert.equal(rec.at,'2026-11-11T12:00:00.000Z');
 assert.ok(rec.version&&rec.edition&&rec.fingerprint&&rec.inputs.circuits.length===4);
 assert.equal(typeof rec.summary.designAmps,'number');
 // Mêmes données : même dossier (date inchangée).
 assert.equal(makeCalcRecord({panel:p,prev:rec,now:new Date('2027-01-01')}),rec);
 // Données modifiées : nouveau dossier.
 const p2=structuredClone(p);p2.circuits[0].loads=[{name:'Borne',watts:7200}];
 assert.notEqual(makeCalcRecord({panel:p2,prev:rec}).fingerprint,rec.fingerprint);
 // Rien à calculer : pas de dossier.
 assert.equal(makeCalcRecord({panel:{...p,details:{}}}),null);
 // Résultat historique : le panneau a changé depuis, l'instantané garde les données d'origine.
 assert.equal(isHistoric(p,[],rec),false);
 assert.equal(isHistoric(p2,[],rec),true);
 assert.equal(panelFromRecord(p2,rec).circuits[0].loads,undefined);
});

test('PDF de calcul : cadre du calcul et mention « Résultat historique »',async()=>{
 const p=panel();p.circuits[0].loads=[{name:'Chauffe-eau',watts:3000,continuous:false}];
 const rec=makeCalcRecord({panel:p,now:new Date('2026-11-11T12:00:00Z')});
 const site={name:'Maison',street:'1 rue A',city:'Québec'};
 for(const [lang,meta] of [['fr',{record:rec,historic:true,changed:true}],['en',{record:rec,historic:false,changed:false}],['fr',null]]){
  for(const fn of [buildCalcNote,buildLoads]){
   const bytes=await fn({user:{name:'T'},site,panel:p,children:[],version:'9.9.9',lang,calcMeta:meta});
   assert.ok(bytes.length>1500);
  }
 }
});

import {diffCircuits} from '../public/js/history.js';
test('historique : différences entre deux versions',()=>{
 const a=circuits(3),b=structuredClone(a);
 b[1].label='Prises cuisine';b[1].status='Identifié';
 b.push({...circuits(1)[0],id:'cx',slots:['9A']});
 a.push({...circuits(1)[0],id:'old',slots:['11A']});
 const d=diffCircuits(a,b);
 const c1=d.find(x=>x.id==='c1');
 assert.deepEqual(c1.changes.map(x=>[x.k,x.from,x.to]),[['label','—','Prises cuisine'],['status','À confirmer','Identifié']]);
 assert.ok(d.find(x=>x.id==='cx'&&x.added));
 assert.ok(d.find(x=>x.id==='old'&&x.removed));
 assert.equal(d.find(x=>x.id==='c0'),undefined);
});
