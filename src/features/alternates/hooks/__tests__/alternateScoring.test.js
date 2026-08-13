// Tests des corrections R1-R5 de l'audit du score de déroutement
// (AUDIT_SCORE_DEROUTEMENTS.md, 2026-08-13)
import { describe, it, expect } from 'vitest';
import { scoringUtils } from '../useAlternateScoring';
import { getLandingDistanceM } from '@utils/aircraftPerf';

const { calculateInfrastructureScore, calculateServicesScore, calculateWeatherScore, calculateStrategicPosition } = scoringUtils;

// Avion type DA40 : distance d'atterrissage POH 1 000 ft (≈ 305 m)
const AIRCRAFT = { registration: 'F-TEST', distances: { landingDistance50ft: 1000 } };

const airportWith = (runway) => ({
  icao: 'LFXX',
  runways: [{ length: 1600, width: 30, ...runway }],
});

describe('R3 — getLandingDistanceM (source POH réelle)', () => {
  it('convertit les pieds POH en mètres', () => {
    expect(getLandingDistanceM(AIRCRAFT)).toBeCloseTo(304.8, 1);
  });
  it('null si absente (fail-closed, pas de valeur inventée)', () => {
    expect(getLandingDistanceM({})).toBeNull();
    expect(getLandingDistanceM(null)).toBeNull();
  });
});

describe('R1 — surfaces SIA reconnues', () => {
  it('ASPH (code SIA) est reconnu comme revêtue', () => {
    const paved = calculateInfrastructureScore(airportWith({ surface: 'ASPH' }), { aircraft: AIRCRAFT });
    const grass = calculateInfrastructureScore(airportWith({ surface: 'GRASS' }), { aircraft: AIRCRAFT });
    expect(paved).toBeGreaterThan(grass);
    expect(paved).toBeGreaterThanOrEqual(0.9); // 0,5 piste + 0,16 taille + 0,10 largeur + 0,15 revêtue
  });
  it('les surfaces combinées "CONC+ASPH" sont reconnues', () => {
    const combo = calculateInfrastructureScore(airportWith({ surface: 'CONC+ASPH' }), { aircraft: AIRCRAFT });
    const paved = calculateInfrastructureScore(airportWith({ surface: 'ASPH' }), { aircraft: AIRCRAFT });
    expect(combo).toBe(paved);
  });
});

describe('R3 — besoin de piste basé sur l\'avion réel', () => {
  it('une piste trop courte pour CET avion fait chuter le score', () => {
    const bigAircraft = { registration: 'F-BIG', distances: { landingDistance50ft: 3280 } }; // ~1000 m → besoin 1430 m
    const shortRwy = calculateInfrastructureScore(airportWith({ surface: 'ASPH', length: 1200 }), { aircraft: bigAircraft });
    const okRwy = calculateInfrastructureScore(airportWith({ surface: 'ASPH', length: 1200 }), { aircraft: AIRCRAFT });
    expect(shortRwy).toBeLessThan(okRwy);
  });
});

describe('R2 — services réels SIA branchés', () => {
  it('FUEL du sidecar SIA compte comme carburant', () => {
    const ctx = { servicesByIcao: { LFXX: new Set(['FUEL']) } };
    const withFuel = calculateServicesScore({ icao: 'LFXX', type: 'AD' }, ctx);
    const without = calculateServicesScore({ icao: 'LFXX', type: 'AD' }, { servicesByIcao: {} });
    expect(withFuel - without).toBeCloseTo(0.4, 5);
  });
  it('REPAIR/CUST/HAND comptent en services additionnels', () => {
    const ctx = { servicesByIcao: { LFXX: new Set(['REPAIR', 'CUST', 'HAND']) } };
    const s = calculateServicesScore({ icao: 'LFXX', type: 'AD' }, ctx);
    const base = calculateServicesScore({ icao: 'LFXX', type: 'AD' }, { servicesByIcao: {} });
    expect(s - base).toBeCloseTo(0.10, 5);
  });
});

describe('R4 — météo inconnue = 0,5, jamais un avantage', () => {
  it('sans METAR : 0,5 (était 0,7)', async () => {
    const s = await calculateWeatherScore({ icao: 'LFXX' }, { weather: {} });
    expect(s).toBe(0.5);
  });
  it('un METAR correct note MIEUX que l\'absence de METAR', async () => {
    const goodWeather = {
      LFXX: { metar: { decoded: { visibility: 'CAVOK', clouds: [], wind: { speed: 5 } } } }
    };
    const known = await calculateWeatherScore({ icao: 'LFXX' }, { weather: goodWeather });
    const unknown = await calculateWeatherScore({ icao: 'LFXX' }, { weather: {} });
    expect(known).toBeGreaterThan(unknown);
  });
});

describe('R5 — départ/arrivée : plus de pénalité par construction', () => {
  const ctx = {
    departure: { lat: 45.93, lon: 6.11 },
    arrival: { lat: 45.64, lon: 5.88 },
    departureIcao: 'LFLP',
    arrivalIcao: 'LFLB',
  };
  it('le terrain d\'arrivée reçoit un score neutre-bon (0,6), plus 0', () => {
    const s = calculateStrategicPosition({ icao: 'LFLB', coordinates: { lat: 45.64, lon: 5.88 } }, ctx);
    expect(s).toBe(0.6);
  });
  it('le terrain de départ aussi', () => {
    const s = calculateStrategicPosition({ icao: 'LFLP', coordinates: { lat: 45.93, lon: 6.11 } }, ctx);
    expect(s).toBe(0.6);
  });
});
