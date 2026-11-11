// Génère api/_data/brandmark.js : le symbole Disjonio en PNG (pied de page des PDF). Usage : NODE_PATH=$(npm root -g) node scripts/brandmark-png.mjs
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
import {readFile,writeFile} from 'node:fs/promises';
const svg=await readFile(new URL('../public/branding/disjonio/svg/disjonio-symbol-on-light.svg',import.meta.url),'utf8');
const b=await chromium.launch();const p=await b.newPage({viewport:{width:192,height:192}});
await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:192px;height:192px}</style>${svg}`);
const png=await p.screenshot({omitBackground:true});await b.close();
await writeFile(new URL('../api/_data/brandmark.js',import.meta.url),'// Généré par scripts/brandmark-png.mjs à partir de public/branding/disjonio — ne pas modifier à la main.\nexport default {w:192,h:192,png:"'+png.toString('base64')+'"};\n');
console.log('brandmark',png.length,'octets');
