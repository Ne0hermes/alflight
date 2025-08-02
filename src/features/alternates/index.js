// src/features/alternates/index.js

// Export du module principal
export { default } from './AlternatesModule';

// Export des composants
export { AlternateSelector } from './components/AlternateSelector';
export { AlternateMap } from './components/AlternateMap';
export { AlternateDetails } from './components/AlternateDetails';

// Export des hooks d'intégration
export { 
  useAlternatesForNavigation,
  useAlternatesForFuel,
  useAlternatesForPerformance,
  useAlternatesForVAC
} from './hooks/useAlternatesIntegration';

// Export du store pour accès direct si nécessaire
export { useAlternatesStore } from '@core/stores/alternatesStore';