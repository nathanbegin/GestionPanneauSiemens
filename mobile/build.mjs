// Prépare mobile/www à partir de ../public : l'application démarre directement sur l'espace connecté.
// API_URL (facultatif) : adresse du serveur. Défaut : https://gestion-panneau-siemens.vercel.app
import {cp,rm,writeFile,readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const here=new URL('.',import.meta.url),www=new URL('www/',here),pub=new URL('../public/',here);
const api=(process.env.API_URL||'https://gestion-panneau-siemens.vercel.app').replace(/\/$/,'');
await rm(www,{recursive:true,force:true});await mkdir(www,{recursive:true});
for(const dir of ['assets','js','branding','fonts'])await cp(new URL(dir,pub),new URL(dir,www),{recursive:true});
await cp(new URL('model.js',pub),new URL('model.js',www));
for(const f of ['qr.js','i18n.js','i18n-core.js','i18n-en.js','i18n-load.js','i18n-en-docs.js','i18n-en-admin.js'])await cp(new URL(f,pub),new URL(f,www));
await cp(new URL('vendor/',pub),new URL('vendor/',www),{recursive:true});
// Page d'entrée = application ; pas de service worker dans l'app native.
const html=(await readFile(new URL('app.html',pub),'utf8')).replace('<link rel="manifest" href="manifest.webmanifest">','');
await writeFile(new URL('index.html',www),html);
await writeFile(new URL('config.js',www),`// Généré par mobile/build.mjs\nwindow.MP_CONFIG={apiBase:${JSON.stringify(api)},native:true};\n`);
console.log('www prêt →',fileURLToPath(www),'· API :',api);
