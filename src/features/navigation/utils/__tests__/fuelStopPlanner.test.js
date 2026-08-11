// Tests du planificateur d'escale carburant (Lot 8 — crans 1+2).
// Cas de référence utilisateur : navigation demandant 88 L pour 85 L
// embarquables → alerte, puis escale qui coupe le vol en tronçons tenables.
import { describe, it, expect } from 'vitest';
import { splitLegsAtFuelStops, analyzeFuelAutonomy, findFuelStopCandidates, assessRouteFuelWaypoint } from '../fuelStopPlanner';

// Route ~240 NM plein est à 47°N (1° de longitude ≈ 40,9 NM à cette latitude)
const A = { name: 'LFAA', icao: 'LFAA', lat: 47.0, lon: 0.0 };
const M = { name: 'MID', lat: 47.0, lon: 3.0 };
const B = { name: 'LFBB', icao: 'LFBB', lat: 47.0, lon: 6.0 };

// Avion : 120 kt, 40 L/h, réserve 20 L → 240 NM ≈ 2 h ≈ 80 L + 20 = 100 L requis
const AIRCRAFT = { cruiseSpeedKt: 120, fuelConsumptionLph: 40 };

describe('analyzeFuelAutonomy', () => {
  it('fail-closed : données avion manquantes → no-data (ni alerte ni feu vert)', () => {
    expect(analyzeFuelAutonomy({
      waypoints: [A, B], cruiseSpeedKt: null, fuelConsumptionLph: 40, reserveLiters: 20, capacityLtr: 100
    }).status).toBe('no-data');
    expect(analyzeFuelAutonomy({
      waypoints: [A, B], cruiseSpeedKt: 120, fuelConsumptionLph: 40, reserveLiters: 20, capacityLtr: null
    }).status).toBe('no-data');
    expect(analyzeFuelAutonomy({
      waypoints: [A], cruiseSpeedKt: 120, fuelConsumptionLph: 40, reserveLiters: 20, capacityLtr: 100
    }).status).toBe('no-data');
  });

  it('capacité suffisante → ok', () => {
    const r = analyzeFuelAutonomy({
      waypoints: [A, B], ...AIRCRAFT, reserveLiters: 20, capacityLtr: 150
    });
    expect(r.status).toBe('ok');
    expect(r.worstLeg).toBeNull();
    expect(r.legs).toHaveLength(1);
  });

  it('trip + réserve > capacité → insufficient avec le tronçon en défaut', () => {
    const r = analyzeFuelAutonomy({
      waypoints: [A, M, B], ...AIRCRAFT, reserveLiters: 20, capacityLtr: 85
    });
    expect(r.status).toBe('insufficient');
    expect(r.worstLeg).not.toBeNull();
    expect(r.worstLeg.requiredLtr).toBeGreaterThan(85);
    // Requis = trip + contingence (5 %, min 1 gal) + réserve finale (+ roulage/
    // dégagement si fournis — 0 ici) : même critère que le bilan par tronçon
    const expectedContingency = Math.max(3.78541, r.worstLeg.tripLtr * 0.05);
    expect(r.worstLeg.requiredLtr).toBeCloseTo(r.worstLeg.tripLtr + expectedContingency + 20, 5);
  });

  it('une escale fuelStop coupe le calcul par tronçon : chaque moitié tient', () => {
    const stop = { ...M, icao: 'LFMM', fuelStop: true };
    const r = analyzeFuelAutonomy({
      waypoints: [A, stop, B], ...AIRCRAFT, reserveLiters: 20, capacityLtr: 85
    });
    // Chaque tronçon ≈ 120 NM ≈ 1 h ≈ 40 L + 20 = 60 L ≤ 85 L
    expect(r.status).toBe('ok');
    expect(r.legs).toHaveLength(2);
    r.legs.forEach(l => expect(l.fits).toBe(true));
  });

  it('escale présente mais un tronçon reste trop long → insufficient sur CE tronçon', () => {
    const earlyStop = { name: 'LFSS', icao: 'LFSS', lat: 47.0, lon: 0.5, fuelStop: true };
    const r = analyzeFuelAutonomy({
      waypoints: [A, earlyStop, B], ...AIRCRAFT, reserveLiters: 20, capacityLtr: 85
    });
    expect(r.status).toBe('insufficient');
    expect(r.worstLeg.from.icao).toBe('LFSS'); // le grand tronçon restant
  });
});

describe('splitLegsAtFuelStops', () => {
  it('sans escale : un seul tronçon, startIndex 0', () => {
    const legs = splitLegsAtFuelStops([A, M, B]);
    expect(legs).toHaveLength(1);
    expect(legs[0].startIndex).toBe(0);
    expect(legs[0].waypoints).toHaveLength(3);
  });

  it('escale au milieu : deux tronçons partageant le waypoint-escale', () => {
    const stop = { ...M, fuelStop: true };
    const legs = splitLegsAtFuelStops([A, stop, B]);
    expect(legs).toHaveLength(2);
    expect(legs[0].waypoints).toEqual([A, stop]);
    expect(legs[1].waypoints).toEqual([stop, B]);
    expect(legs[1].startIndex).toBe(1);
  });

  it('fuelStop sur départ/arrivée : ignoré (pas de tronçon vide)', () => {
    const legs = splitLegsAtFuelStops([{ ...A, fuelStop: true }, B]);
    expect(legs).toHaveLength(1);
  });
});

describe('findFuelStopCandidates', () => {
  const leg = { waypoints: [A, B], startIndex: 0 };
  const mkApt = (icao, lat, lon, fuel = true) => ({
    icao, name: icao, lat, lon, services: { fuel }
  });

  it('ne retient que les aérodromes AVEC avitaillement, dans le corridor et la fenêtre utile', () => {
    const airports = [
      mkApt('LFOK', 47.05, 3.0),          // ~3 NM de la route, à 50 % — parfait
      mkApt('LFNF', 47.05, 3.0, false),   // pas d'avitaillement → exclu
      mkApt('LFFA', 47.6, 3.0),           // ~36 NM de la route → exclu (> 15)
      mkApt('LFEA', 47.02, 0.3)           // à ~5 % du tronçon → hors fenêtre
    ];
    const r = findFuelStopCandidates({ airports, leg });
    expect(r.map(c => c.icao)).toEqual(['LFOK']);
    expect(r[0].distToRouteNM).toBeLessThan(5);
    expect(r[0].fraction).toBeGreaterThan(0.4);
    expect(r[0].fraction).toBeLessThan(0.6);
  });

  it('trie par proximité du milieu du tronçon puis par détour', () => {
    // NB : ICAO à 4 LETTRES obligatoires (LF70 serait rejeté par le filtre)
    const airports = [
      mkApt('LFGC', 47.05, 4.2),  // ~70 %
      mkApt('LFGA', 47.05, 3.0),  // ~50 % → premier
      mkApt('LFGB', 47.05, 2.1)   // ~35 %
    ];
    const r = findFuelStopCandidates({ airports, leg });
    expect(r[0].icao).toBe('LFGA');
    expect(r).toHaveLength(3);
  });

  it('exclut les aérodromes déjà présents dans la route', () => {
    const airports = [mkApt('LFAA', 47.0, 0.02), mkApt('LFOK', 47.05, 3.0)];
    const r = findFuelStopCandidates({ airports, leg });
    expect(r.map(c => c.icao)).toEqual(['LFOK']);
  });

  it('insertAfterGlobalIndex pointe le bon segment (route multi-waypoints)', () => {
    const multiLeg = { waypoints: [A, M, B], startIndex: 0 };
    // Proche du 2e segment (M→B), à ~70 % du tronçon (dans la fenêtre 25-75 %)
    const airports = [mkApt('LFOK', 47.05, 4.2)];
    const r = findFuelStopCandidates({ airports, leg: multiLeg });
    expect(r).toHaveLength(1);
    expect(r[0].insertAfterGlobalIndex).toBe(1); // insérer après M
  });

  it('fail-closed : tronçon invalide ou vide → []', () => {
    expect(findFuelStopCandidates({ airports: [mkApt('LFOK', 47.05, 3.0)], leg: null })).toEqual([]);
    expect(findFuelStopCandidates({ airports: [], leg })).toEqual([]);
  });

  // 🔧 REVUE LOT 8 — forme RÉELLE des providers : les aérodromes GeoJSON n'ont
  // NI services NI fuel → exclus tels quels (fail-closed), proposés uniquement
  // après enrichissement explicite (couche services SIA type FUEL)
  it('objet de production sans champ services/fuel → exclu ; enrichi → proposé', () => {
    const productionShape = { icao: 'LFOK', name: 'Terrain', lat: 47.05, lon: 3.0, elevation: 300, runways: [] };
    expect(findFuelStopCandidates({ airports: [productionShape], leg })).toEqual([]);
    const enriched = { ...productionShape, services: { fuel: true } };
    expect(findFuelStopCandidates({ airports: [enriched], leg }).map(c => c.icao)).toEqual(['LFOK']);
  });

  // 🔧 REVUE LOT 8 — le départ/arrivée du VOL COMPLET ne doit jamais être
  // proposé, même s'il est hors du tronçon en défaut
  it('routeWaypoints : exclut le départ du vol pour un tronçon 2 en défaut', () => {
    const S = { name: 'LFSS', icao: 'LFSS', lat: 47.0, lon: 0.5, fuelStop: true };
    const leg2 = { waypoints: [S, B], startIndex: 1 };
    // LFAA (départ du vol) géographiquement dans la fenêtre du tronçon 2 ?
    // Peu importe : il doit être exclu par identifiant.
    const airports = [mkApt('LFAA', 47.05, 3.2), mkApt('LFOK', 47.05, 3.2)];
    const r = findFuelStopCandidates({ airports, leg: leg2, routeWaypoints: [A, S, B] });
    expect(r.map(c => c.icao)).toEqual(['LFOK']);
  });
});

describe('assessRouteFuelWaypoint (lot 10-C — avitailler à un aérodrome DU trajet)', () => {
  // Route A → M (aérodrome avitaillable du trajet) → B ; 120 kt / 40 L/h
  const MID = { name: 'LFQE', icao: 'LFQE', lat: 47.0, lon: 3.0 };
  const P = {
    waypoints: [A, MID, B],
    cruiseSpeedKt: 120,
    fuelConsumptionLph: 40,
    reserveLiters: 20,
    capacityLtr: 85,
    taxiLtr: 5
  };

  it('calcule consommation, restant (pleins au départ) et litres minimum à avitailler', () => {
    const r = assessRouteFuelWaypoint({ ...P, waypoint: MID });
    // ~122 NM ≈ 1,02 h ≈ 41 L + 5 L roulage ≈ 46 L consommés
    expect(r.consumedToWpLtr).toBeGreaterThan(40);
    expect(r.consumedToWpLtr).toBeLessThan(55);
    expect(r.remainingAtWpLtr).toBeCloseTo(85 - r.consumedToWpLtr, 5);
    // Reste du vol : ~41 L trip + contingence + 20 réserve + 5 roulage ≈ 70 L
    expect(r.requiredRestLtr).toBeGreaterThan(60);
    // Minimum à avitailler = besoin restant − restant à bord
    expect(r.minRefuelLtr).toBeCloseTo(Math.max(0, r.requiredRestLtr - r.remainingAtWpLtr), 5);
    expect(r.reachable).toBe(true);
  });

  it('restant suffisant pour finir → 0 L à avitailler (pas de chiffre négatif)', () => {
    const r = assessRouteFuelWaypoint({ ...P, capacityLtr: 300, waypoint: MID });
    expect(r.minRefuelLtr).toBe(0);
  });

  it('point hors de portée même pleins → reachable=false', () => {
    const r = assessRouteFuelWaypoint({ ...P, capacityLtr: 30, waypoint: MID });
    expect(r.reachable).toBe(false);
  });

  // 🔧 REVUE LOT 10 — le point est atteignable mais même le plein complet ne
  // couvre pas la SUITE : ne pas proposer « avitaillez X L » (impossible)
  it('suite du vol > capacité → restFits=false (pas de bouton Marquer)', () => {
    const NEAR = { name: 'LFNR', icao: 'LFNR', lat: 47.0, lon: 1.0 };  // ~41 NM
    const FAR = { name: 'LFFR', icao: 'LFFR', lat: 47.0, lon: 8.0 };   // ~286 NM restants
    const r = assessRouteFuelWaypoint({
      ...P, waypoints: [A, NEAR, FAR], waypoint: NEAR
    });
    expect(r.reachable).toBe(true);
    expect(r.requiredRestLtr).toBeGreaterThan(85);
    expect(r.restFits).toBe(false);
    // Et sur le cas nominal, restFits est vrai
    expect(assessRouteFuelWaypoint({ ...P, waypoint: MID }).restFits).toBe(true);
  });

  // 🔧 REVUE LOT 10 — conso depuis le DERNIER plein : une escale marquée en
  // AMONT remet les réservoirs à plein, le cumul depuis le départ était faux
  it('escale marquée en amont → consommation comptée depuis cette escale', () => {
    const STOP1 = { name: 'LFS1', icao: 'LFS1', lat: 47.0, lon: 1.5, fuelStop: true };
    const W = { name: 'LFWW', icao: 'LFWW', lat: 47.0, lon: 4.5 };
    const END = { name: 'LFEE', icao: 'LFEE', lat: 47.0, lon: 6.0 };
    const r = assessRouteFuelWaypoint({ ...P, waypoints: [A, STOP1, W, END], waypoint: W });
    // Tronçon STOP1→W ≈ 122 NM ≈ 41 L + 5 roulage ≈ 46 L — PAS ~87 L depuis A
    expect(r.consumedToWpLtr).toBeLessThan(55);
    expect(r.consumedToWpLtr).toBeGreaterThan(40);
  });

  it('fail-closed : waypoint absent de la route ou capacité manquante → null', () => {
    expect(assessRouteFuelWaypoint({ ...P, waypoint: { ...MID } })).toBeNull(); // autre référence
    expect(assessRouteFuelWaypoint({ ...P, waypoint: MID, capacityLtr: null })).toBeNull();
  });
});

describe('getFuelCapacityLtr (via analyzeFuelAutonomy — convention litres)', () => {
  it('capacité 55 L (ULM) reste 55 L : l\'alerte se déclenche bien', async () => {
    const { getFuelCapacityLtr } = await import('@utils/aircraftPerf');
    expect(getFuelCapacityLtr({ fuelCapacity: 55 })).toBe(55);
    expect(getFuelCapacityLtr({ fuel: { capacity: 110 } })).toBe(110);
    expect(getFuelCapacityLtr({})).toBeNull();
    expect(getFuelCapacityLtr(null)).toBeNull();
  });
});
