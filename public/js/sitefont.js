// Police du site : réglée par l'administrateur (Administration → Site), appliquée sur toutes les pages.
const KEY='mp_font',OK=['manrope','inter','system'];
export function applyFont(f){
 if(!OK.includes(f))return;
 document.documentElement.dataset.font=f;
 try{localStorage.setItem(KEY,f);}catch{}
}
try{const f=localStorage.getItem(KEY);if(OK.includes(f))document.documentElement.dataset.font=f;}catch{}
