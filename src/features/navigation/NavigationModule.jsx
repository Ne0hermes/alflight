// src/features/navigation/NavigationModule.jsx
import React, { memo, useState, useCallback, useEffect } from 'react';
import { MapPin, Plus, Trash2, Navigation2, Home, Sun, Moon, List, Loader, AlertCircle, AlertTriangle, Wind, Plane } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useUnits } from '@hooks/useUnits';
import { ValueWithUnit, ValueGrid } from '@shared/components/ValueWithUnit';

// Import des contextes et hooks
import { useNavigation, useAircraft } from '@core/contexts';
import { useOpenAIPStore, openAIPSelectors } from '@core/stores/openAIPStore';
import { useWeatherStore, weatherSelectors } from '@core/stores/weatherStore';

// Import du vrai hook useNavigationResults
import { useNavigationResults } from './hooks/useNavigationResults';

// Import des composants locaux
import NavigationMapReact from './components/NavigationMapReact';
// Utilisation de la carte React-Leaflet
const NavigationMap = NavigationMapReact;
import { OpenAIPConfig } from '@components/OpenAIPConfig';
import { SimpleAirportSelector as AirportSelector } from './components/SimpleAirportSelector';
import { WaypointCardWithRunways } from './components/WaypointCardWithRunways';
import { ReportingPointsSelector } from './components/ReportingPointsSelector';
import { default as AirspaceAnalyzer } from './components/AirspaceAnalyzer';
// import { default as TechnicalLog } from './components/TechnicalLog';
import { default as RunwayAnalyzer } from './components/RunwayAnalyzer';
import WindAnalysis from './components/WindAnalysis';
import TopOfDescent from './components/TopOfDescent';
import DangerousZonesDetector from './components/DangerousZonesDetector';
import VFRNavigationTable from './components/VFRNavigationTable';
import MapConnectionTestV2 from './components/MapConnectionTestV2';
import MapDiagnosticTest from './components/MapDiagnosticTest';

// Hook temporaire pour remplacer useAlternatesForNavigation
const useAlternatesForNavigation = () => {
  return {
    alternates: [],
    hasAlternates: false,
    addAlternateAsWaypoint: () => {}
  };
};




const NavigationModule = () => {
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
    updateWaypoint: updateWaypointInStore
  } = useNavigation();
  // Passer les paramètres au hook
  const navigationResults = useNavigationResults(waypoints, flightType, selectedAircraft);
  const { alternates, hasAlternates, addAlternateAsWaypoint } = useAlternatesForNavigation();
  
  // OpenAIP Store
  const { loadAirports } = useOpenAIPStore();
  const loading = openAIPSelectors.useLoading();
  const errors = openAIPSelectors.useErrors();
  
  const [showReportingPoints, setShowReportingPoints] = useState(false);
  const [selectedWaypointId, setSelectedWaypointId] = useState(null);
  const [plannedAltitude, setPlannedAltitude] = useState(3000); // Altitude par défaut en pieds
  const [selectedVFRPoints, setSelectedVFRPoints] = useState({}); // Points VFR par waypoint
  const [dangerousZones, setDangerousZones] = useState({});

  // Charger les aérodromes au montage
  useEffect(() => {
    loadAirports('FR');
  }, [loadAirports]);
  
  // Stocker les zones dangereuses pour les autres modules
  useEffect(() => {
    if (dangerousZones && Object.keys(dangerousZones).length > 0) {
      // Stocker dans le localStorage pour que le module Technical Log puisse y accéder
      localStorage.setItem('flightDangerousZones', JSON.stringify(dangerousZones));
    }
  }, [dangerousZones]);

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

  // Suggestions d'altitude basées sur les règles
  const getAltitudeSuggestions = () => {
    const isVFR = flightType.rules === 'VFR';
    const suggestions = [];
    
    if (isVFR) {
      // Règles VFR : altitudes impaires + 500 vers l'Est (0-179°), paires + 500 vers l'Ouest (180-359°)
      suggestions.push(
        { altitude: 2500, description: "VFR bas niveau" },
        { altitude: 3500, description: "VFR Est (0-179°)" },
        { altitude: 4500, description: "VFR Ouest (180-359°)" },
        { altitude: 5500, description: "VFR Est (0-179°)" },
        { altitude: 6500, description: "VFR Ouest (180-359°)" }
      );
    } else {
      // Règles IFR : altitudes en milliers pairs/impairs selon direction
      suggestions.push(
        { altitude: 3000, description: "IFR Ouest (180-359°)" },
        { altitude: 4000, description: "IFR Est (0-179°)" },
        { altitude: 5000, description: "IFR Ouest (180-359°)" },
        { altitude: 6000, description: "IFR Est (0-179°)" },
        { altitude: 7000, description: "IFR Ouest (180-359°)" }
      );
    }
    
    return suggestions;
  };

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
  const altitudeSuggestions = getAltitudeSuggestions();

  // Obtenir l'aérodrome d'arrivée
  const arrivalAirport = waypoints.length > 0 ? waypoints[waypoints.length - 1] : null;
  const arrivalIcao = arrivalAirport?.name && arrivalAirport.name.match(/^[A-Z]{4}$/) ? arrivalAirport.name : null;

  return (
    <div>
      {/* Configuration OpenAIP */}
      <OpenAIPConfig />
      
      {/* Alerte si pas d'avion sélectionné */}
      {!selectedAircraft && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
          <p style={sx.text.sm}>
            Sélectionnez un avion dans l'onglet "Gestion Avions" pour activer les calculs
          </p>
        </div>
      )}

      {/* Alerte de chargement OpenAIP */}
      {loading.airports && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
          <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={sx.text.sm}>
            Chargement des données aéronautiques OpenAIP...
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
          
          {/* Calcul du Top of Descent */}
          <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
            <TopOfDescent
              currentAltitude={plannedAltitude}
              waypoints={waypoints}
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

      {/* Test de connexion - temporairement réactivé */}
      <MapConnectionTestV2 />

      {/* Section Carte et Points de navigation côte à côte */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          {/* Carte de navigation (60%) */}
          <div style={{ flex: '0 0 60%' }}>
            <NavigationMap 
              waypoints={waypoints}
              onWaypointUpdate={handleWaypointUpdate}
            />
            
            <div style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(3))}>
              💡 Glissez les marqueurs sur la carte pour ajuster les positions des waypoints. 
              Utilisez le bouton "Afficher rayon" pour visualiser votre rayon d'action basé sur le carburant disponible.
            </div>
          </div>
          
          {/* Points de navigation (40%) */}
          <div style={{ flex: '0 0 40%', minWidth: '400px' }}>
            <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
              <h3 style={sx.combine(sx.text.lg, sx.text.bold)}>
                📍 Points de navigation
              </h3>
              
              {/* Bouton pour les points VFR */}
              <button
                onClick={() => setShowReportingPoints(!showReportingPoints)}
                style={sx.combine(
                  sx.components.button.base,
                  sx.components.button.secondary,
                  { padding: '6px 12px', fontSize: '12px' }
                )}
                title="Points de report VFR"
              >
                <Navigation2 size={14} />
                VFR
              </button>
            </div>
            
            {/* Liste des waypoints avec scroll si nécessaire */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px',
              maxHeight: '600px',
              overflowY: 'auto',
              paddingRight: '8px'
            }}>
              {waypoints.map((waypoint, index) => (
                <WaypointCardWithRunways
                  key={waypoint.id}
                  waypoint={waypoint}
                  index={index}
                  totalWaypoints={waypoints.length}
                  onSelect={(airport) => handleAirportSelect(waypoint.id, airport)}
                  onRemove={() => removeWaypoint(waypoint.id)}
                  onShowReportingPoints={() => {
                    setSelectedWaypointId(waypoint.id);
                    setShowReportingPoints(true);
                  }}
                />
              ))}
            </div>
            
            <button
              onClick={addWaypoint}
              style={sx.combine(sx.components.button.base, sx.components.button.primary, sx.spacing.mt(3), { width: '100%' })}
            >
              <Plus size={16} />
              Ajouter un point
            </button>
          </div>
        </div>
      </section>

      {/* Points de report VFR */}
      {showReportingPoints && selectedWaypointId && (
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
          <ReportingPointsSelector
            airportIcao={waypoints.find(w => w.id === selectedWaypointId)?.name}
            selectedPoints={selectedVFRPoints[selectedWaypointId] || []}
            onPointsChange={(points) => {
              setSelectedVFRPoints(prev => ({
                ...prev,
                [selectedWaypointId]: points
              }));
            }}
            maxPoints={5}
          />
        </section>
      )}

      {/* Détection des zones dangereuses */}
      {waypoints && waypoints.length >= 2 && (
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
          <DangerousZonesDetector
            waypoints={waypoints}
            onZonesChange={setDangerousZones}
          />
        </section>
      )}
      
      {/* Analyse des espaces aériens */}
      {selectedAircraft && navigationResults && (
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
          <AirspaceAnalyzer 
            waypoints={waypoints} 
            plannedAltitude={plannedAltitude}
            onAltitudeChange={setPlannedAltitude}
            flightTypeRules={flightType.rules}
            altitudeSuggestions={altitudeSuggestions}
          />
        </section>
      )}

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

    </div>
  );
};

// Export avec displayName
NavigationModule.displayName = 'NavigationModule';

export default NavigationModule;