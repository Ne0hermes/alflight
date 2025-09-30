// src/features/flight-wizard/steps/Step5Fuel.jsx
import React, { memo } from 'react';
import FuelModule from '@features/fuel/FuelModule';
import { Fuel } from 'lucide-react';
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

// Composant principal de l'étape 5 - Utilise directement le FuelModule complet
export const Step5Fuel = memo(({ flightPlan, onUpdate }) => {
  // Le FuelModule gère tout en interne via les contextes et stores
  // Il calcule automatiquement les besoins en fonction de la navigation et des alternates
  
  return (
    <div style={commonStyles.container}>
      {/* Titre de l'étape */}
      <div style={commonStyles.label}>
        <Fuel size={20} />
        Bilan carburant
      </div>

      {/* Module de carburant complet */}
      <FuelModule />
    </div>
  );
});

// Display name pour le debug
Step5Fuel.displayName = 'Step5Fuel';

export default Step5Fuel;