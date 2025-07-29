// src/shared/hooks/useWindCalculations.js
import { useMemo, useCallback } from 'react';

/**
 * Hook pour les calculs de vent et navigation
 */
export const useWindCalculations = (trueCourse, trueAirspeed) => {
  // Calcul des composantes de vent
  const calculateWindComponents = useCallback((windDirection, windSpeed) => {
    const courseRad = trueCourse * Math.PI / 180;
    const windRad = windDirection * Math.PI / 180;
    const windAngle = windRad - courseRad;
    
    return {
      headwind: windSpeed * Math.cos(windAngle),
      crosswind: windSpeed * Math.sin(windAngle)
    };
  }, [trueCourse]);
  
  // Calcul de la dérive
  const calculateDrift = useCallback((windDirection, windSpeed) => {
    if (!trueAirspeed || trueAirspeed === 0) return 0;
    
    const { crosswind } = calculateWindComponents(windDirection, windSpeed);
    const driftRad = Math.asin(crosswind / trueAirspeed);
    return driftRad * 180 / Math.PI;
  }, [trueAirspeed, calculateWindComponents]);
  
  // Calcul du cap à suivre
  const calculateHeading = useCallback((windDirection, windSpeed) => {
    const drift = calculateDrift(windDirection, windSpeed);
    const heading = trueCourse - drift;
    return (heading + 360) % 360;
  }, [trueCourse, calculateDrift]);
  
  // Calcul de la vitesse sol
  const calculateGroundSpeed = useCallback((windDirection, windSpeed) => {
    if (!trueAirspeed) return 0;
    
    const drift = calculateDrift(windDirection, windSpeed);
    const { headwind } = calculateWindComponents(windDirection, windSpeed);
    
    const driftRad = drift * Math.PI / 180;
    const groundSpeed = Math.sqrt(
      Math.pow(trueAirspeed * Math.cos(driftRad) - headwind, 2) +
      Math.pow(trueAirspeed * Math.sin(driftRad), 2)
    );
    
    return Math.round(groundSpeed);
  }, [trueAirspeed, calculateDrift, calculateWindComponents]);
  
  // Retour de toutes les fonctions mémorisées
  return {
    calculateWindComponents,
    calculateDrift,
    calculateHeading,
    calculateGroundSpeed
  };
};