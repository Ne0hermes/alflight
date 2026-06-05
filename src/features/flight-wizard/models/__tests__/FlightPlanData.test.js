// Phase 3 (A4) — le moteur de masse parallèle de FlightPlanData est neutralisé.
// Le centrage (weightBalanceStore + scenarios) est la seule autorité de masse.
import { describe, it, expect } from 'vitest';
import FlightPlanData from '@features/flight-wizard/models/FlightPlanData';

describe('FlightPlanData — moteur de masse parallèle neutralisé (A4)', () => {
  it('calculateWeightBalance ne fabrique plus de masse', () => {
    const fp = new FlightPlanData();
    fp.aircraft = { ...fp.aircraft, emptyWeight: 700, maxWeight: 1100, fuelType: 'JET A-1' };
    fp.fuel = { ...fp.fuel, confirmed: 100, climb: 5, cruise: 20 };
    fp.weightBalance = { ...fp.weightBalance, passengers: 2, passengersWeight: 80, baggage: 10 };
    const before = JSON.stringify(fp.weightBalance);
    fp.calculateWeightBalance();
    // Aucune masse parallèle : les valeurs restent celles fournies (0 par défaut),
    // PAS un recalcul emptyWeight + passagers×poids + carburant×densité.
    expect(fp.weightBalance.takeoffWeight).toBe(0);
    expect(fp.weightBalance.landingWeight).toBe(0);
    expect(JSON.stringify(fp.weightBalance)).toBe(before);
  });

  it('updateWeightBalance fusionne les valeurs du centrage sans recalcul', () => {
    const fp = new FlightPlanData();
    fp.updateWeightBalance({ takeoffWeight: 950, landingWeight: 900, cg: { takeoff: 2.1, landing: 2.0 } });
    expect(fp.weightBalance.takeoffWeight).toBe(950); // valeur du centrage, conservée
    expect(fp.weightBalance.landingWeight).toBe(900);
    expect(fp.weightBalance.cg.landing).toBe(2.0);
  });
});
