// src/features/vac/components/VACDataEditorExtended.jsx
import React, { memo, useState, useEffect } from 'react';
import { Save, X, Plus, Trash2, AlertTriangle, Edit2, MapPin, Radio, Plane, Mountain, Shield, FileText, Fuel, Info } from 'lucide-react';
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
      // Initialiser toutes les sections
      if (!clonedData.vfrPoints) clonedData.vfrPoints = [];
      if (!clonedData.runways) clonedData.runways = [];
      if (!clonedData.procedures) clonedData.procedures = { departure: [], arrival: [] };
      if (!clonedData.obstacles) clonedData.obstacles = [];
      if (!clonedData.restrictions) clonedData.restrictions = [];
      if (!clonedData.remarks) clonedData.remarks = '';
      if (!clonedData.services) clonedData.services = { 
        fuel: false, 
        avgas100LL: false,
        jetA1: false,
        maintenance: false, 
        customs: false, 
        handling: false,
        restaurant: false,
        hotel: false,
        parking: false
      };
      if (!clonedData.operatingHours) clonedData.operatingHours = '';
      if (!clonedData.coordinates) clonedData.coordinates = chart.coordinates || { lat: 0, lon: 0 };
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
  
  // Fonctions pour gérer les listes
  const addRunway = () => {
    const newData = { ...editedData };
    newData.runways.push({
      identifier: '00/00',
      qfu: 0,
      length: 1000,
      width: 30,
      surface: 'Revêtue',
      lighting: 'Non éclairée',
      ils: false,
      slope: 0
    });
    setEditedData(newData);
    setHasModifications(true);
  };
  
  const removeRunway = (index) => {
    const newData = { ...editedData };
    newData.runways.splice(index, 1);
    setEditedData(newData);
    setHasModifications(true);
  };
  
  const addVFRPoint = () => {
    const newData = { ...editedData };
    newData.vfrPoints.push({
      name: 'Nouveau point',
      code: 'XX',
      mandatory: false,
      coordinates: { lat: 48.8566, lon: 2.3522 },
      description: '',
      altitude: 1000
    });
    setEditedData(newData);
    setHasModifications(true);
  };
  
  const removeVFRPoint = (index) => {
    const newData = { ...editedData };
    newData.vfrPoints.splice(index, 1);
    setEditedData(newData);
    setHasModifications(true);
  };
  
  const addObstacle = () => {
    const newData = { ...editedData };
    newData.obstacles.push({
      type: 'Antenne',
      height: 100,
      elevation: 0,
      distance: 1,
      bearing: 0,
      lit: true,
      description: ''
    });
    setEditedData(newData);
    setHasModifications(true);
  };
  
  const removeObstacle = (index) => {
    const newData = { ...editedData };
    newData.obstacles.splice(index, 1);
    setEditedData(newData);
    setHasModifications(true);
  };
  
  const addProcedure = (type) => {
    const newData = { ...editedData };
    newData.procedures[type].push({
      name: 'Nouvelle procédure',
      description: '',
      altitude: 1500,
      qfu: ''
    });
    setEditedData(newData);
    setHasModifications(true);
  };
  
  const removeProcedure = (type, index) => {
    const newData = { ...editedData };
    newData.procedures[type].splice(index, 1);
    setEditedData(newData);
    setHasModifications(true);
  };
  
  // Sauvegarder
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
  
  // Rendu du contenu selon l'onglet actif
  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div style={{ display: 'grid', gap: '24px' }}>
            <section>
              <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
                Informations générales
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {/* Date de publication */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={sx.components.label.base}>
                    Date de publication/mise à jour de la carte
                  </label>
                  <input
                    type="date"
                    value={editedData.publicationDate || ''}
                    onChange={(e) => updateValue('publicationDate', e.target.value)}
                    style={sx.components.input.base}
                  />
                  {editedData.publicationDate && (() => {
                    const publicationDate = new Date(editedData.publicationDate);
                    const today = new Date();
                    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
                    const isOutdated = publicationDate < oneYearAgo;
                    
                    return isOutdated ? (
                      <p style={sx.combine(sx.text.xs, { color: '#ef4444' }, sx.spacing.mt(1))}>
                        ⚠️ Cette carte date de plus d'un an
                      </p>
                    ) : (
                      <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                        ✓ Carte à jour
                      </p>
                    );
                  })()}
                </div>
                
                <div>
                  <label style={sx.components.label.base}>Altitude terrain (ft)</label>
                  <input
                    type="number"
                    value={editedData.airportElevation || 0}
                    onChange={(e) => updateValue('airportElevation', parseInt(e.target.value) || 0)}
                    style={sx.components.input.base}
                  />
                </div>
                <div>
                  <label style={sx.components.label.base}>Tour de piste (ft)</label>
                  <input
                    type="number"
                    value={editedData.circuitAltitude || 0}
                    onChange={(e) => updateValue('circuitAltitude', parseInt(e.target.value) || 0)}
                    style={sx.components.input.base}
                  />
                </div>
                <div>
                  <label style={sx.components.label.base}>Variation magnétique (°)</label>
                  <input
                    type="number"
                    value={editedData.magneticVariation || 0}
                    onChange={(e) => updateValue('magneticVariation', parseFloat(e.target.value) || 0)}
                    style={sx.components.input.base}
                  />
                </div>
                <div>
                  <label style={sx.components.label.base}>Horaires d'ouverture</label>
                  <input
                    type="text"
                    value={editedData.operatingHours || ''}
                    onChange={(e) => updateValue('operatingHours', e.target.value)}
                    placeholder="Ex: SR-SS, HJ, H24"
                    style={sx.components.input.base}
                  />
                </div>
              </div>
            </section>
            
            <section>
              <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
                Coordonnées de l'aérodrome
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div>
                  <label style={sx.components.label.base}>Latitude</label>
                  <input
                    type="number"
                    value={editedData.coordinates?.lat || 0}
                    onChange={(e) => updateValue('coordinates.lat', parseFloat(e.target.value) || 0)}
                    step="0.0001"
                    style={sx.components.input.base}
                  />
                </div>
                <div>
                  <label style={sx.components.label.base}>Longitude</label>
                  <input
                    type="number"
                    value={editedData.coordinates?.lon || 0}
                    onChange={(e) => updateValue('coordinates.lon', parseFloat(e.target.value) || 0)}
                    step="0.0001"
                    style={sx.components.input.base}
                  />
                </div>
              </div>
            </section>
          </div>
        );
        
      case 'runways':
        return (
          <div>
            <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
              <h4 style={sx.text.base}>Caractéristiques des pistes</h4>
              <button
                onClick={addRunway}
                style={sx.combine(sx.components.button.base, sx.components.button.primary)}
              >
                <Plus size={16} />
                Ajouter un seuil de piste
              </button>
            </div>
            
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(3))}>
              <Info size={16} />
              <div>
                <p style={sx.text.sm}>
                  <strong>Important :</strong> Chaque seuil de piste est géré individuellement.
                </p>
                <ul style={{ marginTop: '8px', marginLeft: '20px', fontSize: '13px' }}>
                  <li>Pour une piste 05/23, créez deux entrées séparées : une pour le seuil 05 et une pour le seuil 23</li>
                  <li>Chaque seuil peut avoir ses propres caractéristiques (ILS, distances déclarées, etc.)</li>
                  <li>Cela reflète la réalité opérationnelle où chaque sens d'approche a ses spécificités</li>
                </ul>
              </div>
            </div>
            
            {editedData.runways?.map((runway, idx) => (
              <div key={idx} style={sx.combine(sx.components.card.base, sx.spacing.p(3), sx.spacing.mb(2))}>
                <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                  <h5 style={sx.combine(sx.text.base, sx.flex.start)}>
                    <Plane size={18} style={{ marginRight: '8px' }} />
                    Seuil {runway.identifier || `#${idx + 1}`}
                    {runway.qfu && (
                      <span style={{ 
                        marginLeft: '8px', 
                        fontSize: '12px', 
                        color: '#6b7280',
                        fontWeight: 'normal' 
                      }}>
                        (QFU {runway.qfu}°)
                      </span>
                    )}
                  </h5>
                  <button
                    onClick={() => removeRunway(idx)}
                    style={sx.combine(sx.components.button.base, sx.components.button.danger)}
                    title="Supprimer ce seuil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                {/* Identifiant unique et QFU */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                      Identifiant du seuil
                      <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={runway.identifier}
                      onChange={(e) => updateValue(`runways.${idx}.identifier`, e.target.value.toUpperCase())}
                      placeholder="Ex: 05, 23, 05L, 23R"
                      maxLength="3"
                      style={sx.components.input.base}
                    />
                    <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                      Entrez uniquement ce seuil (05 OU 23, pas 05/23)
                    </p>
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                      QFU (orientation magnétique)
                      <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                    </label>
                    <input
                      type="number"
                      value={runway.qfu}
                      onChange={(e) => updateValue(`runways.${idx}.qfu`, parseInt(e.target.value) || 0)}
                      placeholder="Ex: 050 pour piste 05"
                      min="0"
                      max="360"
                      style={sx.components.input.base}
                    />
                    <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                      Direction magnétique en degrés (0-360)
                    </p>
                  </div>
                </div>
                
                {/* Dimensions physiques */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Longueur (m)</label>
                    <input
                      type="number"
                      value={runway.length}
                      onChange={(e) => updateValue(`runways.${idx}.length`, parseInt(e.target.value) || 0)}
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Largeur (m)</label>
                    <input
                      type="number"
                      value={runway.width}
                      onChange={(e) => updateValue(`runways.${idx}.width`, parseInt(e.target.value) || 0)}
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Surface</label>
                    <select
                      value={runway.surface}
                      onChange={(e) => updateValue(`runways.${idx}.surface`, e.target.value)}
                      style={sx.components.input.base}
                    >
                      <option value="Revêtue">Revêtue</option>
                      <option value="Asphalte">Asphalte</option>
                      <option value="Béton">Béton</option>
                      <option value="Herbe">Herbe</option>
                      <option value="Terre">Terre</option>
                      <option value="Gravier">Gravier</option>
                      <option value="Composite">Composite</option>
                    </select>
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Pente (%)</label>
                    <input
                      type="number"
                      value={runway.slope || 0}
                      onChange={(e) => updateValue(`runways.${idx}.slope`, parseFloat(e.target.value) || 0)}
                      step="0.1"
                      placeholder="+ montée, - descente"
                      style={sx.components.input.base}
                    />
                  </div>
                </div>
                
                {/* Distances déclarées */}
                <div style={sx.combine(sx.spacing.mb(2))}>
                  <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>Distances déclarées (m)</h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                        TORA
                        <span style={sx.combine(sx.text.xs, sx.text.secondary)}> (décollage)</span>
                      </label>
                      <input
                        type="number"
                        value={runway.tora || runway.length}
                        onChange={(e) => updateValue(`runways.${idx}.tora`, parseInt(e.target.value) || 0)}
                        placeholder="Distance de roulement"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                        TODA
                        <span style={sx.combine(sx.text.xs, sx.text.secondary)}> (+ clearway)</span>
                      </label>
                      <input
                        type="number"
                        value={runway.toda || runway.tora || runway.length}
                        onChange={(e) => updateValue(`runways.${idx}.toda`, parseInt(e.target.value) || 0)}
                        placeholder="TORA + clearway"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                        ASDA
                        <span style={sx.combine(sx.text.xs, sx.text.secondary)}> (+ stopway)</span>
                      </label>
                      <input
                        type="number"
                        value={runway.asda || runway.tora || runway.length}
                        onChange={(e) => updateValue(`runways.${idx}.asda`, parseInt(e.target.value) || 0)}
                        placeholder="TORA + stopway"
                        style={sx.components.input.base}
                      />
                    </div>
                    <div>
                      <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                        LDA
                        <span style={sx.combine(sx.text.xs, sx.text.secondary)}> (atterrissage)</span>
                      </label>
                      <input
                        type="number"
                        value={runway.lda || runway.length}
                        onChange={(e) => updateValue(`runways.${idx}.lda`, parseInt(e.target.value) || 0)}
                        placeholder="Distance d'atterrissage"
                        style={sx.components.input.base}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Aides à l'approche */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Éclairage</label>
                    <select
                      value={runway.lighting || 'Non éclairée'}
                      onChange={(e) => updateValue(`runways.${idx}.lighting`, e.target.value)}
                      style={sx.components.input.base}
                    >
                      <option value="Non éclairée">Non éclairée</option>
                      <option value="Basse intensité">Basse intensité</option>
                      <option value="Moyenne intensité">Moyenne intensité</option>
                      <option value="Haute intensité">Haute intensité</option>
                      <option value="HIRL">HIRL</option>
                      <option value="MIRL">MIRL</option>
                      <option value="LIRL">LIRL</option>
                    </select>
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Aide visuelle</label>
                    <select
                      value={runway.visualAid || 'Aucune'}
                      onChange={(e) => updateValue(`runways.${idx}.visualAid`, e.target.value)}
                      style={sx.components.input.base}
                    >
                      <option value="Aucune">Aucune</option>
                      <option value="PAPI">PAPI</option>
                      <option value="APAPI">APAPI</option>
                      <option value="VASI">VASI</option>
                      <option value="AVASI">AVASI</option>
                      <option value="T-VASIS">T-VASIS</option>
                      <option value="PVASI">PVASI</option>
                    </select>
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Balisage lumineux</label>
                    <select
                      value={runway.approachLighting || 'Aucun'}
                      onChange={(e) => updateValue(`runways.${idx}.approachLighting`, e.target.value)}
                      style={sx.components.input.base}
                    >
                      <option value="Aucun">Aucun</option>
                      <option value="ALSF-1">ALSF-1</option>
                      <option value="ALSF-2">ALSF-2</option>
                      <option value="CALVERT">CALVERT</option>
                      <option value="CALVERT-2">CALVERT-2</option>
                      <option value="MALS">MALS</option>
                      <option value="MALSF">MALSF</option>
                      <option value="MALSR">MALSR</option>
                      <option value="SALS">SALS</option>
                      <option value="SALSF">SALSF</option>
                      <option value="SSALF">SSALF</option>
                      <option value="SSALR">SSALR</option>
                      <option value="SSALS">SSALS</option>
                    </select>
                  </div>
                </div>
                
                {/* ILS et radio-navigation */}
                <div style={sx.combine(sx.spacing.mb(2))}>
                  <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>Aides radio-électriques</h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="checkbox"
                        checked={runway.ils || false}
                        onChange={(e) => updateValue(`runways.${idx}.ils`, e.target.checked)}
                        style={{ marginRight: '4px' }}
                      />
                      <label style={sx.text.sm}>ILS disponible</label>
                      {runway.ils && (
                        <>
                          <select
                            value={runway.ilsCategory || 'CAT I'}
                            onChange={(e) => updateValue(`runways.${idx}.ilsCategory`, e.target.value)}
                            style={sx.combine(sx.components.input.base, { flex: 1 })}
                          >
                            <option value="CAT I">CAT I</option>
                            <option value="CAT II">CAT II</option>
                            <option value="CAT IIIA">CAT IIIA</option>
                            <option value="CAT IIIB">CAT IIIB</option>
                            <option value="CAT IIIC">CAT IIIC</option>
                          </select>
                        </>
                      )}
                    </div>
                    
                    {runway.ils && (
                      <>
                        <div>
                          <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Fréquence ILS (MHz)</label>
                          <input
                            type="text"
                            value={runway.ilsFrequency}
                            onChange={(e) => updateValue(`runways.${idx}.ilsFrequency`, e.target.value)}
                            placeholder="110.30"
                            style={sx.components.input.base}
                          />
                        </div>
                        <div>
                          <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Indicatif ILS</label>
                          <input
                            type="text"
                            value={runway.ilsIdent}
                            onChange={(e) => updateValue(`runways.${idx}.ilsIdent`, e.target.value.toUpperCase())}
                            placeholder="PGS"
                            maxLength="4"
                            style={sx.components.input.base}
                          />
                        </div>
                        <div>
                          <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Radiale ILS (°)</label>
                          <input
                            type="number"
                            value={runway.ilsRadial || runway.qfu}
                            onChange={(e) => updateValue(`runways.${idx}.ilsRadial`, parseInt(e.target.value) || 0)}
                            placeholder="Same as QFU"
                            min="0"
                            max="360"
                            style={sx.components.input.base}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Autres aides radio */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={runway.dme || false}
                        onChange={(e) => updateValue(`runways.${idx}.dme`, e.target.checked)}
                        style={{ marginRight: '8px' }}
                      />
                      <label style={sx.text.sm}>DME</label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={runway.vor || false}
                        onChange={(e) => updateValue(`runways.${idx}.vor`, e.target.checked)}
                        style={{ marginRight: '8px' }}
                      />
                      <label style={sx.text.sm}>VOR</label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={runway.ndb || false}
                        onChange={(e) => updateValue(`runways.${idx}.ndb`, e.target.checked)}
                        style={{ marginRight: '8px' }}
                      />
                      <label style={sx.text.sm}>NDB</label>
                    </div>
                  </div>
                </div>
                
                {/* Remarques */}
                <div>
                  <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Remarques spécifiques à ce seuil</label>
                  <textarea
                    value={runway.remarks || ''}
                    onChange={(e) => updateValue(`runways.${idx}.remarks`, e.target.value)}
                    placeholder="Obstacles, restrictions, procédures particulières..."
                    rows={2}
                    style={sx.combine(sx.components.input.base, { resize: 'vertical' })}
                  />
                </div>
              </div>
            ))}
          </div>
        );
        
      case 'frequencies':
        return (
          <div>
            <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
              Fréquences radio (MHz)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {['twr', 'gnd', 'atis', 'afis', 'app', 'dep', 'info'].map(freq => (
                <div key={freq}>
                  <label style={sx.components.label.base}>{freq.toUpperCase()}</label>
                  <input
                    type="text"
                    value={editedData.frequencies?.[freq] || ''}
                    onChange={(e) => updateValue(`frequencies.${freq}`, e.target.value)}
                    placeholder="118.850"
                    style={sx.components.input.base}
                  />
                </div>
              ))}
            </div>
          </div>
        );
        
      case 'vfr':
        return (
          <div>
            <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
              <h4 style={sx.text.base}>Points de report VFR</h4>
              <button
                onClick={addVFRPoint}
                style={sx.combine(sx.components.button.base, sx.components.button.primary)}
              >
                <Plus size={16} />
                Ajouter un point
              </button>
            </div>
            
            {editedData.vfrPoints?.map((point, idx) => (
              <div key={idx} style={sx.combine(sx.components.card.base, sx.spacing.p(3), sx.spacing.mb(2))}>
                <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                  <h5 style={sx.text.base}>Point {idx + 1}</h5>
                  <button
                    onClick={() => removeVFRPoint(idx)}
                    style={sx.combine(sx.components.button.base, sx.components.button.danger)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Nom</label>
                    <input
                      type="text"
                      value={point.name}
                      onChange={(e) => updateValue(`vfrPoints.${idx}.name`, e.target.value)}
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Code</label>
                    <input
                      type="text"
                      value={point.code}
                      onChange={(e) => updateValue(`vfrPoints.${idx}.code`, e.target.value)}
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Altitude (ft)</label>
                    <input
                      type="number"
                      value={point.altitude || 0}
                      onChange={(e) => updateValue(`vfrPoints.${idx}.altitude`, parseInt(e.target.value) || 0)}
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Latitude</label>
                    <input
                      type="number"
                      value={point.coordinates?.lat || 0}
                      onChange={(e) => updateValue(`vfrPoints.${idx}.coordinates.lat`, parseFloat(e.target.value) || 0)}
                      step="0.0001"
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Longitude</label>
                    <input
                      type="number"
                      value={point.coordinates?.lon || 0}
                      onChange={(e) => updateValue(`vfrPoints.${idx}.coordinates.lon`, parseFloat(e.target.value) || 0)}
                      step="0.0001"
                      style={sx.components.input.base}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={point.mandatory || false}
                      onChange={(e) => updateValue(`vfrPoints.${idx}.mandatory`, e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <label style={sx.text.sm}>Obligatoire</label>
                  </div>
                  <div style={{ gridColumn: 'span 3' }}>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Description</label>
                    <input
                      type="text"
                      value={point.description || ''}
                      onChange={(e) => updateValue(`vfrPoints.${idx}.description`, e.target.value)}
                      placeholder="Ex: Château d'eau, Pont, Église..."
                      style={sx.components.input.base}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
        
      case 'obstacles':
        return (
          <div>
            <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
              <h4 style={sx.text.base}>Obstacles remarquables</h4>
              <button
                onClick={addObstacle}
                style={sx.combine(sx.components.button.base, sx.components.button.primary)}
              >
                <Plus size={16} />
                Ajouter un obstacle
              </button>
            </div>
            
            {editedData.obstacles?.map((obstacle, idx) => (
              <div key={idx} style={sx.combine(sx.components.card.base, sx.spacing.p(3), sx.spacing.mb(2))}>
                <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                  <h5 style={sx.text.base}>Obstacle {idx + 1}</h5>
                  <button
                    onClick={() => removeObstacle(idx)}
                    style={sx.combine(sx.components.button.base, sx.components.button.danger)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Type</label>
                    <select
                      value={obstacle.type}
                      onChange={(e) => updateValue(`obstacles.${idx}.type`, e.target.value)}
                      style={sx.components.input.base}
                    >
                      <option value="Antenne">Antenne</option>
                      <option value="Château d'eau">Château d'eau</option>
                      <option value="Éolienne">Éolienne</option>
                      <option value="Pylône">Pylône</option>
                      <option value="Cheminée">Cheminée</option>
                      <option value="Grue">Grue</option>
                      <option value="Ligne HT">Ligne HT</option>
                      <option value="Immeuble">Immeuble</option>
                    </select>
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Hauteur (ft)</label>
                    <input
                      type="number"
                      value={obstacle.height}
                      onChange={(e) => updateValue(`obstacles.${idx}.height`, parseInt(e.target.value) || 0)}
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Élévation sol (ft)</label>
                    <input
                      type="number"
                      value={obstacle.elevation}
                      onChange={(e) => updateValue(`obstacles.${idx}.elevation`, parseInt(e.target.value) || 0)}
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Distance (NM)</label>
                    <input
                      type="number"
                      value={obstacle.distance}
                      onChange={(e) => updateValue(`obstacles.${idx}.distance`, parseFloat(e.target.value) || 0)}
                      step="0.1"
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Relèvement (°)</label>
                    <input
                      type="number"
                      value={obstacle.bearing}
                      onChange={(e) => updateValue(`obstacles.${idx}.bearing`, parseInt(e.target.value) || 0)}
                      style={sx.components.input.base}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={obstacle.lit || false}
                      onChange={(e) => updateValue(`obstacles.${idx}.lit`, e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <label style={sx.text.sm}>Balisé</label>
                  </div>
                  <div style={{ gridColumn: 'span 3' }}>
                    <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Description</label>
                    <input
                      type="text"
                      value={obstacle.description || ''}
                      onChange={(e) => updateValue(`obstacles.${idx}.description`, e.target.value)}
                      placeholder="Informations complémentaires..."
                      style={sx.components.input.base}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
        
      case 'procedures':
        return (
          <div>
            <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
              Procédures de départ et d'arrivée
            </h4>
            
            {['departure', 'arrival'].map(type => (
              <div key={type} style={sx.spacing.mb(4)}>
                <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                  <h5 style={sx.text.base}>
                    {type === 'departure' ? 'Procédures de départ' : 'Procédures d\'arrivée'}
                  </h5>
                  <button
                    onClick={() => addProcedure(type)}
                    style={sx.combine(sx.components.button.base, sx.components.button.primary)}
                  >
                    <Plus size={16} />
                    Ajouter
                  </button>
                </div>
                
                {editedData.procedures?.[type]?.map((proc, idx) => (
                  <div key={idx} style={sx.combine(sx.components.card.base, sx.spacing.p(3), sx.spacing.mb(2))}>
                    <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                      <input
                        type="text"
                        value={proc.name}
                        onChange={(e) => updateValue(`procedures.${type}.${idx}.name`, e.target.value)}
                        placeholder="Nom de la procédure"
                        style={sx.combine(sx.components.input.base, { fontWeight: 'bold' })}
                      />
                      <button
                        onClick={() => removeProcedure(type, idx)}
                        style={sx.combine(sx.components.button.base, sx.components.button.danger)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div>
                        <label style={sx.combine(sx.components.label.base, sx.text.xs)}>QFU</label>
                        <input
                          type="text"
                          value={proc.qfu || ''}
                          onChange={(e) => updateValue(`procedures.${type}.${idx}.qfu`, e.target.value)}
                          placeholder="Ex: 07, 25, Toutes"
                          style={sx.components.input.base}
                        />
                      </div>
                      <div>
                        <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Altitude (ft)</label>
                        <input
                          type="number"
                          value={proc.altitude}
                          onChange={(e) => updateValue(`procedures.${type}.${idx}.altitude`, parseInt(e.target.value) || 0)}
                          style={sx.components.input.base}
                        />
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={sx.combine(sx.components.label.base, sx.text.xs)}>Description</label>
                        <textarea
                          value={proc.description}
                          onChange={(e) => updateValue(`procedures.${type}.${idx}.description`, e.target.value)}
                          placeholder="Décrivez la procédure..."
                          style={sx.combine(sx.components.input.base, { minHeight: '60px' })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
        
      case 'services':
        return (
          <div>
            <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
              Services disponibles
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {[
                { key: 'fuel', label: 'Avitaillement carburant' },
                { key: 'avgas100LL', label: 'AVGAS 100LL disponible' },
                { key: 'jetA1', label: 'JET A1 disponible' },
                { key: 'maintenance', label: 'Maintenance' },
                { key: 'customs', label: 'Douanes' },
                { key: 'handling', label: 'Assistance au sol' },
                { key: 'restaurant', label: 'Restaurant' },
                { key: 'hotel', label: 'Hôtel' },
                { key: 'parking', label: 'Parking avions' },
                { key: 'hangar', label: 'Hangar disponible' },
                { key: 'meteo', label: 'Station météo' },
                { key: 'flightSchool', label: 'École de pilotage' }
              ].map(service => (
                <div key={service.key} style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={editedData.services?.[service.key] || false}
                    onChange={(e) => updateValue(`services.${service.key}`, e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <label style={sx.text.sm}>{service.label}</label>
                </div>
              ))}
            </div>
          </div>
        );
        
      case 'remarks':
        return (
          <div>
            <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
              Remarques et restrictions
            </h4>
            <div>
              <label style={sx.components.label.base}>Remarques générales</label>
              <textarea
                value={editedData.remarks || ''}
                onChange={(e) => updateValue('remarks', e.target.value)}
                placeholder="Ajoutez des remarques importantes, restrictions, informations particulières..."
                style={sx.combine(sx.components.input.base, { minHeight: '150px', fontFamily: 'monospace' })}
              />
            </div>
            
            <div style={sx.spacing.mt(4)}>
              <label style={sx.components.label.base}>Restrictions opérationnelles</label>
              <textarea
                value={editedData.restrictions?.join('\n') || ''}
                onChange={(e) => updateValue('restrictions', e.target.value.split('\n').filter(r => r))}
                placeholder="Une restriction par ligne..."
                style={sx.combine(sx.components.input.base, { minHeight: '100px', fontFamily: 'monospace' })}
              />
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
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
          maxWidth: '900px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
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
                Cette carte a été importée manuellement. Veuillez saisir toutes les données nécessaires.
              </p>
            </div>
          </div>
        )}
        
        {/* Onglets */}
        <div style={sx.combine(sx.flex.row, { overflowX: 'auto', borderBottom: '1px solid #e5e7eb' })}>
          {[
            { id: 'general', label: 'Général', icon: Edit2 },
            { id: 'runways', label: 'Pistes', icon: Plane },
            { id: 'frequencies', label: 'Fréquences', icon: Radio },
            { id: 'vfr', label: 'VFR', icon: MapPin },
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
                fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                whiteSpace: 'nowrap'
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Contenu */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0' }}>
          {renderTabContent()}
        </div>
        
        {/* Actions */}
        <div style={sx.combine(sx.flex.end, sx.spacing.gap(3), sx.spacing.pt(4), { borderTop: '1px solid #e5e7eb' })}>
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