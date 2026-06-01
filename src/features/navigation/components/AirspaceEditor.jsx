import React, { useState, useEffect } from 'react';
import { Edit2, Save, X, RefreshCw } from 'lucide-react';

/**
 * Composant pour éditer les propriétés des espaces aériens
 */
const AirspaceEditor = ({ airspace, onSave, onCancel }) => {
  const [editedData, setEditedData] = useState({
    name: '',
    type: '',
    class: '',
    floor_raw: '',
    ceiling_raw: '',
    activity: '',
    schedule: '',
    remarks: ''
  });

  useEffect(() => {
    if (airspace && airspace.properties) {
      setEditedData({
        name: airspace.properties.name || '',
        type: airspace.properties.type || '',
        class: airspace.properties.class || 'G',
        floor_raw: airspace.properties.floor_raw || 'SFC',
        ceiling_raw: airspace.properties.ceiling_raw || '',
        activity: airspace.properties.activity || '',
        schedule: airspace.properties.schedule || '',
        remarks: airspace.properties.remarks || ''
      });
    }
  }, [airspace]);

  const handleSave = () => {
    onSave(airspace.id, editedData);
  };

  const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  
  // Types d'espaces aériens disponibles
  const airspaceTypes = [
    { value: 'CTR', label: 'CTR - Zone de contrôle' },
    { value: 'TMA', label: 'TMA - Région de contrôle terminale' },
    { value: 'CTA', label: 'CTA - Région de contrôle' },
    { value: 'AWY', label: 'AWY - Voie aérienne' },
    { value: 'ATZ', label: 'ATZ - Zone de trafic d\'aérodrome' },
    { value: 'R', label: 'R - Zone réglementée' },
    { value: 'P', label: 'P - Zone interdite' },
    { value: 'D', label: 'D - Zone dangereuse' },
    { value: 'TMZ', label: 'TMZ - Zone à transpondeur obligatoire' },
    { value: 'RMZ', label: 'RMZ - Zone radio obligatoire' },
    { value: 'TSA', label: 'TSA - Zone temporaire' },
    { value: 'TRA', label: 'TRA - Zone réservée temporaire' },
    { value: 'FIR', label: 'FIR - Région d\'information de vol' },
    { value: 'UIR', label: 'UIR - Région supérieure' },
    { value: 'OTHER', label: 'Autre' }
  ];

  if (!airspace) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'var(--bg-overlay)',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      zIndex: 10000,
      minWidth: '400px',
      maxWidth: '600px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '10px',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
          <Edit2 size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
          Éditer l'espace aérien
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

      <div style={{ marginBottom: '15px' }}>
        <label style={{
          display: 'block',
          marginBottom: '5px',
          fontSize: '14px',
          fontWeight: '500',
          color: 'var(--text-secondary)'
        }}>
          Type d'espace aérien
        </label>
        <select
          value={editedData.type}
          onChange={(e) => setEditedData({ ...editedData, type: e.target.value })}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid var(--text-tertiary)',
            borderRadius: '8px',
            fontSize: '14px',
            background: 'var(--bg-overlay)'
          }}
        >
          {airspaceTypes.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{
          display: 'block',
          marginBottom: '5px',
          fontSize: '14px',
          fontWeight: '500',
          color: 'var(--text-secondary)'
        }}>
          Nom
        </label>
        <input
          type="text"
          value={editedData.name}
          onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid var(--text-tertiary)',
            borderRadius: '8px',
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{
          display: 'block',
          marginBottom: '5px',
          fontSize: '14px',
          fontWeight: '500',
          color: 'var(--text-secondary)'
        }}>
          Classe
        </label>
        <select
          value={editedData.class}
          onChange={(e) => setEditedData({ ...editedData, class: e.target.value })}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid var(--text-tertiary)',
            borderRadius: '8px',
            fontSize: '14px',
            background: 'var(--bg-overlay)'
          }}
        >
          {classes.map(cls => (
            <option key={cls} value={cls}>Classe {cls}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '5px',
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--text-secondary)'
          }}>
            Plancher
          </label>
          <input
            type="text"
            value={editedData.floor_raw}
            onChange={(e) => setEditedData({ ...editedData, floor_raw: e.target.value })}
            placeholder="ex: SFC, 1000 ft, FL65"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--text-tertiary)',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '5px',
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--text-secondary)'
          }}>
            Plafond
          </label>
          <input
            type="text"
            value={editedData.ceiling_raw}
            onChange={(e) => setEditedData({ ...editedData, ceiling_raw: e.target.value })}
            placeholder="ex: 1500 ft, FL195"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--text-tertiary)',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '5px',
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--text-secondary)'
          }}>
            Activité
          </label>
          <input
            type="text"
            value={editedData.activity}
            onChange={(e) => setEditedData({ ...editedData, activity: e.target.value })}
            placeholder="ex: MILITARY, GLIDING, H24"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--text-tertiary)',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '5px',
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--text-secondary)'
          }}>
            Horaires
          </label>
          <input
            type="text"
            value={editedData.schedule}
            onChange={(e) => setEditedData({ ...editedData, schedule: e.target.value })}
            placeholder="ex: HO, H24, SR-SS"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--text-tertiary)',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '5px',
          fontSize: '14px',
          fontWeight: '500',
          color: 'var(--text-secondary)'
        }}>
          Remarques
        </label>
        <textarea
          value={editedData.remarks}
          onChange={(e) => setEditedData({ ...editedData, remarks: e.target.value })}
          rows={3}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid var(--text-tertiary)',
            borderRadius: '8px',
            fontSize: '14px',
            resize: 'vertical'
          }}
        />
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
        paddingTop: '10px',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            background: 'var(--bg-overlay)',
            border: '1px solid var(--text-tertiary)',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <X size={16} />
          Annuler
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: '8px 16px',
            background: 'var(--text-secondary)',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Save size={16} />
          Enregistrer
        </button>
      </div>

      {airspace.properties.modified && (
        <div style={{
          marginTop: '10px',
          padding: '8px',
          background: 'rgba(242, 105, 33, 0.10)',
          border: '1px solid var(--accent-primary)',
          borderRadius: '8px',
          fontSize: '12px',
          color: 'var(--accent-primary)'
        }}>
          ⚠️ Cet espace aérien a été modifié localement
        </div>
      )}
      
      {editedData.type !== airspace.properties.type && (
        <div style={{
          marginTop: '10px',
          padding: '8px',
          background: 'var(--bg-overlay)',
          border: '1px solid #818cf8',
          borderRadius: '8px',
          fontSize: '12px',
          color: 'var(--text-primary)'
        }}>
          ℹ️ Type original : <strong>{airspace.properties.type}</strong>
        </div>
      )}
    </div>

};

export default AirspaceEditor;