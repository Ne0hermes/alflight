// src/features/alternates/index.js

// Export par défaut du module principal (composant)
export { default } from './AlternatesModule.jsx';

// Export des hooks pour utilisation dans d'autres modules
export { useAlternateSelection } from './hooks/useAlternateSelection';
export { useAdvancedAlternateSelection } from './hooks/useAdvancedAlternateSelection';
export { 
  useAlternatesForNavigation,
  useAlternatesForFuel,
  useAlternatesForPerformance,
  useAlternatesForVAC 
} from './hooks/useAlternatesIntegration';

// Export des composants si nécessaire
export { AlternateDetails } from './components/AlternateDetails';
export { AlternateMap } from './components/AlternateMap';
export { AlternateSelector } from './components/AlternateSelector';

// Export des utilitaires
export { 
  calculateSearchZone, 
  isAirportInSearchZone,
  calculateDistanceFromRoute,
  geometryUtils
} from './utils/geometryCalculations';

// Les fonctions de navigation sont maintenant importées depuis le module centralisé
// Elles doivent être importées directement là où elles sont utilisées
export { scoreAlternates, scoringUtils } from './hooks/useAlternateScoring';
export { filterAlternates, filterUtils } from './utils/alternateFilters';