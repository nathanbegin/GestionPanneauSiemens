// Catalogue partagé (navigateur, serveur, mobile) : charges typiques, bornes de recharge,
// modèles de panneaux, familles de disjoncteurs et calibres de fils.
// ⚠ Valeurs TYPIQUES et INDICATIVES : la plaque signalétique de l'appareil, la fiche du fabricant
// et le Code de construction du Québec, chapitre V (CSA C22.1) ont toujours préséance.

// Catégories utilisées pour le calcul de charge d'un logement (règle 8-200).
export const LOAD_CATEGORIES={
 basic:'Incluse dans la charge de base (≤ 1500 W)',
 heating:'Chauffage par plinthes / convecteurs',
 heating100:'Fournaise, conduit ou accumulateur (100 %)',
 cooling:'Climatisation / thermopompe',
 range:'Cuisinière',
 water100:'Chauffe-eau instantané, piscine, spa (100 %)',
 ev:'Borne de recharge (100 %)',
 other:'Autre charge > 1500 W',
};
export const VOLTAGES=[120,208,240,347,600];

// g = groupe d'affichage ; w = watts typiques ; v = tension ; cont = charge continue ; b = disjoncteur typique (A)
export const LOAD_LIBRARY=[
 // Bornes de recharge
 {id:'ev-l1',g:'Borne de recharge',name:'Borne niveau 1 — prise 120 V (12 A)',w:1440,v:120,cat:'ev',cont:true,b:15,note:'Câble fourni avec le véhicule, circuit dédié recommandé. Environ 5 à 8 km d’autonomie par heure.'},
 {id:'ev-l2-16',g:'Borne de recharge',name:'Borne niveau 2 — 16 A (3,8 kW)',w:3840,v:240,cat:'ev',cont:true,b:20},
 {id:'ev-l2-24',g:'Borne de recharge',name:'Borne niveau 2 — 24 A (5,8 kW)',w:5760,v:240,cat:'ev',cont:true,b:30},
 {id:'ev-l2-30',g:'Borne de recharge',name:'Borne niveau 2 — 30 A (7,2 kW)',w:7200,v:240,cat:'ev',cont:true,b:40,note:'Puissance la plus répandue en résidentiel au Québec.'},
 {id:'ev-l2-32',g:'Borne de recharge',name:'Borne niveau 2 — 32 A (7,7 kW)',w:7680,v:240,cat:'ev',cont:true,b:40},
 {id:'ev-l2-40',g:'Borne de recharge',name:'Borne niveau 2 — 40 A (9,6 kW)',w:9600,v:240,cat:'ev',cont:true,b:50},
 {id:'ev-l2-48',g:'Borne de recharge',name:'Borne niveau 2 — 48 A (11,5 kW)',w:11520,v:240,cat:'ev',cont:true,b:60},
 // Chauffage et climatisation
 {id:'bb-1000',g:'Chauffage et climatisation',name:'Plinthe électrique 1000 W',w:1000,v:240,cat:'heating',cont:true,b:15},
 {id:'bb-1500',g:'Chauffage et climatisation',name:'Plinthe électrique 1500 W',w:1500,v:240,cat:'heating',cont:true,b:15},
 {id:'bb-2000',g:'Chauffage et climatisation',name:'Plinthe électrique 2000 W',w:2000,v:240,cat:'heating',cont:true,b:15},
 {id:'conv-2500',g:'Chauffage et climatisation',name:'Convecteur / aérotherme 2500 W',w:2500,v:240,cat:'heating',cont:true,b:20},
 {id:'floor-heat',g:'Chauffage et climatisation',name:'Plancher chauffant salle de bain (500 W)',w:500,v:120,cat:'heating',cont:true,b:15},
 {id:'furnace-10',g:'Chauffage et climatisation',name:'Fournaise électrique 10 kW',w:10000,v:240,cat:'heating100',cont:true,b:60},
 {id:'furnace-15',g:'Chauffage et climatisation',name:'Fournaise électrique 15 kW',w:15000,v:240,cat:'heating100',cont:true,b:80,note:'Les fournaises de 20 kW et plus sont souvent alimentées par deux circuits.'},
 {id:'hp-2t',g:'Chauffage et climatisation',name:'Thermopompe centrale 2 tonnes (typique)',w:3000,v:240,cat:'cooling',cont:true,b:20,note:'Utilisez le MCA (fil) et le MOP (disjoncteur max.) de la plaque, colonne 240 V.'},
 {id:'hp-3t',g:'Chauffage et climatisation',name:'Thermopompe centrale 3 tonnes (typique)',w:4200,v:240,cat:'cooling',cont:true,b:25,note:'Utilisez le MCA et le MOP de la plaque signalétique.'},
 {id:'hp-4t',g:'Chauffage et climatisation',name:'Thermopompe centrale 4 tonnes (typique)',w:5500,v:240,cat:'cooling',cont:true,b:30,note:'Utilisez le MCA et le MOP de la plaque signalétique.'},
 {id:'minisplit-12',g:'Chauffage et climatisation',name:'Thermopompe murale 12 000 BTU',w:1300,v:240,cat:'cooling',cont:true,b:15},
 {id:'minisplit-24',g:'Chauffage et climatisation',name:'Thermopompe murale 24 000 BTU',w:2600,v:240,cat:'cooling',cont:true,b:20},
 {id:'ac-window',g:'Chauffage et climatisation',name:'Climatiseur de fenêtre 120 V',w:1200,v:120,cat:'cooling',cont:true,b:15},
 {id:'erv',g:'Chauffage et climatisation',name:'Échangeur d’air (VRC / VRE)',w:200,v:120,cat:'basic',cont:true,b:15},
 // Eau chaude
 {id:'wh-3000',g:'Eau chaude',name:'Chauffe-eau 40 gal — 3000 W',w:3000,v:240,cat:'other',cont:true,b:20},
 {id:'wh-4500',g:'Eau chaude',name:'Chauffe-eau 60 gal — 4500 W',w:4500,v:240,cat:'other',cont:true,b:30,note:'Disjoncteur de 25 ou 30 A selon le fabricant.'},
 {id:'wh-tankless-18',g:'Eau chaude',name:'Chauffe-eau instantané 18 kW',w:18000,v:240,cat:'water100',cont:true,b:null,note:'Généralement plusieurs circuits (ex. 2 × 40 A) : suivez la notice du fabricant.'},
 {id:'wh-hp',g:'Eau chaude',name:'Chauffe-eau thermodynamique (thermopompe)',w:1000,v:240,cat:'other',cont:true,b:15,note:'Certains modèles ont un élément d’appoint de 4500 W : utilisez la plaque.'},
 // Piscine et spa
 {id:'pool-hp',g:'Piscine et spa',name:'Thermopompe de piscine (typique 50 000 BTU)',w:5000,v:240,cat:'water100',cont:true,b:30,note:'Puissance absorbée bien inférieure à la puissance restituée (COP). Disjoncteur de 20 à 40 A selon le modèle.'},
 {id:'pool-heater',g:'Piscine et spa',name:'Chauffe-piscine électrique 11 kW',w:11000,v:240,cat:'water100',cont:true,b:60},
 {id:'pool-pump',g:'Piscine et spa',name:'Pompe de piscine 1,5 HP',w:1800,v:240,cat:'other',cont:true,b:15,note:'Protection DDFT requise.'},
 {id:'spa',g:'Piscine et spa',name:'Spa 240 V (typique)',w:9600,v:240,cat:'water100',cont:true,b:50,note:'Souvent 40 ou 50 A, avec sectionneur DDFT.'},
 // Cuisine et lavage
 {id:'range-12',g:'Cuisine et lavage',name:'Cuisinière jusqu’à 12 kW',w:12000,v:240,cat:'range',cont:false,b:40,note:'Pratique courante : 40 A grâce au facteur de demande des cuisinières.'},
 {id:'cooktop',g:'Cuisine et lavage',name:'Table de cuisson 7 kW',w:7000,v:240,cat:'range',cont:false,b:40},
 {id:'wall-oven',g:'Cuisine et lavage',name:'Four encastré 5 kW',w:5000,v:240,cat:'other',cont:false,b:30},
 {id:'dryer',g:'Cuisine et lavage',name:'Sécheuse 5,6 kW',w:5600,v:240,cat:'other',cont:false,b:30},
 {id:'washer',g:'Cuisine et lavage',name:'Laveuse',w:1000,v:120,cat:'basic',cont:false,b:20},
 {id:'dishwasher',g:'Cuisine et lavage',name:'Lave-vaisselle',w:1200,v:120,cat:'basic',cont:false,b:15},
 {id:'fridge',g:'Cuisine et lavage',name:'Réfrigérateur',w:700,v:120,cat:'basic',cont:false,b:15},
 {id:'freezer',g:'Cuisine et lavage',name:'Congélateur',w:500,v:120,cat:'basic',cont:false,b:15},
 {id:'microwave',g:'Cuisine et lavage',name:'Micro-ondes',w:1500,v:120,cat:'basic',cont:false,b:20},
 {id:'counter',g:'Cuisine et lavage',name:'Prises de comptoir (petits appareils)',w:1500,v:120,cat:'basic',cont:false,b:20},
 // Général
 {id:'lighting',g:'Usage général',name:'Éclairage d’une pièce',w:400,v:120,cat:'basic',cont:true,b:15},
 {id:'receptacles',g:'Usage général',name:'Prises générales d’une pièce',w:1000,v:120,cat:'basic',cont:false,b:15},
 {id:'garage-door',g:'Usage général',name:'Ouvre-porte de garage',w:600,v:120,cat:'basic',cont:false,b:15},
 {id:'sump',g:'Usage général',name:'Pompe de puisard 1/2 HP',w:800,v:120,cat:'basic',cont:false,b:15},
 {id:'well-pump',g:'Usage général',name:'Pompe de puits 1 HP',w:1500,v:240,cat:'basic',cont:false,b:15},
 {id:'workshop',g:'Usage général',name:'Atelier (compresseur, scie)',w:2400,v:240,cat:'other',cont:false,b:20},
];
export const loadById=id=>LOAD_LIBRARY.find(l=>l.id===id);

// Guide des bornes de recharge (affiché dans l'onglet Planification).
export const EV_GUIDE=[
 {level:'Niveau 1',supply:'120 V, prise ordinaire',power:'1,4 à 1,9 kW',breaker:'15 ou 20 A, circuit dédié recommandé',range:'≈ 5 à 8 km par heure',use:'Hybrides rechargeables, faible kilométrage quotidien.'},
 {level:'Niveau 2',supply:'208 / 240 V, circuit dédié',power:'3,8 à 11,5 kW (7,2 kW le plus courant)',breaker:'Borne 30 A → 40 A · borne 40 A → 50 A · borne 48 A → 60 A',range:'≈ 35 à 60 km par heure',use:'Recharge résidentielle et publique standard (connecteur J1772).'},
 {level:'Niveau 3 (rapide, courant continu)',supply:'Triphasé 480 V ou 600 V',power:'50 à 350 kW',breaker:'Entrée électrique commerciale dédiée (ex. 250 A à 600 V pour 175 kW)',range:'80 % de la batterie en 20 à 40 min',use:'Bornes publiques. Pas installable sur un panneau résidentiel.'},
];

// Règle générale : une charge continue ne doit pas dépasser 80 % du calibre du disjoncteur
// (disjoncteur ≥ 125 % de la charge), sauf appareil homologué pour 100 %.
export const CONTINUOUS_FACTOR=0.8;
export const STANDARD_BREAKERS=[15,20,25,30,35,40,45,50,60,70,80,90,100,125,150,175,200];
export const SERVICE_SIZES=[60,100,125,150,200,320,400];
// Conducteurs en cuivre, isolant 90 °C, courant admissible à 60 °C (type NMD90 en résidentiel).
export const WIRE_TABLE=[
 {gauge:'14 AWG',amps:15},{gauge:'12 AWG',amps:20},{gauge:'10 AWG',amps:30},{gauge:'8 AWG',amps:40},
 {gauge:'6 AWG',amps:55},{gauge:'4 AWG',amps:70},{gauge:'3 AWG',amps:85},{gauge:'2 AWG',amps:95},
 {gauge:'1 AWG',amps:110},{gauge:'1/0 AWG',amps:125},{gauge:'2/0 AWG',amps:145},{gauge:'3/0 AWG',amps:165},{gauge:'4/0 AWG',amps:195},
];
export const WIRE_TYPES=['NMD90 (Loomex)','AC90 (BX)','TECK90','Conduit + T90','Aluminium (artère)','Autre'];
export const wireAmps=g=>WIRE_TABLE.find(w=>w.gauge===g)?.amps??null;

// Conducteurs d'entrée électrique (du point de raccordement d'Hydro-Québec, en tête de mât,
// jusqu'au disjoncteur principal, en passant par l'embase du compteur).
// Courant admissible indicatif, colonne 75 °C, au plus 3 conducteurs en conduit
// (Code canadien de l'électricité, tableaux 2 (cuivre) et 4 (aluminium)).
// Le tableau 39 permet parfois un calibre plus petit pour l'entrée d'un logement unifamilial.
export const SERVICE_CONDUCTORS=[
 {gauge:'6 AWG',cu:65,al:50},{gauge:'4 AWG',cu:85,al:65},{gauge:'3 AWG',cu:100,al:75},{gauge:'2 AWG',cu:115,al:90},
 {gauge:'1 AWG',cu:130,al:100},{gauge:'1/0 AWG',cu:150,al:120},{gauge:'2/0 AWG',cu:175,al:135},{gauge:'3/0 AWG',cu:200,al:155},
 {gauge:'4/0 AWG',cu:230,al:180},{gauge:'250 kcmil',cu:255,al:205},{gauge:'300 kcmil',cu:285,al:230},{gauge:'350 kcmil',cu:310,al:250},
 {gauge:'400 kcmil',cu:335,al:270},{gauge:'500 kcmil',cu:380,al:310},{gauge:'600 kcmil',cu:420,al:340},
];
export const SERVICE_MATERIALS=['Cuivre','Aluminium'];
export const SERVICE_ROUTES=['Aérienne — mât','Aérienne — sur façade','Souterraine'];
export const serviceAmpacity=(gauge,material)=>{const r=SERVICE_CONDUCTORS.find(w=>w.gauge===gauge);return r?(material==='Aluminium'?r.al:r.cu):null;};
// Vérification indicative : conducteurs d'entrée comparés au disjoncteur principal.
export function serviceCheck(det={}){
 if(!det.serviceGauge)return null;
 const material=det.serviceMaterial||'Cuivre';
 const ampacity=serviceAmpacity(det.serviceGauge,material);
 const main=Number(det.mainAmps)||null;
 const label=`${det.serviceGauge} ${material.toLowerCase()}`;
 if(!ampacity)return {label,ampacity:null,status:'unknown',text:''};
 if(!main)return {label,ampacity,status:'unknown',text:`Conducteurs d’entrée ${label} : environ ${ampacity} A admissibles (colonne 75 °C).`};
 if(ampacity>=main)return {label,ampacity,status:'ok',text:`Conducteurs d’entrée ${label} (≈ ${ampacity} A) compatibles avec le principal de ${main} A.`};
 return {label,ampacity,status:'warn',text:`Conducteurs d’entrée ${label} : environ ${ampacity} A admissibles (colonne 75 °C), moins que le principal de ${main} A. Le tableau 39 du Code permet parfois un calibre réduit pour un logement unifamilial : à faire valider par un maître électricien.`};
}

// Familles de produits (métadonnées publiques seulement : la bibliothèque complète des panneaux
// et des disjoncteurs est réservée aux abonnés et servie par l'API).
// pitch = largeur d'un espace en pouces (3/4" ou 1"), utilisée pour le dessin réaliste.
export const FAMILIES={
 QO:{brand:'Square D',maker:'Schneider Electric',parent:'Schneider Electric',name:'Square D QO',pitch:.75,accent:'#3a8f4e',body:'#161616',handle:'#2c2c2c',ink:'#f3f3f3',mark:'QO'},
 HOM:{brand:'Square D',maker:'Schneider Electric',parent:'Schneider Electric',name:'Square D HomeLine',pitch:1,accent:'#3a8f4e',body:'#1a1a1a',handle:'#303030',ink:'#f3f3f3',mark:'HOM'},
 SIE:{brand:'Siemens',maker:'Siemens Canada',name:'Siemens EQ / Q',pitch:1,accent:'#0b8a8f',body:'#24282b',handle:'#3a4045',ink:'#f1f4f5',mark:'Q'},
 BR:{brand:'Eaton',maker:'Eaton Canada',name:'Eaton BR',pitch:1,accent:'#1f5fa8',body:'#141414',handle:'#262626',ink:'#f3f3f3',mark:'BR'},
 CH:{brand:'Cutler-Hammer',maker:'Eaton Canada',parent:'Eaton',name:'Cutler-Hammer CH',pitch:.75,accent:'#1f5fa8',body:'#a8784b',handle:'#7b5232',ink:'#fff8ee',mark:'CH'},
 LEV:{brand:'Leviton',maker:'Leviton Canada',name:'Leviton LP / LR / LS',pitch:1,accent:'#2d63a6',body:'#d7dbdd',handle:'#596066',ink:'#22282c',mark:'LB'},
 CBM:{brand:'Eaton',maker:'Eaton Canada',name:'Eaton CBM / CBL (boulonné)',pitch:1,accent:'#1f5fa8',body:'#171717',handle:'#2a2a2a',ink:'#f3f3f3',mark:'BA'},
 GEN:{brand:'Generac',maker:'Generac',name:'Generac (inverseurs et HomeLink)',pitch:1,accent:'#e2621b',body:'#1c1c1c',handle:'#2e2e2e',ink:'#f3f3f3',mark:''},
 generic:{brand:'',maker:'',name:'Générique / autre marque',pitch:1,accent:'#6b7a72',body:'#262b28',handle:'#3a403c',ink:'#eef2ec',mark:''},
};
export const FAMILY_IDS=Object.keys(FAMILIES);
export const familyOf=id=>FAMILIES[id]||FAMILIES.generic;

export const PANEL_STATES=['Existant','Planifié','Installé','Vérifié'];
// Étapes d'un projet de panneau : on peut passer de l'une à l'autre en gardant les données.
export const PANEL_STAGES={
 conception:{n:1,label:'Conception',short:'Planifier',icon:'✏️',hint:'Pas encore de panneau : concevez-le (modèle, disjoncteurs, capacité) avant de l’installer.'},
 releve:{n:2,label:'Relevé',short:'Relever',icon:'📋',hint:'Un panneau existe : relevez ses circuits (photos, questions) pour clarifier ou préparer un agrandissement.'},
 verification:{n:3,label:'Vérification',short:'Vérifier',icon:'🔌',hint:'Vérifiez la charge : inscrivez les gros électroménagers et reliez-les au bon circuit.'},
};
export const STAGE_IDS=Object.keys(PANEL_STAGES);
export const stageFromState=s=>s==='Planifié'?'conception':s==='Vérifié'?'verification':'releve';
export const LOADS_SOURCES=[
 'Gouvernement du Québec — Guide sur les bornes de recharge (niveaux 1, 2 et 3)',
 'Ressources naturelles Canada — Recharge des véhicules électriques',
 'Code canadien de l’électricité (CSA C22.1) : règles 8-104, 8-200, 8-106, section 86 ; feuilles de calcul municipales (Winnipeg, Burnaby)',
 'Fiches de fabricants (bornes, thermopompes de piscine, chauffe-eau)',
];
