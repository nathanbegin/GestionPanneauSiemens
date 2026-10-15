import test from 'node:test';import assert from 'node:assert/strict';import {blank,validate,normalize} from '../public/model.js';
test('32 positions complètes',()=>assert.equal(validate(blank()).length,32));
test('demi-emplacements liés nB et n+2 A',()=>{const d=blank();d[0].slots=['1A'];d[2].slots=['3B'];d.push({...d[0],id:'liaison',slots:['1B','3A']});validate(d);});
test('refuse chevauchement et liaison entre colonnes',()=>{const d=blank();d[0].slots=['1A','2A'];assert.throws(()=>validate(d));const e=blank();e.push({...e[0],id:'doublon'});assert.throws(()=>validate(e));});
test('migration v1 conserve les informations et les bipolaires',()=>{const d=Array.from({length:40},(_,i)=>({position:i+1,label:'Circuit '+(i+1),room:'',usage:'Autre',amps:15,poles:1,status:'À identifier',notes:''}));d[0].poles=2;d[2].status='Libre';const out=normalize(d);assert.equal(out.length,39);assert.deepEqual(out[0].slots,['1A','1B','3A','3B']);assert.equal(out[0].label,'Circuit 1');});
test('rejette données malformées',()=>{assert.throws(()=>validate([]));const d=blank();d[0].amps=999;assert.throws(()=>validate(d));});
