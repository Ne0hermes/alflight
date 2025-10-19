# Guide de Logging pour Claude Code

## 📋 Vue d'ensemble

Ce guide explique comment **Claude Code doit systématiquement enregistrer ses actions** dans Google Sheets.

---

## 🎯 RÈGLE PRINCIPALE

**À chaque fois que Claude Code termine une tâche ou effectue des modifications, il DOIT envoyer un résumé à Google Sheets.**

---

## 📊 Comment enregistrer une action

### Méthode via PowerShell (Recommandée)

```powershell
.\scripts\claude-log-action.ps1 `
  -Summary "Résumé court de l'action" `
  -Details "Explication détaillée de ce qui a été fait" `
  -Files "fichier1.js, fichier2.jsx" `
  -Component "Composant concerné"
```

### Méthode via curl

```bash
curl -X POST http://localhost:3001/api/log \
  -H "Content-Type: application/json" \
  -d '{
    "action": "CLAUDE_CODE_ACTION",
    "component": "Composant",
    "summary": "Résumé",
    "details": "Détails complets",
    "files": "fichiers modifiés",
    "status": "completed"
  }'
```

---

## 📝 Format des résumés

### 1. Résumé court (Summary)
**1 ligne** décrivant l'action principale
```
Correction de 41 erreurs de syntaxe dans l'application
```

### 2. Détails complets (Details)
**Explication complète** avec:
- Ce qui a été fait
- Pourquoi
- Comment
- Résultat

```
Corrections effectuées :
✅ 19 fichiers corrigés manuellement
✅ 41 fichiers corrigés via script automatisé
✅ Création de fix-all-errors.cjs pour automatiser les réparations

Problèmes résolus :
- Parenthèses manquantes dans React.memo
- Console.log cassés
- useEffect mal fermés
- Fonctions initialize() incomplètes

Résultat : Application fonctionnelle, serveur Vite lancé sur port 4004
```

---

## 🔄 Workflow de Claude Code

### Avant de commencer
1. Lire la demande de l'utilisateur
2. Planifier les étapes

### Pendant le travail
- Effectuer les modifications
- Noter mentalement ce qui est fait

### **Après chaque tâche complétée** ⚠️ OBLIGATOIRE
```powershell
.\scripts\claude-log-action.ps1 `
  -Summary "Ce que j'ai fait en 1 ligne" `
  -Details "Explication détaillée de TOUT ce qui a été modifié, pourquoi, et le résultat" `
  -Files "liste, des, fichiers, modifiés" `
  -Component "Composant concerné"
```

---

## 📋 Exemples concrets

### Exemple 1 : Correction de bugs
```powershell
.\scripts\claude-log-action.ps1 `
  -Summary "Correction de 41 erreurs de syntaxe" `
  -Details @"
Problème initial : Serveur Vite affichait 41 erreurs ESBuild

Actions effectuées :
1. Création de backup commit (73d9080)
2. Analyse des erreurs (parenthèses manquantes, memo cassés)
3. Corrections manuelles de 19 fichiers critiques
4. Création du script fix-all-errors.cjs
5. Réparation automatisée des 41 fichiers
6. Redémarrage serveur Vite

Résultat :
✅ 0 erreur de syntaxe
✅ Serveur opérationnel sur http://localhost:4004
✅ Application fonctionnelle
✅ Commit final créé (c372de4)
"@ `
  -Files "voir fix-all-errors.cjs pour la liste complète" `
  -Component "Correction syntaxe globale"
```

### Exemple 2 : Nouvelle fonctionnalité
```powershell
.\scripts\claude-log-action.ps1 `
  -Summary "Ajout authentification Google et Apple" `
  -Details @"
Implémentation complète de l'authentification OAuth :

Fichiers créés :
- GoogleSignIn.jsx : Composant Google Sign-In
- AppleSignIn.jsx : Composant Apple Sign-In
- authStore.js : Store Zustand pour l'auth

Fonctionnalités :
✅ Connexion Google (One Tap + bouton)
✅ Connexion Apple (popup)
✅ Gestion des tokens JWT
✅ Refresh automatique
✅ Déconnexion

Intégration : Composants prêts à utiliser dans LoginPage
"@ `
  -Files "GoogleSignIn.jsx, AppleSignIn.jsx, authStore.js" `
  -Component "Authentification"
```

### Exemple 3 : Configuration système
```powershell
.\scripts\claude-log-action.ps1 `
  -Summary "Configuration commit automatique quotidien à 22h" `
  -Details @"
Mise en place du système de sauvegarde automatique :

Scripts créés :
1. daily-auto-commit.ps1 : Script de commit/push quotidien
2. setup-daily-commit-task.ps1 : Configuration tâche Windows
3. claude-log-action.ps1 : Helper de logging

Configuration :
- Tâche Windows programmée à 22h00
- Commit + push automatique si changements
- Logging dans Google Sheets
- Vérification quotidienne des commits

Commande d'installation :
.\scripts\setup-daily-commit-task.ps1
"@ `
  -Files "daily-auto-commit.ps1, setup-daily-commit-task.ps1, claude-log-action.ps1" `
  -Component "Automation Git"
```

---

## 🚨 Points importants

### ✅ TOUJOURS logger :
- Corrections de bugs
- Nouvelles fonctionnalités
- Modifications de fichiers
- Configurations système
- Scripts créés
- Refactoring important

### ❌ NE PAS logger :
- Questions/réponses simples
- Lecture de fichiers
- Recherches dans le code
- Explications sans modification

### 📊 Qualité des résumés :
- **Clair** : Utilisateur doit comprendre immédiatement
- **Complet** : Tous les détails importants
- **Structuré** : Listes, sections, emojis
- **Résultat** : Toujours indiquer le résultat final

---

## 🔗 Vérification

Après chaque log, vérifier dans Google Sheets :
https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k

La ligne doit apparaître avec :
- Date/Heure
- Action (CLAUDE_CODE_ACTION)
- Composant
- Summary
- Details
- Files
- Status

---

## 🎯 Checklist Claude Code

Avant de terminer une tâche :
- [ ] Modifications effectuées
- [ ] Résumé rédigé (court et détaillé)
- [ ] Liste des fichiers modifiés
- [ ] **Log envoyé à Google Sheets** ⚠️ OBLIGATOIRE
- [ ] Confirmation affichée à l'utilisateur

---

**Note importante pour Claude Code :**
Ce logging est SYSTÉMATIQUE. L'utilisateur compte sur Google Sheets pour suivre toutes les modifications. Ne jamais sauter cette étape !
