// Composant pour l'édition des procédures depuis les données AIXM
import React from 'react';
import { Plus, Trash2, PlaneTakeoff, PlaneLanding, Navigation2 } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

export const ProceduresEditor = ({ editedData, updateValue }) => {
  
  
  const addProcedure = (type) => {
    const newProcedure = {
      name: '',
      type: type, // departure ou arrival
      runway: '',
      description: '',
      minAltitude: 0,
      maxAltitude: 0,
      waypoints: [],
      restrictions: '',
      notes: ''
    };
    
    const currentProcedures = editedData.procedures || { departure: [], arrival: [] };
    const updatedProcedures = {
      ...currentProcedures,
      [type]: [...(currentProcedures[type] || []), newProcedure]
    };
    updateValue('procedures', updatedProcedures);
  };
  
  const removeProcedure = (type, index) => {
    const currentProcedures = editedData.procedures || { departure: [], arrival: [] };
    const updatedProcedures = {
      ...currentProcedures,
      [type]: currentProcedures[type].filter((_, i) => i !== index)
    };
    updateValue('procedures', updatedProcedures);
  };
  
  const updateProcedureField = (type, index, field, value) => {
    const currentProcedures = editedData.procedures || { departure: [], arrival: [] };
    const proceduresList = [...(currentProcedures[type] || [])];
    proceduresList[index] = { ...proceduresList[index], [field]: value };
    
    const updatedProcedures = {
      ...currentProcedures,
      [type]: proceduresList
    };
    updateValue('procedures', updatedProcedures);
  };
  
  const addWaypoint = (type, procIndex) => {
    const newWaypoint = {
      name: '',
      coordinates: { lat: 0, lon: 0 },
      altitude: 0,
      speed: null,
      flyover: false
    };
    
    const currentProcedures = editedData.procedures || { departure: [], arrival: [] };
    const proceduresList = [...(currentProcedures[type] || [])];
    const waypoints = proceduresList[procIndex].waypoints || [];
    proceduresList[procIndex] = {
      ...proceduresList[procIndex],
      waypoints: [...waypoints, newWaypoint]
    };
    
    const updatedProcedures = {
      ...currentProcedures,
      [type]: proceduresList
    };
    updateValue('procedures', updatedProcedures);
  };
  
  const removeWaypoint = (type, procIndex, waypointIndex) => {
    const currentProcedures = editedData.procedures || { departure: [], arrival: [] };
    const proceduresList = [...(currentProcedures[type] || [])];
    proceduresList[procIndex] = {
      ...proceduresList[procIndex],
      waypoints: proceduresList[procIndex].waypoints.filter((_, i) => i !== waypointIndex)
    };
    
    const updatedProcedures = {
      ...currentProcedures,
      [type]: proceduresList
    };
    updateValue('procedures', updatedProcedures);
  };
  
  const updateWaypointField = (type, procIndex, waypointIndex, field, value) => {
    const currentProcedures = editedData.procedures || { departure: [], arrival: [] };
    const proceduresList = [...(currentProcedures[type] || [])];
    const waypoints = [...(proceduresList[procIndex].waypoints || [])];
    
    if (field.includes('.')) {
      // Nested field (e.g., coordinates.lat)
      const [parent, child] = field.split('.');
      waypoints[waypointIndex] = {
        ...waypoints[waypointIndex],
        [parent]: {
          ...waypoints[waypointIndex][parent],
          [child]: value
        }
      };
    } else {
      waypoints[waypointIndex] = {
        ...waypoints[waypointIndex],
        [field]: value
      };
    }
    
    proceduresList[procIndex] = {
      ...proceduresList[procIndex],
      waypoints
    };
    
    const updatedProcedures = {
      ...currentProcedures,
      [type]: proceduresList
    };
    updateValue('procedures', updatedProcedures);
  };
  
  const renderProcedureSection = (type) => {
    const procedures = editedData.procedures?.[type] || [];
    const Icon = type === 'departure' ? PlaneTakeoff : PlaneLanding;
    const title = type === 'departure' ? 'Procédures de départ' : "Procédures d'arrivée";
    const color = type === 'departure' ? '#10b981' : '#3b82f6';
    const bgColor = type === 'departure' ? '#f0fdf4' : '#eff6ff';
    
    return (
      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: bgColor, borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h5 style={{ fontSize: '14px', fontWeight: 'bold', color, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon size={18} />
            {title}
            {procedures.length === 0 && (
              <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'normal', marginLeft: '12px' }}>
                ⚠️ Aucune procédure définie
              </span>
            )}
          </h5>
          <button
            onClick={() => addProcedure(type)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              backgroundColor: color,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={14} /> Ajouter
          </button>
        </div>
        
        {procedures.length > 0 ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {procedures.map((procedure, idx) => (
              <div key={idx} style={{ 
                padding: '16px', 
                backgroundColor: 'white', 
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                {/* En-tête de la procédure */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h6 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1f2937' }}>
                      {procedure.name || `Procédure ${type === 'departure' ? 'départ' : 'arrivée'} #${idx + 1}`}
                    </h6>
                    {procedure.runway && (
                      <span style={{ 
                        fontSize: '12px', 
                        padding: '2px 6px', 
                        backgroundColor: '#dbeafe', 
                        color: '#1e40af',
                        borderRadius: '3px'
                      }}>
                        RWY {procedure.runway}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeProcedure(type, idx)}
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
                
                {/* Informations générales */}
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                    Informations générales
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Nom de la procédure
                      </label>
                      <input
                        type="text"
                        value={procedure.name || ''}
                        onChange={(e) => updateProcedureField(type, idx, 'name', e.target.value.toUpperCase())}
                        placeholder={type === 'departure' ? 'RNAV1 NORTH' : 'STAR SOUTH'}
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Piste associée
                      </label>
                      <input
                        type="text"
                        value={procedure.runway || ''}
                        onChange={(e) => updateProcedureField(type, idx, 'runway', e.target.value.toUpperCase())}
                        placeholder="05/23"
                        style={sx.components.input.base}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Altitudes */}
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                    Altitudes
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Altitude minimale (ft)
                      </label>
                      <input
                        type="number"
                        value={procedure.minAltitude || 0}
                        onChange={(e) => updateProcedureField(type, idx, 'minAltitude', parseInt(e.target.value) || 0)}
                        placeholder="1500"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Altitude maximale (ft)
                      </label>
                      <input
                        type="number"
                        value={procedure.maxAltitude || 0}
                        onChange={(e) => updateProcedureField(type, idx, 'maxAltitude', parseInt(e.target.value) || 0)}
                        placeholder="5000"
                        style={sx.components.input.base}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Waypoints */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h6 style={{ fontSize: '13px', fontWeight: 'bold', color: '#4b5563' }}>
                      Points de cheminement
                    </h6>
                    <button
                      onClick={() => addWaypoint(type, idx)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <Plus size={12} /> Waypoint
                    </button>
                  </div>
                  
                  {procedure.waypoints && procedure.waypoints.length > 0 ? (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {procedure.waypoints.map((waypoint, wpIdx) => (
                        <div key={wpIdx} style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', 
                          gap: '8px',
                          padding: '8px',
                          backgroundColor: '#f9fafb',
                          borderRadius: '4px',
                          alignItems: 'center'
                        }}>
                          <input
                            type="text"
                            value={waypoint.name || ''}
                            onChange={(e) => updateWaypointField(type, idx, wpIdx, 'name', e.target.value.toUpperCase())}
                            placeholder="POINT"
                            style={{ ...sx.components.input.base, fontSize: '12px' }}
                          />
                          <input
                            type="number"
                            value={waypoint.coordinates?.lat || 0}
                            onChange={(e) => updateWaypointField(type, idx, wpIdx, 'coordinates.lat', parseFloat(e.target.value) || 0)}
                            placeholder="Lat"
                            step="0.0001"
                            style={{ ...sx.components.input.base, fontSize: '12px' }}
                          />
                          <input
                            type="number"
                            value={waypoint.coordinates?.lon || 0}
                            onChange={(e) => updateWaypointField(type, idx, wpIdx, 'coordinates.lon', parseFloat(e.target.value) || 0)}
                            placeholder="Lon"
                            step="0.0001"
                            style={{ ...sx.components.input.base, fontSize: '12px' }}
                          />
                          <input
                            type="number"
                            value={waypoint.altitude || 0}
                            onChange={(e) => updateWaypointField(type, idx, wpIdx, 'altitude', parseInt(e.target.value) || 0)}
                            placeholder="Alt"
                            style={{ ...sx.components.input.base, fontSize: '12px' }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="checkbox"
                              checked={waypoint.flyover || false}
                              onChange={(e) => updateWaypointField(type, idx, wpIdx, 'flyover', e.target.checked)}
                              style={{ width: '14px', height: '14px' }}
                            />
                            <span style={{ fontSize: '11px', color: '#6b7280' }}>FO</span>
                          </div>
                          <button
                            onClick={() => removeWaypoint(type, idx, wpIdx)}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '11px'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                      Aucun waypoint défini
                    </div>
                  )}
                </div>
                
                {/* Description et restrictions */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    Description de la procédure
                  </label>
                  <textarea
                    value={procedure.description || ''}
                    onChange={(e) => updateProcedureField(type, idx, 'description', e.target.value)}
                    placeholder="Description détaillée de la procédure..."
                    rows="2"
                    style={{
                      ...sx.components.input.base,
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    Restrictions / Notes
                  </label>
                  <input
                    type="text"
                    value={procedure.restrictions || ''}
                    onChange={(e) => updateProcedureField(type, idx, 'restrictions', e.target.value)}
                    placeholder="VFR uniquement, De jour seulement..."
                    style={sx.components.input.base}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
            <Navigation2 size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p>Aucune procédure {type === 'departure' ? 'de départ' : "d'arrivée"} définie.</p>
          </div>
        )}
      </div>

  return (
    <div>
      {renderProcedureSection('departure')}
      {renderProcedureSection('arrival')}
    </div>
