# 🔍 Guide de débogage - Carburant Alternates à 0

## Problème
Les gallons et litres pour le carburant de déroutement (Alternate) restent à 0 dans le module Fuel.

## Points de débogage ajoutés

### 1. Dans `useAlternatesIntegration.js`
- **Logs 🛢️** pour tracer le calcul :
  - `🛢️ Pas de calcul:` - Indique pourquoi le calcul ne se fait pas
  - `🛢️ Alternates à analyser:` - Montre les aérodromes sélectionnés
  - `🛢️ Position manquante pour` - Indique si une position est invalide
  - `🛢️ Analyse de [ICAO]` - Détails de chaque aérodrome
  - `🛢️ Distance [ICAO] depuis` - Distance calculée
  - `🛢️ Distances calculées:` - Résumé des distances max
  - `🛢️ Calcul final:` - Détails du calcul de carburant
  - `🛢️ Fuel calculé (useMemo):` - Résultat final

### 2. Dans `FuelModule.jsx`
- **Logs 🔥** pour le module :
  - `🔥 FuelModule - Données alternates:` - Toutes les données reçues du hook
- **Logs 📊** pour les mises à jour :
  - `📊 Fuel Update - Alternates:` - État lors de la mise à jour
  - `📊 Mise à jour du carburant alternate:` - Valeur mise à jour
  - `📊 Reset carburant alternate` - Remise à zéro

### 3. Dans `AlternatesModule.jsx`
- Correction pour s'assurer que chaque aérodrome sélectionné a :
  - Une `position` valide avec `lat` et `lon`
  - Un `selectionType` défini ('departure' ou 'arrival')

## Vérifications à faire dans la console

### 1. Vérifier les aérodromes sélectionnés
```javascript
const alternates = useAlternatesStore.getState().selectedAlternates;
console.log('Alternates:', alternates);

// Vérifier chaque alternate
alternates.forEach(alt => {
  console.log(`${alt.icao}:`, {
    position: alt.position,
    selectionType: alt.selectionType
  });
});
```

### 2. Vérifier l'avion
```javascript
const aircraft = JSON.parse(localStorage.getItem('selectedAircraft') || '{}');
console.log('Aircraft:', {
  model: aircraft.model,
  fuelConsumption: aircraft.fuelConsumption,
  cruiseSpeed: aircraft.cruiseSpeedKt || aircraft.cruiseSpeed
});
```

### 3. Vérifier les waypoints
```javascript
const waypoints = JSON.parse(localStorage.getItem('waypoints') || '[]');
console.log('Waypoints:', waypoints.length);
console.log('Départ:', waypoints[0]);
console.log('Arrivée:', waypoints[waypoints.length - 1]);
```

### 4. Forcer un recalcul
```javascript
// Forcer la mise à jour
const store = useAlternatesStore.getState();
store.setSelectedAlternates(store.selectedAlternates);
```

## Causes possibles du problème

### 1. Position manquante ou invalide
- **Symptôme** : Log `🛢️ Position manquante pour [ICAO]`
- **Solution** : Re-sélectionner l'aérodrome

### 2. SelectionType non défini
- **Symptôme** : Log `🛢️ Type inconnu pour [ICAO]: undefined`
- **Solution** : Re-sélectionner l'aérodrome dans le bon côté

### 3. Avion sans consommation
- **Symptôme** : `fuelConsumption` est null ou 0
- **Solution** : Définir la consommation dans Gestion Avions

### 4. Waypoints manquants
- **Symptôme** : Log `🛢️ Pas de calcul: waypoints manquants`
- **Solution** : Créer une route dans Navigation

### 5. Distance calculée = 0
- **Symptôme** : Log `🛢️ Distances calculées: {max: 0}`
- **Solution** : Vérifier les coordonnées des waypoints et alternates

## Corrections appliquées

1. **AlternatesModule.jsx** : S'assure que la position est correctement définie lors de la sélection
2. **useAlternatesIntegration.js** : 
   - Ajout de logs détaillés
   - Utilisation de `useMemo` pour éviter les recalculs
   - Calcul unique du carburant
3. **FuelModule.jsx** : 
   - Mise à jour même si fuel = 0
   - Logs détaillés des données reçues
   - Suppression de la condition `alternateFuelRequired > 0`

## Test rapide

1. Ouvrir la console (F12)
2. Sélectionner un aérodrome de déroutement
3. Observer les logs 🛢️
4. Si "Fuel calculé (useMemo): 0", vérifier :
   - La distance calculée
   - La consommation de l'avion
   - La vitesse de l'avion
5. Si "Fuel calculé (useMemo): [nombre]", mais reste à 0 dans l'interface :
   - Vérifier les logs 📊
   - Vérifier que `setFuelData` est appelé

## Calcul manuel pour vérification

```javascript
// Exemple de calcul manuel
const distance = 50; // NM
const cruiseSpeed = 100; // kt
const fuelConsumption = 30; // L/h
const flightTime = distance / cruiseSpeed; // 0.5 h
const totalTime = flightTime + 0.5; // +30 min = 1 h
const fuelRequired = totalTime * fuelConsumption; // 30 L

console.log('Calcul manuel:', {
  distance,
  cruiseSpeed,
  fuelConsumption,
  flightTime,
  totalTime,
  fuelRequired
});
```