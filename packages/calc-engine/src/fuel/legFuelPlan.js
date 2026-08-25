// src/features/fuel/utils/legFuelPlan.js
// 🔧 CRAN 3 (escale carburant) — Bilan carburant PAR TRONÇON.
// Une escale `fuelStop` (avitaillement complet) coupe le vol en tronçons :
// chaque tronçon doit être flyable avec le plein disponible À SON DÉPART.
// Par tronçon : roulage + trip + contingence (5 % du trip, min 1 gal US) +
// réserve finale réglementaire. Le DÉGAGEMENT ne s'applique qu'au DERNIER
// tronçon (le déroutement protège la destination finale).
// Les extras (additional/extra/discretionary) sont hors minima par tronçon.
// Règle A5 : vitesse/conso/waypoints manquants → null (pas de chiffre inventé).
import { calculateDistance } from '../nav/navigationCalculations.js';
import { splitLegsAtFuelStops } from './fuelStopPlanner.js';
import { computeWorstDiversion } from './alternateFuelCalculations.js';

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
 * @param {number|null} [p.effectiveSpeedKt] 🔧 C2 : vitesse SOL moyenne corrigée
 *   du vent (navigationResults.effectiveSpeedKt). Si fournie, les TEMPS (donc
 *   le trip par tronçon) l'utilisent — sinon repli TAS (comportement d'avant).
 *   cruiseSpeedKt reste requis (garde fail-closed A5).
 * @returns {{ legs, worstLeg, isMultiLeg } | null}
 *   legs[i] = { from, to, viaLabel, distanceNM, tripLtr, contingencyLtr,
 *               taxiLtr, finalReserveLtr, alternateLtr, totalLtr }
 */
export function computeLegFuelPlans({ waypoints, cruiseSpeedKt, fuelConsumptionLph, taxiLtr = 0, finalReserveLtr = 0, alternateLtr = 0, alternates = null, aircraft = null, effectiveSpeedKt = null }) {
  const valid = (waypoints || []).filter(isValidWp);
  if (valid.length < 2 || !cruiseSpeedKt || !fuelConsumptionLph) return null;

  // 🔧 C2 : vitesse utilisée pour les TEMPS — sol effective (vent) si dispo.
  const speedForTimeKt = (Number.isFinite(effectiveSpeedKt) && effectiveSpeedKt > 0)
    ? effectiveSpeedKt : cruiseSpeedKt;

  const rawLegs = splitLegsAtFuelStops(valid);
  if (rawLegs.length === 0) return null;

  const multiLeg = rawLegs.length > 1;
  const perLegDiversion = multiLeg && Array.isArray(alternates) && alternates.length > 0 && aircraft;

  const legs = rawLegs.map((leg, idx) => {
    let distanceNM = 0;
    for (let i = 0; i < leg.waypoints.length - 1; i++) {
      distanceNM += calculateDistance(leg.waypoints[i], leg.waypoints[i + 1]);
    }
    const tripLtr = (distanceNM / speedForTimeKt) * fuelConsumptionLph;
    const contingencyLtr = Math.max(GAL_LTR, tripLtr * 0.05); // 5 %, min 1 gal US
    const isLast = idx === rawLegs.length - 1;
    let legAlternateLtr;
    let alternateStatus = null; // renseigné UNIQUEMENT quand le dégagement est incalculable
    if (perLegDiversion) {
      // Supplément de déroutement calculé sur CE tronçon (pied de
      // perpendiculaire → fin du tronçon).
      const div = computeWorstDiversion({ alternates, waypoints: leg.waypoints, aircraft });
      if (div?.hasComputable) {
        // Un 0 est LÉGITIME ici : déroutement vérifié suffisant (0 supplément).
        legAlternateLtr = Math.max(0, div.supplementLtr || 0);
        // Revue 25/08 : vérification PARTIELLE — au moins un déroutement
        // sélectionné n'a pas pu être évalué (position manquante…) : le pire
        // calculé peut ne pas être le pire réel. Signalé, jamais tu.
        if (Array.isArray(div.errors) && div.errors.length > 0) {
          alternateStatus = 'partial';
        }
      } else {
        // ⛔ Lot 1.0 (25/08) : AUCUN déroutement calculable. L'ancien code
        // écrivait 0 en se prétendant « fail-closed » — exactement l'inverse :
        // le même 0 que « vérifié suffisant ». Le poste devient null, et le
        // TOTAL du tronçon aussi : un bilan auquel il manque le dégagement
        // n'a pas de total présentable.
        legAlternateLtr = null;
        alternateStatus = div?.errors?.[0]?.status || 'missing-data';
      }
    } else {
      legAlternateLtr = isLast ? (alternateLtr || 0) : 0;
    }
    const totalLtr = legAlternateLtr === null
      ? null
      : taxiLtr + tripLtr + contingencyLtr + finalReserveLtr + legAlternateLtr;
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
      alternateStatus,
      totalLtr
    };
  });

  // worstLeg : parmi les tronçons au total CALCULABLE uniquement (null >= x est
  // toujours faux — l'ancien reduce aurait silencieusement élu un mauvais
  // tronçon). Aucun total calculable → worstLeg null, verdict indisponible.
  const computable = legs.filter((l) => Number.isFinite(l.totalLtr));
  const worstLeg = computable.length > 0
    ? computable.reduce((a, b) => (a.totalLtr >= b.totalLtr ? a : b))
    : null;
  return {
    legs,
    worstLeg,
    isMultiLeg: legs.length > 1,
    // Lot 1.0 : tronçons dont le dégagement (donc le total) est incalculable
    incomputableLegs: legs.length - computable.length
  };
}
