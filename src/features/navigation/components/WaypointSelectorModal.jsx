// src/features/navigation/components/WaypointSelectorModal.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, MapPin, Users, Search, Loader, Plane, ChevronDown, ChevronUp, Navigation2, Ruler, Wind, Image, Info, Layers } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { aeroDataProvider } from '@core/data';
import vfrPointsService from '@services/vfrPointsService';

/**
 * Modal pour sélectionner un waypoint avec recherche unifiée
 * Séparation visuelle entre Aérodromes et Points d'intérêt
 * Avec cartes dépliables pour voir les détails
 */
export const WaypointSelectorModal = ({ isOpen, onClose, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [airports, setAirports] = useState([]);
  const [communityPoints, setCommunityPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('aerodromes'); // 'aerodromes' | 'poi'
  const [expandedId, setExpandedId] = useState(null);
  const inputRef = useRef(null);

  // Charger les données au montage (ou à l'ouverture)
  useEffect(() => {
    if (isOpen) {
      loadData();
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Reset state on close
      setExpandedId(null);
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
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

  // Filtrer les aérodromes
  const filteredAirports = useMemo(() => {
    const term = searchTerm.toUpperCase();
    const searchLower = searchTerm.toLowerCase();

    if (!searchTerm || searchTerm.length < 1) {
      // Afficher les principaux aérodromes par défaut
      const mainAirports = ['LFPG', 'LFPO', 'LFLL', 'LFML', 'LFBO', 'LFMN', 'LFRS', 'LFST', 'LFBD', 'LFRB', 'LFAT', 'LFQQ', 'LFSB', 'LFPB', 'LFKJ'];
      return airports
        .filter(a => mainAirports.includes(a.icao))
        .sort((a, b) => mainAirports.indexOf(a.icao) - mainAirports.indexOf(b.icao));
    }

    return airports.filter(a =>
      a.icao?.includes(term) ||
      a.name?.toUpperCase().includes(term) ||
      a.city?.toUpperCase().includes(term)
    ).sort((a, b) => {
      if (a.icao === term) return -1;
      if (b.icao === term) return 1;
      if (a.icao?.startsWith(term)) return -1;
      if (b.icao?.startsWith(term)) return 1;
      return 0;
    }).slice(0, 30);
  }, [searchTerm, airports]);

  // Filtrer les points d'intérêt
  const filteredPOIs = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();

    if (!searchTerm || searchTerm.length < 1) {
      // Afficher les POI récents par défaut
      return communityPoints.slice(0, 15);
    }

    return communityPoints.filter(p =>
      p.name?.toLowerCase().includes(searchLower) ||
      p.description?.toLowerCase().includes(searchLower) ||
      p.type?.toLowerCase().includes(searchLower) ||
      p.aerodrome?.toLowerCase().includes(searchLower)
    ).slice(0, 30);
  }, [searchTerm, communityPoints]);

  // Compteurs pour les badges des onglets
  const aerodromesCount = filteredAirports.length;
  const poiCount = filteredPOIs.length;

  const handleSelect = (item) => {
    if (item.type === 'aerodrome') {
      onSelect({
        type: 'aerodrome',
        data: item.data
      });
    } else {
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

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedId(expandedId === id ? null : id);
  };

  // Fonction pour formater la surface
  const formatSurface = (surface) => {
    if (!surface) return 'N/A';
    const map = {
      'ASPHALT': 'Asphalte', 'CONCRETE': 'Béton', 'GRASS': 'Herbe',
      'GRAVEL': 'Gravier', 'BITUMINOUS': 'Bitume', 'TARMAC': 'Tarmac',
      'SOIL': 'Terre', 'TURF': 'Gazon', 'SAND': 'Sable'
    };
    return map[surface?.toUpperCase()] || surface;
  };

  // Fonction pour la catégorie d'aérodrome
  const getCategoryBadge = (category) => {
    const categories = {
      'large': { label: 'Grand', color: 'var(--text-primary)', bg: 'var(--bg-overlay)' },
      'medium': { label: 'Moyen', color: 'var(--accent-primary)', bg: 'rgba(242, 105, 33, 0.10)' },
      'small': { label: 'Petit', color: 'var(--text-primary)', bg: 'var(--bg-overlay)' }
    };
    return categories[category] || { label: category || 'N/A', color: 'var(--text-secondary)', bg: 'var(--bg-overlay)' };
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
              placeholder="Rechercher un aerodrome (LF...), une ville ou un point VFR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.input}
            />
            {loading && <Loader size={16} style={styles.loader} />}
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabContainer}>
          <button
            onClick={() => setActiveTab('aerodromes')}
            style={{
              ...styles.tab,
              ...(activeTab === 'aerodromes' ? styles.tabActive : styles.tabInactive)
            }}
          >
            <Plane size={16} />
            Aerodromes
            <span style={{
              ...styles.tabBadge,
              backgroundColor: activeTab === 'aerodromes' ? 'var(--text-secondary)' : 'var(--text-tertiary)',
            }}>
              {aerodromesCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('poi')}
            style={{
              ...styles.tab,
              ...(activeTab === 'poi' ? styles.tabActivePOI : styles.tabInactive)
            }}
          >
            <MapPin size={16} />
            Points d'interet
            <span style={{
              ...styles.tabBadge,
              backgroundColor: activeTab === 'poi' ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}>
              {poiCount}
            </span>
          </button>
        </div>

        {/* Results List */}
        <div style={styles.resultsList}>
          {/* TAB AERODROMES */}
          {activeTab === 'aerodromes' && (
            <>
              {filteredAirports.length === 0 ? (
                <div style={styles.emptyState}>
                  <Plane size={48} color="var(--border-subtle)" />
                  <p style={styles.emptyText}>Aucun aerodrome trouve</p>
                  <p style={styles.emptySubText}>Essayez un code OACI (LFST) ou un nom de ville</p>
                </div>
              ) : (
                filteredAirports.map(airport => {
                  const isExpanded = expandedId === `ad-${airport.icao}`;
                  const catBadge = getCategoryBadge(airport.category);

                  return (
                    <div key={airport.icao} style={styles.cardWrapper}>
                      {/* Main row */}
                      <div
                        style={styles.resultItem}
                        className="result-item"
                      >
                        <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--bg-overlay)' }}
                          onClick={() => handleSelect({ type: 'aerodrome', data: airport })}
                        >
                          <Plane size={20} color="var(--text-secondary)" />
                        </div>
                        <div style={styles.itemContent}
                          onClick={() => handleSelect({ type: 'aerodrome', data: airport })}
                        >
                          <div style={styles.itemLabelRow}>
                            <span style={styles.itemLabel}>{airport.icao}</span>
                            <span style={styles.itemLabelSeparator}>-</span>
                            <span style={styles.itemLabelName}>{airport.name}</span>
                          </div>
                          <div style={styles.itemSubLabel}>
                            {airport.city && <span>{airport.city}</span>}
                            {airport.elevation && <span> - {airport.elevation} ft</span>}
                            {airport.runways?.length > 0 && (
                              <span> - {airport.runways.length} piste{airport.runways.length > 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>

                        {/* Category badge */}
                        <div style={{
                          padding: '2px 8px',
                          borderRadius: '8px',
                          fontSize: '10px',
                          fontWeight: '600',
                          color: catBadge.color,
                          backgroundColor: catBadge.bg,
                          marginRight: '8px',
                          whiteSpace: 'nowrap'
                        }}>
                          {catBadge.label}
                        </div>

                        {/* Expand button */}
                        <button
                          onClick={(e) => toggleExpand(`ad-${airport.icao}`, e)}
                          style={styles.expandButton}
                          title="Voir les details"
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {/* Select button */}
                        <div style={styles.actionIcon}
                          onClick={() => handleSelect({ type: 'aerodrome', data: airport })}
                        >
                          <div style={styles.plusButton} className="plus-button">+</div>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <AerodromeDetails airport={airport} formatSurface={formatSurface} />
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* TAB POINTS D'INTERET */}
          {activeTab === 'poi' && (
            <>
              {filteredPOIs.length === 0 ? (
                <div style={styles.emptyState}>
                  <MapPin size={48} color="var(--border-subtle)" />
                  <p style={styles.emptyText}>Aucun point d'interet trouve</p>
                  <p style={styles.emptySubText}>Essayez un nom ou une description</p>
                </div>
              ) : (
                filteredPOIs.map(point => {
                  const isExpanded = expandedId === `poi-${point.id}`;

                  return (
                    <div key={point.id} style={styles.cardWrapper}>
                      {/* Main row */}
                      <div
                        style={{
                          ...styles.resultItem,
                          borderLeft: '3px solid var(--text-primary)'
                        }}
                        className="result-item"
                      >
                        <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--bg-overlay)' }}
                          onClick={() => handleSelect({
                            type: 'community',
                            data: point
                          })}
                        >
                          {point.photo_url ? (
                            <img
                              src={point.photo_url}
                              alt={point.name}
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '8px',
                                objectFit: 'cover'
                              }}
                            />
                          ) : (
                            <MapPin size={20} color="var(--text-primary)" />
                          )}
                        </div>
                        <div style={styles.itemContent}
                          onClick={() => handleSelect({
                            type: 'community',
                            data: point
                          })}
                        >
                          <div style={styles.itemLabel}>{point.name}</div>
                          <div style={styles.itemSubLabel}>
                            {point.type && <span style={styles.poiTypeBadge}>{point.type}</span>}
                            {point.aerodrome && <span style={styles.poiAerodromeBadge}>{point.aerodrome}</span>}
                            {point.description && (
                              <span style={{ marginLeft: '4px' }}>
                                {point.description.length > 40
                                  ? point.description.substring(0, 40) + '...'
                                  : point.description}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expand button */}
                        <button
                          onClick={(e) => toggleExpand(`poi-${point.id}`, e)}
                          style={styles.expandButton}
                          title="Voir les details"
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {/* Select button */}
                        <div style={styles.actionIcon}
                          onClick={() => handleSelect({
                            type: 'community',
                            data: point
                          })}
                        >
                          <div style={styles.plusButton} className="plus-button">+</div>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <POIDetails point={point} />
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Composant pour les details d'un aerodrome (carte depliable)
 */
const AerodromeDetails = ({ airport, formatSurface }) => {
  return (
    <div style={styles.detailsPanel}>
      {/* Header info */}
      <div style={styles.detailsGrid}>
        <div style={styles.detailCard}>
          <div style={styles.detailCardIcon}>
            <Navigation2 size={14} color="var(--accent-primary)" />
          </div>
          <div>
            <div style={styles.detailCardLabel}>Coordonnees</div>
            <div style={styles.detailCardValue}>
              {airport.coordinates?.lat?.toFixed(4)}N, {airport.coordinates?.lon?.toFixed(4)}E
            </div>
          </div>
        </div>

        <div style={styles.detailCard}>
          <div style={styles.detailCardIcon}>
            <Layers size={14} color="var(--accent-primary)" />
          </div>
          <div>
            <div style={styles.detailCardLabel}>Elevation</div>
            <div style={styles.detailCardValue}>
              {airport.elevation ? `${airport.elevation} ft` : 'N/A'}
            </div>
          </div>
        </div>

        <div style={styles.detailCard}>
          <div style={styles.detailCardIcon}>
            <Info size={14} color="var(--accent-primary)" />
          </div>
          <div>
            <div style={styles.detailCardLabel}>Type</div>
            <div style={styles.detailCardValue}>
              {airport.type || 'AD'}
            </div>
          </div>
        </div>
      </div>

      {/* Runways */}
      {airport.runways && airport.runways.length > 0 ? (
        <div style={styles.runwaysSection}>
          <div style={styles.runwaysSectionTitle}>
            <Ruler size={14} />
            Pistes ({airport.runways.length})
          </div>
          <div style={styles.runwaysList}>
            {airport.runways.map((rwy, idx) => (
              <div key={idx} style={styles.runwayCard}>
                <div style={styles.runwayDesignation}>
                  {rwy.designation || rwy.identifier || 'N/A'}
                </div>
                <div style={styles.runwayDetails}>
                  <span style={styles.runwayDimension}>
                    {rwy.dimensions?.length || rwy.length || '?'}m x {rwy.dimensions?.width || rwy.width || '?'}m
                  </span>
                  <span style={styles.runwaySurface}>
                    {formatSurface(rwy.surface)}
                  </span>
                </div>
                {rwy.le_heading && (
                  <div style={styles.runwayQFU}>
                    QFU: {rwy.le_heading}/{rwy.he_heading}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={styles.noRunwaysMsg}>
          Aucune information de piste disponible
        </div>
      )}
    </div>
  );
};

/**
 * Composant pour les details d'un point d'interet (carte depliable)
 */
const POIDetails = ({ point }) => {
  return (
    <div style={styles.detailsPanel}>
      <div style={{ display: 'flex', gap: '16px' }}>
        {/* Photo */}
        {point.photo_url && (
          <div style={styles.poiPhotoContainer}>
            <img
              src={point.photo_url}
              alt={point.name}
              style={styles.poiPhoto}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Info */}
        <div style={{ flex: 1 }}>
          {/* Coordinates */}
          <div style={styles.detailsGrid}>
            <div style={styles.detailCard}>
              <div style={styles.detailCardIcon}>
                <Navigation2 size={14} color="var(--text-primary)" />
              </div>
              <div>
                <div style={styles.detailCardLabel}>Coordonnees</div>
                <div style={styles.detailCardValue}>
                  {point.lat?.toFixed(4)}N, {point.lon?.toFixed(4)}E
                </div>
              </div>
            </div>

            {point.altitude && (
              <div style={styles.detailCard}>
                <div style={styles.detailCardIcon}>
                  <Layers size={14} color="var(--text-primary)" />
                </div>
                <div>
                  <div style={styles.detailCardLabel}>Altitude</div>
                  <div style={styles.detailCardValue}>
                    {point.altitude} ft
                  </div>
                </div>
              </div>
            )}

            {point.frequency && (
              <div style={styles.detailCard}>
                <div style={styles.detailCardIcon}>
                  <Wind size={14} color="var(--text-primary)" />
                </div>
                <div>
                  <div style={styles.detailCardLabel}>Frequence</div>
                  <div style={styles.detailCardValue}>
                    {point.frequency}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {point.description && (
            <div style={styles.poiDescription}>
              <strong>Description:</strong> {point.description}
            </div>
          )}

          {/* Additional info */}
          <div style={styles.poiMetaGrid}>
            {point.type && (
              <div style={styles.poiMetaItem}>
                <span style={styles.poiMetaLabel}>Type:</span>
                <span style={styles.poiMetaValue}>{point.type}</span>
              </div>
            )}
            {point.aerodrome && (
              <div style={styles.poiMetaItem}>
                <span style={styles.poiMetaLabel}>Aerodrome:</span>
                <span style={styles.poiMetaValue}>{point.aerodrome}</span>
              </div>
            )}
            {point.airspace && (
              <div style={styles.poiMetaItem}>
                <span style={styles.poiMetaLabel}>Espace aerien:</span>
                <span style={styles.poiMetaValue}>{point.airspace}</span>
              </div>
            )}
            {point.airspaceClass && (
              <div style={styles.poiMetaItem}>
                <span style={styles.poiMetaLabel}>Classe:</span>
                <span style={styles.poiMetaValue}>{point.airspaceClass}</span>
              </div>
            )}
            {point.country && (
              <div style={styles.poiMetaItem}>
                <span style={styles.poiMetaLabel}>Pays:</span>
                <span style={styles.poiMetaValue}>{point.country}</span>
              </div>
            )}
            {point.aeronauticalRemarks && (
              <div style={{ ...styles.poiMetaItem, gridColumn: '1 / -1' }}>
                <span style={styles.poiMetaLabel}>Remarques:</span>
                <span style={styles.poiMetaValue}>{point.aeronauticalRemarks}</span>
              </div>
            )}
          </div>
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
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '8px',
    maxWidth: '700px',
    width: '100%',
    height: '85vh',
    maxHeight: '800px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid var(--bg-overlay)'
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-tertiary)',
    padding: '8px',
    borderRadius: '8px',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchContainer: {
    padding: '16px 24px',
    backgroundColor: 'var(--bg-overlay)'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    color: 'var(--text-tertiary)'
  },
  input: {
    width: '100%',
    padding: '14px 16px 14px 48px',
    fontSize: '16px',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    outline: 'none',
    transition: 'all 0.2s',
    backgroundColor: 'var(--bg-overlay)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
  },
  loader: {
    position: 'absolute',
    right: '16px',
    color: 'var(--text-secondary)',
    animation: 'spin 1s linear infinite'
  },

  // Tabs
  tabContainer: {
    display: 'flex',
    borderBottom: '2px solid var(--bg-overlay)',
    padding: '0 24px',
    backgroundColor: 'var(--bg-overlay)'
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px 16px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s',
    borderBottom: '3px solid transparent',
    marginBottom: '-2px',
    background: 'none'
  },
  tabActive: {
    color: 'var(--text-secondary)',
    borderBottomColor: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-overlay)'
  },
  tabActivePOI: {
    color: 'var(--text-primary)',
    borderBottomColor: 'var(--text-primary)',
    backgroundColor: 'var(--bg-overlay)'
  },
  tabInactive: {
    color: 'var(--text-secondary)',
    borderBottomColor: 'transparent'
  },
  tabBadge: {
    padding: '2px 8px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    minWidth: '20px',
    textAlign: 'center'
  },

  // Results
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
    color: 'var(--text-tertiary)',
    textAlign: 'center'
  },
  emptyText: {
    fontSize: '16px',
    fontWeight: '500',
    marginBottom: '8px'
  },
  emptySubText: {
    fontSize: '14px',
    color: 'var(--text-tertiary)'
  },
  cardWrapper: {
    marginBottom: '4px',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid var(--border-subtle)',
    transition: 'all 0.2s'
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: 'var(--bg-overlay)'
  },
  iconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '12px',
    flexShrink: 0
  },
  itemContent: {
    flex: 1,
    minWidth: 0
  },
  itemLabelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap'
  },
  itemLabel: {
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  itemLabelSeparator: {
    color: 'var(--text-tertiary)',
    fontSize: '14px'
  },
  itemLabelName: {
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--text-secondary)'
  },
  itemSubLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '2px'
  },
  expandButton: {
    background: 'none',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '8px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    marginRight: '8px'
  },
  actionIcon: {
    marginLeft: '4px'
  },
  plusButton: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-overlay)',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '18px',
    cursor: 'pointer'
  },

  // POI badges
  poiTypeBadge: {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: '8px',
    fontSize: '10px',
    fontWeight: '600',
    backgroundColor: 'var(--bg-overlay)',
    color: 'var(--text-primary)',
    marginRight: '4px'
  },
  poiAerodromeBadge: {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: '8px',
    fontSize: '10px',
    fontWeight: '600',
    backgroundColor: 'var(--bg-overlay)',
    color: 'var(--text-primary)',
    marginRight: '4px'
  },

  // Details panel (expanded)
  detailsPanel: {
    padding: '16px',
    backgroundColor: 'var(--bg-overlay)',
    borderTop: '1px solid var(--border-subtle)'
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '8px',
    marginBottom: '12px'
  },
  detailCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px 10px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)'
  },
  detailCardIcon: {
    padding: '4px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  detailCardLabel: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  detailCardValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginTop: '2px'
  },

  // Runways section
  runwaysSection: {
    marginTop: '4px'
  },
  runwaysSectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  runwaysList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  runwayCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)'
  },
  runwayDesignation: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    minWidth: '60px'
  },
  runwayDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1
  },
  runwayDimension: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-secondary)'
  },
  runwaySurface: {
    fontSize: '11px',
    color: 'var(--text-secondary)'
  },
  runwayQFU: {
    fontSize: '11px',
    color: 'var(--accent-primary)',
    fontWeight: '600',
    padding: '2px 8px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '8px'
  },
  noRunwaysMsg: {
    padding: '12px',
    textAlign: 'center',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    fontStyle: 'italic'
  },

  // POI details
  poiPhotoContainer: {
    flexShrink: 0,
    width: '140px',
    height: '140px',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-overlay)'
  },
  poiPhoto: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  poiDescription: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    marginBottom: '8px',
    lineHeight: '1.4'
  },
  poiMetaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '6px'
  },
  poiMetaItem: {
    fontSize: '12px',
    padding: '4px 8px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)'
  },
  poiMetaLabel: {
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginRight: '4px'
  },
  poiMetaValue: {
    color: 'var(--text-primary)'
  }
};

// Hover styles
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  .result-item:hover {
    background-color: var(--bg-overlay) !important;
  }
  .result-item:hover .plus-button {
    background-color: var(--text-secondary) !important;
    color: white !important;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default WaypointSelectorModal;
