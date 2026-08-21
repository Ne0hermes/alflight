// src/services/__tests__/isaRelativeTables.test.js
//
// Tables raisonnant en ÉCART À L'ISA (Phase 0, 17/08/2026).
//
// Beaucoup de manuels — les Robin de la base — donnent pour chaque palier
// d'altitude trois températures : ISA−20, ISA et ISA+20. Rangées telles quelles
// dans un cube altitude × température absolue, ces neuf valeurs en réclament
// vingt-sept : dix-huit trous fabriqués alors que le manuel est complet.
//
// Les données ci-dessous sont celles de F-GUKQ (Robin DR400/120), table
// « Landing Ground Roll Distance - Flaps Landing - Max Mass 900 kg ».

import { describe, it, expect } from 'vitest';
import {
  isaTempAt,
  detectIsaRelativeTemperatures,
  buildLookupForOperation,
} from '../performanceTableGrouping';
import { resolveOperationFromTables } from '../tableInterpolationAdapter';

const pt = (Altitude, Temperature, value, Masse = 900) => ({ Altitude, Temperature, value, Masse });

// Table réelle F-GUKQ : 3 altitudes × 3 écarts (−20 / 0 / +20), 9 points.
const TABLE_ROBIN = [
  pt(0, -5, 185), pt(0, 15, 200), pt(0, 35, 210),
  pt(4000, -13, 205), pt(4000, 7, 225), pt(4000, 27, 240),
  pt(8000, -21, 235), pt(8000, -1, 250), pt(8000, 19, 270),
];

// Table réelle F-GGZO : mêmes températures absolues à toutes les altitudes.
const TABLE_ABSOLUE = [
  pt(0, 0, 210), pt(0, 10, 228), pt(0, 20, 246),
  pt(1000, 0, 231), pt(1000, 10, 250), pt(1000, 20, 269),
  pt(2000, 0, 254), pt(2000, 10, 274), pt(2000, 20, 295),
];

const groupe = (data) => ({ operationId: 'landing_ground_roll_flaps_landing', tables: [{ data }] });

describe('isaTempAt — atmosphère standard', () => {
  it('15 °C au niveau de la mer, −1,84 °C à 8000 ft', () => {
    expect(isaTempAt(0)).toBeCloseTo(15, 6);
    expect(isaTempAt(2000)).toBeCloseTo(11.04, 2);
    expect(isaTempAt(4000)).toBeCloseTo(7.08, 2);
    expect(isaTempAt(8000)).toBeCloseTo(-0.84, 2);
  });
});

describe('detectIsaRelativeTemperatures — reconnaissance stricte', () => {
  it('reconnaît une table Robin (températures différentes par palier, écarts identiques)', () => {
    expect(detectIsaRelativeTemperatures(TABLE_ROBIN)).toBe(true);
  });

  it('NE convertit PAS une table à températures absolues classiques', () => {
    expect(detectIsaRelativeTemperatures(TABLE_ABSOLUE)).toBe(false);
  });

  it('refuse de conclure sur une seule altitude', () => {
    expect(detectIsaRelativeTemperatures([pt(0, -5, 185), pt(0, 15, 200)])).toBe(false);
  });

  it('refuse quand les écarts ne coïncident pas (vraie table trouée)', () => {
    const trouee = [pt(0, -5, 185), pt(0, 15, 200), pt(4000, 7, 225), pt(4000, 30, 250)];
    expect(detectIsaRelativeTemperatures(trouee)).toBe(false);
  });

  it('ignore les points sans altitude ou sans température', () => {
    const sale = [...TABLE_ROBIN, { Altitude: null, Temperature: 12, value: 1 }, { Altitude: 2000, value: 2 }];
    expect(detectIsaRelativeTemperatures(sale)).toBe(true);
  });

  // ⚠️ Le cas F-BXNG / F-BXQT : une seule température par altitude, la ligne ISA.
  // Tous les écarts valent 0 et « coïncident » trivialement. Convertir réduirait
  // l'axe des températures à un point unique : toute OAT serait écrêtée sur la
  // valeur ISA, et une journée à 35 °C recevrait la distance des 15 °C.
  it('REFUSE une table réduite à la seule diagonale ISA (un écart unique)', () => {
    const diagonaleISA = [
      pt(0, 15, 224), pt(2500, 10, 277), pt(5000, 5, 340), pt(7500, 0, 414),
    ];
    // Les températures diffèrent bien d'un palier à l'autre…
    expect(new Set(diagonaleISA.map(p => p.Temperature)).size).toBe(4);
    // …et les écarts coïncident tous (0), mais il n'y en a qu'UN.
    expect(detectIsaRelativeTemperatures(diagonaleISA)).toBe(false);
  });

  it('accepte dès qu\'il existe deux écarts distincts', () => {
    const deuxEcarts = [
      pt(0, 15, 200), pt(0, 35, 210),
      pt(4000, 7, 225), pt(4000, 27, 240),
    ];
    expect(detectIsaRelativeTemperatures(deuxEcarts)).toBe(true);
  });
});

describe('buildLookupForOperation — axe des températures', () => {
  it('table Robin : axe en écarts (−20 / 0 / +20) et grille PLEINE', () => {
    const l = buildLookupForOperation(groupe(TABLE_ROBIN));
    expect(l.temperatureScale).toBe('isaDeviation');
    expect(l.temperatures).toEqual([-20, 0, 20]);
    expect(l.altitudes).toEqual([0, 4000, 8000]);
    // 3 altitudes × 3 écarts = 9 cases, toutes renseignées : plus aucun trou.
    const cases = l.values[0].flat();
    expect(cases).toHaveLength(9);
    expect(cases.filter(v => v === null)).toHaveLength(0);
    expect(l.values[0][0]).toEqual([185, 200, 210]);
    expect(l.values[0][2]).toEqual([235, 250, 270]);
  });

  it('avant ce correctif, la même table laissait 18 trous sur 27', () => {
    // Reconstitution de l'ancien rangement : axe en températures ABSOLUES.
    const absolues = [...new Set(TABLE_ROBIN.map(p => p.Temperature))].sort((a, b) => a - b);
    expect(absolues).toHaveLength(9);                     // 9 températures distinctes
    const cases = 3 * absolues.length;                    // 3 altitudes × 9
    expect(cases - TABLE_ROBIN.length).toBe(18);          // 18 cases sans valeur
  });

  it('table absolue : axe inchangé, comportement historique préservé', () => {
    const l = buildLookupForOperation(groupe(TABLE_ABSOLUE));
    expect(l.temperatureScale).toBe('absolute');
    expect(l.temperatures).toEqual([0, 10, 20]);
    expect(l.values[0][2]).toEqual([254, 274, 295]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 21/08/2026 — Bornes de température d'une grille ISA-relative.
// Le manuel raisonne en ISA−20 / ISA / ISA+20 : la plage se juge en ÉCART À
// L'ISA, jamais en température absolue. Au-delà de ISA+20 (côté chaud, la
// distance réelle est plus longue) : REFUS motivé. Sous ISA−20 : écrêtage sur
// ISA−20 (distance plus longue que la réalité, conservateur) + avertissement.
describe('resolveOperationFromTables — grille ISA-relative, bornes jugées en écart à l\'ISA', () => {
  const OP = 'landing_ground_roll_flaps_landing';
  const avionRobin = {
    advancedPerformance: {
      tables: [{ operationId: OP, table_name: 'Landing Ground Roll 900 kg', outputUnit: 'm', data: TABLE_ROBIN }]
    }
  };
  const cond = (pressure_altitude, temperature) => ({ mass: 900, pressure_altitude, temperature });

  it('ISA+10 (25 °C à 0 ft) → interpolé entre ISA (200) et ISA+20 (210) = 205, sans avertissement', () => {
    const res = resolveOperationFromTables(avionRobin, OP, cond(0, 25));
    expect(res.status).toBe('COMPUTED');
    expect(res.value).toBeCloseTo(205, 6);
    expect(res.warnings).toHaveLength(0);
  });

  it('pile sur ISA+20 (35 °C à 0 ft) → 210, pas de refus', () => {
    const res = resolveOperationFromTables(avionRobin, OP, cond(0, 35));
    expect(res.status).toBe('COMPUTED');
    expect(res.value).toBe(210);
  });

  it('ISA+30 (45 °C à 0 ft) → REFUS, motif exprimé en écart à l\'ISA', () => {
    const res = resolveOperationFromTables(avionRobin, OP, cond(0, 45));
    expect(res.status).toBe('ERROR');
    expect(res.value).toBeUndefined();
    expect(res.reason).toBe('OAT 45 °C à 0 ft, soit ISA+30, au-delà de la grille du manuel (max ISA+20) — distance non calculable, vérifiez le manuel de vol');
    expect(res.source.temperatureScale).toBe('isaDeviation');
  });

  it('la même OAT absolue (30 °C) est acceptée à 0 ft (ISA+15) et refusée à 4000 ft (ISA+23)', () => {
    // 30 − 15 = ISA+15 au niveau de la mer → entre ISA (200) et ISA+20 (210) : 207,5.
    const ok = resolveOperationFromTables(avionRobin, OP, cond(0, 30));
    expect(ok.status).toBe('COMPUTED');
    expect(ok.value).toBeCloseTo(207.5, 6);
    // 30 − 7,08 = ISA+22,9 à 4000 ft → au-delà de ISA+20 : refus.
    const refus = resolveOperationFromTables(avionRobin, OP, cond(4000, 30));
    expect(refus.status).toBe('ERROR');
    expect(refus.reason).toMatch(/^OAT 30 °C à 4000 ft, soit ISA\+23, au-delà de la grille du manuel \(max ISA\+20\)/);
  });

  it('ISA−30 (−15 °C à 0 ft) → écrêté sur ISA−20 (185) + avertissement « conservateur »', () => {
    const res = resolveOperationFromTables(avionRobin, OP, cond(0, -15));
    expect(res.status).toBe('COMPUTED');
    expect(res.value).toBeCloseTo(185, 6);
    expect(res.warnings.some(w => /soit ISA-30 — sous la plage du manuel \(ISA-20\)/.test(w))).toBe(true);
    expect(res.warnings.some(w => /conservateur/i.test(w))).toBe(true);
  });
});
