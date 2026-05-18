// src/services/tableInterpolationAdapter.js
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║   ADAPTER : tableaux de performance → API resolveOperation          ║
// ║                                                                      ║
// ║   Permet à la matrice de couverture (PerformanceStateMatrix) de      ║
// ║   consommer les tableaux numériques (advancedPerformance.tables[])   ║
// ║   au même endroit que les abaques (performanceModels[]), pour qu'un  ║
// ║   pilote dont l'avion est configuré en tableaux voie SES valeurs     ║
// ║   apparaître dans la matrice — symétriquement aux abaques.           ║
// ║                                                                      ║
// ║   Pré-requis (Option B, P4) : chaque tableau porte un `operationId`  ║
// ║   du catalogue canonique + une seule grandeur de sortie par ligne    ║
// ║   (champ `value`). Le grouping par operationId/masse est délégué à   ║
// ║   performanceTableGrouping.js (P4).                                  ║
// ║                                                                      ║
// ║   L'interpolation trilinéaire (masse × altitude × température) est   ║
// ║   déléguée à performanceTrilinearInterpolation.js.                   ║
// ║                                                                      ║
// ║   Hors plage masse : extrapolation linéaire avec WARNING explicite.  ║
// ║   Hors plage altitude/température : clamp aux bornes + warning.      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { OPERATION_CATALOG, getOperation, isValidOperationId } from '../abac/curves/core/operationCatalog';
import {
  groupTablesByOperationId,
  buildLookupForOperation
} from './performanceTableGrouping';
import { trilinearInterpolate } from './performanceTrilinearInterpolation';

// ─────────────────────────────────────────────────────────────────────────
// EXTRACTION : récupère les tables d'un avion (formats runtime + Supabase)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Récupère le tableau des `advancedPerformance.tables[]` d'un avion,
 * que celui-ci soit au format runtime ou au format brut Supabase.
 */
function getAdvancedPerformanceTables(aircraft) {
  if (!aircraft) return [];
  if (Array.isArray(aircraft.advancedPerformance?.tables)) {
    return aircraft.advancedPerformance.tables;
  }
  if (Array.isArray(aircraft.aircraft_data?.advancedPerformance?.tables)) {
    return aircraft.aircraft_data.advancedPerformance.tables;
  }
  return [];
}

/**
 * Trouve les tableaux portant un `operationId` donné sur un avion.
 * Symétrique à `findGraphsForOperation` côté abaques.
 *
 * @returns {Array} Liste des tableaux match (peut être plusieurs masses du même opId)
 */
export function findTablesForOperation(aircraft, operationId) {
  const tables = getAdvancedPerformanceTables(aircraft);
  if (!isValidOperationId(operationId)) return [];
  return tables.filter(t => t.operationId === operationId);
}

// ─────────────────────────────────────────────────────────────────────────
// CONVERSION conditions → cibles trilinéaires
// ─────────────────────────────────────────────────────────────────────────

/**
 * Convertit l'objet `conditions` standard (inputsToConditions output) en
 * cibles consommables par l'interpolation trilinéaire des tables.
 */
function conditionsToTrilinearTargets(conditions) {
  return {
    targetMass: typeof conditions?.mass === 'number' ? conditions.mass : null,
    targetAlt:  typeof conditions?.pressure_altitude === 'number' ? conditions.pressure_altitude : null,
    targetTemp: typeof conditions?.temperature === 'number' ? conditions.temperature : null
  };
}

// ─────────────────────────────────────────────────────────────────────────
// EXTRAPOLATION MASSE (hors plage)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Extrapole linéairement quand la masse cible est hors de la plage
 * disponible dans les tableaux. Utilise les 2 masses extrêmes du côté
 * concerné pour préserver la pente locale.
 *
 * @returns {number|null}
 */
function extrapolateForMass(lookup, targetMass, targetAlt, targetTemp) {
  const { masses, altitudes, temperatures, values } = lookup;
  if (!Array.isArray(masses) || masses.length < 2) return null;
  const min = masses[0];
  const max = masses[masses.length - 1];
  // Choisir les 2 masses du côté de l'extrapolation
  let m1, m2, idx1, idx2;
  if (targetMass < min) { idx1 = 0; idx2 = 1; }
  else if (targetMass > max) { idx1 = masses.length - 2; idx2 = masses.length - 1; }
  else return null; // pas d'extrapolation nécessaire
  m1 = masses[idx1]; m2 = masses[idx2];

  // Évaluer les 2 valeurs aux masses extrêmes via trilinear (qui clampe altitude/temp)
  const v1 = trilinearInterpolate(masses, altitudes, temperatures, values, m1, targetAlt, targetTemp);
  const v2 = trilinearInterpolate(masses, altitudes, temperatures, values, m2, targetAlt, targetTemp);
  if (v1 === null || v2 === null) return null;
  if (Math.abs(m2 - m1) < 0.001) return v1;
  // Extrapolation linéaire
  return v1 + ((v2 - v1) * (targetMass - m1)) / (m2 - m1);
}

// ─────────────────────────────────────────────────────────────────────────
// API PRINCIPALE — résolution d'une opération via tableaux
// ─────────────────────────────────────────────────────────────────────────

/**
 * Évalue une opération canonique à partir des tableaux de performance d'un avion.
 *
 * Pipeline :
 *   1. Filtre les tables portant `operationId`
 *   2. Groupe par masse (via performanceTableGrouping)
 *   3. Construit le lookup 3D (masse × altitude × température → value)
 *   4. Interpole trilinéairement aux conditions du pilote
 *   5. Si masse hors plage → extrapolation linéaire + warning
 *
 * @param {object} aircraft     L'avion (runtime ou Supabase shape)
 * @param {string} operationId  id du catalogue canonique
 * @param {object} conditions   { temperature, pressure_altitude, mass, wind }
 * @returns {object|null}       Résultat compatible avec le format resolveOperation,
 *                              ou null si pas de table pour cet operationId.
 */
export function resolveOperationFromTables(aircraft, operationId, conditions) {
  if (!isValidOperationId(operationId)) return null;
  const opDef = getOperation(operationId);

  // 1. Récupère les tables de cet operationId
  const tables = findTablesForOperation(aircraft, operationId);
  if (tables.length === 0) return null;

  // 2. Group + lookup 3D
  const groups = groupTablesByOperationId(tables);
  const group = groups[0]; // les tables sont déjà filtrées par operationId
  if (!group || group.tables.length === 0) return null;

  const lookup = buildLookupForOperation(group);
  if (!lookup) return null;

  const warnings = [];
  const { altitudes, temperatures, masses, values } = lookup;

  // Sanity checks
  if (masses.length === 0 || altitudes.length === 0 || temperatures.length === 0) {
    return {
      operationId,
      operationLabel: opDef.labelFr,
      status: 'ERROR',
      reason: `Tableaux ${operationId} : grille 3D incomplète (masses=${masses.length}, alts=${altitudes.length}, temps=${temperatures.length}).`,
      source: { kind: 'table', tableCount: group.tables.length, method: 'Interpolation trilinéaire' }
    };
  }

  const { targetMass, targetAlt, targetTemp } = conditionsToTrilinearTargets(conditions);
  if (targetMass === null || targetAlt === null || targetTemp === null) {
    return {
      operationId,
      operationLabel: opDef.labelFr,
      status: 'MISSING_INPUT',
      reason: `Input manquant (mass=${targetMass}, alt=${targetAlt}, temp=${targetTemp}).`,
      source: { kind: 'table', tableCount: group.tables.length, method: 'Interpolation trilinéaire' }
    };
  }

  // 3. Vérification plages + warnings extrapolation
  const minMass = masses[0], maxMass = masses[masses.length - 1];
  const minAlt = altitudes[0], maxAlt = altitudes[altitudes.length - 1];
  const minTemp = temperatures[0], maxTemp = temperatures[temperatures.length - 1];
  const massInRange = targetMass >= minMass && targetMass <= maxMass;
  if (!massInRange) {
    warnings.push(
      targetMass < minMass
        ? `⚠ Masse ${targetMass} kg sous la plage du tableau (min ${minMass} kg) — extrapolation linéaire`
        : `⚠ Masse ${targetMass} kg au-delà de la plage (max ${maxMass} kg) — extrapolation linéaire`
    );
  }
  if (targetAlt < minAlt || targetAlt > maxAlt) {
    warnings.push(
      targetAlt < minAlt
        ? `⚠ Altitude ${targetAlt} ft sous la plage (min ${minAlt} ft) — clamp aux bornes`
        : `⚠ Altitude ${targetAlt} ft au-delà de la plage (max ${maxAlt} ft) — clamp aux bornes`
    );
  }
  if (targetTemp < minTemp || targetTemp > maxTemp) {
    warnings.push(
      targetTemp < minTemp
        ? `⚠ Température ${targetTemp}°C sous la plage (min ${minTemp}°C) — clamp aux bornes`
        : `⚠ Température ${targetTemp}°C au-delà de la plage (max ${maxTemp}°C) — clamp aux bornes`
    );
  }

  // 4. Interpolation
  let value;
  let method;
  if (massInRange) {
    value = trilinearInterpolate(masses, altitudes, temperatures, values, targetMass, targetAlt, targetTemp);
    method = 'Trilinéaire (masse × alt × temp)';
  } else {
    value = extrapolateForMass(lookup, targetMass, targetAlt, targetTemp);
    method = 'Trilinéaire + extrapolation masse';
  }

  if (value === null || !Number.isFinite(value)) {
    return {
      operationId,
      operationLabel: opDef.labelFr,
      status: 'ERROR',
      reason: `Interpolation a renvoyé null. Vérifier la couverture du tableau (peut-être valeurs manquantes pour cette combinaison).`,
      source: { kind: 'table', tableCount: group.tables.length, method, masses, altitudes, temperatures },
      warnings
    };
  }

  // 5. Préparer un step "simulé" pour la cohérence avec l'affichage cascade
  //    (la matrice itère sur cascadeSteps pour afficher les détails)
  const simulatedStep = {
    graphId: `table:${operationId}`,
    graphName: group.tables[0]?.table_name || `Tableau ${operationId}`,
    role: 'primary',
    cascadeOrder: null,
    operationId,
    mode: 'trilinear',
    modeDeclared: true,
    used: 'trilinear',
    xDim: 'mass',
    xTitle: 'mass',
    yTitle: 'value',
    queryX: targetMass,
    entryY: null,
    output: value,
    error: null,
    // Détail de l'interpolation pour le panneau debug
    trilinearResult: {
      method,
      lookup: {
        masses, altitudes, temperatures,
        tableCount: group.tables.length,
        valueCount: masses.length * altitudes.length * temperatures.length
      },
      target: { mass: targetMass, altitude: targetAlt, temperature: targetTemp },
      extrapolated: !massInRange
    }
  };

  // Pick outputUnit : priorité au champ stocké sur la table, fallback au catalogue
  const firstTableUnit = group.tables[0]?.outputUnit;
  const catalogUnit = opDef.acceptedOutputs[0]?.defaultUnit || '';
  const unit = firstTableUnit || catalogUnit;
  const outputKind = opDef.acceptedOutputs[0]?.kind || null;

  // Confidence : trilinéaire pleine plage = 95%, extrapolation = 75%
  const confidence = massInRange ? '95%' : '75%';

  return {
    operationId,
    operationLabel: opDef.labelFr,
    status: 'COMPUTED',
    value,
    unit,
    outputKind,
    source: {
      kind: 'table',
      tableCount: group.tables.length,
      method,
      // Masses disponibles pour info
      masses,
      altitudeRange: [minAlt, maxAlt],
      temperatureRange: [minTemp, maxTemp]
    },
    inputs: {
      temperature: conditions.temperature,
      pressure_altitude: conditions.pressure_altitude,
      mass: conditions.mass,
      wind: conditions.wind
    },
    confidence,
    cascadeSteps: [simulatedStep],
    warnings,
    debug: { perGraph: [] }
  };
}
