// src/features/navigation/utils/effectiveSpeed.js
// 🔧 C2 (Lot 0.4) — Vitesse SOL moyenne corrigée du vent pour une route, en un
// appel : combine l'utilitaire PUR routeWindTimes et le store des vents en
// altitude (priorité manuel > Open-Meteo > null, via getWindAt).
// À passer en `effectiveSpeedKt` à computeLegFuelPlans & co. — repli TAS géré
// par le consommateur (null si pas de vent en cache : comportement d'avant).

import { computeRouteWindTimes } from '@utils/routeWindTimes';
import { useWindsAloftStore } from '@core/stores/windsAloftStore';

// Altitude d'échantillonnage par défaut (alignée sur plannedAltitude défaut).
const DEFAULT_WIND_ALT_FT = 3000;

/**
 * @param {Array} waypoints
 * @param {number|null} cruiseSpeedKt TAS (kt)
 * @returns {number|null} vitesse sol moyenne pondérée (kt), ou null si
 *   waypoints/TAS insuffisants OU aucun vent en cache (le consommateur
 *   retombe alors sur la TAS — jamais de valeur inventée ici).
 */
export function getRouteEffectiveSpeedKt(waypoints, cruiseSpeedKt) {
  const r = computeRouteWindTimes({
    waypoints,
    cruiseSpeedKt,
    windProvider: (lat, lon) =>
      useWindsAloftStore.getState().getWindAt(lat, lon, DEFAULT_WIND_ALT_FT, new Date())
  });
  if (!r || r.windCorrected === 'none') return null;
  return Math.round(r.effectiveSpeedKt * 10) / 10;
}
