// Perf hors couverture (décision pilote 2026-06-23) : quand un tableau est
// hors plage masse ET que l'extrapolation est impossible (tableau fourni à UNE
// seule masse = la masse maxi), on AFFICHE le résultat du TABLEAU LE PLUS PROCHE
// (masse clampée) au lieu d'une ERREUR — conservateur pour un avion plus léger.
// L'alerte hors-couverture est CONSERVÉE.
import { describe, it, expect } from 'vitest';
import { resolveOperationFromTables } from '../tableInterpolationAdapter';
import { resolveOperation, ResultStatus } from '../operationResolver';

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

// ─────────────────────────────────────────────────────────────────────────
// 21/08/2026 — Hors plage ALTITUDE / TEMPÉRATURE (ré-audit F-BXQT / F-BXNG).
// Au-delà du plafond de la grille (altitude plus haute, OAT plus chaude), la
// distance réelle est PLUS LONGUE que celle de la borne : l'écrêtage rendait une
// valeur OPTIMISTE avec un simple avertissement. Règle fail-closed : REFUS
// (status ERROR, motif explicite, pas de valeur). Sous le plancher, l'écrêtage
// rend une distance plus longue que la réalité : conservé, et signalé.
// La grille ci-dessus est ABSOLUE (0/40 °C à toutes les altitudes) ; le cas
// ISA-relatif est couvert dans isaRelativeTables.test.js.
describe('Hors plage altitude / température — refus côté optimiste, clamp côté conservateur', () => {
  const cond = (pressure_altitude, temperature, mass = 1089) => ({ mass, pressure_altitude, temperature });

  it('OAT au-delà du max (50 > 40 °C) → ERROR, motif explicite, aucune valeur', () => {
    const res = resolveOperationFromTables(aircraft, OP, cond(0, 50));
    expect(res.status).toBe('ERROR');
    expect(res.value).toBeUndefined();
    expect(res.reason).toBe('OAT 50 °C au-delà de la grille du manuel (max 40 °C) — distance non calculable, vérifiez le manuel de vol');
    // La plage du manuel reste exposée pour le panneau de détail.
    expect(res.source.temperatureRange).toEqual([0, 40]);
    expect(res.source.altitudeRange).toEqual([0, 4000]);
  });

  it('OAT sous le min (−10 < 0 °C) → COMPUTED, valeur écrêtée sur 0 °C + avertissement « conservateur »', () => {
    const res = resolveOperationFromTables(aircraft, OP, cond(0, -10));
    expect(res.status).toBe('COMPUTED');
    expect(res.value).toBeCloseTo(400, 6);                       // = valeur à 0 °C
    expect(res.warnings.some(w => /Température -10°C sous la plage \(min 0°C\)/.test(w))).toBe(true);
    expect(res.warnings.some(w => /conservateur/i.test(w))).toBe(true);
  });

  it('altitude au-delà du max (6000 > 4000 ft) → ERROR avec motif', () => {
    const res = resolveOperationFromTables(aircraft, OP, cond(6000, 0));
    expect(res.status).toBe('ERROR');
    expect(res.value).toBeUndefined();
    expect(res.reason).toBe('Altitude-pression 6000 ft au-delà de la grille du manuel (max 4000 ft) — distance non calculable, vérifiez le manuel de vol');
  });

  it('altitude sous le min (−500 < 0 ft) → COMPUTED, écrêtée sur 0 ft + avertissement', () => {
    const res = resolveOperationFromTables(aircraft, OP, cond(-500, 0));
    expect(res.status).toBe('COMPUTED');
    expect(res.value).toBeCloseTo(400, 6);
    expect(res.warnings.some(w => /Altitude -500 ft sous la plage \(min 0 ft\)/.test(w))).toBe(true);
  });

  it('altitude ET OAT au-delà → un seul ERROR citant les deux dépassements', () => {
    const res = resolveOperationFromTables(aircraft, OP, cond(6000, 50));
    expect(res.status).toBe('ERROR');
    expect(res.reason).toBe(
      'Altitude-pression 6000 ft au-delà de la grille du manuel (max 4000 ft) ; ' +
      'OAT 50 °C au-delà de la grille du manuel (max 40 °C) — distance non calculable, vérifiez le manuel de vol'
    );
  });

  it('pile sur le plafond (4000 ft / 40 °C) → COMPUTED, pas de refus', () => {
    const res = resolveOperationFromTables(aircraft, OP, cond(4000, 40));
    expect(res.status).toBe('COMPUTED');
    expect(res.value).toBeCloseTo(600, 6);
    expect(res.warnings).toHaveLength(0);
  });

  it('masse hors plage ET OAT au-delà : le refus température prime sur le « tableau le plus proche »', () => {
    const res = resolveOperationFromTables(aircraft, OP, cond(0, 50, 1078));
    expect(res.status).toBe('ERROR');
    expect(res.value).toBeUndefined();
    expect(res.reason).toMatch(/^OAT 50 °C au-delà de la grille du manuel/);
  });

  it('bout en bout via resolveOperation : le statut remonte en ResultStatus.ERROR, motif conservé', () => {
    const res = resolveOperation(aircraft, OP, { mass: 1089, oat: 50, pressureAltitude: 0, headwind: 0 });
    expect(res.status).toBe(ResultStatus.ERROR);
    expect(res.value).toBeUndefined();
    expect(res.reason).toMatch(/OAT 50 °C au-delà de la grille du manuel \(max 40 °C\)/);
  });
});

// Cas réel F-BXQT / F-BXNG (Cessna F150) : la grille n'a qu'UNE température par
// palier — la ligne ISA (15 °C à 0 ft, 10 °C à 2500 ft, 5 °C à 5000 ft, 0 °C à
// 7500 ft). L'axe absolu vaut [0, 5, 10, 15] °C et seule la diagonale est
// renseignée. Reproduit par exécution le 21/08 : (726 kg, 0 ft, 25 °C) → 224 m,
// la distance des 15 °C, avec un simple avertissement « clamp aux bornes ».
describe('Cas F-BXQT — grille réduite à la seule ligne ISA', () => {
  const OP_F150 = 'takeoff_ground_roll_flaps_up';
  const f150 = {
    advancedPerformance: {
      tables: [{
        operationId: OP_F150,
        table_name: 'Décollage roulement 726 kg',
        outputUnit: 'm',
        data: [pt(726, 0, 15, 224), pt(726, 2500, 10, 277), pt(726, 5000, 5, 340), pt(726, 7500, 0, 414)]
      }]
    }
  };

  it('(726 kg, 0 ft, 15 °C) → 224 m : le point du manuel, tel quel', () => {
    const res = resolveOperationFromTables(f150, OP_F150, { mass: 726, pressure_altitude: 0, temperature: 15 });
    expect(res.status).toBe('COMPUTED');
    expect(res.value).toBe(224);
  });

  it('(726 kg, 0 ft, 25 °C) → ERROR : plus jamais les 224 m des 15 °C', () => {
    const res = resolveOperationFromTables(f150, OP_F150, { mass: 726, pressure_altitude: 0, temperature: 25 });
    expect(res.status).toBe('ERROR');
    expect(res.value).toBeUndefined();
    expect(res.reason).toBe('OAT 25 °C au-delà de la grille du manuel (max 15 °C) — distance non calculable, vérifiez le manuel de vol');
  });
});
