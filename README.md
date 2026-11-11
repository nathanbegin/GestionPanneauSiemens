# Disjonio — v2.2.0

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

- **Vue réaliste du panneau** (onglet Panneau → « Schéma / Réaliste », préférence gardée sur l'appareil) : boîtier en acier avec vis, plaque intérieure, étiquette du fabricant avec le **logo de la marque du panneau** (texte si aucun logo), disjoncteur principal ou cosses, colonnes numérotées, disjoncteurs simples, doubles et triples (manettes reliées), jumelés, obturateurs ; **DDFT** = bouton TEST blanc + fil témoin blanc vers la barre de neutre, **anti-arc** = bouton TEST bleu, combiné = violet ; témoin de statut (vert, ambre, gris) ; désignations de part et d'autre (désactivées par défaut sur téléphone). Toucher un disjoncteur ouvre sa fiche. `public/js/panelreal.js`.
- **Équipes** (forfaits avec `features.team`, places = `seats`, propriétaire compris) : menu → « 👥 Mon équipe ». Le propriétaire invite par lien (valide 14 jours, à usage unique, envoyé par courriel si configuré), se rend visible dans l'**annuaire**, accepte ou refuse les demandes, retire des membres. Un employé se crée un compte gratuit, puis ouvre le lien d'invitation ou cherche son électricien dans l'annuaire et demande à rejoindre (aussi proposé dans « Mon abonnement »). Un membre actif profite du forfait du propriétaire (fonctions et quota de panneaux partagés) ; chacun garde ses sites. Tables `app_team_members`, `app_team_invites`, colonne `app_users.team_public`.
- **Partage dans l'équipe** : bouton « 👥 Partager » sur un site (avec tous ses panneaux, actuels et futurs) ou sur un panneau ; avec toute l'équipe ou un membre ; en lecture seule ou en modification. Le propriétaire seul peut supprimer ou repartager ; un panneau créé dans un site partagé appartient au propriétaire du site (quota de l'équipe). L'accès cesse dès que la personne quitte l'équipe. Rapports, étiquettes et PDF fonctionnent pour les ressources partagées. Table `app_shares`, contrôles dans `api/_lib/shares.js`. « Mon équipe » affiche le quota de l'équipe et les panneaux actifs / créés dans la période pour chaque personne.
- **Suggestions d'amélioration** : menu du compte → « 💡 Suggérer une amélioration » (suggestion, problème, question ou autre ; page, version et appareil joints automatiquement ; 10 envois par heure au maximum). Console → **Suggestions** : filtre par statut (nouvelle, à l'étude, planifiée, faite, refusée), note interne, lien vers la fiche de l'abonné ; le tableau de bord affiche le nombre de suggestions nouvelles. Table `app_feedback`.
- **Mode guidé (questions)** — gratuit, sans IA. Sur la page d'un site : « 🧭 Mode guidé ». L'application pose des questions simples (type de panneau, marque et gamme, disjoncteur principal, nombre de positions), puis décrit chaque position : simple, double, jumelé, triple, espace vide ou « je ne sais pas », calibre inscrit sur la manette, désignation (avec suggestions et catégorie déduite) et bouton TEST (DDFT / anti-arc). Le dessin du panneau se construit à chaque réponse ; les 2es pôles sont sautés automatiquement ; on peut revenir en arrière, toucher un disjoncteur du dessin pour corriger, ou déclarer « les positions restantes sont vides ». Vérification finale : appareils courants (cuisinière, sécheuse, chauffe-eau, plinthes, thermopompe, borne, spa…) sans disjoncteur attribué, appareils 240 V sur un disjoncteur simple. Brouillon conservé dans le navigateur (« Reprendre là où vous étiez »). Logique dans `public/guided.js` (testée), interface dans `public/js/guided.js`.
- **Mode guidé → modèles de disjoncteurs** (forfaits avec la bibliothèque, ou administrateurs) : après la vérification des appareils, les disjoncteurs identiques (format, calibre, protection) sont regroupés et les modèles compatibles de la bibliothèque sont proposés (même famille, neutre enfichable selon le panneau). Un clic attribue un modèle à tout le groupe ; « Les attribuer automatiquement » traite les groupes qui n'ont qu'un seul modèle compatible. Si la gamme du panneau est inconnue, elle est demandée. Le dessin adopte l'apparence des modèles choisis.
- **IA + questions** : sur l'écran de confirmation de l'assistant IA, « 🧭 Questions sur les points incertains » pose les mêmes questions uniquement pour les positions à faible confiance ou sans désignation.
- **Ajout de panneau par photo (IA)** — forfaits payants. Sur la page d'un site : « 📷 Ajouter par photo (IA) ». Photos du panneau ouvert, de l'étiquette du fabricant et du répertoire, ou fichier récapitulatif (PDF, CSV, texte). L'IA lit la marque, la gamme, le principal, le nombre de positions et chaque disjoncteur (position, pôles, jumelé, calibre, DDFT/anti-arc, désignation). L'utilisateur confirme l'identification, voit le panneau se construire disjoncteur par disjoncteur, corrige au besoin, puis confirme « c'est la configuration en place » avant la création. Les circuits peu sûrs restent « À confirmer ».
  - Variables Vercel : `OPENAI_API_KEY` (obligatoire), `OPENAI_MODEL` (facultatif : un modèle ou une liste séparée par des virgules ; par défaut `gpt-6.1-terra`, le modèle d'OpenAI dédié au raisonnement visuel, 1 $ / 5 $ US par million de jetons, puis repli automatique sur `gpt-6-astra`, `gpt-6-luna`, `gpt-6.1-sol`, `gpt-5.6-terra` et `gpt-5.4-mini` si le projet OpenAI n'a pas accès au précédent ; un modèle refusé est réessayé après 10 minutes, ce qui couvre le délai d'activation chez OpenAI), `OPENAI_IMAGE_DETAIL` (défaut `high` ; `original` pour les très petites étiquettes).
  - **Console → Intelligence artificielle** : ordre des modèles (cocher, monter, descendre, ajouter un identifiant), bouton « Tester l'accès » par modèle, niveau de détail des photos, utilisation et coût estimé sur 30 jours. Ce réglage (table `app_settings`) a priorité sur `OPENAI_MODEL` et s'applique dès la prochaine analyse, sans redéploiement.
  - Quota : 100 analyses par mois (forfaits Électricien), 20 (autres forfaits payants) ; réglable par forfait avec `features.aiScans` dans la console. Journal dans `app_ai_scans` (jetons consommés). Les photos ne sont pas conservées (`store:false`).
  - **Photos de précision** : depuis l'écran de confirmation, « 📷 Ajouter des photos pour préciser ». L'IA reçoit la configuration déjà établie (les corrections de l'utilisateur sont protégées) et la complète ; les circuits ajoutés ou modifiés sont marqués. L'assistant s'ouvre en grand (presque toute la largeur de l'écran).
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
- **Stripe sans SDK** (`api/_lib/stripe.js`, dernière version d'API `2026-10-28.endive`, modifiable avec `STRIPE_API_VERSION` ; les deux formes d'objets facture sont gérées) : Checkout (abonnement ou paiement unique), changement de forfait au prorata, portail client (carte, factures, annulation), produits et prix créés automatiquement à l'enregistrement d'un forfait. Un prix modifié crée un nouveau prix Stripe : les abonnés existants conservent l'ancien.
- **Webhook** `POST /api/stripe-webhook` : signature vérifiée, idempotent. Événements : `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_failed`, `charge.refunded`.
- **Mobile** : pas d'achat dans l'application (règles Apple/Google). Les boutons ouvrent la page web.

### Codes promo (sans paiement)
Variable Vercel `PROMO_CODES`, codes séparés par des virgules, insensibles à la casse (4 caractères minimum) :
- `MONCODE` → forfait caché **Accès complet** (toutes les fonctions, panneaux et sites illimités), sans date de fin ;
- `ESSAI:electricien-solo:90` → forfait Électricien Solo pendant 90 jours.

L'utilisateur entre le code dans *Mon abonnement*. Fonctionne sans Stripe. Tentatives limitées, utilisation inscrite au journal de la console. Retirer un code de la variable empêche les nouvelles utilisations ; pour retirer l'accès à quelqu'un, annulez son forfait dans la console.

### Activer Stripe (le moment venu)
1. **Bac à sable (sandbox)** : dans Stripe, créer un *sandbox* dédié au développement (plutôt que le mode test partagé). Tout le paramétrage ci-dessous se fait d'abord dans ce sandbox.
2. **Clé restreinte** (recommandée plutôt qu'une clé secrète `sk_…`) : Développeurs → Clés API → *Créer une clé restreinte* `rk_…` avec seulement ces permissions en **écriture** : Customers, Checkout Sessions, Products, Prices, Subscriptions, Customer portal, Refunds ; en **lecture** : Charges, Invoices, Payment Intents. Ajouter une politique d'accès (restriction d'IP) si possible.
3. **Vercel** → Environment Variables, en cochant **Sensitive** (valeur non lisible après enregistrement) : `STRIPE_SECRET_KEY` (la clé `rk_test_…`), `STRIPE_WEBHOOK_SECRET`, et `STRIPE_TAX=1` seulement une fois l'inscription fiscale active. Utiliser des clés différentes pour Preview et Production.
4. **Webhook** : Développeurs → Webhooks → `https://VOTRE-DOMAINE/api/stripe-webhook`, événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`, `radar.early_fraud_warning.created`. Copier le secret de signature dans `STRIPE_WEBHOOK_SECRET`. Les litiges et alertes de fraude apparaissent dans **Console → Journal**.
5. **Taxes (TPS/TVQ)** : Stripe Tax ne perçoit **aucune** taxe tant qu'une inscription n'est pas active (sans erreur). Ajouter les inscriptions Canada (TPS/TVH) et Québec (TVQ) dans Stripe Tax → Inscriptions, *puis* `STRIPE_TAX=1`. Les prix sont « taxes en sus » (`tax_behavior: exclusive`).
6. **Portail client** : Paramètres → Portail client : autoriser l'annulation, la mise à jour de la carte et l'historique des factures ; activer les courriels de rappel avant renouvellement.
7. Dans la console, ouvrir et enregistrer chaque forfait payant : les produits (un par forfait) et prix (mensuel / annuel) Stripe sont créés automatiquement.
8. Tester avec la carte `4242 4242 4242 4242` (et `4000 0000 0000 0341` pour un échec de renouvellement), puis créer la clé restreinte et le webhook **en mode production** (`rk_live_…`) avant le lancement — voir la liste de contrôle « Go live » de Stripe.

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

## Langue de l'interface (français / anglais)

Le bouton **FR / EN** (barre du haut de l'application et en-tête des pages publiques) change la langue. À la création du compte, un champ « Langue / Language » la fixe ; elle se modifie dans **Mon compte → Langue** et se retrouve sur tous les appareils (profil du compte). Elle détermine aussi la langue des **PDF** et des **courriels**.

- **Interface :** le code est écrit en français ; en anglais, `public/i18n.js` traduit à la volée chaque texte affiché (texte, placeholder, title, aria-label, boîtes natives, nombres et dates) d'après les dictionnaires `public/i18n-en.js` (application), `i18n-en-docs.js` (PDF, guide, pages publiques) et `i18n-en-admin.js` (console). Les blocs HTML des pages publiques sont traduits d'un seul tenant (clé = HTML normalisé).
- **PDF :** `api/_lib/pdf.js` traduit tout texte dessiné (`Doc.safe`) avec les mêmes dictionnaires ; la langue vient du paramètre `lang` du lien signé (langue courante de l'interface).
- **Courriels :** `api/_lib/mail-text.js` (réinitialisation du mot de passe, invitation, demande d'équipe) selon `profile.lang` du destinataire.
- **Ajouter une phrase :** une ligne `["texte français", "English text"]` au bon dictionnaire (`{}` = valeur variable, `{1}`, `{2}` pour réordonner) ; sans entrée, le texte reste en français. Un test vérifie la cohérence des dictionnaires.
- Les données saisies par l'utilisateur ne sont pas traduites (seuls les textes connus du dictionnaire changent).

## Connexion avec Google et Microsoft (SSO)

Module **autonome et amovible**, ajouté au système de comptes existant (scénario « B ») : les comptes, mots de passe, sessions (`mp_session`), forfaits et identifiants (`uuid`) ne changent pas.

**Activation** : renseigner `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` et/ou `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` (voir `.env.example`). Déclarer chez le fournisseur l'URI de redirection `https://VOTRE-DOMAINE/sso/callback/google` (ou `/microsoft`). Sans variables, rien n'apparaît dans l'interface.

**Fonctionnement** : flux OpenID Connect « code d'autorisation » + PKCE, jeton d'identité validé localement (signature RS256, émetteur, audience, expiration, nonce). Une table `app_identities(provider, subject, user_id)` lie l'identité externe à `app_users`. Règles (`api/_lib/sso/decide.js`) :
- identité déjà liée → connexion ;
- courriel **vérifié** correspondant à un compte existant → liaison automatique ; courriel non vérifié → refus (anti prise de contrôle) ;
- sinon → création d'un compte sans mot de passe (acceptation des conditions affichée sous les boutons) ;
- Microsoft : le courriel n'est jugé vérifié que pour les comptes personnels ou si `xms_edov` l'atteste.
« Mon compte → Connexions externes » permet de lier/retirer ; on ne peut retirer la dernière connexion d'un compte sans mot de passe. Un compte créé par SSO peut définir un mot de passe via « Mot de passe oublié ». Supprimer un tel compte demande de taper SUPPRIMER.

**Limites** : application native (Capacitor) non incluse pour l'instant (boutons masqués) ; Apple à venir (jeton client signé + `form_post`, il faudra un cookie `SameSite=None`).

**Retirer le module (ex. migration vers Neon Auth)** :
1. supprimer `api/_lib/sso/`, `public/js/sso.js` et `test/sso.test.js` ;
2. retirer toutes les lignes marquées `// SSO` (`grep -rn "// SSO" api public`) : 1 import + 1 appel dans `api/auth.js`, 5 lignes dans `public/js/app.js` ;
3. retirer la réécriture `/sso/callback/:provider` de `vercel.json` et `/js/sso.js` de `public/sw.js` ;
4. (facultatif) `DROP TABLE app_identities;`. Les comptes SSO restent des lignes `app_users` avec courriel : ils pourront se réidentifier par courriel chez le nouveau fournisseur.

Pour **ajouter Apple ou un autre fournisseur** : une entrée dans `api/_lib/sso/providers.js`.

## Mode hors ligne (consultation)

« Rendre disponible hors ligne » (page d'un site) conserve le site et tous ses panneaux dans IndexedDB, sur l'appareil seulement (`public/js/offline.js`). Sans réseau, l'application s'ouvre (service worker), affiche un bandeau « Hors ligne » et sert ces copies pour la lecture : liste des sites téléchargés, panneaux, circuits, nomenclature, charges.

- **Pas encore possible hors ligne** : modifier (l'enregistrement échoue avec « Réessayer »), générer des PDF, analyser des photos.
- Les copies sont effacées à la déconnexion et si un autre compte se connecte sur l'appareil.
- Rafraîchir une copie : bouton « 📥 Hors ligne ✓ » → Actualiser.

## Corbeille et historique des versions

- **Corbeille** : supprimer un site ou un panneau le déplace 30 jours dans `app_trash` (copie JSON, historique inclus) avant l'effacement définitif; « 🗑 Corbeille » (page Mes sites) restaure ou supprime pour de bon. La restauration respecte les limites du forfait. Les partages d'un site supprimé ne sont pas restaurés.
- **Historique** : chaque enregistrement d'un panneau crée un instantané (`app_panel_history`), regroupé par rafales de 10 minutes pour une même personne; 60 versions gardées. « ⋯ Plus d'actions → 🕘 Historique » montre qui a changé quoi, remet l'ancienne valeur d'un circuit ou restaure tout le panneau (la restauration est elle-même une nouvelle version).

## Remise au client, démonstration et liste « À terminer »

- **Remettre au client** (page d'un site, forfaits Électricien) : « Accès en consultation » (lecture seule, distinct de l'équipe, révocable : table `app_handoffs`, accès via `siteAccess`/`panelAccess`) ou « Copie du dossier » (copie indépendante du site et des panneaux dans le compte du destinataire après acceptation, limites de forfait respectées). L'invitation est liée à l'adresse courriel du client; lien valide 14 jours; courriel envoyé si Resend est configuré, sinon lien à copier. Code : `api/_lib/handoff.js`, `public/js/handoff.js`.
- **Démonstration** : `/app#/demo` (sans compte) charge un faux serveur en mémoire (`public/js/demo.js`, données `demo-data.js` générées par `node scripts/build-demo.mjs`); rien n'est envoyé ni enregistré. Le rapport d'exemple est `public/assets/exemple-rapport.pdf` (`node scripts/build-sample.mjs`).
- **À terminer** : bouton « ✅ À terminer » sur un panneau (circuits sans description, à vérifier sur place, sans calibre, fiche incomplète, appareils non reliés, alertes de calcul), chaque point ouvrant la correction (`public/js/checklist.js`).

## Disposition d'édition (bureau, tablette, téléphone)

- **Deux zones** dès 900 px (ou 721 px en paysage) : panneau à gauche, fiche du circuit à droite (largeur redimensionnable en glissant la poignée, mémorisée). La liste des circuits est masquée pendant l'édition (bouton « ☷ Liste » pour y revenir); l'en-tête se réduit à une pastille d'étape et au menu d'actions.
- Le **circuit en cours** est entouré de bleu (distinct des couleurs de statut) et suit « Enregistrer et suivant »; le cadrage « Circuits » est privilégié pendant l'édition et rétabli à la fermeture; « Ajuster » et « Centrer » sont dans la barre du panneau.
- **Positionnement mesuré** : `--chrome-h` (hauteur réelle de l'en-tête, barres démo/hors ligne comprises) est calculée dans `public/js/app.js` (`syncChrome`).
- **Téléphone** : fiche plein écran avec un repère du circuit actif et de ses voisins; « ▦ Panneau » ouvre un aperçu temporaire du panneau.

## Police du site et identité visuelle

- **Police** : Manrope (identité Disjonio, par défaut) ou Inter, hébergées dans `public/fonts/` (licence OFL, `@font-face` dans `mp.css`), ou la police du système. Réglage : **Administration → Site** (stocké dans `app_settings` clé `site`, renvoyé par `GET /api/auth` et appliqué par `public/js/sitefont.js` sur l'application et les pages publiques).
- **Logo** : `public/branding/disjonio/` (kit d'identité). Le symbole est dans l'en-tête, les icônes PWA/mobiles (`node scripts/icons.mjs`) et le pied de page des PDF (`node scripts/brandmark-png.mjs` régénère `api/_data/brandmark.js`).

## Progression des analyses par IA

`public/js/aiprogress.js` : barre de progression, étapes cochées, temps écoulé et résultats qui apparaissent un à un (circuits lus, champs de la plaque). L'**envoi** des photos est mesuré pour de vrai (`apiProgress` dans `api.js`, XHR) ; l'**attente de l'IA** est estimée (sa durée réelle n'est pas connue d'avance, la barre plafonne à ~94 % jusqu'à la réponse). Utilisée pour la plaque signalétique d'un électroménager et l'ajout d'un panneau par photos (et photos de précision).

## Base de données : migrations et performance

- **Migrations versionnées** (`api/_lib/db.js`) : `SCHEMA_VERSION` + table `app_schema_version`. Un démarrage à froid ne fait que 2 requêtes quand le schéma est à jour ; les ~35 instructions (`runMigrations`, idempotentes) ne s'exécutent qu'une fois par version. **Quand on ajoute une table, une colonne ou un index : l'ajouter à `runMigrations` et augmenter `SCHEMA_VERSION`.** `npm run migrate` (avec `DATABASE_URL`) les applique à la main, par exemple avant un déploiement.
- **Index** : panneaux par utilisateur, clients et abonnements Stripe, partages, invitations (courriel), crédits, événements de quota.
- **Recherche globale** : le filtrage (insensible à la casse et aux accents courants) se fait dans PostgreSQL ; seuls les panneaux pouvant correspondre (300 au plus) sont chargés et détaillés.
