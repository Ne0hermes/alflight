// src/hooks/useNavigationResults.js
import { useMemo } from 'react';
import { useNavigation, useAircraft } from '@core/contexts';

export const useNavigationResults = () => {
  const { selectedAircraft } = useAircraft();
  const { waypoints, flightType } = useNavigation();
  const { 
    calculateTotalDistance, 
    calculateFlightTime, 
    calculateFuelRequired,
    getRegulationReserveMinutes,
    getRegulationReserveLiters
  } = useNavigation();
  
  return useMemo(() => {
    if (!selectedAircraft || !waypoints.length) return null;
    
    const totalDistance = calculateTotalDistance();
    const totalTime = calculateFlightTime(selectedAircraft.cruiseSpeedKt);
    const fuelRequired = calculateFuelRequired(selectedAircraft.fuelConsumption);
    const regulationReserveMinutes = getRegulationReserveMinutes();
    const regulationReserveLiters = getRegulationReserveLiters(selectedAircraft.fuelConsumption);
    
    return {
      totalDistance: parseFloat(totalDistance.toFixed(1)),
      totalTime: Math.round(totalTime * 60), // Conversion en minutes
      fuelRequired: parseFloat(fuelRequired.toFixed(1)),
      regulationReserveMinutes: regulationReserveMinutes,
      regulationReserveLiters: parseFloat(regulationReserveLiters.toFixed(1))
    };
  }, [
    selectedAircraft, 
    waypoints, 
    flightType,
    calculateTotalDistance,
    calculateFlightTime,
    calculateFuelRequired,
    getRegulationReserveMinutes,
    getRegulationReserveLiters
  ]);
};