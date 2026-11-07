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

## Ajout par photo (IA), actions groupées et PDF à votre image (v2.6)

- **Ajout de panneau par photo (IA)** — forfaits payants. Sur la page d'un site : « 📷 Ajouter par photo (IA) ». Photos du panneau ouvert, de l'étiquette du fabricant et du répertoire, ou fichier récapitulatif (PDF, CSV, texte). L'IA lit la marque, la gamme, le principal, le nombre de positions et chaque disjoncteur (position, pôles, jumelé, calibre, DDFT/anti-arc, désignation). L'utilisateur confirme l'identification, voit le panneau se construire disjoncteur par disjoncteur, corrige au besoin, puis confirme « c'est la configuration en place » avant la création. Les circuits peu sûrs restent « À confirmer ».
  - Variables Vercel : `OPENAI_API_KEY` (obligatoire), `OPENAI_MODEL` (défaut `gpt-6.1-terra`, le modèle d'OpenAI dédié au raisonnement visuel, 1 $ / 5 $ US par million de jetons ; `gpt-6-astra` pour les cas difficiles), `OPENAI_IMAGE_DETAIL` (défaut `high` ; `original` pour les très petites étiquettes).
  - Quota : 100 analyses par mois (forfaits Électricien), 20 (autres forfaits payants) ; réglable par forfait avec `features.aiScans` dans la console. Journal dans `app_ai_scans` (jetons consommés). Les photos ne sont pas conservées (`store:false`).
  - Photos réduites à 2000 px dans le navigateur ; 6 fichiers et 3 Mo au total par analyse.
- **Actions groupées** (onglets Panneau et Nomenclature) : « ☑ Sélection multiple », sélection rapide (filtrés, positions vides, à confirmer), puis espace inutilisé (aucun disjoncteur), disjoncteur libre, statut, calibre, protection, usage, pièce ou effacement.
- **PDF à l'image de l'entreprise** (forfaits avec `branding`) : dans « Mon compte », logo (PNG/JPEG redimensionné), couleur principale, couleur d'accent et pied de page, appliqués à tous les PDF. Le contraste est ajusté automatiquement (texte foncé sur en-tête clair).
- **Entrée électrique** : calibre, matériau et type des conducteurs entre le point de raccordement d'Hydro-Québec et le panneau, avec vérification indicative.

## Generac, calcul de charge expliqué et note de calcul (v2.5)

- **Generac** (`api/_data/generac.js`, sources : fiches officielles HomeLink 0L1648-G et 6377, pages produit Generac, distributeurs pour les modèles abandonnés) : HomeLink 30 A (6852, 6853, 6854) et 50 A (9854, 9855) acceptant les disjoncteurs 1" Siemens, Eaton et Square D ; inverseurs manuels 6377, 6376, 6378 ; inverseurs automatiques avec centre de distribution RXG16EZA1, RXG16EZA1W, RXG16EZA3 ; inverseurs automatiques maison entière RXSW/RXSC (dont RXSW200A3CUL approuvé au Canada) et trousse 6869, affichés à titre informatif (aucun espace de dérivation).
- **Calcul de charge expliqué** : page publique `/calcul-de-charge` (étapes, ce qui est compté ou exclu, exemple complet calculé par le moteur de l'application), contenu partagé dans `public/loadguide.js`. Superficie du sous-sol comptée à 75 % (8-110). Dans l'onglet Planification, chaque étape s'ouvre : explication, appareils comptés, couverts par la charge de base ou exclus, règle du Code.
- **Note de calcul PDF** (`kind=calc`) : résultat et verdict sur le principal installé, méthode, chaque étape (règle, explication, formule, appareils), total, points à corriger, autres règles (80 %, fils, marge), références et avertissement, signature.
- **PDF** : logo du fabricant et ligne « Modèle » dans les en-têtes, l'étiquette du panneau et le rapport de site.

## Attribution des modèles et liaison des sous-panneaux (v2.4)

- **Attribuer les modèles** (onglet Planification, abonnés) : les fiches sont regroupées en disjoncteurs physiques (`public/units.js` : unipolaire, bipolaire, tripolaire, jumelé, quad, y compris les bipolaires sur demi-emplacements « 1B / 3A »). Modèles proposés selon le format, les calibres et la protection, neutre enfichable en premier si le panneau en a une barre.
  - *Un à un* : un clic sur le modèle l'attribue et passe au suivant ; Passer, Précédent, Retirer le modèle.
  - *Par groupe identique* : groupes par format, calibres et protection ; sélection (tout, sans modèle seulement) et attribution en lot.
- **Sous-panneaux** : un circuit dont l'usage est « Sous-panneau » propose de le lier à un panneau du site, de créer le sous-panneau tout de suite (pré-rempli et relié), ou de le relier plus tard depuis la fiche du sous-panneau (le champ « Circuit d'alimentation » propose les circuits du panneau source). La liaison est vérifiée côté serveur (même site, aucune boucle).

## Bibliothèque de produits et concepteur visuel (v2.3)

- Données fournies par l'administrateur (`api/_data/catalogue.js`, issues des catalogues canadiens Schneider/Square D, Siemens, Eaton et Leviton) : 332 panneaux, 680 disjoncteurs, 7 familles (QO, HomeLine, Siemens, BR, CH, Leviton, CBM), anciennes marques, génératrices, parasurtenseurs, sources.
- **Réservée aux abonnés** (fonction « planification » ou administrateur) : servie seulement par `GET /api/panels?catalog=1` (402 sinon). Le choix d'un modèle est vérifié et réécrit côté serveur (circuits maximaux, jumelés, neutre enfichable).
- Sélecteur visuel de modèle (filtres marque, type, ampérage, numéro, générations précédentes) avec miniature réelle du panneau.
- Rendu SVG réaliste : boîtier, plaque frontale, principal ou cosses, barres omnibus, couleurs et pas (3/4" ou 1") par famille, boutons TEST (anti-arc, DDFT, double fonction, protection d'équipement), queues de cochon, témoin des disjoncteurs intelligents, jumelés et quads.
- Palette de disjoncteurs filtrée par famille, format, protection et calibre ; placement par clic sur les positions libres valides, contrôle de compatibilité (famille, PoN, jumelés).
- Logos : déposer les logos officiels autorisés dans `public/assets/brands/` (voir `LISEZMOI.md`) ; sinon le nom de la marque s'affiche.

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

### Codes promo (sans paiement)
Variable Vercel `PROMO_CODES`, codes séparés par des virgules, insensibles à la casse (4 caractères minimum) :
- `MONCODE` → forfait caché **Accès complet** (toutes les fonctions, panneaux et sites illimités), sans date de fin ;
- `ESSAI:electricien-solo:90` → forfait Électricien Solo pendant 90 jours.

L'utilisateur entre le code dans *Mon abonnement*. Fonctionne sans Stripe. Tentatives limitées, utilisation inscrite au journal de la console. Retirer un code de la variable empêche les nouvelles utilisations ; pour retirer l'accès à quelqu'un, annulez son forfait dans la console.

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
