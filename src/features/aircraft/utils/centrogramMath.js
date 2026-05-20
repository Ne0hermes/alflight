// src/features/aircraft/utils/centrogramMath.js
//
// Utilitaires mathématiques pour la lecture graphique d'un centrogramme MANEX.
//
// Le centrogramme est une succession de mini-graphes (PLACES AVANT, PLACES ARRIÈRE,
// CARBURANT, BAGAGES, ...) où chaque mini-graphe représente une fonction affine
// reliant la masse ajoutée (x, en kg) au moment cumulé (y, en m·kg).
//
//   f(x) = a · x + b
//     a = bras de levier de cette étape (en m, ou cm selon l'échelle)
//     b = moment cumulé à la fin de l'étape précédente
//
// Méthode :
//   1) Le pilote calibre les axes en cliquant sur des graduations connues.
//   2) Le pilote clique N ≥ 2 points sur la droite affine du mini-graphe.
//   3) On calcule a et b par régression linéaire des moindres carrés.
//   4) R² affiché → le pilote vérifie que les points sont bien alignés.
//
// Toutes les valeurs en sortie sont en COORDONNÉES DATA (post-calibration),
// pas en pixels.

/**
 * Convertit un point pixel vers une coordonnée data via une calibration
 * multi-points linéaire par morceaux.
 *
 * @param {number} pixel - pixel inner (post-margin SVG)
 * @param {Array<{value:number, pixel:number}>} ticks - calibration (≥ 2)
 * @returns {number} valeur data correspondante
 */
export function pixelToData(pixel, ticks) {
  if (!Array.isArray(ticks) || ticks.length < 2) return NaN;

  // Trier par pixel croissant
  const sorted = [...ticks].sort((a, b) => a.pixel - b.pixel);

  // Bornes
  if (pixel <= sorted[0].pixel) {
    // Extrapolation à gauche
    const p0 = sorted[0];
    const p1 = sorted[1];
    const slope = (p1.value - p0.value) / (p1.pixel - p0.pixel);
    return p0.value + slope * (pixel - p0.pixel);
  }
  if (pixel >= sorted[sorted.length - 1].pixel) {
    const pN = sorted[sorted.length - 1];
    const pN_1 = sorted[sorted.length - 2];
    const slope = (pN.value - pN_1.value) / (pN.pixel - pN_1.pixel);
    return pN.value + slope * (pixel - pN.pixel);
  }

  // Interpolation linéaire entre les 2 ticks encadrants
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (pixel >= a.pixel && pixel <= b.pixel) {
      const t = (pixel - a.pixel) / (b.pixel - a.pixel);
      return a.value + t * (b.value - a.value);
    }
  }
  return NaN;
}

/**
 * Régression linéaire des moindres carrés.
 * Retourne { a, b, r2 } pour y = a·x + b.
 *
 * @param {Array<{x:number, y:number}>} points
 * @returns {{a:number, b:number, r2:number, n:number} | null}
 */
export function linearRegression(points) {
  if (!Array.isArray(points) || points.length < 2) return null;

  const valid = points.filter(p =>
    Number.isFinite(p.x) && Number.isFinite(p.y)
  );
  if (valid.length < 2) return null;

  const n = valid.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;

  for (const p of valid) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
    sumYY += p.y * p.y;
  }

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-12) {
    // Tous les x sont identiques → pas de droite affine définie
    return null;
  }

  const a = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - a * sumX) / n;

  // Coefficient de détermination R²
  // R² = 1 - SS_res / SS_tot
  const meanY = sumY / n;
  let ssRes = 0, ssTot = 0;
  for (const p of valid) {
    const yPred = a * p.x + b;
    ssRes += (p.y - yPred) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }
  const r2 = ssTot < 1e-12 ? 1 : 1 - ssRes / ssTot;

  return { a, b, r2, n };
}

/**
 * Calcule la prédiction f(x) = a·x + b pour un test rapide par le pilote.
 *
 * @param {number} x
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function predictMoment(x, a, b) {
  if (!Number.isFinite(x) || !Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return a * x + b;
}

/**
 * Convertit un bras (pente a) d'une unité interne quelconque vers l'unité
 * storage (cm pour FR, in pour US).
 *
 * IMPORTANT : la pente a est en "unité_y / unité_x". Si :
 *   - y est en m·kg et x est en kg → a est en m → multiplier par 100 pour cm
 *   - y est en kg·cm et x est en kg → a est en cm directement
 *   - y est en lbs·in et x est en lbs → a est en in
 *
 * Le pilote doit DÉCLARER au début quelles sont les unités lues sur les
 * graduations. Cette fonction se contente de convertir entre m / cm / in.
 *
 * @param {number} slope - pente a (en armUnit)
 * @param {'m'|'cm'|'mm'|'in'} fromUnit - unité de la pente (= unité y/x si x en masse)
 * @param {'cm'|'in'|'m'|'mm'} toUnit - unité storage
 * @returns {number}
 */
export function convertArmUnit(slope, fromUnit, toUnit) {
  if (!Number.isFinite(slope)) return NaN;
  if (fromUnit === toUnit) return slope;

  // Conversion vers mètres (pivot)
  const toMeters = {
    m: 1, cm: 0.01, mm: 0.001, in: 0.0254
  };
  if (!(fromUnit in toMeters) || !(toUnit in toMeters)) return slope;

  const inMeters = slope * toMeters[fromUnit];
  return inMeters / toMeters[toUnit];
}

/**
 * Stages "fixes" du centrogramme (toujours présents sur la plupart des avions).
 * Les stages dynamiques (réservoirs additionnels, compartiments bagages, sièges
 * additionnels) sont ajoutés via buildStageList ci-dessous.
 */
export const CENTROGRAM_STAGES = [
  {
    key: 'empty',
    label: 'Bras CG à vide',
    aircraftPath: 'arms.empty',
    helper: 'Lis le bras du CG à vide. C\'est généralement une valeur unique (point) sur le centrogramme, pas une droite. Tu peux le saisir directement ou cliquer un point unique.',
    singleValue: true, // Pas une fonction affine, juste une valeur unique
    category: 'fixe'
  },
  {
    key: 'frontSeats',
    label: 'Sièges avant (pilote + copilote)',
    aircraftPath: 'arms.frontSeats',
    helper: 'Mini-graphique "PLACES AVANT" / "FRONT SEATS". Clique 3-5 points sur la droite affine.',
    singleValue: false,
    category: 'seats'
  },
  {
    key: 'rearSeats',
    label: 'Sièges arrière',
    aircraftPath: 'arms.rearSeats',
    helper: 'Mini-graphique "PLACES ARRIÈRE" / "REAR SEATS". Clique 3-5 points sur la droite affine.',
    singleValue: false,
    category: 'seats'
  },
  {
    key: 'fuelMain',
    label: 'Carburant — Réservoir principal',
    aircraftPath: 'arms.fuelMain',
    helper: 'Mini-graphique "CARBURANT PRINCIPAL" / "MAIN FUEL". Si la courbe n\'est pas une droite (réservoir non-linéaire), prends la pente moyenne ou plusieurs segments.',
    singleValue: false,
    category: 'fuel'
  }
  // Les compartiments bagages, sièges additionnels et réservoirs additionnels
  // sont gérés dynamiquement par buildStageList ci-dessous, à partir de
  // data.baggageCompartments / data.additionalSeats / data.additionalFuelTanks.
];

/**
 * Émoji par type de réservoir pour le menu déroulant
 */
const FUEL_TANK_EMOJI = {
  main: '⛽',
  wing: '✈️',
  optional: '🔋',
  tip: '🛢️',
  aux: '🔧'
};

const FUEL_TANK_LABELS = {
  main: 'Réservoir principal',
  wing: 'Réservoir d\'aile',
  optional: 'Réservoir optionnel',
  tip: 'Réservoir d\'extrémité (tip tank)',
  aux: 'Réservoir auxiliaire'
};

/**
 * Construit la liste dynamique des stages incluant :
 *   - Les stages fixes (vide, sièges avant, arrière, carburant principal)
 *   - Les réservoirs additionnels (data.additionalFuelTanks)
 *   - Les compartiments bagages (data.baggageCompartments)
 *   - Les sièges additionnels (data.additionalSeats)
 *
 * @param {Object} aircraftData - data du store
 * @returns {Array<{key, label, aircraftPath, helper, singleValue, dynamicIndex?, category?}>}
 */
export function buildStageList(aircraftData) {
  const stages = [...CENTROGRAM_STAGES];

  // ─── Réservoirs additionnels (data.additionalFuelTanks = [{id, name, type, arm, capacity}]) ───
  // Permet de gérer : réservoir d'ailes (gauche/droite), réservoir optionnel,
  // tip-tank, réservoir auxiliaire... bref tout ce qui s'ajoute au réservoir
  // principal.
  const additionalFuelTanks = aircraftData?.additionalFuelTanks || [];
  additionalFuelTanks.forEach((tank, idx) => {
    const typeLabel = FUEL_TANK_LABELS[tank.type] || 'Réservoir';
    const emoji = FUEL_TANK_EMOJI[tank.type] || '⛽';
    stages.push({
      key: `fuelTank_${tank.id}`,
      label: `${emoji} ${tank.name || typeLabel}`,
      aircraftPath: `additionalFuelTanks[${idx}].arm`,
      helper: `Mini-graphique "${tank.name || typeLabel.toUpperCase()}". Clique 3-5 points sur la droite affine. Pour un réservoir non-linéaire, prends la pente moyenne.`,
      singleValue: false,
      dynamicIndex: idx,
      dynamicType: 'fuelTank',
      tankType: tank.type,
      category: 'fuel'
    });
  });

  // ─── Compartiments bagages (data.baggageCompartments = [{id, name, arm, maxWeight}]) ───
  const baggageCompartments = aircraftData?.baggageCompartments || [];
  baggageCompartments.forEach((comp, idx) => {
    stages.push({
      key: `baggage_${comp.id}`,
      label: `🧳 Bagages — ${comp.name || `Compartiment ${idx + 1}`}`,
      aircraftPath: `baggageCompartments[${idx}].arm`,
      helper: `Mini-graphique "${comp.name || 'BAGAGES'}". Clique 3-5 points sur la droite affine.`,
      singleValue: false,
      dynamicIndex: idx,
      dynamicType: 'baggage',
      category: 'baggage'
    });
  });

  // ─── Sièges additionnels (data.additionalSeats = [{id, name, arm}]) ───
  const additionalSeats = aircraftData?.additionalSeats || [];
  additionalSeats.forEach((seat, idx) => {
    stages.push({
      key: `seat_${seat.id}`,
      label: `💺 ${seat.name || `Siège additionnel ${idx + 1}`}`,
      aircraftPath: `additionalSeats[${idx}].arm`,
      helper: `Mini-graphique "${seat.name || 'SIÈGE'}". Clique 3-5 points sur la droite affine.`,
      singleValue: false,
      dynamicIndex: idx,
      dynamicType: 'seat',
      category: 'seats'
    });
  });

  return stages;
}

// Constantes utiles à exporter pour l'UI
export const FUEL_TANK_TYPES = [
  { value: 'main',     label: 'Principal' },
  { value: 'wing',     label: 'Aile' },
  { value: 'optional', label: 'Optionnel' },
  { value: 'tip',      label: 'Extrémité (tip tank)' },
  { value: 'aux',      label: 'Auxiliaire' }
];
