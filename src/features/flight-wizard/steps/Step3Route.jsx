// src/features/flight-wizard/steps/Step3Route.jsx
import React, { memo } from 'react';
import NavigationModule from '@features/navigation/NavigationModule';
import { Navigation } from 'lucide-react';
import { theme } from '../../../styles/theme';

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
  }
};

// Composant principal de l'étape 3
export const Step3Route = memo(({ flightPlan, onUpdate }) => {
  return (
    <div style={commonStyles.container} className="wizard-step-3-route">
      {/* Titre de l'étape */}
      <div style={commonStyles.label}>
        <Navigation size={20} />
        Planification de la navigation
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