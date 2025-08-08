// src/features/aircraft/components/ManexImporter.jsx
import React, { memo, useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, X, Eye, Download, Trash2, BarChart3 } from 'lucide-react';
// Style system removed - using inline styles
import { generateDefaultChart } from '../utils/performanceCharts';
import ManexImporterFallback from './ManexImporterFallback';
import PdfExtractor from './PdfExtractor';
import SimplePdfReader from './SimplePdfReader';
import { showNotification } from '../../../shared/components/Notification';

export const ManexImporter = memo(({ 
  aircraft, 
  onManexUpdate,
  onClose 
}) => {
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [useFallback, setUseFallback] = useState(false);
  const [usePdfJs, setUsePdfJs] = useState(true);
  const fileInputRef = useRef(null);

  // Si on veut utiliser le mode fallback
  if (useFallback) {
    return <ManexImporterFallback aircraft={aircraft} onManexUpdate={onManexUpdate} onClose={onClose} />;
  }

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      setError('Veuillez sélectionner un fichier PDF');
      return;
    }

    setPdfFile(file);
    setError(null);
    setLoading(true);

    // Créer URL de prévisualisation
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  // Callback pour quand PdfExtractor a extrait les données
  const handlePdfExtracted = (data) => {
    setExtractedData(data);
    setLoading(false);
    setError(null);
  };

  // Callback pour les erreurs - essayer SimplePdfReader comme fallback
  const handlePdfError = (errorMsg) => {
    console.warn('PdfExtractor a échoué, utilisation de SimplePdfReader comme fallback');
    // Ne pas afficher d'erreur immédiatement, laisser SimplePdfReader essayer
  };
  
  // Callback pour SimplePdfReader (fallback)
  const handleSimplePdfExtracted = (data) => {
    setExtractedData(data);
    setLoading(false);
    setError(null);
  };
  
  // Callback pour erreur du SimplePdfReader
  const handleSimplePdfError = (errorMsg) => {
    setError(errorMsg);
    setLoading(false);
    // Proposer le mode manuel après une erreur
    setTimeout(() => {
      if (window.confirm('L\'extraction du PDF a échoué. Voulez-vous utiliser le mode de saisie manuelle ?')) {
        setUseFallback(true);
      }
    }, 500);
  };


  const handleSave = () => {
    if (extractedData && onManexUpdate) {
      try {
        onManexUpdate(aircraft.id, extractedData);
        showNotification(
          `✅ MANEX enregistré avec succès pour ${aircraft.registration}`,
          'success',
          5000
        );
        onClose();
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement du MANEX:', error);
        showNotification(
          `❌ Erreur lors de l'enregistrement du MANEX: ${error.message || 'Erreur inconnue'}`,
          'error',
          7000
        );
      }
    }
  };

  const handleRemoveManex = () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer le MANEX ?')) {
      try {
        onManexUpdate(aircraft.id, null);
        showNotification(
          `🗑️ MANEX supprimé pour ${aircraft.registration}`,
          'info',
          4000
        );
        onClose();
      } catch (error) {
        console.error('Erreur lors de la suppression du MANEX:', error);
        showNotification(
          `❌ Erreur lors de la suppression du MANEX`,
          'error',
          5000
        );
      }
    }
  };

  return (
    <>
      {/* Essayer d'abord PdfExtractor avec PDF.js, puis SimplePdfReader en fallback */}
      {pdfFile && loading && usePdfJs && (
        <PdfExtractor 
          file={pdfFile} 
          onExtracted={handlePdfExtracted}
          onError={(err) => {
            handlePdfError(err);
            // Basculer sur SimplePdfReader en cas d'erreur
            setUsePdfJs(false);
          }}
        />
      )}
      
      {/* Fallback sur SimplePdfReader si PdfExtractor échoue */}
      {pdfFile && loading && !usePdfJs && (
        <SimplePdfReader 
          file={pdfFile} 
          onExtracted={handleSimplePdfExtracted}
          onError={handleSimplePdfError}
        />
      )}
      
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
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'flex-start' }}>
            <FileText size={24} style={{ marginRight: '8px' }} />
            Import du Manuel de Vol (MANEX)
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Info avion */}
        <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px' }}>
            <strong>Avion:</strong> {aircraft.registration} - {aircraft.model}
          </p>
          {aircraft.manex && (
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              MANEX actuel: {aircraft.manex.fileName} ({aircraft.manex.fileSize})
            </p>
          )}
          <button
            onClick={() => setUseFallback(true)}
            style={{
              marginTop: '8px',
              padding: '6px 12px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Utiliser le mode de saisie manuelle
          </button>
        </div>

        {/* Zone d'upload */}
        {!extractedData && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #d1d5db',
                borderRadius: '8px',
                padding: '40px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: '#fafafa',
                transition: 'all 0.2s',
                ':hover': {
                  borderColor: '#3b82f6',
                  backgroundColor: '#f0f9ff'
                }
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.backgroundColor = '#f0f9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.backgroundColor = '#fafafa';
              }}
            >
              <Upload size={48} style={{ margin: '0 auto 16px', color: '#9ca3af' }} />
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>
                Cliquez pour sélectionner le fichier PDF du MANEX
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                ou glissez-déposez le fichier ici
              </p>
            </div>

            {/* Actions pour MANEX existant */}
            {aircraft.manex && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', gap: '8px' }}>
                <button
                  onClick={handleRemoveManex}
                  style={{ padding: '8px 16px', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Trash2 size={16} />
                  Supprimer le MANEX actuel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Affichage du chargement */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e5e7eb',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ fontSize: '16px' }}>Extraction des données du MANEX en cours...</p>
          </div>
        )}

        {/* Affichage des données extraites */}
        {extractedData && !loading && (
          <div>
            <div style={{ backgroundColor: '#d1fae5', border: '1px solid #86efac', borderRadius: '6px', padding: '12px', display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <CheckCircle size={20} style={{ color: '#065f46' }} />
              <div>
                <p style={{ fontSize: '14px' }}>
                  <strong>MANEX importé avec succès!</strong>
                </p>
                <p style={{ fontSize: '12px', color: '#6b7280' }}>
                  {extractedData.pageCount} pages analysées
                </p>
              </div>
            </div>

            {/* Sections trouvées */}
            {extractedData.sections.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                  Sections identifiées
                </h4>
                <div style={{ maxHeight: '150px', overflow: 'auto', backgroundColor: '#f9fafb', padding: '12px', borderRadius: '6px' }}>
                  {extractedData.sections.map((section, idx) => (
                    <div key={idx} style={{ fontSize: '12px', marginBottom: '4px' }}>
                      • Section {section.number}: {section.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performances extraites */}
            {Object.keys(extractedData.performances).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                  Données de performance
                </h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                  gap: '8px',
                  backgroundColor: '#f9fafb',
                  padding: '12px',
                  borderRadius: '6px'
                }}>
                  {Object.entries(extractedData.performances).map(([key, value]) => {
                    const isDefault = extractedData.extractionDetails?.performances?.[key] === 'default';
                    return (
                      <div 
                        key={key} 
                        style={{ 
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: isDefault ? '#fef3c7' : '#d1fae5',
                          border: isDefault ? '1px solid #fcd34d' : '1px solid #86efac',
                          position: 'relative'
                        }}
                      >
                        <strong>{key.toUpperCase()}:</strong> {value}
                        {isDefault && (
                          <span style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '4px',
                            fontSize: '10px',
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            fontWeight: 'bold'
                          }}>
                            Par défaut
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {extractedData.extractionDetails?.performances && 
                 Object.values(extractedData.extractionDetails.performances).some(v => v === 'default') && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#92400e',
                    backgroundColor: '#fef3c7',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #fcd34d'
                  }}>
                    ⚠️ Les valeurs en jaune sont des valeurs par défaut. Veuillez les vérifier et les ajuster selon votre manuel de vol.
                  </div>
                )}
              </div>
            )}

            {/* Abaques de performances extraits */}
            {extractedData.performanceCharts && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'flex-start' }}>
                  <BarChart3 size={16} style={{ marginRight: '8px' }} />
                  Abaques de performances
                </h4>
                <div style={{ 
                  backgroundColor: '#EFF6FF',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #BFDBFE'
                }}>
                  {Object.entries(extractedData.performanceCharts).map(([chartType, chart]) => (
                    chart && (
                      <div key={chartType} style={{ marginBottom: '8px' }}>
                        <p style={{ fontSize: '14px', fontWeight: 'bold' }}>
                          {chartType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </p>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          • Altitudes: {chart.pressureAltitudes?.join(', ')} ft<br/>
                          • Températures: {chart.temperatures?.join(', ')} °C<br/>
                          • Unité: {chart.unit}<br/>
                          {chart.corrections && Object.keys(chart.corrections).length > 0 && (
                            <>• Corrections disponibles: {Object.keys(chart.corrections).join(', ')}<br/></>
                          )}
                        </div>
                      </div>
                    )
                  ))}
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                    💡 Les abaques permettront le calcul précis des performances en fonction des conditions atmosphériques
                  </p>
                </div>
              </div>
            )}

            {/* Limitations extraites */}
            {Object.keys(extractedData.limitations).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                  Limitations
                </h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                  gap: '8px',
                  backgroundColor: '#fff4ed',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #fed7aa'
                }}>
                  {Object.entries(extractedData.limitations).map(([key, value]) => {
                    const isDefault = extractedData.extractionDetails?.limitations?.[key] === 'default';
                    return (
                      <div 
                        key={key} 
                        style={{ 
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: isDefault ? '#fef3c7' : '#fee2e2',
                          border: isDefault ? '1px solid #fcd34d' : '1px solid #fca5a5',
                          position: 'relative'
                        }}
                      >
                        <strong>{key.toUpperCase()}:</strong> {value}
                        {isDefault && (
                          <span style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '4px',
                            fontSize: '10px',
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            fontWeight: 'bold'
                          }}>
                            Par défaut
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Boutons d'action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
              <button
                onClick={() => {
                  setPdfFile(null);
                  setExtractedData(null);
                  setPreviewUrl(null);
                }}
                style={{ padding: '8px 16px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
              >
                Choisir un autre fichier
              </button>
              <button
                onClick={handleSave}
                style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle size={16} />
                Enregistrer le MANEX
              </button>
            </div>
          </div>
        )}

        {/* Affichage des erreurs */}
        {error && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px', display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
            <AlertTriangle size={20} style={{ color: '#991b1b' }} />
            <p style={{ fontSize: '14px' }}>{error}</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
    </>
  );
});

ManexImporter.displayName = 'ManexImporter';

export default ManexImporter;