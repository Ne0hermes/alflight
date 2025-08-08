// src/features/alternates/components/AlternateDetails.jsx
import React, { memo } from 'react';
import { Info, Fuel, Wind, Radio, Download, MapPin, Ruler, AlertTriangle } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useVACStore, vacSelectors } from '@core/stores/vacStore';
import { useWeatherStore, weatherSelectors } from '@core/stores/weatherStore';
import { Conversions } from '@utils/conversions';

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
              color: 'white',
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
            <div style={sx.combine(sx.text.xs, sx.spacing.mt(1), { color: '#9ca3af' })}>
              {Conversions.coordinatesToDMS(alternate.position.lat, alternate.position.lon).formatted}
            </div>
          </div>
        </div>
        
        {/* Score */}
        <div style={{
          padding: '8px 16px',
          backgroundColor: getScoreColor(alternate.score),
          borderRadius: '8px',
          color: 'white',
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
          { backgroundColor: '#f0f9ff', borderLeft: '4px solid #0284c7' } :
          { backgroundColor: '#fef2f2', borderLeft: '4px solid #dc2626' }
      )}>
        <h5 style={sx.combine(
          sx.text.sm, sx.text.bold, sx.spacing.mb(2), 
          { color: weather?.metar ? '#0369a1' : '#991b1b' }
        )}>
          📡 METAR
        </h5>
        {weather?.metar ? (
          <>
            <div style={sx.combine(
              sx.text.sm, 
              { fontFamily: 'monospace', backgroundColor: '#ffffff', padding: '12px', borderRadius: '6px', whiteSpace: 'pre-wrap' }
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
          <div style={sx.combine(sx.text.sm, { color: '#991b1b' })}>
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
          { backgroundColor: '#fef3c7', borderLeft: '4px solid #f59e0b' }
        )}>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2), { color: '#d97706' })}>
            📅 TAF (Prévisions)
          </h5>
          <div style={sx.combine(
            sx.text.sm, 
            { fontFamily: 'monospace', backgroundColor: '#ffffff', padding: '12px', borderRadius: '6px', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto' }
          )}>
            {weather.taf.raw}
          </div>
        </div>
      )}
      
      {/* Grille d'informations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {/* Pistes */}
        <div style={sx.components.card.base}>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            🛬 Pistes disponibles
          </h5>
          {alternate.runways.map((runway, idx) => (
            <div key={idx} style={sx.combine(sx.text.sm, sx.spacing.mb(1))}>
              <strong>{runway.id}</strong> : {runway.length}×{runway.width}m • {runway.surface}
            </div>
          ))}
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
            <div style={sx.combine(sx.text.sm, { color: '#10b981' })}>
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
          <summary style={{ cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>
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
    <span style={{ color: available ? '#10b981' : '#ef4444' }}>
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
            backgroundColor: '#e5e7eb',
            borderRadius: '4px',
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
  const colors = ['#3b82f6', '#10b981', '#f59e0b'];
  return colors[index] || '#6b7280';
};

const getScoreColor = (score) => {
  if (score >= 0.8) return '#10b981';
  if (score >= 0.6) return '#f59e0b';
  return '#ef4444';
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