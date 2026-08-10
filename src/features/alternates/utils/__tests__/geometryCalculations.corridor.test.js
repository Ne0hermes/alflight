// Tests de la zone CORRIDOR (Lot 7) — bande ± radius NM autour de la
// polyligne de navigation. Scénarios issus de la revue adversariale :
// le défaut historique de calculateDistanceToSegment (along-track jamais
// négatif) incluait à tort des aérodromes situés DERRIÈRE une extrémité.
import { describe, it, expect } from 'vitest';
import { isAirportInSearchZone } from '../geometryCalculations';

const corridorZone = (routePoints, radius) => ({
  type: 'corridor',
  routePoints,
  radius,
  departure: routePoints[0],
  arrival: routePoints[routePoints.length - 1]
});

describe('isAirportInSearchZone — corridor', () => {
  const A = { lat: 47.0, lon: 0.0 };
  const B = { lat: 47.0, lon: 1.5 }; // ~61 NM à l'est de A
  const C = { lat: 48.0, lon: 1.5 }; // ~60 NM au nord de B

  it('inclut un aérodrome proche de la route (distance perpendiculaire)', () => {
    // ~9 NM au nord du milieu de A-B
    const airport = { icao: 'LFXX', position: { lat: 47.15, lon: 0.75 } };
    const r = isAirportInSearchZone(airport, corridorZone([A, B], 25));
    expect(r.isInZone).toBe(true);
    expect(r.location).toBe('corridor');
    expect(r.distanceToRoute).toBeLessThan(10);
  });

  it('EXCLUT un aérodrome loin DERRIÈRE le départ (défaut along-track corrigé)', () => {
    // ~40 NM à l'ouest de A, 5 NM au nord : distance réelle à la route ≈ 40 NM
    const airport = { icao: 'LFYY', position: { lat: 47.083, lon: -1.0 } };
    const r = isAirportInSearchZone(airport, corridorZone([A, B], 25));
    expect(r.isInZone).toBe(false);
    expect(r.distanceToRoute).toBeGreaterThan(30);
  });

  it('virage à 90° : un point au sud du coude est mesuré au COUDE, pas projeté', () => {
    // ~31 NM au sud de B : le segment B→C ne doit PAS le rapporter à ~8 NM
    const airport = { icao: 'LFZZ', position: { lat: 46.48, lon: 1.5 } };
    const r = isAirportInSearchZone(airport, corridorZone([A, B, C], 25));
    expect(r.isInZone).toBe(false);
    expect(r.distanceToRoute).toBeGreaterThan(28);
  });

  it('corridor très étroit (1 NM) : seuls les points quasi sur la route passent', () => {
    // NB : l'orthodromie A→B passe ~0,14 NM au nord du parallèle 47° en son
    // milieu — un corridor de 0 NM strict ne retiendrait donc RIEN, comportement
    // assumé du curseur à 0.
    const onRoute = { icao: 'LFON', position: { lat: 47.0, lon: 0.75 } };
    const near = { icao: 'LFNE', position: { lat: 47.1, lon: 0.75 } }; // ~6 NM
    expect(isAirportInSearchZone(onRoute, corridorZone([A, B], 1)).isInZone).toBe(true);
    expect(isAirportInSearchZone(near, corridorZone([A, B], 1)).isInZone).toBe(false);
  });

  it('polyligne : la distance retenue est le MIN sur tous les segments', () => {
    // Proche du segment B→C (~6 NM à l'est), loin de A→B
    const airport = { icao: 'LFMN', position: { lat: 47.5, lon: 1.65 } };
    const r = isAirportInSearchZone(airport, corridorZone([A, B, C], 15));
    expect(r.isInZone).toBe(true);
    expect(r.distanceToRoute).toBeLessThan(10);
  });

  it('fail-closed : route à un seul point ou radius absent → hors zone', () => {
    const airport = { icao: 'LFAA', position: { lat: 47.0, lon: 0.1 } };
    expect(isAirportInSearchZone(airport, corridorZone([A], 25)).isInZone).toBe(false);
    expect(isAirportInSearchZone(airport, { type: 'corridor', routePoints: [A, B], radius: null, departure: A, arrival: B }).isInZone).toBe(false);
  });
});
