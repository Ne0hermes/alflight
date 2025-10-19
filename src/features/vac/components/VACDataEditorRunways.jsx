// Composant pour l'édition des pistes depuis les données AIXM
import React from 'react';
import { Plus, Trash2, Info, Plane } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

export const RunwaysEditor = ({ editedData, updateValue }) => {
  
  
  const addRunway = () => {
    const newRunway = {
      identifier: '',
      designation: '',
      length: 0,
      width: 0,
      surface: 'ASPH',
      qfu: 0,
      magneticBearing: 0,
      trueBearing: 0,
      tora: 0,
      toda: 0,
      asda: 0,
      lda: 0,
      threshold: { lat: 0, lon: 0 },
      pcn: '',
      ils: null,
      vasis: null
    };
    
    const currentRunways = editedData.runways || [];
    updateValue('runways', [...currentRunways, newRunway]);
  };
  
  const removeRunway = (index) => {
    const newRunways = editedData.runways.filter((_, i) => i !== index);
    updateValue('runways', newRunways);
  };
  
  const updateRunwayField = (index, field, value) => {
    const newRunways = [...(editedData.runways || [])];
    newRunways[index] = { ...newRunways[index], [field]: value };
    updateValue('runways', newRunways);
  };
  
  const updateNestedField = (index, path, value) => {
    const newRunways = [...(editedData.runways || [])];
    const keys = path.split('.');
    let obj = newRunways[index];
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    
    obj[keys[keys.length - 1]] = value;
    updateValue('runways', newRunways);
  };
  
  return (
    <div>
      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h5 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0369a1' }}>
            Caractéristiques des pistes
            {(!editedData.runways || editedData.runways.length === 0) && (
              <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'normal', marginLeft: '12px' }}>
                ⚠️ Aucune piste définie
              </span>
            )}
          </h5>
          <button
            onClick={addRunway}
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
            <Plus size={14} /> Ajouter une piste
          </button>
        </div>
        
        {editedData.runways && editedData.runways.length > 0 ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {editedData.runways.map((runway, idx) => (
              <div key={idx} style={{ 
                padding: '16px', 
                backgroundColor: 'white', 
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                {/* En-tête de la piste */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plane size={18} style={{ color: '#3b82f6' }} />
                    <h6 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1f2937' }}>
                      Piste {runway.identifier || runway.designation || `#${idx + 1}`}
                    </h6>
                    {runway.magneticBearing > 0 && (
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>
                        (QFU {runway.magneticBearing}°)
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeRunway(idx)}
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
                
                {/* Identification et orientation */}
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                    Identification et orientation
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Désignation
                      </label>
                      <input
                        type="text"
                        value={runway.designation || runway.identifier || ''}
                        onChange={(e) => updateRunwayField(idx, 'designation', e.target.value.toUpperCase())}
                        placeholder="05/23"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        QFU Magnétique
                      </label>
                      <input
                        type="number"
                        value={runway.magneticBearing || runway.qfu || 0}
                        onChange={(e) => updateRunwayField(idx, 'magneticBearing', parseFloat(e.target.value) || 0)}
                        placeholder="046"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        QFU Vrai
                      </label>
                      <input
                        type="number"
                        value={runway.trueBearing || 0}
                        onChange={(e) => updateRunwayField(idx, 'trueBearing', parseFloat(e.target.value) || 0)}
                        placeholder="048.68"
                        step="0.01"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        PCN
                      </label>
                      <input
                        type="text"
                        value={runway.pcn || ''}
                        onChange={(e) => updateRunwayField(idx, 'pcn', e.target.value)}
                        placeholder="76 F/C/W/T"
                        style={sx.components.input.base}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Dimensions */}
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                    Dimensions et surface
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Longueur (m)
                      </label>
                      <input
                        type="number"
                        value={runway.length || 0}
                        onChange={(e) => updateRunwayField(idx, 'length', parseInt(e.target.value) || 0)}
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Largeur (m)
                      </label>
                      <input
                        type="number"
                        value={runway.width || 0}
                        onChange={(e) => updateRunwayField(idx, 'width', parseInt(e.target.value) || 0)}
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        Surface
                      </label>
                      <input
                        type="text"
                        value={runway.surface || ''}
                        onChange={(e) => updateRunwayField(idx, 'surface', e.target.value)}
                        placeholder="CONC+ASPH"
                        style={sx.components.input.base}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Distances déclarées */}
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                    Distances déclarées (m)
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        TORA
                      </label>
                      <input
                        type="number"
                        value={runway.tora || runway.length || 0}
                        onChange={(e) => updateRunwayField(idx, 'tora', parseInt(e.target.value) || 0)}
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        TODA
                      </label>
                      <input
                        type="number"
                        value={runway.toda || runway.length || 0}
                        onChange={(e) => updateRunwayField(idx, 'toda', parseInt(e.target.value) || 0)}
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        ASDA
                      </label>
                      <input
                        type="number"
                        value={runway.asda || runway.length || 0}
                        onChange={(e) => updateRunwayField(idx, 'asda', parseInt(e.target.value) || 0)}
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        LDA
                      </label>
                      <input
                        type="number"
                        value={runway.lda || runway.length || 0}
                        onChange={(e) => updateRunwayField(idx, 'lda', parseInt(e.target.value) || 0)}
                        style={sx.components.input.base}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Aides visuelles et ILS */}
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                    Aides à l'approche
                  </h6>
                  
                  {/* VASIS/PAPI */}
                  {runway.vasis && (
                    <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                            Type VASIS
                          </label>
                          <input
                            type="text"
                            value={runway.vasis?.type || ''}
                            onChange={(e) => updateNestedField(idx, 'vasis.type', e.target.value)}
                            placeholder="PAPI"
                            style={sx.components.input.base}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                            Angle (°)
                          </label>
                          <input
                            type="number"
                            value={runway.vasis?.angle || 0}
                            onChange={(e) => updateNestedField(idx, 'vasis.angle', parseFloat(e.target.value) || 0)}
                            step="0.1"
                            style={sx.components.input.base}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                            MEHT (ft)
                          </label>
                          <input
                            type="number"
                            value={runway.vasis?.meht || 0}
                            onChange={(e) => updateNestedField(idx, 'vasis.meht', parseInt(e.target.value) || 0)}
                            style={sx.components.input.base}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* ILS */}
                  {runway.ils && (
                    <div style={{ padding: '8px', backgroundColor: '#f0fdf4', borderRadius: '4px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                            ILS Cat.
                          </label>
                          <input
                            type="text"
                            value={runway.ils?.category || ''}
                            onChange={(e) => updateNestedField(idx, 'ils.category', e.target.value)}
                            placeholder="I"
                            style={sx.components.input.base}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                            Fréquence
                          </label>
                          <input
                            type="number"
                            value={runway.ils?.frequency || 0}
                            onChange={(e) => updateNestedField(idx, 'ils.frequency', parseFloat(e.target.value) || 0)}
                            step="0.01"
                            placeholder="110.30"
                            style={sx.components.input.base}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                            Indicatif
                          </label>
                          <input
                            type="text"
                            value={runway.ils?.identifier || ''}
                            onChange={(e) => updateNestedField(idx, 'ils.identifier', e.target.value.toUpperCase())}
                            placeholder="PGS"
                            maxLength="4"
                            style={sx.components.input.base}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                            GP Slope (°)
                          </label>
                          <input
                            type="number"
                            value={runway.ils?.glidePath?.slope || 0}
                            onChange={(e) => updateNestedField(idx, 'ils.glidePath.slope', parseFloat(e.target.value) || 0)}
                            step="0.1"
                            placeholder="3.0"
                            style={sx.components.input.base}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Boutons pour ajouter VASIS ou ILS s'ils n'existent pas */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    {!runway.vasis && (
                      <button
                        onClick={() => updateRunwayField(idx, 'vasis', { type: 'PAPI', angle: 3.0, meht: 50 })}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        + Ajouter VASIS/PAPI
                      </button>
                    )}
                    {!runway.ils && (
                      <button
                        onClick={() => updateRunwayField(idx, 'ils', { 
                          category: 'I', 
                          frequency: 0, 
                          identifier: '',
                          glidePath: { slope: 3.0, frequency: 0, rdh: 50 }
                        })}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        + Ajouter ILS
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Coordonnées du seuil */}
                {runway.threshold && (
                  <div>
                    <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>
                      Coordonnées du seuil
                    </h6>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                          Latitude
                        </label>
                        <input
                          type="number"
                          value={runway.threshold?.lat || 0}
                          onChange={(e) => updateNestedField(idx, 'threshold.lat', parseFloat(e.target.value) || 0)}
                          step="0.000001"
                          style={sx.components.input.base}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                          Longitude
                        </label>
                        <input
                          type="number"
                          value={runway.threshold?.lon || 0}
                          onChange={(e) => updateNestedField(idx, 'threshold.lon', parseFloat(e.target.value) || 0)}
                          step="0.000001"
                          style={sx.components.input.base}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
            <Info size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p>Aucune piste définie. Cliquez sur "Ajouter une piste" pour commencer.</p>
          </div>
        )}
      </div>
    </div>
