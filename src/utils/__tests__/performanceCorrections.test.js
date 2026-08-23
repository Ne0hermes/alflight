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

// ════════════════════════════════════════════════════════════════════════════
// SURFACES ET ÉTATS DE PISTE (21/08/2026, demande César)
//
// « Pour les terrains meubles, les pistes dures mouillées, les herbes mouillées,
//   les herbes hautes et les pistes en herbe, il faut que je puisse ajouter un
//   facteur — pourcentage ou facteur multiplicatif, comme pour le vent. »
//
// Les états non détectables (kind 'manual') sont DÉCLARÉS par le pilote via
// conditions.runwayStates ; absents de la déclaration, ils sont sans objet ;
// runwayStates absent (appelant non câblé) → simple rappel, jamais appliqué.
// ════════════════════════════════════════════════════════════════════════════

const wetGrassFactor = { id: 'wg-f', type: 'wet_grass', mode: 'factor_fixed', value: 1.15, appliesTo: 'both' };
const wetGrassPercent = { id: 'wg-p', type: 'wet_grass', mode: 'percent_fixed', value: 20, appliesTo: 'landing' };

describe('états de piste déclarés — facteur fixe / pourcentage fixe', () => {
  const run = (corrections, conditions) =>
    applyPerformanceCorrections({ distance: 1000, phase: 'landing', corrections, conditions });

  it('factor_fixed ×1,15 sur herbe mouillée DÉCLARÉE : appliqué, détail « déclaré »', () => {
    const r = run([wetGrassFactor], { windComponentKt: 0, surface: 'grass', runwayStates: ['wet_grass'] });
    expect(r.corrected).toBeCloseTo(1150, 6);
    expect(r.applied).toBe(true);
    expect(r.steps[0].factor).toBeCloseTo(1.15, 6);
    expect(r.steps[0].detail).toMatch(/herbe mouillée/);
    expect(r.steps[0].detail).toMatch(/déclaré/);
    expect(r.steps[0].note).toBeNull();
  });

  it('percent_fixed +20 % sur herbe mouillée déclarée : ×1,20', () => {
    const r = run([wetGrassPercent], { windComponentKt: 0, surface: 'grass', runwayStates: ['wet_grass'] });
    expect(r.corrected).toBeCloseTo(1200, 6);
  });

  it('état NON déclaré (runwayStates présent mais vide) : règle sans objet, aucune étape', () => {
    const r = run([wetGrassFactor], { windComponentKt: 0, surface: 'grass', runwayStates: [] });
    expect(r.corrected).toBe(1000);
    expect(r.applied).toBe(false);
    expect(r.steps).toHaveLength(0);
  });

  it('autre état déclaré (herbe haute) : la règle herbe mouillée reste sans objet', () => {
    const r = run([wetGrassFactor], { windComponentKt: 0, surface: 'grass', runwayStates: ['high_grass'] });
    expect(r.corrected).toBe(1000);
    expect(r.steps).toHaveLength(0);
  });

  it('runwayStates ABSENT (appelant non câblé) : jamais appliqué, rappel « à appliquer manuellement »', () => {
    const r = run([wetGrassFactor], { windComponentKt: 0, surface: 'grass' });
    expect(r.corrected).toBe(1000);
    expect(r.applied).toBe(false);
    expect(r.steps[0].note).toMatch(/à appliquer manuellement/);
  });

  it("plusieurs états déclarés : chacun s'applique une fois, ils se multiplient", () => {
    const highGrass = { id: 'hg', type: 'high_grass', mode: 'percent_fixed', value: 25, appliesTo: 'both' };
    const r = run([wetGrassFactor, highGrass], { windComponentKt: 0, surface: 'grass', runwayStates: ['wet_grass', 'high_grass'] });
    expect(r.corrected).toBeCloseTo(1000 * 1.15 * 1.25, 6);
    expect(r.steps).toHaveLength(2);
  });

  it('la piste en herbe (auto) reste pilotée par `surface`, pas par la déclaration', () => {
    const r = run([grass15], { windComponentKt: 0, surface: 'grass', runwayStates: [] });
    expect(r.corrected).toBeCloseTo(1150, 6);
    const dur = run([grass15], { windComponentKt: 0, surface: 'paved', runwayStates: ['grass'] });
    expect(dur.corrected).toBe(1000);
  });

  it('factor_fixed sur la piste en herbe (auto) : ×1,2', () => {
    const grassFactor = { id: 'gf', type: 'grass', mode: 'factor_fixed', value: 1.2, appliesTo: 'both' };
    const r = run([grassFactor], { windComponentKt: 0, surface: 'grass' });
    expect(r.corrected).toBeCloseTo(1200, 6);
  });

  it('facteur fixe hors bornes (×12) : refusé avec note', () => {
    const crazy = { id: 'cr', type: 'soft_ground', mode: 'factor_fixed', value: 12, appliesTo: 'both' };
    const r = run([crazy], { windComponentKt: 0, surface: 'grass', runwayStates: ['soft_ground'] });
    expect(r.corrected).toBe(1000);
    expect(r.steps[0].note).toMatch(/hors bornes/);
  });

  it('COMPAT : règle de surface héritée en factor_per_step = facteur brut fixe (jamais une puissance)', () => {
    const legacy = { id: 'lg', type: 'grass', mode: 'factor_per_step', value: 1.15, stepKt: null, appliesTo: 'both' };
    const r = run([legacy], { windComponentKt: 0, surface: 'grass' });
    expect(r.corrected).toBeCloseTo(1150, 6);
    expect(describeCorrection(legacy)).toContain('×1,15 fixe');
  });

  it('describeCorrection : « ×1,15 fixe » pour factor_fixed', () => {
    expect(describeCorrection(wetGrassFactor)).toContain('Herbe mouillée');
    expect(describeCorrection(wetGrassFactor)).toContain('×1,15 fixe');
    expect(describeCorrection(wetGrassPercent)).toContain('+20 %');
  });
});

describe('garde anti-cumul — étendue aux surfaces et états de piste', () => {
  it('deux règles « Herbe » pour la même phase : AUCUNE appliquée + note', () => {
    const deux = [
      { id: 'g1', type: 'grass', mode: 'percent_fixed', value: 15, appliesTo: 'takeoff' },
      { id: 'g2', type: 'grass', mode: 'factor_fixed', value: 1.2, appliesTo: 'both' },
    ];
    const r = applyPerformanceCorrections({
      distance: 1000, phase: 'takeoff', corrections: deux, conditions: { windComponentKt: 0, surface: 'grass' },
    });
    // Sans la garde : 1,15 × 1,2 = ×1,38 — une double pénalité que le manuel ne donne pas.
    expect(r.corrected).toBe(1000);
    expect(r.applied).toBe(false);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].note).toMatch(/AUCUNE appliquée/);
    expect(r.steps[0].note).toMatch(/une seule règle/);
  });

  it('deux règles « Herbe mouillée » déclarée : AUCUNE appliquée, les autres types passent', () => {
    const regles = [
      { id: 'w1', type: 'wet_grass', mode: 'percent_fixed', value: 15, appliesTo: 'landing' },
      { id: 'w2', type: 'wet_grass', mode: 'factor_fixed', value: 1.3, appliesTo: 'landing' },
      grass15,
    ];
    const r = applyPerformanceCorrections({
      distance: 1000, phase: 'landing', corrections: regles,
      conditions: { windComponentKt: 0, surface: 'grass', runwayStates: ['wet_grass'] },
    });
    expect(r.corrected).toBeCloseTo(1150, 6);   // herbe appliquée, herbe mouillée neutralisée
    expect(r.steps.find((s) => s.id === 'ambigu-wet_grass')).toBeTruthy();
  });

  it("la même règle sur l'autre phase ne compte pas comme doublon", () => {
    const r = applyPerformanceCorrections({
      distance: 1000, phase: 'takeoff',
      corrections: [
        { id: 'g1', type: 'grass', mode: 'percent_fixed', value: 15, appliesTo: 'takeoff' },
        { id: 'g2', type: 'grass', mode: 'percent_fixed', value: 30, appliesTo: 'landing' },
      ],
      conditions: { windComponentKt: 0, surface: 'grass' },
    });
    expect(r.corrected).toBeCloseTo(1150, 6);
  });
});

describe("vent déjà intégré par l'abaque (windAppliedByAbac) — 21/08, ré-audit F-HFGI", () => {
  // Cas réel : l'abaque « Distance atterrissage — roulage » de F-HFGI a un panneau
  // vent (596 ft vent nul → 520 ft à +8 kt → 775 ft à −5 kt). Appliquer EN PLUS
  // « vent arrière +10 % par 2 kt » comptait le vent deux fois (775 × 1,3).
  const headwindTable = {
    id: 'ht', type: 'headwind', mode: 'factor_table', appliesTo: 'both',
    brackets: [{ fromKt: 10, value: 0.85 }, { fromKt: 20, value: 0.65 }],
  };

  it('vent arrière 5 kt : règle vent SIGNALÉE (non appliquée), herbe appliquée', () => {
    const r = applyPerformanceCorrections({
      distance: 775, phase: 'landing', corrections: [tailwind10per2, grass15],
      conditions: { windComponentKt: -5, surface: 'grass', windAppliedByAbac: true },
    });
    expect(r.corrected).toBeCloseTo(775 * 1.15, 6);      // ×1,3 vent NON appliqué
    expect(r.totalFactor).toBeCloseTo(1.15, 6);
    const vent = r.steps.find((s) => s.id === 't');
    expect(vent).toBeTruthy();
    expect(vent.factor).toBeNull();
    expect(vent.note).toMatch(/vent déjà intégré par l'abaque/);
    expect(vent.note).toMatch(/règle non appliquée/);
    const herbe = r.steps.find((s) => s.id === 'g');
    expect(herbe.factor).toBeCloseTo(1.15, 6);
    expect(r.applied).toBe(true);
  });

  it('vent de face 15 kt, tableau de paliers : NON appliqué avec note, distance brute', () => {
    const r = applyPerformanceCorrections({
      distance: 520, phase: 'landing', corrections: [headwindTable],
      conditions: { windComponentKt: 15, surface: 'paved', windAppliedByAbac: true },
    });
    expect(r.corrected).toBe(520);                        // ×0,85 NON appliqué
    expect(r.applied).toBe(false);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].note).toMatch(/vent déjà intégré par l'abaque/);
  });

  it('toutes les règles de vent de la phase sont signalées, même celles sans objet au vent du jour', () => {
    const r = applyPerformanceCorrections({
      distance: 600, phase: 'takeoff', corrections: [headwind085per10, tailwind10per2],
      conditions: { windComponentKt: 12, surface: null, windAppliedByAbac: true },
    });
    expect(r.corrected).toBe(600);
    expect(r.steps.map((s) => s.id).sort()).toEqual(['h', 't']);
    expect(r.steps.every((s) => s.factor === null && /règle non appliquée/.test(s.note))).toBe(true);
  });

  it('windAppliedByAbac false ou absent : comportement inchangé (vent arrière 5 kt → ×1,3)', () => {
    const conditions = { windComponentKt: -5, surface: 'grass' };
    const absent = applyPerformanceCorrections({ distance: 775, phase: 'landing', corrections: [tailwind10per2, grass15], conditions });
    const faux = applyPerformanceCorrections({
      distance: 775, phase: 'landing', corrections: [tailwind10per2, grass15],
      conditions: { ...conditions, windAppliedByAbac: false },
    });
    for (const r of [absent, faux]) {
      expect(r.corrected).toBeCloseTo(775 * 1.3 * 1.15, 6);
      expect(r.steps.find((s) => s.id === 't').factor).toBeCloseTo(1.3, 6);
    }
  });

  it("la garde anti-cumul prime : deux règles vent ambiguës → une seule note d'ambiguïté", () => {
    const r = applyPerformanceCorrections({
      distance: 775, phase: 'landing',
      corrections: [tailwind10per2, { ...tailwind10per2, id: 't2' }],
      conditions: { windComponentKt: -5, surface: null, windAppliedByAbac: true },
    });
    expect(r.corrected).toBe(775);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].id).toBe('ambigu-tailwind');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ÉCART À L'ISA (23/08/2026, demande pilote — F-BXNG et F-BXQT, Cessna 150)
//
// Ces manuels ne publient les distances QU'AUX CONDITIONS STANDARD : une seule
// température par palier d'altitude, exactement sur la ligne ISA. Ils donnent en
// compensation une note de correction en température, ici celle du pilote :
//   « décollage +10 % tous les +20 °C ; atterrissage +10 % tous les +35 °C ».
//
// Depuis le refus des OAT hors grille (21/08), ces avions n'avaient plus AUCUNE
// distance calculable hors ISA. La règle `isa_deviation` rend la note saisissable.
// Arrondi CONSERVATEUR comme le vent arrière : toute tranche ENTAMÉE est due.
// ════════════════════════════════════════════════════════════════════════════

const isaTakeoff10per20 = { id: 'isa-to', type: 'isa_deviation', mode: 'percent_per_step', value: 10, stepC: 20, appliesTo: 'takeoff' };
const isaLanding10per35 = { id: 'isa-ld', type: 'isa_deviation', mode: 'percent_per_step', value: 10, stepC: 35, appliesTo: 'landing' };

describe("écart ISA — note de correction en température du manuel", () => {
  const run = (corrections, conditions, phase = 'takeoff') =>
    applyPerformanceCorrections({ distance: 1000, phase, corrections, conditions });
  // La source ne corrige RIEN : c'est le cas nominal de la règle.
  const std = (isaDeviationC) => ({ windComponentKt: 0, surface: null, runwayStates: [], isaDeviationC, temperatureAppliedBySource: false });

  it('ISA+21 avec un pas de 20 °C → 2 tranches (entamée = due) → ×1,20', () => {
    const r = run([isaTakeoff10per20], std(21));
    expect(r.corrected).toBeCloseTo(1200, 6);
    expect(r.applied).toBe(true);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].factor).toBeCloseTo(1.2, 6);
    expect(r.unresolvedTemperature).toBeUndefined();
  });

  it('ISA+27 : détail lisible « 2 tranches de 20 °C (entamée = due) »', () => {
    const r = run([isaTakeoff10per20], std(27));
    expect(r.corrected).toBeCloseTo(1200, 6);
    expect(r.steps[0].detail).toBe('ISA+27 °C → 2 tranches de 20 °C (entamée = due) → ×1,2');
  });

  it('pile sur la tranche (ISA+20) : une seule tranche, pas deux', () => {
    expect(run([isaTakeoff10per20], std(20)).corrected).toBeCloseTo(1100, 6);
    expect(run([isaTakeoff10per20], std(20.1)).corrected).toBeCloseTo(1200, 6);
  });

  it('à l\'ISA ou en dessous : règle SANS OBJET — aucun crédit, aucune étape', () => {
    for (const d of [0, -0.5, -12]) {
      const r = run([isaTakeoff10per20], std(d));
      expect(r.corrected).toBe(1000);
      expect(r.applied).toBe(false);
      expect(r.steps).toHaveLength(0);
      expect(r.unresolvedTemperature).toBeUndefined();
    }
  });

  it('écart ISA absent ou non fini : NON appliqué, avec note (jamais silencieux)', () => {
    for (const d of [undefined, null, NaN, 'chaud']) {
      const r = run([isaTakeoff10per20], { ...std(0), isaDeviationC: d });
      expect(r.corrected).toBe(1000);
      expect(r.steps[0].note).toMatch(/écart ISA indisponible/);
    }
  });

  it('factor_per_step : le facteur est élevé à la puissance du nombre de tranches', () => {
    const regle = { id: 'f', type: 'isa_deviation', mode: 'factor_per_step', value: 1.1, stepC: 20, appliesTo: 'takeoff' };
    const r = run([regle], std(25));
    expect(r.corrected).toBeCloseTo(1000 * 1.1 * 1.1, 6);
  });

  it('la note du pilote diffère par phase : +10 %/20 °C au décollage, /35 °C à l\'atterrissage', () => {
    const regles = [isaTakeoff10per20, isaLanding10per35];
    expect(run(regles, std(30), 'takeoff').corrected).toBeCloseTo(1200, 6);   // 30/20 → 2 tranches
    expect(run(regles, std(30), 'landing').corrected).toBeCloseTo(1100, 6);   // 30/35 → 1 tranche
  });

  it('stepC manquant ou nul : règle mal saisie, ignorée (stepKt n\'est JAMAIS lu)', () => {
    const sansPas = { ...isaTakeoff10per20, stepC: null };
    const enNoeuds = { ...isaTakeoff10per20, stepC: undefined, stepKt: 20 };
    for (const c of [sansPas, enNoeuds]) {
      const r = run([c], std(21));
      expect(r.corrected).toBe(1000);
      expect(r.applied).toBe(false);
    }
  });

  it('mode non autorisé pour la température (percent_fixed, table) : ignoré', () => {
    const fixe = { id: 'x', type: 'isa_deviation', mode: 'percent_fixed', value: 10, appliesTo: 'takeoff' };
    const r = run([fixe], std(21));
    expect(r.corrected).toBe(1000);
    expect(r.applied).toBe(false);
  });

  it('facteur hors bornes (×3 par tranche sur ISA+40) : refusé avec note', () => {
    const fou = { id: 'z', type: 'isa_deviation', mode: 'factor_per_step', value: 3, stepC: 10, appliesTo: 'takeoff' };
    const r = run([fou], std(40));
    expect(r.corrected).toBe(1000);
    expect(r.steps[0].note).toMatch(/hors bornes/);
  });

  it('se cumule normalement avec le vent et la surface, chacun une fois', () => {
    const r = applyPerformanceCorrections({
      distance: 1000, phase: 'takeoff', corrections: [isaTakeoff10per20, tailwind10per2, grass15],
      conditions: { windComponentKt: -4, surface: 'grass', runwayStates: [], isaDeviationC: 21, temperatureAppliedBySource: false },
    });
    expect(r.corrected).toBeCloseTo(1000 * 1.2 * 1.2 * 1.15, 6);
    expect(r.steps).toHaveLength(3);
  });

  it('describeCorrection : « +10 % par 20 °C au-dessus de la standard »', () => {
    expect(describeCorrection(isaTakeoff10per20))
      .toBe('Température au-dessus de la standard (écart ISA) : +10 % par 20 °C au-dessus de la standard (décollage)');
    const facteur = { ...isaTakeoff10per20, mode: 'factor_per_step', value: 1.1 };
    expect(describeCorrection(facteur)).toContain('×1,1 par 20 °C au-dessus de la standard');
  });

  it('garde anti-cumul : deux règles d\'écart ISA sur la même phase → AUCUNE appliquée', () => {
    const deux = [isaTakeoff10per20, { ...isaTakeoff10per20, id: 'isa-2', value: 15, stepC: 10 }];
    const r = run(deux, std(21));
    // Sans la garde : 1,20 × 1,45 = ×1,74 — une pénalité que le manuel ne donne pas.
    expect(r.corrected).toBe(1000);
    expect(r.steps.find((s) => s.id === 'ambigu-isa_deviation')).toBeTruthy();
    // …et la distance reste NON corrigée : elle doit être écartée.
    expect(r.unresolvedTemperature).toBe(true);
  });
});

describe('température déjà intégrée par la source (temperatureAppliedBySource)', () => {
  // Grille à plusieurs températures, ou abaque à panneau OAT : la température est
  // déjà dans la distance lue. Appliquer la note du manuel la compterait deux fois.
  it('règle SIGNALÉE (non appliquée), les autres facteurs jouent normalement', () => {
    const r = applyPerformanceCorrections({
      distance: 1000, phase: 'takeoff', corrections: [isaTakeoff10per20, grass15],
      conditions: { windComponentKt: 0, surface: 'grass', runwayStates: [], isaDeviationC: 27, temperatureAppliedBySource: true },
    });
    expect(r.corrected).toBeCloseTo(1150, 6);            // ×1,2 de la température NON appliqué
    const temp = r.steps.find((s) => s.id === 'isa-to');
    expect(temp.factor).toBeNull();
    expect(temp.note).toMatch(/température déjà intégrée par le tableau\/l'abaque/);
    expect(temp.note).toMatch(/règle non appliquée/);
    expect(r.unresolvedTemperature).toBeUndefined();     // la source corrige : rien à signaler
  });

  it('source qui intègre la température SANS règle saisie : rien à signaler', () => {
    const r = applyPerformanceCorrections({
      distance: 1000, phase: 'takeoff', corrections: [grass15],
      conditions: { windComponentKt: 0, surface: 'grass', isaDeviationC: 27, temperatureAppliedBySource: true },
    });
    expect(r.unresolvedTemperature).toBeUndefined();
    expect(r.corrected).toBeCloseTo(1150, 6);
  });
});

describe('🛡️ unresolvedTemperature — distance standard non corrigée', () => {
  // LE point de sécurité du lot : ne JAMAIS présenter comme utilisable, par 35 °C,
  // une distance que le manuel ne donne qu'aux conditions standard.
  const sansRegleISA = (corrections, isaDeviationC) => applyPerformanceCorrections({
    distance: 224, phase: 'takeoff', corrections,
    conditions: { windComponentKt: 0, surface: 'grass', runwayStates: [], isaDeviationC, temperatureAppliedBySource: false },
  });

  it('aucune règle du tout sur la fiche avion : drapeau levé + motif actionnable', () => {
    const r = sansRegleISA([], 20);
    expect(r.unresolvedTemperature).toBe(true);
    const note = r.steps.find((s) => s.id === 'isa-non-corrige').note;
    expect(note).toMatch(/distance donnée aux conditions standard/);
    expect(note).toMatch(/non corrigée d'un écart ISA de \+20 °C/);
    expect(note).toMatch(/Performances → Facteurs correctifs/);
  });

  it('des règles existent (vent, herbe) mais aucune pour la température : drapeau levé', () => {
    const r = sansRegleISA([headwind085per10, grass15], 25);
    expect(r.unresolvedTemperature).toBe(true);
    expect(r.steps.some((s) => s.id === 'isa-non-corrige')).toBe(true);
  });

  it('règle d\'écart ISA présente et appliquée : PAS de drapeau', () => {
    const r = sansRegleISA([isaTakeoff10per20], 25);
    expect(r.unresolvedTemperature).toBeUndefined();
    expect(r.corrected).toBeCloseTo(224 * 1.2, 6);
  });

  it('règle présente mais sur l\'AUTRE phase : drapeau levé (elle ne corrige rien ici)', () => {
    const r = sansRegleISA([isaLanding10per35], 25);
    expect(r.unresolvedTemperature).toBe(true);
  });

  it('à l\'ISA ou plus froid : aucun drapeau, la distance standard est valable', () => {
    for (const d of [0, -3]) expect(sansRegleISA([], d).unresolvedTemperature).toBeUndefined();
  });

  it('temperatureAppliedBySource ABSENT (appelant non câblé) : aucun drapeau, comportement inchangé', () => {
    const r = applyPerformanceCorrections({
      distance: 224, phase: 'takeoff', corrections: [grass15],
      conditions: { windComponentKt: 0, surface: 'grass', isaDeviationC: 25 },
    });
    expect(r.unresolvedTemperature).toBeUndefined();
    expect(r.corrected).toBeCloseTo(224 * 1.15, 6);
  });

  it('liste de règles VIDE : le moteur ne sort plus par anticipation, le drapeau passe', () => {
    // C'est exactement F-BXNG : aucune règle saisie, grille standard-seule, 35 °C.
    const r = applyPerformanceCorrections({
      distance: 224, phase: 'takeoff', corrections: [],
      conditions: { isaDeviationC: 20, temperatureAppliedBySource: false },
    });
    expect(r.unresolvedTemperature).toBe(true);
    expect(r.corrected).toBe(224);                 // la valeur reste lisible…
    expect(r.applied).toBe(false);                 // …mais rien ne l'a corrigée
  });

  it('distance invalide : sortie anticipée, aucun drapeau (rien à corriger)', () => {
    const r = applyPerformanceCorrections({
      distance: 0, phase: 'takeoff', corrections: [],
      conditions: { isaDeviationC: 20, temperatureAppliedBySource: false },
    });
    expect(r.unresolvedTemperature).toBeUndefined();
    expect(r.steps).toHaveLength(0);
  });
});
