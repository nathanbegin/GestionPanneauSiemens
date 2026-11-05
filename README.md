# Mon Panneau — v2.2.0

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

## Planification et calcul de charges (v2.2)

Réservé aux forfaits dont la fonction « planification » est activée (Électricien Solo et Équipe) et aux administrateurs.

- `public/catalog.js` : bibliothèque de charges typiques (bornes niveaux 1 et 2, thermopompes, plinthes, fournaises, chauffe-eau, piscine, spa, cuisinière, sécheuse…), guide des bornes niveaux 1/2/3, 22 modèles de panneaux courants (Siemens, Square D, Eaton, Cutler-Hammer, Leviton, Federal Pioneer), familles de disjoncteurs avec références **indicatives**, table des fils de cuivre.
- `public/loadcalc.js` : charge par circuit, règle des 80 % pour les charges continues, disjoncteur et fil suggérés, phases L1/L2 (rangées alternées), capacité du panneau, calcul de charge d'un logement inspiré de la règle 8-200 (charge de base, chauffage 100 %/75 %, climatisation, cuisinière 6000 W + 40 %, 100 % pour piscine/spa/instantané/bornes, 25 % des autres charges), charges des sous-panneaux, suggestions et liste de matériel.
- Interface : choix du modèle dans la fiche du panneau (superficie habitable, état Existant/Planifié/Installé/Vérifié), section « Planification » dans la fiche de circuit (disjoncteur du catalogue, charges, conducteur, calcul en direct), onglet « Planification et charges », PDF « Bilan de charges et matériel » (`kind=loads`).
- ⚠ Toutes les valeurs du catalogue (modèles, références, charges) sont à valider par un maître électricien et selon les fiches des fabricants avant une utilisation professionnelle.

## Abonnements (v2.1)

| Forfait | Prix (CAD, taxes en sus) | Limite | Quota |
| --- | --- | --- | --- |
| Gratuit | 0 $ | 5 panneaux, 2 sites | actifs |
| Propriétaire | 3,99 $/mois · 29 $/an | 10 panneaux, 3 sites | actifs |
| Gestionnaire d'immeuble | 24 $/mois · 240 $/an | 150 panneaux, 3 utilisateurs | actifs |
| Électricien Solo | 34 $/mois · 340 $/an | 25 panneaux | nouveaux / mois |
| Électricien Équipe | 89 $/mois · 890 $/an | 120 panneaux, 5 utilisateurs | nouveaux / mois |
| Forfait de panneaux | 29 $ | 10 panneaux valables 12 mois | crédits |

Ces valeurs sont insérées au premier démarrage, puis **se modifient dans la console** (`/app#/admin`, réservée aux courriels de `ADMIN_EMAILS`).

- **Limites appliquées côté serveur** à la création d'un panneau ou d'un site (HTTP 402). Quand le forfait est épuisé, un crédit prépayé est utilisé. Aucune donnée n'est jamais supprimée ni bloquée en lecture.
- **Console** : tableau de bord (revenu mensuel récurrent estimé, abonnés, annulations), recherche d'abonnés, fiche abonné (attribuer un forfait offert avec date de fin, changer le forfait Stripe avec ou sans prorata, limite personnalisée, offrir des panneaux, annuler à la fin de la période ou immédiatement, réactiver, **rembourser en totalité ou en partie**), édition des forfaits et des forfaits de panneaux, journal de toutes les actions.
- **Stripe sans SDK** (`api/_lib/stripe.js`, version d'API figée `2024-06-20`) : Checkout (abonnement ou paiement unique), changement de forfait au prorata, portail client (carte, factures, annulation), produits et prix créés automatiquement à l'enregistrement d'un forfait. Un prix modifié crée un nouveau prix Stripe : les abonnés existants conservent l'ancien.
- **Webhook** `POST /api/stripe-webhook` : signature vérifiée, idempotent. Événements : `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_failed`, `charge.refunded`.
- **Mobile** : pas d'achat dans l'application (règles Apple/Google). Les boutons ouvrent la page web.

### Activer Stripe (le moment venu)
1. Créer le compte Stripe (entreprise, compte bancaire canadien), puis activer **Stripe Tax** (inscriptions TPS/TVQ) si applicable.
2. Dans Vercel : `STRIPE_SECRET_KEY` (commencer par `sk_test_…`), `ADMIN_EMAILS`, et `STRIPE_TAX=1` si Stripe Tax est activé.
3. Dans Stripe → Développeurs → Webhooks : ajouter `https://VOTRE-DOMAINE/api/stripe-webhook` avec les 6 événements ci-dessus, puis copier le secret dans `STRIPE_WEBHOOK_SECRET`.
4. Stripe → Paramètres → Portail client : autoriser l'annulation, la mise à jour de la carte et l'historique des factures. Activer les courriels de rappel avant renouvellement.
5. Dans la console, ouvrir et enregistrer chaque forfait payant : les produits et prix Stripe sont créés automatiquement.
6. Tester avec la carte `4242 4242 4242 4242`, puis passer aux clés `sk_live_…` (et recréer le webhook en mode production).

> Vercel Hobby interdit l'usage commercial et limite à 12 fonctions (l'application en compte 12) : passer au forfait **Vercel Pro** avant d'encaisser des paiements.

## Architecture

- `public/` : site statique + application (JavaScript natif en modules, sans étape de compilation). `public/model.js` est partagé par le navigateur, le serveur et le mobile.
- `api/` : fonctions Vercel (Node 22). `auth`, `account`, `sites`, `panels`, `report`, `etiquettes`, `billing`, `stripe-webhook`, `admin` (+ routes v1 `panel`, `panel-live`, `panels-manager`). Le code commun est dans `api/_lib/` (non exposé).
- Base PostgreSQL (Neon) : tables `app_users`, `app_sessions`, `app_resets`, `app_rate`, `app_sites`, `app_panels`, `app_plans`, `app_packs`, `app_subscriptions`, `app_credits`, `app_panel_events`, `app_stripe_events`, `app_admin_audit`, créées automatiquement. Les tables v1 (`panel_state`, `panels_extra`…) ne sont pas modifiées.
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
