import { describe, it, expect } from 'vitest';
import { sampleRouteGreatCircle, analyzeTerrain, analyzeObstacles } from '../terrainAnalysis';

describe('sampleRouteGreatCircle', () => {
  it('échantillonne une route et borne à maxPoints', () => {
    const wps = [
      { lat: 48.0, lon: 2.0 },
      { lat: 46.0, lon: 6.0 }, // ~200+ NM
    ];
    const s = sampleRouteGreatCircle(wps, { stepNM: 2, maxPoints: 100 });
    expect(s.length).toBeGreaterThan(1);
    expect(s.length).toBeLessThanOrEqual(100);
    // distances croissantes
    for (let i = 1; i < s.length; i++) {
      expect(s[i].distanceNM).toBeGreaterThanOrEqual(s[i - 1].distanceNM);
    }
  });

  it('retourne [] si moins de 2 waypoints valides', () => {
    expect(sampleRouteGreatCircle([{ lat: 48, lon: 2 }])).toEqual([]);
    expect(sampleRouteGreatCircle([])).toEqual([]);
  });
});

describe('analyzeTerrain', () => {
  const samples = [
    { lat: 45.9, lon: 6.9, distanceNM: 0, legIndex: 0 },
    { lat: 45.83, lon: 6.86, distanceNM: 5, legIndex: 0 }, // ~Mont Blanc
    { lat: 45.7, lon: 6.8, distanceNM: 10, legIndex: 0 },
  ];

  it('SCÉNARIO MONT BLANC : ligne droite à 1500 ft sur un relief à 15780 ft → collision', () => {
    const r = analyzeTerrain({ samples, terrainFt: [3000, 15780, 4000], plannedAltitudeFt: 1500, clearanceFt: 1000 });
    expect(r.status).toBe('collision');
    expect(r.conflicts.some((c) => c.kind === 'collision')).toBe(true);
    expect(r.maxTerrainFt).toBe(15780);
  });

  it('proximité : marge sous la garde de 1000 ft', () => {
    const r = analyzeTerrain({ samples, terrainFt: [500, 2500, 600], plannedAltitudeFt: 3000, clearanceFt: 1000 });
    expect(r.status).toBe('proximity');
    expect(r.conflicts[0].kind).toBe('proximity');
    expect(r.minMarginFt).toBe(500);
  });

  it('ok : marge suffisante partout', () => {
    const r = analyzeTerrain({ samples, terrainFt: [500, 800, 600], plannedAltitudeFt: 3000, clearanceFt: 1000 });
    expect(r.status).toBe('ok');
    expect(r.conflicts).toHaveLength(0);
  });

  it('FAIL-CLOSED : aucune donnée de terrain → unchecked (jamais "ok")', () => {
    const r = analyzeTerrain({ samples, terrainFt: [null, null, null], plannedAltitudeFt: 3000, clearanceFt: 1000 });
    expect(r.status).toBe('unchecked');
    expect(r.status).not.toBe('ok');
  });

  it('unchecked si altitude prévue manquante', () => {
    const r = analyzeTerrain({ samples, terrainFt: [500, 800, 600], plannedAltitudeFt: undefined });
    expect(r.status).toBe('unchecked');
  });
});

describe('analyzeObstacles', () => {
  const waypoints = [
    { lat: 48.0, lon: 2.0 },
    { lat: 48.0, lon: 3.0 },
  ];

  it('signale un obstacle haut proche de la route', () => {
    const obstacles = [
      // pylône à 3200 ft MSL quasi sur la route (lat 48.0, lon 2.5)
      { properties: { latitude: 48.0, longitude: 2.5, total_height_ft: 3200, name: 'Pylône' } },
      // obstacle bas et loin — ignoré
      { properties: { latitude: 40.0, longitude: 10.0, total_height_ft: 300, name: 'Loin' } },
    ];
    const r = analyzeObstacles({ waypoints, obstacles, plannedAltitudeFt: 3000, corridorNM: 1, clearanceFt: 500 });
    expect(r.conflicts.length).toBe(1);
    expect(r.conflicts[0].name).toBe('Pylône');
  });

  it('ignore les obstacles nettement sous l\'altitude prévue', () => {
    const obstacles = [{ properties: { latitude: 48.0, longitude: 2.5, total_height_ft: 800, name: 'Bas' } }];
    const r = analyzeObstacles({ waypoints, obstacles, plannedAltitudeFt: 5000, corridorNM: 1, clearanceFt: 500 });
    expect(r.conflicts).toHaveLength(0);
  });
});
