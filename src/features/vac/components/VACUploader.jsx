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
        backgroundColor: 'white',
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
            border: '2px dashed #3b82f6',
            borderRadius: '8px',
            backgroundColor: '#f0f9ff',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#dbeafe';
            e.currentTarget.style.borderColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f9ff';
            e.currentTarget.style.borderColor = '#3b82f6';
          }}
        >
          <Upload size={40} style={{ color: '#3b82f6' }} />
          <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e40af' }}>
            Cliquez pour importer une carte VAC
          </p>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Extraction automatique des données (fréquences, pistes, procédures...)
          </p>
        </button>
        
        {/* Résultats de l'extraction */}
        {extractedData && (
          <div style={{ marginTop: '16px' }}>
            <div style={{
              backgroundColor: '#d1fae5',
              border: '1px solid #86efac',
              borderRadius: '6px',
              padding: '12px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}>
              <CheckCircle size={20} style={{ color: '#065f46' }} />
              <div>
                <p style={{ fontSize: '14px', fontWeight: 'bold' }}>Carte VAC importée avec succès!</p>
                <p style={{ fontSize: '12px', color: '#6b7280' }}>
                  {extractedData.runways?.length || 0} piste(s) • 
                  {Object.keys(extractedData.frequencies || {}).length} fréquence(s) • 
                  {extractedData.navaids?.length || 0} aide(s) à la navigation
                </p>
              </div>
            </div>
            
            {/* Aperçu des données */}
            <details style={{ marginTop: '12px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                Voir les données extraites
              </summary>
              <pre style={{
                fontSize: '12px',
                backgroundColor: '#f9fafb',
                padding: '12px',
                borderRadius: '6px',
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