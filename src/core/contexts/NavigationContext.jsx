// src/core/contexts/NavigationContext.jsx
// Version utilisant Zustand pour être cohérent avec le reste de l'app

import React, { createContext, useContext, useMemo } from 'react';
import { useNavigationStore } from '@core/stores/navigationStore';
import { useAircraft } from './AircraftContext';

const NavigationContext = createContext(null);

export const NavigationProvider = ({ children }) => {
  // Récupérer tout depuis le store Zustand
  const navigationStore = useNavigationStore();
  const { selectedAircraft } = useAircraft();
  
  // Calculer navigationResults à chaque changement
  const navigationResults = useMemo(() => {
    if (!selectedAircraft) return null;
    return navigationStore.getNavigationResults(selectedAircraft);
  }, [navigationStore.waypoints, navigationStore.flightType, selectedAircraft]);

  // Log pour debug
  console.log('🧭 NavigationContext - navigationResults:', navigationResults);

  // Créer la valeur du contexte
  const value = {
    // États du store
    waypoints: navigationStore.waypoints,
    flightType: navigationStore.flightType,
    flightParams: navigationStore.flightParams,
    
    // Actions du store
    setWaypoints: navigationStore.setWaypoints,
    setFlightType: navigationStore.setFlightType,
    setFlightParams: navigationStore.setFlightParams,
    addWaypoint: navigationStore.addWaypoint,
    removeWaypoint: navigationStore.removeWaypoint,
    updateWaypoint: navigationStore.updateWaypoint,
    clearRoute: navigationStore.clearRoute,
    
    // IMPORTANT: Exposer navigationResults
    navigationResults
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};

export default NavigationContext;