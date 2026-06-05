// Phase 4.2 (A6/P0) — vitesse/conso : null si non renseigné (fin des 30/40/100/120 divergents).
import { describe, it, expect } from 'vitest';
import { getCruiseSpeedKt, getFuelConsumptionLph } from '@utils/aircraftPerf';

describe('getCruiseSpeedKt', () => {
  it('cruiseSpeedKt prioritaire, sinon cruiseSpeed', () => {
    expect(getCruiseSpeedKt({ cruiseSpeedKt: 110 })).toBe(110);
    expect(getCruiseSpeedKt({ cruiseSpeed: 95 })).toBe(95);
    expect(getCruiseSpeedKt({ cruiseSpeedKt: 110, cruiseSpeed: 95 })).toBe(110);
  });
  it('absente / ≤0 / null → null (plus de 100 ni 120 fabriqués)', () => {
    expect(getCruiseSpeedKt({})).toBeNull();
    expect(getCruiseSpeedKt({ cruiseSpeed: 0 })).toBeNull();
    expect(getCruiseSpeedKt(null)).toBeNull();
  });
});

describe('getFuelConsumptionLph', () => {
  it('renseignée → valeur (string tolérée)', () => {
    expect(getFuelConsumptionLph({ fuelConsumption: 32 })).toBe(32);
    expect(getFuelConsumptionLph({ fuelConsumption: '28.5' })).toBe(28.5);
  });
  it('absente / 0 / null → null (plus de 30 ni 40 fabriqués)', () => {
    expect(getFuelConsumptionLph({})).toBeNull();
    expect(getFuelConsumptionLph({ fuelConsumption: 0 })).toBeNull();
    expect(getFuelConsumptionLph(null)).toBeNull();
  });
});
