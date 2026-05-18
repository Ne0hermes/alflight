// src/utils/performanceSafetyFactor.js
//
// Facteurs de sécurité réglementaires appliqués OPTIONNELLEMENT et UNIQUEMENT
// à l'AFFICHAGE des distances de performance dans le module pilote.
//
// Principe (validé par le pilote) :
//   - Les calculs et les sorties des abaques/tableaux sont STRICTEMENT issus
//     du MANEX (× 1.0). Aucune marge n'est appliquée pendant l'extraction
//     ni pendant l'interpolation.
//   - Au moment de la préparation de vol, le pilote PROPOSE optionnellement
//     un facteur dans le module Performance. Le facteur est appliqué dans
//     le RENDU de la matrice de couverture, mais la valeur brute est
//     toujours visible et utilisée comme base.
//
// Le facteur ne s'applique qu'aux opérations dont la grandeur de sortie
// est une distance (`outputKind === 'distance'`). Les vitesses, taux de
// montée, et angles ne se multiplient pas par sécurité.

import { OPERATION_CATALOG } from '../abac/curves/core/operationCatalog';

/** Presets réglementaires courants en VFR/IFR/CAT (référence : SERA, EU-OPS, EASA). */
export const SAFETY_FACTOR_PRESETS = [
  {
    id: 'raw',
    value: 1.0,
    label: 'Brut MANEX (sans marge)',
    description: 'Valeurs strictement issues du MANEX. Aucun facteur appliqué.'
  },
  {
    id: 'vfr_private',
    value: 1.15,
    label: 'VFR privé (× 1.15)',
    description: 'Marge recommandée VFR privé hors transport public.'
  },
  {
    id: 'ifr_cat_easa',
    value: 1.43,
    label: 'IFR / CAT EASA (× 1.43)',
    description: 'Transport aérien commercial CAT (EU-OPS Part-CAT.POL).'
  },
  {
    id: 'public_transport',
    value: 1.67,
    label: 'Transport public (× 1.67)',
    description: 'Atterrissage public transport avec piste humide / glissante.'
  }
];

/** Lookup rapide par id. */
export const SAFETY_FACTOR_BY_ID = SAFETY_FACTOR_PRESETS.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {});

/** Preset par défaut : brut MANEX, aucune marge. */
export const DEFAULT_SAFETY_FACTOR = SAFETY_FACTOR_PRESETS[0];

/**
 * Indique si une opération produit une grandeur de type "distance" (qui se
 * multiplie par un facteur de sécurité), par opposition aux vitesses,
 * taux de montée, etc.
 *
 * @param {string} operationId  id du catalogue canonique
 * @returns {boolean}
 */
export function isDistanceOperation(operationId) {
  if (!operationId) return false;
  const op = OPERATION_CATALOG.find(o => o.id === operationId);
  if (!op) return false;
  // Une opération est "distance" si toutes ses sorties acceptées sont en distance
  // (ou au moins l'unique sortie acceptée si elle n'en a qu'une).
  return op.acceptedOutputs.every(o => o.kind === 'distance');
}

/**
 * Applique un facteur de sécurité à une valeur de distance.
 * Retourne la valeur brute si l'opération n'est pas une distance ou si
 * le facteur ≤ 1 (no-op).
 *
 * @param {number} rawValue       Valeur brute MANEX
 * @param {string} operationId    id catalogue (pour décider si applicable)
 * @param {number} factor         Multiplicateur (1.0 = pas de marge)
 * @returns {number}              Valeur avec marge appliquée (ou brute si non applicable)
 */
export function applySafetyFactor(rawValue, operationId, factor) {
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) return rawValue;
  if (typeof factor !== 'number' || !Number.isFinite(factor) || factor <= 1) return rawValue;
  if (!isDistanceOperation(operationId)) return rawValue;
  return rawValue * factor;
}

/** Récupère un preset par id, fallback sur DEFAULT_SAFETY_FACTOR. */
export function getSafetyFactor(id) {
  return SAFETY_FACTOR_BY_ID[id] || DEFAULT_SAFETY_FACTOR;
}
