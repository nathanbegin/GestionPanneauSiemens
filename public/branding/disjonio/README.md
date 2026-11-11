# Disjonio — Identité visuelle (v1)

Ce dossier est la **catégorie dédiée à l’image de marque de Disjonio** dans le dépôt GestionPanneauSiemens. L’ajout de ces fichiers ne remplace **aucun visuel de l’application actuelle** : ils sont prêts à être intégrés ultérieurement.

## Logo

Symbole **D** composé de deux disjoncteurs à levier et d’un éclair vert doux. Les SVG sont natifs, éditables et transparents, sauf les icônes carrées pour application. La typographie du mot-symbole est **Manrope ExtraBold (800)** avec replis Inter et Arial.

## Palette officielle — six couleurs uniquement

| Couleur | Valeur | Usage |
|---|---|---|
| Vert forêt | `#1A4032` | Identité et fonds sombres |
| Vert tendre | `#8ABF92` | Éclair, accents |
| Anthracite | `#394039` | Textes et détails |
| Gris olive | `#878C81` | Disjoncteurs |
| Blanc cassé | `#F3F4EF` | Surfaces et logos inversés |
| Gris très clair | `#EEF1EA` | Surfaces secondaires |

## Organisation

- `svg/` — 23 variantes : horizontales, empilées, typographiques, symbole, monochromes et icônes pour application.
- `web/` — favicon SVG, icône SVG, variables CSS facultatives, exemple de manifeste PWA.
- `apercus/` — page HTML autonome pour visualiser les variantes.

## Comment choisir un fichier

| Usage | Chemin depuis ce dossier |
|---|---|
| En-tête sur fond clair, sans sous-titre | `svg/disjonio-horizontal-no-tagline-on-light.svg` |
| En-tête français sur fond clair | `svg/disjonio-horizontal-fr-on-light.svg` |
| En-tête anglais sur fond sombre | `svg/disjonio-horizontal-en-on-dark.svg` |
| Logo empilé français | `svg/disjonio-stacked-fr-on-light.svg` |
| Variante typographique seule | `svg/disjonio-wordmark-on-light.svg` |
| Petite taille, symbole simplifié | `svg/disjonio-symbol-simple-on-light.svg` |
| Icône PWA | `web/icon.svg` |
| Favicon vectoriel | `web/favicon.svg` |

Les suffixes `on-light` et `on-dark` décrivent **le fond sur lequel utiliser le logo**, pas un fond intégré dans le fichier SVG. Le logo est transparent.

## Textes de marque

- Français : **ORGANISATION ÉLECTRIQUE**
- English: **ELECTRICAL ORGANIZATION**
- `no-tagline` : aucun sous-titre.

## Intégration au site (exemples, non appliqués)

Les assets sont servis depuis `public/` à l’URL `/branding/disjonio/` dans le projet actuel :

```html
<img src="/branding/disjonio/svg/disjonio-horizontal-no-tagline-on-light.svg" alt="Disjonio" width="280">
<link rel="icon" type="image/svg+xml" href="/branding/disjonio/web/favicon.svg">
```

Pour obtenir l'apparence attendue des textes SVG, charger Manrope :

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Le manifeste `web/manifest.brand-example.webmanifest` est un **exemple uniquement**, à adapter au manifeste principal existant; il n'est pas activé. De même, les variables `web/disjonio-tokens.css` ne sont pas importées. Le projet existant conserve ses couleurs, favicons, pages et fonctionnalités.

## Remarques

- Les fichiers SVG ne contiennent aucune image bitmap et ne redistribuent aucune police.
- Pour une reproduction figée dans un environnement sans Manrope, convertir le texte en contours ou produire les fichiers PNG depuis les SVG.
- Pour des favicons à 16–32 px, utiliser la variante simple, dont les deux rectangles restent discernables.
- La trousse PNG/ICO complète reste disponible séparément; cette proposition GitHub privilégie **les sources vectorielles SVG et les ressources Web textuelles**, adaptées au suivi de versions Git.
- Il s'agit du redessin vectoriel validé du concept, et non d'un calque pixel-perfect de la maquette initiale.
