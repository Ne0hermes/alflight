// src/features/vac/components/VACDataEditor.jsx
import React, { memo, useState, useEffect } from 'react';
import { Save, X, Plus, Trash2, AlertTriangle, Edit2, MapPin, Radio, Plane, Mountain, Shield, FileText, Fuel } from 'lucide-react';
import { useVACStore } from '@core/stores/vacStore';
import { sx } from '@shared/styles/styleSystem';

export const VACDataEditor = memo(({ chart, onClose }) => {
  const { updateExtractedData } = useVACStore(state => ({
    updateExtractedData: state.updateExtractedData
  }));
  
  const [editedData, setEditedData] = useState(null);
  const [hasModifications, setHasModifications] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  // Initialiser les données à l'ouverture
  useEffect(() => {
    if (chart?.extractedData) {
      const clonedData = JSON.parse(JSON.stringify(chart.extractedData));
      // Initialiser toutes les sections si elles n'existent pas
      if (!clonedData.vfrPoints) clonedData.vfrPoints = [];
      if (!clonedData.runways) clonedData.runways = [];
      if (!clonedData.procedures) clonedData.procedures = { departure: [], arrival: [] };
      if (!clonedData.obstacles) clonedData.obstacles = [];
      if (!clonedData.restrictions) clonedData.restrictions = [];
      if (!clonedData.remarks) clonedData.remarks = '';
      if (!clonedData.services) clonedData.services = { fuel: false, maintenance: false, customs: false, handling: false };
      setEditedData(clonedData);
    }
  }, [chart]);
  
  // Mettre à jour une valeur
  const updateValue = (path, value) => {
    const newData = { ...editedData };
    const keys = path.split('.');
    let obj = newData;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]];
    }
    
    obj[keys[keys.length - 1]] = value;
    setEditedData(newData);
    setHasModifications(true);
  };
  
  // Ajouter une nouvelle piste
  const addRunway = () => {
    const newData = { ...editedData };
    if (!newData.runways) newData.runways = [];
    newData.runways.push({
      identifier: '00/00',
      qfu: 0,
      length: 1000,
      width: 30,
      surface: 'Revêtue'
    });
    setEditedData(newData);
    setHasModifications(true);
  };
  
  // Supprimer une piste
  const removeRunway = (index) => {
    const newData = { ...editedData };
    newData.runways.splice(index, 1);
    setEditedData(newData);
    setHasModifications(true);
  };
  
  // Ajouter un point VFR
  const addVFRPoint = () => {
    const newData = { ...editedData };
    newData.vfrPoints.push({
      name: 'Point',
      code: 'XX',
      mandatory: false,
      coordinates: { lat: 0, lon: 0 },
      description: ''
    });
    setEditedData(newData);
    setHasModifications(true);
  };
  
  // Supprimer un point VFR
  const removeVFRPoint = (index) => {
    const newData = { ...editedData };
    newData.vfrPoints.splice(index, 1);
    setEditedData(newData);
    setHasModifications(true);
  };
  
  // Ajouter un obstacle
  const addObstacle = () => {
    const newData = { ...editedData };
    newData.obstacles.push({
      type: 'Antenne',
      height: 0,
      elevation: 0,
      distance: 0,
      bearing: 0,
      lit: true
    });
    setEditedData(newData);
    setHasModifications(true);
  };
  
  // Supprimer un obstacle
  const removeObstacle = (index) => {
    const newData = { ...editedData };
    newData.obstacles.splice(index, 1);
    setEditedData(newData);
    setHasModifications(true);
  };
  
  // Ajouter une procédure
  const addProcedure = (type) => {
    const newData = { ...editedData };
    newData.procedures[type].push({
      name: 'Nouvelle procédure',
      description: '',
      altitude: 0
    });
    setEditedData(newData);
    setHasModifications(true);
  };
  
  // Supprimer une procédure
  const removeProcedure = (type, index) => {
    const newData = { ...editedData };
    newData.procedures[type].splice(index, 1);
    setEditedData(newData);
    setHasModifications(true);
  };
  
  // Sauvegarder les modifications
  const saveData = () => {
    if (editedData && chart?.icao) {
      updateExtractedData(chart.icao, {
        ...editedData,
        manuallyModified: true,
        needsManualExtraction: false,
        modificationDate: Date.now()
      });
      onClose();
    }
  };
  
  if (!editedData) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={sx.combine(
        sx.components.card.base,
        {
          maxWidth: '800px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '24px',
          backgroundColor: 'white'
        }
      )}>
        {/* En-tête */}
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
          <h3 style={sx.combine(sx.text.xl, sx.text.bold)}>
            <Edit2 size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Édition des données - {chart.icao}
          </h3>
          <button
            onClick={onClose}
            style={sx.combine(sx.components.button.base, sx.components.button.danger)}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Alerte pour cartes importées */}
        {editedData.needsManualExtraction && (
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mb(4))}>
            <AlertTriangle size={20} />
            <div>
              <p style={sx.text.sm}>
                <strong>⚠️ Données à compléter</strong>
              </p>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                Cette carte a été importée manuellement. Veuillez saisir les données de la carte VAC.
              </p>
            </div>
          </div>
        )}
        
        {/* Onglets */}
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(2), sx.spacing.mb(4), { borderBottom: '1px solid #e5e7eb' })}>
          {[
            { id: 'general', label: 'Général', icon: Edit2 },
            { id: 'runways', label: 'Pistes', icon: Plane },
            { id: 'frequencies', label: 'Fréquences', icon: Radio },
            { id: 'vfr', label: 'Points VFR', icon: MapPin },
            { id: 'obstacles', label: 'Obstacles', icon: Mountain },
            { id: 'procedures', label: 'Procédures', icon: Shield },
            { id: 'services', label: 'Services', icon: Fuel },
            { id: 'remarks', label: 'Remarques', icon: FileText }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: activeTab === tab.id ? 'bold' : 'normal'
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Contenu des onglets */}
        <div style={{ minHeight: '400px', maxHeight: '500px', overflowY: 'auto' }}>
          {/* Informations générales */}
          <section>
            <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
              Informations générales
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div>
                <label style={sx.components.label.base}>
                  Altitude terrain (ft)
                </label>
                <input
                  type="number"
                  value={editedData.airportElevation || 0}
                  onChange={(e) => updateValue('airportElevation', parseInt(e.target.value) || 0)}
                  style={sx.components.input.base}
                />
              </div>
              <div>
                <label style={sx.components.label.base}>
                  Tour de piste (ft)
                </label>
                <input
                  type="number"
                  value={editedData.circuitAltitude || 0}
                  onChange={(e) => updateValue('circuitAltitude', parseInt(e.target.value) || 0)}
                  style={sx.components.input.base}
                />
              </div>
              <div>
                <label style={sx.components.label.base}>
                  Variation magnétique (°)
                </label>
                <input
                  type="number"
                  value={editedData.magneticVariation || 0}
                  onChange={(e) => updateValue('magneticVariation', parseFloat(e.target.value) || 0)}
                  style={sx.components.input.base}
                />
              </div>
            </div>
          </section>
          
          {/* Fréquences */}
          <section>
            <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
              Fréquences radio (MHz)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={sx.components.label.base}>TWR</label>
                <input
                  type="text"
                  value={editedData.frequencies?.twr || ''}
                  onChange={(e) => updateValue('frequencies.twr', e.target.value)}
                  placeholder="118.850"
                  style={sx.components.input.base}
                />
              </div>
              <div>
                <label style={sx.components.label.base}>GND</label>
                <input
                  type="text"
                  value={editedData.frequencies?.gnd || ''}
                  onChange={(e) => updateValue('frequencies.gnd', e.target.value)}
                  placeholder="121.950"
                  style={sx.components.input.base}
                />
              </div>
              <div>
                <label style={sx.components.label.base}>ATIS</label>
                <input
                  type="text"
                  value={editedData.frequencies?.atis || ''}
                  onChange={(e) => updateValue('frequencies.atis', e.target.value)}
                  placeholder="128.450"
                  style={sx.components.input.base}
                />
              </div>
            </div>
          </section>
          
          {/* Pistes */}
          <section>
            <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
              <h4 style={sx.combine(sx.text.base, sx.text.bold)}>
                Caractéristiques des pistes
              </h4>
              <button
                onClick={addRunway}
                style={sx.combine(sx.components.button.base, sx.components.button.primary)}
              >
                <Plus size={16} />
                Ajouter une piste
              </button>
            </div>
            
            {editedData.runways?.map((runway, idx) => (
              <div key={idx} style={sx.combine(
                sx.components.card.base,
                sx.spacing.p(3),
                sx.spacing.mb(2)
              )}>
                <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                  <h5 style={sx.text.base}>Piste {idx + 1}</h5>
                  <button
                    onClick={() => removeRunway(idx)}
                    style={sx.combine(sx.components.button.base, sx.components.button.danger)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                      Identifiant
                    </label>
                    <input
                      type="text"
                      value={runway.identifier}
                      onChange={(e) => updateValue(`runways.${idx}.identifier`, e.target.value)}
                      placeholder="07/25"
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                      QFU (°)
                    </label>
                    <input
                      type="number"
                      value={runway.qfu}
                      onChange={(e) => updateValue(`runways.${idx}.qfu`, parseInt(e.target.value) || 0)}
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                      Longueur (m)
                    </label>
                    <input
                      type="number"
                      value={runway.length}
                      onChange={(e) => updateValue(`runways.${idx}.length`, parseInt(e.target.value) || 0)}
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                      Largeur (m)
                    </label>
                    <input
                      type="number"
                      value={runway.width}
                      onChange={(e) => updateValue(`runways.${idx}.width`, parseInt(e.target.value) || 0)}
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                      Surface
                    </label>
                    <select
                      value={runway.surface}
                      onChange={(e) => updateValue(`runways.${idx}.surface`, e.target.value)}
                      style={sx.components.input.base}
                    >
                      <option value="Revêtue">Revêtue</option>
                      <option value="Herbe">Herbe</option>
                      <option value="Terre">Terre</option>
                      <option value="Gravier">Gravier</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
            
            {(!editedData.runways || editedData.runways.length === 0) && (
              <div style={sx.combine(sx.text.center, sx.text.secondary, sx.spacing.p(4))}>
                Aucune piste définie. Cliquez sur "Ajouter une piste" pour commencer.
              </div>
            )}
          </section>
        </div>
        
        {/* Actions */}
        <div style={sx.combine(sx.flex.end, sx.spacing.gap(3), sx.spacing.mt(6))}>
          <button
            onClick={onClose}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
          >
            Annuler
          </button>
          <button
            onClick={saveData}
            disabled={!hasModifications}
            style={sx.combine(
              sx.components.button.base,
              sx.components.button.success,
              !hasModifications && { opacity: 0.5, cursor: 'not-allowed' }
            )}
          >
            <Save size={16} />
            Enregistrer les modifications
          </button>
        </div>
      </div>
    </div>
  );
});

VACDataEditor.displayName = 'VACDataEditor';

export default VACDataEditor;