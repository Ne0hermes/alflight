// src/features/vac/components/VACDataEditorExtended.jsx
import React, { memo, useState, useEffect, Fragment } from 'react';
import { Save, X, Plus, Trash2, AlertTriangle, Edit2, MapPin, Radio, Plane, Mountain, Shield, FileText, Fuel, Info } from 'lucide-react';
import { useVACStore } from '@core/stores/vacStore';
import { sx } from '@shared/styles/styleSystem';
import { RunwaysEditor } from './VACDataEditorRunways';
import { VFREditor } from './VACDataEditorVFR';
import { ObstaclesEditor } from './VACDataEditorObstacles';
import { ProceduresEditor } from './VACDataEditorProcedures';
import { ServicesEditor } from './VACDataEditorServices';

export const VACDataEditor = memo(({ chart, onClose }) => {
  const { updateExtractedData } = useVACStore(state => ({
    updateExtractedData: state.updateExtractedData
  }));
  
  const [editedData, setEditedData] = useState(null);
  const [hasModifications, setHasModifications] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  // Fonction pour vérifier si un champ est manquant ou incomplet
  const isMissingData = (value) => {
    return value === null || value === undefined || value === '' || value === 0 || 
           (typeof value === 'object' && Object.keys(value).length === 0) ||
           (Array.isArray(value) && value.length === 0);
  };
  
  // Styles pour les champs manquants
  const getMissingFieldStyle = (value) => {
    if (isMissingData(value)) {
      return {
        backgroundColor: '#fef2f2',
        borderColor: '#fca5a5',
        borderWidth: '2px'
      };
    }
    return {};
  };
  
  // Initialiser les données à l'ouverture avec toutes les données extraites
  useEffect(() => {
    if (chart?.extractedData || chart) {
      const existingData = chart.extractedData || {};
      
      // Debug: afficher les données reçues
      console.log('📊 VACDataEditor - Chart reçu:', chart);
      console.log('📊 VACDataEditor - ExtractedData:', existingData);
      console.log('📊 VACDataEditor - Fréquences dans extractedData:', existingData.frequencies);
      console.log('📊 VACDataEditor - Fréquences dans chart:', chart.frequencies);
      console.log('📊 VACDataEditor - Fréquences dans chart.extractedData:', chart.extractedData?.frequencies);
      console.log('🛬 VACDataEditor - Pistes dans extractedData:', existingData.runways);
      if (existingData.runways && existingData.runways.length > 0) {
        console.log('🛬 Détail de la première piste:', existingData.runways[0]);
        console.log('🛬 Designation:', existingData.runways[0].designation);
        console.log('🛬 Identifier:', existingData.runways[0].identifier);
      }
      console.log('🛬 VACDataEditor - Pistes dans chart:', chart.runways);
      
      // Log pour débugger le problème des fréquences
      const allFrequencies = existingData.frequencies || chart.extractedData?.frequencies || chart.frequencies || {};
      console.log('📻 VACDataEditor - Toutes les fréquences trouvées:', allFrequencies);
      console.log('📻 VACDataEditor - Type des fréquences:', typeof allFrequencies);
      console.log('📻 VACDataEditor - Clés des fréquences:', Object.keys(allFrequencies));
      
      // Créer une structure complète avec les données existantes et les valeurs par défaut
      const clonedData = {
        // Informations générales (pré-remplies depuis AIXM)
        airportName: existingData.airportName || chart.name || '',
        airportICAO: existingData.airportICAO || chart.icao || '',
        airportIATA: existingData.iata || existingData.airportIATA || chart.iata || '',
        airportCity: existingData.city || existingData.airportCity || chart.city || '',
        airportType: existingData.airportType || '',
        airportElevation: existingData.airportElevation || 0,
        
        // Variation magnétique et transition
        magneticVariation: existingData.magneticVariation || chart.magneticVariation?.value || 0,
        magneticVariationDate: chart.magneticVariation?.date || '',
        magneticVariationChange: chart.magneticVariation?.change || 0,
        transitionAltitude: existingData.transitionAltitude || chart.transitionAltitude || 0,
        referencePoint: existingData.referencePoint || chart.referencePoint || '',
        
        // Tour de piste
        circuitAltitude: existingData.circuitAltitude || 1000,
        circuitSide: existingData.circuitSide || 'left',
        
        // Coordonnées
        coordinates: existingData.coordinates || chart.coordinates || { lat: 0, lon: 0 },
        
        // Pistes (avec toutes les données AIXM)
        runways: existingData.runways || [],
        
        // Fréquences (depuis AIXM) - chercher dans extractedData ET directement dans chart
        // Les fréquences peuvent être dans chart.extractedData.frequencies ou chart.frequencies
        frequencies: (() => {
          const freq = existingData.frequencies || chart.extractedData?.frequencies || chart.frequencies || {};
          console.log('🎯 Fréquences finalement assignées:', freq);
          return freq;
        })(),
        
        // Aides à la navigation
        navaids: existingData.navaids || chart.navaids || [],
        
        // Espaces aériens
        airspaces: existingData.airspaces || chart.airspaces || {},
        
        // Points VFR
        vfrPoints: existingData.vfrPoints || [],
        
        // Procédures
        procedures: existingData.procedures || { departure: [], arrival: [] },
        
        // Obstacles
        obstacles: existingData.obstacles || [],
        
        // Restrictions
        restrictions: existingData.restrictions || [],
        
        // Services
        services: existingData.services || { 
          fuel: existingData.fuel || false,
          avgas100LL: false,
          jetA1: false,
          maintenance: false,
          customs: existingData.customs || false,
          handling: existingData.handling || false,
          restaurant: false,
          hotel: false,
          parking: false
        },
        
        // Horaires et remarques
        operatingHours: existingData.operatingHours || '',
        remarks: existingData.remarks || '',
        
        // Métadonnées
        dataSource: existingData.dataSource || chart.source || '',
        airac: existingData.airac || chart.airac || '',
        lastUpdate: existingData.lastUpdate || new Date().toISOString()
      };
      
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
                {isMissingData(editedData.airportName) && (
                  <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'normal', marginLeft: '12px' }}>
                    ⚠️ Certaines données sont manquantes
                  </span>
                )}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {/* Codes aérodrome */}
                <div>
                  <label style={sx.components.label.base}>
                    Code ICAO
                  </label>
                  <input
                    type="text"
                    value={editedData.airportICAO || chart?.icao || ''}
                    onChange={(e) => updateValue('airportICAO', e.target.value)}
                    style={sx.components.input.base}
                    readOnly
                  />
                </div>
                <div>
                  <label style={sx.components.label.base}>
                    Code IATA
                    {isMissingData(editedData.airportIATA) && (
                      <span style={{ color: '#fbbf24', marginLeft: '8px', fontSize: '11px' }}>
                        (optionnel)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={editedData.airportIATA || ''}
                    onChange={(e) => updateValue('airportIATA', e.target.value)}
                    style={{
                      ...sx.components.input.base,
                      ...getMissingFieldStyle(editedData.airportIATA)
                    }}
                    placeholder="Ex: CDG"
                  />
                </div>
                
                {/* Nom et ville */}
                <div>
                  <label style={sx.components.label.base}>
                    Nom de l'aérodrome
                    {isMissingData(editedData.airportName) && (
                      <span style={{ color: '#ef4444', marginLeft: '8px', fontSize: '12px' }}>
                        ⚠️ Requis
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={editedData.airportName || ''}
                    onChange={(e) => updateValue('airportName', e.target.value)}
                    style={{
                      ...sx.components.input.base,
                      ...getMissingFieldStyle(editedData.airportName)
                    }}
                    placeholder="Ex: STRASBOURG ENTZHEIM"
                  />
                </div>
                <div>
                  <label style={sx.components.label.base}>
                    Ville
                  </label>
                  <input
                    type="text"
                    value={editedData.airportCity || ''}
                    onChange={(e) => updateValue('airportCity', e.target.value)}
                    style={{
                      ...sx.components.input.base,
                      ...getMissingFieldStyle(editedData.airportCity)
                    }}
                    placeholder="Ex: STRASBOURG"
                  />
                </div>
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
                  <label style={sx.components.label.base}>
                    Altitude terrain (ft)
                    {isMissingData(editedData.airportElevation) && (
                      <span style={{ color: '#ef4444', marginLeft: '8px', fontSize: '12px' }}>
                        ⚠️ Donnée manquante
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={editedData.airportElevation || 0}
                    onChange={(e) => updateValue('airportElevation', parseInt(e.target.value) || 0)}
                    style={{
                      ...sx.components.input.base,
                      ...getMissingFieldStyle(editedData.airportElevation)
                    }}
                    placeholder="Entrez l'altitude du terrain"
                  />
                </div>
                <div>
                  <label style={sx.components.label.base}>
                    Tour de piste (ft)
                    {isMissingData(editedData.circuitAltitude) && (
                      <span style={{ color: '#ef4444', marginLeft: '8px', fontSize: '12px' }}>
                        ⚠️ Donnée manquante
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={editedData.circuitAltitude || 0}
                    onChange={(e) => updateValue('circuitAltitude', parseInt(e.target.value) || 0)}
                    style={{
                      ...sx.components.input.base,
                      ...getMissingFieldStyle(editedData.circuitAltitude)
                    }}
                    placeholder="Généralement 1000ft AAL"
                  />
                </div>
                <div>
                  <label style={sx.components.label.base}>
                    Variation magnétique (°)
                    {editedData.magneticVariationDate && (
                      <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '8px' }}>
                        ({editedData.magneticVariationDate})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editedData.magneticVariation || 0}
                    onChange={(e) => updateValue('magneticVariation', parseFloat(e.target.value) || 0)}
                    style={{
                      ...sx.components.input.base,
                      ...getMissingFieldStyle(editedData.magneticVariation)
                    }}
                    placeholder="Ex: 2.5°E"
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
                
                {/* Altitude de transition et point de référence */}
                <div>
                  <label style={sx.components.label.base}>
                    Altitude de transition (ft)
                    {isMissingData(editedData.transitionAltitude) && (
                      <span style={{ color: '#fbbf24', marginLeft: '8px', fontSize: '11px' }}>
                        ⚠️ Important
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={editedData.transitionAltitude || 0}
                    onChange={(e) => updateValue('transitionAltitude', parseInt(e.target.value) || 0)}
                    style={{
                      ...sx.components.input.base,
                      ...getMissingFieldStyle(editedData.transitionAltitude)
                    }}
                    placeholder="Ex: 4000"
                  />
                </div>
                
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={sx.components.label.base}>
                    Point de référence
                  </label>
                  <input
                    type="text"
                    value={editedData.referencePoint || ''}
                    onChange={(e) => updateValue('referencePoint', e.target.value)}
                    style={{
                      ...sx.components.input.base,
                      ...getMissingFieldStyle(editedData.referencePoint)
                    }}
                    placeholder="Ex: Intersection axe de piste et voie de circulation F"
                  />
                </div>
                
                {/* Métadonnées */}
                {editedData.dataSource && (
                  <div style={{ gridColumn: 'span 2', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6b7280' }}>
                      <span><strong>Source:</strong> {editedData.dataSource}</span>
                      {editedData.airac && <span><strong>AIRAC:</strong> {editedData.airac}</span>}
                      {editedData.lastUpdate && (
                        <span><strong>Dernière MAJ:</strong> {new Date(editedData.lastUpdate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                )}
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
        return <RunwaysEditor editedData={editedData} updateValue={updateValue} />;
      case 'frequencies':
        console.log('🔍 Rendering frequencies tab - editedData.frequencies:', editedData.frequencies);
        console.log('🔍 Frequencies keys:', Object.keys(editedData.frequencies || {}));
        console.log('🔍 Frequencies length:', Object.keys(editedData.frequencies || {}).length);
        
        return (
          <div>
            <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
              Fréquences radio (MHz)
              {(!editedData.frequencies || Object.keys(editedData.frequencies).length === 0) && (
                <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'normal', marginLeft: '12px' }}>
                  ⚠️ Aucune fréquence définie
                </span>
              )}
            </h4>
            
            {/* Fréquences AIXM/SIA modifiables */}
            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#0369a1' }}>
                Fréquences radio (MHz)
                {(!editedData.frequencies || Object.keys(editedData.frequencies).length === 0) && (
                  <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'normal', marginLeft: '12px' }}>
                    ⚠️ Aucune fréquence définie
                  </span>
                )}
              </h5>
              
              {editedData.frequencies && Object.keys(editedData.frequencies).length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                  {Object.entries(editedData.frequencies).map(([service, freqData]) => {
                    // Si c'est un tableau de fréquences (depuis AIXM)
                    if (Array.isArray(freqData) && freqData.length > 0) {
                      return (
                        <div key={service} style={{ 
                          padding: '12px', 
                          backgroundColor: 'white', 
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '8px'
                          }}>
                            <label style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '14px' }}>
                              {service.toUpperCase()}
                            </label>
                            <button
                              onClick={() => {
                                const newFreq = { frequency: '', schedule: 'H24', remarks: '' };
                                updateValue(`frequencies.${service}`, [...freqData, newFreq]);
                              }}
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
                              <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Ajouter
                            </button>
                          </div>
                          {freqData.map((freq, idx) => (
                            <div key={`${service}_${idx}`} style={{ 
                              display: 'flex',
                              gap: '8px',
                              alignItems: 'center',
                              marginBottom: '8px'
                            }}>
                              <input
                                type="text"
                                value={freq.frequency || ''}
                                onChange={(e) => {
                                  const newFreqs = [...freqData];
                                  newFreqs[idx] = { ...freq, frequency: e.target.value };
                                  updateValue(`frequencies.${service}`, newFreqs);
                                }}
                                placeholder="Fréquence"
                                style={{
                                  ...sx.components.input.base,
                                  flex: '1',
                                  padding: '6px',
                                  fontSize: '14px'
                                }}
                              />
                              <input
                                type="text"
                                value={freq.schedule || ''}
                                onChange={(e) => {
                                  const newFreqs = [...freqData];
                                  newFreqs[idx] = { ...freq, schedule: e.target.value };
                                  updateValue(`frequencies.${service}`, newFreqs);
                                }}
                                placeholder="Horaire"
                                style={{
                                  ...sx.components.input.base,
                                  width: '80px',
                                  padding: '6px',
                                  fontSize: '14px'
                                }}
                              />
                              <input
                                type="text"
                                value={freq.remarks || ''}
                                onChange={(e) => {
                                  const newFreqs = [...freqData];
                                  newFreqs[idx] = { ...freq, remarks: e.target.value };
                                  updateValue(`frequencies.${service}`, newFreqs);
                                }}
                                placeholder="Remarques"
                                style={{
                                  ...sx.components.input.base,
                                  flex: '2',
                                  padding: '6px',
                                  fontSize: '14px'
                                }}
                              />
                              <button
                                onClick={() => {
                                  const newFreqs = freqData.filter((_, i) => i !== idx);
                                  updateValue(`frequencies.${service}`, newFreqs);
                                }}
                                style={{
                                  padding: '6px',
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
                          ))}
                        </div>
                      );
                    }
                    return null;
                  })}
                  
                  {/* Bouton pour ajouter un nouveau service */}
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: 'white', 
                    borderRadius: '6px',
                    border: '1px dashed #d1d5db',
                    textAlign: 'center'
                  }}>
                    <button
                      onClick={() => {
                        const serviceName = prompt('Nom du nouveau service (ex: DEL, AFIS, etc.):');
                        if (serviceName) {
                          const key = serviceName.toLowerCase().replace(/[^a-z]/g, '');
                          if (!editedData.frequencies[key]) {
                            updateValue(`frequencies.${key}`, [{ frequency: '', schedule: 'H24', remarks: '' }]);
                          }
                        }
                      }}
                      style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <Plus size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      Ajouter un nouveau service
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <p style={{ color: '#6b7280', marginBottom: '12px' }}>
                    Aucune fréquence disponible. Ajoutez des fréquences manuellement.
                  </p>
                  <button
                    onClick={() => {
                      updateValue('frequencies', {
                        twr: [{ frequency: '', schedule: 'H24', remarks: '' }],
                        gnd: [{ frequency: '', schedule: 'H24', remarks: '' }],
                        atis: [{ frequency: '', schedule: 'H24', remarks: '' }],
                        app: [{ frequency: '', schedule: 'H24', remarks: '' }]
                      });
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Initialiser les fréquences standards
                  </button>
                </div>
              )}
            </div>
          </div>
        );
        
      case 'vfr':
        return <VFREditor editedData={editedData} updateValue={updateValue} />;
      case 'obstacles':
        return <ObstaclesEditor editedData={editedData} updateValue={updateValue} />;
        
      case 'procedures':
        return <ProceduresEditor editedData={editedData} updateValue={updateValue} />;
        
      case 'services':
        return <ServicesEditor editedData={editedData} updateValue={updateValue} />;
        
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