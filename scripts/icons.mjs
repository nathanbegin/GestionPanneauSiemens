// Génère les icônes PNG (PWA, iOS, Android) à partir des SVG avec le Chromium préinstallé.
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright'); // Playwright global ou local (NODE_PATH)
import {readFile} from 'node:fs/promises';
const out=new URL('../public/assets/',import.meta.url);
const browser=await chromium.launch();
const page=await browser.newPage();
for(const [src,size,name] of [['icon.svg',192,'icon-192.png'],['icon.svg',512,'icon-512.png'],['icon-maskable.svg',512,'icon-maskable-512.png'],['icon-maskable.svg',1024,'icon-1024.png']]){
 const svg=await readFile(new URL(src,out),'utf8');
 await page.setViewportSize({width:size,height:size});
 await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
 await page.screenshot({path:new URL(name,out).pathname,omitBackground:true});
}
await browser.close();
