// src/features/navigation/components/ManualWaypointControl.jsx
import React, { useState, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, X, Check, Navigation } from 'lucide-react';

const ManualWaypointControl = ({ onAddWaypoint, isActive, setIsActive }) => {
  const map = useMap();
  const [tempMarker, setTempMarker] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [clickPosition, setClickPosition] = useState(null);
  const [waypointData, setWaypointData] = useState({
    name: '',
    altitude: '',
    description: ''
  });

  useEffect(() => {
    if (!map) return;

    // Changer le curseur selon le mode
    if (isActive) {
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.getContainer().style.cursor = '';
    }

    const handleMapClick = (e) => {
      if (!isActive) return;

      const { lat, lng } = e.latlng;
      setClickPosition({ lat, lng });
      
      // Créer un marqueur temporaire
      if (tempMarker) {
        map.removeLayer(tempMarker);
      }

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'manual-waypoint-temp',
          html: `<div style="
            background: #3b82f6;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            position: relative;
            left: -15px;
            top: -15px;
          ">+</div>`,
          iconSize: [30, 30]
        })
      }).addTo(map);

      setTempMarker(marker);
      setShowPopup(true);
      
      // Générer un nom par défaut basé sur les coordonnées
      const defaultName = `WPT${Math.abs(lat).toFixed(0)}${Math.abs(lng).toFixed(0)}`;
      setWaypointData({
        name: defaultName,
        altitude: '',
        description: ''
      });
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
      if (tempMarker) {
        map.removeLayer(tempMarker);
      }
    };
  }, [map, isActive, tempMarker]);

  const handleSubmit = () => {
    if (!clickPosition || !waypointData.name) return;

    // Créer le waypoint avec toutes les données
    const newWaypoint = {
      id: `manual-${Date.now()}`,
      name: waypointData.name,
      lat: clickPosition.lat,
      lon: clickPosition.lng,
      altitude: waypointData.altitude ? parseFloat(waypointData.altitude) : null,
      description: waypointData.description,
      type: 'MANUAL',
      isManual: true,
      coordinates: `${clickPosition.lat.toFixed(6)}°, ${clickPosition.lng.toFixed(6)}°`
    };

    // Ajouter le waypoint
    onAddWaypoint(newWaypoint);

    // Nettoyer
    if (tempMarker) {
      map.removeLayer(tempMarker);
      setTempMarker(null);
    }
    setShowPopup(false);
    setIsActive(false);
    setWaypointData({ name: '', altitude: '', description: '' });
  };

  const handleCancel = () => {
    if (tempMarker) {
      map.removeLayer(tempMarker);
      setTempMarker(null);
    }
    setShowPopup(false);
    setIsActive(false);
    setWaypointData({ name: '', altitude: '', description: '' });
  };

  return (
    <>

      {/* Popup de saisie */}
      {showPopup && clickPosition && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 1000,
          minWidth: '300px'
        }}>
          <div style={{ marginBottom: '15px' }}>
            <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={20} />
              Nouveau Waypoint Manuel
            </h3>
            <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>
              Position: {clickPosition.lat.toFixed(6)}°, {clickPosition.lng.toFixed(6)}°
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
              Nom du waypoint *
            </label>
            <input
              type="text"
              value={waypointData.name}
              onChange={(e) => setWaypointData({ ...waypointData, name: e.target.value })}
              placeholder="Ex: POINT1, WPT001..."
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
              Altitude (ft)
            </label>
            <input
              type="number"
              value={waypointData.altitude}
              onChange={(e) => setWaypointData({ ...waypointData, altitude: e.target.value })}
              placeholder="Ex: 5000"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
              Description
            </label>
            <textarea
              value={waypointData.description}
              onChange={(e) => setWaypointData({ ...waypointData, description: e.target.value })}
              placeholder="Notes optionnelles..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '14px'
              }}
            >
              <X size={16} />
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={!waypointData.name}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                background: waypointData.name ? '#3b82f6' : '#ccc',
                color: 'white',
                cursor: waypointData.name ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '14px'
              }}
            >
              <Check size={16} />
              Ajouter
            </button>
          </div>
        </div>
      )}

      {/* Message d'aide */}
      {isActive && !showPopup && (
        <div style={{
          position: 'absolute',
          top: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#333',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '4px',
          fontSize: '14px',
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          Cliquez sur la carte pour ajouter un waypoint
        </div>
      )}
    </>
  );
};

export default ManualWaypointControl;