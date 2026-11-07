import test from 'node:test';import assert from 'node:assert/strict';
import {scanToPanel,snapAmps} from '../public/aiscan.js';
import {scanPanel,toInputParts,outputText,SCAN_SCHEMA,aiAllowance} from '../api/_lib/ai.js';
import {validate} from '../public/model.js';

const scan={is_panel:true,brand:'Siemens',series:'EQ',catalog_number:'G3040MB1200',family:'',main_amps:200,bus_amps:200,positions:30,voltage:'120/240 V monophasé',panel_kind:'Principal',
 breakers:[
  {position:1,poles:2,half:'',amps:40,label:'Cuisinière',label_source:'directory',protection:'Standard',confidence:.9},
  {position:2,poles:1,half:'',amps:15,label:'Chambre',label_source:'directory',protection:'Anti-arc',confidence:.6},
  {position:4,poles:1,half:'A',amps:15,label:'Salle de bain',label_source:'directory',protection:'DDFT',confidence:.8},
  {position:4,poles:1,half:'B',amps:21,label:'',label_source:'none',protection:'Inconnue',confidence:.4},
  {position:3,poles:1,half:'',amps:20,label:'Conflit',label_source:'breaker',protection:'Standard',confidence:.9},
  {position:41,poles:1,half:'',amps:15,label:'Hors panneau',label_source:'breaker',protection:'Standard',confidence:.9},
 ],empty_positions:[29,30],confidence:.8,warnings:['Répertoire partiellement illisible'],summary:'Panneau Siemens 30 positions.'};

test('conversion d’une lecture IA en panneau',()=>{
 const p=scanToPanel(scan);
 assert.equal(p.positions,42,'position 41 lue → panneau agrandi');
 validate(p.circuits,{positions:p.positions});
 const at=slot=>p.circuits.find(c=>c.slots.includes(slot));
 assert.deepEqual(at('1A').slots,['1A','1B','3A','3B']);assert.equal(at('1A').amps,40);assert.equal(at('1A').status,'Identifié');
 assert.equal(at('2A').status,'À confirmer','confiance 0,6');assert.equal(at('2A').protection,'Anti-arc');
 assert.deepEqual(at('4A').slots,['4A']);assert.deepEqual(at('4B').slots,['4B']);assert.equal(at('4B').amps,20,'21 A ramené à 20 A');
 assert.equal(at('29A').vacant,true);
 assert.ok(p.warnings.some(w=>/Position 3/.test(w)),'conflit signalé');
 assert.equal(p.meta.details.brand,'Siemens');assert.equal(p.meta.details.mainAmps,200);
 assert.ok(p.steps.length>=5);
 assert.equal(snapAmps(100),100);assert.equal(snapAmps(13),15);assert.equal(snapAmps(228),225);assert.equal(snapAmps(240),null);assert.equal(snapAmps(300),null);
});

test('préparation des fichiers et schéma strict',()=>{
 const img='data:image/jpeg;base64,'+Buffer.from([0xff,0xd8,0xff]).toString('base64');
 const parts=toInputParts([{name:'a.jpg',data:img},{name:'r.csv',data:'data:text/csv;base64,'+Buffer.from('pos,amps\n1,15').toString('base64')},{name:'p.pdf',data:'data:application/pdf;base64,JVBERg=='}]);
 assert.equal(parts[0].type,'input_image');assert.equal(parts[1].type,'input_text');assert.match(parts[1].text,/1,15/);assert.equal(parts[2].type,'input_file');
 assert.throws(()=>toInputParts([]));assert.throws(()=>toInputParts([{name:'x.exe',data:'data:application/x-msdownload;base64,AAAA'}]));
 // Schéma strict : chaque objet exige toutes ses propriétés.
 const walk=s=>{if(s.type==='object'){assert.equal(s.additionalProperties,false);assert.deepEqual([...s.required].sort(),Object.keys(s.properties).sort());Object.values(s.properties).forEach(walk);}if(s.items)walk(s.items);};
 walk(SCAN_SCHEMA);
 assert.throws(()=>outputText({output:[{content:[{type:'refusal',refusal:'non'}]}]}));
});

test('appel OpenAI simulé',async()=>{
 process.env.OPENAI_API_KEY='test-key';
 let sent;
 const fetchImpl=async(url,opts)=>{sent={url,body:JSON.parse(opts.body),auth:opts.headers.Authorization};return {ok:true,status:200,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(scan)}]}],usage:{input_tokens:1200,output_tokens:400}})};};
 const out=await scanPanel({files:[{name:'a.jpg',data:'data:image/jpeg;base64,/9j/'}],hint:{brand:'Siemens'}},{fetchImpl});
 assert.equal(sent.url,'https://api.openai.com/v1/responses');assert.equal(sent.auth,'Bearer test-key');
 assert.equal(sent.body.model,'gpt-6.1-terra');assert.equal(sent.body.text.format.type,'json_schema');assert.equal(sent.body.text.format.strict,true);
 assert.match(sent.body.input[0].content[0].text,/Siemens/);
 assert.equal(out.scan.brand,'Siemens');assert.equal(out.usage.input,1200);
 const bad=async()=>({ok:false,status:429,json:async()=>({error:{code:'rate_limit'}})});
 await assert.rejects(()=>scanPanel({files:[{name:'a.jpg',data:'data:image/jpeg;base64,/9j/'}]},{fetchImpl:bad}),e=>e.status===429);
 delete process.env.OPENAI_API_KEY;
 await assert.rejects(()=>scanPanel({files:[]}),e=>e.status===503);
});

test('droits d’accès à l’IA',()=>{
 const e=(id,live,features={})=>({live,plan:{id,features}});
 assert.equal(aiAllowance(e('gratuit',false),false).allowed,false);
 assert.deepEqual(aiAllowance(e('proprietaire',true),false),{allowed:true,monthly:20});
 assert.deepEqual(aiAllowance(e('electricien-solo',true,{planning:true}),false),{allowed:true,monthly:100});
 assert.equal(aiAllowance(e('gratuit',false),true).allowed,true);
});

test('repli automatique quand le projet OpenAI n’a pas accès au modèle',async()=>{
 const {resetModelCache,modelOrder,DENY_TTL_MS}=await import('../api/_lib/ai.js');
 resetModelCache();process.env.OPENAI_API_KEY='k';delete process.env.OPENAI_MODEL;
 const tried=[];let terraOk=false;
 const fetchImpl=async(url,opts)=>{const m=JSON.parse(opts.body).model;tried.push(m);
  if(m==='gpt-6-astra'||(m==='gpt-6.1-terra'&&terraOk))return {ok:true,status:200,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(scan)}]}],usage:{}})};
  return {ok:false,status:403,json:async()=>({error:{code:'model_not_found',message:'no access'}})};};
 const file=[{name:'a.jpg',data:'data:image/jpeg;base64,/9j/'}];
 const out=await scanPanel({files:file},{fetchImpl});
 assert.equal(out.model,'gpt-6-astra');assert.deepEqual(tried,['gpt-6.1-terra','gpt-6-astra']);
 // Terra refusé récemment : Astra est essayé directement.
 tried.length=0;await scanPanel({files:file},{fetchImpl});assert.deepEqual(tried,['gpt-6-astra']);
 // Après le délai, Terra (maintenant autorisé) est réessayé et redevient le modèle utilisé.
 assert.equal(modelOrder({},Date.now()+DENY_TTL_MS+1000)[0],'gpt-6.1-terra');
 resetModelCache();terraOk=true;tried.length=0;
 assert.equal((await scanPanel({files:file},{fetchImpl})).model,'gpt-6.1-terra');assert.deepEqual(tried,['gpt-6.1-terra']);
 process.env.OPENAI_MODEL='modele-a, modele-b';
 const none=async()=>({ok:false,status:404,json:async()=>({error:{code:'model_not_found'}})});
 await assert.rejects(()=>scanPanel({files:file},{fetchImpl:none}),e=>e.status===503&&/modele-a, modele-b/.test(e.message));
 delete process.env.OPENAI_MODEL;delete process.env.OPENAI_API_KEY;resetModelCache();
});

test('réglages IA de la console : priorité, validation, test d’accès',async()=>{
 const {aiModels,aiSource,cleanAiSettings,imageDetail,testModel,DEFAULT_MODELS,toInputParts:parts}=await import('../api/_lib/ai.js');
 delete process.env.OPENAI_MODEL;
 assert.deepEqual(aiModels({}),DEFAULT_MODELS);assert.equal(aiSource({}),'defaut');
 process.env.OPENAI_MODEL='gpt-6-luna';assert.deepEqual(aiModels({}),['gpt-6-luna']);assert.equal(aiSource({}),'variable');
 assert.deepEqual(aiModels({models:['gpt-6-astra']}),['gpt-6-astra'],'la console a priorité sur la variable');assert.equal(aiSource({models:['gpt-6-astra']}),'console');
 delete process.env.OPENAI_MODEL;
 assert.deepEqual(cleanAiSettings({models:['gpt-6-astra','gpt-6-astra',' gpt-6-luna '],detail:'original'}),{models:['gpt-6-astra','gpt-6-luna'],detail:'original'});
 assert.throws(()=>cleanAiSettings({models:['bad model!']}));assert.throws(()=>cleanAiSettings({detail:'max'}));
 assert.equal(imageDetail({detail:'original'}),'original');assert.equal(imageDetail({}),'high');
 assert.equal(parts([{name:'a.jpg',data:'data:image/jpeg;base64,/9j/'}],imageDetail({detail:'original'}))[0].detail,'original');
 process.env.OPENAI_API_KEY='k';
 const ok=await testModel('gpt-6-astra',{fetchImpl:async()=>({ok:true,status:200,json:async()=>({})})});assert.equal(ok.ok,true);
 const no=await testModel('gpt-6.1-terra',{fetchImpl:async()=>({ok:false,status:403,json:async()=>({error:{code:'model_not_found'}})})});assert.equal(no.ok,false);assert.match(no.message,/Non autorisé/);
 delete process.env.OPENAI_API_KEY;
});
