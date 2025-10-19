// src/hooks/useUnitsWatcher.js
import { useEffect } from 'react';
import { useUnitsStore } from '@core/stores/unitsStore';

/**
 * Hook pour déclencher un re-render quand les unités changent
 * Utilisé dans les composants qui affichent des valeurs avec unités
 */
export const useUnitsWatcher = () => {
  useEffect(() => {
    // Écouter l'événement custom pour les changements d'unités
    const handleUnitsUpdate = (event) => {
      
      // Le simple fait d'écouter cet événement dans useEffect
      // forcera un re-render des composants qui utilisent ce hook
    };
    
    window.addEventListener('unitsUpdated', handleUnitsUpdate);
    
    return () => {
      window.removeEventListener('unitsUpdated', handleUnitsUpdate);
    };
  }, []);
  
  // Retourner les unités actuelles
  return useUnitsStore((state) => state.units);
};

/**
 * Hook pour obtenir une unité spécifique avec écoute des changements
 */
export const useUnit = (category) => {
  const units = useUnitsWatcher();
  return units[category];
};