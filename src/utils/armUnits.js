// src/utils/armUnits.js
//
// 🔧 Item L (bug m/mm) — garde-fou d'UNITÉ pour les bras de levier (centrage).
//
// Cause racine : double pivot. Le contrat de stockage (mbUnits) annonce armLength='mm',
// MAIS le moteur de centrage (weightBalanceStore.calculateWeightBalance / calculations.js)
// calcule en MÈTRES (prouvé par les golden tests : emptyWeightArm 2.10 → cg 2.132). Des
// données mixtes en circulation (ex. F-HFGI : fuelMain 805.9 mm, autres bras en m) donnent
// un moment ×1000 → centrage faux.
//
// Tant que la source n'est pas unifiée (chantier en cours : pivot unique = mètre), on
// NORMALISE défensivement à l'ENTRÉE du moteur — point de consommation unique qui couvre
// TOUTES les provenances (wizard local, import communautaire, avions déjà stockés), pas
// seulement l'import (que couvre le garde-fou du normaliseur).
//
// Sûreté du seuil : aucun overlap possible en aviation générale. Un bras réel exprimé en
// mètres vaut 0.01–10 ; en millimètres 300–10000. Le seuil 10 sépare proprement → zéro
// faux positif. Idempotent : une valeur déjà en mètres (< 10) n'est jamais retouchée, donc
// composer avec le garde-fou d'import (K) ne produit pas de double division.

const ARM_KEYS = [
  'emptyWeightArm',
  'fuelArm',
  'frontLeftSeatArm',
  'frontRightSeatArm',
  'rearLeftSeatArm',
  'rearRightSeatArm',
  'baggageArm',
  'auxiliaryArm',
];

/**
 * Ramène un bras de levier en MÈTRES. Une valeur |x| > 10 est interprétée comme des
 * millimètres et divisée par 1000. Les valeurs non numériques sont renvoyées telles
 * quelles (le moteur gère lui-même l'absence via Number.isFinite → bras manquant).
 * ⚠️ Ne couvre QUE la paire m/mm (ANO-12) : des cm ou des pouces legacy seront
 * mal interprétés — la migration P5 doit les désambiguïser, pas cette fonction.
 * @param {number|string|null|undefined} value
 * @returns {number|null|undefined} mètres (ou la valeur d'origine si non numérique)
 */
export function armToMeters(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return value;
  return Math.abs(n) > 10 ? n / 1000 : n;
}

/**
 * Ramène un MOMENT en kg·m. Même logique de magnitude que armToMeters mais avec
 * un seuil adapté : un moment GA réel en kg·m vaut ~100–40 000, en kg·mm il vaut
 * ~100 000–10 000 000. Le seuil 50 000 sépare proprement les deux populations.
 * @param {number|string|null|undefined} value
 * @returns {number|null|undefined} kg·m (ou la valeur d'origine si non numérique)
 */
export function momentToKgM(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return value;
  return Math.abs(n) > 50000 ? n / 1000 : n;
}

/**
 * Retourne une COPIE de l'avion dont tous les bras de levier sont garantis en mètres :
 * weightBalance.*Arm, additionalFuelTanks[].arm, baggageCompartments[].arm.
 * Ne touche PAS aux limites CG (cgLimits/cgEnvelope) ni au reste. Shallow-clone (immutable).
 * @param {object} aircraft
 * @returns {object} avion avec bras normalisés en mètres
 */
export function normalizeAircraftArmsToMeters(aircraft) {
  if (!aircraft || typeof aircraft !== 'object') return aircraft;
  const out = { ...aircraft };

  if (out.weightBalance && typeof out.weightBalance === 'object') {
    const wb = { ...out.weightBalance };
    for (const k of ARM_KEYS) {
      if (wb[k] !== undefined && wb[k] !== null) wb[k] = armToMeters(wb[k]);
    }
    out.weightBalance = wb;
  }

  if (Array.isArray(out.additionalFuelTanks)) {
    out.additionalFuelTanks = out.additionalFuelTanks.map((t) =>
      t && t.arm !== undefined && t.arm !== null ? { ...t, arm: armToMeters(t.arm) } : t
    );
  }

  if (Array.isArray(out.baggageCompartments)) {
    out.baggageCompartments = out.baggageCompartments.map((c) =>
      c && c.arm !== undefined && c.arm !== null ? { ...c, arm: armToMeters(c.arm) } : c
    );
  }

  // armLengths : forme historique (clés emptyMassArm/fuelArm/frontSeat1Arm…) servant de
  // repli quand weightBalance est absent. Tous ses champs numériques sont des bras → normaliser.
  if (out.armLengths && typeof out.armLengths === 'object') {
    const al = { ...out.armLengths };
    for (const k of Object.keys(al)) {
      if (al[k] !== undefined && al[k] !== null) al[k] = armToMeters(al[k]);
    }
    out.armLengths = al;
  }

  return out;
}

/**
 * C3.3 (moteur) — Normalise en MÈTRES les valeurs de **CG** de l'enveloppe et
 * des limites de centrage, à l'entrée du moteur. Complète
 * normalizeAircraftArmsToMeters (qui excluait l'enveloppe) : sans cela, un
 * avion legacy (copie IndexedDB locale, import externe) avec une enveloppe en
 * mm était comparé à un CG calculé en mètres → verdict faux (ANO-13).
 *
 * ⚠️ NE TOUCHE QUE les champs de CG : jamais les masses des points (kg > 10
 * légitimes), jamais les moments (seuil différent, cf. momentToKgM).
 *
 * @param {object} aircraft
 * @returns {object} copie avec enveloppe/limites CG en mètres
 */
export function normalizeAircraftCgEnvelopeToMeters(aircraft) {
  if (!aircraft || typeof aircraft !== 'object') return aircraft;
  const out = { ...aircraft };

  const normPoints = (pts) =>
    Array.isArray(pts)
      ? pts.map((p) => (p && p.cg !== undefined && p.cg !== null && p.cg !== '' ? { ...p, cg: armToMeters(p.cg) } : p))
      : pts;

  const normLimits = (lim) => {
    if (!lim || typeof lim !== 'object') return lim;
    const copy = { ...lim };
    for (const k of ['forward', 'aft']) {
      if (copy[k] !== undefined && copy[k] !== null && copy[k] !== '') copy[k] = armToMeters(copy[k]);
    }
    if (Array.isArray(copy.forwardVariable)) copy.forwardVariable = normPoints(copy.forwardVariable);
    return copy;
  };

  if (out.cgEnvelope && typeof out.cgEnvelope === 'object') {
    const env = { ...out.cgEnvelope };
    for (const k of ['aftCG', 'aftMinCG', 'aftMaxCG', 'forwardCG']) {
      if (env[k] !== undefined && env[k] !== null && env[k] !== '') env[k] = armToMeters(env[k]);
    }
    env.forwardPoints = normPoints(env.forwardPoints);
    env.intermediatePoints = normPoints(env.intermediatePoints);
    out.cgEnvelope = env;
  }
  if (out.cgLimits) out.cgLimits = normLimits(out.cgLimits);
  if (out.weightBalance?.cgLimits) {
    out.weightBalance = { ...out.weightBalance, cgLimits: normLimits(out.weightBalance.cgLimits) };
  }

  return out;
}

/**
 * C2 (hydratation wizard) — Normalise un avion EXISTANT vers le canonique du
 * wizard (bras en m, moments en kg·m) avant édition. Couvre la forme « wizard »
 * (arms.*, moments.*, cgLimits, cgEnvelope.*) EN PLUS de la forme moteur
 * (weightBalance/armLengths via normalizeAircraftArmsToMeters).
 *
 * Les MASSES ne sont jamais touchées : kg et lbs sont indiscernables par
 * magnitude (ANO-11) — seule la migration P5 (référence externe) peut trancher.
 *
 * @param {object|null} aircraft
 * @returns {object|null} copie normalisée (ou l'entrée telle quelle si nulle)
 */
export function normalizeAircraftForWizard(aircraft) {
  if (!aircraft || typeof aircraft !== 'object') return aircraft;
  const out = normalizeAircraftArmsToMeters(aircraft);

  const mapObj = (obj, fn) => {
    if (!obj || typeof obj !== 'object') return obj;
    const copy = { ...obj };
    for (const k of Object.keys(copy)) {
      if (copy[k] !== undefined && copy[k] !== null && copy[k] !== '') copy[k] = fn(copy[k]);
    }
    return copy;
  };

  if (out.arms) out.arms = mapObj(out.arms, armToMeters);
  if (out.moments) out.moments = mapObj(out.moments, momentToKgM);
  if (out.cgLimits) out.cgLimits = mapObj(out.cgLimits, armToMeters);

  if (out.additionalSeats) {
    out.additionalSeats = out.additionalSeats.map((s) =>
      s && s.arm != null && s.arm !== '' ? { ...s, arm: armToMeters(s.arm) } : s
    );
  }
  if (out.baggageCompartments) {
    out.baggageCompartments = out.baggageCompartments.map((c) => {
      if (!c) return c;
      const copy = { ...c };
      if (copy.arm != null && copy.arm !== '') copy.arm = armToMeters(copy.arm);
      if (copy.momentMax != null && copy.momentMax !== '') copy.momentMax = momentToKgM(copy.momentMax);
      return copy;
    });
  }
  if (out.additionalFuelTanks) {
    out.additionalFuelTanks = out.additionalFuelTanks.map((t) => {
      if (!t) return t;
      const copy = { ...t };
      if (copy.arm != null && copy.arm !== '') copy.arm = armToMeters(copy.arm);
      if (copy.momentAtFull != null && copy.momentAtFull !== '') copy.momentAtFull = momentToKgM(copy.momentAtFull);
      return copy;
    });
  }

  if (out.cgEnvelope && typeof out.cgEnvelope === 'object') {
    const env = { ...out.cgEnvelope };
    const armKeys = ['aftCG', 'aftMinCG', 'aftMaxCG', 'forwardCG', 'macLength', 'lemac'];
    const momentKeys = ['aftMinMoment', 'aftMaxMoment'];
    for (const k of armKeys) {
      if (env[k] != null && env[k] !== '') env[k] = armToMeters(env[k]);
    }
    for (const k of momentKeys) {
      if (env[k] != null && env[k] !== '') env[k] = momentToKgM(env[k]);
    }
    const normPoint = (p) => {
      if (!p) return p;
      const copy = { ...p };
      if (copy.cg != null && copy.cg !== '') copy.cg = armToMeters(copy.cg);
      if (copy.moment != null && copy.moment !== '') copy.moment = momentToKgM(copy.moment);
      return copy;
    };
    if (Array.isArray(env.forwardPoints)) env.forwardPoints = env.forwardPoints.map(normPoint);
    if (Array.isArray(env.intermediatePoints)) env.intermediatePoints = env.intermediatePoints.map(normPoint);
    out.cgEnvelope = env;
  }

  return out;
}
