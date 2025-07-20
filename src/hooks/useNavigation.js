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
    // reserve supprimé !
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

  // Calculs mémorisés (sans réserve)
  const navigationResults = useMemo(() => {
    if (!selectedAircraft) return { totalDistance: 0, totalTime: 0, fuelRequired: 0 };

    const totalDistance = NavigationCalculations.calculateTotalDistance(waypoints);
    const totalTime = NavigationCalculations.calculateFlightTime(totalDistance, flightParams.trueAirspeed);
    const fuelRequired = NavigationCalculations.calculateFuelRequired(totalTime, selectedAircraft.fuelConsumption);

    return {
      totalDistance: Math.round(totalDistance),
      totalTime: totalTime * 60,
      fuelRequired: Math.round(fuelRequired)
      // fuelWithReserve supprimé !
    };
  }, [waypoints, flightParams, selectedAircraft]);

  return {
    waypoints,
    setWaypoints,
    flightParams,
    setFlightParams,
    navigationResults
  };
};