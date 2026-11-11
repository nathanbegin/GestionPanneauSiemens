// Icônes SVG cohérentes (trait, grille 24) : remplacent les émojis placés en début de bouton, lien ou titre.
// Le texte reste inchangé dans le code (et dans les dictionnaires de traduction) ; la substitution se fait à l'affichage,
// après la traduction, et ne touche pas aux saisies de l'utilisateur.
const P={
 house:'M3 11l9-8 9 8M5 10v10h14V10M9 20v-6h6v6',user:'M4 21c0-4 4-6 8-6s8 2 8 6M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
 refresh:'M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4',swap:'M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4',
 star:'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
 users:'M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M17 6a3 3 0 1 1 0 6M17.5 14.5c2.8.3 4.5 2 4.5 4.5',
 gear:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
 help:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01',
 bulb:'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
 logout:'M9 4H5v16h4M16 8l4 4-4 4M20 12H9',camera:'M4 8h3l2-3h6l2 3h3v12H4zM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
 file:'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6',grid:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
 list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',zap:'M13 2L4 14h7l-1 8 9-12h-7z',plug:'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5',
 calc:'M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01',download:'M12 3v12M7 10l5 5 5-5M4 21h16',
 offline:'M2 8a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18',trash:'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
 clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',check:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12l3 3 5-6',
 pencil:'M4 20l1-5L16 4l4 4L9 19zM14 6l4 4',printer:'M7 9V3h10v6M6 17H4v-6h16v6h-2M7 14h10v7H7z',
 handshake:'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z',film:'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M16 9h4M4 15h4M16 15h4',
 compass:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM16 8l-2.5 5.5L8 16l2.5-5.5z',checksq:'M4 4h16v16H4zM8 12l3 3 5-6',more:'M5 12h.01M12 12h.01M19 12h.01',
};
const MAP={'🏠':'house','👤':'user','🔄':'refresh','⇄':'swap','⭐':'star','👥':'users','🛠':'gear','⚙':'gear','❓':'help','💡':'bulb','↩':'logout','📷':'camera','📄':'file','▦':'grid','☷':'list','⚡':'zap','🔌':'plug','🧮':'calc','📥':'download','📡':'offline','🗑':'trash','🕘':'clock','✅':'check','✏️':'pencil','✏':'pencil','🖨':'printer','🤝':'handshake','🎬':'film','🧭':'compass','☑':'checksq','⋯':'more'};
const KEYS=Object.keys(MAP).sort((a,b)=>b.length-a.length);
const NS='http://www.w3.org/2000/svg';
export function icon(name,size=18){
 const s=document.createElementNS(NS,'svg');
 s.setAttribute('viewBox','0 0 24 24');s.setAttribute('width',size);s.setAttribute('height',size);s.setAttribute('aria-hidden','true');s.setAttribute('class','ic');
 s.setAttribute('fill','none');s.setAttribute('stroke','currentColor');s.setAttribute('stroke-width','1.9');s.setAttribute('stroke-linecap','round');s.setAttribute('stroke-linejoin','round');
 const p=document.createElementNS(NS,'path');p.setAttribute('d',P[name]);s.append(p);return s;
}
const SEL='button,a,summary,legend,.stage-chip,.tabs button,.menu a,.menu button';
// Remplace l'émoji initial du premier nœud texte d'un élément (boutons, liens, titres de section).
export function enhanceIcons(root=document.body){
 for(const el of root.querySelectorAll(SEL)){
  if(el.dataset.noIcon!==undefined||el.closest('[data-i18n-skip]')&&!el.closest('.menu,.tabs'))continue;
  const t=[...el.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());
  if(!t)continue;
  const txt=t.textContent.replace(/^\s+/,'');
  const k=KEYS.find(x=>txt.startsWith(x));
  if(!k)continue;
  const rest=txt.slice(k.length).replace(/^[️\s]+/,'');
  t.textContent=rest?' '+rest:'';
  el.insertBefore(icon(MAP[k],k==='⋯'?20:18),t);
  el.classList.add('has-ic');
 }
}
let timer=0;
export function watchIcons(){
 if(typeof MutationObserver!=='function')return;
 const run=()=>{timer=0;try{enhanceIcons(document.body);}catch{}};
 // Après la traduction : l'observateur de langue s'exécute avant ce délai.
 new MutationObserver(()=>{if(!timer)timer=setTimeout(run,40);}).observe(document.body,{childList:true,subtree:true});
 setTimeout(run,60);
}
