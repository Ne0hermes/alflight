// src/features/flight-wizard/steps/Step4Weather.jsx
import React, { memo, useEffect } from 'react';
import { WeatherModule } from '@features/weather/WeatherModule';
import { Cloud } from 'lucide-react';
import { theme } from '../../../styles/theme';

const commonStyles = {
  container: {
    padding: '24px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: `2px solid ${theme.colors.primary[100]}`
  },
  title: {
    fontSize: 'var(--fs-title)',
    fontWeight: '700',
    color: theme.colors.textPrimary,
    margin: 0
  },
  description: {
    fontSize: 'var(--fs-body)',
    color: theme.colors.textSecondary,
    marginTop: '8px'
  }
};

export const Step4Weather = memo(({ flightPlan, onUpdate }) => {
  // Marquer l'étape comme complétée automatiquement
  // La météo est consultative, pas obligatoire
  useEffect(() => {
    if (onUpdate) {
      onUpdate();
    }
  }, [onUpdate]);

  return (
    <div style={commonStyles.container}>
      {/* En-tête de l'étape */}
      <div style={commonStyles.header}>
        <Cloud size={32} color={theme.colors.primary[500]} />
        <div>
          <h2 style={commonStyles.title}>Informations Météorologiques</h2>
          <p style={commonStyles.description}>
            METAR et TAF pour le départ, l'arrivée et les aérodromes de déroutement
          </p>
        </div>
      </div>

      {/* Module météo intégré */}
      <WeatherModule wizardMode={true} />

      {/* Note d'information */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: theme.colors.info[50],
        borderLeft: `4px solid ${theme.colors.info[500]}`,
        borderRadius: 'var(--radius-sm)'
      }}>
        <p style={{
          margin: 0,
          fontSize: 'var(--fs-body)',
          color: theme.colors.info[900]
        }}>
          <strong>ℹ️ Information :</strong> Les données météorologiques sont chargées automatiquement
          pour votre départ, arrivée et aérodromes de déroutement. Vous pouvez également rechercher
          la météo d'autres aérodromes.
        </p>
      </div>
    </div>
  );
});

Step4Weather.displayName = 'Step4Weather';

export default Step4Weather;
