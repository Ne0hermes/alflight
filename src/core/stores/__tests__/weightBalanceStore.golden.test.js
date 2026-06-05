// Caractérisation (golden) du comportement ACTUEL de weightBalanceStore.
// Phase 0 du PLAN_REMEDIATION_FLUX_2026-06-05 : poser le filet AVANT toute
// modification, pour mesurer chaque delta des phases suivantes.
//
// ⚠️ Ces valeurs capturent le comportement PRÉSENT, bugs compris :
//   - l'enveloppe CG est aplatie en rectangle [forwardPoints[0].cg, aftCG]
//     (anomalies A2/A3). La Phase 2 introduira cg_limit(masse) et fera évoluer
//     ces attentes À DESSEIN — c'est le but du filet.
//
// Toutes les valeurs attendues sont calculées à la main depuis le code de
// calculateWeightBalance (weightBalanceStore.js:190-248).

import { describe, it, expect, beforeEach } from 'vitest';
import { useWeightBalanceStore } from '@core/stores/weightBalanceStore';

// Avion de référence : weightBalance explicite (pas de fallback bras) +
// cgEnvelope (force le bloc cgLimits l.99-106 → forward=1.90, aft=2.50).
const AIRCRAFT = {
  registration: 'F-GOLD',
  fuelType: 'AVGAS 100LL',
  emptyWeight: 700,
  weights: { emptyWeight: 700, mtow: 1100 },
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
  cgEnvelope: {
    forwardPoints: [{ weight: 600, cg: 1.90 }, { weight: 1100, cg: 2.00 }],
    aftCG: 2.50,
  },
};

const setLoads = (loads) => useWeightBalanceStore.getState().setLoads(loads);
const calc = () => useWeightBalanceStore.getState().calculateWeightBalance(AIRCRAFT);

describe('weightBalanceStore.calculateWeightBalance — golden (comportement actuel)', () => {
  beforeEach(() => {
    // Charge de référence : 2 sièges avant 80 kg, 10 kg bagages, 80 kg carburant.
    setLoads({ frontLeft: 80, frontRight: 80, rearLeft: 0, rearRight: 0, baggage: 10, auxiliary: 0, fuel: 80 });
  });

  it('masse / moment / CG = calcul manuel', () => {
    // total = 700 + 80 + 80 + 10 + 80 = 950
    // moment = 700*2.10 + 80*2.05 + 80*2.05 + 10*3.50 + 80*2.40
    //        = 1470 + 164 + 164 + 35 + 192 = 2025
    // cg = 2025 / 950 = 2.132
    const r = calc();
    expect(r).not.toBeNull();
    expect(r.totalWeight).toBe(950);
    expect(r.totalMoment).toBe(2025);
    expect(r.cg).toBe(2.132);
  });

  it('charge de référence : dans les limites (masse + CG)', () => {
    const r = calc();
    expect(r.isWithinWeight).toBe(true); // 950 ∈ [600, 1100]
    expect(r.isWithinCG).toBe(true);     // 2.132 ∈ [1.90, 2.50] (rectangle actuel)
    expect(r.isWithinLimits).toBe(true);
  });

  it('dépassement MTOW correctement détecté', () => {
    // total = 700 + 80 + 80 + 100 + 100 + 20 + 60 = 1140 (> MTOW 1100)
    // moment = 1470 + 164 + 164 + 300 + 300 + 70 + 144 = 2612 ; cg = 2.291
    setLoads({ frontLeft: 80, frontRight: 80, rearLeft: 100, rearRight: 100, baggage: 20, auxiliary: 0, fuel: 60 });
    const r = calc();
    expect(r.totalWeight).toBe(1140);
    expect(r.cg).toBe(2.291);
    expect(r.isWithinWeight).toBe(false);
    expect(r.isWithinLimits).toBe(false);
  });
});
