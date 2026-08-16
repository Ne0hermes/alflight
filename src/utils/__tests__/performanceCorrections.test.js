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
