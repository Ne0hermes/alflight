// SSOT « type de vol » & réserve réglementaire — @core/flightType.
// Verrouille le calculateur canonique unique (EASA NCO.OP.125) et les mappings
// de vocabulaire entre le store canonique (jour/nuit · VFR/IFR · local/navigation)
// et la projection generalInfo du wizard (day/night · VFR/IFR · local/navigation).

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FLIGHT_TYPE,
  BASE_RESERVE_MINUTES,
  NIGHT_RESERVE_MINUTES,
  IFR_SUPPLEMENT_MINUTES,
  computeRegulatoryReserveMinutes,
  computeRegulatoryReserveLiters,
  generalInfoToFlightType,
  flightTypeToGeneralInfo,
} from '@core/flightType';

describe('computeRegulatoryReserveMinutes — calculateur réglementaire unique', () => {
  it('VFR jour → 30 min (base)', () => {
    expect(computeRegulatoryReserveMinutes({ period: 'jour', rules: 'VFR', category: 'navigation' }))
      .toBe(30);
  });

  it('VFR nuit → 45 min', () => {
    expect(computeRegulatoryReserveMinutes({ period: 'nuit', rules: 'VFR', category: 'navigation' }))
      .toBe(45);
  });

  it('IFR jour → 45 min (30 + 15)', () => {
    expect(computeRegulatoryReserveMinutes({ period: 'jour', rules: 'IFR', category: 'navigation' }))
      .toBe(45);
  });

  it('IFR nuit → 60 min (45 + 15)', () => {
    expect(computeRegulatoryReserveMinutes({ period: 'nuit', rules: 'IFR', category: 'navigation' }))
      .toBe(60);
  });

  it('vol local de jour → 30 min (et non 20 : conformité NCO.OP.125)', () => {
    expect(computeRegulatoryReserveMinutes({ period: 'jour', rules: 'VFR', category: 'local' }))
      .toBe(30);
  });

  it('local ne réduit jamais le minimum (ni de jour ni de nuit)', () => {
    expect(computeRegulatoryReserveMinutes({ period: 'nuit', rules: 'VFR', category: 'local' }))
      .toBe(45);
  });

  it('flightType partiel/absent → base VFR jour (jamais NaN)', () => {
    expect(computeRegulatoryReserveMinutes(undefined)).toBe(30);
    expect(computeRegulatoryReserveMinutes({})).toBe(30);
    expect(computeRegulatoryReserveMinutes({ rules: 'IFR' })).toBe(45);
  });

  it('les constantes exportées correspondent aux valeurs réglementaires', () => {
    expect(BASE_RESERVE_MINUTES).toBe(30);
    expect(NIGHT_RESERVE_MINUTES).toBe(45);
    expect(IFR_SUPPLEMENT_MINUTES).toBe(15);
  });
});

describe('computeRegulatoryReserveLiters — fail-closed sur la consommation', () => {
  it('conso connue → litres = (min/60) × conso', () => {
    // 45 min à 30 L/h = 22.5 L
    expect(computeRegulatoryReserveLiters({ period: 'nuit', rules: 'VFR' }, 30)).toBeCloseTo(22.5, 5);
    // 30 min à 24 L/h = 12 L
    expect(computeRegulatoryReserveLiters({ period: 'jour', rules: 'VFR' }, 24)).toBeCloseTo(12, 5);
  });

  it('conso absente (null/undefined) → null (pas de litres fabriqués)', () => {
    expect(computeRegulatoryReserveLiters({ period: 'nuit' }, null)).toBeNull();
    expect(computeRegulatoryReserveLiters({ period: 'nuit' }, undefined)).toBeNull();
  });
});

describe('mapping vocabulaire SSOT ⇄ generalInfo', () => {
  it('generalInfo → flightType (day/night → jour/nuit, valeurs partagées sinon)', () => {
    expect(generalInfoToFlightType({ dayNight: 'night', flightType: 'IFR', flightNature: 'local' }))
      .toEqual({ period: 'nuit', rules: 'IFR', category: 'local' });
    expect(generalInfoToFlightType({ dayNight: 'day', flightType: 'VFR', flightNature: 'navigation' }))
      .toEqual({ period: 'jour', rules: 'VFR', category: 'navigation' });
  });

  it('generalInfo vide → défaut canonique (jour/VFR/navigation)', () => {
    expect(generalInfoToFlightType({})).toEqual({ ...DEFAULT_FLIGHT_TYPE });
    expect(generalInfoToFlightType(undefined)).toEqual({ ...DEFAULT_FLIGHT_TYPE });
  });

  it('flightType → generalInfo (nuit/jour → night/day)', () => {
    expect(flightTypeToGeneralInfo({ period: 'nuit', rules: 'VFR', category: 'navigation' }))
      .toEqual({ dayNight: 'night', flightType: 'VFR', flightNature: 'navigation' });
  });

  it('round-trip generalInfo → flightType → generalInfo est stable', () => {
    const gi = { dayNight: 'night', flightType: 'IFR', flightNature: 'local' };
    expect(flightTypeToGeneralInfo(generalInfoToFlightType(gi))).toEqual(gi);
  });
});

describe('parité wizard — le bug d’origine est verrouillé', () => {
  it('un plan « nuit » saisi en Step1 (generalInfo) donne bien 45 min de réserve', () => {
    // Reproduit le chemin prép de vol : Step1 écrit la SSOT depuis generalInfo,
    // la réserve en dérive. Avant le fix, « nuit » était inatteignable (radio désactivé)
    // et même forcé n’avait aucun effet (generalInfo n’était lu par aucun calcul vivant).
    const ft = generalInfoToFlightType({ dayNight: 'night', flightType: 'VFR', flightNature: 'navigation' });
    expect(computeRegulatoryReserveMinutes(ft)).toBe(45);
  });

  it('local et navigation ne divergent pas (même base 30 min de jour)', () => {
    const local = generalInfoToFlightType({ dayNight: 'day', flightType: 'VFR', flightNature: 'local' });
    const nav = generalInfoToFlightType({ dayNight: 'day', flightType: 'VFR', flightNature: 'navigation' });
    expect(computeRegulatoryReserveMinutes(local)).toBe(computeRegulatoryReserveMinutes(nav));
    expect(computeRegulatoryReserveMinutes(local)).toBe(30);
  });
});
