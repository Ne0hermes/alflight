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
  moduleWrapper: {
    // Style simple pour le wrapper du module
    width: '100%'
  }
};

// Composant principal de l'étape 3
export const Step3Route = memo(({ flightPlan, onUpdate }) => {
  // Configuration de ce qu'on veut afficher/masquer
  const wizardConfig = {
    showTitle: false, // Le titre est déjà dans le wizard
    showTabs: false, // Pas besoin des tabs dans le wizard
    showExportButtons: false, // Pas d'export dans le wizard
    simplifiedView: true // Vue simplifiée pour le wizard
  };

  return (
    <div style={commonStyles.container}>
      {/* Titre de l'étape */}
      <div style={commonStyles.label}>
        <Navigation size={20} />
        Planification de la navigation
      </div>

      {/* Module de navigation avec configuration wizard */}
      <div style={commonStyles.moduleWrapper}>
        {/* On peut passer des props si le module les accepte */}
        <NavigationModule 
          wizardMode={true}
          config={wizardConfig}
        />
      </div>

      {/* CSS pour masquer certains éléments spécifiques */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Masquer les éléments non nécessaires dans le wizard */
        .navigation-module-title,
        .navigation-module-tabs,
        .navigation-module-export {
          display: none !important;
        }

        /* Simplifier l'affichage */
        .navigation-module-container {
          padding: 0 !important;
          margin: 0 !important;
        }

        /* Masquer certains boutons */
        .btn-export,
        .btn-print,
        .btn-share {
          display: none !important;
        }
      `}} />
    </div>
  );
});

// Display name pour le debug
Step3Route.displayName = 'Step3Route';

export default Step3Route;