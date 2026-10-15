# GestionPanneauSiemens — v1.3.0
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
