// Configuration réservoirs PAR VOL (décision pilote 2026-07) : le CDB coche à
// chaque préparation les réservoirs réellement embarqués. Sémantique clé issue
// de la revue adversariale : une config VIERGE (engagée mais aucune case
// touchée — cas du reload de brouillon, la config n'étant pas persistée) ne
// fait PAS foi : elle ne doit ni filtrer les calculs ni écraser le FOB/les
// loads restaurés. Elle ne fait foi qu'à la première interaction du pilote.

import { describe, it, expect, beforeEach } from 'vitest';
import { useFuelStore, aircraftTankConfigId, activeTankIdsFrom } from '../fuelStore';

const AC = {
  id: 42,
  registration: 'F-TEST',
  additionalFuelTanks: [
    { id: 'L', capacity: 60, arm: 2.0 },
    { id: 'R', capacity: 40, arm: 2.5 },
    { capacity: 50, arm: 3.1 }, // sans id → clé d'index '2'
  ],
};
const AC_KEY = aircraftTankConfigId(AC); // '42'

beforeEach(() => {
  useFuelStore.getState().resetTankConfig();
});

describe('aircraftTankConfigId — identité avion', () => {
  it('privilégie id, repli sur registration, null si pas d\'avion', () => {
    expect(aircraftTankConfigId({ id: 7, registration: 'F-X' })).toBe('7');
    expect(aircraftTankConfigId({ registration: 'F-X' })).toBe('F-X');
    expect(aircraftTankConfigId(null)).toBe(null);
  });
});

describe('activeTankIdsFrom — la config ne fait foi que si engagée ET non vierge', () => {
  it('null si non engagée (aircraftId null)', () => {
    expect(activeTankIdsFrom({ aircraftId: null, tanks: {} }, AC)).toBe(null);
  });

  it('null si engagée pour un AUTRE avion', () => {
    const cfg = { aircraftId: 'autre', tanks: { L: { active: true, ltr: 10 } } };
    expect(activeTankIdsFrom(cfg, AC)).toBe(null);
  });

  it('null si VIERGE (engagée, aucune case touchée) — ne pas écraser un brouillon restauré', () => {
    expect(activeTankIdsFrom({ aircraftId: AC_KEY, tanks: {} }, AC)).toBe(null);
  });

  it('liste des réservoirs cochés après interaction (ids String et clés d\'index)', () => {
    const cfg = {
      aircraftId: AC_KEY,
      tanks: { L: { active: true, ltr: 30 }, '2': { active: true, ltr: 20 } },
    };
    expect(activeTankIdsFrom(cfg, AC)).toEqual(['L', '2']);
  });

  it('[] si le pilote a interagi puis tout décoché → « rien embarqué » (≠ null)', () => {
    const cfg = { aircraftId: AC_KEY, tanks: { L: { active: false, ltr: 0 } } };
    expect(activeTankIdsFrom(cfg, AC)).toEqual([]);
  });
});

describe('actions tankConfig du store', () => {
  it('initTankConfig : même avion → conserve la saisie en cours (allers-retours d\'étapes)', () => {
    const s = useFuelStore.getState();
    s.initTankConfig(AC_KEY);
    s.setTankActive('L', true);
    s.setTankLiters('L', 45);
    s.initTankConfig(AC_KEY); // re-montage du module, même avion
    expect(useFuelStore.getState().tankConfig.tanks.L).toEqual({ active: true, ltr: 45 });
  });

  it('initTankConfig : avion différent → repart vierge', () => {
    const s = useFuelStore.getState();
    s.initTankConfig(AC_KEY);
    s.setTankActive('L', true);
    s.initTankConfig('autre-avion');
    const cfg = useFuelStore.getState().tankConfig;
    expect(cfg.aircraftId).toBe('autre-avion');
    expect(cfg.tanks).toEqual({});
  });

  it('setTankActive(false) remet le volume à zéro (décision pilote : pas de mémoire)', () => {
    const s = useFuelStore.getState();
    s.initTankConfig(AC_KEY);
    s.setTankActive('L', true);
    s.setTankLiters('L', 45);
    s.setTankActive('L', false);
    expect(useFuelStore.getState().tankConfig.tanks.L).toEqual({ active: false, ltr: 0 });
  });

  it('getActiveTankIds : null si vierge, ids après interaction, null pour un autre avion', () => {
    const s = useFuelStore.getState();
    s.initTankConfig(AC_KEY);
    expect(s.getActiveTankIds(AC_KEY)).toBe(null); // vierge
    s.setTankActive('R', true);
    expect(useFuelStore.getState().getActiveTankIds(AC_KEY)).toEqual(['R']);
    expect(useFuelStore.getState().getActiveTankIds('autre')).toBe(null);
  });

  it('resetTankConfig purge tout (nouvelle préparation de vol)', () => {
    const s = useFuelStore.getState();
    s.initTankConfig(AC_KEY);
    s.setTankActive('L', true);
    s.resetTankConfig();
    expect(useFuelStore.getState().tankConfig).toEqual({ aircraftId: null, tanks: {} });
  });
});
