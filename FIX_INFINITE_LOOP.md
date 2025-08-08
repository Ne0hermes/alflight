# ✅ Correction de la boucle infinie dans FuelModule

## Problème
Une erreur "Maximum update depth exceeded" se produisait dans le FuelModule, causant un crash de l'application.

## Cause
Les fonctions `setFuelData` étaient incluses dans les tableaux de dépendances des `useEffect`, ce qui créait une boucle infinie :
1. `useEffect` s'exécutait et appelait `setFuelData`
2. `setFuelData` modifiait l'état
3. Comme `setFuelData` était dans les dépendances, le `useEffect` se redéclenchait
4. Retour à l'étape 1 → boucle infinie

## Solution appliquée
Retirer `setFuelData` des tableaux de dépendances des `useEffect` dans `FuelModule.jsx` :

### Avant (problématique) :
```javascript
useEffect(() => {
  // ...
  setFuelData(prev => ({ ... }));
}, [navigationResults, selectedAircraft, setFuelData]); // ❌ setFuelData dans les deps
```

### Après (corrigé) :
```javascript
useEffect(() => {
  // ...
  setFuelData(prev => ({ ... }));
}, [navigationResults, selectedAircraft]); // ✅ setFuelData retiré
```

## Fichiers modifiés
- `src/features/fuel/FuelModule.jsx` :
  - Ligne 186 : Retiré `setFuelData` des dépendances du premier `useEffect`
  - Ligne 219 : Retiré `setFuelData` et `maxDistanceAlternate` des dépendances du second `useEffect`

## Règle générale pour éviter ce problème
**Ne jamais inclure les fonctions de mise à jour d'état (`setState`, `setData`, etc.) dans les tableaux de dépendances des `useEffect`**

Ces fonctions sont stables (ne changent pas) et leur inclusion peut causer des boucles infinies.

## Vérification
L'application devrait maintenant :
1. Ne plus afficher l'erreur "Maximum update depth exceeded"
2. Mettre à jour correctement le carburant alternate
3. Afficher les logs de débogage sans boucle infinie

## Test
1. Rafraîchir la page
2. Sélectionner des aérodromes de déroutement
3. Vérifier que les valeurs de carburant alternate se mettent à jour
4. Observer la console pour les logs 📊 (ils ne doivent apparaître qu'une fois par changement)