// Règle STRICTE du bras carburant par réservoir (décision pilote 2026-06) :
// jamais de moyenne, jamais de × bras absent, jamais de repli inventé. Un
// réservoir chargé sans bras → erreur ; des bras différents sans répartition →
// indisponible (et non une moyenne).

import { describe, it, expect } from 'vitest';
import { singleFuelArm, computeScenarioFuel } from '../fuelArm';

const D = 0.72; // densité AVGAS approx pour les calculs

describe('singleFuelArm — bras unique uniquement si NON ambigu', () => {
  it('1 seul réservoir → son bras', () => {
    expect(singleFuelArm({ additionalFuelTanks: [{ capacity: 100, arm: 2.4 }] })).toEqual({ arm: 2.4 });
  });

  it('2 réservoirs d\'aile au MÊME bras → ce bras (exact, pas une moyenne)', () => {
    const ac = { additionalFuelTanks: [{ capacity: 60, arm: 2.2 }, { capacity: 40, arm: 2.2 }] };
    expect(singleFuelArm(ac)).toEqual({ arm: 2.2 });
  });

  it('2 réservoirs à bras DIFFÉRENTS → ambigu (répartition requise, jamais de moyenne)', () => {
    const ac = { additionalFuelTanks: [{ capacity: 60, arm: 2.0 }, { capacity: 40, arm: 2.5 }] };
    expect(singleFuelArm(ac)).toEqual({ error: 'ambiguous' });
  });

  it('réservoir avec capacité mais SANS bras → erreur fuelArm', () => {
    const ac = { additionalFuelTanks: [{ capacity: 60, arm: 2.0 }, { capacity: 40 }] };
    expect(singleFuelArm(ac)).toEqual({ error: 'fuelArm' });
  });

  it('réservoir avec bras = 0 → erreur fuelArm (jamais × 0)', () => {
    expect(singleFuelArm({ additionalFuelTanks: [{ capacity: 60, arm: 0 }] })).toEqual({ error: 'fuelArm' });
  });

  it('aucun réservoir, legacy arms.fuelMain → ce bras', () => {
    expect(singleFuelArm({ arms: { fuelMain: 2.18 } })).toEqual({ arm: 2.18 });
  });

  it('aucun réservoir et aucun bras legacy → erreur fuelArm', () => {
    expect(singleFuelArm({ weightBalance: { emptyWeightArm: 2.1 } })).toEqual({ error: 'fuelArm' });
  });

  it('garde-fou mm : bras réservoir en millimètres ramené en mètres', () => {
    expect(singleFuelArm({ additionalFuelTanks: [{ capacity: 100, arm: 805.9 }] }).arm).toBeCloseTo(0.8059, 6);
  });
});

describe('computeScenarioFuel — moment par réservoir, jamais de moyenne', () => {
  const TANKS_DIFF = { fuelCapacity: 100, additionalFuelTanks: [
    { id: 'L', name: 'Aile G', capacity: 60, arm: 2.0 },
    { id: 'R', name: 'Tip', capacity: 40, arm: 2.5 },
  ] };

  it('full : une ligne par réservoir, moment = Σ cap×densité×bras', () => {
    const r = computeScenarioFuel({ aircraft: TANKS_DIFF, scenario: 'full', density: D });
    expect(r.ok).toBe(true);
    expect(r.rows).toHaveLength(2);
    // À PLEINS réservoirs, Σ(cap×bras) == capacité×moyenne pondérée (identité
    // mathématique) : la divergence avec la moyenne se prouve en PARTIEL
    // non proportionnel (cf. test « fob avec répartition » ci-dessous).
    expect(r.moment).toBeCloseTo(60 * D * 2.0 + 40 * D * 2.5, 6);
  });

  it('fob bras DIFFÉRENTS sans répartition → indisponible (distribution), jamais une moyenne', () => {
    const r = computeScenarioFuel({ aircraft: TANKS_DIFF, scenario: 'fob', density: D, fobLiters: 50 });
    expect(r).toEqual({ ok: false, reason: 'distribution' });
  });

  it('fob avec répartition NON proportionnelle → exact par réservoir ≠ moyenne', () => {
    const loads = { fuel_L: 20, fuel_R: 30 }; // non proportionnel aux capacités 60/40
    const r = computeScenarioFuel({ aircraft: TANKS_DIFF, scenario: 'fob', density: D, fobLiters: 50, loads });
    expect(r.ok).toBe(true);
    expect(r.moment).toBeCloseTo(20 * D * 2.0 + 30 * D * 2.5, 6); // = 115·D
    expect(r.moment).not.toBeCloseTo(50 * D * 2.2, 2);            // ≠ moyenne 110·D
  });

  it('fob bras IDENTIQUES sans répartition → autorisé (ligne unique au bras commun)', () => {
    const same = { fuelCapacity: 100, additionalFuelTanks: [
      { id: 'L', capacity: 60, arm: 2.2 }, { id: 'R', capacity: 40, arm: 2.2 },
    ] };
    const r = computeScenarioFuel({ aircraft: same, scenario: 'fob', density: D, fobLiters: 50 });
    expect(r.ok).toBe(true);
    expect(r.moment).toBeCloseTo(50 * D * 2.2, 6);
  });

  it('landing : carburant brûlé retiré dans l\'ordre de la liste (déterministe)', () => {
    const loads = { fuel_L: 30, fuel_R: 20 }; // 50 L à bord
    // brûlé 35 L → retire 30 du 1er (G), puis 5 du 2e (Tip) → reste G:0, Tip:15
    const r = computeScenarioFuel({ aircraft: TANKS_DIFF, scenario: 'landing', density: D, fobLiters: 50, burnedLiters: 35, loads });
    expect(r.ok).toBe(true);
    expect(r.weight).toBeCloseTo(15 * D, 6);
    expect(r.moment).toBeCloseTo(15 * D * 2.5, 6); // ne reste que du Tip (bras 2.5)
  });

  it('réservoir chargé sans bras → indisponible (fuelArm), jamais × 0', () => {
    const bad = { additionalFuelTanks: [{ id: 'A', capacity: 60, arm: 2.0 }, { id: 'B', capacity: 40 }] };
    const r = computeScenarioFuel({ aircraft: bad, scenario: 'full', density: D });
    expect(r).toEqual({ ok: false, reason: 'fuelArm' });
  });
});
