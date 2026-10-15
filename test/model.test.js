import test from 'node:test';import assert from 'node:assert/strict';import {blank,validate,parentOf} from '../public/model.js';
test('40 positions uniques',()=>assert.equal(validate(blank()).length,40));
test('bipolaire sur la même colonne et réservation',()=>{const d=blank();d[0].poles=2;assert.throws(()=>validate(d));d[2].status='Libre';validate(d);assert.equal(parentOf(d,3).position,1);});
test('empêche dépassement et chevauchement',()=>{const d=blank();d[38].poles=2;assert.throws(()=>validate(d));d[38].poles=1;d[0].poles=2;d[2].status='Libre';d[2].poles=2;d[4].status='Libre';assert.throws(()=>validate(d));});
test('rejette import malformé',()=>{assert.throws(()=>validate([]));const d=blank();d[4].position=1;assert.throws(()=>validate(d));const e=blank();e[0].amps=999;assert.throws(()=>validate(e));});
