// src/services/operationResolver.js
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║   RÉSOLVEUR D'OPÉRATIONS DE PERFORMANCE                              ║
// ║                                                                      ║
// ║   Bridge manquant entre les abaques créés dans AbacBuilder           ║
// ║   (persistés dans `aircraft_data.performanceModels[]`) et les        ║
// ║   calculs de la préparation de vol.                                  ║
// ║                                                                      ║
// ║   Étant donné :                                                      ║
// ║     - un avion (avec ses abaques)                                    ║
// ║     - un operationId du catalogue (ex. 'landing_50ft_flaps_landing') ║
// ║     - un objet d'inputs (mass, oat, headwind, ...)                   ║
// ║                                                                      ║
// ║   Le résolveur retourne un OperationResult typé qui dit :            ║
// ║     - COMPUTED       → valeur + source exacte (lequel abaque)        ║
// ║     - NOT_IMPLEMENTED→ aucun abaque ne porte cet operationId         ║
// ║     - MISSING_INPUT  → l'input requis par l'axe X manque             ║
// ║     - AMBIGUOUS      → plusieurs abaques portent ce même id          ║
// ║     - ERROR          → autre erreur de configuration                 ║
// ║                                                                      ║
// ║   Cette structure permet à l'UI de prep de vol d'afficher une        ║
// ║   matrice exhaustive (les 9 opérations du catalogue) sans            ║
// ║   ambiguïté.                                                         ║
// ║                                                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  OPERATION_CATALOG,
  getOperation,
  isValidOperationId
} from '../abac/curves/core/operationCatalog';
import { inputsToConditions } from './abacInterpolation';
import { evaluateAbacWithAtelierEngine } from './atelierCascadeAdapter';
import { resolveOperationFromTables } from './tableInterpolationAdapter';

/** Statuts possibles d'un résultat d'opération. */
export const ResultStatus = Object.freeze({
  COMPUTED:        'COMPUTED',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  MISSING_INPUT:   'MISSING_INPUT',
  AMBIGUOUS:       'AMBIGUOUS',
  ERROR:           'ERROR'
});

// ─────────────────────────────────────────────────────────────────────────
// MAPPING axisVariable → champ d'inputs
// ─────────────────────────────────────────────────────────────────────────

/**
 * Table de correspondance entre l'id de variable d'axe (cf. axisVariables.ts)
 * et le nom du champ dans l'objet `inputs` fourni au résolveur.
 * À étendre quand de nouvelles variables sont consommées.
 */
const AXIS_VARIABLE_TO_INPUT_FIELD = {
  // Masse
  mass:                'mass',
  takeoff_weight:      'massTakeoff',
  landing_weight:      'massLanding',

  // Environnement / altitude
  oat:                 'oat',
  pressure_altitude:   'pressureAltitude',
  density_altitude:    'densityAltitude',
  qnh:                 'qnh',
  humidity:            'humidity',

  // Vent
  headwind:            'headwind',
  tailwind:            'tailwind',
  crosswind:           'crosswind',
  wind_component:      'windComponent',

  // Piste
  runway_slope:        'runwaySlope',
  runway_condition:    'runwayCondition',

  // Vitesse
  ias:                 'ias',
  cas:                 'cas',
  tas:                 'tas',

  // Moteur
  rpm:                 'rpm',
  manifold_pressure:   'manifoldPressure',
  power_percent:       'powerPercent'
};

/** Récupère la valeur d'input associée à une variable d'axe.
 *  Avec fallback automatique pour les variables de la famille "vent" : si la variable
 *  exacte demandée n'est pas fournie, on essaie les autres variantes (headwind ↔ wind_component
 *  ↔ tailwind) parce qu'elles représentent la même grandeur physique (ou son opposé).
 */
function pickInputForAxis(axisVariableId, inputs) {
  if (!axisVariableId || !inputs) return undefined;
  const direct = AXIS_VARIABLE_TO_INPUT_FIELD[axisVariableId];
  const directValue = direct ? inputs[direct] : undefined;
  if (directValue !== null && directValue !== undefined && !Number.isNaN(directValue)) {
    return directValue;
  }

  // Fallback vent : essai des autres clés équivalentes
  const windAliases = ['windComponent', 'headwind', 'tailwind'];
  if (axisVariableId === 'wind_component' || axisVariableId === 'headwind') {
    for (const k of windAliases) {
      const v = inputs[k];
      if (v !== null && v !== undefined && !Number.isNaN(v)) return v;
    }
  }
  if (axisVariableId === 'tailwind') {
    // tailwind = -headwind ; si on a headwind, on retourne son opposé
    const hw = inputs.headwind ?? inputs.windComponent;
    if (hw !== null && hw !== undefined && !Number.isNaN(hw)) return -hw;
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────
// COLLECTE des graphes pour une opération donnée
// ─────────────────────────────────────────────────────────────────────────

/**
 * Récupère le tableau `performanceModels` depuis l'objet aircraft,
 * que celui-ci soit au format runtime (`aircraft.performanceModels`) ou
 * au format brut Supabase (`aircraft.aircraft_data.performanceModels`).
 */
function getPerformanceModels(aircraft) {
  if (!aircraft) return [];
  if (Array.isArray(aircraft.performanceModels)) return aircraft.performanceModels;
  if (Array.isArray(aircraft?.aircraft_data?.performanceModels)) return aircraft.aircraft_data.performanceModels;
  return [];
}

/**
 * Cherche dans tous les `performanceModels` de l'avion les graphes qui
 * portent un `operationId` donné. Retourne une liste de paires
 * `{ model, graph }` (un seul match attendu en pratique).
 */
export function findGraphsForOperation(aircraft, operationId) {
  const out = [];
  const models = getPerformanceModels(aircraft);
  for (const model of models) {
    // Chaque model.data est un AbacCurvesJSON
    const json = model?.data;
    const graphs = json?.graphs;
    if (!Array.isArray(graphs)) continue;
    for (const graph of graphs) {
      // Seuls les graphiques PRIMAIRES sont matchables. Les intermédiaires
      // sont des étapes de correction chaînées en amont, jamais consommés
      // directement. role undefined → traité comme 'primary' (rétro-compat).
      const role = graph?.role || 'primary';
      if (role === 'primary' && graph?.operationId === operationId) {
        out.push({ model, graph });
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// INTERPOLATION linéaire sur une courbe (à partir des points fittés)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Interpole linéairement Y à partir de X sur une liste de points.
 * Retourne `{ value, extrapolated }` ou `null` si pas de points.
 *
 * `extrapolated` vaut :
 *   - null si x est strictement dans l'intervalle
 *   - 'low' si x est sous le min
 *   - 'high' si x est au-delà du max
 *   (dans ces deux cas, on renvoie la valeur du bord — pas d'extrapolation
 *    linéaire au-delà, plus sûr pour des calculs aéro.)
 */
export function interpolateY(points, x) {
  if (!Array.isArray(points) || points.length === 0) return null;
  if (points.length === 1) return { value: points[0].y, extrapolated: null };

  // Tri par x (les fittedPoints le sont déjà mais on sécurise)
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const minX = sorted[0].x;
  const maxX = sorted[sorted.length - 1].x;

  if (x < minX) return { value: sorted[0].y, extrapolated: 'low' };
  if (x > maxX) return { value: sorted[sorted.length - 1].y, extrapolated: 'high' };

  // Recherche binaire de l'intervalle
  let lo = 0;
  let hi = sorted.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].x <= x) lo = mid;
    else hi = mid;
  }
  const a = sorted[lo];
  const b = sorted[hi];
  const dx = b.x - a.x;
  if (dx === 0) return { value: a.y, extrapolated: null };
  const t = (x - a.x) / dx;
  return { value: a.y + t * (b.y - a.y), extrapolated: null };
}

// ─────────────────────────────────────────────────────────────────────────
// API PRINCIPALE — résolution d'une opération
// ─────────────────────────────────────────────────────────────────────────

/**
 * Évalue une opération canonique pour des conditions données.
 *
 * @param {object} aircraft   L'avion (avec ses performanceModels)
 * @param {string} operationId  id du catalogue (ex. 'takeoff_50ft')
 * @param {object} inputs     { mass, oat, pressureAltitude, headwind, ... }
 * @returns {object}          OperationResult typé (cf. ResultStatus)
 */
/**
 * 🔧 A5/P0 — Entrées indispensables au calcul (le vent a un défaut conservateur 0).
 * Retourne la liste des entrées manquantes (null/NaN) pour renvoyer MISSING_INPUT
 * au lieu de calculer sur une valeur inventée.
 */
export function missingRequiredInputs(conditions = {}) {
  const ok = (v) => typeof v === 'number' && Number.isFinite(v);
  const missing = [];
  if (!ok(conditions.temperature))       missing.push('température');
  if (!ok(conditions.pressure_altitude)) missing.push('altitude');
  if (!ok(conditions.mass))              missing.push('masse');
  return missing;
}

export function resolveOperation(aircraft, operationId, inputs = {}) {
  // ── 1. Validation de l'id ──
  if (!isValidOperationId(operationId)) {
    return {
      operationId,
      status: ResultStatus.ERROR,
      reason: `operationId inconnu du catalogue : "${operationId}".`
    };
  }
  const opDef = getOperation(operationId);

  // ── 2. Recherche des sources de données portant cet operationId ──
  // Priorité d'évaluation : abaque > tableau (P1 — branchement tableaux).
  // Le pilote n'a normalement qu'UNE source par operationId (abaque OU tableau,
  // jamais les deux à la fois selon décision architecturale).
  const matches = findGraphsForOperation(aircraft, operationId);

  if (matches.length === 0) {
    // ─── Fallback tableaux : si pas d'abaque pour cet operationId, on
    // tente la résolution via les tableaux numériques (advancedPerformance.tables).
    // L'adapter retourne null si aucune table non plus.
    const conditionsForTable = inputsToConditions(inputs);
    const tableResult = resolveOperationFromTables(aircraft, operationId, conditionsForTable);
    if (tableResult) {
      // 🔧 A5/P0 — Données présentes mais entrée(s) requise(s) manquante(s) ⇒ MISSING_INPUT.
      const missingTbl = missingRequiredInputs(conditionsForTable);
      if (missingTbl.length > 0) {
        return {
          operationId,
          operationLabel: opDef.labelFr,
          status: ResultStatus.MISSING_INPUT,
          missingInputs: missingTbl,
          reason: `Donnée(s) requise(s) manquante(s) : ${missingTbl.join(', ')} — performance non calculée (aucune valeur inventée).`
        };
      }
      // Adapter le status string vers ResultStatus enum
      let mappedStatus = ResultStatus.COMPUTED;
      if (tableResult.status === 'MISSING_INPUT') mappedStatus = ResultStatus.MISSING_INPUT;
      else if (tableResult.status === 'ERROR') mappedStatus = ResultStatus.ERROR;
      return { ...tableResult, status: mappedStatus };
    }

    return {
      operationId,
      operationLabel: opDef.labelFr,
      status: ResultStatus.NOT_IMPLEMENTED,
      reason: `Aucun abaque ni tableau portant l'operationId "${operationId}" n'est défini sur cet avion.`
    };
  }

  if (matches.length > 1) {
    return {
      operationId,
      operationLabel: opDef.labelFr,
      status: ResultStatus.AMBIGUOUS,
      reason: `${matches.length} abaques portent l'operationId "${operationId}". Garde un seul abaque pour chaque opération canonique.`,
      candidates: matches.map(m => ({
        modelId: m.model?.id,
        modelName: m.model?.name,
        graphId: m.graph?.id,
        graphName: m.graph?.name
      }))
    };
  }

  const { model, graph } = matches[0];

  // ── 3. ÉVALUATION EN CASCADE (Phase 3.7) ──
  // Si le set d'abaques contient plusieurs graphes (intermédiaires + primaire),
  // on les évalue en chaîne :
  //   - Graphe 1 (T1) : input X depuis conditions → output Y1
  //   - Graphe 2 (T2) : input X = Y1, family selon T2 → output Y2
  //   - …
  //   - Graphe primaire : input X = Y(n-1), family selon primaire → output final
  //
  // Pour chaque graphe individuel, on essaie d'abord BRACKET 2D (lecture pilote),
  // puis IDW 4D en fallback si le graphe n'a pas de paramètre familial déclaré.
  const abaqueData = model?.data || { graphs: [graph] };
  const conditions = inputsToConditions(inputs);

  // 🔧 A5/P0 — Entrée(s) requise(s) manquante(s) ⇒ on REFUSE de calculer (pas
  // d'ISA ni de masse inventée). La matrice affiche « donnée manquante ».
  const missingAbac = missingRequiredInputs(conditions);
  if (missingAbac.length > 0) {
    return {
      operationId,
      operationLabel: opDef.labelFr,
      status: ResultStatus.MISSING_INPUT,
      missingInputs: missingAbac,
      reason: `Donnée(s) requise(s) manquante(s) : ${missingAbac.join(', ')} — performance non calculée (aucune valeur inventée).`,
      source: { kind: 'abac', modelId: model?.id, modelName: model?.name, graphId: graph?.id, graphName: graph?.name }
    };
  }

  // P0 (AUDIT_MOTEUR_PERF_VOL.md) — UN SEUL MOTEUR : la préparation de vol
  // évalue les abaques avec le moteur de l'ATELIER (cascade.ts), via
  // l'adaptateur. L'ancien evaluateAbacCascade (abacInterpolation.js)
  // évaluait les graphes dans le mauvais ordre et sortait des valeurs
  // aberrantes (−7363 m en COMPUTED sur le cas réel PA-28 F-GNAM).
  const cascade = evaluateAbacWithAtelierEngine(abaqueData, conditions);

  // ── 3.4. Entrée de panneau manquante (détectée par l'adaptateur) ──
  if (Array.isArray(cascade.missing) && cascade.missing.length > 0) {
    return {
      operationId,
      operationLabel: opDef.labelFr,
      status: ResultStatus.MISSING_INPUT,
      missingInputs: cascade.missing,
      reason: cascade.error || `Donnée(s) requise(s) manquante(s) : ${cascade.missing.join(', ')}.`,
      source: { kind: 'abac', modelId: model?.id, modelName: model?.name, graphId: graph?.id, graphName: graph?.name }
    };
  }

  // ── 3.5. Détection d'erreur dans la cascade ──
  // Une étape qui échoue interrompt la chaîne : on remonte l'erreur au lieu
  // d'un faux calcul issu d'un fallback.
  const failedStep = cascade.steps.find(s => s.used === null);
  if (failedStep || (cascade.error && cascade.finalValue === null)) {
    const errReason = failedStep
      ? `Étape "${failedStep.graphName}" (mode déclaré : ${failedStep.mode}) : ${failedStep.error || 'aucune valeur produite.'}`
      : cascade.error;
    return {
      operationId,
      operationLabel: opDef.labelFr,
      status: ResultStatus.ERROR,
      reason: errReason,
      source: { kind: 'abac', modelId: model?.id, modelName: model?.name, graphId: graph?.id, graphName: graph?.name },
      cascadeSteps: cascade.steps,
      debug: { perGraph: [] }
    };
  }

  const finalValue = cascade.finalValue;
  const outputKind = graph.outputKind || opDef.acceptedOutputs[0]?.kind || null;

  // ── 3.6. P1 — GARDE DE PLAUSIBILITÉ (AUDIT_MOTEUR_PERF_VOL.md) ──
  // Une distance doit être FINIE et STRICTEMENT POSITIVE. Avant cette garde,
  // une valeur aberrante (ex. négative) partait en COMPUTED vers la matrice.
  if (!Number.isFinite(finalValue) || (outputKind === 'distance' && finalValue <= 0)) {
    return {
      operationId,
      operationLabel: opDef.labelFr,
      status: ResultStatus.ERROR,
      reason: `Valeur calculée implausible (${Number.isFinite(finalValue) ? `${finalValue.toFixed(1)} — une distance doit être > 0` : 'non finie'}). Vérifie la calibration des axes et des guides de l'abaque.`,
      source: { kind: 'abac', modelId: model?.id, modelName: model?.name, graphId: graph?.id, graphName: graph?.name },
      cascadeSteps: cascade.steps,
      debug: { perGraph: [] }
    };
  }

  const finalMethod = cascade.steps.length > 1
    ? `Moteur atelier — cascade ${cascade.steps.length} graphes (chaîne de l'atelier)`
    : 'Moteur atelier — graphe unique';
  const warnings = Array.isArray(cascade.warnings) ? [...cascade.warnings] : [];
  // Même moteur que le banc de référence de l'atelier : confiance élevée,
  // dégradée si des guides ont été prolongés/extrapolés hors tracé.
  const finalConfidence = warnings.length > 0 ? '85%' : '95%';
  const curves = Array.isArray(graph.curves) ? graph.curves : [];

  return {
    operationId,
    operationLabel: opDef.labelFr,
    status: ResultStatus.COMPUTED,
    value: finalValue,
    unit: cascade.outputUnit || graph.outputUnit || opDef.acceptedOutputs[0]?.defaultUnit || '',
    outputKind,
    source: {
      kind: 'abac',
      modelId: model?.id,
      modelName: model?.name,
      graphId: graph?.id,
      graphName: graph?.name,
      curveCount: curves.length,
      method: finalMethod
    },
    inputs: {
      temperature: conditions.temperature,
      pressure_altitude: conditions.pressure_altitude,
      mass: conditions.mass,
      wind: conditions.wind
    },
    confidence: finalConfidence,
    bracketDetails: null,
    cascadeSteps: cascade.steps, // chaîne d'évaluation (contrat matrice)
    warnings,
    debug: {
      perGraph: []
    }
  };
}

/**
 * Génère un état de performance complet en itérant sur TOUTES les opérations
 * du catalogue. Chaque opération produit un OperationResult, garantissant
 * l'exhaustivité (aucune opération canonique ne peut être silencieusement
 * oubliée).
 *
 * @returns {object} PerformanceState
 */
export function generatePerformanceState(aircraft, inputs = {}) {
  const results = {};
  let computed = 0, notImplemented = 0, missingInput = 0, ambiguous = 0, error = 0;

  for (const op of OPERATION_CATALOG) {
    const r = resolveOperation(aircraft, op.id, inputs);
    results[op.id] = r;
    switch (r.status) {
      case ResultStatus.COMPUTED:        computed++; break;
      case ResultStatus.NOT_IMPLEMENTED: notImplemented++; break;
      case ResultStatus.MISSING_INPUT:   missingInput++; break;
      case ResultStatus.AMBIGUOUS:       ambiguous++; break;
      case ResultStatus.ERROR:           error++; break;
      default: break;
    }
  }

  return {
    aircraftId: aircraft?.id || aircraft?.aircraftId || null,
    generatedAt: new Date().toISOString(),
    inputs,
    results,
    coverage: {
      total:           OPERATION_CATALOG.length,
      computed,
      notImplemented,
      missingInput,
      ambiguous,
      error
    }
  };
}
