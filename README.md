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

### 6. Navigation Chauffeur en 2 Etapes & Assistante Vocale VORA
- **Navigation en 2 étapes** :
  1. **Étape 1 (Vers le point de ramassage)** : La carte guide vers le client avec bouton *"Prendre en charge le client"* (émet `pickup-passenger`).
  2. **Étape 2 (Vers la destination finale)** : Dès la prise en charge, la carte bascule sur l'itinéraire de destination avec bouton *"Terminer la course"*.
- **Assistante Vocale VORA** : Système vocal féminin fluide en français (Web Speech API) guidant le chauffeur et le passager à chaque transition de statut.

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

## Guide d'Installation & Lancement Local

### Prérequis
- **Node.js** v18+ ou v20+
- **npm** ou **yarn**
- Base de données PostgreSQL (ou instance Neon Serverless)

### 1. Démarrage du Backend

```bash
cd backend
npm install
npm run dev
# Serveur actif sur http://localhost:5000
```

### 2. Démarrage de l'Application Mobile / Web

```bash
cd mobile
npm install
npx expo start --web --port 8081
# Application accessible sur http://localhost:8081
```

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
