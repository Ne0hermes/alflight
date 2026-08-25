// Tests du bilan carburant PAR TRONÇON (cran 3 — escale avitaillement).
import { describe, it, expect } from 'vitest';
import { computeLegFuelPlans } from '../legFuelPlan';

// Route ~240 NM plein est à 47°N ; avion 120 kt / 40 L/h
const A = { name: 'LFAA', icao: 'LFAA', lat: 47.0, lon: 0.0 };
const STOP = { name: 'LFSS', icao: 'LFSS', lat: 47.0, lon: 3.0, fuelStop: true };
const B = { name: 'LFBB', icao: 'LFBB', lat: 47.0, lon: 6.0 };

const BASE = {
  cruiseSpeedKt: 120,
  fuelConsumptionLph: 40,
  taxiLtr: 5,
  finalReserveLtr: 20,
  alternateLtr: 12
};

describe('computeLegFuelPlans', () => {
  it('fail-closed : données avion ou route manquantes → null', () => {
    expect(computeLegFuelPlans({ ...BASE, waypoints: [A] })).toBeNull();
    expect(computeLegFuelPlans({ ...BASE, waypoints: [A, B], cruiseSpeedKt: null })).toBeNull();
    expect(computeLegFuelPlans({ ...BASE, waypoints: [A, B], fuelConsumptionLph: null })).toBeNull();
  });

  it('sans escale : un seul tronçon = bilan classique (dégagement inclus)', () => {
    const r = computeLegFuelPlans({ ...BASE, waypoints: [A, B] });
    expect(r.isMultiLeg).toBe(false);
    expect(r.legs).toHaveLength(1);
    const leg = r.legs[0];
    // ~245 NM → ~2,04 h → ~81,7 L trip ; contingence 5 % ≈ 4,1 L
    expect(leg.tripLtr).toBeGreaterThan(75);
    expect(leg.alternateLtr).toBe(12);
    expect(leg.totalLtr).toBeCloseTo(leg.taxiLtr + leg.tripLtr + leg.contingencyLtr + 20 + 12, 5);
  });

  it('escale : 2 tronçons — roulage/réserve sur CHAQUE, dégagement sur le DERNIER seul', () => {
    const r = computeLegFuelPlans({ ...BASE, waypoints: [A, STOP, B] });
    expect(r.isMultiLeg).toBe(true);
    expect(r.legs).toHaveLength(2);
    const [l1, l2] = r.legs;
    expect(l1.taxiLtr).toBe(5);
    expect(l2.taxiLtr).toBe(5);
    expect(l1.finalReserveLtr).toBe(20);
    expect(l2.finalReserveLtr).toBe(20);
    expect(l1.alternateLtr).toBe(0);   // pas de dégagement sur le tronçon 1
    expect(l2.alternateLtr).toBe(12);  // dégagement à destination finale
    // Chaque demi-tronçon (~122 NM ≈ 41 L trip) est bien plus léger que le vol entier
    expect(l1.totalLtr).toBeLessThan(80);
    expect(r.worstLeg).toBe(l2); // à trip égal, le dégagement rend le 2 plus lourd
  });

  it('Lot 1.0 — dégagement PAR TRONÇON incalculable → null (jamais un faux 0), total null, worstLeg indisponible', () => {
    // alternates non vides + avion sans vitesse ni consommation :
    // computeWorstDiversion renvoie hasComputable:false sur chaque tronçon.
    // L'ancien code écrivait 0 L de dégagement — indistinguable d'un
    // « vérifié suffisant » — et le verdict d'emport passait à tort.
    const r = computeLegFuelPlans({
      ...BASE,
      waypoints: [A, STOP, B],
      alternates: [{ icao: 'LFXX', name: 'Déroutement sans position' }],
      aircraft: {}
    });
    expect(r.isMultiLeg).toBe(true);
    for (const leg of r.legs) {
      expect(leg.alternateLtr).toBeNull();
      expect(leg.totalLtr).toBeNull();
      expect(leg.alternateStatus).toBeTruthy();
    }
    expect(r.incomputableLegs).toBe(2);
    expect(r.worstLeg).toBeNull();
  });

  it('contingence : minimum 1 gal US même sur un tronçon très court', () => {
    const NEAR = { name: 'LFNN', lat: 47.0, lon: 0.15 }; // ~6 NM
    const r = computeLegFuelPlans({ ...BASE, waypoints: [A, NEAR] });
    expect(r.legs[0].contingencyLtr).toBeCloseTo(3.78541, 3);
  });

  it('labels : le tronçon est identifié par ses extrémités', () => {
    const r = computeLegFuelPlans({ ...BASE, waypoints: [A, STOP, B] });
    expect(r.legs[0].label).toBe('LFAA → LFSS');
    expect(r.legs[1].label).toBe('LFSS → LFBB');
  });
});
