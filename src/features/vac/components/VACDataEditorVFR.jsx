// Composant pour l'édition des points VFR depuis les données AIXM
import React from 'react';
import { Plus, Trash2, MapPin, Navigation } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

export const VFREditor = ({ editedData, updateValue }) => {
  console.log('🗺️ Rendering VFR editor - points:', editedData.vfrPoints);
  
  const addVFRPoint = () => {
    const newPoint = {
      name: '',
      type: 'N', // N, S, E, W, SE, SW, NE, NW ou autres
      coordinates: { lat: 0, lon: 0 },
      altitude: 0,
      mandatory: false,
      description: '',
      distance: 0, // Distance from airport
      bearing: 0 // Bearing from airport
    };
    
    const currentPoints = editedData.vfrPoints || [];
    updateValue('vfrPoints', [...currentPoints, newPoint]);
  };
  
  const removeVFRPoint = (index) => {
    const newPoints = editedData.vfrPoints.filter((_, i) => i !== index);
    updateValue('vfrPoints', newPoints);
  };
  
  const updatePointField = (index, field, value) => {
    const newPoints = [...(editedData.vfrPoints || [])];
    newPoints[index] = { ...newPoints[index], [field]: value };
    updateValue('vfrPoints', newPoints);
  };
  
  const updateNestedField = (index, path, value) => {
    const newPoints = [...(editedData.vfrPoints || [])];
    const keys = path.split('.');
    let obj = newPoints[index];
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    
    obj[keys[keys.length - 1]] = value;
    updateValue('vfrPoints', newPoints);
  };
  
  // Types de points VFR communs
  const vfrPointTypes = [
    { value: 'N', label: 'Nord (N)' },
    { value: 'S', label: 'Sud (S)' },
    { value: 'E', label: 'Est (E)' },
    { value: 'W', label: 'Ouest (W)' },
    { value: 'NE', label: 'Nord-Est (NE)' },
    { value: 'NW', label: 'Nord-Ouest (NW)' },
    { value: 'SE', label: 'Sud-Est (SE)' },
    { value: 'SW', label: 'Sud-Ouest (SW)' },
    { value: 'ENTRY', label: 'Point d\'entrée' },
    { value: 'EXIT', label: 'Point de sortie' },
    { value: 'HOLD', label: 'Point d\'attente' },
    { value: 'REPORT', label: 'Point de report' },
    { value: 'OTHER', label: 'Autre' }
  ];
  
  return (
    <div>
      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h5 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0369a1' }}>
            Points de report VFR
            {(!editedData.vfrPoints || editedData.vfrPoints.length === 0) && (
              <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'normal', marginLeft: '12px' }}>
                ⚠️ Aucun point VFR défini
              </span>
            )}
          </h5>
          <button
            onClick={addVFRPoint}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={14} /> Ajouter un point VFR
          </button>
        </div>
        
        {editedData.vfrPoints && editedData.vfrPoints.length > 0 ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {editedData.vfrPoints.map((point, idx) => (
              <div key={idx} style={{ 
                padding: '16px', 
                backgroundColor: 'white', 
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                {/* En-tête du point */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={18} style={{ color: '#3b82f6' }} />
                    <h6 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1f2937' }}>
                      {point.name || `Point VFR #${idx + 1}`}
                    </h6>
                    {point.type && (
                      <span style={{ 
                        fontSize: '12px', 
                        padding: '2px 6px', 
                        backgroundColor: '#dbeafe', 
                        color: '#1e40af',
                        borderRadius: '3px',
                        fontWeight: 'bold'
                      }}>
                        {point.type}
                      </span>
                    )}
                    {point.mandatory && (
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '2px 6px', 
                        backgroundColor: '#fee2e2', 
                        color: '#991b1b',
                        borderRadius: '3px'
                      }}>
                        OBLIGATOIRE
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeVFRPoint(idx)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                {/* Identification */}
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                    Identification
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Nom du point
                      </label>
                      <input
                        type="text"
                        value={point.name || ''}
                        onChange={(e) => updatePointField(idx, 'name', e.target.value.toUpperCase())}
                        placeholder="POINT NORD"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Type
                      </label>
                      <select
                        value={point.type || 'OTHER'}
                        onChange={(e) => updatePointField(idx, 'type', e.target.value)}
                        style={sx.components.input.base}
                      >
                        {vfrPointTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Point obligatoire
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', height: '32px' }}>
                        <input
                          type="checkbox"
                          checked={point.mandatory || false}
                          onChange={(e) => updatePointField(idx, 'mandatory', e.target.checked)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ marginLeft: '8px', fontSize: '13px', color: '#6b7280' }}>
                          {point.mandatory ? 'Oui' : 'Non'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Position et altitude */}
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                    Position et altitude
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Latitude
                      </label>
                      <input
                        type="number"
                        value={point.coordinates?.lat || 0}
                        onChange={(e) => updateNestedField(idx, 'coordinates.lat', parseFloat(e.target.value) || 0)}
                        step="0.000001"
                        placeholder="48.583611"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Longitude
                      </label>
                      <input
                        type="number"
                        value={point.coordinates?.lon || 0}
                        onChange={(e) => updateNestedField(idx, 'coordinates.lon', parseFloat(e.target.value) || 0)}
                        step="0.000001"
                        placeholder="7.628056"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Altitude (ft)
                      </label>
                      <input
                        type="number"
                        value={point.altitude || 0}
                        onChange={(e) => updatePointField(idx, 'altitude', parseInt(e.target.value) || 0)}
                        placeholder="1500"
                        style={sx.components.input.base}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Position relative à l'aérodrome */}
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                    Position relative à l'aérodrome
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Distance (NM)
                      </label>
                      <input
                        type="number"
                        value={point.distance || 0}
                        onChange={(e) => updatePointField(idx, 'distance', parseFloat(e.target.value) || 0)}
                        step="0.1"
                        placeholder="5.0"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Relèvement (°)
                      </label>
                      <input
                        type="number"
                        value={point.bearing || 0}
                        onChange={(e) => updatePointField(idx, 'bearing', parseInt(e.target.value) || 0)}
                        min="0"
                        max="360"
                        placeholder="090"
                        style={sx.components.input.base}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Description */}
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    Description / Remarques
                  </label>
                  <textarea
                    value={point.description || ''}
                    onChange={(e) => updatePointField(idx, 'description', e.target.value)}
                    placeholder="Description du point de report, repères visuels, consignes particulières..."
                    rows="3"
                    style={{
                      ...sx.components.input.base,
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
            <Navigation size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p>Aucun point VFR défini. Cliquez sur "Ajouter un point VFR" pour commencer.</p>
          </div>
        )}
      </div>
    </div>
  );
};