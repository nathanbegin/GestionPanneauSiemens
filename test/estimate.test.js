import test from 'node:test';import assert from 'node:assert/strict';
import {estimateCosts,cleanEstimateInput,estimatePrompt,ESTIMATE_SCHEMA} from '../api/_lib/ai.js';
process.env.OPENAI_API_KEY='test';
const out={items:[{description:'Disjoncteur 20 A',qty:2,unit_low:12,unit_high:18,store:'Home Depot Canada',url:null,note:null,confidence:'medium'}],stores_checked:['Home Depot Canada'],warnings:[]};
const ok=body=>({ok:true,status:200,json:async()=>({output_text:JSON.stringify(out),usage:{input_tokens:10,output_tokens:5}}),_body:body});
test('entrée nettoyée : articles bornés, quantité valide, erreur si vide',()=>{
 const c=cleanEstimateInput({items:[{description:'x'.repeat(500),qty:-3},{description:''},{description:'B',qty:'2'}],context:{mainAmps:'200',family:'QO'}});
 assert.equal(c.items.length,2);assert.equal(c.items[0].description.length,200);assert.equal(c.items[0].qty,1);assert.equal(c.items[1].qty,2);assert.equal(c.context.mainAmps,200);
 assert.throws(()=>cleanEstimateInput({items:[]}),/Aucun article/);
});
test('invite : magasins nommés, pas d’adresse inventée, lang',()=>{
 const p=estimatePrompt({items:[{description:'a',qty:1}],context:{}},'fr',true);
 for(const m of ['Home Depot','Rona','Canac','Patrick Morin','Lumen'])assert.ok(p.includes(m),m);
 assert.match(p,/invente JAMAIS/);assert.match(estimatePrompt({items:[],context:{}},'fr',false),/indisponible/);
});
test('estimation avec recherche web, puis repli sans outil si le modèle la refuse',async()=>{
 const bodies=[];
 let r=await estimateCosts({input:{items:[{description:'Disjoncteur 20 A',qty:2}]},settings:{models:['m1']}},{fetchImpl:async(u,o)=>{bodies.push(JSON.parse(o.body));return ok();}});
 assert.equal(r.live,true);assert.deepEqual(bodies[0].tools,[{type:'web_search'}]);assert.equal(r.scan.items[0].unit_high,18);
 const calls=[];
 r=await estimateCosts({input:{items:[{description:'D',qty:1}]},settings:{models:['m1']}},{fetchImpl:async(u,o)=>{const b=JSON.parse(o.body);calls.push(!!b.tools);return b.tools?{ok:false,status:400,json:async()=>({error:{code:'unsupported'}})}:ok();}});
 assert.deepEqual(calls,[true,false]);assert.equal(r.live,false);
});
test('429 et clé invalide ne déclenchent pas de repli',async()=>{
 let n=0;await assert.rejects(estimateCosts({input:{items:[{description:'D',qty:1}]},settings:{models:['m1']}},{fetchImpl:async()=>{n++;return {ok:false,status:429,json:async()=>({})};}}),/sollicité/);
 assert.equal(n,1);
});
test('schéma strict : tous les champs requis',()=>{
 const it=ESTIMATE_SCHEMA.properties.items.items;assert.deepEqual([...it.required].sort(),Object.keys(it.properties).sort());
});

import {matchPanelModel,library} from '../api/_lib/library.js';
import {scanToPanel} from '../public/aiscan.js';
import {SCAN_SCHEMA,scanPrompt} from '../api/_lib/ai.js';
test('modèle de panneau : numéro exact, texte de plaque, candidats, rien',()=>{
 const lib=library();const any=lib.panels.find(p=>p.designable&&p.cat.length>=8);
 let m=matchPanelModel({catalog_number:any.cat.toLowerCase().replace(/(.{3})/g,'$1 ')});
 assert.equal(m.status,'exact');assert.equal(m.modelId,any.cat);
 m=matchPanelModel({catalog_number:'',nameplate_text:'LOADCENTER TYPE 1 CAT. NO. '+any.cat+' 120/240V'});
 assert.equal(m.status,'text');assert.equal(m.modelId,any.cat);
 m=matchPanelModel({family:any.family,main_amps:any.main,positions:any.espaces});
 assert.ok(['candidates','none'].includes(m.status));if(m.status==='candidates')assert.ok(m.candidates.some(c=>c.cat===any.cat));
 assert.equal(matchPanelModel({}).status,'none');
});
test('schéma : plaque et manettes reliées requis ; invite sur les pôles et le modèle',()=>{
 assert.ok(SCAN_SCHEMA.required.includes('nameplate_text'));
 const it=SCAN_SCHEMA.properties.breakers.items;assert.ok(it.required.includes('handle_tie'));assert.deepEqual(it.properties.handle_tie.enum,['common','separate','unknown']);
 for(const k of Object.keys(it.properties))assert.ok(it.required.includes(k),k);
 const p=scanPrompt({});assert.match(p,/BIPOLAIRE/);assert.match(p,/TRIPOLAIRE/);assert.match(p,/catalog_number/);
});
test('lecture : manettes non reliées → avertissement ; charge 240 V unipolaire → avertissement',()=>{
 const base={is_panel:true,brand:'Siemens',series:'EQ',catalog_number:'',nameplate_text:'',family:'',main_amps:200,bus_amps:200,positions:12,voltage:'120/240 V monophasé',panel_kind:'Principal',empty_positions:[],confidence:.9,warnings:[],summary:''};
 const b=(o)=>({position:1,poles:1,handle_tie:'unknown',half:'',spans_next:false,amps:30,label:'',label_source:'directory',protection:'Standard',confidence:.9,...o});
 let r=scanToPanel({...base,breakers:[b({position:1,poles:2,handle_tie:'separate',label:'Chauffage'})]});
 assert.ok(r.warnings.some(w=>/ne semblent pas reliées/.test(w)));
 r=scanToPanel({...base,breakers:[b({position:1,label:'Cuisinière',amps:40})]});
 assert.ok(r.warnings.some(w=>/normalement sur un bipolaire/.test(w)));
 r=scanToPanel({...base,breakers:[b({position:1,poles:3,handle_tie:'common',label:'Pompe triphasée'})]});
 assert.equal(r.circuits.find(c=>c.label==='Pompe triphasée').slots.length,6);
});
