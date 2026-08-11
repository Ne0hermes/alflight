// src/features/fuel/utils/legFuelPlan.js
// 🔧 CRAN 3 (escale carburant) — Bilan carburant PAR TRONÇON.
// Une escale `fuelStop` (avitaillement complet) coupe le vol en tronçons :
// chaque tronçon doit être flyable avec le plein disponible À SON DÉPART.
// Par tronçon : roulage + trip + contingence (5 % du trip, min 1 gal US) +
// réserve finale réglementaire. Le DÉGAGEMENT ne s'applique qu'au DERNIER
// tronçon (le déroutement protège la destination finale).
// Les extras (additional/extra/discretionary) sont hors minima par tronçon.
// Règle A5 : vitesse/conso/waypoints manquants → null (pas de chiffre inventé).
import { calculateDistance } from '@utils/navigationCalculations';
import { splitLegsAtFuelStops } from '@features/navigation/utils/fuelStopPlanner';
import { computeWorstDiversion } from '@features/alternates/utils/alternateFuelCalculations';

const GAL_LTR = 3.78541;
const isValidWp = (wp) => Number.isFinite(wp?.lat) && Number.isFinite(wp?.lon);

/**
 * @param {Object} p
 * @param {Array}  p.waypoints           waypoints de la navigation (fuelStop === true = escale)
 * @param {number|null} p.cruiseSpeedKt
 * @param {number|null} p.fuelConsumptionLph
 * @param {number} p.taxiLtr             roulage (appliqué à CHAQUE départ de tronçon)
 * @param {number} p.finalReserveLtr     réserve finale réglementaire (chaque tronçon)
 * @param {number} p.alternateLtr        dégagement — utilisé en MONO-tronçon
 *   (route entière) ; en multi-tronçon, si `alternates` + `aircraft` sont
 *   fournis, le supplément est recalculé PAR TRONÇON (revue cran 3 : un
 *   travers pénalisant sur le tronçon 1 doit charger le tronçon 1, pas le
 *   dernier). Approche conservatrice : pas d'exclusion du pied clampé à
 *   l'escale (léger sur-provisionnement possible, jamais l'inverse).
 * @param {Array}  [p.alternates]        déroutements sélectionnés (par-tronçon)
 * @param {Object} [p.aircraft]          avion (vitesse/conso pour la diversion)
 * @returns {{ legs, worstLeg, isMultiLeg } | null}
 *   legs[i] = { from, to, viaLabel, distanceNM, tripLtr, contingencyLtr,
 *               taxiLtr, finalReserveLtr, alternateLtr, totalLtr }
 */
export function computeLegFuelPlans({ waypoints, cruiseSpeedKt, fuelConsumptionLph, taxiLtr = 0, finalReserveLtr = 0, alternateLtr = 0, alternates = null, aircraft = null }) {
  const valid = (waypoints || []).filter(isValidWp);
  if (valid.length < 2 || !cruiseSpeedKt || !fuelConsumptionLph) return null;

  const rawLegs = splitLegsAtFuelStops(valid);
  if (rawLegs.length === 0) return null;

  const multiLeg = rawLegs.length > 1;
  const perLegDiversion = multiLeg && Array.isArray(alternates) && alternates.length > 0 && aircraft;

  const legs = rawLegs.map((leg, idx) => {
    let distanceNM = 0;
    for (let i = 0; i < leg.waypoints.length - 1; i++) {
      distanceNM += calculateDistance(leg.waypoints[i], leg.waypoints[i + 1]);
    }
    const tripLtr = (distanceNM / cruiseSpeedKt) * fuelConsumptionLph;
    const contingencyLtr = Math.max(GAL_LTR, tripLtr * 0.05); // 5 %, min 1 gal US
    const isLast = idx === rawLegs.length - 1;
    let legAlternateLtr;
    if (perLegDiversion) {
      // Supplément de déroutement calculé sur CE tronçon (pied de
      // perpendiculaire → fin du tronçon) — fail-closed : statuts d'erreur → 0
      const div = computeWorstDiversion({ alternates, waypoints: leg.waypoints, aircraft });
      legAlternateLtr = div?.hasComputable ? Math.max(0, div.supplementLtr || 0) : 0;
    } else {
      legAlternateLtr = isLast ? (alternateLtr || 0) : 0;
    }
    const totalLtr = taxiLtr + tripLtr + contingencyLtr + finalReserveLtr + legAlternateLtr;
    const from = leg.waypoints[0];
    const to = leg.waypoints[leg.waypoints.length - 1];
    return {
      index: idx,
      from,
      to,
      label: `${from.icao || from.name || `WP${leg.startIndex + 1}`} → ${to.icao || to.name || ''}`,
      distanceNM,
      tripLtr,
      contingencyLtr,
      taxiLtr,
      finalReserveLtr,
      alternateLtr: legAlternateLtr,
      totalLtr
    };
  });

  const worstLeg = legs.reduce((a, b) => (a.totalLtr >= b.totalLtr ? a : b));
  return { legs, worstLeg, isMultiLeg: legs.length > 1 };
}
