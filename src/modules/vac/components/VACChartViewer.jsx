// src/modules/vac/components/VACChartViewer.jsx
import React, { useState, useEffect } from 'react';
import { useVACStore } from '../store/vacStore';
import { ZoomIn, ZoomOut, RotateCw, Download, Printer, ChevronLeft, ChevronRight } from 'lucide-react';

export const VACChartViewer = ({ chart }) => {
  const { getChartPDF } = useVACStore();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(100);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    loadPDF();
    return () => {
      // Nettoyer l'URL quand le composant est démonté
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [chart.id]);

  const loadPDF = async () => {
    setLoading(true);
    setError(null);
    try {
      const blob = await getChartPDF(chart.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } else {
        setError('Carte non trouvée dans le cache');
      }
    } catch (err) {
      setError('Erreur lors du chargement de la carte');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleZoom = (delta) => {
    setScale(prevScale => {
      const newScale = prevScale + delta;
      return Math.min(Math.max(50, newScale), 300);
    });
  };

  const handleRotate = () => {
    setRotation(prevRotation => (prevRotation + 90) % 360);
  };

  const handlePrint = () => {
    if (pdfUrl) {
      const printWindow = window.open(pdfUrl);
      if (printWindow) {
        printWindow.print();
      }
    }
  };

  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${chart.airportIcao}_${chart.type}_${chart.version}.pdf`;
      link.click();
    }
  };

  // Styles
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#f3f4f6'
  };

  const toolbarStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: 'white',
    borderBottom: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  };

  const viewerStyle = {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  };

  const buttonStyle = {
    padding: '8px',
    backgroundColor: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '14px',
    color: '#374151',
    transition: 'all 0.2s'
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6b7280' }}>Chargement de la carte...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#ef4444' }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>⚠️ {error}</p>
          <button onClick={loadPDF} style={{ ...buttonStyle, border: '1px solid #ef4444', color: '#ef4444' }}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
            {chart.airportIcao} - {chart.type} (v{chart.version})
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Zoom */}
          <button
            onClick={() => handleZoom(-10)}
            style={buttonStyle}
            title="Zoom arrière"
          >
            <ZoomOut size={16} />
          </button>
          <span style={{ 
            padding: '8px 12px', 
            backgroundColor: '#f3f4f6', 
            borderRadius: '6px',
            fontSize: '14px',
            minWidth: '60px',
            textAlign: 'center'
          }}>
            {scale}%
          </span>
          <button
            onClick={() => handleZoom(10)}
            style={buttonStyle}
            title="Zoom avant"
          >
            <ZoomIn size={16} />
          </button>

          <div style={{ width: '1px', backgroundColor: '#e5e7eb', margin: '0 8px' }} />

          {/* Rotation */}
          <button
            onClick={handleRotate}
            style={buttonStyle}
            title="Rotation"
          >
            <RotateCw size={16} />
          </button>

          <div style={{ width: '1px', backgroundColor: '#e5e7eb', margin: '0 8px' }} />

          {/* Actions */}
          <button
            onClick={handlePrint}
            style={buttonStyle}
            title="Imprimer"
          >
            <Printer size={16} />
          </button>
          <button
            onClick={handleDownload}
            style={buttonStyle}
            title="Télécharger"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div style={viewerStyle}>
        {pdfUrl && (
          <iframe
            src={pdfUrl}
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '1000px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              backgroundColor: 'white',
              transform: `scale(${scale / 100}) rotate(${rotation}deg)`,
              transformOrigin: 'center',
              transition: 'transform 0.3s'
            }}
            title={`${chart.airportIcao} VAC Chart`}
          />
        )}
      </div>

      {/* Informations carte */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'white',
        borderTop: '1px solid #e5e7eb',
        fontSize: '12px',
        color: '#6b7280',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>
          Valide du {new Date(chart.effectiveDate).toLocaleDateString('fr-FR')} au{' '}
          {new Date(chart.expiryDate).toLocaleDateString('fr-FR')}
        </span>
        {chart.downloadDate && (
          <span>
            Téléchargée le {new Date(chart.downloadDate).toLocaleDateString('fr-FR')}
          </span>
        )}
      </div>
    </div>
  );
};