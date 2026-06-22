// src/services/__tests__/atelierCascadeAdapter.test.js
//
// P0 (AUDIT_MOTEUR_PERF_VOL.md) — la préparation de vol évalue les abaques
// avec LE MOTEUR DE L'ATELIER (cascade.ts) via atelierCascadeAdapter.
//
// Verrouillé ici :
//   1. resolveOperation (chemin abaque) = même valeur que cascade.ts appelé
//      directement sur la même chaîne (équivalence des moteurs, fin du −7363 m) ;
//   2. mapping du vent SIGNÉ du résolveur (positif = face) vers le panneau
//      vent de l'abaque (magnitude + windDirection) — face raccourcit,
//      arrière rallonge, calme strictement neutre ;
//   3. P1 — garde de plausibilité : une distance ≤ 0 sort en ERROR explicite,
//      plus jamais en COMPUTED.

import { describe, it, expect } from 'vitest';
import { resolveOperation } from '../operationResolver';
import { performCascadeCalculationWithParameters, findGraphChain } from '../../abac/curves/core/cascade';

const mkCurve = (id, familyValue, pts, windDirection) => {
  const points = pts.map(([x, y], i) => ({ x, y, id: `${id}-p${i}` }));
  return {
    id,
    name: id,
    color: '#000000',
    points,
    familyValue,
    ...(windDirection ? { windDirection } : {}),
    fitted: { points }
  };
};

// Primaire OAT (y = 10 × oat), famille altitude (une courbe 2000 ft),
// porteur de l'operationId — relié au panneau g2.
const mkPrimary = (operationId) => ({
  id: 'g1',
  name: 'Primaire OAT',
  role: 'primary',
  operationId,
  familyAxisVariable: 'pressure_altitude',
  isWindRelated: false,
  linkedFrom: [],
  linkedTo: ['g2'],
  axes: {
    xAxis: { min: 0, max: 40, step: 10, title: 'oat', unit: '°C' },
    yAxis: { min: 0, max: 400, step: 100, title: 'takeoff_distance_50ft', unit: 'm' }
  },
  curves: [mkCurve('g1-c2000', 2000, [[0, 0], [40, 400]])]
});

const mkAircraft = (graphs) => ({
  performanceModels: [{ id: 'm1', name: 'Set test', data: { graphs } }]
});

describe('P0 — resolveOperation délègue les abaques au moteur de l’atelier', () => {
  it('équivalence : même valeur que cascade.ts sur la même chaîne (panneau masse, guide tronqué)', () => {
    const massPanel = {
      id: 'g2',
      name: 'Panneau masse',
      role: 'intermediate',
      isWindRelated: false,
      linkedFrom: ['g1'],
      linkedTo: [],
      axes: {
        xAxis: { min: 950, max: 1150, step: 50, title: 'mass', unit: 'kg', reversed: true },
        yAxis: { min: 0, max: 400, step: 100, title: 'takeoff_distance_50ft', unit: 'm' }
      },
      curves: [
        mkCurve('low', 1, [[950, 100], [1150, 200]]),
        mkCurve('high', 2, [[950, 200], [1089.9, 290]]) // tronqué (cas réel)
      ]
    };
    const graphs = [mkPrimary('takeoff_50ft'), massPanel];
    const aircraft = mkAircraft(graphs);

    const result = resolveOperation(aircraft, 'takeoff_50ft', {
      mass: 1000, oat: 21, pressureAltitude: 2000, headwind: 0, windComponent: 0, tailwind: 0
    });

    expect(result.status).toBe('COMPUTED');
    // Valeur attendue ≈ 133,3 (entrée au bord d'axe 1150, guide tronqué prolongé)
    expect(result.value).toBeCloseTo(133.3, 0);
    expect(result.unit).toBe('m');
    expect(result.source.kind).toBe('abac');
    expect(result.source.method).toContain('atelier');

    // ÉQUIVALENCE : cascade.ts appelé directement = même valeur.
    const chain = findGraphChain(graphs, 'g1');
    const direct = performCascadeCalculationWithParameters(chain, 21, [
      { graphId: 'g1', parameter: 2000, parameterName: 'Altitude pression' },
      { graphId: 'g2', parameter: 1000, parameterName: 'mass' }
    ]);
    expect(direct.success).toBe(true);
    expect(result.value).toBeCloseTo(direct.finalValue, 6);

    // Contrat matrice : 2 étapes, primaire en TÊTE (plus jamais en dernier).
    expect(result.cascadeSteps).toHaveLength(2);
    expect(result.cascadeSteps[0].role).toBe('primary');
    expect(result.cascadeSteps[0].used).toBe('bracket');
    expect(result.cascadeSteps[1].used).toBe('slope-follow');
    expect(result.cascadeSteps[1].entryY).toBeCloseTo(210, 1);
  });

  it('vent signé : face raccourcit, arrière rallonge, calme strictement neutre', () => {
    const windPanel = {
      id: 'g2',
      name: 'Panneau vent',
      role: 'intermediate',
      isWindRelated: true,
      linkedFrom: ['g1'],
      linkedTo: [],
      axes: {
        xAxis: { min: 0, max: 15, step: 5, title: 'wind_component', unit: 'kt' },
        yAxis: { min: 0, max: 400, step: 100, title: 'takeoff_distance_50ft', unit: 'm' }
      },
      curves: [
        mkCurve('h1', 1, [[0, 100], [15, 60]], 'headwind'),
        mkCurve('h2', 2, [[0, 200], [15, 130]], 'headwind'),
        mkCurve('t1', 1, [[0, 100], [15, 140]], 'tailwind'),
        mkCurve('t2', 2, [[0, 200], [15, 270]], 'tailwind')
      ]
    };
    const aircraft = mkAircraft([mkPrimary('takeoff_50ft'), windPanel]);
    const base = { mass: 1000, oat: 15, pressureAltitude: 2000 };
    const run = (hw) => resolveOperation(aircraft, 'takeoff_50ft', {
      ...base, headwind: hw, windComponent: hw, tailwind: -hw
    });

    // Entrée : OAT 15 → 150 (= ligne de référence vent nul).
    const calm = run(0);
    expect(calm.status).toBe('COMPUTED');
    expect(calm.value).toBeCloseTo(150, 1); // neutralité au vent calme

    const headwind = run(8);  // positif = face → raccourcit
    expect(headwind.status).toBe('COMPUTED');
    expect(headwind.value).toBeLessThan(150);
    expect(headwind.value).toBeCloseTo(120.7, 0);

    const tailwind = run(-8); // négatif = arrière → magnitude 8 sur courbes tailwind
    expect(tailwind.status).toBe('COMPUTED');
    expect(tailwind.value).toBeGreaterThan(150);
    expect(tailwind.value).toBeCloseTo(179.3, 0);
  });

  it('P1 — une distance négative sort en ERROR, jamais en COMPUTED', () => {
    const brokenPanel = {
      id: 'g2',
      name: 'Panneau masse mal calibré',
      role: 'intermediate',
      isWindRelated: false,
      linkedFrom: ['g1'],
      linkedTo: [],
      axes: {
        xAxis: { min: 950, max: 1150, step: 50, title: 'mass', unit: 'kg', reversed: true },
        yAxis: { min: -200, max: 400, step: 100, title: 'takeoff_distance_50ft', unit: 'm' }
      },
      curves: [
        // Guides plongeant sous zéro côté masses basses : sortie négative.
        mkCurve('low', 1, [[950, -100], [1150, 0]]),
        mkCurve('high', 2, [[950, 300], [1150, 400]])
      ]
    };
    const aircraft = mkAircraft([mkPrimary('takeoff_50ft'), brokenPanel]);

    const result = resolveOperation(aircraft, 'takeoff_50ft', {
      mass: 950, oat: 1, pressureAltitude: 2000, headwind: 0, windComponent: 0, tailwind: 0
    });

    expect(result.status).toBe('ERROR');
    expect(result.reason).toContain('implausible');
    expect(result.value).toBeUndefined();
  });
});
