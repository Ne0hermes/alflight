// curves/core/bezier.ts
//
// P2b (AUDIT_ABAC_CONSTRUCTION.md) — façonnage Bézier RECYCLÉ du prototype
// v2/BezierAbacEditor : étant donné les points cliqués d'une courbe, on calcule
// les segments de Bézier cubique qui passent EXACTEMENT par ces points
// (schéma Catmull-Rom), puis le pilote peut tirer les poignées cp1/cp2 de
// chaque segment pour affiner localement le tracé entre deux points.
//
// La Bézier est un OUTIL DE SAISIE, pas une représentation persistée :
// « Appliquer » échantillonne le tracé en points ordinaires (XYPoint[]) →
// le modèle de données, l'interpolation (manager.fitCurve) et la cascade
// restent strictement inchangés.

import { XYPoint } from './types';

export interface BezierSegment {
  p0: XYPoint;
  cp1: XYPoint;
  cp2: XYPoint;
  p1: XYPoint;
}

/** Overrides de poignées par INDEX de segment (coords DATA). */
export type BezierOverrides = Record<number, { cp1?: XYPoint; cp2?: XYPoint }>;

/**
 * Calcule les segments Bézier cubiques passant par les points donnés
 * (Catmull-Rom centripète : cp1 = P_i + (P_{i+1} − P_{i−1})/6, etc.).
 * Retourne [] si moins de 2 points.
 */
export function fitBezierThroughPoints(points: XYPoint[]): BezierSegment[] {
  if (!Array.isArray(points) || points.length < 2) return [];

  const n = points.length;
  const segments: BezierSegment[] = [];

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const pPrev = i === 0 ? p0 : points[i - 1];
    const pNext = i + 2 >= n ? p1 : points[i + 2];

    const cp1: XYPoint = {
      x: p0.x + (p1.x - pPrev.x) / 6,
      y: p0.y + (p1.y - pPrev.y) / 6
    };
    const cp2: XYPoint = {
      x: p1.x - (pNext.x - p0.x) / 6,
      y: p1.y - (pNext.y - p0.y) / 6
    };

    segments.push({ p0, cp1, cp2, p1 });
  }

  return segments;
}

/** Applique les poignées tirées par le pilote sur les segments de base. */
export function applyBezierOverrides(
  segments: BezierSegment[],
  overrides: BezierOverrides
): BezierSegment[] {
  return segments.map((seg, i) => {
    const ov = overrides[i];
    if (!ov) return seg;
    return { ...seg, ...(ov.cp1 ? { cp1: ov.cp1 } : {}), ...(ov.cp2 ? { cp2: ov.cp2 } : {}) };
  });
}

/** Échantillonne UN segment cubique à nSamples intervalles (nSamples+1 points). */
export function sampleBezierSegment(seg: BezierSegment, nSamples = 6): XYPoint[] {
  const out: XYPoint[] = [];
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

/**
 * Échantillonne TOUTE la chaîne de segments en une polyligne de points,
 * sans doublonner les jointures, puis TRIE PAR X : tout le pipeline aval
 * (manager.addPoint, interpolation, cascade) suppose une courbe fonction
 * de X. Si le pilote a déformé le tracé en « S » horizontal, le tri rabat
 * la forme sur une fonction — comportement assumé, cohérent avec le reste.
 */
export function sampleBezierSegments(segments: BezierSegment[], perSegment = 6): XYPoint[] {
  const out: XYPoint[] = [];
  segments.forEach((seg, i) => {
    const pts = sampleBezierSegment(seg, perSegment);
    // La jointure p1 du segment i == p0 du segment i+1 → on saute le 1er point
    // de chaque segment sauf le tout premier.
    out.push(...(i === 0 ? pts : pts.slice(1)));
  });
  return out.sort((a, b) => a.x - b.x);
}
