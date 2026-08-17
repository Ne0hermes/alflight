// src/services/performanceTableGrouping.js
//
// Regroupement des tableaux de performance par OPÉRATION et par MASSE.
//
// Nouveau schéma (Option B) :
//   Chaque tableau porte un `operationId` du catalogue canonique (cf.
//   src/abac/curves/core/operationCatalog.ts) et une seule grandeur de
//   sortie par ligne (`value`). Les tableaux d'une même operation à
//   différentes masses se regroupent pour former un nuage 3D
//   (masse × altitude × température) interpolable.
//
// L'ancien schéma (Distance_roulement / Distance_passage_15m mélangés dans
// la même ligne) reste partiellement supporté pour rétro-compatibilité,
// mais est destiné à disparaître après P1.

import { isValidOperationId } from '../abac/curves/core/operationCatalog';

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Extrait le nom de base d'un tableau (sans la masse).
 * Utilisé par l'ancien groupage par nom (rétrocompat).
 */
function extractBaseName(tableName) {
  if (!tableName) return '';
  return tableName
    .replace(/\s*-?\s*\d+\s*(kg|lb).*$/i, '')
    .replace(/\s*\/\s*\d+\s*(kg|lb).*$/i, '')
    .trim();
}

/**
 * Extrait la masse d'un tableau depuis ses données, son nom ou ses conditions.
 * @returns {number|null}
 */
function extractMass(table) {
  // 1. Chercher dans les données (priorité)
  if (table.data && Array.isArray(table.data) && table.data.length > 0) {
    const firstPoint = table.data[0];
    if (firstPoint.Masse !== undefined && firstPoint.Masse !== null) {
      return parseFloat(firstPoint.Masse);
    }
  }
  // 2. Chercher dans le nom du tableau
  const name = table.table_name || '';
  const massMatch = name.match(/(\d+)\s*kg/i);
  if (massMatch) return parseFloat(massMatch[1]);
  // 3. Chercher dans les conditions
  if (table.conditions && table.conditions.mass !== undefined) {
    return parseFloat(table.conditions.mass);
  }
  return null;
}

/**
 * Récupère la valeur de sortie d'un point de tableau.
 * Nouveau schéma : champ `value` unique.
 * Ancien schéma : `Distance_roulement`, `Distance_passage_15m`,
 *                 `ground_roll`, `distance_50ft` (fallback rétrocompat).
 *
 * @param {object} point  Une ligne du tableau (data row)
 * @returns {number|null}
 */
function extractValue(point) {
  if (!point || typeof point !== 'object') return null;
  // Nouveau schéma : `value` unique
  if (point.value !== undefined && point.value !== null) {
    const v = parseFloat(point.value);
    if (Number.isFinite(v)) return v;
  }
  // Ancien schéma : tente plusieurs noms de colonne (FR + EN)
  const legacyFields = [
    'Distance_roulement', 'Distance_passage_15m',
    'ground_roll', 'distance_50ft', 'over_50ft_m', 'ground_roll_m',
    'Distance', 'distance'
  ];
  for (const f of legacyFields) {
    if (point[f] !== undefined && point[f] !== null) {
      const v = parseFloat(point[f]);
      if (Number.isFinite(v)) return v;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// API NOUVELLE (Option B) — groupage par operationId
// ─────────────────────────────────────────────────────────────────────────

/**
 * Regroupe les tableaux par `operationId` du catalogue canonique.
 * Les tableaux sans operationId valide sont ignorés (log warning).
 *
 * @param {Array} tables  Liste des tableaux (aircraft.advancedPerformance.tables)
 * @returns {Array<{ operationId, tables, masses }>}
 */
export function groupTablesByOperationId(tables) {
  if (!Array.isArray(tables)) return [];
  const groups = {};
  let ignored = 0;

  tables.forEach((table, index) => {
    const opId = table.operationId;
    if (!opId || !isValidOperationId(opId)) {
      ignored++;
      return;
    }
    if (!groups[opId]) {
      groups[opId] = { operationId: opId, tables: [], masses: [] };
    }
    const mass = extractMass(table);
    groups[opId].tables.push({ ...table, originalIndex: index, mass });
    if (mass !== null && !groups[opId].masses.includes(mass)) {
      groups[opId].masses.push(mass);
    }
  });

  // Trier les masses + tables par masse pour chaque groupe
  Object.values(groups).forEach(g => {
    g.masses.sort((a, b) => a - b);
    g.tables.sort((a, b) => (a.mass || 0) - (b.mass || 0));
  });

  if (ignored > 0) {
    console.warn(`[performanceTableGrouping] ${ignored} tableau(x) sans operationId valide ignoré(s)`);
  }
  return Object.values(groups);
}

/**
 * Construit la structure 3D (masse × altitude × température) → value
 * exploitable par l'interpolation trilinéaire.
 *
 * @param {object} group  Un groupe retourné par groupTablesByOperationId
 * @returns {object|null} { operationId, altitudes, temperatures, masses, values }
 */
/** Température de l'atmosphère standard à une altitude-pression (°C). */
export function isaTempAt(altitudeFt) {
  return 15 - 1.98 * (altitudeFt / 1000);
}

/**
 * Le tableau raisonne-t-il en ÉCART À L'ISA plutôt qu'en température absolue ?
 *
 * Beaucoup de manuels — les Robin de la base, notamment — donnent pour chaque
 * palier d'altitude trois températures : ISA−20, ISA et ISA+20. En absolu, cela
 * s'écrit −5/15/35 au niveau de la mer, −13/7/27 à 4000 ft, −21/−1/19 à 8000 ft.
 * Rangées telles quelles dans un cube altitude × température absolue, ces neuf
 * valeurs réclament vingt-sept cases : dix-huit trous sont fabriqués de toutes
 * pièces, alors que le manuel est complet.
 *
 * Reconnaissance volontairement stricte : il faut au moins deux altitudes, des
 * températures absolues QUI DIFFÈRENT d'un palier à l'autre, et des écarts à
 * l'ISA qui, eux, COÏNCIDENT. Un tableau à températures absolues (0/10/20/30/40
 * à toutes les altitudes) n'est donc jamais converti.
 */
export function detectIsaRelativeTemperatures(points) {
  const parAltitude = new Map();
  for (const p of points) {
    const alt = parseFloat(p.Altitude);
    const temp = parseFloat(p.Temperature);
    if (!Number.isFinite(alt) || !Number.isFinite(temp)) continue;
    if (!parAltitude.has(alt)) parAltitude.set(alt, []);
    parAltitude.get(alt).push(temp);
  }
  if (parAltitude.size < 2) return false;

  const cle = (arr) => [...new Set(arr)].sort((a, b) => a - b).join('|');
  const absolus = new Set();
  const ecarts = new Set();
  for (const [alt, temps] of parAltitude) {
    absolus.add(cle(temps));
    ecarts.add(cle(temps.map((t) => Math.round(t - isaTempAt(alt)))));
  }
  // Températures identiques partout → grille absolue classique, on n'y touche pas.
  if (absolus.size === 1) return false;
  // Les écarts ne se superposent pas → ce n'est pas un tableau ISA-relatif.
  if (ecarts.size !== 1) return false;

  // ⚠️ Garde-fou : il faut AU MOINS DEUX écarts distincts.
  // Un tableau ne portant qu'une température par altitude (la seule ligne ISA,
  // cas de F-BXNG et F-BXQT après leur aller-retour Excel) satisferait sinon le
  // test : tous les écarts valent 0, ils « coïncident » trivialement. L'axe des
  // températures se réduirait alors à un point unique, et TOUTE température
  // serait écrêtée sur la valeur ISA — une journée à 35 °C recevrait la distance
  // des 15 °C. C'est précisément le comportement non conservateur qu'on vient de
  // supprimer. Sans deux écarts, le tableau ne dit rien de l'effet de la
  // température : on refuse de calculer plutôt que d'inventer.
  const [seulEcart] = ecarts;
  return seulEcart.split('|').length >= 2;
}

export function buildLookupForOperation(group) {
  if (!group?.tables?.length) return null;

  const tousLesPoints = group.tables.flatMap(t => t.data || []);
  const isaRelative = detectIsaRelativeTemperatures(tousLesPoints);
  // Valeur portée par l'axe des températures : l'écart à l'ISA quand le manuel
  // raisonne ainsi, la température absolue sinon.
  const axeTemp = (point) => {
    const temp = parseFloat(point.Temperature);
    if (!isaRelative) return temp;
    const alt = parseFloat(point.Altitude);
    return Math.round(temp - isaTempAt(alt));
  };

  const altitudesSet = new Set();
  const temperaturesSet = new Set();
  const massesSet = new Set();

  group.tables.forEach(table => {
    (table.data || []).forEach(point => {
      if (point.Altitude !== undefined && point.Altitude !== null) altitudesSet.add(parseFloat(point.Altitude));
      if (point.Temperature !== undefined && point.Temperature !== null) temperaturesSet.add(axeTemp(point));
      if (point.Masse !== undefined && point.Masse !== null) massesSet.add(parseFloat(point.Masse));
    });
  });

  const altitudes = Array.from(altitudesSet).filter(Number.isFinite).sort((a, b) => a - b);
  const temperatures = Array.from(temperaturesSet).filter(Number.isFinite).sort((a, b) => a - b);
  const masses = Array.from(massesSet).filter(Number.isFinite).sort((a, b) => a - b);

  // Structure 3D : values[massIdx][altIdx][tempIdx] = value
  const values = masses.map((mass) =>
    altitudes.map((alt) =>
      temperatures.map((temp) => {
        for (const table of group.tables) {
          const point = (table.data || []).find(p =>
            parseFloat(p.Masse) === mass &&
            parseFloat(p.Altitude) === alt &&
            axeTemp(p) === temp
          );
          if (point) {
            const v = extractValue(point);
            if (v !== null) return v;
          }
        }
        return null;
      })
    )
  );

  return {
    operationId: group.operationId,
    altitudes,
    temperatures,
    masses,
    values,
    // 'absolute' = températures du manuel telles quelles ; 'isaDeviation' = écarts
    // à l'ISA. L'appelant DOIT convertir sa température cible dans le second cas.
    temperatureScale: isaRelative ? 'isaDeviation' : 'absolute',
    tableCount: group.tables.length
  };
}

// ─────────────────────────────────────────────────────────────────────────
// API ANCIENNE — groupage par nom de base (RÉTROCOMPAT)
// ─────────────────────────────────────────────────────────────────────────
// Conservée tant que `PerformanceModule.jsx` l'utilise pour calculer le
// fallbackWeight. À supprimer dans P1 quand le module sera refondu.

/**
 * Regroupe les tableaux par nom de base (ancien comportement).
 * @deprecated Préférer groupTablesByOperationId pour le nouveau schéma.
 */
export function groupTablesByBaseName(tables) {
  if (!Array.isArray(tables)) return [];
  const groups = {};

  tables.forEach((table, index) => {
    const baseName = extractBaseName(table.table_name || '');
    if (!baseName) {
      console.warn(`Table ${index} n'a pas de nom de base valide`);
      return;
    }
    if (!groups[baseName]) {
      groups[baseName] = { baseName, tables: [], type: table.table_type, masses: [] };
    }
    const mass = extractMass(table);
    groups[baseName].tables.push({ ...table, originalIndex: index, mass, baseName });
    if (mass !== null && !groups[baseName].masses.includes(mass)) {
      groups[baseName].masses.push(mass);
    }
  });

  Object.values(groups).forEach(g => {
    g.masses.sort((a, b) => a - b);
    g.tables.sort((a, b) => (a.mass || 0) - (b.mass || 0));
  });
  return Object.values(groups);
}

/**
 * Filtre par phase 'takeoff' / 'landing'.
 * @deprecated Utilisé uniquement par l'ancien chemin.
 */
export function filterGroupsByType(groups, type) {
  return groups.filter(group => {
    const groupType = (group.type || '').toLowerCase();
    const baseName = (group.baseName || '').toLowerCase();
    if (type === 'takeoff') return groupType === 'takeoff' || baseName.includes('take') || baseName.includes('décollage');
    if (type === 'landing') return groupType === 'landing' || baseName.includes('land') || baseName.includes('atterrissage');
    return false;
  });
}

/**
 * Construit la structure 3D ancienne (avec champs distance multiples).
 * @deprecated Préférer buildLookupForOperation.
 */
export function getCombinedDataForGroup(group) {
  if (!group?.tables?.length) return null;

  const altitudesSet = new Set();
  const temperaturesSet = new Set();
  const massesSet = new Set();

  group.tables.forEach(table => {
    (table.data || []).forEach(point => {
      if (point.Altitude !== undefined) altitudesSet.add(point.Altitude);
      if (point.Temperature !== undefined) temperaturesSet.add(point.Temperature);
      if (point.Masse !== undefined) massesSet.add(point.Masse);
    });
  });

  const altitudes = Array.from(altitudesSet).sort((a, b) => a - b);
  const temperatures = Array.from(temperaturesSet).sort((a, b) => a - b);
  const masses = Array.from(massesSet).sort((a, b) => a - b);

  // Champs supportés : FR (legacy) + EN (nouveau) + value (Option B)
  const distanceFields = [
    'Distance_roulement', 'Distance_passage_15m',
    'ground_roll', 'distance_50ft', 'over_50ft_m', 'ground_roll_m',
    'Distance', 'value'
  ];

  const values = {};
  distanceFields.forEach(field => {
    values[field] = masses.map((mass, massIdx) =>
      altitudes.map((alt, altIdx) =>
        temperatures.map((temp, tempIdx) => {
          for (const table of group.tables) {
            const point = (table.data || []).find(p =>
              p.Masse === mass && p.Altitude === alt && p.Temperature === temp
            );
            if (point && point[field] !== undefined) return point[field];
          }
          return null;
        })
      )
    );
  });

  return {
    baseName: group.baseName,
    type: group.type,
    altitudes, temperatures, masses, values,
    tableCount: group.tables.length
  };
}

export default {
  // Nouvelle API
  groupTablesByOperationId,
  buildLookupForOperation,
  // Ancienne API (rétrocompat)
  groupTablesByBaseName,
  filterGroupsByType,
  getCombinedDataForGroup,
  extractBaseName,
  extractMass,
  extractValue
};
