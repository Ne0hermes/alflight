// Composant pour l'édition des obstacles depuis les données AIXM
import React from 'react';
import { Plus, Trash2, AlertTriangle, Radio } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

export const ObstaclesEditor = ({ editedData, updateValue }) => {
  
  
  const addObstacle = () => {
    const newObstacle = {
      type: 'TOWER', // TOWER, MAST, BUILDING, ANTENNA, CRANE, WINDTURBINE, etc.
      name: '',
      height: 0,
      elevation: 0,
      totalHeight: 0, // height + elevation
      coordinates: { lat: 0, lon: 0 },
      lighting: 'NONE', // NONE, LOW, MEDIUM, HIGH, STROBE
      markings: false,
      distance: 0, // Distance from airport
      bearing: 0, // Bearing from airport
      description: ''
    };
    
    const currentObstacles = editedData.obstacles || [];
    updateValue('obstacles', [...currentObstacles, newObstacle]);
  };
  
  const removeObstacle = (index) => {
    const newObstacles = editedData.obstacles.filter((_, i) => i !== index);
    updateValue('obstacles', newObstacles);
  };
  
  const updateObstacleField = (index, field, value) => {
    const newObstacles = [...(editedData.obstacles || [])];
    
    // Si on modifie height ou elevation, recalculer totalHeight
    if (field === 'height' || field === 'elevation') {
      const height = field === 'height' ? value : newObstacles[index].height || 0;
      const elevation = field === 'elevation' ? value : newObstacles[index].elevation || 0;
      newObstacles[index] = { 
        ...newObstacles[index], 
        [field]: value,
        totalHeight: height + elevation
      };
    } else {
      newObstacles[index] = { ...newObstacles[index], [field]: value };
    }
    
    updateValue('obstacles', newObstacles);
  };
  
  const updateNestedField = (index, path, value) => {
    const newObstacles = [...(editedData.obstacles || [])];
    const keys = path.split('.');
    let obj = newObstacles[index];
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    
    obj[keys[keys.length - 1]] = value;
    updateValue('obstacles', newObstacles);
  };
  
  // Types d'obstacles
  const obstacleTypes = [
    { value: 'TOWER', label: 'Tour / Pylône' },
    { value: 'MAST', label: 'Mât' },
    { value: 'ANTENNA', label: 'Antenne' },
    { value: 'BUILDING', label: 'Bâtiment' },
    { value: 'CHIMNEY', label: 'Cheminée' },
    { value: 'CRANE', label: 'Grue' },
    { value: 'WINDTURBINE', label: 'Éolienne' },
    { value: 'BRIDGE', label: 'Pont' },
    { value: 'POWERLINE', label: 'Ligne électrique' },
    { value: 'CABLE', label: 'Câble' },
    { value: 'TREE', label: 'Arbre' },
    { value: 'OTHER', label: 'Autre' }
  ];
  
  // Types de balisage lumineux
  const lightingTypes = [
    { value: 'NONE', label: 'Aucun' },
    { value: 'LOW', label: 'Basse intensité' },
    { value: 'MEDIUM', label: 'Moyenne intensité' },
    { value: 'HIGH', label: 'Haute intensité' },
    { value: 'STROBE', label: 'Stroboscopique' },
    { value: 'RED', label: 'Feu rouge fixe' },
    { value: 'WHITE', label: 'Feu blanc' },
    { value: 'DUAL', label: 'Rouge/Blanc' }
  ];
  
  return (
    <div>
      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h5 style={{ fontSize: '14px', fontWeight: 'bold', color: '#991b1b' }}>
            Obstacles remarquables
            {(!editedData.obstacles || editedData.obstacles.length === 0) && (
              <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'normal', marginLeft: '12px' }}>
                ⚠️ Aucun obstacle défini
              </span>
            )}
          </h5>
          <button
            onClick={addObstacle}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={14} /> Ajouter un obstacle
          </button>
        </div>
        
        {editedData.obstacles && editedData.obstacles.length > 0 ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {editedData.obstacles.map((obstacle, idx) => (
              <div key={idx} style={{ 
                padding: '16px', 
                backgroundColor: 'white', 
                borderRadius: '6px',
                border: '1px solid #fca5a5'
              }}>
                {/* En-tête de l'obstacle */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #fecaca'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} style={{ color: '#dc2626' }} />
                    <h6 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1f2937' }}>
                      {obstacle.name || `Obstacle #${idx + 1}`}
                    </h6>
                    {obstacle.type && (
                      <span style={{ 
                        fontSize: '12px', 
                        padding: '2px 6px', 
                        backgroundColor: '#fee2e2', 
                        color: '#991b1b',
                        borderRadius: '3px',
                        fontWeight: 'bold'
                      }}>
                        {obstacle.type}
                      </span>
                    )}
                    {obstacle.totalHeight > 500 && (
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '2px 6px', 
                        backgroundColor: '#dc2626', 
                        color: 'white',
                        borderRadius: '3px',
                        fontWeight: 'bold'
                      }}>
                        {obstacle.totalHeight} ft AMSL
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeObstacle(idx)}
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
                
                {/* Type et identification */}
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                    Type et identification
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Type d'obstacle
                      </label>
                      <select
                        value={obstacle.type || 'OTHER'}
                        onChange={(e) => updateObstacleField(idx, 'type', e.target.value)}
                        style={sx.components.input.base}
                      >
                        {obstacleTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Nom / Description
                      </label>
                      <input
                        type="text"
                        value={obstacle.name || ''}
                        onChange={(e) => updateObstacleField(idx, 'name', e.target.value)}
                        placeholder="Pylône radio, Château d'eau..."
                        style={sx.components.input.base}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Hauteurs */}
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                    Dimensions
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Hauteur structure (ft)
                      </label>
                      <input
                        type="number"
                        value={obstacle.height || 0}
                        onChange={(e) => updateObstacleField(idx, 'height', parseInt(e.target.value) || 0)}
                        placeholder="200"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Élévation sol (ft)
                      </label>
                      <input
                        type="number"
                        value={obstacle.elevation || 0}
                        onChange={(e) => updateObstacleField(idx, 'elevation', parseInt(e.target.value) || 0)}
                        placeholder="500"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Altitude totale (ft AMSL)
                      </label>
                      <input
                        type="number"
                        value={obstacle.totalHeight || 0}
                        disabled
                        style={{
                          ...sx.components.input.base,
                          backgroundColor: '#f3f4f6',
                          cursor: 'not-allowed',
                          fontWeight: 'bold'
                        }}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Position */}
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                    Position géographique
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Latitude
                      </label>
                      <input
                        type="number"
                        value={obstacle.coordinates?.lat || 0}
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
                        value={obstacle.coordinates?.lon || 0}
                        onChange={(e) => updateNestedField(idx, 'coordinates.lon', parseFloat(e.target.value) || 0)}
                        step="0.000001"
                        placeholder="7.628056"
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
                        value={obstacle.distance || 0}
                        onChange={(e) => updateObstacleField(idx, 'distance', parseFloat(e.target.value) || 0)}
                        step="0.1"
                        placeholder="2.5"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Relèvement (°)
                      </label>
                      <input
                        type="number"
                        value={obstacle.bearing || 0}
                        onChange={(e) => updateObstacleField(idx, 'bearing', parseInt(e.target.value) || 0)}
                        min="0"
                        max="360"
                        placeholder="270"
                        style={sx.components.input.base}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Balisage */}
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                    Balisage et signalisation
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Balisage lumineux
                      </label>
                      <select
                        value={obstacle.lighting || 'NONE'}
                        onChange={(e) => updateObstacleField(idx, 'lighting', e.target.value)}
                        style={sx.components.input.base}
                      >
                        {lightingTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Marques diurnes
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', height: '32px' }}>
                        <input
                          type="checkbox"
                          checked={obstacle.markings || false}
                          onChange={(e) => updateObstacleField(idx, 'markings', e.target.checked)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ marginLeft: '8px', fontSize: '13px', color: '#6b7280' }}>
                          {obstacle.markings ? 'Bandes rouges/blanches' : 'Non balisé'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Remarques */}
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    Remarques / Informations complémentaires
                  </label>
                  <textarea
                    value={obstacle.description || ''}
                    onChange={(e) => updateObstacleField(idx, 'description', e.target.value)}
                    placeholder="Informations supplémentaires sur l'obstacle, particularités..."
                    rows="2"
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
            <Radio size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p>Aucun obstacle défini. Cliquez sur "Ajouter un obstacle" pour commencer.</p>
          </div>
        )}
      </div>
    </div>
