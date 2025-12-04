// src/features/navigation/NavigationModule.jsx
import React, { memo, useState, useCallback, useEffect, Fragment } from 'react';
import { MapPin, Plus, Trash2, Navigation2, Home, Sun, Moon, List, Loader, AlertCircle, AlertTriangle, Wind, Plane, Shield } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useUnits } from '@hooks/useUnits';
import { ValueWithUnit, ValueGrid } from '@shared/components/ValueWithUnit';

// Import des contextes et hooks
import { useNavigation, useAircraft } from '@core/contexts';
import { useNavigationStore } from '@core/stores/navigationStore';
import { useWeatherStore, weatherSelectors } from '@core/stores/weatherStore';

// Import du vrai hook useNavigationResults
import { useNavigationResults } from './hooks/useNavigationResults';

// Import des composants locaux
import { SimpleAirportSelector } from './components/SimpleAirportSelector';
const AirportSelector = SimpleAirportSelector;
import { WaypointCardWithRunways } from './components/WaypointCardWithRunways';
import { ReportingPointsSelector } from './components/ReportingPointsSelector';
import { default as RunwayAnalyzer } from './components/RunwayAnalyzer';
import WindAnalysis from './components/WindAnalysis';
import AlternatesModule from '../alternates/AlternatesModule';
import WaypointSelectorModal from './components/WaypointSelectorModal';
// Supprimé: import AirspacesSummaryTable from './components/AirspacesSummaryTable';

// Hook temporaire pour remplacer useAlternatesForNavigation
const useAlternatesForNavigation = () => {
  return {
    alternates: [],
    hasAlternates: false,
    addAlternateAsWaypoint: () => { }
  };
};


const NavigationModule = ({ wizardMode = false, config = {} }) => {
  const { selectedAircraft } = useAircraft(); // Keep useAircraft for selectedAircraft
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
    getSegmentAltitude,
    moveWaypointUp,
    moveWaypointDown
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
  // Synchroniser l'altitude locale avec le store global quand elle change
  const [plannedAltitude, setPlannedAltitude] = useState(flightParams.altitude || 3000); // Altitude par défaut en pieds
  useEffect(() => {
    if (plannedAltitude !== flightParams.altitude) {
      setFlightParams(prev => ({ ...prev, altitude: plannedAltitude }));
    }
  }, [plannedAltitude, flightParams.altitude, setFlightParams]);
  const [selectedVFRPoints, setSelectedVFRPoints] = useState({}); // Points VFR par waypoint
  const [dangerousZones, setDangerousZones] = useState({});
  const [activeTab, setActiveTab] = useState('navigation'); // Nouvel état pour les onglets
  const [showWaypointModal, setShowWaypointModal] = useState(false);
  const [waypointInsertIndex, setWaypointInsertIndex] = useState(null);

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

  const removeWaypoint = useCallback((id, index) => {
    if (id) {
      console.log('🗑️ Suppression du waypoint par ID:', id);
      removeWaypointFromStore(id);
    } else if (index !== undefined && index !== null) {
      console.log('🗑️ Suppression du waypoint par index (fallback):', index);
      // Fallback: suppression manuelle via setWaypoints
      const newWaypoints = [...waypoints];
      // On ne supprime que si on a plus de 2 points (Départ/Arrivée minimum)
      if (newWaypoints.length > 2) {
        newWaypoints.splice(index, 1);
        setWaypoints(newWaypoints);
      } else {
        console.warn('⚠️ Impossible de supprimer: minimum 2 points requis');
      }
    } else {
      console.error('❌ Tentative de suppression sans ID ni index valide');
    }
  }, [removeWaypointFromStore, waypoints, setWaypoints]);

  // Handlers pour déplacer les waypoints (avec fallback index)
  const handleMoveUp = useCallback((id, index) => {
    // Ne pas déplacer si c'est le premier ou si le précédent est le départ (index <= 1)
    if (index <= 1) return;

    if (id && moveWaypointUp) {
      // Essayer via le store d'abord
      moveWaypointUp(id);
      return;
    }

    // Fallback manuel si pas d'ID ou si la fonction du store n'existe pas
    console.log('⬆️ Déplacement vers le haut par index (fallback):', index);
    const newWaypoints = [...waypoints];
    [newWaypoints[index - 1], newWaypoints[index]] = [newWaypoints[index], newWaypoints[index - 1]];
    setWaypoints(newWaypoints);
  }, [waypoints, setWaypoints, moveWaypointUp]);

  const handleMoveDown = useCallback((id, index) => {
    // Ne pas déplacer si c'est l'avant-dernier ou dernier (index >= length - 2)
    if (index >= waypoints.length - 2) return;

    if (id && moveWaypointDown) {
      // Essayer via le store d'abord
      moveWaypointDown(id);
      return;
    }

    // Fallback manuel
    console.log('⬇️ Déplacement vers le bas par index (fallback):', index);
    const newWaypoints = [...waypoints];
    [newWaypoints[index], newWaypoints[index + 1]] = [newWaypoints[index + 1], newWaypoints[index]];
    setWaypoints(newWaypoints);
  }, [waypoints, setWaypoints, moveWaypointDown]);

  // Fonction pour insérer un waypoint à une position spécifique
  const insertWaypoint = useCallback((waypoint, index) => {
    const newWaypoints = [...waypoints];
    newWaypoints.splice(index, 0, waypoint);
    setWaypoints(newWaypoints);
  }, [waypoints, setWaypoints]);

  // Handler pour la sélection depuis le modal
  const handleWaypointSelection = useCallback((selection) => {
    console.log('📍 handleWaypointSelection appelé avec:', selection);

    let newWaypoint = null;

    if (selection.type === 'aerodrome') {
      const airport = selection.data;
      newWaypoint = {
        id: `waypoint-${Date.now()}`,
        name: airport.icao,
        lat: parseFloat(airport.coordinates.lat),
        lon: parseFloat(airport.coordinates.lon || airport.coordinates.lng),
        elevation: airport.elevation,
        airportName: airport.name,
        city: airport.city,
        type: 'waypoint'
      };
    } else if (selection.type === 'community') {
      // Point communautaire VFR
      const communityPoint = selection.data;
      newWaypoint = {
        id: `vfr-community-${Date.now()}`,
        name: communityPoint.name,
        lat: parseFloat(communityPoint.lat),
        lon: parseFloat(communityPoint.lon),
        elevation: communityPoint.altitude || 0, // Altitude en pieds (standard aviation)
        altitude: communityPoint.altitude,
        description: communityPoint.description,
        type: 'vfr', // Type VFR pour l'affichage sur la carte
        vfrType: communityPoint.type, // Type de point VFR (VRP, Landmark, etc.)
        fromCommunity: true
      };
      console.log('✅ Point communautaire créé:', newWaypoint);
    }

    if (newWaypoint) {
      const newWaypoints = [...waypoints];

      if (waypointInsertIndex !== null) {
        // Insertion à un index spécifique
        newWaypoints.splice(waypointInsertIndex, 0, newWaypoint);
      } else {
        // Ajout à la fin (avant l'arrivée si elle existe et est vide/non définie, ou juste avant la fin)
        // Logique : si on a déjà Départ et Arrivée, on insère avant l'Arrivée
        if (newWaypoints.length >= 2) {
          // Insérer avant le dernier point (Arrivée)
          newWaypoints.splice(newWaypoints.length - 1, 0, newWaypoint);
        } else {
          // Sinon ajouter à la fin
          newWaypoints.push(newWaypoint);
        }
      }

      setWaypoints(newWaypoints);
    }

    // Réinitialiser
    setWaypointInsertIndex(null);
  }, [waypoints, waypointInsertIndex, setWaypoints]);

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

  // Handler pour l'altitude
  const handleAltitudeChange = (value) => {
    // Accepter uniquement les nombres
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 45000) {
      setFlightParams(prev => ({ ...prev, altitude: numValue }));
    } else if (value === '') {
      setFlightParams(prev => ({ ...prev, altitude: 0 }));
    }
  };

  const reserveInfo = getReserveInfo();

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
                  plannedAltitude={flightParams.altitude || 3000}
                />
              </section>

            </>
          )}

          {/* Section Points de navigation et Gestion du trajet */}
          <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
            <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
              {/* En-tête avec titre */}
              <div style={sx.spacing.mb(4)}>
                <h3 style={sx.combine(sx.text.xl, sx.text.bold)}>
                  📍 Points de navigation
                </h3>
              </div>

              {/* Liste des waypoints */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {/* Message vide */}
                {waypoints.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <p style={{ color: '#6b7280', marginBottom: '16px' }}>
                      Aucun point de navigation défini
                    </p>
                    <button
                      onClick={() => {
                        setWaypointInsertIndex(null); // null = ajouter à la fin
                        setShowWaypointModal(true);
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
                    >
                      <Plus size={20} />
                      Ajouter un point de passage
                    </button>
                  </div>
                )}

                {waypoints.map((waypoint, index) => {
                  const prevWaypoint = index > 0 ? waypoints[index - 1] : null;
                  const incomingSegmentId = prevWaypoint ? `${prevWaypoint.id}-${waypoint.id}` : null;
                  const incomingSegmentAltitude = incomingSegmentId ? segmentAltitudes[incomingSegmentId] : null;

                  return (
                    <div key={waypoint.id || index}>
                      <WaypointCardWithRunways
                        waypoint={waypoint}
                        linkedVfrPoints={[]}
                        index={index}
                        totalWaypoints={waypoints.length}
                        allWaypoints={waypoints}
                        segmentAltitude={incomingSegmentAltitude}
                        onSelect={(airport) => handleAirportSelect(waypoint.id, airport)}
                        onRemove={() => removeWaypoint(waypoint.id, index)}
                        onMoveUp={() => handleMoveUp(waypoint.id, index)}
                        onMoveDown={() => handleMoveDown(waypoint.id, index)}
                        onRemoveVfrPoint={() => { }}
                        onInsertWaypoint={insertWaypoint}
                        onShowReportingPoints={() => {
                          setSelectedWaypointId(waypoint.id);
                          setShowReportingPoints(true);
                        }}
                      />

                      {/* Ligne de connexion simple entre les points (visuel uniquement) */}
                      {index < waypoints.length - 1 && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          height: '20px',
                          position: 'relative'
                        }}>
                          <div style={{
                            width: '2px',
                            height: '100%',
                            backgroundColor: '#e5e7eb'
                          }}></div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Bouton principal pour ajouter un point */}
                {waypoints.length > 0 && (
                  <button
                    onClick={() => {
                      setWaypointInsertIndex(null); // null = ajouter à la fin
                      setShowWaypointModal(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '2px dashed #e5e7eb',
                      background: '#f9fafb',
                      color: '#6b7280',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s',
                      marginTop: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.color = '#3b82f6';
                      e.currentTarget.style.background = '#eff6ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.color = '#6b7280';
                      e.currentTarget.style.background = '#f9fafb';
                    }}
                  >
                    <Plus size={20} />
                    Ajouter un point de passage
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Tableau récapitulatif des espaces aériens traversés */}
          {waypoints.length >= 2 && (
            <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Shield size={20} color="#3b82f6" />
                Espaces Aériens et Zones Traversés
              </h3>
              {/* Section Espaces Aériens - DÉPLACÉE vers l'étape 7 (Synthèse) */}
            </section>
          )}
        </>
      )}

      {/* Modal de sélection de waypoint */}
      <WaypointSelectorModal
        isOpen={showWaypointModal}
        onClose={() => {
          setShowWaypointModal(false);
          setWaypointInsertIndex(null);
        }}
        onSelect={handleWaypointSelection}
      />

    </div>
  );
};

// Export avec displayName
NavigationModule.displayName = 'NavigationModule';

export default NavigationModule;