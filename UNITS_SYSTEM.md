# Système de gestion des unités - ALFlight

## Vue d'ensemble

Le système d'unités d'ALFlight permet aux utilisateurs de choisir leurs unités préférées et les applique automatiquement dans toute l'application.

## Unités supportées

### Carburant
- **Litres (L)** - Unité de stockage par défaut
- **Gallons US (gal)** - Facteur: 1 gal = 3.78541 L
- **Kilogrammes (kg)** - Facteur: 1 kg = 1.25 L (densité 0.8)
- **Livres (lbs)** - Facteur: 1 lbs = 0.567 L

### Masse/Poids
- **Kilogrammes (kg)** - Unité de stockage par défaut
- **Livres (lbs)** - Facteur: 1 lbs = 0.453592 kg

### Distance
- **Milles nautiques (NM)** - Unité de stockage par défaut
- **Kilomètres (km)** - Facteur: 1 NM = 1.852 km
- **Milles terrestres (mi)** - Facteur: 1 NM = 1.15078 mi

### Altitude
- **Pieds (ft)** - Unité de stockage par défaut
- **Mètres (m)** - Facteur: 1 ft = 0.3048 m
- **Niveau de vol (FL)** - FL = altitude en pieds / 100

### Vitesse
- **Nœuds (kt)** - Unité de stockage par défaut
- **Kilomètres/heure (km/h)** - Facteur: 1 kt = 1.852 km/h
- **Miles/heure (mph)** - Facteur: 1 kt = 1.15078 mph
- **Mètres/seconde (m/s)** - Facteur: 1 kt = 0.514444 m/s

### Température
- **Celsius (°C)** - Unité de stockage par défaut
- **Fahrenheit (°F)** - Formule: °F = °C × 9/5 + 32

### Pression
- **Hectopascals (hPa)** - Unité de stockage par défaut
- **Pouces de mercure (inHg)** - Facteur: 1 hPa = 0.02953 inHg
- **Millibars (mb)** - Facteur: 1 hPa = 1 mb

## Architecture technique

### 1. Stockage des données
Les données sont **toujours stockées** dans les unités standard (L, kg, NM, ft, kt, °C, hPa) pour garantir la cohérence et simplifier les calculs internes.

### 2. Hooks principaux

#### `useUnits()`
Hook principal pour la gestion des unités :
```javascript
const { format, convert, getSymbol, toStorage, getUnit } = useUnits();

// Convertir une valeur pour l'affichage
const displayValue = convert(100, 'fuel', 'ltr', { toUnit: 'gal' });

// Formater avec l'unité
const formatted = format(100, 'fuel', 1); // "100.0 L" ou "26.4 gal"

// Obtenir le symbole de l'unité
const symbol = getSymbol('fuel'); // "L", "gal", "kg", ou "lbs"

// Convertir vers l'unité de stockage
const storageValue = toStorage(26.4, 'fuel'); // Si l'unité est gal, retourne 100 L
```

#### `useUnitsWatcher()`
Hook pour forcer le re-render quand les unités changent :
```javascript
const units = useUnitsWatcher();
// Le composant se met à jour automatiquement quand les préférences changent
```

### 3. Flux de données

```
Saisie utilisateur → Conversion vers stockage → Base de données
                                                       ↓
Affichage ← Conversion depuis stockage ← Lecture des données
```

### 4. Événements

Un événement custom `unitsUpdated` est déclenché lors de la sauvegarde des préférences :
```javascript
window.addEventListener('unitsUpdated', (event) => {
  console.log('Nouvelles unités:', event.detail);
});
```

## Modules impactés

### AircraftModule
- **Carburant** : Capacité et consommation
- **Masses** : MTOW, masses limites, bagages
- **Centrage** : Points de l'enveloppe CG

### FuelModule
- **Quantités** : Affichage dans l'unité préférée
- **Table unique** : Une seule colonne avec l'unité sélectionnée
- **Totaux** : Calculés dans l'unité correcte

### WeightBalanceModule
- **Charges** : Passagers et bagages
- **Moments** : Calculs automatiques avec conversion

### NavigationModule
- **Distances** : Routes et segments
- **Altitudes** : Niveaux de vol
- **Vitesses** : TAS, GS, vent

### WeatherModule
- **Température** : METAR/TAF
- **Pression** : QNH
- **Vent** : Vitesse et rafales
- **Visibilité** : Conversion km/sm/m

## Configuration utilisateur

Les préférences sont accessibles dans :
**Onglet Pilote → Préférences d'unités**

### Presets disponibles
- **🇪🇺 Europe** : Standard européen (L, kg, NM, ft, kt, °C, hPa)
- **🇺🇸 USA** : Standard américain (gal, lbs, NM, ft, kt, °C, inHg)
- **✈️ Aviation** : Standard OACI (kg carburant, reste Europe)
- **📐 Métrique** : Système métrique (L, kg, km, m, km/h, °C, hPa)

### Sauvegarde
1. Modifier les unités souhaitées
2. Cliquer sur "Sauvegarder et appliquer"
3. Les changements sont appliqués immédiatement dans toute l'application

## Tests

Un fichier de test est disponible : `test-units-system.html`

Pour tester :
1. Ouvrir le fichier dans un navigateur
2. Sélectionner différentes unités
3. Vérifier les conversions en temps réel
4. Tester les presets régionaux

## Maintenance

### Ajouter une nouvelle catégorie d'unités

1. Définir dans `unitsStore.js` :
```javascript
units: {
  // ...
  newCategory: 'defaultUnit',
}
```

2. Ajouter les conversions dans `unitsConversion.js`

3. Mettre à jour les composants concernés avec `useUnits()`

### Ajouter une nouvelle unité à une catégorie existante

1. Ajouter l'option dans `UnitsPreferences.jsx`
2. Définir les facteurs de conversion
3. Tester avec le fichier de test

## Bonnes pratiques

1. **Toujours stocker en unités standard** - Ne jamais stocker dans l'unité préférée
2. **Convertir à l'affichage** - Utiliser `convert()` ou `format()`
3. **Convertir à la saisie** - Utiliser `toStorage()` avant de sauvegarder
4. **Utiliser useUnitsWatcher** - Pour les composants qui affichent des unités
5. **Labels dynamiques** - Toujours utiliser `getSymbol()` dans les labels

## Dépannage

### Les unités ne se mettent pas à jour
- Vérifier que le composant utilise `useUnitsWatcher()`
- S'assurer que l'événement `unitsUpdated` est bien déclenché

### Conversions incorrectes
- Vérifier les facteurs de conversion dans le code
- S'assurer que les valeurs sont numériques avant conversion
- Utiliser les logs de debug dans la console

### Performance
- Les conversions sont mémorisées avec `useMemo` quand possible
- Le re-render est optimisé avec `memo` sur les composants