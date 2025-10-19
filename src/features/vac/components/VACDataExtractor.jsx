// src/features/vac/components/VACDataExtractor.jsx
import React, { memo, useState, useEffect } from 'react';
import { Database, Download, Copy, CheckCircle, FileJson, FileText, Clipboard, Edit2, Save, X, AlertTriangle, Plus, Trash2, Info } from 'lucide-react';
import { useVACStore, vacSelectors } from '@core/stores/vacStore';
import { sx } from '@shared/styles/styleSystem';

export const VACDataExtractor = memo(() => {
  const downloadedCharts = useVACStore(state => state.getDownloadedCharts());
  const { updateExtractedData } = vacSelectors.useVACActions();
  const [selectedIcao, setSelectedIcao] = useState('');
  const [exportFormat, setExportFormat] = useState('json');
  const [copiedField, setCopiedField] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState(null);
  const [hasModifications, setHasModifications] = useState(false);
  
  const selectedChart = downloadedCharts.find(c => c.icao === selectedIcao);
  const extractedData = selectedChart?.extractedData;
  
  // Initialiser les données éditées quand on change de carte
  useEffect(() => {
    if (extractedData) {
      const clonedData = JSON.parse(JSON.stringify(extractedData));
      // S'assurer que vfrPoints existe
      if (!clonedData.vfrPoints) {
        clonedData.vfrPoints = [];
      }
      setEditedData(clonedData);
    }
  }, [selectedIcao, extractedData]);
  
  // Copier une valeur dans le presse-papier
  const copyToClipboard = async (value, field) => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Erreur copie:', err);
    }
  };
  
  // Exporter toutes les données
  const exportData = () => {
    if (!extractedData) return;
    
    const dataToExport = {
      icao: selectedChart.icao,
      name: selectedChart.name,
      coordinates: selectedChart.coordinates,
      extractedData: extractedData,
      exportDate: new Date().toISOString()
    };
    
    let content, filename, mimeType;
    
    switch (exportFormat) {
      case 'json':
        content = JSON.stringify(dataToExport, null, 2);
        filename = `${selectedIcao}_data.json`;
        mimeType = 'application/json';
        break;
        
      case 'csv':
        // Format CSV pour les pistes
        const csvRows = ['Piste,QFU,Longueur,Largeur,Surface'];
        extractedData.runways.forEach(rwy => {
          csvRows.push(`${rwy.identifier},${rwy.qfu},${rwy.length},${rwy.width},${rwy.surface}`);
        });
        content = csvRows.join('\n');
        filename = `${selectedIcao}_runways.csv`;
        mimeType = 'text/csv';
        break;
        
      case 'text':
        // Format texte lisible
        content = `DONNÉES EXTRAITES - ${selectedChart.name} (${selectedIcao})\n`;
        content += `${'='.repeat(50)}\n\n`;
        content += `INFORMATIONS GÉNÉRALES\n`;
        content += `Altitude terrain : ${extractedData.airportElevation} ft\n`;
        content += `Tour de piste : ${extractedData.circuitAltitude || 'N/A'} ft\n`;
        content += `Variation magnétique : ${extractedData.magneticVariation}°\n\n`;
        
        content += `PISTES\n`;
        extractedData.runways.forEach(rwy => {
          content += `- ${rwy.identifier} : ${rwy.length}×${rwy.width}m, QFU ${rwy.qfu}°, ${rwy.surface}\n`;
        });
        
        content += `\nFRÉQUENCES\n`;
        Object.entries(extractedData.frequencies).forEach(([type, freq]) => {
          content += `- ${type.toUpperCase()} : ${freq} MHz\n`;
        });
        
        filename = `${selectedIcao}_data.txt`;
        mimeType = 'text/plain';
        break;
    }
    
    // Télécharger le fichier
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Copier toutes les données en JSON
  const copyAllData = async () => {
    if (!extractedData) return;
    
    const dataToExport = {
      icao: selectedChart.icao,
      name: selectedChart.name,
      coordinates: selectedChart.coordinates,
      ...extractedData
    };
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(dataToExport, null, 2));
      setCopiedField('all');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Erreur copie:', err);
    }
  };
  
  // Activer le mode édition
  const startEdit = () => {
    setEditMode(true);
    setEditedData(JSON.parse(JSON.stringify(extractedData)));
  };
  
  // Sauvegarder les modifications
  const saveEdit = () => {
    if (editedData && selectedIcao) {
      updateExtractedData(selectedIcao, {
        ...editedData,
        manuallyModified: true,
        modificationDate: Date.now()
      });
      setEditMode(false);
      setHasModifications(false);
    }
  };
  
  // Annuler les modifications
  const cancelEdit = () => {
    setEditMode(false);
    setEditedData(JSON.parse(JSON.stringify(extractedData)));
    setHasModifications(false);
  };
  
  // Mettre à jour une valeur éditée
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
  
  // Ajouter une nouvelle fréquence
  const addFrequency = (type) => {
    const newData = { ...editedData };
    if (!newData.frequencies[type]) {
      newData.frequencies[type] = 0;
      setEditedData(newData);
      setHasModifications(true);
    }
  };
  
  // Ajouter une nouvelle piste
  const addRunway = () => {
    const newData = { ...editedData };
    newData.runways.push({
      identifier: 'XX/XX',
      qfu: 0,
      length: 0,
      width: 0,
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
  
  // Ajouter un nouveau point VFR
  const addVFRPoint = () => {
    const newData = { ...editedData };
    if (!newData.vfrPoints) {
      newData.vfrPoints = [];
    }
    newData.vfrPoints.push({
      id: `vfr-${Date.now()}`,
      name: 'Nouveau point',
      code: 'XX',
      mandatory: false,
      coordinates: {
        lat: selectedChart.coordinates.lat,
        lon: selectedChart.coordinates.lon
      },
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
  
  return (
    <div>
      {/* Information sur les fonctionnalités */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
        <Info size={20} />
        <div>
          <p style={sx.combine(sx.text.sm, sx.text.bold)}>
            Fonctionnalités de cette section :
          </p>
          <ul style={{ paddingLeft: '20px', fontSize: '13px', marginTop: '8px' }}>
            <li>Visualiser les données extraites des cartes VAC téléchargées</li>
            <li><strong>Modifier</strong> les données existantes (altitude, pistes, fréquences, etc.)</li>
            <li><strong>Ajouter</strong> de nouvelles pistes, points VFR et fréquences</li>
            <li>Les modifications sont automatiquement sauvegardées et utilisées dans toute l'application</li>
          </ul>
        </div>
      </div>
      
      {/* Sélection de la carte */}
      <div style={sx.spacing.mb(4)}>
        <label style={sx.components.label.base}>
          Sélectionner une carte téléchargée
        </label>
        <select
          value={selectedIcao}
          onChange={(e) => setSelectedIcao(e.target.value)}
          style={sx.components.input.base}
        >
          <option value="">-- Choisir une carte --</option>
          {downloadedCharts.map(chart => (
            <option key={chart.icao} value={chart.icao}>
              {chart.icao} - {chart.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* Affichage des données extraites */}
      {selectedChart && extractedData && (
        <>
          {/* Notification si données à saisir */}
          {extractedData.needsManualExtraction && !extractedData.manuallyModified && (
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mb(4))}>
              <AlertTriangle size={20} />
              <div>
                <p style={sx.text.sm}>
                  <strong>⚠️ Données à compléter - Carte importée manuellement</strong>
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  Cette carte a été importée manuellement et nécessite la saisie des données. 
                  Cliquez sur "Modifier" pour ajouter les informations de la carte VAC (altitude terrain, pistes, fréquences, etc.).
                </p>
              </div>
            </div>
          )}
          
          {/* Notification si données modifiées manuellement */}
          {extractedData.manuallyModified && (
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
              <AlertTriangle size={16} />
              <div>
                <p style={sx.text.sm}>
                  <strong>Données modifiées manuellement</strong>
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  Ces données ont été modifiées le {new Date(extractedData.modificationDate).toLocaleDateString('fr-FR')} 
                  et peuvent différer de la carte VAC originale.
                </p>
              </div>
            </div>
          )}
          
          {/* Actions d'export et édition */}
          <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
            <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                style={sx.combine(sx.components.input.base, { width: 'auto' })}
                disabled={editMode}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV (Pistes)</option>
                <option value="text">Texte</option>
              </select>
              
              <button
                onClick={exportData}
                style={sx.combine(sx.components.button.base, sx.components.button.primary)}
                disabled={editMode}
              >
                <Download size={16} />
                Exporter
              </button>
              
              <button
                onClick={copyAllData}
                style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
                disabled={editMode}
              >
                {copiedField === 'all' ? <CheckCircle size={16} /> : <Clipboard size={16} />}
                Copier tout
              </button>
            </div>
            
            <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
              {!editMode ? (
                <button
                  onClick={startEdit}
                  style={sx.combine(sx.components.button.base, sx.components.button.warning)}
                >
                  <Edit2 size={16} />
                  Modifier
                </button>
              ) : (
                <>
                  <button
                    onClick={saveEdit}
                    style={sx.combine(sx.components.button.base, sx.components.button.success)}
                    disabled={!hasModifications}
                  >
                    <Save size={16} />
                    Enregistrer
                  </button>
                  <button
                    onClick={cancelEdit}
                    style={sx.combine(sx.components.button.base, sx.components.button.danger)}
                  >
                    <X size={16} />
                    Annuler
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Données extraites avec copie individuelle */}
          <div style={{ display: 'grid', gap: '16px' }}>
            {/* Informations générales */}
            <DataSection title="Informations générales">
              <DataField 
                label="Code OACI" 
                value={selectedChart.icao} 
                onCopy={() => copyToClipboard(selectedChart.icao, 'icao')}
                copied={copiedField === 'icao'}
                editMode={false} // Code OACI non modifiable
              />
              <DataField 
                label="Nom" 
                value={selectedChart.name} 
                onCopy={() => copyToClipboard(selectedChart.name, 'name')}
                copied={copiedField === 'name'}
                editMode={false} // Nom non modifiable
              />
              <DataField 
                label="Altitude terrain" 
                value={editMode ? editedData.airportElevation : `${extractedData.airportElevation} ft`} 
                onCopy={() => copyToClipboard(extractedData.airportElevation, 'elevation')}
                copied={copiedField === 'elevation'}
                editMode={editMode}
                onChange={(val) => updateValue('airportElevation', parseInt(val) || 0)}
                type="number"
                isModified={editedData?.airportElevation !== extractedData.airportElevation}
              />
              <DataField 
                label="Tour de piste" 
                value={editMode ? (editedData.circuitAltitude || '') : `${extractedData.circuitAltitude || 'N/A'} ft`} 
                onCopy={() => copyToClipboard(extractedData.circuitAltitude, 'circuit')}
                copied={copiedField === 'circuit'}
                editMode={editMode}
                onChange={(val) => updateValue('circuitAltitude', parseInt(val) || 0)}
                type="number"
                isModified={editedData?.circuitAltitude !== extractedData.circuitAltitude}
              />
              <DataField 
                label="Variation magnétique" 
                value={editMode ? editedData.magneticVariation : `${extractedData.magneticVariation}°`} 
                onCopy={() => copyToClipboard(extractedData.magneticVariation, 'variation')}
                copied={copiedField === 'variation'}
                editMode={editMode}
                onChange={(val) => updateValue('magneticVariation', parseFloat(val) || 0)}
                type="number"
                isModified={editedData?.magneticVariation !== extractedData.magneticVariation}
              />
            </DataSection>
            
            {/* Coordonnées */}
            <DataSection title="Coordonnées">
              <DataField 
                label="Latitude" 
                value={selectedChart.coordinates.lat.toFixed(6)} 
                onCopy={() => copyToClipboard(selectedChart.coordinates.lat, 'lat')}
                copied={copiedField === 'lat'}
              />
              <DataField 
                label="Longitude" 
                value={selectedChart.coordinates.lon.toFixed(6)} 
                onCopy={() => copyToClipboard(selectedChart.coordinates.lon, 'lon')}
                copied={copiedField === 'lon'}
              />
              <DataField 
                label="Format décimal" 
                value={`${selectedChart.coordinates.lat.toFixed(6)}, ${selectedChart.coordinates.lon.toFixed(6)}`} 
                onCopy={() => copyToClipboard(`${selectedChart.coordinates.lat.toFixed(6)}, ${selectedChart.coordinates.lon.toFixed(6)}`, 'coords')}
                copied={copiedField === 'coords'}
              />
            </DataSection>
            
            {/* Pistes */}
            <DataSection title="Caractéristiques des pistes">
              {(editMode ? editedData.runways : extractedData.runways).map((rwy, idx) => (
                <div key={idx} style={sx.combine(sx.components.card.base, sx.spacing.mb(2))}>
                  <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                    <h5 style={sx.text.base}>
                      {editMode ? (
                        <input
                          type="text"
                          value={rwy.identifier}
                          onChange={(e) => updateValue(`runways.${idx}.identifier`, e.target.value)}
                          style={sx.combine(sx.components.input.base, { width: '150px', fontWeight: 'bold' })}
                        />
                      ) : (
                        <strong>Piste {rwy.identifier}</strong>
                      )}
                    </h5>
                    {editMode && (
                      <button
                        onClick={() => removeRunway(idx)}
                        style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '4px 8px' })}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <DataField 
                      label="QFU" 
                      value={editMode ? rwy.qfu : `${rwy.qfu}°`} 
                      onCopy={() => copyToClipboard(rwy.qfu, `qfu-${idx}`)}
                      copied={copiedField === `qfu-${idx}`}
                      editMode={editMode}
                      onChange={(val) => updateValue(`runways.${idx}.qfu`, parseInt(val) || 0)}
                      type="number"
                      isModified={editedData?.runways[idx]?.qfu !== extractedData.runways[idx]?.qfu}
                    />
                    <DataField 
                      label="Longueur" 
                      value={editMode ? rwy.length : `${rwy.length} m`} 
                      onCopy={() => copyToClipboard(rwy.length, `length-${idx}`)}
                      copied={copiedField === `length-${idx}`}
                      editMode={editMode}
                      onChange={(val) => updateValue(`runways.${idx}.length`, parseInt(val) || 0)}
                      type="number"
                      isModified={editedData?.runways[idx]?.length !== extractedData.runways[idx]?.length}
                    />
                    <DataField 
                      label="Largeur" 
                      value={editMode ? rwy.width : `${rwy.width} m`} 
                      onCopy={() => copyToClipboard(rwy.width, `width-${idx}`)}
                      copied={copiedField === `width-${idx}`}
                      editMode={editMode}
                      onChange={(val) => updateValue(`runways.${idx}.width`, parseInt(val) || 0)}
                      type="number"
                      isModified={editedData?.runways[idx]?.width !== extractedData.runways[idx]?.width}
                    />
                    <DataField 
                      label="Surface" 
                      value={rwy.surface} 
                      onCopy={() => copyToClipboard(rwy.surface, `surface-${idx}`)}
                      copied={copiedField === `surface-${idx}`}
                      editMode={editMode}
                      onChange={(val) => updateValue(`runways.${idx}.surface`, val)}
                      isModified={editedData?.runways[idx]?.surface !== extractedData.runways[idx]?.surface}
                    />
                  </div>
                </div>
              ))}
              {editMode && (
                <button
                  onClick={addRunway}
                  style={sx.combine(sx.components.button.base, sx.components.button.primary, sx.spacing.mt(2))}
                >
                  <Plus size={16} />
                  Ajouter une piste
                </button>
              )}
            </DataSection>
            
            {/* Fréquences */}
            <DataSection title="Fréquences radio">
              {Object.entries(editMode ? editedData.frequencies : extractedData.frequencies).map(([type, freq]) => (
                <DataField 
                  key={type}
                  label={type.toUpperCase()} 
                  value={editMode ? freq : `${freq} MHz`} 
                  onCopy={() => copyToClipboard(freq, `freq-${type}`)}
                  copied={copiedField === `freq-${type}`}
                  editMode={editMode}
                  onChange={(val) => updateValue(`frequencies.${type}`, parseFloat(val) || 0)}
                  type="number"
                  isModified={editedData?.frequencies?.[type] !== extractedData.frequencies?.[type]}
                />
              ))}
              {editMode && (
                <div style={sx.spacing.mt(2)}>
                  <button
                    onClick={() => addFrequency('afis')}
                    style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '6px 12px', fontSize: '13px', marginRight: '8px' })}
                  >
                    + AFIS
                  </button>
                  <button
                    onClick={() => addFrequency('atis')}
                    style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '6px 12px', fontSize: '13px' })}
                  >
                    + ATIS
                  </button>
                </div>
              )}
            </DataSection>
            
            {/* Points de report VFR */}
            <DataSection title="Points de report VFR">
              {(editMode ? editedData.vfrPoints : extractedData.vfrPoints || []).map((point, idx) => (
                <div key={idx} style={sx.combine(sx.components.card.base, sx.spacing.mb(2))}>
                  <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                    <h5 style={sx.text.base}>
                      {editMode ? (
                        <input
                          type="text"
                          value={point.name}
                          onChange={(e) => updateValue(`vfrPoints.${idx}.name`, e.target.value)}
                          style={sx.combine(sx.components.input.base, { width: '200px', fontWeight: 'bold' })}
                        />
                      ) : (
                        <strong>{point.name}</strong>
                      )}
                    </h5>
                    {editMode && (
                      <button
                        onClick={() => removeVFRPoint(idx)}
                        style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '4px 8px' })}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <DataField 
                      label="Code" 
                      value={point.code} 
                      onCopy={() => copyToClipboard(point.code, `vfr-code-${idx}`)}
                      copied={copiedField === `vfr-code-${idx}`}
                      editMode={editMode}
                      onChange={(val) => updateValue(`vfrPoints.${idx}.code`, val)}
                      isModified={editedData?.vfrPoints?.[idx]?.code !== extractedData.vfrPoints?.[idx]?.code}
                    />
                    <DataField 
                      label="Type" 
                      value={point.mandatory ? 'Obligatoire' : 'Facultatif'} 
                      editMode={editMode}
                      onChange={(val) => updateValue(`vfrPoints.${idx}.mandatory`, val === 'Obligatoire')}
                      isModified={editedData?.vfrPoints?.[idx]?.mandatory !== extractedData.vfrPoints?.[idx]?.mandatory}
                    />
                    <DataField 
                      label="Latitude" 
                      value={editMode ? (point.coordinates?.lat || 0) : point.coordinates?.lat?.toFixed(6)} 
                      onCopy={() => copyToClipboard(point.coordinates?.lat, `vfr-lat-${idx}`)}
                      copied={copiedField === `vfr-lat-${idx}`}
                      editMode={editMode}
                      onChange={(val) => updateValue(`vfrPoints.${idx}.coordinates.lat`, parseFloat(val) || 0)}
                      type="number"
                      isModified={editedData?.vfrPoints?.[idx]?.coordinates?.lat !== extractedData.vfrPoints?.[idx]?.coordinates?.lat}
                    />
                    <DataField 
                      label="Longitude" 
                      value={editMode ? (point.coordinates?.lon || 0) : point.coordinates?.lon?.toFixed(6)} 
                      onCopy={() => copyToClipboard(point.coordinates?.lon, `vfr-lon-${idx}`)}
                      copied={copiedField === `vfr-lon-${idx}`}
                      editMode={editMode}
                      onChange={(val) => updateValue(`vfrPoints.${idx}.coordinates.lon`, parseFloat(val) || 0)}
                      type="number"
                      isModified={editedData?.vfrPoints?.[idx]?.coordinates?.lon !== extractedData.vfrPoints?.[idx]?.coordinates?.lon}
                    />
                    <DataField 
                      label="Description" 
                      value={point.description || ''} 
                      onCopy={() => copyToClipboard(point.description, `vfr-desc-${idx}`)}
                      copied={copiedField === `vfr-desc-${idx}`}
                      editMode={editMode}
                      onChange={(val) => updateValue(`vfrPoints.${idx}.description`, val)}
                      isModified={editedData?.vfrPoints?.[idx]?.description !== extractedData.vfrPoints?.[idx]?.description}
                    />
                  </div>
                </div>
              ))}
              {editMode && (
                <button
                  onClick={addVFRPoint}
                  style={sx.combine(sx.components.button.base, sx.components.button.primary, sx.spacing.mt(2))}
                >
                  <Plus size={16} />
                  Ajouter un point VFR
                </button>
              )}
            </DataSection>
          </div>
          
          {/* Note d'utilisation */}
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(4))}>
            <div>
              <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                💡 Utilisation des données extraites
              </p>
              <ul style={{ paddingLeft: '20px', fontSize: '13px', marginTop: '8px' }}>
                <li>Cliquez sur <Copy size={12} style={{ display: 'inline' }} /> pour copier une valeur individuelle</li>
                <li>Utilisez "Copier tout" pour obtenir l'ensemble des données en JSON</li>
                <li>Exportez en JSON pour une intégration dans d'autres applications</li>
                <li>Exportez en CSV pour utiliser les données de pistes dans un tableur</li>
                <li>Les données sont automatiquement utilisées dans les calculs de performance</li>
                <li>Les points VFR ajoutés ou modifiés sont disponibles dans l'onglet Navigation</li>
                <li>Les données modifiées sont marquées visuellement pour indiquer leur source</li>
              </ul>
            </div>
          </div>
        </>
      )}
      
      {/* Message si aucune carte téléchargée */}
      {downloadedCharts.length === 0 && (
        <div style={sx.combine(sx.text.center, sx.text.secondary, sx.spacing.p(8))}>
          Aucune carte VAC téléchargée. Téléchargez des cartes pour extraire leurs données.
        </div>
      )}
    </div>

});

// Composant pour une section de données
const DataSection = memo(({ title, children }) => (
  <div style={sx.components.card.base}>
    <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
      {title}
    </h4>
    <div style={{ display: 'grid', gap: '12px' }}>
      {children}
    </div>
  </div>

// Composant pour un champ de donnée avec copie et édition
const DataField = memo(({ label, value, onCopy, copied, editMode, onChange, type = 'text', isModified = false }) => {
  // Pour le type select dans le mode édition
  if (editMode && onChange && label === 'Type') {
    return (
      <div style={sx.combine(
        sx.flex.between, 
        sx.spacing.p(2), 
        sx.bg.gray, 
        sx.rounded.md,
        isModified && { backgroundColor: '#fef3c7', borderLeft: '3px solid #f59e0b' }
      )}>
        <div style={{ flex: 1 }}>
          <span style={sx.combine(sx.text.sm, sx.text.secondary)}>
            {label} :
            {isModified && (
              <span style={sx.combine(sx.text.xs, sx.text.warning, sx.spacing.ml(2))}>
                (modifié)
              </span>
            )}
          </span>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={sx.combine(
              sx.components.input.base, 
              sx.spacing.ml(2), 
              sx.spacing.mt(1),
              { width: 'calc(100% - 100px)' }
            )}
          >
            <option value="Obligatoire">Obligatoire</option>
            <option value="Facultatif">Facultatif</option>
          </select>
        </div>
      </div>
    );
  }
  
  return (
  <div style={sx.combine(
    sx.flex.between, 
    sx.spacing.p(2), 
    sx.bg.gray, 
    sx.rounded.md,
    isModified && { backgroundColor: '#fef3c7', borderLeft: '3px solid #f59e0b' }
  )}>
    <div style={{ flex: 1 }}>
      <span style={sx.combine(sx.text.sm, sx.text.secondary)}>
        {label} :
        {isModified && (
          <span style={sx.combine(sx.text.xs, sx.text.warning, sx.spacing.ml(2))}>
            (modifié)
          </span>
        )}
      </span>
      {editMode && onChange ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={sx.combine(
            sx.components.input.base, 
            sx.spacing.ml(2), 
            sx.spacing.mt(1),
            { width: 'calc(100% - 100px)' }
          )}
        />
      ) : (
        <strong style={sx.combine(sx.text.sm, sx.spacing.ml(2))}>{value}</strong>
      )}
    </div>
    {!editMode && (
      <button
        onClick={onCopy}
        style={{
          padding: '4px 8px',
          backgroundColor: copied ? '#10b981' : '#f3f4f6',
          border: `1px solid ${copied ? '#10b981' : '#e5e7eb'}`,
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        title="Copier dans le presse-papier"
      >
        {copied ? <CheckCircle size={14} color="white" /> : <Copy size={14} color="#6b7280" />}
      </button>
    )}
  </div>

});

// Export des display names
VACDataExtractor.displayName = 'VACDataExtractor';
DataSection.displayName = 'DataSection';
DataField.displayName = 'DataField';

export default VACDataExtractor;