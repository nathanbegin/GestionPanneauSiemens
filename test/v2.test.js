import test from 'node:test';import assert from 'node:assert/strict';
import {blank,validate,reshape,resize,stats,cleanPanelMeta,cleanSite,designation,formatOf,highestPosition,normalize} from '../public/model.js';
import {hashPassword,verifyPassword,sign,verifySignature} from '../api/_lib/auth.js';
import {buildReport,buildLabels} from '../api/_lib/pdf.js';

test('panneau de 42 positions',()=>{const d=blank(42);assert.equal(validate(d,{positions:42}).length,42);assert.throws(()=>validate(d,{positions:40}));});
test('bipolaire puis retour unipolaire',()=>{
 let d=reshape(blank(24),'1','double',24);
 assert.deepEqual(d.find(c=>c.id==='1').slots,['1A','1B','3A','3B']);assert.ok(!d.some(c=>c.id==='3'));assert.equal(designation(d[0]),'1/3');assert.equal(formatOf(d[0]),'double');
 d=reshape(d,'1','single',24);assert.ok(d.some(c=>c.slots.join()==='3A,3B'));validate(d,{positions:24});
});
test('jumelé crée un demi-emplacement B',()=>{const d=reshape(blank(24),'5','tandem',24);assert.deepEqual(d.find(c=>c.id==='5').slots,['5A']);assert.ok(d.some(c=>c.slots.join()==='5B'));const back=reshape(d,'5','single',24);assert.deepEqual(back.find(c=>c.id==='5').slots,['5A','5B']);});
test('refuse de fusionner une fiche remplie',()=>{const d=blank(24);d[2].label='Four';assert.throws(()=>reshape(d,'1','double',24),/Four/);});
test('refuse une position hors panneau',()=>assert.throws(()=>reshape(blank(24),'23','double',24)));
test('tripolaire',()=>{const d=reshape(blank(30),'2','triple',30);assert.deepEqual(d.find(c=>c.id==='2').slots,['2A','2B','4A','4B','6A','6B']);});
test('redimensionnement',()=>{let d=resize(blank(24),30);assert.equal(d.length,30);d=resize(d,20);assert.equal(d.length,20);const f=blank(24);f[23].label='Spa';assert.throws(()=>resize(f,20),/Spa/);assert.throws(()=>resize(blank(24),21));});
test('statistiques',()=>{const d=blank(4);d[0].status='Identifié';d[1].status='Libre';assert.deepEqual(stats(d),{total:4,identified:1,free:1,toConfirm:2,progress:50});});
test('métadonnées nettoyées',()=>{const m=cleanPanelMeta({name:' P ',tag:'P-1',details:{mainAmps:'200',surveyDate:'2026-11-05'}});assert.equal(m.name,'P');assert.equal(m.details.mainAmps,200);assert.throws(()=>cleanPanelMeta({name:''}));assert.throws(()=>cleanPanelMeta({name:'x',kind:'Bidon'}));assert.equal(cleanSite({name:'M',postalCode:'h7n 1a1'}).postalCode,'H7N 1A1');});
test('import v1 vers un grand panneau',()=>{const d=normalize(blank(32),{positions:84});assert.equal(highestPosition(d),32);});
test('mots de passe scrypt',async()=>{const h=await hashPassword('motdepasse123');assert.ok(await verifyPassword('motdepasse123',h));assert.ok(!await verifyPassword('autre',h));});
test('liens signés',()=>{const {exp,sig}=sign({panel:'a',uid:'u'});assert.ok(verifySignature({panel:'a',uid:'u',exp:String(exp)},sig));assert.ok(!verifySignature({panel:'b',uid:'u',exp:String(exp)},sig));});
test('PDF rapport, aide-mémoire et étiquettes',async()=>{
 let circuits=reshape(blank(40),'1','double',40);circuits[0].label='Cuisinière — 240 V ✓ 🔥';circuits[0].status='Identifié';circuits[0].amps=40;
 const panel={id:'p',name:'Panneau principal',tag:'P-1',kind:'Principal',location:'Sous-sol',positions:40,details:{brand:'Siemens',mainAmps:200,voltage:'120/240 V monophasé'},circuits};
 const site={name:'Maison',street:'1 rue A',city:'Laval',province:'QC',postalCode:'H7N 1A1',client:'',notes:''};
 const user={name:'Test',email:'t@example.com',profile:{accountType:'pro',company:'Élec inc.',licence:'1234'}};
 for(const kind of ['report','door']){const b=await buildReport({kind,user,site,panels:[{panel,fedFromLabel:''},{panel:{...panel,id:'q'},fedFromLabel:'P-1'}],version:'test'});assert.equal(Buffer.from(b.slice(0,5)).toString(),'%PDF-');}
 const l=await buildLabels({site,panel,fedFromLabel:''});assert.ok(l.length>1000);
});

import {bulkApply as bulk} from '../public/model.js';
import {blank as blankPanel,validate as validatePanel} from '../public/model.js';
test('actions groupées sur les circuits',()=>{
 const c=blankPanel(6);c[0].label='Cuisine';c[0].amps=20;c[0].loads=[];
 let r=bulk(c,['1','3'],{type:'vacant'});
 assert.equal(r[0].vacant,true);assert.equal(r[0].label,'');assert.equal(r[0].status,'Libre');assert.equal(r[0].amps,null);
 validatePanel(r,{positions:6});
 r=bulk(r,['1'],{type:'set',patch:{amps:15,status:'Identifié'}});assert.equal(r[0].vacant,undefined);assert.equal(r[0].amps,15);
 r=bulk(r,['2','4'],{type:'set',patch:{room:'Garage',protection:'DDFT'}});assert.equal(r[1].room,'Garage');assert.equal(r[3].protection,'DDFT');
 r=bulk(r,['2'],{type:'free'});assert.equal(r[1].status,'Libre');assert.equal(r[1].room,'Garage');
 r=bulk(r,['2'],{type:'clear'});assert.equal(r[1].room,'');assert.equal(r[1].status,'À confirmer');
 assert.throws(()=>bulk(r,['1'],{type:'set',patch:{amps:17}}));
 validatePanel(r,{positions:6});
});

import {brandTheme,decodeLogo} from '../api/_lib/pdf.js';
test('image de marque des PDF',()=>{
 const t=brandTheme({primary:'#ffd200',accent:'#222222'});
 assert.ok(t.headText.red<.2,'texte foncé sur en-tête clair');
 const d=brandTheme({primary:'#0b3d91'});assert.equal(d.headText.red,1);
 assert.equal(brandTheme(null).headBg,brandTheme({}).headBg);
 assert.equal(decodeLogo(''),null);
 assert.throws(()=>decodeLogo('data:image/png;base64,'+Buffer.from('nope').toString('base64')));
 const png=Buffer.from('89504e470d0a1a0a','hex');assert.equal(decodeLogo('data:image/png;base64,'+png.toString('base64')).type,'png');
});

import {cleanPdfSettings,resolveFooter} from '../api/_lib/footers.js';
test('pieds de page des PDF',()=>{
 const s=cleanPdfSettings({legal:' Mention ',footers:[{id:'g1',label:'Garantie',text:'Garantie 1 an'},{label:'',text:'x'}]});
 assert.equal(s.legal,'Mention');assert.equal(s.footers.length,1);
 assert.deepEqual(resolveFooter({footerId:'g1',footer:'perso'},s),{footer:'Garantie 1 an',legal:'Mention'});
 assert.equal(resolveFooter({footer:'perso'},s).footer,'perso');
 assert.throws(()=>cleanPdfSettings({footers:[{id:'a',label:'x',text:'y'},{id:'a',label:'z',text:'w'}]}));
});
