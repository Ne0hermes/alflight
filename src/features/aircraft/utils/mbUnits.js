// src/features/aircraft/utils/mbUnits.js
//
// HELPER CENTRALISÉ pour les unités du module Masse & Centrage.
//
// Toutes les valeurs M&C sont stockées dans une unité CANONIQUE INTERNE :
//   - weight       → kg
//   - armLength    → mm  (préférence par défaut Europe)
//   - fuel         → L
//   - moment       → kg·mm (masse_canonique × longueur_canonique)
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

// ─── Unités canoniques internes (storage) ──────────────────────────────────
export const STORAGE_UNITS = {
  weight: 'kg',
  armLength: 'mm',  // ← préférence utilisateur par défaut
  fuel: 'ltr',
  speed: 'kt',
  fuelConsumption: 'lph',
  altitude: 'ft',
  temperature: 'C',
  runway: 'm'
};

// ─── Densités carburant standard (kg/L) ────────────────────────────────────
export const FUEL_DENSITIES = {
  AVGAS: 0.72,    // AVGAS 100LL
  'JET-A1': 0.80, // JET A-1
  MOGAS: 0.74,    // MOGAS UL91, essence auto
  default: 0.72   // fallback (suppose AVGAS)
};

/**
 * Convertit une valeur depuis l'unité de l'utilisateur vers l'unité canonique
 * (pour stockage dans le store).
 *
 * @param {number|string} value    Valeur en unité utilisateur
 * @param {string}        userUnit Unité utilisateur (ex: 'mm', 'cm', 'kg')
 * @param {string}        category Catégorie (armLength, weight, fuel, …)
 * @returns {number|null}          Valeur en unité canonique, ou null si invalide
 */
export function toStorage(value, userUnit, category) {
  if (value === '' || value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(num)) return null;
  const targetUnit = STORAGE_UNITS[category];
  if (!targetUnit || userUnit === targetUnit) return num;
  try {
    return convertValue(num, userUnit, targetUnit, category);
  } catch (e) {
    console.warn(`[mbUnits.toStorage] Conversion failed`, { value, userUnit, category, error: e.message });
    return num;
  }
}

/**
 * Convertit une valeur depuis l'unité canonique (storage) vers l'unité de
 * l'utilisateur (pour affichage dans un TextField).
 *
 * @param {number|string} storedValue Valeur en unité canonique
 * @param {string}        userUnit    Unité utilisateur (ex: 'mm', 'cm', 'kg')
 * @param {string}        category    Catégorie (armLength, weight, fuel, …)
 * @returns {number|''}               Valeur en unité utilisateur, ou '' si invalide
 */
export function fromStorage(storedValue, userUnit, category) {
  if (storedValue === '' || storedValue === null || storedValue === undefined) return '';
  const num = typeof storedValue === 'number' ? storedValue : parseFloat(storedValue);
  if (!Number.isFinite(num)) return '';
  const sourceUnit = STORAGE_UNITS[category];
  if (!sourceUnit || userUnit === sourceUnit) return num;
  try {
    return convertValue(num, sourceUnit, userUnit, category);
  } catch (e) {
    console.warn(`[mbUnits.fromStorage] Conversion failed`, { storedValue, userUnit, category, error: e.message });
    return num;
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
 * et canonique. Le moment canonique est kg·mm.
 *
 * @param {number}   storedMoment   Moment en kg·mm
 * @param {object}   units          Préférences utilisateur
 * @param {string}   direction      'fromStorage' (kg·mm → user) ou 'toStorage' (user → kg·mm)
 * @returns {number}
 */
export function convertMoment(value, units, direction) {
  if (!Number.isFinite(value)) return value;
  const userWeight = units.weight || 'kg';
  const userArm = units.armLength || 'mm';

  if (direction === 'fromStorage') {
    // kg·mm → userWeight × userArm
    // moment = mass × arm. Si on change d'unités : moment_user = moment_kgmm × (kg→userWeight) × (mm→userArm)
    const wRatio = convertValue(1, 'kg', userWeight, 'weight');
    const aRatio = convertValue(1, 'mm', userArm, 'armLength');
    return value * wRatio * aRatio;
  } else {
    // userWeight × userArm → kg·mm
    const wRatio = convertValue(1, userWeight, 'kg', 'weight');
    const aRatio = convertValue(1, userArm, 'mm', 'armLength');
    return value * wRatio * aRatio;
  }
}

/**
 * Helper : densité du carburant selon le type sélectionné dans l'avion.
 * @param {string} fuelType - 'AVGAS', 'JET-A1', 'MOGAS', ou autre
 * @returns {number} densité en kg/L
 */
export function getFuelDensity(fuelType) {
  return FUEL_DENSITIES[fuelType] || FUEL_DENSITIES.default;
}

/**
 * Calcul dynamique 2-sur-3 : étant donné deux des trois valeurs (masse, bras,
 * moment), retourne la troisième.
 *
 * Toutes les valeurs sont en unité CANONIQUE (kg, mm, kg·mm).
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
