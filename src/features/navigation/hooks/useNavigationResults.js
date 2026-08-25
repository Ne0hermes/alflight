// src/features/navigation/hooks/useNavigationResults.js
import { useMemo } from 'react';
import { getCruiseSpeedKt, getFuelConsumptionLph } from '@utils/aircraftPerf';
import { computeRegulatoryReserveMinutes } from '@core/flightType';
import { computeRouteWindTimes } from '@utils/routeWindTimes';
import { useWindsAloftStore } from '@core/stores/windsAloftStore';
import { useNavigationStore } from '@core/stores/navigationStore';
// ⛔ Lot 1.0 (tranche 3) : provider de vent partagé — altitude du TRONÇON
// saisie au tableau de nav, plus jamais 3000 ft en dur.
import { makeRouteWindProvider } from '../utils/windSampling';

export const useNavigationResults = (waypoints, flightType, selectedAircraft) => {
  // 🔧 C2 : abonnement au store des vents — les résultats (temps, carburant)
  // se recalculent quand les vents en altitude arrivent ou que le vent manuel
  // change. La priorité manuel > Open-Meteo > null est gérée par getWindAt.
  const windsProfiles = useWindsAloftStore((s) => s.profiles);
  const manualWind = useWindsAloftStore((s) => s.manualWind);
  // Altitudes réelles du vol (par tronçon + globale) — le vent suit la saisie.
  const segmentAltitudes = useNavigationStore((s) => s.segmentAltitudes);
  const flightAltFt = useNavigationStore((s) => s.flightParams?.altitude);

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
      windProvider: makeRouteWindProvider({ segmentAltitudes, defaultAltFt: flightAltFt })
    });

    const totalDistance = windTimes ? windTimes.totalDistanceNM : 0;
    const totalTime = windTimes ? Math.round(windTimes.totalTimeMin) : 0; // min
    const fuelConsumption = getFuelConsumptionLph(selectedAircraft);
    const fuelRequired = (totalTime > 0 && fuelConsumption) ? (totalTime / 60) * fuelConsumption : 0;

    // 🔒 SSOT : réserve réglementaire via le calculateur canonique unique
    // (@core/flightType). Plus de règle 30/45/+15 dupliquée (conformité NCO.OP.125).
    // ⛔ Lot 1.0 (tranche 3) : un flightType de MAUVAISE FORME (la chaîne 'VFR'
    // au lieu de l'objet canonique {period, rules, category}) était avalé par
    // les `?.` — réserve figée à 30 min y compris de nuit et en IFR. Bruyant
    // et fail-closed : réserve nulle, pas un plancher silencieux.
    const flightTypeValid = flightType != null && typeof flightType === 'object';
    if (flightType != null && !flightTypeValid) {
      console.error('[useNavigationResults] flightType invalide (attendu : objet {period, rules, category}, reçu :', flightType, ') — réserve réglementaire non calculée. Passez le type canonique du navigationStore.');
    }
    const regulationReserveMinutes = flightTypeValid ? computeRegulatoryReserveMinutes(flightType) : null;

    const regulationReserveLiters = (fuelConsumption && regulationReserveMinutes != null) ? (regulationReserveMinutes / 60) * fuelConsumption : null;
    
    const result = {
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalTime,
      fuelRequired: Math.round(fuelRequired * 10) / 10, // Arrondir à 0.1L près
      regulationReserveMinutes,
      // null préservé (Math.round(null)→0 maquillerait l'absence)
      regulationReserveLiters: regulationReserveLiters != null ? Math.round(regulationReserveLiters * 10) / 10 : null,
      // 🔧 C2 : vitesse sol moyenne pondérée (pour la chaîne carburant par
      // tronçon) + statut de correction ('full'|'partial'|'none') + segments
      // intenables (vent ≥ TAS) pour affichage.
      effectiveSpeedKt: windTimes ? Math.round(windTimes.effectiveSpeedKt * 10) / 10 : null,
      windCorrected: windTimes ? windTimes.windCorrected : 'none',
      untenableSegments: windTimes ? windTimes.untenableSegments : 0,
      // Lot 1.0 — tronçons SANS donnée de vent (temps air immobile), à afficher
      noWindSegments: windTimes ? windTimes.noWindSegments : 0,
      segmentCount: windTimes ? windTimes.segmentCount : 0
    };


    return result;
  }, [waypoints, flightType, selectedAircraft, windsProfiles, manualWind, segmentAltitudes, flightAltFt]);
};