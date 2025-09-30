/**
 * Composant pour gérer les points VFR de manière avancée
 * Permet la réutilisation des points, les circuits fermés, etc.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Plus, Repeat, Home, Navigation2, Trash2, Copy, ArrowRight, RotateCcw } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useNavigation } from '@core/contexts';
import { useCustomVFRStore } from '@core/stores/customVFRStore';

export const VFRPointManager = ({ 
  waypoints = [],
  onAddWaypoint,
  onUpdateWaypoint,
  onInsertWaypoint
}) => {
  const [showPointSelector, setShowPointSelector] = useState(false);
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState(null);
  const [insertMode, setInsertMode] = useState(null); // 'before' | 'after' | null
  
  const { customVFRPoints } = useCustomVFRStore();
  const { addWaypoint, updateWaypoint } = useNavigation();

  // PAS DE POINTS PRÉDÉFINIS - Utilisation exclusive des données SIA/AIXM

  // Récupérer tous les points VFR disponibles - UNIQUEMENT depuis SIA et points personnalisés
  const allVFRPoints = useMemo(() => {
    const points = [];
    
    // Ajouter les points custom créés par l'utilisateur
    customVFRPoints.forEach(p => {
      points.push({
        ...p,
        source: 'custom',
        displayName: `${p.name} (Personnalisé)`
      });
    });
    
    // NOTE: Les points VFR officiels doivent être chargés depuis les fichiers SIA/AIXM
    // via le composant VFRPointInserter qui utilise geoJSONDataService
    
    return points;
  }, [customVFRPoints]);

  // Fonction pour copier le départ comme arrivée
  const copyDepartureToArrival = () => {
    if (waypoints.length >= 2) {
      const departure = waypoints[0];
      const arrival = waypoints[waypoints.length - 1];
      
      if (departure.name && departure.lat && departure.lon) {
        updateWaypoint(arrival.id, {
          name: departure.name,
          lat: departure.lat,
          lon: departure.lon,
          airportName: departure.airportName,
          city: departure.city,
          elevation: departure.elevation
        });
      }
    }
  };

  // Fonction pour ajouter un point VFR au trajet
  const addVFRPointToRoute = (point, position = 'end') => {
    const newWaypoint = {
      id: Date.now(),
      name: point.displayName || point.name,
      lat: point.lat,
      lon: point.lon,
      type: 'vfr-point',
      vfrPointId: point.id,
      description: point.description
    };

    if (position === 'end') {
      // Ajouter avant le dernier waypoint (arrivée)
      const insertIndex = Math.max(0, waypoints.length - 1);
      onInsertWaypoint?.(newWaypoint, insertIndex);
    } else if (typeof position === 'number') {
      // Insérer à une position spécifique
      onInsertWaypoint?.(newWaypoint, position);
    }
    
    setShowPointSelector(false);
    setInsertMode(null);
    setSelectedWaypointIndex(null);
  };

  // Fonction pour créer un circuit fermé
  const createClosedCircuit = () => {
    if (waypoints.length >= 2) {
      const departure = waypoints[0];
      
      // Copier les caractéristiques du départ vers l'arrivée
      copyDepartureToArrival();
      
      // Optionnellement, ajouter un message
      console.log('Circuit fermé créé : retour à', departure.name);
    }
  };

  // Fonction pour insérer un waypoint existant
  const duplicateWaypoint = (waypointIndex) => {
    const wp = waypoints[waypointIndex];
    if (wp) {
      const duplicate = {
        ...wp,
        id: Date.now(),
        name: `${wp.name} (bis)`
      };
      onInsertWaypoint?.(duplicate, waypointIndex + 1);
    }
  };

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(3))}>
      <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
        <Navigation2 size={20} />
        <span style={sx.spacing.ml(2)}>Gestion avancée des points</span>
      </h3>

      {/* Actions rapides */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        {/* Circuit fermé */}
        <button
          onClick={createClosedCircuit}
          disabled={waypoints.length < 2 || !waypoints[0].name}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.secondary,
            {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              opacity: waypoints.length < 2 || !waypoints[0].name ? 0.5 : 1
            }
          )}
          title="Créer un vol avec retour au point de départ"
        >
          <RotateCcw size={16} />
          Circuit fermé
        </button>

        {/* Copier départ vers arrivée */}
        <button
          onClick={copyDepartureToArrival}
          disabled={waypoints.length < 2 || !waypoints[0].name}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.secondary,
            {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              opacity: waypoints.length < 2 || !waypoints[0].name ? 0.5 : 1
            }
          )}
          title="Copier le point de départ comme arrivée"
        >
          <Copy size={16} />
          Départ → Arrivée
        </button>

        {/* Ajouter des points VFR */}
        <button
          onClick={() => setShowPointSelector(!showPointSelector)}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.primary,
            {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px'
            }
          )}
        >
          <Plus size={16} />
          Points VFR
        </button>
      </div>

      {/* Sélecteur de points VFR */}
      {showPointSelector && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Sélectionner un point VFR
          </h4>
          
          {allVFRPoints.length === 0 ? (
            <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
              Aucun point VFR disponible. Ajoutez des aérodromes au trajet ou créez des points personnalisés.
            </p>
          ) : (
            <div style={{ 
              display: 'grid', 
              gap: '8px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {allVFRPoints.map(point => (
                <div
                  key={point.id}
                  style={{
                    padding: '10px',
                    background: 'white',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    ':hover': {
                      borderColor: '#3b82f6',
                      background: '#f0f9ff'
                    }
                  }}
                  onClick={() => addVFRPointToRoute(point)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                        {point.displayName}
                      </p>
                      <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                        {point.description}
                      </p>
                      <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                        📍 {point.lat?.toFixed(4)}°, {point.lon?.toFixed(4)}°
                      </p>
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      background: point.source === 'custom' ? '#fef3c7' : '#dbeafe',
                      color: point.source === 'custom' ? '#92400e' : '#1e40af',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {point.source === 'custom' ? 'Personnalisé' : point.airportIcao}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button
            onClick={() => setShowPointSelector(false)}
            style={sx.combine(
              sx.components.button.base,
              sx.components.button.secondary,
              sx.spacing.mt(3),
              { width: '100%' }
            )}
          >
            Fermer
          </button>
        </div>
      )}

      {/* Liste des waypoints avec options de duplication */}
      <div style={sx.spacing.mt(4)}>
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
          Points du trajet
        </h4>
        <div style={{ display: 'grid', gap: '8px' }}>
          {waypoints.map((wp, index) => (
            <div
              key={wp.id}
              style={{
                padding: '8px 12px',
                background: '#f9fafb',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ flex: 1 }}>
                <span style={sx.combine(sx.text.sm, sx.text.bold)}>
                  {index === 0 ? '🛫 Départ' : index === waypoints.length - 1 ? '🛬 Arrivée' : `📍 WP${index}`}:
                </span>
                <span style={sx.combine(sx.text.sm, sx.spacing.ml(2))}>
                  {wp.name || 'Non défini'}
                </span>
              </div>
              
              {/* Actions pour chaque waypoint */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {/* Dupliquer le waypoint */}
                {wp.name && (
                  <button
                    onClick={() => duplicateWaypoint(index)}
                    style={{
                      padding: '4px',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Dupliquer ce point"
                  >
                    <Repeat size={14} />
                  </button>
                )}
                
                {/* Insérer un point VFR après */}
                {index < waypoints.length - 1 && (
                  <button
                    onClick={() => {
                      setSelectedWaypointIndex(index);
                      setInsertMode('after');
                      setShowPointSelector(true);
                    }}
                    style={{
                      padding: '4px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Insérer un point VFR après"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info sur la possibilité de réutiliser les points */}
      <div style={sx.combine(
        sx.components.alert.base,
        sx.components.alert.info,
        sx.spacing.mt(4)
      )}>
        <p style={sx.text.sm}>
          💡 Les points VFR peuvent être réutilisés plusieurs fois dans votre trajet. 
          Parfait pour les circuits d'entraînement ou les navigations avec retour par le même chemin.
        </p>
      </div>
    </div>
  );
};

VFRPointManager.displayName = 'VFRPointManager';

export default VFRPointManager;