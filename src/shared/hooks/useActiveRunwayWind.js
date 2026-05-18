// src/shared/hooks/useActiveRunwayWind.js
//
// Hook qui détermine la "meilleure piste" d'un aérodrome face au vent METAR,
// et calcule la COMPOSANTE VENT DE FACE SIGNÉE sur cette piste.
//
// Convention :
//   - headwindComponent > 0 → vent de face (favorable)
//   - headwindComponent < 0 → vent arrière (défavorable)
//
// Source des pistes :
//   1. VAC store (charts uploadées avec extracted runways) — priorité
//   2. aeroDataProvider.getAirfields({ icao }) — fallback
//   3. fallback statique (rare)
//
// Usage :
//   const { loading, bestRunway, headwindComponent, source } =
//     useActiveRunwayWind(icao, weather);

import { useEffect, useState, useMemo } from 'react';
import { useVACStore } from '../../core/stores/vacStore';
import { aeroDataProvider } from '../../core/data';
import { selectBestRunwayForWind } from '../../utils/runwayWindUtils';

export function useActiveRunwayWind(icao, weather) {
  const [runways, setRunways] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState(null);

  const vacChart = useVACStore(state => icao ? state.getChartByIcao(icao) : null);

  // Extraire le vent METAR (direction + speed)
  const wind = useMemo(() => {
    const w = weather?.metar?.decoded?.wind
           || weather?.decoded?.wind
           || weather?.wind
           || null;
    if (!w) return null;
    if (typeof w.direction !== 'number' || typeof w.speed !== 'number') return null;
    return { direction: w.direction, speed: w.speed };
  }, [weather]);

  // Charger les pistes (VAC priority, sinon aeroDataProvider)
  useEffect(() => {
    if (!icao) {
      setRunways([]);
      setSource(null);
      return;
    }

    // 1. VAC extracted runways
    if (vacChart?.extractedData?.runways && vacChart.extractedData.runways.length > 0) {
      const vacRunways = vacChart.extractedData.runways.map(rwy => {
        const thresholds = rwy.identifier ? String(rwy.identifier).split('/') : [];
        const baseIdent = thresholds[0] || '';
        const oppositeIdent = thresholds[1] || '';
        const baseQfu = rwy.qfu || (parseInt(String(baseIdent).replace(/[LRC]/, '')) * 10) || 0;
        const oppositeQfu = (baseQfu + 180) % 360;
        return {
          identifier: rwy.identifier,
          le_ident: baseIdent,
          he_ident: oppositeIdent,
          le_heading: baseQfu,
          he_heading: oppositeQfu,
          qfu: baseQfu,
          length: rwy.length,
          width: rwy.width,
          surface: rwy.surface
        };
      });
      setRunways(vacRunways);
      setSource('vac');
      return;
    }

    // 2. aeroDataProvider (async)
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const airports = await aeroDataProvider.getAirfields({ icao });
        const airportData = Array.isArray(airports) ? airports.find(a => a.icao === icao) : null;
        if (cancelled) return;
        const rws = airportData?.runways || [];
        setRunways(rws);
        setSource(rws.length > 0 ? 'aeroDataProvider' : null);
      } catch (e) {
        if (!cancelled) {
          setRunways([]);
          setSource(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [icao, vacChart]);

  // Calculer la meilleure piste face au vent
  const bestRunway = useMemo(() => {
    if (!wind || runways.length === 0) return null;
    return selectBestRunwayForWind(runways, wind);
  }, [runways, wind]);

  // Composante vent de face signée sur la meilleure piste
  const headwindComponent = bestRunway?.headwind ?? null;
  const crosswindComponent = bestRunway?.crosswind ?? null;

  return {
    loading,
    runways,
    wind,
    bestRunway,
    headwindComponent,
    crosswindComponent,
    source
  };
}
