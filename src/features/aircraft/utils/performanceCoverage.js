// src/features/aircraft/utils/performanceCoverage.js
//
// R22 — Couverture des tables de performance d'un avion : compare les modèles
// présents au MINIMUM ATTENDU (8 tables, cf. operationCatalog) et renvoie la
// liste NOMINATIVE des tables manquantes (pas un simple booléen présent/absent).
// Décision pilote : atterrissage LANDING + lisse ; groupe à poids fixe ;
// chaque table manquante « ignorable » via bypassedFields.

import {
  getExpectedPerformanceOperations,
  getOperation
} from '../../../abac/curves/core/operationCatalog';

/** Préfixe des clés de bypass des tables de perf (mécanisme bypassedFields). */
export const PERF_BYPASS_PREFIX = 'performance.';

/** Ensemble des operationId effectivement COUVERTS par l'avion. On lit le
 *  systemType de chaque modèle (posé à l'enregistrement) ET l'operationId du
 *  graphe primaire (robustesse). Tolérant aux emplacements legacy. */
export function getPresentOperationIds(aircraft) {
  const present = new Set();
  if (!aircraft) return present;

  // ── ABAQUES (performanceModels) : systemType + operationId du primaire ──
  const models =
    aircraft.performanceModels ||
    aircraft.advancedPerformance?.performanceModels ||
    aircraft.data?.performanceModels ||
    [];
  for (const m of models) {
    const st = m?.data?.metadata?.systemType;
    if (st) present.add(st);
    const graphs = m?.data?.graphs || [];
    for (const g of graphs) {
      if ((g.role || 'primary') === 'primary' && g.operationId) present.add(g.operationId);
    }
  }

  // ── TABLEAUX (advancedPerformance.tables / performanceTables) ──
  // R27 — MÊME taxonomie operationId que les abaques (R23/R24). Sans cette
  // lecture, un avion dont les perfs sont 100 % des TABLEAUX (ex. F-GOVE, 0
  // abaque) affichait TOUTES les tables comme manquantes, même après
  // re-classification. La prépa vol, elle, les consommait déjà (resolver →
  // fallback tableaux par t.operationId).
  const tables = [
    ...(Array.isArray(aircraft.advancedPerformance?.tables) ? aircraft.advancedPerformance.tables : []),
    ...(Array.isArray(aircraft.performanceTables) ? aircraft.performanceTables : []),
    ...(Array.isArray(aircraft.data?.advancedPerformance?.tables) ? aircraft.data.advancedPerformance.tables : []),
    ...(Array.isArray(aircraft.data?.performanceTables) ? aircraft.data.performanceTables : [])
  ];
  for (const t of tables) {
    const op = t?.operationId || t?.classification;
    if (op) present.add(op);
  }

  return present;
}

/**
 * Liste des tables du minimum attendu MANQUANTES (ni présentes, ni ignorées).
 * @param {object} aircraft
 * @param {Set<string>} [bypassedSet] clés bypassedFields actives
 * @returns {Array<{operationId, label, phase, flaps, bypassKey}>}
 */
export function computeMissingPerformanceTables(aircraft, bypassedSet = new Set()) {
  const present = getPresentOperationIds(aircraft);
  const missing = [];
  for (const op of getExpectedPerformanceOperations()) {
    const bypassKey = PERF_BYPASS_PREFIX + op.id;
    if (present.has(op.id) || bypassedSet.has(bypassKey)) continue;
    missing.push({
      operationId: op.id,
      label: op.labelFr,
      phase: op.phase,
      flaps: op.configuration?.flaps || null,
      bypassKey
    });
  }
  return missing;
}

/** Modèles présents portant un operationId « hérité » SANS volets précisés
 *  (takeoff_50ft, takeoff_ground_roll) → à re-tagger via les listes
 *  Phase/Métrique/Volets (synergie R17). Informatif. */
const LEGACY_UNSPECIFIED_FLAPS = new Set(['takeoff_50ft', 'takeoff_ground_roll']);
export function getFlapsUnspecifiedModels(aircraft) {
  const out = [];
  for (const id of getPresentOperationIds(aircraft)) {
    if (LEGACY_UNSPECIFIED_FLAPS.has(id)) {
      const op = getOperation(id);
      if (op) out.push({ operationId: id, label: op.labelFr });
    }
  }
  return out;
}
