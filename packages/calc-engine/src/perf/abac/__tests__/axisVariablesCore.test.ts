// Lot 1-A (décision pilote 20/08) — dégraissage du catalogue de variables
// d'axes : la liste COURTE (perfCore) proposée dans l'atelier ne contient que
// les variables que la préparation de vol sait router ; le catalogue complet
// reste résolvable (ids persistés des vieux modèles). Ce test VERROUILLE :
//   1. la liste courte = exactement 10 ids ;
//   2. headwind / tailwind absents de la liste courte mais toujours résolus
//      par getAxisVariable (le sens du vent se choisit sur chaque courbe) ;
//   3. le label de 'custom' (axe de transfert des lectures descendantes) ;
//   4. getFamilyVariablesGrouped = exactement 3 ids (une famille ≠ un axe).
import { describe, it, expect } from 'vitest';
import {
  AXIS_VARIABLES,
  getAxisVariable,
  getAxisVariablesGroupedFor,
  getAxisVariablesGroupedForCore,
  getFamilyVariablesGrouped
} from '../axisVariables';

const PERF_CORE_IDS = [
  'oat',
  'pressure_altitude',
  'mass',
  'wind_component',
  'takeoff_distance_ground',
  'takeoff_distance_50ft',
  'landing_distance_ground',
  'landing_distance_50ft',
  'rate_of_climb',
  'custom'
];

const flatIds = (groups: Array<{ items: Array<{ id: string }> }>): string[] =>
  groups.flatMap(g => g.items.map(v => v.id));

describe('Lot 1-A — liste courte perfCore', () => {
  it('le catalogue marque perfCore sur exactement les 10 ids décidés', () => {
    const marked = AXIS_VARIABLES.filter(v => v.perfCore === true).map(v => v.id);
    expect(marked.sort()).toEqual([...PERF_CORE_IDS].sort());
  });

  it('getAxisVariablesGroupedForCore(x) ∪ (y) couvre exactement les 10 ids', () => {
    const xIds = flatIds(getAxisVariablesGroupedForCore('x'));
    const yIds = flatIds(getAxisVariablesGroupedForCore('y'));
    const union = Array.from(new Set([...xIds, ...yIds]));
    expect(union.sort()).toEqual([...PERF_CORE_IDS].sort());
  });

  it('axe X court : entrées routables + custom, sans les sorties', () => {
    const xIds = flatIds(getAxisVariablesGroupedForCore('x'));
    expect(xIds.sort()).toEqual(['custom', 'mass', 'oat', 'pressure_altitude', 'wind_component']);
  });

  it('axe Y court : sorties + custom, sans les entrées', () => {
    const yIds = flatIds(getAxisVariablesGroupedForCore('y'));
    expect(yIds.sort()).toEqual([
      'custom',
      'landing_distance_50ft',
      'landing_distance_ground',
      'rate_of_climb',
      'takeoff_distance_50ft',
      'takeoff_distance_ground'
    ]);
  });

  it('la liste courte est un sous-ensemble strict de la liste complète (rien retiré du catalogue)', () => {
    const fullX = flatIds(getAxisVariablesGroupedFor('x'));
    const coreX = flatIds(getAxisVariablesGroupedForCore('x'));
    coreX.forEach(id => expect(fullX).toContain(id));
    expect(fullX.length).toBeGreaterThan(coreX.length);
  });
});

describe('Lot 1-A — headwind / tailwind : hors liste courte, toujours résolus', () => {
  it('headwind et tailwind ne sont PAS proposés dans la liste courte', () => {
    const xIds = flatIds(getAxisVariablesGroupedForCore('x'));
    expect(xIds).not.toContain('headwind');
    expect(xIds).not.toContain('tailwind');
  });

  it('headwind et tailwind restent résolus par getAxisVariable (vieux modèles)', () => {
    expect(getAxisVariable('headwind')?.label).toBe('Vent de face');
    expect(getAxisVariable('tailwind')?.label).toBe('Vent arrière');
  });
});

describe('Lot 1-A — label de custom (axe de transfert)', () => {
  it('custom est renommé « Axe de transfert (sans variable précise) », unité libre', () => {
    const custom = getAxisVariable('custom');
    expect(custom?.label).toBe('Axe de transfert (sans variable précise)');
    expect(custom?.defaultUnit).toBe('');
    expect(custom?.units).toBeUndefined();
  });
});

describe('Lot 1-A — variables de FAMILLE de courbes', () => {
  it('getFamilyVariablesGrouped = exactement pressure_altitude, mass, wind_component', () => {
    const ids = flatIds(getFamilyVariablesGrouped());
    expect(ids.sort()).toEqual(['mass', 'pressure_altitude', 'wind_component']);
  });

  it('les groupes de famille gardent la forme optgroup (catégorie + label + items)', () => {
    for (const g of getFamilyVariablesGrouped()) {
      expect(typeof g.category).toBe('string');
      expect(typeof g.label).toBe('string');
      expect(g.items.length).toBeGreaterThan(0);
    }
  });
});
