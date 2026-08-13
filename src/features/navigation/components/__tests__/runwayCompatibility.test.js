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
