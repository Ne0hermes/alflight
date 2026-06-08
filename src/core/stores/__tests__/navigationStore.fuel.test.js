// Cluster 2 — vitesse/conso fail-closed dans calculateNavigationResults.
// La fonction est interne au module ; on la teste via le getter du store
// getNavigationResults(selectedAircraft). Vérifie qu'AUCUNE vitesse (100 kt) ni
// conso (30 L/h) n'est fabriquée : donnée absente ⇒ temps/carburant = null, mais
// la DISTANCE reste calculable.

import { describe, it, expect } from 'vitest';
import { useNavigationStore } from '@core/stores/navigationStore';

// ~102 NM entre les deux points (≈ 1.7° de latitude).
const WPTS = [
  { id: 1, name: 'DEP', lat: 48.7, lon: 2.1, type: 'departure' },
  { id: 2, name: 'ARR', lat: 47.0, lon: 2.0, type: 'arrival' },
];
const FLIGHT = { period: 'jour', rules: 'VFR', category: 'voyage' };

const results = (aircraft) => {
  useNavigationStore.setState({ waypoints: WPTS, flightType: FLIGHT });
  return useNavigationStore.getState().getNavigationResults(aircraft);
};

describe('calculateNavigationResults — vitesse/conso fail-closed (cluster 2)', () => {
  it('avion complet (vitesse + conso) → temps & carburant calculés', () => {
    const r = results({ cruiseSpeedKt: 110, fuelConsumption: 30 });
    expect(r).not.toBeNull();
    expect(r.totalDistance).toBeGreaterThan(0);
    expect(typeof r.totalTime).toBe('number');
    expect(r.totalTime).toBeGreaterThan(0);
    expect(typeof r.fuelRequired).toBe('number');
    expect(r.cruiseSpeed).toBe(110);
    expect(r.fuelConsumption).toBe(30);
    expect(typeof r.regulationReserveLiters).toBe('number');
  });

  it('vitesse de croisière absente → totalTime/fuelRequired null (pas de 100 kt fabriqué)', () => {
    const r = results({ fuelConsumption: 30 });
    expect(r).not.toBeNull();
    expect(r.cruiseSpeed).toBeNull();
    expect(r.totalTime).toBeNull();
    expect(r.fuelRequired).toBeNull();
    expect(r.totalDistance).toBeGreaterThan(0); // la distance reste calculable
  });

  it('consommation absente → fuelRequired/regulationReserveLiters null (pas de 30 L/h fabriqué)', () => {
    const r = results({ cruiseSpeedKt: 110 });
    expect(r.fuelConsumption).toBeNull();
    expect(r.fuelRequired).toBeNull();
    expect(r.regulationReserveLiters).toBeNull();
    expect(typeof r.totalTime).toBe('number'); // le temps reste calculable (vitesse OK)
  });
});

describe('calculateNavigationResults — réserve réglementaire (conformité NCO.OP.125)', () => {
  const AC = { cruiseSpeedKt: 110, fuelConsumption: 30 };

  it('vol local de jour → 30 min (et non 20 : correctif conformité)', () => {
    useNavigationStore.setState({ waypoints: WPTS, flightType: { period: 'jour', rules: 'VFR', category: 'local' } });
    const r = useNavigationStore.getState().getNavigationResults(AC);
    expect(r.regulationReserveMinutes).toBe(30);
  });

  it('vol de nuit → 45 min', () => {
    useNavigationStore.setState({ waypoints: WPTS, flightType: { period: 'nuit', rules: 'VFR', category: 'navigation' } });
    const r = useNavigationStore.getState().getNavigationResults(AC);
    expect(r.regulationReserveMinutes).toBe(45);
  });

  it('IFR → +15 min (45 de jour)', () => {
    useNavigationStore.setState({ waypoints: WPTS, flightType: { period: 'jour', rules: 'IFR', category: 'navigation' } });
    const r = useNavigationStore.getState().getNavigationResults(AC);
    expect(r.regulationReserveMinutes).toBe(45);
  });
});
