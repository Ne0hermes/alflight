// src/utils/routeWindTimes.js
//
// 🔧 C2 (Lot 0.4) — SOURCE UNIQUE du temps de vol CORRIGÉ DU VENT.
//
// Problème refermé : le tableau de navigation corrigeait les temps du vent
// (triangle des vents) alors que TOUTE la chaîne carburant calculait en
// distance/TAS. Avec vent de face, le temps réel (donc le carburant réel)
// était sous-estimé — divergence dangereuse entre l'ETE affiché et le bilan.
//
// Ce module est PUR (aucun store importé) : le vent est fourni par un
// `windProvider(lat, lon)` injectable — typiquement
//   (lat, lon) => useWindsAloftStore.getState().getWindAt(lat, lon, altFt, when)
// qui applique déjà la priorité manuel > Open-Meteo > null.
//
// RÈGLES DE SÛRETÉ :
//  - Segment sans donnée de vent → temps à la TAS, et le résultat global est
//    marqué windCorrected: 'partial' ou 'none' ET compté (noWindSegments) —
//    l'interface doit pouvoir dire « vent inconnu sur N tronçons », pas
//    seulement « partiel » (Lot 1.0 : rien d'inventé, rien de silencieux).
//  - Vent ≥ TAS (segment intenable) → temps à la TAS + compteur untenable
//    (on n'invente pas une vitesse sol ; le pilote doit revoir son vol).
//  - cruiseSpeedKt absent → null (fail-closed, comme aircraftPerf).

import { calculateDistance, calculateBearing, calculateMidpoint } from './navigationCalculations.js';
import { solveWindTriangle } from './windTriangle.js';

const validWp = (wp) => wp && typeof wp.lat === 'number' && typeof wp.lon === 'number';

/**
 * Temps de route corrigés du vent, segment par segment.
 *
 * @param {object} p
 * @param {Array}  p.waypoints        - route (lat/lon requis)
 * @param {number} p.cruiseSpeedKt    - TAS de croisière (kt) — null ⇒ retour null
 * @param {function} [p.windProvider] - (lat, lon) => {directionDeg, speedKt, source}|null
 * @returns {null | {
 *   totalDistanceNM: number,
 *   totalTimeMin: number,            // corrigé du vent partout où c'est possible
 *   effectiveSpeedKt: number,        // vitesse sol moyenne pondérée par la distance
 *   windCorrected: 'full'|'partial'|'none',
 *   windSegments: number,            // tronçons réellement corrigés du vent
 *   noWindSegments: number,          // tronçons SANS donnée de vent (temps à la TAS)
 *   untenableSegments: number,
 *   segmentCount: number,
 *   segments: Array<{distanceNM, trueCourse, gsKt, timeMin, windSource}>
 * }}
 */
export function computeRouteWindTimes({ waypoints, cruiseSpeedKt, windProvider }) {
  const pts = (waypoints || []).filter(validWp);
  if (pts.length < 2) return null;
  const tas = Number(cruiseSpeedKt);
  if (!Number.isFinite(tas) || tas <= 0) return null;

  const segments = [];
  let totalDistanceNM = 0;
  let totalTimeMin = 0;
  let windSegments = 0;
  let untenableSegments = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const distanceNM = calculateDistance({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });
    if (!(distanceNM > 0)) continue;
    const trueCourse = calculateBearing({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });

    let gsKt = tas;
    let windSource = 'none';
    if (typeof windProvider === 'function') {
      const mid = calculateMidpoint({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });
      const wind = windProvider(mid.lat, mid.lon);
      if (wind && wind.speedKt > 0) {
        const tri = solveWindTriangle(trueCourse, tas, wind.directionDeg, wind.speedKt);
        if (tri) {
          gsKt = tri.groundSpeed;
          windSource = wind.source || 'wind';
          windSegments++;
        } else {
          // Vent ≥ TAS : intenable — temps TAS (plancher), signalé, jamais inventé
          untenableSegments++;
          windSource = 'untenable';
        }
      } else if (wind) {
        // Vent connu et nul : c'est une correction valide (GS = TAS)
        windSource = wind.source || 'calm';
        windSegments++;
      }
    }

    const timeMin = (distanceNM / gsKt) * 60;
    totalDistanceNM += distanceNM;
    totalTimeMin += timeMin;
    segments.push({ distanceNM, trueCourse, gsKt, timeMin, windSource });
  }

  if (segments.length === 0) return null;

  const windCorrected =
    windSegments === segments.length ? 'full' : windSegments > 0 ? 'partial' : 'none';

  return {
    totalDistanceNM,
    totalTimeMin,
    // Vitesse sol moyenne pondérée distance : LE chiffre à passer aux calculs
    // carburant par tronçon (legFuelPlan, planificateur d'escales…).
    effectiveSpeedKt: totalDistanceNM / (totalTimeMin / 60),
    windCorrected,
    windSegments,
    // Tronçons sans AUCUNE donnée de vent (provider muet ou absent) : leur
    // temps est celui de l'air immobile — l'UI doit le dire, pas le taire.
    noWindSegments: segments.length - windSegments - untenableSegments,
    untenableSegments,
    segmentCount: segments.length,
    segments
  };
}
