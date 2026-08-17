// Tests du moteur de facteurs correctifs (vent, herbe) — arrondis conservateurs.
import { describe, it, expect } from 'vitest';
import { applyPerformanceCorrections, describeCorrection } from '../performanceCorrections';

const headwind085per10 = { id: 'h', type: 'headwind', mode: 'factor_per_step', value: 0.85, stepKt: 10, appliesTo: 'both' };
const tailwind10per2 = { id: 't', type: 'tailwind', mode: 'percent_per_step', value: 10, stepKt: 2, appliesTo: 'both' };
const grass15 = { id: 'g', type: 'grass', mode: 'percent_fixed', value: 15, appliesTo: 'both' };

describe('applyPerformanceCorrections', () => {
  it('vent de face ×0,85 par 10 kt : tranches COMPLÈTES uniquement (15 kt → 1 tranche)', () => {
    const r = applyPerformanceCorrections({
      distance: 400, phase: 'takeoff', corrections: [headwind085per10],
      conditions: { windComponentKt: 15, surface: null }
    });
    expect(r.corrected).toBeCloseTo(400 * 0.85, 5);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].factor).toBeCloseTo(0.85, 5);
  });

  it('vent de face 8 kt < tranche de 10 kt : NON appliqué (conservateur) avec note', () => {
    const r = applyPerformanceCorrections({
      distance: 400, phase: 'takeoff', corrections: [headwind085per10],
      conditions: { windComponentKt: 8, surface: null }
    });
    expect(r.corrected).toBe(400);
    expect(r.applied).toBe(false);
    expect(r.steps[0].note).toMatch(/non appliqué/);
  });

  it('vent de face 20 kt : 2 tranches → ×0,85²', () => {
    const r = applyPerformanceCorrections({
      distance: 400, phase: 'landing', corrections: [headwind085per10],
      conditions: { windComponentKt: 20, surface: null }
    });
    expect(r.corrected).toBeCloseTo(400 * 0.85 * 0.85, 5);
  });

  it('vent arrière +10 % par 2 kt : tranche ENTAMÉE due (5 kt → 3 tranches → +30 %)', () => {
    const r = applyPerformanceCorrections({
      distance: 500, phase: 'landing', corrections: [tailwind10per2],
      conditions: { windComponentKt: -5, surface: null }
    });
    expect(r.corrected).toBeCloseTo(500 * 1.3, 5);
  });

  it('piste en herbe +15 % appliqué quand surface=grass, ignoré sur dur', () => {
    const herbe = applyPerformanceCorrections({
      distance: 300, phase: 'takeoff', corrections: [grass15],
      conditions: { windComponentKt: 0, surface: 'grass' }
    });
    expect(herbe.corrected).toBeCloseTo(345, 5);
    const dur = applyPerformanceCorrections({
      distance: 300, phase: 'takeoff', corrections: [grass15],
      conditions: { windComponentKt: 0, surface: 'paved' }
    });
    expect(dur.corrected).toBe(300);
    expect(dur.steps).toHaveLength(0);
  });

  it('surface inconnue : herbe NON appliquée mais SIGNALÉE (jamais silencieux)', () => {
    const r = applyPerformanceCorrections({
      distance: 300, phase: 'takeoff', corrections: [grass15],
      conditions: { windComponentKt: 0, surface: null }
    });
    expect(r.corrected).toBe(300);
    expect(r.steps[0].note).toMatch(/surface de piste inconnue/);
  });

  it('cumul : vent arrière puis herbe se multiplient, détail par étape', () => {
    const r = applyPerformanceCorrections({
      distance: 500, phase: 'landing', corrections: [tailwind10per2, grass15],
      conditions: { windComponentKt: -4, surface: 'grass' }
    });
    // -4 kt → 2 tranches → ×1,20 ; puis herbe ×1,15
    expect(r.corrected).toBeCloseTo(500 * 1.2 * 1.15, 5);
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0].after).toBe(600);
    expect(r.totalFactor).toBeCloseTo(1.38, 5);
  });

  it("appliesTo filtre par phase (règle atterrissage ignorée au décollage)", () => {
    const landingOnly = { ...tailwind10per2, appliesTo: 'landing' };
    const r = applyPerformanceCorrections({
      distance: 500, phase: 'takeoff', corrections: [landingOnly],
      conditions: { windComponentKt: -4, surface: null }
    });
    expect(r.corrected).toBe(500);
  });

  it('facteur hors bornes (règle aberrante) : refusé avec note', () => {
    const crazy = { id: 'c', type: 'tailwind', mode: 'factor_per_step', value: 8, stepKt: 1, appliesTo: 'both' };
    const r = applyPerformanceCorrections({
      distance: 500, phase: 'landing', corrections: [crazy],
      conditions: { windComponentKt: -3, surface: null }
    });
    expect(r.corrected).toBe(500);
    expect(r.steps[0].note).toMatch(/hors bornes/);
  });

  it('describeCorrection produit des phrases FR lisibles', () => {
    expect(describeCorrection(headwind085per10)).toContain('Vent de face');
    expect(describeCorrection(headwind085per10)).toContain('10 kt');
    expect(describeCorrection(grass15)).toContain('+15 %');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TABLEAUX DE TRANCHES (17/08/2026)
//
// Le manuel DR401 dit exactement :
//   « Influence du vent de face : pour 10 KIAS multiplier par 0,85,
//     pour 20 KIAS par 0,65, pour 30 KIAS par 0,55 » — décollage ET atterrissage.
//
// Saisi en trois règles « par tranche », le moteur les MULTIPLIAIT : à 30 kt il
// restait 220 m sur 1000 au lieu de 550. Un tableau se lit, il ne se cumule pas.
// ════════════════════════════════════════════════════════════════════════════

const tableDR401 = {
  id: 'tbl', type: 'headwind', appliesTo: 'both', mode: 'factor_table',
  brackets: [{ fromKt: 10, value: 0.85 }, { fromKt: 20, value: 0.65 }, { fromKt: 30, value: 0.55 }],
};

describe('tableau de tranches — vent de face', () => {
  const dist = (windComponentKt, corrections = [tableDR401]) =>
    applyPerformanceCorrections({ distance: 1000, phase: 'takeoff', corrections, conditions: { windComponentKt } }).corrected;

  it('restitue EXACTEMENT les trois paliers du manuel', () => {
    expect(dist(10)).toBeCloseTo(850, 6);
    expect(dist(20)).toBeCloseTo(650, 6);
    expect(dist(30)).toBeCloseTo(550, 6);
  });

  it('entre deux paliers : garde le palier ATTEINT, jamais le suivant', () => {
    // 15 kt donne le palier 10 kt (850 m) et non une interpolation vers 650 :
    // on ne crédite pas un gain que le manuel ne démontre pas.
    expect(dist(15)).toBeCloseTo(850, 6);
    expect(dist(25)).toBeCloseTo(650, 6);
    expect(dist(29.9)).toBeCloseTo(650, 6);
  });

  it('sous le premier palier : aucune correction, avec une note', () => {
    const r = applyPerformanceCorrections({
      distance: 1000, phase: 'takeoff', corrections: [tableDR401], conditions: { windComponentKt: 5 },
    });
    expect(r.corrected).toBe(1000);
    expect(r.applied).toBe(false);
    expect(r.steps[0].note).toMatch(/sous le premier palier/);
  });

  it('au-delà du dernier palier : palier le plus fort, SIGNALÉ comme hors manuel', () => {
    const r = applyPerformanceCorrections({
      distance: 1000, phase: 'takeoff', corrections: [tableDR401], conditions: { windComponentKt: 45 },
    });
    expect(r.corrected).toBeCloseTo(550, 6);
    expect(r.steps[0].note).toMatch(/au-delà du dernier palier/);
  });

  it('vent arrière sur une table de vent de face : sans objet', () => {
    expect(dist(-10)).toBe(1000);
  });

  it('un tableau de PÉNALITÉ prend le palier SUIVANT dès qu\'il est entamé', () => {
    // Vent arrière : sous-estimer la pénalité serait dangereux, on arrondit vers le haut.
    const tail = {
      id: 'tw', type: 'tailwind', appliesTo: 'both', mode: 'percent_table',
      brackets: [{ fromKt: 5, value: 10 }, { fromKt: 10, value: 25 }],
    };
    const d = (w) => applyPerformanceCorrections({
      distance: 1000, phase: 'takeoff', corrections: [tail], conditions: { windComponentKt: w },
    });
    expect(d(-5).corrected).toBeCloseTo(1100, 6);   // palier 5 kt → +10 %
    expect(d(-7).corrected).toBeCloseTo(1250, 6);   // entamé → palier 10 kt → +25 %
    expect(d(-12).steps[0].note).toMatch(/au-delà du dernier palier/); // hors table : à vérifier
  });

  it('le libellé énumère les paliers', () => {
    expect(describeCorrection(tableDR401)).toMatch(/10 kt → ×0,85 · 20 kt → ×0,65 · 30 kt → ×0,55/);
  });
});

describe('garde anti-cumul — plusieurs règles du même type', () => {
  const troisRegles = [
    { id: 'a', type: 'headwind', appliesTo: 'takeoff', mode: 'factor_per_step', value: 0.85, stepKt: 10 },
    { id: 'b', type: 'headwind', appliesTo: 'takeoff', mode: 'factor_per_step', value: 0.65, stepKt: 20 },
    { id: 'c', type: 'headwind', appliesTo: 'takeoff', mode: 'factor_per_step', value: 0.55, stepKt: 30 },
  ];

  it('n\'applique AUCUNE règle et rend la distance brute', () => {
    const r = applyPerformanceCorrections({
      distance: 1000, phase: 'takeoff', corrections: troisRegles, conditions: { windComponentKt: 30 },
    });
    // Avant ce garde-fou : 0,6141 × 0,65 × 0,55 = 0,2195 → 220 m.
    expect(r.corrected).toBe(1000);
    expect(r.applied).toBe(false);
    expect(r.steps[0].note).toMatch(/AUCUNE appliquée/);
  });

  it('ne bloque que le type ambigu : les autres corrections passent', () => {
    const r = applyPerformanceCorrections({
      distance: 1000, phase: 'takeoff',
      corrections: [...troisRegles, { id: 'g', type: 'grass', mode: 'percent_fixed', value: 15, appliesTo: 'takeoff' }],
      conditions: { windComponentKt: 30, surface: 'grass' },
    });
    expect(r.corrected).toBeCloseTo(1150, 6);   // herbe appliquée, vent neutralisé
    expect(r.applied).toBe(true);
  });
});
