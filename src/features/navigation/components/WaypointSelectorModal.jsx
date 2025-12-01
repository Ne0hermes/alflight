// src/features/navigation/components/WaypointSelectorModal.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, MapPin, Users, Search, Loader, Plane } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { aeroDataProvider } from '@core/data';
import vfrPointsService from '@services/vfrPointsService';

/**
 * Modal pour sélectionner un waypoint avec recherche unifiée
 * (Aérodromes + Points Communauté)
 */
export const WaypointSelectorModal = ({ isOpen, onClose, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [airports, setAirports] = useState([]);
  const [communityPoints, setCommunityPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Charger les données au montage (ou à l'ouverture)
  useEffect(() => {
    if (isOpen) {
      loadData();
      // Focus sur l'input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger en parallèle
      const [airportsData, pointsData] = await Promise.all([
        aeroDataProvider.getAirfields({ country: 'FR' }),
        vfrPointsService.getAllPublicPoints().catch(err => {
          console.error('Erreur chargement points VFR:', err);
          return [];
        })
      ]);

      setAirports(airportsData || []);
      setCommunityPoints(pointsData || []);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer et combiner les résultats
  const results = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];

    const term = searchTerm.toUpperCase();
    const searchLower = searchTerm.toLowerCase();

    // Filtrer aéroports
    const matchedAirports = airports.filter(a =>
      a.icao?.includes(term) ||
      a.name?.toUpperCase().includes(term) ||
      a.city?.toUpperCase().includes(term)
    ).map(a => ({
      type: 'aerodrome',
      id: a.icao,
      label: `${a.icao} - ${a.name}`,
      subLabel: a.city,
      data: a,
      score: a.icao === term ? 100 : (a.icao.startsWith(term) ? 50 : 10)
    }));

    // Filtrer points communauté
    const matchedPoints = communityPoints.filter(p =>
      p.name?.toLowerCase().includes(searchLower) ||
      p.description?.toLowerCase().includes(searchLower)
    ).map(p => ({
      type: 'community',
      id: p.id,
      label: p.name,
      subLabel: p.type,
      data: p,
      score: p.name.toLowerCase() === searchLower ? 90 : (p.name.toLowerCase().startsWith(searchLower) ? 40 : 5)
    }));

    // Combiner et trier
    return [...matchedAirports, ...matchedPoints]
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // Limiter à 50 résultats
  }, [searchTerm, airports, communityPoints]);

  const handleSelect = (item) => {
    if (item.type === 'aerodrome') {
      onSelect({
        type: 'aerodrome',
        data: item.data
      });
    } else {
      // Formater le point communauté comme attendu
      onSelect({
        type: 'community',
        data: {
          name: item.data.name,
          lat: item.data.lat,
          lon: item.data.lon,
          altitude: item.data.altitude,
          description: item.data.description,
          type: item.data.type
        }
      });
    }
    onClose();
    setSearchTerm('');
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h3 style={styles.title}>Ajouter un point de passage</h3>
          <button onClick={onClose} style={styles.closeButton}>
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div style={styles.searchContainer}>
          <div style={styles.inputWrapper}>
            <Search size={20} style={styles.searchIcon} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Rechercher un aérodrome (LF...), une ville ou un point VFR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.input}
            />
            {loading && <Loader size={16} style={styles.loader} />}
          </div>
        </div>

        {/* Results List */}
        <div style={styles.resultsList}>
          {searchTerm.length < 2 ? (
            <div style={styles.emptyState}>
              <Search size={48} color="#e5e7eb" />
              <p style={styles.emptyText}>Commencez à taper pour rechercher...</p>
              <p style={styles.emptySubText}>Exemple: "LFAT", "Le Touquet", "Sierra"...</p>
            </div>
          ) : results.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyText}>Aucun résultat trouvé</p>
            </div>
          ) : (
            <>
              {/* Section Aérodromes */}
              {results.some(r => r.type === 'aerodrome') && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '8px',
                    paddingLeft: '8px'
                  }}>
                    Aérodromes
                  </h4>
                  {results.filter(r => r.type === 'aerodrome').map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleSelect(item)}
                      style={styles.resultItem}
                      className="result-item"
                    >
                      <div style={styles.iconWrapper}>
                        <Plane size={20} color="#2563eb" />
                      </div>
                      <div style={styles.itemContent}>
                        <div style={styles.itemLabel}>{item.label}</div>
                        <div style={styles.itemSubLabel}>
                          {item.subLabel}
                        </div>
                      </div>
                      <div style={styles.actionIcon}>
                        <div style={styles.plusButton}>+</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Section Points Communauté */}
              {results.some(r => r.type === 'community') && (
                <div>
                  <h4 style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#059669',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '8px',
                    paddingLeft: '8px',
                    marginTop: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Users size={14} />
                    Points Communauté
                  </h4>
                  {results.filter(r => r.type === 'community').map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleSelect(item)}
                      style={{
                        ...styles.resultItem,
                        borderLeft: '3px solid #10b981'
                      }}
                      className="result-item"
                    >
                      <div style={{ ...styles.iconWrapper, backgroundColor: '#ecfdf5' }}>
                        <Users size={20} color="#16a34a" />
                      </div>
                      <div style={styles.itemContent}>
                        <div style={styles.itemLabel}>{item.label}</div>
                        <div style={styles.itemSubLabel}>
                          {item.subLabel} • {item.data.description}
                        </div>
                      </div>
                      <div style={styles.actionIcon}>
                        <div style={styles.plusButton} className="plus-button">+</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
    backdropFilter: 'blur(4px)'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    maxWidth: '600px',
    width: '100%',
    height: '80vh',
    maxHeight: '700px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #f3f4f6'
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    padding: '8px',
    borderRadius: '8px',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchContainer: {
    padding: '20px 24px',
    borderBottom: '1px solid #f3f4f6',
    backgroundColor: '#f9fafb'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    color: '#9ca3af'
  },
  input: {
    width: '100%',
    padding: '14px 16px 14px 48px',
    fontSize: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    outline: 'none',
    transition: 'all 0.2s',
    backgroundColor: 'white',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
  },
  loader: {
    position: 'absolute',
    right: '16px',
    color: '#3b82f6',
    animation: 'spin 1s linear infinite'
  },
  resultsList: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    color: '#9ca3af',
    textAlign: 'center'
  },
  emptyText: {
    fontSize: '16px',
    fontWeight: '500',
    marginBottom: '8px'
  },
  emptySubText: {
    fontSize: '14px',
    color: '#d1d5db'
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: '4px',
    border: '1px solid transparent',
    ':hover': {
      backgroundColor: '#f3f4f6'
    }
  },
  iconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '16px',
    flexShrink: 0
  },
  itemContent: {
    flex: 1
  },
  itemLabel: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '2px'
  },
  itemSubLabel: {
    fontSize: '13px',
    color: '#6b7280'
  },
  actionIcon: {
    marginLeft: '12px'
  },
  plusButton: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#eff6ff',
    color: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '18px'
  }
};

// Add style for hover effect via JS since inline styles don't support pseudo-classes
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  .result-item:hover {
    background-color: #f9fafb !important;
    border-color: #e5e7eb !important;
  }
  .result-item:hover .plus-button {
    background-color: #3b82f6 !important;
    color: white !important;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default WaypointSelectorModal;
