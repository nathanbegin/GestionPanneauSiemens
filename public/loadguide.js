// Explications en langage clair du calcul de charge d'une maison (logement unifamilial).
// Référence : Code canadien de l'électricité, Première partie (CSA C22.1), règles 8-104, 8-106, 8-110 et 8-200,
// tel qu'adopté au Québec dans le Code de construction, chapitre V — Électricité (avec modifications du Québec).
// ⚠ Vulgarisation : la version officielle du Code et un maître électricien font foi.

export const GUIDE_INTRO={
 what:'Le calcul de charge estime la puissance maximale qu’une maison peut demander en même temps, pour choisir la bonne grosseur d’entrée électrique (100 A, 200 A…) et du disjoncteur principal.',
 why:'On n’additionne pas simplement tous les appareils : ils ne fonctionnent jamais tous au maximum en même temps. Le Code donne des règles (« facteurs de demande ») pour compter chaque type d’appareil de façon réaliste mais sécuritaire.',
 scope:'Ce calcul vise une maison unifamiliale (règle 8-200). Les immeubles à logements (8-202), les commerces et les bâtiments industriels suivent d’autres règles.',
};

// Explication par étape (même identifiant que les étapes de dwellingCalc).
export const GUIDE_STEPS={
 area:{title:'1. Mesurer la superficie habitable',rule:'8-110',
  plain:'On mesure la maison par l’extérieur des murs. Le rez-de-chaussée et les étages comptent à 100 %. Le sous-sol compte à 75 % (seulement les parties de plus de 1,8 m de hauteur).',
  includes:['Rez-de-chaussée et étages, mesurés par l’extérieur','Sous-sol à 75 % (hauteur de plus de 1,8 m)'],
  excludes:['Garage, abri d’auto, galerie, terrasse','Vide sanitaire et parties du sous-sol de 1,8 m ou moins'],
  tip:'100 m² hors sol + sous-sol de 80 m² → 100 + 0,75 × 80 = 160 m².'},
 basic:{title:'2. Calculer la charge de base',rule:'8-200 1) a) i) et ii)',
  plain:'Une seule valeur couvre tout l’usage « normal » de la maison : 5000 W pour les 90 premiers m², puis 1000 W par tranche de 90 m² (ou partie de tranche) en plus.',
  includes:['Tout l’éclairage','Toutes les prises (salon, chambres, comptoirs…)','Les petits appareils et tout appareil de 1500 W ou moins : réfrigérateur, lave-vaisselle, micro-ondes, laveuse, échangeur d’air, pompe de puisard…'],
  excludes:['On ne compte pas le nombre de prises ou de luminaires','On n’additionne pas les appareils de 1500 W ou moins : ils sont déjà dans la charge de base'],
  tip:'160 m² → 90 m² (5000 W) + 70 m² restants = 1 tranche entamée (1000 W) → 6000 W.'},
 heat:{title:'3. Ajouter le chauffage OU la climatisation (le plus élevé)',rule:'8-200 1) a) iii), 8-106 3) et section 62',
  plain:'Chauffage électrique par plinthes ou convecteurs : 100 % des 10 premiers kW, puis 75 % du reste. Fournaise électrique ou accumulateur thermique : 100 %. Climatisation : 100 %. Comme on ne chauffe pas et ne climatise pas en même temps, on garde seulement le plus élevé des deux.',
  includes:['Plinthes, convecteurs, aérothermes, planchers chauffants électriques','Fournaise électrique, éléments d’appoint, accumulateur','Climatiseurs et thermopompes'],
  excludes:['Le moins élevé entre chauffage et climatisation (non simultanés)','Une thermopompe qui chauffe et climatise ne se compte pas deux fois'],
  tip:'14 kW de plinthes → 10 kW + 75 % de 4 kW = 13 kW. Climatisation 4,2 kW → on garde 13 kW.'},
 range:{title:'4. Ajouter la cuisinière',rule:'8-200 1) a) iv)',
  plain:'Une cuisinière de 12 kW ou moins compte pour 6000 W. Au-delà de 12 kW, on ajoute 40 % de ce qui dépasse 12 kW.',
  includes:['Cuisinière électrique','Table de cuisson et four encastré : on les additionne comme une seule cuisinière'],
  excludes:['Cuisinière au gaz (sauf son allumage, déjà dans la charge de base)'],
  tip:'Cuisinière de 14 kW → 6000 W + 40 % × 2000 W = 6800 W.'},
 water100:{title:'5. Ajouter à 100 % les gros appareils d’eau chaude',rule:'8-200 1) a) v)',
  plain:'Ces appareils fonctionnent longtemps à pleine puissance : on les compte au complet.',
  includes:['Chauffe-eau instantané (sans réservoir)','Chauffe-piscine et thermopompe de piscine','Spa et bain tourbillon chauffé','Bain de vapeur'],
  excludes:['Le chauffe-eau à réservoir ordinaire : il va dans « autres appareils » (étape 7)'],
  tip:'Thermopompe de piscine 5 kW → 5000 W.'},
 ev:{title:'6. Ajouter les bornes de recharge à 100 %',rule:'8-200 1) a) vi), 8-106 11) et section 86',
  plain:'Une borne de recharge peut tirer sa pleine puissance pendant des heures : elle compte à 100 %. Exception : si un système de gestion de l’énergie (EVEMS) limite automatiquement la borne quand la maison consomme beaucoup, on peut compter la valeur limitée.',
  includes:['Bornes de niveau 1 et 2'],
  excludes:['La part réduite par un système de gestion de l’énergie conforme (EVEMS)'],
  tip:'Borne de 30 A (7,2 kW) → 7200 W. C’est souvent ce qui fait passer une maison de 100 A à 200 A.'},
 other:{title:'7. Ajouter les autres appareils de plus de 1500 W',rule:'8-200 1) a) vii)',
  plain:'Tous les autres appareils de plus de 1500 W (sécheuse, chauffe-eau à réservoir, four encastré séparé, atelier…). S’il y a une cuisinière électrique, on en compte 25 %. Sans cuisinière : 100 % des 6 premiers kW, puis 25 % du reste.',
  includes:['Sécheuse','Chauffe-eau à réservoir','Pompe de piscine, atelier, autres appareils fixes de plus de 1500 W'],
  excludes:['Appareils de 1500 W ou moins (déjà dans la charge de base)'],
  tip:'Sécheuse 5,6 kW + chauffe-eau 4,5 kW = 10,1 kW → 25 % = 2525 W (avec cuisinière).'},
 total:{title:'8. Additionner et convertir en ampères',rule:'8-200 1) et 1) b)',
  plain:'On additionne les étapes 2 à 7, puis on divise par 240 V pour obtenir des ampères. L’entrée doit être au moins égale à ce résultat, et jamais moins que le minimum du Code : 100 A pour une maison de 80 m² ou plus, 60 A sinon.',
  includes:['Toutes les charges de la maison, y compris celles des sous-panneaux'],
  excludes:[],
  tip:'34 725 W ÷ 240 V = 145 A → entrée de 150 A minimum (ou 200 A pour garder de la marge).'},
};

// Règles importantes hors du calcul de l'entrée.
export const GUIDE_RULES=[
 {title:'La règle des 80 % pour chaque circuit',rule:'8-104',plain:'Une charge « continue » (qui fonctionne 3 heures ou plus : chauffage, borne, chauffe-eau) ne doit pas dépasser 80 % du calibre de son disjoncteur. Autrement dit, le disjoncteur doit valoir au moins 125 % de la charge. Exemple : borne de 32 A → disjoncteur de 40 A.'},
 {title:'Le fil doit supporter le disjoncteur',rule:'Tableau 2 et 4-004',plain:'Le calibre du fil se choisit selon le disjoncteur, jamais l’inverse : 14 AWG pour 15 A, 12 AWG pour 20 A, 10 AWG pour 30 A, 8 AWG pour 40 A (cuivre, cas résidentiels courants).'},
 {title:'Garder une marge',rule:'Bonne pratique',plain:'Un panneau chargé à plus de 80 % de son principal laisse peu de place pour une borne, une thermopompe ou un spa futurs. Prévoyez vos projets dans le calcul.'},
 {title:'Les données à utiliser',rule:'Plaques signalétiques',plain:'Utilisez la puissance inscrite sur la plaque de chaque appareil (en W ou VA). Si seule l’intensité est indiquée : puissance ≈ ampères × tension. Pour les thermopompes, utilisez le MCA (fil) et le MOP (disjoncteur maximal).'},
 {title:'Changer l’entrée électrique',rule:'Hydro-Québec',plain:'Une augmentation de l’entrée (ex. 100 A → 200 A) se coordonne avec Hydro-Québec et doit être faite par un maître électricien, avec déclaration de travaux.'},
];
export const GUIDE_DISCLAIMER='Vulgarisation fournie à titre informatif, basée sur le Code canadien de l’électricité (CSA C22.1) tel qu’adopté au Québec (Code de construction, chapitre V — Électricité). Les numéros de règles peuvent varier selon l’édition en vigueur. Seul le texte officiel du Code fait foi, et le calcul doit être validé par un maître électricien membre de la CMEQ.';
export const GUIDE_REFS=[
 'Code canadien de l’électricité, Première partie, CSA C22.1 — section 8 (règles 8-104, 8-106, 8-110, 8-200), section 62 (chauffage), section 86 (recharge de véhicules)',
 'Code de construction du Québec, chapitre V — Électricité (Régie du bâtiment du Québec)',
 'Feuilles de calcul de charge résidentielle publiées par des autorités canadiennes (Ville de Winnipeg, Ville de Burnaby)',
 'IAEI Magazine — Residential Load Calculations',
];
