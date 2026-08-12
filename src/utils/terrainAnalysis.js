// src/utils/terrainAnalysis.js
//
// Détection de conflit vertical route ↔ relief / obstacles.
//
// PRINCIPE : on échantillonne la route (grand-cercle) en points réguliers, on
// récupère l'altitude du terrain à chaque point (open-meteo), et on compare à
// l'altitude prévue du vol, augmentée d'une MARGE DE GARDE (clearance).
//
// RÈGLE DE SÉCURITÉ (fail-closed) : ces fonctions ne fabriquent JAMAIS une
// altitude de terrain. Si la donnée d'élévation est absente pour un point, le
// point est marqué « non vérifié » et le statut global ne peut pas être « ok ».
// L'UI doit alors afficher « relief non vérifié », jamais « pas de conflit ».

import { calculateDistance, calculateBearing, calculateDestination } from './navigationCalculations';

const wpLat = (wp) => (wp?.lat ?? wp?.latitude);
const wpLon = (wp) => (wp?.lon ?? wp?.lng ?? wp?.longitude);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

const M_TO_FT = 3.28084;
export const metersToFeet = (m) => (isNum(m) ? m * M_TO_FT : null);

/**
 * Échantillonne la route le long des segments (grand-cercle), pas de `stepNM`.
 * Cap dur à `maxPoints` (limite open-meteo = 100 coords/appel) : si la route est
 * trop longue, le pas est élargi automatiquement pour rester sous le plafond.
 *
 * @returns {Array<{lat:number, lon:number, distanceNM:number, legIndex:number}>}
 */
export function sampleRouteGreatCircle(waypoints, { stepNM = 2, maxPoints = 100 } = {}) {
  const pts = (waypoints || []).filter((w) => isNum(wpLat(w)) && isNum(wpLon(w)));
  if (pts.length < 2) return [];

  // Distance totale pour, si besoin, élargir le pas et rester ≤ maxPoints.
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += calculateDistance(
      { lat: wpLat(pts[i]), lon: wpLon(pts[i]) },
      { lat: wpLat(pts[i + 1]), lon: wpLon(pts[i + 1]) }
    );
  }
  if (!(total > 0)) return [];
  const effectiveStep = Math.max(stepNM, total / Math.max(1, maxPoints - pts.length));

  const samples = [];
  let cumulative = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = { lat: wpLat(pts[i]), lon: wpLon(pts[i]) };
    const b = { lat: wpLat(pts[i + 1]), lon: wpLon(pts[i + 1]) };
    const legDist = calculateDistance(a, b);
    if (!(legDist > 0)) continue;
    const bearing = calculateBearing(a, b);
    const nSteps = Math.max(1, Math.ceil(legDist / effectiveStep));
    // On inclut le point de départ du 1er segment, puis les points suivants
    // (le début de chaque segment = fin du précédent, on l'évite en démarrant à 1).
    const kStart = i === 0 ? 0 : 1;
    for (let k = kStart; k <= nSteps; k++) {
      const d = Math.min(k * effectiveStep, legDist);
      const p = k === 0 ? a : calculateDestination(a, d, bearing);
      samples.push({
        lat: p.lat,
        lon: p.lon,
        distanceNM: cumulative + d,
        legIndex: i,
      });
      if (samples.length >= maxPoints) return samples;
    }
    cumulative += legDist;
  }
  return samples;
}

/**
 * Analyse le conflit vertical route/relief.
 *
 * @param {object} p
 * @param {Array} p.samples          - sortie de sampleRouteGreatCircle
 * @param {Array<number|null>} p.terrainFt - élévation terrain (ft) par échantillon, null si inconnue
 * @param {number} p.plannedAltitudeFt - altitude de vol prévue (ft MSL)
 * @param {number} [p.clearanceFt=1000] - marge de garde souhaitée au-dessus du relief
 * @returns {{
 *   status: 'ok'|'proximity'|'collision'|'unchecked',
 *   conflicts: Array<{distanceNM:number, terrainFt:number, altitudeFt:number, marginFt:number, kind:'collision'|'proximity'}>,
 *   maxTerrainFt: number|null,
 *   minMarginFt: number|null,
 *   uncheckedCount: number,
 *   sampledCount: number
 * }}
 */
export function analyzeTerrain({ samples, terrainFt, plannedAltitudeFt, clearanceFt = 1000 }) {
  const n = samples?.length || 0;
  if (!n || !isNum(plannedAltitudeFt)) {
    return { status: 'unchecked', conflicts: [], maxTerrainFt: null, minMarginFt: null, uncheckedCount: n, sampledCount: n };
  }

  const conflicts = [];
  let maxTerrainFt = null;
  let minMarginFt = null;
  let uncheckedCount = 0;

  for (let i = 0; i < n; i++) {
    const t = terrainFt?.[i];
    if (!isNum(t)) { uncheckedCount++; continue; }
    if (maxTerrainFt == null || t > maxTerrainFt) maxTerrainFt = t;
    const margin = plannedAltitudeFt - t; // marge réelle au-dessus du relief
    if (minMarginFt == null || margin < minMarginFt) minMarginFt = margin;

    if (plannedAltitudeFt <= t) {
      conflicts.push({ distanceNM: samples[i].distanceNM, terrainFt: t, altitudeFt: plannedAltitudeFt, marginFt: margin, kind: 'collision' });
    } else if (margin < clearanceFt) {
      conflicts.push({ distanceNM: samples[i].distanceNM, terrainFt: t, altitudeFt: plannedAltitudeFt, marginFt: margin, kind: 'proximity' });
    }
  }

  // Statut global. Fail-closed : si TOUS les points sont non vérifiés → unchecked.
  let status;
  if (uncheckedCount === n) status = 'unchecked';
  else if (conflicts.some((c) => c.kind === 'collision')) status = 'collision';
  else if (conflicts.some((c) => c.kind === 'proximity')) status = 'proximity';
  else status = 'ok';

  return { status, conflicts, maxTerrainFt, minMarginFt, uncheckedCount, sampledCount: n };
}

/**
 * Analyse les obstacles artificiels (pylônes, antennes…) à proximité latérale de
 * la route dont le SOMMET (MSL) menace l'altitude prévue.
 *
 * @param {object} p
 * @param {Array} p.waypoints
 * @param {Array} p.obstacles       - features SIA (properties.total_height_ft, latitude, longitude)
 * @param {number} p.plannedAltitudeFt
 * @param {number} [p.corridorNM=1]  - demi-largeur du couloir de surveillance
 * @param {number} [p.clearanceFt=500]
 * @returns {{conflicts: Array}}
 */
export function analyzeObstacles({ waypoints, obstacles, plannedAltitudeFt, corridorNM = 1, clearanceFt = 500 }) {
  const pts = (waypoints || []).filter((w) => isNum(wpLat(w)) && isNum(wpLon(w)));
  if (pts.length < 2 || !isNum(plannedAltitudeFt) || !Array.isArray(obstacles)) return { conflicts: [] };

  // Bounding box de la route + marge (~corridor) pour pré-filtrer.
  const lats = pts.map(wpLat), lons = pts.map(wpLon);
  const pad = corridorNM / 60 + 0.05; // ~1' de latitude par NM, marge large
  const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad;
  const minLon = Math.min(...lons) - pad, maxLon = Math.max(...lons) + pad;

  const conflicts = [];
  for (const obs of obstacles) {
    const oLat = obs?.properties?.latitude ?? obs?.latitude ?? obs?.geometry?.coordinates?.[1] ?? obs?.coordinates?.lat;
    const oLon = obs?.properties?.longitude ?? obs?.longitude ?? obs?.geometry?.coordinates?.[0] ?? obs?.coordinates?.lon;
    const topFt = obs?.properties?.total_height_ft ?? obs?.total_height_ft ?? obs?.topFt;
    if (!isNum(oLat) || !isNum(oLon) || !isNum(topFt)) continue;
    if (oLat < minLat || oLat > maxLat || oLon < minLon || oLon > maxLon) continue;
    if (topFt < plannedAltitudeFt - clearanceFt) continue; // ne menace pas l'altitude

    // Distance latérale mini à un segment de la route.
    let minLatNM = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = lateralDistanceNM(
        { lat: oLat, lon: oLon },
        { lat: wpLat(pts[i]), lon: wpLon(pts[i]) },
        { lat: wpLat(pts[i + 1]), lon: wpLon(pts[i + 1]) }
      );
      if (d < minLatNM) minLatNM = d;
    }
    if (minLatNM <= corridorNM) {
      conflicts.push({
        lat: oLat, lon: oLon, topFt,
        name: obs?.properties?.name ?? obs?.name ?? 'Obstacle',
        lateralNM: Math.round(minLatNM * 10) / 10,
        marginFt: plannedAltitudeFt - topFt,
      });
    }
  }
  conflicts.sort((a, b) => a.marginFt - b.marginFt);
  return { conflicts };
}

// Distance latérale (cross-track) approximative d'un point à un segment, en NM.
function lateralDistanceNM(p, a, b) {
  const dA = calculateDistance(a, p);
  const dB = calculateDistance(b, p);
  const ab = calculateDistance(a, b);
  if (!(ab > 0)) return Math.min(dA, dB);
  // Projection : si le pied de perpendiculaire tombe hors du segment, on prend
  // l'extrémité la plus proche (conservateur).
  const brgAB = calculateBearing(a, b);
  const brgAP = calculateBearing(a, p);
  const angle = ((brgAP - brgAB) * Math.PI) / 180;
  const along = dA * Math.cos(angle);
  if (along < 0) return dA;
  if (along > ab) return dB;
  return Math.abs(dA * Math.sin(angle));
}
