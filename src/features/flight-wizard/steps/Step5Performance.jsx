// src/features/flight-wizard/steps/Step5Performance.jsx
import React, { memo } from 'react';
import PerformanceModule from '@features/performance/PerformanceModule';
import { theme } from '../../../styles/theme';

// Styles communs
const commonStyles = {
  container: {
    padding: '0'
  },
  label: {
    fontSize: 'var(--fs-body)',
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
      {/* R15 — DISCLAIMER réglementaire (demande pilote) : marge d'erreur
          assumée vs les exemples du MANEX (= tolérance du banc de test des
          abaques, 5 %) + responsabilité du commandant de bord. */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '10px 14px', marginBottom: 14, borderRadius: 6,
        backgroundColor: 'rgba(242, 105, 33, 0.08)',
        border: '1px solid var(--accent-primary)',
        fontSize: 'var(--fs-body)', color: 'var(--text-primary)', lineHeight: 1.5
      }}>
        <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
        <div>
          <strong style={{ color: 'var(--accent-primary)' }}>Marge de précision.</strong>{' '}
          Les performances calculées par l'application proviennent d'abaques et de tableaux
          numérisés du MANEX : une <strong>marge d'erreur de ±5 %</strong> par rapport aux
          exemples de référence du manuel est assumée.{' '}
          <strong>
            Le commandant de bord reste seul responsable de la détermination des performances —
            en cas de doute, reprenez le calcul sur les abaques officiels du MANEX.
          </strong>
        </div>
      </div>

      {/* Module de performance complet - 🔧 FIX: Passer flightPlan ET onUpdate pour sauvegarde automatique */}
      <PerformanceModule wizardMode={true} config={{ flightPlan, onUpdate }} />
    </div>
  );
});

// Display name pour le debug
Step5Performance.displayName = 'Step5Performance';

export default Step5Performance;
