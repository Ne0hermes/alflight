// src/features/navigation/NavigationModule.jsx
import React, { memo, useState, useEffect, useCallback } from 'react';
import { useNavigation, useAircraft } from '@core/contexts';
import { MapPin, Plus, Trash2, Navigation2, Home, Sun, Moon } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useAirportCoordinates } from '@hooks/useAirportCoordinates';

export const NavigationModule = memo(() => {
  const { selectedAircraft } = useAircraft();
  const { waypoints, setWaypoints, flightParams, setFlightParams, flightType, setFlightType, navigationResults } = useNavigation();
  
  const handleWaypointChange = useCallback((index, field, value) => {
    const updated = [...waypoints];
    updated[index] = { ...updated[index], [field]: value };
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
    setWaypoints(waypoints.filter(wp => wp.id !== id));
  }, [waypoints, setWaypoints]);

  // Utiliser le hook pour obtenir les coordonnées
  const { getCoordinatesByICAO } = useAirportCoordinates();

  const handleICAOChange = useCallback((index, icao) => {
    handleWaypointChange(index, 'name', icao.toUpperCase());
    
    // Chercher les coordonnées
    const coords = getCoordinatesByICAO(icao);
    if (coords) {
      handleWaypointChange(index, 'lat', coords.lat);
      handleWaypointChange(index, 'lon', coords.lon);
    }
  }, [handleWaypointChange, getCoordinatesByICAO]);

  return (
    <div>
      {/* Sélection avion */}
      {!selectedAircraft && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
          <p style={sx.text.sm}>
            Sélectionnez un avion dans l'onglet "Gestion Avions" pour activer les calculs
          </p>
        </div>
      )}

      {/* Type de vol */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
          ✈️ Type de vol
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div>
            <label style={sx.components.label.base}>Période</label>
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
            <label style={sx.components.label.base}>Règles</label>
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
            <label style={sx.components.label.base}>Catégorie</label>
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
        
        {/* Info réserve */}
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(3))}>
          <p style={sx.text.sm}>
            Réserve réglementaire : <strong>{navigationResults?.regulationReserveMinutes || 0} minutes</strong>
            {flightType.period === 'nuit' && ' (vol de nuit)'}
            {flightType.rules === 'IFR' && ' (+15 min IFR)'}
            {flightType.category === 'local' && ' (vol local)'}
          </p>
        </div>
      </section>

      {/* Points de navigation */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
          🗺️ Points de navigation
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {waypoints.map((waypoint, index) => (
            <div key={waypoint.id} style={sx.combine(sx.components.card.base, sx.flex.between)}>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 2fr 2fr', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="ICAO"
                  value={waypoint.name}
                  onChange={(e) => handleICAOChange(index, e.target.value)}
                  style={sx.components.input.base}
                />
                <input
                  type="number"
                  placeholder="Latitude"
                  value={waypoint.lat}
                  onChange={(e) => handleWaypointChange(index, 'lat', parseFloat(e.target.value))}
                  style={sx.components.input.base}
                  step="0.0001"
                />
                <input
                  type="number"
                  placeholder="Longitude"
                  value={waypoint.lon}
                  onChange={(e) => handleWaypointChange(index, 'lon', parseFloat(e.target.value))}
                  style={sx.components.input.base}
                  step="0.0001"
                />
              </div>
              {waypoints.length > 2 && (
                <button
                  onClick={() => removeWaypoint(waypoint.id)}
                  style={sx.combine(sx.components.button.base, sx.components.button.danger, sx.spacing.ml(3))}
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
      </section>

      {/* Résultats */}
      {selectedAircraft && navigationResults && (
        <section style={sx.combine(sx.components.section.base)}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
            📊 Résultats de navigation
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div style={sx.components.card.base}>
              <h4 style={sx.text.secondary}>Distance totale</h4>
              <p style={sx.combine(sx.text['2xl'], sx.text.bold)}>
                {navigationResults.totalDistance} NM
              </p>
            </div>
            
            <div style={sx.components.card.base}>
              <h4 style={sx.text.secondary}>Temps de vol</h4>
              <p style={sx.combine(sx.text['2xl'], sx.text.bold)}>
                {Math.floor(navigationResults.totalTime / 60)}h{String(navigationResults.totalTime % 60).padStart(2, '0')}
              </p>
            </div>
            
            <div style={sx.components.card.base}>
              <h4 style={sx.text.secondary}>Carburant nécessaire</h4>
              <p style={sx.combine(sx.text['2xl'], sx.text.bold)}>
                {navigationResults.fuelRequired} L
              </p>
            </div>
            
            <div style={sx.components.card.base}>
              <h4 style={sx.text.secondary}>Réserve finale</h4>
              <p style={sx.combine(sx.text['2xl'], sx.text.bold)}>
                {navigationResults.regulationReserveLiters} L
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
});

NavigationModule.displayName = 'NavigationModule';

export default NavigationModule;