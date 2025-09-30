# 🧪 Guide de Test Complet - Licences & Qualifications

## 📋 Commandes disponibles dans la console

Une fois sur http://localhost:4003, ouvrez la console (F12) et utilisez :

### Commandes principales
```javascript
// Test complet automatisé
runFullTest()      // Lance un test complet avec ajout de données

// Diagnostic
debugCert()        // Affiche l'état détaillé des certifications
validateCert()     // Vérifie la structure des données

// Gestion des données
resetCert()        // Réinitialise toutes les certifications
addTestLicense()   // Ajoute une licence de test
addTestRating()    // Ajoute une qualification de test
```

## 🚀 Test rapide (recommandé)

1. **Ouvrir l'application et la console**
   ```
   http://localhost:4003
   F12 pour ouvrir la console
   ```

2. **Lancer le test automatisé**
   ```javascript
   runFullTest()
   ```
   Ceci va :
   - Vérifier l'état initial
   - Ajouter automatiquement des données de test si vide
   - Afficher un résumé complet

3. **Tester l'export**
   - Cliquer sur "Exporter le profil pilote"
   - Observer les logs dans la console :
     ```
     === DÉBUT EXPORT ===
     Export - pilotCertifications (raw): ...
     Export - Contenu détaillé:
       - licenses: 2 éléments
       - qualifications/ratings: 2 éléments
       - endorsements: 1 éléments
       - training: 1 éléments
     === FIN EXPORT ===
     ```

4. **Tester l'import**
   - Cliquer sur "Vider données (TEST)"
   - Rafraîchir (F5)
   - Vérifier que c'est vide : `debugCert()`
   - Cliquer sur "Importer" et sélectionner le fichier
   - Observer les logs :
     ```
     === DÉBUT IMPORT ===
     Import - Données reçues: ...
     Import - pilotCertifications après intégration: ...
     === FIN IMPORT ===
     ```
   - Rafraîchir (F5)
   - Vérifier la restauration : `debugCert()`

## 🔍 Diagnostic détaillé

### Vérifier l'état actuel
```javascript
debugCert()
```
Affiche :
- Contenu brut du localStorage
- Nombre d'éléments par catégorie
- Détail de chaque licence/qualification

### Valider la structure
```javascript
validateCert()
```
Vérifie que toutes les catégories sont présentes et au bon format.

## 🐛 Résolution des problèmes

### Problème : Les données ne s'exportent pas

1. **Vérifier la présence des données**
   ```javascript
   debugCert()
   ```

2. **Si vide, ajouter des données**
   ```javascript
   runFullTest()
   ```

3. **Re-tester l'export**

### Problème : L'import ne fonctionne pas

1. **Vérifier le format du fichier JSON**
   Le fichier doit avoir cette structure :
   ```json
   {
     "version": "1.0",
     "type": "pilot",
     "data": {
       "licenses": [...],
       "qualifications": [...],
       "pilotCertifications": {
         "licenses": [...],
         "ratings": [...],
         "endorsements": [...],
         "training": [...]
       }
     }
   }
   ```

2. **Réinitialiser et re-tester**
   ```javascript
   resetCert()
   // Rafraîchir (F5)
   // Importer le fichier
   ```

### Problème : Les données ne s'affichent pas dans l'interface

1. **Rafraîchir la page** (F5)
2. **Naviguer vers** Espace Pilote > Licences et Qualifications
3. **Vérifier dans la console** : `debugCert()`

## 📊 Structure des données

Les certifications sont stockées dans `localStorage.pilotCertifications` :

```javascript
{
  "licenses": [       // Licences (PPL, CPL, etc.)
    {
      "id": 1234567890,
      "type": "PPL(A) - Private Pilot License (Avion)",
      "issueDate": "2024-01-15",
      "document": null,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "ratings": [        // Qualifications (IR, Night, etc.)
    {
      "id": 1234567891,
      "type": "IR - Instrument Rating",
      "issueDate": "2024-03-01",
      "expiryDate": "2025-03-01",
      ...
    }
  ],
  "endorsements": [], // Variantes
  "training": []      // Formations
}
```

## ✅ Checklist de validation

- [ ] `runFullTest()` ajoute bien 6 éléments (2 licences, 2 qualifications, 1 variante, 1 formation)
- [ ] L'export génère un fichier JSON avec toutes les données
- [ ] Les logs d'export montrent le bon nombre d'éléments
- [ ] Après vidage et import, les données sont restaurées
- [ ] Les logs d'import confirment la restauration
- [ ] L'interface affiche les données après rafraîchissement