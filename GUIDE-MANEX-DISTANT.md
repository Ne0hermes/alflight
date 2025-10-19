# Guide: Configuration des MANEX distants pour avions pré-enregistrés

## 🎯 Objectif

Permettre aux utilisateurs de télécharger des avions pré-configurés avec leurs MANEX complets, sans inclure les PDFs volumineux dans les fichiers JSON.

## 📋 Principe

1. **Export**: Le JSON contient uniquement les métadonnées + URL distante du PDF
2. **Import**: Le PDF est téléchargé automatiquement depuis l'URL lors du premier accès
3. **Stockage**: Le PDF est sauvegardé localement dans IndexedDB pour accès hors-ligne

## 🔧 Configuration rapide (GitHub - GRATUIT)

### Étape 1: Créer un repository pour les MANEX

```bash
# Sur GitHub, créer un nouveau repository public
# Nom suggéré: alflight-manex
```

### Étape 2: Uploader vos PDFs

```bash
# Structure recommandée:
alflight-manex/
  ├── da40ng/
  │   └── MANEX_DA40NG_V2.0.pdf
  ├── c172/
  │   └── MANEX_C172_V3.1.pdf
  └── README.md
```

### Étape 3: Obtenir les URLs

- Aller sur GitHub dans le fichier PDF
- Cliquer sur "Raw"
- Copier l'URL (format: `https://raw.githubusercontent.com/username/alflight-manex/main/da40ng/MANEX_DA40NG_V2.0.pdf`)

### Étape 4: Modifier vos JSON d'export

Pour chaque avion pré-enregistré, ajoutez `remoteUrl` dans le champ `manex`:

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
      "remoteUrl": "https://raw.githubusercontent.com/votre-username/alflight-manex/main/da40ng/MANEX_DA40NG_V2.0.pdf"
    },
    "hasManex": true
  }
}
```

## 🚀 Utilisation

### Pour l'administrateur (vous):

1. Exporter un avion configuré via l'interface
2. Uploader le PDF du MANEX sur GitHub
3. Modifier le JSON pour ajouter `remoteUrl`
4. Partager le JSON avec vos utilisateurs

### Pour l'utilisateur:

1. Importer le JSON de l'avion
2. Ouvrir le MANEX via le bouton 📚
3. Un message apparaît: "⚠️ Fichier PDF non chargé - Cliquez sur 'Télécharger le PDF' pour le récupérer"
4. Cliquer sur "Récupérer le PDF"
5. Le PDF est téléchargé automatiquement depuis GitHub
6. Accès hors-ligne ensuite (stocké dans IndexedDB)

## 📊 Avantages

✅ **JSON légers**: ~770 KB au lieu de 12+ MB
✅ **Téléchargement à la demande**: Seulement si l'utilisateur consulte le MANEX
✅ **Accès hors-ligne**: Une fois téléchargé, disponible sans connexion
✅ **Gratuit**: GitHub offre l'hébergement gratuit pour les repos publics
✅ **Versionning**: Facile de mettre à jour les MANEX (changer l'URL)

## 🔒 Alternative: Serveur privé

Si vous préférez héberger sur votre serveur:

### Configuration Apache (.htaccess):

```apache
<FilesMatch "\.(pdf)$">
  Header set Access-Control-Allow-Origin "*"
  Header set Access-Control-Allow-Methods "GET"
</FilesMatch>
```

### Configuration Nginx:

```nginx
location /manex/ {
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods GET;
}
```

### URL de vos fichiers:

```
https://votre-domaine.com/manex/da40ng-v2.0.pdf
```

## 🧪 Test

Pour tester avec votre F-HSTR:

1. Uploadez "MANEX DA40NG V2.0 - VERSION FINALE.pdf" sur GitHub
2. Modifiez le fichier `public/aircraft-presets/da40ng-f-hstr-example.json`
3. Remplacez l'URL par votre vraie URL GitHub
4. Importez ce JSON dans l'application
5. Testez le téléchargement du MANEX

## 📝 Script automatique pour ajouter remoteUrl

Créez un fichier `add-remote-url.js`:

```javascript
const fs = require('fs');

// Configuration
const jsonFile = process.argv[2];
const remoteUrl = process.argv[3];

if (!jsonFile || !remoteUrl) {
  console.error('Usage: node add-remote-url.js <fichier.json> <url-du-pdf>');
  process.exit(1);
}

// Lire et modifier
const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
if (data.aircraftData && data.aircraftData.manex) {
  data.aircraftData.manex.remoteUrl = remoteUrl;
  fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2));
  console.log('✅ remoteUrl ajoutée:', remoteUrl);
} else {
  console.error('❌ Structure JSON invalide');
}
```

Utilisation:
```bash
node add-remote-url.js avion.json "https://raw.githubusercontent.com/.../manex.pdf"
```

## 🎓 Exemple complet

Voir `public/aircraft-presets/da40ng-f-hstr-example.json` pour un exemple fonctionnel.
