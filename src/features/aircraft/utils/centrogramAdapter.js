// src/features/aircraft/utils/centrogramAdapter.js
//
// ════════════════════════════════════════════════════════════════════════════
//  ADAPTATEUR CENTROGRAMME  ⇄  AVION   (Phase 1 — Fondation, pur, sans React)
// ════════════════════════════════════════════════════════════════════════════
//
// Objectif (demande pilote) : « la saisie manuelle OU la saisie par graphique
// doivent être 2 éléments complémentaires arrivant à la même chose ».
//
// Ce module est le PONT canonique entre :
//   • un DOCUMENT centrogramme tracé (image calibrée + courbes par élément +
//     enveloppe Cat N/U) produit par le futur Studio graphique (Phases 2-3),
//   • et la structure AVION consommée par tout le reste de l'app : les bras de
//     levier (`arms.*`, `additionalFuelTanks[].arm`, …) et l'enveloppe de
//     centrage `cgEnvelope` (lue par src/utils/cgEnvelope.js → moteur W&B).
//
// Il ne contient AUCUNE logique d'UI ni d'I/O — uniquement des transformations
// pures, testables. Il réutilise :
//   • `linearRegression` + `convertArmUnit` de ./centrogramMath.js
//   • le contrat de forme de cgEnvelope (forwardPoints[] / aftPoints[] /
//     aftMin..aftMax / aftCG) lu par src/utils/cgEnvelope.js.
//
// Conventions d'UNITÉ en SORTIE (pivot unique = MÈTRE) :
//   • bras de levier → mètres (le moteur W&B calcule en mètres ; armUnits.js
//     normalise déjà tout >10 m). On émet donc des mètres « par construction ».
//   • CG d'enveloppe → mètres (cgEnvelope.js compare le CG calculé, en mètres,
//     aux limites de l'enveloppe SANS conversion → elles DOIVENT être en mètres).
//   • masses → kg.

import { linearRegression, convertArmUnit } from './centrogramMath';

/* ────────────────────────────────────────────────────────────────────────────
 * Types (JSDoc) — le DOCUMENT centrogramme
 *
 * @typedef {{x:number, y:number}} SamplePoint   x = masse ajoutée (kg), y = moment (armUnit·kg)
 * @typedef {{weight:number, cg:number}} EnvPoint
 *
 * @typedef {Object} CentroElement
 * @property {string}  aircraftPath  chemin avion cible (ex. 'arms.frontSeats',
 *                                    'additionalFuelTanks[0].arm') — fourni par
 *                                    buildStageList() de centrogramMath.
 * @property {string}  [type]        type logique d'élément (frontSeats, mainTank…)
 * @property {boolean} [singleValue] true = valeur unique (ex. bras à vide) plutôt
 *                                    qu'une droite à régresser.
 * @property {number}  [value]       bras direct si singleValue (dans `armUnit`).
 * @property {SamplePoint[]} [points] points cliqués sur la droite (sinon).
 * @property {('m'|'cm'|'mm'|'in')} [armUnit] unité du bras/pente de CET élément.
 *
 * @typedef {Object} CentroCategory
 * @property {string}   name         'normal' | 'utility' | libellé libre.
 * @property {string}   [color]
 * @property {EnvPoint[]} forwardPoints  limite avant (CG mini), en `cgUnit`.
 * @property {EnvPoint[]} aftPoints      limite arrière (CG maxi), en `cgUnit`.
 * @property {number}   [maxWeight]   masse maxi de la catégorie (kg).
 * @property {('m'|'cm'|'mm'|'in')} [cgUnit] unité des CG de CETTE catégorie.
 *
 * @typedef {Object} CentroDoc
 * @property {string} version
 * @property {{arm?:string, weight?:string, cg?:string}} [units] unités par défaut.
 * @property {CentroElement[]} [elements]
 * @property {{categories?:CentroCategory[], mac?:{macLength:number, lemac:number}, cgUnit?:string}} [envelope]
 * ──────────────────────────────────────────────────────────────────────────── */

/** Types d'éléments reconnus (alignés sur les stages de centrogramMath). */
export const ELEMENT_TYPES = Object.freeze({
  EMPTY: 'empty',
  FRONT_SEATS: 'frontSeats',
  REAR_SEATS: 'rearSeats',
  BAGGAGE: 'baggage',
  MAIN_TANK: 'mainTank',
  WING_TANK: 'wingTank',
  OPTIONAL_TANK: 'optionalTank',
});

const numOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const isCat = (name, ...needles) => {
  const s = String(name || '').toLowerCase();
  return needles.some((n) => s.includes(n));
};

/* ════════════════════════════════════════════════════════════════════════════
 *  1) BRAS DE LEVIER — dérivation depuis un élément tracé
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * Dérive le bras de levier (en MÈTRES) d'un élément du centrogramme.
 *   • singleValue → conversion directe de `value` (armUnit → m).
 *   • sinon       → pente de la régression linéaire des points (moment vs masse),
 *                   la pente étant exprimée en armUnit ⇒ convertie en mètres.
 *
 * @param {CentroElement} element
 * @param {{arm?:string}} [docUnits] unités par défaut du document.
 * @returns {{arm:number|null, r2:number|null, n:number, source:'single'|'regression'|'invalid'}}
 */
export function deriveArm(element, docUnits = {}) {
  const armUnit = element?.armUnit || docUnits.arm || 'm';

  if (element?.singleValue) {
    const v = numOrNull(element.value);
    if (v === null) return { arm: null, r2: null, n: 0, source: 'invalid' };
    return { arm: convertArmUnit(v, armUnit, 'm'), r2: 1, n: 1, source: 'single' };
  }

  const pts = Array.isArray(element?.points)
    ? element.points.filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
    : [];
  const reg = linearRegression(pts);
  if (!reg) return { arm: null, r2: null, n: pts.length, source: 'invalid' };

  // reg.a = pente = bras dans l'unité armUnit (y en armUnit·kg, x en kg).
  return { arm: convertArmUnit(reg.a, armUnit, 'm'), r2: reg.r2, n: reg.n, source: 'regression' };
}

/**
 * Construit la liste des affectations de bras { path, value(m), r2, source } à
 * appliquer sur l'avion (via updateData(path, value) côté UI, ou
 * applyArmAssignments() en pur). Les éléments invalides sont reportés en warnings.
 *
 * @param {CentroDoc} doc
 * @returns {{assignments:Array<{path:string, value:number, r2:number|null, source:string, type?:string}>, warnings:string[]}}
 */
export function deriveArmAssignments(doc) {
  const warnings = [];
  const assignments = [];
  const units = doc?.units || {};
  for (const el of doc?.elements || []) {
    if (!el?.aircraftPath) {
      warnings.push(`Élément sans aircraftPath ignoré (type=${el?.type ?? '?'})`);
      continue;
    }
    const { arm, r2, source } = deriveArm(el, units);
    if (arm === null) {
      warnings.push(`Bras non dérivable pour ${el.aircraftPath} (points insuffisants ou alignés sur une verticale)`);
      continue;
    }
    assignments.push({ path: el.aircraftPath, value: round(arm, 4), r2, source, type: el.type });
  }
  return { assignments, warnings };
}

/* ════════════════════════════════════════════════════════════════════════════
 *  2) ENVELOPPE DE CENTRAGE — construction au format canonique cgEnvelope
 * ════════════════════════════════════════════════════════════════════════════ */

/** Trie/filtre/convertit en mètres une liste de points {weight, cg}. */
function normEnvPoints(points, cgUnit) {
  return (points || [])
    .map((p) => ({ weight: numOrNull(p.weight), cg: numOrNull(p.cg) }))
    .filter((p) => p.weight !== null && p.weight > 0 && p.cg !== null)
    .map((p) => ({ weight: p.weight, cg: round(convertArmUnit(p.cg, cgUnit, 'm'), 4) }))
    .sort((a, b) => a.weight - b.weight);
}

/** Choisit la catégorie « principale » (celle qui alimente les champs moteur). */
function pickPrimaryCategory(categories) {
  if (!categories || categories.length === 0) return null;
  return (
    categories.find((c) => isCat(c.name, 'normal', 'normale')) ||
    categories.find((c) => !isCat(c.name, 'util')) ||
    categories[0]
  );
}

/**
 * Construit un objet `cgEnvelope` au format EXACT attendu par src/utils/cgEnvelope.js :
 *   - forwardPoints: [{weight, cg}]              (courbe avant complète)
 *   - aftPoints:     [{weight, cg}]              (courbe arrière complète — champ
 *                                                 lu en priorité par aftLimitPoints)
 *   - aftMinWeight/aftMinCG/aftMaxWeight/aftMaxCG (modèle 2-points rétro-compat)
 *   - aftCG                                       (constante legacy = aftMax)
 *   - categories: { [name]: {forwardPoints, aftPoints, maxWeight, color} } (toutes)
 *   - macLength/lemac                             (si mac fourni)
 *
 * Tous les CG sont en MÈTRES. La catégorie principale (Normal par défaut)
 * alimente les champs « plats » consommés par le moteur ; toutes les catégories
 * sont conservées sous `categories` pour le tracé dual (Cat N / Cat U).
 *
 * @param {{categories?:CentroCategory[], mac?:{macLength:number, lemac:number}, cgUnit?:string}} envelope
 * @returns {{cgEnvelope:object|null, warnings:string[]}}
 */
export function buildCgEnvelope(envelope) {
  const warnings = [];
  const cats = envelope?.categories || [];
  if (cats.length === 0) {
    return { cgEnvelope: null, warnings: ['Aucune catégorie d’enveloppe tracée'] };
  }

  const docCgUnit = envelope?.cgUnit || 'm';
  const categoriesOut = {};
  for (const c of cats) {
    const cgUnit = c.cgUnit || docCgUnit;
    categoriesOut[c.name || 'normal'] = {
      name: c.name || 'normal',
      color: c.color,
      forwardPoints: normEnvPoints(c.forwardPoints, cgUnit),
      aftPoints: normEnvPoints(c.aftPoints, cgUnit),
      maxWeight: numOrNull(c.maxWeight),
    };
  }

  const primarySrc = pickPrimaryCategory(cats);
  const primary = categoriesOut[primarySrc?.name || 'normal'];
  const fwd = primary?.forwardPoints || [];
  const aft = primary?.aftPoints || [];

  if (fwd.length === 0) warnings.push('Limite avant absente dans la catégorie principale');
  if (aft.length === 0) warnings.push('Limite arrière absente dans la catégorie principale');

  const aftMin = aft[0] || null;                 // plus petite masse
  const aftMax = aft[aft.length - 1] || null;    // plus grande masse

  const cgEnvelope = {
    forwardPoints: fwd,
    // Courbe arrière complète : lue EN PRIORITÉ par cgEnvelope.aftLimitPoints.
    aftPoints: aft,
    // Modèle 2-points + legacy (rétro-compat avec les avions/chemins existants).
    aftMinWeight: aftMin ? aftMin.weight : '',
    aftMinCG: aftMin ? aftMin.cg : '',
    aftMaxWeight: aftMax ? aftMax.weight : '',
    aftMaxCG: aftMax ? aftMax.cg : '',
    aftCG: aftMax ? aftMax.cg : (aftMin ? aftMin.cg : ''),
    categories: categoriesOut,
  };

  if (envelope?.mac) {
    const macLength = numOrNull(envelope.mac.macLength);
    const lemac = numOrNull(envelope.mac.lemac);
    if (macLength !== null) cgEnvelope.macLength = macLength;
    if (lemac !== null) cgEnvelope.lemac = lemac;
  }

  return { cgEnvelope, warnings };
}

/* ════════════════════════════════════════════════════════════════════════════
 *  3) DOC COMPLET → PATCH AVION   (« à la validation de tous les bras → enveloppe »)
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * Convertit un document centrogramme complet en patch avion prêt à appliquer.
 * @param {CentroDoc} doc
 * @returns {{armAssignments:Array, cgEnvelope:object|null, warnings:string[]}}
 */
export function centrogramToAircraft(doc) {
  const { assignments, warnings: aw } = deriveArmAssignments(doc);
  const { cgEnvelope, warnings: ew } = buildCgEnvelope(doc?.envelope || {});
  return { armAssignments: assignments, cgEnvelope, warnings: [...aw, ...ew] };
}

/**
 * Applique une liste d'affectations { path, value } sur un objet cible (pur,
 * immutable). Gère les chemins `a.b` et `a[i].b`. Sert au test et à un usage
 * hors-React ; côté UI on préfèrera updateData(path, value) un par un.
 *
 * @param {object} target
 * @param {Array<{path:string, value:any}>} assignments
 * @returns {object} nouvelle copie de target avec les valeurs posées.
 */
export function applyArmAssignments(target, assignments) {
  const out = JSON.parse(JSON.stringify(target || {}));
  for (const { path, value } of assignments || []) {
    setByPath(out, path, value);
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════════════════
 *  4) PONT INVERSE — AVION → ÉBAUCHE de document (pour ré-édition / Phase 3)
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * Construit une ébauche de document centrogramme à partir d'un avion existant :
 * pré-remplit l'enveloppe (catégorie principale) avec ce qui est déjà saisi à la
 * main, pour que le Studio graphique ouvre sur l'état courant (bidirectionnel).
 *
 * @param {object} aircraft
 * @returns {CentroDoc}
 */
export function aircraftToCentrogramScaffold(aircraft) {
  const env = aircraft?.cgEnvelope || {};
  const forwardPoints = (env.forwardPoints || [])
    .map((p) => ({ weight: numOrNull(p.weight), cg: numOrNull(p.cg) }))
    .filter((p) => p.weight !== null && p.cg !== null);

  // Limite arrière : courbe complète si dispo, sinon modèle 2-points.
  let aftPoints = (env.aftPoints || [])
    .map((p) => ({ weight: numOrNull(p.weight), cg: numOrNull(p.cg) }))
    .filter((p) => p.weight !== null && p.cg !== null);
  if (aftPoints.length === 0) {
    const two = [
      { weight: numOrNull(env.aftMinWeight), cg: numOrNull(env.aftMinCG) },
      { weight: numOrNull(env.aftMaxWeight), cg: numOrNull(env.aftMaxCG) },
    ].filter((p) => p.weight !== null && p.cg !== null);
    aftPoints = two;
  }

  return {
    version: '1.0',
    units: { arm: 'm', weight: 'kg', cg: 'm' },
    elements: [],
    envelope: {
      cgUnit: 'm',
      categories: forwardPoints.length || aftPoints.length
        ? [{ name: 'normal', forwardPoints, aftPoints }]
        : [],
    },
  };
}

/* ──────────────────────────── helpers internes ──────────────────────────── */

function round(n, dp) {
  if (!Number.isFinite(n)) return n;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Pose value au chemin `a.b` ou `a[i].b` dans obj (mutation interne). */
function setByPath(obj, path, value) {
  const tokens = String(path)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let cur = obj;
  for (let i = 0; i < tokens.length - 1; i++) {
    const k = tokens[i];
    const nextIsIndex = /^\d+$/.test(tokens[i + 1]);
    if (cur[k] === null || cur[k] === undefined) cur[k] = nextIsIndex ? [] : {};
    cur = cur[k];
  }
  cur[tokens[tokens.length - 1]] = value;
}

export const __test__ = { setByPath, normEnvPoints, pickPrimaryCategory };
