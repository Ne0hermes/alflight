# 📚 RÉCAPITULATIF: Système de MANEX distants

## 🎯 Objectif atteint

Les utilisateurs peuvent maintenant importer des avions pré-configurés et récupérer automatiquement les MANEX depuis un serveur distant (GitHub gratuit).

---

## ✅ Modifications apportées au code

### Fichier modifié: `ManexImporter.jsx`

**Ajout de la fonction `downloadRemoteManex`** (lignes 61-106):
- Télécharge automatiquement un PDF depuis une URL distante
- Convertit en base64 et sauvegarde dans IndexedDB
- Affiche des notifications de progression

**Détection automatique au chargement** (lignes 43-47):
- Vérifie si `remoteUrl` existe
- Lance le téléchargement automatiquement si le PDF n'est pas en local

**Bouton intelligent "Récupérer le PDF"** (lignes 405-438):
- Active si `remoteUrl` existe, même sans PDF local
- Télécharge le PDF en un clic
- Désactive si aucune source disponible

**Messages adaptés** (lignes 391-400):
- Message différent selon la présence ou non de `remoteUrl`
- Guide l'utilisateur vers la bonne action

---

## 📁 Fichiers de documentation créés

### 1. **GUIDE-RAPIDE-GITHUB.md** ⭐ COMMENCEZ ICI
Guide visuel étape par étape pour créer votre repository GitHub sans ligne de commande.

**Résumé rapide:**
1. Créer compte GitHub → https://github.com
2. Créer repository "alflight-manex" (Public)
3. Upload PDF via glisser-déposer
4. Cliquer sur PDF → Raw → Copier URL
5. Ajouter URL dans le JSON

---

### 2. **setup-github-manex.ps1**
Script PowerShell automatique qui:
- Vérifie Git
- Clone le repository
- Crée la structure de dossiers
- Copie vos PDFs existants
- Push tout sur GitHub

**Utilisation:**
```powershell
cd D:\Applicator\alflight
.\setup-github-manex.ps1
```

---

### 3. **setup-manex-repo.md**
Instructions détaillées pour la méthode ligne de commande avec Git.

---

### 4. **GUIDE-MANEX-DISTANT.md**
Documentation technique complète:
- Principe du système
- Format JSON
- Options d'hébergement
- Avantages/inconvénients
- Script automatique pour ajouter remoteUrl

---

### 5. **public/aircraft-presets/README.md**
Guide technique de la structure des fichiers d'avions pré-enregistrés.

---

### 6. **public/aircraft-presets/da40ng-f-hstr-example.json**
Exemple fonctionnel avec remoteUrl configurée.

---

## 🚀 Comment démarrer (3 méthodes)

### Méthode 1: Via le site web (Recommandée - 5 minutes)

Suivez **GUIDE-RAPIDE-GITHUB.md**

**Avantages:**
- ✅ Aucune installation requise
- ✅ Interface visuelle
- ✅ Impossible de se tromper

---

### Méthode 2: Script automatique (Si Git installé)

```powershell
cd D:\Applicator\alflight
.\setup-github-manex.ps1
```

**Avantages:**
- ✅ Configuration automatique
- ✅ Copie automatique des PDFs existants
- ✅ Structure créée automatiquement

---

### Méthode 3: Ligne de commande manuelle

Suivez **setup-manex-repo.md**

**Avantages:**
- ✅ Contrôle total
- ✅ Compréhension du processus

---

## 📊 Format JSON avec remoteUrl

```json
{
  "aircraftData": {
    "id": "aircraft_f-hstr_preset",
    "registration": "F-HSTR",
    "model": "DA40 NG",
    "manex": {
      "fileName": "MANEX DA40NG V2.0 - VERSION FINALE.pdf",
      "fileSize": "11.82 MB",
      "uploadDate": "2025-10-05T10:00:00.000Z",
      "remoteUrl": "https://raw.githubusercontent.com/VOTRE-USERNAME/alflight-manex/main/da40ng/MANEX_DA40NG_V2.0.pdf"
    },
    "hasManex": true
  }
}
```

**Note:** Remplacez `VOTRE-USERNAME` par votre nom d'utilisateur GitHub.

---

## 🔄 Workflow complet

### Pour vous (administrateur):

1. **Configurer GitHub** (une seule fois)
   - Créer repository "alflight-manex"
   - Uploader les PDFs

2. **Pour chaque avion pré-enregistré:**
   - Exporter la configuration JSON depuis ALFlight
   - Ouvrir le JSON dans un éditeur
   - Ajouter `"remoteUrl": "https://raw.githubusercontent.com/..."`
   - Sauvegarder
   - Distribuer le JSON

---

### Pour l'utilisateur final:

1. **Import initial**
   - Recevoir le fichier JSON
   - Import dans ALFlight
   - Message: "MANEX configuré mais PDF manquant"

2. **Premier accès au MANEX**
   - Cliquer sur le bouton 📚 MANEX
   - Message: "⚠️ Fichier PDF non chargé"
   - Cliquer sur "Récupérer le PDF"
   - Téléchargement automatique depuis GitHub
   - Sauvegarde dans IndexedDB

3. **Accès suivants**
   - PDF disponible immédiatement
   - Fonctionne hors-ligne
   - Pas de re-téléchargement

---

## 📈 Avantages du système

### Pour vous:
- ✅ **JSON légers**: 770 KB au lieu de 12+ MB
- ✅ **Distribution facile**: Envoi par email, Slack, etc.
- ✅ **Mise à jour centralisée**: Changer le PDF sur GitHub suffit
- ✅ **Gratuit**: GitHub offre 100 GB pour repos publics
- ✅ **Versioning**: Historique complet des modifications

### Pour les utilisateurs:
- ✅ **Téléchargement rapide**: JSON léger d'abord
- ✅ **À la demande**: PDF téléchargé seulement si consulté
- ✅ **Hors-ligne**: Disponible sans connexion après premier accès
- ✅ **Automatique**: Un seul clic pour récupérer le PDF
- ✅ **Toujours à jour**: Peut re-télécharger si nouvelle version

---

## 🧪 Test du système

### Test rapide (sans GitHub):

Vous pouvez tester avec une URL de test:

```json
"remoteUrl": "https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf"
```

Importez un avion avec cette URL pour tester le téléchargement.

### Test complet:

1. Créer repository GitHub
2. Uploader un petit PDF de test
3. Récupérer l'URL
4. Modifier votre JSON F-HSTR avec cette URL
5. Importer dans ALFlight
6. Tester le téléchargement

---

## ❓ FAQ

**Q: Les PDFs sont-ils publics sur GitHub?**
R: Oui, mais seulement pour ceux qui ont l'URL. Ils n'apparaissent pas dans les recherches Google.

**Q: Puis-je utiliser un repository privé?**
R: Non, les URLs Raw ne fonctionnent que pour les repos publics sur GitHub gratuit.

**Q: Quelle est la limite de taille?**
R: GitHub accepte jusqu'à 100 MB par fichier. Votre MANEX de 12 MB passe largement.

**Q: Que se passe-t-il si je supprime le PDF de GitHub?**
R: Les utilisateurs qui l'ont déjà téléchargé l'ont en local. Les nouveaux ne pourront plus le récupérer.

**Q: Puis-je changer l'URL plus tard?**
R: Oui, mais il faut redistribuer le JSON avec la nouvelle URL.

**Q: Et si je n'ai pas de compte GitHub?**
R: Créez-en un gratuitement sur https://github.com (2 minutes).

---

## 📞 Support

Si vous rencontrez un problème:

1. Vérifiez que l'URL fonctionne en l'ouvrant dans un navigateur
2. Vérifiez que le repository est bien Public
3. Vérifiez l'orthographe de l'URL dans le JSON
4. Consultez les logs dans la console navigateur (F12)

---

## 🎉 Prêt à commencer!

**Prochaine action:** Ouvrez **GUIDE-RAPIDE-GITHUB.md** et suivez les étapes!

Temps estimé: **5-10 minutes** pour la configuration initiale.
