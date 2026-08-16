// TESTS D'OR (caractérisation) — src/utils/armUnits.js
//
// But : figer le comportement ACTUEL du garde-fou d'unités (bras de levier /
// moments) AVANT le déplacement du module vers le paquet autonome (Phase 2).
// Ces tests décrivent ce que le code FAIT aujourd'hui, pas ce qu'il devrait
// faire : les comportements discutables (cm et pouces mal interprétés, double
// normalisation dans le chemin wizard, clés ajoutées à undefined…) sont figés
// TELS QUELS et signalés au rapport, jamais corrigés ici.
//
// Contrat central : heuristique de MAGNITUDE, pas de métadonnée d'unité.
//   - bras   : |x| > 10      → millimètres → ÷1000
//   - moment : |x| > 50 000  → kg·mm       → ÷1000
//   - masses : JAMAIS devinées (kg et lbs indiscernables par magnitude, ANO-11)

import { describe, it, expect } from 'vitest';
import {
  armToMeters,
  momentToKgM,
  normalizeAircraftArmsToMeters,
  normalizeAircraftCgEnvelopeToMeters,
  normalizeAircraftForWizard,
} from '@utils/armUnits';

// ────────────────────────────────────────────────────────────────────────────
// armToMeters
// ────────────────────────────────────────────────────────────────────────────

describe('armToMeters — heuristique de magnitude m/mm (seuil 10)', () => {
  it('cas nominal : bras déjà en mètres (< 10) renvoyé intact', () => {
    expect(armToMeters(2.1)).toBeCloseTo(2.1, 10);
    expect(armToMeters(0.42)).toBeCloseTo(0.42, 10);
    expect(armToMeters(9.999)).toBeCloseTo(9.999, 10);
  });

  it('cas nominal : bras en millimètres (> 10) divisé par 1000', () => {
    expect(armToMeters(805.9)).toBeCloseTo(0.8059, 10);   // F-HFGI fuelMain
    expect(armToMeters(2100)).toBeCloseTo(2.1, 10);
    expect(armToMeters(10000)).toBeCloseTo(10, 10);       // borne haute des mm GA
  });

  it('le seuil est STRICT : 10 reste 10, 10.0001 bascule en mm', () => {
    expect(armToMeters(10)).toBe(10);                     // pas > 10 → intact
    expect(armToMeters(10.0001)).toBeCloseTo(0.0100001, 10);
  });

  it('le seuil porte sur la VALEUR ABSOLUE : les bras négatifs basculent aussi', () => {
    expect(armToMeters(-805.9)).toBeCloseTo(-0.8059, 10);
    expect(armToMeters(-2.1)).toBeCloseTo(-2.1, 10);
    expect(armToMeters(-10)).toBe(-10);
    expect(armToMeters(-10.5)).toBeCloseTo(-0.0105, 10);
  });

  it('zéro et -0 traversent sans conversion', () => {
    expect(armToMeters(0)).toBe(0);
    expect(Object.is(armToMeters(-0), -0)).toBe(true);
  });

  it('chaînes numériques : parseFloat puis même heuristique (retour NUMBER)', () => {
    expect(armToMeters('2.1')).toBe(2.1);
    expect(armToMeters('805.9')).toBeCloseTo(0.8059, 10);
    expect(armToMeters('  2.4  ')).toBe(2.4);             // espaces tolérés
    expect(armToMeters('1e4')).toBe(10);                  // 10000 → 10
  });

  it('parseFloat est PERMISSIF : un suffixe d\'unité est ignoré, pas rejeté', () => {
    expect(armToMeters('805.9mm')).toBeCloseTo(0.8059, 10);
    expect(armToMeters('2.1 m')).toBe(2.1);
    expect(armToMeters('2.1abc')).toBe(2.1);
  });

  it('valeurs non numériques renvoyées TELLES QUELLES (identité, pas 0, pas null)', () => {
    expect(armToMeters(null)).toBeNull();
    expect(armToMeters(undefined)).toBeUndefined();
    expect(armToMeters('')).toBe('');
    expect(armToMeters('   ')).toBe('   ');
    expect(armToMeters('abc')).toBe('abc');
    expect(armToMeters(true)).toBe(true);                 // parseFloat('true') → NaN
    expect(armToMeters(false)).toBe(false);
    const obj = { arm: 2.1 };
    expect(armToMeters(obj)).toBe(obj);                   // même référence
  });

  it('NaN et Infinity : non finis → renvoyés tels quels', () => {
    expect(armToMeters(NaN)).toBeNaN();
    expect(armToMeters(Infinity)).toBe(Infinity);
    expect(armToMeters(-Infinity)).toBe(-Infinity);
    expect(armToMeters('NaN')).toBe('NaN');               // la CHAÎNE, pas NaN
  });

  it('un tableau à 1 élément numérique est converti (coercition parseFloat)', () => {
    // parseFloat([2.5]) === parseFloat('2.5') → comportement figé tel quel.
    expect(armToMeters([2.5])).toBe(2.5);
    expect(armToMeters([2500])).toBeCloseTo(2.5, 10);
    expect(armToMeters([2.5, 3.5])).toBe(2.5);            // '2.5,3.5' → 2.5
  });

  it('IDEMPOTENCE dans la plage GA (m 0.01–10 / mm 300–10000)', () => {
    for (const v of [0.42, 2.1, 9.9, 300, 805.9, 2100, 10000]) {
      const once = armToMeters(v);
      expect(armToMeters(once)).toBeCloseTo(once, 10);
    }
  });

  it('NON idempotent au-delà de 10 000 mm (hors plage GA) — comportement figé', () => {
    // 15 000 mm → 15, qui est encore > 10 → un 2e passage donne 0.015.
    expect(armToMeters(15000)).toBeCloseTo(15, 10);
    expect(armToMeters(armToMeters(15000))).toBeCloseTo(0.015, 10);
  });
});

describe('armToMeters — cm et pouces VOLONTAIREMENT non couverts (ANO-12)', () => {
  it('centimètres > 10 : mal interprétés comme des mm (÷1000 au lieu de ÷100)', () => {
    expect(armToMeters(210)).toBeCloseTo(0.21, 10);       // 210 cm = 2.10 m attendu
    expect(armToMeters(260)).toBeCloseTo(0.26, 10);       // 260 cm = 2.60 m attendu
  });

  it('centimètres <= 10 : laissés tels quels (donc ×100 trop grands)', () => {
    expect(armToMeters(5)).toBe(5);                       // 5 cm = 0.05 m attendu
  });

  it('pouces > 10 : mal interprétés comme des mm', () => {
    expect(armToMeters(82.68)).toBeCloseTo(0.08268, 10);  // 82.68 in = 2.10 m attendu
  });

  it('pouces <= 10 : laissés tels quels', () => {
    expect(armToMeters(8)).toBe(8);                       // 8 in = 0.2032 m attendu
  });
});

// ────────────────────────────────────────────────────────────────────────────
// momentToKgM
// ────────────────────────────────────────────────────────────────────────────

describe('momentToKgM — heuristique de magnitude kg·m / kg·mm (seuil 50 000)', () => {
  it('cas nominal : moment déjà en kg·m (<= 50 000) intact', () => {
    expect(momentToKgM(1260)).toBe(1260);                 // 600 kg × 2.1 m
    expect(momentToKgM(40000)).toBe(40000);
    expect(momentToKgM(50000)).toBe(50000);               // seuil STRICT
  });

  it('cas nominal : moment en kg·mm (> 50 000) divisé par 1000', () => {
    expect(momentToKgM(50001)).toBeCloseTo(50.001, 10);
    expect(momentToKgM(1260000)).toBeCloseTo(1260, 10);
    expect(momentToKgM(10000000)).toBeCloseTo(10000, 10);
  });

  it('seuil sur la valeur absolue (moments négatifs)', () => {
    expect(momentToKgM(-1260)).toBe(-1260);
    expect(momentToKgM(-1260000)).toBeCloseTo(-1260, 10);
  });

  it('seuil DIFFÉRENT de celui des bras : 2100 reste 2100 (pas 2.1)', () => {
    expect(momentToKgM(2100)).toBe(2100);
    expect(armToMeters(2100)).toBeCloseTo(2.1, 10);       // discriminant
  });

  it('zéro, chaînes et valeurs non numériques : même contrat que armToMeters', () => {
    expect(momentToKgM(0)).toBe(0);
    expect(momentToKgM('1260000')).toBeCloseTo(1260, 10);
    expect(momentToKgM('1260')).toBe(1260);
    expect(momentToKgM(null)).toBeNull();
    expect(momentToKgM(undefined)).toBeUndefined();
    expect(momentToKgM('')).toBe('');
    expect(momentToKgM('abc')).toBe('abc');
    expect(momentToKgM(NaN)).toBeNaN();
    expect(momentToKgM(Infinity)).toBe(Infinity);
  });

  it('IDEMPOTENCE dans la plage GA, NON idempotent au-delà de 50 000 000', () => {
    for (const v of [1260, 40000, 1260000, 10000000]) {
      const once = momentToKgM(v);
      expect(momentToKgM(once)).toBeCloseTo(once, 10);
    }
    expect(momentToKgM(60000000)).toBeCloseTo(60000, 10);
    expect(momentToKgM(momentToKgM(60000000))).toBeCloseTo(60, 10); // 2e passage
  });
});

// ────────────────────────────────────────────────────────────────────────────
// normalizeAircraftArmsToMeters
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeAircraftArmsToMeters — entrées dégénérées', () => {
  it('null / undefined / primitives renvoyés tels quels', () => {
    expect(normalizeAircraftArmsToMeters(null)).toBeNull();
    expect(normalizeAircraftArmsToMeters(undefined)).toBeUndefined();
    expect(normalizeAircraftArmsToMeters('F-HFGI')).toBe('F-HFGI');
    expect(normalizeAircraftArmsToMeters(42)).toBe(42);
    expect(normalizeAircraftArmsToMeters(0)).toBe(0);
    expect(normalizeAircraftArmsToMeters(false)).toBe(false);
  });

  it('objet vide → copie (nouvelle référence), pas la même instance', () => {
    const src = {};
    const out = normalizeAircraftArmsToMeters(src);
    expect(out).toEqual({});
    expect(out).not.toBe(src);
  });

  it('un TABLEAU est traité comme un objet → devient un objet indexé', () => {
    // typeof [] === 'object' → { ...[] } : comportement figé tel quel.
    const out = normalizeAircraftArmsToMeters([{ arm: 2100 }]);
    expect(Array.isArray(out)).toBe(false);
    expect(out).toEqual({ 0: { arm: 2100 } });            // arm NON normalisé
  });
});

describe('normalizeAircraftArmsToMeters — weightBalance', () => {
  const AC_MIXTE = {
    registration: 'F-HFGI',
    weightBalance: {
      emptyWeightArm: 2.1,        // déjà en m
      fuelArm: 805.9,             // en mm → 0.8059
      frontLeftSeatArm: 2050,
      frontRightSeatArm: '2050',  // chaîne mm
      rearLeftSeatArm: 3.2,
      rearRightSeatArm: null,
      baggageArm: 0,
      auxiliaryArm: undefined,
      emptyWeight: 620,           // MASSE — jamais devinée
      maxTakeoffWeight: 1157,
    },
  };

  it('les 8 clés de bras sont normalisées, les MASSES ne le sont jamais', () => {
    const out = normalizeAircraftArmsToMeters(AC_MIXTE);
    expect(out.weightBalance.emptyWeightArm).toBeCloseTo(2.1, 10);
    expect(out.weightBalance.fuelArm).toBeCloseTo(0.8059, 10);
    expect(out.weightBalance.frontLeftSeatArm).toBeCloseTo(2.05, 10);
    expect(out.weightBalance.frontRightSeatArm).toBeCloseTo(2.05, 10);
    expect(out.weightBalance.rearLeftSeatArm).toBeCloseTo(3.2, 10);
    expect(out.weightBalance.baggageArm).toBe(0);
    // MASSES intactes malgré une magnitude > 10 (kg vs lbs indiscernables)
    expect(out.weightBalance.emptyWeight).toBe(620);
    expect(out.weightBalance.maxTakeoffWeight).toBe(1157);
    expect(out.registration).toBe('F-HFGI');
  });

  it('null et undefined sont SAUTÉS (pas passés à armToMeters, valeur conservée)', () => {
    const out = normalizeAircraftArmsToMeters(AC_MIXTE);
    expect(out.weightBalance.rearLeftSeatArm).toBeCloseTo(3.2, 10);
    expect(out.weightBalance.rearRightSeatArm).toBeNull();
    expect('auxiliaryArm' in out.weightBalance).toBe(true);
    expect(out.weightBalance.auxiliaryArm).toBeUndefined();
  });

  it('une chaîne vide traverse armToMeters et reste une chaîne vide', () => {
    const out = normalizeAircraftArmsToMeters({ weightBalance: { fuelArm: '' } });
    expect(out.weightBalance.fuelArm).toBe('');
  });

  it('les clés HORS liste ARM_KEYS ne sont PAS normalisées, même en …Arm', () => {
    const out = normalizeAircraftArmsToMeters({
      weightBalance: { fuelMainArm: 805.9, pilotArm: 2050, cgLimits: { forward: 1900 } },
    });
    expect(out.weightBalance.fuelMainArm).toBe(805.9);   // inchangé
    expect(out.weightBalance.pilotArm).toBe(2050);       // inchangé
    expect(out.weightBalance.cgLimits).toEqual({ forward: 1900 }); // hors périmètre
  });

  it('weightBalance non-objet (null / chaîne) laissé intact', () => {
    expect(normalizeAircraftArmsToMeters({ weightBalance: null }).weightBalance).toBeNull();
    expect(normalizeAircraftArmsToMeters({ weightBalance: 'x' }).weightBalance).toBe('x');
  });

  it('IMMUTABILITÉ : la source n\'est jamais mutée, weightBalance est recopié', () => {
    const src = { weightBalance: { fuelArm: 805.9 } };
    const out = normalizeAircraftArmsToMeters(src);
    expect(src.weightBalance.fuelArm).toBe(805.9);        // source intacte
    expect(out.weightBalance).not.toBe(src.weightBalance);
    expect(out).not.toBe(src);
  });

  it('IDEMPOTENCE : un 2e passage ne redivise pas', () => {
    const once = normalizeAircraftArmsToMeters(AC_MIXTE);
    const twice = normalizeAircraftArmsToMeters(once);
    expect(twice).toEqual(once);
  });
});

describe('normalizeAircraftArmsToMeters — réservoirs et soutes', () => {
  it('additionalFuelTanks[].arm normalisé, capacité et masses intactes', () => {
    const out = normalizeAircraftArmsToMeters({
      additionalFuelTanks: [
        { id: 'L', capacity: 60, arm: 2000 },
        { id: 'R', capacity: 40, arm: 2.5 },
      ],
    });
    expect(out.additionalFuelTanks[0].arm).toBeCloseTo(2, 10);
    expect(out.additionalFuelTanks[0].capacity).toBe(60); // pas un bras
    expect(out.additionalFuelTanks[1].arm).toBeCloseTo(2.5, 10);
  });

  it('réservoir SANS arm (ou arm null) : objet renvoyé PAR RÉFÉRENCE (pas de copie)', () => {
    const t1 = { id: 'A', capacity: 60 };
    const t2 = { id: 'B', capacity: 40, arm: null };
    const src = { additionalFuelTanks: [t1, t2, null] };
    const out = normalizeAircraftArmsToMeters(src);
    expect(out.additionalFuelTanks[0]).toBe(t1);
    expect(out.additionalFuelTanks[1]).toBe(t2);
    expect(out.additionalFuelTanks[2]).toBeNull();        // entrée nulle conservée
    expect(out.additionalFuelTanks).not.toBe(src.additionalFuelTanks); // tableau recopié
  });

  it('baggageCompartments[].arm normalisé, maxWeight/momentMax intacts', () => {
    const out = normalizeAircraftArmsToMeters({
      baggageCompartments: [{ id: 'B1', arm: 3200, maxWeight: 40, momentMax: 128000 }],
    });
    expect(out.baggageCompartments[0].arm).toBeCloseTo(3.2, 10);
    expect(out.baggageCompartments[0].maxWeight).toBe(40);
    expect(out.baggageCompartments[0].momentMax).toBe(128000); // hors périmètre ici
  });

  it('additionalFuelTanks non-tableau : laissé intact (pas de crash)', () => {
    const out = normalizeAircraftArmsToMeters({ additionalFuelTanks: { a: 1 } });
    expect(out.additionalFuelTanks).toEqual({ a: 1 });
  });
});

describe('normalizeAircraftArmsToMeters — armLengths (forme historique)', () => {
  it('TOUTES les clés d\'armLengths sont normalisées, sans liste blanche', () => {
    const out = normalizeAircraftArmsToMeters({
      armLengths: { emptyMassArm: 2100, fuelArm: 805.9, frontSeat1Arm: 2.05, unknownArm: null },
    });
    expect(out.armLengths.emptyMassArm).toBeCloseTo(2.1, 10);
    expect(out.armLengths.fuelArm).toBeCloseTo(0.8059, 10);
    expect(out.armLengths.frontSeat1Arm).toBeCloseTo(2.05, 10);
    expect(out.armLengths.unknownArm).toBeNull();
  });

  it('une clé NON-bras glissée dans armLengths est quand même divisée (piège figé)', () => {
    const out = normalizeAircraftArmsToMeters({ armLengths: { emptyMass: 620 } });
    expect(out.armLengths.emptyMass).toBeCloseTo(0.62, 10); // masse détruite
  });

  it('valeurs non numériques d\'armLengths conservées telles quelles', () => {
    const out = normalizeAircraftArmsToMeters({ armLengths: { unit: 'mm', empty: '' } });
    expect(out.armLengths.unit).toBe('mm');
    expect(out.armLengths.empty).toBe('');
  });
});

describe('normalizeAircraftArmsToMeters — ne touche NI l\'enveloppe NI les cgLimits', () => {
  it('cgEnvelope et cgLimits traversent inchangés (même référence)', () => {
    const cgEnvelope = { aftCG: 2600, forwardPoints: [{ weight: 600, cg: 2050 }] };
    const cgLimits = { forward: 1900, aft: 2600 };
    const out = normalizeAircraftArmsToMeters({ cgEnvelope, cgLimits });
    expect(out.cgEnvelope).toBe(cgEnvelope);
    expect(out.cgLimits).toBe(cgLimits);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// normalizeAircraftCgEnvelopeToMeters
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeAircraftCgEnvelopeToMeters — entrées dégénérées', () => {
  it('null / undefined / primitives renvoyés tels quels', () => {
    expect(normalizeAircraftCgEnvelopeToMeters(null)).toBeNull();
    expect(normalizeAircraftCgEnvelopeToMeters(undefined)).toBeUndefined();
    expect(normalizeAircraftCgEnvelopeToMeters('x')).toBe('x');
    expect(normalizeAircraftCgEnvelopeToMeters(7)).toBe(7);
  });

  it('avion sans enveloppe ni limites → copie superficielle inchangée', () => {
    const src = { registration: 'F-GXYZ', weightBalance: { emptyWeightArm: 2.1 } };
    const out = normalizeAircraftCgEnvelopeToMeters(src);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
    expect(out.weightBalance).toBe(src.weightBalance);    // non recopié ici
  });
});

describe('normalizeAircraftCgEnvelopeToMeters — cgEnvelope', () => {
  const ENV_MM = {
    cgEnvelope: {
      aftCG: 2600,
      aftMinCG: 2300,
      aftMaxCG: 2600,
      forwardCG: 1900,
      aftMinWeight: 600,          // MASSE
      aftMaxWeight: 1100,         // MASSE
      macLength: 1500,            // NON traité par cette fonction
      lemac: 2000,                // NON traité par cette fonction
      forwardPoints: [{ weight: 600, cg: 2050 }, { weight: 1000, cg: 1950 }],
      intermediatePoints: [{ weight: 800, cg: 2000, moment: 1600000 }],
    },
  };

  it('les 4 clés de CG sont converties, les MASSES restent intactes', () => {
    const out = normalizeAircraftCgEnvelopeToMeters(ENV_MM);
    expect(out.cgEnvelope.aftCG).toBeCloseTo(2.6, 10);
    expect(out.cgEnvelope.aftMinCG).toBeCloseTo(2.3, 10);
    expect(out.cgEnvelope.aftMaxCG).toBeCloseTo(2.6, 10);
    expect(out.cgEnvelope.forwardCG).toBeCloseTo(1.9, 10);
    expect(out.cgEnvelope.aftMinWeight).toBe(600);
    expect(out.cgEnvelope.aftMaxWeight).toBe(1100);
  });

  it('macLength et lemac NE SONT PAS convertis par cette fonction', () => {
    const out = normalizeAircraftCgEnvelopeToMeters(ENV_MM);
    expect(out.cgEnvelope.macLength).toBe(1500);
    expect(out.cgEnvelope.lemac).toBe(2000);
  });

  it('points : cg converti, weight et moment NON touchés', () => {
    const out = normalizeAircraftCgEnvelopeToMeters(ENV_MM);
    expect(out.cgEnvelope.forwardPoints[0].cg).toBeCloseTo(2.05, 10);
    expect(out.cgEnvelope.forwardPoints[0].weight).toBe(600);
    expect(out.cgEnvelope.forwardPoints[1].cg).toBeCloseTo(1.95, 10);
    expect(out.cgEnvelope.intermediatePoints[0].cg).toBeCloseTo(2, 10);
    expect(out.cgEnvelope.intermediatePoints[0].moment).toBe(1600000); // hors périmètre
  });

  it('point sans cg (undefined / null / chaîne vide) renvoyé PAR RÉFÉRENCE', () => {
    const p1 = { weight: 600 };
    const p2 = { weight: 700, cg: null };
    const p3 = { weight: 800, cg: '' };
    const out = normalizeAircraftCgEnvelopeToMeters({ cgEnvelope: { forwardPoints: [p1, p2, p3, null] } });
    expect(out.cgEnvelope.forwardPoints[0]).toBe(p1);
    expect(out.cgEnvelope.forwardPoints[1]).toBe(p2);
    expect(out.cgEnvelope.forwardPoints[2]).toBe(p3);
    expect(out.cgEnvelope.forwardPoints[3]).toBeNull();
  });

  it('les clés forwardPoints/intermediatePoints sont AJOUTÉES (à undefined) si absentes', () => {
    const out = normalizeAircraftCgEnvelopeToMeters({ cgEnvelope: { aftCG: 2600 } });
    expect('forwardPoints' in out.cgEnvelope).toBe(true);
    expect('intermediatePoints' in out.cgEnvelope).toBe(true);
    expect(out.cgEnvelope.forwardPoints).toBeUndefined();
    expect(out.cgEnvelope.intermediatePoints).toBeUndefined();
    expect(Object.keys(out.cgEnvelope).sort()).toEqual(['aftCG', 'forwardPoints', 'intermediatePoints']);
  });

  it('points non-tableau : valeur conservée telle quelle', () => {
    const out = normalizeAircraftCgEnvelopeToMeters({ cgEnvelope: { forwardPoints: 'n/a' } });
    expect(out.cgEnvelope.forwardPoints).toBe('n/a');
  });

  it('cgEnvelope déjà en mètres : aucun changement (idempotence)', () => {
    const src = { cgEnvelope: { aftCG: 2.6, forwardCG: 1.9, forwardPoints: [{ weight: 600, cg: 2.05 }] } };
    const once = normalizeAircraftCgEnvelopeToMeters(src);
    expect(once.cgEnvelope.aftCG).toBeCloseTo(2.6, 10);
    expect(once.cgEnvelope.forwardPoints[0].cg).toBeCloseTo(2.05, 10);
    expect(normalizeAircraftCgEnvelopeToMeters(once)).toEqual(once);
  });
});

describe('normalizeAircraftCgEnvelopeToMeters — cgLimits (racine et weightBalance)', () => {
  it('cgLimits.forward / .aft convertis, autres clés conservées', () => {
    const out = normalizeAircraftCgEnvelopeToMeters({
      cgLimits: { forward: 1900, aft: 2600, source: 'POH', maxWeight: 1157 },
    });
    expect(out.cgLimits.forward).toBeCloseTo(1.9, 10);
    expect(out.cgLimits.aft).toBeCloseTo(2.6, 10);
    expect(out.cgLimits.source).toBe('POH');
    expect(out.cgLimits.maxWeight).toBe(1157);            // masse intacte
  });

  it('cgLimits.forwardVariable : cg des points converti', () => {
    const out = normalizeAircraftCgEnvelopeToMeters({
      cgLimits: { forward: 1900, forwardVariable: [{ weight: 600, cg: 2050 }] },
    });
    expect(out.cgLimits.forwardVariable[0].cg).toBeCloseTo(2.05, 10);
    expect(out.cgLimits.forwardVariable[0].weight).toBe(600);
  });

  it('weightBalance.cgLimits converti, le reste de weightBalance intact', () => {
    const out = normalizeAircraftCgEnvelopeToMeters({
      weightBalance: { emptyWeightArm: 2100, emptyWeight: 620, cgLimits: { forward: 1900, aft: 2600 } },
    });
    expect(out.weightBalance.cgLimits.forward).toBeCloseTo(1.9, 10);
    expect(out.weightBalance.cgLimits.aft).toBeCloseTo(2.6, 10);
    // Cette fonction ne normalise PAS les bras : emptyWeightArm reste en mm.
    expect(out.weightBalance.emptyWeightArm).toBe(2100);
    expect(out.weightBalance.emptyWeight).toBe(620);
  });

  it('valeurs vides / nulles de cgLimits sautées', () => {
    const out = normalizeAircraftCgEnvelopeToMeters({ cgLimits: { forward: '', aft: null } });
    expect(out.cgLimits.forward).toBe('');
    expect(out.cgLimits.aft).toBeNull();
  });

  it('cgLimits non-objet laissé tel quel', () => {
    expect(normalizeAircraftCgEnvelopeToMeters({ cgLimits: 'n/a' }).cgLimits).toBe('n/a');
  });

  it('IMMUTABILITÉ : la source reste en millimètres', () => {
    const src = { cgEnvelope: { aftCG: 2600, forwardPoints: [{ weight: 600, cg: 2050 }] } };
    normalizeAircraftCgEnvelopeToMeters(src);
    expect(src.cgEnvelope.aftCG).toBe(2600);
    expect(src.cgEnvelope.forwardPoints[0].cg).toBe(2050);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// normalizeAircraftForWizard
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeAircraftForWizard — entrées dégénérées', () => {
  it('null / undefined / primitives renvoyés tels quels', () => {
    expect(normalizeAircraftForWizard(null)).toBeNull();
    expect(normalizeAircraftForWizard(undefined)).toBeUndefined();
    expect(normalizeAircraftForWizard('x')).toBe('x');
    expect(normalizeAircraftForWizard(0)).toBe(0);
  });
});

describe('normalizeAircraftForWizard — forme moteur héritée de normalizeAircraftArmsToMeters', () => {
  it('weightBalance et armLengths sont normalisés comme dans la fonction moteur', () => {
    const out = normalizeAircraftForWizard({
      weightBalance: { emptyWeightArm: 2100, fuelArm: 805.9, emptyWeight: 620 },
      armLengths: { emptyMassArm: 2100 },
    });
    expect(out.weightBalance.emptyWeightArm).toBeCloseTo(2.1, 10);
    expect(out.weightBalance.fuelArm).toBeCloseTo(0.8059, 10);
    expect(out.weightBalance.emptyWeight).toBe(620);
    expect(out.armLengths.emptyMassArm).toBeCloseTo(2.1, 10);
  });
});

describe('normalizeAircraftForWizard — forme wizard (arms / moments / cgLimits)', () => {
  it('arms : toutes les clés via armToMeters', () => {
    const out = normalizeAircraftForWizard({
      arms: { fuelMain: 805.9, emptyMass: 2.1, frontSeat1: 2050, rearSeat1: null, baggage: '' },
    });
    expect(out.arms.fuelMain).toBeCloseTo(0.8059, 10);
    expect(out.arms.emptyMass).toBeCloseTo(2.1, 10);
    expect(out.arms.frontSeat1).toBeCloseTo(2.05, 10);
    expect(out.arms.rearSeat1).toBeNull();
    expect(out.arms.baggage).toBe('');
  });

  it('moments : toutes les clés via momentToKgM (seuil 50 000, PAS 10)', () => {
    const out = normalizeAircraftForWizard({
      moments: { emptyMass: 1302000, fuelMain: 1260, aux: 0 },
    });
    expect(out.moments.emptyMass).toBeCloseTo(1302, 10);
    expect(out.moments.fuelMain).toBe(1260);              // resterait 1.26 avec armToMeters
    expect(out.moments.aux).toBe(0);
  });

  it('cgLimits : toutes les clés via armToMeters (y compris hors forward/aft)', () => {
    const out = normalizeAircraftForWizard({
      cgLimits: { forward: 1900, aft: 2600, maxWeight: 1157, note: 'POH' },
    });
    expect(out.cgLimits.forward).toBeCloseTo(1.9, 10);
    expect(out.cgLimits.aft).toBeCloseTo(2.6, 10);
    expect(out.cgLimits.maxWeight).toBeCloseTo(1.157, 10); // masse détruite (comportement figé)
    expect(out.cgLimits.note).toBe('POH');
  });

  it('cgLimits.forwardVariable (tableau) traverse armToMeters SANS être normalisé', () => {
    const fv = [{ weight: 600, cg: 2050 }];
    const out = normalizeAircraftForWizard({ cgLimits: { forward: 1900, forwardVariable: fv } });
    expect(out.cgLimits.forwardVariable).toBe(fv);         // même référence, cg en mm
    expect(out.cgLimits.forwardVariable[0].cg).toBe(2050);
  });

  it('les MASSES du wizard ne sont jamais devinées (masses/emptyWeight intacts)', () => {
    const out = normalizeAircraftForWizard({
      masses: { emptyMass: 620, maxTakeoff: 1157 },
      emptyWeight: 1367,                                  // valeur en lbs : NON convertie
    });
    expect(out.masses).toEqual({ emptyMass: 620, maxTakeoff: 1157 });
    expect(out.emptyWeight).toBe(1367);
  });
});

describe('normalizeAircraftForWizard — sièges, soutes, réservoirs', () => {
  it('additionalSeats[].arm normalisé une seule fois (hors périmètre moteur)', () => {
    const out = normalizeAircraftForWizard({
      additionalSeats: [{ id: 'S1', arm: 3200 }, { id: 'S2' }, { id: 'S3', arm: '' }, null],
    });
    expect(out.additionalSeats[0].arm).toBeCloseTo(3.2, 10);
    expect(out.additionalSeats[1]).toEqual({ id: 'S2' });
    expect(out.additionalSeats[2].arm).toBe('');
    expect(out.additionalSeats[3]).toBeNull();
  });

  it('baggageCompartments : arm en m, momentMax en kg·m', () => {
    const out = normalizeAircraftForWizard({
      baggageCompartments: [{ id: 'B1', arm: 3200, momentMax: 128000, maxWeight: 40 }],
    });
    expect(out.baggageCompartments[0].arm).toBeCloseTo(3.2, 10);
    expect(out.baggageCompartments[0].momentMax).toBeCloseTo(128, 10);
    expect(out.baggageCompartments[0].maxWeight).toBe(40);
  });

  it('additionalFuelTanks : arm en m, momentAtFull en kg·m, capacité intacte', () => {
    const out = normalizeAircraftForWizard({
      additionalFuelTanks: [{ id: 'L', capacity: 60, arm: 2000, momentAtFull: 86400 }],
    });
    expect(out.additionalFuelTanks[0].arm).toBeCloseTo(2, 10);
    expect(out.additionalFuelTanks[0].momentAtFull).toBeCloseTo(86.4, 10);
    expect(out.additionalFuelTanks[0].capacity).toBe(60);
  });

  it('DOUBLE normalisation des bras réservoirs/soutes hors plage GA (> 10 000 mm)', () => {
    // normalizeAircraftArmsToMeters divise déjà, puis la passe wizard redivise.
    const out = normalizeAircraftForWizard({
      additionalFuelTanks: [{ arm: 12000 }],
      baggageCompartments: [{ arm: 12000 }],
      additionalSeats: [{ arm: 12000 }],   // une seule passe : pas de moteur en amont
    });
    expect(out.additionalFuelTanks[0].arm).toBeCloseTo(0.012, 10); // 12000 → 12 → 0.012
    expect(out.baggageCompartments[0].arm).toBeCloseTo(0.012, 10);
    expect(out.additionalSeats[0].arm).toBeCloseTo(12, 10);        // 12000 → 12
  });

  it('un tableau attendu mais fourni comme OBJET fait LEVER une TypeError', () => {
    // Comportement figé tel quel : `.map` n'existe pas sur un objet simple.
    expect(() => normalizeAircraftForWizard({ baggageCompartments: {} })).toThrow(TypeError);
    expect(() => normalizeAircraftForWizard({ additionalSeats: {} })).toThrow(TypeError);
    expect(() => normalizeAircraftForWizard({ additionalFuelTanks: {} })).toThrow(TypeError);
  });
});

describe('normalizeAircraftForWizard — cgEnvelope', () => {
  const AC = {
    cgEnvelope: {
      aftCG: 2600, aftMinCG: 2300, aftMaxCG: 2600, forwardCG: 1900,
      macLength: 1500, lemac: 2000,
      aftMinMoment: 1380000, aftMaxMoment: 2860000,
      aftMinWeight: 600, aftMaxWeight: 1100,
      forwardPoints: [{ weight: 600, cg: 2050, moment: 1230000 }],
      intermediatePoints: [{ weight: 800, cg: 2000 }],
    },
  };

  it('CG + macLength + lemac convertis en mètres (contrairement à la fonction moteur)', () => {
    const out = normalizeAircraftForWizard(AC);
    expect(out.cgEnvelope.aftCG).toBeCloseTo(2.6, 10);
    expect(out.cgEnvelope.aftMinCG).toBeCloseTo(2.3, 10);
    expect(out.cgEnvelope.aftMaxCG).toBeCloseTo(2.6, 10);
    expect(out.cgEnvelope.forwardCG).toBeCloseTo(1.9, 10);
    expect(out.cgEnvelope.macLength).toBeCloseTo(1.5, 10);
    expect(out.cgEnvelope.lemac).toBeCloseTo(2, 10);
  });

  it('moments d\'enveloppe convertis en kg·m, masses intactes', () => {
    const out = normalizeAircraftForWizard(AC);
    expect(out.cgEnvelope.aftMinMoment).toBeCloseTo(1380, 10);
    expect(out.cgEnvelope.aftMaxMoment).toBeCloseTo(2860, 10);
    expect(out.cgEnvelope.aftMinWeight).toBe(600);
    expect(out.cgEnvelope.aftMaxWeight).toBe(1100);
  });

  it('points : cg via armToMeters ET moment via momentToKgM, weight intact', () => {
    const out = normalizeAircraftForWizard(AC);
    expect(out.cgEnvelope.forwardPoints[0].cg).toBeCloseTo(2.05, 10);
    expect(out.cgEnvelope.forwardPoints[0].moment).toBeCloseTo(1230, 10);
    expect(out.cgEnvelope.forwardPoints[0].weight).toBe(600);
    expect(out.cgEnvelope.intermediatePoints[0].cg).toBeCloseTo(2, 10);
  });

  it('points non-tableau : AUCUNE clé ajoutée (contrairement à la fonction moteur)', () => {
    const out = normalizeAircraftForWizard({ cgEnvelope: { aftCG: 2600 } });
    expect(Object.keys(out.cgEnvelope)).toEqual(['aftCG']);
    expect('forwardPoints' in out.cgEnvelope).toBe(false);
  });

  it('weightBalance.cgLimits N\'EST PAS normalisé par le chemin wizard', () => {
    const out = normalizeAircraftForWizard({
      weightBalance: { emptyWeightArm: 2100, cgLimits: { forward: 1900, aft: 2600 } },
    });
    expect(out.weightBalance.emptyWeightArm).toBeCloseTo(2.1, 10);
    expect(out.weightBalance.cgLimits).toEqual({ forward: 1900, aft: 2600 }); // en mm
  });
});

describe('normalizeAircraftForWizard — immutabilité et idempotence', () => {
  const AC_COMPLET = {
    registration: 'F-HFGI',
    weightBalance: { emptyWeightArm: 2.1, fuelArm: 805.9, emptyWeight: 620 },
    arms: { fuelMain: 805.9, emptyMass: 2.1 },
    moments: { emptyMass: 1302000 },
    cgLimits: { forward: 1900, aft: 2600 },
    additionalFuelTanks: [{ id: 'L', capacity: 60, arm: 2000, momentAtFull: 86400 }],
    baggageCompartments: [{ id: 'B1', arm: 3200, momentMax: 128000 }],
    additionalSeats: [{ id: 'S1', arm: 3200 }],
    cgEnvelope: {
      aftCG: 2600, forwardCG: 1900,
      forwardPoints: [{ weight: 600, cg: 2050, moment: 1230000 }],
      intermediatePoints: [],
    },
  };

  it('la source n\'est jamais mutée (tous les niveaux)', () => {
    const snapshot = JSON.parse(JSON.stringify(AC_COMPLET));
    normalizeAircraftForWizard(AC_COMPLET);
    expect(AC_COMPLET).toEqual(snapshot);
  });

  it('IDEMPOTENCE sur un avion complet en plage GA', () => {
    const once = normalizeAircraftForWizard(AC_COMPLET);
    const twice = normalizeAircraftForWizard(once);
    expect(twice).toEqual(once);
  });

  it('normalisation complète : valeurs numériques EXACTES figées', () => {
    const out = normalizeAircraftForWizard(AC_COMPLET);
    expect(out.registration).toBe('F-HFGI');
    expect(out.weightBalance.emptyWeightArm).toBeCloseTo(2.1, 10);
    expect(out.weightBalance.fuelArm).toBeCloseTo(0.8059, 10);
    expect(out.weightBalance.emptyWeight).toBe(620);
    expect(out.arms.fuelMain).toBeCloseTo(0.8059, 10);
    expect(out.arms.emptyMass).toBeCloseTo(2.1, 10);
    expect(out.moments.emptyMass).toBeCloseTo(1302, 10);
    expect(out.cgLimits.forward).toBeCloseTo(1.9, 10);
    expect(out.cgLimits.aft).toBeCloseTo(2.6, 10);
    expect(out.additionalFuelTanks[0].arm).toBeCloseTo(2, 10);
    expect(out.additionalFuelTanks[0].momentAtFull).toBeCloseTo(86.4, 10);
    expect(out.baggageCompartments[0].arm).toBeCloseTo(3.2, 10);
    expect(out.baggageCompartments[0].momentMax).toBeCloseTo(128, 10);
    expect(out.additionalSeats[0].arm).toBeCloseTo(3.2, 10);
    expect(out.cgEnvelope.aftCG).toBeCloseTo(2.6, 10);
    expect(out.cgEnvelope.forwardCG).toBeCloseTo(1.9, 10);
    expect(out.cgEnvelope.forwardPoints[0].cg).toBeCloseTo(2.05, 10);
    expect(out.cgEnvelope.forwardPoints[0].moment).toBeCloseTo(1230, 10);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Scénario de régression réel (ANO-12 / F-HFGI) — données mixtes m + mm
// ────────────────────────────────────────────────────────────────────────────

describe('scénario F-HFGI — données mixtes (bras en m, fuelArm en mm)', () => {
  it('le moment carburant retrouve le bon ordre de grandeur après normalisation', () => {
    const src = {
      registration: 'F-HFGI',
      weightBalance: { emptyWeightArm: 2.1, fuelArm: 805.9, emptyWeight: 620 },
    };
    const out = normalizeAircraftArmsToMeters(src);
    const fuelKg = 72;
    expect(fuelKg * out.weightBalance.fuelArm).toBeCloseTo(58.0248, 6); // et non 58 024.8
    expect(out.weightBalance.emptyWeightArm).toBeCloseTo(2.1, 10);      // intact
  });
});
