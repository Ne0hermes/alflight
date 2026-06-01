// src/features/vac/components/VACUploader.jsx
import React, { memo, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useVACStore } from '@core/stores/vacStore';
import VACImporter from './VACImporter';

export const VACUploader = memo(({ icao }) => {
  const [showImporter, setShowImporter] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const { updateExtractedData } = useVACStore();

  const handleImportComplete = (icaoCode, data) => {
    setExtractedData(data);
    setShowImporter(false);
  };

  return (
    <>
      {/* Afficher l'importateur si demandé */}
      {showImporter && (
        <VACImporter
          icao={icao}
          onClose={() => setShowImporter(false)}
          onImportComplete={handleImportComplete}
        />
      )}
      
      <div style={{
        backgroundColor: 'var(--bg-overlay)',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginTop: '16px'
      }}>
        <h4 style={{
          fontSize: '16px',
          fontWeight: 'bold',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <FileText size={20} />
          Charger une carte VAC PDF
        </h4>
        
        <button
          onClick={() => setShowImporter(true)}
          style={{
            width: '100%',
            padding: '24px',
            border: '2px dashed var(--text-secondary)',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-overlay)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-overlay)';
            e.currentTarget.style.borderColor = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-overlay)';
            e.currentTarget.style.borderColor = 'var(--text-secondary)';
          }}
        >
          <Upload size={40} style={{ color: 'var(--text-secondary)' }} />
          <p style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            Cliquez pour importer une carte VAC
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Extraction automatique des données (fréquences, pistes, procédures...)
          </p>
        </button>
        
        {/* Résultats de l'extraction */}
        {extractedData && (
          <div style={{ marginTop: '16px' }}>
            <div style={{
              backgroundColor: 'var(--bg-overlay)',
              border: '1px solid var(--bg-overlay)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}>
              <CheckCircle size={20} style={{ color: 'var(--text-primary)' }} />
              <div>
                <p style={{ fontSize: '14px', fontWeight: 'bold' }}>Carte VAC importée avec succès!</p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {extractedData.runways?.length || 0} piste(s) • 
                  {Object.keys(extractedData.frequencies || {}).length} fréquence(s) • 
                  {extractedData.navaids?.length || 0} aide(s) à la navigation
                </p>
              </div>
            </div>
            
            {/* Aperçu des données */}
            <details style={{ marginTop: '12px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Voir les données extraites
              </summary>
              <pre style={{
                fontSize: '12px',
                backgroundColor: 'var(--bg-overlay)',
                padding: '12px',
                borderRadius: '8px',
                marginTop: '8px',
                overflow: 'auto',
                maxHeight: '300px'
              }}>
                {JSON.stringify(extractedData, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </>
});