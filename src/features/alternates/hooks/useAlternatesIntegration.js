// src/features/alternates/hooks/useAlternatesIntegration.js

import { useAlternatesStore } from '@core/stores/alternatesStore';
import { useNavigation, useAircraft } from '@core/contexts';  // Ajout de useAircraft
import { useVACStore } from '@core/stores/vacStore';  // Ajout pour useAlternatesForVAC
import { useCallback } from 'react';

/**
 * Hook pour intégration dans le module Navigation
 * Permet d'accéder aux alternates depuis le module navigation
 */
export const useAlternatesForNavigation = () => {
  const { selectedAlternates, addAlternate, removeAlternate } = useAlternatesStore();
  const { waypoints, setWaypoints } = useNavigation();
  
  const addAlternateAsWaypoint = useCallback((alternate) => {
    // Créer un waypoint depuis l'alternate
    const newWaypoint = {
      id: Date.now(),
      name: alternate.icao,
      type: 'alternate',
      lat: alternate.position.lat,
      lon: alternate.position.lon,
      elevation: alternate.elevation,
      airportName: alternate.name
    };
    
    // Insérer avant la destination finale
    const newWaypoints = [...waypoints];
    newWaypoints.splice(waypoints.length - 1, 0, newWaypoint);
    setWaypoints(newWaypoints);
  }, [waypoints, setWaypoints]);
  
  return {
    alternates: selectedAlternates,
    hasAlternates: selectedAlternates.length > 0,
    addAlternateAsWaypoint,
    isAlternate: (icao) => selectedAlternates.some(alt => alt.icao === icao)
  };
};

/**
 * Hook pour intégration dans le module Fuel
 * Calcule le carburant nécessaire pour les déroutements
 */
export const useAlternatesForFuel = () => {
  const { selectedAlternates } = useAlternatesStore();
  const { selectedAircraft } = useAircraft();  // Maintenant importé correctement
  const { waypoints } = useNavigation();
  
  const calculateAlternateFuel = useCallback(() => {
    if (!selectedAlternates.length || !selectedAircraft) return 0;
    
    const arrival = waypoints[waypoints.length - 1];
    if (!arrival) return 0;
    
    // Trouver l'alternate le plus éloigné de l'arrivée
    let maxDistance = 0;
    selectedAlternates.forEach(alt => {
      const distance = calculateDistance(
        { lat: arrival.lat, lon: arrival.lon },
        alt.position
      );
      maxDistance = Math.max(maxDistance, distance);
    });
    
    // Calculer le carburant nécessaire
    const fuelConsumption = selectedAircraft.fuelConsumption;
    const cruiseSpeed = selectedAircraft.cruiseSpeedKt;
    const flightTime = maxDistance / cruiseSpeed;
    
    return flightTime * fuelConsumption;
  }, [selectedAlternates, selectedAircraft, waypoints]);
  
  return {
    alternateFuelRequired: calculateAlternateFuel(),
    alternatesCount: selectedAlternates.length,
    alternateIcaos: selectedAlternates.map(alt => alt.icao)
  };
};

/**
 * Hook pour intégration dans le module Performance
 * Vérifie la compatibilité des alternates avec l'avion
 */
export const useAlternatesForPerformance = () => {
  const { selectedAlternates, scoredAlternates } = useAlternatesStore();
  const { selectedAircraft } = useAircraft();  // Ajout de l'import
  
  const checkAlternateCompatibility = useCallback((alternate) => {
    if (!selectedAircraft) return { compatible: false, reasons: ['Pas d\'avion sélectionné'] };
    
    const reasons = [];
    let compatible = true;
    
    // Vérifier la longueur de piste
    const requiredLength = selectedAircraft.performances?.landingDistance * 1.43 || 500;
    const hasAdequateRunway = alternate.runways.some(rwy => rwy.length >= requiredLength);
    
    if (!hasAdequateRunway) {
      compatible = false;
      reasons.push(`Piste trop courte (min ${requiredLength}m requis)`);
    }
    
    // Vérifier les surfaces compatibles
    if (selectedAircraft.compatibleRunwaySurfaces) {
      const hasCompatibleSurface = alternate.runways.some(rwy => 
        selectedAircraft.compatibleRunwaySurfaces.includes(rwy.surface)
      );
      
      if (!hasCompatibleSurface) {
        compatible = false;
        reasons.push('Surface de piste incompatible');
      }
    }
    
    return { compatible, reasons };
  }, [selectedAircraft]);
  
  return {
    checkAlternateCompatibility,
    compatibleAlternates: scoredAlternates.filter(alt => 
      checkAlternateCompatibility(alt).compatible
    )
  };
};

/**
 * Hook pour intégration dans le module VAC
 * Gère l'affichage des cartes VAC des alternates
 */
export const useAlternatesForVAC = () => {
  const { selectedAlternates } = useAlternatesStore();
  const { charts, downloadChart, selectChart } = useVACStore();  // Maintenant importé
  
  const alternateChartsStatus = selectedAlternates.map(alt => ({
    icao: alt.icao,
    hasVAC: charts[alt.icao]?.isDownloaded || false,
    chart: charts[alt.icao]
  }));
  
  const downloadAlternateCharts = useCallback(async () => {
    const promises = selectedAlternates
      .filter(alt => !charts[alt.icao]?.isDownloaded)
      .map(alt => downloadChart(alt.icao));
    
    return Promise.all(promises);
  }, [selectedAlternates, charts, downloadChart]);
  
  return {
    alternateChartsStatus,
    downloadAlternateCharts,
    viewAlternateChart: (icao) => selectChart(icao)
  };
};

// Fonction utilitaire pour calculer la distance
const calculateDistance = (point1, point2) => {
  const R = 3440.065; // Rayon terre en NM
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lon - point1.lon) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};