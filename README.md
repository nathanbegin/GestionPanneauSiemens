# GestionPanneauSiemens — v1.0.0
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
Les 40 circuits sont « À identifier ». Les calibres 15 A sont des valeurs de saisie par défaut, pas un inventaire vérifié. La représentation est indicative : vérifier la numérotation et les caractéristiques sur le panneau réel. Les tandems et quadruplex ne sont pas représentés dans cette version. L'application ne contrôle ni ne mesure l'installation.

## Vérification
`npm test` vérifie la validation des positions, les bipolaires et les imports.

## Ressources créées
Projet Vercel : `gestion-panneau-siemens` (prj_cVEPH4VFiZqFApusdB73iIZoXidA).
Dépôt GitHub : https://github.com/nathanbegin/GestionPanneauSiemens
La base Neon reste à créer et à connecter au projet Vercel avant que la synchronisation distante soit disponible.
