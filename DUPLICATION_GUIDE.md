# Guide de Duplication d'Avion

Ce guide explique comment dupliquer un avion existant dans Supabase pour créer un nouvel avion complètement différent.

## 🎯 Objectif

Utiliser un avion existant comme modèle (template) pour créer rapidement un nouvel avion avec toutes ses données (masse, centrage, performances, carburant, etc.) déjà configurées.

## 📋 Méthodes Disponibles

### Méthode 1: Interface Utilisateur (Recommandé)

1. **Accéder au composant de duplication**
   - Le composant `AircraftDuplicator` peut être intégré dans l'interface utilisateur
   - Emplacement: `src/features/aircraft/components/AircraftDuplicator.jsx`

2. **Utilisation**
   - Sélectionner un avion source dans la liste déroulante
   - Renseigner les nouvelles informations:
     - Immatriculation (obligatoire): ex: `F-ABCD`
     - Modèle (obligatoire): ex: `DR400-180`
     - Constructeur: ex: `Robin`
     - Catégorie: `SEP`, `MEP`, etc.
   - Cliquer sur "Dupliquer l'avion"

### Méthode 2: Console du Navigateur

Pour les utilisateurs avancés, vous pouvez utiliser la console du navigateur:

```javascript
// 1. Importer les fonctions nécessaires
import { duplicateAircraft, getAvailableAircraftForDuplication } from './utils/duplicateAircraft'

// 2. Lister les avions disponibles
const aircrafts = await getAvailableAircraftForDuplication()
console.table(aircrafts)

// 3. Dupliquer un avion (remplacer 'ID_SOURCE' par l'ID réel)
await duplicateAircraft('ID_SOURCE', {
  registration: 'F-XXXX',
  model: 'Nouveau Modèle',
  manufacturer: 'Nouveau Constructeur',
  category: 'SEP',
  overrides: {
    // Modifications supplémentaires (optionnel)
    weights: {
      emptyWeight: '650',
      maxWeight: '1100'
    }
  }
})
```

### Méthode 3: Script PowerShell (Windows)

Créer un script PowerShell pour automatiser la duplication:

```powershell
# dupliquer-avion.ps1

$sourceId = "UUID-DE-L-AVION-SOURCE"
$newRegistration = "F-XXXX"
$newModel = "DR400-180"
$newManufacturer = "Robin"

# Ouvrir la console du navigateur et exécuter:
Write-Host "Copier et coller dans la console du navigateur:"
Write-Host ""
Write-Host "await duplicateAircraft('$sourceId', {" -ForegroundColor Green
Write-Host "  registration: '$newRegistration'," -ForegroundColor Green
Write-Host "  model: '$newModel'," -ForegroundColor Green
Write-Host "  manufacturer: '$newManufacturer'" -ForegroundColor Green
Write-Host "})" -ForegroundColor Green
```

## 🔧 Fonctions Disponibles

### `getAvailableAircraftForDuplication()`

Récupère la liste des avions disponibles pour duplication.

**Retour:**
```javascript
[
  {
    id: 'uuid-123',
    registration: 'F-HSTR',
    model: 'DA40 NG',
    manufacturer: 'Diamond',
    category: 'SEP',
    hasManex: true
  },
  // ...
]
```

### `duplicateAircraft(sourceAircraftId, newDetails)`

Duplique un avion existant.

**Paramètres:**
- `sourceAircraftId` (string): ID de l'avion source
- `newDetails` (object):
  - `registration` (string, requis): Nouvelle immatriculation
  - `model` (string, optionnel): Nouveau modèle
  - `manufacturer` (string, optionnel): Nouveau constructeur
  - `category` (string, optionnel): Catégorie (SEP, MEP, etc.)
  - `aircraftType` (string, optionnel): Type (Avion, Hélicoptère, ULM)
  - `overrides` (object, optionnel): Modifications supplémentaires

**Retour:**
L'objet du nouvel avion créé dans Supabase.

## 📝 Exemples

### Exemple 1: Duplication Simple

Dupliquer F-HSTR pour créer F-ABCD avec le même modèle:

```javascript
await duplicateAircraft('id-de-fhstr', {
  registration: 'F-ABCD'
})
```

### Exemple 2: Duplication avec Modifications

Dupliquer F-HSTR pour créer un DR400-180:

```javascript
await duplicateAircraft('id-de-fhstr', {
  registration: 'F-GEEK',
  model: 'DR400-180',
  manufacturer: 'Robin',
  category: 'SEP'
})
```

### Exemple 3: Duplication Avancée

Dupliquer avec modifications de masse et centrage:

```javascript
await duplicateAircraft('id-de-fhstr', {
  registration: 'F-TECH',
  model: 'PA-28-161',
  manufacturer: 'Piper',
  category: 'SEP',
  overrides: {
    weights: {
      emptyWeight: '650',
      maxWeight: '1157',
      maxBaggage: '100'
    },
    fuel: {
      capacity: 190,
      unusable: 7,
      type: 'AVGAS',
      arm: 2.45
    }
  }
})
```

## ⚠️ Points Importants

1. **Immatriculation Unique**: L'immatriculation doit être unique dans la base de données.

2. **Données Copiées**: Toutes les données sont copiées:
   - Configuration de masse et centrage
   - Performances (décollage, atterrissage)
   - Configuration carburant
   - Positions des sièges et bagages
   - MANEX (si présent)

3. **Modifications Post-Duplication**: Après duplication, vous pouvez modifier toutes les données dans l'éditeur d'avion.

4. **Métadonnées**: Les métadonnées d'origine (ID, communityPresetId, etc.) sont supprimées lors de la duplication.

## 🚀 Intégration dans l'Interface

Pour ajouter le composant de duplication dans l'interface:

```jsx
import AircraftDuplicator from '@features/aircraft/components/AircraftDuplicator';

function MonComposant() {
  const handleSuccess = () => {
    console.log('Avion dupliqué avec succès!');
    // Recharger la liste des avions, naviguer, etc.
  };

  return (
    <AircraftDuplicator onSuccess={handleSuccess} />
  );
}
```

## 📊 Structure des Données

Un avion dans Supabase contient:

```javascript
{
  // Informations de base
  registration: 'F-HSTR',
  model: 'DA40 NG',
  manufacturer: 'Diamond',
  aircraftType: 'Avion',
  category: 'SEP',

  // Masse et centrage
  weights: {
    emptyWeight: '900',
    emptyWeightCG: '2.45',
    maxWeight: '1200',
    maxBaggage: '50'
  },

  // Carburant
  fuel: {
    capacity: 39,
    unusable: 0,
    type: 'JET-A1',
    arm: 2.63
  },

  // Positions (sièges, bagages)
  positions: [...],

  // Performances
  performance: {
    takeoff: {...},
    landing: {...}
  },

  // Métadonnées
  _metadata: {
    version: '1.0.0',
    units: {...}
  }
}
```

## 🔍 Debugging

Pour déboguer en cas de problème:

```javascript
// 1. Vérifier l'avion source
const source = await communityService.getPresetById('ID_SOURCE')
console.log('Source:', source)

// 2. Vérifier les avions disponibles
const available = await getAvailableAircraftForDuplication()
console.table(available)

// 3. Activer les logs détaillés
// Les logs sont automatiquement affichés dans la console lors de la duplication
```

## 📞 Support

En cas de problème:
1. Vérifier les logs de la console du navigateur
2. Vérifier que l'avion source existe dans Supabase
3. Vérifier que la nouvelle immatriculation est unique
4. Vérifier la connexion à Supabase

## 🔗 Fichiers Concernés

- **Utilitaire**: `src/utils/duplicateAircraft.js`
- **Composant UI**: `src/features/aircraft/components/AircraftDuplicator.jsx`
- **Service**: `src/services/communityService.js`
- **Store**: `src/core/stores/aircraftStore.js`
