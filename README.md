# VORA — Plateforme de Mobilité Urbaine & VTC Intelligente (Contexte Africain)

<div align="center">

![VORA Banner](https://img.shields.io/badge/VORA-Mobilite%20Securisee-0EA5E9?style=for-the-badge&logo=uber&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.74-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Expo Router](https://img.shields.io/badge/Expo_Router-v3-000000?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express_API-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_DB-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![AI Powered](https://img.shields.io/badge/IA-Natural_Language_Geocoding-8E44AD?style=for-the-badge&logo=google&logoColor=white)

**Développé par l'équipe TEAM-VANGUARD pour le Nuxcine Hackathon**

</div>

---

## Presentation du Projet

**VORA** est une plateforme moderne de transport urbain (VTC / Moto-taxi / Voiture) spécifiquement conçue pour le contexte africain et camerounais. Elle résout les défis majeurs des métropoles africaines :
- L'absence d'adressage postal formel compensée par une IA d'analyse des repères informels.
- La sécurité des passagers et des chauffeurs grâce à des identifiants anonymisés (`VORA-XXXXXX`) et la vérification d'identité Didit KYC.
- Le géofencing strict intra-urbain (aucune course ne sort de sa ville d'origine).
- La tarification équitable adaptée au contexte local (règles strictes moto, tarifs de nuit, surge pricing).
- Le dispatch séquentiel en cascade au plus proche avec compte à rebours de 20 secondes.
- Le paiement sécurisé par Mobile Money (MTN MoMo, Orange Money via CamerPay) et portefeuille in-app.

Elle combine un **Frontend Web & Mobile sous React Native & Expo Router** (`/mobile`) avec un **Backend Node.js/Express résilient connecté à PostgreSQL / Neon Serverless** (`/backend`).

---

## Fonctionnalités Majeures & Innovations VANGUARD

### 1. Geolocalisation par IA & Reperes Informels Camerounais
- Au Cameroun, l'adressage formel par numéros de rue est quasi-inexistant. Les résidents utilisent des repères informels (*"derrière la pharmacie Mvog-Ada"*, *"en face de la boulangerie à Bastos"*, *"au carrefour Mokolo"*).
- VORA utilise un moteur d'IA basé sur Google Gemini API croisé avec une base locale de repères camerounais pour convertir ces expressions en coordonnées GPS réelles.
- Interface de recherche nettoyée : affichage exclusif de lieux et de repères physiques clairs.

### 2. Geofencing Strict Intra-Urbain (Toutes les Villes du Cameroun)
- **Règle stricte** : Une course VORA ne peut **JAMAIS** sortir du périmètre urbain de la ville où elle a débuté.
- S'applique à toutes les villes du Cameroun : Yaoundé, Douala, Bafoussam, Garoua, Bamenda, Maroua, Kribi, Limbe, Buea, etc.
- Double validation (client et serveur) avec rejet immédiat des trajets interurbains ou dépassant le rayon urbain maximal autorisé (28 km).

### 3. Regles de Capacite & Tarification Moto (Bendskin)
- **Règle de capacité stricte** :
  - Avec bagages (1 bagage ou plus) : **Maximum 1 passager**.
  - Sans bagages : **Maximum 2 passagers**.
- **Tarif Nuit Moto** : Les tarifs de la catégorie Moto **doublent automatiquement après 18h00** (de 18h00 à 06h00) avec affichage d'un badge NUIT explicite.
- Validation préventive côté interface et validation bloquante côté serveur (erreur HTTP 400).

### 4. Reservation pour Autrui ("Commander pour un Proche")
- Possibilité de commander une course pour une tierce personne tout en **conservant l'intégralité du suivi GPS et de l'état du trajet en temps réel**.
- Validation stricte des données : nom complet obligatoire et numéro de téléphone camerounais valide (`+237 6xx / 2xx`).
- Le chauffeur est notifié des coordonnées du passager bénéficiaire pour une prise en charge sans friction.

### 5. Carte Zoomee & Suivi Vehicule en Temps Reel
- Intégration d'une cartographie dynamique OpenStreetMap / Leaflet avec un niveau de zoom rapproché (niveau 15-16) permettant de distinguer nettement les noms des quartiers camerounais (Mokolo, Bastos, Tsinga, Deido, Bonanjo...) et les carrefours.
- Suivi en direct du véhicule du chauffeur (voiture ou moto) qui s'anime sur la carte du passager via WebSocket (`driver-location:${driverId}`).

### 6. Navigation Chauffeur en 2 Étapes, Appels In-App & Contrôle de l'Assistante Vocale VORA
- **Navigation en 2 étapes** :
  1. **Étape 1 (Vers le point de ramassage)** : La carte guide vers le client avec bouton *"Prendre en charge le client"* (émet `pickup-passenger`).
  2. **Étape 2 (Vers la destination finale)** : Dès la prise en charge, la carte bascule sur l'itinéraire de destination avec bouton *"Terminer la course"*.
- **Contrôle & Désactivation de l'Assistante Vocale VORA (Passager & Chauffeur)** :
  - Tant le passager que le chauffeur ont le **contrôle total pour activer ou couper l'assistante vocale** à tout moment.
  - **Côté Passager** : Bouton interactif direct sur l'écran de course (`confirm-ride.tsx`) avec statuts visuels (*Voix Active* / *Voix Coupée*) et commutateur dédié dans le profil usager (*Préférences & Accessibilité*).
  - **Côté Chauffeur** : Bouton rapide de coupure de voix dans le tableau de bord chauffeur et bouton flottant sur la carte GPS de navigation.
  - La préférence est automatiquement persistée localement et respectée pour toutes les synthèses vocales.
- **Appels Vocaux 100% In-App (VoIP & WebRTC)** :
  - Communication vocale directe intégrée sans redirection vers le composeur téléphonique du smartphone.
  - Sonnerie d'appel entrant cool et réaliste (Web Audio API à deux tonalités harmonieuses 440 Hz + 480 Hz).
  - Signalisation bidirectionnelle temps réel sur la room de course Socket.io (`webrtc-call-ride`, `webrtc-answer-ride`, `webrtc-hangup-ride`).
  - Décrochage, compteur d'appel en cours et raccrochage synchronisé instantanément pour les deux parties.

### 7. Cloture de Course & Notoriete du Chauffeur
- En fin de course, l'assistante VORA remercie le passager et l'invite à évaluer son trajet.
- Modale d'évaluation (`RideRatingModal`) permettant d'attribuer une note de 1 à 5 étoiles, des badges de compliments ("Conduite prudente", "Poli & Courtois", "Véhicule propre") et un retour texte.
- L'API `POST /api/rides/:id/rate` met à jour la course et **recalcule automatiquement la note moyenne et la notoriété du chauffeur** dans NeonDB.

### 8. Protection Stricte de Navigation & Authentification
- Les routes protégées de l'application (`/(root)`, `/(driver)`) disposent d'un garde d'authentification strict : tout utilisateur non inscrit ou non connecté est immédiatement redirigé vers l'écran d'accueil/onboarding (`/(auth)/welcome`).
- Les utilisateurs déjà connectés accèdent directement à l'accueil sans repasser par les écrans de bienvenue.

### 9. Page de Connexion Unique & Redirection Automatique Admin
- **Aucune page de connexion administrateur séparée** : Tous les utilisateurs (passagers, chauffeurs et administrateurs) utilisent la même page de connexion (`/(auth)/sign-in`).
- Si des identifiants administrateur sont saisis, le système vérifie automatiquement auprès de l'API backend et redirige l'utilisateur directement vers le panneau d'administration sécurisé (`/(admin)/dashboard`).
- Si les identifiants appartiennent à un passager ou un chauffeur, la connexion normale se poursuit vers leurs espaces respectifs.

### 10. Gestion des Comptes Administrateurs & Sécurité du Profil
- **Gestion des comptes administrateurs** : Interface dédiée permettant de lister tous les administrateurs enregistrés, d'en créer de nouveaux avec des rôles spécifiques (`ADMIN`, `SUPER_ADMIN`), et de révoquer les accès.
- **Modification du profil & mot de passe** : L'administrateur peut à tout moment mettre à jour son adresse email, son nom, et modifier son mot de passe de manière sécurisée directement depuis l'onglet *Mon Profil & Sécurité*.
- **Supervision des comptes usagers** : Vue centralisée de l'ensemble des passagers et chauffeurs avec leurs statuts de vérification, soldes et informations véhicules.

### 11. Photo du Véhicule Obligatoire pour les Chauffeurs
- Lors de l'enregistrement de son compte, le chauffeur doit **obligatoirement télécharger une photo de son véhicule**.
- Cette photo est transmise et affichée sur la carte de confirmation de course du passager (`confirm-ride.tsx`), lui permettant de reconnaître immédiatement la voiture ou la moto en approche lors de la prise de contact.

### 12. Photo de Profil Chauffeur Obligatoire avec Analyse Faciale par IA
- La photo de profil du chauffeur est strictement obligatoire.
- Pour certifier qu'il s'agit bien d'une véritable personne humaine (et non d'un objet, d'un paysage ou d'un véhicule), une **intelligence artificielle de vision par ordinateur** analyse automatiquement l'image avant de valider l'inscription.
- Le chauffeur reçoit un retour instantané dans l'interface confirmant la détection et la validation faciale.

### 13. Annulation de Course Passager avec Pénalité de Retard
- Bouton d'annulation intégré dans l'écran de suivi passager tant que la course est au statut `ACCEPTED`.
- Calcul automatique d'une pénalité de 500 FCFA déduite du portefeuille passager si l'annulation intervient plus de 2 minutes après l'acceptation par le chauffeur.

### 14. Suspension & Déblocage des Comptes Usagers
- L'administrateur peut à tout moment suspendre ou réactiver le compte d'un passager ou d'un chauffeur suspect.
- Tout compte suspendu est immédiatement bloqué côté serveur : interdiction de commander, d'accepter des courses ou de synchroniser son profil (erreur HTTP 403 avec message explicatif).
- Bouton d'action direct dans l'onglet *Comptes Usagers* du tableau de bord d'administration.

### 15. Portefeuille Commissions Administrateur en Temps Réel
- Un portefeuille dédié collecte automatiquement le pourcentage de commission de la plateforme sur chaque course payée (par défaut 10%).
- Onglet *Commissions & Solde* affichant le montant total perçu, l'historique détaillé des prélèvements par course et un outil d'ajustement du taux de commission (entre 0% et 50%).
- Crédit automatique effectué lors de la clôture mutuelle ou de l'auto-confirmation de fin de course.

### 16. Assistants Sociaux & Gestion des Conflits / Appels d'Aide
- Création de profils dédiés aux **Assistants Sociaux** (`SOCIAL_ASSISTANT`) au sein de l'équipe d'administration.
- Onglet *Assistance & Conflits* centralisant les appels d'aide et réclamations des usagers.
- Suivi du cycle de vie des incidents : `EN ATTENTE` -> `EN COURS` (assigné à un assistant social) -> `RÉSOLU`.

### 17. Déconnexion Sécurisée & Navigation Verrouillée sur `/sign-in`
- Lorsqu'un utilisateur (passager, chauffeur ou administrateur) se déconnecte, l'historique est réinitialisé et la navigation est verrouillée sur la page de connexion unique (`/(auth)/sign-in`).
- Les gardes de navigation empêchent tout retour arrière vers les écrans protégés sans ré-authentification préalable.

### 18. Réinitialisation & Nettoyage Sécurisé de la Base de Données
- Option sécurisée permettant à l'administrateur de vider l'ensemble des données de test (courses, chauffeurs, usagers, litiges, alertes) tout en préservant l'intégrité de la structure et les comptes administrateurs.

### 19. Suppression de l'Historique de Courses
- Le passager peut **effacer son historique de courses** depuis l'onglet *Tous les Trajets* via un bouton dédié 🗑️ **Effacer** affiché uniquement lorsqu'il y a des courses à supprimer.
- La suppression est un **soft-delete** : les données restent en base de données à des fins d'audit, mais elles n'apparaissent plus dans l'interface utilisateur.
- Endpoint backend : `DELETE /api/rides/history/user/:userId` (passager) et `DELETE /api/rides/history/driver/:driverId` (chauffeur).
- Les courses actives (`SEARCHING`, `ACCEPTED`, `IN_TRANSIT`, `ARRIVEE_SIGNALEE`) ne sont **jamais** supprimées de la vue, uniquement les courses terminées ou annulées.

### 20. Notifications Push & Alertes Audio en Temps Réel
- **Système de notifications VORA** (`lib/notifications.ts`) — module natif utilisant la **Web Notifications API** (API standard W3C, sans dépendance tierce) pour déclencher des notifications système même lorsque l'application est en arrière-plan ou minimisée.
- **Événements couverts** :
  - 🚗 Course acceptée par un chauffeur → Notification toast + son harmonique montant.
  - ❌ Course annulée (par chauffeur ou passager) → Notification + son grave descendant d'alerte.
  - ✅ Course terminée → Notification + jingle signature VORA satisfaisant.
  - 📍 Nouvelle course disponible (chauffeur) → Notification + son d'alerte positif.
- **Feedback audio immédiat in-app** : Chaque événement déclencheur joue un son distinct généré en temps réel via l'**API Web Audio** (sans fichier audio externe), assurant une réactivité sonore même en mode hors-ligne partiel.
- **Initialisation globale** : Les permissions de notification sont demandées dès le démarrage de l'application dans `_layout.tsx`, garantissant une couverture même hors de l'écran de course.

### 21. Notification du Chauffeur lors d'une Annulation Passager
- Lorsqu'un passager annule une course acceptée, le chauffeur est désormais **proactivement notifié** via Socket.io sur son ID utilisateur direct.
- Le chauffeur reçoit une notification push **avec retour sonore** (son d'alerte) l'informant que le passager a annulé, évitant ainsi qu'il continue de se déplacer inutilement vers un point de ramassage abandonné.

---

## Structure du Projet

```text
VORA/
├── backend/                  # API REST Express Node.js & Base PostgreSQL / Neon
│   ├── src/
│   │   ├── db/               # Schéma SQL, pool Neon et migrations
│   │   ├── routes/           # Routes API (Rides, Drivers, Users, CamerPay, Didit)
│   │   │   ├── rides.ts      # Gestion des courses, validation moto, notation
│   │   │   ├── drivers.ts    # Profils chauffeurs, validation, mise en ligne
│   │   │   ├── users.ts      # Profils utilisateurs, portefeuille in-app
│   │   │   └── camerpay.ts   # Passerelle Mobile Money MTN / Orange
│   │   ├── utils/
│   │   │   ├── pricing.ts    # Moteur tarifaire, surge pricing, nuit moto x2
│   │   │   ├── geofence.ts   # Contrôle intra-urbain Cameroun
│   │   │   └── anonymize.ts  # Anonymisation VORA-XXXXXX
│   │   ├── socket.ts         # Dispatch séquentiel 20s, WebSockets, suivi temps réel
│   │   └── server.ts         # Point d'entrée serveur Express
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/                   # Application Mobile & Web Expo Router
│   ├── app/
│   │   ├── (auth)/           # Routes authentification (welcome, sign-in, sign-up)
│   │   ├── (driver)/         # Espace Chauffeur (dashboard, navigation 2 étapes, gains)
│   │   ├── (root)/           # Espace Passager (tabs, book-ride, find-ride, confirm-ride)
│   │   └── _layout.tsx       # Layout racine, configuration polices et Clerk
│   ├── components/           # Composants UI (Map, VehicleTypeSelector, RideRatingModal, CamerPaySelector)
│   ├── constants/            # Données de repères et imagerie
│   ├── lib/                  # Utilitaires (vora-pricing, geofence, voiceAssistant, socket)
│   ├── store/                # Zustand State Management (location, driver)
│   ├── package.json
│   └── tsconfig.json
│
├── .gitignore
└── README.md
```

---

## Fournisseurs d'API & Services Intégrés

VORA s'appuie sur une suite d'APIs et de services cloud de premier plan pour garantir performance, sécurité et adaptation au contexte camerounais :

| Fournisseur / Service | Catégorie | Rôle & Utilisation dans VORA | Variables d'Environnement |
| :--- | :--- | :--- | :--- |
| **Google Gemini AI** *(Google AI Studio)* | Intelligence Artificielle (NLP & Vision) | • **Géocodage sémantique** : Conversion des repères informels camerounais (*Bastos, Mvog-Ada, Mokolo...*) en coordonnées GPS réelles.<br>• **Vision par IA** : Validation faciale obligatoire certifiant la présence d'une personne humaine réelle sur la photo de profil du chauffeur. | `EXPO_PUBLIC_GEMINI_API_KEY` |
| **Neon Serverless** | Base de Données Cloud | Base PostgreSQL cloud managée hébergeant l'ensemble des données (courses, utilisateurs, chauffeurs, litiges, commissions d'administration et appels d'assistance). | `DATABASE_URL` |
| **Clerk Authentication** | Authentification & Sécurité | Gestion unifiée des comptes usagers, sessions JWT sécurisées, rafraîchissement des tokens et synchronisation multi-plateforme. | `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`<br>`CLERK_SECRET_KEY` |
| **Google Cloud Platform** | OAuth 2.0 & Identité | Authentification sociale sécurisée Google Sign-In pour passagers et chauffeurs. | `EXPO_PUBLIC_GOOGLE_CLIENT_ID`<br>`GOOGLE_CLIENT_SECRET` |
| **CamerPay API** | Paiement Mobile Money | Passerelle de paiement locale pour le Cameroun : règlement instantané des courses et recharges de portefeuille in-app via **MTN Mobile Money** et **Orange Money**. | `CAMERPAY_API_KEY`<br>`CAMERPAY_API_SECRET`<br>`CAMERPAY_CALLBACK_SECRET`<br>`CAMERPAY_API_URL` |
| **Geoapify API** | Cartographie & Géolocalisation | Recherche de lieux, autocomplétion d'adresses, géocodage inverse et calcul des directions / itinéraires routiers optimisés. | `EXPO_PUBLIC_GEOAPIFY_API_KEY`<br>`EXPO_PUBLIC_PLACES_API_KEY`<br>`EXPO_PUBLIC_DIRECTIONS_API_KEY` |
| **OpenStreetMap & Leaflet / CARTO** | Cartographie Interactive | Moteur cartographique vectoriel haute définition avec niveau de zoom rapproché affichant les quartiers, carrefours et repères locaux. | Intégration OSM / CARTO Tile Servers |
| **Stripe API** | Paiement Bancaire International | Gestion des transactions par carte de crédit/débit internationale (Visa, Mastercard) en environnement sécurisé. | `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| **Didit Identity (KYC)** | Vérification d'Identité & Conformité | Vérification biométrique et conformité d'identité des chauffeurs partenaires (KYC). | `DIDIT_API_KEY`<br>`DIDIT_WORKFLOW_ID` |
| **Web Speech API** *(Standard W3C)* | Synthèse Vocale Embarquée | **Assistante Vocale VORA** : guidage sonore féminin fluide en français (`fr-FR`) à chaque étape du trajet (accueil, acceptation, arrivée, prise en charge, fin de course). | Natif navigateur / Web standard |
| **WebRTC & Socket.io** | Communication Temps Réel | Appels vocaux audio in-app chiffrés avec chronomètre en direct et messagerie instantanée sécurisée (anonymisation `VORA-XXXXXX`). | `EXPO_PUBLIC_SOCKET_URL` |
| **DiceBear API** | Génération Graphique d'Avatars | Génération d'avatars vectoriels et de formes géométriques stylisées pour les profils et presets afin de garantir des visuels neutres non-humains par défaut. | API publique DiceBear Shapes & Badges |

---

## Guide d'Installation & Lancement Local

### Prérequis
- **Node.js** v18+ ou v20+
- **npm** ou **yarn**
- Base de données PostgreSQL (ou instance Neon Serverless cloud)

### 1. Démarrage du Backend

```bash
cd backend
npm install
npm run dev
# Serveur actif sur http://localhost:5000 (WebSocket & API REST)
```

### 2. Démarrage du Frontend avec Tunnel HTTPS (FORTEMENT RECOMMANDÉ)

> [!IMPORTANT]
> **Pourquoi le Tunnel HTTPS est indispensable en local :**
> - **Permissions Navigateur Sécurisées** : Les fonctionnalités modernes de l'application (synthèse et reconnaissance vocale Web Speech, sons et sonneries d'appel in-app Web Audio API, géolocalisation GPS en direct, WebRTC / microphone et Service Worker PWA) exigent impérativement un **contexte sécurisé HTTPS** (`Secure Context`) pour fonctionner sur les smartphones et navigateurs distants.
> - **Authentification Clerk & OAuth Google** : Clerk et Google exigent des origines sécurisées HTTPS ou localhost strict.
> - **Installation PWA fluide** : L'installation de l'application sur l'écran d'accueil d'un smartphone (Android Chrome ou iOS Safari) requiert une connexion HTTPS certifiée.

Pour démarrer le frontend avec un tunnel HTTPS public automatique (via ngrok) :

```bash
cd mobile
npm install --legacy-peer-deps

# Lancement avec tunnel HTTPS sécurisé
npx expo start --web --tunnel --port 8081
```

> **Conseil** : Dès le lancement, Expo affiche l'URL publique HTTPS (ex: `https://xxxx.exp.direct`). Ouvrez cette URL sur votre ordinateur ou sur n'importe quel smartphone pour tester toutes les fonctionnalités dans des conditions réelles de production.
>
> Si vous souhaitez lancer uniquement sur votre machine en local sans tunnel :
> ```bash
> npx expo start --web --port 8081
> ```

---

### 3. Cadre Responsive iPhone XR sur Ordinateur & Mobile Natif

- **Sur Ordinateur de Bureau (Desktop / Laptop)** : L'application s'affiche automatiquement au format élégant **iPhone XR** (dimensions 414 × 896 pt, bordures courbées premium, encoche notch supérieure, fente haut-parleur et ombre portée réaliste) pour une expérience de démonstration mobile parfaite.
- **Sur Smartphone (Écran ≤ 500px)** : L'application occupe **100% de l'écran en plein écran natif**, optimisé pour l'utilisation tactile et la PWA installée sans bordures superflues.

---

### 4. Appels In-App & Chat Direct Chauffeur-Passager (VoIP + Sonnerie)

- **100% In-App (Aucune redirection externe)** : Plus de redirection vers l'application téléphonique native de l'OS (`tel:...`). Tout le flux d'appel et de discussion s'effectue directement dans l'application VORA.
- **Sonnerie In-App Polyphonique Mélodieuse** : Une sonnerie VoIP moderne et fluide synthétisée dynamiquement via l'API Web Audio (aucun fichier audio lourd à télécharger, latence zéro, accords harmoniques F#4/A4/C#5/E5 avec carillon de décrochage et bip de fin d'appel).
- **Messagerie Instantanée Sécurisée** : Chat bidirectionnel en direct avec horodatage et anonymisation complète des numéros réels.

---

## Déploiement & Test sur Réseau Local (LAN / Wi-Fi)

Pour tester l'application sur des smartphones physiques connectés au même réseau Wi-Fi local :

### 1. Identifier l'adresse IP locale de votre machine
- **Windows** : ouvrir PowerShell et taper `ipconfig` (relever l'adresse IPv4, ex: `192.168.1.135`).
- **macOS / Linux** : ouvrir le terminal et taper `ifconfig` ou `ip a`.

### 2. Configurer le fichier `mobile/.env`
Mettre à jour les adresses de l'API et des WebSockets avec votre IP locale :
```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.135:5000
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.135:5000
```

### 3. Lancer Expo en mode Réseau Local (LAN)
```bash
cd mobile
npx expo start --lan
```
- **Sur Android / iOS** : Scanner le QR Code affiché dans le terminal avec l'application **Expo Go** (ou l'appareil photo sur iOS).
- **Sur navigateur mobile** : Ouvrir l'URL `http://192.168.1.135:8081`.
- *Note pare-feu Windows* : veillez à autoriser les connexions entrantes sur les ports `5000` et `8081`.

---

## Build du Front-End (Web & Mobile)

### 1. Build Web Production (PWA / SPA)
Pour générer une version web statique optimisée et prête à être hébergée (Nginx, Vercel, Netlify, Cloudflare Pages, S3...) :
```bash
cd mobile
npx expo export --platform web
```
- Les fichiers de production sont compilés dans le dossier `mobile/dist/`.
- Ce dossier peut être directement servi par n'importe quel serveur HTTP statique ou reverse proxy Nginx.

### 2. Build Mobile Android (APK & AAB)

#### Option A : Via EAS Build (Cloud Expo — Recommandé)
```bash
npm install -g eas-cli
eas login
eas build:configure

# Générer un fichier APK autonome directement installable sur smartphone Android :
eas build -p android --profile preview

# Générer un bundle AAB optimisé pour soumission sur Google Play Store :
eas build -p android --profile production
```

#### Option B : Build Local avec Prebuild (Android Studio / Gradle)
```bash
cd mobile
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```
- L'APK autonome généré se trouve dans : `mobile/android/app/build/outputs/apk/release/app-release.apk`.

### 3. Build Mobile iOS (IPA)
```bash
cd mobile
eas build -p ios --profile production
```

---

## Déploiement en Production sur Serveur VPS (Ubuntu / Debian)

### 1. Prérequis sur le VPS
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw nginx certbot python3-certbot-nginx

# Installation de Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Installation du gestionnaire de processus PM2
sudo npm install -g pm2
```

### 2. Déploiement & Compilation du Backend sur le VPS

```bash
# Cloner le dépôt
git clone https://github.com/Nuxcine-Hackathon/TEAM-VANGUARD.git /var/www/vora
cd /var/www/vora/backend

# Installer les dépendances et compiler le TypeScript en JavaScript
npm install
npm run build
```

Créer et configurer le fichier de variables d'environnement `/var/www/vora/backend/.env` :
```env
PORT=5000
DATABASE_URL=postgresql://<user>:<password>@<neon-host>/neondb?sslmode=require
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
CAMERPAY_API_KEY=...
CAMERPAY_API_SECRET=...
CAMERPAY_CALLBACK_SECRET=...
CAMERPAY_API_URL=https://camerpay.biz/api
ADMIN_EMAIL=admin@vora.cm
ADMIN_PASSWORD=<MOT_DE_PASSE_SECURISE>
ADMIN_COMMISSION_RATE=0.10
```

Démarrer le backend avec PM2 pour garantir une exécution continue avec auto-redémarrage :
```bash
pm2 start dist/server.js --name "vora-backend"
pm2 startup
pm2 save
```

### 3. Configuration du Reverse Proxy Nginx & WebSockets

Créer le fichier de configuration `/etc/nginx/sites-available/vora.conf` :
```nginx
server {
    server_name api.vora.cm;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # Support obligatoire des WebSockets (Socket.io & WebRTC signaling)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Bloc optionnel pour héberger le front-end web compilé (dossier dist) sur le même VPS
server {
    server_name app.vora.cm;
    root /var/www/vora/mobile/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Activer le site et tester la configuration Nginx :
```bash
sudo ln -s /etc/nginx/sites-available/vora.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Sécurisation HTTPS avec Certificat SSL Gratuit (Let's Encrypt)
```bash
sudo certbot --nginx -d api.vora.cm -d app.vora.cm
```

### 5. Configuration du Pare-Feu UFW
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Livraison & Déploiement pour les Organisateurs

### Fichier de Configuration — `env-configs.zip`

Pour permettre aux organisateurs d'exécuter le projet immédiatement sans configuration manuelle des clés API, un archive `env-configs.zip` est incluse à la racine du dépôt et attachée à chaque **GitHub Release**.

```
env-configs.zip
├── backend.env        → à copier/renommer en backend/.env
├── mobile.env         → à copier/renommer en mobile/.env
└── README.txt         → instructions rapides de déploiement
```

**Étapes d'utilisation :**
1. Télécharger et dézipper `env-configs.zip`
2. Copier `backend.env` → `backend/.env`
3. Copier `mobile.env` → `mobile/.env`
4. Lancer le projet (voir sections démarrage ci-dessus)

> ⚠️ Ces fichiers contiennent des clés API actives. Ne pas redistribuer publiquement.

---

### Releases Automatisées — GitHub Actions

Un workflow CI/CD est configuré dans `.github/workflows/release-build.yml`. Il se déclenche :
- **Manuellement** via GitHub → Actions → *VORA Automated Release & Build* → *Run workflow*
- **Automatiquement** lors d'un push de tag `v*.*.*` (ex : `git tag v1.0.0 && git push --tags`)

Le workflow produit et attache à la GitHub Release :

| Fichier | Contenu |
|---|---|
| `vora-backend-dist.zip` | Backend Node.js compilé (`dist/server.js` + `package.json`) |
| `vora-frontend-web-dist.zip` | Frontend web statique (PWA/SPA — HTML, JS, CSS) |
| `vora-env-configs.zip` | Variables d'environnement prêtes à l'emploi |

### Format du Build — Web (pas APK)

> **Le build frontend est une application Web Progressive (PWA/SPA), PAS un APK Android.**

VORA est construit avec **Expo Router** en mode **React Native Web**. La commande `npx expo export --platform web` génère un dossier `dist/` contenant des fichiers HTML/JS/CSS statiques qui s'ouvrent dans n'importe quel navigateur moderne.

Pour exécuter le build web :
```bash
# Option 1 — npx serve (recommandé, aucune installation requise)
cd mobile/dist
npx serve .

# Option 2 — Python (si installé)
python -m http.server 8080

# Option 3 — Nginx ou Apache (pour déploiement VPS)
# Voir section déploiement VPS ci-dessus
```

### Compatibilité Backend Local — Comment ça fonctionne ?

**Oui, le build fonctionne 100% avec un backend tournant sur le PC des organisateurs**, sans aucune reconfiguration.

Le fichier `mobile/lib/config.ts` utilise une résolution dynamique de l'URL du backend :

```typescript
// Résolution automatique : détecte localhost, 127.0.0.1 ou n'importe quelle IP LAN (192.168.x.x, 10.x.x.x)
export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || isLanIP(host)) {
      return `http://${host}:5000`;
    }
  }
  return PRODUCTION_API_URL; // Fallback vers le VPS en production
}
```

**Flux d'exécution pour les organisateurs :**
1. L'organisateur lance le backend → `cd backend && node dist/server.js` (port `5000`)
2. L'organisateur sert le frontend → `npx serve mobile/dist` (port `3000` ou `8080`)
3. Il ouvre `http://localhost:3000` dans son navigateur
4. Le frontend détecte `localhost` et appelle automatiquement `http://localhost:5000` → **ça marche sans rien changer**

Même chose sur réseau local (LAN) : si l'IP de la machine est `192.168.1.50`, le frontend appellera `http://192.168.1.50:5000` automatiquement.

---

## Verification Technique & Conformite

- **Compilation TypeScript Backend** : `npx tsc --noEmit` -> **0 erreur (Code 0)**
- **Compilation TypeScript Mobile** : `npx tsc --noEmit` -> **0 erreur (Code 0)**
- **Design & Interface** : Respect strict des directives d'affichage professionnelles (aucune émoticône superflue dans le front-end, composants vectoriels et SVG).

---

## Équipe de Développement — TEAM-VANGUARD

- **Patrick Assako** (@patrickassako) — *Lead Developer*
- **Legrand Onana** (@psycho237-prog) — *Fullstack Engineer*

---

<div align="center">
  <sub>TEAM-VANGUARD pour le Hackathon Nuxcine — © 2026 VORA Mobility. Tous droits réservés.</sub>
</div>
