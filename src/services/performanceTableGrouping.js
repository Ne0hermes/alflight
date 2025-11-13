// src/services/performanceTableGrouping.js

/**
 * Service de regroupement des tableaux de performance par masse
 * Regroupe les tableaux qui représentent le même abaque à différentes masses
 */

/**
 * Extrait le nom de base d'un tableau (sans la masse)
 * @param {string} tableName - Nom du tableau
 * @returns {string} Nom de base
 */
function extractBaseName(tableName) {
  if (!tableName) return '';

  // Enlever les mentions de masse (1200 kg, 1310 kg / 2888 lb, etc.)
  return tableName
    .replace(/\s*-?\s*\d+\s*(kg|lb).*$/i, '')
    .replace(/\s*\/\s*\d+\s*(kg|lb).*$/i, '')
    .trim();
}

/**
 * Extrait la masse d'un tableau depuis son nom ou ses données
 * @param {Object} table - Tableau de performance
 * @returns {number|null} Masse en kg, ou null si non trouvée
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
  if (massMatch) {
    return parseFloat(massMatch[1]);
  }

  // 3. Chercher dans les conditions
  if (table.conditions && table.conditions.mass !== undefined) {
    return parseFloat(table.conditions.mass);
  }

  return null;
}

/**
 * Regroupe les tableaux par nom de base
 * @param {Array} tables - Liste des tableaux de performance
 * @returns {Array} Groupes de tableaux
 */
export function groupTablesByBaseName(tables) {
  if (!tables || !Array.isArray(tables)) {
    return [];
  }

  const groups = {};

  tables.forEach((table, index) => {
    const baseName = extractBaseName(table.table_name || '');
    const mass = extractMass(table);

    if (!baseName) {
      console.warn(`Table ${index} n'a pas de nom de base valide`);
      return;
    }

    if (!groups[baseName]) {
      groups[baseName] = {
        baseName,
        tables: [],
        type: table.table_type,
        masses: []
      };
    }

    groups[baseName].tables.push({
      ...table,
      originalIndex: index,
      mass,
      baseName
    });

    if (mass !== null && !groups[baseName].masses.includes(mass)) {
      groups[baseName].masses.push(mass);
    }
  });

  // Trier les masses pour chaque groupe
  Object.values(groups).forEach(group => {
    group.masses.sort((a, b) => a - b);
    group.tables.sort((a, b) => (a.mass || 0) - (b.mass || 0));
  });

  // Convertir en tableau
  return Object.values(groups);
}

/**
 * Filtre les groupes par type (takeoff/landing)
 * @param {Array} groups - Groupes de tableaux
 * @param {string} type - Type recherché ('takeoff' ou 'landing')
 * @returns {Array} Groupes filtrés
 */
export function filterGroupsByType(groups, type) {
  return groups.filter(group => {
    const groupType = (group.type || '').toLowerCase();
    const baseName = (group.baseName || '').toLowerCase();

    if (type === 'takeoff') {
      return groupType === 'takeoff' || baseName.includes('take') || baseName.includes('décollage');
    } else if (type === 'landing') {
      return groupType === 'landing' || baseName.includes('land') || baseName.includes('atterrissage');
    }

    return false;
  });
}

/**
 * Récupère les données combinées d'un groupe pour l'interpolation
 * @param {Object} group - Groupe de tableaux
 * @returns {Object} Structure de données pour interpolation trilinéaire
 */
export function getCombinedDataForGroup(group) {
  if (!group || !group.tables || group.tables.length === 0) {
    return null;
  }

  // Collecter toutes les altitudes, températures et masses uniques
  const altitudesSet = new Set();
  const temperaturesSet = new Set();
  const massesSet = new Set();

  group.tables.forEach(table => {
    if (table.data && Array.isArray(table.data)) {
      table.data.forEach(point => {
        if (point.Altitude !== undefined) altitudesSet.add(point.Altitude);
        if (point.Temperature !== undefined) temperaturesSet.add(point.Temperature);
        if (point.Masse !== undefined) massesSet.add(point.Masse);
      });
    }
  });

  const altitudes = Array.from(altitudesSet).sort((a, b) => a - b);
  const temperatures = Array.from(temperaturesSet).sort((a, b) => a - b);
  const masses = Array.from(massesSet).sort((a, b) => a - b);

  // Créer une structure 3D : values[massIdx][altIdx][tempIdx]
  const values = {};

  // Champs de distance disponibles
  const distanceFields = ['Distance_roulement', 'Distance_passage_15m'];

  distanceFields.forEach(field => {
    values[field] = [];

    masses.forEach((mass, massIdx) => {
      values[field][massIdx] = [];

      altitudes.forEach((alt, altIdx) => {
        values[field][massIdx][altIdx] = [];

        temperatures.forEach((temp, tempIdx) => {
          // Trouver la valeur dans les données
          let foundValue = null;

          for (const table of group.tables) {
            if (table.data && Array.isArray(table.data)) {
              const point = table.data.find(p =>
                p.Masse === mass &&
                p.Altitude === alt &&
                p.Temperature === temp
              );

              if (point && point[field] !== undefined) {
                foundValue = point[field];
                break;
              }
            }
          }

          values[field][massIdx][altIdx][tempIdx] = foundValue;
        });
      });
    });
  });

  return {
    baseName: group.baseName,
    type: group.type,
    altitudes,
    temperatures,
    masses,
    values,
    tableCount: group.tables.length
  };
}

export default {
  groupTablesByBaseName,
  filterGroupsByType,
  getCombinedDataForGroup,
  extractBaseName,
  extractMass
};
