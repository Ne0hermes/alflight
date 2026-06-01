// src/features/flight-wizard/steps/Step3VAC.jsx
import React, { memo, useState, useEffect } from 'react';
import {
  FileText, CheckCircle, XCircle, Download, ChevronDown, ChevronUp,
  MapPin, Radio, Plane, Navigation, Settings, AlertCircle, Cloud, ExternalLink
} from 'lucide-react';
import { theme } from '../../../styles/theme';
import { useNavigation, useWeather } from '@core/contexts';
import { useVACStore } from '@core/stores/vacStore';
import { aixmParser } from '@services/aixmParser';
// REMOVED: import { getCircuitAltitudes } from '@data/circuitAltitudesComplete'; - File deleted, data must come from official XML

/**
 * Étape 3 : Informations aérodromes et Météo
 * Affiche les informations détaillées et la météo pour chaque aérodrome
 */
export const Step3VAC = memo(({ flightPlan, onUpdate }) => {
  const { waypoints } = useNavigation();
  const { weatherData, fetchMultiple } = useWeather();
  const { charts } = useVACStore(state => ({
    charts: state.charts || {}
  }));

  const [aerodromeData, setAerodromeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedAerodrome, setExpandedAerodrome] = useState(null);
  const [expandedSection, setExpandedSection] = useState({});
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  // Ouvrir le premier aérodrome par défaut (une seule fois)
  useEffect(() => {
    if (aerodromeData.length > 0 && !hasAutoOpened) {
      setExpandedAerodrome(aerodromeData[0].icao);
      setExpandedSection({ [aerodromeData[0].icao]: 'general' });
      setHasAutoOpened(true);
    }
  }, [aerodromeData, hasAutoOpened]);

  // Récupérer la météo pour tous les aérodromes
  useEffect(() => {
    if (aerodromeData.length > 0 && fetchMultiple) {
      const icaoCodes = aerodromeData.map(ad => ad.icao).filter(Boolean);
      console.log('🌤️ [Step3VAC] Récupération météo pour:', icaoCodes);
      fetchMultiple(icaoCodes);
    }
  }, [aerodromeData, fetchMultiple]);

  // Calculer les VAC manquantes
  const getMissingVACs = () => {
    return aerodromeData
      .filter(ad => !hasVAC(ad.icao))
      .map(ad => ad.icao);
  };

  // Fonction pour déterminer le rôle d'un aérodrome
  const getAerodromeRole = (icao) => {
    // Vérifier si c'est le départ
    const isDeparture = waypoints?.find(wp =>
      wp.type === 'departure' && (wp.icao === icao || wp.name === icao)
    );
    if (isDeparture) return { role: 'departure', label: 'Départ', color: 'var(--text-primary)' };

    // Vérifier si c'est l'arrivée
    const isArrival = waypoints?.find(wp =>
      wp.type === 'arrival' && (wp.icao === icao || wp.name === icao)
    );
    if (isArrival) return { role: 'arrival', label: 'Arrivée', color: 'var(--text-secondary)' };

    // Vérifier si c'est un déroutement
    const isAlternate = flightPlan?.alternates?.find(alt => alt.icao === icao);
    if (isAlternate) return { role: 'alternate', label: 'Déroutement', color: 'var(--accent-primary)' };

    return { role: 'unknown', label: 'Autre', color: 'var(--text-secondary)' };
  };

  // Récupérer les aérodromes depuis les waypoints
  useEffect(() => {
    const loadAerodromeData = async () => {
      if (!waypoints || waypoints.length === 0) {
        setAerodromeData([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Récupérer uniquement les aérodromes (départ, arrivée, alternates)
        const aerodromeIcaos = waypoints
          .filter(wp => wp.type === 'departure' || wp.type === 'arrival')
          .map(wp => wp.icao || wp.name)
          .filter(Boolean);

        console.log('🔍 [Step3VAC] Waypoints départ/arrivée:', aerodromeIcaos);
        console.log('🔍 [Step3VAC] flightPlan.alternates:', flightPlan?.alternates);

        // Ajouter les alternates depuis le flightPlan
        if (flightPlan?.alternates) {
          flightPlan.alternates.forEach(alt => {
            console.log('🔍 [Step3VAC] Processing alternate:', alt);
            if (alt.icao && !aerodromeIcaos.includes(alt.icao)) {
              console.log('✅ [Step3VAC] Adding alternate ICAO:', alt.icao);
              aerodromeIcaos.push(alt.icao);
            } else {
              console.warn('⚠️ [Step3VAC] Alternate skipped:', {
                icao: alt.icao,
                alreadyIncluded: aerodromeIcaos.includes(alt.icao),
                alternate: alt
              });
            }
          });
        } else {
          console.warn('⚠️ [Step3VAC] No alternates in flightPlan');
        }

        console.log('🔍 [Step3VAC] Final aerodromeIcaos array:', aerodromeIcaos);

        // Charger les données AIXM pour ces aérodromes
        const aixmData = await aixmParser.loadAndParse();
        console.log('🔍 [Step3VAC] Total AIXM aerodromes:', aixmData.length);

        const filteredData = aixmData
          .filter(ad => ad && ad.icao && aerodromeIcaos.includes(ad.icao));
        // TODO: circuitAltitude must be extracted from official AIXM XML files
        // For now, it will be undefined

        console.log('✅ [Step3VAC] Filtered aerodromes:', filteredData.map(ad => ad.icao));
        setAerodromeData(filteredData);
        console.log('✅ Données aérodromes chargées pour Step3VAC:', filteredData.length);
      } catch (error) {
        console.error('❌ Erreur chargement données VAC:', error);
        setAerodromeData([]);
      } finally {
        setLoading(false);
      }
    };

    loadAerodromeData();
  }, [waypoints, flightPlan?.alternates]);

  // Fonction pour enrichir un aérodrome avec les données extraites du vacStore
  const getEnrichedAerodrome = (aerodrome) => {
    const upperIcao = aerodrome.icao?.toUpperCase();
    const chart = charts[upperIcao];

    // Si pas de chart VAC, retourner les données AIXM telles quelles
    if (!chart) {
      return aerodrome;
    }

    // Enrichir avec les données extraites de la VAC (SANS écraser les données AIXM existantes)
    const enriched = { ...aerodrome };

    // Priorité : extractedData du vacStore > données racine du chart > données AIXM
    if (chart.extractedData) {
      // Utiliser extractedData SEULEMENT si les valeurs existent
      if (chart.extractedData.transitionAltitude !== undefined) {
        enriched.transitionAltitude = chart.extractedData.transitionAltitude;
      }
      if (chart.extractedData.circuitAltitude !== undefined) {
        enriched.circuitAltitude = chart.extractedData.circuitAltitude;
      }
      if (chart.extractedData.integrationAltitude !== undefined) {
        enriched.integrationAltitude = chart.extractedData.integrationAltitude;
      }
    } else {
      // Fallback: utiliser les données au niveau racine du chart (si elles existent)
      if (chart.transitionAltitude !== undefined) {
        enriched.transitionAltitude = chart.transitionAltitude;
      }
      if (chart.circuitAltitude !== undefined) {
        enriched.circuitAltitude = chart.circuitAltitude;
      }
      if (chart.integrationAltitude !== undefined) {
        enriched.integrationAltitude = chart.integrationAltitude;
      }
    }

    // Si toujours undefined après tentative d'enrichissement, garder les valeurs AIXM originales
    // (ne rien faire, elles sont déjà dans enriched via { ...aerodrome })

    return enriched;
  };

  // Vérifier si un PDF VAC existe pour un aérodrome
  const hasVAC = (icao) => {
    const upperIcao = icao?.toUpperCase();
    const chart = charts[upperIcao];

    // Vérifier que la carte existe et qu'elle a des données réelles
    if (!chart) return false;
    if (!chart.isDownloaded && !chart.isCustom) return false;

    // Vérifier qu'il y a au moins un PDF OU des données extraites valides
    const hasPDF = chart.hasPdf || chart.url || chart.pdfFileName;
    const hasExtractedData = chart.extractedData && (
      chart.extractedData.airportElevation > 0 ||
      chart.extractedData.circuitAltitude > 0 ||
      (chart.extractedData.runways && chart.extractedData.runways.length > 0)
    );

    return hasPDF || hasExtractedData;
  };

  // Visualiser une carte VAC
  const handleViewChart = (icao) => {
    const upperIcao = icao?.toUpperCase();
    const chart = charts[upperIcao];
    if (chart?.url) {
      window.open(chart.url, '_blank');
    } else {
      alert('Aucune carte VAC disponible pour visualisation');
    }
  };

  // Basculer l'affichage d'une section
  const toggleSection = (icao, section) => {
    setExpandedSection(prev => ({
      ...prev,
      [icao]: prev[icao] === section ? null : section
    }));
  };

  // Formater les coordonnées en DMS
  const formatCoordinatesDMS = (lat, lon) => {
    if (!lat || !lon) return null;

    const formatDMS = (decimal, isLongitude) => {
      const absolute = Math.abs(decimal);
      const degrees = Math.floor(absolute);
      const minutesDecimal = (absolute - degrees) * 60;
      const minutes = Math.floor(minutesDecimal);
      const secondsDecimal = (minutesDecimal - minutes) * 60;
      const seconds = Math.floor(secondsDecimal);

      if (isLongitude) {
        const direction = decimal >= 0 ? 'E' : 'W';
        return `${degrees.toString().padStart(3, '0')}°${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}"${direction}`;
      } else {
        const direction = decimal >= 0 ? 'N' : 'S';
        return `${degrees.toString().padStart(2, '0')}°${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}"${direction}`;
      }
    };

    return {
      lat: formatDMS(lat, false),
      lon: formatDMS(lon, true)
    };
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <p>Chargement des aérodromes...</p>
        </div>
      </div>
    );
  }

  if (aerodromeData.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <FileText size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }} />
          <p style={styles.emptyText}>
            Aucun aérodrome sélectionné. Veuillez d'abord définir votre trajet à l'étape 2.
          </p>
        </div>
      </div>
    );
  }

  const missingVACs = getMissingVACs();

  return (
    <div style={styles.container}>
      {/* Alerte si des VAC manquent */}
      {missingVACs.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(242, 105, 33, 0.10)',
          border: '2px solid var(--accent-primary)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <AlertCircle size={22} color="var(--accent-primary)" />
            <span style={{
              fontWeight: 'bold',
              fontSize: '16px',
              color: 'var(--accent-primary)'
            }}>
              {missingVACs.length} carte(s) VAC manquante(s)
            </span>
          </div>
          <div style={{
            fontSize: '14px',
            color: 'var(--accent-primary)',
            lineHeight: '1.6'
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>
              <strong>Aérodromes concernés :</strong> {missingVACs.join(', ')}
            </p>
            <p style={{ margin: '0', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <span style={{ fontSize: '16px', marginTop: '2px' }}>ℹ️</span>
              <span>
                Veuillez télécharger les cartes VAC manquantes via le module <strong>"Cartes VAC"</strong> (menu de gauche) avant de générer le PDF final.
              </span>
            </p>
          </div>
        </div>
      )}

      <div style={styles.aerodromeList}>
        {aerodromeData.map(aerodromeBase => {
          // Enrichir l'aérodrome avec les données du vacStore
          const aerodrome = getEnrichedAerodrome(aerodromeBase);

          const hasChart = hasVAC(aerodrome.icao);
          const isExpanded = expandedAerodrome === aerodrome.icao;
          const currentSection = expandedSection[aerodrome.icao];
          const coordsDMS = formatCoordinatesDMS(aerodrome.coordinates?.lat, aerodrome.coordinates?.lon);

          const aerodromeRole = getAerodromeRole(aerodrome.icao);

          return (
            <div key={aerodrome.icao} style={styles.aerodromeCard}>
              {/* En-tête de la carte - Structure optimisée */}
              <div
                style={styles.aerodromeHeader}
                onClick={() => setExpandedAerodrome(isExpanded ? null : aerodrome.icao)}
              >
                <div style={styles.aerodromeInfoContainer}>
                  {/* Ligne 1: OACI + Badge Rôle + VAC Status */}
                  <div style={styles.aerodromeTopLine}>
                    <span style={styles.aerodromeIcao}>{aerodrome.icao}</span>

                    {/* Badge Rôle (Départ/Arrivée/Déroutement) */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      backgroundColor: aerodromeRole.color,
                      color: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {aerodromeRole.role === 'departure' && <Plane size={12} style={{ transform: 'rotate(-45deg)' }} />}
                      {aerodromeRole.role === 'arrival' && <Plane size={12} style={{ transform: 'rotate(45deg)' }} />}
                      {aerodromeRole.role === 'alternate' && <Navigation size={12} />}
                      <span>{aerodromeRole.label}</span>
                    </div>

                    {/* Badge VAC */}
                    {hasChart ? (
                      <div style={styles.statusSuccess}>
                        <CheckCircle size={14} />
                        <span>VAC</span>
                      </div>
                    ) : (
                      <div style={styles.statusMissing}>
                        <XCircle size={14} />
                        <span>VAC</span>
                      </div>
                    )}

                    {/* Chevron à droite */}
                    <div style={styles.expandIconInline}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>

                  {/* Ligne 2: Nom complet de l'aérodrome */}
                  <div style={styles.aerodromeNameLine}>
                    {aerodrome.name}
                  </div>

                  {/* Lignes 3-4: Boutons VAC (si disponible) */}
                  {hasChart && (
                    <div style={styles.aerodromeButtonsStack}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewChart(aerodrome.icao);
                        }}
                        style={styles.viewButtonFull}
                      >
                        <FileText size={16} />
                        Visualiser la VAC
                      </button>
                      <a
                        href={charts[aerodrome.icao?.toUpperCase()]?.url}
                        download={`VAC_${aerodrome.icao}.${charts[aerodrome.icao?.toUpperCase()]?.type?.includes('pdf') ? 'pdf' : 'png'}`}
                        onClick={(e) => e.stopPropagation()}
                        style={styles.downloadButtonFull}
                      >
                        <Download size={16} />
                        Télécharger la VAC
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Informations détaillées (expandable) */}
              {isExpanded && (
                <div style={styles.detailsContainer}>
                  {/* Section Météo */}
                  <div style={styles.meteoSection}>
                    <div style={styles.meteoHeader}>
                      <Cloud size={18} style={{ color: theme.colors.primary }} />
                      <h4 style={styles.meteoHeaderTitle}>Météo</h4>
                    </div>

                    {weatherData?.[aerodrome.icao] ? (
                      <div style={styles.meteoContainer}>
                        {/* METAR */}
                        {weatherData[aerodrome.icao].metar && (
                          <div style={styles.weatherBlock}>
                            <h5 style={styles.weatherTitle}>
                              METAR
                            </h5>
                            <div style={styles.weatherContent}>
                              <p style={styles.weatherText}>
                                {weatherData[aerodrome.icao].metar.raw || 'N/A'}
                              </p>
                              {weatherData[aerodrome.icao].metar.time && (
                                <p style={styles.weatherMeta}>
                                  Observé le {new Date(weatherData[aerodrome.icao].metar.time).toLocaleString('fr-FR')}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* TAF */}
                        {weatherData[aerodrome.icao].taf && (
                          <div style={styles.weatherBlock}>
                            <h5 style={styles.weatherTitle}>
                              TAF
                            </h5>
                            <div style={styles.weatherContent}>
                              <p style={styles.weatherText}>
                                {weatherData[aerodrome.icao].taf.raw || 'N/A'}
                              </p>
                              {weatherData[aerodrome.icao].taf.time && (
                                <p style={styles.weatherMeta}>
                                  Émis le {new Date(weatherData[aerodrome.icao].taf.time).toLocaleString('fr-FR')}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={styles.meteoEmptyState}>
                        <p style={styles.meteoEmptyText}>
                          Météo non disponible pour {aerodrome.icao}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Section Info terrain - Container */}
                  <div style={styles.terrainSection}>
                    {/* En-tête Info terrain */}
                    <div style={styles.terrainHeader}>
                      <MapPin size={18} style={{ color: theme.colors.primary }} />
                      <h4 style={styles.terrainHeaderTitle}>Info terrain</h4>
                    </div>

                    {/* Onglets de sections */}
                    <div style={styles.sectionTabs}>
                    <button
                      onClick={() => toggleSection(aerodrome.icao, 'general')}
                      style={{
                        ...styles.sectionTab,
                        ...(currentSection === 'general' ? styles.sectionTabActive : {})
                      }}
                    >
                      <MapPin size={14} /> Général
                    </button>
                    <button
                      onClick={() => toggleSection(aerodrome.icao, 'runways')}
                      style={{
                        ...styles.sectionTab,
                        ...(currentSection === 'runways' ? styles.sectionTabActive : {})
                      }}
                    >
                      <Plane size={14} /> Pistes
                    </button>
                    <button
                      onClick={() => toggleSection(aerodrome.icao, 'frequencies')}
                      style={{
                        ...styles.sectionTab,
                        ...(currentSection === 'frequencies' ? styles.sectionTabActive : {})
                      }}
                    >
                      <Radio size={14} /> Fréquences
                    </button>
                    <button
                      onClick={() => toggleSection(aerodrome.icao, 'vfr')}
                      style={{
                        ...styles.sectionTab,
                        ...(currentSection === 'vfr' ? styles.sectionTabActive : {})
                      }}
                    >
                      <Navigation size={14} /> VFR
                    </button>
                    <button
                      onClick={() => toggleSection(aerodrome.icao, 'services')}
                      style={{
                        ...styles.sectionTab,
                        ...(currentSection === 'services' ? styles.sectionTabActive : {})
                      }}
                    >
                      <Settings size={14} /> Services
                    </button>
                  </div>

                  {/* Contenu des sections */}
                  <div style={styles.sectionContent}>
                    {/* Section Général */}
                    {currentSection === 'general' && (
                      <div style={styles.section}>
                        <div style={styles.infoGrid}>
                          <div style={styles.infoItem}>
                            <span style={styles.infoLabel}>Élévation terrain</span>
                            <span style={styles.infoValue}>
                              {/* Utiliser valueFt normalisé (parser garantit la conversion m→ft si nécessaire) */}
                              {aerodrome.elevation?.valueFt != null
                                ? `${aerodrome.elevation.valueFt} ft`
                                : aerodrome.elevation?.value != null
                                  ? `${aerodrome.elevation.value} ft`
                                  : 'N/A'}
                            </span>
                          </div>
                          <div style={styles.infoItem}>
                            <span style={styles.infoLabel}>Altitude transition</span>
                            <span style={styles.infoValue}>
                              {aerodrome.transitionAltitude ? `${aerodrome.transitionAltitude} ft` : 'N/A'}
                            </span>
                          </div>
                          <div style={styles.infoItem}>
                            <span style={styles.infoLabel}>Alt. tour de piste</span>
                            <span style={styles.infoValue}>
                              {(() => {
                                const elevFt = aerodrome.elevation?.valueFt ?? aerodrome.elevation?.value;
                                return aerodrome.circuitAltitude && elevFt != null
                                  ? `${elevFt + aerodrome.circuitAltitude} ft (${aerodrome.circuitAltitude} AAL)`
                                  : 'N/A';
                              })()}
                            </span>
                          </div>
                          <div style={styles.infoItem}>
                            <span style={styles.infoLabel}>Alt. intégration</span>
                            <span style={styles.infoValue}>
                              {(() => {
                                const elevFt = aerodrome.elevation?.valueFt ?? aerodrome.elevation?.value;
                                return aerodrome.integrationAltitude && elevFt != null
                                  ? `${elevFt + aerodrome.integrationAltitude} ft (${aerodrome.integrationAltitude} AAL)`
                                  : 'N/A';
                              })()}
                            </span>
                          </div>
                        </div>

                        {coordsDMS && (
                          <div style={{ ...styles.infoGrid, marginTop: '12px' }}>
                            <div style={styles.infoItem}>
                              <span style={styles.infoLabel}>Latitude</span>
                              <span style={styles.infoValue}>{coordsDMS.lat}</span>
                              <span style={styles.infoValueSecondary}>
                                {aerodrome.coordinates?.lat?.toFixed(6)}°
                              </span>
                            </div>
                            <div style={styles.infoItem}>
                              <span style={styles.infoLabel}>Longitude</span>
                              <span style={styles.infoValue}>{coordsDMS.lon}</span>
                              <span style={styles.infoValueSecondary}>
                                {aerodrome.coordinates?.lon?.toFixed(6)}°
                              </span>
                            </div>
                          </div>
                        )}

                        {aerodrome.magneticVariation?.value && (
                          <div style={{ ...styles.infoGrid, marginTop: '12px' }}>
                            <div style={styles.infoItem}>
                              <span style={styles.infoLabel}>Déclinaison magnétique</span>
                              <span style={styles.infoValue}>
                                {Math.abs(aerodrome.magneticVariation.value)}° {aerodrome.magneticVariation.value >= 0 ? 'E' : 'W'}
                                {aerodrome.magneticVariation.date && ` (${aerodrome.magneticVariation.date})`}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section Pistes */}
                    {currentSection === 'runways' && (
                      <div style={styles.section}>
                        {aerodrome.runways && aerodrome.runways.length > 0 ? (
                          aerodrome.runways.map((rwy, idx) => (
                            <div key={idx} style={styles.runwayCard}>
                              <div style={styles.runwayHeader}>
                                <span style={styles.runwayDesignation}>
                                  {rwy.designation || rwy.identifier}
                                </span>
                                <span style={styles.runwayDimensions}>
                                  {rwy.length}m × {rwy.width}m
                                </span>
                              </div>
                              <div style={styles.runwayDetails}>
                                <div style={styles.runwayDetailItem}>
                                  <span>TORA:</span> <strong>{rwy.tora || 'N/A'}m</strong>
                                </div>
                                <div style={styles.runwayDetailItem}>
                                  <span>TODA:</span> <strong>{rwy.toda || 'N/A'}m</strong>
                                </div>
                                <div style={styles.runwayDetailItem}>
                                  <span>ASDA:</span> <strong>{rwy.asda || 'N/A'}m</strong>
                                </div>
                                <div style={styles.runwayDetailItem}>
                                  <span>LDA:</span> <strong>{rwy.lda || 'N/A'}m</strong>
                                </div>
                              </div>
                              <div style={styles.runwayInfo}>
                                <span>Surface: {rwy.surface || 'N/A'}</span>
                                {rwy.qfu && <span>• QFU: {parseFloat(rwy.qfu).toFixed(1)}°</span>}
                                {rwy.ils && <span>• ILS CAT {rwy.ils.category}</span>}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p style={styles.noData}>Aucune information de piste disponible</p>
                        )}
                      </div>
                    )}

                    {/* Section Fréquences */}
                    {currentSection === 'frequencies' && (
                      <div style={styles.section}>
                        {aerodrome.frequencies && Object.keys(aerodrome.frequencies).length > 0 ? (
                          Object.entries(aerodrome.frequencies).map(([service, freqs]) => {
                            const serviceIcons = {
                              TWR: '🗼', GND: '🚖', APP: '📡', ATIS: '📻',
                              AFIS: '📢', INFO: 'ℹ️', CTAF: '🔊'
                            };
                            const icon = serviceIcons[service.toUpperCase()] || '📻';

                            return (
                              <div key={service} style={styles.frequencyItem}>
                                <span style={styles.frequencyService}>
                                  {icon} {service.toUpperCase()}
                                </span>
                                <span style={styles.frequencyValue}>
                                  {Array.isArray(freqs)
                                    ? freqs.map(f => f.frequency).join(', ')
                                    : freqs}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <p style={styles.noData}>Aucune fréquence disponible</p>
                        )}
                      </div>
                    )}

                    {/* Section VFR */}
                    {currentSection === 'vfr' && (
                      <div style={styles.section}>
                        {aerodrome.vfrPoints && aerodrome.vfrPoints.length > 0 ? (
                          aerodrome.vfrPoints.map((point, idx) => (
                            <div key={idx} style={styles.vfrPointItem}>
                              <div style={styles.vfrPointHeader}>
                                <span style={styles.vfrPointName}>{point.name}</span>
                                <span style={styles.vfrPointType}>{point.type || 'VRP'}</span>
                              </div>
                              {point.description && (
                                <p style={styles.vfrPointDescription}>{point.description}</p>
                              )}
                              {point.coordinates && (
                                <p style={styles.vfrPointCoords}>
                                  {point.coordinates.lat?.toFixed(4)}°N, {point.coordinates.lon?.toFixed(4)}°E
                                </p>
                              )}
                            </div>
                          ))
                        ) : (
                          <p style={styles.noData}>Aucun point VFR répertorié</p>
                        )}
                      </div>
                    )}

                    {/* Section Services */}
                    {currentSection === 'services' && (
                      <div style={styles.section}>
                        {aerodrome.adminInfo?.telephone && (
                          <div style={styles.contactInfo}>
                            <span style={styles.contactLabel}>☎️ Téléphone:</span>
                            <span style={styles.contactValue}>{aerodrome.adminInfo.telephone}</span>
                          </div>
                        )}

                        <div style={styles.servicesGrid}>
                          {[
                            { key: 'fuel', label: 'Carburant', icon: '⛽' },
                            { key: 'avgas100LL', label: 'AVGAS 100LL', icon: '🛢️' },
                            { key: 'maintenance', label: 'Maintenance', icon: '🔧' },
                            { key: 'restaurant', label: 'Restaurant', icon: '🍽️' },
                            { key: 'hotel', label: 'Hôtel', icon: '🏨' },
                            { key: 'parking', label: 'Parking', icon: '🅿️' }
                          ].map(service => (
                            aerodrome.services?.[service.key] && (
                              <div key={service.key} style={styles.serviceItem}>
                                <span>{service.icon}</span>
                                <span>{service.label}</span>
                              </div>
                            )
                          ))}
                        </div>

                        {!aerodrome.services || Object.values(aerodrome.services).every(v => !v) ? (
                          <p style={styles.noData}>Aucune information de services disponible</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const styles = {
  container: {
    padding: '0',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  },
  icon: {
    color: theme.colors.primary
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    margin: 0
  },
  infoBox: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: 'var(--bg-overlay)',
    borderLeft: '4px solid var(--text-secondary)',
    borderRadius: 'var(--radius-sm)'
  },
  infoText: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--text-primary)',
    lineHeight: '1.6'
  },
  weatherBlock: {
    padding: '16px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)'
  },
  weatherTitle: {
    margin: '0 0 12px 0',
    fontSize: '15px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center'
  },
  weatherContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  weatherText: {
    margin: 0,
    fontSize: '13px',
    fontFamily: 'monospace',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-surface)',
    padding: '12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: '1.6'
  },
  weatherMeta: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontStyle: 'italic'
  },
  weatherLoading: {
    textAlign: 'center',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  meteoSection: {
    padding: '16px',
    backgroundColor: 'var(--bg-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    margin: '12px'
  },
  meteoHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px'
  },
  meteoHeaderTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  meteoContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  meteoEmptyState: {
    padding: '20px',
    textAlign: 'center',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)'
  },
  meteoEmptyText: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    fontStyle: 'italic'
  },
  terrainSection: {
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    margin: '12px',
    backgroundColor: 'var(--bg-overlay)',
    overflow: 'hidden'
  },
  terrainHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 16px 12px'
  },
  terrainHeaderTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  description: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '24px',
    lineHeight: '1.5'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: 'var(--text-secondary)'
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0
  },
  aerodromeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  aerodromeCard: {
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface)',
    overflow: 'hidden',
    transition: 'box-shadow 0.2s'
  },
  aerodromeHeader: {
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 16px',
    backgroundColor: 'var(--bg-overlay)',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  aerodromeInfoContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '100%'
  },
  aerodromeTopLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  aerodromeIcao: {
    fontSize: '18px',
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  aerodromeNameLine: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontWeight: '500'
  },
  aerodromeButtonsStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '4px'
  },
  expandIconInline: {
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    marginLeft: 'auto'
  },
  aerodromeInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1
  },
  aerodromeName: {
    fontSize: '14px',
    color: 'var(--text-secondary)'
  },
  aerodromeElevation: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    fontStyle: 'italic'
  },
  expandIcon: {
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center'
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center'
  },
  statusSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: 'var(--bg-overlay)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '11px',
    fontWeight: '600'
  },
  statusMissing: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: 'var(--bg-overlay)',
    color: '#C04534',
    borderRadius: 'var(--radius-sm)',
    fontSize: '11px',
    fontWeight: '600'
  },
  aerodromeActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  uploadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'var(--text-secondary)',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  viewButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'var(--text-primary)',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  downloadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'var(--bg-surface)',
    color: theme.colors.primary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 'var(--radius-sm)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'all 0.2s'
  },
  viewButtonFull: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    width: '100%',
    backgroundColor: 'var(--text-primary)',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    boxSizing: 'border-box'
  },
  downloadButtonFull: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    width: '100%',
    backgroundColor: 'var(--bg-surface)',
    color: theme.colors.primary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 'var(--radius-sm)',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'all 0.2s',
    boxSizing: 'border-box'
  },
  detailsContainer: {
    borderTop: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-surface)'
  },
  sectionTabs: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-overlay)'
  },
  sectionTab: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '8px',
    padding: '10px 16px',
    width: '100%',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    transition: 'all 0.2s',
    boxSizing: 'border-box'
  },
  sectionTabActive: {
    color: 'var(--bg-surface)',
    backgroundColor: 'var(--text-secondary)',
    borderColor: 'var(--text-secondary)'
  },
  sectionContent: {
    padding: '16px'
  },
  section: {
    fontSize: '13px'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px'
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  infoLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  infoValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  infoValueSecondary: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    fontStyle: 'italic'
  },
  runwayCard: {
    padding: '12px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '8px',
    border: '1px solid var(--border-subtle)'
  },
  runwayHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  runwayDesignation: {
    fontSize: '16px',
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  runwayDimensions: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: '500'
  },
  runwayDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    marginBottom: '8px'
  },
  runwayDetailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontSize: '12px',
    color: 'var(--text-secondary)'
  },
  runwayInfo: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  frequencyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '6px',
    border: '1px solid var(--border-subtle)'
  },
  frequencyService: {
    fontSize: '13px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  frequencyValue: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    fontFamily: 'monospace'
  },
  vfrPointItem: {
    padding: '10px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '8px',
    border: '1px solid var(--border-subtle)'
  },
  vfrPointHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  },
  vfrPointName: {
    fontSize: '14px',
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  vfrPointType: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--border-subtle)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)'
  },
  vfrPointDescription: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    margin: '4px 0'
  },
  vfrPointCoords: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    fontFamily: 'monospace',
    margin: '4px 0 0'
  },
  contactInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'var(--bg-overlay)',
    border: '2px solid #C04534',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '16px'
  },
  contactLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#C04534'
  },
  contactValue: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#C04534',
    fontFamily: 'monospace'
  },
  servicesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '8px'
  },
  serviceItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-overlay)',
    border: '1px solid var(--bg-overlay)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--text-primary)'
  },
  noData: {
    textAlign: 'center',
    padding: '20px',
    color: 'var(--text-tertiary)',
    fontSize: '13px',
    fontStyle: 'italic'
  }
};

Step3VAC.displayName = 'Step3VAC';

export default Step3VAC;
