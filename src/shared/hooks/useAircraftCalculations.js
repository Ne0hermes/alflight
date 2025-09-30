// src/shared/hooks/useAircraftCalculations.js
import { useMemo, useCallback } from 'react';
import { useAircraft } from '@core/contexts';

/**
 * Hook optimisé pour tous les calculs liés aux avions
 * Centralise la logique métier et évite la duplication
 */
export const useAircraftCalculations = () => {
  const { selectedAircraft } = useAircraft();
  
  // Calcul du temps de vol mémorisé
  const calculateFlightTime = useCallback((distanceNm, groundSpeedKt = null) => {
    if (!selectedAircraft) return 0;
    const speed = groundSpeedKt || selectedAircraft.cruiseSpeedKt;
    return distanceNm / speed; // en heures
  }, [selectedAircraft]);
  
  // Calcul de la consommation carburant mémorisé
  const calculateFuelConsumption = useCallback((flightTimeHours) => {
    if (!selectedAircraft) return 0;
    return flightTimeHours * selectedAircraft.fuelConsumption;
  }, [selectedAircraft]);
  
  // Calcul de l'autonomie mémorisé
  const calculateEndurance = useCallback((fuelLiters = null) => {
    if (!selectedAircraft) return 0;
    const fuel = fuelLiters || selectedAircraft.fuelCapacity;
    return fuel / selectedAircraft.fuelConsumption;
  }, [selectedAircraft]);
  
  // Calcul de la distance franchissable mémorisé
  const calculateRange = useCallback((fuelLiters = null, groundSpeedKt = null) => {
    if (!selectedAircraft) return 0;
    const endurance = calculateEndurance(fuelLiters);
    const speed = groundSpeedKt || selectedAircraft.cruiseSpeedKt;
    return endurance * speed;
  }, [selectedAircraft, calculateEndurance]);
  
  // Conversions mémorisées
  const conversions = useMemo(() => ({
    kphToKt: (kph) => kph * 0.539957,
    ktToKph: (kt) => kt * 1.852,
    lToGal: (liters) => liters * 0.264172,
    galToL: (gallons) => gallons * 3.78541,
    fuelToWeight: (liters) => {
      if (!selectedAircraft) return 0;
      const density = selectedAircraft.fuelType === 'JET A-1' ? 0.84 : 0.72;
      return liters * density;
    }
  }), [selectedAircraft]);
  
  return {
    selectedAircraft,
    calculateFlightTime,
    calculateFuelConsumption,
    calculateEndurance,
    calculateRange,
    conversions,
    // Valeurs dérivées communes
    maxRange: useMemo(() => calculateRange(), [calculateRange]),
    maxEndurance: useMemo(() => calculateEndurance(), [calculateEndurance])
  };
};