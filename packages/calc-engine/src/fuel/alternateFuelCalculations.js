// src/features/alternates/utils/alternateFuelCalculations.js
// Carburant de dégagement — algorithme validé (Lot 2, 2026-08) :
// 1. Pied de la perpendiculaire abaissée du déroutement sur la ROUTE RÉELLE
//    (polyligne complète de tous les waypoints, segment par segment — pas
//    seulement la droite départ→arrivée).
// 2. A = carburant du pied jusqu'à l'ARRIVÉE (le long de la route restante).
// 3. B = carburant du pied jusqu'au DÉROUTEMENT (direct).
// 4. Supplément = B − A si positif ; sinon le carburant restant au passage de
//    la perpendiculaire suffit pour rejoindre le déroutement.
// La réserve finale réglementaire est EXCLUE de la comparaison (elle reste un
// poste séparé du bilan : finalReserve).
import {
  calculateDistance,
  calculateBearing,
  calculateDestination,
  // Rayon canonique : la copie locale a été supprimée (duplication relevée
  // à la cartographie — un même nombre défini à deux endroits finit toujours
  // par diverger).
  EARTH_RADIUS_NM
} from '../nav/navigationCalculations.js';
import { getCruiseSpeedKt, getFuelConsumptionLph } from '../perf/aircraftPerf.js';

const toRad = (d) => d * Math.PI / 180;

// Position d'un déroutement, tolérante aux formats rencontrés dans l'app
// (store: position ; flightPlan: coordinates ; brut: lat/lon|lng).
// Chaque candidat est validé par CONTENU : un objet position présent mais
// invalide (lat/lon null) ne masque pas un coordinates valide.
export const resolveAlternatePosition = (alt) => {
  const candidates = [
    alt?.position,
    alt?.coordinates,
    { lat: alt?.lat, lon: alt?.lon ?? alt?.lng }
  ];
  for (const pos of candidates) {
    const lat = parseFloat(pos?.lat);
    const lon = parseFloat(pos?.lon ?? pos?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  return null;
};

/**
 * Projette un point sur UN segment orthodromique : pied de perpendiculaire
 * clampé aux extrémités du segment.
 * Corrige le défaut historique de calculateDistanceToSegment : l'along-track
 * issu de Math.acos n'est jamais négatif — le signe (pied en amont du début)
 * vient de cos(cap vers le point − cap du segment) < 0.
 */
export function projectPointOnSegment(point, start, end) {
  const segLenNM = calculateDistance(start, end);
  if (!Number.isFinite(segLenNM) || segLenNM < 0.05) {
    return {
      alongTrackNM: 0,
      footPoint: { lat: start.lat, lon: start.lon },
      distToFootNM: calculateDistance(point, start),
      segLenNM: segLenNM || 0
    };
  }
  const d13 = calculateDistance(start, point) / EARTH_RADIUS_NM; // distance angulaire
  const brg13 = toRad(calculateBearing(start, point));
  const brg12 = toRad(calculateBearing(start, end));
  const crossTrack = Math.asin(Math.sin(d13) * Math.sin(brg13 - brg12));
  let alongTrack = Math.acos(Math.min(1, Math.max(-1, Math.cos(d13) / Math.cos(crossTrack)))) * EARTH_RADIUS_NM;
  if (Math.cos(brg13 - brg12) < 0) alongTrack = -alongTrack;
  const alongTrackNM = Math.max(0, Math.min(segLenNM, alongTrack));
  const footPoint = alongTrackNM === 0
    ? { lat: start.lat, lon: start.lon }
    : alongTrackNM >= segLenNM
      ? { lat: end.lat, lon: end.lon }
      : calculateDestination(start, alongTrackNM, calculateBearing(start, end));
  return {
    alongTrackNM,
    footPoint,
    distToFootNM: calculateDistance(point, footPoint),
    segLenNM
  };
}

/**
 * Pied de perpendiculaire sur la POLYLIGNE complète : projette le déroutement
 * sur chaque segment de la route et retient le pied le plus PÉNALISANT —
 * celui qui maximise la marge (distance pied→déroutement − distance
 * pied→arrivée). Sur une route simple, c'est le pied du travers classique ;
 * si la route repasse plusieurs fois près du déroutement, prendre le pied le
 * plus PROCHE sous-estimerait le supplément (contre-exemple vérifié : route
 * en U où le pied le plus proche donne « suffisant » alors qu'un pied
 * ultérieur exige +10 L).
 * @returns null si moins de 2 waypoints valides ou position absente
 */
export function findPerpendicularFootOnRoute(alternatePos, waypoints) {
  const pts = (waypoints || [])
    .map(wp => ({ lat: parseFloat(wp?.lat), lon: parseFloat(wp?.lon ?? wp?.lng) }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (!alternatePos || pts.length < 2) return null;

  const segLens = [];
  for (let i = 0; i < pts.length - 1; i++) {
    segLens.push(calculateDistance(pts[i], pts[i + 1]));
  }
  // suffixe[i] = distance de la FIN du segment i jusqu'à l'arrivée
  const suffix = new Array(segLens.length).fill(0);
  for (let i = segLens.length - 2; i >= 0; i--) {
    suffix[i] = suffix[i + 1] + segLens[i + 1];
  }

  let best = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const proj = projectPointOnSegment(alternatePos, pts[i], pts[i + 1]);
    const distToArrivalNM = Math.max(0, proj.segLenNM - proj.alongTrackNM) + suffix[i];
    const marginNM = proj.distToFootNM - distToArrivalNM;
    if (!best || marginNM > best.marginNM) {
      best = { proj, segmentIndex: i, distToArrivalNM, marginNM };
    }
  }
  if (!best) return null;

  let distFromDepartureNM = best.proj.alongTrackNM;
  for (let i = 0; i < best.segmentIndex; i++) distFromDepartureNM += segLens[i];

  return {
    footPoint: best.proj.footPoint,
    segmentIndex: best.segmentIndex,
    distToArrivalNM: best.distToArrivalNM,
    distFromDepartureNM,
    distFootToAlternateNM: best.proj.distToFootNM,
    totalRouteNM: segLens.reduce((s, l) => s + l, 0)
  };
}

/**
 * Algorithme validé complet pour UN déroutement.
 * @returns objet à champ status : 'ok' | 'missing-position' | 'missing-route'
 *          | 'missing-aircraft-data' — jamais un 0 silencieux.
 */
export function computeDiversionFuel({ alternate, waypoints, aircraft }) {
  const position = resolveAlternatePosition(alternate);
  if (!position) return { status: 'missing-position', icao: alternate?.icao, name: alternate?.name };

  const cruiseSpeedKt = getCruiseSpeedKt(aircraft);
  const consumptionLph = getFuelConsumptionLph(aircraft);
  if (!cruiseSpeedKt || !consumptionLph) {
    return { status: 'missing-aircraft-data', icao: alternate?.icao, name: alternate?.name };
  }

  const foot = findPerpendicularFootOnRoute(position, waypoints);
  if (!foot) return { status: 'missing-route', icao: alternate?.icao, name: alternate?.name };

  const fuelToArrivalLtr = (foot.distToArrivalNM / cruiseSpeedKt) * consumptionLph;         // A
  const fuelToAlternateLtr = (foot.distFootToAlternateNM / cruiseSpeedKt) * consumptionLph; // B
  const rawSupplementLtr = fuelToAlternateLtr - fuelToArrivalLtr;                           // B − A

  return {
    status: 'ok',
    icao: alternate?.icao,
    name: alternate?.name,
    footPoint: foot.footPoint,
    segmentIndex: foot.segmentIndex,
    distToArrivalNM: foot.distToArrivalNM,
    distFootToAlternateNM: foot.distFootToAlternateNM,
    fuelToArrivalLtr,       // A : pied de perpendiculaire → arrivée
    fuelToAlternateLtr,     // B : pied de perpendiculaire → déroutement
    isSufficient: rawSupplementLtr <= 0,
    supplementLtr: rawSupplementLtr > 0 ? Math.ceil(rawSupplementLtr) : 0
  };
}

/**
 * Pire cas parmi plusieurs déroutements : le supplément retenu au bilan est le
 * MAX des suppléments (0 si tous suffisants). `worst` est le déroutement le
 * plus pénalisant (à afficher), `errors` les déroutements non calculables.
 */
export function computeWorstDiversion({ alternates, waypoints, aircraft }) {
  const results = (alternates || []).map(alt =>
    computeDiversionFuel({ alternate: alt, waypoints, aircraft })
  );
  const ok = results.filter(r => r.status === 'ok');
  const errors = results.filter(r => r.status !== 'ok');

  let worst = null;
  for (const r of ok) {
    const margin = r.fuelToAlternateLtr - r.fuelToArrivalLtr;
    const worstMargin = worst ? worst.fuelToAlternateLtr - worst.fuelToArrivalLtr : -Infinity;
    if (margin > worstMargin) worst = r;
  }

  return {
    results,
    worst,
    errors,
    supplementLtr: worst?.supplementLtr ?? 0,
    isSufficient: !!worst && worst.isSufficient,
    hasComputable: ok.length > 0
  };
}
