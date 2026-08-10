import { describe, it, expect } from 'vitest';
import { getDeclination, trueToMagnetic } from '../magneticDeclination';

describe('getDeclination (WMM NOAA)', () => {
  it('France 2026 : déclinaison Est plausible (0 à 4°E)', () => {
    const d = getDeclination(48.85, 2.35, new Date('2026-08-07'));
    expect(d).not.toBeNull();
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(4);
  });

  it('mémoïsation stable et null si position invalide', () => {
    const a = getDeclination(45.0, 5.0, new Date('2026-08-07'));
    expect(getDeclination(45.0, 5.0, new Date('2026-08-07'))).toBe(a);
    expect(getDeclination(undefined, 5)).toBeNull();
    expect(getDeclination('x', 'y')).toBeNull();
  });
});

describe('trueToMagnetic', () => {
  it('soustrait la déclinaison Est et normalise 0-360', () => {
    expect(trueToMagnetic(10, 2)).toBe(8);
    expect(trueToMagnetic(1, 2)).toBe(359);   // passage par le nord
    expect(trueToMagnetic(359, -2)).toBe(1);  // déclinaison Ouest
    expect(trueToMagnetic('x', 2)).toBeNull();
  });
});
