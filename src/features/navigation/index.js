// src/features/navigation/index.js

// Re-export du module principal comme export par défaut
export { default } from './NavigationModule';

// Export des composants pour utilisation directe si nécessaire
// export { NavigationMap } from './components/NavigationMap'; // Composant supprimé
export { AirportSelector } from './components/AirportSelector';

// Export des hooks
export { useNavigationResults } from './hooks/useNavigationResults';