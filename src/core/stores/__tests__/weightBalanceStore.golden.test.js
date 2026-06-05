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

// ── Phase 2 (A2) — le store interpole l'enveloppe avant (verdict corrigé) ──
const AIRCRAFT_VAR_FWD = {
  registration: 'F-VARF',
  fuelType: 'AVGAS 100LL',
  emptyWeight: 850,
  weights: { emptyWeight: 850, mtow: 1100 },
  weightBalance: {
    emptyWeightArm: 2.00, frontLeftSeatArm: 2.00, frontRightSeatArm: 2.00,
    rearLeftSeatArm: 2.00, rearRightSeatArm: 2.00, baggageArm: 2.00,
    auxiliaryArm: 2.00, fuelArm: 2.00,
  },
  // Limite avant qui se resserre avec la masse : 2.05 @600 kg → 1.95 @1000 kg.
  cgEnvelope: { forwardPoints: [{ weight: 600, cg: 2.05 }, { weight: 1000, cg: 1.95 }], aftCG: 2.60 },
};

describe('weightBalanceStore — Phase 2 : enveloppe interpolée (A2)', () => {
  it('applique la limite avant À la masse réelle, pas forwardPoints[0]', () => {
    useWeightBalanceStore.getState().setLoads({
      frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0, baggage: 0, auxiliary: 0, fuel: 150,
    });
    const r = useWeightBalanceStore.getState().calculateWeightBalance(AIRCRAFT_VAR_FWD);
    // total = 850 + 150 = 1000 ; moment = 850×2 + 150×2 = 2000 ; cg = 2.00
    expect(r.totalWeight).toBe(1000);
    expect(r.cg).toBe(2);
    // limite avant interpolée à 1000 kg = 1.95 (et non le point[0] figé = 2.05)
    expect(r.cgLimits.forward).toBeCloseTo(1.95, 6);
    // 2.00 ∈ [1.95, 2.60] → DANS les limites ; l'ancien rectangle (2.05) disait HORS
    expect(r.isWithinCG).toBe(true);
  });
});

// ── Phase 4 (A6/P0) — zéro fallback fantôme ──
const AIRCRAFT_MISSING_ARM = {
  registration: 'F-NOARM',
  fuelType: 'AVGAS 100LL',
  emptyWeight: 700,
  weights: { emptyWeight: 700, mtow: 1100 },
  // Pas de weightBalance → fallback depuis armLengths ; rearSeat1Arm ABSENT.
  armLengths: {
    emptyMassArm: 2.10, frontSeat1Arm: 2.05, frontSeat2Arm: 2.05,
    rearSeat2Arm: 3.00, fuelArm: 2.40, standardBaggageArm: 3.50,
  },
  cgEnvelope: { forwardPoints: [{ weight: 600, cg: 1.9 }, { weight: 1100, cg: 2.0 }], aftCG: 2.5 },
};

describe('weightBalanceStore — Phase 4 : zéro fallback fantôme (A6/P0)', () => {
  it('bras manquant sur station chargée → CG non fiable (isWithinCG null + warning)', () => {
    useWeightBalanceStore.getState().setLoads({
      frontLeft: 80, frontRight: 0, rearLeft: 100, rearRight: 0, baggage: 0, auxiliary: 0, fuel: 50,
    });
    const r = useWeightBalanceStore.getState().calculateWeightBalance(AIRCRAFT_MISSING_ARM);
    expect(r).not.toBeNull();
    expect(r.cgReliable).toBe(false);
    expect(r.isWithinCG).toBeNull(); // pas de faux « OK » sur un bras inventé
    expect(r.isWithinLimits).toBe(false); // fail-closed
    expect(r.warnings.join(' ')).toMatch(/arrière gauche/);
    expect(r.totalWeight).toBe(930); // la masse reste calculable (700+80+100+50)
  });

  it('masse à vide absente → calcul refusé (null), pas de 600 kg fabriqué', () => {
    useWeightBalanceStore.getState().setLoads({
      frontLeft: 80, frontRight: 0, rearLeft: 0, rearRight: 0, baggage: 0, auxiliary: 0, fuel: 0,
    });
    const r = useWeightBalanceStore.getState().calculateWeightBalance({
      registration: 'F-NOEW', fuelType: 'AVGAS 100LL', weights: { mtow: 1100 },
    });
    expect(r).toBeNull();
  });
});
