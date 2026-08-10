// src/features/weather/components/WindsAloftTable.jsx
// 🔧 LOT 6-C — « WINTEM chiffré » : vents et températures en altitude par
// segment de route (lignes) × niveaux de pression (colonnes) — les valeurs
// numériques de la carte WINTEM, analysables, issues des profils Open-Meteo
// déjà en cache (windsAloftStore). Fail-closed : cellule « — » sans donnée.
import React, { useEffect, useMemo } from 'react';
import { useWindsAloftStore, windsAloftKey } from '@core/stores/windsAloftStore';
import { calculateMidpoint } from '@utils/navigationCalculations';
import { parseTimeString } from '@services/dayNightCalculator';

const PRESSURE_LEVELS_HPA = [1000, 950, 925, 900, 850, 800, 700];
const MAX_HOUR_DELTA_MS = 3 * 60 * 60 * 1000;

const nearestHour = (profile, when) => {
  if (!profile?.hours?.length) return null;
  const target = when instanceof Date && !Number.isNaN(when.getTime()) ? when.getTime() : Date.now();
  let best = null;
  let bestDelta = Infinity;
  for (const h of profile.hours) {
    const t = Date.parse(`${h.timeISO}Z`);
    if (!Number.isFinite(t)) continue;
    const delta = Math.abs(t - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = h;
    }
  }
  return best && bestDelta <= MAX_HOUR_DELTA_MS ? best : null;
};

export const WindsAloftTable = ({
  waypoints = [],
  segmentAltitudes = {},
  plannedAltitude = 3000,
  departureTimeTheoretical = null,
  flightDate = null
}) => {
  const profiles = useWindsAloftStore(state => state.profiles);
  const manualWind = useWindsAloftStore(state => state.manualWind);
  const ensureProfiles = useWindsAloftStore(state => state.ensureProfiles);

  // Segments valides + milieux (mêmes conventions que le tableau de nav)
  const segments = useMemo(() => {
    const list = [];
    for (let i = 0; i < (waypoints?.length || 0) - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      // Number.isFinite : 0 est une coordonnée VALIDE (méridien de Greenwich)
      if (!Number.isFinite(from?.lat) || !Number.isFinite(from?.lon) ||
          !Number.isFinite(to?.lat) || !Number.isFinite(to?.lon)) continue;
      const fromId = from.id || from.name || `wp${i}`;
      const toId = to.id || to.name || `wp${i + 1}`;
      const segmentId = `${fromId}-${toId}`;
      list.push({
        label: `${from.name || from.icao || `WP${i + 1}`} → ${to.name || to.icao || `WP${i + 2}`}`,
        mid: calculateMidpoint({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }),
        altitude: segmentAltitudes[segmentId]?.startAlt || plannedAltitude
      });
    }
    return list;
  }, [waypoints, segmentAltitudes, plannedAltitude]);

  useEffect(() => {
    if (segments.length > 0) ensureProfiles(segments.map(s => s.mid));
  }, [segments, ensureProfiles]);

  if (segments.length === 0) {
    return (
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
        Définissez une route (départ/arrivée) pour afficher les vents en altitude.
      </p>
    );
  }

  const whenForWind = (flightDate && departureTimeTheoretical)
    ? (parseTimeString(departureTimeTheoretical, new Date(flightDate)) || new Date())
    : new Date();

  const cellStyle = {
    padding: '6px 8px',
    border: '1px solid var(--border-subtle)',
    textAlign: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-caption)',
    whiteSpace: 'nowrap'
  };

  return (
    <div>
      {manualWind && (
        <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent-primary)', fontWeight: 600, margin: '0 0 8px' }}>
          ⚠ Vent manuel prioritaire pour les calculs : {manualWind.directionDeg}° / {manualWind.speedKt} kt
          — le tableau ci-dessous montre les profils du modèle.
        </p>
      )}
      <div className="pdf-avoid-break" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
              <th style={{ ...cellStyle, fontFamily: 'var(--font-sans)', textAlign: 'left' }}>Segment (alt)</th>
              {PRESSURE_LEVELS_HPA.map(hpa => (
                <th key={hpa} style={{ ...cellStyle, fontFamily: 'var(--font-sans)' }}>{hpa} hPa</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {segments.map((seg, idx) => {
              const profile = profiles[windsAloftKey(seg.mid.lat, seg.mid.lon)];
              const hour = nearestHour(profile, whenForWind);
              const byHpa = new Map((hour?.levels || []).map(l => [l.hpa, l]));
              // Niveau le plus proche de l'altitude du segment (surligné)
              let nearestHpa = null;
              let nearestDelta = Infinity;
              (hour?.levels || []).forEach(l => {
                const d = Math.abs(l.heightFt - seg.altitude);
                if (d < nearestDelta) { nearestDelta = d; nearestHpa = l.hpa; }
              });
              return (
                <tr key={idx}>
                  <td style={{ ...cellStyle, fontFamily: 'var(--font-sans)', textAlign: 'left', fontWeight: 600 }}>
                    {seg.label}
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> ({seg.altitude} ft)</span>
                  </td>
                  {PRESSURE_LEVELS_HPA.map(hpa => {
                    const level = byHpa.get(hpa);
                    if (!level) return <td key={hpa} style={cellStyle}>—</td>;
                    return (
                      <td
                        key={hpa}
                        style={{
                          ...cellStyle,
                          backgroundColor: hpa === nearestHpa ? 'var(--accent-soft)' : undefined
                        }}
                        title={`≈ ${Math.round(level.heightFt)} ft`}
                      >
                        {String(Math.round(level.directionDeg)).padStart(3, '0')}°/{Math.round(level.speedKt)} kt
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {level.temperatureC != null ? `${level.temperatureC > 0 ? '+' : ''}${Math.round(level.temperatureC)} °C` : '—'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)', margin: '6px 0 0' }}>
        Source : Open-Meteo (AROME en France) au milieu de chaque segment, heure de départ prévue.
        Cellule surlignée : niveau le plus proche de l'altitude du segment (celui utilisé par le tableau de navigation).
        « — » : donnée indisponible.
      </p>
    </div>
  );
};

export default WindsAloftTable;
