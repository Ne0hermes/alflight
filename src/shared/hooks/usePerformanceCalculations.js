// src/shared/hooks/usePerformanceCalculations.js
import { useMemo, useCallback } from 'react';
import { useAircraft } from '@core/contexts';

/**
 * Hook pour les calculs de performance (décollage/atterrissage)
 */
export const usePerformanceCalculations = () => {
  const { selectedAircraft } = useAircraft();
  
  // Calcul de la température ISA
  const calculateISATemperature = useCallback((altitudeFt) => {
    return 15 - (altitudeFt * 0.002);
  }, []);
  
  // Calcul du facteur de correction altitude/température
  const calculateCorrectionFactor = useCallback((altitudeFt, actualTemp) => {
    const isaTemp = calculateISATemperature(altitudeFt);
    const deltaT = actualTemp - isaTemp;
    
    const altitudeFactor = (altitudeFt / 1000) * 0.10;
    const tempFactor = (deltaT / 10) * 0.015;
    
    return 1 + altitudeFactor + tempFactor;
  }, [calculateISATemperature]);
  
  // Calcul des distances corrigées
  const calculateCorrectedDistances = useCallback((altitudeFt, actualTemp, weight = null) => {
    if (!selectedAircraft?.performances) return null;
    
    const factor = calculateCorrectionFactor(altitudeFt, actualTemp);
    const weightFactor = weight ? (weight - selectedAircraft.maxTakeoffWeight) / 100 * 0.01 : 0;
    const totalFactor = factor + weightFactor;
    
    return {
      takeoffDistance: Math.round(selectedAircraft.performances.takeoffDistance * totalFactor),
      accelerateStopDistance: Math.round(selectedAircraft.performances.accelerateStopDistance * totalFactor),
      landingDistance: Math.round(selectedAircraft.performances.landingDistance * totalFactor),
      landingDistanceFlapsUp: Math.round(selectedAircraft.performances.landingDistanceFlapsUp * totalFactor),
      correctionFactor: totalFactor
    };
  }, [selectedAircraft, calculateCorrectionFactor]);
  
  // Calcul du taux de montée corrigé
  const calculateClimbRate = useCallback((altitudeFt, actualTemp, weight) => {
    if (!selectedAircraft) return 0;
    
    // Taux de base (fictif, devrait venir des données avion)
    const baseClimbRate = 700; // ft/min
    
    // Corrections
    const altitudeCorrection = 1 - (altitudeFt / 20000);
    const tempCorrection = 1 - ((actualTemp - calculateISATemperature(altitudeFt)) / 50);
    const weightCorrection = 1 - ((weight - selectedAircraft.emptyWeight) / 1000 * 0.1);
    
    return Math.round(baseClimbRate * altitudeCorrection * tempCorrection * weightCorrection);
  }, [selectedAircraft, calculateISATemperature]);
  
  return {
    calculateISATemperature,
    calculateCorrectionFactor,
    calculateCorrectedDistances,
    calculateClimbRate
  };
};