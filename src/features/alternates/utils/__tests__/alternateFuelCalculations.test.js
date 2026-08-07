// Tests de l'algorithme validé du carburant de dégagement (Lot 2).
// Géométrie synthétique près de l'équateur : 1° ≈ 60 NM, route plein nord
// le long du méridien 0 → distances prévisibles (tolérances larges pour
// l'orthodromie).
import { describe, it, expect } from 'vitest';
import {
  resolveAlternatePosition,
  projectPointOnSegment,
  findPerpendicularFootOnRoute,
  computeDiversionFuel,
  computeWorstDiversion
} from '../alternateFuelCalculations';

// Avion : 100 kt, 30 L/h → 60 NM = 0,6 h = 18 L
const AIRCRAFT = { cruiseSpeedKt: 100, fuelConsumption: 30 };

// Route 120 NM plein nord : départ {0,0} → arrivée {2,0}
const ROUTE = [
  { lat: 0, lon: 0, type: 'departure' },
  { lat: 2, lon: 0, type: 'arrival' }
];

describe('resolveAlternatePosition', () => {
  it('accepte position, coordinates, lat/lon et lat/lng', () => {
    expect(resolveAlternatePosition({ position: { lat: 1, lon: 2 } })).toEqual({ lat: 1, lon: 2 });
    expect(resolveAlternatePosition({ coordinates: { lat: 1, lon: 2 } })).toEqual({ lat: 1, lon: 2 });
    expect(resolveAlternatePosition({ lat: 1, lon: 2 })).toEqual({ lat: 1, lon: 2 });
    expect(resolveAlternatePosition({ lat: 1, lng: 2 })).toEqual({ lat: 1, lon: 2 });
  });

  it('retourne null si la position est absente ou invalide', () => {
    expect(resolveAlternatePosition({})).toBeNull();
    expect(resolveAlternatePosition({ coordinates: { lat: undefined, lon: undefined } })).toBeNull();
    expect(resolveAlternatePosition(null)).toBeNull();
  });
});

describe('projectPointOnSegment', () => {
  it('projette au milieu pour un point abeam le milieu', () => {
    const proj = projectPointOnSegment({ lat: 1, lon: 0.5 }, ROUTE[0], ROUTE[1]);
    expect(proj.footPoint.lat).toBeCloseTo(1, 1);
    expect(Math.abs(proj.footPoint.lon)).toBeLessThan(0.05);
    expect(proj.alongTrackNM).toBeCloseTo(60, 0);
    expect(proj.distToFootNM).toBeCloseTo(30, 0);
  });

  it('clampe au début pour un point en AMONT du segment (signe along-track)', () => {
    const proj = projectPointOnSegment({ lat: -1, lon: 0.2 }, ROUTE[0], ROUTE[1]);
    expect(proj.alongTrackNM).toBe(0);
    expect(proj.footPoint.lat).toBeCloseTo(0, 5);
  });

  it('clampe à la fin pour un point au-delà du segment', () => {
    const proj = projectPointOnSegment({ lat: 3, lon: 0.2 }, ROUTE[0], ROUTE[1]);
    expect(proj.alongTrackNM).toBeCloseTo(proj.segLenNM, 0);
    expect(proj.footPoint.lat).toBeCloseTo(2, 1);
  });
});

describe('findPerpendicularFootOnRoute', () => {
  it('trouve le pied sur le bon segment d\'une polyligne', () => {
    // Route en L : nord puis est ; déroutement au sud du 2e segment
    const routeL = [
      { lat: 0, lon: 0 },
      { lat: 1, lon: 0 },
      { lat: 1, lon: 2 }
    ];
    const foot = findPerpendicularFootOnRoute({ lat: 0.8, lon: 1 }, routeL);
    expect(foot.segmentIndex).toBe(1);
    expect(foot.footPoint.lon).toBeCloseTo(1, 1);
    // distToArrival ≈ 60 NM restants sur le 2e segment
    expect(foot.distToArrivalNM).toBeCloseTo(60, 0);
  });

  it('retourne null sans route ou sans position', () => {
    expect(findPerpendicularFootOnRoute({ lat: 1, lon: 1 }, [{ lat: 0, lon: 0 }])).toBeNull();
    expect(findPerpendicularFootOnRoute(null, ROUTE)).toBeNull();
    expect(findPerpendicularFootOnRoute({ lat: 1, lon: 1 }, [
      { lat: null, lon: null }, { lat: null, lon: null }
    ])).toBeNull();
  });
});

describe('computeDiversionFuel — algorithme validé', () => {
  it('« carburant suffisant » quand rejoindre le déroutement coûte moins que finir la navigation (B ≤ A)', () => {
    // Déroutement abeam le milieu à ~30 NM : A ≈ 18 L (60 NM), B ≈ 9 L (30 NM)
    const result = computeDiversionFuel({
      alternate: { icao: 'LFXX', position: { lat: 1, lon: 0.5 } },
      waypoints: ROUTE,
      aircraft: AIRCRAFT
    });
    expect(result.status).toBe('ok');
    expect(result.fuelToArrivalLtr).toBeCloseTo(18, 0);   // A
    expect(result.fuelToAlternateLtr).toBeCloseTo(9, 0);  // B
    expect(result.isSufficient).toBe(true);
    expect(result.supplementLtr).toBe(0);
  });

  it('supplément = ceil(B − A) quand le déroutement est plus loin que l\'arrivée', () => {
    // Déroutement abeam le milieu à ~120 NM : A ≈ 18 L, B ≈ 36 L → +18 L
    const result = computeDiversionFuel({
      alternate: { icao: 'LFYY', position: { lat: 1, lon: 2 } },
      waypoints: ROUTE,
      aircraft: AIRCRAFT
    });
    expect(result.status).toBe('ok');
    expect(result.isSufficient).toBe(false);
    expect(result.supplementLtr).toBeGreaterThanOrEqual(17);
    expect(result.supplementLtr).toBeLessThanOrEqual(19);
  });

  it('route en U : retient le pied le plus PÉNALISANT, pas le plus proche (contre-exemple de revue)', () => {
    // Route en U : nord, est, sud — le déroutement au centre a plusieurs
    // travers candidats. Le plus PROCHE (segment médian) donnerait
    // « suffisant » ; le plus pénalisant (3e segment) exige ~+10 L.
    const routeU = [
      { lat: 0, lon: 0 },
      { lat: 2, lon: 0 },
      { lat: 2, lon: 3 },
      { lat: 0, lon: 3 }
    ];
    const result = computeDiversionFuel({
      alternate: { icao: 'LFUU', position: { lat: 1, lon: 1.45 } },
      waypoints: routeU,
      aircraft: AIRCRAFT
    });
    expect(result.status).toBe('ok');
    expect(result.isSufficient).toBe(false);
    expect(result.supplementLtr).toBeGreaterThanOrEqual(9);
    expect(result.supplementLtr).toBeLessThanOrEqual(11);
  });

  it('statuts explicites au lieu de 0 silencieux', () => {
    expect(computeDiversionFuel({
      alternate: { icao: 'LFZZ' }, waypoints: ROUTE, aircraft: AIRCRAFT
    }).status).toBe('missing-position');

    expect(computeDiversionFuel({
      alternate: { icao: 'LFZZ', position: { lat: 1, lon: 1 } },
      waypoints: ROUTE,
      aircraft: {} // ni vitesse ni conso
    }).status).toBe('missing-aircraft-data');

    expect(computeDiversionFuel({
      alternate: { icao: 'LFZZ', position: { lat: 1, lon: 1 } },
      waypoints: [{ lat: 0, lon: 0 }],
      aircraft: AIRCRAFT
    }).status).toBe('missing-route');
  });
});

describe('computeWorstDiversion', () => {
  it('retient le déroutement le plus pénalisant', () => {
    const analysis = computeWorstDiversion({
      alternates: [
        { icao: 'PROCHE', position: { lat: 1, lon: 0.5 } }, // suffisant
        { icao: 'LOIN', position: { lat: 1, lon: 2 } }      // +18 L
      ],
      waypoints: ROUTE,
      aircraft: AIRCRAFT
    });
    expect(analysis.worst.icao).toBe('LOIN');
    expect(analysis.supplementLtr).toBeGreaterThan(0);
    expect(analysis.isSufficient).toBe(false);
  });

  it('supplément 0 et verdict suffisant quand tous les déroutements sont couverts', () => {
    const analysis = computeWorstDiversion({
      alternates: [{ icao: 'PROCHE', position: { lat: 1, lon: 0.5 } }],
      waypoints: ROUTE,
      aircraft: AIRCRAFT
    });
    expect(analysis.supplementLtr).toBe(0);
    expect(analysis.isSufficient).toBe(true);
  });

  it('collecte les erreurs sans jeter, sans déroutement calculable', () => {
    const analysis = computeWorstDiversion({
      alternates: [{ icao: 'SANSPOS' }],
      waypoints: ROUTE,
      aircraft: AIRCRAFT
    });
    expect(analysis.worst).toBeNull();
    expect(analysis.errors[0].status).toBe('missing-position');
    expect(analysis.supplementLtr).toBe(0);
    expect(analysis.hasComputable).toBe(false);
  });
});
