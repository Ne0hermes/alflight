// src/modules/vac/components/VACDataValidator.jsx
import React, { useState } from 'react';
import { useVACStore } from '../store/vacStore';
import { Check, X, AlertCircle, Save, Eye } from 'lucide-react';

export const VACDataValidator = ({ chart, onClose }) => {
  const { updateExtractedData, validateExtractedData } = useVACStore();
  const [editedData, setEditedData] = useState(chart.extractedData || {});
  const [showPreview, setShowPreview] = useState(false);

  const handleFieldChange = (section, index, field, value) => {
    setEditedData(prev => {
      const newData = { ...prev };
      if (Array.isArray(newData[section])) {
        newData[section] = [...newData[section]];
        newData[section][index] = {
          ...newData[section][index],
          [field]: value
        };
      } else if (typeof newData[section] === 'object') {
        newData[section] = {
          ...newData[section],
          [field]: value
        };
      } else {
        newData[section] = value;
      }
      return newData;
    });
  };

  const handleSave = () => {
    updateExtractedData(chart.id, editedData);
    onClose();
  };

  const sectionStyle = {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  };

  const headerStyle = {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const fieldStyle = {
    marginBottom: '12px'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '4px'
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Formulaire de validation */}
      <div style={{ 
        flex: 1, 
        padding: '24px',
        overflow: 'auto',
        backgroundColor: 'white'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>
            Validation des données - {chart.airportIcao}
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Section Pistes */}
        <div style={sectionStyle}>
          <h3 style={headerStyle}>
            <span>🛬</span> Pistes
          </h3>
          {editedData.runways?.map((runway, index) => (
            <div key={index} style={{ 
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '6px',
              marginBottom: '8px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Identifiant</label>
                  <input
                    type="text"
                    value={runway.identifier || ''}
                    onChange={(e) => handleFieldChange('runways', index, 'identifier', e.target.value)}
                    style={inputStyle}
                    pattern="[0-9]{2}[LCR]?"
                    placeholder="09L"
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>QFU (°)</label>
                  <input
                    type="number"
                    value={runway.qfu || ''}
                    onChange={(e) => handleFieldChange('runways', index, 'qfu', parseInt(e.target.value))}
                    style={inputStyle}
                    min="1"
                    max="360"
                    placeholder="090"
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Longueur (m)</label>
                  <input
                    type="number"
                    value={runway.length || ''}
                    onChange={(e) => handleFieldChange('runways', index, 'length', parseInt(e.target.value))}
                    style={inputStyle}
                    placeholder="2700"
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Largeur (m)</label>
                  <input
                    type="number"
                    value={runway.width || ''}
                    onChange={(e) => handleFieldChange('runways', index, 'width', parseInt(e.target.value))}
                    style={inputStyle}
                    placeholder="45"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => handleFieldChange('runways', editedData.runways?.length || 0, null, {
              identifier: '',
              qfu: 0,
              length: 0,
              width: 0,
              surface: 'ASPH'
            })}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            + Ajouter une piste
          </button>
        </div>

        {/* Section Fréquences */}
        <div style={sectionStyle}>
          <h3 style={headerStyle}>
            <span>📻</span> Fréquences
          </h3>
          {editedData.frequencies?.map((freq, index) => (
            <div key={index} style={{ 
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '6px',
              marginBottom: '8px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Type</label>
                  <select
                    value={freq.type || 'INFO'}
                    onChange={(e) => handleFieldChange('frequencies', index, 'type', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="TWR">Tour (TWR)</option>
                    <option value="GND">Sol (GND)</option>
                    <option value="ATIS">ATIS</option>
                    <option value="APP">Approche (APP)</option>
                    <option value="INFO">Info</option>
                  </select>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Fréquence</label>
                  <input
                    type="text"
                    value={freq.frequency || ''}
                    onChange={(e) => handleFieldChange('frequencies', index, 'frequency', e.target.value)}
                    style={inputStyle}
                    pattern="1[0-3][0-9]\.[0-9]{1,3}"
                    placeholder="118.750"
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Horaires</label>
                  <input
                    type="text"
                    value={freq.hours || ''}
                    onChange={(e) => handleFieldChange('frequencies', index, 'hours', e.target.value)}
                    style={inputStyle}
                    placeholder="H24"
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Téléphone</label>
                  <input
                    type="tel"
                    value={freq.phone || ''}
                    onChange={(e) => handleFieldChange('frequencies', index, 'phone', e.target.value)}
                    style={inputStyle}
                    placeholder="+33123456789"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => handleFieldChange('frequencies', editedData.frequencies?.length || 0, null, {
              type: 'INFO',
              frequency: '',
              hours: '',
              phone: ''
            })}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            + Ajouter une fréquence
          </button>
        </div>

        {/* Section ILS */}
        {editedData.ils && editedData.ils.length > 0 && (
          <div style={sectionStyle}>
            <h3 style={headerStyle}>
              <span>📡</span> ILS
            </h3>
            {editedData.ils.map((ils, index) => (
              <div key={index} style={{ 
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '6px',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Piste</label>
                    <input
                      type="text"
                      value={ils.runway || ''}
                      onChange={(e) => handleFieldChange('ils', index, 'runway', e.target.value)}
                      style={inputStyle}
                      placeholder="09L"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Fréquence</label>
                    <input
                      type="text"
                      value={ils.frequency || ''}
                      onChange={(e) => handleFieldChange('ils', index, 'frequency', e.target.value)}
                      style={inputStyle}
                      placeholder="110.30"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Identifiant</label>
                    <input
                      type="text"
                      value={ils.identifier || ''}
                      onChange={(e) => handleFieldChange('ils', index, 'identifier', e.target.value)}
                      style={inputStyle}
                      placeholder="CDG"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Catégorie</label>
                    <select
                      value={ils.category || 'I'}
                      onChange={(e) => handleFieldChange('ils', index, 'category', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="I">CAT I</option>
                      <option value="II">CAT II</option>
                      <option value="III">CAT III</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section Altitude de circuit */}
        <div style={sectionStyle}>
          <h3 style={headerStyle}>
            <span>✈️</span> Paramètres de vol
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Altitude de circuit (ft)</label>
              <input
                type="number"
                value={editedData.patternAltitude || ''}
                onChange={(e) => setEditedData(prev => ({
                  ...prev,
                  patternAltitude: parseInt(e.target.value)
                }))}
                style={inputStyle}
                placeholder="1000"
              />
            </div>
            {editedData.minima && (
              <>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Minima Circling (ft)</label>
                  <input
                    type="number"
                    value={editedData.minima.circling || ''}
                    onChange={(e) => handleFieldChange('minima', null, 'circling', parseInt(e.target.value))}
                    style={inputStyle}
                    placeholder="600"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ 
          display: 'flex', 
          gap: '12px',
          position: 'sticky',
          bottom: 0,
          backgroundColor: 'white',
          padding: '16px 0',
          borderTop: '1px solid #e5e7eb',
          marginTop: '24px'
        }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Save size={20} />
            Enregistrer les modifications
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Eye size={20} />
            Aperçu
          </button>
        </div>
      </div>

      {/* Aperçu des données */}
      {showPreview && (
        <div style={{
          width: '400px',
          borderLeft: '1px solid #e5e7eb',
          padding: '24px',
          backgroundColor: '#f9fafb',
          overflow: 'auto'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            Aperçu des données validées
          </h3>
          <pre style={{
            backgroundColor: 'white',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '12px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap'
          }}>
            {JSON.stringify(editedData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};