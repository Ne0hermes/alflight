// src/utils/fuelDensity.js
//
// SOURCE UNIQUE de la densité carburant (kg/L) pour toute l'application.
// Les valeurs proviennent EXCLUSIVEMENT de constants.js (FUEL_DENSITIES).
// Élimine les anciennes tables divergentes — anomalie A1 de l'audit :
//   - unitConversions.js : JET_A1 = 0.80 (faux)
//   - mbUnits.js         : 'JET-A1' = 0.80, MOGAS = 0.74 (faux)
//
// P0 (zéro fallback silencieux) : getFuelDensity renvoie `null` si le type est
// inconnu ou absent. L'appelant décide explicitement (alarme MISSING_INPUT en
// Phase 4, ou recours conservateur temporaire `?? 0.84` côté masse/centrage).

import { FUEL_DENSITIES } from './constants';

// Normalisation des variantes de nomenclature vers les clés canoniques.
const ALIASES = {
  'JET A-1': 'JET A-1', 'JET-A1': 'JET A-1', 'JET A1': 'JET A-1',
  'JET-A': 'JET A-1', 'JET A': 'JET A-1', 'JETA1': 'JET A-1', 'JET': 'JET A-1',
  'AVGAS 100LL': 'AVGAS 100LL', 'AVGAS': 'AVGAS 100LL',
  'AVGAS100LL': 'AVGAS 100LL', '100LL': 'AVGAS 100LL',
  'MOGAS': 'MOGAS', 'MOGAS UL91': 'MOGAS', 'UL91': 'MOGAS',
};

/**
 * Densité carburant canonique en kg/L.
 * @param {string} fuelType  Type de carburant (variantes d'orthographe tolérées).
 * @returns {number|null}    Densité kg/L, ou null si type inconnu/absent (P0).
 */
export function getFuelDensity(fuelType) {
  if (fuelType == null || fuelType === '') return null;
  const raw = String(fuelType).trim();
  const key = ALIASES[raw] ?? ALIASES[raw.toUpperCase()] ?? raw;
  const d = FUEL_DENSITIES[key];
  return typeof d === 'number' ? d : null;
}
