// Génération des PDF : rapport complet, aide-mémoire de porte et étiquettes (feuille Avery 5160).
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {sortCircuits,designation,slotOrder,slotPos,stats,siteAddress,panelTitle,tagGroups,formatOf,breakerFormats} from '../../public/model.js';

const SIZES={letter:[612,792],legal:[612,1008]};
const C={ink:rgb(.094,.235,.196),green:rgb(.133,.416,.318),muted:rgb(.42,.47,.44),line:rgb(.80,.84,.80),soft:rgb(.93,.95,.92),white:rgb(1,1,1),amber:rgb(.70,.52,.22),free:rgb(.62,.66,.62),lime:rgb(.89,.97,.66)};
const M=40;

class Doc{
 static async create(format='letter',title='Mon Panneau'){
  const d=new Doc();d.pdf=await PDFDocument.create();d.size=SIZES[format]||SIZES.letter;
  d.font=await d.pdf.embedFont(StandardFonts.Helvetica);d.bold=await d.pdf.embedFont(StandardFonts.HelveticaBold);
  d.pdf.setTitle(title);d.pdf.setCreator('Mon Panneau');d.pdf.setProducer('Mon Panneau');d.pdf.setLanguage('fr-CA');
  d.cache=new Map();return d;
 }
 // Remplace les caractères absents de l'encodage WinAnsi des polices standard.
 safe(text){
  let out='';
  for(const ch of String(text??'').replace(/[\t\r]/g,' ')){
   if(ch==='\n'){out+=ch;continue;}
   if(!this.cache.has(ch)){let ok=true;try{this.font.encodeText(ch);}catch{ok=false;}this.cache.set(ch,ok);}
   out+=this.cache.get(ch)?ch:'?';
  }
  return out;
 }
 width(t,size,f=this.font){return f.widthOfTextAtSize(this.safe(t),size);}
 fit(t,size,max,f=this.font){
  t=this.safe(t).replace(/\n/g,' ');
  if(f.widthOfTextAtSize(t,size)<=max)return t;
  while(t.length&&f.widthOfTextAtSize(t+'…',size)>max)t=t.slice(0,-1);
  return t.trimEnd()+'…';
 }
 wrap(t,size,max,f=this.font){
  const lines=[];
  for(const para of this.safe(t).split('\n')){
   let line='';
   for(const word of para.split(/\s+/).filter(Boolean)){
    const test=line?line+' '+word:word;
    if(f.widthOfTextAtSize(test,size)<=max){line=test;continue;}
    if(line)lines.push(line);
    line=f.widthOfTextAtSize(word,size)>max?this.fit(word,size,max,f):word;
   }
   lines.push(line);
  }
  return lines;
 }
 page(){this.p=this.pdf.addPage(this.size);this.y=this.size[1]-M;return this.p;}
 text(t,x,y,{size=10,f=this.font,color=C.ink,max}={}){this.p.drawText(max?this.fit(t,size,max,f):this.safe(t),{x,y,size,font:f,color});}
 rect(x,y,w,h,opts){this.p.drawRectangle({x,y,width:w,height:h,...opts});}
 line(x1,y1,x2,y2,color=C.line,t=.6){this.p.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},color,thickness:t});}
 get W(){return this.size[0];}
 get H(){return this.size[1];}
 ensure(h,onBreak){if(this.y-h<M+28){this.page();onBreak?.();return true;}return false;}
}

const fmtDate=d=>new Intl.DateTimeFormat('fr-CA',{dateStyle:'long'}).format(d);
const fmtDateTime=d=>new Intl.DateTimeFormat('fr-CA',{dateStyle:'long',timeStyle:'short',timeZone:'America/Toronto'}).format(d);
const surveyDate=v=>v?fmtDate(new Date(v+'T12:00:00')):'';
function preparedBy(user){
 const p=user.profile||{};
 if(p.accountType==='pro'&&p.company)return {title:p.company,lines:[p.licence&&'Licence RBQ : '+p.licence,'Responsable : '+user.name,[p.phone,p.proEmail].filter(Boolean).join(' · '),p.address].filter(Boolean),pro:true};
 return {title:user.name,lines:[user.email],pro:false};
}

function footers(d,label){
 const pages=d.pdf.getPages();
 pages.forEach((p,i)=>{
  p.drawLine({start:{x:M,y:M+8},end:{x:d.W-M,y:M+8},color:C.line,thickness:.6});
  p.drawText(d.fit(label,7,d.W-2*M-80),{x:M,y:M-4,size:7,font:d.font,color:C.muted});
  const n=`Page ${i+1} / ${pages.length}`;
  p.drawText(n,{x:d.W-M-d.width(n,7),y:M-4,size:7,font:d.font,color:C.muted});
 });
}

function header(d,{overline,title,subtitle,right}){
 const h=78;
 d.rect(0,d.H-h,d.W,h,{color:C.ink});
 d.rect(M,d.H-h+16,4,h-32,{color:C.lime});
 d.text(overline,M+14,d.H-28,{size:8,f:d.bold,color:C.lime,max:d.W-2*M-180});
 d.text(title,M+14,d.H-48,{size:18,f:d.bold,color:C.white,max:d.W-2*M-170});
 if(subtitle)d.text(subtitle,M+14,d.H-64,{size:9,color:rgb(.8,.87,.83),max:d.W-2*M-170});
 right.forEach((r,i)=>{const s=d.safe(r);d.text(s,d.W-M-d.width(s,8),d.H-30-i*12,{size:8,color:rgb(.8,.87,.83)});});
 d.y=d.H-h-20;
}

// Bloc d'informations à deux colonnes (libellé / valeur).
function infoGrid(d,rows){
 const colW=(d.W-2*M-16)/2;const half=Math.ceil(rows.length/2);
 const startY=d.y;let maxDrop=0;
 [rows.slice(0,half),rows.slice(half)].forEach((col,ci)=>{
  let y=startY;const x=M+ci*(colW+16);
  for(const [k,v] of col){
   d.text(k.toUpperCase(),x,y,{size:6.5,f:d.bold,color:C.muted});
   const lines=d.wrap(v||'—',9,colW).slice(0,2);
   lines.forEach((l,i)=>d.text(l,x,y-11-i*11,{size:9}));
   y-=14+lines.length*11;
  }
  maxDrop=Math.max(maxDrop,startY-y);
 });
 d.y=startY-maxDrop-4;
}

function preparedBlock(d,user,generatedAt){
 const pb=preparedBy(user);
 const lines=pb.lines.slice(0,3);const h=36+lines.length*10;
 d.ensure(h+10);
 d.rect(M,d.y-h,d.W-2*M,h,{color:C.soft,borderColor:C.line,borderWidth:.6});
 d.text(pb.pro?'PRÉPARÉ PAR L’ENTREPRENEUR':'PRÉPARÉ PAR',M+12,d.y-14,{size:6.5,f:d.bold,color:C.muted});
 d.text(pb.title,M+12,d.y-26,{size:10,f:d.bold,max:300});
 lines.forEach((l,i)=>d.text(l,M+12,d.y-38-i*10,{size:8,color:C.muted,max:320}));
 const g='Document généré le '+fmtDateTime(generatedAt);
 d.text(g,d.W-M-12-d.width(g,7.5),d.y-14,{size:7.5,color:C.muted});
 d.y-=h+14;
}

function sectionTitle(d,t,sub){
 d.ensure(40);
 d.text(t,M,d.y-12,{size:12.5,f:d.bold});
 if(sub)d.text(sub,M,d.y-25,{size:8,color:C.muted,max:d.W-2*M});
 d.y-=sub?36:22;
}

const statusColor=c=>c.status==='Identifié'?C.green:c.status==='Libre'?C.free:C.amber;

// Répertoire en deux colonnes (impairs à gauche, pairs à droite), comme sur la porte du panneau.
function directory(d,panel,{rowH=18,compact=false}={}){
 const circuits=sortCircuits(panel.circuits);
 const rows=Math.ceil(panel.positions/2);
 const gap=10,colW=(d.W-2*M-gap)/2;
 // Découpe en blocs de lignes si le répertoire dépasse la page.
 let row=0;
 while(row<rows){
  const avail=Math.floor((d.y-(M+30)-16)/rowH);
  if(avail<3){d.page();continue;}
  const end=Math.min(rows,row+avail),top=d.y-16;
  d.text('IMPAIRS',M,d.y-8,{size:6.5,f:d.bold,color:C.muted});
  d.text('PAIRS',M+colW+gap,d.y-8,{size:6.5,f:d.bold,color:C.muted});
  for(const c of circuits){
   const first=slotOrder(c.slots[0]),last=slotOrder(c.slots.at(-1));
   const startRow=first/2,endRow=(last+1)/2;
   if(endRow<=row||startRow>=end)continue;
   const a=Math.max(startRow,row),b=Math.min(endRow,end);
   const side=slotPos(c.slots[0])%2===0?1:0,x=M+side*(colW+gap);
   const y=top-(b-row)*rowH,h=(b-a)*rowH;
   d.rect(x,y+.8,colW,h-1.6,{color:c.status==='Libre'?C.soft:C.white,borderColor:C.line,borderWidth:.6});
   d.rect(x,y+.8,3,h-1.6,{color:statusColor(c)});
   const small=h<rowH*.9,fs=small?6.5:compact?7.8:8.6;
   const pos=designation(c);
   const posW=Math.max(30,d.width(pos,fs,d.bold)+8);
   d.text(pos,x+7,y+h/2-fs/2.8,{size:fs,f:d.bold,color:C.green,max:posW});
   const amps=c.amps?c.amps+' A':'— A';
   d.text(amps,x+colW-6-d.width(amps,fs,d.bold),y+h/2-fs/2.8,{size:fs,f:d.bold});
   const labelW=colW-posW-d.width(amps,fs,d.bold)-22;
   const label=c.status==='Libre'?'LIBRE':c.label||'À identifier';
   const room=c.room&&c.status!=='Libre'?c.room:'';
   if(h>=rowH*1.8&&room){
    d.text(label,x+7+posW,y+h/2+1.5,{size:fs,f:c.label?d.font:d.font,color:c.label?C.ink:C.muted,max:labelW});
    d.text(room,x+7+posW,y+h/2-fs,{size:fs-1.5,color:C.muted,max:labelW});
   }else d.text(room&&!small?`${label} — ${room}`:label,x+7+posW,y+h/2-fs/2.8,{size:fs,color:c.label||c.status==='Libre'?C.ink:C.muted,max:labelW});
  }
  d.y=top-(end-row)*rowH-10;
  row=end;
  if(row<rows)d.page();
 }
}

function legend(d){
 d.ensure(16);
 let x=M;
 for(const [t,col] of [['Identifié',C.green],['À confirmer',C.amber],['Libre',C.free]]){d.rect(x,d.y-7,6,6,{color:col});d.text(t,x+10,d.y-7,{size:7,color:C.muted});x+=70;}
 d.y-=16;
}

function detailTable(d,panel){
 const cols=[['Pos.',50],['Désignation',142],['Pièce / zone',92],['Type',78],['Calibre',42],['Protection',64],['Statut',64]];
 const head=()=>{d.rect(M,d.y-16,d.W-2*M,16,{color:C.ink});let x=M+5;for(const [t,w] of cols){d.text(t.toUpperCase(),x,d.y-11,{size:6.5,f:d.bold,color:C.white});x+=w;}d.y-=18;};
 head();
 let zebra=false;
 for(const c of sortCircuits(panel.circuits)){
  const extra=[c.exceptions&&'Exceptions : '+c.exceptions,c.notes&&'Notes : '+c.notes,...tagGroups.map(k=>(c.tags?.[k]||[]).length?({locations:'Emplacements',functions:'Fonctions',devices:'Appareils'}[k]+' : '+c.tags[k].join(', ')):'').filter(Boolean),formatOf(c)!=='single'?'Format : '+breakerFormats[formatOf(c)]:''].filter(Boolean);
  const extraLines=extra.flatMap(e=>d.wrap(e,7,d.W-2*M-54)).slice(0,8);
  const h=15+extraLines.length*9;
  if(d.ensure(h+2,head))zebra=false;
  if(zebra)d.rect(M,d.y-h,d.W-2*M,h,{color:C.soft});
  zebra=!zebra;
  const vals=[designation(c),c.status==='Libre'?'Libre':c.label||'À identifier',c.room,c.usage,c.amps?c.amps+' A':'—',c.protection||'—',c.status];
  let x=M+5;
  vals.forEach((v,i)=>{d.text(v||'—',x,d.y-10,{size:7.8,f:i<2?d.bold:d.font,color:i===6?statusColor(c):C.ink,max:cols[i][1]-6});x+=cols[i][1];});
  extraLines.forEach((l,i)=>d.text(l,M+49,d.y-20-i*9,{size:7,color:C.muted}));
  d.y-=h;
  d.line(M,d.y,d.W-M,d.y);
 }
 d.y-=10;
}

function signature(d,user){
 const pb=preparedBy(user);
 d.ensure(70);
 d.y-=14;
 d.text('Attestation',M,d.y,{size:10,f:d.bold});
 const msg=pb.pro?'Je confirme que ce répertoire reflète l’identification des circuits réalisée à la date du relevé.':'Répertoire établi par le propriétaire. Faire valider par un maître électricien au besoin.';
 d.text(msg,M,d.y-13,{size:8,color:C.muted,max:d.W-2*M});
 const y=d.y-48;
 d.line(M,y,M+230,y,C.ink,.8);d.line(M+290,y,M+430,y,C.ink,.8);
 d.text('Signature',M,y-10,{size:7,color:C.muted});d.text('Date',M+290,y-10,{size:7,color:C.muted});
 d.y=y-24;
}

function panelInfoRows(panel,site,fedFromLabel){
 const det=panel.details||{};
 const s=stats(panel.circuits);
 return [
  ['Site',site.name+(site.client?' — '+site.client:'')],['Adresse',siteAddress(site)],
  ['Bâtiment',det.building],['Emplacement du panneau',panel.location],
  ['Type de panneau',panel.kind],['Alimenté par',fedFromLabel?(fedFromLabel+(det.fedFromCircuit?' — circuit '+det.fedFromCircuit:'')):'Réseau / entrée électrique'],
  ['Marque et modèle',[det.brand,det.model].filter(Boolean).join(' ')],['Principal et tension',[det.mainAmps?det.mainAmps+' A':'',det.voltage].filter(Boolean).join(' · ')],
  ['Positions',`${panel.positions} positions · ${s.total} circuits/groupes`],['Avancement',`${s.identified} identifié(s) · ${s.free} libre(s) · ${s.toConfirm} à confirmer (${s.progress} %)`],
  ['Relevé effectué',[surveyDate(det.surveyDate),det.surveyedBy&&'par '+det.surveyedBy].filter(Boolean).join(' ')],
 ];
}

function panelPages(d,{panel,site,fedFromLabel,user,kind,generatedAt,version}){
 d.page();
 header(d,{overline:kind==='door'?'AIDE-MÉMOIRE DU PANNEAU ÉLECTRIQUE':'RAPPORT DE PANNEAU ÉLECTRIQUE',title:panelTitle(panel),subtitle:[panel.location,site.name].filter(Boolean).join(' · '),right:[fmtDate(generatedAt),'Mon Panneau v'+version]});
 if(kind==='door'){
  const det=panel.details||{};
  const info=[siteAddress(site),[det.brand,det.model].filter(Boolean).join(' '),det.mainAmps&&'Principal '+det.mainAmps+' A',det.voltage,fedFromLabel&&'Alimenté par '+fedFromLabel+(det.fedFromCircuit?' (circuit '+det.fedFromCircuit+')':'')].filter(Boolean).join('  ·  ');
  d.wrap(info,8.5,d.W-2*M).slice(0,2).forEach((l,i)=>d.text(l,M,d.y-i*11,{size:8.5,color:C.muted}));
  d.y-=30;
  const pb=preparedBy(user);
  const rows=Math.ceil(panel.positions/2),footer=58;
  const rowH=Math.max(10,Math.min(24,(d.y-M-footer-26)/rows));
  directory(d,panel,{rowH,compact:rowH<16});
  legend(d);
  // Coordonnées de la personne ou de l'entreprise qui a préparé l'aide-mémoire.
  const y=Math.max(M+20,d.y-6);
  d.line(M,y+4,d.W-M,y+4);
  d.text((pb.pro?'Préparé par ':'Établi par ')+pb.title,M,y-8,{size:8,f:d.bold,max:300});
  d.text(pb.lines.join(' · '),M,y-19,{size:7,color:C.muted,max:d.W-2*M});
  return;
 }
 infoGrid(d,panelInfoRows(panel,site,fedFromLabel));
 preparedBlock(d,user,generatedAt);
 sectionTitle(d,'Répertoire des circuits','Vue de face : positions impaires à gauche, paires à droite.');
 directory(d,panel,{rowH:panel.positions>60?14:18});
 legend(d);
 if(panel.details?.notes){sectionTitle(d,'Notes sur le panneau');d.wrap(panel.details.notes,8.5,d.W-2*M).forEach(l=>{d.ensure(12);d.text(l,M,d.y,{size:8.5});d.y-=11;});d.y-=8;}
 d.page();
 sectionTitle(d,'Détail des circuits — '+panelTitle(panel),'Désignation, pièce desservie, calibre, protection, notes et exceptions.');
 detailTable(d,panel);
 signature(d,user);
}

export async function buildReport({kind='report',format='letter',user,site,panels,generatedAt=new Date(),version}){
 const d=await Doc.create(format,(kind==='door'?'Aide-mémoire — ':'Rapport — ')+(panels.length===1?panelTitle(panels[0].panel):site.name));
 if(panels.length>1&&kind==='report'){
  d.page();
  header(d,{overline:'RAPPORT DES PANNEAUX ÉLECTRIQUES',title:site.name,subtitle:siteAddress(site),right:[fmtDate(generatedAt),'Mon Panneau v'+version]});
  infoGrid(d,[['Site',site.name],['Client',site.client],['Adresse',siteAddress(site)],['Panneaux',String(panels.length)]]);
  preparedBlock(d,user,generatedAt);
  sectionTitle(d,'Panneaux du site','Hiérarchie d’alimentation et avancement de l’identification.');
  const head=()=>{d.rect(M,d.y-16,d.W-2*M,16,{color:C.ink});[['Panneau',M+5],['Type',M+200],['Emplacement',M+290],['Alimenté par',M+420]].forEach(([t,x])=>d.text(t.toUpperCase(),x,d.y-11,{size:6.5,f:d.bold,color:C.white}));d.y-=18;};
  head();
  for(const {panel,fedFromLabel} of panels){
   d.ensure(20,head);const s=stats(panel.circuits);
   d.text(panelTitle(panel),M+5,d.y-10,{size:8.5,f:d.bold,max:190});
   d.text(`${s.progress} % identifié`,M+5,d.y-19,{size:6.5,color:C.muted});
   d.text(panel.kind,M+200,d.y-10,{size:8,max:85});
   d.text(panel.location||'—',M+290,d.y-10,{size:8,max:125});
   d.text(fedFromLabel||'Entrée électrique',M+420,d.y-10,{size:8,max:d.W-M-(M+420)});
   d.y-=24;d.line(M,d.y+2,d.W-M,d.y+2);
  }
  if(site.notes){d.y-=10;sectionTitle(d,'Notes sur le site');d.wrap(site.notes,8.5,d.W-2*M).forEach(l=>{d.ensure(12);d.text(l,M,d.y,{size:8.5});d.y-=11;});}
 }
 for(const p of panels)panelPages(d,{...p,site,user,kind,generatedAt,version});
 footers(d,'Mon Panneau · Répertoire indicatif établi à partir d’un relevé visuel — ne remplace pas une inspection par un maître électricien.');
 return d.pdf.save();
}

// Étiquettes autocollantes : gabarit Avery 5160 / 8160 (30 par feuille Lettre, 2⅝ × 1 po).
export async function buildLabels({site,panel,fedFromLabel,skipFree=false}){
 const d=await Doc.create('letter','Étiquettes — '+panelTitle(panel));
 const W=189,H=72,left=13.5,top=36,pitchX=198;
 const items=[{type:'panel'},...sortCircuits(panel.circuits).filter(c=>!(skipFree&&c.status==='Libre')).map(c=>({type:'circuit',c}))];
 items.forEach((it,i)=>{
  const k=i%30;if(k===0)d.page();
  const col=k%3,row=Math.floor(k/3),x=left+col*pitchX,y=d.H-top-(row+1)*H;
  d.rect(x+2,y+2,W-4,H-4,{borderColor:rgb(.88,.9,.88),borderWidth:.4});
  if(it.type==='panel'){
   const det=panel.details||{};
   d.rect(x+8,y+10,W-16,H-20,{color:C.ink});
   d.text('PANNEAU '+(panel.kind||'').toUpperCase(),x+14,y+H-22,{size:6,f:d.bold,color:C.lime,max:W-28});
   d.text(panel.tag||panel.name,x+14,y+H-38,{size:15,f:d.bold,color:C.white,max:W-28});
   d.text(panel.tag?panel.name:panel.location,x+14,y+H-48,{size:7,color:C.white,max:W-28});
   d.text([det.mainAmps&&det.mainAmps+' A',fedFromLabel&&'Alim. : '+fedFromLabel+(det.fedFromCircuit?' #'+det.fedFromCircuit:'')].filter(Boolean).join(' · ')||site.name,x+14,y+16,{size:6.5,color:rgb(.8,.87,.83),max:W-28});
   return;
  }
  const c=it.c,pos=designation(c);
  let posSize=16;while(posSize>7&&d.width(pos,posSize,d.bold)>46)posSize--;
  d.text(pos,x+10,y+H/2-posSize/3,{size:posSize,f:d.bold,color:C.green});
  const tx=x+62,tw=W-72;
  const label=c.status==='Libre'?'LIBRE':c.label||'________________';
  const lines=d.wrap(label,9,tw,d.bold).slice(0,2);
  lines.forEach((l,j)=>d.text(l,tx,y+H-22-j*11,{size:9,f:d.bold}));
  const meta=[c.amps&&c.amps+' A',c.room,c.protection&&c.protection!=='Standard'?c.protection:''].filter(Boolean).join(' · ');
  if(meta)d.text(meta,tx,y+14,{size:7,color:C.muted,max:tw});
 });
 return d.pdf.save();
}
