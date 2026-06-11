// src/features/aircraft/utils/mbUnits.js
//
// HELPER CENTRALISÉ pour les unités du module Masse & Centrage.
//
// Toutes les valeurs M&C sont stockées dans une unité CANONIQUE INTERNE :
//   - weight       → kg
//   - armLength    → m   (C3.1 : pivot unique = MÈTRE — aligné sur le moteur de
//                         centrage, les golden tests, le CentrogramReader et le
//                         normaliseur d'import ; l'ancien contrat 'mm' n'était
//                         honoré par personne — cf. AUDIT_MASSE_CENTRAGE_UNITES.md ANO-1)
//   - fuel         → L
//   - moment       → kg·m (masse_canonique × longueur_canonique)
//
// L'affichage et la saisie passent toujours par les préférences utilisateur
// (units du store unitsStore). Conversion auto via convertValue.
//
// Règles d'or :
//   1. Plus jamais d'unité hard-codée dans un composant
//   2. Toujours passer par toStorage() avant updateData()
//   3. Toujours passer par fromStorage() avant d'afficher dans un TextField
//   4. getUnitLabel(category) pour afficher le symbole (mm, kg, L…)

import { convertValue, getUnitSymbol } from '@utils/unitConversions';
import { FUEL_DENSITIES as CANON } from '@utils/constants';
import { getFuelDensity as canonicalFuelDensity } from '@utils/fuelDensity';

// ─── Unités canoniques internes (storage) ──────────────────────────────────
export const STORAGE_UNITS = {
  weight: 'kg',
  armLength: 'm',   // C3.1 — pivot unique = mètre (voir en-tête)
  fuel: 'ltr',
  speed: 'kt',
  fuelConsumption: 'lph',
  altitude: 'ft',
  temperature: 'C',
  runway: 'm'
};

// ─── Densités carburant (kg/L) — SOURCE UNIQUE : constants.js (anomalie A1) ──
// Schéma de clés courtes conservé pour rétro-compat ; VALEURS issues de l'unique
// table canonique (plus de 0.80 Jet ni 0.74 MOGAS divergents).
export const FUEL_DENSITIES = {
  AVGAS: CANON['AVGAS 100LL'],   // 0.72
  'JET-A1': CANON['JET A-1'],    // 0.84 (était 0.80)
  MOGAS: CANON['MOGAS'],         // 0.72 (était 0.74)
  default: CANON['AVGAS 100LL']  // 0.72
};

/**
 * Convertit une valeur depuis l'unité de l'utilisateur vers l'unité canonique
 * (pour stockage dans le store).
 *
 * @param {number|string} value    Valeur en unité utilisateur
 * @param {string}        userUnit Unité utilisateur (ex: 'mm', 'cm', 'kg')
 * @param {string}        category Catégorie (armLength, weight, fuel, …)
 * @param {object}        [opts]   Options convertValue (ex: { density } pour fuel)
 * @returns {number|null}          Valeur en unité canonique, ou null si invalide/inconvertible
 */
export function toStorage(value, userUnit, category, opts = {}) {
  if (value === '' || value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(num)) return null;
  const targetUnit = STORAGE_UNITS[category];
  if (!targetUnit || userUnit === targetUnit) return num;
  try {
    const out = convertValue(num, userUnit, targetUnit, category, opts);
    // C1.3 (ANO-4) : fail-closed — une conversion impossible ne produit JAMAIS
    // une valeur dans la mauvaise unité. null ⇒ champ invalide, verdict bloqué.
    return Number.isFinite(out) ? out : null;
  } catch (e) {
    console.warn(`[mbUnits.toStorage] Conversion refusée (fail-closed)`, { value, userUnit, category, error: e.message });
    return null;
  }
}

/**
 * Convertit une valeur depuis l'unité canonique (storage) vers l'unité de
 * l'utilisateur (pour affichage dans un TextField).
 *
 * @param {number|string} storedValue Valeur en unité canonique
 * @param {string}        userUnit    Unité utilisateur (ex: 'mm', 'cm', 'kg')
 * @param {string}        category    Catégorie (armLength, weight, fuel, …)
 * @param {object}        [opts]      Options convertValue (ex: { density } pour fuel)
 * @returns {number|''}               Valeur en unité utilisateur, ou '' si invalide/inconvertible
 */
export function fromStorage(storedValue, userUnit, category, opts = {}) {
  if (storedValue === '' || storedValue === null || storedValue === undefined) return '';
  const num = typeof storedValue === 'number' ? storedValue : parseFloat(storedValue);
  if (!Number.isFinite(num)) return '';
  const sourceUnit = STORAGE_UNITS[category];
  if (!sourceUnit || userUnit === sourceUnit) return num;
  try {
    const out = convertValue(num, sourceUnit, userUnit, category, opts);
    // C1.3 (ANO-4) : fail-closed — jamais le nombre brut dans la mauvaise unité.
    return Number.isFinite(out) ? out : '';
  } catch (e) {
    console.warn(`[mbUnits.fromStorage] Conversion refusée (fail-closed)`, { storedValue, userUnit, category, error: e.message });
    return '';
  }
}

/**
 * Retourne le symbole d'affichage pour une catégorie, selon les préférences
 * utilisateur.
 *
 * @param {object} units    Objet units du unitsStore (units = state.units)
 * @param {string} category Catégorie (armLength, weight, fuel, moment, …)
 * @returns {string}        Symbole UI (ex: 'mm', 'kg', 'L', 'kg·mm')
 */
export function getMBUnitSymbol(units, category) {
  if (category === 'moment') {
    // Moment = masse × longueur. Compose à partir des préférences.
    const w = getUnitSymbol(units.weight || 'kg');
    const a = getUnitSymbol(units.armLength || 'mm');
    return `${w}·${a}`;
  }
  const userUnit = units?.[category];
  if (!userUnit) return '';
  return getUnitSymbol(userUnit);
}

/**
 * Convertit une valeur de moment (masse × longueur) entre unités utilisateur
 * et canonique. Le moment canonique = STORAGE_UNITS.weight × STORAGE_UNITS.armLength
 * (kg·m) — toujours dérivé du pivot, jamais codé en dur.
 *
 * @param {number}   value          Moment
 * @param {object}   units          Préférences utilisateur
 * @param {string}   direction      'fromStorage' (kg·m → user) ou 'toStorage' (user → kg·m)
 * @returns {number}
 */
export function convertMoment(value, units, direction) {
  if (!Number.isFinite(value)) return value;
  const userWeight = units.weight || STORAGE_UNITS.weight;
  const userArm = units.armLength || STORAGE_UNITS.armLength;

  if (direction === 'fromStorage') {
    // canonique → userWeight × userArm
    const wRatio = convertValue(1, STORAGE_UNITS.weight, userWeight, 'weight');
    const aRatio = convertValue(1, STORAGE_UNITS.armLength, userArm, 'armLength');
    return value * wRatio * aRatio;
  } else {
    // userWeight × userArm → canonique
    const wRatio = convertValue(1, userWeight, STORAGE_UNITS.weight, 'weight');
    const aRatio = convertValue(1, userArm, STORAGE_UNITS.armLength, 'armLength');
    return value * wRatio * aRatio;
  }
}

/**
 * Helper : densité du carburant selon le type sélectionné dans l'avion.
 * @param {string} fuelType - 'AVGAS', 'JET-A1', 'MOGAS', ou autre
 * @returns {number} densité en kg/L
 */
export function getFuelDensity(fuelType) {
  // Source unique + normalisation des alias ('JET A-1' vs 'JET-A1'…).
  return canonicalFuelDensity(fuelType) ?? FUEL_DENSITIES.default;
}

/**
 * Calcul dynamique 2-sur-3 : étant donné deux des trois valeurs (masse, bras,
 * moment), retourne la troisième.
 *
 * Toutes les valeurs sont en unité CANONIQUE (kg, m, kg·m).
 *
 * @param {object} values - { mass, arm, moment } — au moins 2 doivent être Number
 * @returns {object} - { mass, arm, moment } complétés ; ou null si moins de 2 valeurs
 */
export function compute2of3({ mass, arm, moment }) {
  const m = Number.isFinite(mass)   ? mass   : null;
  const a = Number.isFinite(arm)    ? arm    : null;
  const M = Number.isFinite(moment) ? moment : null;

  const count = [m !== null, a !== null, M !== null].filter(Boolean).length;
  if (count < 2) return null;

  if (m !== null && a !== null && M === null) return { mass: m, arm: a, moment: m * a };
  if (m !== null && M !== null && a === null) return m === 0 ? null : { mass: m, arm: M / m, moment: M };
  if (a !== null && M !== null && m === null) return a === 0 ? null : { mass: M / a, arm: a, moment: M };
  // count === 3 : retourner tel quel sans recalculer
  return { mass: m, arm: a, moment: M };
}
