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
  const aircraftList = useAircraftStore(state => state.aircraftList);
  const selectedAircraftId = useAircraftStore(state => state.selectedAircraftId);
  const selectedAircraft = useAircraftStore(state => {
    const id = state.selectedAircraftId;
    return state.aircraftList.find(a => a.id === id) || null;
  });
  const setSelectedAircraft = useAircraftStore(state => state.setSelectedAircraft);
  const updateAircraft = useAircraftStore(state => state.updateAircraft);
  const deleteAircraft = useAircraftStore(state => state.deleteAircraft);
  const addAircraft = useAircraftStore(state => state.addAircraft);
  
  // Debug: vérifier que le store est bien initialisé
  console.log('🚀 AircraftProvider - Render with:', {
    aircraftListLength: aircraftList?.length,
    selectedAircraftId: selectedAircraftId,
    selectedAircraft: selectedAircraft?.registration,
    setSelectedAircraftType: typeof setSelectedAircraft
  });
  
  const value = useMemo(() => ({
    aircraftList,
    selectedAircraft,
    setSelectedAircraft,
    updateAircraft,
    deleteAircraft,
    addAircraft
  }), [
    aircraftList,
    selectedAircraft,
    setSelectedAircraft,
    updateAircraft,
    deleteAircraft,
    addAircraft
  ]);

  return <AircraftContext.Provider value={value}>{children}</AircraftContext.Provider>;
});

export const NavigationProvider = memo(({ children }) => {
  // Extraire toutes les propriétés et méthodes du store correctement
  const waypoints = useNavigationStore(state => state.waypoints);
  const setWaypoints = useNavigationStore(state => state.setWaypoints);
  const flightParams = useNavigationStore(state => state.flightParams);
  const setFlightParams = useNavigationStore(state => state.setFlightParams);
  const flightType = useNavigationStore(state => state.flightType);
  const setFlightType = useNavigationStore(state => state.setFlightType);
  const calculateTotalDistance = useNavigationStore(state => state.calculateTotalDistance);
  const calculateFlightTime = useNavigationStore(state => state.calculateFlightTime);
  const calculateFuelRequired = useNavigationStore(state => state.calculateFuelRequired);
  const getRegulationReserveMinutes = useNavigationStore(state => state.getRegulationReserveMinutes);
  const getRegulationReserveLiters = useNavigationStore(state => state.getRegulationReserveLiters);
  
  const { selectedAircraft } = useAircraft();
  
  // Calculs mémorisés
  const navigationResults = useMemo(() => {
    if (!selectedAircraft || !waypoints.length) return null;
    
    const totalDistance = calculateTotalDistance();
    const totalTime = calculateFlightTime(selectedAircraft.cruiseSpeedKt);
    const fuelRequired = calculateFuelRequired(selectedAircraft.fuelConsumption);
    const regulationReserveMinutes = getRegulationReserveMinutes();
    const regulationReserveLiters = getRegulationReserveLiters(selectedAircraft.fuelConsumption);
    
    return {
      totalDistance: parseFloat(totalDistance.toFixed(1)),
      totalTime: totalTime,
      fuelRequired: parseFloat(fuelRequired.toFixed(1)),
      regulationReserveMinutes: regulationReserveMinutes,
      regulationReserveLiters: parseFloat(regulationReserveLiters.toFixed(1))
    };
  }, [selectedAircraft, waypoints, flightType, calculateTotalDistance, calculateFlightTime, 
      calculateFuelRequired, getRegulationReserveMinutes, getRegulationReserveLiters]);

  const value = useMemo(() => ({
    waypoints,
    setWaypoints,
    flightParams,
    setFlightParams,
    flightType,
    setFlightType,
    navigationResults,
    // Exposer les fonctions de calcul
    calculateTotalDistance,
    calculateFlightTime,
    calculateFuelRequired,
    getRegulationReserveMinutes,
    getRegulationReserveLiters
  }), [waypoints, setWaypoints, flightParams, setFlightParams, flightType, setFlightType,
      navigationResults, calculateTotalDistance, calculateFlightTime, calculateFuelRequired,
      getRegulationReserveMinutes, getRegulationReserveLiters]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
});

export const FuelProvider = memo(({ children }) => {
  // Extraire correctement les propriétés et méthodes du store
  const fuelData = useFuelStore(state => state.fuelData);
  const setFuelData = useFuelStore(state => state.setFuelData);
  const fobFuel = useFuelStore(state => state.fobFuel);
  const setFobFuel = useFuelStore(state => state.setFobFuel);
  const calculateTotal = useFuelStore(state => state.calculateTotal);
  const isFobSufficient = useFuelStore(state => state.isFobSufficient);
  const updateTripFuel = useFuelStore(state => state.updateTripFuel);
  const updateFinalReserve = useFuelStore(state => state.updateFinalReserve);
  
  const { navigationResults } = useNavigation();
  const { selectedAircraft } = useAircraft();
  
  // Auto-sync avec la navigation
  React.useEffect(() => {
    if (navigationResults?.fuelRequired) {
      updateTripFuel(navigationResults.fuelRequired);
    }
  }, [navigationResults?.fuelRequired, updateTripFuel]);
  
  // Auto-sync de la réserve finale
  React.useEffect(() => {
    if (navigationResults?.regulationReserveLiters) {
      updateFinalReserve(navigationResults.regulationReserveLiters);
    }
  }, [navigationResults?.regulationReserveLiters, updateFinalReserve]);

  const value = useMemo(() => ({
    fuelData,
    setFuelData,
    fobFuel,
    setFobFuel,
    calculateTotal,
    isFobSufficient,
    updateTripFuel,
    updateFinalReserve
  }), [fuelData, setFuelData, fobFuel, setFobFuel, calculateTotal, isFobSufficient, updateTripFuel, updateFinalReserve]);

  return <FuelContext.Provider value={value}>{children}</FuelContext.Provider>;
});

export const WeightBalanceProvider = memo(({ children }) => {
  // Extraire correctement les propriétés et méthodes du store
  const loads = useWeightBalanceStore(state => state.loads);
  const setLoads = useWeightBalanceStore(state => state.setLoads);
  const updateLoad = useWeightBalanceStore(state => state.updateLoad);
  const updateFuelLoad = useWeightBalanceStore(state => state.updateFuelLoad);
  const calculateWeightBalance = useWeightBalanceStore(state => state.calculateWeightBalance);
  
  const { selectedAircraft } = useAircraft();
  const { fobFuel } = useFuel();
  
  // Mise à jour du poids du carburant
  React.useEffect(() => {
    if (selectedAircraft && fobFuel?.ltr) {
      const fuelDensity = selectedAircraft.fuelType === 'JET A-1' ? 0.84 : 0.72;
      updateFuelLoad(fobFuel.ltr, fuelDensity);
    }
  }, [selectedAircraft, fobFuel?.ltr, updateFuelLoad]);
  
  // Extraire les valeurs individuelles des loads pour les dépendances
  const { frontLeft, frontRight, rearLeft, rearRight, baggage, auxiliary, fuel } = loads;
  
  // Calculs mémorisés avec dépendances correctes
  const calculations = useMemo(() => {
    if (!selectedAircraft) return null;
    
    return calculateWeightBalance(selectedAircraft, fobFuel);
  }, [selectedAircraft, frontLeft, frontRight, rearLeft, rearRight, baggage, auxiliary, fuel, fobFuel, calculateWeightBalance]);

  const value = useMemo(() => ({
    loads,
    setLoads,
    updateLoad,
    calculations,
    isWithinLimits: calculations?.isWithinLimits || false
  }), [loads, setLoads, updateLoad, calculations]);

  return <WeightBalanceContext.Provider value={value}>{children}</WeightBalanceContext.Provider>;
});

export const WeatherProvider = memo(({ children }) => {
  // Extraire correctement les propriétés et méthodes du store
  const weatherData = useWeatherStore(state => state.weatherData);
  const loading = useWeatherStore(state => state.loading);
  const errors = useWeatherStore(state => state.errors);
  const fetchWeather = useWeatherStore(state => state.fetchWeather);
  const fetchMultiple = useWeatherStore(state => state.fetchMultiple);
  const clearWeather = useWeatherStore(state => state.clearWeather);
  const clearAll = useWeatherStore(state => state.clearAll);
  const getWeatherByIcao = useWeatherStore(state => state.getWeatherByIcao);
  const isLoading = useWeatherStore(state => state.isLoading);
  const getError = useWeatherStore(state => state.getError);
  const needsRefresh = useWeatherStore(state => state.needsRefresh);
  
  const value = useMemo(() => ({
    weatherData,
    loading,
    errors,
    fetchWeather,
    fetchMultiple,
    clearWeather,
    clearAll,
    getWeatherByIcao,
    isLoading,
    getError,
    needsRefresh
  }), [
    weatherData,
    loading,
    errors,
    fetchWeather,
    fetchMultiple,
    clearWeather,
    clearAll,
    getWeatherByIcao,
    isLoading,
    getError,
    needsRefresh
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