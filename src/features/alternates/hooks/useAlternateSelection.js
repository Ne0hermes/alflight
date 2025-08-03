// src/features/alternates/hooks/useAlternateSelection.js

import { useMemo, useCallback, useEffect } from 'react';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { useOpenAIPStore, openAIPSelectors } from '@core/stores/openAIPStore';
import { useNavigation, useAircraft, useFuel, useWeather } from '@core/contexts';
import { useNavigationResults } from '@hooks/useNavigationResults';
import { useWeatherStore } from '@core/stores/weatherStore';
import { useVACStore } from '@core/stores/vacStore';
import { 
  calculateSearchZone, 
  isAirportInSearchZone,
  calculateDistanceFromRoute 
} from '../utils/geometryCalculations';
import { scoreAlternates } from './useAlternateScoring';

/**
 * Hook principal pour la sélection automatique avancée des aérodromes de déroutement
 * Utilise la logique géométrique complète avec triangle équilatéral et scoring multi-critères
 */
export const useAlternateSelection = () => {
  const { waypoints, flightType } = useNavigation();
  const { selectedAircraft } = useAircraft();
  const { fuelData, fobFuel, calculateTotal } = useFuel();
  const navigationResults = useNavigationResults();
  const weatherStore = useWeatherStore();
  const vacStore = useVACStore();
  
  const airports = openAIPSelectors.useFilteredAirports();
  const { 
    searchConfig,
    setCandidates,
    setScoredAlternates,
    setSearchZone,
    selectedAlternates
  } = useAlternatesStore();
  
  // Validation des données
  const isReady = useMemo(() => {
    return (
      waypoints.length >= 2 &&
      waypoints[0].lat && waypoints[0].lon &&
      waypoints[waypoints.length - 1].lat && waypoints[waypoints.length - 1].lon &&
      selectedAircraft &&
      navigationResults
    );
  }, [waypoints, selectedAircraft, navigationResults]);
  
  // Calcul des données carburant pour le rayon dynamique
  const fuelDataForRadius = useMemo(() => {
    if (!selectedAircraft || !fobFuel || !navigationResults) return null;
    
    const totalRequired = calculateTotal('ltr');
    const fuelRemaining = fobFuel.ltr - navigationResults.fuelRequired;
    
    return {
      aircraft: selectedAircraft,
      fuelRemaining,
      reserves: {
        final: navigationResults.regulationReserveLiters,
        alternate: fuelData.alternate.ltr
      }
    };
  }, [selectedAircraft, fobFuel, navigationResults, calculateTotal, fuelData]);
  
  // Calcul de la zone de recherche
  const searchZone = useMemo(() => {
    if (!isReady) return null;
    
    const departure = {
      lat: waypoints[0].lat,
      lon: waypoints[0].lon
    };
    const arrival = {
      lat: waypoints[waypoints.length - 1].lat,
      lon: waypoints[waypoints.length - 1].lon
    };
    
    return calculateSearchZone(departure, arrival, waypoints, fuelDataForRadius);
  }, [waypoints, fuelDataForRadius, isReady]);
  
  // Paramètres dynamiques
  const dynamicParams = useMemo(() => {
    if (!selectedAircraft || !navigationResults || !searchZone) return null;
    
    const landingDistance = selectedAircraft.performances?.landingDistance || 500;
    const requiredRunwayLength = Math.ceil(landingDistance * 1.43);
    
    return {
      requiredRunwayLength,
      maxRadiusNM: searchZone.dynamicRadius,
      flightRules: flightType.rules,
      isDayFlight: flightType.period === 'jour'
    };
  }, [selectedAircraft, navigationResults, searchZone, flightType]);
  
  // Fonction de recherche et scoring
  const findAlternates = useCallback(async () => {
    if (!searchZone || !selectedAircraft || !dynamicParams) return;
    
    console.log('🔍 Recherche avancée d\'alternates...');
    
    // 1. Filtrer les aérodromes dans la zone
    const candidatesInZone = [];
    
    for (const airport of airports) {
      const zoneCheck = isAirportInSearchZone(airport, searchZone);
      
      if (zoneCheck.isInZone) {
        // Enrichir avec les informations de distance
        candidatesInZone.push({
          ...airport,
          distance: calculateDistanceFromRoute(
            airport.coordinates,
            { lat: waypoints[0].lat, lon: waypoints[0].lon },
            { lat: waypoints[waypoints.length - 1].lat, lon: waypoints[waypoints.length - 1].lon }
          ),
          position: airport.coordinates,
          zoneInfo: zoneCheck
        });
      }
    }
    
    // 2. Filtrer selon les critères
    const filtered = candidatesInZone.filter(airport => {
      // Longueur de piste
      const hasAdequateRunway = airport.runways?.some(rwy => 
        (rwy.length || 0) >= dynamicParams.requiredRunwayLength
      );
      
      return hasAdequateRunway;
    });
    
    setCandidates(filtered);
    
    // 3. Récupérer la météo
    await Promise.all(
      filtered.slice(0, 10).map(airport => 
        weatherStore.fetchWeather(airport.icao).catch(() => null)
      )
    );
    
    // 4. Calculer les scores
    const context = {
      departure: { lat: waypoints[0].lat, lon: waypoints[0].lon },
      arrival: { lat: waypoints[waypoints.length - 1].lat, lon: waypoints[waypoints.length - 1].lon },
      waypoints,
      aircraft: selectedAircraft,
      weather: weatherStore.weatherData,
      flightType
    };
    
    // Utiliser scoreAlternates qui retourne une liste d'aérodromes scorés
    const scoredAirports = await scoreAlternates(filtered, context);
    
    // Enrichir avec les métadonnées
    const scored = scoredAirports.map(airport => ({
      ...airport,
      // Services
      services: {
        fuel: airport.fuel || false,
        atc: hasATCService(airport),
        lighting: hasNightLighting(airport)
      },
      // Pistes
      runways: airport.runways || []
    }));
    
    // 5. Trier par score
    scored.sort((a, b) => b.score - a.score);
    setScoredAlternates(scored);
    
    // 6. Sélectionner automatiquement les 3 meilleurs
    const top3 = scored.slice(0, 3);
    useAlternatesStore.getState().setSelectedAlternates(top3);
    
    console.log(`✅ ${scored.length} alternates scorés`);
  }, [
    searchZone,
    airports,
    selectedAircraft,
    dynamicParams,
    waypoints,
    weatherStore,
    flightType,
    setCandidates,
    setScoredAlternates
  ]);
  
  // Mise à jour automatique
  useEffect(() => {
    if (searchZone) {
      setSearchZone(searchZone);
      findAlternates();
    }
  }, [searchZone, findAlternates, setSearchZone]);
  
  return {
    searchZone,
    dynamicParams,
    selectedAlternates,
    findAlternates,
    isReady
  };
};

// Fonctions utilitaires
const hasATCService = (airport) => {
  if (airport.frequencies) {
    return airport.frequencies.some(freq => 
      ['TWR', 'APP', 'AFIS'].includes(freq.type)
    );
  }
  return ['medium_airport', 'large_airport'].includes(airport.type);
};

const hasNightLighting = (airport) => {
  if (airport.runways) {
    return airport.runways.some(rwy => 
      rwy.lighting || rwy.lights || rwy.hasLighting
    );
  }
  return airport.type !== 'small_airport';
};