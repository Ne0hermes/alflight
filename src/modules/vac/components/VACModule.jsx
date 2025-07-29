import React, { useEffect, useState } from 'react';
import { useFlightSystem } from '../../../context/FlightSystemContext';
import { useVACStore } from '../store/vacStore';
import { 
  Search, 
  Download, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  HardDrive, 
  Cloud, 
  Map, 
  Navigation,
  FileText,
  Calendar,
  Info
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
    marginBottom: '8px',
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
  searchBox: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px'
  },
  input: {
    flex: 1,
    padding: '10px 16px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px'
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
  buttonSecondary: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  buttonDanger: {
    padding: '8px 16px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  chartsList: {
    display: 'grid',
    gap: '12px'
  },
  chartItem: {
    padding: '16px',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa'
  },
  chartInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  chartTitle: {
    fontSize: '16px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  chartMeta: {
    fontSize: '13px',
    color: '#666',
    display: 'flex',
    gap: '16px'
  },
  chartActions: {
    display: 'flex',
    gap: '8px'
  },
  statusBadge: {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  localStatus: {
    backgroundColor: '#d4edda',
    color: '#155724'
  },
  cloudStatus: {
    backgroundColor: '#cfe2ff',
    color: '#084298'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#666'
  },
  infoBox: {
    backgroundColor: '#e7f3ff',
    border: '1px solid #b6d4fe',
    borderRadius: '6px',
    padding: '12px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    marginBottom: '20px'
  }
};

// Données simulées pour les cartes VAC
const mockVACData = {
  'LFPG': {
    icao: 'LFPG',
    name: 'Paris Charles de Gaulle',
    charts: [
      { id: 'vac-1', type: 'VAC', date: '2024-03-15', version: '24/03' },
      { id: 'iac-1', type: 'IAC', date: '2024-03-15', version: '24/03' }
    ]
  },
  'LFPO': {
    icao: 'LFPO',
    name: 'Paris Orly',
    charts: [
      { id: 'vac-2', type: 'VAC', date: '2024-02-01', version: '24/02' },
      { id: 'iac-2', type: 'IAC', date: '2024-02-01', version: '24/02' }
    ]
  },
  'LFPB': {
    icao: 'LFPB',
    name: 'Paris Le Bourget',
    charts: [
      { id: 'vac-3', type: 'VAC', date: '2024-01-15', version: '24/01' }
    ]
  }
};

// Composant pour afficher une carte VAC
const ChartItem = ({ chart, airport, onDownload, onDelete, isLocal }) => {
  const getChartIcon = (type) => {
    switch (type) {
      case 'VAC': return <Map size={16} />;
      case 'IAC': return <Navigation size={16} />;
      default: return <FileText size={16} />;
    }
  };

  return (
    <div style={styles.chartItem}>
      <div style={styles.chartInfo}>
        <div style={styles.chartTitle}>
          {getChartIcon(chart.type)}
          {airport.name} - {chart.type}
        </div>
        <div style={styles.chartMeta}>
          <span>
            <Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {new Date(chart.date).toLocaleDateString()}
          </span>
          <span>Version: {chart.version}</span>
          <span style={{ ...styles.statusBadge, ...(isLocal ? styles.localStatus : styles.cloudStatus) }}>
            {isLocal ? <HardDrive size={12} /> : <Cloud size={12} />}
            {isLocal ? ' Local' : ' Cloud'}
          </span>
        </div>
      </div>
      
      <div style={styles.chartActions}>
        {!isLocal && (
          <button 
            style={styles.buttonSecondary}
            onClick={() => onDownload(airport.icao, chart.id)}
          >
            <Download size={16} />
            Télécharger
          </button>
        )}
        {isLocal && (
          <button 
            style={styles.buttonDanger}
            onClick={() => onDelete(chart.id)}
          >
            <Trash2 size={16} />
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
};

// Composant principal VAC
export const VACModule = () => {
  const { flightPlan } = useFlightSystem();
  const { charts, downloadChart, deleteChart, searchCharts } = useVACStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // Recherche automatique basée sur le plan de vol
  useEffect(() => {
    if (flightPlan?.departure || flightPlan?.arrival) {
      const airports = [flightPlan.departure, flightPlan.arrival].filter(Boolean);
      airports.forEach(icao => {
        if (mockVACData[icao] && !charts.some(c => c.airport === icao)) {
          handleSearch(icao);
        }
      });
    }
  }, [flightPlan, charts]);

  const handleSearch = async (query) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm) return;

    setLoading(true);
    try {
      // Simulation de recherche
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const results = mockVACData[searchTerm.toUpperCase()];
      if (results) {
        setSearchResults(results);
      } else {
        setSearchResults({ notFound: true, query: searchTerm });
      }
    } catch (error) {
      console.error('Erreur de recherche:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (icao, chartId) => {
    try {
      await downloadChart(icao, chartId);
      // Simuler le téléchargement
      console.log(`Téléchargement de ${chartId} pour ${icao}`);
    } catch (error) {
      console.error('Erreur de téléchargement:', error);
    }
  };

  const handleDelete = async (chartId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette carte ?')) {
      try {
        await deleteChart(chartId);
        console.log(`Suppression de ${chartId}`);
      } catch (error) {
        console.error('Erreur de suppression:', error);
      }
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <h2 style={styles.title}>
          <Map size={24} />
          Module Cartes VAC
        </h2>
        
        <div style={styles.infoBox}>
          <Info size={20} color="#0066cc" />
          <div>
            <strong>Cartes Visual Approach Charts (VAC)</strong>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              Recherchez et téléchargez les cartes d'approche à vue pour vos aéroports.
              Les cartes sont automatiquement suggérées selon votre plan de vol.
            </div>
          </div>
        </div>

        <div style={styles.searchBox}>
          <input
            type="text"
            style={styles.input}
            placeholder="Rechercher un aéroport (code ICAO)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            maxLength={4}
          />
          <button 
            style={styles.button}
            onClick={() => handleSearch()}
            disabled={loading}
          >
            <Search size={16} />
            {loading ? 'Recherche...' : 'Rechercher'}
          </button>
        </div>
      </div>

      {searchResults && !searchResults.notFound && (
        <div style={styles.section}>
          <h3 style={styles.subtitle}>
            <Cloud size={20} />
            Cartes disponibles - {searchResults.name}
          </h3>
          <div style={styles.chartsList}>
            {searchResults.charts.map(chart => (
              <ChartItem
                key={chart.id}
                chart={chart}
                airport={searchResults}
                onDownload={handleDownload}
                onDelete={handleDelete}
                isLocal={charts.some(c => c.id === chart.id)}
              />
            ))}
          </div>
        </div>
      )}

      {searchResults?.notFound && (
        <div style={styles.section}>
          <div style={styles.emptyState}>
            <AlertCircle size={48} color="#666" />
            <h3 style={{ marginTop: '16px' }}>Aucune carte trouvée</h3>
            <p style={{ marginTop: '8px' }}>
              Aucune carte VAC disponible pour "{searchResults.query}"
            </p>
          </div>
        </div>
      )}

      <div style={styles.section}>
        <h3 style={styles.subtitle}>
          <HardDrive size={20} />
          Cartes téléchargées
        </h3>
        
        {charts.length > 0 ? (
          <div style={styles.chartsList}>
            {charts.map(chart => {
              const airport = mockVACData[chart.airport] || { 
                name: chart.airport, 
                icao: chart.airport 
              };
              return (
                <ChartItem
                  key={chart.id}
                  chart={chart}
                  airport={airport}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  isLocal={true}
                />
              );
            })}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <HardDrive size={48} color="#666" />
            <h3 style={{ marginTop: '16px' }}>Aucune carte téléchargée</h3>
            <p style={{ marginTop: '8px' }}>
              Recherchez et téléchargez des cartes VAC pour les consulter hors ligne
            </p>
          </div>
        )}
      </div>
    </div>
  );
};