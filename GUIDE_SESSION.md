# 🚀 GUIDE DE DEMARRAGE DE SESSION

## 📋 Procédure au début de chaque session Claude Code

### Option 1 : Commande slash (Recommandé)
```
/start
```

### Option 2 : Script PowerShell
```bash
powershell -ExecutionPolicy Bypass -File START_SESSION.ps1
```

### Option 3 : Script Batch
```bash
START_SESSION.bat
```

### Option 4 : Commande manuelle
```bash
cd /d/Applicator/alflight && node server/googleSheetsServer.js &
```

## ✅ Vérification du serveur

Après le démarrage, vérifiez que le serveur est opérationnel :

```bash
curl http://localhost:3001/health
```

**Réponse attendue :**
```json
{
  "status": "ok",
  "service": "Google Sheets Logger",
  "spreadsheet": "1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k",
  "sheet": "Tracking"
}
```

## 📊 Accès au Google Sheets

**Lien direct :** https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k/edit

## 🔄 Tracking automatique

Une fois le serveur démarré, **toutes vos modifications sont automatiquement synchronisées** :

- ✅ **Write** (création de fichiers)
- ✅ **Edit** (modifications)
- ✅ **Delete** (suppressions)

Les hooks sont configurés dans `.claude/hooks/` et activés dans `.claude/settings.local.json`.

## 📝 Tracking manuel (optionnel)

Si vous souhaitez tracker une action spécifique manuellement :

```bash
powershell -ExecutionPolicy Bypass -File scripts/auto-track.ps1 -Operation [Write|Edit|Delete] -FilePath "chemin/fichier" -Summary "Description"
```

**Exemples :**
```bash
# Création
powershell -ExecutionPolicy Bypass -File scripts/auto-track.ps1 -Operation Write -FilePath "src/App.jsx" -Summary "Nouveau composant principal"

# Modification
powershell -ExecutionPolicy Bypass -File scripts/auto-track.ps1 -Operation Edit -FilePath "package.json" -Summary "Ajout dépendances"

# Suppression
powershell -ExecutionPolicy Bypass -File scripts/auto-track.ps1 -Operation Delete -FilePath "old-file.js" -Summary "Nettoyage code obsolète"
```

## 🛑 Arrêt du serveur

Si vous devez arrêter le serveur :

```bash
# Windows
taskkill /F /IM node.exe

# Ou trouver le PID spécifique
netstat -ano | findstr :3001
taskkill /F /PID <PID>
```

## 📍 Logs

- **Google Sheets** : Synchronisation en temps réel
- **Logs locaux** : `tracking/claude-updates.log`
- **Logs serveur** : Console où le serveur Node.js tourne

## 🎯 Workflow complet

1. **Démarrer la session** : `/start` ou `START_SESSION.bat`
2. **Vérifier** : `curl http://localhost:3001/health`
3. **Travailler normalement** : Les modifications sont auto-trackées
4. **Consulter les logs** : Ouvrir le Google Sheets

## ⚠️ Dépannage

### Le serveur ne démarre pas
- Vérifier que le port 3001 est libre : `netstat -ano | findstr :3001`
- Vérifier les credentials : `D:\Applicator\alfight-46443ca54259.json`

### Les logs ne s'enregistrent pas
- Vérifier que le serveur est actif : `curl http://localhost:3001/health`
- Vérifier les hooks : `.claude/settings.local.json`
- Tester manuellement : `powershell -ExecutionPolicy Bypass -File scripts/auto-track.ps1 ...`

### Erreur d'authentification Google
- Vérifier que le service account a accès au spreadsheet
- Vérifier que l'API Google Sheets est activée
