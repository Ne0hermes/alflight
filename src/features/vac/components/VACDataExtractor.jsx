// src/features/vac/components/VACDataExtractor.jsx
import React, { memo, useState } from 'react';
import { Database, Download, Copy, CheckCircle, FileJson, FileText, Clipboard } from 'lucide-react';
import { useVACStore } from '@core/stores/vacStore';
import { sx } from '@shared/styles/styleSystem';

export const VACDataExtractor = memo(() => {
  const downloadedCharts = useVACStore(state => state.getDownloadedCharts());
  const [selectedIcao, setSelectedIcao] = useState('');
  const [exportFormat, setExportFormat] = useState('json');
  const [copiedField, setCopiedField] = useState(null);
  
  const selectedChart = downloadedCharts.find(c => c.icao === selectedIcao);
  const extractedData = selectedChart?.extractedData;
  
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
  
  return (
    <div style={sx.combine(sx.components.section.base, sx.spacing.mt(6))}>
      <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start, sx.spacing.gap(2))}>
        <Database size={20} />
        Extraction et utilisation des données VAC
      </h3>
      
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
          {/* Actions d'export */}
          <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
            <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                style={sx.combine(sx.components.input.base, { width: 'auto' })}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV (Pistes)</option>
                <option value="text">Texte</option>
              </select>
              
              <button
                onClick={exportData}
                style={sx.combine(sx.components.button.base, sx.components.button.primary)}
              >
                <Download size={16} />
                Exporter
              </button>
              
              <button
                onClick={copyAllData}
                style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
              >
                {copiedField === 'all' ? <CheckCircle size={16} /> : <Clipboard size={16} />}
                Copier tout
              </button>
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
              />
              <DataField 
                label="Nom" 
                value={selectedChart.name} 
                onCopy={() => copyToClipboard(selectedChart.name, 'name')}
                copied={copiedField === 'name'}
              />
              <DataField 
                label="Altitude terrain" 
                value={`${extractedData.airportElevation} ft`} 
                onCopy={() => copyToClipboard(extractedData.airportElevation, 'elevation')}
                copied={copiedField === 'elevation'}
              />
              {extractedData.circuitAltitude && (
                <DataField 
                  label="Tour de piste" 
                  value={`${extractedData.circuitAltitude} ft`} 
                  onCopy={() => copyToClipboard(extractedData.circuitAltitude, 'circuit')}
                  copied={copiedField === 'circuit'}
                />
              )}
              <DataField 
                label="Variation magnétique" 
                value={`${extractedData.magneticVariation}°`} 
                onCopy={() => copyToClipboard(extractedData.magneticVariation, 'variation')}
                copied={copiedField === 'variation'}
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
              {extractedData.runways.map((rwy, idx) => (
                <div key={idx} style={sx.combine(sx.components.card.base, sx.spacing.mb(2))}>
                  <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
                    Piste {rwy.identifier}
                  </h5>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <DataField 
                      label="QFU" 
                      value={`${rwy.qfu}°`} 
                      onCopy={() => copyToClipboard(rwy.qfu, `qfu-${idx}`)}
                      copied={copiedField === `qfu-${idx}`}
                    />
                    <DataField 
                      label="Longueur" 
                      value={`${rwy.length} m`} 
                      onCopy={() => copyToClipboard(rwy.length, `length-${idx}`)}
                      copied={copiedField === `length-${idx}`}
                    />
                    <DataField 
                      label="Largeur" 
                      value={`${rwy.width} m`} 
                      onCopy={() => copyToClipboard(rwy.width, `width-${idx}`)}
                      copied={copiedField === `width-${idx}`}
                    />
                    <DataField 
                      label="Surface" 
                      value={rwy.surface} 
                      onCopy={() => copyToClipboard(rwy.surface, `surface-${idx}`)}
                      copied={copiedField === `surface-${idx}`}
                    />
                  </div>
                </div>
              ))}
            </DataSection>
            
            {/* Fréquences */}
            <DataSection title="Fréquences radio">
              {Object.entries(extractedData.frequencies).map(([type, freq]) => (
                <DataField 
                  key={type}
                  label={type.toUpperCase()} 
                  value={`${freq} MHz`} 
                  onCopy={() => copyToClipboard(freq, `freq-${type}`)}
                  copied={copiedField === `freq-${type}`}
                />
              ))}
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
  );
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
));

// Composant pour un champ de donnée avec copie
const DataField = memo(({ label, value, onCopy, copied }) => (
  <div style={sx.combine(sx.flex.between, sx.spacing.p(2), sx.bg.gray, sx.rounded.md)}>
    <div>
      <span style={sx.combine(sx.text.sm, sx.text.secondary)}>{label} :</span>
      <strong style={sx.combine(sx.text.sm, sx.spacing.ml(2))}>{value}</strong>
    </div>
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
  </div>
));

// Export des display names
VACDataExtractor.displayName = 'VACDataExtractor';
DataSection.displayName = 'DataSection';
DataField.displayName = 'DataField';

export default VACDataExtractor;