// Vue « réaliste » d'un panneau : boîtier en acier, plaque intérieure, étiquette du fabricant,
// disjoncteur principal (ou cosses), deux colonnes de disjoncteurs numérotées, obturateurs.
// Construite à partir des données du panneau : marque et logo du fabricant, formats (simple, double,
// triple, jumelé), calibres, DDFT (bouton TEST + fil témoin blanc), anti-arc, statut de chaque circuit.
import {familyOf} from '../catalog.js';
import {slotPos,slotOrder,designation} from '../model.js';
import {isEmptySlot} from './panelart.js';

const NS='http://www.w3.org/2000/svg';
function s(tag,attrs={},...kids){
 const el=document.createElementNS(NS,tag);
 for(const [k,v] of Object.entries(attrs))if(v!=null&&v!==false)el.setAttribute(k,String(v));
 for(const k of kids.flat())if(k!=null&&k!==false)el.append(k instanceof Node?k:document.createTextNode(String(k)));
 return el;
}
const slug=b=>String(b||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const fit=(t,n)=>{t=String(t||'');return t.length>n?t.slice(0,n-1)+'…':t;};
// Couleurs : éclaircir / foncer une couleur hexadécimale.
const shade=(hex,f)=>{const m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return hex;const n=parseInt(m[1],16);const c=[n>>16,(n>>8)&255,n&255].map(v=>Math.round(f<0?v*(1+f):v+(255-v)*f));return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');};
const STATUS={'Identifié':'#29c4a1','À confirmer':'#e0a43a','Non visible':'#e0a43a','Libre':'#9aa5ad'};
// Boutons de test : DDFT (GFCI) blanc, anti-arc bleu, combiné violet, protection d'équipement gris.
const TEST={'DDFT':{fill:'#f4f1e6',ink:'#1d2328',txt:'TEST',pig:true,tag:'GFCI'},'Anti-arc':{fill:'#3d82d6',ink:'#fff',txt:'TEST',pig:false,tag:'AFCI'},
 'DDFT + anti-arc':{fill:'#8b6ad8',ink:'#fff',txt:'TEST',pig:true,tag:'DF'},'Protection équipement':{fill:'#e8e4d6',ink:'#1d2328',txt:'TEST',pig:true,tag:'GFEP'}};

const P=19.65,H=18.1,W=72,XL=219,XR=310; // pas d'une position, hauteur d'un disjoncteur, largeur d'une colonne

/**
 * opts : {panel, labels:boolean (désignations à côté du panneau), match?(c)→bool (filtre), selected?:Set<id>, onCircuit(id)}
 */
export function panelReal({panel,labels=true,match=null,selected=null,onCircuit}){
 const det=panel.details||{};
 const fam=familyOf(det.family);
 const brand=(fam.brand||det.brand||'').trim();
 const rows=Math.ceil(panel.positions/2);
 const isMain=det.mainAmps&&!/cosses|sans principal/i.test(det.modelInfo||'')&&panel.kind!=='Sous-panneau'||/principal/i.test(det.modelInfo||'');
 // Géométrie verticale (le panneau s'allonge selon le nombre de positions).
 const Y0=387,areaBottom=Y0+rows*P,recessBottom=areaBottom+40,trimBottom=recessBottom+13,encBottom=trimBottom+81,total=encBottom+40;
 // Cadrage serré autour du boîtier ; colonnes de désignations de part et d'autre si demandées.
 const left=labels?-160:72,width=labels?920:456;
 const body=det.family&&fam.body?fam.body:'#1b2127';
 const svg=s('svg',{xmlns:NS,viewBox:`${left} 0 ${width} ${total}`,class:'panel-real',role:'img','aria-label':`Panneau ${brand} ${det.mainAmps?det.mainAmps+' A':''}, ${panel.positions} positions, vue réaliste`});
 svg.append(s('defs',{},
  grad('rpSteel',[0,'#d1dbe0'],[.19,'#a5b1ba'],[.43,'#bfcbd1'],[.72,'#8e9ba5'],[1,'#c1ccd3'],{x2:1,y2:1}),
  grad('rpTrim',[0,'#7b8893'],[.1,'#d4dee3'],[.45,'#a8b6bf'],[.9,'#ebf1f2'],[1,'#8999a2'],{x2:1,y2:.16}),
  grad('rpRecess',[0,'#8a969f'],[.08,'#adb9c0'],[.29,'#b9c5cb'],[.75,'#b4c0c7'],[.93,'#e0e7e9'],[1,'#7c8994'],{x2:1,y2:0}),
  grad('rpBody',[0,shade(body,.14)],[.17,shade(body,-.35)],[.66,shade(body,.06)],[1,shade(body,-.5)],{x2:0,y2:1}),
  grad('rpHandle',[0,'#767c83'],[.19,'#454c54'],[.48,'#1d2228'],[.74,'#555c65'],[1,'#15191e'],{x2:1,y2:1}),
  grad('rpBlank',[0,'#d0dbe0'],[.22,'#b6c3ca'],[.66,'#aab7bf'],[1,'#838f98'],{x2:0,y2:1}),
  grad('rpMain',[0,'#6a7077'],[.46,'#20252b'],[1,'#080a0d'],{x2:1,y2:1}),
  s('radialGradient',{id:'rpScrew'},s('stop',{offset:0,'stop-color':'#687680'}),s('stop',{offset:.65,'stop-color':'#dce5e8'}),s('stop',{offset:.9,'stop-color':'#66737e'}),s('stop',{offset:1,'stop-color':'#41515d'})),
  s('filter',{id:'rpDoor',x:'-40%',y:'-40%',width:'180%',height:'180%'},s('feDropShadow',{dx:5,dy:14,stdDeviation:12,'flood-color':'#04090d','flood-opacity':.45})),
  s('filter',{id:'rpFrame',x:'-20%',y:'-20%',width:'140%',height:'140%'},s('feDropShadow',{dx:2,dy:5,stdDeviation:5,'flood-color':'#394a55','flood-opacity':.5}))));

 // ---------- Boîtier, plaque intérieure, vis ----------
 svg.append(
  s('rect',{x:91,y:30,width:418,height:encBottom-30,rx:17,fill:'#6e7a83',opacity:.95,filter:'url(#rpDoor)'}),
  s('path',{d:`M112 30H488Q509 30 509 52V${encBottom-24}Q509 ${encBottom} 487 ${encBottom}H112Q91 ${encBottom} 91 ${encBottom-22}V52Q91 30 112 30Z`,fill:'url(#rpSteel)',stroke:'#6a7c86','stroke-width':3}),
  s('path',{d:'M110 48H483',stroke:'#eff6f8','stroke-opacity':.43,'stroke-width':2}),
  s('path',{d:`M111 ${encBottom-17}H480`,stroke:'#47525a','stroke-opacity':.35,'stroke-width':2}),
  s('path',{d:`M132 156Q127 141 139 133H460Q471 138 468 158V${trimBottom-20}Q466 ${trimBottom-4} 455 ${trimBottom}H143Q129 ${trimBottom-5} 132 ${trimBottom-25}Z`,fill:'url(#rpTrim)',stroke:'#75838e','stroke-width':3,filter:'url(#rpFrame)'}),
  s('rect',{x:145,y:147,width:310,height:recessBottom-147,rx:15,fill:'url(#rpRecess)',stroke:'#edf5f6','stroke-opacity':.72,'stroke-width':3}),
  s('rect',{x:158,y:159,width:284,height:recessBottom-173,rx:9,fill:'none',stroke:'#7b8a94','stroke-opacity':.42,'stroke-width':1.6}),
  ...[[115,65],[485,65],[115,encBottom-36],[485,encBottom-36]].map(([x,y])=>s('g',{transform:`translate(${x} ${y})`,stroke:'#47535c','stroke-width':1.2},s('circle',{r:9.4,fill:'url(#rpScrew)'}),s('path',{d:'M-3-3L3 3M-3 3L3-3'}))));

 // ---------- Étiquette du fabricant (logo de la marque du panneau) ----------
 const label=s('g',{transform:'translate(216 197)'},
  s('rect',{width:168,height:83,fill:'#f8faf8',rx:1,stroke:'#7d8587','stroke-width':1}),
  s('rect',{x:2,y:2,width:164,height:9,fill:'#dbe0df'}),
  s('rect',{x:2,y:2,width:43,height:9,fill:'#cb473e'}),s('text',{x:6,y:9,'font-size':6,'font-weight':700,fill:'#fff'},'DANGER'),
  s('rect',{x:124,y:2,width:42,height:9,fill:'#cc4f44'}),s('text',{x:144.5,y:9,'text-anchor':'middle','font-size':6,'font-weight':700,fill:'#fff'},'WARNING'),
  s('text',{x:7,y:22,'font-size':6.6,'font-weight':750,fill:'#1f2e32'},isMain?`LOAD CENTER · ${det.mainAmps} A`:'LOAD CENTER · COSSES'),
  s('text',{x:7,y:31,'font-size':5.6,fill:'#505e63'},fit([det.voltage||'120/240 V',`${panel.positions} ESPACES`].join(' · '),34)),
  s('text',{x:7,y:39.5,'font-size':5.6,fill:'#505e63'},fit([det.model||(det.family?fam.name:''),det.modelId].filter(Boolean).join(' · '),34)),
  s('path',{d:'M8 45H159M8 59H159',stroke:'#aeb5b4','stroke-width':.65}),
  s('g',{fill:'#838b8b'},...[[8,48,79],[8,53,74],[8,63,85],[8,68,75],[100,48,56],[100,53,51],[100,63,57],[100,68,50]].map(([x,y,w])=>s('rect',{x,y,width:w,height:2}))),
  s('text',{x:8,y:78,'font-size':5,fill:'#566067'},'REPRÉSENTATION ILLUSTRATIVE'));
 // Logo du fabricant au centre du bandeau (nom de marque en attendant le chargement, ou si aucun logo).
 const brandText=s('text',{x:84,y:8.6,'text-anchor':'middle','font-size':brand.length>12?6.2:8.2,'font-weight':800,fill:fam.accent||'#087ca9'},fit(brand.toUpperCase()||'PANNEAU',18));
 label.append(s('rect',{x:47,y:2,width:75,height:9,fill:'#fff'}),brandText);
 if(brand){
  const img=s('image',{href:`assets/brands/${slug(brand)}.svg`,x:49,y:2.4,width:71,height:8.2,preserveAspectRatio:'xMidYMid meet'});
  img.addEventListener('load',()=>brandText.remove());img.addEventListener('error',()=>img.remove());
  label.append(img);
 }
 svg.append(label);

 // ---------- Disjoncteur principal ou cosses ----------
 if(isMain){
  svg.append(s('g',{'aria-label':`Disjoncteur principal ${det.mainAmps} ampères`},
   s('rect',{x:220,y:295,width:160,height:71,rx:2,fill:'#2e353b',stroke:'#525d66','stroke-width':2}),
   s('rect',{x:225,y:299,width:150,height:11,fill:'#14191e'}),
   s('rect',{x:226,y:312,width:71,height:49,fill:'url(#rpBody)'}),s('rect',{x:303,y:312,width:71,height:49,fill:'url(#rpBody)'}),
   s('rect',{x:249,y:319,width:36,height:34,rx:2,fill:'url(#rpMain)',stroke:'#777e83'}),s('rect',{x:316,y:319,width:36,height:34,rx:2,fill:'url(#rpMain)',stroke:'#777e83'}),
   s('rect',{x:253,y:319,width:28,height:7,fill:'#8a9195',opacity:.48}),s('rect',{x:320,y:319,width:28,height:7,fill:'#8a9195',opacity:.48}),
   s('rect',{x:294,y:318,width:12,height:39,rx:1,fill:'#11161a'}),
   s('text',{x:300,y:337,fill:'#eaf4fa','text-anchor':'middle','font-size':9.5,'font-weight':800,transform:'rotate(90 300 337)'},`${det.mainAmps} A`),
   s('text',{x:232,y:307,'font-size':7,fill:'#b7c1c9'},'ON / I'),s('text',{x:330,y:307,'font-size':7,fill:'#b7c1c9'},'ON / I')));
 }else{
  svg.append(s('g',{'aria-label':'Cosses principales, sans disjoncteur principal'},
   s('rect',{x:228,y:300,width:144,height:62,rx:3,fill:'#3a4249',stroke:'#5c6770','stroke-width':1.5}),
   ...[255,345].map(x=>s('g',{},s('rect',{x:x-17,y:312,width:34,height:30,rx:3,fill:'#c9a56a',stroke:'#7d6436'}),s('circle',{cx:x,cy:327,r:7,fill:'#9a7b44',stroke:'#5e4a26'}),s('path',{d:`M${x-4} 327H${x+4}`,stroke:'#3d301a','stroke-width':1.6}))),
   s('text',{x:300,y:356,'text-anchor':'middle','font-size':6.5,'font-weight':700,fill:'#cfd7dc'},'COSSES PRINCIPALES')));
 }

 // ---------- Ouvertures des colonnes et barre centrale ----------
 svg.append(
  s('rect',{x:216,y:Y0-4,width:168,height:rows*P+12,rx:1,fill:'#172029',stroke:'#566675','stroke-width':2}),
  s('rect',{x:292,y:Y0-1,width:16,height:rows*P+6,fill:'#070b0f',stroke:'#46535e','stroke-width':1.5}),
  s('path',{d:`M299 ${Y0}V${areaBottom+4}`,stroke:'#adb9c5','stroke-opacity':.3,'stroke-dasharray':'2 3'}));

 // Numéros de position (impairs à gauche, pairs à droite).
 const nums=s('g',{'font-size':9,'font-weight':750,fill:'#546570','text-anchor':'middle'});
 for(let n=1;n<=panel.positions;n++){const r=Math.floor((n-1)/2),y=Y0+r*P+12.4;nums.append(s('text',{x:n%2?203:398,y},String(n).padStart(2,'0')));}
 svg.append(nums);

 // ---------- Disjoncteurs et obturateurs ----------
 const slots=s('g',{class:'rp-slots'});
 const pigtails=s('g',{class:'rp-pigtails'});
 const tagList=s('g',{class:'rp-labels'});
 const brandShort=fit((fam.brand||det.brand||'').toUpperCase(),9);
 for(const c of panel.circuits){
  const right=slotPos(c.slots[0])%2===0,x=right?XR:XL;
  const o0=slotOrder(c.slots[0]),o1=slotOrder(c.slots[c.slots.length-1]);
  const y=Y0+o0*P/2,hgt=(o1-o0+1)*P/2-(P-H);
  const half=c.slots.length===1;
  const poles=new Set(c.slots.map(slotPos)).size;
  const dim=match&&!match(c);
  const g=s('g',{class:'rp-slot'+(dim?' dim':'')+(selected?.has(c.id)?' sel':''),'data-id':c.id,transform:`translate(${x} ${y})`,role:'button',tabindex:0,
   'aria-label':`${designation(c)} : ${c.vacant?'espace inutilisé':c.label||'à identifier'}${c.amps?', '+c.amps+' A':''}${c.protection&&c.protection!=='Standard'?', '+c.protection:''}`});
  g.append(s('title',{},`${designation(c)} · ${c.vacant?'Espace inutilisé':c.label||'À identifier'}${c.amps?' · '+c.amps+' A':''}${c.protection&&c.protection!=='Standard'?' · '+c.protection:''}${c.breakerRef?' · '+c.breakerRef:''}`));
  if(isEmptySlot(c)){
   // Obturateur : une plaque par position couverte.
   g.append(s('rect',{x:0,y:0,width:W,height:hgt,fill:'url(#rpBlank)',stroke:'#72818d','stroke-width':.7}),
    s('path',{d:`M2 ${hgt-2}H70`,stroke:'#647581','stroke-opacity':.7,'stroke-width':.8}),s('path',{d:'M4 3H68',stroke:'#edf4f6','stroke-opacity':.5,'stroke-width':.85}));
  }else{
   const test=TEST[c.protection];
   g.append(s('rect',{x:0,y:0,width:W,height:hgt,rx:.6,fill:'url(#rpBody)',stroke:'#5c6670','stroke-width':.55}));
   // Bloc d'identification (calibre, marque ou référence, nombre de pôles).
   const bx=right?43:2,bw=27;
   const line2=c.breakerRef||(poles>1?`${poles} POLE`:brandShort);
   const testBtn=(y0,text)=>[s('rect',{x:bx+1,y:y0,width:bw-2,height:5.8,rx:1.3,fill:test.fill,stroke:'#11161a','stroke-width':.45}),
    s('text',{x:bx+13,y:y0+4.2,'text-anchor':'middle','font-size':3.4,'font-weight':800,fill:test.ink},text)];
   if(!half){
    g.append(s('rect',{x:bx,y:2,width:bw,height:Math.min(hgt-4,13.8),fill:'#242b31',stroke:'#64727a','stroke-width':.5}),
     s('rect',{x:bx+1,y:3,width:bw-2,height:5.1,fill:'#4c5965'}),
     s('text',{x:bx+13,y:7.8,'text-anchor':'middle','font-size':5.15,'font-weight':800,fill:'#e8eef0'},c.amps?c.amps+'A':'?'));
    if(!test||poles>1)g.append(s('text',{x:bx+13,y:13.7,'text-anchor':'middle','font-size':c.breakerRef?4.2:4.7,fill:'#c4ced3'},fit(line2,10)));
    // DDFT / anti-arc : bouton TEST coloré (2e ligne d'un simple, 2e pôle d'un double ou triple).
    if(test&&poles===1)g.append(...testBtn(9.3,`${test.tag} TEST`));
    if(test&&poles>1)g.append(s('rect',{x:bx,y:P+2,width:bw,height:9.6,fill:'#242b31',stroke:'#64727a','stroke-width':.5}),...testBtn(P+3.9,`${test.tag} · TEST`));
    if(poles>1&&c.breakerRef&&!test)g.append(s('text',{x:bx+13,y:P+9,'text-anchor':'middle','font-size':4.7,fill:'#c4ced3'},`${poles} POLE`));
   }else{
    g.append(s('text',{x:bx+13,y:hgt/2+2.2,'text-anchor':'middle','font-size':5,'font-weight':800,fill:'#e8eef0'},c.amps?c.amps+'A':'?'));
    if(test)g.append(s('circle',{cx:right?bx+24:bx+3,cy:hgt/2,r:2.2,fill:test.fill,stroke:'#11161a','stroke-width':.4}));
   }
   // Manettes : une par pôle, reliées par une barre pour un double ou un triple.
   const hx=right?6:33;
   const handles=half?1:poles;
   for(let k=0;k<handles;k++){
    const hy=half?.8:2+k*P,hh=half?hgt-1.6:14.2;
    const off=c.status==='Libre';
    g.append(s('rect',{x:hx,y:hy,width:32,height:hh,rx:1,fill:'#080c10'}),
     s('rect',{x:hx+3,y:hy+(off?hh*.36:.9),width:26,height:half?hh*.55:9,rx:1.8,fill:'url(#rpHandle)',stroke:'#80888f','stroke-width':.75}),
     !half&&s('path',{d:`M${hx+6} ${hy+2+(off?hh*.36:0)}h20`,stroke:'#9ca6ae','stroke-opacity':.55,'stroke-width':.75}));
   }
   if(handles>1)g.append(s('rect',{x:hx+13,y:6,width:6,height:(handles-1)*P+2,rx:1.5,fill:'#3b434b',stroke:'#80888f','stroke-width':.6}));
   // Bouton TEST (DDFT / anti-arc) et étiquette du type de protection.
   if(test){
    // Fil témoin blanc (pigtail) qui rejoint la barre de neutre au centre.
    if(test.pig){
     const sx=right?XR:XL+W,sy=y+Math.min(hgt-3,9),cx=300;
     pigtails.append(s('path',{d:`M${sx} ${sy}C${sx+(right?-6:6)} ${sy+3} ${cx+(right?6:-6)} ${sy+5} ${cx+(right?3:-3)} ${sy+7}`,fill:'none',stroke:'#f4f4ef','stroke-width':1.5,'stroke-linecap':'round',opacity:.95}));
    }
   }
  }
  // Témoin de statut (vert identifié, ambre à confirmer, gris libre).
  g.append(s('rect',{x:right?.8:W-3.2,y:2,width:2,height:Math.max(3,hgt-4),fill:c.vacant?'#9aa5ad':STATUS[c.status]||'#9aa5ad',opacity:.94}));
  g.append(s('rect',{class:'rp-sel',x:-2,y:-1.7,width:W+4,height:hgt+3.4,rx:2,fill:'none',stroke:'#2ad8f6','stroke-width':2}));
  slots.append(g);
  // Désignation à côté du panneau, reliée à son numéro.
  if(labels&&(c.label||c.vacant)){
   const ly=y+Math.min(hgt/2,9)+3,txt=c.vacant?'Espace inutilisé':c.label;
   tagList.append(s('text',{x:right?606:-6,y:ly,'text-anchor':right?'start':'end','font-size':half?7.4:8.4,'font-weight':c.vacant?400:600,'font-style':c.vacant?'italic':'normal',fill:dim?'#9aa6ae':'#22343c',class:'rp-label','data-id':c.id},fit(txt,30)),
    s('path',{d:right?`M512 ${ly-3}H600`:`M0 ${ly-3}H88`,stroke:'#b4c0c7','stroke-width':.6,'stroke-dasharray':'1.5 2.5'}));
  }
 }
 svg.append(slots,pigtails,tagList,
  s('text',{x:300,y:trimBottom+16,'font-size':11,fill:'#64747f','text-anchor':'middle','font-weight':700,'letter-spacing':1},[brand.toUpperCase()||'PANNEAU',isMain?`${det.mainAmps} A`:'SOUS-PANNEAU'].join(' · ')));
 svg.addEventListener('click',e=>{const g=e.target.closest('[data-id]');if(g&&onCircuit)onCircuit(g.getAttribute('data-id'));});
 svg.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('.rp-slot')){e.preventDefault();onCircuit?.(e.target.getAttribute('data-id'));}});
 return svg;
}
function grad(id,...args){
 const opts=typeof args.at(-1)==='object'&&!Array.isArray(args.at(-1))?args.pop():{};
 return s('linearGradient',{id,x1:0,y1:0,x2:opts.x2??1,y2:opts.y2??1},...args.map(([o,c])=>s('stop',{offset:o,'stop-color':c})));
}
