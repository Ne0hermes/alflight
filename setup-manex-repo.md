# Script de configuration du repository MANEX

## Prérequis
- Avoir un compte GitHub
- Avoir Git installé sur votre machine

## Instructions

### 1. Créer le repository sur GitHub.com
1. Aller sur https://github.com/new
2. Nom: `alflight-manex`
3. Public ✓
4. Ajouter README ✓
5. Créer

### 2. Cloner localement

```bash
# Ouvrir PowerShell ou Git Bash
cd D:\Applicator

# Cloner le repository (remplacez VOTRE-USERNAME)
git clone https://github.com/VOTRE-USERNAME/alflight-manex.git

cd alflight-manex
```

### 3. Organiser les fichiers

```bash
# Créer la structure
mkdir da40ng
mkdir c172
# ... autres modèles d'avions

# Copier vos PDFs
copy "D:\log app\MANEX DA40NG V2.0 - VERSION FINALE.pdf" "da40ng\MANEX_DA40NG_V2.0.pdf"
```

### 4. Pousser sur GitHub

```bash
# Ajouter les fichiers
git add .

# Commit
git commit -m "Add DA40NG MANEX v2.0"

# Pousser
git push origin main
```

### 5. Obtenir l'URL

Votre fichier sera accessible à:
```
https://raw.githubusercontent.com/VOTRE-USERNAME/alflight-manex/main/da40ng/MANEX_DA40NG_V2.0.pdf
```

## Structure recommandée

```
alflight-manex/
├── README.md
├── da40ng/
│   ├── MANEX_DA40NG_V2.0.pdf
│   └── MANEX_DA40NG_V1.5.pdf
├── c172/
│   └── MANEX_C172_V3.1.pdf
├── pa28/
│   └── MANEX_PA28_V2.0.pdf
└── dr400/
    └── MANEX_DR400_V1.8.pdf
```

## Mise à jour d'un MANEX

```bash
# Aller dans le repo
cd D:\Applicator\alflight-manex

# Remplacer le fichier
copy "nouveau_fichier.pdf" "da40ng\MANEX_DA40NG_V2.1.pdf"

# Commit et push
git add .
git commit -m "Update DA40NG MANEX to v2.1"
git push origin main
```

## Tester l'URL

Vous pouvez tester si l'URL fonctionne en l'ouvrant dans votre navigateur.
Si le PDF se télécharge ou s'affiche, c'est bon !
