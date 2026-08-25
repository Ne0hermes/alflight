// Tests du verdict de compatibilité piste (logique pure, hors composant).
import { describe, it, expect } from 'vitest';
import { analyzeRunwayCompatibility } from '@utils/runwayCompatibility';

const RWY = { designation: '05/23', toda: 800, lda: 700, length: 800, surface: 'ASPH' };
const AIRCRAFT = {
  registration: 'F-TEST',
  // POH statique en PIEDS (comportement historique)
  distances: { takeoffDistance50ft: 2000, landingDistance50ft: 1800 },
};

describe('analyzeRunwayCompatibility — distances CALCULÉES (m, prioritaires)', () => {
  it('NO-GO décollage : TODA 800 m < 900 m calculés', () => {
    const r = analyzeRunwayCompatibility(RWY, AIRCRAFT, { takeoffM: 900, landingM: 600, factorLabel: '×1.15' });
    expect(r.compatible).toBe(false);
    expect(r.usedCalculated).toBe(true);
    expect(r.reasons.some(s => s.includes('TODA insuffisante') && s.includes('calculé'))).toBe(true);
  });

  it('GO : TODA 800 ≥ 750 et LDA 700 ≥ 650 calculés, marges affichées', () => {
    const r = analyzeRunwayCompatibility(RWY, AIRCRAFT, { takeoffM: 750, landingM: 650, factorLabel: null });
    expect(r.compatible).toBe(true);
    expect(r.usedCalculated).toBe(true);
    expect(r.reasons.some(s => s.includes('marge 50 m'))).toBe(true);
  });

  it('mixte : décollage calculé, atterrissage en repli POH (landingM absent)', () => {
    const r = analyzeRunwayCompatibility(RWY, AIRCRAFT, { takeoffM: 750, landingM: null });
    // LDA 700 m = 2297 ft ≥ 1800 ft POH → pas de motif d'échec atterrissage
    expect(r.compatible).toBe(true);
    expect(r.usedCalculated).toBe(true);
  });

  it('la distance calculée PRIME sur un POH contradictoire', () => {
    // POH statique dirait NO-GO (TODA 2625 ft > 2000 ft requis = OK en fait) —
    // on force un POH exigeant 3000 ft (NO-GO statique) mais calculé 700 m (GO).
    const exigeant = { ...AIRCRAFT, distances: { takeoffDistance50ft: 3000, landingDistance50ft: 3000 } };
    const r = analyzeRunwayCompatibility(RWY, exigeant, { takeoffM: 700, landingM: 650 });
    expect(r.compatible).toBe(true);
  });
});

describe('analyzeRunwayCompatibility — repli POH statique (ft)', () => {
  it('sans perfDistances : comparaison historique en pieds (GO ici)', () => {
    // TODA 800 m = 2625 ft ≥ 2000 ft requis ; LDA 700 m = 2297 ft ≥ 1800 ft
    const r = analyzeRunwayCompatibility(RWY, AIRCRAFT, null);
    expect(r.compatible).toBe(true);
    expect(r.usedCalculated).toBe(false);
  });

  it('NO-GO statique signalé « POH statique »', () => {
    const exigeant = { ...AIRCRAFT, distances: { takeoffDistance50ft: 3000, landingDistance50ft: 1000 } };
    const r = analyzeRunwayCompatibility(RWY, exigeant, null);
    expect(r.compatible).toBe(false);
    expect(r.reasons.some(s => s.includes('POH statique'))).toBe(true);
  });

  it('avion absent → unknown', () => {
    const r = analyzeRunwayCompatibility(RWY, null);
    expect(r.compatible).toBe('unknown');
  });
});

// ⛔ Lot 1.0 (tranche 3, 25/08) : TODA/LDA STRICTES. Avant : la longueur
// physique était prise pour distance déclarée (LDA offerte trop longue dès
// qu'un seuil est décalé), sinon 0 — et une piste sans AUCUNE donnée sortait
// « ✅ compatible ».
describe('Lot 1.0 — distances non publiées : jamais un GO fabriqué', () => {
  it('pas de toda/lda (seulement la longueur) → unknown, sans « marge » chiffrée', () => {
    const r = analyzeRunwayCompatibility({ designation: '04/22', length: 800, surface: 'ASPH' }, AIRCRAFT, { takeoffM: 750, landingM: 650 });
    expect(r.compatible).toBe('unknown');
    expect(r.reasons.some(s => s.includes('non publiée'))).toBe(true);
    expect(r.reasons.some(s => s.includes('marge'))).toBe(false);
    expect(r.todaFeet).toBeNull();
    expect(r.ldaFeet).toBeNull();
  });

  it('toda publiée mais pas la lda → unknown (une seule distance manquante suffit)', () => {
    const r = analyzeRunwayCompatibility({ toda: 800, length: 800, surface: 'ASPH' }, AIRCRAFT, { takeoffM: 750, landingM: 650 });
    expect(r.compatible).toBe('unknown');
  });

  it('piste sans AUCUNE donnée → surtout pas « compatible »', () => {
    const r = analyzeRunwayCompatibility({ surface: 'ASPH' }, AIRCRAFT, null);
    expect(r.compatible).toBe('unknown');
    expect(r.reasons.some(s => s.includes('✅ Piste compatible'))).toBe(false);
  });

  it('NO-GO conservateur : longueur physique < requis (la LDA réelle est ≤ à la longueur)', () => {
    const r = analyzeRunwayCompatibility({ length: 500, surface: 'ASPH' }, AIRCRAFT, { takeoffM: 750, landingM: 650 });
    expect(r.compatible).toBe(false);
    expect(r.reasons.some(s => s.includes('Longueur physique'))).toBe(true);
  });

  it('la comparaison porte sur la LDA déclarée (650), pas la longueur (720)', () => {
    const r = analyzeRunwayCompatibility({ toda: 720, lda: 650, length: 720, surface: 'ASPH' }, AIRCRAFT, { takeoffM: 700, landingM: 700 });
    expect(r.compatible).toBe(false);
    expect(r.reasons.some(s => s.includes('LDA insuffisante') && s.includes('650'))).toBe(true);
  });
});
