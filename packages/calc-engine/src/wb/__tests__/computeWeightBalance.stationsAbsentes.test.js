/**
 * STATIONS ABSENTES vs DONNÉES MANQUANTES (27/08/2026).
 *
 * Le moteur exigeait d'entrée les bras des QUATRE sièges et un bras carburant
 * unique, et refusait tout le calcul si l'un manquait. « Manquant » n'y
 * distinguait pas la donnée oubliée de la STATION QUI N'EXISTE PAS : sur la
 * flotte réelle, les trois biplaces (Cessna 150/152, sans sièges arrière) et le
 * DR401 (carburant réparti sur trois réservoirs à trois bras différents, donc
 * aucun bras unique) ne calculaient AUCUN centrage — ni en préparation de vol,
 * ni au banc de cas de référence.
 *
 * Le refus reste fail-closed, mais au bon endroit : une station CHARGÉE dont le
 * bras manque rend toujours cg = null avec un avertissement qui la nomme.
 */
import { describe, it, expect } from 'vitest';
import { computeWeightBalance } from '../computeWeightBalance.js';

// Biplace type Cessna 150/152 : aucun bras de siège arrière dans la fiche.
const BIPLACE = {
  registration: 'F-TEST2',
  fuelType: 'AVGAS 100LL',
  weights: { emptyWeight: 527, mtow: 726 },
  weightBalance: {
    emptyWeightArm: 0.854,
    frontLeftSeatArm: 0.94,
    frontRightSeatArm: 0.94,
    fuelArm: 1.07,
    // rearLeftSeatArm / rearRightSeatArm : ABSENTS — l'avion n'a pas de sièges arrière
  },
  cgEnvelope: {
    forwardPoints: [{ weight: 500, cg: 0.79 }, { weight: 726, cg: 0.83 }],
    aftCG: 0.95,
  },
};

// Multi-réservoirs type DR401 : chaque réservoir porte SON bras, aucun bras unique.
const MULTI_RESERVOIRS = {
  registration: 'F-TEST3',
  fuelType: 'AVGAS 100LL',
  weights: { emptyWeight: 620, mtow: 1050 },
  weightBalance: {
    emptyWeightArm: 0.3226,
    frontLeftSeatArm: 0.4037,
    frontRightSeatArm: 0.4037,
    rearLeftSeatArm: 1.1875,
    rearRightSeatArm: 1.1875,
    // fuelArm : ABSENT — le carburant se répartit par réservoir
  },
  additionalFuelTanks: [
    { id: 'p', name: 'Principal', arm: 0.82268, totalCapacity: 110, usableCapacity: 110 },
    { id: 'a', name: 'Aile', arm: 0.337, totalCapacity: 80, usableCapacity: 80 },
  ],
  cgEnvelope: {
    forwardPoints: [{ weight: 620, cg: 0.205 }, { weight: 1050, cg: 0.28 }],
    aftCG: 0.564,
  },
};

describe('Biplace — les sièges arrière n\'existent pas', () => {
  it('charge avant seule → le centrage se calcule (plus de refus global)', () => {
    const r = computeWeightBalance({ aircraft: BIPLACE, loads: { frontLeft: 80, frontRight: 75 } });
    expect(r).not.toBeNull();
    expect(Number.isFinite(r.cg)).toBe(true);
    expect(r.totalWeight).toBe(682);
    // Aucun NaN : une station vide sans bras contribue 0, jamais NaN.
    expect(Number.isNaN(r.totalMoment)).toBe(false);
  });

  it('avion à vide → bilan rendu, pas de refus', () => {
    const r = computeWeightBalance({ aircraft: BIPLACE, loads: {} });
    expect(r).not.toBeNull();
    expect(r.totalWeight).toBe(527);
    expect(r.cg).toBeCloseTo(0.854, 3);
  });

  it('FAIL-CLOSED : une charge posée sur un siège arrière sans bras refuse le centrage', () => {
    const r = computeWeightBalance({ aircraft: BIPLACE, loads: { frontLeft: 80, rearLeft: 70 } });
    expect(r.cg).toBeNull();
    expect(r.isWithinCG).toBeNull();
    expect(r.warnings.some((w) => /Bras de levier manquant.*siège arrière gauche/.test(w))).toBe(true);
  });
});

describe('Multi-réservoirs — pas de bras carburant unique', () => {
  it('répartition par réservoir → le centrage se calcule', () => {
    const r = computeWeightBalance({
      aircraft: MULTI_RESERVOIRS,
      loads: { frontLeft: 80, fuel_p: 50, fuel_a: 30 },
    });
    expect(r).not.toBeNull();
    expect(Number.isFinite(r.cg)).toBe(true);
    // Chaque réservoir pèse à SON bras : 50 L et 30 L d'AVGAS (0,72 kg/L).
    expect(r.totalWeight).toBeCloseTo(620 + 80 + 80 * 0.72, 1);
  });

  it('FAIL-CLOSED : bloc carburant unique sur des réservoirs à bras DIFFÉRENTS → refusé', () => {
    const r = computeWeightBalance({ aircraft: MULTI_RESERVOIRS, loads: { frontLeft: 80, fuel: 60 } });
    expect(r.cg).toBeNull();
    expect(r.warnings.some((w) => /Bras de levier manquant.*carburant/.test(w))).toBe(true);
  });
});

describe('Le refus subsiste là où il doit', () => {
  // La masse à vide est la seule station TOUJOURS chargée : son bras absent
  // refuse le centrage par la voie fine (cg null + station nommée), et non plus
  // par un refus global muet. Le résultat pour le pilote est le même — aucun
  // centrage n'est rendu — mais il sait désormais ce qui manque.
  it('bras de la masse à vide absent → centrage refusé et station nommée', () => {
    const sansBras = { ...BIPLACE, weightBalance: { ...BIPLACE.weightBalance, emptyWeightArm: undefined } };
    const r = computeWeightBalance({ aircraft: sansBras, loads: {} });
    expect(r.cg).toBeNull();
    expect(r.isWithinCG).toBeNull();
    expect(r.warnings.some((w) => /Bras de levier manquant.*masse à vide/.test(w))).toBe(true);
  });

  it('masse à vide non renseignée → refus total (null)', () => {
    const { weights, ...sansMasse } = BIPLACE;
    expect(computeWeightBalance({ aircraft: sansMasse, loads: {} })).toBeNull();
  });
});
