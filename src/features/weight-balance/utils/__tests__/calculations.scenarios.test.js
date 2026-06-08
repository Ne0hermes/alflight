// Caractérisation de calculateScenarios — filet AVANT/APRÈS le fail-closed
// densité (cluster 1). Vérifie que :
//   - type carburant CONNU → scénarios carburant calculés (nombres) ;
//   - type carburant INCONNU → scénarios carburant INDISPONIBLES (w/cg/fuel null,
//     unavailableReason='fuelDensity'), SEUL ZFW (masse sans carburant) reste fiable.
// Objectif : prouver qu'aucune masse carburant n'est inventée (?? 0.84 retiré).

import { describe, it, expect } from 'vitest';
import { calculateScenarios } from '../calculations';

const AIRCRAFT = {
  fuelType: 'AVGAS 100LL',
  weights: { emptyWeight: 700 },
  fuelCapacity: 100, // litres
  weightBalance: {
    emptyWeightArm: 2.10,
    frontLeftSeatArm: 2.05,
    frontRightSeatArm: 2.05,
    rearLeftSeatArm: 3.00,
    rearRightSeatArm: 3.00,
    baggageArm: 3.50,
    auxiliaryArm: 3.70,
    fuelArm: 2.40,
  },
};
const CALCS = { totalWeight: 870, totalMoment: 1800, cg: 2.07 };
const LOADS = { frontLeft: 80, frontRight: 80, rearLeft: 0, rearRight: 0, baggage: 10, auxiliary: 0, fuel: 57.6 };
const FOB = { ltr: 80 };
const FUELDATA = { roulage: { ltr: 2 }, trip: { ltr: 20 } };

describe('calculateScenarios — densité fail-closed (cluster 1)', () => {
  it('type carburant connu (AVGAS) → scénarios carburant calculés', () => {
    const r = calculateScenarios(AIRCRAFT, CALCS, LOADS, FOB, FUELDATA);
    expect(r).not.toBeNull();
    expect(r.fuelDensityMissing).toBe(false);
    expect(typeof r.fulltank.w).toBe('number');
    expect(r.fulltank.fuel).toBeGreaterThan(0); // 100 L × densité AVGAS > 0
    expect(typeof r.landing.w).toBe('number');
    expect(typeof r.zfw.w).toBe('number');
  });

  it('type carburant inconnu → scénarios carburant INDISPONIBLES, ZFW reste fiable', () => {
    const r = calculateScenarios({ ...AIRCRAFT, fuelType: 'XYZ_INCONNU' }, CALCS, LOADS, FOB, FUELDATA);
    expect(r).not.toBeNull();
    expect(r.fuelDensityMissing).toBe(true);
    // Aucune masse carburant inventée : scénarios avec carburant indisponibles.
    expect(r.fulltank.w).toBeNull();
    expect(r.fulltank.unavailableReason).toBe('fuelDensity');
    expect(r.toCrm.w).toBeNull();
    expect(r.landing.w).toBeNull();
    // La masse SANS carburant reste calculable.
    expect(typeof r.zfw.w).toBe('number');
    expect(r.zfw.w).toBeGreaterThan(0);
  });

  it('type carburant absent (undefined) → même fail-closed', () => {
    const r = calculateScenarios({ ...AIRCRAFT, fuelType: undefined }, CALCS, LOADS, FOB, FUELDATA);
    expect(r.fuelDensityMissing).toBe(true);
    expect(r.fulltank.w).toBeNull();
    expect(typeof r.zfw.w).toBe('number');
  });
});
