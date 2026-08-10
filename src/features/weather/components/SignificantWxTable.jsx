// src/features/weather/components/SignificantWxTable.jsx
// 🔧 LOT 6-C — « TEMSI chiffrée » : phénomènes significatifs par segment de
// route en DONNÉES analysables (isotherme 0 °C, couches nuageuses, visibilité,
// potentiel orageux) + SIGMET officiels actifs sur les FIR françaises.
// Seuils d'alerte VFR appliqués par l'app. Fail-closed : « — » sans donnée.
import React, { useEffect, useMemo, useState } from 'react';
import { useWindsAloftStore } from '@core/stores/windsAloftStore';
import { calculateMidpoint } from '@utils/navigationCalculations';
import { parseTimeString } from '@services/dayNightCalculator';
import { weatherAPI } from '@services/weatherAPI';

const warnStyle = { color: 'var(--color-red-critical)', fontWeight: 700 };
const cautionStyle = { color: 'var(--accent-primary)', fontWeight: 600 };

export const SignificantWxTable = ({
  waypoints = [],
  segmentAltitudes = {},
  plannedAltitude = 3000,
  departureTimeTheoretical = null,
  flightDate = null
}) => {
  // Abonnement aux profils SANS lire la valeur : getWxAt lit le cache via
  // get(), mais le re-render doit suivre l'arrivée asynchrone des profils
  useWindsAloftStore(state => state.profiles);
  const ensureProfiles = useWindsAloftStore(state => state.ensureProfiles);
  const getWxAt = useWindsAloftStore(state => state.getWxAt);

  // SIGMET officiels (FIR françaises) — fetch au montage, état local
  // undefined = chargement en cours, null = échec du service, [] = aucun SIGMET
  const [sigmets, setSigmets] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    weatherAPI.fetchSigmets().then(result => {
      if (!cancelled) setSigmets(result);
    });
    return () => { cancelled = true; };
  }, []);

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

  const whenForWx = (flightDate && departureTimeTheoretical)
    ? (parseTimeString(departureTimeTheoretical, new Date(flightDate)) || new Date())
    : new Date();

  const cellStyle = {
    padding: '6px 8px',
    border: '1px solid var(--border-subtle)',
    textAlign: 'center',
    fontSize: 'var(--fs-caption)',
    whiteSpace: 'nowrap'
  };

  if (segments.length === 0) {
    return (
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
        Définissez une route pour analyser les phénomènes significatifs.
      </p>
    );
  }

  return (
    <div>
      <div className="pdf-avoid-break" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
              <th style={{ ...cellStyle, textAlign: 'left' }}>Segment (alt)</th>
              <th style={cellStyle}>Iso 0 °C</th>
              <th style={cellStyle}>Nuages B/M/H</th>
              <th style={cellStyle}>Visibilité</th>
              <th style={cellStyle}>Orageux (CAPE)</th>
              <th style={{ ...cellStyle, textAlign: 'left' }}>Alertes</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg, idx) => {
              const wx = getWxAt(seg.mid.lat, seg.mid.lon, whenForWx);
              const alerts = [];
              if (wx) {
                if (wx.visibilityM != null && wx.visibilityM < 5000) {
                  alerts.push({ text: `Visibilité < 5 km`, style: warnStyle });
                }
                if (wx.freezingLevelFt != null && wx.freezingLevelFt < seg.altitude) {
                  alerts.push({ text: 'Iso 0 °C sous l\'altitude — givrage possible en nuage', style: warnStyle });
                }
                if (wx.capeJkg != null && wx.capeJkg > 1000) {
                  alerts.push({ text: 'Potentiel orageux marqué', style: cautionStyle });
                }
                if (wx.cloudCoverLowPct != null && wx.cloudCoverLowPct > 75) {
                  alerts.push({ text: 'Couche basse abondante — plafond bas possible', style: cautionStyle });
                }
              }
              return (
                <tr key={idx}>
                  <td style={{ ...cellStyle, textAlign: 'left', fontWeight: 600 }}>
                    {seg.label}
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> ({seg.altitude} ft)</span>
                  </td>
                  <td style={{
                    ...cellStyle,
                    ...(wx?.freezingLevelFt != null && wx.freezingLevelFt < seg.altitude ? warnStyle : {})
                  }}>
                    {wx?.freezingLevelFt != null ? `${wx.freezingLevelFt} ft` : '—'}
                  </td>
                  <td style={cellStyle}>
                    {wx ? `${wx.cloudCoverLowPct ?? '—'} / ${wx.cloudCoverMidPct ?? '—'} / ${wx.cloudCoverHighPct ?? '—'} %` : '—'}
                  </td>
                  <td style={{
                    ...cellStyle,
                    ...(wx?.visibilityM != null && wx.visibilityM < 5000 ? warnStyle : {})
                  }}>
                    {/* Plancher à la centaine de mètres : ne JAMAIS surestimer une
                        visibilité (1 500 m doit se lire 1.5 km, pas « 2 km ») */}
                    {wx?.visibilityM != null ? `${Math.floor(wx.visibilityM / 100) / 10} km` : '—'}
                  </td>
                  <td style={{
                    ...cellStyle,
                    ...(wx?.capeJkg != null && wx.capeJkg > 1000 ? cautionStyle : {})
                  }}>
                    {wx?.capeJkg != null ? `${Math.round(wx.capeJkg)} J/kg` : '—'}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'left', whiteSpace: 'normal' }}>
                    {alerts.length > 0
                      ? alerts.map((a, i) => <div key={i} style={a.style}>⚠ {a.text}</div>)
                      : (wx ? 'RAS' : '—')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* SIGMET officiels (phénomènes significatifs émis par les veilles) */}
      <div style={{ marginTop: '12px' }} className="pdf-avoid-break">
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, marginBottom: '6px' }}>
          SIGMET actifs (FIR françaises)
        </div>
        {sigmets === undefined && (
          <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)', margin: 0 }}>
            Chargement des SIGMET…
          </p>
        )}
        {sigmets === null && (
          <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)', margin: 0 }}>
            SIGMET non disponibles (réseau ou service indisponible).
          </p>
        )}
        {Array.isArray(sigmets) && sigmets.length === 0 && (
          <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', margin: 0 }}>
            ✓ Aucun SIGMET actif sur les FIR françaises.
          </p>
        )}
        {Array.isArray(sigmets) && sigmets.length > 0 && sigmets.map((s, i) => (
          <div
            key={i}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-caption)',
              backgroundColor: 'rgba(242, 105, 33, 0.10)',
              border: '1px solid var(--accent-primary)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              marginBottom: '6px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            <strong>{s.firId} — {s.hazard || 'SIGMET'}</strong>
            {'\n'}{s.rawSigmet || ''}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)', margin: '6px 0 0' }}>
        Équivalent chiffré du contenu TEMSI : modèle Open-Meteo/AROME au milieu de chaque segment
        + SIGMET officiels (NOAA). Les cartes TEMSI/WINTEM officielles en image seront jointes au
        briefing une fois l'accès AEROWEB activé.
      </p>
    </div>
  );
};

export default SignificantWxTable;
