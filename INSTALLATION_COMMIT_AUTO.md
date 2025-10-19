# Installation du Commit Automatique Quotidien

## 🎯 Objectif

Créer un commit + push automatique **tous les jours à 22h00**.

---

## 📋 Installation (À faire UNE SEULE FOIS)

### Étape 1 : Lancer PowerShell en Administrateur

1. Appuyer sur `Windows + X`
2. Choisir **"Windows PowerShell (Admin)"** ou **"Terminal (Admin)"**

### Étape 2 : Exécuter le script d'installation

```powershell
cd D:\Applicator\alflight
.\scripts\setup-daily-commit-task.ps1
```

### Étape 3 : Confirmer le test (optionnel)

Le script demandera si vous voulez tester immédiatement. Répondre `o` pour tester.

---

## ✅ Vérification

### Voir la tâche planifiée :

```powershell
Get-ScheduledTask -TaskName "AlFlight-Daily-Commit-22h"
```

### Voir quand elle s'est exécutée :

```powershell
Get-ScheduledTask -TaskName "AlFlight-Daily-Commit-22h" | Get-ScheduledTaskInfo
```

### Ouvrir le planificateur de tâches Windows :

1. Appuyer sur `Windows + R`
2. Taper : `taskschd.msc`
3. Chercher : **AlFlight-Daily-Commit-22h**

---

## 🧪 Tester manuellement

### Exécuter maintenant (sans attendre 22h) :

```powershell
Start-ScheduledTask -TaskName "AlFlight-Daily-Commit-22h"
```

### Voir les logs d'exécution :

Les résultats s'afficheront dans une fenêtre PowerShell qui s'ouvrira automatiquement.

---

## 🔄 Ce qui se passe chaque jour à 22h

1. **Vérification** : Y a-t-il des changements dans le dépôt ?
2. **Si OUI** :
   - `git add -A` (ajouter tous les fichiers)
   - `git commit -m "Sauvegarde automatique quotidienne - YYYY-MM-DD à HH:MM"`
   - `git push` (envoyer vers GitHub)
   - Enregistrer dans Google Sheets
3. **Si NON** :
   - Vérifier si un commit a déjà été fait aujourd'hui
   - Afficher le statut

---

## 📊 Logging Google Sheets

Chaque commit automatique est enregistré dans Google Sheets avec :
- Date/Heure
- Nombre de fichiers modifiés
- Lien vers le spreadsheet

**Lien direct** : https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k

---

## 🛠️ Commandes utiles

### Désactiver temporairement

```powershell
Disable-ScheduledTask -TaskName "AlFlight-Daily-Commit-22h"
```

### Réactiver

```powershell
Enable-ScheduledTask -TaskName "AlFlight-Daily-Commit-22h"
```

### Supprimer complètement

```powershell
Unregister-ScheduledTask -TaskName "AlFlight-Daily-Commit-22h" -Confirm:$false
```

### Modifier l'heure d'exécution

1. Ouvrir `taskschd.msc`
2. Trouver la tâche **AlFlight-Daily-Commit-22h**
3. Double-cliquer > Onglet **Déclencheurs**
4. Modifier l'heure
5. OK

---

## 📝 Fichiers créés

| Fichier | Description |
|---------|-------------|
| `scripts/daily-auto-commit.ps1` | Script exécuté chaque jour à 22h |
| `scripts/setup-daily-commit-task.ps1` | Script d'installation (1 fois) |
| `INSTALLATION_COMMIT_AUTO.md` | Ce guide |

---

## ❓ Dépannage

### La tâche ne s'exécute pas

1. Vérifier que l'ordinateur est allumé à 22h
2. Vérifier l'état de la tâche :
   ```powershell
   Get-ScheduledTask -TaskName "AlFlight-Daily-Commit-22h" | Select State
   ```
3. Si "Disabled", réactiver :
   ```powershell
   Enable-ScheduledTask -TaskName "AlFlight-Daily-Commit-22h"
   ```

### Le commit échoue

- Vérifier la connexion internet
- Vérifier les credentials GitHub (doit être configuré avec SSH ou token)
- Tester manuellement :
  ```powershell
  cd D:\Applicator\alflight
  git status
  git push
  ```

### Google Sheets ne reçoit pas le log

- Vérifier que le serveur Google Sheets est démarré :
  ```powershell
  curl http://localhost:3001/health
  ```
- Si non démarré, lancer :
  ```powershell
  npm run dev
  ```

---

## ✅ Checklist d'installation

- [ ] Script d'installation exécuté
- [ ] Tâche planifiée visible dans Task Scheduler
- [ ] Test manuel réussi
- [ ] Vérification de l'heure (22:00)
- [ ] Google Sheets connecté (optionnel mais recommandé)

---

**Installation terminée !** 🎉

Le système créera automatiquement un commit et un push chaque jour à 22h si des changements sont détectés.
