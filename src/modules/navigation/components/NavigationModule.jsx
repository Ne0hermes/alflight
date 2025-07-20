import React from 'react';
import { useFlightSystem } from '../../../context/FlightSystemContext';
import { LoadInput } from '../../../components/ui/LoadInput';
import { Plus, Trash2, MapPin, ChevronRight } from 'lucide-react';

export const NavigationModule = () => {
  const { 
    selectedAircraft, 
    setSelectedAircraft, 
    aircraftList,
    waypoints, 
    setWaypoints, 
    flightParams, 
    setFlightParams, 
    navigationResults,
  } = useFlightSystem();

  const addWaypoint = () => {
    const newId = Math.max(...waypoints.map(w => w.id)) + 1;
    const lastWp = waypoints[waypoints.length - 1];
    setWaypoints([
      ...waypoints.slice(0, -1),
      { id: newId, name: '', type: 'waypoint', lat: lastWp.lat, lon: lastWp.lon },
      lastWp
    ]);
  };

  const removeWaypoint = (index) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  const updateWaypoint = (index, name) => {
    const updated = [...waypoints];
    updated[index].name = name;
    setWaypoints(updated);
  };

  return (
    <div>
      {/* Sélection d'avion */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          backgroundColor: '#dbeafe', 
          border: '2px solid #3b82f6', 
          borderRadius: '8px', 
          padding: '16px' 
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1e40af', 
            marginBottom: '12px' 
          }}>
            ✈️ Sélection de l'avion
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                color: '#6b7280', 
                marginBottom: '4px' 
              }}>
                Avion pour ce vol
              </label>
              <select
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '6px' 
                }}
                value={selectedAircraft?.id || ''}
                onChange={(e) => setSelectedAircraft(aircraftList.find(a => a.id === e.target.value))}
              >
                {aircraftList.map(aircraft => (
                  <option key={aircraft.id} value={aircraft.id}>
                    {aircraft.registration} - {aircraft.model}
                  </option>
                ))}
              </select>
            </div>
            {selectedAircraft && (
              <div style={{ fontSize: '14px' }}>
                <p style={{ margin: '0 0 4px 0' }}>
                  <span style={{ color: '#6b7280' }}>Carburant:</span>{' '}
                  <span style={{ fontWeight: '500' }}>{selectedAircraft.fuelType}</span>
                </p>
                <p style={{ margin: '0 0 4px 0' }}>
                  <span style={{ color: '#6b7280' }}>Vitesse:</span>{' '}
                  <span style={{ fontWeight: '500' }}>{selectedAircraft.cruiseSpeedKt} kt</span>
                </p>
                <p style={{ margin: '0' }}>
                  <span style={{ color: '#6b7280' }}>Consommation:</span>{' '}
                  <span style={{ fontWeight: '500' }}>{selectedAircraft.fuelConsumption} L/h</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Route */}
        <div>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1f2937', 
            marginBottom: '16px' 
          }}>
            📍 Planification de route
          </h3>
          
          <div style={{ marginBottom: '16px' }}>
            {waypoints.map((wp, index) => (
              <div key={wp.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '12px', 
                backgroundColor: '#f9fafb', 
                borderRadius: '8px',
                marginBottom: '8px'
              }}>
                <MapPin 
                  size={20} 
                  style={{ color: wp.type === 'departure' ? '#10b981' : '#ef4444' }} 
                />
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={wp.name}
                    onChange={(e) => updateWaypoint(index, e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '6px' 
                    }}
                    placeholder="Code OACI"
                  />
                </div>
                {index > 0 && index < waypoints.length - 1 && (
                  <button 
                    onClick={() => removeWaypoint(index)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#ef4444', 
                      cursor: 'pointer' 
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            
            <button 
              onClick={addWaypoint}
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '2px dashed #d1d5db', 
                borderRadius: '8px', 
                backgroundColor: 'transparent',
                color: '#6b7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Plus size={16} />
              Ajouter un waypoint
            </button>
          </div>

          {/* Résultats */}
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#eff6ff', 
            borderRadius: '8px' 
          }}>
            <h4 style={{ 
              fontWeight: '600', 
              color: '#1e40af', 
              marginBottom: '12px' 
            }}>
              📊 Résultats du calcul
            </h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '12px', 
              fontSize: '14px' 
            }}>
              <div>
                <p style={{ margin: '0', color: '#6b7280' }}>Distance totale</p>
                <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>
                  {navigationResults.totalDistance} Nm
                </p>
              </div>
              <div>
                <p style={{ margin: '0', color: '#6b7280' }}>Temps estimé</p>
                <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>
                  {Math.round(navigationResults.totalTime)} min
                </p>
              </div>
              <div>
                <p style={{ margin: '0', color: '#6b7280' }}>Carburant requis</p>
                <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>
                  {navigationResults.fuelRequired} L
                </p>
              </div>
              <div>
                <p style={{ margin: '0', color: '#6b7280' }}>Avec réserve</p>
                <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>
                  {navigationResults.fuelWithReserve} L
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Paramètres de vol */}
        <div>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1f2937', 
            marginBottom: '16px' 
          }}>
            ⚙️ Paramètres de vol
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <LoadInput
              label="Altitude de croisière (ft)"
              value={flightParams.altitude}
              onChange={(v) => setFlightParams({...flightParams, altitude: v})}
            />
            <LoadInput
              label="Vitesse vraie (kt)"
              value={flightParams.trueAirspeed}
              onChange={(v) => setFlightParams({...flightParams, trueAirspeed: v})}
            />
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                color: '#6b7280', 
                marginBottom: '4px' 
              }}>
                💨 Vent
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input 
                  type="number" 
                  style={{ 
                    padding: '8px 12px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '6px' 
                  }}
                  placeholder="Direction °"
                  value={flightParams.windDirection}
                  onChange={(e) => setFlightParams({...flightParams, windDirection: parseInt(e.target.value) || 0})}
                />
                <input 
                  type="number" 
                  style={{ 
                    padding: '8px 12px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '6px' 
                  }}
                  placeholder="Vitesse kt"
                  value={flightParams.windSpeed}
                  onChange={(e) => setFlightParams({...flightParams, windSpeed: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};