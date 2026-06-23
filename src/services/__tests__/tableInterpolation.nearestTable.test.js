// Perf hors couverture (décision pilote 2026-06-23) : quand un tableau est
// hors plage masse ET que l'extrapolation est impossible (tableau fourni à UNE
// seule masse = la masse maxi), on AFFICHE le résultat du TABLEAU LE PLUS PROCHE
// (masse clampée) au lieu d'une ERREUR — conservateur pour un avion plus léger.
// L'alerte hors-couverture est CONSERVÉE.
import { describe, it, expect } from 'vitest';
import { resolveOperationFromTables } from '../tableInterpolationAdapter';

const pt = (Masse, Altitude, Temperature, value) => ({ Masse, Altitude, Temperature, value });

// Tableau d'atterrissage fourni à UNE seule masse (1089 kg = masse maxi),
// 2 altitudes × 2 températures.
const aircraft = {
  advancedPerformance: {
    tables: [{
      operationId: 'landing_ground_roll_flaps_landing',
      table_name: 'Atterrissage 1089 kg',
      outputUnit: 'm',
      data: [
        pt(1089, 0, 0, 400), pt(1089, 0, 40, 460),
        pt(1089, 4000, 0, 520), pt(1089, 4000, 40, 600),
      ]
    }]
  }
};
const OP = 'landing_ground_roll_flaps_landing';

describe('Tableau hors couverture → tableau le plus proche', () => {
  it('masse SOUS la plage (1078 < 1089, mono-masse) → COMPUTED via le plus proche + alerte conservée', () => {
    const res = resolveOperationFromTables(aircraft, OP, { mass: 1078, pressure_altitude: 0, temperature: 0 });
    expect(res.status).toBe('COMPUTED');                 // plus d'ERROR
    expect(res.value).toBeCloseTo(400, 0);               // valeur au 1089 kg / 0 ft / 0 °C
    expect(res.source.method).toMatch(/plus proche/i);
    expect(res.warnings.some(w => /hors plage/i.test(w))).toBe(true);     // alerte maintenue
    expect(res.warnings.some(w => /plus proche/i.test(w))).toBe(true);
    expect(res.warnings.some(w => /conservateur/i.test(w))).toBe(true);   // sous le min = conservateur
  });

  it('masse DANS la plage → trilinéaire normal (pas de repli)', () => {
    const res = resolveOperationFromTables(aircraft, OP, { mass: 1089, pressure_altitude: 0, temperature: 0 });
    expect(res.status).toBe('COMPUTED');
    expect(res.value).toBeCloseTo(400, 0);
    expect(res.source.method).toMatch(/trilin/i);
    expect((res.warnings || []).some(w => /plus proche/i.test(w))).toBe(false);
  });
});
