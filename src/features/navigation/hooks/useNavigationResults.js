// src/features/navigation/hooks/useNavigationResults.js
import { useMemo } from 'react';
import { useNavigation, useAircraft } from '@core/contexts';

export const useNavigationResults = () => {
  const { waypoints, flightType } = useNavigation();
  const { selectedAircraft } = useAircraft();
  
  return useMemo(() => {
    if (!selectedAircraft || waypoints.length < 2) return null;
    
    // Calcul de la distance totale
    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const wp1 = waypoints[i];
      const wp2 = waypoints[i + 1];
      
      if (wp1.lat && wp1.lon && wp2.lat && wp2.lon) {
        // Formule de Haversine pour la distance
        const R = 3440.065; // Rayon de la Terre en miles nautiques
        const dLat = (wp2.lat - wp1.lat) * Math.PI / 180;
        const dLon = (wp2.lon - wp1.lon) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(wp1.lat * Math.PI / 180) * Math.cos(wp2.lat * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        totalDistance += distance;
      }
    }
    
    // Calcul du temps de vol
    const cruiseSpeed = selectedAircraft.cruiseSpeedKt || 100;
    const totalTime = Math.round((totalDistance / cruiseSpeed) * 60); // en minutes
    
    // Calcul du carburant nécessaire
    const fuelConsumption = selectedAircraft.fuelConsumption || 30; // L/h
    const fuelRequired = Math.round((totalTime / 60) * fuelConsumption);
    
    // Calcul de la réserve réglementaire
    let regulationReserveMinutes = 30; // Base VFR jour
    
    if (flightType.period === 'nuit') {
      regulationReserveMinutes = 45; // VFR nuit
    }
    
    if (flightType.rules === 'IFR') {
      regulationReserveMinutes += 15; // Supplément IFR
    }
    
    if (flightType.category === 'local' && flightType.period === 'jour') {
      regulationReserveMinutes = 20; // Vol local de jour
    }
    
    const regulationReserveLiters = Math.round((regulationReserveMinutes / 60) * fuelConsumption);
    
    return {
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalTime,
      fuelRequired,
      regulationReserveMinutes,
      regulationReserveLiters
    };
  }, [waypoints, flightType, selectedAircraft]);
};