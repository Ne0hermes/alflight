// src/features/navigation/utils/effectiveSpeed.js
//
// 🔧 C2 — vitesse sol moyenne de la route, corrigée du vent, pour la chaîne
// carburant par tronçon (computeLegFuelPlans). null si aucune correction de
// vent n'est possible (le repli TAS vit dans legFuelPlan, pas ici).
//
// ⛔ Lot 1.0 (tranche 3, 25/08/2026) : le vent était lu à 3000 ft EN DUR quelle
// que soit l'altitude du vol — le carburant se calculait sur un autre vent que
// celui affiché au tableau de navigation. Le provider partagé (windSampling)
// échantillonne désormais à l'altitude saisie PAR TRONÇON, sinon l'altitude
// globale du vol.
import { computeRouteWindTimes } from '@utils/routeWindTimes';
import { useNavigationStore } from '@core/stores/navigationStore';
import { makeRouteWindProvider } from './windSampling';

export function getRouteEffectiveSpeedKt(waypoints, cruiseSpeedKt) {
  const { segmentAltitudes, flightParams } = useNavigationStore.getState();
  const r = computeRouteWindTimes({
    waypoints,
    cruiseSpeedKt,
    windProvider: makeRouteWindProvider({
      segmentAltitudes,
      defaultAltFt: flightParams?.altitude
    })
  });
  if (!r || r.windCorrected === 'none') return null;
  return Math.round(r.effectiveSpeedKt * 10) / 10;
}
