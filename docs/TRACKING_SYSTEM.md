# Système de Tracking Automatique ALFlight

## 📊 Vue d'ensemble

Le projet ALFlight dispose d'un **double système de tracking** qui enregistre automatiquement toutes les modifications dans Google Sheets pour un suivi complet de l'évolution du code.

### Systèmes de tracking

1. **AutoTracker** (`scripts/autoTracker.cjs`)
   - Surveille les modifications de l'application en temps réel
   - Détecte les changements dans `src/`, `server/`, `public/`
   - Enregistre automatiquement dans Google Sheets

2. **Claude Code Tracker** (`scripts/claude-code-tracker.cjs`)
   - Spécialisé pour tracker les modifications faites par Claude Code
   - Regroupe intelligemment les changements par session
   - Envoie des rapports détaillés avec contexte complet

## 🚀 Démarrage rapide

### Option 1: Démarrage automatique (recommandé)

```bash
START_SESSION.bat
```

Ce script lance automatiquement :
- Le serveur Google Sheets Logger (port 3001)
- L'application Vite (port 4001)
- L'AutoTracker
- Le Claude Code Tracker

### Option 2: Démarrage manuel

```bash
# Terminal 1: Serveur Google Sheets
cd server
node googleSheetsServer.js

# Terminal 2: Application + Double Tracking
npm run dev:full-tracked
```

### Option 3: Tracking séparé

```bash
# Seulement AutoTracker
npm run dev:tracked

# Seulement Claude Code Tracker
npm run dev:claude-tracker
```

## 📁 Structure des fichiers

```
alflight/
├── server/
│   └── googleSheetsServer.js         # Serveur API Google Sheets (port 3001)
├── scripts/
│   ├── autoTracker.cjs                # Tracker des modifications app
│   ├── claude-code-tracker.cjs        # Tracker des modifications Claude Code
│   └── send-modification-report.ps1   # Script PowerShell manuel de reporting
├── tracking/
│   ├── claude-updates.log             # Log local de toutes les modifications
│   └── claude-session.json            # État de la session Claude Code
├── START_SESSION.bat                  # Script de démarrage complet
└── SEND_REPORT.bat                    # Envoi manuel de rapport
```

## 🎯 Fonctionnalités

### AutoTracker

**Ce qu'il fait:**
- Détecte automatiquement les modifications de fichiers
- Analyse le type de changement (code, style, config, test)
- Identifie le module/composant concerné
- Envoie les logs groupés à Google Sheets
- Délai de groupement: 2 secondes

**Fichiers surveillés:**
- `src/**/*.{js,jsx,css,json}`
- `server/**/*.js`
- `public/**/*`

**Fichiers ignorés:**
- `node_modules/`, `.git/`, `dist/`, `build/`
- `*.log`, `tracking/**`

### Claude Code Tracker

**Ce qu'il fait:**
- Surveille spécifiquement les modifications faites par Claude Code
- Regroupe les changements par fichier
- Envoie des rapports détaillés toutes les 5-30 secondes
- Sauvegarde l'état de session pour récupération après crash
- Envoie automatiquement les modifications en attente au démarrage

**Fichiers surveillés:**
- `src/**/*.{js,jsx,tsx,ts,css}`
- `server/**/*.js`
- `scripts/**/*.{js,cjs}`
- `*.{bat,ps1}`

**Format du rapport:**
```json
{
  "action": "CLAUDE_CODE_MODIFICATIONS",
  "component": "Claude Code Assistant",
  "summary": "X fichier(s) modifié(s) - Y opération(s)",
  "details": {
    "timestamp": "2025-10-11 14:00:00",
    "session_start": "2025-10-11 13:00:00",
    "total_changes": 5,
    "files": [
      {
        "file": "src/components/Example.jsx",
        "operations": ["Modification"],
        "change_count": 3,
        "first_change": "2025-10-11 13:30:00",
        "last_change": "2025-10-11 14:00:00"
      }
    ]
  },
  "files": "src/components/Example.jsx, src/utils/helper.js",
  "status": "completed"
}
```

## 📝 Google Sheets

### Spreadsheet
**ID:** `1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k`

**Lien:** https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k

### Structure de la feuille "Tracking"

| Colonne | Contenu | Description |
|---------|---------|-------------|
| A | Date/Heure | Timestamp de l'action |
| B | Action | Type d'action (CODE_MODIFICATION, DOWNLOAD_AIRCRAFT, etc.) |
| C | Composant | Module/composant concerné |
| D | Résumé | Description courte |
| E | Détails | JSON avec informations complètes |
| F | Fichiers | Liste des fichiers modifiés |
| G | Statut | completed, pending, failed, etc. |
| H | Auteur | (optionnel) |

### Types d'actions trackées

| Action | Source | Description |
|--------|--------|-------------|
| `CLAUDE_CODE_MODIFICATIONS` | Claude Tracker | Modifications groupées par Claude Code |
| `Code update - [Module]` | AutoTracker | Modifications de l'application |
| `DOWNLOAD_AIRCRAFT` | App | Téléchargement d'avion depuis la communauté |
| `CODE_MODIFICATION` | Manuel | Rapport envoyé manuellement |
| `SESSION_DEMARREE` | START_SESSION.bat | Démarrage de session de dev |
| `SESSION_PRETE` | START_SESSION.bat | Environnement prêt |

## 🔧 Configuration

### Serveur Google Sheets (googleSheetsServer.js)

```javascript
// Port du serveur
const PORT = 3001;

// Fichier credentials
const CREDENTIALS_PATH = 'D:\\Applicator\\alfight-46443ca54259.json';

// Spreadsheet ID
const SPREADSHEET_ID = '1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k';
```

### Claude Code Tracker (claude-code-tracker.cjs)

```javascript
// Délai avant d'envoyer le rapport (pour grouper les changements)
debounceMs: 5000,  // 5 secondes

// Délai maximum d'attente avant envoi forcé
maxWaitMs: 30000,  // 30 secondes
```

### AutoTracker (autoTracker.cjs)

```javascript
// Délai avant de logger (pour grouper les changements)
debounceMs: 2000,  // 2 secondes
```

## 📤 Envoi manuel de rapports

### Option 1: Utiliser curl directement

```bash
curl -X POST http://localhost:3001/api/log \
  -H "Content-Type: application/json" \
  -d '{
    "action": "CODE_MODIFICATION",
    "component": "Mon Composant",
    "summary": "Description courte",
    "details": "{\"info\": \"details JSON\"}",
    "files": "file1.js, file2.jsx",
    "status": "completed"
  }'
```

### Option 2: Utiliser le script PowerShell

```powershell
.\scripts\send-modification-report.ps1 `
  -ModificationSummary "Ma modification" `
  -FilesModified @("file1.js", "file2.jsx") `
  -Category "Code Update" `
  -Status "success"
```

### Option 3: Utiliser SEND_REPORT.bat

1. Ouvrir `SEND_REPORT.bat`
2. Modifier les variables `SUMMARY` et `FILES`
3. Exécuter le fichier

## 🔍 Endpoints API

### POST `/api/log`
Enregistre un log dans Google Sheets

**Body:**
```json
{
  "action": "string (required)",
  "component": "string (optional, default: 'Application')",
  "summary": "string (optional)",
  "details": "string (optional)",
  "files": "string (optional)",
  "status": "string (optional, default: 'completed')"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Log ajouté à Google Sheets",
  "spreadsheet": "1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k",
  "range": "Tracking!A123:H123"
}
```

### GET `/health`
Vérifie que le serveur est actif

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-11T12:00:00.000Z"
}
```

### GET `/api/test`
Teste la connexion Google Sheets et envoie un log de test

## 🐛 Dépannage

### Le tracker ne démarre pas

1. Vérifier que le serveur Google Sheets est actif:
   ```bash
   curl http://localhost:3001/health
   ```

2. Vérifier le fichier credentials:
   ```bash
   dir D:\Applicator\alfight-46443ca54259.json
   ```

3. Vérifier les logs:
   ```bash
   type tracking\claude-updates.log
   ```

### Les modifications ne sont pas détectées

1. Vérifier que le fichier est dans les chemins surveillés
2. Vérifier que le fichier n'est pas ignoré (node_modules, .git, etc.)
3. Attendre le délai de debounce (5-30 secondes)
4. Vérifier les logs du tracker dans la console

### Erreur d'envoi à Google Sheets

1. Vérifier que le serveur est actif (port 3001)
2. Vérifier les credentials Google Sheets
3. Vérifier l'accès à Internet
4. Vérifier les permissions sur le spreadsheet

## 📊 Statistiques et monitoring

### Logs locaux

Tous les logs sont sauvegardés localement dans:
- `tracking/claude-updates.log` - Historique complet
- `tracking/claude-session.json` - État de la session Claude

### Visualisation

Accédez au Google Sheets pour voir:
- Historique complet des modifications
- Filtres par action, composant, date
- Graphiques et analyses (à configurer dans Sheets)

## 🎓 Bonnes pratiques

1. **Toujours lancer START_SESSION.bat** au début de la session
2. **Garder les fenêtres de serveur ouvertes** pendant le développement
3. **Vérifier Google Sheets** régulièrement pour suivre l'historique
4. **Utiliser des messages clairs** dans les rapports manuels
5. **Grouper les modifications** plutôt que d'envoyer des rapports unitaires

## 🔒 Sécurité

- Le fichier `alfight-46443ca54259.json` contient les credentials Google
- **Ne jamais commit ce fichier** dans Git
- Les logs locaux peuvent contenir des informations sensibles
- Le serveur écoute uniquement sur localhost (127.0.0.1)

## 📚 Ressources

- [Documentation Google Sheets API](https://developers.google.com/sheets/api)
- [Chokidar (File Watcher)](https://github.com/paulmillr/chokidar)
- [Express.js](https://expressjs.com/)
- [Concurrently](https://github.com/open-cli-tools/concurrently)

## 🤝 Contribution

Pour ajouter de nouveaux types de tracking:

1. Ajouter l'action dans le code source
2. Envoyer un POST vers `/api/log` avec les bonnes données
3. Documenter le nouveau type d'action dans ce README

---

**Version:** 1.0.0
**Dernière mise à jour:** 2025-10-11
**Auteur:** Claude Code Assistant
