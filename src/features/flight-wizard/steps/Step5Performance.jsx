// src/features/flight-wizard/steps/Step5Performance.jsx
import React, { memo } from 'react';
import PerformanceModule from '@features/performance/PerformanceModule';
import { Gauge } from 'lucide-react';
import { theme } from '../../../styles/theme';

// Styles communs
const commonStyles = {
  container: {
    padding: '0',
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

// Composant principal de l'étape 5 - Utilise directement le PerformanceModule complet
export const Step5Performance = memo(({ flightPlan, onUpdate }) => {
  // Le PerformanceModule gère tout en interne via les contextes et stores
  // Il agrège les données de masse, météo, altitude et performance avion

  return (
    <div style={commonStyles.container}>
      {/* Module de performance complet - 🔧 FIX: Passer flightPlan ET onUpdate pour sauvegarde automatique */}
      <PerformanceModule wizardMode={true} config={{ flightPlan, onUpdate }} />
    </div>
  );
});

// Display name pour le debug
Step5Performance.displayName = 'Step5Performance';

export default Step5Performance;
