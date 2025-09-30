import { XYPoint } from './types';

export function pchipInterpolate(points: XYPoint[], numOutputPoints: number = 100): XYPoint[] {
  if (points.length < 2) {
    throw new Error('PCHIP requires at least 2 points');
  }

  // Filtrer les points invalides
  const validPoints = points.filter(p =>
    typeof p.x === 'number' && !isNaN(p.x) && isFinite(p.x) &&
    typeof p.y === 'number' && !isNaN(p.y) && isFinite(p.y)
  );

  if (validPoints.length < 2) {
    console.warn('Not enough valid points for PCHIP interpolation');
    return validPoints;
  }

  const sortedPoints = [...validPoints].sort((a, b) => a.x - b.x);
  const n = sortedPoints.length;

  const slopes = computePCHIPSlopes(sortedPoints);

  const interpolated: XYPoint[] = [];
  const xMin = sortedPoints[0].x;
  const xMax = sortedPoints[n - 1].x;
  const step = (xMax - xMin) / (numOutputPoints - 1);

  // Calculer les limites Y des points originaux pour le clamping
  const originalMinY = Math.min(...sortedPoints.map(p => p.y));
  const originalMaxY = Math.max(...sortedPoints.map(p => p.y));

  for (let i = 0; i < numOutputPoints; i++) {
    const x = xMin + i * step;
    let y = evaluatePCHIP(x, sortedPoints, slopes);

    // IMPORTANT: Limiter Y aux bornes des points originaux
    y = Math.max(originalMinY, Math.min(originalMaxY, y));

    // Vérifier que la valeur calculée est valide
    if (!isNaN(y) && isFinite(y)) {
      interpolated.push({ x, y });
    }
  }

  return interpolated;
}

function computePCHIPSlopes(points: XYPoint[]): number[] {
  const n = points.length;
  const slopes: number[] = new Array(n);
  const deltas: number[] = new Array(n - 1);
  const h: number[] = new Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    h[i] = points[i + 1].x - points[i].x;
    deltas[i] = (points[i + 1].y - points[i].y) / h[i];
  }

  slopes[0] = deltas[0];
  slopes[n - 1] = deltas[n - 2];

  for (let i = 1; i < n - 1; i++) {
    const d0 = deltas[i - 1];
    const d1 = deltas[i];

    if (d0 * d1 <= 0) {
      slopes[i] = 0;
    } else {
      const w0 = 2 * h[i] + h[i - 1];
      const w1 = h[i] + 2 * h[i - 1];
      slopes[i] = (w0 + w1) / (w0 / d0 + w1 / d1);
    }
  }

  for (let i = 0; i < n - 1; i++) {
    const d = deltas[i];
    if (d === 0) {
      slopes[i] = 0;
      slopes[i + 1] = 0;
    } else {
      const alpha = slopes[i] / d;
      const beta = slopes[i + 1] / d;
      const cond = alpha * alpha + beta * beta;
      if (cond > 9) {
        const tau = 3 / Math.sqrt(cond);
        slopes[i] = tau * alpha * d;
        slopes[i + 1] = tau * beta * d;
      }
    }
  }

  return slopes;
}

function evaluatePCHIP(x: number, points: XYPoint[], slopes: number[]): number {
  const n = points.length;

  if (x <= points[0].x) return points[0].y;
  if (x >= points[n - 1].x) return points[n - 1].y;

  let i = 0;
  while (i < n - 1 && x > points[i + 1].x) {
    i++;
  }

  const h = points[i + 1].x - points[i].x;
  const t = (x - points[i].x) / h;
  const t2 = t * t;
  const t3 = t2 * t;

  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  return h00 * points[i].y + h10 * h * slopes[i] +
         h01 * points[i + 1].y + h11 * h * slopes[i + 1];
}

export function akimaInterpolate(points: XYPoint[], numOutputPoints: number = 100): XYPoint[] {
  if (points.length < 5) {
    throw new Error('Akima requires at least 5 points');
  }

  // Filtrer les points invalides
  const validPoints = points.filter(p =>
    typeof p.x === 'number' && !isNaN(p.x) && isFinite(p.x) &&
    typeof p.y === 'number' && !isNaN(p.y) && isFinite(p.y)
  );

  if (validPoints.length < 5) {
    console.warn('Not enough valid points for Akima interpolation');
    return pchipInterpolate(validPoints, numOutputPoints);
  }

  const sortedPoints = [...validPoints].sort((a, b) => a.x - b.x);
  const n = sortedPoints.length;

  const slopes = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    slopes[i] = (sortedPoints[i + 1].y - sortedPoints[i].y) /
                (sortedPoints[i + 1].x - sortedPoints[i].x);
  }

  const extendedSlopes = [
    2 * slopes[0] - slopes[1],
    2 * slopes[0] - slopes[2],
    ...slopes,
    2 * slopes[n - 2] - slopes[n - 3],
    2 * slopes[n - 2] - slopes[n - 4]
  ];

  const tangents = new Array(n);
  for (let i = 0; i < n; i++) {
    const m1 = extendedSlopes[i];
    const m2 = extendedSlopes[i + 1];
    const m3 = extendedSlopes[i + 2];
    const m4 = extendedSlopes[i + 3];

    const w1 = Math.abs(m4 - m3);
    const w2 = Math.abs(m2 - m1);

    if (w1 + w2 === 0) {
      tangents[i] = (m2 + m3) / 2;
    } else {
      tangents[i] = (w1 * m2 + w2 * m3) / (w1 + w2);
    }
  }

  const interpolated: XYPoint[] = [];
  const xMin = sortedPoints[0].x;
  const xMax = sortedPoints[n - 1].x;
  const step = (xMax - xMin) / (numOutputPoints - 1);

  // Calculer les limites Y des points originaux pour le clamping
  const originalMinY = Math.min(...sortedPoints.map(p => p.y));
  const originalMaxY = Math.max(...sortedPoints.map(p => p.y));

  for (let i = 0; i < numOutputPoints; i++) {
    const x = xMin + i * step;
    let y = evaluateAkima(x, sortedPoints, tangents);

    // IMPORTANT: Limiter Y aux bornes des points originaux
    y = Math.max(originalMinY, Math.min(originalMaxY, y));

    // Vérifier que la valeur calculée est valide
    if (!isNaN(y) && isFinite(y)) {
      interpolated.push({ x, y });
    }
  }

  return interpolated;
}

function evaluateAkima(x: number, points: XYPoint[], tangents: number[]): number {
  const n = points.length;

  if (x <= points[0].x) return points[0].y;
  if (x >= points[n - 1].x) return points[n - 1].y;

  let i = 0;
  while (i < n - 1 && x > points[i + 1].x) {
    i++;
  }

  const x0 = points[i].x;
  const x1 = points[i + 1].x;
  const y0 = points[i].y;
  const y1 = points[i + 1].y;
  const m0 = tangents[i];
  const m1 = tangents[i + 1];

  const h = x1 - x0;
  const t = (x - x0) / h;
  const t2 = t * t;
  const t3 = t2 * t;

  const a = y0;
  const b = m0;
  const c = (3 * (y1 - y0) / h - 2 * m0 - m1) / h;
  const d = (m0 + m1 - 2 * (y1 - y0) / h) / (h * h);

  return a + b * (x - x0) + c * Math.pow(x - x0, 2) + d * Math.pow(x - x0, 3);
}

export function naturalCubicSplineInterpolate(points: XYPoint[], numOutputPoints: number = 200): XYPoint[] {
  if (points.length < 2) {
    throw new Error('Natural cubic spline requires at least 2 points');
  }

  // Filtrer les points invalides
  const validPoints = points.filter(p =>
    typeof p.x === 'number' && !isNaN(p.x) && isFinite(p.x) &&
    typeof p.y === 'number' && !isNaN(p.y) && isFinite(p.y)
  );

  if (validPoints.length < 2) {
    console.warn('Not enough valid points for spline interpolation');
    return validPoints;
  }

  const sortedPoints = [...validPoints].sort((a, b) => a.x - b.x);

  // Si seulement 2 points, faire une interpolation linéaire
  if (sortedPoints.length === 2) {
    const interpolated: XYPoint[] = [];
    const xMin = sortedPoints[0].x;
    const xMax = sortedPoints[1].x;
    const yMin = sortedPoints[0].y;
    const yMax = sortedPoints[1].y;
    const step = (xMax - xMin) / (numOutputPoints - 1);

    for (let i = 0; i < numOutputPoints; i++) {
      const x = xMin + i * step;
      const t = (x - xMin) / (xMax - xMin);
      const y = yMin + t * (yMax - yMin);
      if (!isNaN(y) && isFinite(y)) {
        interpolated.push({ x, y });
      }
    }
    return interpolated;
  }
  const n = sortedPoints.length;

  // Calcul des coefficients de la spline cubique naturelle
  const h: number[] = [];
  const alpha: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    h[i] = sortedPoints[i + 1].x - sortedPoints[i].x;
    // Vérifier que h[i] n'est pas zéro ou trop petit
    if (Math.abs(h[i]) < 1e-10) {
      console.warn(`Points trop proches aux indices ${i} et ${i+1}`);
      // Utiliser PCHIP comme fallback
      return pchipInterpolate(sortedPoints, numOutputPoints);
    }
  }

  for (let i = 1; i < n - 1; i++) {
    alpha[i] = (3 / h[i]) * (sortedPoints[i + 1].y - sortedPoints[i].y) -
               (3 / h[i - 1]) * (sortedPoints[i].y - sortedPoints[i - 1].y);
  }

  // Résolution du système tridiagonal
  const l: number[] = new Array(n).fill(0);
  const mu: number[] = new Array(n).fill(0);
  const z: number[] = new Array(n).fill(0);
  const c: number[] = new Array(n).fill(0);
  const b: number[] = new Array(n - 1);
  const d: number[] = new Array(n - 1);

  l[0] = 1;
  mu[0] = 0;
  z[0] = 0;

  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (sortedPoints[i + 1].x - sortedPoints[i - 1].x) - h[i - 1] * mu[i - 1];
    // Vérifier la division par zéro
    if (Math.abs(l[i]) < 1e-10) {
      console.warn(`Matrice singulière détectée à l'indice ${i}`);
      // Utiliser PCHIP comme fallback
      return pchipInterpolate(sortedPoints, numOutputPoints);
    }
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  l[n - 1] = 1;
  z[n - 1] = 0;
  c[n - 1] = 0;

  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (sortedPoints[j + 1].y - sortedPoints[j].y) / h[j] -
           h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);

    // Vérifier que les coefficients sont valides
    if (!isFinite(b[j]) || !isFinite(c[j]) || !isFinite(d[j])) {
      console.warn(`Coefficients invalides détectés à l'indice ${j}`);
      // Utiliser PCHIP comme fallback
      return pchipInterpolate(sortedPoints, numOutputPoints);
    }
  }

  // Interpolation
  const interpolated: XYPoint[] = [];
  const xMin = sortedPoints[0].x;
  const xMax = sortedPoints[n - 1].x;
  const step = (xMax - xMin) / (numOutputPoints - 1);

  // Calculer les limites Y des points originaux pour le clamping
  const originalMinY = Math.min(...sortedPoints.map(p => p.y));
  const originalMaxY = Math.max(...sortedPoints.map(p => p.y));

  for (let i = 0; i < numOutputPoints; i++) {
    const x = xMin + i * step;

    // Trouver le segment
    let j = 0;
    while (j < n - 1 && x > sortedPoints[j + 1].x) {
      j++;
    }

    if (j === n - 1) j = n - 2;

    const dx = x - sortedPoints[j].x;
    let y = sortedPoints[j].y + b[j] * dx + c[j] * dx * dx + d[j] * dx * dx * dx;

    // IMPORTANT: Limiter Y aux bornes des points originaux pour éviter les oscillations
    y = Math.max(originalMinY, Math.min(originalMaxY, y));

    // Vérifier que la valeur calculée est valide
    if (!isNaN(y) && isFinite(y)) {
      interpolated.push({ x, y });
    }
  }

  return interpolated;
}

export function catmullRomInterpolate(points: XYPoint[], numOutputPoints: number = 150, tension: number = 0.5): XYPoint[] {
  if (points.length < 2) {
    throw new Error('Catmull-Rom requires at least 2 points');
  }

  // Filtrer les points invalides
  const validPoints = points.filter(p =>
    typeof p.x === 'number' && !isNaN(p.x) && isFinite(p.x) &&
    typeof p.y === 'number' && !isNaN(p.y) && isFinite(p.y)
  );

  if (validPoints.length < 2) {
    console.warn('Not enough valid points for Catmull-Rom interpolation');
    return validPoints;
  }

  const sortedPoints = [...validPoints].sort((a, b) => a.x - b.x);
  const n = sortedPoints.length;

  // Ajouter des points fantômes au début et à la fin
  const extendedPoints: XYPoint[] = [
    {
      x: sortedPoints[0].x - (sortedPoints[1].x - sortedPoints[0].x),
      y: sortedPoints[0].y - (sortedPoints[1].y - sortedPoints[0].y)
    },
    ...sortedPoints,
    {
      x: sortedPoints[n - 1].x + (sortedPoints[n - 1].x - sortedPoints[n - 2].x),
      y: sortedPoints[n - 1].y + (sortedPoints[n - 1].y - sortedPoints[n - 2].y)
    }
  ];

  const interpolated: XYPoint[] = [];

  for (let i = 1; i < extendedPoints.length - 2; i++) {
    const p0 = extendedPoints[i - 1];
    const p1 = extendedPoints[i];
    const p2 = extendedPoints[i + 1];
    const p3 = extendedPoints[i + 2];

    const segmentPoints = Math.ceil(numOutputPoints / (n - 1));

    for (let t = 0; t < 1; t += 1 / segmentPoints) {
      const t2 = t * t;
      const t3 = t2 * t;

      const v0 = tension * (p2.x - p0.x);
      const v1 = tension * (p3.x - p1.x);

      const a = 2 * p1.x - 2 * p2.x + v0 + v1;
      const b = -3 * p1.x + 3 * p2.x - 2 * v0 - v1;
      const c = v0;
      const d = p1.x;

      const x = a * t3 + b * t2 + c * t + d;

      const v0y = tension * (p2.y - p0.y);
      const v1y = tension * (p3.y - p1.y);

      const ay = 2 * p1.y - 2 * p2.y + v0y + v1y;
      const by = -3 * p1.y + 3 * p2.y - 2 * v0y - v1y;
      const cy = v0y;
      const dy = p1.y;

      const y = ay * t3 + by * t2 + cy * t + dy;

      // Vérifier que les valeurs calculées sont valides
      if (!isNaN(x) && isFinite(x) && !isNaN(y) && isFinite(y)) {
        interpolated.push({ x, y });
      }
    }
  }

  // Ajouter le dernier point
  interpolated.push(sortedPoints[n - 1]);

  // Éliminer les doublons et retrier par x
  const uniquePoints = interpolated.filter((point, index) => {
    if (index === 0) return true;
    return Math.abs(point.x - interpolated[index - 1].x) > 0.001;
  });

  return uniquePoints.sort((a, b) => a.x - b.x).slice(0, numOutputPoints);
}

export function calculateRMSE(original: XYPoint[], fitted: XYPoint[]): number {
  // Vérifier que les deux arrays ont des éléments valides
  if (!original || original.length === 0 || !fitted || fitted.length === 0) {
    return 0;
  }

  let sumSquaredErrors = 0;
  let count = 0;

  for (const point of original) {
    // Trouver le point interpolé le plus proche
    let closestFitted = fitted[0];
    let minDistance = Math.abs(fitted[0].x - point.x);

    for (const fittedPoint of fitted) {
      const distance = Math.abs(fittedPoint.x - point.x);
      if (distance < minDistance) {
        minDistance = distance;
        closestFitted = fittedPoint;
      }
    }

    const error = point.y - closestFitted.y;
    if (!isNaN(error) && isFinite(error)) {
      sumSquaredErrors += error * error;
      count++;
    }
  }

  return count > 0 ? Math.sqrt(sumSquaredErrors / count) : 0;
}

export function enforceMonotonicity(points: XYPoint[], increasing: boolean = true): XYPoint[] {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const result: XYPoint[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    let y = sorted[i].y;

    if (increasing) {
      y = Math.max(y, result[result.length - 1].y);
    } else {
      y = Math.min(y, result[result.length - 1].y);
    }

    result.push({ x: sorted[i].x, y });
  }

  return result;
}

export function smoothCurve(points: XYPoint[], factor: number = 0.5): XYPoint[] {
  if (factor <= 0 || factor >= 1) return points;
  if (points.length < 3) return points;

  const result: XYPoint[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const smoothedY = factor * points[i].y +
                     (1 - factor) * 0.5 * (points[i - 1].y + points[i + 1].y);
    result.push({ x: points[i].x, y: smoothedY });
  }

  result.push(points[points.length - 1]);
  return result;
}