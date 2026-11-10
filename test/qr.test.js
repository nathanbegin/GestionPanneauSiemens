import test from 'node:test';import assert from 'node:assert/strict';
import {qrMatrix,qrSvg,panelLink,qrAllowed} from '../public/qr.js';
import {buildLabels} from '../api/_lib/pdf.js';
import {blank} from '../public/model.js';

const ID='3f2b8c1e-4d5a-4b6c-9d7e-1a2b3c4d5e6f';
test('lien du code QR',()=>{
 assert.equal(panelLink('https://exemple.ca/',ID),'https://exemple.ca/app#/panneaux/'+ID);
 assert.equal(panelLink('https://exemple.ca',ID),'https://exemple.ca/app#/panneaux/'+ID);
});
test('matrice et SVG',()=>{
 const url=panelLink('https://gestion-panneau-siemens.vercel.app',ID);
 const m=qrMatrix(url);
 assert.ok(m.length>=21&&(m.length-17)%4===0,'taille de version valide');
 assert.ok(m.every(r=>r.length===m.length));
 // motifs de repérage : coins haut-gauche, haut-droite et bas-gauche
 const n=m.length;
 for(const [r0,c0] of [[0,0],[0,n-7],[n-7,0]]){assert.ok(m[r0][c0]&&m[r0][c0+6]&&m[r0+6][c0]&&m[r0+6][c0+6]&&m[r0+3][c0+3],'motif de repérage');assert.equal(m[r0+1][c0+1],false);}
 assert.deepEqual(qrMatrix(url),m,'déterministe');
 const svg=qrSvg(url);
 assert.match(svg,/^<svg [^>]*viewBox="0 0 /);assert.match(svg,/<path d="M/);
 assert.ok(qrMatrix(url,{ecl:'L'}).length<=qrMatrix(url,{ecl:'Q'}).length);
});
test('forfaits avec code QR',()=>{
 assert.equal(qrAllowed({}),false);assert.equal(qrAllowed({qr:true}),true);assert.equal(qrAllowed({planning:true}),true);assert.equal(qrAllowed({},true),true);assert.equal(qrAllowed(undefined),false);
});
test('étiquettes PDF avec code QR',async()=>{
 const panel={id:ID,name:'Principal',tag:'P-1',kind:'Principal',location:'',positions:30,details:{},circuits:blank(30).map((c,i)=>i<2?{...c,label:'X'+i,amps:15}:c)};
 const base=await buildLabels({site:{name:'Maison'},panel,fedFromLabel:''});
 const withQr=await buildLabels({site:{name:'Maison'},panel,fedFromLabel:'',qrUrl:panelLink('https://exemple.ca',ID)});
 assert.ok(base.length>1000&&withQr.length>base.length,'le code QR ajoute des modules au PDF');
});
