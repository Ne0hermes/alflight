import { GraphConfig, AxesConfig, XYPoint } from './types';

/**
 * Calcule les limites automatiques des axes en fonction des points
 * Ajoute une marge fixe de 5 unités autour des valeurs min/max
 */
export function calculateAutoAxesLimits(
  points: XYPoint[],
  marginUnits: number = 5
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  if (!points || points.length === 0) {
    return { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
  }

  let xMin = points[0].x;
  let xMax = points[0].x;
  let yMin = points[0].y;
  let yMax = points[0].y;

  // Trouver les valeurs min et max exactes
  for (const point of points) {
    xMin = Math.min(xMin, point.x);
    xMax = Math.max(xMax, point.x);
    yMin = Math.min(yMin, point.y);
    yMax = Math.max(yMax, point.y);
  }

  // Ajouter une marge fixe de 5 unités
  const xRange = xMax - xMin;
  const yRange = yMax - yMin;

  // Si tous les points ont la même valeur, ajouter une plage par défaut
  if (xRange === 0) {
    xMin -= 50;
    xMax += 50;
  } else {
    xMin -= marginUnits;
    xMax += marginUnits;
  }

  if (yRange === 0) {
    yMin -= 50;
    yMax += 50;
  } else {
    yMin -= marginUnits;
    yMax += marginUnits;
  }

  // Arrondir simplement à l'entier le plus proche pour garder la précision
  xMin = Math.floor(xMin);
  xMax = Math.ceil(xMax);
  yMin = Math.floor(yMin);
  yMax = Math.ceil(yMax);

  return { xMin, xMax, yMin, yMax };
}

/**
 * Calcule les limites pour un graphique complet (toutes les courbes)
 */
export function calculateGraphAutoLimits(graph: GraphConfig): {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
} {
  const allPoints: XYPoint[] = [];

  // Collecter tous les points de toutes les courbes
  for (const curve of graph.curves) {
    if (curve.points && curve.points.length > 0) {
      allPoints.push(...curve.points);
    }
    // Inclure aussi les points interpolés s'ils existent
    if (curve.fitted && curve.fitted.points && curve.fitted.points.length > 0) {
      allPoints.push(...curve.fitted.points);
    }
  }

  return calculateAutoAxesLimits(allPoints);
}


/**
 * Met à jour les axes d'un graphique avec les limites automatiques
 */
export function updateAxesWithAutoLimits(
  axes: AxesConfig,
  limits: { xMin: number; xMax: number; yMin: number; yMax: number }
): AxesConfig {
  return {
    xAxis: {
      ...axes.xAxis,
      min: limits.xMin,
      max: limits.xMax
    },
    yAxis: {
      ...axes.yAxis,
      min: limits.yMin,
      max: limits.yMax
    }
  };
}

/**
 * Vérifie si les points sont en dehors des limites actuelles des axes
 */
export function arePointsOutOfBounds(
  points: XYPoint[],
  axes: AxesConfig,
  tolerance: number = 0
): boolean {
  for (const point of points) {
    if (
      point.x < axes.xAxis.min - tolerance ||
      point.x > axes.xAxis.max + tolerance ||
      point.y < axes.yAxis.min - tolerance ||
      point.y > axes.yAxis.max + tolerance
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Suggère de nouvelles limites si les points actuels sont proches des bords
 */
export function suggestNewLimits(
  axes: AxesConfig,
  points: XYPoint[],
  expandFactor: number = 0.2
): AxesConfig | null {
  if (points.length === 0) return null;

  const currentXRange = axes.xAxis.max - axes.xAxis.min;
  const currentYRange = axes.yAxis.max - axes.yAxis.min;

  // Vérifier si des points sont proches des bords (dans les 10% des limites)
  const threshold = 0.1;
  let needsExpansion = false;

  for (const point of points) {
    const xDistToMin = point.x - axes.xAxis.min;
    const xDistToMax = axes.xAxis.max - point.x;
    const yDistToMin = point.y - axes.yAxis.min;
    const yDistToMax = axes.yAxis.max - point.y;

    if (
      xDistToMin < currentXRange * threshold ||
      xDistToMax < currentXRange * threshold ||
      yDistToMin < currentYRange * threshold ||
      yDistToMax < currentYRange * threshold
    ) {
      needsExpansion = true;
      break;
    }
  }

  if (!needsExpansion) return null;

  // Calculer les nouvelles limites avec expansion
  const newLimits = calculateAutoAxesLimits(points, expandFactor);

  // Garder les limites existantes si elles sont plus larges
  return {
    xAxis: {
      ...axes.xAxis,
      min: Math.min(axes.xAxis.min, newLimits.xMin),
      max: Math.max(axes.xAxis.max, newLimits.xMax)
    },
    yAxis: {
      ...axes.yAxis,
      min: Math.min(axes.yAxis.min, newLimits.yMin),
      max: Math.max(axes.yAxis.max, newLimits.yMax)
    }
  };
}