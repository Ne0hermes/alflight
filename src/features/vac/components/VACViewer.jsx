// src/features/vac/components/VACViewer.jsx
import React, { memo, useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize2, Info } from 'lucide-react';
import { useVACStore } from '@core/stores/vacStore';
import { sx } from '@shared/styles/styleSystem';

export const VACViewer = memo(() => {
  const selectedChart = useVACStore(state => state.selectedChart);
  const charts = useVACStore(state => state.charts);
  const { selectChart } = useVACStore();
  
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [page, setPage] = useState(1);
  
  const chart = selectedChart ? charts[selectedChart] : null;
  
  // Reset zoom et rotation quand on change de carte
  useEffect(() => {
    setZoom(100);
    setRotation(0);
    setPage(1);
  }, [selectedChart]);
  
  if (!chart || !chart.isDownloaded) return null;
  
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleDownload = () => {
    // En production, télécharger le PDF réel
    window.open(chart.url, '_blank');
  };
  
  return (
    <div style={styles.overlay}>
      <div style={styles.viewer}>
        {/* En-tête */}
        <div style={styles.header}>
          <div style={sx.combine(sx.flex.start, sx.spacing.gap(3))}>
            <h3 style={sx.combine(sx.text.lg, sx.text.bold, { margin: 0 })}>
              {chart.icao} - {chart.name}
            </h3>
            {chart.extractedData && (
              <span style={sx.combine(sx.text.sm, sx.text.secondary)}>
                Alt: {chart.extractedData.airportElevation} ft • 
                {chart.extractedData.runways.length} piste(s)
              </span>
            )}
          </div>
          
          <button
            onClick={() => selectChart(null)}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Barre d'outils */}
        <div style={styles.toolbar}>
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
            <button
              onClick={handleZoomIn}
              style={styles.toolButton}
              title="Zoom avant"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={handleZoomOut}
              style={styles.toolButton}
              title="Zoom arrière"
            >
              <ZoomOut size={18} />
            </button>
            <span style={styles.zoomIndicator}>{zoom}%</span>
          </div>
          
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
            <button
              onClick={handleRotate}
              style={styles.toolButton}
              title="Rotation"
            >
              <RotateCw size={18} />
            </button>
            <button
              onClick={handleDownload}
              style={styles.toolButton}
              title="Télécharger PDF"
            >
              <Download size={18} />
            </button>
            <button
              onClick={() => {/* Plein écran */}}
              style={styles.toolButton}
              title="Plein écran"
            >
              <Maximize2 size={18} />
            </button>
          </div>
        </div>
        
        {/* Zone de visualisation */}
        <div style={styles.pdfContainer}>
          {/* En mode démo, afficher une simulation de carte VAC */}
          <DemoVACChart chart={chart} zoom={zoom} rotation={rotation} />
        </div>
        
        {/* Panneau d'information */}
        <div style={styles.infoPanel}>
          <div style={sx.combine(sx.flex.start, sx.spacing.gap(2))}>
            <Info size={16} style={{ color: sx.theme.colors.primary[600] }} />
            <p style={sx.combine(sx.text.sm, { margin: 0 })}>
              Utilisez la molette de la souris pour zoomer, cliquez et glissez pour déplacer la carte
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

// Composant de démonstration pour simuler une carte VAC
const DemoVACChart = memo(({ chart, zoom, rotation }) => {
  const data = chart.extractedData;
  
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'auto',
      backgroundColor: '#f3f4f6'
    }}>
      <div style={{
        transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
        transformOrigin: 'center',
        transition: 'transform 0.3s',
        backgroundColor: 'white',
        padding: '40px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        minWidth: '600px',
        minHeight: '800px'
      }}>
        {/* En-tête de la carte */}
        <div style={{
          textAlign: 'center',
          marginBottom: '30px',
          borderBottom: '2px solid #1f2937',
          paddingBottom: '20px'
        }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
            {chart.icao}
          </h1>
          <h2 style={{ fontSize: '24px', color: '#6b7280', margin: 0 }}>
            {chart.name}
          </h2>
        </div>
        
        {/* Informations terrain */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
            INFORMATIONS TERRAIN
          </h3>
          <table style={{ width: '100%', fontSize: '14px' }}>
            <tbody>
              <tr>
                <td style={styles.tableCell}>Altitude de référence :</td>
                <td style={styles.tableCell}><strong>{data?.airportElevation || 0} ft</strong></td>
              </tr>
              {data?.circuitAltitude && (
                <tr>
                  <td style={styles.tableCell}>Altitude de tour de piste :</td>
                  <td style={styles.tableCell}><strong>{data.circuitAltitude} ft</strong></td>
                </tr>
              )}
              <tr>
                <td style={styles.tableCell}>Variation magnétique :</td>
                <td style={styles.tableCell}><strong>{data?.magneticVariation || 0}° E</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Caractéristiques des pistes */}
        {data?.runways && data.runways.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              CARACTÉRISTIQUES DES PISTES
            </h3>
            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={styles.tableHeader}>Piste</th>
                  <th style={styles.tableHeader}>QFU</th>
                  <th style={styles.tableHeader}>Dimensions</th>
                  <th style={styles.tableHeader}>Revêtement</th>
                </tr>
              </thead>
              <tbody>
                {data.runways.map((rwy, idx) => (
                  <tr key={idx}>
                    <td style={styles.tableCell}>{rwy.identifier}</td>
                    <td style={styles.tableCell}>{rwy.qfu}°</td>
                    <td style={styles.tableCell}>{rwy.length} × {rwy.width} m</td>
                    <td style={styles.tableCell}>{rwy.surface}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Fréquences */}
        {data?.frequencies && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              FRÉQUENCES RADIO
            </h3>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <tbody>
                {Object.entries(data.frequencies).map(([type, freq]) => (
                  <tr key={type}>
                    <td style={styles.tableCell}>{type.toUpperCase()} :</td>
                    <td style={styles.tableCell}><strong>{freq} MHz</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Schéma de piste simplifié */}
        <div style={{
          marginTop: '40px',
          padding: '20px',
          border: '2px solid #e5e7eb',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            [Schéma de l'aérodrome]
          </p>
          <div style={{
            margin: '20px auto',
            width: '400px',
            height: '200px',
            backgroundColor: '#f9fafb',
            border: '1px dashed #9ca3af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: '#9ca3af' }}>
              Vue aérienne de l'aérodrome
            </span>
          </div>
        </div>
        
        {/* Note de démonstration */}
        <div style={{
          marginTop: '40px',
          padding: '15px',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#92400e',
          textAlign: 'center'
        }}>
          <strong>MODE DÉMONSTRATION</strong><br />
          En production, la carte VAC PDF officielle serait affichée ici
        </div>
      </div>
    </div>
  );
});

// Styles
const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  viewer: {
    width: '90%',
    height: '90%',
    maxWidth: '1400px',
    backgroundColor: 'white',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    padding: '16px 24px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  toolbar: {
    padding: '12px 24px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  toolButton: {
    padding: '8px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: '#f3f4f6',
      borderColor: '#d1d5db'
    }
  },
  zoomIndicator: {
    padding: '4px 12px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500'
  },
  pdfContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb'
  },
  infoPanel: {
    padding: '12px 24px',
    backgroundColor: '#f0f9ff',
    borderTop: '1px solid #bae6fd'
  },
  tableCell: {
    padding: '8px',
    borderBottom: '1px solid #e5e7eb'
  },
  tableHeader: {
    padding: '8px',
    fontWeight: 'bold',
    textAlign: 'left',
    borderBottom: '2px solid #d1d5db'
  }
};

VACViewer.displayName = 'VACViewer';
DemoVACChart.displayName = 'DemoVACChart';

export default VACViewer;