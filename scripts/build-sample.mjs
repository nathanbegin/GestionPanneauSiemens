// Génère public/assets/exemple-rapport.pdf (rapport d'exemple de la démonstration, données fictives).
import {writeFileSync} from 'node:fs';
import {buildReport} from '../api/_lib/pdf.js';
import {DEMO_SITE,DEMO_PANEL} from '../public/js/demo-data.js';
import {APP_VERSION} from '../public/model.js';
const bytes=await buildReport({kind:'report',format:'letter',user:{name:'Démonstration',email:'demo@exemple.ca',profile:{}},site:DEMO_SITE,panels:[{panel:DEMO_PANEL,fedFromLabel:''}],version:APP_VERSION});
writeFileSync(new URL('../public/assets/exemple-rapport.pdf',import.meta.url),bytes);
console.log('exemple-rapport.pdf',bytes.length,'octets');
