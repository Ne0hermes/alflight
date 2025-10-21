// src/features/flight-wizard/steps/Step3Route.jsx
import React, { memo, useState } from 'react';
import NavigationModule from '@features/navigation/NavigationModule';
import { Navigation, Map } from 'lucide-react';
import { theme } from '../../../styles/theme';
import RouteMapView from '../components/RouteMapView';

// Styles communs
const commonStyles = {
  container: {
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  },
  label: {
    fontSize: '16px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px'
  },
  section: {
    marginBottom: '24px'
  },
  mapSection: {
    marginBottom: '32px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb'
  },
  mapLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px'
  },
  infoText: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '12px',
    fontStyle: 'italic'
  }
};

// Composant principal de l'étape 3
export const Step3Route = memo(({ flightPlan, onUpdate }) => {
  console.log('📍📍📍 Step3Route MONTÉ');

  // Points VFR (à connecter avec votre store de points VFR)
  const [vfrPoints] = useState([]);

  console.log('📍 Step3Route - About to render RouteMapView');

  return (
    <div style={commonStyles.container} className="wizard-step-3-route">
      {/* Titre de l'étape */}
      <div style={commonStyles.label}>
        <Navigation size={20} />
        Planification de la navigation
      </div>

      {/* Carte interactive */}
      <div style={commonStyles.mapSection}>
        <div style={commonStyles.mapLabel}>
          <Map size={18} />
          Carte du trajet
        </div>
        <div style={commonStyles.infoText}>
          📍 Visualisation de votre route avec les aérodromes et waypoints sélectionnés
        </div>
        <RouteMapView vfrPoints={vfrPoints} flightPlan={flightPlan} />
      </div>

      {/* Module de navigation complet pour la gestion des waypoints */}
      <div style={commonStyles.section}>
        <NavigationModule
          wizardMode={true}
          config={{
            showTitle: false,
            showTabs: false,
            showExportButtons: false,
            simplifiedView: true
          }}
        />
      </div>
    </div>
  );
});

// Display name pour le debug
Step3Route.displayName = 'Step3Route';

export default Step3Route;