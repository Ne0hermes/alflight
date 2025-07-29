// src/core/contexts/index.js
import React, { createContext, useContext, useMemo, useCallback, memo } from 'react';
import { useAircraftStore } from '../stores/aircraftStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useFuelStore } from '../stores/fuelStore';
import { useWeightBalanceStore } from '../stores/weightBalanceStore';

// Contexte pour les données d'avion uniquement
const AircraftContext = createContext();
export const useAircraft = () => {
  const context = useContext(AircraftContext);
  if (!context) throw new Error('useAircraft must be used within AircraftProvider');
  return context;
};

// Contexte pour la navigation uniquement
const NavigationContext = createContext();
export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useNavigation must be used within NavigationProvider');
  return context;
};

// Contexte pour le carburant uniquement
const FuelContext = createContext();
export const useFuel = () => {
  const context = useContext(FuelContext);
  if (!context) throw new Error('useFuel must be used within FuelProvider');
  return context;
};

// Contexte pour masse et centrage uniquement
const WeightBalanceContext = createContext();
export const useWeightBalance = () => {
  const context = useContext(WeightBalanceContext);
  if (!context) throw new Error('useWeightBalance must be used within WeightBalanceProvider');
  return context;
};

// Providers optimisés avec mémorisation
export const AircraftProvider = memo(({ children }) => {
  const store = useAircraftStore();
  
  const value = useMemo(() => ({
    aircraftList: store.aircraftList,
    selectedAircraft: store.selectedAircraft,
    setSelectedAircraft: store.setSelectedAircraft,
    updateAircraft: store.updateAircraft,
    deleteAircraft: store.deleteAircraft,
    addAircraft: store.addAircraft
  }), [
    store.aircraftList,
    store.selectedAircraft,
    store.setSelectedAircraft,
    store.updateAircraft,
    store.deleteAircraft,
    store.addAircraft
  ]);

  return <AircraftContext.Provider value={value}>{children}</AircraftContext.Provider>;
});

export const NavigationProvider = memo(({ children }) => {
  const store = useNavigationStore();
  const { selectedAircraft } = useAircraft();
  
  // Calculs mémorisés
  const navigationResults = useMemo(() => {
    if (!selectedAircraft || !store.waypoints.length) return null;
    
    return {
      totalDistance: store.calculateTotalDistance(),
      totalTime: store.calculateFlightTime(selectedAircraft.cruiseSpeedKt),
      fuelRequired: store.calculateFuelRequired(selectedAircraft.fuelConsumption),
      regulationReserveMinutes: store.getRegulationReserveMinutes(),
      regulationReserveLiters: store.getRegulationReserveLiters(selectedAircraft.fuelConsumption)
    };
  }, [selectedAircraft, store.waypoints, store.flightType]);

  const value = useMemo(() => ({
    waypoints: store.waypoints,
    setWaypoints: store.setWaypoints,
    flightParams: store.flightParams,
    setFlightParams: store.setFlightParams,
    flightType: store.flightType,
    setFlightType: store.setFlightType,
    navigationResults
  }), [store, navigationResults]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
});

export const FuelProvider = memo(({ children }) => {
  const store = useFuelStore();
  const { navigationResults } = useNavigation();
  const { selectedAircraft } = useAircraft();
  
  // Auto-sync avec la navigation
  React.useEffect(() => {
    if (navigationResults?.fuelRequired) {
      store.updateTripFuel(navigationResults.fuelRequired);
    }
  }, [navigationResults?.fuelRequired]);

  const value = useMemo(() => ({
    fuelData: store.fuelData,
    setFuelData: store.setFuelData,
    fobFuel: store.fobFuel,
    setFobFuel: store.setFobFuel,
    calculateTotal: store.calculateTotal,
    isFobSufficient: store.isFobSufficient
  }), [store]);

  return <FuelContext.Provider value={value}>{children}</FuelContext.Provider>;
});

export const WeightBalanceProvider = memo(({ children }) => {
  const store = useWeightBalanceStore();
  const { selectedAircraft } = useAircraft();
  const { fobFuel } = useFuel();
  
  // Calculs mémorisés avec dépendances minimales
  const calculations = useMemo(() => {
    if (!selectedAircraft) return null;
    
    return store.calculateWeightBalance(selectedAircraft, fobFuel);
  }, [selectedAircraft, store.loads, fobFuel]);

  const value = useMemo(() => ({
    loads: store.loads,
    setLoads: store.setLoads,
    calculations,
    isWithinLimits: calculations?.isWithinLimits || false
  }), [store.loads, store.setLoads, calculations]);

  return <WeightBalanceContext.Provider value={value}>{children}</WeightBalanceContext.Provider>;
});

// Provider racine qui combine tous les contextes
export const FlightSystemProviders = memo(({ children }) => {
  return (
    <AircraftProvider>
      <NavigationProvider>
        <FuelProvider>
          <WeightBalanceProvider>
            {children}
          </WeightBalanceProvider>
        </FuelProvider>
      </NavigationProvider>
    </AircraftProvider>
  );
});

// Hook personnalisé pour accéder à plusieurs contextes
export const useFlightSystem = () => {
  const aircraft = useAircraft();
  const navigation = useNavigation();
  const fuel = useFuel();
  const weightBalance = useWeightBalance();
  
  return useMemo(() => ({
    ...aircraft,
    ...navigation,
    ...fuel,
    ...weightBalance
  }), [aircraft, navigation, fuel, weightBalance]);
};