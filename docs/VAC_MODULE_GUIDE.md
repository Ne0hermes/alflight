# Guide d'utilisation du module VAC

## 📋 Prérequis

### Pour le téléchargement depuis le SIA

Le téléchargement des cartes VAC depuis le site officiel du SIA nécessite un serveur proxy pour contourner les restrictions CORS des navigateurs.

#### 1. Démarrer le serveur proxy

```bash
# Dans le dossier server/
cd server
npm install
npm start
```

Le serveur démarre sur le port 3001 par défaut.

#### 2. Vérifier que le serveur est actif

Ouvrez http://localhost:3001/api/health dans votre navigateur.
Vous devriez voir : `{"status":"OK","timestamp":"..."}`

## 🎯 Fonctionnalités

### 1. Téléchargement depuis le SIA

#### Cartes pré-configurées
- Cliquez sur "Télécharger" pour les aéroports listés (LFPG, LFPO, LFPN, etc.)
- Les cartes sont téléchargées depuis le site officiel du SIA

#### Recherche d'aéroport
- Entrez un code OACI français (commençant par LF)
- Exemple : LFPX, LFPY, LFPQ, etc.
- Cliquez sur "Rechercher SIA"

**Note :** Si le serveur proxy n'est pas démarré, le système passera en mode simulation.

### 2. Import manuel de cartes

Pour importer vos propres cartes VAC :

1. Cliquez sur "Importer une carte"
2. Entrez le code OACI (ex: LFXX)
3. Sélectionnez votre fichier (PDF, PNG, JPG)
4. Cliquez sur "Importer la carte"

Les cartes importées sont stockées localement dans votre navigateur.

### 3. Gestion des doublons

Si vous importez une carte pour un aéroport qui a déjà une carte SIA :
- Les deux versions sont conservées séparément
- Badge "SIA" pour la version officielle
- Badge "Version perso" pour votre import
- Badge "2 versions" indique la présence de doublons

### 4. Édition des données

Pour chaque carte téléchargée :
1. Cliquez sur le bouton ✏️ (crayon)
2. Éditez les informations dans les différents onglets :
   - Général (altitude, coordonnées)
   - Pistes (dimensions, QFU, surface)
   - Fréquences (TWR, GND, ATIS, etc.)
   - Points VFR
   - Obstacles
   - Procédures
   - Services
   - Remarques

### 5. Visualisation

- Cliquez sur l'icône 👁️ pour afficher la carte
- Utilisez les outils de zoom et rotation
- Les cartes importées s'affichent directement
- Les cartes SIA nécessitent le proxy pour être visualisées

## ⚠️ Mode simulation

Si le serveur proxy n'est pas disponible :
- Les téléchargements utilisent des données simulées
- Les cartes ne sont pas réellement téléchargées
- Un badge "Simulé" apparaît sur les cartes

## 🔍 Résolution des problèmes

### "Erreur de téléchargement"
1. Vérifiez que le serveur proxy est démarré
2. Vérifiez votre connexion internet
3. Vérifiez que le code OACI est valide

### "Proxy non disponible"
1. Démarrez le serveur proxy (voir Prérequis)
2. Vérifiez qu'aucun autre service n'utilise le port 3001

### "Carte non trouvée sur le SIA"
- Vérifiez le code OACI
- La carte n'existe peut-être pas sur le SIA
- Utilisez l'import manuel à la place

## 📝 Notes importantes

- **Responsabilité** : Les cartes VAC doivent être vérifiées avant utilisation
- **Validité** : Assurez-vous d'avoir les cartes à jour
- **Stockage** : Les cartes importées sont stockées dans le navigateur (localStorage)
- **Limite** : Le localStorage a une limite de ~5-10 MB selon les navigateurs

## 🚀 Commandes rapides

```bash
# Démarrer le serveur proxy (Windows)
start-proxy.bat

# Démarrer le serveur proxy (Linux/Mac)
./start-proxy.sh

# Démarrer l'application et le proxy
npm run dev:all
```