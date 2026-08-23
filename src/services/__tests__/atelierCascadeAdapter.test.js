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
import { chainIncludesWind, chainIncludesTemperature } from '../atelierCascadeAdapter';
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

describe('Lecture descendante (readoutAxis: x) — zone d\'atterrissage type Piper', () => {
  // Zone de sortie : guides de vent étiquetés, distance lue EN BAS (axe X).
  //   vent nul     x = 150 + y        (fv 0,  none)
  //   15 kt face   x = 150 + 0.75·y   (fv 15, headwind — plus court)
  //   5 kt arrière x = 150 + 1.25·y   (fv 5 POSITIF + tag tailwind → −5)
  const mkZone = () => ({
    id: 'g2',
    name: 'Zone course atterrissage',
    role: 'intermediate',
    readoutAxis: 'x',
    isWindRelated: true,
    familyAxisVariable: 'wind_component',
    linkedFrom: ['g1'],
    linkedTo: [],
    axes: {
      xAxis: { min: 150, max: 450, step: 50, title: 'landing_distance_ground', unit: 'm' },
      yAxis: { min: 0, max: 400, step: 100, title: 'custom', unit: '' }
    },
    curves: [
      mkCurve('nul', 0, [[150, 0], [550, 400]], 'none'),
      mkCurve('face15', 15, [[150, 0], [450, 400]], 'headwind'),
      mkCurve('arriere5', 5, [[150, 0], [650, 400]], 'tailwind')
    ]
  });

  // Entrée : OAT 20 → Y transféré 200 (primaire y = 10 × oat).
  const base = { mass: 1000, oat: 20, pressureAltitude: 2000 };
  const run = (hw) => resolveOperation(mkAircraft([mkPrimary('takeoff_50ft'), mkZone()]), 'takeoff_50ft', {
    ...base, headwind: hw, windComponent: hw, tailwind: -hw
  });

  it('vent nul : lit la distance sur le guide 0, unité de l\'axe X', () => {
    const r = run(0);
    expect(r.status).toBe('COMPUTED');
    expect(r.value).toBeCloseTo(350, 1); // 150 + 200
    expect(r.unit).toBe('m');            // unité de l'axe X de la zone
    expect(r.cascadeSteps[1].used).toBe('readout-x');
  });

  it('vent de face signé : interpole entre vent nul et 15 kt', () => {
    const r = run(6);
    expect(r.status).toBe('COMPUTED');
    expect(r.value).toBeCloseTo(330, 1); // 350 + 0.4 × (300 − 350)
  });

  it('vent arrière : tag tailwind lu en négatif, guide exact puis interpolé', () => {
    const exact = run(-5);
    expect(exact.status).toBe('COMPUTED');
    expect(exact.value).toBeCloseTo(400, 1); // 150 + 1.25 × 200

    const between = run(-2);
    expect(between.status).toBe('COMPUTED');
    expect(between.value).toBeCloseTo(370, 1); // entre 400 (−5) et 350 (0)
  });

  it('vent hors des guides tracés : refus fail-closed', () => {
    const r = run(20);
    expect(r.status).toBe('ERROR');
    expect(r.value).toBeUndefined();
  });
});

describe("windIncluded — le vent est-il DÉJÀ lu par la chaîne d'abaques ? (21/08, F-HFGI)", () => {
  // Le résolveur pose `windIncluded` pour que PerformanceModule n'applique PAS
  // une seconde fois les règles de vent de la fiche avion (double correction).
  const massPanel = {
    id: 'g2', name: 'Panneau masse', role: 'intermediate', isWindRelated: false,
    linkedFrom: ['g1'], linkedTo: [],
    axes: {
      xAxis: { min: 950, max: 1150, step: 50, title: 'mass', unit: 'kg', reversed: true },
      yAxis: { min: 0, max: 400, step: 100, title: 'takeoff_distance_50ft', unit: 'm' }
    },
    curves: [mkCurve('low', 1, [[950, 100], [1150, 200]]), mkCurve('high', 2, [[950, 200], [1150, 300]])]
  };
  const windPanel = {
    id: 'g2', name: 'Panneau vent', role: 'intermediate', isWindRelated: true,
    linkedFrom: ['g1'], linkedTo: [],
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
  // Zone type F-HFGI : lecture descendante, guides « Face 15 kt / Vent nul / Arrière 5 kt ».
  const readoutXWindZone = {
    id: 'g2', name: 'Zone course atterrissage', role: 'intermediate',
    readoutAxis: 'x', isWindRelated: true, familyAxisVariable: 'wind_component',
    linkedFrom: ['g1'], linkedTo: [],
    axes: {
      xAxis: { min: 150, max: 450, step: 50, title: 'landing_distance_ground', unit: 'm' },
      yAxis: { min: 0, max: 400, step: 100, title: 'custom', unit: '' }
    },
    curves: [
      mkCurve('nul', 0, [[150, 0], [550, 400]], 'none'),
      mkCurve('face15', 15, [[150, 0], [450, 400]], 'headwind'),
      mkCurve('arriere5', 5, [[150, 0], [650, 400]], 'tailwind')
    ]
  };
  const inputs = { mass: 1000, oat: 20, pressureAltitude: 2000, headwind: -5, windComponent: -5, tailwind: 5 };

  it('chaîne avec panneau vent (axe X vent) → windIncluded true', () => {
    const r = resolveOperation(mkAircraft([mkPrimary('takeoff_50ft'), windPanel]), 'takeoff_50ft', inputs);
    expect(r.status).toBe('COMPUTED');
    expect(r.windIncluded).toBe(true);
  });

  it('zone en lecture descendante à guides de vent (F-HFGI) → windIncluded true', () => {
    const r = resolveOperation(mkAircraft([mkPrimary('takeoff_50ft'), readoutXWindZone]), 'takeoff_50ft', inputs);
    expect(r.status).toBe('COMPUTED');
    expect(r.windIncluded).toBe(true);
  });

  it('chaîne SANS panneau vent (primaire + masse) → windIncluded false', () => {
    const r = resolveOperation(mkAircraft([mkPrimary('takeoff_50ft'), massPanel]), 'takeoff_50ft', inputs);
    expect(r.status).toBe('COMPUTED');
    expect(r.windIncluded).toBe(false);
  });

  it('vent variable (moyenne face/arrière) conserve le drapeau', () => {
    const r = resolveOperation(mkAircraft([mkPrimary('takeoff_50ft'), windPanel]), 'takeoff_50ft', {
      mass: 1000, oat: 20, pressureAltitude: 2000, windVariable: true, windMagnitude: 5, windComponent: 0, headwind: 0, tailwind: 0
    });
    expect(r.status).toBe('COMPUTED');
    expect(r.windAveraged).toBe(true);
    expect(r.windIncluded).toBe(true);
  });

  it('chainIncludesWind : critères un par un', () => {
    const primary = mkPrimary('takeoff_50ft');
    const panel = { id: 'p', role: 'intermediate', axes: { xAxis: { title: 'mass' }, yAxis: { title: 'd' } } };
    expect(chainIncludesWind([primary, { ...panel, isWindRelated: true }])).toBe(true);
    expect(chainIncludesWind([primary, { ...panel, axes: { xAxis: { title: 'headwind' } } }])).toBe(true);
    expect(chainIncludesWind([primary, { ...panel, readoutAxis: 'x', familyAxisVariable: 'wind_component' }])).toBe(true);
    expect(chainIncludesWind([{ ...primary, familyAxisVariable: 'wind_component' }])).toBe(true);
    // Famille « vent » sur un panneau slope-follow : c'est son X (masse) qui est lu, pas le vent.
    expect(chainIncludesWind([primary, { ...panel, familyAxisVariable: 'wind_component' }])).toBe(false);
    expect(chainIncludesWind([primary, panel])).toBe(false);
    expect(chainIncludesWind([])).toBe(false);
    expect(chainIncludesWind(null)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 23/08/2026 — temperatureIncluded : jumeau de windIncluded pour l'OAT.
// Vrai, la règle « écart ISA » de la fiche avion N'est PAS appliquée (la
// température compterait deux fois) ; faux, c'est elle qui doit corriger — et
// son absence rend la distance inutilisable (fail-closed côté PerformanceModule).
describe("temperatureIncluded — l'OAT est-elle DÉJÀ lue par la chaîne d'abaques ?", () => {
  const inputs = { mass: 1000, oat: 20, pressureAltitude: 2000, headwind: 0, windComponent: 0, tailwind: 0 };

  it("abaque à primaire OAT (cas courant) → temperatureIncluded true", () => {
    const r = resolveOperation(mkAircraft([mkPrimary('takeoff_50ft')]), 'takeoff_50ft', inputs);
    expect(r.status).toBe('COMPUTED');
    expect(r.temperatureIncluded).toBe(true);
    expect(r.standardConditionsOnly).toBe(false);
  });

  it('chainIncludesTemperature : critères un par un', () => {
    const primary = mkPrimary('takeoff_50ft');
    // Primaire SANS OAT : axe X en masse, famille en altitude.
    const primaireSansOat = {
      ...primary, familyAxisVariable: 'pressure_altitude',
      axes: { xAxis: { title: 'mass' }, yAxis: { title: 'd' } }
    };
    const panel = { id: 'p', role: 'intermediate', axes: { xAxis: { title: 'mass' }, yAxis: { title: 'd' } } };

    expect(chainIncludesTemperature([primary])).toBe(true);                                    // axe X = OAT
    expect(chainIncludesTemperature([primaireSansOat, { ...panel, axes: { xAxis: { title: 'oat' } } }])).toBe(true);
    expect(chainIncludesTemperature([{ ...primaireSansOat, familyAxisVariable: 'oat' }])).toBe(true); // famille du primaire
    expect(chainIncludesTemperature([primaireSansOat, { ...panel, readoutAxis: 'x', familyAxisVariable: 'oat' }])).toBe(true);
    // Famille « OAT » sur un panneau slope-follow : c'est son X (masse) qui est lu.
    expect(chainIncludesTemperature([primaireSansOat, { ...panel, familyAxisVariable: 'oat' }])).toBe(false);
    expect(chainIncludesTemperature([primaireSansOat, panel])).toBe(false);
    // Titre d'axe X non reconnu sur le PRIMAIRE : l'entrée de la chaîne retombe
    // sur conditions.temperature (cf. entryDim) — la température EST donc lue.
    const primaireTitreInconnu = { ...primary, axes: { xAxis: { title: 'zzz' }, yAxis: { title: 'd' } } };
    expect(chainIncludesTemperature([primaireTitreInconnu])).toBe(true);
    // Sur un panneau intermédiaire en revanche, un titre inconnu ne vaut rien.
    expect(chainIncludesTemperature([primaireSansOat, { ...panel, axes: { xAxis: { title: 'zzz' } } }])).toBe(false);
    expect(chainIncludesTemperature([])).toBe(false);
    expect(chainIncludesTemperature(null)).toBe(false);
  });
});
