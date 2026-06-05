// Phase 1 (A1) — densité carburant unique. Garde-fou T5 : Jet A-1 = 0.84 partout.
import { describe, it, expect } from 'vitest';
import { getFuelDensity } from '@utils/fuelDensity';
import { FUEL_DENSITIES } from '@utils/constants';
import { DENSITIES } from '@utils/unitConversions';
import {
  getFuelDensity as mbGetFuelDensity,
  FUEL_DENSITIES as MB_DENSITIES,
} from '@features/aircraft/utils/mbUnits';

describe('getFuelDensity — source unique (constants.js)', () => {
  it('valeurs canoniques', () => {
    expect(getFuelDensity('JET A-1')).toBe(0.84);
    expect(getFuelDensity('AVGAS 100LL')).toBe(0.72);
    expect(getFuelDensity('MOGAS')).toBe(0.72);
  });
  it('normalise les alias', () => {
    expect(getFuelDensity('JET-A1')).toBe(0.84);
    expect(getFuelDensity('jet a-1')).toBe(0.84);
    expect(getFuelDensity('AVGAS')).toBe(0.72);
  });
  it('type inconnu/absent → null (P0, pas de devinette)', () => {
    expect(getFuelDensity('UNKNOWN')).toBeNull();
    expect(getFuelDensity('')).toBeNull();
    expect(getFuelDensity(null)).toBeNull();
    expect(getFuelDensity(undefined)).toBeNull();
  });
});

describe('A1 — Jet A-1 = 0.84 partout (plus de 0.80 / 0.74 divergents)', () => {
  it('unitConversions.DENSITIES sourcé depuis constants', () => {
    expect(DENSITIES.JET_A1).toBe(0.84); // était 0.80
    expect(DENSITIES.AVGAS).toBe(0.72);
  });
  it('mbUnits aligné', () => {
    expect(MB_DENSITIES['JET-A1']).toBe(0.84); // était 0.80
    expect(MB_DENSITIES.MOGAS).toBe(0.72); // était 0.74
    expect(mbGetFuelDensity('JET-A1')).toBe(0.84);
    expect(mbGetFuelDensity('JET A-1')).toBe(0.84); // normalisation
  });
  it('cohérence inter-modules pour Jet A-1', () => {
    const canon = FUEL_DENSITIES['JET A-1'];
    expect(getFuelDensity('JET A-1')).toBe(canon);
    expect(DENSITIES.JET_A1).toBe(canon);
    expect(mbGetFuelDensity('JET-A1')).toBe(canon);
  });
});
