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
 * @param {number|string|null|undefined} value
 * @returns {number|null|undefined} mètres (ou la valeur d'origine si non numérique)
 */
export function armToMeters(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return value;
  return Math.abs(n) > 10 ? n / 1000 : n;
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
