// src/features/shared-hooks/useNavigationResults.js
import { useMemo } from 'react';
import { useNavigation, useAircraft } from '@core/contexts';

/**
 * Hook pour calculer les résultats de navigation
 */
export const useNavigationResults = () => {
  const { waypoints, flightType } = useNavigation();
  const { selectedAircraft } = useAircraft();
  
  return useMemo(() => {
    // Si pas d'avion ou pas assez de waypoints, pas de résultats
    if (!selectedAircraft || waypoints.length < 2) {
      return null;
    }
    
    // Filtrer les waypoints valides
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    if (validWaypoints.length < 2) {
      return null;
    }
    
    // Calculer la distance totale
    let totalDistance = 0;
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      const distance = calculateDistance(validWaypoints[i], validWaypoints[i + 1]);
      totalDistance += distance;
    }
    
    // Calculer le temps de vol
    const cruiseSpeed = selectedAircraft.cruiseSpeedKt || 100;
    const totalTime = Math.round((totalDistance / cruiseSpeed) * 60); // en minutes
    
    // Calculer la réserve réglementaire
    let regulationReserveMinutes = 30; // Base VFR jour
    
    if (flightType.period === 'nuit') {
      regulationReserveMinutes = 45; // VFR nuit
    }
    
    if (flightType.rules === 'IFR') {
      regulationReserveMinutes += 15; // +15 min pour IFR
    }
    
    if (flightType.category === 'local') {
      // Pas de changement supplémentaire pour vol local
    }
    
    // Calculer le carburant
    const fuelConsumption = selectedAircraft.fuelConsumption || 30; // L/h
    const flightFuelLiters = (totalTime / 60) * fuelConsumption;
    const regulationReserveLiters = (regulationReserveMinutes / 60) * fuelConsumption;
    const fuelRequired = Math.ceil(flightFuelLiters + regulationReserveLiters);
    
    return {
      totalDistance: Math.round(totalDistance),
      totalTime,
      flightFuelLiters: Math.round(flightFuelLiters),
      regulationReserveMinutes,
      regulationReserveLiters: Math.round(regulationReserveLiters),
      fuelRequired,
      segments: validWaypoints.slice(0, -1).map((wp, i) => ({
        from: wp,
        to: validWaypoints[i + 1],
        distance: calculateDistance(wp, validWaypoints[i + 1]),
        time: calculateDistance(wp, validWaypoints[i + 1]) / cruiseSpeed * 60

    };
  }, [waypoints, selectedAircraft, flightType]);
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