// C0.1 (PLAN_CORRECTIFS_UNITES.md) — INVARIANCE PAR UNITÉ.
//
// Principe : le MÊME avion physique (DR400-like, identique au golden F-GOLD),
// persisté tel que l'assistant de création le produit AUJOURD'HUI sous chaque
// préréglage d'unités, doit donner le MÊME CG et le MÊME verdict d'enveloppe.
//
// Réalité actuelle (audit v2.0, ANO-11/12/13) : l'assistant stocke bras, masses
// et enveloppe DANS L'UNITÉ D'AFFICHAGE (pas de toStorage), le moteur lit les
// masses en kg sans garde-fou et « répare » les bras par heuristique magnitude
// (>10 ⇒ ÷1000) qui ne couvre que la paire m/mm — l'enveloppe étant exclue.
//
// État attendu de ce filet :
//   - contrôle canonique (m/kg) : VERT (sanité du moteur)
//   - les 4 tests « préréglage » : ROUGES aujourd'hui = preuve chiffrée des
//     anomalies. Une fois la preuve actée, ils sont marqués it.fails (tripwire) :
//     le jour où C2/C3/C5 corrigent le flux, ils se mettent à ÉCHOUER en sens
//     inverse ⇒ OBLIGATION de les rebasculer en it() — verrou définitif.
//
// Référence physique (calcul manuel, identique au golden) :
//   total = 700+80+80+10+80 = 950 kg
//   moment = 700×2.10 + 80×2.05 + 80×2.05 + 10×3.50 + 80×2.40 = 2025 kg·m
//   cg = 2025/950 = 2.1316 m ; enveloppe fwd interp.@950 ≈ 1.97 m, aft 2.50 m ⇒ DANS les limites.

import { describe, it, expect, beforeEach } from 'vitest';
import { useWeightBalanceStore } from '@core/stores/weightBalanceStore';
import { toStorage } from '@features/aircraft/utils/mbUnits';

const CG_REF = 2025 / 950; // 2.13158 m
const LOADS = { frontLeft: 80, frontRight: 80, rearLeft: 0, rearRight: 0, baggage: 10, auxiliary: 0, fuel: 80 };

// Le même avion physique exprimé dans l'unité d'affichage d'un préréglage,
// tel que Step3WeightBalance le persiste (valeurs nues, métadonnée constante).
const aircraftAsStoredUnder = ({ armFactor, weightFactor, round = (x) => x }) => ({
  registration: 'F-INVA',
  fuelType: 'AVGAS 100LL',
  emptyWeight: round(700 * weightFactor),
  weights: { emptyWeight: round(700 * weightFactor), mtow: round(1100 * weightFactor) },
  weightBalance: {
    emptyWeightArm: round(2.10 * armFactor),
    frontLeftSeatArm: round(2.05 * armFactor),
    frontRightSeatArm: round(2.05 * armFactor),
    rearLeftSeatArm: round(3.00 * armFactor),
    rearRightSeatArm: round(3.00 * armFactor),
    baggageArm: round(3.50 * armFactor),
    auxiliaryArm: round(3.70 * armFactor),
    fuelArm: round(2.40 * armFactor)
  },
  cgEnvelope: {
    forwardPoints: [
      { weight: round(600 * weightFactor), cg: round(1.90 * armFactor) },
      { weight: round(1100 * weightFactor), cg: round(2.00 * armFactor) }
    ],
    aftCG: round(2.50 * armFactor)
  }
});

const calc = (aircraft) => {
  useWeightBalanceStore.getState().setLoads(LOADS); // charges de vol : TOUJOURS saisies en kg côté préparation
  return useWeightBalanceStore.getState().calculateWeightBalance(aircraft);
};

describe('C0.1 — invariance du CG par préréglage d’unités', () => {
  beforeEach(() => {
    useWeightBalanceStore.getState().setLoads(LOADS);
  });

  // ── Contrôle : pivot canonique m/kg — le moteur est sain sur entrées saines ──
  it('CONTRÔLE canonique (m, kg) : CG = 2.132 m et verdict DANS les limites', () => {
    const r = calc(aircraftAsStoredUnder({ armFactor: 1, weightFactor: 1 }));
    expect(r).not.toBeNull();
    expect(r.cg).toBeCloseTo(CG_REF, 3);
    expect(r.isWithinCG).toBe(true);
    expect(r.isWithinLimits).toBe(true);
  });

  // ── EUROPE (kg / mm) — préréglage PAR DÉFAUT ──
  it('EUROPE mm : le CG survit via l’heuristique magnitude (bras ÷1000)', () => {
    const r = calc(aircraftAsStoredUnder({ armFactor: 1000, weightFactor: 1 }));
    expect(r).not.toBeNull();
    expect(r.cg).toBeCloseTo(CG_REF, 3); // armUnits.js : 2100 > 10 ⇒ ÷1000 ✔
  });

  // ✅ VERROU (ex-tripwire ANO-13, basculé le 2026-06-11) : depuis C3.3, le
  // moteur normalise AUSSI l'enveloppe CG en mètres à l'entrée
  // (normalizeAircraftCgEnvelopeToMeters) ⇒ verdict homogène même sur un avion
  // legacy entièrement en mm. Ce test garantit que ça ne régresse jamais.
  it('EUROPE mm : verdict enveloppe correct (C3.3 — enveloppe normalisée à l’entrée moteur)', () => {
    const r = calc(aircraftAsStoredUnder({ armFactor: 1000, weightFactor: 1 }));
    expect(r.isWithinCG).toBe(true);
    expect(r.isWithinLimits).toBe(true);
  });

  // PREUVE ANO-12 : préréglage metric ⇒ bras en cm (210, 205…) ; l'heuristique
  // >10 ⇒ ÷1000 les transforme en 0.21 m, 0.205 m… ⇒ CG ×10 faux.
  // ⤷ Rebasculer en it() quand C2.2 + C5.2 (saisie canonique + migration) seront livrés.
  it.fails('METRIC cm : CG identique à la référence [ROUGE = ANO-12, heuristique casse les cm ×10]', () => {
    const r = calc(aircraftAsStoredUnder({ armFactor: 100, weightFactor: 1 }));
    expect(r).not.toBeNull();
    expect(r.cg).toBeCloseTo(CG_REF, 3);
  });

  // PREUVE ANO-11 + ANO-12 : préréglage USA ⇒ masses en lbs lues comme kg
  // (aucun garde-fou possible) + bras en pouces (82.7 ⇒ ÷1000 ⇒ ×25.4 faux).
  // ⤷ Rebasculer en it() quand C2.1/C2.2 + C5.3 seront livrés.
  it.fails('USA lbs/in : CG identique à la référence [ROUGE = ANO-11 kg/lbs + ANO-12 pouces]', () => {
    const KG_TO_LBS = 2.20462;
    const M_TO_IN = 39.3701;
    const r = calc(aircraftAsStoredUnder({
      armFactor: M_TO_IN,
      weightFactor: KG_TO_LBS,
      round: (x) => Math.round(x * 10) / 10 // l'effet Step3 arrondit à 1 décimale (l.317)
    }));
    expect(r).not.toBeNull();
    expect(r.cg).toBeCloseTo(CG_REF, 3);
  });

  it.fails('USA lbs/in : verdict masse honnête — la marge d’emport ne doit pas être gonflée ×2.2 [ROUGE = ANO-11]', () => {
    const r = calc(aircraftAsStoredUnder({ armFactor: 39.3701, weightFactor: 2.20462 }));
    // Masse réelle 950 kg / MTOW 1100 kg ⇒ marge restante réelle = 150 kg.
    // Avec masses lbs-lues-kg : total ≈ 1543.2+250 = 1793.2 « kg » vs MTOW 2425.1 « kg »
    // ⇒ marge affichée ≈ 632 kg : QUADRUPLE de la réalité. On exige ≤ 200 kg.
    const margin = (r?.totalWeight != null) ? (2425.1 - r.totalWeight) : Infinity;
    expect(margin).toBeLessThanOrEqual(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C2 (Phase 2) — NOUVEAU FLUX : la saisie passe par toStorage() à la frontière
// (Step3WeightBalance). Quel que soit le préréglage, ce qui est STOCKÉ est
// canonique (kg, m) ⇒ le moteur produit le MÊME CG et le MÊME verdict.
// Ce bloc est le pendant VERT des tripwires ci-dessus : il fige le contrat.
// ─────────────────────────────────────────────────────────────────────────────
describe('C2 — invariance via la frontière toStorage (flux corrigé)', () => {
  // Saisies « clavier » de l'utilisateur dans SON unité, pour le même avion physique
  const USER_INPUTS = {
    europe: { weight: 'kg', armLength: 'mm', e: 700, mtow: 1100,
      arms: { empty: 2100, fl: 2050, fr: 2050, rl: 3000, rr: 3000, bag: 3500, aux: 3700, fuel: 2400 },
      env: { w1: 600, cg1: 1900, w2: 1100, cg2: 2000, aft: 2500 } },
    usa: { weight: 'lbs', armLength: 'in', e: 700 * 2.20462, mtow: 1100 * 2.20462,
      arms: { empty: 2.10 * 39.3701, fl: 2.05 * 39.3701, fr: 2.05 * 39.3701, rl: 3.00 * 39.3701, rr: 3.00 * 39.3701, bag: 3.50 * 39.3701, aux: 3.70 * 39.3701, fuel: 2.40 * 39.3701 },
      env: { w1: 600 * 2.20462, cg1: 1.90 * 39.3701, w2: 1100 * 2.20462, cg2: 2.00 * 39.3701, aft: 2.50 * 39.3701 } },
    metric: { weight: 'kg', armLength: 'cm', e: 700, mtow: 1100,
      arms: { empty: 210, fl: 205, fr: 205, rl: 300, rr: 300, bag: 350, aux: 370, fuel: 240 },
      env: { w1: 600, cg1: 190, w2: 1100, cg2: 200, aft: 250 } }
  };

  const buildViaBoundary = (p) => {
    const arm = (v) => toStorage(v, p.armLength, 'armLength'); // → m
    const w = (v) => toStorage(v, p.weight, 'weight');         // → kg
    return {
      registration: 'F-CANO',
      fuelType: 'AVGAS 100LL',
      emptyWeight: w(p.e),
      weights: { emptyWeight: w(p.e), mtow: w(p.mtow) },
      weightBalance: {
        emptyWeightArm: arm(p.arms.empty),
        frontLeftSeatArm: arm(p.arms.fl),
        frontRightSeatArm: arm(p.arms.fr),
        rearLeftSeatArm: arm(p.arms.rl),
        rearRightSeatArm: arm(p.arms.rr),
        baggageArm: arm(p.arms.bag),
        auxiliaryArm: arm(p.arms.aux),
        fuelArm: arm(p.arms.fuel)
      },
      cgEnvelope: {
        forwardPoints: [
          { weight: w(p.env.w1), cg: arm(p.env.cg1) },
          { weight: w(p.env.w2), cg: arm(p.env.cg2) }
        ],
        aftCG: arm(p.env.aft)
      }
    };
  };

  for (const [name, prefs] of Object.entries(USER_INPUTS)) {
    it(`${name.toUpperCase()} (${prefs.weight}/${prefs.armLength}) : CG = 2.132 m et DANS les limites`, () => {
      const r = calc(buildViaBoundary(prefs));
      expect(r).not.toBeNull();
      expect(r.cg).toBeCloseTo(CG_REF, 3);
      expect(r.isWithinCG).toBe(true);
      expect(r.isWithinLimits).toBe(true);
    });
  }
});
