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
  const loadFromSupabase = useAircraftStore(state => state.loadFromSupabase);
  const isInitialized = useAircraftStore(state => state.isInitialized);
  const error = useAircraftStore(state => state.error);

  // 🔧 FIX: DÉSACTIVATION CHARGEMENT AUTOMATIQUE DEPUIS SUPABASE
  // L'utilisateur doit créer ses avions via le wizard uniquement
  // React.useEffect(() => {
  //   if (!isInitialized) {
  //     loadFromSupabase().catch(err => {
  //       console.error('❌ Échec du chargement initial Supabase:', err);
  //     });
  //   }
  // }, [isInitialized, loadFromSupabase]);

  // 🔧 FIX: Charger les avions depuis IndexedDB au démarrage (pas localStorage - Out of Memory)
  React.useEffect(() => {
    if (!isInitialized) {
      const loadFromIndexedDB = async () => {
        console.log('📂 [AircraftProvider] Chargement depuis IndexedDB...');
        try {
          const { default: dataBackupManager } = await import('@utils/dataBackupManager');

          // 🔧 FIX: Charger TOUS les avions mais SANS les données volumineuses
          const allAircraft = await dataBackupManager.getAllFromStore('aircraftData');

          // 🔧 FIX CRITIQUE: Ne charger QUE les métadonnées légères (pas MANEX/photos/images)
          // Sinon: 6 avions × 12 MB MANEX = 72 MB en mémoire → Out of Memory!
          const lightAircraft = allAircraft.map(aircraft => {
            const light = { ...aircraft };

            // 🔧 FIX: Ajouter les flags AVANT de supprimer les données
            light.hasPhoto = !!(aircraft.photo || aircraft.profilePhoto);
            light.hasManex = !!aircraft.manex;

            // Supprimer les données volumineuses (on les chargera à la demande)
            delete light.manex;           // ❌ 12 MB par avion
            delete light.photo;           // ❌ Photos base64
            delete light.profilePhoto;    // ❌ Photos base64

            // Supprimer les images des performance tables
            if (light.advancedPerformance?.tables) {
              light.advancedPerformance.tables = light.advancedPerformance.tables.map(table => {
                const lightTable = { ...table };
                delete lightTable.sourceImage;
                return lightTable;
              });
            }

            // Supprimer les images des performance models
            if (light.performanceModels) {
              light.performanceModels = light.performanceModels.map(model => {
                const lightModel = { ...model };
                if (lightModel.data?.graphs) {
                  lightModel.data.graphs = lightModel.data.graphs.map(graph => {
                    const lightGraph = { ...graph };
                    delete lightGraph.sourceImage;
                    return lightGraph;
                  });
                }
                return lightModel;
              });
            }

            // 🔧 FIX CRITIQUE: Mapper weights.emptyWeight → emptyWeight pour les anciens avions
            // Les avions créés avant la correction ont weights.emptyWeight mais pas emptyWeight (propriété racine)
            // Le code WeightBalanceStore et WeightBalanceTable s'attendent à aircraft.emptyWeight
            if (!light.emptyWeight && light.weights?.emptyWeight) {
              light.emptyWeight = parseFloat(light.weights.emptyWeight);
              console.log(`✅ [AircraftProvider] Mapped weights.emptyWeight → emptyWeight for ${light.registration}: ${light.emptyWeight} kg`);
            }
            if (!light.maxTakeoffWeight && light.weights?.mtow) {
              light.maxTakeoffWeight = parseFloat(light.weights.mtow);
              console.log(`✅ [AircraftProvider] Mapped weights.mtow → maxTakeoffWeight for ${light.registration}: ${light.maxTakeoffWeight} kg`);
            }
            // 🔧 FIX: Mapper minTakeoffWeight depuis weights ou utiliser emptyWeight comme fallback
            if (!light.minTakeoffWeight) {
              // Si weights.minTakeoffWeight existe, l'utiliser
              if (light.weights?.minTakeoffWeight) {
                light.minTakeoffWeight = parseFloat(light.weights.minTakeoffWeight);
              }
              // Sinon, utiliser emptyWeight comme valeur minimale
              else if (light.emptyWeight) {
                light.minTakeoffWeight = light.emptyWeight;
              }
              // Dernière option : valeur par défaut
              else {
                light.minTakeoffWeight = 600;
              }
              console.log(`✅ [AircraftProvider] Set minTakeoffWeight for ${light.registration}: ${light.minTakeoffWeight} kg`);
            }

            // 🔧 FIX CRITIQUE: Créer weightBalance depuis arms si manquant
            // Les anciens avions ont arms mais pas weightBalance
            // Le code WeightBalanceStore vérifie weightBalance.emptyWeightArm et weightBalance.cgLimits
            if (light.arms && (!light.weightBalance || !light.weightBalance.emptyWeightArm)) {
              const parseOrNull = (value) => {
                if (!value || value === '' || value === '0') return null;
                const parsed = parseFloat(value);
                return isNaN(parsed) ? null : parsed;
              };

              light.weightBalance = {
                frontLeftSeatArm: parseOrNull(light.arms.frontSeats) || parseOrNull(light.arms.frontSeat),
                frontRightSeatArm: parseOrNull(light.arms.frontSeats) || parseOrNull(light.arms.frontSeat),
                rearLeftSeatArm: parseOrNull(light.arms.rearSeats) || parseOrNull(light.arms.rearSeat),
                rearRightSeatArm: parseOrNull(light.arms.rearSeats) || parseOrNull(light.arms.rearSeat),
                fuelArm: parseOrNull(light.arms.fuelMain) || parseOrNull(light.arms.fuel),
                emptyWeightArm: parseOrNull(light.arms.empty),
                baggageArm: parseOrNull(light.arms.baggage) || 3.50,
                auxiliaryArm: parseOrNull(light.arms.auxiliaryBaggage) || 3.70,
                cgLimits: (() => {
                  // Vérifier si cgLimits existe et est valide
                  const hasValidCgLimits = light.cgLimits &&
                    light.cgLimits.forward !== '' &&
                    light.cgLimits.aft !== '';

                  if (hasValidCgLimits) {
                    return light.cgLimits;
                  }

                  // Utiliser cgEnvelope comme fallback
                  if (light.cgEnvelope) {
                    return {
                      forward: parseOrNull(light.cgEnvelope.forwardPoints?.[0]?.cg),
                      aft: parseOrNull(light.cgEnvelope.aftCG),
                      forwardVariable: light.cgEnvelope.forwardPoints || []
                    };
                  }

                  // Dernier fallback
                  return {
                    forward: null,
                    aft: null,
                    forwardVariable: []
                  };
                })()
              };
              console.log(`✅ [AircraftProvider] Created weightBalance from arms for ${light.registration}`);
            }

            return light;
          });

          console.log('✅ [AircraftProvider] Métadonnées légères chargées depuis IndexedDB:', {
            count: lightAircraft.length,
            registrations: lightAircraft.map(a => a.registration)
          });

          // 🔧 NE PAS CONVERTIR ICI : Les données restent en STORAGE units
          // La conversion vers USER units se fera automatiquement via useUnits().format()
          // lors de l'affichage dans les composants
          console.log('📦 [AircraftProvider] Avions chargés en STORAGE units (ltr/lph/kg/kt):', {
            count: lightAircraft.length,
            note: 'Conversion → USER units faite par format() lors de l\'affichage'
          });

          // Charger les avions dans le store (en STORAGE units)
          useAircraftStore.setState({
            aircraftList: lightAircraft,
            isInitialized: true,
            selectedAircraftId: null
          });

        } catch (error) {
          console.error('❌ [AircraftProvider] Erreur chargement IndexedDB:', error);
          // Marquer comme initialisé même en cas d'erreur
          useAircraftStore.setState({
            isInitialized: true,
            aircraftList: [],
            selectedAircraftId: null
          });
        }

        console.log('ℹ️ [AircraftProvider] Chargement Supabase DÉSACTIVÉ - Utilisez le wizard pour créer des avions');
      };

      loadFromIndexedDB();
    }
  }, [isInitialized]);
  
  // Wrapper pour debugger les appels addAircraft
  const debugAddAircraft = useCallback(async (aircraft) => {
    console.log('🔧 [AircraftProvider.debugAddAircraft] Appel addAircraft');
    try {
      const result = await addAircraft(aircraft);
      console.log('✅ [AircraftProvider.debugAddAircraft] Résultat:', {
        id: result?.id,
        registration: result?.registration,
        hasResult: !!result
      });
      return result;
    } catch (error) {
      console.error('❌ AircraftProvider - addAircraft error:', error);
      throw error;
    }
  }, [addAircraft]);
  
  // Debug: vérifier que le store est bien initialisé
  // .toISOString(), 'with:', {
  //   aircraftListLength: aircraftList?.length,
  //   aircraftListIds: aircraftList?.map(a => a.id) || [],
  //   selectedAircraftId: selectedAircraftId,
  //   selectedAircraft: selectedAircraft?.registration,
  //   setSelectedAircraftType: typeof setSelectedAircraft
  // });
  
  // Effectuer une surveillance des changements de la liste d'avions
  React.useEffect(() => {
    //  || []
    // });
  }, [aircraftList]);
  
  // Surveillance spécifique pour les nouvelles entrées
  React.useEffect(() => {
    const currentLength = aircraftList?.length || 0;
    //     
    // Forcer un re-render si nécessaire
    if (currentLength !== (window.lastKnownAircraftCount || 2)) {
            window.lastKnownAircraftCount = currentLength;
    }
  }, [aircraftList?.length]);
  
  const value = useMemo(() => ({
    aircraftList,
    selectedAircraft,
    setSelectedAircraft,
    updateAircraft,
    deleteAircraft,
    addAircraft: debugAddAircraft
  }), [
    aircraftList,
    selectedAircraft,
    setSelectedAircraft,
    updateAircraft,
    deleteAircraft,
    debugAddAircraft
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
  const getNavigationResults = useNavigationStore(state => state.getNavigationResults);
  const addWaypoint = useNavigationStore(state => state.addWaypoint);
  const removeWaypoint = useNavigationStore(state => state.removeWaypoint);
  const updateWaypoint = useNavigationStore(state => state.updateWaypoint);
  const clearRoute = useNavigationStore(state => state.clearRoute);
  const moveWaypointUp = useNavigationStore(state => state.moveWaypointUp);
  const moveWaypointDown = useNavigationStore(state => state.moveWaypointDown);
  const segmentAltitudes = useNavigationStore(state => state.segmentAltitudes);
  const setSegmentAltitude = useNavigationStore(state => state.setSegmentAltitude);
  const getSegmentAltitude = useNavigationStore(state => state.getSegmentAltitude);
  
  const { selectedAircraft } = useAircraft();
  
  // Calculs mémorisés
  const navigationResults = useMemo(() => {
    if (!selectedAircraft || !waypoints.length) return null;
    
    return getNavigationResults(selectedAircraft);
  }, [selectedAircraft, waypoints, flightType, getNavigationResults]);

  const value = useMemo(() => ({
    waypoints,
    setWaypoints,
    flightParams,
    setFlightParams,
    flightType,
    setFlightType,
    navigationResults,
    // Exposer les actions du store
    addWaypoint,
    removeWaypoint,
    updateWaypoint,
    clearRoute,
    moveWaypointUp,
    moveWaypointDown,
    getNavigationResults,
    // Altitudes par segment
    segmentAltitudes,
    setSegmentAltitude,
    getSegmentAltitude
  }), [waypoints, setWaypoints, flightParams, setFlightParams, flightType, setFlightType,
      navigationResults, addWaypoint, removeWaypoint, updateWaypoint, clearRoute, moveWaypointUp, moveWaypointDown, getNavigationResults,
      segmentAltitudes, setSegmentAltitude, getSegmentAltitude]);

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

  // 🔧 FIX: Créer une chaîne de dépendance incluant TOUS les chargements (dynamiques inclus)
  // Cette approche garantit que les changements des compartiments bagages dynamiques
  // (baggage_0, baggage_1, etc.) déclenchent bien le recalcul
  const loadsSignature = useMemo(() => {
    return JSON.stringify(loads);
  }, [loads]);

  // Calculs mémorisés avec dépendances correctes incluant loadsSignature
  const calculations = useMemo(() => {
    if (!selectedAircraft) return null;

    console.log('🔄 [WeightBalanceProvider] Recalcul avec loads:', loads);
    return calculateWeightBalance(selectedAircraft, fobFuel);
  }, [selectedAircraft, loadsSignature, fobFuel, calculateWeightBalance]);

  const value = useMemo(() => ({
    loads,
    setLoads,
    updateLoad,
    updateFuelLoad,
    calculations,
    isWithinLimits: calculations?.isWithinLimits || false
  }), [loads, setLoads, updateLoad, updateFuelLoad, calculations]);

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