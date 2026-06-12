// src/abac/curves/core/referenceBench.ts
//
// R13 — BANC DE TEST PERMANENT (AUDIT_ABAC_ATELIER_IMAGE_UNIQUE.md §21).
// Les cas de référence du manuel (entrées d'un exemple + résultat attendu)
// sont stockés DANS le modèle (metadata.referenceCases) et rejoués
// automatiquement à la validation : PASS/FAIL ± tolérance. C'est le filet
// qui aurait bloqué AVANT l'enregistrement le miroir du panneau masse et le
// mélange des familles de vent (test de référence PA-28, §19).
//
// Décision pilote (2026-06-12) : banc de test UNIQUEMENT — pas d'ajustement
// automatique des courbes à partir des cas (risque de maquillage du résultat
// avec un seul cas ; cf. réponse détaillée dans la conversation R13).

import { GraphConfig, ReferenceCase } from './types';
import {
  findGraphChain,
  performCascadeCalculationWithParameters,
  GraphParameters
} from './cascade';

export interface ReferenceCaseResult {
  caseId: string;
  status: 'pass' | 'fail' | 'error';
  computed?: number;
  deviationPct?: number;
  message?: string;
}

export const DEFAULT_TOLERANCE_PCT = 5;

/** Chaîne de calcul courante (même logique que le CascadeCalculator). */
export function buildChain(graphs: GraphConfig[]): GraphConfig[] {
  const start = graphs.find(g => !g.linkedFrom || g.linkedFrom.length === 0);
  if (!start) return [];
  return findGraphChain(graphs, start.id);
}

/** Rejoue UN cas sur les graphes EN L'ÉTAT (console moteur silencée). */
export function runReferenceCase(graphs: GraphConfig[], rc: ReferenceCase): ReferenceCaseResult {
  const chain = buildChain(graphs);
  if (chain.length === 0) {
    return { caseId: rc.id, status: 'error', message: 'Chaîne de graphes introuvable' };
  }

  const params: GraphParameters[] = [];
  for (let i = 0; i < chain.length; i++) {
    const g = chain[i];
    const p = rc.parameters?.[g.id];
    if (p === undefined || Number.isNaN(p)) {
      // Le paramètre du PREMIER graphe (altitude) est optionnel, comme dans
      // le calculateur ; pour les suivants il est obligatoire.
      if (i === 0) continue;
      return {
        caseId: rc.id,
        status: 'error',
        message: `Paramètre manquant pour « ${g.name} » — les graphes ont changé depuis la saisie du cas ? Re-saisis-le.`
      };
    }
    params.push({
      graphId: g.id,
      parameter: p,
      parameterName: g.axes?.xAxis?.title,
      ...(g.isWindRelated && rc.windDirection ? { windDirection: rc.windDirection } : {})
    });
  }

  // Le moteur journalise énormément : on le fait taire le temps du rejeu
  // (un banc de 5 cas ne doit pas noyer la console).
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  let result;
  try {
    result = performCascadeCalculationWithParameters(chain, rc.inputValue, params);
  } finally {
    console.log = origLog;
    console.warn = origWarn;
  }

  if (!result.success) {
    return { caseId: rc.id, status: 'error', message: result.error || 'Échec du calcul' };
  }

  const computed = result.finalValue;
  const deviationPct = rc.expected !== 0
    ? (Math.abs(computed - rc.expected) / Math.abs(rc.expected)) * 100
    : Math.abs(computed);
  const tol = rc.tolerancePct ?? DEFAULT_TOLERANCE_PCT;

  return {
    caseId: rc.id,
    status: deviationPct <= tol ? 'pass' : 'fail',
    computed,
    deviationPct
  };
}

export function runAllReferenceCases(graphs: GraphConfig[], cases: ReferenceCase[]): ReferenceCaseResult[] {
  return (cases || []).map(rc => runReferenceCase(graphs, rc));
}
