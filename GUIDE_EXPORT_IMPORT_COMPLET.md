# 📚 Guide Export/Import Complet - Profil Pilote

## ✅ Nouveau système d'export/import COMPLET

Le système a été **entièrement refait** pour exporter **TOUTES les données** du profil pilote :
- ✅ **Informations personnelles** (nom, prénom, adresse, téléphone, etc.)
- ✅ **Licences et qualifications** (PPL, CPL, IR, Night, etc.)
- ✅ **Suivi médical** (Classe 1, Classe 2, dates d'expiration)
- ✅ **Configuration des unités** (nm/km, ft/m, etc.)
- ✅ **Photo du pilote**

## 🚀 Test rapide du système

### 1. Ouvrir l'application et la console
```
http://localhost:4003
F12 pour ouvrir la console du navigateur
```

### 2. Lancer le test complet automatisé
```javascript
testExportImport.runCompleteSystemTest()
```

Cette commande va :
- Ajouter automatiquement des données de test complètes
- Vérifier que tout est bien enregistré
- Afficher un résumé détaillé
- Donner les instructions pour tester l'export/import

## 📝 Commandes disponibles

### Test complet automatisé
```javascript
testExportImport.runCompleteSystemTest()
```
Lance un test complet avec ajout de données et vérification.

### Ajouter des données de test
```javascript
testExportImport.addCompleteTestData()
```
Ajoute un profil complet avec :
- Informations personnelles complètes
- 3 licences (PPL, CPL, ATPL)
- 3 qualifications (IR, Night, MEP)
- 2 variantes (Tailwheel, Complex)
- 2 formations (CRM, UPRT)
- 2 dossiers médicaux
- Configuration des unités

### Vérifier l'état du profil
```javascript
testExportImport.verifyCompleteProfile()
```
Affiche un diagnostic détaillé de toutes les données présentes.

### Vider toutes les données
```javascript
testExportImport.clearAllProfileData()
```
Supprime toutes les données du profil pour tester depuis zéro.

## 🔄 Procédure de test manuelle

### 1. Préparer les données
```javascript
// Ajouter des données de test
testExportImport.addCompleteTestData()

// Vérifier qu'elles sont bien présentes
testExportImport.verifyCompleteProfile()
```

### 2. Tester l'export
1. Aller dans **Espace Pilote**
2. Cliquer sur **"Exporter le profil pilote"**
3. Observer dans la console :
   ```
   === DÉBUT EXPORT COMPLET ===
   📊 Résumé de l'export:
     ✅ Informations personnelles: Oui
     ✅ Licences: 3
     ✅ Qualifications: 3
     ✅ Variantes: 2
     ✅ Formations: 2
     ✅ Dossiers médicaux: 2
     ✅ Configuration unités: Oui
   === FIN EXPORT ===
   ```
4. Un fichier `profil-pilote-complet-YYYY-MM-DD.json` sera téléchargé

### 3. Tester l'import
1. Vider les données :
   ```javascript
   testExportImport.clearAllProfileData()
   ```
2. Rafraîchir la page (F5)
3. Vérifier que tout est vide :
   ```javascript
   testExportImport.verifyCompleteProfile()
   ```
4. Cliquer sur **"Importer"** dans l'Espace Pilote
5. Sélectionner le fichier précédemment exporté
6. Observer dans la console :
   ```
   === DÉBUT IMPORT COMPLET ===
   ✅ Informations personnelles importées
   ✅ Profil pilote importé
   ✅ Certifications importées:
     - Licences: 3
     - Qualifications: 3
     - Variantes: 2
     - Formations: 2
   ✅ Suivi médical importé: 2 dossiers
   ✅ Configuration des unités importée
   === FIN IMPORT ===
   ```
7. Rafraîchir la page (F5)
8. Vérifier la restauration :
   ```javascript
   testExportImport.verifyCompleteProfile()
   ```

## 📄 Structure du fichier exporté

Le fichier JSON exporté contient :
```json
{
  "version": "2.0",
  "exportDate": "2024-12-29T10:00:00Z",
  "type": "pilot_complete",
  "data": {
    "personalInfo": {
      "firstName": "Jean",
      "lastName": "Dupont",
      "email": "jean.dupont@example.com",
      // ... toutes les infos personnelles
    },
    "pilotProfile": {
      "photo": null,
      "totalHours": 1250,
      // ... statistiques du pilote
    },
    "certifications": {
      "licenses": [...],
      "qualifications": [...],
      "endorsements": [...],
      "training": [...]
    },
    "medicalRecords": [...],
    "unitsConfig": {
      "distance": "nm",
      "altitude": "ft",
      // ... configuration complète
    }
  },
  "stats": {
    "licensesCount": 3,
    "qualificationsCount": 3,
    // ... statistiques de vérification
  }
}
```

## ✅ Points de vérification

Après import, vérifier que :
- [ ] Les informations personnelles sont complètes
- [ ] Les licences apparaissent dans la section Certifications
- [ ] Les qualifications sont présentes avec leurs dates
- [ ] Le suivi médical affiche les dossiers
- [ ] La configuration des unités est restaurée
- [ ] La photo du pilote est présente (si applicable)

## 🐛 Résolution des problèmes

### Problème : L'export ne contient pas toutes les données
```javascript
// Vérifier ce qui est stocké
testExportImport.verifyCompleteProfile()

// Si des données manquent, les ajouter
testExportImport.addCompleteTestData()
```

### Problème : L'import échoue
1. Vérifier que le fichier est un JSON valide
2. S'assurer que le type est `"pilot_complete"` ou `"pilot"`
3. Vérifier la console pour les erreurs détaillées

### Problème : Les données ne s'affichent pas après import
1. **Toujours rafraîchir la page** après un import (F5)
2. Vérifier avec `testExportImport.verifyCompleteProfile()`
3. Naviguer dans les différentes sections pour voir les données

## 🎯 Résumé

Le nouveau système exporte et importe **TOUT** :
- ✅ Informations personnelles complètes
- ✅ Toutes les licences et qualifications
- ✅ Suivi médical complet
- ✅ Configuration des unités
- ✅ Photo et statistiques du pilote

Utilisez `testExportImport.runCompleteSystemTest()` pour un test complet automatisé !