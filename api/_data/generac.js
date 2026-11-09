// Produits Generac (inverseurs de transfert manuels, automatiques et HomeLink), ajoutés le 2026-11-07.
// Même format que catalogue.js. « accepte » = familles de disjoncteurs acceptées par le centre de distribution.
// Les espaces des HomeLink sont déduits des disjoncteurs inclus (fiche 0L1648-G) : statut « Catalogue », note explicite.
export default {
 sources:{
  'GEN-HL':{t:'Generac — Fiche technique HomeLink Upgradeable Manual Transfer Switch 6852/6853/6854/9854/9855, bulletin 0L1648-G (2019)',u:'https://www.generac.com/globalassets/products/residential/transfer-switches/homelink-manual-transfer-switches/spec-sheets/6852-6853-6854-9854-9855-homelink-transfer-switch-specsheet.pdf'},
  'GEN-6377':{t:'Generac — Fiche technique Manual Transfer Switch 1-2 circuits, modèle 6377, bulletin 10000037582-A (2018)',u:'https://www.generac.com/globalassets/products/residential/portable-generator-transfer-switches/spec-sheets/g0063770-30amp-1-2-circuit-manual-transfer-switch-specsheet.pdf'},
  'GEN-RXS':{t:'Generac — Inverseurs automatiques RXSW/RXSC 100-200 A (pages produit et manuel du propriétaire)',u:'https://www.generac.com/residential-products/standby-generator-transfer-switches/automatic/rxsw200a3cul-caeb0a29/'},
  'GEN-RXG':{t:'Generac — Manuel du propriétaire RXG16EZA1 (85 A) et fiches distributeurs RXG16EZA1W',u:'https://manfilemode-generacsoa.generac.com/api/manualfiles/RXG16EZA1/10000012944/0'},
  'GEN-DIST':{t:'Distributeurs (Rexel, Northern Tool, Electric Generators Direct, Covalin) — modèles abandonnés ou non confirmés par Generac',u:'https://www.rexelusa.com/p/882590/generac/transfer-switch-manual-30a-125-250v-10-16-circuits-kit-/696471063783/6378'},
 },
 famille:{id:'GEN',marque:'Generac',gamme:'Inverseurs de transfert et HomeLink',pas:'1"',barres:'—',pon:'Non indiqué',
  disj:'HomeLink : disjoncteurs 1" Siemens, Eaton et Square D (standard, jumelés, DDFT, anti-arc)',
  tandem:'HomeLink : jumelés acceptés (10 circuits max. pour 30 A, 16 pour 50 A)',
  principal:'HomeLink et inverseurs manuels : alimentés par un disjoncteur 2P du panneau principal. RXSW : sectionneur de service intégré (service rated).',
  note:'Les inverseurs automatiques RXSW/RXSC n’ont pas d’espaces de dérivation : listés à titre informatif.'},
 panneaux:[
  // HomeLink : inverseur manuel pré-câblé avec centre de distribution, évolutif en automatique (trousse 6869).
  {famille:'GEN',cat:'6852',type:'HomeLink manuel pré-câblé',bus_A:30,principal_A:null,espaces:8,circuits:10,enveloppe:'NEMA 1 (intérieur)',pon:false,accepte:['SIE','BR','HOM'],statut:'Catalogue',source:'GEN-HL',
   note:'8 circuits fournis (1×2P 30 A, 1×1P 20 A, 5×1P 15 A), 10 max. Disjoncteur 2P 50 A requis au panneau principal. Entrée L14-30 (boîte non incluse). Évolutif en automatique (trousse 6869, génératrice de secours ≤ 11 kW). Espaces déduits des disjoncteurs inclus.'},
  {famille:'GEN',cat:'6853',type:'HomeLink manuel pré-câblé (trousse)',bus_A:30,principal_A:null,espaces:8,circuits:10,enveloppe:'NEMA 1 (intérieur)',pon:false,accepte:['SIE','BR','HOM'],statut:'Catalogue',source:'GEN-HL',
   note:'Comme 6852 + cordon 10 pi L14-30 et boîte d’entrée 30 A en résine (NEMA 3R).'},
  {famille:'GEN',cat:'6854',type:'HomeLink manuel pré-câblé (trousse)',bus_A:30,principal_A:null,espaces:8,circuits:10,enveloppe:'NEMA 1 (intérieur)',pon:false,accepte:['SIE','BR','HOM'],statut:'Catalogue',source:'GEN-HL',
   note:'Comme 6852 + cordon 10 pi L14-30 et boîte d’entrée 30 A en aluminium (NEMA 3R).'},
  {famille:'GEN',cat:'9854',type:'HomeLink manuel pré-câblé',bus_A:50,principal_A:null,espaces:8,circuits:16,enveloppe:'NEMA 1 (intérieur)',pon:false,accepte:['SIE','BR','HOM'],statut:'Catalogue',source:'GEN-HL',
   note:'10 circuits fournis (1×2P 30 A, 1×2P 20 A, 2×1P 20 A, 2 jumelés 20 A), 16 max. Disjoncteur 2P 50 A requis au panneau principal. Entrée CS6377. Évolutif en automatique (trousse 6869). Espaces déduits des disjoncteurs inclus.'},
  {famille:'GEN',cat:'9855',type:'HomeLink manuel pré-câblé (trousse)',bus_A:50,principal_A:null,espaces:8,circuits:16,enveloppe:'NEMA 1 (intérieur)',pon:false,accepte:['SIE','BR','HOM'],statut:'Catalogue',source:'GEN-HL',
   note:'Comme 9854 + cordon 10 pi 6/4 (CS6364 / NEMA 14-50) et boîte d’entrée 50 A en aluminium.'},
  {famille:'GEN',cat:'6869',type:'Trousse de conversion manuel → automatique',bus_A:null,principal_A:null,espaces:null,circuits:null,enveloppe:'Se monte dans l’inverseur',pon:false,statut:'Catalogue',source:'GEN-HL',
   note:'Panneau d’automatisation et couvercle pour HomeLink 6852 à 9855.'},
  // Inverseurs manuels pour génératrice portative.
  {famille:'GEN',cat:'6377',type:'Inverseur manuel 1-2 circuits',bus_A:30,principal_A:null,espaces:2,circuits:2,enveloppe:'NEMA 3R (extérieur)',pon:false,statut:'Catalogue',source:'GEN-6377',
   note:'Disjoncteur 2P 30 A inclus. Entrée L14-30 sous le boîtier. 125/250 V. Pour 1 ou 2 circuits essentiels (chauffe-eau, pompe de puits).'},
  {famille:'GEN',cat:'6376',type:'Inverseur manuel pré-câblé',bus_A:30,principal_A:null,espaces:6,circuits:10,enveloppe:'NEMA 1 (intérieur)',pon:false,statut:'Génération précédente',source:'GEN-DIST',
   note:'6 circuits, extensible à 10 (distributeurs). Disjoncteur 2P 60 A requis au panneau principal. Abandonné.'},
  {famille:'GEN',cat:'6378',type:'Inverseur manuel pré-câblé (trousse)',bus_A:30,principal_A:null,espaces:10,circuits:16,enveloppe:'NEMA 1 (intérieur)',pon:false,statut:'Génération précédente',source:'GEN-DIST',
   note:'10 circuits, extensible à 16 (distributeurs). Disjoncteur 2P 60 A requis au panneau principal. Abandonné.'},
  // Inverseurs automatiques avec centre de distribution intégré.
  {famille:'GEN',cat:'RXG16EZA1',type:'Inverseur automatique avec centre de distribution',bus_A:85,principal_A:null,espaces:16,circuits:16,enveloppe:'NEMA 1 (intérieur)',pon:false,statut:'Génération précédente',source:'GEN-RXG',
   note:'Pré-câblé pour génératrices refroidies à l’air de 8, 11 ou 16 kW. Disjoncteurs livrés : 5×1P 15 A, 5×1P 20 A, 2P 20, 40 et 50 A. Abandonné chez la plupart des distributeurs.'},
  {famille:'GEN',cat:'RXG16EZA1W',type:'Inverseur automatique avec centre de distribution',bus_A:100,principal_A:null,espaces:16,circuits:16,enveloppe:'NEMA 1 (intérieur)',pon:false,statut:'Catalogue de détail',source:'GEN-DIST',
   note:'Version 100 A du RXG16EZA1 (distributeurs), génératrices jusqu’à 24 kW.'},
  {famille:'GEN',cat:'RXG16EZA3',type:'Inverseur automatique avec centre de distribution',bus_A:100,principal_A:null,espaces:16,circuits:16,enveloppe:'NEMA 3R (extérieur)',pon:false,statut:'À vérifier',source:'GEN-DIST',
   note:'Version extérieure 100 A listée par un distributeur canadien ; non confirmée par Generac.'},
  // Inverseurs automatiques « maison entière » : aucun espace de dérivation.
  {famille:'GEN',cat:'RXSW200A3CUL',type:'Inverseur automatique (entrée de service, Canada)',bus_A:200,principal_A:200,espaces:null,circuits:null,enveloppe:'NEMA 3R aluminium',pon:false,statut:'Catalogue',source:'GEN-RXS',
   note:'Approuvé au Canada comme sectionneur d’entrée de service (disjoncteur de service intégré). Gestion de 4 charges CVC sans accessoire. Génératrices monophasées.'},
  {famille:'GEN',cat:'RXSW100A3',type:'Inverseur automatique (service rated)',bus_A:100,principal_A:100,espaces:null,circuits:null,enveloppe:'NEMA 3R aluminium',pon:false,statut:'Catalogue',source:'GEN-RXS',note:'120/240 V monophasé, contrôleurs Evolution ou Nexus.'},
  {famille:'GEN',cat:'RXSW150A3',type:'Inverseur automatique (service rated)',bus_A:150,principal_A:150,espaces:null,circuits:null,enveloppe:'NEMA 3R aluminium',pon:false,statut:'Catalogue',source:'GEN-RXS',note:'Le 150 A n’existe qu’en version service rated. Génératrices de 8 à 26 kW.'},
  {famille:'GEN',cat:'RXSW200A3',type:'Inverseur automatique (service rated)',bus_A:200,principal_A:200,espaces:null,circuits:null,enveloppe:'NEMA 3R aluminium',pon:false,statut:'Catalogue',source:'GEN-RXS',note:'120/240 V monophasé.'},
  {famille:'GEN',cat:'RXSW100A3SPD',type:'Inverseur automatique (service rated) + parasurtenseur',bus_A:100,principal_A:100,espaces:null,circuits:null,enveloppe:'NEMA 3R aluminium',pon:false,statut:'Catalogue',source:'GEN-RXS',note:'Parasurtenseur maison entière intégré.'},
  {famille:'GEN',cat:'RXSW200A3SPD',type:'Inverseur automatique (service rated) + parasurtenseur',bus_A:200,principal_A:200,espaces:null,circuits:null,enveloppe:'NEMA 3R aluminium',pon:false,statut:'Catalogue',source:'GEN-RXS',note:'Parasurtenseur maison entière intégré.'},
  {famille:'GEN',cat:'RXSC100A3',type:'Inverseur automatique (non service rated)',bus_A:100,principal_A:null,espaces:null,circuits:null,enveloppe:'Acier',pon:false,statut:'Catalogue',source:'GEN-RXS',note:'Installé en aval du disjoncteur principal existant.'},
  {famille:'GEN',cat:'RXSC200A3',type:'Inverseur automatique (non service rated)',bus_A:200,principal_A:null,espaces:null,circuits:null,enveloppe:'Acier',pon:false,statut:'Catalogue',source:'GEN-RXS',note:'Installé en aval du disjoncteur principal existant.'},
 ],
};
