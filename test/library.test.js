import test from 'node:test';import assert from 'node:assert/strict';
import {parseAmps,protectionOf,library,findPanel,panelSnapshot} from '../api/_lib/library.js';
import {blank,placeBreaker,validate} from '../public/model.js';
import {compatibility,validStarts} from '../public/js/library.js';

test('lecture des calibres',()=>{
 assert.deepEqual(parseAmps(20),[20]);assert.deepEqual(parseAmps('15/20'),[15,20]);assert.deepEqual(parseAmps('2×15'),[15,15]);
 assert.deepEqual(parseAmps('2×15 + 2P20'),[15,20,15]);assert.deepEqual(parseAmps('15 + 2P30 + 15'),[15,30,15]);assert.deepEqual(parseAmps(null),[]);
});
test('protections',()=>{assert.equal(protectionOf('CAFCI'),'Anti-arc');assert.equal(protectionOf('DDFT 5 mA intelligent (2e gén.)'),'DDFT');assert.equal(protectionOf('Double fonction (CAFCI + 5 mA)'),'DDFT + anti-arc');assert.equal(protectionOf('Protection équipement 30 mA'),'Protection équipement');assert.equal(protectionOf('Standard'),'Standard');});
test('bibliothèque normalisée',()=>{
 const L=library();assert.equal(L.panels.length,332);assert.equal(L.breakers.length,680);
 const by=c=>L.breakers.find(b=>b.cat===c);
 assert.equal(by('QO120CP').kind,'single');assert.equal(by('QO1520CP').kind,'tandem');assert.equal(by('DNPL152015').kind,'quad');
 assert.equal(by('QOM30L').kind,null);assert.equal(by('CHOM2150BB').kind,null);
 for(const b of L.breakers)if(b.kind)assert.ok(b.amps.length||b.surge,b.cat);
 const p=findPanel('CQO140M200PC');assert.equal(p.espaces,40);assert.ok(p.tandem&&p.designable);
 assert.equal(panelSnapshot(p).maxCircuits,80);
 assert.ok(!findPanel('CQOE220GFINM').designable);
 const lev=L.panels.find(x=>x.family==='LEV'&&x.designable);assert.equal(lev.tandem,false);
});
test('placement de chaque format de la bibliothèque',()=>{
 const L=library();
 for(const kind of ['single','double','triple','tandem','quad']){
  const b=L.breakers.find(x=>x.kind===kind);let c=blank(12);
  c=placeBreaker(c,1,b,12);validate(c,{positions:12});
  assert.ok(c.some(x=>x.breakerRef===b.cat),kind);
 }
 const c=blank(12);c[0].label='Four';assert.throws(()=>placeBreaker(c,1,L.breakers.find(x=>x.kind==='single'),12),/Four/);
 assert.throws(()=>placeBreaker(blank(12),11,L.breakers.find(x=>x.kind==='double'),12));
});
test('compatibilité et positions valides',()=>{
 const L=library();const pon=L.breakers.find(b=>b.neutre==='PoN'&&b.family==='QO');const qo=L.breakers.find(b=>b.cat==='QO1520CP');
 assert.ok(compatibility(pon,{family:'QO',pon:false}).some(i=>i.level==='error'));
 assert.ok(compatibility(qo,{family:'SIE',pon:true}).some(i=>i.level==='error'));
 assert.ok(compatibility(qo,{family:'QO',tandem:false}).some(i=>/jumelés/.test(i.text)));
 assert.equal(compatibility(qo,{family:'QO',pon:true,tandem:true}).length,0);
 const panel={positions:8,circuits:blank(8)};panel.circuits[2].label='Occupé';
 const free=c=>!c.label;
 const starts=validStarts(panel,L.breakers.find(b=>b.kind==='double'),free);
 assert.ok(starts.has(2)&&!starts.has(1)&&!starts.has(3)&&!starts.has(7));
});
