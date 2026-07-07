// Schéma carburant/énergie EASA 2022 (règlement (UE) 2021/1296) : le bilan
// comprend 8 postes, dont le carburant discrétionnaire (« marge ») ajouté à la
// seule discrétion du commandant de bord — distinct de l'extra (retards prévus
// / contraintes opérationnelles). Vérifie que le poste existe, qu'il s'additionne
// au total (donc au contrôle FOB), et que les states persistés avant son ajout
// sont migrés au rechargement.
// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { useFuelStore } from '@core/stores/fuelStore';

const EXPECTED_KEYS = [
  'roulage', 'trip', 'contingency', 'alternate',
  'finalReserve', 'additional', 'extra', 'discretionary'
];

beforeEach(() => {
  useFuelStore.getState().resetToDefault();
});

describe('fuelStore — poste discrétionnaire (schéma carburant EASA 2022)', () => {
  it('l\'état initial contient les 8 postes du schéma, discretionary à zéro', () => {
    const { fuelData } = useFuelStore.getState();
    expect(Object.keys(fuelData).sort()).toEqual([...EXPECTED_KEYS].sort());
    expect(fuelData.discretionary).toEqual({ gal: 0, ltr: 0 });
  });

  it('la marge discrétionnaire s\'additionne au total requis', () => {
    const before = useFuelStore.getState().calculateTotal('ltr');
    useFuelStore.getState().updateFuelItem('discretionary', { gal: 2.6, ltr: 10 });
    const after = useFuelStore.getState().calculateTotal('ltr');
    expect(after).toBeCloseTo(before + 10, 5);
  });

  it('la marge discrétionnaire compte dans le contrôle de suffisance FOB', () => {
    const state = useFuelStore.getState();
    state.setFobFuel(state.calculateTotal('ltr'));
    expect(useFuelStore.getState().isFobSufficient()).toBe(true);

    useFuelStore.getState().updateFuelItem('discretionary', { gal: 1.3, ltr: 5 });
    expect(useFuelStore.getState().isFobSufficient()).toBe(false);
    expect(useFuelStore.getState().getFuelDifference()).toBeCloseTo(-5, 5);
  });

  it('resetToDefault conserve le poste discretionary', () => {
    useFuelStore.getState().updateFuelItem('discretionary', { gal: 1.3, ltr: 5 });
    useFuelStore.getState().resetToDefault();
    expect(useFuelStore.getState().fuelData.discretionary).toEqual({ gal: 0, ltr: 0 });
  });

  it('migre les states persistés antérieurs (fuelData sans discretionary)', async () => {
    const legacyState = {
      state: {
        fuelData: {
          roulage: { gal: 1.0, ltr: 3.79 },
          trip: { gal: 10, ltr: 37.9 },
          contingency: { gal: 1, ltr: 3.79 },
          alternate: { gal: 2.0, ltr: 7.57 },
          finalReserve: { gal: 4, ltr: 15.1 },
          additional: { gal: 0, ltr: 0 },
          extra: { gal: 3, ltr: 11.4 }
        },
        fobFuel: { gal: 20, ltr: 75.7 }
      },
      version: 0
    };
    localStorage.setItem('fuel-storage', JSON.stringify(legacyState));

    await useFuelStore.persist.rehydrate();

    const { fuelData } = useFuelStore.getState();
    expect(fuelData.discretionary).toEqual({ gal: 0, ltr: 0 });
    // Les valeurs existantes sont préservées
    expect(fuelData.extra).toEqual({ gal: 3, ltr: 11.4 });
    expect(fuelData.trip).toEqual({ gal: 10, ltr: 37.9 });
  });
});
