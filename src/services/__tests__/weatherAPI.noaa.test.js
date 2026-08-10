// Tests du mapping NOAA aviationweather.gov → contrat `decoded` AVWX (Lot 6-C).
// Pièges d'unités couverts : visibilité en statute miles (string "10+" possible),
// obsTime en epoch SECONDES, plafonds déjà en pieds, wdir "VRB"/0.
import { describe, it, expect } from 'vitest';
import { mapNoaaMetar } from '../weatherAPI';

// METAR NOAA type (champs réels de /api/data/metar?format=json)
const NOAA_METAR = {
  icaoId: 'LFPO',
  rawOb: 'LFPO 101300Z 27010KT 9999 FEW040 21/12 Q1018',
  obsTime: 1770730980, // epoch SECONDES
  wdir: 270,
  wspd: 10,
  wgst: null,
  visib: '6+',
  temp: 21.3,
  dewp: 12.1,
  altim: 1018.2,
  clouds: [{ cover: 'FEW', base: 4000 }] // base DÉJÀ en pieds
};

describe('mapNoaaMetar', () => {
  it('respecte le contrat decoded complet (station, vent, unités)', () => {
    const r = mapNoaaMetar(NOAA_METAR, 'LFPO');
    expect(r.raw).toBe(NOAA_METAR.rawOb);
    expect(r.source).toBe('noaa');
    expect(r.decoded.station).toBe('LFPO');
    expect(r.decoded.wind).toEqual({ direction: 270, speed: 10, gust: null });
    expect(r.decoded.temperature).toBe(21.3);
    expect(r.decoded.dewpoint).toBe(12.1);
    expect(r.decoded.pressure).toBe(1018); // hPa arrondi
  });

  it('obsTime epoch SECONDES → ISO (pas de ×1 par erreur)', () => {
    const r = mapNoaaMetar(NOAA_METAR, 'LFPO');
    expect(r.decoded.time).toBe(new Date(1770730980 * 1000).toISOString());
    // Une date en millisecondes brutes serait en 1970
    expect(new Date(r.decoded.time).getFullYear()).toBeGreaterThan(2020);
  });

  it('visibilité : ≥ 6 SM (dont "10+") → 9999, sinon SM → mètres', () => {
    expect(mapNoaaMetar({ ...NOAA_METAR, visib: '10+' }, 'LFPO').decoded.visibility).toBe(9999);
    expect(mapNoaaMetar({ ...NOAA_METAR, visib: 6 }, 'LFPO').decoded.visibility).toBe(9999);
    // 3 SM = 4828 m
    expect(mapNoaaMetar({ ...NOAA_METAR, visib: 3 }, 'LFPO').decoded.visibility).toBe(4828);
    // 0.5 SM = 805 m
    expect(mapNoaaMetar({ ...NOAA_METAR, visib: 0.5 }, 'LFPO').decoded.visibility).toBe(805);
    // Absente → 9999 par défaut (convention CAVOK du reste de l'app)
    expect(mapNoaaMetar({ ...NOAA_METAR, visib: null }, 'LFPO').decoded.visibility).toBe(9999);
  });

  it('plafonds nuageux : base NOAA déjà en pieds (PAS de ×100)', () => {
    const r = mapNoaaMetar(NOAA_METAR, 'LFPO');
    expect(r.decoded.clouds).toEqual([{ type: 'FEW', altitude: 4000 }]);
  });

  it('vent : wdir "VRB" → Variable, wdir 0 + vitesse 0 → Calme', () => {
    const vrb = mapNoaaMetar({ ...NOAA_METAR, wdir: 'VRB', wspd: 5 }, 'LFPO');
    expect(vrb.decoded.wind.direction).toBe('Variable');
    expect(vrb.decoded.wind.speed).toBe(5);

    const calme = mapNoaaMetar({ ...NOAA_METAR, wdir: 0, wspd: 0 }, 'LFPO');
    expect(calme.decoded.wind.direction).toBe('Calme');
    expect(calme.decoded.wind.speed).toBe(0);
  });

  it('rafales numériques transmises, sinon null', () => {
    expect(mapNoaaMetar({ ...NOAA_METAR, wgst: 22 }, 'LFPO').decoded.wind.gust).toBe(22);
    expect(mapNoaaMetar(NOAA_METAR, 'LFPO').decoded.wind.gust).toBeNull();
  });

  it('fail-closed : entrée vide ou sans rawOb → null (règle A5)', () => {
    expect(mapNoaaMetar(null, 'LFPO')).toBeNull();
    expect(mapNoaaMetar({}, 'LFPO')).toBeNull();
    expect(mapNoaaMetar({ icaoId: 'LFPO' }, 'LFPO')).toBeNull();
  });

  it('champs numériques manquants → null (pas de valeur fabriquée)', () => {
    const r = mapNoaaMetar({ rawOb: 'LFXX ...', wdir: null, wspd: null, temp: null, dewp: null, altim: null }, 'LFXX');
    expect(r.decoded.temperature).toBeNull();
    expect(r.decoded.dewpoint).toBeNull();
    expect(r.decoded.pressure).toBeNull();
    // wspd absent → 0 → direction Calme (même sémantique qu'AVWX)
    expect(r.decoded.wind.speed).toBe(0);
    expect(r.decoded.wind.direction).toBe('Calme');
  });
});
