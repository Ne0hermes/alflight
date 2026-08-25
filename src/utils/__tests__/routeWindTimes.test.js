// Tests C2 (Lot 0.4) — temps de route corrigés du vent, source unique.
import { describe, it, expect } from 'vitest';
import { computeRouteWindTimes } from '../routeWindTimes';
import { computeLegFuelPlans } from '@features/fuel/utils/legFuelPlan';

// Route plein EST d'environ 60 NM à latitude 45° (1° de lon ≈ 42,4 NM)
const A = { lat: 45, lon: 5, name: 'A' };
const B = { lat: 45, lon: 6.4142, name: 'B' };
const TAS = 100;

const westWind = () => ({ directionDeg: 270, speedKt: 20, source: 'test' }); // vent arrière (route ~090)
const eastWind = () => ({ directionDeg: 90, speedKt: 20, source: 'test' });  // vent de face
const storm = () => ({ directionDeg: 90, speedKt: 120, source: 'test' });    // vent ≥ TAS

describe('computeRouteWindTimes', () => {
  it('sans windProvider : temps à la TAS, windCorrected none', () => {
    const r = computeRouteWindTimes({ waypoints: [A, B], cruiseSpeedKt: TAS });
    expect(r).not.toBeNull();
    expect(r.windCorrected).toBe('none');
    expect(r.effectiveSpeedKt).toBeCloseTo(TAS, 5);
    expect(r.totalTimeMin).toBeCloseTo((r.totalDistanceNM / TAS) * 60, 5);
  });

  it('vent de face : temps PLUS LONG que la TAS (le carburant suit)', () => {
    const tasOnly = computeRouteWindTimes({ waypoints: [A, B], cruiseSpeedKt: TAS });
    const withWind = computeRouteWindTimes({ waypoints: [A, B], cruiseSpeedKt: TAS, windProvider: eastWind });
    expect(withWind.windCorrected).toBe('full');
    expect(withWind.totalTimeMin).toBeGreaterThan(tasOnly.totalTimeMin);
    expect(withWind.effectiveSpeedKt).toBeLessThan(TAS);
  });

  it('vent arrière : temps plus court', () => {
    const withWind = computeRouteWindTimes({ waypoints: [A, B], cruiseSpeedKt: TAS, windProvider: westWind });
    expect(withWind.effectiveSpeedKt).toBeGreaterThan(TAS);
  });

  it('Lot 1.0 — vent INCONNU (provider muet) : compté et exposé, jamais silencieux', () => {
    const r = computeRouteWindTimes({ waypoints: [A, B], cruiseSpeedKt: TAS, windProvider: () => null });
    expect(r.windCorrected).toBe('none');
    expect(r.noWindSegments).toBe(1);
    expect(r.windSegments).toBe(0);
    expect(r.segmentCount).toBe(1);
    expect(r.segments[0].windSource).toBe('none');
    expect(r.effectiveSpeedKt).toBeCloseTo(TAS, 5); // temps air immobile, assumé et dit
  });

  it('Lot 1.0 — vent PARTIEL (2 tronçons, 1 renseigné) : partial + compteurs exacts', () => {
    const C = { lat: 45, lon: 7.8284, name: 'C' };
    // Milieu A-B ≈ lon 5,71 (< 6 → vent connu) ; milieu B-C ≈ lon 7,12 (→ null)
    const provider = (lat, lon) => (lon < 6 ? { directionDeg: 90, speedKt: 20, source: 'test' } : null);
    const r = computeRouteWindTimes({ waypoints: [A, B, C], cruiseSpeedKt: TAS, windProvider: provider });
    expect(r.windCorrected).toBe('partial');
    expect(r.windSegments).toBe(1);
    expect(r.noWindSegments).toBe(1);
    expect(r.untenableSegments).toBe(0);
    expect(r.segmentCount).toBe(2);
  });

  it('vent ≥ TAS : segment intenable SIGNALÉ, temps plancher TAS (jamais inventé)', () => {
    const r = computeRouteWindTimes({ waypoints: [A, B], cruiseSpeedKt: TAS, windProvider: storm });
    expect(r.untenableSegments).toBe(1);
    expect(r.segments[0].windSource).toBe('untenable');
    expect(r.segments[0].gsKt).toBe(TAS);
  });

  it('fail-closed : TAS absente → null', () => {
    expect(computeRouteWindTimes({ waypoints: [A, B], cruiseSpeedKt: null, windProvider: eastWind })).toBeNull();
    expect(computeRouteWindTimes({ waypoints: [A], cruiseSpeedKt: TAS })).toBeNull();
  });
});

describe('computeLegFuelPlans + effectiveSpeedKt (C2)', () => {
  const base = { waypoints: [A, B], cruiseSpeedKt: TAS, fuelConsumptionLph: 30, taxiLtr: 0, finalReserveLtr: 0, alternateLtr: 0 };

  it('vitesse sol effective fournie (vent de face) → trip carburant PLUS ÉLEVÉ', () => {
    const tasPlan = computeLegFuelPlans(base);
    const windPlan = computeLegFuelPlans({ ...base, effectiveSpeedKt: 80 }); // 20 kt de face
    expect(windPlan.legs[0].tripLtr).toBeGreaterThan(tasPlan.legs[0].tripLtr);
    expect(windPlan.legs[0].tripLtr / tasPlan.legs[0].tripLtr).toBeCloseTo(100 / 80, 3);
  });

  it('effectiveSpeedKt null/absent → comportement TAS inchangé', () => {
    const a = computeLegFuelPlans(base);
    const b = computeLegFuelPlans({ ...base, effectiveSpeedKt: null });
    expect(b.legs[0].tripLtr).toBeCloseTo(a.legs[0].tripLtr, 6);
  });
});
