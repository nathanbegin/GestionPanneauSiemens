// Génère api/_data/brandlogo.js : logo horizontal Disjonio (PNG) utilisé dans l'en-tête des PDF quand l'entreprise n'a pas son logo.
// Usage : NODE_PATH=$(npm root -g) node scripts/brandlogo-png.mjs
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
import {readFile,writeFile} from 'node:fs/promises';
const svg=await readFile(new URL('../public/branding/disjonio/svg/outlined/disjonio-horizontal-no-tagline-on-light.svg',import.meta.url),'utf8');
const vb=svg.match(/viewBox="([\d.\s-]+)"/)[1].split(/\s+/).map(Number);const W=640,H=Math.round(W*vb[3]/vb[2]);
const b=await chromium.launch();const p=await b.newPage({viewport:{width:W,height:H}});
await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${W}px;height:${H}px}</style>${svg}`);
const png=await p.screenshot({omitBackground:true});await b.close();
await writeFile(new URL('../api/_data/brandlogo.js',import.meta.url),`// Généré par scripts/brandlogo-png.mjs à partir de public/branding/disjonio — ne pas modifier à la main.\nexport default {w:${W},h:${H},png:"${png.toString('base64')}"};\n`);
console.log('brandlogo',W,H,png.length,'octets');
