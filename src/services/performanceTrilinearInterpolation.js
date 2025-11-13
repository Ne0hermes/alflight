// src/services/performanceTrilinearInterpolation.js

/**
 * Interpolation linéaire simple entre deux points
 */
function linearInterpolate(x1, y1, x2, y2, x) {
  if (Math.abs(x2 - x1) < 0.001) return y1;
  return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
}

/**
 * Trouve les indices encadrants pour une valeur dans un tableau trié
 * @param {Array} arr - Tableau trié de valeurs
 * @param {number} target - Valeur cible
 * @returns {Object} {low, high, exactMatch}
 */
function findBracketingIndices(arr, target) {
  if (!arr || arr.length === 0) {
    return { low: 0, high: 0, exactMatch: false };
  }

  // Vérifier les limites
  if (target <= arr[0]) {
    return { low: 0, high: 0, exactMatch: Math.abs(target - arr[0]) < 0.001 };
  }

  if (target >= arr[arr.length - 1]) {
    const idx = arr.length - 1;
    return { low: idx, high: idx, exactMatch: Math.abs(target - arr[idx]) < 0.001 };
  }

  // Recherche binaire
  for (let i = 0; i < arr.length - 1; i++) {
    if (Math.abs(arr[i] - target) < 0.001) {
      return { low: i, high: i, exactMatch: true };
    }

    if (arr[i] < target && target < arr[i + 1]) {
      return { low: i, high: i + 1, exactMatch: false };
    }
  }

  // Dernière vérification
  const lastIdx = arr.length - 1;
  if (Math.abs(arr[lastIdx] - target) < 0.001) {
    return { low: lastIdx, high: lastIdx, exactMatch: true };
  }

  return { low: 0, high: 0, exactMatch: false };
}

/**
 * Interpolation trilinéaire pour les tableaux de performance
 * Dimensions : Masse × Altitude × Température
 *
 * @param {Array} masses - Tableau des masses disponibles (kg)
 * @param {Array} altitudes - Tableau des altitudes disponibles (ft)
 * @param {Array} temperatures - Tableau des températures disponibles (°C)
 * @param {Array} values - Tableau 3D [massIdx][altIdx][tempIdx] des valeurs
 * @param {number} targetMass - Masse cible (kg)
 * @param {number} targetAlt - Altitude cible (ft)
 * @param {number} targetTemp - Température cible (°C)
 * @returns {number|null} Valeur interpolée ou null si impossible
 */
export function trilinearInterpolate(
  masses,
  altitudes,
  temperatures,
  values,
  targetMass,
  targetAlt,
  targetTemp
) {
  // Vérifications
  if (!masses || !altitudes || !temperatures || !values) {
    console.warn('[TrilinearInterpolation] Données manquantes');
    return null;
  }

  if (masses.length === 0 || altitudes.length === 0 || temperatures.length === 0) {
    console.warn('[TrilinearInterpolation] Tableaux vides');
    return null;
  }

  // Trouver les indices encadrants
  const massIdx = findBracketingIndices(masses, targetMass);
  const altIdx = findBracketingIndices(altitudes, targetAlt);
  const tempIdx = findBracketingIndices(temperatures, targetTemp);

  console.log('[TrilinearInterpolation] Indices trouvés:', {
    mass: { target: targetMass, indices: massIdx, values: [masses[massIdx.low], masses[massIdx.high]] },
    alt: { target: targetAlt, indices: altIdx, values: [altitudes[altIdx.low], altitudes[altIdx.high]] },
    temp: { target: targetTemp, indices: tempIdx, values: [temperatures[tempIdx.low], temperatures[tempIdx.high]] }
  });

  // Si on est exactement sur un point de la grille 3D
  if (massIdx.exactMatch && altIdx.exactMatch && tempIdx.exactMatch) {
    const exactValue = values?.[massIdx.low]?.[altIdx.low]?.[tempIdx.low];
    if (exactValue !== null && exactValue !== undefined) {
      console.log('[TrilinearInterpolation] Valeur exacte trouvée:', exactValue);
      return exactValue;
    }
  }

  // Interpolation trilinéaire complète
  try {
    // Étape 1 : Interpolation sur les températures pour chaque coin du cube masse-altitude
    const c000 = getValueSafe(values, massIdx.low, altIdx.low, tempIdx.low);
    const c001 = getValueSafe(values, massIdx.low, altIdx.low, tempIdx.high);
    const c010 = getValueSafe(values, massIdx.low, altIdx.high, tempIdx.low);
    const c011 = getValueSafe(values, massIdx.low, altIdx.high, tempIdx.high);
    const c100 = getValueSafe(values, massIdx.high, altIdx.low, tempIdx.low);
    const c101 = getValueSafe(values, massIdx.high, altIdx.low, tempIdx.high);
    const c110 = getValueSafe(values, massIdx.high, altIdx.high, tempIdx.low);
    const c111 = getValueSafe(values, massIdx.high, altIdx.high, tempIdx.high);

    // Interpoler sur la température
    const c00 = interpolateIfPossible(temperatures[tempIdx.low], c000, temperatures[tempIdx.high], c001, targetTemp);
    const c01 = interpolateIfPossible(temperatures[tempIdx.low], c010, temperatures[tempIdx.high], c011, targetTemp);
    const c10 = interpolateIfPossible(temperatures[tempIdx.low], c100, temperatures[tempIdx.high], c101, targetTemp);
    const c11 = interpolateIfPossible(temperatures[tempIdx.low], c110, temperatures[tempIdx.high], c111, targetTemp);

    // Interpoler sur l'altitude
    const c0 = interpolateIfPossible(altitudes[altIdx.low], c00, altitudes[altIdx.high], c01, targetAlt);
    const c1 = interpolateIfPossible(altitudes[altIdx.low], c10, altitudes[altIdx.high], c11, targetAlt);

    // Interpoler sur la masse
    const result = interpolateIfPossible(masses[massIdx.low], c0, masses[massIdx.high], c1, targetMass);

    console.log('[TrilinearInterpolation] Résultat:', result);
    return result;

  } catch (error) {
    console.error('[TrilinearInterpolation] Erreur:', error);
    return null;
  }
}

/**
 * Récupère une valeur de manière sécurisée depuis le tableau 3D
 */
function getValueSafe(values, massIdx, altIdx, tempIdx) {
  try {
    const value = values?.[massIdx]?.[altIdx]?.[tempIdx];
    return (value !== null && value !== undefined) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Interpolation linéaire qui gère les valeurs nulles
 */
function interpolateIfPossible(x1, y1, x2, y2, x) {
  if (y1 === null && y2 === null) return null;
  if (y1 === null) return y2;
  if (y2 === null) return y1;

  return linearInterpolate(x1, y1, x2, y2, x);
}

/**
 * Extrapolation linéaire pour masse hors limites
 * Utilise les deux premières ou dernières masses pour extrapoler
 */
function extrapolateMass(masses, altitudes, temperatures, values, targetMass, targetAlt, targetTemp) {
  const minMass = masses[0];
  const maxMass = masses[masses.length - 1];

  // Extrapolation en dessous de la masse minimale
  if (targetMass < minMass && masses.length >= 2) {
    const m1 = masses[0];
    const m2 = masses[1];

    // Calculer les valeurs aux deux premières masses
    const v1 = trilinearInterpolate(masses, altitudes, temperatures, values, m1, targetAlt, targetTemp);
    const v2 = trilinearInterpolate(masses, altitudes, temperatures, values, m2, targetAlt, targetTemp);

    if (v1 !== null && v2 !== null) {
      // Extrapolation linéaire
      const extrapolated = linearInterpolate(m1, v1, m2, v2, targetMass);
      console.log('[Extrapolation] Masse inférieure:', {
        targetMass,
        minMass,
        m1, v1,
        m2, v2,
        extrapolated
      });
      return extrapolated;
    }
  }

  // Extrapolation au-dessus de la masse maximale
  if (targetMass > maxMass && masses.length >= 2) {
    const m1 = masses[masses.length - 2];
    const m2 = masses[masses.length - 1];

    const v1 = trilinearInterpolate(masses, altitudes, temperatures, values, m1, targetAlt, targetTemp);
    const v2 = trilinearInterpolate(masses, altitudes, temperatures, values, m2, targetAlt, targetTemp);

    if (v1 !== null && v2 !== null) {
      const extrapolated = linearInterpolate(m1, v1, m2, v2, targetMass);
      console.log('[Extrapolation] Masse supérieure:', {
        targetMass,
        maxMass,
        m1, v1,
        m2, v2,
        extrapolated
      });
      return extrapolated;
    }
  }

  return null;
}

/**
 * Calcule une distance de performance pour un groupe de tableaux
 * @param {Object} groupData - Données du groupe (de getCombinedDataForGroup)
 * @param {string} field - Champ à calculer ('Distance_roulement' ou 'Distance_passage_15m')
 * @param {number} mass - Masse (kg)
 * @param {number} altitude - Altitude pression (ft)
 * @param {number} temperature - Température (°C)
 * @returns {number|null} Distance en mètres
 */
export function calculatePerformanceDistance(groupData, field, mass, altitude, temperature) {
  if (!groupData || !groupData.values || !groupData.values[field]) {
    console.warn('[PerformanceDistance] Données de groupe invalides');
    return null;
  }

  const { masses, altitudes, temperatures, values } = groupData;

  console.log('[PerformanceDistance] Calcul pour:', {
    field,
    mass,
    altitude,
    temperature,
    availableMasses: masses,
    availableAltitudes: altitudes,
    availableTemperatures: temperatures
  });

  return trilinearInterpolate(
    masses,
    altitudes,
    temperatures,
    values[field],
    mass,
    altitude,
    temperature
  );
}

/**
 * Calcule les performances avec extrapolation si nécessaire
 * Retourne un objet avec la valeur et des métadonnées sur le calcul
 * @returns {Object|null} { value, method, massUsed, warning }
 */
export function calculatePerformanceWithExtrapolation(groupData, field, mass, altitude, temperature) {
  console.log('🔍 [calculatePerformanceWithExtrapolation] Début calcul:', {
    field,
    mass,
    altitude,
    temperature,
    hasGroupData: !!groupData,
    hasValues: !!groupData?.values,
    hasField: !!groupData?.values?.[field]
  });

  if (!groupData || !groupData.values || !groupData.values[field]) {
    console.warn('[PerformanceDistance] Données de groupe invalides');
    return null;
  }

  const { masses, altitudes, temperatures, values } = groupData;
  const minMass = masses[0];
  const maxMass = masses[masses.length - 1];

  const massInRange = mass >= minMass && mass <= maxMass;
  console.log('📊 [calculatePerformanceWithExtrapolation] Plages disponibles:', {
    masses,
    minMass,
    maxMass,
    mass,
    massInRange
  });

  // 🔍 VÉRIFICATION: Si masse hors limites, passer directement à l'extrapolation
  if (!massInRange) {
    console.log('⚠️ [calculatePerformanceWithExtrapolation] Masse hors limites détectée AVANT interpolation - Skip vers extrapolation');
    // Ne PAS appeler trilinearInterpolate car il va clamper automatiquement
    // Aller directement au code d'extrapolation/clamped en bas
  } else {
    // Masse dans la plage - interpolation normale
    const interpolated = trilinearInterpolate(
      masses,
      altitudes,
      temperatures,
      values[field],
      mass,
      altitude,
      temperature
    );

    // Si l'interpolation a réussi (masse dans la plage)
    if (interpolated !== null) {
      console.log('✅ [calculatePerformanceWithExtrapolation] Interpolation normale réussie');
      return {
        value: interpolated,
        method: 'interpolation',
        massUsed: mass,
        warning: null
      };
    }
  }

  // Masse hors limites - calculer avec extrapolation ET masse limite
  console.log('⚠️ [calculatePerformanceWithExtrapolation] Masse hors limites détectée');
  const results = {};

  // 1. Extrapolation linéaire
  console.log('📐 [calculatePerformanceWithExtrapolation] Tentative extrapolation linéaire...');
  const extrapolated = extrapolateMass(masses, altitudes, temperatures, values[field], mass, altitude, temperature);
  console.log('📐 [calculatePerformanceWithExtrapolation] Résultat extrapolation:', extrapolated);

  if (extrapolated !== null) {
    results.extrapolated = {
      value: extrapolated,
      method: 'extrapolation',
      massUsed: mass,
      warning: mass < minMass
        ? `Masse ${mass} kg inférieure à la masse minimale du tableau (${minMass} kg). Valeur extrapolée.`
        : `Masse ${mass} kg supérieure à la masse maximale du tableau (${maxMass} kg). Valeur extrapolée.`
    };
    console.log('✅ [calculatePerformanceWithExtrapolation] Extrapolation ajoutée aux résultats');
  } else {
    console.warn('❌ [calculatePerformanceWithExtrapolation] Extrapolation échouée (null)');
  }

  // 2. Calcul avec masse limite (min ou max)
  const clampedMass = mass < minMass ? minMass : (mass > maxMass ? maxMass : mass);
  console.log('📌 [calculatePerformanceWithExtrapolation] Tentative calcul avec masse limite:', clampedMass);

  const clamped = trilinearInterpolate(
    masses,
    altitudes,
    temperatures,
    values[field],
    clampedMass,
    altitude,
    temperature
  );
  console.log('📌 [calculatePerformanceWithExtrapolation] Résultat masse limite:', clamped);

  if (clamped !== null) {
    results.clamped = {
      value: clamped,
      method: 'clamped',
      massUsed: clampedMass,
      warning: mass < minMass
        ? `Masse réelle ${mass} kg < masse min ${minMass} kg. Calcul avec masse minimale.`
        : `Masse réelle ${mass} kg > masse max ${maxMass} kg. Calcul avec masse maximale.`
    };
    console.log('✅ [calculatePerformanceWithExtrapolation] Calcul masse limite ajouté aux résultats');
  } else {
    console.warn('❌ [calculatePerformanceWithExtrapolation] Calcul masse limite échoué (null)');
  }

  console.log('🎯 [calculatePerformanceWithExtrapolation] Résultats finaux hors limites:', results);
  const finalResult = Object.keys(results).length > 0 ? results : null;
  console.log('🎯 [calculatePerformanceWithExtrapolation] Retourne:', finalResult ? 'Objet avec résultats' : 'null');
  return finalResult;
}

export default {
  trilinearInterpolate,
  calculatePerformanceDistance,
  calculatePerformanceWithExtrapolation
};
