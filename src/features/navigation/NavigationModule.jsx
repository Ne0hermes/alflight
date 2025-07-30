// src/features/navigation/NavigationModule.jsx
import React, { memo, useState, useCallback } from 'react';
import { MapPin, Plus, Trash2, Navigation2, Home, Sun, Moon, Map, List } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

// Import des contextes
import { useNavigation, useAircraft } from '@core/contexts';
import { useNavigationResults } from '@hooks/useNavigationResults';
import { useAirportCoordinates } from '@hooks/useAirportCoordinates';

// Import des composants locaux
import { NavigationMap } from './components/NavigationMap';
import { PerformanceCalculator } from './components/PerformanceCalculator';
import { AirportSelector } from './components/AirportSelector';

const NavigationModule = () => {
  const { selectedAircraft } = useAircraft();
  const { waypoints, setWaypoints, flightParams, setFlightParams, flightType, setFlightType } = useNavigation();
  const navigationResults = useNavigationResults();
  const { getCoordinatesByICAO } = useAirportCoordinates();
  
  const [viewMode, setViewMode] = useState('list'); // 'list' ou 'map'
  const [showAirportSelector, setShowAirportSelector] = useState(false);
  const [airportSelectorIndex, setAirportSelectorIndex] = useState(null);

  // Handlers pour les waypoints
  const handleWaypointChange = useCallback((index, field, value) => {
    const updated = [...waypoints];
    updated[index] = { ...updated[index], [field]: value };
    setWaypoints(updated);
  }, [waypoints, setWaypoints]);

  const handleWaypointUpdate = useCallback((waypointId, updates) => {
    const updated = waypoints.map(wp => 
      wp.id === waypointId ? { ...wp, ...updates } : wp
    );
    setWaypoints(updated);
  }, [waypoints, setWaypoints]);

  const addWaypoint = useCallback(() => {
    setWaypoints([...waypoints, {
      id: Date.now(),
      name: '',
      type: 'waypoint',
      lat: 0,
      lon: 0
    }]);
  }, [waypoints, setWaypoints]);

  const removeWaypoint = useCallback((id) => {
    if (waypoints.length <= 2) return; // Garder au moins départ et arrivée
    setWaypoints(waypoints.filter(wp => wp.id !== id));
  }, [waypoints, setWaypoints]);

  const handleICAOChange = useCallback((index, icao) => {
    handleWaypointChange(index, 'name', icao.toUpperCase());
    
    // Chercher les coordonnées
    const coords = getCoordinatesByICAO(icao);
    if (coords) {
      handleWaypointChange(index, 'lat', coords.lat);
      handleWaypointChange(index, 'lon', coords.lon);
    }
  }, [handleWaypointChange, getCoordinatesByICAO]);

  // Handler pour la sélection d'aéroport via le sélecteur
  const handleAirportSelect = useCallback((airport) => {
    if (airportSelectorIndex !== null && airport) {
      handleWaypointChange(airportSelectorIndex, 'name', airport.icao);
      handleWaypointChange(airportSelectorIndex, 'lat', airport.coordinates.lat);
      handleWaypointChange(airportSelectorIndex, 'lon', airport.coordinates.lon);
    }
    setShowAirportSelector(false);
    setAirportSelectorIndex(null);
  }, [airportSelectorIndex, handleWaypointChange]);

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
          
          {/* Boutons de bascule vue */}
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
            <button
              onClick={() => setViewMode('list')}
              style={sx.combine(
                sx.components.button.base,
                viewMode === 'list' ? sx.components.button.primary : sx.components.button.secondary
              )}
            >
              <List size={16} />
              Liste
            </button>
            <button
              onClick={() => setViewMode('map')}
              style={sx.combine(
                sx.components.button.base,
                viewMode === 'map' ? sx.components.button.primary : sx.components.button.secondary
              )}
            >
              <Map size={16} />
              Carte
            </button>
          </div>
        </div>
        
        {/* Vue Liste */}
        {viewMode === 'list' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {waypoints.map((waypoint, index) => (
                <div key={waypoint.id} style={sx.combine(sx.components.card.base, sx.flex.between)}>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 2fr 2fr auto', gap: '12px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="ICAO"
                        value={waypoint.name}
                        onChange={(e) => handleICAOChange(index, e.target.value)}
                        style={sx.components.input.base}
                      />
                      <span style={{
                        position: 'absolute',
                        left: '8px',
                        top: '-8px',
                        fontSize: '10px',
                        backgroundColor: 'white',
                        padding: '0 4px',
                        color: index === 0 ? '#10b981' : index === waypoints.length - 1 ? '#f59e0b' : '#3b82f6'
                      }}>
                        {index === 0 ? 'Départ' : index === waypoints.length - 1 ? 'Arrivée' : `Étape ${index}`}
                      </span>
                    </div>
                    <input
                      type="number"
                      placeholder="Latitude"
                      value={waypoint.lat || ''}
                      onChange={(e) => handleWaypointChange(index, 'lat', parseFloat(e.target.value) || 0)}
                      style={sx.components.input.base}
                      step="0.0001"
                    />
                    <input
                      type="number"
                      placeholder="Longitude"
                      value={waypoint.lon || ''}
                      onChange={(e) => handleWaypointChange(index, 'lon', parseFloat(e.target.value) || 0)}
                      style={sx.components.input.base}
                      step="0.0001"
                    />
                    <button
                      onClick={() => {
                        setAirportSelectorIndex(index);
                        setShowAirportSelector(true);
                      }}
                      style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '8px' })}
                      title="Rechercher un aérodrome"
                    >
                      <MapPin size={16} />
                    </button>
                  </div>
                  {waypoints.length > 2 && (
                    <button
                      onClick={() => removeWaypoint(waypoint.id)}
                      style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '8px', marginLeft: '12px' })}
                      title="Supprimer ce point"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <button
              onClick={addWaypoint}
              style={sx.combine(sx.components.button.base, sx.components.button.primary, sx.spacing.mt(3))}
            >
              <Plus size={16} />
              Ajouter un point
            </button>
          </>
        )}
        
        {/* Vue Carte */}
        {viewMode === 'map' && (
          <div>
            <NavigationMap 
              waypoints={waypoints}
              onWaypointUpdate={handleWaypointUpdate}
              selectedAircraft={selectedAircraft}
            />
            
            <div style={sx.combine(sx.flex.between, sx.spacing.mt(3))}>
              <button
                onClick={addWaypoint}
                style={sx.combine(sx.components.button.base, sx.components.button.primary)}
              >
                <Plus size={16} />
                Ajouter un point
              </button>
              
              <div style={sx.combine(sx.text.sm, sx.text.secondary)}>
                💡 Glissez les marqueurs sur la carte pour ajuster les positions
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Résultats de navigation */}
      {selectedAircraft && navigationResults && (
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
      )}
      
      {/* Calculateur de performances */}
      {selectedAircraft && waypoints.length >= 2 && waypoints[0].name && waypoints[waypoints.length - 1].name && (
        <PerformanceCalculator />
      )}

      {/* Modal Sélecteur d'aéroport */}
      {showAirportSelector && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h3 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mb(4))}>
              Sélectionner un aérodrome
            </h3>
            
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <AirportSelector
                label=""
                value={null}
                onChange={handleAirportSelect}
                placeholder="Rechercher par code ICAO, nom ou ville..."
              />
            </div>
            
            <div style={sx.combine(sx.flex.end, sx.spacing.mt(4))}>
              <button
                onClick={() => {
                  setShowAirportSelector(false);
                  setAirportSelectorIndex(null);
                }}
                style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

NavigationModule.displayName = 'NavigationModule';

export default NavigationModule;