// src/abac/v2/calibration.js
//
// Outils de conversion pixel ↔ data pour les abaques v2 et fit Bézier cubique.

/**
 * Construit une calibration à partir de 2 points cliqués + leurs coordonnées data.
 * En général :
 *   pointOrigin = (xMin, yMin)  ← coin bas-gauche du graphique sur le PDF
 *   pointMax    = (xMax, yMax)  ← coin haut-droit
 *
 * NOTE : les pixels Y croissent vers le bas dans une image, alors que les data Y
 * croissent vers le haut → la fonction `pixelToData` inverse l'axe Y.
 */
export function buildCalibration({ pixelOrigin, pixelMax, dataBounds }) {
  if (!pixelOrigin || !pixelMax || !dataBounds) {
    throw new Error('Calibration : pixelOrigin, pixelMax et dataBounds sont requis');
  }
  const { xMin, xMax, yMin, yMax } = dataBounds;
  if (xMax === xMin || yMax === yMin) {
    throw new Error('Calibration : bornes data invalides (xMin==xMax ou yMin==yMax)');
  }
  if (pixelOrigin.px === pixelMax.px || pixelOrigin.py === pixelMax.py) {
    throw new Error('Calibration : les 2 points doivent différer en x ET y');
  }
  return { pixelOrigin, pixelMax, dataBounds };
}

/**
 * Convertit un pixel (px, py) en coordonnées data (x, y).
 */
export function pixelToData(calibration, px, py) {
  const { pixelOrigin, pixelMax, dataBounds } = calibration;
  const { xMin, xMax, yMin, yMax } = dataBounds;

  const tx = (px - pixelOrigin.px) / (pixelMax.px - pixelOrigin.px);
  const ty = (py - pixelOrigin.py) / (pixelMax.py - pixelOrigin.py);

  return {
    x: xMin + tx * (xMax - xMin),
    y: yMin + ty * (yMax - yMin)
  };
}

/**
 * Convertit des coordonnées data (x, y) en pixel (px, py).
 */
export function dataToPixel(calibration, x, y) {
  const { pixelOrigin, pixelMax, dataBounds } = calibration;
  const { xMin, xMax, yMin, yMax } = dataBounds;

  const tx = (x - xMin) / (xMax - xMin);
  const ty = (y - yMin) / (yMax - yMin);

  return {
    px: pixelOrigin.px + tx * (pixelMax.px - pixelOrigin.px),
    py: pixelOrigin.py + ty * (pixelMax.py - pixelOrigin.py)
  };
}

// ---------------------------------------------------------------------------
// Fit Bézier cubique via Catmull-Rom (centripetal)
// ---------------------------------------------------------------------------
//
// Étant donné une liste de N points cliqués P0..P_{N-1}, on calcule N-1 segments
// de Bézier cubique passant exactement par les points. Chaque segment (P_i, P_{i+1})
// a pour control points :
//   cp1 = P_i     + (P_{i+1} - P_{i-1}) / 6
//   cp2 = P_{i+1} - (P_{i+2} - P_i)     / 6
// Aux bords, on duplique les extrémités (P_{-1} = P_0, P_N = P_{N-1}).
//
// Ce schéma donne une courbe C1, naturelle visuellement, qui passe exactement
// par chaque point cliqué (interpolante, pas approximation).

/**
 * Calcule les segments Bézier passant par les points donnés.
 * @param {Array<{x:number,y:number}>} points - au moins 2 points (sinon retourne [])
 * @returns {Array<{p0,cp1,cp2,p1}>}
 */
export function fitBezierThroughPoints(points) {
  if (!Array.isArray(points) || points.length < 2) return [];

  const n = points.length;
  const segments = [];

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const pPrev = i === 0 ? p0 : points[i - 1];
    const pNext = i + 2 >= n ? p1 : points[i + 2];

    const cp1 = {
      x: p0.x + (p1.x - pPrev.x) / 6,
      y: p0.y + (p1.y - pPrev.y) / 6
    };
    const cp2 = {
      x: p1.x - (pNext.x - p0.x) / 6,
      y: p1.y - (pNext.y - p0.y) / 6
    };

    segments.push({ p0, cp1, cp2, p1 });
  }

  return segments;
}

/**
 * Construit la chaîne `d=...` SVG depuis une liste de segments Bézier en coords pixel.
 * Les segments doivent être déjà projetés en pixels (utiliser dataToPixel avant).
 */
export function bezierSegmentsToSVGPath(pixelSegments) {
  if (!Array.isArray(pixelSegments) || pixelSegments.length === 0) return '';
  const first = pixelSegments[0];
  let d = `M ${first.p0.px} ${first.p0.py}`;
  for (const s of pixelSegments) {
    d += ` C ${s.cp1.px} ${s.cp1.py}, ${s.cp2.px} ${s.cp2.py}, ${s.p1.px} ${s.p1.py}`;
  }
  return d;
}

/**
 * Échantillonne un segment Bézier cubique (en coords data) à `nSamples` points,
 * utile pour mesurer un RMSE ou exporter une version polyligne.
 */
export function sampleBezierSegment(seg, nSamples = 20) {
  const out = [];
  for (let i = 0; i <= nSamples; i++) {
    const t = i / nSamples;
    const omt = 1 - t;
    const b0 = omt * omt * omt;
    const b1 = 3 * omt * omt * t;
    const b2 = 3 * omt * t * t;
    const b3 = t * t * t;
    out.push({
      x: b0 * seg.p0.x + b1 * seg.cp1.x + b2 * seg.cp2.x + b3 * seg.p1.x,
      y: b0 * seg.p0.y + b1 * seg.cp1.y + b2 * seg.cp2.y + b3 * seg.p1.y
    });
  }
  return out;
}
