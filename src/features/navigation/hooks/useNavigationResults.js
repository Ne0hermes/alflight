// src/features/navigation/hooks/useNavigationResults.js
import { useMemo } from 'react';
import { getCruiseSpeedKt, getFuelConsumptionLph } from '@utils/aircraftPerf';
import { computeRegulatoryReserveMinutes } from '@core/flightType';
import { computeRouteWindTimes } from '@utils/routeWindTimes';
import { useWindsAloftStore } from '@core/stores/windsAloftStore';

// Altitude par défaut pour l'échantillonnage du vent quand l'altitude de
// croisière n'est pas transmise (aligné sur plannedAltitude par défaut).
const DEFAULT_WIND_ALT_FT = 3000;

export const useNavigationResults = (waypoints, flightType, selectedAircraft) => {
  // 🔧 C2 : abonnement au store des vents — les résultats (temps, carburant)
  // se recalculent quand les vents en altitude arrivent ou que le vent manuel
  // change. La priorité manuel > Open-Meteo > null est gérée par getWindAt.
  const windsProfiles = useWindsAloftStore((s) => s.profiles);
  const manualWind = useWindsAloftStore((s) => s.manualWind);

  return useMemo(() => {

    if (!selectedAircraft || !waypoints || waypoints.length < 2) {
            return null;
    }

    // Filtrer les waypoints valides (avec coordonnées)
    const validWaypoints = waypoints.filter(wp => wp.lat && wp.lon);

    if (validWaypoints.length < 2) {
            return null;
    }

    // 🔧 C2 (Lot 0.4) — SOURCE UNIQUE des distances ET des temps, CORRIGÉS DU
    // VENT (routeWindTimes + triangle des vents). Auparavant : Haversine local
    // + temps = distance/TAS, alors que le tableau de nav affichait des temps
    // corrigés → le carburant était sous-estimé par vent de face.
    const cruiseSpeed = getCruiseSpeedKt(selectedAircraft);
    const windTimes = computeRouteWindTimes({
      waypoints: validWaypoints,
      cruiseSpeedKt: cruiseSpeed,
      windProvider: (lat, lon) =>
        useWindsAloftStore.getState().getWindAt(lat, lon, DEFAULT_WIND_ALT_FT, new Date())
    });

    const totalDistance = windTimes ? windTimes.totalDistanceNM : 0;
    const totalTime = windTimes ? Math.round(windTimes.totalTimeMin) : 0; // min
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
      regulationReserveLiters: Math.round(regulationReserveLiters * 10) / 10,
      // 🔧 C2 : vitesse sol moyenne pondérée (pour la chaîne carburant par
      // tronçon) + statut de correction ('full'|'partial'|'none') + segments
      // intenables (vent ≥ TAS) pour affichage.
      effectiveSpeedKt: windTimes ? Math.round(windTimes.effectiveSpeedKt * 10) / 10 : null,
      windCorrected: windTimes ? windTimes.windCorrected : 'none',
      untenableSegments: windTimes ? windTimes.untenableSegments : 0
    };


    return result;
  }, [waypoints, flightType, selectedAircraft, windsProfiles, manualWind]);
};