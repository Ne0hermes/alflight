// Résiduel A5 / P0 — le résolveur de perf refuse les entrées manquantes
// (plus d'ISA 15° ni de masse 1000 fabriquées) au lieu de calculer.
import { describe, it, expect } from 'vitest';
import { inputsToConditions } from '@services/abacInterpolation';
import { missingRequiredInputs } from '@services/operationResolver';

describe('inputsToConditions — plus de défaut fabriqué (A5/P0)', () => {
  it('entrées présentes conservées', () => {
    expect(inputsToConditions({ oat: 20, pressureAltitude: 500, mass: 950, headwind: 8 }))
      .toEqual({ temperature: 20, pressure_altitude: 500, mass: 950, wind: 8 });
  });
  it('0 °C et altitude 0 restent valides (pas null)', () => {
    const c = inputsToConditions({ oat: 0, pressureAltitude: 0, mass: 900 });
    expect(c.temperature).toBe(0);
    expect(c.pressure_altitude).toBe(0);
  });
  it("entrées absentes → null (plus d'ISA 15 / masse 1000 / alt 0)", () => {
    const c = inputsToConditions({ mass: 900 });
    expect(c.temperature).toBeNull();
    expect(c.pressure_altitude).toBeNull();
    expect(c.mass).toBe(900);
    expect(c.wind).toBe(0); // vent : 0 conservateur conservé
  });
  it('null explicite → null', () => {
    const c = inputsToConditions({ oat: null, pressureAltitude: null, mass: null });
    expect(c.temperature).toBeNull();
    expect(c.pressure_altitude).toBeNull();
    expect(c.mass).toBeNull();
  });
});

describe('missingRequiredInputs — entrées à refuser (A5/P0)', () => {
  it('toutes présentes → aucune manquante', () => {
    expect(missingRequiredInputs({ temperature: 15, pressure_altitude: 0, mass: 900, wind: 0 })).toEqual([]);
  });
  it('température/altitude/masse null → listées dans l\'ordre', () => {
    expect(missingRequiredInputs({ temperature: null, pressure_altitude: null, mass: null }))
      .toEqual(['température', 'altitude', 'masse']);
  });
  it("le vent n'est PAS requis (défaut conservateur 0)", () => {
    expect(missingRequiredInputs({ temperature: 15, pressure_altitude: 0, mass: 900 })).toEqual([]);
  });
});
