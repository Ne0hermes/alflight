# 🧪 Guide de test pour les licences et qualifications

## 📋 Procédure de test

### 1. Ouvrir l'application
- Aller sur http://localhost:4003
- Naviguer vers l'Espace Pilote
- Ouvrir la section "Licences et Qualifications"

### 2. Ouvrir la console du navigateur (F12)

### 3. Vérifier l'état initial
```javascript
// Dans la console, taper :
debugCert()
// Ceci affichera l'état actuel des certifications
```

### 4. Ajouter des données de test
```javascript
// Ajouter une licence de test
addTestLicense()

// Ajouter une qualification de test
addTestRating()

// Rafraîchir la page (F5) pour voir les changements
```

### 5. Tester l'export
1. Cliquer sur "Exporter le profil pilote"
2. Observer dans la console les logs qui commencent par "=== DÉBUT EXPORT ==="
3. Vérifier que les licences et qualifications sont bien présentes dans les logs
4. Ouvrir le fichier JSON exporté et vérifier la présence des données

### 6. Tester l'import
1. Cliquer sur "Vider données (TEST)" pour supprimer les données
2. Rafraîchir la page (F5)
3. Vérifier que les données sont bien supprimées : `debugCert()`
4. Cliquer sur "Importer" et sélectionner le fichier exporté
5. Observer dans la console les logs qui commencent par "=== DÉBUT IMPORT ==="
6. Rafraîchir la page (F5)
7. Vérifier que les données sont restaurées : `debugCert()`

## 🔍 Points à vérifier

- ✅ Les licences sont sauvegardées dans `pilotCertifications.licenses`
- ✅ Les qualifications sont dans `pilotCertifications.ratings`
- ✅ L'export contient bien les données dans le JSON
- ✅ L'import restaure correctement les données
- ✅ Les logs montrent le bon nombre d'éléments

## 🐛 En cas de problème

1. **Si les données ne s'affichent pas après ajout :**
   - Rafraîchir la page (F5)
   - Vérifier avec `debugCert()` que les données sont bien dans le localStorage

2. **Si l'export est vide :**
   - Vérifier dans la console que `pilotCertifications` contient bien des données
   - S'assurer d'avoir ajouté des licences/qualifications avant l'export

3. **Si l'import ne fonctionne pas :**
   - Vérifier que le fichier JSON est valide
   - Observer les erreurs dans la console
   - S'assurer que la structure du JSON correspond au format attendu

## 📝 Structure attendue du JSON

```json
{
  "version": "1.0",
  "type": "pilot",
  "data": {
    "licenses": [...],
    "qualifications": [...],
    "endorsements": [...],
    "training": [...],
    "pilotCertifications": {
      "licenses": [...],
      "ratings": [...],
      "endorsements": [...],
      "training": [...]
    }
  }
}
```