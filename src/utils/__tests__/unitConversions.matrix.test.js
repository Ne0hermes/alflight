// C0.2 (PLAN_CORRECTIFS_UNITES.md) — Matrice de conversion exhaustive + fail-closed.
//
// Filet posé AVANT les correctifs de Phase 1. État attendu :
//   - AVANT C1.x : les tests « fail-closed » (clé manquante ⇒ throw, NaN ⇒ NaN,
//     alias km/h, 0°C→32°F, densité gal↔lbs) sont ROUGES — c'est la preuve des
//     anomalies ANO-3, ANO-7, CV-4, CV-6 de l'audit AUDIT_MASSE_CENTRAGE_UNITES.md.
//   - APRÈS C1.1-C1.6 : tout est VERT et le reste à jamais.

import { describe, it, expect } from 'vitest';
import {
  convertValue,
  armLengthConversions,
  weightConversions,
  fuelConversions
} from '@utils/unitConversions';

// ─── Références exactes (NIST / OACI) ───────────────────────────────────────
const REF = {
  IN_PER_M: 39.3701,     // facteur utilisé par l'app (1 m = 39.3701 in)
  MM_PER_IN: 25.4,       // exact par définition
  LBS_PER_KG: 2.20462,   // facteur app (exact : 2.2046226218)
  KG_PER_LBS: 0.453592,  // facteur app (exact : 0.45359237)
  LTR_PER_GAL: 3.78541
};

const closeTo = (received, expected, relTol = 1e-9) =>
  expect(Math.abs(received - expected)).toBeLessThanOrEqual(Math.abs(expected) * relTol + 1e-12);

// ─── 1. Matrice armLength : les 12 paires mm/cm/m/in contre valeurs de référence ──
describe('armLength — matrice complète contre références', () => {
  const cases = [
    ['mmToCm', 1500, 150],
    ['mmToM', 1500, 1.5],
    ['mmToIn', 1500, 1500 / 25.4],
    ['cmToMm', 150, 1500],
    ['cmToM', 150, 1.5],
    ['cmToIn', 150, 150 / 2.54],
    ['mToMm', 1.5, 1500],
    ['mToCm', 1.5, 150],
    ['mToIn', 1.5, 1.5 * REF.IN_PER_M],
    ['inToMm', 59.0551, 59.0551 * 25.4],
    ['inToCm', 59.0551, 59.0551 * 2.54],
    ['inToM', 59.0551, 59.0551 / REF.IN_PER_M]
  ];
  it.each(cases)('%s : aucun facteur inversé', (fn, input, expected) => {
    closeTo(armLengthConversions[fn](input), expected, 1e-9);
  });

  it('les 12 fonctions attendues existent (aucune clé manquante ⇒ pass-through)', () => {
    for (const fn of cases.map((c) => c[0])) {
      expect(typeof armLengthConversions[fn]).toBe('function');
    }
  });
});

// ─── 2. Propriété aller-retour a→b→a ≈ identité ─────────────────────────────
describe('aller-retour a→b→a — perte bornée', () => {
  const armUnits = ['mm', 'cm', 'm', 'in'];
  const samples = [0.5, 2.1, 850, 2100];
  for (const a of armUnits) {
    for (const b of armUnits) {
      if (a === b) continue;
      it(`armLength ${a}→${b}→${a}`, () => {
        for (const x of samples) {
          const out = convertValue(convertValue(x, a, b, 'armLength'), b, a, 'armLength');
          closeTo(out, x, 1e-9);
        }
      });
    }
  }

  it('weight kg→lbs→kg : dérive du produit 2.20462×0.453592 documentée (CV-7, tolérance 1e-5)', () => {
    const x = 1500;
    const out = convertValue(convertValue(x, 'kg', 'lbs', 'weight'), 'lbs', 'kg', 'weight');
    // Produit des facteurs = 0.99999823 ⇒ ~2.7e-3 kg de biais sur 1500 kg par cycle.
    closeTo(out, x, 1e-5);
  });
});

// ─── 3. Fail-closed : clé manquante ⇒ ERREUR, jamais la valeur d'origine (ANO-3) ──
describe('fail-closed — pass-through interdit', () => {
  it('clé inexistante (mm→m dans la catégorie weight) ⇒ throw en mode test, jamais 1500 silencieux', () => {
    expect(() => convertValue(1500, 'mm', 'm', 'weight')).toThrow();
  });

  it('catégorie inconnue ⇒ throw en mode test, jamais la valeur brute', () => {
    expect(() => convertValue(42, 'mm', 'm', 'categorieInexistante')).toThrow();
  });

  it('valeur non numérique ⇒ NaN, jamais 0 (ANO-7 : un bras illisible ne devient pas un moment nul)', () => {
    expect(Number.isNaN(convertValue('abc', 'mm', 'm', 'armLength'))).toBe(true);
    expect(Number.isNaN(convertValue('', 'mm', 'm', 'armLength'))).toBe(true);
    expect(Number.isNaN(convertValue(null, 'mm', 'm', 'armLength'))).toBe(true);
  });

  it('0 est une valeur VALIDE : 0 °C = 32 °F (le garde !value avalait le zéro)', () => {
    closeTo(convertValue(0, 'C', 'F', 'temperature'), 32, 1e-9);
  });

  it('0 mm = 0 m (zéro converti, pas court-circuité)', () => {
    expect(convertValue(0, 'mm', 'm', 'armLength')).toBe(0);
  });
});

// ─── 4. Alias d'unités (CV-4) : km/h et m/s doivent convertir, pas passer tels quels ──
describe('alias d’unités — km/h, m/s', () => {
  it('100 km/h → kt ≈ 53.9957 (le préréglage metric stocke "km/h", la table attend "kmh")', () => {
    closeTo(convertValue(100, 'km/h', 'kt', 'speed'), 100 / 1.852, 1e-6);
  });
  it('10 m/s → kt ≈ 19.438', () => {
    closeTo(convertValue(10, 'm/s', 'kt', 'speed'), 10 / 0.514444, 1e-6);
  });
});

// ─── 5. Carburant : la densité est un paramètre, pas une constante AVGAS (ANO-14/CV-6) ──
describe('carburant — densité paramétrable', () => {
  it('ltr→kg avec densité JET A-1 : 100 L × 0.84 = 84 kg', () => {
    closeTo(convertValue(100, 'ltr', 'kg', 'fuel', { density: 0.84 }), 84, 1e-9);
  });
  it('gal→lbs respecte la densité JET A-1 (≈7.01 lbs/gal, pas le 6.01 AVGAS figé)', () => {
    closeTo(fuelConversions.galToLbs(1, 0.84), 3.78541 * 0.84 * 2.20462, 1e-9);
  });
  it('lbs→gal respecte la densité JET A-1 (inverse cohérent, dérive CV-7 tolérée)', () => {
    const oneGalInLbs = fuelConversions.galToLbs(1, 0.84);
    // L'aller-retour porte le biais kg↔lbs (2.20462×0.453592 = 0.99999823, CV-7) : tolérance 1e-5.
    closeTo(fuelConversions.lbsToGal(oneGalInLbs, 0.84), 1, 1e-5);
  });
  it('gal→lbs sans densité reste compatible AVGAS (≈6.0087)', () => {
    closeTo(fuelConversions.galToLbs(1), 6.0087, 1e-3);
  });
  it('kg↔lbs (catégorie weight) : facteurs nominaux', () => {
    closeTo(weightConversions.kgToLbs(1), REF.LBS_PER_KG, 1e-12);
    closeTo(weightConversions.lbsToKg(1), REF.KG_PER_LBS, 1e-12);
  });
});
