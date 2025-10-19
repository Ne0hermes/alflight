// src/features/navigation/NavigationModule.jsx
import React, { memo, useState, useCallback, useEffect, Fragment } from 'react';
import { MapPin, Plus, Trash2, Navigation2, Home, Sun, Moon, List, Loader, AlertCircle, AlertTriangle, Wind, Plane } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useUnits } from '@hooks/useUnits';
import { ValueWithUnit, ValueGrid } from '@shared/components/ValueWithUnit';

// Import des contextes et hooks
import { useNavigation, useAircraft } from '@core/contexts';
// import { useOpenAIPStore, openAIPSelectors } from '@core/stores/openAIPStore';
import { useWeatherStore, weatherSelectors } from '@core/stores/weatherStore';

// Import du vrai hook useNavigationResults
import { useNavigationResults } from './hooks/useNavigationResults';

// Import des composants locaux
import { SimpleAirportSelector } from './components/SimpleAirportSelector';
const AirportSelector = SimpleAirportSelector;
import { WaypointCardWithRunways } from './components/WaypointCardWithRunways';
import { ReportingPointsSelector } from './components/ReportingPointsSelector';
// import { default as AirspaceAnalyzer } from './components/AirspaceAnalyzer';
// import { default as TechnicalLog } from './components/TechnicalLog';
import { default as RunwayAnalyzer } from './components/RunwayAnalyzer';
import WindAnalysis from './components/WindAnalysis';
import VFRNavigationTable from './components/VFRNavigationTable';
import GlobalVFRPointsManager from './components/GlobalVFRPointsManager';
import AlternatesModule from '../alternates/AlternatesModule';

// Hook temporaire pour remplacer useAlternatesForNavigation
const useAlternatesForNavigation = () => {
  return {
    alternates: [],
    hasAlternates: false,
    addAlternateAsWaypoint: () => {}
  };
};


const NavigationModule = ({ wizardMode = false, config = {} }) => {
  const { selectedAircraft } = useAircraft();
  const { format, convert, getSymbol, getUnit, toStorage } = useUnits();

  // Debug: Afficher l'unité actuelle
  const {
    waypoints,
    setWaypoints,
    flightParams,
    setFlightParams,
    flightType,
    setFlightType,
    addWaypoint: addWaypointToStore,
    removeWaypoint: removeWaypointFromStore,
    updateWaypoint: updateWaypointInStore,
    updateWaypoint,
    segmentAltitudes,
    setSegmentAltitude,
    getSegmentAltitude
  } = useNavigation();
  // Passer les paramètres au hook
  const navigationResults = useNavigationResults(waypoints, flightType, selectedAircraft);
  const { alternates, hasAlternates, addAlternateAsWaypoint } = useAlternatesForNavigation();

  // OpenAIP Store - Supprimé
  // const { loadAirports } = useOpenAIPStore();
  const loading = false;
  const errors = [];

  const [showReportingPoints, setShowReportingPoints] = useState(false);
  const [selectedWaypointId, setSelectedWaypointId] = useState(null);
  const [plannedAltitude, setPlannedAltitude] = useState(3000); // Altitude par défaut en pieds
  const [selectedVFRPoints, setSelectedVFRPoints] = useState({}); // Points VFR par waypoint
  const [dangerousZones, setDangerousZones] = useState({});
  const [activeTab, setActiveTab] = useState('navigation'); // Nouvel état pour les onglets

  // Charger les aérodromes au montage - Supprimé
  // useEffect(() => {
  //   loadAirports('FR');
  // }, [loadAirports]);
  
  // Détection automatique des zones dangereuses en arrière-plan
  useEffect(() => {
    const detectZones = async () => {
      if (waypoints.length >= 2) {
        // Importer dynamiquement le module de détection
        const { detectDangerousZones } = await import('./utils/zoneDetection');
        const zones = await detectDangerousZones(waypoints, segmentAltitudes);
        setDangerousZones(zones);
        
        // Stocker dans le localStorage pour que le module Technical Log puisse y accéder
        localStorage.setItem('flightDangerousZones', JSON.stringify(zones));
      }
    };
    
    detectZones();
  }, [waypoints, segmentAltitudes]);

  // Handlers pour les waypoints
  const handleWaypointUpdate = useCallback((waypointId, updates) => {
    updateWaypointInStore(waypointId, updates);
  }, [updateWaypointInStore]);

  const handleAirportSelect = useCallback((waypointId, airport) => {
    if (airport) {
      handleWaypointUpdate(waypointId, {
        name: airport.icao,
        lat: airport.coordinates.lat,
        lon: airport.coordinates.lon || airport.coordinates.lng,
        elevation: airport.elevation,
        airportName: airport.name,
        city: airport.city
      });
    }
  }, [handleWaypointUpdate]);

  const addWaypoint = useCallback(() => {
    addWaypointToStore();
  }, [addWaypointToStore]);

  const removeWaypoint = useCallback((id) => {
    removeWaypointFromStore(id);
  }, [removeWaypointFromStore]);

  // Fonction pour insérer un waypoint à une position spécifique
  const insertWaypoint = useCallback((waypoint, index) => {
    const newWaypoints = [...waypoints];
    newWaypoints.splice(index, 0, waypoint);
    setWaypoints(newWaypoints);
  }, [waypoints, setWaypoints]);

  // Calcul de la réserve carburant affichée
  const getReserveInfo = () => {
    if (!navigationResults) return { minutes: 0, description: 'Aucun vol défini' };
    
    let description = [];
    if (flightType.period === 'nuit') description.push('vol de nuit');
    if (flightType.rules === 'IFR') description.push('+15 min IFR');
    if (flightType.category === 'local') description.push('vol local');
    
    return {
      minutes: navigationResults.regulationReserveMinutes,
      description: description.length > 0 ? ` (${description.join(', ')})` : ''
    };
  };

  // Suggestions d'altitude - Supprimé car AirspaceAnalyzer n'est plus utilisé
  // const getAltitudeSuggestions = () => {
  //   const isVFR = flightType.rules === 'VFR';
  //   const suggestions = [];
  //   
  //   if (isVFR) {
  //     // Règles VFR : altitudes impaires + 500 vers l'Est (0-179°), paires + 500 vers l'Ouest (180-359°)
  //     suggestions.push(
  //       { altitude: 2500, description: "VFR bas niveau" },
  //       { altitude: 3500, description: "VFR Est (0-179°)" },
  //       { altitude: 4500, description: "VFR Ouest (180-359°)" },
  //       { altitude: 5500, description: "VFR Est (0-179°)" },
  //       { altitude: 6500, description: "VFR Ouest (180-359°)" }
  //     );
  //   } else {
  //     // Règles IFR : altitudes en milliers pairs/impairs selon direction
  //     suggestions.push(
  //       { altitude: 3000, description: "IFR Ouest (180-359°)" },
  //       { altitude: 4000, description: "IFR Est (0-179°)" },
  //       { altitude: 5000, description: "IFR Ouest (180-359°)" },
  //       { altitude: 6000, description: "IFR Est (0-179°)" },
  //       { altitude: 7000, description: "IFR Ouest (180-359°)" }
  //     );
  //   }
  //   
  //   return suggestions;
  // };

  // Handler pour l'altitude
  const handleAltitudeChange = (value) => {
    // Accepter uniquement les nombres
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 45000) {
      setPlannedAltitude(numValue);
    } else if (value === '') {
      setPlannedAltitude(0);
    }
  };

  const reserveInfo = getReserveInfo();
  // const altitudeSuggestions = getAltitudeSuggestions(); // Supprimé car AirspaceAnalyzer n'est plus utilisé

  // Obtenir l'aérodrome d'arrivée
  const arrivalAirport = waypoints.length > 0 ? waypoints[waypoints.length - 1] : null;
  const arrivalIcao = arrivalAirport?.name && arrivalAirport.name.match(/^[A-Z]{4}$/) ? arrivalAirport.name : null;

  return (
    <div>
      {/* Onglets - masqués en mode wizard */}
      {!wizardMode && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '0'
        }}>
          <button
            onClick={() => setActiveTab('navigation')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: activeTab === 'navigation' ? '#93163C' : 'transparent',
              color: activeTab === 'navigation' ? 'white' : '#6b7280',
              border: 'none',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              borderBottom: activeTab === 'navigation' ? '2px solid #93163C' : '2px solid transparent'
            }}
          >
            <Navigation2 size={18} />
            Navigation VFR
          </button>
          <button
            onClick={() => setActiveTab('alternates')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: activeTab === 'alternates' ? '#93163C' : 'transparent',
              color: activeTab === 'alternates' ? 'white' : '#6b7280',
              border: 'none',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              borderBottom: activeTab === 'alternates' ? '2px solid #93163C' : '2px solid transparent'
            }}
          >
            <Plane size={18} />
            Déroutements
          </button>
        </div>
      )}

      {/* Contenu des onglets - En mode wizard, afficher toujours la navigation */}
      {!wizardMode && activeTab === 'alternates' ? (
        <AlternatesModule wizardMode={wizardMode} config={config} />
      ) : (
        <>
          {/* Alerte si pas d'avion sélectionné */}
          {!selectedAircraft && (
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
              <p style={sx.text.sm}>
            Sélectionnez un avion dans l'onglet "Gestion Avions" pour activer les calculs
          </p>
        </div>
      )}

      {loading.airports && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
          <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={sx.text.sm}>
            Chargement des données aéronautiques...
          </p>
        </div>
      )}

      {/* Erreur de chargement */}
      {errors.airports && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mb(4))}>
          <AlertCircle size={20} />
          <p style={sx.text.sm}>
            Erreur de chargement des données : {errors.airports}
          </p>
        </div>
      )}

      {/* Section Type de vol - masquée en mode wizard car définie en étape 1 */}
      {!wizardMode && (
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
            ✈️ Type de vol
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div>
              <label style={sx.components.label.base}>
                {flightType.period === 'jour' ? <Sun size={14} /> : <Moon size={14} />} Période
              </label>
              <select
                value={flightType.period}
                onChange={(e) => setFlightType({ ...flightType, period: e.target.value })}
                style={sx.components.input.base}
              >
                <option value="jour">Jour</option>
                <option value="nuit">Nuit</option>
              </select>
            </div>

            <div>
              <label style={sx.components.label.base}>
                <Navigation2 size={14} /> Règles
              </label>
              <select
                value={flightType.rules}
                onChange={(e) => setFlightType({ ...flightType, rules: e.target.value })}
                style={sx.components.input.base}
              >
                <option value="VFR">VFR</option>
                <option value="IFR">IFR</option>
              </select>
            </div>

            <div>
              <label style={sx.components.label.base}>
                <Home size={14} /> Catégorie
              </label>
              <select
                value={flightType.category}
                onChange={(e) => setFlightType({ ...flightType, category: e.target.value })}
                style={sx.components.input.base}
              >
                <option value="local">Local</option>
                <option value="navigation">Navigation</option>
              </select>
            </div>
          </div>

          {/* Info réserve réglementaire */}
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(3))}>
            <p style={sx.text.sm}>
              Réserve réglementaire : <strong>{reserveInfo.minutes} minutes</strong>
              {reserveInfo.description}
            </p>
          </div>
        </section>
      )}

      {/* Résultats de navigation - masqués en mode wizard */}
      {!wizardMode && selectedAircraft && navigationResults && (
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
            📊 Résultats de navigation
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div style={sx.components.card.base}>
              <ValueWithUnit
                label="Distance totale"
                value={navigationResults.totalDistance}
                category="distance"
                fromUnit="nm"
                decimals={1}
                alternativeDecimals={0}
                size="2xl"
                emphasis={true}
              />
            </div>

            <div style={sx.components.card.base}>
              <h4 style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(2))}>Temps de vol</h4>
              <p style={sx.combine(sx.text['2xl'], sx.text.bold, sx.text.primary)}>
                {Math.floor(navigationResults.totalTime / 60)}h{String(navigationResults.totalTime % 60).padStart(2, '0')}
              </p>
              <ValueWithUnit
                value={selectedAircraft.cruiseSpeedKt}
                category="speed"
                fromUnit="kt"
                decimals={0}
                size="xs"
                showAlternative={true}
                style={{ marginTop: '4px' }}
              />
            </div>

            <div style={sx.components.card.base}>
              <ValueWithUnit
                label="Carburant nécessaire"
                value={navigationResults.fuelRequired}
                category="fuel"
                fromUnit="ltr"
                decimals={0}
                alternativeDecimals={1}
                size="2xl"
                emphasis={true}
              />
            </div>

            <div style={sx.components.card.base}>
              <ValueWithUnit
                label="Réserve finale"
                value={navigationResults.regulationReserveLiters}
                category="fuel"
                fromUnit="ltr"
                decimals={0}
                alternativeDecimals={1}
                size="2xl"
                emphasis={true}
              />
              <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                {navigationResults.regulationReserveMinutes} min
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Analyse du vent et impact sur le vol - masquée en mode wizard */}
      {!wizardMode && selectedAircraft && waypoints.length >= 2 && (
        <>
          <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
            <WindAnalysis
              waypoints={waypoints}
              selectedAircraft={selectedAircraft}
              plannedAltitude={plannedAltitude}
            />
          </section>

        </>
      )}

      {/* Analyse des pistes d'arrivée - Maintenant intégrée dans les waypoints */}
      {/* {arrivalIcao && (
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
          <RunwayAnalyzer icao={arrivalIcao} />
        </section>
      )} */}

      {/* Section Points de navigation et Gestion du trajet */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
          {/* En-tête avec titre */}
          <div style={sx.spacing.mb(4)}>
            <h3 style={sx.combine(sx.text.xl, sx.text.bold)}>
              📍 Points de navigation
            </h3>
          </div>
          
          {/* Liste des waypoints - grouper les points VFR avec leur aérodrome */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {/* Bouton pour ajouter le premier aérodrome si la liste est vide */}
            {waypoints.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ color: '#6b7280', marginBottom: '16px' }}>
                  Aucun point de navigation défini
                </p>
                <button
                  onClick={() => {
                    const newWaypoint = {
                      id: `waypoint-${Date.now()}`,
                      name: '',
                      lat: null,
                      lon: null,
                      type: 'waypoint'
                    };
                    addWaypointToStore(newWaypoint);
                  }}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: '2px solid #3b82f6',
                    background: '#3b82f6',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#2563eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#3b82f6';
                  }}
                >
                  <Plus size={20} />
                  Ajouter un aérodrome
                </button>
              </div>
            )}

            {waypoints.map((waypoint, index) => {
              // Extraire le code ICAO de l'aérodrome
              const currentIcao = waypoint.name ? waypoint.name.split(' ')[0] : null;

              // Vérifier si ce waypoint est un point VFR lié à un aérodrome adjacent
              const prevWaypoint = index > 0 ? waypoints[index - 1] : null;
              const nextWaypoint = index < waypoints.length - 1 ? waypoints[index + 1] : null;
              const prevIcao = prevWaypoint?.name ? prevWaypoint.name.split(' ')[0] : null;
              const nextIcao = nextWaypoint?.name ? nextWaypoint.name.split(' ')[0] : null;

              // Si c'est un point VFR, vérifier s'il est lié à l'aérodrome précédent OU suivant
              if (waypoint.type === 'vfr-point') {
                // Cas 1: Lié à l'aérodrome précédent (ordre normal: LFST → STS)
                const isLinkedToPrevious = prevWaypoint && prevWaypoint.type !== 'vfr-point' &&
                                          (waypoint.aerodrome === prevWaypoint.name ||
                                           waypoint.aerodrome === prevIcao ||
                                           // Auto-détection par préfixe du nom (ex: STS lié à LFST)
                                           (prevIcao && waypoint.name?.startsWith(prevIcao.substring(2))));

                // Cas 2: Lié à l'aérodrome suivant (ordre inversé: STS → LFST)
                const isLinkedToNext = nextWaypoint && nextWaypoint.type !== 'vfr-point' &&
                                      (waypoint.aerodrome === nextWaypoint.name ||
                                       waypoint.aerodrome === nextIcao ||
                                       // Auto-détection par préfixe du nom
                                       (nextIcao && waypoint.name?.startsWith(nextIcao.substring(2))));

                if (isLinkedToPrevious || isLinkedToNext) {
                  // Ce point VFR sera affiché avec son aérodrome parent, on le skip ici
                  return null;
                }
              }

              // Trouver tous les points VFR liés à cet aérodrome (avant ET après)
              const linkedVfrPoints = [];
              if (waypoint.type !== 'vfr-point') {
                // 1. Points VFR qui PRÉCÈDENT cet aérodrome
                for (let i = index - 1; i >= 0; i--) {
                  const prevWp = waypoints[i];
                  if (prevWp.type === 'vfr-point') {
                    // Vérifier toutes les conditions de liaison
                    const matchFullName = prevWp.aerodrome === waypoint.name;
                    const matchIcao = prevWp.aerodrome === currentIcao;
                    const matchPrefix = currentIcao && currentIcao.length >= 4 && prevWp.name?.startsWith(currentIcao.substring(2));
                    const isLinked = matchFullName || matchIcao || matchPrefix;

                    if (isLinked) {
                      linkedVfrPoints.unshift(prevWp); // Ajouter au début
                    } else {
                      break;
                    }
                  } else {
                    break; // Arrêter si on trouve un aérodrome
                  }
                }

                // 2. Points VFR qui SUIVENT cet aérodrome
                for (let i = index + 1; i < waypoints.length; i++) {
                  const nextWp = waypoints[i];
                  if (nextWp.type === 'vfr-point') {
                    // Vérifier toutes les conditions de liaison
                    const matchFullName = nextWp.aerodrome === waypoint.name;
                    const matchIcao = nextWp.aerodrome === currentIcao;
                    const matchPrefix = currentIcao && currentIcao.length >= 4 && nextWp.name?.startsWith(currentIcao.substring(2));
                    const isLinked = matchFullName || matchIcao || matchPrefix;

                    if (isLinked) {
                      linkedVfrPoints.push(nextWp); // Ajouter à la fin
                    } else {
                      break;
                    }
                  } else {
                    break; // Arrêter si on trouve un aérodrome
                  }
                }
              }

              // Calculer le vrai index suivant (en sautant TOUS les points VFR groupés)
              // Il faut compter les VFR avant ET après cet aérodrome
              let vfrAfter = 0;
              for (let i = index + 1; i < waypoints.length; i++) {
                const wp = waypoints[i];
                if (wp.type === 'vfr-point') {
                  const isLinked = wp.aerodrome === waypoint.name ||
                                  wp.aerodrome === currentIcao ||
                                  (currentIcao && wp.name?.startsWith(currentIcao.substring(2)));
                  if (isLinked) {
                    vfrAfter++;
                  } else {
                    break;
                  }
                } else {
                  break;
                }
              }

              const nextRealIndex = index + 1 + vfrAfter;
              const isLast = nextRealIndex >= waypoints.length;
              const nextWaypointForButton = !isLast ? waypoints[nextRealIndex] : null;

              const segmentId = nextWaypointForButton ? `${waypoint.id}-${nextWaypointForButton.id}` : null;
              const segmentAltitude = segmentId ? segmentAltitudes[segmentId] : null;

              // Pour le TOD, on prend l'altitude du segment qui arrive à ce waypoint
              const incomingSegmentId = prevWaypoint ? `${prevWaypoint.id}-${waypoint.id}` : null;
              const incomingSegmentAltitude = incomingSegmentId ? segmentAltitudes[incomingSegmentId] : null;

              return (
                <React.Fragment key={waypoint.id}>
                  {/* Carte du waypoint avec ses points VFR intégrés */}
                  <WaypointCardWithRunways
                    waypoint={waypoint}
                    linkedVfrPoints={linkedVfrPoints}
                    index={index}
                    totalWaypoints={waypoints.length}
                    allWaypoints={waypoints}
                    segmentAltitude={incomingSegmentAltitude}
                    onSelect={(airport) => handleAirportSelect(waypoint.id, airport)}
                    onRemove={() => {
                      // Supprimer l'aérodrome et tous ses points VFR liés
                      removeWaypoint(waypoint.id);
                      linkedVfrPoints.forEach(vfr => removeWaypoint(vfr.id));
                    }}
                    onRemoveVfrPoint={(vfrId) => {
                      // Supprimer un point VFR individuel
                      try {
                        removeWaypoint(vfrId);

                        // Vérifier après un court délai que le waypoint a bien été supprimé
                        setTimeout(() => {
                          // Verification complete
                        }, 100);
                      } catch (error) {
                        console.error('❌ NavigationModule: Erreur lors de la suppression:', error);
                      }
                    }}
                    onInsertWaypoint={insertWaypoint}
                    onShowReportingPoints={() => {
                      setSelectedWaypointId(waypoint.id);
                      setShowReportingPoints(true);
                    }}
                  />

                  {/* Bouton pour ajouter un waypoint - toujours après l'ensemble aérodrome + VFR */}
                  {!isLast && nextWaypointForButton && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      margin: '16px 0'
                    }}>
                      <button
                        onClick={() => {
                          // Créer un nouveau waypoint vide
                          const newWaypoint = {
                            id: `waypoint-${Date.now()}`,
                            name: '',
                            lat: null,
                            lon: null,
                            type: 'waypoint'
                          };
                          // Insérer après l'aérodrome et tous ses points VFR
                          insertWaypoint(newWaypoint, nextRealIndex);
                        }}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          border: '2px dashed #94a3b8',
                          background: 'white',
                          color: '#64748b',
                          fontSize: '20px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.color = '#3b82f6';
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#94a3b8';
                          e.currentTarget.style.color = '#64748b';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                        title="Ajouter un aérodrome ici"
                      >
                        +
                      </button>
                    </div>
                  )}
                </React.Fragment>
              );
            }).filter(Boolean)}

            {/* Bouton pour ajouter un aérodrome après le dernier */}
            {waypoints.length > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                margin: '16px 0'
              }}>
                <button
                  onClick={() => {
                    const newWaypoint = {
                      id: `waypoint-${Date.now()}`,
                      name: '',
                      lat: null,
                      lon: null,
                      type: 'waypoint'
                    };
                    addWaypointToStore(newWaypoint);
                  }}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: '2px dashed #94a3b8',
                    background: 'white',
                    color: '#64748b',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.color = '#3b82f6';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#94a3b8';
                    e.currentTarget.style.color = '#64748b';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title="Ajouter un aérodrome"
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* Info sur le trajet */}
          {waypoints.length >= 2 && navigationResults && (
            <div style={sx.combine(
              sx.components.alert.base,
              sx.components.alert.info,
              sx.spacing.mt(4)
            )}>
              <p style={sx.text.sm}>
                <strong>Trajet :</strong> {waypoints.filter(w => w.name).map(w => w.name).join(' → ')}
                {waypoints[0]?.name === waypoints[waypoints.length - 1]?.name && ' (Circuit fermé)'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Tableau de navigation VFR */}
      {selectedAircraft && waypoints.length >= 2 && (
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
          <VFRNavigationTable
            waypoints={waypoints}
            selectedAircraft={selectedAircraft}
            plannedAltitude={plannedAltitude}
            flightType={flightType}
            navigationResults={navigationResults}
          />
        </section>
      )}

          {/* Points VFR Globaux - Masqués en mode wizard */}
          {!wizardMode && (
            <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
              <GlobalVFRPointsManager />
            </section>
          )}
        </>
      )}

    </div>
  );
};

// Export avec displayName
NavigationModule.displayName = 'NavigationModule';

export default NavigationModule;