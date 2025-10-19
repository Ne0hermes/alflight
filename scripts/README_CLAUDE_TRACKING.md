# 🤖 Tracking des modifications Claude Code vers Google Sheets

Ce système permet d'enregistrer automatiquement toutes les modifications faites par Claude Code dans Google Sheets.

## 📋 Structure 8 colonnes

Date/Heure | Action | Composant | Résumé | Détails | Fichiers | Statut | Auteur

## 🚀 Utilisation

### Option 1: Appel manuel après chaque modification

Après avoir modifié un fichier avec Claude Code, exécutez:

```powershell
# Pour une modification
.\scripts\track-change.ps1 "src/components/MonComposant.jsx" "edit" "Description de la modification"

# Pour une création
.\scripts\track-change.ps1 "src/utils/newFile.js" "write" "Nouveau fichier créé"

# Pour une suppression
.\scripts\track-change.ps1 "src/old/deprecated.js" "delete" "Fichier supprimé"
```

### Option 2: Via hooks Claude Code (si supporté)

Les hooks sont configurés dans `.claude/hooks/`:
- `on-file-write.ps1` - Appelé automatiquement lors de la création d'un fichier
- `on-file-edit.ps1` - Appelé automatiquement lors de la modification d'un fichier

### Option 3: Logging depuis Claude Code directement

Dans vos prompts à Claude Code, demandez-lui d'exécuter:

```
Après avoir modifié [fichier], exécute:
powershell -File scripts/track-change.ps1 "[fichier]" "edit" "[description]"
```

## 📝 Scripts disponibles

### `log-claude-change.ps1`
Script principal qui envoie les données à Google Sheets.

**Paramètres:**
- `-FilePath`: Chemin du fichier (obligatoire)
- `-Action`: Type d'action (edit/write/delete)
- `-Summary`: Résumé de la modification

### `track-change.ps1`
Wrapper simplifié pour un usage facile.

**Exemple:**
```powershell
.\scripts\track-change.ps1 "src/App.jsx" "edit" "Ajout du nouveau composant"
```

## 🔗 Intégration avec le serveur de logging

Le système envoie automatiquement les données à:
- **Endpoint**: http://localhost:3001/api/log
- **Google Sheets**: https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k

## 📊 Détection automatique du composant

Le système détecte automatiquement le composant basé sur le chemin:
- `features/aircraft` → Aircraft Module
- `features/flight-wizard` → Flight Wizard
- `features/logbook` → Logbook
- `features/pilot` → Pilot Module
- `utils` → Utilities
- `core/stores` → State Management
- `server` → Backend
- `scripts` → Scripts

## ✅ Vérifier les logs

Les logs sont enregistrés dans Google Sheets à chaque appel réussi:
```
✅ Logged: Code update - Aircraft Module → Tracking!A114:H114
```

## 🛠️ Dépannage

Si le logging échoue:
1. Vérifier que le serveur Google Sheets est actif: `http://localhost:3001/health`
2. Vérifier les credentials: `D:\Applicator\alfight-46443ca54259.json`
3. Vérifier la connexion Internet

## 📌 Notes importantes

- Le serveur Google Sheets doit être actif (`npm run dev:tracked`)
- Les modifications sont loggées en temps réel
- La colonne F (Fichiers) est systématiquement remplie
- Le système utilise les infos Git (branche actuelle)
