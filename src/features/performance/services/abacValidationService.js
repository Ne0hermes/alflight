// Service de validation et d'interpolation pour les données ABAC
// Implémente les tests de validation et les méthodes d'interpolation

class ABACValidationService {
  constructor() {
    this.tolerances = {
      absolute: 20, // mètres par défaut
      relative_percent: 5 // 5% par défaut
    };
  }

  // Valider un ensemble de données ABAC
  validateAbacData(abacData) {
    const validationReport = {
      isValid: true,
      errors: [],
      warnings: [],
      dataQuality: 1.0
    };

    // Vérifier la structure minimale
    if (!abacData.id) {
      validationReport.errors.push('ID manquant');
      validationReport.isValid = false;
    }

    if (!abacData.grid || !abacData.grid.values || abacData.grid.values.length === 0) {
      validationReport.errors.push('Grille de données vide');
      validationReport.isValid = false;
    }

    // Vérifier la cohérence des axes
    if (abacData.axes) {
      const requiredAxes = ['pressure_alt_ft', 'oat_c', 'mass_kg'];
      requiredAxes.forEach(axis => {
        if (!abacData.axes[axis] || !abacData.axes[axis].ticks || abacData.axes[axis].ticks.length === 0) {
          validationReport.warnings.push(`Axe ${axis} manquant ou incomplet`);
          validationReport.dataQuality *= 0.9;
        }
      });
    }

    // Vérifier la monotonie des données
    if (abacData.grid?.values) {
      const monotonicityCheck = this.checkMonotonicity(abacData.grid.values);
      if (!monotonicityCheck.isMonotonic) {
        validationReport.warnings.push(`Non-monotonie détectée: ${monotonicityCheck.details}`);
        validationReport.dataQuality *= 0.8;
      }
    }

    // Vérifier les plages de valeurs raisonnables
    const rangeCheck = this.checkDataRanges(abacData);
    if (rangeCheck.issues.length > 0) {
      validationReport.warnings.push(...rangeCheck.issues);
      validationReport.dataQuality *= rangeCheck.qualityFactor;
    }

    return validationReport;
  }

  // Vérifier la monotonie des données
  checkMonotonicity(values) {
    const result = {
      isMonotonic: true,
      details: ''
    };

    // Grouper par conditions fixes et vérifier la monotonie
    const grouped = this.groupByConditions(values);
    
    for (const [key, group] of Object.entries(grouped)) {
      // Trier par altitude
      const sorted = group.sort((a, b) => (a.pressure_alt_ft || 0) - (b.pressure_alt_ft || 0));
      
      // Vérifier que les valeurs augmentent avec l'altitude
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].value < sorted[i-1].value) {
          result.isMonotonic = false;
          result.details = `Décroissance anormale à ${sorted[i].pressure_alt_ft}ft`;
          break;
        }
      }
    }

    return result;
  }

  // Grouper les valeurs par conditions similaires
  groupByConditions(values) {
    const groups = {};
    
    values.forEach(v => {
      const key = `${v.oat_c}_${v.mass_kg}_${v.headwind_kt}_${v.slope_percent}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(v);
    });
    
    return groups;
  }

  // Vérifier les plages de données
  checkDataRanges(abacData) {
    const issues = [];
    let qualityFactor = 1.0;

    if (abacData.grid?.values) {
      abacData.grid.values.forEach(v => {
        // Vérifier l'altitude
        if (v.pressure_alt_ft < -1000 || v.pressure_alt_ft > 15000) {
          issues.push(`Altitude hors plage: ${v.pressure_alt_ft}ft`);
          qualityFactor *= 0.95;
        }

        // Vérifier la température
        if (v.oat_c < -40 || v.oat_c > 50) {
          issues.push(`Température hors plage: ${v.oat_c}°C`);
          qualityFactor *= 0.95;
        }

        // Vérifier la masse
        if (v.mass_kg < 300 || v.mass_kg > 5000) {
          issues.push(`Masse hors plage: ${v.mass_kg}kg`);
          qualityFactor *= 0.95;
        }

        // Vérifier les distances
        if (abacData.meta?.purpose?.includes('distance')) {
          if (v.value < 50 || v.value > 5000) {
            issues.push(`Distance suspecte: ${v.value}m`);
            qualityFactor *= 0.9;
          }
        }
      });
    }

    return { issues: [...new Set(issues)], qualityFactor };
  }

  // Exécuter les tests de validation
  async executeValidationTests(abacData, testCases) {
    const results = {
      id: abacData.id,
      status: 'pending',
      details: [],
      summary: {
        passed: 0,
        failed: 0,
        totalError: 0,
        maxError: 0
      }
    };

    for (const testCase of testCases) {
      const predicted = await this.interpolate(abacData, testCase.inputs);
      const expected = testCase.expected;
      const absError = Math.abs(predicted - expected);
      const pctError = (absError / Math.abs(expected)) * 100;
      
      const passed = absError <= testCase.tol_abs && pctError <= testCase.tol_pct;
      
      results.details.push({
        case: testCase.name,
        ok: passed,
        pred: predicted,
        exp: expected,
        abs_err: absError,
        pct_err: pctError,
        inputs: testCase.inputs
      });

      if (passed) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }
      
      results.summary.totalError += absError;
      results.summary.maxError = Math.max(results.summary.maxError, absError);
    }

    results.status = results.summary.failed === 0 ? 'pass' : 'fail';
    results.summary.successRate = results.summary.passed / testCases.length;

    return results;
  }

  // Interpolation des données ABAC
  async interpolate(abacData, inputs) {
    const method = abacData.interpolation?.method || 'bilinear';
    
    switch (method) {
      case 'bilinear':
        return this.bilinearInterpolation(abacData, inputs);
      case 'trilinear':
        return this.trilinearInterpolation(abacData, inputs);
      case 'multilinear':
        return this.multilinearInterpolation(abacData, inputs);
      default:
        return this.nearestNeighbor(abacData, inputs);
    }
  }

  // Interpolation bilinéaire (2D)
  bilinearInterpolation(abacData, inputs) {
    const values = abacData.grid.values;
    
    // Trouver les 4 points encadrants
    const bounds = this.findBounds2D(values, inputs);
    
    if (!bounds) {
      // Extrapolation ou valeur par défaut
      if (abacData.interpolation?.extrapolation_policy === 'linear_warn') {
        
        return this.linearExtrapolate(values, inputs);
      } else if (abacData.interpolation?.extrapolation_policy === 'clamp') {
        return this.clampToNearest(values, inputs);
      } else {
        throw new Error('Valeurs hors domaine, extrapolation interdite');
      }
    }

    // Interpolation bilinéaire standard
    const { x1, x2, y1, y2, q11, q12, q21, q22 } = bounds;
    const x = inputs.pressure_alt_ft;
    const y = inputs.oat_c;

    // Formule bilinéaire
    const fx1 = ((x2 - x) / (x2 - x1)) * q11 + ((x - x1) / (x2 - x1)) * q21;
    const fx2 = ((x2 - x) / (x2 - x1)) * q12 + ((x - x1) / (x2 - x1)) * q22;
    const result = ((y2 - y) / (y2 - y1)) * fx1 + ((y - y1) / (y2 - y1)) * fx2;

    return result;
  }

  // Interpolation trilinéaire (3D)
  trilinearInterpolation(abacData, inputs) {
    const values = abacData.grid.values;
    
    // Trouver les 8 points encadrants
    const bounds = this.findBounds3D(values, inputs);
    
    if (!bounds) {
      return this.handleOutOfBounds(abacData, values, inputs);
    }

    // Interpolation trilinéaire
    const x = inputs.pressure_alt_ft;
    const y = inputs.oat_c;
    const z = inputs.mass_kg;
    
    const { x0, x1, y0, y1, z0, z1, v } = bounds;
    
    // Calculer les coefficients
    const xd = (x - x0) / (x1 - x0);
    const yd = (y - y0) / (y1 - y0);
    const zd = (z - z0) / (z1 - z0);
    
    // Interpolation en 3 étapes
    const c00 = v[0][0][0] * (1 - xd) + v[1][0][0] * xd;
    const c01 = v[0][0][1] * (1 - xd) + v[1][0][1] * xd;
    const c10 = v[0][1][0] * (1 - xd) + v[1][1][0] * xd;
    const c11 = v[0][1][1] * (1 - xd) + v[1][1][1] * xd;
    
    const c0 = c00 * (1 - yd) + c10 * yd;
    const c1 = c01 * (1 - yd) + c11 * yd;
    
    const result = c0 * (1 - zd) + c1 * zd;
    
    return result;
  }

  // Interpolation multilinéaire (N dimensions)
  multilinearInterpolation(abacData, inputs) {
    const dimensions = abacData.grid.order_of_iteration;
    const values = abacData.grid.values;
    
    // Construire le hypercube de points
    const hypercube = this.findHypercube(values, inputs, dimensions);
    
    if (!hypercube) {
      return this.handleOutOfBounds(abacData, values, inputs);
    }

    // Interpolation récursive sur chaque dimension
    return this.recursiveInterpolate(hypercube, inputs, dimensions, 0);
  }

  // Interpolation récursive pour N dimensions
  recursiveInterpolate(cube, inputs, dimensions, dimIndex) {
    if (dimIndex >= dimensions.length) {
      return cube.value;
    }

    const dim = dimensions[dimIndex];
    const value = inputs[dim];
    
    // Trouver les deux hyperplans encadrants
    const [lower, upper] = this.splitHypercube(cube, dim, value);
    
    if (!upper) {
      return this.recursiveInterpolate(lower, inputs, dimensions, dimIndex + 1);
    }

    // Interpoler entre les deux hyperplans
    const lowerValue = this.recursiveInterpolate(lower, inputs, dimensions, dimIndex + 1);
    const upperValue = this.recursiveInterpolate(upper, inputs, dimensions, dimIndex + 1);
    
    const t = (value - lower[dim]) / (upper[dim] - lower[dim]);
    return lowerValue * (1 - t) + upperValue * t;
  }

  // Trouver les bornes pour interpolation 2D
  findBounds2D(values, inputs) {
    const x = inputs.pressure_alt_ft;
    const y = inputs.oat_c;
    
    // Filtrer par masse proche
    const massFiltered = values.filter(v => 
      Math.abs(v.mass_kg - inputs.mass_kg) < 50
    
    if (massFiltered.length < 4) return null;
    
    // Trouver les 4 coins
    const xValues = [...new Set(massFiltered.map(v => v.pressure_alt_ft))].sort((a, b) => a - b);
    const yValues = [...new Set(massFiltered.map(v => v.oat_c))].sort((a, b) => a - b);
    
    const x1 = xValues.find(v => v <= x) || xValues[0];
    const x2 = xValues.find(v => v > x) || xValues[xValues.length - 1];
    const y1 = yValues.find(v => v <= y) || yValues[0];
    const y2 = yValues.find(v => v > y) || yValues[yValues.length - 1];
    
    // Trouver les valeurs aux 4 coins
    const findValue = (px, py) => {
      const point = massFiltered.find(v => 
        v.pressure_alt_ft === px && v.oat_c === py
      return point ? point.value : null;
    };
    
    const q11 = findValue(x1, y1);
    const q12 = findValue(x1, y2);
    const q21 = findValue(x2, y1);
    const q22 = findValue(x2, y2);
    
    if (q11 === null || q12 === null || q21 === null || q22 === null) {
      return null;
    }
    
    return { x1, x2, y1, y2, q11, q12, q21, q22 };
  }

  // Trouver les bornes pour interpolation 3D
  findBounds3D(values, inputs) {
    // Implémentation simplifiée
    const bounds = {
      x0: 0, x1: 2000,
      y0: 0, y1: 30,
      z0: 900, z1: 1200,
      v: [[[0]]] // Placeholder
    };
    
    // TODO: Implémenter la recherche réelle des 8 points
    return bounds;
  }

  // Gérer les valeurs hors domaine
  handleOutOfBounds(abacData, values, inputs) {
    const policy = abacData.interpolation?.extrapolation_policy || 'forbid';
    
    switch (policy) {
      case 'forbid':
        throw new Error(`Valeurs hors domaine: ${JSON.stringify(inputs)}`);
      case 'linear_warn':
        
        return this.linearExtrapolate(values, inputs);
      case 'clamp':
        return this.clampToNearest(values, inputs);
      default:
        return this.nearestNeighbor(abacData, inputs);
    }
  }

  // Extrapolation linéaire
  linearExtrapolate(values, inputs) {
    // Trouver les deux points les plus proches
    const sorted = values.sort((a, b) => {
      const distA = this.euclideanDistance(a, inputs);
      const distB = this.euclideanDistance(b, inputs);
      return distA - distB;
    });
    
    if (sorted.length < 2) {
      return sorted[0]?.value || 0;
    }
    
    // Extrapolation linéaire simple
    const p1 = sorted[0];
    const p2 = sorted[1];
    
    const dx = p2.pressure_alt_ft - p1.pressure_alt_ft;
    const dy = p2.value - p1.value;
    
    if (dx === 0) return p1.value;
    
    const slope = dy / dx;
    const deltaX = inputs.pressure_alt_ft - p1.pressure_alt_ft;
    
    return p1.value + slope * deltaX;
  }

  // Limiter aux valeurs du domaine
  clampToNearest(values, inputs) {
    // Trouver le point le plus proche
    let minDist = Infinity;
    let nearest = null;
    
    values.forEach(v => {
      const dist = this.euclideanDistance(v, inputs);
      if (dist < minDist) {
        minDist = dist;
        nearest = v;
      }
    });
    
    return nearest?.value || 0;
  }

  // Plus proche voisin
  nearestNeighbor(abacData, inputs) {
    return this.clampToNearest(abacData.grid.values, inputs);
  }

  // Distance euclidienne
  euclideanDistance(point1, point2) {
    const dx = (point1.pressure_alt_ft || 0) - (point2.pressure_alt_ft || 0);
    const dy = (point1.oat_c || 0) - (point2.oat_c || 0);
    const dz = (point1.mass_kg || 0) - (point2.mass_kg || 0);
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Proposer des ajustements pour corriger les échecs
  proposeAdjustments(testResults, abacData) {
    const adjustments = [];
    const failedCases = testResults.details.filter(d => !d.ok);
    
    if (failedCases.length === 0) {
      return adjustments;
    }

    // Analyser les patterns d'erreur
    const errorAnalysis = this.analyzeErrors(failedCases);
    
    // Proposer des corrections basées sur l'analyse
    if (errorAnalysis.systematicBias) {
      adjustments.push({
        type: 'shift_output',
        delta: errorAnalysis.averageBias,
        confidence: errorAnalysis.biasConfidence
      });
    }

    if (errorAnalysis.scaleError) {
      adjustments.push({
        type: 'scale_output',
        factor: errorAnalysis.scaleFactor,
        confidence: errorAnalysis.scaleConfidence
      });
    }

    if (errorAnalysis.axisShift) {
      adjustments.push({
        type: 'shift_axis',
        axis: errorAnalysis.problematicAxis,
        delta: errorAnalysis.axisShiftValue
      });
    }

    return adjustments;
  }

  // Analyser les patterns d'erreur
  analyzeErrors(failedCases) {
    const errors = failedCases.map(c => c.pred - c.exp);
    const absErrors = errors.map(Math.abs);
    
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const avgAbsError = absErrors.reduce((a, b) => a + b, 0) / absErrors.length;
    
    // Détecter un biais systématique
    const systematicBias = Math.abs(avgError) > avgAbsError * 0.5;
    
    // Détecter une erreur d'échelle
    const relativeErrors = failedCases.map(c => (c.pred - c.exp) / c.exp);
    const avgRelError = relativeErrors.reduce((a, b) => a + b, 0) / relativeErrors.length;
    const scaleError = Math.abs(avgRelError) > 0.1;
    
    return {
      systematicBias,
      averageBias: avgError,
      biasConfidence: 1 - (Math.abs(avgError) / avgAbsError),
      scaleError,
      scaleFactor: 1 / (1 + avgRelError),
      scaleConfidence: Math.min(1, Math.abs(avgRelError) * 10),
      axisShift: false,
      problematicAxis: null,
      axisShiftValue: 0
    };
  }

  // Appliquer les ajustements aux données
  applyAdjustments(abacData, adjustments) {
    const adjustedData = JSON.parse(JSON.stringify(abacData)); // Deep copy
    
    adjustments.forEach(adj => {
      switch (adj.type) {
        case 'shift_output':
          adjustedData.grid.values.forEach(v => {
            v.value += adj.delta;
          });
          break;
          
        case 'scale_output':
          adjustedData.grid.values.forEach(v => {
            v.value *= adj.factor;
          });
          break;
          
        case 'shift_axis':
          adjustedData.grid.values.forEach(v => {
            if (v[adj.axis] !== undefined) {
              v[adj.axis] += adj.delta;
            }
          });
          break;
      }
    });
    
    return adjustedData;
  }
}

export default ABACValidationService;