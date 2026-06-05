// Phase 2 (A2/A3) — enveloppe de centrage réelle (interpolée), pas un rectangle.
import { describe, it, expect } from 'vitest';
import {
  cgLimitsAtMass,
  isWithinEnvelope,
  envelopeWeightRange,
  buildEnvelopePolygon,
} from '@utils/cgEnvelope';

describe('cgLimitsAtMass — courbe avant variable (A2)', () => {
  const env = { forwardPoints: [{ weight: 600, cg: 2.05 }, { weight: 1000, cg: 1.95 }], aftCG: 2.60 };
  it('interpole la limite avant entre les points', () => {
    expect(cgLimitsAtMass(env, 800).forward).toBeCloseTo(2.00, 6); // milieu
    expect(cgLimitsAtMass(env, 1000).forward).toBeCloseTo(1.95, 6);
    expect(cgLimitsAtMass(env, 600).forward).toBeCloseTo(2.05, 6);
  });
  it('clamp hors plage', () => {
    expect(cgLimitsAtMass(env, 400).forward).toBeCloseTo(2.05, 6);
    expect(cgLimitsAtMass(env, 1200).forward).toBeCloseTo(1.95, 6);
  });
  it('T7 — corrige le faux verdict du rectangle figé', () => {
    // À 1000 kg la limite avant réelle = 1.95 ; l'ancien moteur utilisait
    // forwardPoints[0].cg = 2.05 → un CG de 1.98 était jugé HORS limites à tort.
    expect(isWithinEnvelope(env, 1000, 1.98)).toBe(true); // 1.98 >= 1.95 (réel)
  });
});

describe('cgLimitsAtMass — modèle arrière 2-points (A3)', () => {
  const env = {
    forwardPoints: [{ weight: 600, cg: 1.90 }],
    aftMinWeight: 600, aftMinCG: 2.30,
    aftMaxWeight: 1100, aftMaxCG: 2.60,
    aftCG: 2.60, // legacy
  };
  it('interpole la limite arrière par masse', () => {
    expect(cgLimitsAtMass(env, 600).aft).toBeCloseTo(2.30, 6);
    expect(cgLimitsAtMass(env, 1100).aft).toBeCloseTo(2.60, 6);
    expect(cgLimitsAtMass(env, 850).aft).toBeCloseTo(2.45, 6); // milieu
  });
  it('T6 — à basse masse, limite arrière réelle (2.30) < legacy (2.60)', () => {
    // Un CG de 2.45 à 600 kg est HORS limites (réel 2.30) alors que l'ancien
    // moteur (aftCG constant 2.60) le jugeait DANS les limites.
    expect(isWithinEnvelope(env, 600, 2.45)).toBe(false); // 2.45 > 2.30
    expect(isWithinEnvelope(env, 1100, 2.45)).toBe(true); // 2.45 < 2.60
  });
});

describe('cgLimitsAtMass — rétro-compat & absence', () => {
  it('aftCG legacy seul → limite arrière constante', () => {
    const env = { forwardPoints: [{ weight: 600, cg: 1.9 }, { weight: 1100, cg: 2.0 }], aftCG: 2.5 };
    expect(cgLimitsAtMass(env, 600).aft).toBeCloseTo(2.5, 6);
    expect(cgLimitsAtMass(env, 1100).aft).toBeCloseTo(2.5, 6);
  });
  it('limites scalaires {forward, aft} si pas de points', () => {
    const r = cgLimitsAtMass({ forward: 1.95, aft: 2.5 }, 900);
    expect(r.forward).toBe(1.95);
    expect(r.aft).toBe(2.5);
    expect(r.source).toBe('legacy');
  });
  it('enveloppe absente → source missing, verdict null (jamais « OK »)', () => {
    expect(cgLimitsAtMass({}, 900).source).toBe('missing');
    expect(isWithinEnvelope({}, 900, 2.0)).toBeNull();
    expect(isWithinEnvelope(null, 900, 2.0)).toBeNull();
  });
  it('envelopeWeightRange + buildEnvelopePolygon', () => {
    const env = {
      forwardPoints: [{ weight: 600, cg: 1.9 }, { weight: 1100, cg: 2.0 }],
      aftMaxWeight: 1100, aftMaxCG: 2.6, aftMinWeight: 600, aftMinCG: 2.3,
    };
    expect(envelopeWeightRange(env)).toEqual({ min: 600, max: 1100 });
    const poly = buildEnvelopePolygon(env);
    expect(poly.length).toBe(4); // 2 avant + 2 arrière
    expect(poly[0]).toMatchObject({ w: 600, cg: 1.9 });
  });
});
