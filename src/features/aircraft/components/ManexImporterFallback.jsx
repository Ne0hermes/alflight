// src/features/aircraft/components/ManexImporterFallback.jsx
import React, { memo, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, X, Info } from 'lucide-react';
import { generateDefaultChart } from '../utils/performanceCharts';
import { showNotification } from '../../../shared/components/Notification';

/**
 * Version fallback du ManexImporter qui fonctionne sans PDF.js
 * Permet d'entrer manuellement les données ou utilise des valeurs par défaut
 */
export const ManexImporterFallback = memo(({ 
  aircraft, 
  onManexUpdate,
  onClose 
}) => {
  const [useDefaults, setUseDefaults] = useState(false);
  const [manualData, setManualData] = useState({
    vso: '',
    vs1: '',
    vfe: '',
    vno: '',
    vne: '',
    va: '',
    vx: '',
    vy: '',
    vr: '',
    takeoffRoll: '',
    takeoffDistance: '',
    landingRoll: '',
    landingDistance: '',
    maxCrosswind: ''
  });

  const handleManualChange = (field, value) => {
    setManualData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveWithDefaults = () => {
    try {
      const aircraftCategory = aircraft.maxTakeoffWeight <= 7000 ? 'light' : 
                              aircraft.maxTakeoffWeight <= 136000 ? 'medium' : 'heavy';
      
      const extractedInfo = {
        fileName: 'Données par défaut',
        fileSize: 'N/A',
        pageCount: 0,
        uploadDate: new Date().toISOString(),
        dataSource: `Valeurs par défaut pour avion ${aircraftCategory === 'light' ? 'léger' : aircraftCategory === 'medium' ? 'moyen' : 'lourd'}`,
        sections: [],
        performances: getDefaultPerformances(aircraftCategory),
        limitations: getDefaultLimitations(aircraftCategory),
        procedures: {},
        performanceCharts: {
          takeoffDistance: generateDefaultChart('takeoff_distance', aircraftCategory),
          takeoffRoll: generateDefaultChart('takeoff_roll', aircraftCategory),
          landingDistance: generateDefaultChart('landing_distance', aircraftCategory),
          landingRoll: generateDefaultChart('landing_roll', aircraftCategory),
          climbRate: generateDefaultChart('climb_rate', aircraftCategory)
        }
      };

      onManexUpdate(aircraft.id, extractedInfo);
      showNotification(
        `✅ Valeurs par défaut enregistrées pour ${aircraft.registration}`,
        'success',
        5000
      );
      onClose();
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
      showNotification(
        `❌ Erreur lors de l'enregistrement des valeurs par défaut`,
        'error',
        5000
      );
    }
  };

  const handleSaveManual = () => {
    try {
      const extractedInfo = {
        fileName: 'Données manuelles',
        fileSize: 'N/A',
        pageCount: 0,
        uploadDate: new Date().toISOString(),
        dataSource: 'Valeurs entrées manuellement par l\'utilisateur',
        sections: [],
        performances: Object.fromEntries(
          Object.entries(manualData).filter(([_, v]) => v !== '')
        ),
        limitations: {},
        procedures: {},
        performanceCharts: {}
      };

      // Vérifier qu'au moins quelques données ont été entrées
      const hasData = Object.values(manualData).some(v => v !== '');
      if (!hasData) {
        showNotification(
          '⚠️ Veuillez entrer au moins quelques valeurs avant d\'enregistrer',
          'warning',
          4000
        );
        return;
      }

      onManexUpdate(aircraft.id, extractedInfo);
      showNotification(
        `✅ Données manuelles enregistrées pour ${aircraft.registration}`,
        'success',
        5000
      );
      onClose();
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
      showNotification(
        `❌ Erreur lors de l'enregistrement des données manuelles`,
        'error',
        5000
      );
    }
  };

  const getDefaultPerformances = (category) => {
    const defaults = {
      light: { vso: 45, vs1: 50, vfe: 85, vno: 125, vne: 160, va: 95, vx: 60, vy: 75, vr: 55 },
      medium: { vso: 60, vs1: 70, vfe: 120, vno: 180, vne: 220, va: 130, vx: 85, vy: 95, vr: 75 },
      heavy: { vso: 110, vs1: 125, vfe: 180, vno: 250, vne: 320, va: 180, vx: 140, vy: 160, vr: 130 }
    };
    return defaults[category] || defaults.light;
  };

  const getDefaultLimitations = (category) => {
    const defaults = {
      light: { maxCrosswind: 15, maxTailwind: 5, mtow: 1200, mlw: 1150 },
      medium: { maxCrosswind: 25, maxTailwind: 10, mtow: 5700, mlw: 5400 },
      heavy: { maxCrosswind: 35, maxTailwind: 10, mtow: 79000, mlw: 66000 }
    };
    return defaults[category] || defaults.light;
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
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            <FileText size={24} style={{ marginRight: '8px' }} />
            Configuration MANEX
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

        {/* Info */}
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
          <Info size={16} style={{ display: 'inline', marginRight: '8px', color: '#2563eb' }} />
          <span style={{ fontSize: '14px' }}>
            Import PDF temporairement indisponible. Vous pouvez utiliser les valeurs par défaut ou entrer manuellement les données.
          </span>
        </div>

        {/* Options */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', cursor: 'pointer' }}>
            <input
              type="radio"
              checked={useDefaults}
              onChange={() => setUseDefaults(true)}
              style={{ marginRight: '8px' }}
            />
            <span style={{ fontSize: '16px' }}>Utiliser les valeurs par défaut pour {aircraft.model}</span>
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              checked={!useDefaults}
              onChange={() => setUseDefaults(false)}
              style={{ marginRight: '8px' }}
            />
            <span style={{ fontSize: '16px' }}>Entrer manuellement les données</span>
          </label>
        </div>

        {/* Formulaire manuel */}
        {!useDefaults && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
              Vitesses caractéristiques (kt)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {['vso', 'vs1', 'vfe', 'vno', 'vne', 'va', 'vx', 'vy', 'vr'].map(field => (
                <div key={field}>
                  <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    {field.toUpperCase()}
                  </label>
                  <input
                    type="number"
                    value={manualData[field]}
                    onChange={(e) => handleManualChange(field, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              ))}
            </div>

            <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '20px', marginBottom: '12px' }}>
              Distances (m)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {['takeoffRoll', 'takeoffDistance', 'landingRoll', 'landingDistance'].map(field => (
                <div key={field}>
                  <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="number"
                    value={manualData[field]}
                    onChange={(e) => handleManualChange(field, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Valeurs par défaut preview */}
        {useDefaults && (
          <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
              Valeurs par défaut qui seront utilisées:
            </h4>
            <div style={{ fontSize: '14px', color: '#4b5563' }}>
              <p>• Catégorie: {aircraft.maxTakeoffWeight <= 7000 ? 'Avion léger' : aircraft.maxTakeoffWeight <= 136000 ? 'Avion moyen' : 'Avion lourd'}</p>
              <p>• Abaques de performances standards</p>
              <p>• Vitesses et limitations typiques</p>
              <p>• Corrections environnementales standards</p>
            </div>
          </div>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onClose}
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
            Annuler
          </button>
          <button
            onClick={useDefaults ? handleSaveWithDefaults : handleSaveManual}
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
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
});

ManexImporterFallback.displayName = 'ManexImporterFallback';

export default ManexImporterFallback;