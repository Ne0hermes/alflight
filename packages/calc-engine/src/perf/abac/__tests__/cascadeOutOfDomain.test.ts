// packages/calc-engine/src/perf/abac/__tests__/cascadeOutOfDomain.test.ts
//
// X HORS DOMAINE ENTRE DEUX COURBES D'ALTITUDE (17/08/2026).
//
// Le cas banal d'un été chaud sur un terrain à 400 ft : l'altitude-pression
// tombe ENTRE deux courbes de l'abaque, et la température demandée dépasse le
// domaine tracé des deux (au-delà de la tolérance d'extrapolation de 10 %).
// `findYForX` rend alors null pour chacune, la branche d'interpolation ne
// produisait RIEN, et la ligne de trace suivante déréférençait le vide :
// TypeError, plantage du rendu de l'étape Performance — pas un message
// d'erreur. Le correctif rend un échec fail-closed avec le motif.

import { describe, it, expect } from 'vitest';
import { performCascadeCalculationWithParameters } from '../cascade';
import type { GraphConfig } from '../types';

// Deux courbes d'altitude (0 et 2000 ft), X tracé de 0 à 40.
// Tolérance d'extrapolation : 10 % de la plage, soit 4 → tout X > 44 est hors domaine.
const points = (yBase: number) =>
  Array.from({ length: 5 }, (_, i) => ({ x: i * 10, y: yBase + i * 50 }));

const graphe: GraphConfig = {
  id: 'g1',
  name: 'Distance de décollage',
  axes: {
    xAxis: { title: 'oat', min: 0, max: 40, unit: '°C' },
    yAxis: { title: 'takeoff_distance', min: 0, max: 1000, unit: 'm' },
  },
  curves: [
    { id: 'c0', name: '0 ft', familyValue: 0, points: points(200), fitted: { points: points(200) } },
    { id: 'c2000', name: '2000 ft', familyValue: 2000, points: points(260), fitted: { points: points(260) } },
  ],
} as unknown as GraphConfig;

describe('cascade — X hors domaine entre deux courbes d\'altitude', () => {
  it('altitude entre deux courbes, X DANS le domaine : interpolation normale', () => {
    const r = performCascadeCalculationWithParameters([graphe], 20, [
      { graphId: 'g1', parameter: 1000 },
    ]);
    expect(r.success).toBe(true);
    // Mi-chemin entre 300 (0 ft) et 360 (2000 ft) à X=20.
    expect(r.finalValue).toBeCloseTo(330, 6);
  });

  it('X au-delà du domaine des DEUX courbes : échec explicite, PAS de plantage', () => {
    // Avant le correctif : TypeError « Cannot read properties of undefined
    // (reading 'outputValue') » — l'étape 5 du wizard cassait à l'écran.
    const r = performCascadeCalculationWithParameters([graphe], 60, [
      { graphId: 'g1', parameter: 1000 },
    ]);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/hors du domaine tracé/);
    expect(r.error).toMatch(/vérifiez le manuel de vol/);
  });

  it('X dans la tolérance d\'extrapolation de 10 % : valeur rendue (comportement historique)', () => {
    const r = performCascadeCalculationWithParameters([graphe], 43, [
      { graphId: 'g1', parameter: 1000 },
    ]);
    expect(r.success).toBe(true);
    expect(r.finalValue).toBeGreaterThan(400);
  });
});
