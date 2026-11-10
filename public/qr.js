// Code QR : matrice et SVG. Partagé navigateur / serveur (PDF). Encodeur : qrcode-generator (MIT), voir vendor/qrcode.mjs.
import qrcode from './vendor/qrcode.mjs';

/** Matrice de modules (true = sombre). ecl : 'L' | 'M' | 'Q' | 'H'. */
export function qrMatrix(text,{ecl='M'}={}){
 const q=qrcode(0,ecl);q.addData(String(text),'Byte');q.make();
 const n=q.getModuleCount();
 return Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>q.isDark(r,c)));
}
/** SVG autonome (fond blanc, marge de 4 modules). */
export function qrSvg(text,{ecl='M',margin=4}={}){
 const m=qrMatrix(text,{ecl}),n=m.length,size=n+margin*2;
 let d='';
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(m[r][c])d+=`M${c+margin} ${r+margin}h1v1h-1z`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Code QR"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
/** Lien du code QR d'un panneau : ouvre le panneau dans l'application (connexion requise). */
export const panelLink=(origin,id)=>String(origin).replace(/\/$/,'')+'/app#/panneaux/'+id;
/** Forfaits qui incluent les codes QR : option « qr » (Gestionnaire), planification (Électricien) et administrateurs. */
export const qrAllowed=(features={},isAdmin=false)=>!!(isAdmin||features?.qr||features?.planning);
