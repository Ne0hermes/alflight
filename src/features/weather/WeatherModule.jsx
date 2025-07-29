// src/features/weather/WeatherModule.jsx
import React, { memo, useState, useEffect } from 'react';
import { Cloud, Search, RefreshCw, AlertTriangle, Wind, Eye, Thermometer, Gauge, Clock, Plane } from 'lucide-react';
import { useWeatherStore, weatherSelectors } from '@core/stores/weatherStore';
import { useNavigation } from '@core/contexts';
import { sx } from '@shared/styles/styleSystem';

export const WeatherModule = memo(() => {
  const { waypoints } = useNavigation();
  const { fetchWeather, fetchMultiple } = weatherSelectors.useWeatherActions();
  const [searchIcao, setSearchIcao] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  
  // Extraire les codes OACI des waypoints
  const waypointIcaos = waypoints
    .map(wp => wp.name)
    .filter(name => name && name.match(/^[A-Z]{4}$/));
  
  // Charger automatiquement la météo des waypoints
  useEffect(() => {
    if (waypointIcaos.length > 0) {
      fetchMultiple(waypointIcaos);
    }
  }, [waypointIcaos.join(','), fetchMultiple]);
  
  const handleSearch = async () => {
    if (searchIcao && searchIcao.match(/^[A-Z]{4}$/i)) {
      const icao = searchIcao.toUpperCase();
      await fetchWeather(icao);
      
      // Ajouter aux recherches récentes
      setRecentSearches(prev => {
        const updated = [icao, ...prev.filter(s => s !== icao)].slice(0, 5);
        return updated;
      });
      
      setSearchIcao('');
    }
  };
  
  return (
    <div style={sx.spacing.p(6)}>
      {/* En-tête et recherche */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
          <Cloud size={20} />
          <span style={sx.spacing.ml(2)}>Recherche météo</span>
        </h3>
        
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(3))}>
          <input
            type="text"
            placeholder="Code OACI (ex: LFPG)"
            value={searchIcao}
            onChange={(e) => setSearchIcao(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            style={sx.combine(sx.components.input.base, { flex: 1 })}
          />
          <button
            onClick={handleSearch}
            disabled={!searchIcao.match(/^[A-Z]{4}$/i)}
            style={sx.combine(
              sx.components.button.base,
              sx.components.button.primary,
              !searchIcao.match(/^[A-Z]{4}$/i) && { opacity: 0.5, cursor: 'not-allowed' }
            )}
          >
            <Search size={16} />
            Rechercher
          </button>
        </div>
        
        {/* Recherches récentes */}
        {recentSearches.length > 0 && (
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2), sx.spacing.mt(3))}>
            <span style={sx.combine(sx.text.sm, sx.text.secondary)}>Récent :</span>
            {recentSearches.map(icao => (
              <button
                key={icao}
                onClick={() => fetchWeather(icao)}
                style={sx.combine(
                  sx.components.button.base,
                  sx.components.button.secondary,
                  { padding: '4px 12px', fontSize: '13px' }
                )}
              >
                {icao}
              </button>
            ))}
          </div>
        )}
      </section>
      
      {/* Météo des waypoints */}
      {waypointIcaos.length > 0 && (
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
            <Plane size={20} />
            <span style={sx.spacing.ml(2)}>Météo de la navigation</span>
          </h3>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            {waypointIcaos.map((icao, index) => (
              <WeatherCard 
                key={icao} 
                icao={icao} 
                label={index === 0 ? 'Départ' : index === waypointIcaos.length - 1 ? 'Arrivée' : 'Étape'}
              />
            ))}
          </div>
        </section>
      )}
      
      {/* Toutes les stations météo */}
      <section style={sx.components.section.base}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
          📍 Toutes les stations
        </h3>
        <AllWeatherStations />
      </section>
    </div>
  );
});

// Composant pour afficher une carte météo
const WeatherCard = memo(({ icao, label }) => {
  const weather = weatherSelectors.useWeatherByIcao(icao);
  const isLoading = weatherSelectors.useIsLoading(icao);
  const error = weatherSelectors.useError(icao);
  const { fetchWeather } = weatherSelectors.useWeatherActions();
  
  if (isLoading) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.flex.center, { minHeight: '120px' })}>
        <div style={sx.text.secondary}>Chargement {icao}...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.components.alert.danger)}>
        <AlertTriangle size={20} />
        <div>
          <p style={sx.combine(sx.text.sm, sx.text.bold)}>{icao} - Erreur</p>
          <p style={sx.text.sm}>{error}</p>
        </div>
      </div>
    );
  }
  
  if (!weather) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.flex.between)}>
        <div>
          <p style={sx.combine(sx.text.base, sx.text.bold)}>{icao}</p>
          <p style={sx.text.sm}>Pas de données météo</p>
        </div>
        <button
          onClick={() => fetchWeather(icao)}
          style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
        >
          <Search size={16} />
          Charger
        </button>
      </div>
    );
  }
  
  const metar = weather.metar?.decoded;
  const isOld = Date.now() - weather.timestamp > 60 * 60 * 1000; // Plus d'une heure
  
  return (
    <div style={sx.combine(
      sx.components.card.base,
      { borderColor: label === 'Départ' ? '#10b981' : label === 'Arrivée' ? '#f59e0b' : '#3b82f6' }
    )}>
      {/* En-tête */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
        <div>
          <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.flex.start)}>
            {icao}
            {label && (
              <span style={sx.combine(
                sx.text.sm,
                sx.spacing.ml(2),
                { 
                  padding: '2px 8px', 
                  borderRadius: '4px',
                  backgroundColor: label === 'Départ' ? '#d1fae5' : label === 'Arrivée' ? '#fef3c7' : '#dbeafe',
                  color: label === 'Départ' ? '#065f46' : label === 'Arrivée' ? '#92400e' : '#1e40af'
                }
              )}>
                {label}
              </span>
            )}
          </h4>
          <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.flex.start)}>
            <Clock size={12} />
            <span style={sx.spacing.ml(1)}>
              {new Date(weather.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {isOld && <span style={{ color: '#f59e0b' }}> (données anciennes)</span>}
            </span>
          </p>
        </div>
        <button
          onClick={() => fetchWeather(icao)}
          style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '6px' })}
          title="Actualiser"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      
      {/* Données METAR décodées */}
      {metar && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {/* Vent */}
          <div style={sx.combine(sx.flex.col, sx.spacing.gap(1))}>
            <div style={sx.combine(sx.flex.start, sx.text.secondary, sx.text.sm)}>
              <Wind size={16} />
              <span style={sx.spacing.ml(1)}>Vent</span>
            </div>
            <p style={sx.text.bold}>
              {metar.wind.direction === 'Calme' ? 'Calme' : 
                `${metar.wind.direction}° / ${metar.wind.speed}kt`}
              {metar.wind.gust && <span style={{ color: '#f59e0b' }}> G{metar.wind.gust}kt</span>}
            </p>
          </div>
          
          {/* Visibilité */}
          <div style={sx.combine(sx.flex.col, sx.spacing.gap(1))}>
            <div style={sx.combine(sx.flex.start, sx.text.secondary, sx.text.sm)}>
              <Eye size={16} />
              <span style={sx.spacing.ml(1)}>Visibilité</span>
            </div>
            <p style={sx.text.bold}>
              {metar.visibility === 'CAVOK' ? 'CAVOK' : metar.visibility}
            </p>
          </div>
          
          {/* Température */}
          <div style={sx.combine(sx.flex.col, sx.spacing.gap(1))}>
            <div style={sx.combine(sx.flex.start, sx.text.secondary, sx.text.sm)}>
              <Thermometer size={16} />
              <span style={sx.spacing.ml(1)}>Temp/Rosée</span>
            </div>
            <p style={sx.text.bold}>
              {metar.temperature}°C / {metar.dewpoint}°C
            </p>
          </div>
          
          {/* Pression */}
          <div style={sx.combine(sx.flex.col, sx.spacing.gap(1))}>
            <div style={sx.combine(sx.flex.start, sx.text.secondary, sx.text.sm)}>
              <Gauge size={16} />
              <span style={sx.spacing.ml(1)}>QNH</span>
            </div>
            <p style={sx.text.bold}>{metar.pressure} hPa</p>
          </div>
        </div>
      )}
      
      {/* Nuages */}
      {metar && metar.clouds.length > 0 && (
        <div style={sx.combine(sx.spacing.mt(3), sx.spacing.pt(3), { borderTop: '1px solid #e5e7eb' })}>
          <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(1))}>Nuages :</p>
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2), { flexWrap: 'wrap' })}>
            {metar.clouds.map((cloud, i) => (
              <span key={i} style={sx.combine(sx.text.sm, {
                padding: '2px 8px',
                backgroundColor: '#f3f4f6',
                borderRadius: '4px'
              })}>
                {cloud.type} {cloud.altitude}ft
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* METAR brut */}
      <details style={sx.spacing.mt(3)}>
        <summary style={{ cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>
          METAR brut
        </summary>
        <pre style={{ 
          fontSize: '12px', 
          backgroundColor: '#f9fafb', 
          padding: '8px', 
          borderRadius: '4px',
          marginTop: '8px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}>
          {weather.metar?.raw}
        </pre>
      </details>
      
      {/* TAF si disponible */}
      {weather.taf && (
        <details style={sx.spacing.mt(2)}>
          <summary style={{ cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>
            TAF
          </summary>
          <pre style={{ 
            fontSize: '12px', 
            backgroundColor: '#f9fafb', 
            padding: '8px', 
            borderRadius: '4px',
            marginTop: '8px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {weather.taf?.raw}
          </pre>
        </details>
      )}
    </div>
  );
});

// Composant pour afficher toutes les stations
const AllWeatherStations = memo(() => {
  const weatherData = useWeatherStore(state => state.weatherData);
  const stations = Array.from(weatherData.keys()).sort();
  
  if (stations.length === 0) {
    return (
      <div style={sx.combine(sx.text.center, sx.text.secondary, sx.spacing.p(8))}>
        Aucune donnée météo chargée
      </div>
    );
  }
  
  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {stations.map(icao => (
        <WeatherCard key={icao} icao={icao} />
      ))}
    </div>
  );
});

WeatherModule.displayName = 'WeatherModule';
WeatherCard.displayName = 'WeatherCard';
AllWeatherStations.displayName = 'AllWeatherStations';

export default WeatherModule;