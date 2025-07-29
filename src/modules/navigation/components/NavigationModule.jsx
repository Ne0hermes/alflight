import React from 'react';
import { useFlightSystem } from '../../../context/FlightSystemContext';
import { LoadInput } from '../../../components/ui/LoadInput';
import { Plus, Trash2, MapPin, ChevronRight, Sun, Moon, Navigation2, Home, CheckCircle } from 'lucide-react';
import { PerformanceCalculator } from './PerformanceCalculator';
import { RouteMap } from './RouteMap';
import { useAirportCoordinates } from '../../vac/hooks/useAirportCoordinates';

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
    flightType,
    setFlightType
  } = useFlightSystem();

  const { getCoordinatesByICAO } = useAirportCoordinates();

  // Enrichir automatiquement les waypoints avec les coordonnées depuis VAC
  React.useEffect(() => {
    const enrichedWaypoints = waypoints.map(wp => {
      if (wp.name && (!wp.lat || !wp.lon)) {
        const coords = getCoordinatesByICAO(wp.name);
        if (coords) {
          return {
            ...wp,
            lat: coords.lat,
            lon: coords.lon
          };
        }
      }
      return wp;
    });

    // Vérifier si des coordonnées ont été ajoutées
    const hasNewCoords = enrichedWaypoints.some((wp, index) => 
      wp.lat !== waypoints[index].lat || wp.lon !== waypoints[index].lon
    );

    if (hasNewCoords) {
      setWaypoints(enrichedWaypoints);
    }
  }, [waypoints.map(wp => wp.name).join(','), getCoordinatesByICAO]); // Dépendance sur les noms uniquement

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
      {/* Type de vol */}
      <div style={{ 
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#fef3c7',
        border: '2px solid #f59e0b',
        borderRadius: '8px'
      }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#92400e', 
          marginBottom: '12px' 
        }}>
          🛩️ Type de Vol
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {/* Période */}
          <div>
            <label style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '14px', 
              color: '#6b7280', 
              marginBottom: '4px'
            }}>
              {flightType?.period === 'jour' ? <Sun size={16} /> : <Moon size={16} />}
              Période
            </label>
            <select
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px',
                backgroundColor: 'white'
              }}
              value={flightType?.period || 'jour'}
              onChange={(e) => setFlightType({...flightType, period: e.target.value})}
            >
              <option value="jour">Jour</option>
              <option value="nuit">Nuit</option>
            </select>
          </div>

          {/* Règles de vol */}
          <div>
            <label style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '14px', 
              color: '#6b7280', 
              marginBottom: '4px'
            }}>
              {flightType?.rules === 'VFR' ? '🌤️' : '🛫'}
              Règles de vol
            </label>
            <select
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px',
                backgroundColor: 'white'
              }}
              value={flightType?.rules || 'VFR'}
              onChange={(e) => setFlightType({...flightType, rules: e.target.value})}
            >
              <option value="VFR">VFR</option>
              <option value="IFR">IFR</option>
            </select>
          </div>

          {/* Catégorie */}
          <div>
            <label style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '14px', 
              color: '#6b7280', 
              marginBottom: '4px'
            }}>
              {flightType?.category === 'local' ? <Home size={16} /> : <Navigation2 size={16} />}
              Catégorie
            </label>
            <select
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px',
                backgroundColor: 'white'
              }}
              value={flightType?.category || 'navigation'}
              onChange={(e) => setFlightType({...flightType, category: e.target.value})}
            >
              <option value="local">Vol Local</option>
              <option value="navigation">Navigation</option>
            </select>
          </div>
        </div>

        {/* Réglementation applicable */}
        <div style={{ 
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#fbbf24',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ 
            flexShrink: 0,
            width: '40px',
            height: '40px',
            backgroundColor: '#f59e0b',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '20px' }}>📋</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ 
              margin: '0',
              fontSize: '14px',
              fontWeight: '600',
              color: '#78350f'
            }}>
              Réserve réglementaire : {navigationResults?.regulationReserveMinutes || 0} minutes
            </p>
            <p style={{ 
              margin: '4px 0 0 0',
              fontSize: '13px',
              color: '#92400e'
            }}>
              {flightType?.period === 'nuit' 
                ? 'Vol de NUIT : 45 minutes de réserve' 
                : flightType?.category === 'local' 
                  ? 'Vol LOCAL de JOUR : 10 minutes de réserve'
                  : 'Vol de NAVIGATION de JOUR : 30 minutes de réserve'
              }
            </p>
            {selectedAircraft && (
              <p style={{ 
                margin: '4px 0 0 0',
                fontSize: '13px',
                color: '#92400e',
                fontWeight: '600'
              }}>
                Volume carburant requis : {navigationResults?.regulationReserveLiters || 0} L 
                <span style={{ fontWeight: '400', fontSize: '12px' }}>
                  {' '}(basé sur {selectedAircraft.fuelConsumption} L/h)
                </span>
              </p>
            )}
            {flightType?.rules === 'IFR' && (
              <p style={{ 
                margin: '4px 0 0 0',
                fontSize: '12px',
                color: '#78350f',
                fontStyle: 'italic'
              }}>
                ⚠️ Vol IFR : +15 minutes supplémentaires ajoutées à la réserve de base
              </p>
            )}
            {/* ✅ NOUVELLE NOTE EXPLICATIVE */}
            <p style={{ 
              margin: '8px 0 0 0',
              fontSize: '12px',
              color: '#065f46',
              fontWeight: '600',
              backgroundColor: '#d1fae5',
              padding: '4px 8px',
              borderRadius: '4px',
              display: 'inline-block'
            }}>
              💡 Cette réserve sera automatiquement ajoutée dans l'onglet "Bilan Carburant"
            </p>
          </div>
        </div>
      </div>

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
                  {wp.lat && wp.lon && (
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      fontSize: '11px', 
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <CheckCircle size={12} />
                      {wp.lat.toFixed(4)}°, {wp.lon.toFixed(4)}°
                      <span style={{ color: '#6b7280', marginLeft: '4px' }}>
                        (depuis VAC)
                      </span>
                    </p>
                  )}
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

          {/* 🔧 RÉSULTATS SIMPLIFIÉS - Plus de calcul de réserve */}
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
            <div style={{ marginBottom: '12px', fontSize: '14px', color: '#6b7280' }}>
              Vol {flightType?.rules || 'VFR'} de {flightType?.category || 'navigation'} - {flightType?.period || 'jour'}
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
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
                <p style={{ margin: '0', color: '#6b7280' }}>Trip Fuel</p>
                <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold', color: '#059669' }}>
                  {navigationResults.fuelRequired} L
                </p>
              </div>
            </div>
            {/* ✅ NOUVELLE NOTE EXPLICATIVE */}
            <div style={{ 
              marginTop: '12px',
              padding: '8px',
              backgroundColor: '#d1fae5',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#047857'
            }}>
              <p style={{ margin: '0', fontWeight: '600' }}>
                🚀 Automatisation activée
              </p>
              <p style={{ margin: '4px 0 0 0' }}>
                Le <strong>Trip Fuel</strong> ({navigationResults.fuelRequired} L) sera automatiquement reporté dans l'onglet "Bilan Carburant".
                La réserve réglementaire ({navigationResults.regulationReserveLiters || 0} L) sera ajoutée dans la "Final Reserve".
              </p>
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

      {/* Section Performances de décollage et atterrissage */}
      <PerformanceCalculator />

      {/* Carte de la route */}
      <RouteMap waypoints={waypoints} />
    </div>
  );
};