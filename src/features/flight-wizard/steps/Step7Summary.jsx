import React from 'react';
import { FileText, CheckCircle } from 'lucide-react';
import { theme } from '../../../styles/theme';

/**
 * Étape 7 : Synthèse du vol
 */
export const Step7Summary = ({ flightPlan, onUpdate }) => {
  const summary = flightPlan.generateSummary();

  return (
    <div style={styles.container}>
      <div style={styles.field}>
        <label style={styles.label}>
          <FileText size={18} style={styles.icon} />
          Synthèse de votre vol
        </label>
      </div>

      <div style={{ ...styles.card, backgroundColor: 'rgba(147, 22, 60, 0.05)' }}>
        <h4 style={{ fontSize: '16px', color: theme.colors.primary, marginBottom: '16px' }}>
          Résumé de la préparation
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Informations générales */}
          <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
            <h5 style={{ fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '8px' }}>
              Vol
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>{flightPlan.generalInfo.callsign} - {flightPlan.generalInfo.flightType}</div>
              <div>{flightPlan.generalInfo.dayNight === 'day' ? 'Jour' : 'Nuit'} - {flightPlan.generalInfo.flightNature === 'local' ? 'Local' : 'Navigation'}</div>
            </div>
          </div>

          {/* Route */}
          <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
            <h5 style={{ fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '8px' }}>
              Trajet
            </h5>
            <div>{flightPlan.route.departure.icao} → {flightPlan.route.arrival.icao}</div>
            {flightPlan.alternates.length > 0 && (
              <div style={{ fontSize: '12px', color: theme.colors.textMuted }}>
                Déroutement: {flightPlan.alternates.map(a => a.icao).join(', ')}
              </div>
            )}
          </div>

          {/* Aéronef et carburant */}
          <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
            <h5 style={{ fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '8px' }}>
              Aéronef
            </h5>
            <div>{flightPlan.aircraft.registration} - {flightPlan.aircraft.type}</div>
            <div style={{ fontSize: '12px', color: theme.colors.textMuted }}>
              Carburant: {flightPlan.fuel.confirmed} L
            </div>
          </div>

          {/* Masse et centrage */}
          <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
            <h5 style={{ fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '8px' }}>
              Masse et centrage
            </h5>
            <div>Masse décollage: {flightPlan.weightBalance.takeoffWeight} kg</div>
            <div style={{
              fontSize: '14px',
              color: flightPlan.weightBalance.withinLimits ? theme.colors.success : theme.colors.error,
              fontWeight: '600'
            }}>
              {flightPlan.weightBalance.withinLimits ? '✓ Dans les limites' : '✗ Hors limites'}
            </div>
          </div>

          {/* TOD (Top of Descent) */}
          {flightPlan.todParameters && flightPlan.todParameters.distanceToTod > 0 && (
            <div>
              <h5 style={{ fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '8px' }}>
                Top of Descent (TOD)
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>
                  <span style={{ fontWeight: '600', color: theme.colors.warning }}>
                    TOD à {flightPlan.todParameters.distanceToTod} NM
                  </span> de l'arrivée
                </div>
                <div style={{ fontSize: '12px', color: theme.colors.textMuted }}>
                  Altitude: {flightPlan.todParameters.cruiseAltitude} ft → {flightPlan.todParameters.arrivalElevation + flightPlan.todParameters.patternAltitude} ft
                </div>
                <div style={{ fontSize: '12px', color: theme.colors.textMuted }}>
                  Descente: {flightPlan.todParameters.descentRate} ft/min • {flightPlan.todParameters.descentTime} min • {flightPlan.todParameters.descentAngle}°
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <CheckCircle size={20} style={{ color: theme.colors.primary, marginBottom: '8px' }} />
        <p style={{ fontSize: '14px', color: theme.colors.textPrimary }}>
          Préparation du vol terminée. Vérifiez tous les éléments avant le départ.
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    fontSize: '16px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  card: {
    padding: '16px',
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
  },
  icon: {
    color: theme.colors.primary,
  },
};
