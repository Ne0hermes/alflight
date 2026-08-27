// K2 (AUDIT_CONVERSION_PERF_VOL.md) — garde d'unité du résolveur.
// Une opération « distance » dont l'abaque ne déclare AUCUNE unité est flaguée
// (warning « Unité non déclarée ») au lieu de retomber silencieusement sur « m ».
import { describe, it, expect } from 'vitest';
import { resolveOperation } from '../operationResolver';

const mkCurve = (id, familyValue, pts) => ({
  id, name: id, color: '#000000', familyValue,
  points: pts.map(([x, y], i) => ({ x, y, id: `${id}-p${i}` })),
  fitted: { points: pts.map(([x, y], i) => ({ x, y, id: `${id}-f${i}` })) }
});

// yUnit = unité déclarée sur l'axe Y (les 2 graphes), ou null = NON déclarée.
const mkPrimary = (yUnit) => ({
  id: 'g1', name: 'Primaire', role: 'primary', operationId: 'takeoff_50ft',
  familyAxisVariable: 'pressure_altitude', isWindRelated: false,
  linkedFrom: [], linkedTo: ['g2'],
  axes: {
    xAxis: { min: 0, max: 40, step: 10, title: 'oat', unit: '°C' },
    yAxis: { min: 0, max: 400, step: 100, title: 'takeoff_distance_50ft', ...(yUnit ? { unit: yUnit } : {}) }
  },
  curves: [mkCurve('c2000', 2000, [[0, 0], [40, 400]])]
});
const mkMass = (yUnit) => ({
  id: 'g2', name: 'Masse', role: 'intermediate', isWindRelated: false,
  linkedFrom: ['g1'], linkedTo: [],
  axes: {
    xAxis: { min: 950, max: 1150, step: 50, title: 'mass', unit: 'kg', reversed: true },
    yAxis: { min: 0, max: 400, step: 100, title: 'takeoff_distance_50ft', ...(yUnit ? { unit: yUnit } : {}) }
  },
  curves: [mkCurve('low', 1, [[950, 100], [1150, 200]]), mkCurve('high', 2, [[950, 200], [1150, 300]])]
});
const mkAircraft = (yUnit) => ({ performanceModels: [{ id: 'm1', name: 'Set', data: { graphs: [mkPrimary(yUnit), mkMass(yUnit)] } }] });
// Variante avec un outputUnit ESTAMPILLÉ sur le primaire — c'est ce que fait
// l'atelier dès que l'opération n'accepte qu'une seule sortie : la valeur vient
// du défaut du catalogue, pas d'un choix du pilote.
const mkAircraftEstampille = (yUnit, outputUnit) => ({
  performanceModels: [{
    id: 'm1', name: 'Set',
    data: { graphs: [{ ...mkPrimary(yUnit), outputKind: 'distance', outputUnit }, mkMass(yUnit)] }
  }]
});
const inputs = { mass: 1000, oat: 20, pressureAltitude: 2000, headwind: 0, windComponent: 0, tailwind: 0 };

describe('K2 — garde d\'unité (distance sans unité déclarée)', () => {
  it('abaque SANS unité Y → COMPUTED + warning « non déclarée » + défaut catalogue « m »', () => {
    const res = resolveOperation(mkAircraft(null), 'takeoff_50ft', inputs);
    expect(res.status).toBe('COMPUTED');
    expect(res.unit).toBe('m'); // OUT_DISTANCE.defaultUnit
    expect(res.warnings.some(w => /non déclarée/i.test(w))).toBe(true);
    expect(res.confidence).toBe('85%'); // dégradée par le warning
  });

  it('abaque AVEC unité Y déclarée → PAS de warning K2, unité = celle de l\'abaque', () => {
    const res = resolveOperation(mkAircraft('ft'), 'takeoff_50ft', inputs);
    expect(res.status).toBe('COMPUTED');
    expect(res.unit).toBe('ft');
    expect(res.warnings.some(w => /non déclarée/i.test(w))).toBe(false);
  });

  // 27/08 — motif relevé sur les planches d'atterrissage de la flotte : l'axe
  // de sortie est en « ft » et le primaire porte « m », estampillé par l'atelier
  // depuis le défaut du catalogue. La valeur doit être servie dans l'unité de
  // l'axe RÉELLEMENT lu, et le désaccord signalé.
  it('unités contradictoires (axe « ft », primaire estampillé « m ») → unité de l\'axe + warning', () => {
    const res = resolveOperation(mkAircraftEstampille('ft', 'm'), 'takeoff_50ft', inputs);
    expect(res.status).toBe('COMPUTED');
    expect(res.unit).toBe('ft'); // l'axe de sortie fait foi, pas l'estampille
    expect(res.warnings.some(w => /contradictoires/i.test(w))).toBe(true);
    expect(res.confidence).toBe('85%');
  });

  // Le trou que la rédaction précédente laissait passer : sans unité sur l'axe
  // de sortie, un primaire estampillé suffisait à taire la garde.
  it('axe de sortie MUET mais primaire estampillé → warning quand même', () => {
    const res = resolveOperation(mkAircraftEstampille(null, 'm'), 'takeoff_50ft', inputs);
    expect(res.status).toBe('COMPUTED');
    expect(res.unit).toBe('m'); // repli assumé sur l'estampille
    expect(res.warnings.some(w => /non déclarée/i.test(w))).toBe(true);
    expect(res.confidence).toBe('85%');
  });
});
