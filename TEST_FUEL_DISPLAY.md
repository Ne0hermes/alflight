# 🔍 Test d'affichage du carburant Alternate

## État actuel
Le calcul fonctionne correctement :
- ✅ Carburant calculé : 14 L
- ✅ Conversion en gallons : 3.7 gal
- ✅ Mise à jour dans le store
- ❌ Affichage reste à 0 dans l'interface

## Logs observés
```
🛢️ Fuel calculé (useMemo): 14
📊 Mise à jour du carburant alternate: 14 L
🔥 FuelModule - Données alternates: {alternateFuelRequired: 14, alternateFuelRequiredGal: 3.7...}
```

## Tests dans la console

### 1. Vérifier le store Fuel
```javascript
// Vérifier l'état du store fuel
const fuelStore = JSON.parse(localStorage.getItem('fuelStore') || '{}');
console.log('Fuel Store:', fuelStore);
console.log('Alternate dans store:', fuelStore?.state?.fuelData?.alternate);
```

### 2. Vérifier les données calculées
```javascript
// Vérifier les alternates
const alts = useAlternatesStore.getState().selectedAlternates;
console.log('Alternates sélectionnés:', alts);

// Forcer une mise à jour manuelle (test)
const testUpdate = {
  gal: 3.7,
  ltr: 14
};
console.log('Test update avec:', testUpdate);
```

### 3. Inspecter l'élément HTML
Dans les DevTools :
1. Aller dans l'onglet "Elements" (ou "Inspecteur")
2. Chercher la ligne "Alternate" dans le tableau
3. Vérifier la valeur des inputs

### 4. Test direct du composant
```javascript
// Récupérer l'état actuel
console.log('🎯 Test direct:');
console.log('fuelData:', window.fuelData);
console.log('safeFuelData:', window.safeFuelData);
```

## Corrections appliquées

### 1. Calcul minimum
- Si distance > 0 mais carburant < 1L → retourne 1L minimum
- Assure qu'on a toujours une valeur visible

### 2. Structure safeFuelData
- Changé de `fuelData || defaults` à structure par propriété
- Assure que chaque propriété est correctement initialisée

### 3. Logs de débogage
- Ajout de logs 🎯 pour voir safeFuelData
- Vérification de la valeur alternate au moment de l'affichage

## Solution potentielle

Si l'affichage reste à 0, essayer :

### Option 1 : Rafraîchir le composant
```javascript
// Dans la console, forcer un refresh
location.reload();
```

### Option 2 : Réinitialiser le store
```javascript
// Effacer et recréer
localStorage.removeItem('fuelStore');
location.reload();
```

### Option 3 : Vérifier le contexte
Le problème pourrait venir du contexte React qui ne propage pas les changements.

## Vérification finale

Après les corrections :
1. Sélectionner un alternate différent du départ/arrivée
2. Observer les logs 🛢️ et 📊
3. Vérifier les logs 🎯 pour safeFuelData
4. L'affichage devrait montrer 14 L / 3.7 gal

## Note importante

LFWM à 2.3 NM avec un DA40NG (vitesse 285 kt) :
- Temps de vol : 2.3/285 = 0.008 heures
- + 30 min réserve = 0.508 heures
- Consommation : 26 L/h
- Total : 0.508 × 26 = 13.2 L → arrondi à 14 L

Le calcul est correct !