# 🚀 Prompt de Démarrage - Tracking Automatique

## 📋 À copier au début de CHAQUE session avec Claude Code

```
Bonjour Claude!

Configuration de session:
- Projet: D:\Applicator\alflight
- Tracking automatique: ACTIVÉ
- Après CHAQUE modification (Write/Edit), exécute automatiquement:
  powershell -File scripts/track-change.ps1 "[fichier]" "[action]" "[description]"

Actions possibles:
- "write" pour création
- "edit" pour modification
- "delete" pour suppression

Exemple:
Après avoir modifié src/App.jsx, tu dois exécuter:
powershell -File scripts/track-change.ps1 "src/App.jsx" "edit" "Description de la modification"

Important: TOUJOURS exécuter le tracking après chaque outil Write/Edit/Delete.
```

## 📝 Version Courte (Recommandée)

```
Claude, active le tracking automatique:
- Après CHAQUE modification, exécute: powershell -File scripts/track-change.ps1 "[fichier]" "[action]" "[description]"
- Actions: write/edit/delete
```

## 📝 Version Ultra-Courte

```
Claude: tracking auto ON → track-change.ps1 après chaque modif
```

## ✅ Ce que Claude fera automatiquement

1. **Après Write (création):**
```bash
powershell -File scripts/track-change.ps1 "src/new-file.js" "write" "Description"
```

2. **Après Edit (modification):**
```bash
powershell -File scripts/track-change.ps1 "src/existing.js" "edit" "Description"
```

3. **Après suppression:**
```bash
powershell -File scripts/track-change.ps1 "src/old.js" "delete" "Fichier supprimé"
```

## 🔄 Workflow de Session Type

### 1. Démarrage
```
Toi: "Claude: tracking auto ON"
Claude: "OK, tracking automatique activé. Je loggerai chaque modification."
```

### 2. Pendant la session
```
Toi: "Modifie src/App.jsx pour ajouter X"
Claude: [Modifie le fichier]
Claude: [Exécute automatiquement le tracking]
✅ Logged: Code update - ... → Tracking!A123:H123
```

### 3. Vérification
```
Toi: "Montre-moi les derniers logs"
Claude: [Consulte Google Sheets ou affiche les derniers logs]
```

## 📊 Vérifier que ça fonctionne

**Dans le terminal, vous verrez:**
```
✅ Logged: Code update - Aircraft Module → Tracking!A123:H123
```

**Dans Google Sheets:**
- Colonne A: Date/Heure
- Colonne B: Action
- Colonne C: Composant
- Colonne D: Résumé
- Colonne E: Détails
- **Colonne F: Fichiers** ✅ (toujours remplie)
- Colonne G: Statut
- Colonne H: Auteur

## ⚙️ Configuration Alternative (Fichier .clauderc)

Si `.clauderc` existe avec `"autoTrack": true`, Claude devrait le détecter automatiquement.

**Vérifier:**
```powershell
cat .clauderc
```

**Devrait afficher:**
```json
{
  "autoTrack": true,
  "trackingScript": "scripts/track-change.ps1",
  "projectRoot": "D:\\Applicator\\alflight"
}
```

## 🔍 Dépannage

### ❌ Claude n'exécute pas le tracking

**Rappel à donner:**
```
Claude, rappel: après chaque modification, tu dois exécuter:
powershell -File scripts/track-change.ps1 "[fichier]" "[action]" "[description]"
```

### ❌ Le serveur n'est pas démarré

**Démarrer:**
```powershell
npm run dev:tracked
```

**Vérifier:**
```powershell
curl http://localhost:3001/health
```

## 📌 Template de Message Initial

### Option 1: Complet
```
Bonjour Claude!

Session de travail sur Alflight:
- Projet: D:\Applicator\alflight
- Serveur: npm run dev:tracked (déjà lancé)
- Tracking automatique: ACTIVÉ

Rappel: Après chaque Write/Edit/Delete, exécute:
powershell -File scripts/track-change.ps1 "[fichier]" "[action]" "[description]"

Prêt à travailler!
```

### Option 2: Court
```
Claude: tracking auto ON pour session Alflight
→ track-change.ps1 après chaque modif
```

### Option 3: Minimaliste
```
Claude: auto-track ON
```

## 🎯 Exemples de Logs Automatiques

```
# Tu crées un fichier
You: "Crée src/components/NewComponent.jsx"
Claude: [Crée le fichier]
Claude: powershell -File scripts/track-change.ps1 "src/components/NewComponent.jsx" "write" "Création du nouveau composant"
✅ Logged: File created - Unknown → Tracking!A124:H124

# Tu modifies un fichier
You: "Modifie src/App.jsx pour ajouter le routing"
Claude: [Modifie le fichier]
Claude: powershell -File scripts/track-change.ps1 "src/App.jsx" "edit" "Ajout du système de routing"
✅ Logged: Code update - Unknown → Tracking!A125:H125
```

## 🚀 Commencer Maintenant

**Copie ce message au début de ta prochaine session:**

```
Claude: Session Alflight - Tracking automatique ACTIVÉ
Exécute track-change.ps1 après chaque Write/Edit/Delete
```

C'est tout! Claude s'occupera du reste automatiquement. 🎉
