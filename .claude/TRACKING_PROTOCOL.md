# 📋 PROTOCOLE DE TRACKING AUTOMATIQUE

## ⚠️ RÈGLE OBLIGATOIRE

**Après CHAQUE opération Write/Edit/Delete, TOUJOURS exécuter le script de tracking.**

## 🔄 Workflow Standard

### 1️⃣ Après Write (Création de fichier)
```bash
powershell -ExecutionPolicy Bypass -File scripts/auto-track.ps1 -Operation Write -FilePath "chemin/fichier" -Summary "Description"
```

### 2️⃣ Après Edit (Modification de fichier)
```bash
powershell -ExecutionPolicy Bypass -File scripts/auto-track.ps1 -Operation Edit -FilePath "chemin/fichier" -Summary "Description"
```

### 3️⃣ Après Delete (Suppression de fichier)
```bash
powershell -ExecutionPolicy Bypass -File scripts/auto-track.ps1 -Operation Delete -FilePath "chemin/fichier" -Summary "Description"
```

## ✅ Checklist de Confirmation

Après chaque opération, vérifier:

- [ ] Le serveur Google Sheets est actif (port 3001)
- [ ] Le script de tracking a été exécuté
- [ ] Un message de confirmation apparaît
- [ ] La ligne a été ajoutée dans Google Sheets

## 🎯 Statut Actuel

- **Serveur Google Sheets**: ✅ ACTIF (port 3001)
- **Spreadsheet ID**: `1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k`
- **Feuille**: `Tracking`
- **Hooks configurés**: ✅ OUI (.claude/hooks/)

## 🔗 Vérification Google Sheets

URL directe: https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k/edit

## 📝 Notes

- Le serveur doit être démarré avant toute opération
- Chaque modification est loguée en temps réel
- Les logs locaux sont aussi sauvegardés dans `tracking/claude-updates.log`
