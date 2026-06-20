// Intégration bout-en-bout du carburant STRICT par réservoir dans les scénarios
// de centrage (décision pilote 2026-06 : jamais de moyenne, jamais de × 0, jamais
// de repli ; erreur explicite sinon).

import { describe, it, expect } from 'vitest';
import { calculateScenarios } from '../calculations';
import { getFuelDensity } from '@utils/fuelDensity';

const D = getFuelDensity('AVGAS 100LL');

const baseAircraft = (tanks) => ({
  fuelType: 'AVGAS 100LL',
  weights: { emptyWeight: 700 },
  fuelCapacity: tanks.reduce((s, t) => s + t.capacity, 0),
  weightBalance: {
    emptyWeightArm: 2.10,
    frontLeftSeatArm: 2.05,
    frontRightSeatArm: 2.05,
    baggageArm: 3.50,
    // ⚠️ PAS de fuelArm : le bras vient des réservoirs
  },
  additionalFuelTanks: tanks,
});
const CALCS = { totalWeight: 870, totalMoment: 1800, cg: 2.07 };
const FOB = { ltr: 80 };
const FUELDATA = { roulage: { ltr: 2 }, trip: { ltr: 20 } };

const fuelRows = (items) => items.filter((i) => i.arm != null && /Aile|Tip|Réservoir|Carburant/.test(i.label));

describe('calculateScenarios — carburant strict par réservoir', () => {
  it('2 réservoirs MÊME bras : réservoirs pleins → moment par réservoir, bras exact', () => {
    const ac = baseAircraft([
      { id: 'L', name: 'Aile G', capacity: 60, arm: 2.2 },
      { id: 'R', name: 'Aile D', capacity: 40, arm: 2.2 },
    ]);
    const r = calculateScenarios(ac, CALCS, { frontLeft: 80 }, FOB, FUELDATA);
    const rows = fuelRows(r.fulltank.items);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const fuelMoment = rows.reduce((s, i) => s + i.moment, 0);
    expect(fuelMoment).toBeCloseTo(100 * D * 2.2, 3); // bras commun, exact
    expect(fuelMoment).toBeGreaterThan(0);
  });

  it('2 réservoirs bras DIFFÉRENTS : pleins = exact par réservoir (PAS la moyenne)', () => {
    const ac = baseAircraft([
      { id: 'L', name: 'Aile G', capacity: 60, arm: 2.0 },
      { id: 'R', name: 'Tip', capacity: 40, arm: 2.5 },
    ]);
    const r = calculateScenarios(ac, CALCS, { frontLeft: 80 }, FOB, FUELDATA);
    const fuelMoment = fuelRows(r.fulltank.items).reduce((s, i) => s + i.moment, 0);
    // À pleins, Σ(cap×bras) coïncide avec la moyenne pondérée (identité) ;
    // la divergence se prouve en partiel non proportionnel (test suivant).
    expect(fuelMoment).toBeCloseTo(60 * D * 2.0 + 40 * D * 2.5, 3);
  });

  it('2 réservoirs bras DIFFÉRENTS, FOB sans répartition → décollage/atterrissage INDISPONIBLES', () => {
    const ac = baseAircraft([
      { id: 'L', capacity: 60, arm: 2.0 },
      { id: 'R', capacity: 40, arm: 2.5 },
    ]);
    const r = calculateScenarios(ac, CALCS, { frontLeft: 80 }, FOB, FUELDATA);
    // pleins = OK (capacités connues) ; FOB partiel sans répartition = indisponible
    expect(typeof r.fulltank.w).toBe('number');
    expect(r.toCrm.w).toBeNull();
    expect(r.toCrm.unavailableReason).toBe('distribution');
    expect(r.landing.w).toBeNull();
    expect(r.landing.unavailableReason).toBe('distribution');
  });

  it('2 réservoirs bras DIFFÉRENTS AVEC répartition saisie → décollage exact', () => {
    const ac = baseAircraft([
      { id: 'L', capacity: 60, arm: 2.0 },
      { id: 'R', capacity: 40, arm: 2.5 },
    ]);
    const loads = { frontLeft: 80, fuel_L: 50, fuel_R: 30 };
    const r = calculateScenarios(ac, CALCS, loads, FOB, FUELDATA);
    expect(typeof r.toCrm.w).toBe('number');
    const fuelMoment = fuelRows(r.toCrm.items).reduce((s, i) => s + i.moment, 0);
    expect(fuelMoment).toBeCloseTo(50 * D * 2.0 + 30 * D * 2.5, 3); // = 175·D
    expect(fuelMoment).not.toBeCloseTo(80 * D * 2.2, 1);            // ≠ moyenne 176·D
  });

  it('réservoir chargé SANS bras → scénario indisponible (fuelArm), jamais moment 0 silencieux', () => {
    const ac = baseAircraft([
      { id: 'L', capacity: 60, arm: 2.0 },
      { id: 'R', capacity: 40 }, // pas de bras
    ]);
    const r = calculateScenarios(ac, CALCS, { frontLeft: 80 }, FOB, FUELDATA);
    expect(r.fulltank.w).toBeNull();
    expect(r.fulltank.unavailableReason).toBe('fuelArm');
  });
});
