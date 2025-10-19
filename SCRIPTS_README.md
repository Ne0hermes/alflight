# Scripts de Gestion - ALFlight

Documentation des scripts batch pour gérer l'environnement de développement ALFlight.

---

## 📋 Scripts Disponibles

### 🚀 `START_SESSION.bat`
**Script principal de démarrage sécurisé**

Lance l'environnement de développement complet avec toutes les vérifications de sécurité.

#### Fonctionnalités

**Étape 1 - Vérification des fichiers critiques**
- ✅ Vérification du fichier credentials Google Sheets
- ✅ Vérification du serveur Google Sheets
- ✅ Vérification du fichier .env
- ⚠️ Arrêt si fichiers critiques manquants

**Étape 2 - Vérification du port Google Sheets**
- 🔍 Détection du port 3001
- 🚀 Démarrage automatique si port libre
- ♻️ Réutilisation si serveur déjà actif

**Étape 3 - Test de connexion Google Sheets**
- 🌐 Test HTTP du endpoint `/health`
- 📝 Envoi d'un log de démarrage de session
- ⚠️ Avertissement si serveur non accessible

**Étape 4 - Vérification Supabase**
- 🔐 Chargement des variables d'environnement depuis `.env`
- ✅ Vérification de `VITE_SUPABASE_URL`
- ✅ Vérification de `VITE_SUPABASE_ANON_KEY`

**Étape 5 - Vérification Node.js**
- 📦 Vérification du dossier `node_modules`
- 🔧 Installation automatique si manquant (`npm install`)

**Étape 6 - Démarrage de l'application**
- 🖥️ Lancement de Vite avec tracking actif
- 📡 Application accessible sur `http://localhost:4001`
- 📝 Envoi d'un log "Session prête"

#### Utilisation

```batch
# Double-cliquer sur START_SESSION.bat
# OU depuis la ligne de commande :
START_SESSION.bat
```

#### Sorties

```
[APPLICATION]
- App Web:     http://localhost:4001
- Mode:        Développement avec HMR

[BACKEND]
- Google Sheets Logger:  http://localhost:3001
- Endpoint Health:       http://localhost:3001/health
- Endpoint Test:         http://localhost:3001/api/test

[SUPABASE]
- Dashboard:   https://supabase.com/dashboard/project/bgmscwckawgybymbimga
- Database:    Table community_presets configurée
- URL API:     https://bgmscwckawgybymbimga.supabase.co

[TRACKING]
- Google Sheets:  https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
- Auto-tracker:   ACTIF (surveille modifications fichiers)
- Log local:      tracking\claude-updates.log
```

---

### 🔍 `CHECK_HEALTH.bat`
**Script de diagnostic système**

Effectue un diagnostic complet de l'environnement sans démarrer les serveurs.

#### Vérifications

**1. Fichiers critiques**
- ✅ Credentials Google Sheets (`D:\Applicator\alfight-46443ca54259.json`)
- ✅ Serveur Google Sheets (`server\googleSheetsServer.js`)
- ✅ Fichier `.env`
- ✅ Auto-tracker (`scripts\autoTracker.cjs`)

**2. Ports réseau**
- 🔌 Port 3001 - Google Sheets Logger
- 🔌 Port 4001 - Application Vite

**3. Serveur Google Sheets**
- 🌐 Test endpoint `/health` (HTTP 200)
- 🌐 Test endpoint `/api/test`
- 📊 Affichage du nombre de lignes dans Google Sheets

**4. Configuration Supabase**
- 🔐 `VITE_SUPABASE_URL`
- 🔐 `VITE_SUPABASE_ANON_KEY`

**5. Environnement Node.js**
- 📦 Version de Node.js
- 📦 Version de npm
- 📦 Présence de `node_modules`

**6. Système de tracking**
- 📁 Dossier `tracking`
- 📝 Fichier `claude-updates.log`
- 🔔 Script PowerShell de notification

**7. Accès Google Sheets**
- 🔗 Lien direct vers le spreadsheet

#### Utilisation

```batch
# Double-cliquer sur CHECK_HEALTH.bat
# OU depuis la ligne de commande :
CHECK_HEALTH.bat
```

#### Exemple de sortie

```
[1/7] FICHIERS CRITIQUES
--------------------------------------------------------------------------------
  [OK] Credentials Google Sheets present
  [OK] Serveur Google Sheets present
  [OK] Fichier .env present
  [OK] Auto-tracker present

[2/7] PORTS RESEAU
--------------------------------------------------------------------------------
  [OK] Port 3001 (Google Sheets Logger) - ACTIF
  [INFO] Port 4001 (Application Vite) - LIBRE

[3/7] SERVEUR GOOGLE SHEETS
--------------------------------------------------------------------------------
  [OK] Serveur accessible sur http://localhost:3001
  [OK] Endpoint /health repond correctement
  [OK] Endpoint /api/test operationnel
  [INFO] "rows":294

[4/7] CONFIGURATION SUPABASE
--------------------------------------------------------------------------------
  [OK] VITE_SUPABASE_URL definie
       URL: https://bgmscwckawgybymbimga.supabase.co
  [OK] VITE_SUPABASE_ANON_KEY definie
       Key: eyJhbGciOiJIUzI1NiIs...

[5/7] ENVIRONNEMENT NODE.JS
--------------------------------------------------------------------------------
  [OK] Node.js installe - v22.18.0
  [OK] npm installe - v10.8.2
  [OK] Dependances Node.js installees

[6/7] SYSTEME DE TRACKING
--------------------------------------------------------------------------------
  [OK] Dossier tracking presente
  [OK] Fichier de log local existe
       Lignes: 1250
  [OK] Script de notification PowerShell present

[7/7] ACCES GOOGLE SHEETS
--------------------------------------------------------------------------------
  [INFO] Spreadsheet ID: 1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
  [INFO] Lien direct:
         https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k

================================================================================
  RESULTAT: [OK] SYSTEME OPERATIONNEL

  Tous les composants critiques sont presents et fonctionnels.
  Vous pouvez demarrer l'application avec START_SESSION.bat
================================================================================
```

---

## 🔐 Sécurité

### Fichiers sensibles protégés

Les scripts vérifient la présence de fichiers critiques avant de démarrer :

1. **Credentials Google Sheets** (`alfight-46443ca54259.json`)
   - ⚠️ Ne JAMAIS commit ce fichier
   - 🔒 Stocké en dehors du projet (`D:\Applicator\`)

2. **Fichier .env**
   - 🔐 Contient les clés Supabase
   - ⚠️ Listé dans `.gitignore`

### Vérifications de sécurité

- ✅ Test de connexion avant envoi de données
- ✅ Vérification HTTP 200 du serveur
- ✅ Logs envoyés uniquement si serveur accessible
- ✅ Sauvegarde locale en cas d'échec

---

## 📊 Tracking des modifications

### Système de logging automatique

Les scripts envoient automatiquement des logs à Google Sheets :

**Lors du démarrage :**
```json
{
  "action": "SESSION_DEMARREE",
  "component": "START_SESSION.bat",
  "summary": "Session de developpement demarree",
  "details": "Serveur Google Sheets verifie et operationnel",
  "status": "success"
}
```

**Lorsque la session est prête :**
```json
{
  "action": "SESSION_PRETE",
  "component": "START_SESSION.bat",
  "summary": "Environnement de developpement pret",
  "details": {
    "app_url": "http://localhost:4001",
    "backend_url": "http://localhost:3001",
    "tracking": "active",
    "supabase": "configured"
  },
  "status": "success"
}
```

### Auto-tracker

Le système surveille automatiquement les modifications de fichiers et envoie des logs à Google Sheets :

- 📝 Fichiers créés
- ✏️ Fichiers modifiés
- 🗑️ Fichiers supprimés
- 📦 Changements de package.json

---

## 🚨 Dépannage

### Le serveur Google Sheets ne démarre pas

```batch
# 1. Vérifier que Node.js est installé
node --version

# 2. Vérifier les dépendances
cd server
npm install

# 3. Tester manuellement
node googleSheetsServer.js
```

### Port 3001 déjà utilisé

```batch
# Trouver le processus utilisant le port 3001
netstat -ano | findstr :3001

# Tuer le processus (remplacer PID par le numéro affiché)
taskkill /PID <PID> /F
```

### Erreur de connexion Supabase

1. Vérifier le fichier `.env` :
   ```
   VITE_SUPABASE_URL=https://bgmscwckawgybymbimga.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
   ```

2. Vérifier l'accès au dashboard Supabase :
   - https://supabase.com/dashboard/project/bgmscwckawgybymbimga

### Logs non envoyés à Google Sheets

1. Vérifier le serveur :
   ```batch
   curl http://localhost:3001/health
   ```

2. Vérifier les credentials :
   - Fichier présent : `D:\Applicator\alfight-46443ca54259.json`
   - Permissions correctes sur Google Sheets

3. Consulter le log local :
   ```batch
   type tracking\claude-updates.log
   ```

---

## 📝 Logs locaux

En cas d'échec de connexion à Google Sheets, tous les logs sont sauvegardés localement :

**Emplacement :** `tracking\claude-updates.log`

**Format :**
```json
[2025-10-09T12:31:48.648Z] {
  "timestamp": "09/10/2025 14:31:46",
  "action": "SESSION_DEMARREE",
  "component": "START_SESSION.bat",
  "summary": "Session de developpement demarree",
  "details": "Serveur Google Sheets verifie et operationnel",
  "status": "success"
}
```

---

## 🔗 Liens utiles

- **Application** : http://localhost:4001
- **Backend** : http://localhost:3001
- **Google Sheets** : https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
- **Supabase Dashboard** : https://supabase.com/dashboard/project/bgmscwckawgybymbimga

---

## ✅ Checklist de démarrage

Avant de lancer `START_SESSION.bat` :

- [ ] Node.js installé (v22+)
- [ ] npm installé (v10+)
- [ ] Fichier `.env` présent avec clés Supabase
- [ ] Credentials Google Sheets présents (`D:\Applicator\alfight-46443ca54259.json`)
- [ ] Dépendances installées (`node_modules` présent)
- [ ] Ports 3001 et 4001 libres

Pour vérifier : Exécutez `CHECK_HEALTH.bat`

---

## 📞 Support

En cas de problème :

1. Exécutez `CHECK_HEALTH.bat` pour diagnostiquer
2. Consultez les logs dans `tracking\claude-updates.log`
3. Vérifiez la console du serveur Google Sheets
4. Consultez Google Sheets pour les logs historiques
