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
import { interpolateAbac, inspectAbacByGraph, bracketInterpolateGraph, evaluateAbacCascade, inputsToConditions, InterpolationStatus } from './abacInterpolation';

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

  // ── 2. Recherche des abaques portant cet id ──
  const matches = findGraphsForOperation(aircraft, operationId);

  if (matches.length === 0) {
    return {
      operationId,
      operationLabel: opDef.labelFr,
      status: ResultStatus.NOT_IMPLEMENTED,
      reason: `Aucun abaque portant l'operationId "${operationId}" n'est défini sur cet avion.`
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

  const cascade = evaluateAbacCascade(abaqueData, conditions);

  // ── 3.5. Détection d'erreur dans la cascade ──
  // En mode strict (interpolationMode déclaré), une étape qui échoue produit
  // step.error + step.used === null. On remonte cette erreur au lieu d'un
  // faux calcul issu d'un fallback.
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
      debug: { perGraph: inspectAbacByGraph(abaqueData, conditions, cascade.steps).graphs }
    };
  }

  const finalValue = cascade.finalValue;
  // Méthode = la méthode du DERNIER graphe (primaire)
  const lastStep = cascade.steps[cascade.steps.length - 1];
  const methodLabel = (used) => {
    switch (used) {
      case 'bracket':       return 'Bracket 2D';
      case 'slope-follow':  return 'Slope-follow';
      case 'idw':           return 'IDW 4D';
      default:              return 'inconnu';
    }
  };
  const finalMethod = cascade.steps.length > 1
    ? `Cascade ${cascade.steps.length} graphes (final: ${methodLabel(lastStep?.used)})`
    : methodLabel(lastStep?.used);
  // Confidence agrégée
  const allBracket      = cascade.steps.every(s => s.used === 'bracket');
  const allSlopeFollow  = cascade.steps.every(s => s.used === 'slope-follow');
  const allDeclared     = cascade.steps.every(s => s.modeDeclared && s.used !== 'idw');
  const anyIDW          = cascade.steps.some(s => s.used === 'idw');
  const finalConfidence = anyIDW ? '70%' : (allDeclared ? '95%' : (allBracket || allSlopeFollow) ? '90%' : '85%');
  const bracketDetails = lastStep?.bracketResult || null;
  const interpFallback = null;

  // ── 4. Construction du résultat ──
  const warnings = [];
  // Avertissements d'extrapolation pour chaque maillon de la cascade
  cascade.steps.forEach(step => {
    const br = step.bracketResult;
    const sr = step.slopeResult;
    if (br?.extrapolated && br.availableFamilyValues) {
      warnings.push(
        br.extrapolated === 'below'
          ? `⚠ [${step.graphName}] Extrapolation BAS : ${br.familyDim} = ${Number(br.queryFamily).toFixed(1)} est sous la courbe la plus basse (${Math.min(...br.availableFamilyValues)})`
          : `⚠ [${step.graphName}] Extrapolation HAUT : ${br.familyDim} = ${Number(br.queryFamily).toFixed(1)} est au-delà de la courbe la plus haute (${Math.max(...br.availableFamilyValues)})`
      );
    }
    if (sr?.extrapolated && sr.availableEntryYs) {
      warnings.push(
        sr.extrapolated === 'below'
          ? `⚠ [${step.graphName}] Suivi de pente extrapolé BAS : Y_in = ${Number(sr.entryY).toFixed(1)} est sous la courbe la plus basse au bord gauche (${Math.min(...sr.availableEntryYs).toFixed(1)})`
          : `⚠ [${step.graphName}] Suivi de pente extrapolé HAUT : Y_in = ${Number(sr.entryY).toFixed(1)} est au-delà de la courbe la plus haute au bord gauche (${Math.max(...sr.availableEntryYs).toFixed(1)})`
      );
    }
  });
  const curves = Array.isArray(graph.curves) ? graph.curves : [];

  // Inspection détaillée par sous-graphique (pour debug visuel comparatif avec MANEX)
  // On passe les cascadeSteps pour que slope-follow puisse récupérer le vrai Y_in
  const perGraphDebug = inspectAbacByGraph(abaqueData, conditions, cascade.steps);

  return {
    operationId,
    operationLabel: opDef.labelFr,
    status: ResultStatus.COMPUTED,
    value: finalValue,
    unit: graph.outputUnit || opDef.acceptedOutputs[0]?.defaultUnit || '',
    outputKind: graph.outputKind || opDef.acceptedOutputs[0]?.kind || null,
    source: {
      kind: 'abac',
      modelId: model?.id,
      modelName: model?.name,
      graphId: graph?.id,
      graphName: graph?.name,
      curveCount: curves.length,
      pointsUsed: interpFallback?.totalPoints,
      method: finalMethod
    },
    inputs: {
      temperature: conditions.temperature,
      pressure_altitude: conditions.pressure_altitude,
      mass: conditions.mass,
      wind: conditions.wind
    },
    confidence: finalConfidence,
    bracketDetails,
    nearestPoints: interpFallback?.nearestPoints,
    cascadeSteps: cascade.steps, // ← Phase 3.7 : chaîne d'évaluation
    warnings,
    debug: {
      perGraph: perGraphDebug.graphs
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
