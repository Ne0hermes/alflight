// src/features/alternates/hooks/useAlternateSelection.js
import { useMemo, useCallback, useEffect } from 'react';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { useOpenAIPStore, openAIPSelectors } from '@core/stores/openAIPStore';
import { useNavigation, useAircraft, useFuel } from '@core/contexts';
import { useNavigationResults } from '@hooks/useNavigationResults';
import { calculateSearchZone, isPointInSearchZone } from '../utils/geometryCalculations';
import { filterAlternates } from '../utils/alternateFilters';
import { scoreAlternates } from './useAlternateScoring';

export const useAlternateSelection = () => {
  const { waypoints, flightType } = useNavigation();
  const { selectedAircraft } = useAircraft();
  const { calculateTotal } = useFuel();
  const navigationResults = useNavigationResults();
  
  const airports = openAIPSelectors.useFilteredAirports();
  const { 
    searchConfig, 
    filters,
    setCandidates,
    setScoredAlternates,
    setSearchZone,
    selectedAlternates
  } = useAlternatesStore();
  
  // Calculer les paramètres dynamiques
  const dynamicParams = useMemo(() => {
    if (!selectedAircraft || !navigationResults) return null;
    
    // Distance d'atterrissage requise (avec marge de sécurité)
    const landingDistance = selectedAircraft.performances?.landingDistance || 500;
    const requiredRunwayLength = Math.ceil(landingDistance * 1.43); // Facteur 1.43 réglementaire
    
    // Rayon max basé sur le carburant
    const totalFuelL = calculateTotal('ltr');
    const reserveFuelL = navigationResults.regulationReserveLiters;
    const availableFuelL = totalFuelL - reserveFuelL;
    const fuelConsumptionLH = selectedAircraft.fuelConsumption;
    const cruiseSpeed = selectedAircraft.cruiseSpeedKt;
    
    const maxFlightTimeH = availableFuelL / fuelConsumptionLH;
    const maxRadiusNM = maxFlightTimeH * cruiseSpeed;
    
    return {
      requiredRunwayLength,
      maxRadiusNM,
      flightRules: flightType.rules,
      isDayFlight: flightType.period === 'jour'
    };
  }, [selectedAircraft, navigationResults, calculateTotal, flightType]);
  
  // Calculer la zone de recherche
  const searchZone = useMemo(() => {
    if (waypoints.length < 2) return null;
    
    const departure = waypoints[0];
    const arrival = waypoints[waypoints.length - 1];
    
    if (!departure.lat || !arrival.lat) return null;
    
    return calculateSearchZone(
      { lat: departure.lat, lon: departure.lon },
      { lat: arrival.lat, lon: arrival.lon },
      searchConfig.method,
      searchConfig.bufferDistance
    );
  }, [waypoints, searchConfig]);
  
  // Trouver et filtrer les candidats
  const findAlternates = useCallback(async () => {
    if (!searchZone || !dynamicParams) return;
    
    // 1. Filtrer les aérodromes dans la zone
    const candidatesInZone = airports.filter(airport => {
      const point = { lat: airport.coordinates.lat, lon: airport.coordinates.lon };
      return isPointInSearchZone(point, searchZone);
    });
    
    // 2. Appliquer les filtres
    const filtered = await filterAlternates(candidatesInZone, {
      ...filters,
      ...dynamicParams,
      departure: waypoints[0],
      arrival: waypoints[waypoints.length - 1]
    });
    
    setCandidates(filtered);
    
    // 3. Calculer les scores
    const scored = await scoreAlternates(filtered, {
      departure: waypoints[0],
      arrival: waypoints[waypoints.length - 1],
      aircraft: selectedAircraft,
      flightType,
      searchZone
    });
    
    setScoredAlternates(scored);
  }, [searchZone, dynamicParams, airports, filters, waypoints, selectedAircraft, flightType]);
  
  // Mettre à jour automatiquement quand les paramètres changent
  useEffect(() => {
    if (searchZone) {
      setSearchZone(searchZone);
      findAlternates();
    }
  }, [searchZone, findAlternates]);
  
  return {
    searchZone,
    dynamicParams,
    selectedAlternates,
    findAlternates,
    isReady: !!searchZone && !!dynamicParams
  };
};