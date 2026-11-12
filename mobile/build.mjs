// Prépare mobile/www à partir de ../public : l'application démarre directement sur l'espace connecté.
// API_URL (facultatif) : adresse du serveur. Défaut : https://gestion-panneau-siemens.vercel.app
import {cp,rm,writeFile,readFile,mkdir,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const here=new URL('.',import.meta.url),www=new URL('www/',here),pub=new URL('../public/',here);
const api=(process.env.API_URL||'https://gestion-panneau-siemens.vercel.app').replace(/\/$/,'');
await rm(www,{recursive:true,force:true});await mkdir(www,{recursive:true});
for(const dir of ['assets','js','branding','fonts'])await cp(new URL(dir,pub),new URL(dir,www),{recursive:true});
// Tous les modules JavaScript à la racine de public/ (model, catalog, loadcalc, units, optimize, merge, i18n…) : les modules de js/ les importent.
for(const f of (await readdir(pub)).filter(f=>f.endsWith('.js')&&f!=='sw.js'&&f!=='config.js'))await cp(new URL(f,pub),new URL(f,www));
await cp(new URL('vendor/',pub),new URL('vendor/',www),{recursive:true});
// Page d'entrée = application ; pas de service worker dans l'app native.
const html=(await readFile(new URL('app.html',pub),'utf8')).replace('<link rel="manifest" href="manifest.webmanifest">','');
await writeFile(new URL('index.html',www),html);
await writeFile(new URL('config.js',www),`// Généré par mobile/build.mjs\nwindow.MP_CONFIG={apiBase:${JSON.stringify(api)},native:true};\n`);
console.log('www prêt →',fileURLToPath(www),'· API :',api);
