import React from 'react';
import { ProGate } from '../../billing/components/ProGate';
import { PerformanceCalculator } from '../../performance/components/PerformanceCalculator';
import { VACViewer } from '../../vac/components/VACViewer';
import { ManexImporter } from '../../aircraft/components/ManexImporter';

/**
 * Example 1: Gating advanced performance calculations behind PRO
 */
export const PerformanceWithPaywall = () => {
  return (
    <ProGate 
      feature="Calculs de performance avancés avec interpolation IA"
      showTeaser={true}
    >
      <PerformanceCalculator />
    </ProGate>
  );
};

/**
 * Example 2: Gating VAC cards viewing behind PRO
 */
export const VACViewerWithPaywall = () => {
  return (
    <ProGate 
      feature="Cartes VAC haute résolution"
      showTeaser={false}
    >
      <VACViewer />
    </ProGate>
  );
};

/**
 * Example 3: Gating Manex OCR import behind PRO
 */
export const ManexImporterWithPaywall = () => {
  return (
    <ProGate 
      feature="Analyse OCR des manuels de vol"
    >
      <ManexImporter />
    </ProGate>
  );
};

/**
 * Example 4: Custom fallback for free users
 */
export const ExportWithPaywall = ({ onExport }) => {
  return (
    <ProGate 
      feature="Export PDF professionnel"
      fallback={
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#f9fafb', 
          borderRadius: '8px',
          textAlign: 'center' 
        }}>
          <h3>Export basique disponible</h3>
          <p>L'export PDF professionnel est réservé aux utilisateurs PRO.</p>
          <button onClick={() => onExport('basic')}>
            Export basique (Texte)
          </button>
        </div>
      }
    >
      <button onClick={() => onExport('professional')}>
        Export PDF Professionnel
      </button>
    </ProGate>
  );
};

/**
 * Example 5: Conditional feature based on entitlement
 */
export const ConditionalFeature = () => {
  const { hasEntitlement } = useAuthStore();
  const isPro = hasEntitlement('pro');

  return (
    <div>
      <h2>Fonctionnalités disponibles</h2>
      
      {/* Basic features - always available */}
      <div>
        <h3>✓ Navigation de base</h3>
        <h3>✓ Carte simple</h3>
        <h3>✓ Météo METAR/TAF</h3>
      </div>

      {/* PRO features - gated */}
      <ProGate feature="Fonctionnalités avancées">
        <div>
          <h3>✓ Interpolation IA</h3>
          <h3>✓ Analyse OCR</h3>
          <h3>✓ Cartes VAC HD</h3>
          <h3>✓ Export PDF Pro</h3>
        </div>
      </ProGate>
    </div>
  );
};