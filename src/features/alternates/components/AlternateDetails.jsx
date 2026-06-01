// src/features/alternates/components/AlternateDetails.jsx
import React, { memo, useState } from 'react';
import { Info, Fuel, Wind, Radio, Download, MapPin, Ruler, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useVACStore, vacSelectors } from '@core/stores/vacStore';
import { useWeatherStore, weatherSelectors } from '@core/stores/weatherStore';
import { coordinateConversions } from '@utils/unitConversions';
import { useAircraft } from '@core/contexts';

export const AlternateDetails = memo(({ alternates }) => {
  const { downloadChart } = useVACStore();

  if (!alternates || alternates.length === 0) {
    return (
      <div style={sx.combine(sx.text.center, sx.text.secondary, sx.spacing.p(8))}>
        Aucun aérodrome de déroutement sélectionné
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {alternates.map((alternate, index) => (
        <AlternateCard
          key={alternate.icao}
          alternate={alternate}
          index={index}
          onDownloadVAC={() => downloadChart(alternate.icao)}
        />
      ))}
    </div>
  );
});

const AlternateCard = memo(({ alternate, index, onDownloadVAC }) => {
  const weather = weatherSelectors.useWeatherByIcao(alternate.icao);
  const vacChart = vacSelectors.useChartByIcao(alternate.icao);
  const isVacDownloading = vacSelectors.useIsDownloading(alternate.icao);
  const { selectedAircraft } = useAircraft();
  const [showRunwayDetails, setShowRunwayDetails] = useState(false);

  return (
    <div style={sx.combine(
      sx.components.card.base,
      { borderLeft: `4px solid ${getAlternateColor(index)}` }
    )}>
      {/* En-tête */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
        <div>
          <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.flex.start, sx.spacing.gap(2))}>
            <span style={{
              backgroundColor: getAlternateColor(index),
              color: 'var(--text-primary)',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              {index + 1}
            </span>
            {alternate.icao} - {alternate.name}
          </h4>
          <div style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(1))}>
            <div>
              <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
              {alternate.position.lat.toFixed(4)}°, {alternate.position.lon.toFixed(4)}°
              <span style={sx.spacing.ml(3)}>
                <Ruler size={12} style={{ display: 'inline', marginRight: '4px' }} />
                {alternate.distance.toFixed(1)} NM de la route
              </span>
            </div>
            <div style={sx.combine(sx.text.xs, sx.spacing.mt(1), { color: 'var(--text-tertiary)' })}>
              {coordinateConversions.coordinatesToDMS(alternate.position.lat, alternate.position.lon).formatted}
            </div>
          </div>
        </div>

        {/* Score */}
        <div style={{
          padding: '8px 16px',
          backgroundColor: getScoreColor(alternate.score),
          borderRadius: '8px',
          color: 'var(--text-primary)',
          fontWeight: 'bold'
        }}>
          Score: {(alternate.score * 100).toFixed(0)}%
        </div>
      </div>

      {/* METAR complet ou message d'indisponibilité */}
      <div style={sx.combine(
        sx.components.card.base,
        sx.spacing.mb(3),
        weather?.metar ?
          { backgroundColor: 'var(--bg-overlay)', borderLeft: '4px solid var(--text-secondary)' } :
          { backgroundColor: 'var(--bg-overlay)', borderLeft: '4px solid #C04534' }
      )}>
        <h5 style={sx.combine(
          sx.text.sm, sx.text.bold, sx.spacing.mb(2),
          { color: weather?.metar ? 'var(--text-secondary)' : '#C04534' }
        )}>
          📡 METAR
        </h5>
        {weather?.metar ? (
          <>
            <div style={sx.combine(
              sx.text.sm,
              { fontFamily: 'monospace', backgroundColor: 'var(--bg-overlay)', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap' }
            )}>
              {weather.metar.raw}
            </div>
            {weather.metar.decoded && (
              <div style={sx.combine(sx.text.sm, sx.spacing.mt(2))}>
                <p><strong>Décodé :</strong></p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
                  <li>🌡️ Température: {weather.metar.decoded.temperature}°C / Point de rosée: {weather.metar.decoded.dewpoint}°C</li>
                  <li>🎚️ QNH: {weather.metar.decoded.altimeter} hPa</li>
                  <li>💨 Vent: {weather.metar.decoded.wind.direction}° à {weather.metar.decoded.wind.speed}kt
                    {weather.metar.decoded.wind.gust && ` (rafales ${weather.metar.decoded.wind.gust}kt)`}</li>
                  <li>👁️ Visibilité: {weather.metar.decoded.visibility >= 9999 ? '>10km' : `${(weather.metar.decoded.visibility / 1000).toFixed(1)}km`}</li>
                  {weather.metar.decoded.clouds && weather.metar.decoded.clouds.length > 0 && (
                    <li>☁️ Nuages: {weather.metar.decoded.clouds.map(c => `${c.type} ${c.altitude}ft`).join(', ')}</li>
                  )}
                  {weather.metar.decoded.conditions && weather.metar.decoded.conditions.length > 0 && (
                    <li>⚠️ Conditions: {weather.metar.decoded.conditions.join(', ')}</li>
                  )}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div style={sx.combine(sx.text.sm, { color: '#C04534' })}>
            <p>⚠️ METAR non disponible pour cet aérodrome</p>
            <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
              L'aérodrome {alternate.icao} pourrait être un aérodrome privé ou les données météo ne sont pas disponibles.
            </p>
          </div>
        )}
      </div>

      {/* TAF si disponible */}
      {weather?.taf && (
        <div style={sx.combine(
          sx.components.card.base,
          sx.spacing.mb(3),
          { backgroundColor: 'rgba(242, 105, 33, 0.10)', borderLeft: '4px solid var(--accent-primary)' }
        )}>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2), { color: 'var(--accent-primary)' })}>
            📅 TAF (Prévisions)
          </h5>
          <div style={sx.combine(
            sx.text.sm,
            { fontFamily: 'monospace', backgroundColor: 'var(--bg-overlay)', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto' }
          )}>
            {weather.taf.raw}
          </div>
        </div>
      )}

      {/* Grille d'informations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {/* Pistes avec accordéon */}
        <div style={sx.components.card.base}>
          <button
            onClick={() => setShowRunwayDetails(!showRunwayDetails)}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'none',
              borderWidth: '0',
              borderStyle: 'none',
              padding: 0,
              cursor: 'pointer',
              marginBottom: showRunwayDetails ? '12px' : '8px'
            }}
          >
            <h5 style={sx.combine(sx.text.sm, sx.text.bold)}>
              🛬 Pistes disponibles ({alternate.runways.length})
            </h5>
            {showRunwayDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {!showRunwayDetails ? (
            // Vue compacte
            <div>
              {alternate.runways.slice(0, 2).map((runway, idx) => (
                <div key={idx} style={sx.combine(sx.text.sm, sx.spacing.mb(1))}>
                  <strong>{runway.id || runway.designator}</strong> : {runway.length || Math.round((runway.dimensions?.length || 0))}m
                </div>
              ))}
              {alternate.runways.length > 2 && (
                <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                  ... et {alternate.runways.length - 2} autre{alternate.runways.length - 2 > 1 ? 's' : ''}
                </div>
              )}
            </div>
          ) : (
            // Vue détaillée par direction
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {(() => {
                // Séparer les pistes en directions individuelles
                const runwayDirections = [];
                alternate.runways.forEach(runway => {
                  const designator = runway.designator || runway.designation || runway.id || '';
                  const baseOrientation = runway.orientation || runway.bearing || runway.trueBearing || null;

                  if (designator.includes('/')) {
                    const [rwy1, rwy2] = designator.split('/');
                    const dir1Distances = runway.distancesByDirection?.[rwy1.trim()] || {};
                    const dir2Distances = runway.distancesByDirection?.[rwy2.trim()] || {};

                    runwayDirections.push({
                      ...runway,
                      runwayNumber: rwy1.trim(),
                      qfu: baseOrientation,
                      tora: dir1Distances.tora,
                      toda: dir1Distances.toda,
                      asda: dir1Distances.asda,
                      lda: dir1Distances.lda
                    });

                    const oppositeQfu = baseOrientation !== null ? (baseOrientation + 180) % 360 : null;
                    runwayDirections.push({
                      ...runway,
                      runwayNumber: rwy2.trim(),
                      qfu: oppositeQfu,
                      tora: dir2Distances.tora,
                      toda: dir2Distances.toda,
                      asda: dir2Distances.asda,
                      lda: dir2Distances.lda
                    });
                  } else {
                    runwayDirections.push({
                      ...runway,
                      runwayNumber: designator,
                      qfu: baseOrientation
                    });
                  }
                });

                return runwayDirections.map((runway, idx) => {
                  const runwayNumber = runway.runwayNumber || 'XX';
                  const qfu = runway.qfu !== null && runway.qfu !== undefined ? Math.round(runway.qfu) : null;
                  const lengthM = typeof runway.dimensions?.length === 'number' ? runway.dimensions.length :
                    (typeof runway.length === 'number' ? runway.length : 0);
                  const lengthFt = Math.round(lengthM * 3.28084);
                  const widthM = typeof runway.dimensions?.width === 'number' ? runway.dimensions.width :
                    (typeof runway.width === 'number' ? runway.width : 0);
                  const surfaceType = typeof runway.surface?.type === 'string' ? runway.surface.type :
                    (typeof runway.surface === 'string' ? runway.surface : 'Non spécifiée');
                  const orientation = runway.orientation || runway.bearing || runway.trueBearing || '';

                  // Compatibilité avec l'avion sélectionné
                  const aircraftSurfaces = selectedAircraft?.compatibleRunwaySurfaces || [];
                  const normalizeSurface = (surface) => {
                    if (!surface || typeof surface !== 'string') return null;
                    const s = surface.toUpperCase();
                    if (s.includes('ASPH') || s === 'ASPHALT') return 'ASPH';
                    if (s.includes('CONC') || s === 'CONCRETE') return 'CONC';
                    if (s.includes('GRASS') || s === 'TURF') return 'GRASS';
                    if (s.includes('DIRT') || s === 'EARTH') return 'DIRT';
                    return s;
                  };

                  const runwaySurface = normalizeSurface(surfaceType);
                  const surfaceCompatible = aircraftSurfaces.length > 0 &&
                    aircraftSurfaces.some(s => normalizeSurface(s) === runwaySurface);

                  // Vérifier longueur minimale si spécifiée
                  const minLength = selectedAircraft?.minimumRunwayLength ?
                    parseInt(selectedAircraft.minimumRunwayLength) : 0;
                  const lengthCompatible = minLength > 0 ? lengthM >= minLength : true;

                  const isCompatible = surfaceCompatible && lengthCompatible;

                  return (
                    <div key={idx} style={sx.combine(
                      sx.text.xs,
                      sx.spacing.p(2),
                      sx.spacing.mb(2),
                      sx.rounded.sm,
                      {
                        background: 'var(--bg-overlay)',
                        borderLeft: `3px solid var(--text-secondary)`
                      }
                    )}>
                      {/* Ligne 1: Piste, QFU et Orientation */}
                      <div style={{ marginBottom: '4px' }}>
                        <strong>Piste {runwayNumber}</strong>
                        {qfu !== null && (
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {' '}• QFU {qfu}°
                          </span>
                        )}
                        {orientation && (
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {' '}• Orientation: {orientation}°
                          </span>
                        )}
                      </div>

                      {/* Ligne 2: Longueur et Largeur */}
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Longueur: {lengthFt} ft ({lengthM} m)
                        </span>
                        {widthM > 0 && (
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {' '}• Largeur: {widthM} m
                          </span>
                        )}
                      </div>

                      {/* Ligne 3: Revêtement */}
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Revêtement: {surfaceType}
                        </span>
                      </div>

                      {/* Distances déclarées */}
                      {(
                        (typeof runway.tora === 'number') ||
                        (typeof runway.toda === 'number') ||
                        (typeof runway.asda === 'number') ||
                        (typeof runway.lda === 'number')
                      ) && (
                          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>
                              Distances déclarées :
                            </div>
                            {typeof runway.tora === 'number' && (
                              <div style={{ color: 'var(--text-secondary)' }}>
                                • TORA: {runway.tora} m ({Math.round(runway.tora * 3.28084)} ft)
                              </div>
                            )}
                            {typeof runway.toda === 'number' && (
                              <div style={{ color: 'var(--text-secondary)' }}>
                                • TODA: {runway.toda} m ({Math.round(runway.toda * 3.28084)} ft)
                              </div>
                            )}
                            {typeof runway.asda === 'number' && (
                              <div style={{ color: 'var(--text-secondary)' }}>
                                • ASDA: {runway.asda} m ({Math.round(runway.asda * 3.28084)} ft)
                              </div>
                            )}
                            {typeof runway.lda === 'number' && (
                              <div style={{ color: 'var(--text-secondary)' }}>
                                • LDA: {runway.lda} m ({Math.round(runway.lda * 3.28084)} ft)
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Services */}
        <div style={sx.components.card.base}>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            🛠️ Services
          </h5>
          <div style={sx.text.sm}>
            <ServiceIndicator
              available={alternate.services.fuel}
              label="Carburant"
              icon={<Fuel size={14} />}
            />
            <ServiceIndicator
              available={alternate.services.atc}
              label="ATC/AFIS"
              icon={<Radio size={14} />}
            />
            <ServiceIndicator
              available={alternate.services.lighting}
              label="Balisage"
              icon="💡"
            />
          </div>
        </div>

        {/* Météo */}
        <div style={sx.components.card.base}>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            🌤️ Météo actuelle
          </h5>
          {weather?.metar ? (
            <div style={sx.text.sm}>
              <p><Wind size={14} style={{ display: 'inline' }} /> Vent : {weather.metar.decoded.wind.direction}° / {weather.metar.decoded.wind.speed}kt</p>
              <p>☁️ Plafond : {weather.metar.decoded.clouds?.[0]?.altitude || 'CAVOK'} ft</p>
              <p>👁️ Visibilité : {(weather.metar.decoded.visibility / 1000).toFixed(1)} km</p>
            </div>
          ) : (
            <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
              Pas de données météo disponibles
            </p>
          )}
        </div>

        {/* VAC */}
        <div style={sx.components.card.base}>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            📄 Carte VAC
          </h5>
          {vacChart?.isDownloaded ? (
            <div style={sx.combine(sx.text.sm, { color: 'var(--text-primary)' })}>
              ✅ Carte téléchargée
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                {new Date(vacChart.downloadDate).toLocaleDateString('fr-FR')}
              </p>
            </div>
          ) : (
            <button
              onClick={onDownloadVAC}
              disabled={isVacDownloading}
              style={sx.combine(
                sx.components.button.base,
                sx.components.button.primary,
                { fontSize: '13px', padding: '6px 12px' },
                isVacDownloading && { opacity: 0.5 }
              )}
            >
              {isVacDownloading ? (
                <>Téléchargement...</>
              ) : (
                <>
                  <Download size={14} />
                  Télécharger VAC
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Facteurs de score */}
      {alternate.scoreFactors && (
        <details style={sx.spacing.mt(3)}>
          <summary style={{ cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Voir le détail du score
          </summary>
          <div style={sx.combine(sx.spacing.mt(2), sx.spacing.p(2), sx.bg.gray, sx.rounded.md)}>
            <ScoreBreakdown factors={alternate.scoreFactors} />
          </div>
        </details>
      )}

      {/* NOTAMs si disponibles */}
      {alternate.notams && alternate.notams.length > 0 && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mt(3))}>
          <AlertTriangle size={16} />
          <div>
            <p style={sx.text.sm}><strong>NOTAMs actifs :</strong></p>
            {alternate.notams.map((notam, idx) => (
              <p key={idx} style={sx.combine(sx.text.xs, sx.spacing.mt(1))}>
                • {notam.summary}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>


  );
});

// Composant pour afficher un service
const ServiceIndicator = memo(({ available, label, icon }) => (
  <div style={sx.combine(sx.flex.start, sx.spacing.gap(1), sx.spacing.mb(1))}>
    {typeof icon === 'string' ? <span>{icon}</span> : icon}
    <span style={{ color: available ? 'var(--text-primary)' : '#C04534' }}>
      {available ? '✓' : '✗'}
    </span>
    <span>{label}</span>
  </div>
));

// Composant pour le détail du score
const ScoreBreakdown = memo(({ factors }) => (
  <div style={{ display: 'grid', gap: '8px' }}>
    {Object.entries(factors).map(([key, value]) => (
      <div key={key} style={sx.flex.between}>
        <span style={sx.text.sm}>{getFactorLabel(key)} :</span>
        <div style={sx.flex.start}>
          <div style={{
            width: '100px',
            height: '8px',
            backgroundColor: 'var(--border-subtle)',
            borderRadius: '8px',
            marginRight: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${value * 100}%`,
              height: '100%',
              backgroundColor: getScoreColor(value),
              transition: 'width 0.3s'
            }} />
          </div>
          <span style={sx.combine(sx.text.sm, sx.text.bold)}>
            {(value * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    ))}
  </div>
));

// Fonctions utilitaires
const getAlternateColor = (index) => {
  const colors = ['var(--text-secondary)', 'var(--text-primary)', 'var(--accent-primary)'];
  return colors[index] || 'var(--text-secondary)';
};

const getScoreColor = (score) => {
  if (score >= 0.8) return 'var(--text-primary)';
  if (score >= 0.6) return 'var(--accent-primary)';
  return '#C04534';
};

const getFactorLabel = (factor) => {
  const labels = {
    distance: 'Distance',
    infrastructure: 'Infrastructure',
    weather: 'Météo',
    services: 'Services',
    position: 'Position stratégique'
  };
  return labels[factor] || factor;
};

AlternateDetails.displayName = 'AlternateDetails';
AlternateCard.displayName = 'AlternateCard';
ServiceIndicator.displayName = 'ServiceIndicator';
ScoreBreakdown.displayName = 'ScoreBreakdown';