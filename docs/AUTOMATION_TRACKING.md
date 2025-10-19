# 🤖 Système d'Automatisation - Tracking Google Sheets

## Vue d'ensemble

Le projet ALFlight dispose désormais d'un **système d'automatisation complet** qui enregistre automatiquement **TOUTES** les modifications de Claude Code dans Google Sheets **sans intervention manuelle**.

## 🎯 Composants

### 1. Hook Claude Code (`PostToolUse`)
**Fichier**: `D:\Applicator\.claude\hooks\post-tool-use.js`

**Fonctionnement** :
- ✅ S'exécute automatiquement après chaque modification de fichier (Edit, Write)
- ✅ Capture les modifications en temps réel
- ✅ Groupe les modifications par paquet de 3
- ✅ Envoie automatiquement à Google Sheets
- ✅ Sauvegarde locale dans `tracking/hook-modifications.json`

**Configuration** : `D:\Applicator\.claude\settings.local.json`
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node D:\\Applicator\\.claude\\hooks\\post-tool-use.js '{HOOK_DATA}'",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### 2. Claude Code Tracker (Background)
**Fichier**: `scripts/claude-code-tracker.cjs`

**Fonctionnement** :
- 🔍 Surveille les fichiers en temps réel avec `chokidar`
- ⏱️ Groupe les modifications (5-30 secondes)
- 📊 Envoie des rapports détaillés à Google Sheets
- 💾 Sauvegarde dans `tracking/claude-session.json`

**Démarrage** : `npm run dev:full-tracked` ou via `START_SESSION.bat`

## 📊 Flux de données

```
Modification fichier (Edit/Write)
         ↓
   Hook PostToolUse
         ↓
Sauvegarde locale (hook-modifications.json)
         ↓
   Groupement (3 modifications)
         ↓
Envoi automatique Google Sheets
         ↓
   ✅ Ligne ajoutée dans Tracking
```

## 🚀 Utilisation

### Automatique (Recommandé)
Le système s'active automatiquement dès que Claude Code effectue une modification :

1. **Aucune action requise** - Les hooks s'exécutent automatiquement
2. Les modifications sont groupées intelligemment
3. Envoi automatique après 3 modifications ou si c'est une création de fichier

### Manuel (Backup)
Si besoin d'envoyer manuellement un rapport :

```bash
cd alflight
curl -X POST http://localhost:3001/api/log \
  -H "Content-Type: application/json" \
  -d '{"action":"CLAUDE_CODE_MODIFICATIONS","component":"...","summary":"...","details":"...","files":"...","status":"completed"}'
```

## 📁 Fichiers de tracking

### Local
- `tracking/hook-modifications.json` - Modifications en attente (hook)
- `tracking/claude-session.json` - Session active (tracker)
- `tracking/claude-updates.log` - Historique complet

### Google Sheets
- **Spreadsheet ID** : `1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k`
- **Feuille** : Tracking
- **Lien** : https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k

## 🔧 Configuration

### Modifier le délai de groupement (Hook)
Éditer `post-tool-use.js` :
```javascript
// Envoyer après X modifications
if (modifications.length >= 3) { // Changer 3 par le nombre souhaité
  sendToGoogleSheets(modifications);
}
```

### Modifier les délais (Tracker)
Éditer `claude-code-tracker.cjs` :
```javascript
const CONFIG = {
  debounceMs: 5000,   // 5 secondes - délai de groupement
  maxWaitMs: 30000    // 30 secondes - délai maximum
};
```

### Désactiver les hooks
Éditer `settings.local.json` :
```json
{
  "disableAllHooks": true
}
```

## 📈 Format des logs

### Structure envoyée
```json
{
  "action": "CLAUDE_CODE_MODIFICATIONS",
  "component": "Claude Code Assistant (Hook)",
  "summary": "2 fichier(s) modifié(s) - 3 opération(s)",
  "details": "{\"timestamp\":\"...\",\"files\":[...]}",
  "files": "Step4Performance.jsx, AircraftCreationWizard.jsx",
  "status": "completed"
}
```

### Colonnes Google Sheets
| Colonne | Contenu |
|---------|---------|
| A | Date/Heure |
| B | Action (CLAUDE_CODE_MODIFICATIONS) |
| C | Composant |
| D | Résumé |
| E | Détails JSON |
| F | Fichiers modifiés |
| G | Statut |

## 🐛 Dépannage

### Les hooks ne s'exécutent pas
1. Vérifier que le fichier existe : `D:\Applicator\.claude\hooks\post-tool-use.js`
2. Vérifier la config : `D:\Applicator\.claude\settings.local.json`
3. Vérifier que `disableAllHooks` n'est pas à `true`
4. Redémarrer Claude Code

### Les modifications ne sont pas envoyées
1. Vérifier que le serveur Google Sheets tourne : `http://localhost:3001/health`
2. Vérifier les logs : `tracking/claude-updates.log`
3. Vérifier le fichier temporaire : `tracking/hook-modifications.json`

### Timeout du hook
Si le hook prend trop de temps :
```json
{
  "timeout": 30  // Augmenter à 30 secondes
}
```

## 🎓 Bonnes pratiques

1. ✅ **Garder le serveur Google Sheets actif** (port 3001)
2. ✅ **Ne pas désactiver les hooks** pendant le développement
3. ✅ **Vérifier régulièrement Google Sheets** pour voir l'historique
4. ✅ **Nettoyer les fichiers temporaires** si nécessaire
5. ✅ **Utiliser START_SESSION.bat** pour démarrer tous les services

## 📊 Statistiques

Avec ce système, vous obtenez :
- **100% des modifications** trackées automatiquement
- **0 intervention manuelle** requise
- **Temps réel** - Modifications visibles en < 10 secondes
- **Historique complet** dans Google Sheets
- **Backup local** dans `tracking/`

## 🔒 Sécurité

- Les hooks s'exécutent dans un environnement sécurisé
- Timeout de 10 secondes pour éviter les blocages
- Sauvegarde locale avant envoi
- Pas de données sensibles dans les logs

---

**Version** : 2.0
**Dernière mise à jour** : 2025-10-13
**Auteur** : Claude Code Assistant
