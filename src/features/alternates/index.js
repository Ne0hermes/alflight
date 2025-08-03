// src/features/alternates/index.js

// Export par défaut du module principal (composant)
export { default } from './AlternatesModule.jsx';

// Export des hooks pour utilisation dans d'autres modules
export { useAlternateSelection } from './hooks/useAlternateSelection';
export { useAdvancedAlternateSelection } from './hooks/useAdvancedAlternateSelection';
export { useAlternatesForNavigation } from './hooks/useAlternatesIntegration';
export { useAlternatesForFuel } from './hooks/useAlternatesIntegration';
export { useAlternatesForPerformance } from './hooks/useAlternatesIntegration';
export { useAlternatesForVAC } from './hooks/useAlternatesIntegration';

// Export des composants si nécessaire
export { AlternateDetails } from './components/AlternateDetails';
export { AlternateMap } from './components/AlternateMap';
export { AlternateSelector } from './components/AlternateSelector';

// Export des utilitaires
export { calculateSearchZone, isAirportInSearchZone } from './utils/geometryCalculations';
export { scoreAlternates } from './hooks/useAlternateScoring';