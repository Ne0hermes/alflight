# 📊 Système de Tracking Automatique

Ce système surveille automatiquement les modifications de fichiers dans le projet et les enregistre dans Google Sheets pour un suivi complet de l'évolution du code.

## 🚀 Démarrage Rapide

### Option 1 : Tracker seul
```bash
npm run dev:tracker
```

### Option 2 : Dev complet avec tracking automatique
```bash
npm run dev:tracked
```

Cette commande lance en parallèle :
- ✅ Vite (frontend)
- ✅ Google Sheets Logger (backend)
- ✅ Auto Tracker (surveillance des fichiers)

## 📋 Fonctionnalités

### Détection Automatique
Le tracker détecte automatiquement :
- ✏️ **Modifications de fichiers** (.js, .jsx, .css, .json)
- ➕ **Ajouts de fichiers**
- ❌ **Suppressions de fichiers**
- 📦 **Composant/Module concerné**
- 🌿 **Branche Git active**
- 👤 **Auteur du dernier commit**

### Groupement Intelligent
- Les changements sont groupés par composant
- Délai de 2 secondes pour regrouper les modifications simultanées
- Évite les logs dupliqués

### Catégorisation Automatique
Le système identifie automatiquement le type de changement :

| Type de fichier | Catégorie |
|----------------|-----------|
| `features/aircraft/*` | Aircraft Module |
| `features/flight-wizard/*` | Flight Wizard |
| `features/logbook/*` | Logbook |
| `features/pilot/*` | Pilot Module |
| `utils/*` | Utilities |
| `core/stores/*` | State Management |
| `core/contexts/*` | Contexts |
| `server/*` | Backend |
| `*.css` | Styles |
| `*.json` | Configuration |

## 📊 Exemple de Log

Quand vous modifiez `src/features/aircraft/AircraftModule.jsx`, le système log automatiquement :

```
Action: Code update - Aircraft Module
Details: Code update. Files: change: src/features/aircraft/AircraftModule.jsx. Branch: main
```

## ⚙️ Configuration

### Fichier : `scripts/autoTracker.js`

```javascript
const CONFIG = {
  // Dossiers surveillés
  watchPaths: [
    'src/**/*.js',
    'src/**/*.jsx',
    'src/**/*.css',
    'src/**/*.json',
    'server/**/*.js'
  ],

  // Fichiers ignorés
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**'
  ],

  // Délai de regroupement (ms)
  debounceMs: 2000,

  // Logs détaillés
  verbose: true
};
```

## 🛠️ Utilisation en PowerShell

### Lancer le tracker
```powershell
cd D:\Applicator\alflight
npm run dev:tracker
```

### Arrêter proprement
Appuyez sur `Ctrl+C` - le tracker va :
1. Logger les changements en attente
2. Enregistrer un log "Auto Tracker stopped"
3. Fermer proprement

## 📈 Suivi dans Google Sheets

Tous les logs sont enregistrés dans :
- **Spreadsheet ID**: `1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k`
- **Feuille**: `Tracking`
- **Colonnes**: Date | Heure | Action | Détails | Catégorie

## 🔍 Vérification

Pour vérifier que le tracker fonctionne :

1. **Lancez le tracker** : `npm run dev:tracker`
2. **Modifiez un fichier** : Par exemple `src/features/aircraft/AircraftModule.jsx`
3. **Attendez 2 secondes** (délai de debounce)
4. **Vérifiez la console** : Vous devriez voir `✅ Logged: Code update - Aircraft Module`
5. **Vérifiez Google Sheets** : Une nouvelle ligne doit apparaître

## 🎯 Cas d'Usage

### Développement quotidien
```bash
npm run dev:tracked
```
→ Tout est tracké automatiquement pendant que vous développez

### Suivi de session
Le tracker enregistre :
- ✅ Démarrage de session
- ✅ Toutes les modifications
- ✅ Fin de session

### Debug et historique
- Consultez Google Sheets pour voir l'historique complet des modifications
- Identifiez quand et où des bugs ont été introduits
- Suivez l'évolution de chaque module

## 🚨 Dépannage

### Le tracker ne démarre pas
```bash
# Vérifier que le serveur Google Sheets est actif
curl http://localhost:3001/api/log -X POST -H "Content-Type: application/json" -d '{"action":"Test","details":"Test"}'
```

### Les logs n'apparaissent pas
1. Vérifiez que `server/googleSheetsServer.js` est actif
2. Vérifiez la connexion à Google Sheets
3. Regardez les logs dans la console du tracker

### Trop de logs
Modifiez `CONFIG.debounceMs` pour augmenter le délai de regroupement :
```javascript
debounceMs: 5000 // 5 secondes au lieu de 2
```

## 📝 Notes

- Le tracker utilise `chokidar` pour surveiller les fichiers
- Les changements sont groupés intelligemment pour éviter le spam
- L'arrêt avec Ctrl+C est propre et log la fin de session
- Compatible avec Windows PowerShell et Linux/Mac

## 🎓 Exemple de Session Complète

```powershell
# Terminal 1 : Lancer l'environnement avec tracking
npm run dev:tracked

# Le tracker affiche :
# 🚀 Starting Auto Tracker...
# 📁 Watching: D:\Applicator\alflight
# 🎯 Endpoint: http://localhost:3001/api/log
# ⏱️  Debounce: 2000ms
# 📌 Branch: main
# 👤 Author: YourName
# ✅ Auto Tracker is running. Press Ctrl+C to stop.

# Vous modifiez des fichiers...

# Le tracker affiche :
# 📝 CHANGE: src/features/aircraft/AircraftModule.jsx (Aircraft Module)
# 📊 Processing 1 change(s)...
# ✅ Logged: Code update - Aircraft Module → Tracking!A97:G97
# ✅ All changes logged

# Quand vous avez fini, Ctrl+C :
# 🛑 Stopping Auto Tracker...
# ✅ Logged: Auto Tracker stopped → Tracking!A98:G98
```

---

**Créé le** : 2025-10-04
**Version** : 1.0
**Auteur** : Claude Code Assistant
