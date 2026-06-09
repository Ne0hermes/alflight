// Phase 1 — Fondation du Studio Centrogramme : adaptateur centrogramme ⇄ avion.
import { describe, it, expect } from 'vitest';
import {
  deriveArm,
  deriveArmAssignments,
  buildCgEnvelope,
  centrogramToAircraft,
  applyArmAssignments,
  aircraftToCentrogramScaffold,
  ELEMENT_TYPES,
  __test__,
} from '@features/aircraft/utils/centrogramAdapter';
import { cgLimitsAtMass, isWithinEnvelope } from '@utils/cgEnvelope';

describe('deriveArm — bras de levier (sortie en mètres)', () => {
  it('valeur unique en mètres', () => {
    const r = deriveArm({ singleValue: true, value: 2.1, armUnit: 'm' });
    expect(r.arm).toBeCloseTo(2.1, 6);
    expect(r.source).toBe('single');
  });
  it('valeur unique en mm → convertie en m', () => {
    const r = deriveArm({ singleValue: true, value: 2100, armUnit: 'mm' });
    expect(r.arm).toBeCloseTo(2.1, 6);
  });
  it('valeur unique en cm → convertie en m', () => {
    const r = deriveArm({ singleValue: true, value: 210, armUnit: 'cm' });
    expect(r.arm).toBeCloseTo(2.1, 6);
  });
  it('régression : pente = bras (moment = masse × bras)', () => {
    // y = 2.1 x  → pente 2.1 m. Points parfaitement alignés ⇒ r2 = 1.
    const points = [{ x: 0, y: 0 }, { x: 100, y: 210 }, { x: 200, y: 420 }];
    const r = deriveArm({ points, armUnit: 'm' });
    expect(r.arm).toBeCloseTo(2.1, 6);
    expect(r.r2).toBeCloseTo(1, 6);
    expect(r.source).toBe('regression');
  });
  it('régression avec offset b (moment cumulé) — la pente reste le bras', () => {
    // y = 1.5 x + 500 → bras 1.5 m, offset ignoré.
    const points = [{ x: 0, y: 500 }, { x: 100, y: 650 }, { x: 200, y: 800 }];
    expect(deriveArm({ points, armUnit: 'm' }).arm).toBeCloseTo(1.5, 6);
  });
  it('pente en cm·kg/kg → bras converti en m', () => {
    // y en cm·kg : y = 150 x (cm). pente 150 cm = 1.5 m.
    const points = [{ x: 0, y: 0 }, { x: 10, y: 1500 }];
    expect(deriveArm({ points, armUnit: 'cm' }).arm).toBeCloseTo(1.5, 6);
  });
  it('points insuffisants → invalide', () => {
    expect(deriveArm({ points: [{ x: 1, y: 2 }] }).arm).toBeNull();
    expect(deriveArm({ points: [] }).source).toBe('invalid');
  });
});

describe('deriveArmAssignments — affectations vers chemins avion', () => {
  const doc = {
    units: { arm: 'm' },
    elements: [
      { aircraftPath: 'arms.empty', type: ELEMENT_TYPES.EMPTY, singleValue: true, value: 2.0 },
      { aircraftPath: 'arms.frontSeats', type: ELEMENT_TYPES.FRONT_SEATS, points: [{ x: 0, y: 0 }, { x: 100, y: 180 }] },
      { aircraftPath: 'additionalFuelTanks[0].arm', type: ELEMENT_TYPES.MAIN_TANK, points: [{ x: 0, y: 0 }, { x: 100, y: 220 }] },
      { type: ELEMENT_TYPES.REAR_SEATS, points: [{ x: 0, y: 0 }, { x: 100, y: 250 }] }, // pas de path → warning
    ],
  };
  it('mappe chaque élément valide vers {path, value(m)}', () => {
    const { assignments, warnings } = deriveArmAssignments(doc);
    expect(assignments).toHaveLength(3);
    expect(assignments[0]).toMatchObject({ path: 'arms.empty', value: 2.0 });
    expect(assignments[1]).toMatchObject({ path: 'arms.frontSeats', value: 1.8 });
    expect(assignments[2]).toMatchObject({ path: 'additionalFuelTanks[0].arm', value: 2.2 });
    expect(warnings.some((w) => /aircraftPath/.test(w))).toBe(true);
  });
});

describe('buildCgEnvelope — format canonique cgEnvelope (CG en mètres)', () => {
  const envelope = {
    cgUnit: 'm',
    categories: [
      {
        name: 'normal',
        forwardPoints: [{ weight: 600, cg: 1.90 }, { weight: 1100, cg: 1.95 }],
        aftPoints: [{ weight: 600, cg: 2.30 }, { weight: 1100, cg: 2.55 }],
        maxWeight: 1100,
      },
    ],
    mac: { macLength: 1.4, lemac: 1.2 },
  };

  it('produit forwardPoints + aftPoints triés + modèle 2-points + mac', () => {
    const { cgEnvelope } = buildCgEnvelope(envelope);
    expect(cgEnvelope.forwardPoints).toHaveLength(2);
    expect(cgEnvelope.aftPoints).toHaveLength(2);
    expect(cgEnvelope.aftMinWeight).toBe(600);
    expect(cgEnvelope.aftMaxWeight).toBe(1100);
    expect(cgEnvelope.aftMaxCG).toBeCloseTo(2.55, 6);
    expect(cgEnvelope.aftCG).toBeCloseTo(2.55, 6); // legacy = aftMax
    expect(cgEnvelope.macLength).toBeCloseTo(1.4, 6);
    expect(cgEnvelope.lemac).toBeCloseTo(1.2, 6);
  });

  it('convertit les CG en mètres si la catégorie est en cm', () => {
    const envCm = {
      categories: [{
        name: 'normal',
        forwardPoints: [{ weight: 600, cg: 190 }], // cm
        aftPoints: [{ weight: 600, cg: 230 }],
        cgUnit: 'cm',
      }],
    };
    const { cgEnvelope } = buildCgEnvelope(envCm);
    expect(cgEnvelope.forwardPoints[0].cg).toBeCloseTo(1.90, 6);
    expect(cgEnvelope.aftPoints[0].cg).toBeCloseTo(2.30, 6);
  });

  it('catégorie principale = Normal quand Normal + Utility coexistent', () => {
    const dual = {
      cgUnit: 'm',
      categories: [
        { name: 'Utility', forwardPoints: [{ weight: 600, cg: 1.8 }], aftPoints: [{ weight: 600, cg: 2.1 }] },
        { name: 'Normal', forwardPoints: [{ weight: 600, cg: 1.9 }], aftPoints: [{ weight: 600, cg: 2.3 }] },
      ],
    };
    const { cgEnvelope } = buildCgEnvelope(dual);
    expect(cgEnvelope.forwardPoints[0].cg).toBeCloseTo(1.9, 6); // celle de Normal
    expect(Object.keys(cgEnvelope.categories)).toEqual(expect.arrayContaining(['Utility', 'Normal']));
  });

  it('aucune catégorie → null + warning', () => {
    const { cgEnvelope, warnings } = buildCgEnvelope({ categories: [] });
    expect(cgEnvelope).toBeNull();
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('intégration — buildCgEnvelope alimente le moteur cgLimitsAtMass', () => {
  it('le cgEnvelope produit est interprété correctement par le moteur W&B', () => {
    const { cgEnvelope } = buildCgEnvelope({
      cgUnit: 'm',
      categories: [{
        name: 'normal',
        forwardPoints: [{ weight: 600, cg: 2.05 }, { weight: 1000, cg: 1.95 }],
        aftPoints: [{ weight: 600, cg: 2.30 }, { weight: 1000, cg: 2.60 }],
      }],
    });
    // Limite avant interpolée à 800 kg = milieu = 2.00
    expect(cgLimitsAtMass(cgEnvelope, 800).forward).toBeCloseTo(2.00, 6);
    // Limite arrière interpolée à 800 kg = milieu = 2.45
    expect(cgLimitsAtMass(cgEnvelope, 800).aft).toBeCloseTo(2.45, 6);
    // Un CG de 2.20 à 800 kg est DANS l'enveloppe ; 2.50 est en dehors (arrière).
    expect(isWithinEnvelope(cgEnvelope, 800, 2.20)).toBe(true);
    expect(isWithinEnvelope(cgEnvelope, 800, 2.50)).toBe(false);
  });
});

describe('centrogramToAircraft + applyArmAssignments — patch avion complet', () => {
  const doc = {
    units: { arm: 'm' },
    elements: [
      { aircraftPath: 'arms.empty', singleValue: true, value: 2.0 },
      { aircraftPath: 'arms.frontSeats', points: [{ x: 0, y: 0 }, { x: 100, y: 180 }] },
      { aircraftPath: 'additionalFuelTanks[0].arm', points: [{ x: 0, y: 0 }, { x: 100, y: 220 }] },
    ],
    envelope: {
      cgUnit: 'm',
      categories: [{
        name: 'normal',
        forwardPoints: [{ weight: 600, cg: 1.9 }],
        aftPoints: [{ weight: 600, cg: 2.3 }, { weight: 1100, cg: 2.5 }],
      }],
    },
  };

  it('produit armAssignments + cgEnvelope', () => {
    const { armAssignments, cgEnvelope, warnings } = centrogramToAircraft(doc);
    expect(armAssignments).toHaveLength(3);
    expect(cgEnvelope.forwardPoints[0].cg).toBeCloseTo(1.9, 6);
    expect(warnings).toEqual([]);
  });

  it('applyArmAssignments pose les valeurs aux bons chemins (dont tableau)', () => {
    const { armAssignments } = centrogramToAircraft(doc);
    const patched = applyArmAssignments({}, armAssignments);
    expect(patched.arms.empty).toBe(2.0);
    expect(patched.arms.frontSeats).toBeCloseTo(1.8, 6);
    expect(patched.additionalFuelTanks[0].arm).toBeCloseTo(2.2, 6);
  });
});

describe('aircraftToCentrogramScaffold — pont inverse (ré-édition)', () => {
  it('reconstruit l’enveloppe depuis aftPoints', () => {
    const aircraft = { cgEnvelope: {
      forwardPoints: [{ weight: 600, cg: 1.9 }],
      aftPoints: [{ weight: 600, cg: 2.3 }, { weight: 1100, cg: 2.5 }],
    }};
    const doc = aircraftToCentrogramScaffold(aircraft);
    const cat = doc.envelope.categories[0];
    expect(cat.forwardPoints).toHaveLength(1);
    expect(cat.aftPoints).toHaveLength(2);
  });
  it('reconstruit l’enveloppe depuis le modèle 2-points si aftPoints absent', () => {
    const aircraft = { cgEnvelope: {
      forwardPoints: [{ weight: 600, cg: 1.9 }],
      aftMinWeight: 600, aftMinCG: 2.3, aftMaxWeight: 1100, aftMaxCG: 2.5,
    }};
    const doc = aircraftToCentrogramScaffold(aircraft);
    expect(doc.envelope.categories[0].aftPoints).toHaveLength(2);
  });
  it('avion sans enveloppe → catégories vides', () => {
    const doc = aircraftToCentrogramScaffold({});
    expect(doc.envelope.categories).toEqual([]);
  });
});

describe('setByPath (helper)', () => {
  it('gère a.b et a[i].b', () => {
    const o = {};
    __test__.setByPath(o, 'arms.empty', 2.0);
    __test__.setByPath(o, 'additionalFuelTanks[1].arm', 3.3);
    expect(o.arms.empty).toBe(2.0);
    expect(o.additionalFuelTanks[1].arm).toBe(3.3);
  });
});
