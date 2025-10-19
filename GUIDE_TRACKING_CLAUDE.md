# 📝 Guide: Enregistrer les modifications Claude Code dans Google Sheets

## 🎯 Objectif

Ce guide explique comment enregistrer automatiquement toutes vos modifications faites avec Claude Code dans Google Sheets avec la structure 8 colonnes.

## ✅ Prérequis

1. Serveur Google Sheets actif: `npm run dev:tracked`
2. Scripts de tracking installés dans `scripts/`

## 🚀 Utilisation Simple

### Après CHAQUE modification avec Claude Code

Exécutez cette commande PowerShell:

```powershell
cd D:\Applicator\alflight
.\scripts\track-change.ps1 "chemin/du/fichier" "action" "description"
```

### Exemples concrets

**1. Après avoir modifié un fichier:**
```powershell
.\scripts\track-change.ps1 "src/components/Header.jsx" "edit" "Ajout du menu de navigation"
```

**2. Après avoir créé un fichier:**
```powershell
.\scripts\track-change.ps1 "src/utils/helper.js" "write" "Nouvelles fonctions utilitaires"
```

**3. Après avoir supprimé un fichier:**
```powershell
.\scripts\track-change.ps1 "src/old/legacy.js" "delete" "Code legacy supprimé"
```

## 📊 Résultat dans Google Sheets

Chaque commande crée une ligne avec:

| Colonne | Contenu | Exemple |
|---------|---------|---------|
| A | Date/Heure | 04/10/2025 12:45:30 |
| B | Action | Code update - Aircraft Module |
| C | Composant | Aircraft Module |
| D | Résumé | Ajout du menu de navigation |
| E | Détails | edit effectué par Claude Code. Branch: main |
| F | Fichiers | src/components/Header.jsx |
| G | Statut | completed |
| H | Auteur | Claude Assistant |

## 💡 Workflow recommandé

### Option 1: Demander à Claude Code de logger

Dans vos prompts, ajoutez:

```
Après avoir fait les modifications, exécute:
powershell -File scripts/track-change.ps1 "[fichier modifié]" "edit" "[description courte]"
```

### Option 2: Logger manuellement après chaque session

1. Listez tous les fichiers modifiés: `git status`
2. Pour chaque fichier, exécutez `track-change.ps1`

### Option 3: Logger en batch

Créez un fichier `log-session.ps1`:

```powershell
# Mes modifications de la session
.\scripts\track-change.ps1 "src/App.jsx" "edit" "Refactoring du composant principal"
.\scripts\track-change.ps1 "src/utils/api.js" "edit" "Ajout de la gestion d'erreurs"
.\scripts\track-change.ps1 "src/components/Modal.jsx" "write" "Nouveau composant modal"
```

Puis exécutez: `.\log-session.ps1`

## 🔍 Vérification

Pour vérifier que vos logs sont enregistrés:

1. **Via le terminal:**
   - Cherchez `✅ Logged:` dans la sortie
   - Notez le numéro de ligne (ex: `Tracking!A114:H114`)

2. **Via Google Sheets:**
   - Ouvrez: https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
   - Vérifiez la dernière ligne

## 🛠️ Dépannage

### ❌ "Failed to log"

**Cause:** Le serveur Google Sheets n'est pas actif

**Solution:**
```powershell
cd D:\Applicator\alflight
npm run dev:tracked
```

### ❌ Erreur "Cannot find path"

**Cause:** Chemin de fichier incorrect

**Solution:** Utilisez des chemins relatifs à partir de `alflight/`:
- ✅ Correct: `src/App.jsx`
- ❌ Incorrect: `D:\Applicator\alflight\src\App.jsx`

## 📌 Commandes rapides à mémoriser

```powershell
# Modification
.\scripts\track-change.ps1 "src/file.js" "edit" "description"

# Création
.\scripts\track-change.ps1 "src/new.js" "write" "description"

# Suppression
.\scripts\track-change.ps1 "src/old.js" "delete" "description"
```

## 🎯 Bonnes pratiques

1. **Descriptions claires:** Expliquez POURQUOI, pas QUOI
   - ❌ "Modification de App.jsx"
   - ✅ "Ajout du système de routing"

2. **Logger immédiatement:** Ne pas attendre la fin de session

3. **Grouper les modifications liées:** Utilisez un script batch

4. **Vérifier les logs:** Consultez régulièrement Google Sheets

## 🔗 Liens utiles

- **Google Sheets:** https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
- **Santé du serveur:** http://localhost:3001/health
- **Documentation complète:** `scripts/README_CLAUDE_TRACKING.md`
