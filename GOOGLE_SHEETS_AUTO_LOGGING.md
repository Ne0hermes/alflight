# Système de Logging Automatique Google Sheets

## 📋 Vue d'ensemble

Ce système enregistre automatiquement toutes les modifications effectuées par Claude dans votre Google Sheet de tracking, avec des notifications PowerShell à chaque mise à jour.

## 🔧 Configuration

### Fichiers principaux

1. **Serveur Backend** : `server/googleSheetsServer.js`
   - Gère l'authentification avec Google Sheets API
   - Enregistre les logs dans le spreadsheet
   - Déclenche les notifications PowerShell

2. **Service de Logging** : `src/services/claudeUpdateLogger.js`
   - API JavaScript pour logger depuis l'application
   - Détection automatique des composants
   - Gestion de la file d'attente en cas d'erreur

3. **Script de Notification** : `scripts/notify-update.ps1`
   - Affiche une notification colorée dans PowerShell
   - Enregistre un log local dans `tracking/claude-updates.log`
   - Émet un son de notification

### Credentials

- **Fichier** : `D:\Applicator\alfight-46443ca54259.json`
- **Email** : `claude-code@alfight.iam.gserviceaccount.com`
- **Spreadsheet ID** : `1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k`
- **Feuille** : `Tracking`

## 🚀 Démarrage

### 1. Démarrer le serveur Google Sheets

```bash
cd D:\Applicator\alflight
node server/googleSheetsServer.js
```

Ou avec l'application React:

```bash
npm run dev
```

Le serveur démarre automatiquement sur `http://localhost:3001`

### 2. Vérifier la connexion

```bash
curl http://localhost:3001/health
```

### 3. Tester l'envoi d'un log

```bash
curl -X POST http://localhost:3001/api/log -H "Content-Type: application/json" -d "{\"action\":\"Test\",\"component\":\"Test\",\"details\":\"Test de logging\",\"files\":\"test.js\",\"status\":\"completed\"}"
```

## 💻 Utilisation dans le code

### Import du service

```javascript
import {
  logFileModification,
  logTaskCompleted,
  logBugFix,
  logFeatureAdded
} from '@/services/claudeUpdateLogger';
```

### Exemples d'utilisation

#### Logger une modification de fichier

```javascript
await logFileModification(
  'src/features/aircraft/AircraftModule.jsx',
  'Modification',
  'Ajout de la validation des formulaires'
);
```

#### Logger une tâche complétée

```javascript
await logTaskCompleted('Implémentation authentification', {
  component: 'Auth',
  summary: 'Système d\'authentification avec JWT',
  description: 'Ajout de la connexion, déconnexion et refresh token',
  filesModified: 'auth.js, AuthContext.jsx, Login.jsx'
});
```

#### Logger une correction de bug

```javascript
await logBugFix(
  'Le formulaire ne sauvegardait pas les données',
  'Ajout de la gestion de l\'état avec useState',
  ['AircraftForm.jsx', 'useAircraftForm.js']
);
```

#### Logger une nouvelle fonctionnalité

```javascript
await logFeatureAdded(
  'Système de notifications',
  'Notifications en temps réel avec WebSocket',
  ['NotificationService.js', 'NotificationPanel.jsx']
);
```

## 📊 Format des logs dans Google Sheets

| Colonne | Description | Exemple |
|---------|-------------|---------|
| A | Date/Heure | 03/10/2025 15:42:28 |
| B | Action | Modification: AircraftModule.jsx |
| C | Composant | Avions |
| D | Détails | Ajout de la validation... |
| E | Fichiers | AircraftModule.jsx |
| F | Statut | completed |
| G | Auteur | Claude Assistant |

## 🔔 Notifications PowerShell

À chaque log enregistré, une notification s'affiche dans PowerShell:

```
================================================================================
  LOG GOOGLE SHEETS ENREGISTRE
================================================================================
  Date/Heure: 03/10/2025 15:42:28
  Action:     Correction script PowerShell
  Composant:  Systeme de logging
  Fichiers:   notify-update.ps1
  Details:    Correction des problemes d'encodage...
================================================================================
  Lien: https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWa...
================================================================================
```

## 📁 Structure des fichiers

```
alflight/
├── server/
│   └── googleSheetsServer.js        # Serveur backend Google Sheets
├── src/
│   └── services/
│       └── claudeUpdateLogger.js    # Service de logging client
├── scripts/
│   └── notify-update.ps1            # Script de notification PowerShell
├── tracking/
│   └── claude-updates.log           # Log local des modifications
└── D:\Applicator\
    └── alfight-46443ca54259.json    # Credentials Google Service Account
```

## 🔧 Détection automatique des composants

Le système détecte automatiquement le composant basé sur le chemin du fichier:

| Chemin contient | Composant détecté |
|----------------|------------------|
| `aircraft` | Avions |
| `pilot` | Pilotes |
| `logbook` | Carnet de vol |
| `flight` | Vols |
| `wizard` | Assistant |
| `chart`, `performance` | Performances |
| `export`, `import` | Import/Export |
| `stat` | Statistiques |
| `map` | Carte |
| `weather` | Météo |

## 🛠️ Dépannage

### Le serveur ne démarre pas

Vérifiez que le port 3001 n'est pas déjà utilisé:

```bash
netstat -ano | findstr :3001
taskkill //F //PID <PID>
```

### Les logs ne s'enregistrent pas

1. Vérifiez que le serveur est démarré
2. Testez la connexion: `curl http://localhost:3001/health`
3. Vérifiez les credentials: `D:\Applicator\alfight-46443ca54259.json`

### La notification PowerShell ne s'affiche pas

1. Vérifiez que le script existe: `scripts/notify-update.ps1`
2. Testez manuellement:
   ```powershell
   powershell -ExecutionPolicy Bypass -File "D:\Applicator\alflight\scripts\notify-update.ps1" -Action "Test" -Component "Test"
   ```

## 📝 Logs locaux

En plus du Google Sheet, un fichier log local est créé:

**Emplacement** : `D:\Applicator\alflight\tracking\claude-updates.log`

Format:
```
[2025-10-03 15:42:28] Correction script PowerShell | Systeme de logging | notify-update.ps1
```

## 🔗 Liens utiles

- [Google Sheet Tracking](https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k/edit)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Service Account Guide](https://cloud.google.com/iam/docs/service-accounts)

## ✅ Fonctionnalités

- ✅ Connexion automatique à Google Sheets via Service Account
- ✅ Notifications PowerShell colorées à chaque mise à jour
- ✅ Détection automatique du composant modifié
- ✅ Log local de secours
- ✅ File d'attente en cas d'erreur réseau
- ✅ Son de notification
- ✅ Gestion des caractères spéciaux et encodage UTF-8

## 🎯 Utilisation par Claude

À chaque modification que je (Claude) effectue dans ton projet, je vais:

1. **Automatiquement appeler** le service de logging
2. **Enregistrer** la modification dans le Google Sheet
3. **Afficher** une notification PowerShell confirmant l'enregistrement
4. **Te montrer** la confirmation dans le terminal

Tu verras ainsi en temps réel chaque modification que j'effectue!
