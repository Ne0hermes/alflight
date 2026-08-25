import { describe, it, expect } from 'vitest';
import { computeMaxFuel } from '../maxFuel';

// AVGAS ≈ 0.72 kg/L (source unique constants.js — vérifié par fuelDensity)
const AC = {
  fuelType: 'AVGAS',
  maxTakeoffWeight: 1000,
  additionalFuelTanks: [
    { id: 'M', capacity: 110 },
    { id: 'X', capacity: 80 }
  ]
};

describe('computeMaxFuel', () => {
  it('limité par la CAPACITÉ quand la masse disponible suffit', () => {
    // masse dispo = 1000 − 800 = 200 kg → 277 L possibles > 190 L de capacité
    const r = computeMaxFuel({ aircraft: AC, zfwKg: 800, activeTankIds: ['M', 'X'] });
    expect(r.ok).toBe(true);
    expect(r.limitedBy).toBe('capacity');
    expect(r.litresMax).toBe(190);
    // Répartition dans l'ordre : M plein (110), X plein (80)
    expect(r.perTank).toEqual([{ key: 'M', ltr: 110 }, { key: 'X', ltr: 80 }]);
  });

  it('limité par la MTOW quand la masse manque — remplissage dans l\'ordre', () => {
    // masse dispo = 1000 − 928 = 72 kg → 100 L → M prend 100, X prend 0
    const r = computeMaxFuel({ aircraft: AC, zfwKg: 928, activeTankIds: ['M', 'X'] });
    expect(r.ok).toBe(true);
    expect(r.limitedBy).toBe('mtow');
    expect(r.litresMax).toBe(100);
    expect(r.perTank[0].key).toBe('M');
    expect(r.perTank[0].ltr).toBe(100);
    expect(r.perTank[1].ltr).toBe(0);
  });

  it('ne considère que les réservoirs COCHÉS', () => {
    const r = computeMaxFuel({ aircraft: AC, zfwKg: 800, activeTankIds: ['X'] });
    expect(r.ok).toBe(true);
    expect(r.litresMax).toBe(80);
    expect(r.perTank).toEqual([{ key: 'X', ltr: 80 }]);
  });

  it('masse dispo négative → 0 litre (jamais de négatif)', () => {
    const r = computeMaxFuel({ aircraft: AC, zfwKg: 1100, activeTankIds: null });
    expect(r.ok).toBe(true);
    expect(r.litresMax).toBe(0);
    expect(r.limitedBy).toBe('mtow');
  });

  it('fail-closed : densité inconnue, masses manquantes, aucun réservoir', () => {
    expect(computeMaxFuel({ aircraft: { ...AC, fuelType: 'PLUTONIUM' }, zfwKg: 800 }))
      .toEqual({ ok: false, error: 'fuelDensity' });
    expect(computeMaxFuel({ aircraft: { ...AC, maxTakeoffWeight: undefined }, zfwKg: 800 }))
      .toEqual({ ok: false, error: 'weights' });
    expect(computeMaxFuel({ aircraft: { fuelType: 'AVGAS', maxTakeoffWeight: 1000 }, zfwKg: 800 }))
      .toEqual({ ok: false, error: 'noTanks' });
  });

  it('tous les réservoirs décochés (activeTankIds=[]) → erreur explicite, PAS le repli capacité globale', () => {
    const r = computeMaxFuel({ aircraft: { ...AC, fuelCapacity: 190 }, zfwKg: 800, activeTankIds: [] });
    expect(r).toEqual({ ok: false, error: 'noTanks' });
  });

  it('arrondi vers le BAS : jamais au-dessus de la masse disponible', () => {
    // masse dispo = 1000 − 911.111 = 88.889 kg → 123.457 L → floor 123.4 L
    const r = computeMaxFuel({ aircraft: AC, zfwKg: 911.111, activeTankIds: ['M', 'X'] });
    expect(r.ok).toBe(true);
    expect(r.litresMax).toBe(123.4);
    expect(r.litresMax * 0.72).toBeLessThanOrEqual(88.889);
  });

  it('Lot 1.0 — réservoir coché à contenance INCONNUE : refus tankCapacity (le calcul partiel remplissait les autres)', () => {
    const ac = { fuelType: 'AVGAS', maxTakeoffWeight: 1000, additionalFuelTanks: [
      { id: 'M', capacity: 110 },
      { id: 'X', name: 'Aux' } // aucune contenance saisie
    ] };
    const r = computeMaxFuel({ aircraft: ac, zfwKg: 800, activeTankIds: ['M', 'X'] });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('tankCapacity');
    expect(r.tanks).toEqual(['Aux']);
    // En ne cochant QUE le réservoir connu, le calcul redevient exact
    const r2 = computeMaxFuel({ aircraft: ac, zfwKg: 800, activeTankIds: ['M'] });
    expect(r2.ok).toBe(true);
    expect(r2.litresMax).toBe(110);
  });

  it('Lot 1.0 — TOUS cochés sans contenance : tankCapacity, pas le faux diagnostic « aucun réservoir coché »', () => {
    const ac = { fuelType: 'AVGAS', maxTakeoffWeight: 1000, additionalFuelTanks: [{ id: 'M' }, { id: 'X' }] };
    const r = computeMaxFuel({ aircraft: ac, zfwKg: 800, activeTankIds: ['M', 'X'] });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('tankCapacity');
  });

  it('avion legacy sans réservoirs détaillés : capacité globale', () => {
    const legacy = { fuelType: 'AVGAS', maxTakeoffWeight: 1000, fuelCapacity: 120 };
    const r = computeMaxFuel({ aircraft: legacy, zfwKg: 800, activeTankIds: null });
    expect(r.ok).toBe(true);
    expect(r.litresMax).toBe(120);
    expect(r.perTank).toEqual([]);
  });
});
