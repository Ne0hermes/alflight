// src/features/flight-wizard/steps/Step3VAC.jsx
import React, { memo, useState, useEffect } from 'react';
import {
  FileText, CheckCircle, XCircle, Download, ChevronDown, ChevronUp,
  MapPin, Plane, Navigation, AlertCircle, Cloud, Pencil
} from 'lucide-react';
import { theme } from '../../../styles/theme';
import { useNavigation, useWeather } from '@core/contexts';
import { useWeatherStore } from '@core/stores/weatherStore';
import { useVACStore } from '@core/stores/vacStore';
import { aeroDataProvider } from '@core/data';
import { separateRunwayDirections } from '@utils/runwayDirections';
import RunwayAnalyzer from '@features/navigation/components/RunwayAnalyzer';
import VacQuickImport from '@features/vac/components/VacQuickImport';
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
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
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
    let cancelled = false;

    // Watchdog : empêche le spinner infini si un fetch GeoJSON se bloque sans
    // lever d'erreur (réseau lent, pression mémoire). Au-delà du délai, on
    // bascule sur un état d'erreur explicite + bouton « Réessayer ».
    const withTimeout = (promise, ms) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
    ]);

    const loadAerodromeData = async () => {
      if (!waypoints || waypoints.length === 0) {
        setAerodromeData([]);
        setLoadError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);
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

        // Charger les données VAC (provider GeoJSON) pour ces aérodromes uniquement.
        const filteredData = (await withTimeout(
          Promise.all(aerodromeIcaos.map(ic => aeroDataProvider.getVACDetail(ic))),
          25000
        )).filter(Boolean);
        if (cancelled) return;
        console.log('🔍 [Step3VAC] Aérodromes chargés:', filteredData.length);
        // TODO: circuitAltitude must be extracted from official AIXM XML files
        // For now, it will be undefined

        console.log('✅ [Step3VAC] Filtered aerodromes:', filteredData.map(ad => ad.icao));
        setAerodromeData(filteredData);
        console.log('✅ Données aérodromes chargées pour Step3VAC:', filteredData.length);
      } catch (error) {
        if (cancelled) return;
        console.error('❌ Erreur/timeout chargement données VAC:', error);
        setAerodromeData([]);
        setLoadError(
          error?.message === 'TIMEOUT'
            ? 'Le chargement des données aérodrome a expiré (réseau lent ou données indisponibles). Vérifiez votre connexion puis réessayez.'
            : 'Erreur lors du chargement des données aérodrome.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAerodromeData();
    return () => { cancelled = true; };
  }, [waypoints, flightPlan?.alternates, reloadKey]);

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

  if (loadError) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <AlertCircle size={48} style={{ color: 'var(--accent-primary)', marginBottom: '16px' }} />
          <p style={styles.emptyText}>{loadError}</p>
          <button
            style={{ ...styles.viewButtonFull, width: 'auto', marginTop: '16px' }}
            onClick={() => setReloadKey(k => k + 1)}
          >
            Réessayer
          </button>
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
              fontSize: 'var(--fs-title)',
              color: 'var(--accent-primary)'
            }}>
              {missingVACs.length} carte(s) VAC manquante(s)
            </span>
          </div>
          <div style={{
            fontSize: 'var(--fs-body)',
            color: 'var(--accent-primary)',
            lineHeight: '1.6'
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>
              <strong>Aérodromes concernés :</strong> {missingVACs.join(', ')}
            </p>
            <p style={{ margin: '0 0 10px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <span style={{ fontSize: 'var(--fs-title)', marginTop: '2px' }}>ℹ️</span>
              <span>
                Ajoutez-les ici sans quitter votre préparation : la carte est
                enregistrée dans <strong>votre profil</strong> et vous la retrouverez
                sur tous vos appareils.
              </span>
            </p>
            {/* 🗺️ Import sur place, un bouton par aérodrome manquant (César 16/08) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {missingVACs.map((missingIcao) => (
                <VacQuickImport key={missingIcao} icao={missingIcao} />
              ))}
            </div>
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
                      fontSize: 'var(--fs-caption)',
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

                    {/* On exige un METAR OU un TAF réel : un objet météo « vide »
                        (metar/taf null, ex. station sans METAR ou échec AVWX) ne
                        doit PAS produire un bloc blanc — on affiche « non disponible ». */}
                    {(weatherData?.[aerodrome.icao]?.metar || weatherData?.[aerodrome.icao]?.taf) ? (
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

                    {/* 🔧 LOT 6-C — saisie météo MANUELLE (terrains sans METAR) :
                        les valeurs saisies alimentent les calculs de performances */}
                    <ManualWeatherBlock
                      icao={aerodrome.icao?.toUpperCase()}
                      hasApiWeather={!!(weatherData?.[aerodrome.icao]?.metar || weatherData?.[aerodrome.icao]?.taf)}
                      flightPlan={flightPlan}
                      onUpdate={onUpdate}
                    />
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
                      {/* Menu déroulant des rubriques (remplace les onglets-boutons) :
                          le contenu de la rubrique choisie s'affiche en dessous. */}
                      <select
                        value={currentSection || ''}
                        onChange={(e) =>
                          setExpandedSection(prev => ({
                            ...prev,
                            [aerodrome.icao]: e.target.value || null
                          }))
                        }
                        style={styles.sectionSelect}
                        aria-label="Rubrique d'information terrain"
                      >
                        <option value="">Sélectionner une rubrique…</option>
                        <option value="general">Général</option>
                        <option value="runways">Pistes</option>
                        <option value="frequencies">Fréquences</option>
                        <option value="vfr">VFR</option>
                        <option value="services">Services</option>
                      </select>
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
                        {/* Verdict de compatibilité piste ↔ avion sélectionné.
                            PRIORITÉ aux distances CALCULÉES par le moteur de
                            performances (conditions du jour, facteur inclus),
                            matchées par ICAO strict : décollage pour le terrain
                            de départ, atterrissage pour l'arrivée. Les autres
                            terrains (déroutements) restent en POH statique —
                            on n'applique jamais une distance calculée pour un
                            AUTRE aérodrome. */}
                        <RunwayAnalyzer
                          icao={aerodrome.icao}
                          perfDistances={(() => {
                            const perf = flightPlan?.performance;
                            if (!perf) return null;
                            const factorLabel = perf.safetyFactor?.value > 1
                              ? `×${perf.safetyFactor.value}` : null;
                            const takeoffM = perf.departure?.icao === aerodrome.icao
                              ? (perf.departure.takeoff?.toda50ftFactored ?? perf.departure.takeoff?.toda50ft ?? null)
                              : null;
                            const landingM = perf.arrival?.icao === aerodrome.icao
                              ? (perf.arrival.landing?.lda50ftFactored ?? perf.arrival.landing?.lda50ft ?? null)
                              : null;
                            if (takeoffM == null && landingM == null) return null;
                            return { takeoffM, landingM, factorLabel };
                          })()}
                        />
                        {aerodrome.runways && aerodrome.runways.length > 0 ? (
                          aerodrome.runways.flatMap(separateRunwayDirections).map((rwy, idx) => (
                            <div key={idx} style={styles.runwayCard}>
                              <div style={styles.runwayHeader}>
                                <span style={styles.runwayDesignation}>
                                  Piste {rwy.runwayNumber || rwy.designation || rwy.identifier}
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
                                {rwy.qfu != null && <span>• QFU: {String(Math.round(rwy.qfu)).padStart(3, '0')}°</span>}
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
                            return (
                              <div key={service} style={styles.frequencyItem}>
                                <span style={styles.frequencyService}>
                                  {service.toUpperCase()}
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
                            <span style={styles.contactLabel}>Téléphone:</span>
                            <span style={styles.contactValue}>{aerodrome.adminInfo.telephone}</span>
                          </div>
                        )}

                        <div style={styles.servicesGrid}>
                          {[
                            { key: 'fuel', label: 'Carburant' },
                            { key: 'avgas100LL', label: 'AVGAS 100LL' },
                            { key: 'maintenance', label: 'Maintenance' },
                            { key: 'restaurant', label: 'Restaurant' },
                            { key: 'hotel', label: 'Hôtel' },
                            { key: 'parking', label: 'Parking' }
                          ].map(service => (
                            aerodrome.services?.[service.key] && (
                              <div key={service.key} style={styles.serviceItem}>
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

// 🔧 LOT 6-C — Bloc de saisie météo MANUELLE par aérodrome (vent, température,
// QNH). Cas d'usage : terrain non contrôlé sans METAR. Les valeurs sont
// stockées dans le weatherStore (manualOverrides, prioritaires sur l'API pour
// les performances) ET dans flightPlan.weather.manual (survit au brouillon).
const ManualWeatherBlock = ({ icao, hasApiWeather, flightPlan, onUpdate }) => {
  const override = useWeatherStore(state => state.manualOverrides?.[icao]);
  const setManualWeather = useWeatherStore(state => state.setManualWeather);
  const clearManualWeather = useWeatherStore(state => state.clearManualWeather);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ direction: '', speed: '', temperature: '', qnh: '' });
  const [formError, setFormError] = useState(null);

  if (!icao) return null;

  const openForm = () => {
    setDraft({
      direction: override?.wind?.direction ?? '',
      speed: override?.wind?.speed ?? '',
      temperature: override?.temperature ?? '',
      qnh: override?.qnh ?? ''
    });
    setFormError(null);
    setEditing(true);
  };

  // Persistance côté brouillon (localStorage + Supabase via toJSON)
  const persistToDraft = (values) => {
    if (!flightPlan?.weather) return;
    if (!flightPlan.weather.manual) flightPlan.weather.manual = {};
    if (values) {
      flightPlan.weather.manual[icao] = values;
    } else {
      delete flightPlan.weather.manual[icao];
    }
    if (onUpdate) onUpdate();
  };

  const handleSave = () => {
    const dir = draft.direction === '' ? null : parseFloat(draft.direction);
    const spd = draft.speed === '' ? null : parseFloat(draft.speed);
    const temp = draft.temperature === '' ? null : parseFloat(draft.temperature);
    const qnh = draft.qnh === '' ? null : parseFloat(draft.qnh);

    if ((dir === null) !== (spd === null)) {
      setFormError('Le vent nécessite une direction ET une vitesse (mettez 0/0 pour vent calme).');
      return;
    }
    if (dir !== null && (!Number.isFinite(dir) || dir < 0 || dir > 360)) {
      setFormError('Direction du vent invalide (0 à 360°).');
      return;
    }
    if (spd !== null && (!Number.isFinite(spd) || spd < 0 || spd > 150)) {
      setFormError('Vitesse du vent invalide (0 à 150 kt).');
      return;
    }
    if (temp !== null && (!Number.isFinite(temp) || temp < -60 || temp > 55)) {
      setFormError('Température invalide (−60 à +55 °C).');
      return;
    }
    // QNH — bornes ÉLARGIES (demande César 16/08) : l'ancien plancher de
    // 900 hPa refusait des QNH réels (dépressions profondes, typhons). On
    // couvre désormais toute la plage physiquement observée sur Terre :
    // record bas 870 hPa (typhon Tip, 1979), record haut 1084 hPa (Sibérie,
    // 1968). La borne subsistante n'est plus une limite opérationnelle mais
    // un garde-fou anti-faute de frappe : un « 101 » ou « 10130 » saisi à la
    // place de 1013 fausserait l'altimétrie et donc les altitudes de sécurité.
    if (qnh !== null && (!Number.isFinite(qnh) || qnh < 850 || qnh > 1090)) {
      setFormError('QNH invalide — saisie hors du domaine physique observable (850 à 1090 hPa). Vérifiez la valeur.');
      return;
    }
    if (dir === null && temp === null && qnh === null) {
      setFormError('Renseignez au moins une valeur (vent, température ou QNH).');
      return;
    }

    const values = {
      wind: dir !== null ? { direction: ((dir % 360) + 360) % 360, speed: spd } : null,
      temperature: temp,
      qnh,
      updatedAt: Date.now()
    };
    setManualWeather(icao, values);
    persistToDraft(values);
    setEditing(false);
    setFormError(null);
  };

  const handleClear = () => {
    clearManualWeather(icao);
    persistToDraft(null);
    setEditing(false);
    setFormError(null);
  };

  if (!override && !editing) {
    // Pas de saisie active : proposer la saisie uniquement quand la météo API manque
    if (hasApiWeather) return null;
    return (
      <button onClick={openForm} style={styles.manualEntryButton}>
        <Pencil size={16} />
        Saisir la météo manuellement (vent, température, QNH)
      </button>
    );
  }

  if (override && !editing) {
    const parts = [];
    if (override.wind) {
      parts.push(`Vent ${String(Math.round(override.wind.direction)).padStart(3, '0')}°/${Math.round(override.wind.speed)} kt`);
    }
    if (override.temperature != null) parts.push(`Temp ${override.temperature} °C`);
    if (override.qnh != null) parts.push(`QNH ${override.qnh} hPa`);
    return (
      <div style={styles.manualBadge}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.manualBadgeTitle}>
            <Pencil size={14} />
            Saisie manuelle active
          </div>
          <div style={styles.manualBadgeValues}>{parts.join(' · ')}</div>
          {hasApiWeather && (
            <div style={styles.manualBadgeWarning}>
              ⚠ Vent et température prioritaires sur le METAR pour les calculs de performances
            </div>
          )}
        </div>
        <div style={styles.manualBadgeActions}>
          <button onClick={openForm} style={styles.manualSmallButton}>Modifier</button>
          <button onClick={handleClear} style={styles.manualSmallButton}>Effacer</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.manualForm}>
      <p style={styles.manualFormTitle}>Météo observée / estimée pour {icao}</p>
      <div style={styles.manualFormGrid}>
        <label style={styles.manualLabel}>
          Vent — direction (°)
          <input
            type="number"
            min="0"
            max="360"
            step="10"
            placeholder="ex. 270"
            value={draft.direction}
            onChange={(e) => setDraft(d => ({ ...d, direction: e.target.value }))}
            style={styles.manualInput}
          />
        </label>
        <label style={styles.manualLabel}>
          Vent — vitesse (kt)
          <input
            type="number"
            min="0"
            max="150"
            step="1"
            placeholder="ex. 10"
            value={draft.speed}
            onChange={(e) => setDraft(d => ({ ...d, speed: e.target.value }))}
            style={styles.manualInput}
          />
        </label>
        <label style={styles.manualLabel}>
          Température (°C)
          <input
            type="number"
            min="-60"
            max="55"
            step="1"
            placeholder="ex. 15"
            value={draft.temperature}
            onChange={(e) => setDraft(d => ({ ...d, temperature: e.target.value }))}
            style={styles.manualInput}
          />
        </label>
        <label style={styles.manualLabel}>
          QNH (hPa)
          <input
            type="number"
            min="900"
            max="1100"
            step="1"
            placeholder="ex. 1013"
            value={draft.qnh}
            onChange={(e) => setDraft(d => ({ ...d, qnh: e.target.value }))}
            style={styles.manualInput}
          />
        </label>
      </div>
      {formError && <p style={styles.manualFormError}>{formError}</p>}
      <div style={styles.manualFormActions}>
        <button onClick={handleSave} style={styles.manualSaveButton}>Enregistrer</button>
        <button
          onClick={() => { setEditing(false); setFormError(null); }}
          style={styles.manualCancelButton}
        >
          Annuler
        </button>
      </div>
      <p style={styles.manualFormHint}>
        À utiliser pour un terrain sans METAR (valeurs observées sur place ou estimées
        prudemment). Le vent et la température alimentent les calculs de performances de
        cet aérodrome ; le QNH est conservé comme rappel de calage altimétrique (il
        n'entre pas encore dans les calculs).
      </p>
    </div>
  );
};

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
    fontSize: 'var(--fs-title)',
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
    fontSize: 'var(--fs-body)',
    color: 'var(--text-primary)',
    lineHeight: '1.6'
  },
  weatherBlock: {
    /* Section encadrante retirée : le METAR/TAF n'est plus enfermé dans une
       boîte (double encadrement). Seul le bloc de texte garde son cadre — la
       zone respire davantage. */
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  weatherTitle: {
    margin: '0 0 12px 0',
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-title)',
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
    fontSize: 'var(--fs-body)',
    color: 'var(--text-tertiary)',
    fontStyle: 'italic'
  },
  // 🔧 LOT 6-C — saisie météo manuelle
  manualEntryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    width: '100%',
    marginTop: '12px',
    backgroundColor: 'var(--bg-surface)',
    color: theme.colors.primary,
    border: `1px dashed ${theme.colors.border}`,
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--fs-body)',
    fontWeight: '500',
    cursor: 'pointer',
    boxSizing: 'border-box'
  },
  manualBadge: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginTop: '12px',
    padding: '12px',
    backgroundColor: 'rgba(242, 105, 33, 0.08)',
    border: '1px solid var(--accent-primary)',
    borderRadius: 'var(--radius-sm)'
  },
  manualBadgeTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: 'var(--fs-body)',
    fontWeight: '600',
    color: 'var(--accent-primary)'
  },
  manualBadgeValues: {
    fontSize: 'var(--fs-body)',
    fontFamily: 'monospace',
    color: 'var(--text-primary)',
    marginTop: '4px',
    wordBreak: 'break-word'
  },
  manualBadgeWarning: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--accent-primary)',
    marginTop: '4px'
  },
  manualBadgeActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flexShrink: 0
  },
  manualSmallButton: {
    padding: '6px 12px',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--fs-caption)',
    cursor: 'pointer'
  },
  manualForm: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)'
  },
  manualFormTitle: {
    margin: '0 0 10px 0',
    fontSize: 'var(--fs-body)',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  manualFormGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '10px'
  },
  manualLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-secondary)'
  },
  manualInput: {
    padding: '8px 10px',
    fontSize: 'var(--fs-body)',
    fontFamily: 'monospace',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    boxSizing: 'border-box',
    width: '100%'
  },
  manualFormError: {
    margin: '10px 0 0 0',
    fontSize: 'var(--fs-caption)',
    color: 'var(--color-red-critical)',
    fontWeight: '600'
  },
  manualFormActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px'
  },
  manualSaveButton: {
    padding: '8px 16px',
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--fs-body)',
    fontWeight: '600',
    cursor: 'pointer'
  },
  manualCancelButton: {
    padding: '8px 16px',
    backgroundColor: 'var(--bg-overlay)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--fs-body)',
    cursor: 'pointer'
  },
  manualFormHint: {
    margin: '10px 0 0 0',
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-tertiary)',
    lineHeight: '1.4'
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
    fontSize: 'var(--fs-title)',
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  description: {
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-title)',
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  aerodromeNameLine: {
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
    color: 'var(--text-secondary)'
  },
  aerodromeElevation: {
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-caption)',
    fontWeight: '600'
  },
  statusMissing: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: 'var(--bg-overlay)',
    color: 'var(--color-red-critical)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--fs-caption)',
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
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
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
  sectionSelect: {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 'var(--fs-body)',
    fontWeight: '500',
    cursor: 'pointer',
    boxSizing: 'border-box'
  },
  sectionContent: {
    padding: '16px'
  },
  section: {
    fontSize: 'var(--fs-body)'
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
    fontSize: 'var(--fs-body)',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  infoValue: {
    fontSize: 'var(--fs-body)',
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  infoValueSecondary: {
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  runwayDimensions: {
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
    color: 'var(--text-secondary)'
  },
  runwayInfo: {
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  frequencyValue: {
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  vfrPointType: {
    fontSize: 'var(--fs-body)',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--border-subtle)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)'
  },
  vfrPointDescription: {
    fontSize: 'var(--fs-body)',
    color: 'var(--text-secondary)',
    margin: '4px 0'
  },
  vfrPointCoords: {
    fontSize: 'var(--fs-body)',
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
    border: '2px solid var(--color-red-critical)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '16px'
  },
  contactLabel: {
    fontSize: 'var(--fs-body)',
    fontWeight: '600',
    color: 'var(--color-red-critical)'
  },
  contactValue: {
    fontSize: 'var(--fs-body)',
    fontWeight: '700',
    color: 'var(--color-red-critical)',
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
    fontSize: 'var(--fs-body)',
    fontWeight: '500',
    color: 'var(--text-primary)'
  },
  noData: {
    textAlign: 'center',
    padding: '20px',
    color: 'var(--text-tertiary)',
    fontSize: 'var(--fs-body)',
    fontStyle: 'italic'
  }
};

Step3VAC.displayName = 'Step3VAC';

export default Step3VAC;
