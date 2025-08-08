// src/features/vac/components/VACImporter.jsx
import React, { memo, useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, X, Map, Radio, Plane, Navigation } from 'lucide-react';
import VACPdfExtractor from './VACPdfExtractor';
import { showNotification } from '../../../shared/components/Notification';
import { useVACStore } from '../../../core/stores/vacStore';

export const VACImporter = memo(({ 
  icao,
  onClose,
  onImportComplete 
}) => {
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [usePdfJs, setUsePdfJs] = useState(true);
  const fileInputRef = useRef(null);
  const { updateExtractedData } = useVACStore();

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      setError('Veuillez sélectionner un fichier PDF de carte VAC');
      return;
    }

    setPdfFile(file);
    setError(null);
    setLoading(true);
  };

  // Callback pour quand VACPdfExtractor a extrait les données
  const handlePdfExtracted = (data) => {
    setExtractedData(data);
    setLoading(false);
    setError(null);
    
    // Si on a un code ICAO extrait, l'utiliser
    if (data.icao && !icao) {
      console.log('Code ICAO détecté:', data.icao);
    }
  };

  // Callback pour les erreurs
  const handlePdfError = (errorMsg) => {
    setError(errorMsg);
    setLoading(false);
    showNotification(
      '❌ Erreur lors de l\'extraction de la carte VAC',
      'error',
      5000
    );
  };

  const handleSave = () => {
    if (extractedData) {
      try {
        // Utiliser le code ICAO extrait ou celui fourni
        const targetIcao = extractedData.icao || icao;
        
        if (!targetIcao) {
          showNotification(
            '⚠️ Code ICAO non détecté. Veuillez l\'entrer manuellement.',
            'warning',
            5000
          );
          return;
        }

        // Mettre à jour le store VAC
        updateExtractedData(targetIcao, extractedData);
        
        showNotification(
          `✅ Carte VAC ${targetIcao} importée avec succès`,
          'success',
          5000
        );
        
        if (onImportComplete) {
          onImportComplete(targetIcao, extractedData);
        }
        
        if (onClose) {
          onClose();
        }
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement de la carte VAC:', error);
        showNotification(
          `❌ Erreur lors de l'enregistrement: ${error.message}`,
          'error',
          5000
        );
      }
    }
  };

  const handleManualEntry = () => {
    // Créer des données vides pour entrée manuelle
    const manualData = {
      fileName: 'Entrée manuelle',
      dataSource: 'Données entrées manuellement',
      icao: icao || '',
      airportName: '',
      runways: [],
      frequencies: {},
      navaids: [],
      minima: {},
      procedures: {
        arrival: [],
        departure: [],
        approach: []
      }
    };
    
    setExtractedData(manualData);
    setLoading(false);
  };

  return (
    <>
      {/* Composant d'extraction PDF */}
      {pdfFile && loading && usePdfJs && (
        <VACPdfExtractor 
          file={pdfFile} 
          onExtracted={handlePdfExtracted}
          onError={handlePdfError}
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
          maxWidth: '900px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto'
        }}>
          {/* En-tête */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '20px' 
          }}>
            <h3 style={{ 
              fontSize: '20px', 
              fontWeight: 'bold', 
              display: 'flex', 
              alignItems: 'center',
              gap: '8px'
            }}>
              <Map size={24} />
              Import de Carte VAC
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

          {/* Info aéroport */}
          {icao && (
            <div style={{ 
              backgroundColor: '#f0f9ff', 
              padding: '16px', 
              borderRadius: '8px', 
              marginBottom: '20px',
              border: '1px solid #bfdbfe'
            }}>
              <p style={{ fontSize: '14px' }}>
                <strong>Aéroport:</strong> {icao}
              </p>
            </div>
          )}

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
                  transition: 'all 0.2s'
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
                  Cliquez pour sélectionner une carte VAC PDF
                </p>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>
                  ou glissez-déposez le fichier ici
                </p>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '12px' }}>
                  Formats supportés: Cartes VAC SIA, Jeppesen, autres PDF aéronautiques
                </p>
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                marginTop: '16px' 
              }}>
                <button
                  onClick={handleManualEntry}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Entrer les données manuellement
                </button>
              </div>
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
              <p style={{ fontSize: '16px' }}>Extraction des données VAC en cours...</p>
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
                Analyse des fréquences, pistes, procédures...
              </p>
            </div>
          )}

          {/* Affichage des données extraites */}
          {extractedData && !loading && (
            <div>
              {/* Alerte de succès */}
              <div style={{ 
                backgroundColor: '#d1fae5', 
                border: '1px solid #86efac', 
                borderRadius: '6px', 
                padding: '12px', 
                display: 'flex', 
                gap: '12px', 
                alignItems: 'center', 
                marginBottom: '20px' 
              }}>
                <CheckCircle size={20} style={{ color: '#065f46' }} />
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 'bold' }}>
                    Carte VAC traitée avec succès!
                  </p>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>
                    {extractedData.pageCount} pages analysées • {extractedData.dataSource}
                  </p>
                </div>
              </div>

              {/* Informations de base */}
              {(extractedData.icao || extractedData.airportName) && (
                <div style={{ 
                  backgroundColor: '#f9fafb', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  marginBottom: '16px' 
                }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                    Informations Aéroport
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {extractedData.icao && (
                      <div>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Code ICAO</span>
                        <p style={{ fontSize: '14px', fontWeight: 'bold' }}>{extractedData.icao}</p>
                      </div>
                    )}
                    {extractedData.airportName && (
                      <div>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Nom</span>
                        <p style={{ fontSize: '14px', fontWeight: 'bold' }}>{extractedData.airportName}</p>
                      </div>
                    )}
                    {extractedData.elevation && (
                      <div>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Élévation</span>
                        <p style={{ fontSize: '14px', fontWeight: 'bold' }}>{extractedData.elevation} ft</p>
                      </div>
                    )}
                    {extractedData.coordinates && (
                      <div>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Coordonnées</span>
                        <p style={{ fontSize: '14px', fontWeight: 'bold' }}>{extractedData.coordinates.formatted}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pistes */}
              {extractedData.runways && extractedData.runways.length > 0 && (
                <div style={{ 
                  backgroundColor: '#eff6ff', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  marginBottom: '16px',
                  border: '1px solid #bfdbfe'
                }}>
                  <h4 style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold', 
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Plane size={16} />
                    Pistes ({extractedData.runways.length})
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                    {extractedData.runways.map((runway, idx) => (
                      <div key={idx} style={{ 
                        backgroundColor: 'white', 
                        padding: '8px', 
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}>
                        <strong>{runway.designation}</strong>
                        {runway.length && <span> • {runway.length}m</span>}
                        {runway.surface && <span> • {runway.surface}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fréquences */}
              {extractedData.frequencies && Object.keys(extractedData.frequencies).length > 0 && (
                <div style={{ 
                  backgroundColor: '#fef3c7', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  marginBottom: '16px',
                  border: '1px solid #fcd34d'
                }}>
                  <h4 style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold', 
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Radio size={16} />
                    Fréquences
                  </h4>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                    gap: '8px' 
                  }}>
                    {Object.entries(extractedData.frequencies).map(([service, freqs]) => (
                      <div key={service} style={{ fontSize: '13px' }}>
                        <strong>{service}:</strong> {Array.isArray(freqs) ? freqs.join(', ') : freqs}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aides à la navigation */}
              {extractedData.navaids && extractedData.navaids.length > 0 && (
                <div style={{ 
                  backgroundColor: '#f3e8ff', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  marginBottom: '16px',
                  border: '1px solid #e9d5ff'
                }}>
                  <h4 style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold', 
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Navigation size={16} />
                    Aides à la Navigation
                  </h4>
                  <div style={{ fontSize: '13px' }}>
                    {extractedData.navaids.map((navaid, idx) => (
                      <div key={idx} style={{ marginBottom: '4px' }}>
                        • {navaid.type} {navaid.identifier || navaid.runway} - {navaid.frequency}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Procédures */}
              {extractedData.procedures && (
                <div style={{ 
                  backgroundColor: '#f9fafb', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  marginBottom: '16px' 
                }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                    Procédures
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '13px' }}>
                    {extractedData.procedures.arrival.length > 0 && (
                      <div>
                        <strong>Arrivées (STAR):</strong>
                        <div>{extractedData.procedures.arrival.join(', ')}</div>
                      </div>
                    )}
                    {extractedData.procedures.departure.length > 0 && (
                      <div>
                        <strong>Départs (SID):</strong>
                        <div>{extractedData.procedures.departure.join(', ')}</div>
                      </div>
                    )}
                    {extractedData.procedures.approach.length > 0 && (
                      <div>
                        <strong>Approches:</strong>
                        <div>{extractedData.procedures.approach.join(', ')}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Boutons d'action */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  onClick={() => {
                    setPdfFile(null);
                    setExtractedData(null);
                    setError(null);
                  }}
                  style={{ 
                    padding: '8px 16px', 
                    backgroundColor: '#e5e7eb', 
                    color: '#374151', 
                    border: 'none', 
                    borderRadius: '6px', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    cursor: 'pointer' 
                  }}
                >
                  Choisir un autre fichier
                </button>
                <button
                  onClick={handleSave}
                  style={{ 
                    padding: '8px 16px', 
                    backgroundColor: '#3b82f6', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '6px', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px' 
                  }}
                >
                  <CheckCircle size={16} />
                  Enregistrer la carte VAC
                </button>
              </div>
            </div>
          )}

          {/* Affichage des erreurs */}
          {error && (
            <div style={{ 
              backgroundColor: '#fee2e2', 
              border: '1px solid #fecaca', 
              borderRadius: '6px', 
              padding: '12px', 
              display: 'flex', 
              gap: '12px', 
              alignItems: 'center', 
              marginTop: '16px' 
            }}>
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

VACImporter.displayName = 'VACImporter';

export default VACImporter;