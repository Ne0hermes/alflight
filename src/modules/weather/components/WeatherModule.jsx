import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Wind,
  Eye,
  Droplets,
  Thermometer,
  Navigation,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Gauge,
  ChevronRight
} from 'lucide-react';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    padding: '24px',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh'
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  subtitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px'
  },
  weatherCard: {
    padding: '16px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e9ecef'
  },
  weatherHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px'
  },
  weatherTitle: {
    fontSize: '16px',
    fontWeight: '600'
  },
  weatherValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#0066cc'
  },
  weatherUnit: {
    fontSize: '14px',
    color: '#666',
    marginLeft: '4px'
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffeaa7',
    borderRadius: '6px',
    padding: '12px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    marginTop: '16px'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #e9ecef'
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background-color 0.2s'
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px'
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500'
  },
  vfrStatus: {
    backgroundColor: '#d4edda',
    color: '#155724'
  },
  ifrStatus: {
    backgroundColor: '#f8d7da',
    color: '#721c24'
  },
  mvfrStatus: {
    backgroundColor: '#fff3cd',
    color: '#856404'
  }
};

// Données météo simulées
const generateMockWeatherData = (icao) => ({
  metar: {
    icao: icao || 'LFPG',
    observed: new Date().toISOString(),
    temperature: 15,
    dewpoint: 10,
    altimeter: 29.92,
    visibility: 10,
    windDirection: 270,
    windSpeed: 12,
    windGust: null,
    flightCategory: 'VFR',
    cloudLayers: [
      { coverage: 'FEW', altitude: 2500 },
      { coverage: 'SCT', altitude: 5000 }
    ],
    raw: `${icao || 'LFPG'} ${new Date().toISOString().slice(11, 16)}Z 27012KT 10SM FEW025 SCT050 15/10 A2992`
  },
  taf: {
    icao: icao || 'LFPG',
    issued: new Date().toISOString(),
    validFrom: new Date().toISOString(),
    validTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    forecast: [
      {
        from: new Date().toISOString(),
        to: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        visibility: 10,
        windDirection: 270,
        windSpeed: 12,
        cloudLayers: [{ coverage: 'SCT', altitude: 5000 }]
      }
    ]
  }
});

// Composant pour afficher une carte météo
const WeatherCard = ({ icon: Icon, title, value, unit, color = '#0066cc' }) => (
  <div style={styles.weatherCard}>
    <div style={styles.weatherHeader}>
      <Icon size={20} color={color} />
      <span style={styles.weatherTitle}>{title}</span>
    </div>
    <div>
      <span style={{ ...styles.weatherValue, color }}>{value}</span>
      <span style={styles.weatherUnit}>{unit}</span>
    </div>
  </div>
);

// Composant pour la recherche météo
const WeatherSearch = ({ onSearch, loading }) => {
  const [icao, setIcao] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (icao.trim()) {
      onSearch(icao.toUpperCase());
    }
  };

  return (
    <div style={styles.section}>
      <h3 style={styles.subtitle}>
        <MapPin size={20} />
        Recherche Météo Aéroport
      </h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px' }}>
        <input
          style={styles.input}
          type="text"
          placeholder="Code ICAO (ex: LFPG)"
          value={icao}
          onChange={(e) => setIcao(e.target.value.toUpperCase())}
          maxLength={4}
        />
        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Chargement...
            </>
          ) : (
            <>
              <Cloud size={16} />
              Rechercher
            </>
          )}
        </button>
      </form>
    </div>
  );
};

// Composant pour afficher le METAR
const MetarDisplay = ({ metar }) => {
  if (!metar) return null;

  const getFlightCategoryStyle = (category) => {
    switch (category) {
      case 'VFR': return styles.vfrStatus;
      case 'MVFR': return styles.mvfrStatus;
      case 'IFR': return styles.ifrStatus;
      default: return {};
    }
  };

  // Vérification de sécurité pour l'aéroport
  const airportName = metar.station?.name || metar.icao || 'Aéroport inconnu';

  return (
    <div style={styles.section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={styles.subtitle}>
          <Cloud size={20} />
          METAR - {airportName}
        </h3>
        <span style={{ ...styles.statusBadge, ...getFlightCategoryStyle(metar.flightCategory) }}>
          {metar.flightCategory || 'N/A'}
        </span>
      </div>

      <div style={styles.grid}>
        <WeatherCard
          icon={Wind}
          title="Vent"
          value={`${metar.windDirection || 0}° / ${metar.windSpeed || 0}`}
          unit="kts"
          color="#0066cc"
        />
        <WeatherCard
          icon={Eye}
          title="Visibilité"
          value={metar.visibility || 'N/A'}
          unit="SM"
          color="#28a745"
        />
        <WeatherCard
          icon={Thermometer}
          title="Température"
          value={metar.temperature || 'N/A'}
          unit="°C"
          color="#dc3545"
        />
        <WeatherCard
          icon={Gauge}
          title="Altimètre"
          value={metar.altimeter?.toFixed(2) || 'N/A'}
          unit="inHg"
          color="#6c757d"
        />
      </div>

      {metar.cloudLayers && metar.cloudLayers.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Couches nuageuses</h4>
          {metar.cloudLayers.map((layer, index) => (
            <div key={index} style={styles.infoRow}>
              <span>{layer.coverage}</span>
              <span>{layer.altitude} ft</span>
            </div>
          ))}
        </div>
      )}

      {metar.raw && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '6px', fontFamily: 'monospace', fontSize: '13px' }}>
          {metar.raw}
        </div>
      )}
    </div>
  );
};

// Composant pour afficher les vents en altitude
const WindsAloftDisplay = ({ windsAloft }) => {
  if (!windsAloft || typeof windsAloft !== 'object') return null;

  // Convertir l'objet en tableau si nécessaire
  const windsArray = Array.isArray(windsAloft) 
    ? windsAloft 
    : Object.entries(windsAloft).map(([altitude, data]) => ({
        altitude,
        ...data
      }));

  return (
    <div style={styles.section}>
      <h3 style={styles.subtitle}>
        <Wind size={20} />
        Vents en Altitude
      </h3>
      
      <div style={{ display: 'grid', gap: '8px' }}>
        {windsArray.map((wind, index) => (
          <div key={index} style={styles.infoRow}>
            <span>{wind.altitude} ft</span>
            <span>
              {wind.direction || 0}° / {wind.speed || 0} kts
              {wind.temperature && ` / ${wind.temperature}°C`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Composant pour les avertissements météo
const WeatherWarnings = ({ metar, taf }) => {
  const warnings = [];

  if (metar) {
    if (metar.windSpeed > 25) {
      warnings.push({ type: 'wind', message: 'Vent fort détecté' });
    }
    if (metar.visibility < 5) {
      warnings.push({ type: 'visibility', message: 'Visibilité réduite' });
    }
    if (metar.flightCategory === 'IFR') {
      warnings.push({ type: 'ifr', message: 'Conditions IFR' });
    }
  }

  if (warnings.length === 0) return null;

  return (
    <div style={styles.warningBox}>
      <AlertTriangle size={20} color="#856404" />
      <div>
        <strong>Avertissements :</strong>
        <ul style={{ margin: '4px 0 0 20px', fontSize: '13px' }}>
          {warnings.map((warning, index) => (
            <li key={index}>{warning.message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// Composant principal
export const WeatherModule = () => {
  const [loading, setLoading] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [windsAloft, setWindsAloft] = useState([
    { altitude: '3000', direction: 270, speed: 15, temperature: 10 },
    { altitude: '6000', direction: 280, speed: 25, temperature: 5 },
    { altitude: '9000', direction: 290, speed: 35, temperature: 0 },
    { altitude: '12000', direction: 300, speed: 45, temperature: -10 }
  ]);

  const fetchWeatherData = async (icao) => {
    setLoading(true);
    try {
      // Simulation de récupération des données
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockData = generateMockWeatherData(icao);
      setWeatherData(mockData);
      setSelectedAirport(icao);
    } catch (error) {
      console.error('Erreur lors de la récupération des données météo:', error);
    } finally {
      setLoading(false);
    }
  };

  // Charger les données météo par défaut
  useEffect(() => {
    fetchWeatherData('LFPG');
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <h2 style={styles.title}>
          <Cloud size={24} />
          Module Météo Aviation
        </h2>
      </div>

      <WeatherSearch onSearch={fetchWeatherData} loading={loading} />

      {weatherData && (
        <>
          <MetarDisplay metar={weatherData.metar} />
          <WindsAloftDisplay windsAloft={windsAloft} />
          <WeatherWarnings metar={weatherData.metar} taf={weatherData.taf} />
        </>
      )}
    </div>
  );
};