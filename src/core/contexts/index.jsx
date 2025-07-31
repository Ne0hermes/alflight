// src/core/contexts/index.jsx
import React, { createContext, useContext, useMemo, useCallback, memo } from 'react';
import { useAircraftStore } from '../stores/aircraftStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useFuelStore } from '../stores/fuelStore';
import { useWeightBalanceStore } from '../stores/weightBalanceStore';
import { useWeatherStore } from '../stores/weatherStore';

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

// Contexte pour la météo
const WeatherContext = createContext();
export const useWeather = () => {
  const context = useContext(WeatherContext);
  if (!context) throw new Error('useWeather must be used within WeatherProvider');
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
    
    const totalDistance = store.calculateTotalDistance();
    const totalTime = store.calculateFlightTime(selectedAircraft.cruiseSpeedKt);
    const fuelRequired = store.calculateFuelRequired(selectedAircraft.fuelConsumption);
    const regulationReserveMinutes = store.getRegulationReserveMinutes();
    const regulationReserveLiters = store.getRegulationReserveLiters(selectedAircraft.fuelConsumption);
    
    return {
      totalDistance: parseFloat(totalDistance.toFixed(1)),
      totalTime: totalTime,
      fuelRequired: parseFloat(fuelRequired.toFixed(1)),
      regulationReserveMinutes: regulationReserveMinutes,
      regulationReserveLiters: parseFloat(regulationReserveLiters.toFixed(1))
    };
  }, [selectedAircraft, store.waypoints, store.flightType, store]);

  const value = useMemo(() => ({
    waypoints: store.waypoints,
    setWaypoints: store.setWaypoints,
    flightParams: store.flightParams,
    setFlightParams: store.setFlightParams,
    flightType: store.flightType,
    setFlightType: store.setFlightType,
    navigationResults,
    // Exposer les fonctions de calcul directement depuis le store
    calculateTotalDistance: store.calculateTotalDistance,
    calculateFlightTime: store.calculateFlightTime,
    calculateFuelRequired: store.calculateFuelRequired,
    getRegulationReserveMinutes: store.getRegulationReserveMinutes,
    getRegulationReserveLiters: store.getRegulationReserveLiters
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
  }, [navigationResults?.fuelRequired, store.updateTripFuel]);
  
  // Auto-sync de la réserve finale
  React.useEffect(() => {
    if (navigationResults?.regulationReserveLiters) {
      store.updateFinalReserve(navigationResults.regulationReserveLiters);
    }
  }, [navigationResults?.regulationReserveLiters, store.updateFinalReserve]);

  const value = useMemo(() => ({
    fuelData: store.fuelData,
    setFuelData: store.setFuelData,
    fobFuel: store.fobFuel,
    setFobFuel: store.setFobFuel,
    calculateTotal: store.calculateTotal,
    isFobSufficient: store.isFobSufficient
  }), [store.fuelData, store.setFuelData, store.fobFuel, store.setFobFuel, store.calculateTotal, store.isFobSufficient]);

  return <FuelContext.Provider value={value}>{children}</FuelContext.Provider>;
});

export const WeightBalanceProvider = memo(({ children }) => {
  const store = useWeightBalanceStore();
  const { selectedAircraft } = useAircraft();
  const { fobFuel } = useFuel();
  
  // Mise à jour du poids du carburant
  React.useEffect(() => {
    if (selectedAircraft && fobFuel?.ltr) {
      const fuelDensity = selectedAircraft.fuelType === 'JET A-1' ? 0.84 : 0.72;
      store.updateFuelLoad(fobFuel.ltr, fuelDensity);
    }
  }, [selectedAircraft, fobFuel?.ltr, store.updateFuelLoad]);
  
  // Calculs mémorisés avec dépendances minimales
  const calculations = useMemo(() => {
    if (!selectedAircraft) return null;
    
    return store.calculateWeightBalance(selectedAircraft, fobFuel);
  }, [selectedAircraft, store.loads, fobFuel, store.calculateWeightBalance]);

  const value = useMemo(() => ({
    loads: store.loads,
    setLoads: store.setLoads,
    calculations,
    isWithinLimits: calculations?.isWithinLimits || false
  }), [store.loads, store.setLoads, calculations]);

  return <WeightBalanceContext.Provider value={value}>{children}</WeightBalanceContext.Provider>;
});

export const WeatherProvider = memo(({ children }) => {
  const store = useWeatherStore();
  
  const value = useMemo(() => ({
    weatherData: store.weatherData,
    loading: store.loading,
    errors: store.errors,
    fetchWeather: store.fetchWeather,
    fetchMultiple: store.fetchMultiple,
    clearWeather: store.clearWeather,
    clearAll: store.clearAll,
    getWeatherByIcao: store.getWeatherByIcao,
    isLoading: store.isLoading,
    getError: store.getError,
    needsRefresh: store.needsRefresh
  }), [
    store.weatherData,
    store.loading,
    store.errors,
    store.fetchWeather,
    store.fetchMultiple,
    store.clearWeather,
    store.clearAll,
    store.getWeatherByIcao,
    store.isLoading,
    store.getError,
    store.needsRefresh
  ]);

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
});

// Provider racine qui combine tous les contextes
export const FlightSystemProviders = memo(({ children }) => {
  return (
    <AircraftProvider>
      <NavigationProvider>
        <FuelProvider>
          <WeightBalanceProvider>
            <WeatherProvider>
              {children}
            </WeatherProvider>
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
  const weather = useWeather();
  
  return useMemo(() => ({
    ...aircraft,
    ...navigation,
    ...fuel,
    ...weightBalance,
    ...weather
  }), [aircraft, navigation, fuel, weightBalance, weather]);
};