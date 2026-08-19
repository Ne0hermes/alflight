// Limites BAGAGES du manuel — contrôle MOTEUR (19/08/2026).
//
// Cas réel F-BXQT (Reims/Cessna F150M) : compartiment 1 maxi 54 kg,
// compartiment 2 maxi 18 kg, MAIS masse totale embarquable en soute = 54 kg.
// Le champ maxBaggageTotalMass existait (saisi dans Step3 avec la promesse
// « sera contrôlée lors du calcul M&C ») mais n'était LU PAR AUCUN calcul —
// l'application déclarait un contrôle qui n'existait pas. Ces tests posent le
// contrat : dépassement (total OU par compartiment) ⇒ avertissement explicite
// + isBaggageOverLimit=true + isWithinLimits=false ; fiche SANS limite ⇒
// comportement strictement inchangé (aucune limite fabriquée).

import { describe, it, expect } from 'vitest';
import { computeWeightBalance } from '../computeWeightBalance.js';

// Fiche modelée sur F-BXQT : biplace (bras arrière ABSENTS → null, jamais 0),
// deux compartiments de soute avec limites propres + limite totale 54 kg.
const FBXQT = {
  registration: 'F-BXQT',
  fuelType: 'AVGAS 100LL',
  weights: { emptyWeight: 520, mtow: 757 },
  weightBalance: {
    emptyWeightArm: 0.85,
    frontLeftSeatArm: 0.99,
    frontRightSeatArm: 0.99,
    rearLeftSeatArm: null,   // biplace : pas de sièges arrière
    rearRightSeatArm: null,
    fuelArm: 1.07,
  },
  cgEnvelope: {
    forwardPoints: [{ weight: 500, cg: 0.80 }, { weight: 757, cg: 0.83 }],
    aftCG: 1.09,
  },
  maxBaggageTotalMass: 54,
  baggageCompartments: [
    { id: 'c1', name: 'Compartiment 1', arm: 1.50, maxWeight: 54 },
    { id: 'c2', name: 'Compartiment 2', arm: 1.83, maxWeight: 18 },
  ],
};

const calc = (aircraft, loads) => computeWeightBalance({ aircraft, loads });

describe('computeWeightBalance — limite TOTALE de soute (maxBaggageTotalMass)', () => {
  it('F-BXQT réel : 40 kg C1 + 18 kg C2 = 58 > 54 → hors limites avec avertissement', () => {
    const r = calc(FBXQT, { baggage_c1: 40, baggage_c2: 18 });
    expect(r).not.toBeNull();
    // Chaque compartiment respecte SA limite (40 ≤ 54, 18 ≤ 18) : seul le
    // TOTAL du manuel est violé — exactement le trou que l'audit a confirmé.
    expect(r.isBaggageOverLimit).toBe(true);
    expect(r.isWithinLimits).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/Bagages : 58\.0 kg > maximum total 54\.0 kg/);
    // La masse globale, elle, reste dans les limites (578 ≤ 757) : le verdict
    // hors limites vient bien de la soute, pas de la MTOW.
    expect(r.isWithinWeight).toBe(true);
    expect(r.totalWeight).toBe(578);
  });

  it('36 + 18 = 54 kg exactement → dans les limites, aucun avertissement bagages', () => {
    const r = calc(FBXQT, { baggage_c1: 36, baggage_c2: 18 });
    expect(r).not.toBeNull();
    expect(r.isBaggageOverLimit).toBe(false);
    expect(r.isWithinLimits).toBe(true);
    expect(r.warnings.join(' ')).not.toMatch(/[Bb]agages/);
  });

  it('fiche SANS maxBaggageTotalMass → aucun contrôle total (comportement inchangé)', () => {
    const { maxBaggageTotalMass, ...sansLimite } = FBXQT;
    const r = calc(sansLimite, { baggage_c1: 40, baggage_c2: 18 });
    expect(r).not.toBeNull();
    // 58 kg en soute : chaque compartiment respecte sa propre limite, et sans
    // limite totale déclarée le moteur n'en FABRIQUE pas une.
    expect(r.isBaggageOverLimit).toBe(false);
    expect(r.isWithinLimits).toBe(true);
  });
});

describe('computeWeightBalance — limite PAR compartiment (maxWeight du manuel)', () => {
  it('20 kg dans C2 (max 18) → hors limites avec avertissement nominatif', () => {
    const { maxBaggageTotalMass, ...sansLimiteTotale } = FBXQT;
    const r = calc(sansLimiteTotale, { baggage_c1: 10, baggage_c2: 20 });
    expect(r).not.toBeNull();
    expect(r.isBaggageOverLimit).toBe(true);
    expect(r.isWithinLimits).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/Compartiment « Compartiment 2 » : 20\.0 kg > maximum 18\.0 kg/);
  });

  it('compartiment sans maxWeight → aucun contrôle par compartiment', () => {
    const sansMax = {
      ...FBXQT,
      maxBaggageTotalMass: undefined,
      baggageCompartments: [{ id: 'c1', name: 'Compartiment 1', arm: 1.50 }],
    };
    const r = calc(sansMax, { baggage_c1: 45 });
    expect(r).not.toBeNull();
    expect(r.isBaggageOverLimit).toBe(false);
    expect(r.isWithinLimits).toBe(true);
  });
});

describe('computeWeightBalance — limite totale en mode compartiments LEGACY (baggage/auxiliary)', () => {
  it('40 kg baggage + 20 kg auxiliary = 60 > 54 → hors limites', () => {
    const legacy = {
      ...FBXQT,
      baggageCompartments: undefined,
      weightBalance: { ...FBXQT.weightBalance, baggageArm: 1.50, auxiliaryArm: 1.83 },
    };
    const r = calc(legacy, { baggage: 40, auxiliary: 20 });
    expect(r).not.toBeNull();
    expect(r.isBaggageOverLimit).toBe(true);
    expect(r.isWithinLimits).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/maximum total 54\.0 kg/);
  });
});
