// src/abac/curves/core/fittedRuntime.ts
//
// R20 — `fitted` (l'interpolation densément échantillonnée d'une courbe, 200
// points) est une donnée DÉRIVÉE de `points`. La persister gonflait
// `aircraft_data` (F-GNAM : 9 Mo, ~33 600 points fitted) au point de faire
// dépasser le statement_timeout Postgres à l'UPDATE (code 57014).
//
// Solution : on STRIPPE `fitted.points` avant d'écrire (on garde method+rmse,
// quelques octets) et on le RÉGÉNÈRE à la lecture. Équivalence prouvée
// bit-à-bit sur les 168 courbes réelles de F-GNAM (écart max 0,000000) :
// régénérer == valeur stockée, donc les calculs de perf ne changent pas.

import { GraphConfig, Curve } from './types';
import {
  naturalCubicSplineInterpolate,
  akimaInterpolate,
  pchipInterpolate,
  catmullRomInterpolate
} from './interpolation';

// Le builder produit toujours 200 points (AbacBuilder interpolationPoints).
const DEFAULT_NUM_POINTS = 200;

function computeFittedPoints(points: Curve['points'], method: string, numPoints: number) {
  if (!points || points.length < 2) return points ? [...points] : [];
  switch (method) {
    case 'akima':
      return points.length >= 5 ? akimaInterpolate(points, numPoints) : pchipInterpolate(points, numPoints);
    case 'catmullRom':
      return catmullRomInterpolate(points, numPoints, 0.5);
    case 'pchip':
      return pchipInterpolate(points, numPoints);
    case 'naturalSpline':
    default:
      return naturalCubicSplineInterpolate(points, numPoints);
  }
}

/** Idempotent : régénère `curve.fitted.points` s'il est absent/vide. Pur
 *  (renvoie de nouveaux objets, ne mute pas). Quand fitted est déjà présent
 *  (édition live, données non strippées), renvoie l'objet INCHANGÉ → coût nul. */
export function ensureFittedCurve(curve: Curve): Curve {
  if (curve.fitted?.points?.length) return curve;
  if (!curve.points || curve.points.length < 2) return curve;
  const method = curve.fitted?.method || 'naturalSpline';
  const points = computeFittedPoints(curve.points, method, DEFAULT_NUM_POINTS);
  return { ...curve, fitted: { points, rmse: curve.fitted?.rmse ?? 0, method } };
}

/** Régénère fitted sur tous les graphes. Renvoie le tableau INCHANGÉ si rien
 *  à régénérer (préserve l'identité référentielle pour React/mémoïsation). */
export function ensureFittedGraphs(graphs: GraphConfig[]): GraphConfig[] {
  if (!Array.isArray(graphs)) return graphs;
  let changed = false;
  const next = graphs.map(g => {
    if (!g.curves?.length) return g;
    let curvesChanged = false;
    const curves = g.curves.map(c => {
      const nc = ensureFittedCurve(c);
      if (nc !== c) curvesChanged = true;
      return nc;
    });
    if (!curvesChanged) return g;
    changed = true;
    return { ...g, curves };
  });
  return changed ? next : graphs;
}

/** Inverse : retire `fitted.points` avant persistance (garde method+rmse,
 *  ~30 octets/courbe au lieu de 200 points). Pur. */
export function stripFittedGraphs(graphs: GraphConfig[]): GraphConfig[] {
  if (!Array.isArray(graphs)) return graphs;
  return graphs.map(g => ({
    ...g,
    curves: (g.curves || []).map(c =>
      c.fitted?.points?.length
        ? { ...c, fitted: { ...c.fitted, points: [] } }
        : c
    )
  }));
}

/** Strip appliqué à une structure `aircraft_data` complète (JS, pour la
 *  couche de persistance). Mute une COPIE superficielle ciblée des chemins
 *  performanceModels[].data.graphs[].curves[].fitted.points. Tolérant aux
 *  formes legacy. Renvoie un nouvel objet aircraft_data. */
export function stripFittedFromAircraftData(aircraftData: any): any {
  if (!aircraftData || typeof aircraftData !== 'object') return aircraftData;
  const models = aircraftData.performanceModels;
  if (!Array.isArray(models) || models.length === 0) return aircraftData;
  let stripped = 0;
  const nextModels = models.map((m: any) => {
    const graphs = m?.data?.graphs;
    if (!Array.isArray(graphs)) return m;
    const nextGraphs = graphs.map((g: any) => {
      if (!Array.isArray(g?.curves)) return g;
      const nextCurves = g.curves.map((c: any) => {
        if (c?.fitted?.points?.length) {
          stripped += c.fitted.points.length;
          return { ...c, fitted: { ...c.fitted, points: [] } };
        }
        return c;
      });
      return { ...g, curves: nextCurves };
    });
    return { ...m, data: { ...m.data, graphs: nextGraphs } };
  });
  if (stripped === 0) return aircraftData;
  return { ...aircraftData, performanceModels: nextModels };
}
