import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChecklist} from '../public/js/checklist.js';
const c=(i,extra={})=>({id:'c'+i,slots:[(i*2+1)+'A'],amps:15,usage:'Autre',status:'À confirmer',label:'',room:'',notes:'',exceptions:'',...extra});
test('liste « À terminer »',()=>{
 const panel={name:'P',kind:'Principal',location:'',details:{appliances:[{id:'a'}]},circuits:[c(0),c(1,{label:'Salon'}),c(2,{status:'Identifié',label:'Cuisine',amps:null}),c(3,{status:'Libre'}),c(4,{vacant:true})]};
 const items=buildChecklist(panel,{report:{issues:[{level:'warn',text:'Déséquilibre',circuit:'3'}]}});
 const by=id=>items.find(i=>i.id.startsWith(id));
 assert.equal(by('circuit sans description').action.circuit,'c0');
 assert.equal(by('circuit décrit mais à vérifier').action.circuit,'c1');
 assert.equal(by('circuit sans calibre').action.circuit,'c2');
 assert.match(by('fiche').text,/calibre du principal.*marque et modèle.*emplacement.*date du relevé/);
 assert.equal(by('appliances').action.tab,'appliances');
 assert.ok(items.some(i=>i.id==='issue:Déséquilibre'));
 // Panneau complet : rien à terminer.
 const done={name:'P',kind:'Principal',location:'Sous-sol',details:{mainAmps:200,brand:'Siemens',surveyDate:'2026-01-01'},circuits:[c(0,{status:'Identifié',label:'Salon'})]};
 assert.deepEqual(buildChecklist(done),[]);
});
