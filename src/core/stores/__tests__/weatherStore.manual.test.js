// Tests de la saisie météo MANUELLE (Lot 6-C) : mergeManualWeather (helper pur)
// et actions du weatherStore. Contrat : le résultat a la FORME METAR decoded et
// traverse PerformanceModule / useActiveRunwayWind sans modification aval.
import { describe, it, expect, beforeEach } from 'vitest';
import { mergeManualWeather, useWeatherStore } from '../weatherStore';

const API_WEATHER = {
  icao: 'LFPO',
  timestamp: 1000,
  metar: {
    raw: 'LFPO 101300Z 27010KT 9999 FEW040 21/12 Q1018',
    time: '2026-08-10T13:00:00Z',
    decoded: {
      station: 'LFPO',
      time: '2026-08-10T13:00:00Z',
      wind: { direction: 270, speed: 10, gust: null },
      visibility: 9999,
      clouds: [{ type: 'FEW', altitude: 4000 }],
      temperature: 21,
      dewpoint: 12,
      pressure: 1018
    }
  },
  taf: { raw: 'TAF LFPO ...' }
};

describe('mergeManualWeather (helper pur)', () => {
  it('sans saisie manuelle : renvoie la météo API telle quelle', () => {
    expect(mergeManualWeather(API_WEATHER, undefined)).toBe(API_WEATHER);
    expect(mergeManualWeather(undefined, undefined)).toBeUndefined();
  });

  it('saisie seule (terrain sans METAR) : produit une forme METAR decoded valide', () => {
    const r = mergeManualWeather(undefined, {
      icao: 'LFXX',
      wind: { direction: 180, speed: 8 },
      temperature: 25,
      qnh: 1015,
      updatedAt: 42
    });
    expect(r.isManual).toBe(true);
    expect(r.icao).toBe('LFXX');
    expect(r.metar.raw).toContain('SAISIE MANUELLE');
    // Contrat consommé par useActiveRunwayWind : direction ET vitesse numériques
    expect(r.metar.decoded.wind).toEqual({ direction: 180, speed: 8, gust: null });
    expect(r.metar.decoded.temperature).toBe(25);
    // ⚠️ le champ s'appelle `pressure` (comme le decoded AVWX/NOAA), pas `qnh`
    expect(r.metar.decoded.pressure).toBe(1015);
    // Champs non saisis : fail-closed, pas de valeur fabriquée
    expect(r.metar.decoded.visibility).toBeNull();
    expect(r.metar.decoded.clouds).toEqual([]);
    expect(r.taf).toBeNull();
  });

  it('saisie partielle sur météo API : n\'écrase QUE les champs saisis', () => {
    const r = mergeManualWeather(API_WEATHER, { icao: 'LFPO', qnh: 1002, updatedAt: 42 });
    expect(r.isManual).toBe(true);
    expect(r.manualFields).toEqual(['qnh']);
    expect(r.metar.decoded.pressure).toBe(1002);        // saisi
    expect(r.metar.decoded.wind.direction).toBe(270);   // API conservée
    expect(r.metar.decoded.temperature).toBe(21);       // API conservée
    expect(r.metar.decoded.clouds).toHaveLength(1);     // API conservée
    expect(r.taf).toBe(API_WEATHER.taf);                // TAF conservé
    expect(r.metar.raw).toBe(API_WEATHER.metar.raw);    // raw API conservé
  });

  it('vent manuel complet prioritaire sur le vent METAR', () => {
    const r = mergeManualWeather(API_WEATHER, {
      icao: 'LFPO',
      wind: { direction: 90, speed: 25 },
      updatedAt: 42
    });
    expect(r.manualFields).toEqual(['wind']);
    expect(r.metar.decoded.wind).toEqual({ direction: 90, speed: 25, gust: null });
  });
});

describe('weatherStore — actions manualOverrides', () => {
  beforeEach(() => {
    useWeatherStore.setState({ weatherData: {}, manualOverrides: {}, errors: {}, loading: {}, lastUpdate: {} });
  });

  it('setManualWeather normalise l\'ICAO en majuscules et horodate', () => {
    useWeatherStore.getState().setManualWeather('lfxx', { qnh: 1010 });
    const o = useWeatherStore.getState().manualOverrides.LFXX;
    expect(o.qnh).toBe(1010);
    expect(o.icao).toBe('LFXX');
    expect(o.updatedAt).toBeGreaterThan(0);
  });

  it('clearManualWeather retire la saisie', () => {
    useWeatherStore.getState().setManualWeather('LFXX', { qnh: 1010 });
    useWeatherStore.getState().clearManualWeather('lfxx');
    expect(useWeatherStore.getState().manualOverrides.LFXX).toBeUndefined();
  });

  it('setManualWeatherBulk hydrate depuis un brouillon restauré', () => {
    useWeatherStore.getState().setManualWeatherBulk({
      lfxx: { wind: { direction: 180, speed: 8 }, temperature: null, qnh: 1015, updatedAt: 42 },
      LFYY: { temperature: 12, updatedAt: 43 }
    });
    const s = useWeatherStore.getState();
    expect(s.manualOverrides.LFXX.qnh).toBe(1015);
    expect(s.manualOverrides.LFYY.temperature).toBe(12);
  });

  it('getEffectiveWeather = manuel > API ; sans rien → undefined', () => {
    useWeatherStore.setState({ weatherData: { LFPO: API_WEATHER } });
    useWeatherStore.getState().setManualWeather('LFPO', { temperature: 30 });
    const eff = useWeatherStore.getState().getEffectiveWeather('lfpo');
    expect(eff.metar.decoded.temperature).toBe(30);
    expect(eff.metar.decoded.wind.direction).toBe(270);
    expect(useWeatherStore.getState().getEffectiveWeather('LFZZ')).toBeUndefined();
  });

  it('clearWeather / clearAll ne touchent PAS aux saisies manuelles', () => {
    useWeatherStore.setState({ weatherData: { LFPO: API_WEATHER } });
    useWeatherStore.getState().setManualWeather('LFPO', { qnh: 1002 });
    useWeatherStore.getState().clearWeather('LFPO');
    expect(useWeatherStore.getState().manualOverrides.LFPO.qnh).toBe(1002);
    useWeatherStore.getState().clearAll();
    expect(useWeatherStore.getState().manualOverrides.LFPO.qnh).toBe(1002);
  });

  // 🔧 REVUE 6-C — frontières de vol
  it('clearAllManualWeather purge TOUTES les saisies sans toucher weatherData', () => {
    useWeatherStore.setState({ weatherData: { LFPO: API_WEATHER } });
    useWeatherStore.getState().setManualWeather('LFPO', { temperature: 30 });
    useWeatherStore.getState().setManualWeather('LFXX', { qnh: 1002 });
    useWeatherStore.getState().clearAllManualWeather();
    const s = useWeatherStore.getState();
    expect(s.manualOverrides).toEqual({});
    expect(s.weatherData.LFPO).toBe(API_WEATHER);
    // La météo effective redevient l'API pure
    expect(s.getEffectiveWeather('LFPO')).toBe(API_WEATHER);
  });

  it('setManualWeatherBulk REMPLACE l\'état (une clé absente du brouillon disparaît)', () => {
    useWeatherStore.getState().setManualWeather('LFAA', { temperature: 28 }); // vol précédent
    useWeatherStore.getState().setManualWeatherBulk({ LFBB: { qnh: 1015, updatedAt: 42 } });
    const s = useWeatherStore.getState();
    expect(s.manualOverrides.LFAA).toBeUndefined(); // pas d'héritage trans-vol
    expect(s.manualOverrides.LFBB.qnh).toBe(1015);
    // Map vide = purge complète (brouillon sans saisie)
    useWeatherStore.getState().setManualWeatherBulk({});
    expect(useWeatherStore.getState().manualOverrides).toEqual({});
  });

  // 🔧 REVUE 6-C — 0 °C est une température VALIDE : le contrat aval
  // (PerformanceModule utilise désormais ?? et non ||) repose sur decoded
  it('température manuelle 0 °C traverse la fusion (et survit à une chaîne ??)', () => {
    const eff = mergeManualWeather(undefined, { icao: 'LFXX', temperature: 0, updatedAt: 42 });
    expect(eff.metar.decoded.temperature).toBe(0);
    // Réplique de la chaîne de PerformanceModule : ?? conserve 0
    const metarTemp = eff?.metar?.decoded?.temperature ?? eff?.decoded?.temperature ?? null;
    expect(metarTemp).toBe(0);
  });
});
