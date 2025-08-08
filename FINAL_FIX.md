# Correction Finale - Import calculateDistance

## ❌ Erreur
```
SyntaxError: The requested module '/src/features/alternates/utils/geometryCalculations.js' 
does not provide an export named 'calculateDistance'
```

## ✅ Solution Appliquée

### Fichiers corrigés :
1. **src/features/alternates/hooks/useAlternateSelection.js**
2. **src/features/alternates/components/AlternateSelectorDual.jsx**
3. **src/features/alternates/hooks/useAdvancedAlternateSelection.js**

### Changement effectué :
```javascript
// AVANT (Incorrect)
import { calculateDistance } from '../utils/geometryCalculations';

// APRÈS (Correct)
import { calculateDistance } from '@utils/navigationCalculations';
```

## 📋 Résumé de l'Architecture

### Module centralisé (`@utils/navigationCalculations`)
Exporte toutes les fonctions de calcul de navigation :
- `calculateDistance`
- `calculateBearing`
- `calculateDestination`
- `calculateMidpoint`
- `calculateDistanceToSegment`
- `calculatePerpendicular`
- `getSideOfPerpendicular`
- etc.

### Module alternates (`geometryCalculations.js`)
Exporte uniquement les fonctions spécifiques aux alternates :
- `calculateSearchZone`
- `isAirportInSearchZone`
- `calculateDistanceFromRoute`
- `geometryUtils` (fonctions locales uniquement)

## 🚀 État Final

Toutes les erreurs d'import sont maintenant corrigées. Le module Déroutements devrait fonctionner correctement.

**Action requise** : Rafraîchir la page du navigateur (F5) pour recharger les modules corrigés.