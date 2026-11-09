// Vue « réaliste » d'un panneau : boîtier en acier, plaque intérieure, étiquette du fabricant,
// disjoncteur principal horizontal (ou cosses), deux colonnes de disjoncteurs numérotées, obturateurs.
// Construite à partir des données du panneau : marque et logo du fabricant, formats (simple, double,
// triple, jumelé), calibres, références, DDFT et anti-arc (bouton TEST coloré), statut de chaque circuit.
// Utilisée dans les onglets Panneau et Planification (placement de disjoncteurs de la bibliothèque).
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
// Éclaircir (f>0) ou foncer (f<0) une couleur hexadécimale.
const shade=(hex,f)=>{const m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return hex;const n=parseInt(m[1],16);const c=[n>>16,(n>>8)&255,n&255].map(v=>Math.round(f<0?v*(1+f):v+(255-v)*f));return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');};
const STATUS={'Identifié':'#29c4a1','À confirmer':'#e0a43a','Non visible':'#e0a43a','Libre':'#9aa5ad'};
// Boutons de test : DDFT (GFCI) blanc, anti-arc bleu, combiné violet, protection d'équipement crème.
const TEST={'DDFT':{fill:'#f4f1e6',ink:'#1d2328',tag:'GFCI'},'Anti-arc':{fill:'#3d82d6',ink:'#fff',tag:'AFCI'},
 'DDFT + anti-arc':{fill:'#8b6ad8',ink:'#fff',tag:'DF'},'Protection équipement':{fill:'#e8e4d6',ink:'#1d2328',tag:'GFEP'}};

// Géométrie : pas d'une position, hauteur d'un disjoncteur, largeur d'une colonne, abscisses des colonnes.
const P=24,H=22,W=84,XL=205,XR=311;
const BW=38; // largeur du bloc d'identification (calibre, référence, bouton TEST)

/**
 * opts : {panel, labels:boolean (désignations de part et d'autre), match?(c)→bool (filtre), selected?:Set<id>,
 *         highlight?:Set<position> (positions de départ proposées), onCircuit(id), onPosition(position)}
 */
export function panelReal({panel,labels=false,match=null,selected=null,highlight=null,crop=false,onCircuit,onPosition}){
 const det=panel.details||{};
 const fam=familyOf(det.family);
 const brand=(fam.brand||det.brand||'').trim();
 const rows=Math.ceil(panel.positions/2);
 const isMain=det.mainAmps&&!/cosses|sans principal/i.test(det.modelInfo||'')&&panel.kind!=='Sous-panneau'||/principal/i.test(det.modelInfo||'');
 // Géométrie verticale : le panneau s'allonge selon le nombre de positions.
 const Y0=387,areaBottom=Y0+rows*P,recessBottom=areaBottom+40,trimBottom=recessBottom+13,encBottom=trimBottom+81,total=encBottom+40;
 // Cadrage serré autour du boîtier ; colonnes de désignations de part et d'autre si demandées.
 const left=labels?-115:72,width=labels?830:456;
 const body=det.family&&fam.body?fam.body:'#1b2127';
 const svg=s('svg',{xmlns:NS,viewBox:crop?`${left} ${Y0-18} ${width} ${rows*P+36}`:`${left} 0 ${width} ${total}`,class:'panel-real'+(labels?' with-labels':''),role:'img','aria-label':`Panneau ${brand} ${det.mainAmps?det.mainAmps+' A':''}, ${panel.positions} positions, vue réaliste`});
 svg.append(s('defs',{},
  grad('rpSteel',[0,'#d1dbe0'],[.19,'#a5b1ba'],[.43,'#bfcbd1'],[.72,'#8e9ba5'],[1,'#c1ccd3'],{x2:1,y2:1}),
  grad('rpTrim',[0,'#7b8893'],[.1,'#d4dee3'],[.45,'#a8b6bf'],[.9,'#ebf1f2'],[1,'#8999a2'],{x2:1,y2:.16}),
  grad('rpRecess',[0,'#8a969f'],[.08,'#adb9c0'],[.29,'#b9c5cb'],[.75,'#b4c0c7'],[.93,'#e0e7e9'],[1,'#7c8994'],{x2:1,y2:0}),
  grad('rpBody',[0,shade(body,.14)],[.17,shade(body,-.35)],[.66,shade(body,.06)],[1,shade(body,-.5)],{x2:0,y2:1}),
  grad('rpHandle',[0,'#7d838a'],[.2,'#4b525a'],[.5,'#1d2228'],[.78,'#5a616a'],[1,'#15191e'],{x2:0,y2:1}),
  grad('rpBlank',[0,'#d0dbe0'],[.22,'#b6c3ca'],[.66,'#aab7bf'],[1,'#838f98'],{x2:0,y2:1}),
  grad('rpMain',[0,'#737a81'],[.35,'#2a3036'],[.7,'#15191e'],[1,'#3a4148'],{x2:0,y2:1}),
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
 const brandText=s('text',{x:84,y:8.6,'text-anchor':'middle','font-size':brand.length>12?6.2:8.2,'font-weight':800,fill:fam.accent||'#087ca9'},fit(brand.toUpperCase()||'PANNEAU',18));
 label.append(s('rect',{x:47,y:2,width:75,height:9,fill:'#fff'}),brandText);
 if(brand){
  const img=s('image',{href:`assets/brands/${slug(brand)}.svg`,x:49,y:2.4,width:71,height:8.2,preserveAspectRatio:'xMidYMid meet'});
  img.addEventListener('load',()=>brandText.remove());img.addEventListener('error',()=>img.remove());
  label.append(img);
 }
 svg.append(label);

 // ---------- Disjoncteur principal (manette horizontale) ou cosses ----------
 if(isMain){
  svg.append(s('g',{'aria-label':`Disjoncteur principal ${det.mainAmps} ampères`},
   s('rect',{x:220,y:295,width:160,height:71,rx:2,fill:'#2e353b',stroke:'#525d66','stroke-width':2}),
   s('rect',{x:226,y:301,width:148,height:59,rx:1.5,fill:'url(#rpBody)'}),
   s('text',{x:232,y:310,'font-size':6.5,fill:'#b7c1c9'},'ON / I'),s('text',{x:368,y:310,'text-anchor':'end','font-size':6.5,fill:'#b7c1c9'},'O / OFF'),
   // Logement et manette pleine largeur (deux pôles reliés).
   s('rect',{x:236,y:316,width:128,height:34,rx:3,fill:'#080c10'}),
   s('rect',{x:241,y:319,width:118,height:23,rx:3,fill:'url(#rpMain)',stroke:'#7a8187','stroke-width':1}),
   s('rect',{x:245,y:320,width:110,height:5,rx:2,fill:'#9aa1a6',opacity:.4}),
   s('text',{x:300,y:335.5,'text-anchor':'middle','font-size':10,'font-weight':800,fill:'#eaf4fa','letter-spacing':.5},`${det.mainAmps} A`),
   s('path',{d:'M241 345H359',stroke:'#05080b','stroke-opacity':.6,'stroke-width':1})));
 }else{
  svg.append(s('g',{'aria-label':'Cosses principales, sans disjoncteur principal'},
   s('rect',{x:228,y:300,width:144,height:62,rx:3,fill:'#3a4249',stroke:'#5c6770','stroke-width':1.5}),
   ...[255,345].map(x=>s('g',{},s('rect',{x:x-17,y:312,width:34,height:30,rx:3,fill:'#c9a56a',stroke:'#7d6436'}),s('circle',{cx:x,cy:327,r:7,fill:'#9a7b44',stroke:'#5e4a26'}),s('path',{d:`M${x-4} 327H${x+4}`,stroke:'#3d301a','stroke-width':1.6}))),
   s('text',{x:300,y:356,'text-anchor':'middle','font-size':6.5,'font-weight':700,fill:'#cfd7dc'},'COSSES PRINCIPALES')));
 }

 // ---------- Ouverture des colonnes et barre centrale ----------
 svg.append(
  s('rect',{x:XL-3,y:Y0-4,width:XR+W-XL+6,height:rows*P+8,rx:1,fill:'#172029',stroke:'#566675','stroke-width':2}),
  s('rect',{x:XL+W+3,y:Y0-1,width:XR-XL-W-6,height:rows*P+2,fill:'#070b0f',stroke:'#46535e','stroke-width':1.5}),
  s('path',{d:`M300 ${Y0}V${areaBottom}`,stroke:'#adb9c5','stroke-opacity':.3,'stroke-dasharray':'2 3'}));

 // Numéros de position (impairs à gauche, pairs à droite).
 const nums=s('g',{'font-size':10,'font-weight':750,fill:'#546570','text-anchor':'middle'});
 for(let n=1;n<=panel.positions;n++){const r=Math.floor((n-1)/2);nums.append(s('text',{x:n%2?XL-16:XR+W+16,y:Y0+r*P+P/2+3.5},String(n).padStart(2,'0')));}
 svg.append(nums);

 // ---------- Disjoncteurs et obturateurs ----------
 const slots=s('g',{class:'rp-slots'});
 const tagList=s('g',{class:'rp-labels'});
 const brandShort=fit((fam.brand||det.brand||'').toUpperCase(),11);
 for(const c of panel.circuits){
  const right=slotPos(c.slots[0])%2===0,x=right?XR:XL;
  const o0=slotOrder(c.slots[0]),o1=slotOrder(c.slots[c.slots.length-1]);
  const y=Y0+o0*P/2+1,hgt=(o1-o0+1)*P/2-2;
  const half=c.slots.length===1;
  const poles=new Set(c.slots.map(slotPos)).size;
  const dim=match&&!match(c);
  const desc=`${designation(c)} · ${c.vacant?'Espace inutilisé':c.label||'À identifier'}${c.amps?' · '+c.amps+' A':''}${c.protection&&c.protection!=='Standard'?' · '+c.protection:''}${c.breakerRef?' · '+c.breakerRef:''}`;
  const g=s('g',{class:'rp-slot'+(dim?' dim':'')+(selected?.has(c.id)?' sel':''),'data-id':c.id,transform:`translate(${x} ${y})`,role:'button',tabindex:0,'aria-label':desc},s('title',{},desc));
  const bx=right?W-BW-2:2;            // bloc d'identification, côté extérieur
  const hx=right?6:BW+6,hw=W-BW-14;    // logement de la manette, côté barre centrale
  if(isEmptySlot(c)){
   // Obturateur.
   g.append(s('rect',{x:0,y:0,width:W,height:hgt,fill:'url(#rpBlank)',stroke:'#72818d','stroke-width':.7}),
    s('path',{d:`M2 ${hgt-2}H${W-2}`,stroke:'#647581','stroke-opacity':.7,'stroke-width':.8}),s('path',{d:`M4 3H${W-4}`,stroke:'#edf4f6','stroke-opacity':.5,'stroke-width':.85}));
  }else{
   const test=TEST[c.protection];
   g.append(s('rect',{x:0,y:0,width:W,height:hgt,rx:.8,fill:'url(#rpBody)',stroke:'#5c6670','stroke-width':.6}));
   // Bloc d'identification : calibre, référence (ou marque / nombre de pôles), bouton TEST.
   const amps=c.amps?c.amps+'A':'?';
   const sub=c.breakerRef||(poles>1?`${poles} POLE`:brandShort);
   if(half){
    g.append(s('rect',{x:bx,y:1,width:BW,height:hgt-2,fill:'#242b31',stroke:'#64727a','stroke-width':.5}),
     s('text',{x:bx+2.5,y:hgt/2+2.1,'font-size':5.6,'font-weight':800,fill:'#e8eef0'},amps),
     s('text',{x:bx+BW-2,y:hgt/2+1.6,'text-anchor':'end','font-size':3.5,fill:'#c4ced3'},fit(c.breakerRef||'',11)));
    if(test)g.append(s('rect',{x:bx+15,y:hgt/2-2.6,width:4,height:5.2,rx:1,fill:test.fill,stroke:'#11161a','stroke-width':.35}));
   }else{
    const bh=Math.min(test?20:17,hgt-4);
    g.append(s('rect',{x:bx,y:2,width:BW,height:Math.min(bh,hgt-4),fill:'#242b31',stroke:'#64727a','stroke-width':.5}),
     s('rect',{x:bx+1,y:3,width:BW-2,height:6.6,fill:'#4c5965'}),
     s('text',{x:bx+BW/2,y:8.6,'text-anchor':'middle','font-size':6.4,'font-weight':800,fill:'#e8eef0'},amps),
     s('text',{x:bx+BW/2,y:15.2,'text-anchor':'middle','font-size':c.breakerRef?4.6:5,fill:'#c4ced3'},fit(sub,13)));
    if(poles>1&&c.breakerRef&&hgt>=40)g.append(s('text',{x:bx+BW/2,y:test?29:24,'text-anchor':'middle','font-size':4.6,fill:'#9fabb3'},`${poles} POLE`));
    if(test)g.append(s('rect',{x:bx+2,y:16.6,width:BW-4,height:5,rx:1.3,fill:test.fill,stroke:'#11161a','stroke-width':.45}),
     s('text',{x:bx+BW/2,y:20.2,'text-anchor':'middle','font-size':3.6,'font-weight':800,fill:test.ink},`${test.tag} TEST`));
   }
   // Manettes : une par pôle (ou une pour un demi-disjoncteur), reliées par une barre pour un double ou un triple.
   const off=c.status==='Libre';
   const handles=half?1:poles;
   // Répartition sur la hauteur réelle du disjoncteur (un « quad » au centre n'occupe qu'une position).
   const per=hgt/handles;
   for(let k=0;k<handles;k++){
    const hy=half?1:k*per+2,hh=half?hgt-2:Math.min(H-4,per-3);
    const knob=half?hh-2.4:Math.min(9,hh-2.4),ky=hy+(half||hh<12?1.2:(off?hh-knob-2:2));
    g.append(s('rect',{x:hx,y:hy,width:hw,height:hh,rx:1.2,fill:'#080c10'}),
     s('rect',{x:hx+3,y:ky,width:hw-6,height:knob,rx:1.8,fill:'url(#rpHandle)',stroke:'#858d94','stroke-width':.7}),
     s('path',{d:`M${hx+5} ${ky+1.4}H${hx+hw-5}`,stroke:'#b3bcc3','stroke-opacity':.55,'stroke-width':.7}));
   }
   if(handles>1)g.append(s('rect',{x:hx+hw/2-3,y:Math.min(8,per/2),width:6,height:(handles-1)*per,rx:1.5,fill:'#3b434b',stroke:'#858d94','stroke-width':.6}));
  }
  // Témoin de statut (vert identifié, ambre à confirmer, gris libre), côté barre centrale.
  g.append(s('rect',{x:right?1:W-3,y:2,width:2,height:Math.max(3,hgt-4),fill:c.vacant?'#9aa5ad':STATUS[c.status]||'#9aa5ad',opacity:.94}));
  g.append(s('rect',{class:'rp-sel',x:-2,y:-1.5,width:W+4,height:hgt+3,rx:2,fill:'none',stroke:'#2ad8f6','stroke-width':2}));
  slots.append(g);
  // Désignation à côté du panneau (option).
  if(labels&&(c.label||c.vacant)){
   const txt=c.vacant?'Espace inutilisé':c.label;
   tagList.append(s('text',{x:right?520:80,y:y+hgt/2+4,'text-anchor':right?'start':'end','font-size':half?9:11,'font-weight':c.vacant?400:650,'font-style':c.vacant?'italic':'normal',fill:dim?'#9aa6ae':'#1d3038',class:'rp-label','data-id':c.id},fit(txt,half?30:26)));
  }
 }
 // Positions proposées pour placer un disjoncteur (onglet Planification).
 const targets=s('g',{class:'rp-targets'});
 if(highlight)for(const n of highlight){const r=Math.floor((n-1)/2);targets.append(s('rect',{class:'rp-target','data-pos':n,x:(n%2?XL:XR)+1,y:Y0+r*P+1,width:W-2,height:P-2,rx:3}));}
 svg.append(slots,tagList,targets,
  s('text',{x:300,y:trimBottom+16,'font-size':11,fill:'#64747f','text-anchor':'middle','font-weight':700,'letter-spacing':1},[brand.toUpperCase()||'PANNEAU',isMain?`${det.mainAmps} A`:'SOUS-PANNEAU'].join(' · ')));
 svg.addEventListener('click',e=>{
  const t=e.target.closest('[data-pos]');if(t&&onPosition)return onPosition(Number(t.getAttribute('data-pos')));
  const g=e.target.closest('[data-id]');if(g&&onCircuit)onCircuit(g.getAttribute('data-id'));
 });
 svg.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('.rp-slot')){e.preventDefault();onCircuit?.(e.target.getAttribute('data-id'));}});
 return svg;
}
function grad(id,...args){
 const opts=typeof args.at(-1)==='object'&&!Array.isArray(args.at(-1))?args.pop():{};
 return s('linearGradient',{id,x1:0,y1:0,x2:opts.x2??1,y2:opts.y2??1},...args.map(([o,c])=>s('stop',{offset:o,'stop-color':c})));
}
