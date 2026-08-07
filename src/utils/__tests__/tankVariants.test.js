import { describe, it, expect } from 'vitest';
import {
  applyTankVariant,
  getDefaultVariantId,
  hasTankVariants,
  sanitizeTankVariants
} from '../tankVariants';

const TANKS = [
  { id: 'M', name: 'Principal', type: 'main', capacity: 110, arm: 1.1 },
  { id: 'A', name: 'Aile G', type: 'wing', capacity: 40, arm: 1.2 },
  { id: 'X', name: 'Long range', type: 'aux', capacity: 80, arm: 2.4, optional: true }
];

const AC = {
  id: 7,
  registration: 'F-VRNT',
  fuelType: 'AVGAS',
  fuelCapacity: 230,
  fuelUsableCapacity: 220,
  additionalFuelTanks: TANKS,
  tankVariants: [
    { id: 'v-std', name: 'Standard', isDefault: true, tankIds: ['M', 'A'] },
    { id: 'v-lr', name: 'Long Range', isDefault: false, tankIds: ['M', 'A', 'X'] }
  ]
};

describe('applyTankVariant — avion effectif', () => {
  it('filtre les réservoirs et recalcule la capacité pour la variante Standard', () => {
    const eff = applyTankVariant(AC, 'v-std');
    expect(eff).not.toBe(AC);
    expect(eff.additionalFuelTanks.map(t => t.id)).toEqual(['M', 'A']);
    expect(eff.fuelCapacity).toBe(150);
    expect(eff.fuelUsableCapacity).toBe(150); // plafonnée à la variante
    expect(eff._tankVariantId).toBe('v-std');
  });

  it('variante couvrant tous les réservoirs → avion INCHANGÉ (identité)', () => {
    expect(applyTankVariant(AC, 'v-lr')).toBe(AC);
  });

  it('sans variantes / variante inconnue / pas de variantId → avion inchangé', () => {
    const noVariants = { ...AC, tankVariants: undefined };
    expect(applyTankVariant(noVariants, 'v-std')).toBe(noVariants);
    expect(applyTankVariant(AC, 'v-inexistante')).toBe(AC);
    expect(applyTankVariant(AC, null)).toBe(AC);
  });

  it('variante ne référençant plus aucun réservoir existant → fail-safe inchangé', () => {
    const ac = { ...AC, tankVariants: [{ id: 'v-morte', name: 'X', tankIds: ['ZZZ'] }, ...AC.tankVariants] };
    expect(applyTankVariant(ac, 'v-morte')).toBe(ac);
  });

  it('réservoirs sans id : correspondance par index (convention fuelStore)', () => {
    const ac = {
      ...AC,
      additionalFuelTanks: [{ capacity: 100, arm: 1 }, { capacity: 50, arm: 2 }],
      tankVariants: [
        { id: 'v-1', name: 'Un seul', tankIds: ['0'] },
        { id: 'v-2', name: 'Deux', tankIds: ['0', '1'] }
      ]
    };
    const eff = applyTankVariant(ac, 'v-1');
    expect(eff.additionalFuelTanks).toHaveLength(1);
    expect(eff.fuelCapacity).toBe(100);
  });
});

describe('getDefaultVariantId / hasTankVariants', () => {
  it('retourne la variante isDefault, sinon la première, sinon null', () => {
    expect(getDefaultVariantId(AC)).toBe('v-std');
    expect(getDefaultVariantId({ tankVariants: [{ id: 'a', name: 'A', tankIds: ['M'] }] })).toBe('a');
    expect(getDefaultVariantId({})).toBeNull();
  });

  it('hasTankVariants dès 1 variante (le sélecteur doit être visible)', () => {
    expect(hasTankVariants(AC)).toBe(true);
    expect(hasTankVariants({ tankVariants: [AC.tankVariants[0]] })).toBe(true);
    expect(hasTankVariants({ tankVariants: [] })).toBe(false);
    expect(hasTankVariants({})).toBe(false);
  });
});

describe('sanitizeTankVariants — assainissement au save', () => {
  it('purge les références mortes, les variantes vides, garantit un défaut', () => {
    const cleaned = sanitizeTankVariants([
      { id: 'v1', name: 'OK', isDefault: false, tankIds: ['M', 'DISPARU'] },
      { id: 'v2', name: 'Vide', tankIds: ['DISPARU'] },
      { id: 'v3', name: '   ', tankIds: ['M'] }
    ], TANKS);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].tankIds).toEqual(['M']);
    expect(cleaned[0].isDefault).toBe(true);
  });

  it('tableaux absents → []', () => {
    expect(sanitizeTankVariants(undefined, undefined)).toEqual([]);
  });

  it('exactement UN défaut : les isDefault multiples sont dégradés', () => {
    const cleaned = sanitizeTankVariants([
      { id: 'a', name: 'A', isDefault: true, tankIds: ['M'] },
      { id: 'b', name: 'B', isDefault: true, tankIds: ['A'] }
    ], TANKS);
    expect(cleaned.filter(v => v.isDefault)).toHaveLength(1);
    expect(cleaned[0].isDefault).toBe(true);
    expect(cleaned[1].isDefault).toBe(false);
  });
});
