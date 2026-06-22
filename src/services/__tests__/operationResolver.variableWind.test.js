// Vent VARIABLE (décision pilote 2026-06-22) : pour une opération distance, le
// résolveur retourne la MOYENNE des distances vent de face et vent arrière à la
// magnitude, avec windAveraged=true + un warning explicite.
import { describe, it, expect } from 'vitest';
import { resolveOperation } from '../operationResolver';

const mkCurve = (id, familyValue, pts, windDirection) => ({
  id, name: id, color: '#000000', familyValue,
  points: pts.map(([x, y], i) => ({ x, y, id: `${id}-p${i}` })),
  ...(windDirection ? { windDirection } : {}),
  fitted: { points: pts.map(([x, y], i) => ({ x, y, id: `${id}-f${i}` })) }
});

const primary = {
  id: 'g1', name: 'Primaire OAT', role: 'primary', operationId: 'takeoff_50ft',
  familyAxisVariable: 'pressure_altitude', isWindRelated: false,
  linkedFrom: [], linkedTo: ['g2'],
  axes: {
    xAxis: { min: 0, max: 40, step: 10, title: 'oat', unit: '°C' },
    yAxis: { min: 0, max: 400, step: 100, title: 'takeoff_distance_50ft', unit: 'm' }
  },
  curves: [mkCurve('g1-c2000', 2000, [[0, 0], [40, 400]])]
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
const aircraft = { performanceModels: [{ id: 'm1', name: 'Set', data: { graphs: [primary, windPanel] } }] };
const base = { mass: 1000, oat: 15, pressureAltitude: 2000 };

describe('Vent variable — moyenne face/arrière', () => {
  it('windVariable + magnitude → value = moyenne(face, arrière) + windAveraged + warning', () => {
    const head = resolveOperation(aircraft, 'takeoff_50ft', { ...base, headwind: 8, windComponent: 8, tailwind: -8 });
    const tail = resolveOperation(aircraft, 'takeoff_50ft', { ...base, headwind: -8, windComponent: -8, tailwind: 8 });
    expect(head.status).toBe('COMPUTED');
    expect(tail.status).toBe('COMPUTED');

    const vrb = resolveOperation(aircraft, 'takeoff_50ft', {
      ...base, windVariable: true, windMagnitude: 8, windComponent: 0, headwind: 0, tailwind: 0
    });
    expect(vrb.status).toBe('COMPUTED');
    expect(vrb.windAveraged).toBe(true);
    expect(vrb.value).toBeCloseTo((head.value + tail.value) / 2, 6);
    // Face raccourcit, arrière rallonge → la moyenne est entre les deux.
    expect(vrb.value).toBeGreaterThan(head.value);
    expect(vrb.value).toBeLessThan(tail.value);
    expect(vrb.warnings.some(w => /moyenne face\/arrière/i.test(w))).toBe(true);
  });

  it('magnitude nulle ou vent non variable → calcul normal (pas de moyenne)', () => {
    const calm = resolveOperation(aircraft, 'takeoff_50ft', { ...base, windVariable: true, windMagnitude: 0, windComponent: 0 });
    expect(calm.windAveraged).toBeUndefined();
    const normal = resolveOperation(aircraft, 'takeoff_50ft', { ...base, headwind: 5, windComponent: 5, tailwind: -5 });
    expect(normal.windAveraged).toBeUndefined();
  });
});
