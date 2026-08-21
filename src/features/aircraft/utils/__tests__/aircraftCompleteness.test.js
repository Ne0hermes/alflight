// src/features/aircraft/utils/__tests__/aircraftCompleteness.test.js
//
// Pondération des vitesses dans le score de complétude (demande pilote,
// 21/08/2026) : les TROIS vitesses de décrochage à 0° d'inclinaison (VS1 lisse,
// VS T/O décollage, VSO atterrissage) sont obligatoires ; VFE T/O, VX et VY
// deviennent facultatives (pondération faible).

import { describe, it, expect } from 'vitest';
import { FIELD_DEFINITIONS, evaluateAircraft } from '../aircraftCompleteness';

const def = (path) => FIELD_DEFINITIONS.find((f) => f.path === path);

const base = {
  registration: 'F-TEST',
  model: 'Test',
  speeds: { vso: 45, vsTO: 48, vs1: 50, vne: 160, vno: 125, vfeLdg: 85 },
};
const sans = (key) => {
  const speeds = { ...base.speeds };
  delete speeds[key];
  return { ...base, speeds };
};
const paths = (list) => list.map((f) => f.path);

describe('vitesses de décrochage — obligatoires', () => {
  it('VSO, VS T/O et VS1 sont CRITICAL, au même poids', () => {
    for (const p of ['speeds.vso', 'speeds.vsTO', 'speeds.vs1']) {
      expect(def(p), p).toBeDefined();
      expect(def(p).severity, p).toBe('CRITICAL');
      expect(def(p).weight, p).toBe(4);
    }
  });

  it('une fiche sans VS T/O a un manque CRITIQUE « VS T/O »', () => {
    const r = evaluateAircraft(sans('vsTO'));
    expect(paths(r.criticalMissing)).toContain('speeds.vsTO');
    expect(r.hasCriticalGaps).toBe(true);
  });

  it('VS T/O pèse autant que VSO et VS1 dans le score', () => {
    const avec = evaluateAircraft(base).filledWeight;
    expect(avec - evaluateAircraft(sans('vsTO')).filledWeight).toBe(4);
    expect(avec - evaluateAircraft(sans('vso')).filledWeight).toBe(4);
    expect(avec - evaluateAircraft(sans('vs1')).filledWeight).toBe(4);
  });

  it('les colonnes 20/40/60° (stallByBank) sont facultatives et ne comptent pas dans le score', () => {
    expect(FIELD_DEFINITIONS.some((f) => f.path.includes('stallByBank'))).toBe(false);
    const avec = { ...base, speeds: { ...base.speeds, stallByBank: { clean: { b20: 52 } } } };
    expect(evaluateAircraft(avec).filledWeight).toBe(evaluateAircraft(base).filledWeight);
  });
});

describe('VFE T/O, VX, VY — facultatives', () => {
  it('sont OPTIONAL à pondération faible (moins que VR, qui reste REQUIRED)', () => {
    for (const p of ['speeds.vfeTO', 'speeds.vx', 'speeds.vy']) {
      expect(def(p), p).toBeDefined();
      expect(def(p).severity, p).toBe('OPTIONAL');
      expect(def(p).weight, p).toBe(1);
      expect(def(p).weight, p).toBeLessThan(def('speeds.vr').weight);
    }
    expect(def('speeds.vr').severity).toBe('REQUIRED');
  });

  it('leur absence n\'apparaît ni en critique ni en obligatoire', () => {
    const r = evaluateAircraft(base); // vfeTO / vx / vy absents
    for (const p of ['speeds.vfeTO', 'speeds.vx', 'speeds.vy']) {
      expect(paths(r.criticalMissing)).not.toContain(p);
      expect(paths(r.requiredMissing)).not.toContain(p);
      expect(paths(r.missing)).toContain(p); // toujours listée, en « Optionnels »
    }
  });

  it('VFE T/O ne pèse qu\'un point (contre 4 pour une vitesse de décrochage)', () => {
    const avecVfeTO = { ...base, speeds: { ...base.speeds, vfeTO: 90 } };
    expect(evaluateAircraft(avecVfeTO).filledWeight - evaluateAircraft(base).filledWeight).toBe(1);
  });
});
