# 🚀 Quick Start - Logging Automatique Google Sheets

## ⚡ Démarrage Rapide (2 minutes)

### Option 1: Double-clic sur le fichier .bat

```
start-logging-server.bat
```

### Option 2: Ligne de commande

```bash
cd D:\Applicator\alflight
node server/googleSheetsServer.js
```

### Option 3: Avec l'application React

```bash
npm run dev
```
(Le serveur de logging démarre automatiquement avec Vite)

## ✅ Vérification

Une fois démarré, vous devriez voir:

```
🚀 Serveur Google Sheets Logger démarré sur http://localhost:3001
📊 Spreadsheet ID: 1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
📄 Feuille: Tracking
🔑 Credentials: D:\Applicator\alfight-46443ca54259.json

⏳ Initialisation Google Sheets...
✅ Authentification Google Sheets réussie
✅ Feuille Tracking trouvée

✅ Serveur prêt à recevoir les logs
```

## 📝 Comment ça marche ?

**Automatique !** Chaque fois que Claude fait une modification:

1. 📊 **Log ajouté** dans ton Google Sheet
2. 🔔 **Notification PowerShell** s'affiche
3. 💾 **Log local** créé dans `tracking/claude-updates.log`

## 🎯 Exemple de notification

```
================================================================================
  LOG GOOGLE SHEETS ENREGISTRE
================================================================================
  Date/Heure: 03/10/2025 15:43:35
  Action:     Implementation systeme de logging automatique Google Sheets
  Composant:  Infrastructure
  Fichiers:   claudeUpdateLogger.js, googleSheetsServer.js
================================================================================
```

## 🔗 Accès au Google Sheet

[Ouvrir le Google Sheet Tracking](https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k/edit)

## 🛠️ Dépannage Express

### Le serveur ne démarre pas ?

```bash
# Tuer le processus existant sur le port 3001
netstat -ano | findstr :3001
taskkill //F //PID <PID_trouvé>
```

### Tester manuellement ?

```bash
# Test de connexion
curl http://localhost:3001/health

# Envoyer un log de test
curl -X POST http://localhost:3001/api/log -H "Content-Type: application/json" -d "{\"action\":\"Test\",\"component\":\"Test\",\"details\":\"Test\",\"status\":\"completed\"}"
```

## 📚 Documentation complète

Voir: `GOOGLE_SHEETS_AUTO_LOGGING.md`

---

**C'est tout ! Le système est maintenant actif et enregistre automatiquement chaque modification de Claude. 🎉**
