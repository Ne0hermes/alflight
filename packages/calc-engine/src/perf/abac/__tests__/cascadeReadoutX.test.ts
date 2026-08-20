// Lecture DESCENDANTE (readoutAxis: 'x') — géométrie des planches
// d'atterrissage Piper : panneau gauche OAT × famille altitude → Y transféré,
// zone de sortie à guides de vent étiquetés (+15 face / 0 / −5 arrière),
// résultat lu EN BAS sur l'axe X (échelle des distances).
//
// Fixture analytique (droites exactes) :
//   G1 : y = base(alt) + 0.2·OAT   avec base(0ft)=40, base(4000ft)=60, base(8000ft)=90
//   G2 : vent nul      x = 150 + 3·y
//        15 kt face    x = 150 + 2·y      (plus court à Y égal)
//        5 kt arrière  x = 150 + 3.5·y    (plus long à Y égal)
import { describe, it, expect } from 'vitest';
import {
  performCascadeCalculationWithParameters,
  validateGraphChain
} from '../cascade';
import type { GraphConfig, Curve, XYPoint } from '../types';

function line(fn: (t: number) => XYPoint, ts: number[]): XYPoint[] {
  return ts.map(fn);
}

function mkCurve(partial: Partial<Curve> & { name: string; points: XYPoint[] }): Curve {
  return { id: partial.name, color: '#000', ...partial } as Curve;
}

function mkPanel(): GraphConfig {
  const oats = [-40, -20, 0, 20, 40];
  return {
    id: 'g1',
    name: 'Panneau OAT/Altitude',
    role: 'primary',
    operationId: 'landing_ground_roll',
    axes: {
      xAxis: { min: -40, max: 40, unit: '°C', title: 'oat' },
      yAxis: { min: 0, max: 100, unit: '', title: 'custom' }
    },
    familyAxisVariable: 'pressure_altitude',
    curves: [
      mkCurve({ name: '0 ft', familyValue: 0, points: line(x => ({ x, y: 40 + 0.2 * x }), oats) }),
      mkCurve({ name: '4000 ft', familyValue: 4000, points: line(x => ({ x, y: 60 + 0.2 * x }), oats) }),
      mkCurve({ name: '8000 ft', familyValue: 8000, points: line(x => ({ x, y: 90 + 0.2 * x }), oats) })
    ],
    linkedTo: ['g2']
  };
}

function mkZone(overrides: Partial<GraphConfig> = {}): GraphConfig {
  const ys = [0, 25, 50, 75, 100];
  return {
    id: 'g2',
    name: 'Zone course',
    role: 'intermediate',
    cascadeOrder: 1,
    readoutAxis: 'x',
    isWindRelated: true,
    familyAxisVariable: 'wind_component',
    axes: {
      xAxis: { min: 150, max: 450, unit: 'm', title: 'landing_distance_ground' },
      yAxis: { min: 0, max: 100, unit: '', title: 'custom' }
    },
    curves: [
      mkCurve({ name: 'Vent nul', windDirection: 'none', familyValue: 0, points: line(y => ({ x: 150 + 3 * y, y }), ys) }),
      mkCurve({ name: '15 kt face', windDirection: 'headwind', familyValue: 15, points: line(y => ({ x: 150 + 2 * y, y }), ys) }),
      // familyValue saisi POSITIF + tag arrière → le moteur doit résoudre −5.
      mkCurve({ name: '5 kt arrière', windDirection: 'tailwind', familyValue: 5, points: line(y => ({ x: 150 + 3.5 * y, y }), ys) })
    ],
    linkedFrom: ['g1'],
    ...overrides
  };
}

function run(wind: number | undefined, opts: { oat?: number; alt?: number; zone?: GraphConfig } = {}) {
  const graphs = [mkPanel(), opts.zone ?? mkZone()];
  const params = [
    { graphId: 'g1', parameter: opts.alt ?? 2000 },
    ...(wind === undefined ? [] : [{ graphId: 'g2', parameter: wind, parameterName: 'wind_component' }])
  ];
  return performCascadeCalculationWithParameters(graphs, opts.oat ?? 0, params);
}

// OAT 0 / alt 2000 → Y transféré = (40 + 60)/2 = 50.
describe('lecture descendante (readoutAxis: x)', () => {
  it('vent nul : lit la distance sur le guide 0', () => {
    const r = run(0);
    expect(r.success).toBe(true);
    expect(r.finalValue).toBeCloseTo(300, 1); // 150 + 3·50
    expect(r.outputAxis).toBe('x');
    expect(r.outputUnit).toBe('m');
  });

  it('vent pile sur un guide tracé : lecture directe, non interpolée', () => {
    const r = run(15);
    expect(r.success).toBe(true);
    expect(r.finalValue).toBeCloseTo(250, 1); // 150 + 2·50
    expect(r.steps[1].curveUsed).toBe('15 kt face');
    expect(r.steps[1].interpolated).toBe(false);
  });

  it('vent de face intermédiaire : interpole entre vent nul et 15 kt', () => {
    const r = run(7.5);
    expect(r.success).toBe(true);
    expect(r.finalValue).toBeCloseTo(275, 1); // milieu de 300 et 250
    expect(r.steps[1].interpolated).toBe(true);
  });

  it('vent arrière : familyValue positif + tag tailwind résolu en négatif', () => {
    const r = run(-5);
    expect(r.success).toBe(true);
    expect(r.finalValue).toBeCloseTo(325, 1); // 150 + 3.5·50
  });

  it('vent arrière intermédiaire : interpole entre −5 et 0', () => {
    const r = run(-2.5);
    expect(r.success).toBe(true);
    expect(r.finalValue).toBeCloseTo(312.5, 1);
  });

  it('refuse un vent de face au-delà du guide le plus fort', () => {
    const r = run(20);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/hors du domaine des guides/);
    expect(r.error).toMatch(/vérifiez le manuel de vol/);
  });

  it('refuse un vent arrière au-delà du guide tracé', () => {
    const r = run(-6);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/hors du domaine des guides/);
  });

  it('paramètre manquant : le message nomme la variable de famille', () => {
    const r = run(undefined);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/wind_component/);
  });

  it('refuse un Y transféré hors du tracé du guide', () => {
    // Guide 15 kt tronqué à Y=50 ; entrée Y=75 (OAT 0 / alt 6000 → (60+90)/2).
    const zone = mkZone();
    zone.curves[1] = mkCurve({
      name: '15 kt face', windDirection: 'headwind', familyValue: 15,
      points: line(y => ({ x: 150 + 2 * y, y }), [0, 25, 50])
    });
    const r = run(15, { alt: 6000, zone });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/hors du tracé du guide/);
    // Fail-closed aussi en interpolation : le guide encadrant tronqué suffit à refuser.
    const r2 = run(7.5, { alt: 6000, zone });
    expect(r2.success).toBe(false);
  });

  it('refuse un guide non monotone au niveau d\'entrée (lecture ambiguë)', () => {
    const zone = mkZone();
    zone.curves[0] = mkCurve({
      name: 'Vent nul', windDirection: 'none', familyValue: 0,
      points: [{ x: 150, y: 0 }, { x: 250, y: 60 }, { x: 300, y: 40 }, { x: 450, y: 100 }]
    });
    const r = run(0, { zone }); // Y=50 croisé trois fois
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/ambigu/);
  });

  it('refuse une lecture sur X qui n\'est pas le dernier graphe', () => {
    const zone = mkZone({ linkedTo: ['g3'] });
    const g3: GraphConfig = {
      id: 'g3', name: 'Panneau fantôme', role: 'intermediate', cascadeOrder: 2,
      axes: {
        xAxis: { min: 0, max: 10, unit: 'kt', title: 'headwind' },
        yAxis: { min: 0, max: 100, unit: '', title: 'custom' }
      },
      curves: [mkCurve({ name: 'g', familyValue: 1, points: [{ x: 0, y: 0 }, { x: 10, y: 100 }] })],
      linkedFrom: ['g2']
    };
    const r = performCascadeCalculationWithParameters(
      [mkPanel(), zone, g3],
      0,
      [{ graphId: 'g1', parameter: 2000 }, { graphId: 'g2', parameter: 0 }, { graphId: 'g3', parameter: 5 }]
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/DERNIER/);
  });

  it('refuse une lecture sur X sur le premier graphe', () => {
    const r = performCascadeCalculationWithParameters([mkZone()], 50, [{ graphId: 'g2', parameter: 0 }]);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/PREMIER/);
  });

  it('les chaînes standard restent inchangées : sortie sur Y, unité Y', () => {
    const graphs = [mkPanel()];
    const r = performCascadeCalculationWithParameters(graphs, 0, [{ graphId: 'g1', parameter: 2000 }]);
    expect(r.success).toBe(true);
    expect(r.finalValue).toBeCloseTo(50, 6);
    expect(r.outputAxis).toBe('y');
  });
});

describe('validateGraphChain — règles de la lecture sur X', () => {
  it('accepte la chaîne panneau → zone en dernier', () => {
    const v = validateGraphChain([mkPanel(), mkZone()]);
    expect(v.errors.filter(e => /lecture sur X/.test(e))).toHaveLength(0);
  });

  it('signale une zone lecture-X en milieu de chaîne', () => {
    const zone = mkZone({ linkedTo: ['g3'] });
    const g3: GraphConfig = {
      id: 'g3', name: 'Suivant',
      axes: {
        xAxis: { min: 0, max: 10, unit: 'kt', title: 'headwind' },
        yAxis: { min: 0, max: 100, unit: '', title: 'custom' }
      },
      curves: [mkCurve({ name: 'g', familyValue: 1, points: [{ x: 0, y: 0 }, { x: 10, y: 100 }] })]
    };
    const v = validateGraphChain([mkPanel(), zone, g3]);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => /dernier graphe/.test(e))).toBe(true);
  });

  it('signale l\'absence de variable de famille', () => {
    const v = validateGraphChain([mkPanel(), mkZone({ familyAxisVariable: undefined })]);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => /variable de famille/.test(e))).toBe(true);
  });

  it('signale des guides sans valeur de famille lisible', () => {
    const zone = mkZone();
    zone.curves = zone.curves.map(c => ({ ...c, familyValue: undefined, name: c.name.replace(/[\d.]+/g, '').trim() }));
    const v = validateGraphChain([mkPanel(), zone]);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => /valeur de famille lisible/.test(e))).toBe(true);
  });
});
