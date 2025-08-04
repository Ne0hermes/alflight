// src/features/alternates/hooks/useAlternatesIntegration.js

import { useAlternatesStore } from '@core/stores/alternatesStore';
import { useNavigation, useAircraft } from '@core/contexts';
import { useVACStore } from '@core/stores/vacStore';
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
      airportName: alternate.name,
      selectionType: alternate.selectionType // Conserver le type (departure/arrival)
    };
    
    // Insérer avant la destination finale
    const newWaypoints = [...waypoints];
    newWaypoints.splice(waypoints.length - 1, 0, newWaypoint);
    setWaypoints(newWaypoints);
  }, [waypoints, setWaypoints]);
  
  // Obtenir les alternates par type
  const departureAlternate = selectedAlternates.find(alt => alt.selectionType === 'departure');
  const arrivalAlternate = selectedAlternates.find(alt => alt.selectionType === 'arrival');
  
  return {
    alternates: selectedAlternates,
    departureAlternate,
    arrivalAlternate,
    hasAlternates: selectedAlternates.length > 0,
    hasBothAlternates: !!departureAlternate && !!arrivalAlternate,
    addAlternateAsWaypoint,
    isAlternate: (icao) => selectedAlternates.some(alt => alt.icao === icao),
    getAlternateType: (icao) => {
      const alt = selectedAlternates.find(alt => alt.icao === icao);
      return alt?.selectionType || null;
    }
  };
};

/**
 * Hook pour intégration dans le module Fuel
 * Calcule le carburant nécessaire pour les déroutements
 */
export const useAlternatesForFuel = () => {
  const { selectedAlternates } = useAlternatesStore();
  const { selectedAircraft } = useAircraft();
  const { waypoints } = useNavigation();
  
  const calculateAlternateFuel = useCallback(() => {
    if (!selectedAlternates.length || !selectedAircraft) return 0;
    
    const arrival = waypoints[waypoints.length - 1];
    if (!arrival) return 0;
    
    // Pour le système dual, calculer le carburant pour chaque alternate
    let totalFuel = 0;
    
    selectedAlternates.forEach(alt => {
      let distance = 0;
      
      if (alt.selectionType === 'departure') {
        // Distance depuis le départ
        const departure = waypoints[0];
        if (departure) {
          distance = calculateDistance(
            { lat: departure.lat, lon: departure.lon },
            alt.position
          );
        }
      } else if (alt.selectionType === 'arrival') {
        // Distance depuis l'arrivée
        distance = calculateDistance(
          { lat: arrival.lat, lon: arrival.lon },
          alt.position
        );
      }
      
      // Calculer le carburant nécessaire
      const fuelConsumption = selectedAircraft.fuelConsumption;
      const cruiseSpeed = selectedAircraft.cruiseSpeedKt;
      const flightTime = distance / cruiseSpeed;
      
      totalFuel += flightTime * fuelConsumption;
    });
    
    // Retourner le carburant pour l'alternate le plus consommateur
    return totalFuel / selectedAlternates.length; // Moyenne pour simplifier
  }, [selectedAlternates, selectedAircraft, waypoints]);
  
  // Calculer les distances pour chaque alternate
  const alternateDistances = selectedAlternates.map(alt => {
    const reference = alt.selectionType === 'departure' ? waypoints[0] : waypoints[waypoints.length - 1];
    if (!reference) return { icao: alt.icao, distance: 0, type: alt.selectionType };
    
    return {
      icao: alt.icao,
      distance: calculateDistance(
        { lat: reference.lat, lon: reference.lon },
        alt.position
      ),
      type: alt.selectionType
    };
  });
  
  return {
    alternateFuelRequired: calculateAlternateFuel(),
    alternatesCount: selectedAlternates.length,
    alternateIcaos: selectedAlternates.map(alt => alt.icao),
    alternatesByType: {
      departure: selectedAlternates.filter(alt => alt.selectionType === 'departure'),
      arrival: selectedAlternates.filter(alt => alt.selectionType === 'arrival')
    },
    alternateDistances
  };
};

/**
 * Hook pour intégration dans le module Performance
 * Vérifie la compatibilité des alternates avec l'avion
 */
export const useAlternatesForPerformance = () => {
  const { selectedAlternates, scoredAlternates } = useAlternatesStore();
  const { selectedAircraft } = useAircraft();
  
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
    
    // Vérifier les services pour le type de vol
    if (selectedAircraft.requiresATC && !alternate.services?.atc) {
      compatible = false;
      reasons.push('ATC requis mais non disponible');
    }
    
    return { compatible, reasons };
  }, [selectedAircraft]);
  
  // Vérifier la compatibilité par type
  const compatibilityByType = {
    departure: selectedAlternates
      .filter(alt => alt.selectionType === 'departure')
      .map(alt => ({
        ...alt,
        compatibility: checkAlternateCompatibility(alt)
      })),
    arrival: selectedAlternates
      .filter(alt => alt.selectionType === 'arrival')
      .map(alt => ({
        ...alt,
        compatibility: checkAlternateCompatibility(alt)
      }))
  };
  
  return {
    checkAlternateCompatibility,
    compatibleAlternates: scoredAlternates.filter(alt => 
      checkAlternateCompatibility(alt).compatible
    ),
    compatibilityByType,
    allAlternatesCompatible: selectedAlternates.every(alt => 
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
  const { charts, downloadChart, selectChart } = useVACStore();
  
  const alternateChartsStatus = selectedAlternates.map(alt => ({
    icao: alt.icao,
    name: alt.name,
    type: alt.selectionType,
    hasVAC: charts[alt.icao]?.isDownloaded || false,
    chart: charts[alt.icao]
  }));
  
  const downloadAlternateCharts = useCallback(async () => {
    const promises = selectedAlternates
      .filter(alt => !charts[alt.icao]?.isDownloaded)
      .map(alt => downloadChart(alt.icao));
    
    return Promise.all(promises);
  }, [selectedAlternates, charts, downloadChart]);
  
  // Statistiques par type
  const chartStatusByType = {
    departure: alternateChartsStatus.filter(status => status.type === 'departure'),
    arrival: alternateChartsStatus.filter(status => status.type === 'arrival')
  };
  
  const allChartsDownloaded = alternateChartsStatus.every(status => status.hasVAC);
  const missingCharts = alternateChartsStatus.filter(status => !status.hasVAC);
  
  return {
    alternateChartsStatus,
    chartStatusByType,
    allChartsDownloaded,
    missingCharts,
    downloadAlternateCharts,
    viewAlternateChart: (icao) => selectChart(icao),
    downloadSpecificChart: (icao) => downloadChart(icao)
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