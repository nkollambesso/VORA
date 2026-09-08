#  VORA — Next-Gen Urban Mobility & Smart VTC Platform

<div align="center">

![VORA Banner](https://img.shields.io/badge/VORA-Mobilit%C3%A9%20S%C3%A9curis%C3%A9e-0EA5E9?style=for-the-badge&logo=uber&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.74-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Expo Router](https://img.shields.io/badge/Expo_Router-v3-000000?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express_API-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_DB-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

**Développé par l'équipe TEAM-VANGUARD pour le Nuxcine Hackathon 🚀**

</div>

---

## 📖 Présentation du Projet

**VORA** est une application moderne de mise en relation de transport urbain (VTC / Moto-taxi / Voiture) repensée pour offrir une sécurité maximale, une protection rigoureuse des données personnelles et une transparence totale entre chauffeurs et passagers.

Elle combine un **Frontend Web & Mobile ultra-réactif sous React Native & Expo Router** (`/mobile`) avec un **Backend Node.js/Express résilient connecté à une base PostgreSQL / Neon Serverless** (`/backend`).

---

## Structure du Projet

```text
VORA/
├── backend/                  # API Rest Express Node.js & Base PostgreSQL / Neon
│   ├── src/
│   │   ├── db/               # Schéma SQL et connecteur Neon
│   │   ├── routes/           # Endpoints API (Users, Rides, Drivers, Disputes, Didit KYC, Admin)
│   │   ├── socket.ts         # Service Realtime Socket.io
│   │   └── server.ts         # Point d'entrée serveur Express
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/                   # Application Mobile & Web Expo Router
│   ├── app/                  # Routes Expo Router ((auth), (driver), (root), (api))
│   ├── components/           # Composants UI (RideCard, Map, CustomButton, etc.)
│   ├── constants/            # Constantes et visuels
│   ├── lib/                  # Utilities (auth, fetch, map, anonymize)
│   ├── store/                # Zustand State Management
│   ├── types/                # Types TypeScript
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 🌟 Fonctionnalités Majeures & Innovations VANGUARD

### 🔒 1. Système d'Identifiant Anonymisé (`VORA-XXXXXX`)
- **Protection de la vie privée** : Les numéros de téléphone bruts, noms complets et adresses email personnelles ne sont jamais exposés entre le chauffeur et le client durant la course.
- Chaque utilisateur possède un identifiant anonymisé unique (ex. `VORA-8A92F1`) affiché dans le ride matching, l'historique et le chat.

### 🛡️ 2. Vérification d'Identité Biométrique Didit KYC
- **Conformité & Sécurité renforcée** : Intégration du SDK Didit Protocol v3.
- Vérification instantanée par **pièce d'identité**, **liveness detection** et **face match**.
- Indicateurs visuels dynamiques sur le profil utilisateur (*VÉRIFIÉ ✓*, *EN COURS...*, *NON VÉRIFIÉ*).

### 🤝 3. Confirmation Mutuelle de Fin de Course
- Cycle de vie sécurisé de la course : `en_cours` ➔ `arrivee_signalee` ➔ `terminee`.
- **Validation bilatérale** : Quand le chauffeur arrive à destination, la course passe à `arrivee_signalee`. Le client reçoit une alerte push/popup pour valider ou signaler un problème.
- **Résolution automatique** : Temporisateur intelligent de 5 minutes avec auto-clôture si aucune des parties n'émet de litige.

### 📊 4. Dashboard Administration VORA (Dark Mode)
- **Gestion des Litiges** : Vue centralisée pour arbitrer les contestations de fin de course avec preuves et détails.
- **Accès Sécurisé par PIN** : Code PIN administrateur requis pour déverrouiller le portail admin.
- **Accès discret** : Déclenchement secret par 5 tapotements successifs sur la version du profil utilisateur.

### 💰 5. Suivi des Gains Chauffeur en Temps Réel
- Connexion directe au backend PostgreSQL.
- Tableau de bord avec indicateurs clés (Total des gains, courses effectuées, note moyenne, historique des trajets enregistrés).

### 📱 6. Design Responsive & Multi-Plateforme
- Interface adaptative pour mobiles iOS/Android, tablettes et navigateurs Web modernes.
- Mise en page fluide sans débordement de boutons ni masquage de navigation.

---

## 🛠️ Architecture Technique

```mermaid
graph TD
    Client[📱 Application Mobile / Web React Native] -->|HTTP / REST API| Backend[⚙️ Server API Express Node.js]
    Client -->|WebSockets| Socket[⚡ Socket.io Realtime Service]
    Backend -->|PostgreSQL Query| DB[(🐘 Neon Serverless Postgres DB)]
    Backend -->|KYC Verification| Didit[🔐 Didit Protocol API v3]
    Client -->|Authentication| Clerk[🔑 Clerk Auth Provider]
```

---

## 🚀 Guide d'Installation et Lancement

### 1️⃣ Prérequis
- **Node.js** `>= 18.x`
- **npm** ou **yarn**
- **Expo Go** (sur mobile) ou un navigateur web moderne

### 2️⃣ Installation des dépendances

```bash
# Cloner le dépôt TEAM-VANGUARD
git clone https://github.com/Nuxcine-Hackathon/TEAM-VANGUARD.git
cd TEAM-VANGUARD

# Installer les dépendances du backend
cd backend
npm install
cd ..

# Installer les dépendances du mobile
cd mobile
npm install
cd ..
```

### 3️⃣ Configuration des Variables d'Environnement (`.env`)

Créer un fichier `.env` dans le dossier `backend` et dans `mobile` :

```env
# Backend Config (.env dans /backend)
PORT=5000
DATABASE_URL=postgresql://user:password@ep-cool-service.neon.tech/vora_db?sslmode=require
DIDIT_API_KEY=your_didit_api_key_here
DIDIT_WORKFLOW_ID=your_didit_workflow_id_here

# Frontend Config (.env dans /mobile)
EXPO_PUBLIC_BACKEND_URL=http://localhost:5000
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_pub_key
```

### 4️⃣ Démarrage des Services

```bash
# Terminal 1: Lancer le Backend API VORA
cd backend
npm run dev

# Terminal 2: Lancer l'application Mobile Expo (Web / Mobile)
cd mobile
npx expo start --web --port 8082
```

---

## 👥 Équipe de Développement — TEAM-VANGUARD

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/patrickassako">
        <img src="https://github.com/patrickassako.png" width="80" style="border-radius:50%"><br>
        <b>Fullstack Developer</b>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/psycho237-prog">
        <img src="https://github.com/psycho237-prog.png" width="80" style="border-radius:50%"><br>
        <b>Lead Developer</b>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/nkollambesso">
        <img src="https://github.com/nkollambesso.png" width="80" style="border-radius:50%"><br>
        <b>Assistant Manager</b>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/ongueamassoka-hue">
        <img src="https://github.com/ongueamassoka-hue.png" width="80" style="border-radius:50%"><br>
        <b>Project Manager & Designer</b>
      </a>
    </td>
  </tr>
</table>
---

<div align="center">
  <sub>Fait avec ❤️ par TEAM-VANGUARD pour le Hackathon Nuxcine — © 2026 VORA Mobility. Tous droits réservés.</sub>
</div>
