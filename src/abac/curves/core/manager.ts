import { v4 as uuidv4 } from 'uuid';
import {
  XYPoint,
  Curve,
  FitOptions,
  FitResult,
  AxesConfig,
  ChartRef,
  AbacCurvesJSON,
  InterpolationMethod
} from './types';
import {
  pchipInterpolate,
  akimaInterpolate,
  naturalCubicSplineInterpolate,
  catmullRomInterpolate,
  calculateRMSE,
  enforceMonotonicity,
  smoothCurve
} from './interpolation';

export class AbacCurveManager {
  private curves: Map<string, Curve> = new Map();
  private axesConfig: AxesConfig | null = null;

  constructor() {}

  setAxesConfig(config: AxesConfig): void {
    this.axesConfig = config;
  }

  getAxesConfig(): AxesConfig | null {
    return this.axesConfig;
  }

  addCurve(nameOrData: string | Partial<Curve>, color?: string): string {
    const id = uuidv4();
    let curve: Curve;

    if (typeof nameOrData === 'string') {
      // Ancien format : juste nom et couleur
      curve = {
        id,
        name: nameOrData,
        color: color || this.getRandomColor(),
        points: []
      };
    } else {
      // Nouveau format : objet avec données complètes
      curve = {
        id,
        name: nameOrData.name || `Courbe ${this.curves.size + 1}`,
        color: nameOrData.color || this.getRandomColor(),
        points: nameOrData.points || [],
        fitted: nameOrData.fitted
      };
    }

    console.log(`🏭 Manager.addCurve: Ajout de "${curve.name}" avec ${curve.points.length} points`);
    if (curve.points.length > 0) {
      console.log(`  📦 Premiers points:`, curve.points.slice(0, 3).map(p => `(${p.x}, ${p.y})`));
    }

    this.curves.set(id, curve);
    return id;
  }

  removeCurve(curveId: string): void {
    this.curves.delete(curveId);
  }

  getCurve(curveId: string): Curve | undefined {
    return this.curves.get(curveId);
  }

  getAllCurves(): Curve[] {
    return Array.from(this.curves.values());
  }

  addPoint(curveId: string, point: XYPoint): void {
    const curve = this.curves.get(curveId);
    if (!curve) {
      throw new Error(`Curve ${curveId} not found`);
    }

    const newPoint = {
      ...point,
      id: point.id || uuidv4()
    };

    curve.points.push(newPoint);
    curve.points.sort((a, b) => a.x - b.x);
  }

  removePoint(curveId: string, pointId: string): void {
    const curve = this.curves.get(curveId);
    if (!curve) {
      throw new Error(`Curve ${curveId} not found`);
    }

    curve.points = curve.points.filter(p => p.id !== pointId);
  }

  updatePoint(curveId: string, pointId: string, newPoint: XYPoint): void {
    const curve = this.curves.get(curveId);
    if (!curve) {
      throw new Error(`Curve ${curveId} not found`);
    }

    const index = curve.points.findIndex(p => p.id === pointId);
    if (index !== -1) {
      curve.points[index] = { ...newPoint, id: pointId };
      curve.points.sort((a, b) => a.x - b.x);
    }
  }

  fitCurve(curveId: string, options: FitOptions = {}): FitResult {
    console.log('\n🤖 === AbacCurveManager.fitCurve ===');
    console.log('🆔 CurveId:', curveId);
    console.log('📈 Options:', options);
    console.log('🗂️ Courbes dans le manager:', Array.from(this.curves.keys()));

    const curve = this.curves.get(curveId);
    if (!curve) {
      console.error(`❌ Courbe ${curveId} non trouvée dans le manager!`);
      console.error('🗂️ Courbes disponibles:', Array.from(this.curves.keys()));
      throw new Error(`Curve ${curveId} not found`);
    }

    console.log(`📍 Courbe trouvée: "${curve.name}"`);
    console.log(`🔵 Couleur: ${curve.color}`);
    console.log(`📊 Nombre de points: ${curve.points.length}`);

    const {
      method = 'naturalSpline',
      monotonic = false,
      smoothing = 0,
      numPoints = 200
    } = options;

    console.log('🔧 Paramètres d\'interpolation:');
    console.log('  - Méthode:', method);
    console.log('  - Monotone:', monotonic);
    console.log('  - Lissage:', smoothing);
    console.log('  - Nombre de points:', numPoints);

    const warnings: string[] = [];

    if (curve.points.length < 2) {
      console.warn('⚠️ Points insuffisants pour l\'interpolation');
      warnings.push('Insufficient points for interpolation (minimum 2 required)');
      return {
        curveId,
        originalPoints: curve.points,
        fittedPoints: curve.points,
        rmse: 0,
        warnings,
        method
      };
    }

    if (method === 'akima' && curve.points.length < 5) {
      console.warn('⚠️ Akima nécessite au moins 5 points, utilisation de PCHIP');
      warnings.push('Akima requires at least 5 points, falling back to PCHIP');
    }

    let fittedPoints: XYPoint[];

    try {
      if (method === 'akima' && curve.points.length >= 5) {
        console.log('🌀 Utilisation de l\'interpolation Akima...');
        fittedPoints = akimaInterpolate(curve.points, numPoints);
      } else if (method === 'naturalSpline') {
        console.log('🎨 Utilisation de l\'interpolation Spline Cubique Naturelle...');
        fittedPoints = naturalCubicSplineInterpolate(curve.points, numPoints);
      } else if (method === 'catmullRom') {
        console.log('🎢 Utilisation de l\'interpolation Catmull-Rom...');
        fittedPoints = catmullRomInterpolate(curve.points, numPoints, 0.5);
      } else {
        console.log('🌁 Utilisation de l\'interpolation PCHIP...');
        fittedPoints = pchipInterpolate(curve.points, numPoints);
      }

      console.log(`✅ Interpolation réussie! ${fittedPoints.length} points générés`);
      if (fittedPoints.length > 0) {
        console.log('📦 Premiers points interpolés:',
          fittedPoints.slice(0, 3).map(p => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join(', '));
      } else {
        console.warn(`⚠️ Aucun point interpolé généré pour la courbe "${curve.name}"`);
        console.log('🔍 Points originaux:', curve.points);
        // Utiliser les points originaux si l'interpolation échoue
        fittedPoints = [...curve.points];
      }

      if (monotonic) {
        const isIncreasing = curve.points.length >= 2 &&
          curve.points[curve.points.length - 1].y > curve.points[0].y;
        fittedPoints = enforceMonotonicity(fittedPoints, isIncreasing);
      }

      if (smoothing > 0) {
        fittedPoints = smoothCurve(fittedPoints, smoothing);
      }

      const rmse = calculateRMSE(curve.points, fittedPoints);

      if (rmse > 10) {
        warnings.push(`High RMSE value (${rmse.toFixed(2)}), consider adjusting parameters`);
      }

      if (this.axesConfig) {
        const { xAxis, yAxis } = this.axesConfig;
        const hasExtrapolation = fittedPoints.some(p =>
          p.x < xAxis.min || p.x > xAxis.max ||
          p.y < yAxis.min || p.y > yAxis.max
        );
        if (hasExtrapolation) {
          warnings.push('Some fitted points are outside the defined axes bounds');
        }
      }

      console.log(`📏 RMSE calculé: ${rmse.toFixed(4)}`);

      curve.fitted = {
        points: fittedPoints,
        rmse,
        method
      };

      console.log('💾 Données interpolées sauvegardées dans la courbe');
      console.log('🎉 === Fin de AbacCurveManager.fitCurve (succès) ===\n');

      return {
        curveId,
        originalPoints: curve.points,
        fittedPoints,
        rmse,
        warnings,
        method
      };
    } catch (error) {
      console.error('❌ Erreur lors de l\'interpolation:', error);
      console.error('📦 Stack trace:', (error as Error).stack);
      warnings.push(`Interpolation failed: ${error.message}`);

      console.log('🎉 === Fin de AbacCurveManager.fitCurve (erreur) ===\n');

      return {
        curveId,
        originalPoints: curve.points,
        fittedPoints: curve.points,
        rmse: 0,
        warnings,
        method
      };
    }
  }

  fitAll(options: FitOptions = {}): Record<string, FitResult> {
    const results: Record<string, FitResult> = {};

    for (const curve of this.curves.values()) {
      results[curve.id] = this.fitCurve(curve.id, options);
    }

    return results;
  }

  serializeModel(): AbacCurvesJSON {
    if (!this.axesConfig) {
      throw new Error('Axes configuration not set');
    }

    return {
      version: '1.0.0',
      axes: this.axesConfig,
      curves: this.getAllCurves(),
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }

  loadModel(json: AbacCurvesJSON): void {
    this.clear();
    this.axesConfig = json.axes;

    for (const curve of json.curves) {
      this.curves.set(curve.id, { ...curve });
    }
  }

  /**
   * Génère des courbes intermédiaires entre les courbes existantes
   * pour améliorer la précision de l'interpolation
   * @param numIntermediateCurves Nombre de courbes intermédiaires entre chaque paire
   * @returns IDs des nouvelles courbes créées
   */
  generateIntermediateCurves(numIntermediateCurves: number = 1): string[] {
    const newCurveIds: string[] = [];

    // Obtenir toutes les courbes et les trier par paramètre
    const curvesArray = this.getAllCurves();

    // Filtrer les courbes interpolées existantes
    const baseCurves = curvesArray.filter(c => !c.name.includes('(interpolé)'));

    // Si aucune courbe de base, retourner vide
    if (baseCurves.length < 2) {
      console.log(`⚠️ Pas assez de courbes de base (${baseCurves.length}), minimum 2 requis`);
      return newCurveIds;
    }

    // Extraire les paramètres numériques des noms de courbes
    // Accepter différents formats : "1000 kg", "1000kg", "1000", "Courbe 1", etc.
    let curvesWithParams = baseCurves
      .map(curve => {
        // Essayer différents patterns pour extraire le nombre
        let param = null;

        // Pattern 1: nombre au début (ex: "1000 kg", "1000", "-10 kt")
        let match = curve.name.match(/^(-?[\d.]+)/);
        if (match) {
          param = parseFloat(match[1]);
        }

        // Pattern 2: "Courbe X" ou similaire
        if (param === null) {
          match = curve.name.match(/(?:courbe|curve|line)\s*(\d+)/i);
          if (match) {
            param = parseFloat(match[1]);
          }
        }

        // Pattern 3: nombre n'importe où dans le nom
        if (param === null) {
          match = curve.name.match(/(-?[\d.]+)/);
          if (match) {
            param = parseFloat(match[1]);
          }
        }

        return { curve, param };
      });

    // Si aucun paramètre trouvé, utiliser l'ordre des courbes
    const hasParams = curvesWithParams.some(cp => cp.param !== null);
    if (!hasParams) {
      console.log(`⚠️ Aucun paramètre numérique trouvé dans les noms de courbes, utilisation de l'ordre des courbes`);
      curvesWithParams = baseCurves.map((curve, index) => ({
        curve,
        param: index * 100 // Utiliser un espacement de 100 entre les courbes
      }));
    } else {
      // Filtrer seulement ceux avec des paramètres et trier
      curvesWithParams = curvesWithParams
        .filter(cp => cp.param !== null)
        .sort((a, b) => a.param! - b.param!);
    }

    console.log(`🔧 Génération de courbes intermédiaires...`);
    console.log(`   Courbes de base (${baseCurves.length}): ${baseCurves.map(c => c.name).join(', ')}`);
    console.log(`   Courbes avec paramètres (${curvesWithParams.length}): ${curvesWithParams.map(cp => `${cp.curve.name}(${cp.param})`).join(', ')}`);

    // Pour chaque paire de courbes consécutives
    for (let i = 0; i < curvesWithParams.length - 1; i++) {
      const lower = curvesWithParams[i];
      const upper = curvesWithParams[i + 1];

      // Interpoler automatiquement les courbes si nécessaire
      if (!lower.curve.fitted && lower.curve.points.length >= 2) {
        console.log(`   🔄 Interpolation automatique de "${lower.curve.name}"`);
        this.fitCurve(lower.curve.id, { method: 'pchip', numPoints: 100 });
        lower.curve = this.getCurve(lower.curve.id)!;
      }

      if (!upper.curve.fitted && upper.curve.points.length >= 2) {
        console.log(`   🔄 Interpolation automatique de "${upper.curve.name}"`);
        this.fitCurve(upper.curve.id, { method: 'pchip', numPoints: 100 });
        upper.curve = this.getCurve(upper.curve.id)!;
      }

      if (!lower.curve.fitted || !upper.curve.fitted) {
        console.warn(`⚠️ Courbes ne peuvent pas être interpolées (pas assez de points), passage à la paire suivante`);
        continue;
      }

      console.log(`   📊 Entre "${lower.curve.name}" et "${upper.curve.name}"`);

      // Générer les courbes intermédiaires
      for (let j = 1; j <= numIntermediateCurves; j++) {
        const ratio = j / (numIntermediateCurves + 1);
        const intermediateParam = lower.param! + ratio * (upper.param! - lower.param!);

        // Créer les points interpolés par moyenne arithmétique
        const intermediatePoints: XYPoint[] = [];

        // Utiliser les points fitted pour une meilleure précision
        const lowerPoints = lower.curve.fitted.points;
        const upperPoints = upper.curve.fitted.points;

        // Créer une grille uniforme de valeurs X
        // Trouver les limites communes
        const xMin = Math.max(lowerPoints[0].x, upperPoints[0].x);
        const xMax = Math.min(
          lowerPoints[lowerPoints.length - 1].x,
          upperPoints[upperPoints.length - 1].x
        );

        // Créer des points uniformément espacés
        const numPoints = Math.max(lowerPoints.length, upperPoints.length);
        const xStep = (xMax - xMin) / (numPoints - 1);

        console.log(`      Création de courbe intermédiaire ${j}/${numIntermediateCurves} (ratio=${ratio.toFixed(2)})`);
        console.log(`      Plage X commune: [${xMin.toFixed(2)}, ${xMax.toFixed(2)}]`);

        // Pour chaque valeur X, calculer la moyenne pondérée des Y
        for (let k = 0; k < numPoints; k++) {
          const x = xMin + k * xStep;

          // Trouver Y sur la courbe inférieure
          const yLower = this.findYAtX(lowerPoints, x);
          // Trouver Y sur la courbe supérieure
          const yUpper = this.findYAtX(upperPoints, x);

          if (yLower !== null && yUpper !== null) {
            // Moyenne arithmétique pondérée selon le ratio
            const yIntermediate = yLower + ratio * (yUpper - yLower);
            intermediatePoints.push({
              id: uuidv4(),
              x,
              y: yIntermediate
            });
          }
        }

        if (intermediatePoints.length > 0) {
          // Déterminer le nom de la courbe intermédiaire
          let intermediateName: string;

          // Si on utilise l'ordre des courbes (pas de paramètres numériques)
          if (!hasParams) {
            intermediateName = `Entre ${lower.curve.name} et ${upper.curve.name} (${j}/${numIntermediateCurves})`;
          } else {
            // Déterminer l'unité à partir des courbes existantes
            const unit = lower.curve.name.match(/\s+(\w+)$/)?.[1] || '';
            intermediateName = `${intermediateParam.toFixed(0)}${unit ? ' ' + unit : ''} (interpolé)`;
          }

          // Calculer une couleur intermédiaire
          const intermediateColor = this.interpolateColor(lower.curve.color, upper.curve.color, ratio);

          // Ajouter la nouvelle courbe
          const newId = this.addCurve({
            name: intermediateName,
            color: intermediateColor,
            points: [], // Pas de points originaux
            fitted: {
              points: intermediatePoints,
              rmse: 0,
              method: 'linearInterpolation'
            }
          });

          newCurveIds.push(newId);
          console.log(`      ✅ Créée: "${intermediateName}" avec ${intermediatePoints.length} points`);
        }
      }
    }

    console.log(`✨ ${newCurveIds.length} courbes intermédiaires générées`);
    return newCurveIds;
  }

  /**
   * Trouve la valeur Y pour un X donné dans une liste de points
   */
  private findYAtX(points: XYPoint[], x: number): number | null {
    // Chercher une correspondance exacte
    for (const point of points) {
      if (Math.abs(point.x - x) < 0.0001) {
        return point.y;
      }
    }

    // Interpolation linéaire entre deux points
    for (let i = 0; i < points.length - 1; i++) {
      if (points[i].x <= x && points[i + 1].x >= x) {
        const ratio = (x - points[i].x) / (points[i + 1].x - points[i].x);
        return points[i].y + ratio * (points[i + 1].y - points[i].y);
      }
    }

    return null;
  }

  /**
   * Interpole entre deux couleurs
   */
  private interpolateColor(color1: string, color2: string, ratio: number): string {
    // Convertir hex en RGB
    const hex2rgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 0, b: 0 };
    };

    const rgb2hex = (r: number, g: number, b: number) => {
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    };

    const c1 = hex2rgb(color1);
    const c2 = hex2rgb(color2);

    const r = Math.round(c1.r + ratio * (c2.r - c1.r));
    const g = Math.round(c1.g + ratio * (c2.g - c1.g));
    const b = Math.round(c1.b + ratio * (c2.b - c1.b));

    return rgb2hex(r, g, b);
  }

  clear(): void {
    this.curves.clear();
    this.axesConfig = null;
  }

  createChartRef(): ChartRef {
    return {
      addPoint: (curveId, point) => this.addPoint(curveId, point),
      removePoint: (curveId, pointId) => this.removePoint(curveId, pointId),
      updatePoint: (curveId, pointId, newPoint) => this.updatePoint(curveId, pointId, newPoint),
      fitCurve: (curveId, options) => this.fitCurve(curveId, options),
      fitAll: () => this.fitAll(),
      getCurves: () => this.getAllCurves(),
      addCurve: (curve) => {
        const id = this.addCurve(curve.name, curve.color);
        if (curve.points) {
          curve.points.forEach(p => this.addPoint(id, p));
        }
        return id;
      },
      removeCurve: (curveId) => this.removeCurve(curveId),
      clear: () => this.clear()
    };
  }
}

export const abacManager = new AbacCurveManager();