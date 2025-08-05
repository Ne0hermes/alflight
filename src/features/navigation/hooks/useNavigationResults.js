// src/features/navigation/hooks/useNavigationResults.js
import { useMemo } from 'react';

export const useNavigationResults = (waypoints, flightType, selectedAircraft) => {
  return useMemo(() => {
    console.log('🔄 useNavigationResults called with:', {
      waypoints: waypoints?.length,
      flightType,
      aircraft: selectedAircraft?.registration
    });
    
    if (!selectedAircraft || !waypoints || waypoints.length < 2) {
      console.log('🚫 NavigationResults: Missing data');
      return null;
    }
    
    // Filtrer les waypoints valides (avec coordonnées)
    const validWaypoints = waypoints.filter(wp => wp.lat && wp.lon);
    
    if (validWaypoints.length < 2) {
      console.log('🚫 NavigationResults: Not enough valid waypoints');
      return null;
    }
    
    console.log('📊 NavigationResults: Calculating with', {
      validWaypoints: validWaypoints.length,
      aircraft: selectedAircraft.registration,
      cruiseSpeed: selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed,
      fuelConsumption: selectedAircraft.fuelConsumption
    });
    
    // Calcul de la distance totale
    let totalDistance = 0;
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      const wp1 = validWaypoints[i];
      const wp2 = validWaypoints[i + 1];
      
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
      console.log(`📏 Leg ${i+1}: ${wp1.name || 'WP'} → ${wp2.name || 'WP'} = ${distance.toFixed(1)} NM`);
    }
    
    // Calcul du temps de vol
    const cruiseSpeed = selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 100;
    const totalTime = totalDistance > 0 ? Math.round((totalDistance / cruiseSpeed) * 60) : 0; // en minutes
    
    // Calcul du carburant nécessaire
    const fuelConsumption = selectedAircraft.fuelConsumption || 30; // L/h
    const fuelRequired = totalTime > 0 ? (totalTime / 60) * fuelConsumption : 0;
    
    console.log('📊 NavigationResults: Calculations', {
      totalDistance: totalDistance.toFixed(1),
      cruiseSpeed,
      totalTime,
      fuelConsumption,
      fuelRequired: fuelRequired.toFixed(1)
    });
    
    // Calcul de la réserve réglementaire
    let regulationReserveMinutes = 30; // Base VFR jour
    
    if (flightType?.period === 'nuit') {
      regulationReserveMinutes = 45; // VFR nuit
    }
    
    if (flightType?.rules === 'IFR') {
      regulationReserveMinutes += 15; // Supplément IFR
    }
    
    if (flightType?.category === 'local' && flightType?.period === 'jour') {
      regulationReserveMinutes = 20; // Vol local de jour
    }
    
    const regulationReserveLiters = (regulationReserveMinutes / 60) * fuelConsumption;
    
    const result = {
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalTime,
      fuelRequired: Math.round(fuelRequired * 10) / 10, // Arrondir à 0.1L près
      regulationReserveMinutes,
      regulationReserveLiters: Math.round(regulationReserveLiters * 10) / 10
    };
    
    console.log('📊 NavigationResults: Final result', result);
    
    return result;
  }, [waypoints, flightType, selectedAircraft]);
};