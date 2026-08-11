// src/features/navigation/utils/fuelStopPlanner.js
// 🔧 LOT 8 — Escale carburant (crans 1+2 validés par César).
//
// Cran 1 : détecter, dès la création de la navigation, que le trajet demande
// plus de carburant que l'avion ne peut en embarquer (trip + réserve finale
// réglementaire > capacité totale). Le calcul se fait PAR TRONÇON : une escale
// marquée `fuelStop` (avitaillement complet) remet les réservoirs à plein,
// donc chaque tronçon doit tenir INDIVIDUELLEMENT dans la capacité.
//
// Cran 2 : proposer des aérodromes d'escale AVEC avitaillement, proches de la
// route (corridor) et dans la fenêtre utile du tronçon en défaut, prêts à être
// insérés comme waypoint.
//
// Règle A5 : sans vitesse/conso/capacité renseignées → status 'no-data', on
// n'alerte ni ne rassure avec des chiffres inventés.
import { calculateDistance } from '@utils/navigationCalculations';
import { projectPointOnSegment } from '@features/alternates/utils/alternateFuelCalculations';

const isValidWp = (wp) => Number.isFinite(wp?.lat) && Number.isFinite(wp?.lon);

/**
 * Découpe la route en tronçons aux waypoints-escale (fuelStop === true).
 * @returns {Array<{ waypoints: Array, startIndex: number }>} tronçons dans
 * l'ordre, avec l'index GLOBAL (dans validWaypoints) de leur premier waypoint.
 */
export function splitLegsAtFuelStops(validWaypoints) {
  const legs = [];
  let current = [];
  let startIndex = 0;
  validWaypoints.forEach((wp, i) => {
    current.push(wp);
    if (wp.fuelStop === true && i > 0 && i < validWaypoints.length - 1) {
      legs.push({ waypoints: current, startIndex });
      current = [wp];
      startIndex = i;
    }
  });
  if (current.length >= 2) legs.push({ waypoints: current, startIndex });
  return legs;
}

const legDistanceNM = (wps) => {
  let d = 0;
  for (let i = 0; i < wps.length - 1; i++) {
    d += calculateDistance(wps[i], wps[i + 1]);
  }
  return d;
};

/**
 * Analyse l'autonomie du trajet, tronçon par tronçon.
 * @param {Object} p
 * @param {Array}  p.waypoints          waypoints de la navigation
 * @param {number|null} p.cruiseSpeedKt
 * @param {number|null} p.fuelConsumptionLph
 * @param {number} p.reserveLiters      réserve finale réglementaire (L)
 * @param {number|null} p.capacityLtr   capacité carburant totale de l'avion (L)
 * @param {number} [p.taxiLtr]          roulage par tronçon (0 si inconnu)
 * @param {number} [p.alternateLtr]     dégagement, dernier tronçon (0 si inconnu)
 * @returns {{ status: 'no-data'|'ok'|'insufficient', legs, worstLeg, capacityLtr }}
 */
export function analyzeFuelAutonomy({ waypoints, cruiseSpeedKt, fuelConsumptionLph, reserveLiters = 0, capacityLtr, taxiLtr = 0, alternateLtr = 0 }) {
  const validWaypoints = (waypoints || []).filter(isValidWp);
  if (validWaypoints.length < 2) return { status: 'no-data', legs: [], worstLeg: null, capacityLtr: capacityLtr ?? null };
  if (!cruiseSpeedKt || !fuelConsumptionLph || !capacityLtr) {
    return { status: 'no-data', legs: [], worstLeg: null, capacityLtr: capacityLtr ?? null };
  }

  const rawLegs = splitLegsAtFuelStops(validWaypoints);
  const legs = rawLegs.map((leg, idx) => {
    const distanceNM = legDistanceNM(leg.waypoints);
    const tripLtr = (distanceNM / cruiseSpeedKt) * fuelConsumptionLph;
    // Même critère que legFuelPlan (revue cran 3) : contingence 5 % (min 1 gal),
    // roulage par tronçon, dégagement sur le dernier — l'advisor de l'étape
    // Trajet et le bilan par tronçon rendent le MÊME verdict
    const contingencyLtr = Math.max(3.78541, tripLtr * 0.05);
    const isLast = idx === rawLegs.length - 1;
    const requiredLtr = taxiLtr + tripLtr + contingencyLtr + reserveLiters + (isLast ? alternateLtr : 0);
    return {
      ...leg,
      from: leg.waypoints[0],
      to: leg.waypoints[leg.waypoints.length - 1],
      distanceNM,
      tripLtr,
      // Composantes exposées pour que l'UI affiche une décomposition qui
      // ADDITIONNE au total (revue LOT 10 : le bandeau mentait par omission)
      contingencyLtr,
      taxiLtr,
      alternateLtr: isLast ? alternateLtr : 0,
      requiredLtr,
      fits: requiredLtr <= capacityLtr
    };
  });

  const failing = legs.filter(l => !l.fits);
  const worstLeg = failing.length > 0
    ? failing.reduce((a, b) => (a.requiredLtr >= b.requiredLtr ? a : b))
    : null;

  return {
    status: worstLeg ? 'insufficient' : 'ok',
    legs,
    worstLeg,
    capacityLtr
  };
}

/**
 * 🔧 LOT 10-C — Évalue l'avitaillement à un aérodrome DÉJÀ DANS la navigation
 * (ex. Lunéville en waypoint intermédiaire) : consommation pour l'atteindre,
 * carburant restant à l'arrivée au point (HYPOTHÈSE : réservoirs pleins au
 * départ — documentée dans l'UI), besoin du reste du vol et litres MINIMUM à
 * avitailler. Simulation : le waypoint est marqué fuelStop et la route est
 * ré-analysée par tronçon (mêmes postes que l'advisor/le bilan).
 * @param {Object} p — waypoint : référence d'un waypoint INTERMÉDIAIRE de
 *   p.waypoints ; autres params identiques à analyzeFuelAutonomy.
 * @returns {{ consumedToWpLtr, remainingAtWpLtr, requiredRestLtr,
 *   minRefuelLtr, reachable } | null} null si données manquantes (A5).
 */
export function assessRouteFuelWaypoint({ waypoints, waypoint, cruiseSpeedKt, fuelConsumptionLph, reserveLiters = 0, capacityLtr, taxiLtr = 0, alternateLtr = 0 }) {
  if (!waypoint || !capacityLtr) return null;
  const wpIndex = (waypoints || []).indexOf(waypoint);
  if (wpIndex < 0) return null;
  const simWaypoints = (waypoints || []).map((wp, i) => (i === wpIndex ? { ...wp, fuelStop: true } : wp));
  const simWp = simWaypoints[wpIndex];
  const sim = analyzeFuelAutonomy({
    waypoints: simWaypoints, cruiseSpeedKt, fuelConsumptionLph, reserveLiters, capacityLtr, taxiLtr, alternateLtr
  });
  if (sim.status === 'no-data' || sim.legs.length < 2) return null;

  // Tronçon menant AU waypoint = celui qui se termine sur lui (même référence)
  const legIdx = sim.legs.findIndex(l => l.to === simWp);
  const inboundIdx = legIdx >= 0 ? legIdx : 0;
  // Conso depuis le DERNIER plein (départ ou escale marquée en AMONT — une
  // escale fuelStop remet les réservoirs à plein) : tronçon inbound SEUL,
  // pas le cumul depuis le départ (revue lot 10)
  const consumedToWpLtr = taxiLtr + sim.legs[inboundIdx].tripLtr;
  const remainingAtWpLtr = Math.max(0, capacityLtr - consumedToWpLtr);
  // Besoin du RESTE du vol = max des tronçons après le point (couvre ≥1 escale)
  const requiredRestLtr = Math.max(...sim.legs.slice(inboundIdx + 1).map(l => l.requiredLtr));
  const minRefuelLtr = Math.max(0, requiredRestLtr - remainingAtWpLtr);
  // Atteignable si chaque tronçon JUSQU'AU point tient dans la capacité
  const reachable = sim.legs.slice(0, inboundIdx + 1).every(l => l.fits);
  // Même pleins à ras bord à l'escale, la SUITE doit tenir dans la capacité —
  // sinon avitailler ICI ne suffit pas (revue lot 10)
  const restFits = requiredRestLtr <= capacityLtr;

  return { consumedToWpLtr, remainingAtWpLtr, requiredRestLtr, minRefuelLtr, reachable, restFits };
}

/**
 * Candidats d'escale avitaillement pour un tronçon en défaut.
 * @param {Object} p
 * @param {Array}  p.airports      base d'aérodromes (position/lat/lon, services.fuel)
 * @param {Object} p.leg           tronçon en défaut (waypoints + startIndex globaux)
 * @param {Array}  [p.routeWaypoints] route COMPLÈTE pour l'exclusion (défaut :
 *   waypoints du tronçon — passer la route entière évite de proposer le
 *   départ/arrivée du vol comme escale)
 * @param {number} p.maxDistNM     distance max à la route (défaut 15 NM)
 * @param {number} p.minFraction   fenêtre utile basse (défaut 0.25 du tronçon)
 * @param {number} p.maxFraction   fenêtre utile haute (défaut 0.75)
 * @param {number} p.limit         nombre max de suggestions (défaut 5)
 * @returns {Array<{ icao, name, position, elevation, distToRouteNM, fraction,
 *   insertAfterGlobalIndex }>} triés par pertinence (milieu du tronçon puis détour)
 */
export function findFuelStopCandidates({ airports, leg, routeWaypoints, maxDistNM = 15, minFraction = 0.25, maxFraction = 0.75, limit = 5 }) {
  if (!leg || !Array.isArray(leg.waypoints) || leg.waypoints.length < 2) return [];
  const wps = leg.waypoints;

  // Longueurs cumulées des segments du tronçon (pour la fraction along-track)
  const segLengths = [];
  let totalNM = 0;
  for (let i = 0; i < wps.length - 1; i++) {
    const d = calculateDistance(wps[i], wps[i + 1]);
    segLengths.push(d);
    totalNM += d;
  }
  if (!(totalNM > 0)) return [];

  // Identifiants déjà présents dans la ROUTE (ne pas proposer un waypoint
  // existant — y compris le départ/arrivée du vol, hors du tronçon en défaut)
  const existing = new Set(
    (routeWaypoints ?? wps).flatMap(wp => [wp?.icao, wp?.name]).filter(Boolean).map(s => String(s).toUpperCase())
  );

  const candidates = [];
  for (const apt of airports || []) {
    const icao = apt.icao;
    if (!icao || !/^[A-Z]{4}$/.test(icao) || existing.has(icao.toUpperCase())) continue;
    // Avitaillement EXPLICITE uniquement (A5 : pas d'escale sans pompe supposée)
    const hasFuel = apt.services?.fuel === true || apt.fuel === true;
    if (!hasFuel) continue;
    const position = apt.position || apt.coordinates || { lat: apt.lat, lon: apt.lon ?? apt.lng };
    if (!isValidWp(position)) continue;

    // Projection sur chaque segment du tronçon : min distance + along-track cumulé
    let best = null;
    let cumNM = 0;
    for (let i = 0; i < wps.length - 1; i++) {
      const proj = projectPointOnSegment(position, wps[i], wps[i + 1]);
      if (proj && Number.isFinite(proj.distToFootNM)) {
        if (!best || proj.distToFootNM < best.distToRouteNM) {
          best = {
            distToRouteNM: proj.distToFootNM,
            alongNM: cumNM + Math.max(0, Math.min(proj.alongTrackNM ?? 0, segLengths[i])),
            segIndex: i
          };
        }
      }
      cumNM += segLengths[i];
    }
    if (!best || best.distToRouteNM > maxDistNM) continue;

    const fraction = best.alongNM / totalNM;
    if (fraction < minFraction || fraction > maxFraction) continue;

    candidates.push({
      icao,
      name: apt.name || icao,
      position,
      elevation: apt.elevation,
      distToRouteNM: best.distToRouteNM,
      fraction,
      // Insertion APRÈS le waypoint global de début du segment le plus proche
      insertAfterGlobalIndex: leg.startIndex + best.segIndex
    });
  }

  // Pertinence : proche du milieu du tronçon d'abord, puis détour minimal
  candidates.sort((a, b) =>
    (Math.abs(a.fraction - 0.5) - Math.abs(b.fraction - 0.5)) ||
    (a.distToRouteNM - b.distToRouteNM)
  );
  return candidates.slice(0, limit);
}
