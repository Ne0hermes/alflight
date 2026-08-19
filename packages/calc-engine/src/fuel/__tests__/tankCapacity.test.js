// packages/calc-engine/src/fuel/__tests__/tankCapacity.test.js
//
// ⛽ Deux contenances par réservoir (17/08/2026, validé par César).
//
// LA règle : la masse à vide d'une pesée INCLUT le carburant inutilisable.
// La ligne « carburant » d'un devis de masse est donc l'UTILISABLE seul.
// Compter le volume physique pèserait l'inutilisable deux fois.
// Cas de référence : F-BXQT (Reims/Cessna F150M) — total 98 L, utilisable 85 L.

import { describe, it, expect } from 'vitest';
import { tankUsableLtr, tankTotalLtr, tankUnusableLtr, sumUsableLtr, sumTotalLtr } from '../tankCapacity.js';
import { computeScenarioFuel } from '../../wb/fuelArm.js';
import { computeMaxFuel } from '../maxFuel.js';
import { applyTankVariant } from '../../wb/tankVariants.js';
import { getFuelUsableCapacityLtr } from '../../perf/aircraftPerf.js';

const AVGAS = 0.72;

describe('accesseurs de contenance', () => {
  it('nouveau modèle : chaque grandeur dans son champ', () => {
    const t = { totalCapacity: 98, usableCapacity: 85 };
    expect(tankTotalLtr(t)).toBe(98);
    expect(tankUsableLtr(t)).toBe(85);
    expect(tankUnusableLtr(t)).toBe(13);
  });

  it('fiche legacy : `capacity` seul est lu comme l\'UTILISABLE (hypothèse prudente)', () => {
    const t = { capacity: 85 };
    expect(tankUsableLtr(t)).toBe(85);
    expect(tankTotalLtr(t)).toBe(85);
    expect(tankUnusableLtr(t)).toBeNull();   // l'inutilisable ne se devine pas
  });

  it('champ absent : null, jamais un zéro fabriqué', () => {
    expect(tankUsableLtr({})).toBeNull();
    expect(sumUsableLtr([])).toBeNull();
  });

  it('les chaînes numériques héritées sont lues (« 110 » de F-HFGI)', () => {
    expect(tankUsableLtr({ capacity: '110' })).toBe(110);
  });
});

describe('scénario « pleins » du centrage — le test anti-régression clé', () => {
  const aircraft = (tank) => ({
    additionalFuelTanks: [{ id: 't1', arm: 1.07, ...tank }],
  });

  it('ne compte JAMAIS l\'inutilisable : 98/85 → 61,2 kg, pas 70,6', () => {
    const r = computeScenarioFuel({
      aircraft: aircraft({ totalCapacity: 98, usableCapacity: 85 }),
      scenario: 'full', density: AVGAS,
    });
    expect(r.ok).toBe(true);
    expect(r.weight).toBeCloseTo(85 * AVGAS, 6);   // 61,2 kg
    expect(r.weight).not.toBeCloseTo(98 * AVGAS, 1); // jamais 70,56
  });

  it('fiche legacy (capacity seul) : comportement inchangé', () => {
    const r = computeScenarioFuel({
      aircraft: aircraft({ capacity: 85 }),
      scenario: 'full', density: AVGAS,
    });
    expect(r.weight).toBeCloseTo(61.2, 6);
  });

  it('branche legacy SANS réservoirs : l\'utilisable racine prime sur le volume physique', () => {
    // Avant : fuelCapacity (98) était lu tel quel → +9,4 kg d'inutilisable
    // comptés deux fois. C'était un défaut PRÉEXISTANT, corrigé au passage.
    const r = computeScenarioFuel({
      aircraft: { fuelCapacity: 98, fuelUsableCapacity: 85, weightBalance: { fuelArm: 1.07 } },
      scenario: 'full', density: AVGAS,
    });
    expect(r.weight).toBeCloseTo(61.2, 6);
  });
});

describe('« remplir au maximum » plafonne à l\'utilisable', () => {
  it('98 L physiques, 85 utilisables : le plan s\'arrête à 85', () => {
    const r = computeMaxFuel({
      aircraft: {
        additionalFuelTanks: [{ id: 't1', totalCapacity: 98, usableCapacity: 85, arm: 1.07 }],
        fuelType: 'AVGAS',
        weights: { mtow: 757 },
      },
      zfwKg: 600,
    });
    expect(r.ok).toBe(true);
    expect(r.litresMax).toBeCloseTo(85, 1);
  });
});

describe('variantes de réservoirs : deux sommes, chacune sa sémantique', () => {
  const av = {
    additionalFuelTanks: [
      { id: 'a', totalCapacity: 98, usableCapacity: 85, arm: 1.07 },
      { id: 'b', totalCapacity: 40, usableCapacity: 37, arm: 1.20 },
    ],
    tankVariants: [{ id: 'v1', name: 'Standard', isDefault: true, tankIds: ['a'] }],
    fuelCapacity: 138, fuelUsableCapacity: 122,
  };

  it('la configuration « Standard » (réservoir a seul) porte 98 total / 85 utilisable', () => {
    const eff = applyTankVariant(av, 'v1');
    expect(eff.fuelCapacity).toBe(98);
    expect(eff.fuelUsableCapacity).toBe(85);
  });
});

describe('getFuelUsableCapacityLtr — borne d\'autonomie et d\'escales', () => {
  it('priorité au champ dédié', () => {
    expect(getFuelUsableCapacityLtr({ fuelCapacity: 98, fuelUsableCapacity: 85 })).toBe(85);
  });
  it('vieux schéma fuel.unusable : total − inutilisable', () => {
    expect(getFuelUsableCapacityLtr({ fuelCapacity: 98, fuel: { unusable: 13 } })).toBe(85);
  });
  it('repli sur le volume physique quand rien d\'autre n\'existe (fiche signalée incomplète par ailleurs)', () => {
    expect(getFuelUsableCapacityLtr({ fuelCapacity: 98 })).toBe(98);
  });
  it('rien → null, jamais un zéro', () => {
    expect(getFuelUsableCapacityLtr({})).toBeNull();
  });
});
