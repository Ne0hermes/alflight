// src/services/performanceInterpolation.js

/**
 * Service d'interpolation des performances aéronautiques
 * Utilise les tableaux extraits par l'IA pour calculer les performances réelles
 */

class PerformanceInterpolationService {
  /**
   * Interpolation linéaire simple entre deux points
   */
  linearInterpolate(x1, y1, x2, y2, x) {
    if (x1 === x2) return y1;
    return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
  }

  /**
   * Interpolation bilinéaire pour les tableaux 2D (altitude x température)
   */
  bilinearInterpolate(altitudes, temperatures, values, targetAlt, targetTemp) {
    // Vérifier qu'on a assez de données
    if (!altitudes.length || !temperatures.length || !values.length) {
      console.warn('Données insuffisantes pour interpolation');
      return null;
    }

    // Trier les tableaux pour être sûr
    const sortedAlts = [...altitudes].sort((a, b) => a - b);
    const sortedTemps = [...temperatures].sort((a, b) => a - b);

    // Trouver les indices encadrants pour l'altitude
    let altLow = 0, altHigh = sortedAlts.length - 1;
    let exactAltMatch = false;

    // Recherche des indices encadrants
    for (let i = 0; i < sortedAlts.length - 1; i++) {
      if (Math.abs(sortedAlts[i] - targetAlt) < 0.01) {
        // Correspondance exacte trouvée
        altLow = altHigh = i;
        exactAltMatch = true;
        console.log(`✅ Correspondance exacte altitude: ${sortedAlts[i]}ft`);
        break;
      } else if (sortedAlts[i] <= targetAlt && sortedAlts[i + 1] >= targetAlt) {
        altLow = i;
        altHigh = i + 1;
        break;
      }
    }

    // Vérifier aussi le dernier élément pour une correspondance exacte
    if (!exactAltMatch && Math.abs(sortedAlts[sortedAlts.length - 1] - targetAlt) < 0.01) {
      altLow = altHigh = sortedAlts.length - 1;
      exactAltMatch = true;
      console.log(`✅ Correspondance exacte altitude: ${sortedAlts[sortedAlts.length - 1]}ft`);
    }

    // Si altitude hors limites
    if (!exactAltMatch) {
      if (targetAlt < sortedAlts[0]) {
        altLow = altHigh = 0;
        console.log(`⚠️ Interpolation: altitude ${targetAlt}ft < min ${sortedAlts[0]}ft`);
      } else if (targetAlt > sortedAlts[sortedAlts.length - 1]) {
        altLow = altHigh = sortedAlts.length - 1;
        console.log(`⚠️ Interpolation: altitude ${targetAlt}ft > max ${sortedAlts[sortedAlts.length - 1]}ft`);
      }
    }

    // Trouver les indices encadrants pour la température
    let tempLow = 0, tempHigh = sortedTemps.length - 1;
    let exactTempMatch = false;

    for (let i = 0; i < sortedTemps.length - 1; i++) {
      if (Math.abs(sortedTemps[i] - targetTemp) < 0.01) {
        // Correspondance exacte trouvée
        tempLow = tempHigh = i;
        exactTempMatch = true;
        console.log(`✅ Correspondance exacte température: ${sortedTemps[i]}°C`);
        break;
      } else if (sortedTemps[i] <= targetTemp && sortedTemps[i + 1] >= targetTemp) {
        tempLow = i;
        tempHigh = i + 1;
        break;
      }
    }

    // Vérifier aussi le dernier élément pour une correspondance exacte
    if (!exactTempMatch && Math.abs(sortedTemps[sortedTemps.length - 1] - targetTemp) < 0.01) {
      tempLow = tempHigh = sortedTemps.length - 1;
      exactTempMatch = true;
      console.log(`✅ Correspondance exacte température: ${sortedTemps[sortedTemps.length - 1]}°C`);
    }

    // Si température hors limites
    if (!exactTempMatch) {
      if (targetTemp < sortedTemps[0]) {
        tempLow = tempHigh = 0;
        console.log(`⚠️ Interpolation: température ${targetTemp}°C < min ${sortedTemps[0]}°C`);
      } else if (targetTemp > sortedTemps[sortedTemps.length - 1]) {
        tempLow = tempHigh = sortedTemps.length - 1;
        console.log(`⚠️ Interpolation: température ${targetTemp}°C > max ${sortedTemps[sortedTemps.length - 1]}°C`);
      }
    }

    // Mapper les indices triés vers les indices originaux
    const origAltLow = altitudes.indexOf(sortedAlts[altLow]);
    const origAltHigh = altitudes.indexOf(sortedAlts[altHigh]);
    const origTempLow = temperatures.indexOf(sortedTemps[tempLow]);
    const origTempHigh = temperatures.indexOf(sortedTemps[tempHigh]);

    // Vérifier que les valeurs existent
    if (!values[origAltLow] || !values[origAltHigh]) {
      console.warn('Valeurs manquantes pour les altitudes', origAltLow, origAltHigh);
      return null;
    }

    // Si on est exactement sur un point de la grille
    if (exactAltMatch && exactTempMatch) {
      const exactValue = values[origAltLow][origTempLow];
      console.log(`✅ Valeur exacte trouvée: ${exactValue} (alt: ${sortedAlts[altLow]}ft, temp: ${sortedTemps[tempLow]}°C)`);
      return exactValue;
    }

    // Interpolation sur l'axe des températures pour l'altitude basse
    let valueLowAlt;
    if (tempLow === tempHigh) {
      valueLowAlt = values[origAltLow][origTempLow];
    } else {
      const v1 = values[origAltLow][origTempLow];
      const v2 = values[origAltLow][origTempHigh];
      if (v1 === null || v2 === null) {
        valueLowAlt = v1 || v2; // Utiliser la valeur non-null si possible
      } else {
        valueLowAlt = this.linearInterpolate(
          sortedTemps[tempLow],
          v1,
          sortedTemps[tempHigh],
          v2,
          targetTemp
        );
      }
    }

    // Interpolation sur l'axe des températures pour l'altitude haute
    let valueHighAlt;
    if (tempLow === tempHigh || altLow === altHigh) {
      valueHighAlt = values[origAltHigh][origTempLow];
    } else {
      const v1 = values[origAltHigh][origTempLow];
      const v2 = values[origAltHigh][origTempHigh];
      if (v1 === null || v2 === null) {
        valueHighAlt = v1 || v2; // Utiliser la valeur non-null si possible
      } else {
        valueHighAlt = this.linearInterpolate(
          sortedTemps[tempLow],
          v1,
          sortedTemps[tempHigh],
          v2,
          targetTemp
        );
      }
    }

    // Interpolation finale sur l'axe des altitudes
    if (altLow === altHigh) {
      return valueLowAlt;
    }
    
    if (valueLowAlt === null || valueHighAlt === null) {
      return valueLowAlt || valueHighAlt; // Utiliser la valeur non-null si possible
    }
    
    return this.linearInterpolate(
      sortedAlts[altLow],
      valueLowAlt,
      sortedAlts[altHigh],
      valueHighAlt,
      targetAlt
    );
  }

  /**
   * Calcule la température ISA pour une altitude donnée
   */
  getISATemperature(altitudeFt) {
    // ISA: 15°C au niveau de la mer, -2°C par 1000ft
    return 15 - (2 * altitudeFt / 1000);
  }

  /**
   * Prépare les données du tableau pour l'interpolation
   */
  prepareTableData(tableData) {
    if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
      return null;
    }

    // D'abord, nettoyer les données en remplaçant SL par 0
    const cleanedData = tableData.map(row => {
      const cleanedRow = { ...row };
      
      // Nettoyer l'altitude - chercher dans tous les champs possibles
      ['pressure_altitude_ft', 'pressure_alt_ft', 'altitude', 'altitude_ft'].forEach(field => {
        if (cleanedRow[field] !== undefined && cleanedRow[field] !== null) {
          const value = cleanedRow[field];
          
          // Si c'est "SL" ou contient "SL", remplacer par 0
          if (typeof value === 'string' && value.toUpperCase().includes('SL')) {
            cleanedRow[field] = 0;
            console.log(`🔄 Conversion SL → 0 pour le champ ${field}`);
          } else if (typeof value === 'string' && !isNaN(parseFloat(value))) {
            // Si c'est une chaîne numérique, la convertir en nombre
            cleanedRow[field] = parseFloat(value);
          }
        }
      });
      
      return cleanedRow;
    });

    // Extraire les altitudes uniques
    const altitudesSet = new Set();
    const temperaturesSet = new Set();
    
    cleanedData.forEach(row => {
      // Chercher les différentes variantes de noms de colonnes pour l'altitude
      let altValue = row.pressure_altitude_ft || row.pressure_alt_ft || row.altitude || row.altitude_ft;
      
      if (altValue !== undefined && altValue !== null) {
        altitudesSet.add(Number(altValue));
      }
      
      // Chercher les différentes variantes pour la température
      const tempValue = row.temperature_c || row.temperature_C || row.temperature || row.temp_c;
      if (tempValue !== undefined && tempValue !== null && tempValue !== 'ISA') {
        temperaturesSet.add(Number(tempValue));
      }
    });

    const altitudes = Array.from(altitudesSet).sort((a, b) => a - b);
    const temperatures = Array.from(temperaturesSet).sort((a, b) => a - b);

    // Créer une matrice de valeurs
    const groundRollMatrix = [];
    const distance50ftMatrix = [];

    altitudes.forEach(alt => {
      const groundRollRow = [];
      const distance50ftRow = [];
      
      temperatures.forEach(temp => {
        const dataPoint = cleanedData.find(row => {
          const rowAlt = Number(row.pressure_altitude_ft || row.pressure_alt_ft || row.altitude || row.altitude_ft);
          const rowTemp = Number(row.temperature_c || row.temperature_C || row.temperature || row.temp_c);
          return rowAlt === alt && rowTemp === temp;
        });
        
        if (dataPoint) {
          // Chercher les différentes variantes de noms pour ground roll et distance
          const groundRoll = dataPoint.ground_roll || dataPoint.ground_roll_m || dataPoint.groundroll ||
                            dataPoint.tod || dataPoint.Distance_roulement || dataPoint['Distance roulement'] || null;
          const distance50ft = dataPoint.distance_50ft || dataPoint.distance_15m || dataPoint.over_50ft_m ||
                              dataPoint.distance50ft || dataPoint.toda50ft || dataPoint.toda15m ||
                              dataPoint.Distance_passage_15m || dataPoint['Distance passage 15m'] ||
                              dataPoint.Distance_passage_50ft || dataPoint['Distance passage 50ft'] || null;

          // Log pour debug si on trouve exactement 6000ft et 0°C
          if (alt === 6000 && temp === 0) {
            console.log(`📍 Point exact trouvé (6000ft, 0°C):`, {
              groundRoll,
              distance50ft,
              dataPoint
            });
          }

          groundRollRow.push(groundRoll);
          distance50ftRow.push(distance50ft);
        } else {
          groundRollRow.push(null);
          distance50ftRow.push(null);
        }
      });
      
      groundRollMatrix.push(groundRollRow);
      distance50ftMatrix.push(distance50ftRow);
    });

    return {
      altitudes,
      temperatures,
      groundRollMatrix,
      distance50ftMatrix
    };
  }

  /**
   * Calcule les distances de décollage/atterrissage interpolées
   */
  calculatePerformance(extractedTable, altitude, temperature, weight = null) {
    if (!extractedTable || !extractedTable.data || extractedTable.data.length === 0) {
      console.warn('Pas de données de performance disponibles');
      return null;
    }

    console.log('🎯 Calcul de performance pour:', {
      altitude,
      temperature,
      weight,
      tableName: extractedTable.table_name
    });

    // Préparer les données
    const preparedData = this.prepareTableData(extractedTable.data);
    if (!preparedData) {
      return null;
    }

    const { altitudes, temperatures, groundRollMatrix, distance50ftMatrix } = preparedData;

    console.log('📊 Données préparées:', {
      altitudes,
      temperatures,
      groundRollMatrixSample: groundRollMatrix.length > 0 ? groundRollMatrix[0] : 'empty',
      distance50ftMatrixSample: distance50ftMatrix.length > 0 ? distance50ftMatrix[0] : 'empty'
    });

    // Si pas assez de données pour interpoler
    if (altitudes.length === 0 || temperatures.length === 0) {
      console.warn('Données insuffisantes pour l\'interpolation');
      return null;
    }

    // Interpoler les valeurs
    let groundRoll = null;
    let distance50ft = null;

    try {
      // Chercher d'abord une valeur non-null dans la matrice
      const hasGroundRoll = groundRollMatrix.some(row => row.some(val => val !== null));
      const hasDistance50ft = distance50ftMatrix.some(row => row.some(val => val !== null));

      if (hasGroundRoll) {
        groundRoll = this.bilinearInterpolate(
          altitudes,
          temperatures,
          groundRollMatrix,
          altitude,
          temperature
        );
      }

      if (hasDistance50ft) {
        distance50ft = this.bilinearInterpolate(
          altitudes,
          temperatures,
          distance50ftMatrix,
          altitude,
          temperature
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'interpolation:', error);
    }

    // Appliquer des facteurs de correction si nécessaire
    const result = {
      groundRoll: groundRoll ? Math.round(groundRoll) : null,
      distance50ft: distance50ft ? Math.round(distance50ft) : null,
      conditions: {
        altitude: altitude,
        temperature: temperature,
        weight: weight,
        tableUsed: extractedTable.table_name
      },
      confidence: extractedTable.confidence || 0.5,
      // Ajouter les détails du calcul
      interpolationDetails: {
        altitudesInTable: altitudes,
        temperaturesInTable: temperatures,
        targetAltitude: altitude,
        targetTemperature: temperature,
        dataPointsUsed: this.getInterpolationPoints(altitudes, temperatures, altitude, temperature, extractedTable.data),
        method: altitudes.length > 1 && temperatures.length > 1 ? 'Bilinéaire 2D' : 'Linéaire 1D'
      }
    };

    // Ajouter des marges de sécurité (15% recommandé)
    if (result.groundRoll) {
      result.groundRollWithMargin = Math.round(result.groundRoll * 1.15);
    }
    if (result.distance50ft) {
      result.distance50ftWithMargin = Math.round(result.distance50ft * 1.15);
    }

    return result;
  }

  /**
   * Récupère les points de données utilisés pour l'interpolation
   */
  getInterpolationPoints(altitudes, temperatures, targetAlt, targetTemp, tableData) {
    const points = [];
    
    console.log('🔍 Recherche points interpolation:', {
      targetAlt,
      targetTemp,
      altitudesDisponibles: altitudes,
      temperaturesDisponibles: temperatures
    });
    
    // Trouver les altitudes encadrantes
    let altLow = null, altHigh = null;
    
    // Trier les altitudes pour être sûr
    const sortedAlts = [...altitudes].sort((a, b) => a - b);
    
    for (let i = 0; i < sortedAlts.length - 1; i++) {
      if (sortedAlts[i] <= targetAlt && sortedAlts[i + 1] >= targetAlt) {
        altLow = sortedAlts[i];
        altHigh = sortedAlts[i + 1];
        break;
      }
    }
    
    // Si pas trouvé (altitude hors limites), prendre les extrêmes les plus proches
    if (altLow === null || altHigh === null) {
      if (targetAlt <= sortedAlts[0]) {
        // En dessous de la plage -> prendre la plus basse altitude
        altLow = altHigh = sortedAlts[0];
        console.log(`⚠️ Altitude ${targetAlt}ft sous la plage, utilisation de ${altLow}ft`);
      } else if (targetAlt >= sortedAlts[sortedAlts.length - 1]) {
        // Au-dessus de la plage -> prendre la plus haute altitude
        altLow = altHigh = sortedAlts[sortedAlts.length - 1];
        console.log(`⚠️ Altitude ${targetAlt}ft au-dessus de la plage, utilisation de ${altLow}ft`);
      }
    } else {
      console.log(`✅ Altitudes encadrantes trouvées: ${altLow}ft - ${altHigh}ft`);
    }
    
    // Trouver les températures encadrantes
    let tempLow = null, tempHigh = null;
    
    // Trier les températures pour être sûr
    const sortedTemps = [...temperatures].sort((a, b) => a - b);
    
    for (let i = 0; i < sortedTemps.length - 1; i++) {
      if (sortedTemps[i] <= targetTemp && sortedTemps[i + 1] >= targetTemp) {
        tempLow = sortedTemps[i];
        tempHigh = sortedTemps[i + 1];
        break;
      }
    }
    
    // Si pas trouvé (température hors limites), prendre les extrêmes les plus proches
    if (tempLow === null || tempHigh === null) {
      if (targetTemp <= sortedTemps[0]) {
        tempLow = tempHigh = sortedTemps[0];
        console.log(`⚠️ Température ${targetTemp}°C sous la plage, utilisation de ${tempLow}°C`);
      } else if (targetTemp >= sortedTemps[sortedTemps.length - 1]) {
        tempLow = tempHigh = sortedTemps[sortedTemps.length - 1];
        console.log(`⚠️ Température ${targetTemp}°C au-dessus de la plage, utilisation de ${tempLow}°C`);
      }
    } else {
      console.log(`✅ Températures encadrantes trouvées: ${tempLow}°C - ${tempHigh}°C`);
    }
    
    // Récupérer les 4 points d'interpolation
    const combinations = [
      { alt: altLow, temp: tempLow },
      { alt: altLow, temp: tempHigh },
      { alt: altHigh, temp: tempLow },
      { alt: altHigh, temp: tempHigh }
    ];
    
    combinations.forEach(combo => {
      const dataPoint = tableData.find(row => {
        // Nettoyer l'altitude avant de comparer
        let rowAlt = row.pressure_altitude_ft || row.pressure_alt_ft || row.altitude || row.altitude_ft;
        
        // Gérer le cas SL = 0
        if (typeof rowAlt === 'string' && rowAlt.toUpperCase().includes('SL')) {
          rowAlt = 0;
        }
        
        rowAlt = Number(rowAlt);
        const rowTemp = Number(row.temperature_c || row.temperature_C || row.temperature || row.temp_c);
        return rowAlt === combo.alt && rowTemp === combo.temp;
      });
      
      if (dataPoint) {
        points.push({
          altitude: combo.alt,
          temperature: combo.temp,
          groundRoll: dataPoint.ground_roll || dataPoint.ground_roll_m || dataPoint.groundroll || dataPoint.tod || null,
          distance50ft: dataPoint.distance_50ft || dataPoint.distance_15m || dataPoint.over_50ft_m || 
                       dataPoint.distance50ft || dataPoint.toda50ft || dataPoint.toda15m || null
        });
      }
    });
    
    return points;
  }

  /**
   * Trouve le tableau le plus approprié pour les conditions données
   */
  findBestTable(tables, type, weight) {
    if (!tables || tables.length === 0) return null;

    console.log(`🔍 Recherche de tableau ${type} pour poids ${weight}kg parmi ${tables.length} tableaux`);
    
    // Filtrer par type (takeoff ou landing)
    const filteredTables = tables.filter(table => {
      const tableName = (table.table_name || '').toLowerCase();
      const tableType = (table.table_type || '').toLowerCase();
      
      if (type === 'takeoff') {
        return tableType === 'takeoff' || 
               tableName.includes('take') || 
               tableName.includes('to') ||
               tableName.includes('décollage') ||
               tableName.includes('decolle');
      } else if (type === 'landing') {
        return tableType === 'landing' || 
               tableName.includes('land') || 
               tableName.includes('ldg') ||
               tableName.includes('atterrissage') ||
               tableName.includes('atterri');
      }
      return false;
    });

    console.log(`📊 ${filteredTables.length} tableaux trouvés pour ${type}`);
    
    if (filteredTables.length === 0) {
      // Si aucun tableau trouvé avec les critères stricts, essayer une recherche plus large
      console.log('⚠️ Aucun tableau trouvé, recherche élargie...');
      return tables[0]; // Retourner le premier tableau disponible
    }
    if (filteredTables.length === 1) return filteredTables[0];

    // Si plusieurs tableaux, essayer de trouver le plus proche en poids
    if (weight) {
      let bestTable = filteredTables[0];
      let bestDiff = Infinity;

      filteredTables.forEach(table => {
        // Extraire le poids du nom du tableau ou des conditions
        const weightMatch = table.table_name?.match(/(\d+)\s*kg/i) || 
                          table.conditions?.match(/(\d+)\s*kg/i);
        if (weightMatch) {
          const tableWeight = parseInt(weightMatch[1]);
          const diff = Math.abs(tableWeight - weight);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestTable = table;
          }
        }
      });

      return bestTable;
    }

    // Par défaut, retourner le premier tableau trouvé
    return filteredTables[0];
  }

  /**
   * Applique les corrections pour les conditions non-standard
   */
  applyCorrections(baseDistance, corrections = {}) {
    let correctedDistance = baseDistance;

    // Correction pour piste mouillée
    if (corrections.runwayWet) {
      correctedDistance *= 1.15; // +15% pour piste mouillée
    }

    // Correction pour piste en herbe
    if (corrections.runwayGrass) {
      correctedDistance *= 1.25; // +25% pour herbe
    }

    // Correction pour pente
    if (corrections.runwaySlope) {
      // +10% par % de pente montante (décollage) ou descendante (atterrissage)
      correctedDistance *= (1 + 0.1 * Math.abs(corrections.runwaySlope));
    }

    // Correction pour vent
    if (corrections.headwind) {
      // -10% par 10kt de vent de face
      correctedDistance *= (1 - 0.1 * (corrections.headwind / 10));
    } else if (corrections.tailwind) {
      // +15% par 10kt de vent arrière
      correctedDistance *= (1 + 0.15 * (corrections.tailwind / 10));
    }

    return Math.round(correctedDistance);
  }
}

// Export singleton
const performanceInterpolation = new PerformanceInterpolationService();
export default performanceInterpolation;