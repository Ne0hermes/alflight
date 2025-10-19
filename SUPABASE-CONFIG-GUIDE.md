# 🚀 Guide de Configuration Supabase pour ALFlight Community

## 📋 Étapes à suivre

### 1️⃣ Créer un compte Supabase (GRATUIT)

1. Allez sur **https://supabase.com**
2. Cliquez sur **"Start your project"**
3. Connectez-vous avec **GitHub** (recommandé) ou email
4. Cliquez sur **"New project"**

### 2️⃣ Configurer le projet

Remplissez les informations :

```
Organization: Créez "ALFlight" (ou votre nom)
Project name: alflight-community
Database Password: [Générez un mot de passe fort]
Region: Europe West (Frankfurt) - le plus proche de la France
Pricing Plan: Free (gratuit - 500 MB suffisant pour démarrer)
```

Cliquez sur **"Create new project"**

⏳ **Attendez 2-3 minutes** que le projet soit créé...

---

### 3️⃣ Créer la base de données

Une fois le projet créé :

1. Dans le menu latéral, cliquez sur **"SQL Editor"**
2. Cliquez sur **"New query"**
3. **Copiez tout le contenu** du fichier `supabase-setup.sql`
4. **Collez-le** dans l'éditeur SQL
5. Cliquez sur **"Run"** (en bas à droite)

✅ Vous devriez voir : "Configuration Supabase terminée !"

---

### 4️⃣ Créer le bucket de stockage pour les MANEX

1. Dans le menu latéral, cliquez sur **"Storage"**
2. Cliquez sur **"Create a new bucket"**
3. Remplissez :
   ```
   Name: manex-files
   Public bucket: ✅ OUI (cochez la case)
   File size limit: 50 MB
   Allowed MIME types: application/pdf
   ```
4. Cliquez sur **"Create bucket"**

5. **Configurer les politiques du bucket** :
   - Cliquez sur le bucket **"manex-files"**
   - Allez dans l'onglet **"Policies"**
   - Cliquez sur **"New policy"**
   - Sélectionnez **"For full customization"**
   - Policy name: `Public read access`
   - Target roles: `public`
   - Policy command: `SELECT`
   - WITH CHECK expression: `true`
   - Cliquez sur **"Review"** puis **"Save policy"**

---

### 5️⃣ Récupérer les clés API

1. Dans le menu latéral, cliquez sur **"Project Settings"** (icône ⚙️)
2. Cliquez sur **"API"** dans le menu de gauche
3. Vous verrez deux clés :
   - **Project URL** (commence par https://)
   - **anon public** (longue chaîne de caractères)

---

### 6️⃣ Configurer les variables d'environnement dans ALFlight

Créez ou modifiez le fichier `.env` à la racine du projet alflight :

```bash
# Fichier: D:\Applicator\alflight\.env

VITE_SUPABASE_URL=https://VOTRE-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **IMPORTANT** : Remplacez par VOS vraies clés copiées depuis Supabase !

---

### 7️⃣ Redémarrer l'application

```bash
# Arrêter les serveurs en cours (Ctrl+C dans les terminaux)
# Puis relancer :
cd alflight
npm run dev
```

---

## ✅ Vérification

Pour tester que tout fonctionne :

1. Lancez l'application ALFlight
2. Allez dans "Créer un nouvel avion"
3. À l'étape 0, vous devriez voir la recherche communautaire
4. Les avions devraient se charger depuis Supabase

---

## 📊 Structure créée

Votre base de données contient maintenant :

### Tables
- `community_presets` : Les configurations d'avions
- `manex_files` : Métadonnées des fichiers MANEX
- `preset_votes` : Votes des utilisateurs
- `preset_downloads` : Historique des téléchargements

### Storage
- Bucket `manex-files` : Stockage des PDFs MANEX (public)

### Fonctionnalités automatiques
- ✅ Compteur de votes automatique
- ✅ Compteur de téléchargements
- ✅ Validation communautaire (10 votes = vérifié)
- ✅ Recherche full-text
- ✅ Sécurité (RLS activé)

---

## 🧪 Tester avec des données

Un preset de test (F-HSTR DA40 NG) a été créé automatiquement.

Pour ajouter d'autres avions de test :

1. Dans Supabase, allez dans **"Table Editor"**
2. Sélectionnez la table **"community_presets"**
3. Cliquez sur **"Insert row"**
4. Remplissez les champs et cliquez sur **"Save"**

---

## 🔐 Sécurité

Les politiques RLS (Row Level Security) sont activées :

- ✅ Tout le monde peut **lire** les presets actifs
- ✅ Utilisateurs authentifiés peuvent **soumettre**
- ✅ Utilisateurs peuvent **modifier leurs propres** presets
- ✅ Utilisateurs authentifiés peuvent **voter**
- ✅ MANEX publiquement accessibles via URL

---

## 💰 Limites du plan gratuit

**Plan Free (gratuit)** :
- ✅ 500 MB de stockage database
- ✅ 1 GB de stockage fichiers
- ✅ 50 GB de bande passante/mois
- ✅ 2 GB de RAM
- ✅ Suffisant pour ~40 avions avec MANEX

**Quand upgrader ?**
- Si > 500 MB de database : ~5€/mois (Pro)
- Si > 1 GB de fichiers : ~5€/mois
- Si > 50 GB/mois de bande passante : ~10€/mois

---

## 📞 Besoin d'aide ?

### Dashboard Supabase
https://app.supabase.com/project/VOTRE-PROJECT-ID

### Documentation
https://supabase.com/docs

### Support
https://supabase.com/support

---

## 🎉 C'est prêt !

Votre système communautaire est maintenant configuré !

Les utilisateurs peuvent :
- ✅ Parcourir les avions de la communauté
- ✅ Télécharger les configurations + MANEX
- ✅ Voter pour les configurations
- ✅ Soumettre leurs propres avions

Prochaine étape : Mettre à jour `Step0CommunityCheck.jsx` pour utiliser Supabase au lieu du mock !
