// src/utils/cgEnvelope.js
//
// SOURCE UNIQUE de la géométrie de l'enveloppe de centrage.
// Remplace les trois interprétations divergentes de l'audit (anomalies A2/A3) :
//   - weightBalanceStore : rectangle constant [forwardPoints[0].cg, aftCG]
//   - WeightBalanceChart  : avant interpolé, mais arrière constant (aftCG)
//   - CgEnvelopeDualChart : dessin correct (aftMinCG/aftMaxCG) mais sans verdict
//
// Ici : limite AVANT interpolée sur la courbe forwardPoints (variable avec la
// masse) ET limite ARRIÈRE interpolée sur le modèle 2-points aftMin/aftMax
// (rétro-compat aftCG constant). Les CG sont renvoyés dans la MÊME unité que
// celle saisie dans l'enveloppe (aucune conversion) ; l'appelant compare son CG
// calculé à ces limites, exactement comme avant, mais désormais correctes à la masse.

const num = (v) => {
  if (v === null || v === undefined || v === '') return NaN;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};

// Interpolation linéaire de y (clamp aux extrémités) sur des points {x, y} triés par x.
function interpAt(points, x) {
  if (points.length === 0) return NaN;
  if (points.length === 1) return points[0].y; // un seul point ⇒ constante
  if (x <= points[0].x) return points[0].y;
  const last = points[points.length - 1];
  if (x >= last.x) return last.y;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + t * (b.y - a.y);
    }
  }
  return last.y;
}

// Points de la limite AVANT (CG le plus avant = minimum autorisé), triés par masse.
export function forwardLimitPoints(cgEnvelope) {
  if (!cgEnvelope) return [];
  return (cgEnvelope.forwardPoints || [])
    .map((p) => ({ x: num(p.weight), y: num(p.cg) }))
    .filter((p) => p.x > 0 && p.y > 0)
    .sort((a, b) => a.x - b.x);
}

// Points de la limite ARRIÈRE (CG le plus arrière = maximum autorisé).
//
// Priorité 1 — COURBE COMPLÈTE multi-points `aftPoints: [{weight, cg}]`
// (saisie graphique / centrogramme tracé, où la limite arrière n'est pas une
// simple droite). Triée par masse, mêmes filtres que la limite avant.
// Priorité 2 — modèle 2-points (aftMin/aftMax) avec rétro-compat aftCG constant
// si absents (A3). Ajout rétro-compatible : aucun avion existant n'a `aftPoints`,
// donc le comportement legacy est strictement inchangé tant que ce champ est absent.
export function aftLimitPoints(cgEnvelope) {
  if (!cgEnvelope) return [];
  if (Array.isArray(cgEnvelope.aftPoints) && cgEnvelope.aftPoints.length > 0) {
    const pts = cgEnvelope.aftPoints
      .map((p) => ({ x: num(p.weight), y: num(p.cg) }))
      .filter((p) => p.x > 0 && p.y > 0)
      .sort((a, b) => a.x - b.x);
    if (pts.length > 0) return pts;
  }
  const legacy = num(cgEnvelope.aftCG);
  const minCG = num(cgEnvelope.aftMinCG) > 0 ? num(cgEnvelope.aftMinCG) : legacy;
  const maxCG = num(cgEnvelope.aftMaxCG) > 0 ? num(cgEnvelope.aftMaxCG) : legacy;
  const minW = num(cgEnvelope.aftMinWeight);
  const maxW = num(cgEnvelope.aftMaxWeight);
  const pts = [];
  if (minW > 0 && minCG > 0) pts.push({ x: minW, y: minCG });
  if (maxW > 0 && maxCG > 0) pts.push({ x: maxW, y: maxCG });
  // Aucun couple masse→CG arrière exploitable, mais aftCG constant dispo :
  if (pts.length === 0 && legacy > 0) pts.push({ x: 0, y: legacy });
  return pts.sort((a, b) => a.x - b.x);
}

// Plage de masse couverte par l'enveloppe [min, max], ou null si indéterminée.
export function envelopeWeightRange(cgEnvelope) {
  const xs = [...forwardLimitPoints(cgEnvelope), ...aftLimitPoints(cgEnvelope)]
    .map((p) => p.x)
    .filter((x) => Number.isFinite(x) && x > 0);
  if (xs.length === 0) return null;
  return { min: Math.min(...xs), max: Math.max(...xs) };
}

/**
 * Limites CG (avant/arrière) interpolées à une masse donnée.
 * @param {object} cgEnvelope  Enveloppe avion (forwardPoints + aftMin/aftMax/aftCG),
 *                             ou objet scalaire {forward, aft} en dernier recours.
 * @param {number} mass        Masse (même unité que les masses de l'enveloppe).
 * @returns {{forward:number|null, aft:number|null, source:'envelope'|'legacy'|'missing', warnings:string[]}}
 */
export function cgLimitsAtMass(cgEnvelope, mass) {
  const warnings = [];
  const fwdPts = forwardLimitPoints(cgEnvelope);
  const aftPts = aftLimitPoints(cgEnvelope);

  if (fwdPts.length === 0 && aftPts.length === 0) {
    // Pas de courbe : tenter les limites scalaires (cgLimits) en dernier recours.
    const f = Number.isFinite(num(cgEnvelope?.forward)) ? num(cgEnvelope?.forward) : num(cgEnvelope?.cgLimits?.forward);
    const a = Number.isFinite(num(cgEnvelope?.aft)) ? num(cgEnvelope?.aft) : num(cgEnvelope?.cgLimits?.aft);
    if (Number.isFinite(f) || Number.isFinite(a)) {
      return { forward: Number.isFinite(f) ? f : null, aft: Number.isFinite(a) ? a : null, source: 'legacy', warnings };
    }
    return { forward: null, aft: null, source: 'missing', warnings: ['Enveloppe de centrage absente'] };
  }

  const m = num(mass);
  const forward = fwdPts.length ? interpAt(fwdPts, m) : NaN;
  const aft = aftPts.length ? interpAt(aftPts, m) : NaN;

  const range = envelopeWeightRange(cgEnvelope);
  if (range && Number.isFinite(m) && (m < range.min || m > range.max)) {
    warnings.push(`Masse ${m} hors plage enveloppe [${range.min}–${range.max}] — limite CG bornée`);
  }

  return {
    forward: Number.isFinite(forward) ? forward : null,
    aft: Number.isFinite(aft) ? aft : null,
    source: 'envelope',
    warnings,
  };
}

/**
 * (mass, cg) appartient-il à l'enveloppe ? Masse dans la plage ET cg ∈ [avant, arrière].
 * @returns {boolean|null}  null si l'enveloppe est absente (verdict indéterminé — P0,
 *                          jamais « OK » par défaut ; l'appelant traite null en fail-closed).
 */
export function isWithinEnvelope(cgEnvelope, mass, cg) {
  const limits = cgLimitsAtMass(cgEnvelope, mass);
  if (limits.source === 'missing') return null;
  const c = num(cg);
  if (!Number.isFinite(c)) return null;
  if (limits.forward !== null && c < limits.forward) return false;
  if (limits.aft !== null && c > limits.aft) return false;
  const range = envelopeWeightRange(cgEnvelope);
  const m = num(mass);
  if (range && Number.isFinite(m) && (m < range.min || m > range.max)) return false;
  return true;
}

/**
 * Sommets du polygone d'enveloppe [{w, cg, label}] (avant croissant puis arrière
 * décroissant) — pour le tracé. Réutilise la même géométrie que le verdict.
 */
export function buildEnvelopePolygon(cgEnvelope) {
  const fwd = forwardLimitPoints(cgEnvelope).map((p, i) => ({ w: p.x, cg: p.y, label: `Forward ${i + 1}` }));
  const aftDesc = aftLimitPoints(cgEnvelope).filter((p) => p.x > 0).sort((a, b) => b.x - a.x);
  const aft = aftDesc.map((p, i) => ({
    w: p.x,
    cg: p.y,
    label: aftDesc.length > 1 ? (i === 0 ? 'Aft Max' : 'Aft Min') : 'Aft',
  }));
  return [...fwd, ...aft];
}
