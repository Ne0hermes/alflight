// src/features/vac/components/VACUploader.jsx
import React, { memo, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useVACStore } from '@core/stores/vacStore';
import { VACPDFExtractor } from '@services/pdfExtractor';
import { sx } from '@shared/styles/styleSystem';

export const VACUploader = memo(({ icao }) => {
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const { updateExtractedData } = useVACStore();
  
  const extractor = new VACPDFExtractor();

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Veuillez sélectionner un fichier PDF');
      return;
    }

    setUploading(true);
    
    try {
      // Lire le fichier
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      // Extraire les données
      const extracted = await extractor.extractFromPDF(data);
      setExtractedData(extracted);
      
      // Mettre à jour le store
      updateExtractedData(icao, extracted);
      
      console.log('Données extraites:', extracted);
    } catch (error) {
      console.error('Erreur extraction:', error);
      alert('Erreur lors de l\'extraction des données');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.mt(4))}>
      <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
        📄 Charger une carte VAC PDF
      </h4>
      
      <label style={{
        display: 'block',
        padding: '24px',
        border: '2px dashed #e5e7eb',
        borderRadius: '8px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: '#3b82f6',
          backgroundColor: '#f0f9ff'
        }
      }}>
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          disabled={uploading}
        />
        
        {uploading ? (
          <div>
            <div style={{
              width: 40,
              height: 40,
              border: '3px solid #e5e7eb',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px'
            }} />
            <p style={sx.text.sm}>Extraction en cours...</p>
          </div>
        ) : (
          <>
            <Upload size={40} style={{ margin: '0 auto 12px', color: '#3b82f6' }} />
            <p style={sx.combine(sx.text.base, sx.text.bold)}>
              Cliquez pour charger un PDF
            </p>
            <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
              ou glissez-déposez le fichier ici
            </p>
          </>
        )}
      </label>
      
      {/* Résultats de l'extraction */}
      {extractedData && (
        <div style={sx.combine(sx.spacing.mt(4))}>
          <div style={sx.combine(
            sx.components.alert.base,
            sx.components.alert.success
          )}>
            <CheckCircle size={20} />
            <div>
              <p style={sx.text.bold}>Extraction réussie !</p>
              <p style={sx.text.sm}>
                {extractedData.runways.length} piste(s) • 
                {Object.keys(extractedData.frequencies).length} fréquence(s)
              </p>
            </div>
          </div>
          
          {/* Aperçu des données */}
          <details style={sx.spacing.mt(3)}>
            <summary style={{ cursor: 'pointer', fontSize: '14px' }}>
              Voir les données extraites
            </summary>
            <pre style={{
              fontSize: '12px',
              backgroundColor: '#f9fafb',
              padding: '12px',
              borderRadius: '6px',
              marginTop: '8px',
              overflow: 'auto'
            }}>
              {JSON.stringify(extractedData, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
});