// src/features/navigation/hooks/useNavigationResults.js
import { useMemo } from 'react';
import { getCruiseSpeedKt, getFuelConsumptionLph } from '@utils/aircraftPerf';
import { computeRegulatoryReserveMinutes } from '@core/flightType';

export const useNavigationResults = (waypoints, flightType, selectedAircraft) => {
  return useMemo(() => {
        
    if (!selectedAircraft || !waypoints || waypoints.length < 2) {
            return null;
    }
    
    // Filtrer les waypoints valides (avec coordonnées)
    const validWaypoints = waypoints.filter(wp => wp.lat && wp.lon);
    
    if (validWaypoints.length < 2) {
            return null;
    }
    
        
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
    }
    
    // Calcul du temps de vol
    // 🔧 A6/P0 — Vitesse/conso depuis la source unique (null si non renseigné),
    // plus de 100/30 fabriqués. Sans donnée ⇒ on ne calcule pas (0), pas d'invention.
    const cruiseSpeed = getCruiseSpeedKt(selectedAircraft);
    const totalTime = (totalDistance > 0 && cruiseSpeed) ? Math.round((totalDistance / cruiseSpeed) * 60) : 0; // min
    const fuelConsumption = getFuelConsumptionLph(selectedAircraft);
    const fuelRequired = (totalTime > 0 && fuelConsumption) ? (totalTime / 60) * fuelConsumption : 0;

    // 🔒 SSOT : réserve réglementaire via le calculateur canonique unique
    // (@core/flightType). Plus de règle 30/45/+15 dupliquée (conformité NCO.OP.125).
    const regulationReserveMinutes = computeRegulatoryReserveMinutes(flightType);

    const regulationReserveLiters = fuelConsumption ? (regulationReserveMinutes / 60) * fuelConsumption : 0;
    
    const result = {
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalTime,
      fuelRequired: Math.round(fuelRequired * 10) / 10, // Arrondir à 0.1L près
      regulationReserveMinutes,
      regulationReserveLiters: Math.round(regulationReserveLiters * 10) / 10
    };
    
        
    return result;
  }, [waypoints, flightType, selectedAircraft]);
};