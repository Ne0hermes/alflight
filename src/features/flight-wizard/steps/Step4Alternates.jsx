// src/features/flight-wizard/steps/Step4Alternates.jsx
import React, { memo } from 'react';
import AlternatesModule from '@features/alternates/AlternatesModule';
import { AlertTriangle } from 'lucide-react';
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
  }
};

// Composant principal de l'étape 4 - Utilise directement le AlternatesModule complet
export const Step4Alternates = memo(({ flightPlan, onUpdate }) => {
  // Le AlternatesModule gère tout en interne via les contextes et stores
  // Il synchronise automatiquement avec les données de navigation
  
  return (
    <div style={commonStyles.container}>
      {/* Titre de l'étape */}
      <div style={commonStyles.label}>
        <AlertTriangle size={20} />
        Sélection des aérodromes de déroutement
      </div>

      {/* Module de déroutement complet */}
      <AlternatesModule />
    </div>
  );
});

// Display name pour le debug
Step4Alternates.displayName = 'Step4Alternates';

export default Step4Alternates;