/**
 * Formulaire pour créer/éditer un point VFR personnalisé
 */

import React, { useState, useEffect } from 'react';
import { X, Save, MapPin } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { SimpleAirportSelector } from './SimpleAirportSelector';

export const CustomVFRPointForm = ({ 
  position, // [lat, lon]
  existingPoint = null,
  onSave,
  onCancel 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    aerodrome: '',
    altitude: '',
    ...existingPoint
  });

  // État séparé pour l'aérodrome sélectionné (objet complet)
  const [selectedAerodrome, setSelectedAerodrome] = useState(null);

  // Initialiser selectedAerodrome si existingPoint a un aérodrome
  useEffect(() => {
    if (existingPoint?.aerodrome) {
      // Si c'est déjà un objet avec icao, on le garde
      if (typeof existingPoint.aerodrome === 'object' && existingPoint.aerodrome.icao) {
        setSelectedAerodrome(existingPoint.aerodrome);
      } else if (typeof existingPoint.aerodrome === 'string') {
        // Sinon c'est juste le code ICAO en string
        setSelectedAerodrome({
          icao: existingPoint.aerodrome,
          name: `Aéroport ${existingPoint.aerodrome}`
        });
      }
    }
  }, [existingPoint]);

  useEffect(() => {
    if (existingPoint) {
      setFormData(existingPoint);
    }
  }, [existingPoint]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Le nom du point est obligatoire');
      return;
    }

    const pointData = {
      ...formData,
      lat: position ? position[0] : existingPoint?.lat,
      lon: position ? position[1] : existingPoint?.lon,
      // Sauvegarder le code ICAO de l'aérodrome si sélectionné
      aerodrome: selectedAerodrome ? selectedAerodrome.icao : formData.aerodrome
    };

    onSave(pointData);
  };

  const formatCoordinates = () => {
    const lat = position ? position[0] : existingPoint?.lat;
    const lon = position ? position[1] : existingPoint?.lon;
    
    if (!lat || !lon) return 'N/A';
    
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    
    const formatDMS = (decimal, isLat) => {
      const abs = Math.abs(decimal);
      const degrees = Math.floor(abs);
      const minutes = Math.floor((abs - degrees) * 60);
      const seconds = Math.round(((abs - degrees) * 60 - minutes) * 60);
      
      return `${degrees}°${String(minutes).padStart(2, '0')}'${String(seconds).padStart(2, '0')}"`;
    };
    
    return `${formatDMS(lat, true)}${latDir} ${formatDMS(lon, false)}${lonDir}`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      padding: '24px',
      zIndex: 10000,
      minWidth: '400px',
      maxWidth: '500px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={20} />
          {existingPoint ? 'Modifier' : 'Créer'} un point VFR personnalisé
        </h3>
        <button
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={sx.combine(sx.text.sm, sx.text.secondary)}>
            Coordonnées
          </label>
          <div style={{
            padding: '8px 12px',
            background: '#f3f4f6',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '14px'
          }}>
            {formatCoordinates()}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={sx.combine(sx.text.sm, sx.text.secondary)}>
            Nom du point *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Point Echo, Château d'eau, Autoroute A35..."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            required
            autoFocus
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={sx.combine(sx.text.sm, sx.text.secondary)}>
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Description du point, repères visuels..."
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <SimpleAirportSelector
              label="Aérodrome associé (optionnel)"
              value={selectedAerodrome}
              onChange={setSelectedAerodrome}
              placeholder="Code OACI ou nom..."
            />
          </div>
          
          <div style={{ flex: 1 }}>
            <label style={sx.combine(sx.text.sm, sx.text.secondary)}>
              Altitude recommandée
            </label>
            <input
              type="text"
              value={formData.altitude}
              onChange={(e) => setFormData({ ...formData, altitude: e.target.value })}
              placeholder="1500 ft"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '12px',
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px 20px',
              background: '#f3f4f6',
              color: '#4b5563',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Annuler
          </button>
          <button
            type="submit"
            style={{
              flex: 1,
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Save size={16} />
            {existingPoint ? 'Mettre à jour' : 'Sauvegarder'}
          </button>
        </div>
      </form>
    </div>
