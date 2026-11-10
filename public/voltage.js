// Tensions du réseau : unipolaire (120 V) et bipolaire (240 V par défaut, 208 V en option). Sans DOM.
export const UNIPOLAR_VOLTS=120;
export const BIPOLAR_CHOICES=[240,208];
export const DEFAULT_VOLTS={uni:UNIPOLAR_VOLTS,bi:240};
/** Réseau d'un panneau d'après sa fiche (champ « Tension »). 120/208 V triphasé → bipolaire 208 V ; 347/600 V → 347 / 600 V. */
export function voltsOf(details={}){
 const v=String(details?.voltage||'');
 if(/208/.test(v))return {uni:120,bi:208};
 if(/347|600/.test(v))return {uni:347,bi:600};
 return {...DEFAULT_VOLTS};
}
/** Libellé du réseau (champ « Tension » d'un panneau) pour une tension bipolaire choisie. */
export const voltageLabel=bi=>Number(bi)===208?'120/208 V triphasé':'120/240 V monophasé';
/** Préférence de l'utilisateur (profil du compte) : bipolaire 240 V par défaut. */
export const prefBipolar=profile=>Number(profile?.bipolarVolts)===208?208:240;
export const prefVolts=profile=>({uni:UNIPOLAR_VOLTS,bi:prefBipolar(profile)});
// Préférence courante dans le navigateur (mise à jour à la connexion et à l'enregistrement des paramètres).
let current=DEFAULT_VOLTS;
export const setUserVolts=profile=>{current=prefVolts(profile);};
export const userVolts=()=>current;
