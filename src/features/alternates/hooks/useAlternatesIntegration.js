// src/features/alternates/hooks/useAlternatesIntegration.js

import { useAlternatesStore } from '@core/stores/alternatesStore';
import { useNavigation, useAircraft } from '@core/contexts';
import { useVACStore } from '@core/stores/vacStore';
import { useCallback, useMemo } from 'react';
import { computeWorstDiversion } from '../utils/alternateFuelCalculations';

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

  // 🔧 LOT 2 — Algorithme validé (pied de perpendiculaire sur la route réelle,
  // supplément = carburant(pied→déroutement) − carburant(pied→arrivée) si
  // positif, sinon « carburant suffisant »). Remplace l'ancien calcul
  // « distance perpendiculaire max × conso » qui donnait ~0 L pour un
  // déroutement proche de la route (perçu comme « le calcul ne se fait pas »)
  // et retournait 0 en silence sur toute donnée manquante.
  const diversionAnalysis = useMemo(() => computeWorstDiversion({
    alternates: selectedAlternates,
    waypoints,
    aircraft: selectedAircraft
  }), [selectedAlternates, waypoints, selectedAircraft]);

  const fuelRequired = diversionAnalysis.supplementLtr;

  // Distances pied de perpendiculaire → déroutement (affichage), avec statut
  // explicite pour les déroutements non calculables (plus de 0 ambigu).
  // Appariement par INDEX (computeWorstDiversion préserve l'ordre) — un match
  // par icao confondrait deux points sans icao ou de même OACI.
  const alternateDistances = selectedAlternates.map((alt, index) => {
    const result = diversionAnalysis.results[index];
    return {
      icao: alt.icao,
      distance: result?.status === 'ok' ? result.distFootToAlternateNM : 0,
      status: result?.status || 'missing-position',
      type: alt.selectionType,
      name: alt.name,
      referencePoint: 'Perpendiculaire route'
    };
  });

  // Le déroutement le plus pénalisant (celui qui dimensionne le supplément)
  const maxDistanceAlternate = diversionAnalysis.worst
    ? {
        icao: diversionAnalysis.worst.icao,
        name: diversionAnalysis.worst.name,
        distance: diversionAnalysis.worst.distFootToAlternateNM,
        status: 'ok'
      }
    : { distance: 0, status: diversionAnalysis.errors[0]?.status || 'no-alternate' };

  return {
    alternateFuelRequired: fuelRequired,
    alternateFuelRequiredGal: fuelRequired / 3.78541, // Conversion en gallons
    diversionAnalysis,
    alternatesCount: selectedAlternates.length,
    alternateIcaos: selectedAlternates.map(alt => alt.icao),
    alternatesByType: {
      departure: selectedAlternates.filter(alt => alt.selectionType === 'departure'),
      arrival: selectedAlternates.filter(alt => alt.selectionType === 'arrival')
    },
    alternateDistances,
    maxDistanceAlternate,
    hasAlternates: selectedAlternates.length > 0
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
  
  // Debug: afficher les points pour comprendre pourquoi distance = 0
  if (Math.abs(dLat) < 0.0001 && Math.abs(dLon) < 0.0001) {
      }
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  // Arrondir à 1 décimale pour éviter les valeurs comme 0.0000001
  return Math.round(distance * 10) / 10;
};