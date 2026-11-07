// Convertit les logos SVG (public/assets/brands) en PNG pour les PDF (pdf-lib ne lit pas le SVG).
// Résultat : api/_data/logos.js. À relancer après l'ajout ou le remplacement d'un logo :
//   NODE_PATH=$(npm root -g) node scripts/logos-png.mjs
import {createRequire} from 'node:module';
import {readdir,readFile,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const dir=new URL('../public/assets/brands/',import.meta.url);
const files=(await readdir(dir)).filter(f=>f.endsWith('.svg'));
const browser=await chromium.launch();
const page=await browser.newPage({deviceScaleFactor:1});
const out={};
for(const f of files){
 const svg=await readFile(new URL(f,dir),'utf8');
 // Rendu à 160 px de haut, fond transparent, largeur selon les proportions du logo.
 await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;height:160px;width:auto}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`);
 const img=await page.waitForSelector('img');
 await page.waitForFunction(()=>document.querySelector('img').complete);
 const box=await img.boundingBox();
 const png=await img.screenshot({omitBackground:true});
 out[f.replace(/\.svg$/,'')]={w:Math.round(box.width),h:Math.round(box.height),png:png.toString('base64')};
 console.log(f,Math.round(box.width)+'×'+Math.round(box.height),png.length+' o');
}
await browser.close();
await writeFile(new URL('../api/_data/logos.js',import.meta.url),'// Généré par scripts/logos-png.mjs à partir de public/assets/brands/*.svg — ne pas modifier à la main.\n// Logos des fabricants : marques de commerce de leurs propriétaires (voir public/assets/brands/LISEZMOI.md).\nexport default '+JSON.stringify(out)+';\n');
