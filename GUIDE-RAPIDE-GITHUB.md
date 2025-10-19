# 🚀 Guide Rapide: Héberger vos MANEX sur GitHub

## ✅ Méthode la plus simple (sans ligne de commande)

### 📝 Étape 1: Créer un compte GitHub (si vous n'en avez pas)

1. Allez sur **https://github.com**
2. Cliquez sur **"Sign up"**
3. Suivez les instructions

---

### 📦 Étape 2: Créer le repository

1. Une fois connecté, cliquez sur le **"+"** en haut à droite
2. Sélectionnez **"New repository"**
3. Remplissez:
   ```
   Repository name: alflight-manex
   Description: MANEX files for ALFlight
   ✅ Public (important!)
   ✅ Add a README file
   ```
4. Cliquez sur **"Create repository"**

---

### 📤 Étape 3: Uploader votre PDF

**Option A: Avec dossier (recommandé)**

1. Sur la page de votre repository, cliquez sur **"Add file"** → **"Create new file"**
2. Dans "Name your file...", tapez: `da40ng/README.md`
   - Ceci crée un dossier "da40ng" avec un fichier dedans
3. Dans le contenu, tapez: `MANEX for DA40 NG`
4. Cliquez sur **"Commit new file"** (en bas)
5. Cliquez maintenant sur le dossier **"da40ng"**
6. Cliquez sur **"Add file"** → **"Upload files"**
7. **Glissez-déposez** votre PDF: "MANEX DA40NG V2.0 - VERSION FINALE.pdf"
8. Cliquez sur **"Commit changes"**

**Option B: Sans dossier (plus simple mais moins organisé)**

1. Sur la page de votre repository, cliquez sur **"Add file"** → **"Upload files"**
2. **Glissez-déposez** votre PDF
3. Cliquez sur **"Commit changes"**

---

### 🔗 Étape 4: Obtenir l'URL du PDF

1. Sur la page de votre repository, cliquez sur votre fichier PDF
2. Vous verrez un aperçu (ou "View raw")
3. Cliquez sur le bouton **"Raw"** (en haut à droite)
4. **Copiez l'URL** dans la barre d'adresse de votre navigateur

L'URL ressemblera à:
```
https://raw.githubusercontent.com/VOTRE-NOM/alflight-manex/main/da40ng/MANEX_DA40NG_V2.0.pdf
```

---

### ✏️ Étape 5: Utiliser l'URL dans votre JSON

Ouvrez votre fichier JSON d'avion et ajoutez `"remoteUrl"`:

```json
{
  "aircraftData": {
    "manex": {
      "fileName": "MANEX DA40NG V2.0 - VERSION FINALE.pdf",
      "fileSize": "11.82 MB",
      "uploadDate": "2025-10-05T10:00:00.000Z",
      "remoteUrl": "https://raw.githubusercontent.com/VOTRE-NOM/alflight-manex/main/da40ng/MANEX_DA40NG_V2.0.pdf"
    }
  }
}
```

---

### ✅ Étape 6: Tester

1. Dans ALFlight, importez le JSON modifié
2. Ouvrez le MANEX de l'avion (bouton 📚)
3. Vous verrez: "⚠️ Fichier PDF non chargé"
4. Cliquez sur **"Récupérer le PDF"**
5. Le PDF se télécharge automatiquement!

---

## 🎯 C'est fini!

Vos utilisateurs peuvent maintenant:
- ✅ Importer des avions avec des JSON légers (~1 MB au lieu de 12+ MB)
- ✅ Télécharger les MANEX automatiquement
- ✅ Accéder aux MANEX hors-ligne après le premier téléchargement

---

## 🛠️ Pour ajouter d'autres avions

Répétez l'Étape 3 pour chaque nouveau MANEX:
- Créez un dossier pour chaque modèle: `c172/`, `pa28/`, etc.
- Uploadez les PDFs dans les dossiers appropriés
- Récupérez les URLs
- Mettez à jour vos JSON

---

## 🔄 Pour mettre à jour un MANEX

1. Allez dans le dossier concerné sur GitHub
2. Cliquez sur **"Add file"** → **"Upload files"**
3. Uploadez la nouvelle version avec un nouveau nom:
   - Ancien: `MANEX_DA40NG_V2.0.pdf`
   - Nouveau: `MANEX_DA40NG_V2.1.pdf`
4. Mettez à jour l'URL dans vos nouveaux JSON
5. **Ne supprimez pas l'ancienne version** (pour compatibilité)

---

## 💡 Astuces

- GitHub offre **100 GB gratuit** pour les repositories publics
- Les fichiers sont accessibles **instantanément** après upload
- Vous pouvez **organiser par modèle d'avion** dans des dossiers
- Les URLs sont **permanentes** (ne changent jamais)

---

## ❓ Besoin d'aide?

Si vous préférez utiliser la ligne de commande (plus rapide après le premier setup):
```powershell
.\setup-github-manex.ps1
```

Ce script automatise tout le processus!
