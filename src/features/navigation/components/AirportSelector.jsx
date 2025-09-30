// src/features/navigation/components/AirportSelector.jsx
import React, { memo, useState, useRef, useEffect } from 'react';
import { Search, MapPin, Download, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { aeroDataProvider } from '@core/data';
import { useVACStore } from '@core/stores/vacStore';
import { sx } from '@shared/styles/styleSystem';

export const AirportSelector = memo(({ 
  label, 
  value, 
  onChange, 
  placeholder = "Rechercher un aérodrome...",
  excludeIcao = null // Pour exclure l'aérodrome opposé
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  
  const [airports, setAirports] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Charger les aéroports au montage
  useEffect(() => {
    const loadAirports = async () => {
      try {
        setLoading(true);
        const data = await aeroDataProvider.getAirfields({ country: 'FR' });
        setAirports(data);
      } catch (error) {
        console.error('Erreur lors du chargement des aéroports:', error);
      } finally {
        setLoading(false);
      }
    };
    loadAirports();
  }, []);
  const { downloadChart } = useVACStore();
  
  // Fermer le dropdown si on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  
  // Filtrer les aérodromes
  const filteredAirports = airports.filter(airport => 
    airport.icao !== excludeIcao &&
    (search === '' || 
     airport.icao.toLowerCase().includes(search.toLowerCase()) ||
     airport.name.toLowerCase().includes(search.toLowerCase()) ||
     (airport.city && airport.city.toLowerCase().includes(search.toLowerCase())))
  );
  
  const handleSelect = (airport) => {
    onChange(airport);
    setIsOpen(false);
    setSearch('');
  };
  
  const getVacStatus = (icao) => {
    // OpenAIP supprimé - retour par défaut
    return { hasVac: false, lastUpdate: null };
  };
  
  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <label style={sx.components.label.base}>
        {label}
      </label>
      
      {/* Input de recherche */}
      <div 
        style={sx.combine(
          sx.components.input.base,
          { 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <MapPin size={16} />
        {value ? (
          <div style={{ flex: 1 }}>
            <strong>{value.icao}</strong> - {value.name}
            {value.city && <span style={sx.text.secondary}> ({value.city})</span>}
          </div>
        ) : (
          <span style={sx.combine(sx.text.secondary, { flex: 1 })}>
            {placeholder}
          </span>
        )}
        {value && getVacStatus(value.icao).icon}
      </div>
      
      {/* Dropdown */}
      {isOpen && (
        <div style={styles.dropdown}>
          {/* Barre de recherche */}
          <div style={styles.searchBar}>
            <Search size={16} style={{ color: '#6b7280' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ICAO, nom ou ville..."
              style={styles.searchInput}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          {/* Liste des aérodromes */}
          <div style={styles.airportList}>
            {filteredAirports.length === 0 ? (
              <div style={styles.noResults}>
                Aucun aérodrome trouvé
              </div>
            ) : (
              filteredAirports.slice(0, 10).map(airport => {
                const vacStatus = getVacStatus(airport.icao);
                
                return (
                  <AirportItem
                    key={airport.icao}
                    airport={airport}
                    vacStatus={vacStatus}
                    onSelect={handleSelect}
                    onDownloadVAC={() => downloadChart(airport.icao)}
                  />
                );
              })
            )}
          </div>
          
          {/* Légende */}
          <div style={styles.legend}>
            <div style={styles.legendItem}>
              <span>✅</span> VAC OK
            </div>
            <div style={styles.legendItem}>
              <span>⚠️</span> VAC manquante
            </div>
            <div style={styles.legendItem}>
              <span>❗</span> Divergence GPS
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// Composant pour un élément d'aérodrome
const AirportItem = memo(({ airport, vacStatus, onSelect, onDownloadVAC }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <div>
      <div 
        style={sx.combine(
          styles.airportItem,
          vacStatus.status === 'discrepancy' && styles.airportItemWarning
        )}
      >
        <div 
          style={styles.airportMain}
          onClick={() => onSelect(airport)}
        >
          <div style={styles.airportInfo}>
            <div>
              <strong>{airport.icao}</strong> - {airport.name}
              {airport.city && (
                <span style={sx.text.secondary}> ({airport.city})</span>
              )}
            </div>
            <div style={sx.combine(sx.text.xs, sx.text.secondary)}>
              {airport.coordinates.lat.toFixed(4)}°, {airport.coordinates.lon.toFixed(4)}°
              {airport.elevation && ` • ${airport.elevation} ft`}
            </div>
          </div>
          
          <div style={styles.airportActions}>
            <span style={styles.statusIcon} title={getStatusTooltip(vacStatus)}>
              {vacStatus.icon}
            </span>
            
            {vacStatus.status === 'not_downloaded' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadVAC();
                }}
                style={styles.downloadButton}
                title="Télécharger la carte VAC"
              >
                <Download size={14} />
              </button>
            )}
            
            {vacStatus.status === 'discrepancy' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(!showDetails);
                }}
                style={styles.infoButton}
                title="Voir les divergences"
              >
                <Info size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Détails des divergences */}
      {showDetails && vacStatus.status === 'discrepancy' && (
        <DiscrepancyDetails 
          airportIcao={airport.icao}
        />
      )}
    </div>
  );
});

// Composant pour afficher les détails des divergences
const DiscrepancyDetails = memo(({ airportIcao }) => {
  const { coordinateValidation } = useOpenAIPStore();
  const discrepancies = Object.entries(coordinateValidation)
    .filter(([key, val]) => key.startsWith(airportIcao) && !val.isValid)
    .map(([key, val]) => ({
      pointCode: key.split('_')[1],
      ...val
    }));
  
  return (
    <div style={styles.discrepancyDetails}>
      <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
        <AlertTriangle size={14} style={{ marginRight: '4px' }} />
        Divergences détectées
      </h5>
      
      {discrepancies.map(disc => (
        <div key={disc.pointCode} style={styles.discrepancyItem}>
          <strong>Point {disc.pointCode}</strong>
          <div style={sx.text.xs}>
            <div>OpenAIP: {disc.openAipCoords.lat.toFixed(6)}°, {disc.openAipCoords.lon.toFixed(6)}°</div>
            <div>VAC: {disc.vacCoords.lat.toFixed(6)}°, {disc.vacCoords.lon.toFixed(6)}°</div>
            <div style={{ color: '#dc2626' }}>
              Écart: {disc.distance.toFixed(0)}m
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

// Fonction helper pour le tooltip
const getStatusTooltip = (vacStatus) => {
  switch (vacStatus.status) {
    case 'ok':
      return 'Carte VAC téléchargée et coordonnées cohérentes';
    case 'not_downloaded':
      return 'Carte VAC non téléchargée';
    case 'discrepancy':
      return 'Divergence détectée entre OpenAIP et la carte VAC';
    case 'not_available':
      return 'Carte VAC non disponible';
    default:
      return '';
  }
};

// Styles
const styles = {
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    maxHeight: '400px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  searchBar: {
    padding: '12px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px'
  },
  airportList: {
    flex: 1,
    overflow: 'auto'
  },
  airportItem: {
    borderBottom: '1px solid #e5e7eb',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#f9fafb'
    }
  },
  airportItemWarning: {
    backgroundColor: '#fef3c7'
  },
  airportMain: {
    padding: '12px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  airportInfo: {
    flex: 1
  },
  airportActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statusIcon: {
    fontSize: '18px'
  },
  downloadButton: {
    padding: '4px 8px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#2563eb'
    }
  },
  infoButton: {
    padding: '4px 8px',
    backgroundColor: '#f59e0b',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#d97706'
    }
  },
  noResults: {
    padding: '24px',
    textAlign: 'center',
    color: '#6b7280'
  },
  legend: {
    padding: '8px 12px',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: '#6b7280'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  discrepancyDetails: {
    padding: '12px',
    backgroundColor: '#fef3c7',
    borderTop: '1px solid #fbbf24'
  },
  discrepancyItem: {
    marginBottom: '8px',
    padding: '8px',
    backgroundColor: 'white',
    borderRadius: '4px'
  }
};

AirportSelector.displayName = 'AirportSelector';
AirportItem.displayName = 'AirportItem';
DiscrepancyDetails.displayName = 'DiscrepancyDetails';

export default AirportSelector;