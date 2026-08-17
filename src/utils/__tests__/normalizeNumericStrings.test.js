// src/utils/__tests__/normalizeNumericStrings.test.js
//
// Mise au type des chaînes numériques (17/08/2026).
//
// Trois chemins d'écriture, trois politiques : la saisie laissait des chaînes
// (« 50 »), l'extraction MANEX écrit des nombres, l'import communautaire
// recopie tel quel. Résultat : 50 !== "50" faisait voir 9 à 12 modifications
// fantômes au diff communautaire, et un .toFixed sur une chaîne a fait planter
// le module Déroutements le 16/08. La normalisation vit au point de passage
// COMMUN (validateAndRepairAircraft) : local et communautaire redeviennent
// comparables, quelle que soit l'origine de la fiche.

import { describe, it, expect } from 'vitest';
import { validateAndRepairAircraft } from '../aircraftValidation';

const base = {
  registration: 'F-TEST',
  model: 'Test',
  weights: { emptyWeight: 600, mtow: 900 },
};

const repare = (extra) => validateAndRepairAircraft({ ...base, ...extra }, { quiet: true });

describe('mise au type — vitesses', () => {
  it('les chaînes numériques deviennent des nombres, à la valeur exacte', () => {
    const a = repare({ speeds: { vso: '50', vs1: '55', vne: '166', vapp: '80.5' } });
    expect(a.speeds.vso).toBe(50);
    expect(a.speeds.vs1).toBe(55);
    expect(a.speeds.vne).toBe(166);
    expect(a.speeds.vapp).toBe(80.5);
  });

  it('une chaîne vide reste vide — on ne fabrique JAMAIS un 0', () => {
    const a = repare({ speeds: { vso: '', vy: '86' } });
    expect(a.speeds.vso).toBe('');
    expect(a.speeds.vy).toBe(86);
  });

  it('une chaîne non numérique est conservée telle quelle (fail-closed)', () => {
    const a = repare({ speeds: { vso: '50 kt env.' } });
    expect(a.speeds.vso).toBe('50 kt env.');
  });

  it('un zéro légitime reste un zéro, un nombre reste un nombre', () => {
    const a = repare({ speeds: { vso: 0, vs1: 55 } });
    expect(a.speeds.vso).toBe(0);
    expect(a.speeds.vs1).toBe(55);
  });

  it('voRanges : les cellules numériques sont typées, le drapeau saved est intact', () => {
    const a = repare({ speeds: { voRanges: [{ minWeight: '726', maxWeight: '1089', speed: '82', saved: true }] } });
    expect(a.speeds.voRanges[0]).toEqual({ minWeight: 726, maxWeight: 1089, speed: 82, saved: true });
  });
});

describe('mise au type — limites de vent', () => {
  it('la valeur est typée, le type (énumération) est intact', () => {
    const a = repare({ windLimits: { limits: [{ type: 'maxCrosswind', value: '17', saved: true }] } });
    expect(a.windLimits.limits[0].value).toBe(17);
    expect(a.windLimits.limits[0].type).toBe('maxCrosswind');
  });
});

describe('mise au type — carburant et scalaires', () => {
  it('le cas réel F-HSTR : fuelUsableCapacity « 147.5 » devient 147,5', () => {
    const a = repare({ fuelCapacity: 151, fuelUsableCapacity: '147.5', fuelConsumption: '35' });
    expect(a.fuelUsableCapacity).toBe(147.5);
    expect(a.fuelConsumption).toBe(35);
  });

  it('le cas réel F-HFGI : capacité de réservoir « 110 » devient 110, le nom et l\'id restent', () => {
    const a = repare({
      additionalFuelTanks: [{ id: '5845aa45-4b31', name: 'Reservoir principle', type: 'main', capacity: '110', arm: 0.82268 }],
    });
    expect(a.additionalFuelTanks[0].capacity).toBe(110);
    expect(a.additionalFuelTanks[0].name).toBe('Reservoir principle');
    expect(a.additionalFuelTanks[0].id).toBe('5845aa45-4b31');
  });

  it('l\'égalité stricte redevient vraie entre un preset (nombres) et une saisie (chaînes)', () => {
    const saisie = repare({ speeds: { vso: '50', vne: '166' } });
    const preset = repare({ speeds: { vso: 50, vne: 166 } });
    expect(saisie.speeds.vso === preset.speeds.vso).toBe(true);
    expect(saisie.speeds.vne === preset.speeds.vne).toBe(true);
  });
});
