import { useState, useEffect, useMemo } from 'react';
import { NavigationCalculations } from '../utils/calculations';

export const useNavigation = (selectedAircraft) => {
  const [waypoints, setWaypoints] = useState([
    { id: 1, name: 'LFPN', type: 'departure', lat: 48.9833, lon: 2.5333 },
    { id: 2, name: 'LFPT', type: 'arrival', lat: 48.7333, lon: 2.3833 }
  ]);

  const [flightParams, setFlightParams] = useState({
    altitude: 3000,
    trueAirspeed: 150,
    windDirection: 270,
    windSpeed: 15
  });

  // Ajout de l'état flightType
  const [flightType, setFlightType] = useState({
    period: 'jour',      // jour / nuit
    rules: 'VFR',        // VFR / IFR
    category: 'navigation' // local / navigation
  });

  // Synchroniser la vitesse avec l'avion sélectionné
  useEffect(() => {
    if (selectedAircraft) {
      setFlightParams(prev => ({
        ...prev,
        trueAirspeed: selectedAircraft.cruiseSpeedKt
      }));
    }
  }, [selectedAircraft]);

  // Calcul de la réserve réglementaire en minutes
  const getRegulationReserveMinutes = () => {
    // Pour IFR, on ajoute toujours 15 minutes supplémentaires
    const ifrAdditional = flightType.rules === 'IFR' ? 15 : 0;
    
    if (flightType.period === 'nuit') {
      return 45 + ifrAdditional; // NIGHT = 45 minutes (+ 15 si IFR)
    } else if (flightType.category === 'local') {
      return 10 + ifrAdditional; // DAY + LOCAL = 10 minutes (+ 15 si IFR)
    } else {
      return 30 + ifrAdditional; // DAY + NAVIGATION = 30 minutes (+ 15 si IFR)
    }
  };

  // Calculs mémorisés avec réserve adaptée au type de vol
  const navigationResults = useMemo(() => {
    if (!selectedAircraft) return { 
      totalDistance: 0, 
      totalTime: 0, 
      fuelRequired: 0, 
      fuelWithReserve: 0,
      regulationReserveMinutes: 0,
      regulationReserveLiters: 0
    };

    const totalDistance = NavigationCalculations.calculateTotalDistance(waypoints);
    const totalTime = NavigationCalculations.calculateFlightTime(totalDistance, flightParams.trueAirspeed);
    const fuelRequired = NavigationCalculations.calculateFuelRequired(totalTime, selectedAircraft.fuelConsumption);

    // Calcul de la réserve réglementaire
    const regulationReserveMinutes = getRegulationReserveMinutes();
    const regulationReserveLiters = (regulationReserveMinutes / 60) * selectedAircraft.fuelConsumption;
    
    // Calcul total avec réserve
    const fuelWithReserve = fuelRequired + regulationReserveLiters;

    return {
      totalDistance: Math.round(totalDistance),
      totalTime: totalTime * 60,
      fuelRequired: Math.round(fuelRequired),
      fuelWithReserve: Math.round(fuelWithReserve),
      regulationReserveMinutes,
      regulationReserveLiters: Math.round(regulationReserveLiters)
    };
  }, [waypoints, flightParams, selectedAircraft, flightType]);

  return {
    waypoints,
    setWaypoints,
    flightParams,
    setFlightParams,
    navigationResults,
    flightType,
    setFlightType
  };
};