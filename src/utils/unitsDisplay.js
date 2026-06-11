// src/utils/unitsDisplay.js
//
// ════════════════════════════════════════════════════════════════════════
// HELPER CENTRAL POUR LES UNITÉS — point unique de conversion display/saisie
// ════════════════════════════════════════════════════════════════════════
//
// PRINCIPE ARCHITECTURAL :
//   - Toutes les valeurs en mémoire (Zustand, React state, IndexedDB) sont
//     EXCLUSIVEMENT en UNITÉS CANONIQUES (cf. CANONICAL_UNITS ci-dessous).
//   - Les unités utilisateur (préférences) ne servent QUE :
//       1. À l'AFFICHAGE (convertir canonique → user pref)
//       2. À la SAISIE temporaire dans un input (avant écriture dans le state,
//          on convertit user pref → canonique)
//   - Aucune valeur du state ne doit JAMAIS être en unité utilisateur.
//   - Aucune valeur Supabase ne doit JAMAIS être en unité utilisateur.
//
// CONVENTION D'USAGE :
//   - Pour AFFICHER une valeur :       useDisplayValue(canonicalValue, category)
//   - Pour SAISIR/ÉDITER une valeur :  useEditableValue(canonicalValue, category, onChange)
//   - Pour calculer (purement) :       toUserUnit / toCanonical (sans hook)

import { useMemo } from 'react';
import { useUnitsStore } from '@core/stores/unitsStore';
import { convertValue, getUnitSymbol } from './unitConversions';

// ─── UNITÉS CANONIQUES (gravées dans le marbre) ──────────────────────────
//
// Ces unités sont celles utilisées EN MÉMOIRE et SUR SUPABASE.
// Modifier ce tableau impactera l'app entière — ne pas changer sans migration.
export const CANONICAL_UNITS = {
  weight:           'kg',     // Système International
  armLength:        'm',      // C3.1 — pivot unique = MÈTRE (aligné sur le moteur
                              // de centrage, les golden tests, le CentrogramReader
                              // et le normaliseur d'import ; cf. audit ANO-1)
  fuel:             'ltr',    // SI métrique
  fuelConsumption:  'lph',    // SI métrique
  speed:            'kt',     // Standard aviation mondial
  windSpeed:        'kt',     // idem
  altitude:         'ft',     // Standard aviation mondial
  runway:           'm',      // Standard métrique européen (NM ferait inadapté)
  temperature:      'C',      // SI
  distance:         'nm',     // Standard aviation mondial
  pressure:         'hPa',    // OACI
  visibility:       'km',     // SI
  fuelCapacity:     'ltr',    // alias de fuel (compat)
};

/**
 * Retourne l'unité canonique d'une catégorie. Throw si la catégorie n'existe pas
 * (pour éviter les erreurs silencieuses).
 */
export function getCanonicalUnit(category) {
  const u = CANONICAL_UNITS[category];
  if (!u) {
    console.warn(`[unitsDisplay] Catégorie inconnue: ${category}`);
    return null;
  }
  return u;
}

/**
 * Convertit une valeur CANONIQUE vers l'unité utilisateur (pour affichage).
 *
 * @param {number|string} canonicalValue - Valeur stockée en canonique
 * @param {string}        category       - 'weight', 'armLength', 'fuel', etc.
 * @param {string}        userUnit       - Unité de préférence user (ex: 'kg', 'mm')
 * @returns {number|null} Valeur convertie ou null si invalide
 */
export function toUserUnit(canonicalValue, category, userUnit) {
  if (canonicalValue === '' || canonicalValue === null || canonicalValue === undefined) {
    return null;
  }
  const num = typeof canonicalValue === 'number' ? canonicalValue : parseFloat(canonicalValue);
  if (!Number.isFinite(num)) return null;

  const canonical = getCanonicalUnit(category);
  if (!canonical || canonical === userUnit) return num;

  try {
    const out = convertValue(num, canonical, userUnit, category);
    // Fail-closed (ANO-4) : jamais le nombre brut dans la mauvaise unité.
    return Number.isFinite(out) ? out : null;
  } catch (e) {
    console.warn(`[unitsDisplay.toUserUnit] Conversion refusée (fail-closed)`, { canonicalValue, category, userUnit, error: e.message });
    return null;
  }
}

/**
 * Convertit une valeur UTILISATEUR vers l'unité canonique (pour storage).
 *
 * @param {number|string} userValue - Valeur en unité utilisateur (depuis input)
 * @param {string}        category  - 'weight', 'armLength', 'fuel', etc.
 * @param {string}        userUnit  - Unité de préférence user
 * @returns {number|null} Valeur canonique ou null si invalide
 */
export function toCanonical(userValue, category, userUnit) {
  if (userValue === '' || userValue === null || userValue === undefined) {
    return null;
  }
  const num = typeof userValue === 'number' ? userValue : parseFloat(userValue);
  if (!Number.isFinite(num)) return null;

  const canonical = getCanonicalUnit(category);
  if (!canonical || canonical === userUnit) return num;

  try {
    const out = convertValue(num, userUnit, canonical, category);
    // Fail-closed (ANO-4) : jamais le nombre brut dans la mauvaise unité.
    return Number.isFinite(out) ? out : null;
  } catch (e) {
    console.warn(`[unitsDisplay.toCanonical] Conversion refusée (fail-closed)`, { userValue, category, userUnit, error: e.message });
    return null;
  }
}

/**
 * Hook React : pour AFFICHER une valeur canonique dans l'unité utilisateur.
 *
 * @param {number|string} canonicalValue - Valeur en canonique (depuis state)
 * @param {string}        category       - 'weight', 'armLength', etc.
 * @param {object}        options
 * @param {number}        options.decimals - Nombre de décimales (auto si omis)
 * @param {boolean}       options.both     - Si true, fournit aussi l'autre unité courante (gal/L)
 *
 * @returns {object} { value, valueText, unit, symbol, formatted, both, canonical }
 *   - value     : valeur convertie (Number)
 *   - valueText : string formatée avec decimals (sans unité)
 *   - unit      : code unité user (ex: 'kg', 'gph')
 *   - symbol    : symbole d'affichage (peut différer du code)
 *   - formatted : string complète "12.5 kg"
 *   - both      : si options.both, string "35 L/h (9.2 gal/h)"
 *   - canonical : valeur canonique d'origine
 */
export function useDisplayValue(canonicalValue, category, options = {}) {
  const units = useUnitsStore(state => state.units);
  const userUnit = units?.[category];

  return useMemo(() => {
    const canonical = getCanonicalUnit(category);
    if (!canonical) {
      return { value: null, valueText: '', unit: '', symbol: '', formatted: '', both: '', canonical: canonicalValue };
    }

    const converted = toUserUnit(canonicalValue, category, userUnit);
    const symbol = getUnitSymbol(userUnit || canonical);
    const decimals = options.decimals ?? getDefaultDecimals(category, userUnit);

    const valueText = converted === null ? '' : converted.toFixed(decimals);
    const formatted = converted === null ? '—' : `${valueText} ${symbol}`;

    // Double affichage : afficher l'autre unité usuelle en parenthèses
    let both = formatted;
    if (options.both && converted !== null) {
      const altUnit = getAlternativeUnit(category, userUnit);
      if (altUnit && altUnit !== userUnit) {
        const altValue = toUserUnit(canonicalValue, category, altUnit);
        const altSymbol = getUnitSymbol(altUnit);
        const altDecimals = getDefaultDecimals(category, altUnit);
        if (altValue !== null) {
          both = `${valueText} ${symbol} (${altValue.toFixed(altDecimals)} ${altSymbol})`;
        }
      }
    }

    return {
      value: converted,
      valueText,
      unit: userUnit || canonical,
      symbol,
      formatted,
      both,
      canonical: canonicalValue
    };
  }, [canonicalValue, category, userUnit, options.decimals, options.both]);
}

/**
 * Hook React : pour ÉDITER une valeur canonique avec saisie en unité user.
 *
 * @param {number|string} canonicalValue - Valeur en canonique (depuis state)
 * @param {string}        category       - 'weight', 'armLength', etc.
 * @param {function}      onChange       - Callback appelé avec la nouvelle valeur EN CANONIQUE
 * @param {object}        options
 *
 * @returns {object} { displayValue, displayUnit, symbol, handleChange, ...display }
 *   - displayValue : valeur à mettre dans le TextField (en unité user)
 *   - displayUnit  : symbole à afficher en endAdornment
 *   - handleChange : (event ou rawString) => convertit et appelle onChange(canonical)
 *   - + tout ce que retourne useDisplayValue
 */
export function useEditableValue(canonicalValue, category, onChange, options = {}) {
  const units = useUnitsStore(state => state.units);
  const userUnit = units?.[category];
  const display = useDisplayValue(canonicalValue, category, options);

  const handleChange = (eventOrValue) => {
    const raw = typeof eventOrValue === 'object' && eventOrValue?.target
      ? eventOrValue.target.value
      : eventOrValue;

    if (raw === '' || raw === null || raw === undefined) {
      onChange(null);
      return;
    }

    const canonical = toCanonical(raw, category, userUnit);
    onChange(canonical);
  };

  return {
    ...display,
    displayValue: display.valueText,
    displayUnit: display.symbol,
    handleChange
  };
}

/**
 * Détermine le nombre de décimales par défaut pour un couple (catégorie, unité).
 * Vise un affichage lisible sans excès de précision.
 */
function getDefaultDecimals(category, unit) {
  // Bras de levier : 0 décimale en mm, 1 en cm, 4 en m, 2 en inches
  if (category === 'armLength') {
    if (unit === 'mm') return 0;
    if (unit === 'cm') return 1;
    if (unit === 'm') return 4;
    if (unit === 'in') return 2;
    return 1;
  }
  // Poids : 1 décimale (kg, lbs)
  if (category === 'weight') return 1;
  // Carburant : 1 décimale
  if (category === 'fuel' || category === 'fuelCapacity') return 1;
  if (category === 'fuelConsumption') return 1;
  // Vitesses : 0 décimale (entiers en kt)
  if (category === 'speed' || category === 'windSpeed') return 0;
  // Altitude : 0 décimale
  if (category === 'altitude') return 0;
  // Température : 0 décimale (entier en °C)
  if (category === 'temperature') return 0;
  // Distance : 1 décimale (NM)
  if (category === 'distance') return 1;
  // Pression : 0 décimale (hPa)
  if (category === 'pressure') return 0;
  return 2;
}

/**
 * Retourne l'unité "alternative" usuelle pour une catégorie, à utiliser
 * pour le double affichage. Ex: si user pref = lph, retourne gph (et vice versa).
 */
function getAlternativeUnit(category, userUnit) {
  const alternatives = {
    fuel:            { ltr: 'gal',  gal: 'ltr', kg: 'ltr', lbs: 'gal' },
    fuelCapacity:    { ltr: 'gal',  gal: 'ltr', kg: 'ltr', lbs: 'gal' },
    fuelConsumption: { lph: 'gph',  gph: 'lph' },
    weight:          { kg: 'lbs',   lbs: 'kg' },
    armLength:       { mm: 'in',    cm: 'in',   m: 'ft',  in: 'mm' },
    speed:           { kt: 'kmh',   kmh: 'kt',  mph: 'kt', 'm/s': 'kt' },
    windSpeed:       { kt: 'kmh',   kmh: 'kt',  mph: 'kt' },
    altitude:        { ft: 'm',     m: 'ft' },
    runway:          { m: 'ft',     ft: 'm' },
    temperature:     { C: 'F',      F: 'C' },
    distance:        { nm: 'km',    km: 'nm',   mi: 'nm' },
    pressure:        { hPa: 'inHg', inHg: 'hPa', mb: 'hPa' },
    visibility:      { km: 'sm',    sm: 'km' }
  };
  return alternatives[category]?.[userUnit] || null;
}

/**
 * Helper pour formater rapidement une valeur canonique sans hook React.
 * Utile pour les exports PDF, logs console, etc.
 *
 * @param {number}  canonicalValue
 * @param {string}  category
 * @param {object}  units      - Objet units du store
 * @param {object}  options    - { decimals, both }
 * @returns {string} ex: "35.0 L/h" ou "35.0 L/h (9.2 gal/h)"
 */
export function formatCanonical(canonicalValue, category, units, options = {}) {
  if (canonicalValue === '' || canonicalValue === null || canonicalValue === undefined) {
    return '—';
  }
  const userUnit = units?.[category];
  const canonical = getCanonicalUnit(category);
  if (!canonical) return String(canonicalValue);

  const converted = toUserUnit(canonicalValue, category, userUnit);
  if (converted === null) return '—';

  const symbol = getUnitSymbol(userUnit || canonical);
  const decimals = options.decimals ?? getDefaultDecimals(category, userUnit);
  const main = `${converted.toFixed(decimals)} ${symbol}`;

  if (!options.both) return main;

  const altUnit = getAlternativeUnit(category, userUnit);
  if (!altUnit || altUnit === userUnit) return main;

  const altValue = toUserUnit(canonicalValue, category, altUnit);
  if (altValue === null) return main;
  const altSymbol = getUnitSymbol(altUnit);
  const altDecimals = getDefaultDecimals(category, altUnit);
  return `${main} (${altValue.toFixed(altDecimals)} ${altSymbol})`;
}

// ─── Re-export pratique pour les imports ────────────────────────────────
export { getUnitSymbol, convertValue };
