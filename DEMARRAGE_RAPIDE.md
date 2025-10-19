# 🚀 Guide de Démarrage Rapide - Alflight avec Tracking

## 📋 Méthode 1 : Double-clic (PLUS SIMPLE)

1. **Double-cliquez sur** `START_DEV_TRACKING.bat`
2. Le script va :
   - ✅ Vérifier Node.js, npm, dépendances
   - ✅ Vérifier les ports 3001 et 4001
   - ✅ Vérifier la connexion Internet
   - ✅ Demander confirmation
   - ✅ Démarrer tout automatiquement

3. **Résultat** :
   - Frontend : http://localhost:4001
   - Logger : http://localhost:3001
   - Tracker : Actif en arrière-plan

## 📋 Méthode 2 : PowerShell

```powershell
cd D:\Applicator\alflight
.\start-dev-tracked.ps1
```

## 📋 Méthode 3 : npm (si vous préférez)

```powershell
cd D:\Applicator\alflight
npm run dev:tracked
```

## 🔄 Démarrage Automatique à l'Ouverture de Windows

### Option A : Tâche Planifiée (Recommandé)

1. **Ouvrir le Planificateur de tâches Windows**
   - Appuyez sur `Win + R`
   - Tapez `taskschd.msc`
   - Appuyez sur Entrée

2. **Créer une nouvelle tâche**
   - Cliquez sur "Créer une tâche..." (à droite)
   - **Nom** : `Alflight Dev Tracking`
   - **Description** : `Démarre automatiquement le dev avec tracking`
   - Cochez : "Exécuter avec les autorisations maximales"

3. **Déclencheur**
   - Onglet "Déclencheurs" → "Nouveau..."
   - **Lancer la tâche** : "À l'ouverture de session"
   - **Utilisateur spécifique** : Votre compte
   - **Retarder la tâche de** : 30 secondes (laisser Windows démarrer)
   - OK

4. **Action**
   - Onglet "Actions" → "Nouveau..."
   - **Action** : "Démarrer un programme"
   - **Programme** : `powershell.exe`
   - **Arguments** : `-ExecutionPolicy Bypass -File "D:\Applicator\alflight\start-dev-tracked.ps1"`
   - **Commencer dans** : `D:\Applicator\alflight`
   - OK

5. **Conditions**
   - Décochez "Démarrer la tâche uniquement si l'ordinateur est relié au secteur"
   - Cochez "Démarrer la tâche même si l'ordinateur fonctionne sur batterie"

6. **Paramètres**
   - Cochez "Autoriser l'exécution de la tâche à la demande"
   - **Si la tâche échoue** : Ne pas redémarrer

7. **OK** pour sauvegarder

### Option B : Dossier Démarrage (Plus Simple mais Moins Contrôle)

1. **Ouvrir le dossier Démarrage**
   ```
   Win + R → shell:startup → Entrée
   ```

2. **Créer un raccourci**
   - Clic droit → "Nouveau" → "Raccourci"
   - **Emplacement** : `D:\Applicator\alflight\START_DEV_TRACKING.bat`
   - **Nom** : `Alflight Dev Tracking`
   - Terminer

3. **Au prochain démarrage**, le script s'exécutera automatiquement

### Option C : Script PowerShell Profile (Pour Développeurs)

Ajoutez au profil PowerShell (`$PROFILE`) :

```powershell
# Fonction pour démarrer Alflight
function Start-Alflight {
    Set-Location "D:\Applicator\alflight"
    .\start-dev-tracked.ps1
}

# Alias rapide
Set-Alias alflight Start-Alflight

# Démarrage automatique au lancement de PowerShell (optionnel)
# Décommentez la ligne suivante pour un démarrage automatique
# Start-Alflight
```

Ensuite, tapez simplement `alflight` dans PowerShell pour démarrer.

## ✅ Vérification du Tracking

### Pendant le développement

1. **Modifiez un fichier** (ex: `src/features/aircraft/AircraftModule.jsx`)
2. **Attendez 2 secondes** (délai de regroupement)
3. **Vérifiez la console** du tracker :
   ```
   📝 CHANGE: src/features/aircraft/AircraftModule.jsx (Aircraft Module)
   📊 Processing 1 change(s)...
   ✅ Logged: Code update - Aircraft Module → Tracking!A99:G99
   ```

### Dans Google Sheets

Ouvrez : https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k

Vous verrez :
- Date et heure
- Action (ex: "Code update - Aircraft Module")
- Détails (fichiers modifiés, branche Git)

## 🛑 Arrêt Propre

### Méthode 1 : Ctrl+C dans le terminal
Le tracker va :
1. Logger les changements en attente
2. Enregistrer "Auto Tracker stopped"
3. Fermer proprement

### Méthode 2 : Fermer la fenêtre
Moins propre mais fonctionnel

## 📊 Logs Automatiques Enregistrés

Le système log automatiquement :

| Action | Quand |
|--------|-------|
| Dev session started | Au démarrage du script |
| Code update - [Module] | Modification de fichier |
| File added - [Module] | Ajout de fichier |
| File deleted - [Module] | Suppression de fichier |
| Auto Tracker started | Démarrage du tracker |
| Auto Tracker stopped | Arrêt du tracker (Ctrl+C) |

## 🔧 Dépannage

### Le script ne démarre pas

**Problème** : Erreur "Impossible d'exécuter des scripts"

**Solution** :
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Le port 3001 ou 4001 est occupé

**Solution 1** : Le script propose de l'arrêter automatiquement (répondez 'o')

**Solution 2** : Manuellement
```powershell
# Trouver le processus
Get-NetTCPConnection -LocalPort 3001 | Select-Object OwningProcess

# Arrêter le processus
Stop-Process -Id [ID_DU_PROCESSUS] -Force
```

### Le tracking ne fonctionne pas

**Vérifiez** :
1. Le serveur Google Sheets est actif (port 3001)
2. La connexion Internet fonctionne
3. Les logs dans la console du tracker

**Relancer** :
```powershell
cd D:\Applicator\alflight
npm run dev:tracker
```

## 📝 Commandes Rapides

```powershell
# Démarrer avec tracking
npm run dev:tracked

# Démarrer sans tracking
npm run dev

# Tracker seul
npm run dev:tracker

# Logger Google Sheets seul
npm run dev:logger

# Frontend seul
npm run dev:frontend
```

## 🎯 Utilisation Quotidienne

### Routine Recommandée

**Matin** :
1. Double-clic sur `START_DEV_TRACKING.bat`
2. Confirmer le démarrage
3. Développer normalement

**Pendant** :
- Le tracker log automatiquement vos modifications
- Consultez Google Sheets pour le suivi

**Soir** :
- `Ctrl+C` pour arrêter proprement
- Le tracker log la fin de session

### Avantages

✅ **Traçabilité complète** de vos modifications
✅ **Historique automatique** dans Google Sheets
✅ **Identification rapide** des bugs (quand/où introduits)
✅ **Suivi de progression** par module
✅ **Pas d'action manuelle** nécessaire

---

**Créé le** : 2025-10-04
**Auteur** : Claude Code Assistant
**Version** : 1.0
