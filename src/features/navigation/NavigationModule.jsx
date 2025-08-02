// src/features/navigation/NavigationModule.jsx
import React, { memo, useState, useCallback, useEffect } from 'react';
import { MapPin, Plus, Trash2, Navigation2, Home, Sun, Moon, List, Loader, AlertCircle } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

// Import des contextes et hooks
import { useNavigation, useAircraft } from '@core/contexts';
import { useNavigationResults } from '@hooks/useNavigationResults';
import { useOpenAIPStore, openAIPSelectors } from '@core/stores/openAIPStore';

// Import des composants locaux
import { NavigationMap } from './components/NavigationMap';
import { AirportSelector } from './components/AirportSelector';
import { ReportingPointsSelector } from './components/ReportingPointsSelector';
import { AirspaceAnalyzer } from './components/AirspaceAnalyzer';

const NavigationModule = () => {
  const { selectedAircraft } = useAircraft();
  const { waypoints, setWaypoints, flightParams, setFlightParams, flightType, setFlightType } = useNavigation();
  const navigationResults = useNavigationResults();
  
  // OpenAIP Store
  const { loadAirports } = useOpenAIPStore();
  const loading = openAIPSelectors.useLoading();
  const errors = openAIPSelectors.useErrors();
  
  const [showReportingPoints, setShowReportingPoints] = useState(false);
  const [selectedWaypointId, setSelectedWaypointId] = useState(null);

  // Charger les aérodromes au montage
  useEffect(() => {
    loadAirports('FR');
  }, [loadAirports]);

  // Handlers pour les waypoints
  const handleWaypointUpdate = useCallback((waypointId, updates) => {
    const updated = waypoints.map(wp => 
      wp.id === waypointId ? { ...wp, ...updates } : wp
    );
    setWaypoints(updated);
  }, [waypoints, setWaypoints]);

  const handleAirportSelect = useCallback((waypointId, airport) => {
    if (airport) {
      handleWaypointUpdate(waypointId, {
        name: airport.icao,
        lat: airport.coordinates.lat,
        lon: airport.coordinates.lon,
        elevation: airport.elevation,
        airportName: airport.name
      });
    }
  }, [handleWaypointUpdate]);

  const addWaypoint = useCallback(() => {
    const newWaypoint = {
      id: Date.now(),
      name: '',
      type: 'waypoint',
      lat: null,
      lon: null,
      elevation: null,
      airportName: ''
    };
    setWaypoints([...waypoints, newWaypoint]);
  }, [waypoints, setWaypoints]);

  const removeWaypoint = useCallback((id) => {
    if (waypoints.length <= 2) return; // Garder au moins départ et arrivée
    setWaypoints(waypoints.filter(wp => wp.id !== id));
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

  const reserveInfo = getReserveInfo();

  return (
    <div>
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

      {/* Section Points de navigation */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold)}>
            🗺️ Points de navigation
          </h3>
          
          {/* Bouton pour les points VFR */}
          <button
            onClick={() => setShowReportingPoints(!showReportingPoints)}
            style={sx.combine(
              sx.components.button.base,
              sx.components.button.secondary
            )}
            title="Points de report VFR"
          >
            <Navigation2 size={16} />
            Points VFR
          </button>
        </div>
        
        {/* Liste des waypoints */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {waypoints.map((waypoint, index) => (
            <WaypointCard
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
          style={sx.combine(sx.components.button.base, sx.components.button.primary, sx.spacing.mt(3))}
        >
          <Plus size={16} />
          Ajouter un point
        </button>
      </section>

      {/* Section Carte de navigation */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
          🗺️ Carte de navigation
        </h3>
        
        <NavigationMap 
          waypoints={waypoints}
          onWaypointUpdate={handleWaypointUpdate}
          selectedAircraft={selectedAircraft}
        />
        
        <div style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(3))}>
          💡 Glissez les marqueurs sur la carte pour ajuster les positions des waypoints
        </div>
      </section>

      {/* Points de report VFR */}
      {showReportingPoints && selectedWaypointId && (
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
          <ReportingPointsSelector
            airportIcao={waypoints.find(w => w.id === selectedWaypointId)?.name}
            selectedPoints={[]}
            onPointsChange={(points) => {
              // Logique pour ajouter des points de report
              console.log('Points de report sélectionnés:', points);
            }}
            maxPoints={5}
          />
        </section>
      )}

      {/* Résultats de navigation */}
      {selectedAircraft && navigationResults && (
        <>
          <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
            <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
              📊 Résultats de navigation
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div style={sx.components.card.base}>
                <h4 style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(2))}>Distance totale</h4>
                <p style={sx.combine(sx.text['2xl'], sx.text.bold, sx.text.primary)}>
                  {navigationResults.totalDistance} NM
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  ≈ {(navigationResults.totalDistance * 1.852).toFixed(0)} km
                </p>
              </div>
              
              <div style={sx.components.card.base}>
                <h4 style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(2))}>Temps de vol</h4>
                <p style={sx.combine(sx.text['2xl'], sx.text.bold, sx.text.primary)}>
                  {Math.floor(navigationResults.totalTime / 60)}h{String(navigationResults.totalTime % 60).padStart(2, '0')}
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  @ {selectedAircraft.cruiseSpeedKt} kt
                </p>
              </div>
              
              <div style={sx.components.card.base}>
                <h4 style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(2))}>Carburant nécessaire</h4>
                <p style={sx.combine(sx.text['2xl'], sx.text.bold, sx.text.primary)}>
                  {navigationResults.fuelRequired} L
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  ≈ {(navigationResults.fuelRequired / 3.78541).toFixed(1)} gal
                </p>
              </div>
              
              <div style={sx.components.card.base}>
                <h4 style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(2))}>Réserve finale</h4>
                <p style={sx.combine(sx.text['2xl'], sx.text.bold, sx.text.primary)}>
                  {navigationResults.regulationReserveLiters} L
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  {navigationResults.regulationReserveMinutes} min
                </p>
              </div>
            </div>
          </section>
          
          {/* Analyse des espaces aériens - NOUVELLE SECTION */}
          <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
            <AirspaceAnalyzer waypoints={waypoints} />
          </section>
        </>
      )}
    </div>
  );
};

// Composant pour une carte de waypoint
const WaypointCard = memo(({ waypoint, index, totalWaypoints, onSelect, onRemove, onShowReportingPoints }) => {
  const isFirst = index === 0;
  const isLast = index === totalWaypoints - 1;
  const canDelete = totalWaypoints > 2;
  
  const getLabel = () => {
    if (isFirst) return { text: 'Départ', color: '#10b981' };
    if (isLast) return { text: 'Arrivée', color: '#f59e0b' };
    return { text: `Étape ${index}`, color: '#3b82f6' };
  };
  
  const label = getLabel();
  
  return (
    <div style={sx.combine(
      sx.components.card.base,
      { borderColor: label.color, borderWidth: '2px' }
    )}>
      {/* En-tête avec label */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: label.color,
          backgroundColor: label.color + '20',
          padding: '4px 12px',
          borderRadius: '4px'
        }}>
          {label.text}
        </span>
        
        {canDelete && (
          <button
            onClick={onRemove}
            style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '6px' })}
            title="Supprimer ce point"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      
      {/* Sélecteur d'aérodrome */}
      <AirportSelector
        label="Aérodrome"
        value={waypoint.name ? { 
          icao: waypoint.name, 
          name: waypoint.airportName || waypoint.name,
          coordinates: { lat: waypoint.lat, lon: waypoint.lon }
        } : null}
        onChange={onSelect}
        placeholder="Rechercher un aérodrome..."
        excludeIcao={null}
      />
      
      {/* Informations du waypoint */}
      {waypoint.lat && waypoint.lon && (
        <div style={sx.combine(sx.spacing.mt(3), sx.text.sm, sx.text.secondary)}>
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(4))}>
            <span>📍 {waypoint.lat.toFixed(4)}°, {waypoint.lon.toFixed(4)}°</span>
            {waypoint.elevation && <span>⛰️ {waypoint.elevation} ft</span>}
          </div>
          
          {/* Bouton pour les points de report VFR */}
          {waypoint.name && waypoint.name.match(/^LF[A-Z]{2}$/) && (
            <button
              onClick={onShowReportingPoints}
              style={sx.combine(
                sx.components.button.base,
                sx.components.button.secondary,
                sx.spacing.mt(2),
                { fontSize: '12px', padding: '6px 12px' }
              )}
            >
              <Navigation2 size={14} />
              Points de report VFR
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// Export avec displayName
NavigationModule.displayName = 'NavigationModule';
WaypointCard.displayName = 'WaypointCard';

export default NavigationModule;