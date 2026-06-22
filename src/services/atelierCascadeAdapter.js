// src/services/atelierCascadeAdapter.js
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║   P0 (AUDIT_MOTEUR_PERF_VOL.md) — UN SEUL MOTEUR D'ABAQUES           ║
// ║                                                                      ║
// ║   La préparation de vol évalue désormais les abaques avec LE MÊME    ║
// ║   moteur que l'atelier et le banc de référence : cascade.ts          ║
// ║   (performCascadeCalculationWithParameters).                        ║
// ║                                                                      ║
// ║   Remplace evaluateAbacCascade (abacInterpolation.js) qui :          ║
// ║     - évaluait les graphes dans le MAUVAIS ordre (primaire en        ║
// ║       dernier alors qu'il est l'ENTRÉE d'un abaque multi-panneaux),  ║
// ║     - interrogeait le panneau masse avec l'ALTITUDE comme famille,   ║
// ║     - écrasait les conditions pilote avec les sorties intermédiaires,║
// ║     - sortait −7363 m en COMPUTED sur le cas réel PA-28 F-GNAM.      ║
// ║                                                                      ║
// ║   Rôle de cet adaptateur : traduire les `conditions` du résolveur    ║
// ║   ({ temperature, pressure_altitude, mass, wind }) en                ║
// ║   GraphParameters de la chaîne de lecture (primaire d'abord, liens   ║
// ║   linkedTo — exactement la chaîne construite dans l'atelier), puis   ║
// ║   re-mapper les étapes vers le contrat d'affichage de la matrice.    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  performCascadeCalculationWithParameters,
  findGraphChain
} from '../abac/curves/core/cascade';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Variable canonique d'axe (ou titre legacy) → dimension de `conditions`.
 * Mêmes familles que inputsToConditions : temperature / pressure_altitude /
 * mass / wind. Retourne null si le titre n'est pas reconnu.
 */
export function titleToConditionDim(title) {
  const t = (title || '').toString().toLowerCase();
  if (!t) return null;
  if (t.includes('wind') || t.includes('vent')) return 'wind';
  if (t.includes('oat') || t.includes('temp')) return 'temperature';
  if (t.includes('alt')) return 'pressure_altitude';
  if (t.includes('mass') || t.includes('masse') || t.includes('weight')) return 'mass';
  return null;
}

/**
 * Évalue un set d'abaques (AbacCurvesJSON) aux conditions données avec le
 * moteur de l'atelier.
 *
 * @param {object} abaqueData  { graphs: GraphConfig[] }
 * @param {object} conditions  { temperature, pressure_altitude, mass, wind }
 * @returns {{
 *   steps: Array<object>,        // contrat d'affichage matrice (xDim/queryX/entryY/output/used…)
 *   finalValue: number|null,
 *   outputUnit?: string,         // unité Y du DERNIER graphe de la chaîne
 *   warnings?: string[],
 *   missing?: string[],          // entrées manquantes (→ MISSING_INPUT côté résolveur)
 *   error?: string
 * }}
 */
export function evaluateAbacWithAtelierEngine(abaqueData, conditions) {
  const graphs = Array.isArray(abaqueData?.graphs) ? abaqueData.graphs : [];
  if (graphs.length === 0) {
    return { steps: [], finalValue: null, error: 'Aucun graphe dans l\'abaque.' };
  }

  const primary = graphs.find(g => (g.role || 'primary') === 'primary') || graphs[0];

  // Chaîne de lecture = celle de l'ATELIER : primaire d'abord, puis les
  // panneaux suivis par les liens linkedTo (ordre gauche→droite des cadres).
  let chain = findGraphChain(graphs, primary.id);
  if (chain.length < graphs.length) {
    // Compat modèles anciens (liens absents/partiels) : on complète avec les
    // graphes restants triés par cascadeOrder — primaire TOUJOURS en tête.
    const inChain = new Set(chain.map(g => g.id));
    const rest = graphs
      .filter(g => g.id !== primary.id && !inChain.has(g.id))
      .sort((a, b) => (a.cascadeOrder ?? 99) - (b.cascadeOrder ?? 99));
    chain = chain.length > 0 ? [...chain, ...rest] : [primary, ...rest];
  }

  // Entrée du PRIMAIRE = la variable de son axe X (ex. OAT).
  const entryDim = titleToConditionDim(primary.axes?.xAxis?.title) || 'temperature';
  const initialValue = num(conditions?.[entryDim]);
  if (initialValue === null) {
    return {
      steps: [],
      finalValue: null,
      missing: [primary.axes?.xAxis?.title || entryDim],
      error: `Entrée du graphe primaire manquante (${primary.axes?.xAxis?.title || entryDim}).`
    };
  }

  // GraphParameters : famille du primaire (ex. altitude), puis le X de chaque
  // panneau de correction, mappé par sa variable canonique d'axe.
  const missing = [];
  const parameters = chain.map((g, i) => {
    if (i === 0) {
      // Famille du primaire (courbes 0ft/2000ft/…). Optionnelle : un primaire
      // mono-courbe n'en a pas besoin (cascade.ts gère paramValue undefined).
      const famDim = titleToConditionDim(g.familyAxisVariable) || 'pressure_altitude';
      const famVal = num(conditions?.[famDim]);
      return {
        graphId: g.id,
        parameter: famVal === null ? undefined : famVal,
        parameterName: g.familyAxisVariable || 'Altitude pression'
      };
    }
    const dim = titleToConditionDim(g.axes?.xAxis?.title);
    let windDirection;
    let value = dim ? num(conditions?.[dim]) : null;
    if (dim === 'wind') {
      // Convention résolveur : wind SIGNÉ (positif = face). Le panneau vent
      // de l'abaque travaille en MAGNITUDE + direction (courbes headwind /
      // tailwind filtrées par cascade.ts).
      const w = num(conditions?.wind) ?? 0;
      windDirection = w < 0 ? 'tailwind' : 'headwind';
      value = Math.abs(w);
    }
    if (value === null) missing.push(g.axes?.xAxis?.title || `paramètre de « ${g.name} »`);
    return {
      graphId: g.id,
      parameter: value === null ? undefined : value,
      parameterName: g.axes?.xAxis?.title,
      ...(g.isWindRelated && windDirection ? { windDirection } : {})
    };
  });

  if (missing.length > 0) {
    return {
      steps: [],
      finalValue: null,
      missing,
      error: `Entrée(s) de panneau manquante(s) : ${missing.join(', ')}.`
    };
  }

  const res = performCascadeCalculationWithParameters(chain, initialValue, parameters);

  // ── Re-mapping des étapes vers le contrat d'affichage de la matrice ──
  // (badges `used`, X/Y, entrée/sortie — cf. PerformanceStateMatrix).
  const steps = (res.steps || []).map((s, i) => {
    const g = chain[i];
    return {
      graphId: s.graphId,
      graphName: s.graphName,
      role: g?.role || (i === 0 ? 'primary' : 'intermediate'),
      cascadeOrder: g?.cascadeOrder ?? (i === 0 ? null : i),
      operationId: g?.operationId || null,
      // Méthodes réelles du moteur atelier : famille d'altitude sur le
      // primaire (bracket), suivi de pente sur les panneaux.
      mode: i === 0 ? 'bracket' : 'slope-follow',
      modeDeclared: true,
      used: i === 0 ? 'bracket' : 'slope-follow',
      xDim: i === 0 ? (primary.axes?.xAxis?.title || entryDim) : (g?.axes?.xAxis?.title || ''),
      xTitle: g?.axes?.xAxis?.title || '',
      yTitle: g?.axes?.yAxis?.title || '',
      queryX: i === 0 ? initialValue : (typeof s.parameter === 'number' ? s.parameter : null),
      entryY: i === 0 ? null : (typeof s.inputValue === 'number' ? s.inputValue : null),
      output: typeof s.outputValue === 'number' ? s.outputValue : null,
      curveUsed: s.curveUsed || null,
      error: null
    };
  });

  if (!res.success) {
    return {
      steps,
      finalValue: null,
      error: res.error || 'Échec du calcul en cascade (moteur atelier).'
    };
  }

  // Avertissements : prolongations / extrapolations signalées par le moteur
  // dans ses libellés de courbe (mêmes mentions que dans le banc atelier).
  const warnings = [];
  steps.forEach(st => {
    if (st.curveUsed && /prolong|extrapolation|au-dessus|en dessous/i.test(st.curveUsed)) {
      warnings.push(`⚠ [${st.graphName}] ${st.curveUsed}`);
    }
  });

  const lastGraph = chain[chain.length - 1];

  return {
    steps,
    finalValue: res.finalValue,
    outputUnit: lastGraph?.axes?.yAxis?.unit || undefined,
    warnings
  };
}
