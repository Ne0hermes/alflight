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
import { NavigationMapSIAFixed } from './components/NavigationMapSIAFixed';
import { SimpleAirportSelector } from './components/SimpleAirportSelector';
// Utilisation de la carte SIA corrigée
const NavigationMap = NavigationMapSIAFixed;
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
  console.log('🔧 Navigation Module - Current fuel unit:', getUnit('fuel'));
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
      {/* Onglets */}
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

      {/* Contenu des onglets */}
      {activeTab === 'alternates' ? (
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

      {/* Section Type de vol */}
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

      {/* Résultats de navigation */}
      {selectedAircraft && navigationResults && (
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

      {/* Analyse du vent et impact sur le vol */}
      {selectedAircraft && waypoints.length >= 2 && (
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


      {/* Section Carte de navigation */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <NavigationMap 
          waypoints={waypoints}
          onWaypointUpdate={setWaypoints}
          plannedAltitude={plannedAltitude}
          onPlannedAltitudeChange={setPlannedAltitude}
          segmentAltitudes={segmentAltitudes}
        />
        
        <div style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(3))}>
          💡 Glissez les marqueurs sur la carte pour ajuster les positions des waypoints. 
          Utilisez le bouton "Afficher rayon" pour visualiser votre rayon d'action basé sur le carburant disponible.
        </div>
      </section>

      {/* Section Points de navigation et Gestion du trajet */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
          {/* En-tête avec titre */}
          <div style={sx.spacing.mb(4)}>
            <h3 style={sx.combine(sx.text.xl, sx.text.bold)}>
              📍 Points de navigation
            </h3>
          </div>
          
          {/* Liste des waypoints alternés avec les segments d'altitude */}
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {waypoints.map((waypoint, index) => {
              const isLast = index === waypoints.length - 1;
              const nextWaypoint = !isLast ? waypoints[index + 1] : null;
              const segmentId = nextWaypoint ? `${waypoint.id}-${nextWaypoint.id}` : null;
              const segmentAltitude = segmentId ? segmentAltitudes[segmentId] : null;
              
              // Pour le TOD, on prend l'altitude du segment qui arrive à ce waypoint
              const prevWaypoint = index > 0 ? waypoints[index - 1] : null;
              const incomingSegmentId = prevWaypoint ? `${prevWaypoint.id}-${waypoint.id}` : null;
              const incomingSegmentAltitude = incomingSegmentId ? segmentAltitudes[incomingSegmentId] : null;
              
              return (
                <React.Fragment key={waypoint.id}>
                  {/* Carte du waypoint */}
                  <WaypointCardWithRunways
                    waypoint={waypoint}
                    index={index}
                    totalWaypoints={waypoints.length}
                    allWaypoints={waypoints}
                    segmentAltitude={incomingSegmentAltitude}
                    onSelect={(airport) => handleAirportSelect(waypoint.id, airport)}
                    onRemove={() => removeWaypoint(waypoint.id)}
                    onInsertWaypoint={insertWaypoint}
                    onShowReportingPoints={() => {
                      setSelectedWaypointId(waypoint.id);
                      setShowReportingPoints(true);
                    }}
                  />
                  
                  {/* Bouton pour ajouter un waypoint entre deux points */}
                  {!isLast && nextWaypoint && (
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
                          // Insérer après le waypoint actuel (position index + 1)
                          insertWaypoint(newWaypoint, index + 1);
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
                  
                  {/* Segment d'altitude entre ce waypoint et le suivant */}
                  {!isLast && nextWaypoint && (
                    <div style={sx.combine(
                      sx.spacing.px(4),
                      sx.spacing.py(2),
                      sx.bg.gray,
                      sx.rounded.md,
                      {
                        marginLeft: '40px',
                        marginRight: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        borderLeft: '3px solid #3b82f6'
                      }
                    )}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={sx.combine(sx.text.sm, sx.text.secondary)}>
                          ➜ Segment vers {nextWaypoint.name || `Étape ${index + 2}`}
                        </span>
                        
                        {/* Altitude du segment */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div>
                            <label style={sx.combine(sx.text.xs, sx.text.secondary)}>
                              Altitude
                            </label>
                            <input
                              type="number"
                              value={segmentAltitude?.startAlt || plannedAltitude}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                setSegmentAltitude(segmentId, {
                                  startAlt: value,
                                  endAlt: segmentAltitude?.endAlt || value,
                                  type: value === (segmentAltitude?.endAlt || value) ? 'level' : 
                                        value < (segmentAltitude?.endAlt || value) ? 'climb' : 'descent'
                                });
                              }}
                              style={sx.combine(
                                sx.components.input.base,
                                { width: '100px', padding: '4px 8px', fontSize: '12px' }
                              )}
                              placeholder="ft"
                              step="500"
                            />
                          </div>
                          
                          {/* Type de vol */}
                          <div style={sx.combine(sx.text.xs, {
                            color: segmentAltitude?.type === 'climb' ? '#10b981' :
                                   segmentAltitude?.type === 'descent' ? '#f59e0b' : '#6b7280'
                          })}>
                            {segmentAltitude?.type === 'climb' ? '↗ Montée' :
                             segmentAltitude?.type === 'descent' ? '↘ Descente' : '→ Palier'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
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

          {/* Points VFR Globaux */}
          <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
            <GlobalVFRPointsManager />
          </section>
        </>
      )}

    </div>
  );
};

// Export avec displayName
NavigationModule.displayName = 'NavigationModule';

export default NavigationModule;