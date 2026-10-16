# GestionPanneauSiemens — v1.5.0
Répertoire personnel en français pour un panneau Siemens EQ, 40 positions, principal 200 A.

## Fonctions
- Panneau réaliste responsive, positions impaires à gauche et paires à droite.
- Désignation, pièce, usage, calibre, statut et notes par circuit.
- Bipolaires occupant n et n+2, avec validation des conflits.
- Recherche, nomenclature imprimable, import/export JSON.
- Brouillon local explicitement identifié et synchronisation PostgreSQL privée.
- Contrôle de version optimiste : une modification concurrente n'écrase pas silencieusement une autre.

## Déploiement Vercel
Importer ce dépôt, Framework Preset « Other », Output Directory `public`. Les fonctions sont dans `api/`.
Créer une base Neon depuis Storage / Marketplace du projet Vercel et la connecter. Définir `DATABASE_URL` (injectée par l'intégration) et `PANEL_ACCESS_KEY` (clé privée aléatoire d'au moins 32 caractères) dans les variables d'environnement du projet. Redéployer. L'API initialise sa table au premier accès authentifié.

Aucune clé n'est incluse dans le code client. La clé saisie reste en mémoire jusqu'à la déconnexion ou au rechargement. Toutes les lectures et écritures distantes exigent cette clé. Les brouillons locaux persistent dans le navigateur. Conserver la protection Vercel sur les déploiements privés.

## État initial
Les 40 circuits sont « À identifier ». Les calibres 15 A sont des valeurs de saisie par défaut, pas un inventaire vérifié. La représentation est indicative : vérifier la numérotation et les caractéristiques sur le panneau réel. Les sous-emplacements A/B et groupes liés sont représentés depuis la version 1.1.0. L'application ne contrôle ni ne mesure l'installation.

## Vérification
`npm test` vérifie la validation des positions, les bipolaires et les imports.

## Ressources créées
Projet Vercel : `gestion-panneau-siemens` (prj_cVEPH4VFiZqFApusdB73iIZoXidA).
Dépôt GitHub : https://github.com/nathanbegin/GestionPanneauSiemens
La base Neon est connectée au projet Vercel.

## Version 1.1.0 — disposition photographiée
Représentation de 32 positions visibles avec sous-emplacements A/B. Les groupes liés peuvent occuper des demi-emplacements adjacents ou deux positions entières. Le répertoire v1 reste importable.

La transcription personnelle est conservée dans la variable serveur privée `PANEL_PHOTO_CONFIG`, jamais dans ce dépôt public. Après authentification, un répertoire neuf ou un ancien répertoire par défaut non modifié est initialisé depuis cette configuration. Pour un répertoire déjà modifié, le bouton Configuration photos permet son application explicite. Chaque remplacement distant conserve une copie dans `panel_history`. Les usages transcrits portent le statut À confirmer.

## Version 1.2.0 — nomenclature et tags
Tags structurés : `locations`, `functions`, `devices`. Recherche sans accents, filtrage par tag, surlignage des circuits et édition dans chaque fiche. Exports JSON schema 2 compatibles avec les anciennes sauvegardes, tags inclus dans les impressions.

Le relevé utilisateur est injecté uniquement via `PANEL_SURVEY_CONFIG` (configuration privée comprenant identifiant de migration, baseline et circuits enrichis). À la première lecture authentifiée, une migration avec garde de révision sauvegarde le répertoire précédent dans `panel_history` et applique les champs dont les valeurs correspondent encore à la baseline. Les descriptions et notes originales sont conservées. Les champs modifiés depuis le relevé sont préservés. `panel_migrations` empêche une nouvelle application automatique. Aucun relevé personnel ne doit être commité dans le dépôt public.

## Version 1.3.0 — Exceptions et détails
Chaque circuit dispose d'un champ `exceptions` distinct des notes et tags. Le champ est visible dans la nomenclature et à l'impression, modifiable dans la fiche et inclus dans les exports JSON et la recherche. Les anciens fichiers sans ce champ sont normalisés à une chaîne vide à l'import. Le relevé personnel et les exceptions propres au domicile doivent être enregistrés dans la base privée et non dans le dépôt public.

## Version 1.4.0 — métadonnées de l'impression PDF
Lors de l'impression du répertoire (ou Enregistrer au format PDF), l'en-tête affiche la date et l'heure locales de l'export ainsi que la version de l'application affichée dans l'interface. L'horodatage est actualisé à l'ouverture de la boîte de dialogue d'impression, y compris via la commande Imprimer du navigateur.

## Version 1.5.0 — formats PDF
Choix du papier avant impression : Lettre 8,5 × 11 po (par défaut), Légal 8,5 × 14 po, long 8,5 × 16 po (format personnalisé). Mise en page imprimable compacte à deux colonnes, avec tags et exceptions plus petits, tout en conservant la date et la version. Les descriptions restent intégrales; un répertoire particulièrement long peut encore nécessiter plusieurs pages. Dans la boîte d'impression, sélectionner le format de papier correspondant si le navigateur ou l'imprimante ne respecte pas le format CSS.

## Version 1.7.0 — Étiquettes ZebraHD
Le bouton « Créer des étiquettes » envoie le répertoire courant (schéma 2, tous les circuits et tags) depuis une fonction serveur authentifiée vers `https://zebra.nathanbegin.xyz/api/panels`, puis ouvre `https://zebra.nathanbegin.xyz/etiquettes.html#panel=siemens-eq` dans un nouvel onglet. Le serveur exige la connexion au panneau via `PANEL_ACCESS_KEY` et utilise `PANELS_API_KEY` configurée côté serveur dans Vercel, jamais dans le JavaScript du navigateur. Cette action remplace le panneau `siemens-eq` dans ZebraHD; les modifications locales non encore synchronisées sont également transmises. Le navigateur peut bloquer le nouvel onglet : dans ce cas, un lien de rechange est affiché. La présence de la clé dans le projet ZebraHD, la disponibilité du domaine et le comportement réel de l'import doivent être vérifiés en déploiement.

## Version 1.8.0 — lecture par UID depuis ZebraHD
`GET /api/panel-live?id=siemens-eq` fournit la dernière version enregistrée dans Neon, avec `Authorization: Bearer <PANEL_ACCESS_KEY>` obligatoire. ZebraHD appelle cette route via son propre serveur `POST /api/panel-live` avec une clé fournie temporairement dans son interface et non stockée. L'UID n'est pas une authentification. Les modifications locales non synchronisées ne sont pas visibles par cette lecture. Attention : une protection Vercel Authentication sur le domaine `gestion-panneau-siemens.vercel.app` peut bloquer l'appel serveur-à-serveur. L'ancien export par `POST /api/panels` continue d'utiliser la copie Firebase et son ancienne API GET publique ; ne pas confondre ce flux avec la route privée.

## Version 1.9.0 — gestion multi-panneaux
Chaque panneau Siemens EQ partage le même simulateur de 32 positions avec sous-emplacements A/B, mais possède un nom, un UID stable (`eq-…`) et des circuits indépendants. Le panneau principal existant conserve l'UID historique `siemens-eq` et la table `panel_state`, sans migration destructive. Les panneaux supplémentaires sont enregistrés dans `panels_extra` de Neon et administrés par `api/panels-manager` sous authentification `PANEL_ACCESS_KEY`, avec contrôle de révision. L'interface permet de sélectionner, créer, renommer et supprimer les panneaux supplémentaires. Les exports JSON et ZebraHD transmettent l'UID du panneau actif. La route privée `api/panel-live?id=UID` et le proxy ZebraHD de lecture directe acceptent également les nouveaux UID. L'UID n'est pas un secret : la clé privée demeure obligatoire pour la lecture en direct. Les réglages photo personnalisés restent propres au panneau principal.
