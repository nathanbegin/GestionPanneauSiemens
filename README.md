# Mon Panneau — v2.0.0

Application grand public (et pro) pour faire la **nomenclature des panneaux électriques** : comptes utilisateurs, plusieurs sites (adresses), plusieurs panneaux par site, fiche de chaque disjoncteur, rapports PDF professionnels, étiquettes, et applications iOS / Android.

> Anciennement « GestionPanneauSiemens » (v1.x, un seul panneau Siemens EQ protégé par une clé). L'ancienne interface reste disponible sur `/ancien/` et ses données s'importent dans un compte (voir plus bas).

## Organisation

```
Compte ─┬─ Site (adresse, client, notes)
        │    ├─ Panneau P-1 · Principal (emplacement, bâtiment, marque, calibre, positions…)
        │    │    └─ Circuits (désignation, pièce, usage, calibre, protection, statut, tags, notes, exceptions)
        │    └─ Panneau SP-GAR · Sous-panneau — alimenté par P-1, circuit 14/16
        └─ Site 2 …
```

## Pages

| URL | Contenu |
| --- | --- |
| `/` | Page d'accueil (présentation, public cible, mobile) |
| `/fonctionnement` | Guide pas à pas et FAQ |
| `/conditions` | Conditions d'utilisation et confidentialité (à faire réviser) |
| `/app` | Application : `#/connexion`, `#/inscription`, `#/sites`, `#/sites/:id`, `#/panneaux/:id/(panel\|list\|docs\|info)`, `#/compte` |
| `/ancien/` | Interface v1.9 (clé d'accès unique) |

## Fonctions

- **Comptes** : inscription par courriel, profil *Particulier* ou *Électricien / entrepreneur* (entreprise, licence RBQ, coordonnées affichées sur les rapports), changement de mot de passe, suppression du compte, mot de passe oublié (si Resend est configuré).
- **Sites** : nom, adresse, client, notes ; hiérarchie d'alimentation des panneaux.
- **Panneaux** : nom, étiquette/repère (P-1, SP-GAR), type, bâtiment, emplacement précis, 2 à 84 positions, marque, modèle, calibre principal, tension, alimenté par (panneau + circuit), date du relevé et auteur, notes.
- **Circuits** : face avant interactive (impairs à gauche, pairs à droite), nomenclature avec recherche sans accents / statut / tags, formats unipolaire, bipolaire, tripolaire et jumelé (A/B), protection DDFT / anti-arc, « Enregistrer et suivant » pour identifier rapidement devant le panneau, passage automatique à « Identifié ».
- **Documents (PDF générés côté serveur)** :
  - *Aide-mémoire de porte* : une page, tous les circuits en deux colonnes ;
  - *Rapport complet* : informations site/panneau, « Préparé par », répertoire, tableau détaillé, attestation et signature ;
  - *Rapport du site* : page couverture + tous les panneaux ;
  - *Étiquettes* : feuille Avery 5160/8160 (repère du panneau + 1 étiquette par circuit) ;
  - *ZebraHD* (si `PANELS_API_KEY` est défini) et *export JSON* (réimportable).
- **Synchronisation** : enregistrement automatique, contrôle de révision (aucun écrasement silencieux entre deux appareils).
- **PWA** installable (manifeste + service worker) et **applications natives** iOS/Android (Capacitor) dans `mobile/`.

## Architecture

- `public/` : site statique + application (JavaScript natif en modules, sans étape de compilation). `public/model.js` est partagé par le navigateur, le serveur et le mobile.
- `api/` : fonctions Vercel (Node 22). `auth`, `account`, `sites`, `panels`, `report`, `etiquettes` (+ routes v1 `panel`, `panel-live`, `panels-manager`). Le code commun est dans `api/_lib/` (non exposé).
- Base PostgreSQL (Neon) : tables `app_users`, `app_sessions`, `app_resets`, `app_rate`, `app_sites`, `app_panels`, créées automatiquement. Les tables v1 (`panel_state`, `panels_extra`…) ne sont pas modifiées.
- Sécurité : mots de passe scrypt, jetons de session aléatoires (empreinte SHA-256 en base), témoin `HttpOnly; Secure; SameSite=Lax` sur le web, jeton Bearer sur mobile, en-tête `X-MP-Client` obligatoire pour les écritures (anti-CSRF), limitation des tentatives, liens PDF signés HMAC valables 10 min, CSP stricte, chaque requête filtrée par `user_id`.

## Déploiement Vercel

1. Variables d'environnement (voir `.env.example`) : `DATABASE_URL` (intégration Neon déjà connectée) et **`APP_SECRET`** (≥ 32 caractères aléatoires). Facultatif : `RESEND_API_KEY` + `MAIL_FROM` + `APP_URL` pour le mot de passe oublié, `PANELS_API_KEY` pour ZebraHD.
2. Garder `PANEL_ACCESS_KEY` pour l'ancienne interface et l'import.
3. **Désactiver la protection « Vercel Authentication »** sur le domaine de production : sinon le grand public ne peut pas accéder au site.
4. Redéployer. Les tables se créent au premier appel.

### Récupérer les données v1.x
Se créer un compte, puis *Mon compte → Ancienne version* : entrer l'ancienne clé `PANEL_ACCESS_KEY`. Le panneau principal et les panneaux supplémentaires sont **copiés** dans un nouveau site (rien n'est supprimé).

## Développement local

```bash
npm install
```
```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/panneau npm run dev
```
Le serveur `scripts/dev-server.mjs` émule Vercel (statique + `api/`) sur http://localhost:3000 et utilise `pg` quand la base est locale.

```bash
npm test
```

## Applications mobiles (iOS et Android)

Le dossier `mobile/` est un projet Capacitor 8 qui embarque l'interface de `public/` (démarrage direct sur l'espace connecté) et appelle l'API de production.

```bash
cd mobile && npm install
```
```bash
API_URL=https://gestion-panneau-siemens.vercel.app npm run android
```
```bash
API_URL=https://gestion-panneau-siemens.vercel.app npm run ios
```
- Android : Android Studio, puis *Build → Generate Signed Bundle* pour Google Play.
- iOS : Xcode sur macOS (compte Apple Developer), *Product → Archive* pour l'App Store.
- Identifiant d'application : `xyz.nathanbegin.monpanneau` (modifiable dans `mobile/capacitor.config.json` avant la première publication).
- Icônes et écran de démarrage : `npm run assets` (à partir de `mobile/assets/`).
- Le serveur autorise les origines Capacitor (`capacitor://localhost`, `https://localhost`) en CORS.

## Avertissement
L'application ne contrôle ni ne mesure l'installation. Les documents sont indicatifs et ne remplacent pas une inspection par un maître électricien.
