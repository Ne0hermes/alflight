import React, { useEffect } from 'react';
import { TrendingDown, Mountain, Gauge, Wind, Clock } from 'lucide-react';
import { theme } from '../../../styles/theme';

/**
 * Étape 7 : Affinage des paramètres TOD (Top of Descent)
 * - Altitude de croisière
 * - Taux de descente
 * - Altitude pattern
 * - Calcul automatique du TOD
 */
export const Step7TodParameters = ({ flightPlan, onUpdate }) => {
  const { todParameters, route, aircraft } = flightPlan;

  // Initialiser les valeurs depuis les données existantes
  useEffect(() => {
    let needsUpdate = false;
    const updates = {};

    // Mettre à jour l'altitude du terrain d'arrivée depuis le trajet
    if (route.arrival.elevation && todParameters.arrivalElevation !== route.arrival.elevation) {
      updates.arrivalElevation = route.arrival.elevation;
      needsUpdate = true;

      // Ajuster l'altitude pattern selon le terrain
      const suggestedPattern = route.arrival.elevation > 0 ? 1000 : 1500;
      if (todParameters.patternAltitude !== suggestedPattern) {
        updates.patternAltitude = suggestedPattern;
      }
    }

    // Mettre à jour la vitesse sol depuis l'avion
    if (aircraft.cruiseSpeed && todParameters.groundSpeed !== aircraft.cruiseSpeed) {
      updates.groundSpeed = aircraft.cruiseSpeed;
      needsUpdate = true;
    }

    // Appliquer les mises à jour si nécessaire
    if (needsUpdate) {
      flightPlan.updateTODParameters(updates);
      onUpdate();
    }
  }, [route.arrival.elevation, aircraft.cruiseSpeed]);

  const handleChange = (field, value) => {
    flightPlan.updateTODParameters({ [field]: value });
    onUpdate();
  };

  // Déterminer si la descente est possible
  const isDescentPossible = todParameters.altitudeToDescent > 0;
  const needsClimb = todParameters.altitudeToDescent < 0;

  return (
    <div style={styles.container}>
      {/* En-tête informatif */}
      <div style={styles.infoCard}>
        <TrendingDown size={24} style={{ color: theme.colors.warning }} />
        <div>
          <h4 style={styles.infoTitle}>Calcul du Top of Descent (TOD)</h4>
          <p style={styles.infoText}>
            Affinez les paramètres de descente pour votre arrivée à {route.arrival.icao || 'destination'}
          </p>
        </div>
      </div>

      {/* Paramètres ajustables */}
      <div style={styles.parametersGrid}>
        {/* Altitude de croisière */}
        <div style={styles.field}>
          <label style={styles.label}>
            <Mountain size={18} style={styles.icon} />
            Altitude de croisière prévue
          </label>
          <div style={styles.inputGroup}>
            <input
              type="number"
              style={styles.input}
              value={todParameters.cruiseAltitude}
              onChange={(e) => handleChange('cruiseAltitude', parseInt(e.target.value) || 0)}
              min="0"
              max="20000"
              step="100"
            />
            <span style={styles.unit}>ft</span>
          </div>
          <p style={styles.hint}>Altitude prévue en croisière</p>
        </div>

        {/* Taux de descente */}
        <div style={styles.field}>
          <label style={styles.label}>
            <Gauge size={18} style={styles.icon} />
            Taux de descente
          </label>
          <div style={styles.inputGroup}>
            <input
              type="number"
              style={styles.input}
              value={todParameters.descentRate}
              onChange={(e) => handleChange('descentRate', parseInt(e.target.value) || 0)}
              min="300"
              max="1000"
              step="50"
            />
            <span style={styles.unit}>ft/min</span>
          </div>
          <p style={styles.hint}>Vitesse verticale de descente (standard: 500 ft/min)</p>
        </div>

        {/* Altitude pattern */}
        <div style={styles.field}>
          <label style={styles.label}>
            <Mountain size={18} style={styles.icon} />
            Altitude pattern
          </label>
          <div style={styles.inputGroup}>
            <input
              type="number"
              style={styles.input}
              value={todParameters.patternAltitude}
              onChange={(e) => handleChange('patternAltitude', parseInt(e.target.value) || 0)}
              min="500"
              max="3000"
              step="100"
            />
            <span style={styles.unit}>ft AAL</span>
          </div>
          <p style={styles.hint}>Hauteur au-dessus du terrain en arrivée</p>
        </div>

        {/* Vitesse sol */}
        <div style={styles.field}>
          <label style={styles.label}>
            <Wind size={18} style={styles.icon} />
            Vitesse sol estimée
          </label>
          <div style={styles.inputGroup}>
            <input
              type="number"
              style={styles.input}
              value={todParameters.groundSpeed}
              onChange={(e) => handleChange('groundSpeed', parseInt(e.target.value) || 0)}
              min="60"
              max="300"
              step="5"
            />
            <span style={styles.unit}>kt</span>
          </div>
          <p style={styles.hint}>Vitesse sol prévue (TAS + vent)</p>
        </div>
      </div>

      {/* Résultats du calcul TOD */}
      <div style={{
        ...styles.resultsCard,
        ...(needsClimb ? styles.resultsCardError : isDescentPossible ? styles.resultsCardSuccess : styles.resultsCardWarning)
      }}>
        <div style={styles.resultsHeader}>
          <TrendingDown size={20} />
          <h3 style={styles.resultsTitle}>Résultats du calcul</h3>
        </div>

        {isDescentPossible ? (
          <>
            {/* Distance TOD */}
            <div style={styles.resultRow}>
              <div style={styles.resultLabel}>📍 Distance au TOD</div>
              <div style={styles.resultValue}>
                {todParameters.distanceToTod} NM
              </div>
            </div>
            <div style={styles.resultDescription}>
              Commencez la descente {todParameters.distanceToTod} NM avant l'arrivée
            </div>

            {/* Temps de descente */}
            <div style={styles.resultRow}>
              <div style={styles.resultLabel}>
                <Clock size={16} style={{ display: 'inline', marginRight: '6px' }} />
                Temps de descente
              </div>
              <div style={styles.resultValue}>
                {todParameters.descentTime} min
              </div>
            </div>

            {/* Angle de descente */}
            <div style={styles.resultRow}>
              <div style={styles.resultLabel}>📐 Angle de descente</div>
              <div style={styles.resultValue}>
                {todParameters.descentAngle}°
              </div>
            </div>

            {/* Paramètres détaillés */}
            <div style={styles.detailsBox}>
              <h4 style={styles.detailsTitle}>Paramètres utilisés</h4>
              <div style={styles.detailsGrid}>
                <div>• Altitude croisière : {todParameters.cruiseAltitude} ft</div>
                <div>• Altitude terrain : {todParameters.arrivalElevation} ft</div>
                <div>• Altitude pattern : {todParameters.arrivalElevation + todParameters.patternAltitude} ft</div>
                <div>• Descente totale : {todParameters.altitudeToDescent} ft</div>
                <div>• Taux de descente : {todParameters.descentRate} ft/min</div>
                <div>• Vitesse sol : {todParameters.groundSpeed} kt</div>
              </div>
            </div>
          </>
        ) : needsClimb ? (
          <div style={styles.errorMessage}>
            <h4 style={styles.errorTitle}>⚠️ Montée requise</h4>
            <p>
              Votre altitude de croisière ({todParameters.cruiseAltitude} ft) est inférieure à l'altitude pattern requise ({todParameters.arrivalElevation + todParameters.patternAltitude} ft).
            </p>
            <p style={{ marginTop: '8px' }}>
              Augmentez votre altitude de croisière ou réduisez l'altitude pattern.
            </p>
          </div>
        ) : (
          <div style={styles.warningMessage}>
            <h4 style={styles.warningTitle}>ℹ️ Déjà à l'altitude pattern</h4>
            <p>
              Vous êtes déjà à l'altitude pattern requise. Aucune descente nécessaire.
            </p>
          </div>
        )}
      </div>

      {/* Conseils de pilotage */}
      {isDescentPossible && (
        <div style={styles.tipsCard}>
          <h4 style={styles.tipsTitle}>💡 Conseils de pilotage</h4>
          <ul style={styles.tipsList}>
            <li>Anticipez le TOD en surveillant votre distance à destination</li>
            <li>Ajustez votre puissance progressivement pour maintenir un taux de descente constant</li>
            <li>Surveillez votre vitesse : la descente augmente naturellement la vitesse</li>
            <li>Prévoyez une marge si vous rencontrez du vent de face en descente</li>
          </ul>
        </div>
      )}
    </div>

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  infoCard: {
    display: 'flex',
    gap: '16px',
    padding: '20px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '12px',
    border: '1px solid var(--accent-primary)',
  },
  infoTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--accent-primary)',
    marginBottom: '4px',
  },
  infoText: {
    fontSize: '14px',
    color: 'var(--accent-primary)',
    margin: 0,
  },
  parametersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  icon: {
    color: theme.colors.primary,
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '16px',
    borderRadius: '8px',
    border: '1px solid var(--text-tertiary)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontFamily: theme.fonts.primary,
    transition: 'all 0.3s',
  },
  unit: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    minWidth: '60px',
  },
  hint: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
    margin: 0,
  },
  resultsCard: {
    padding: '24px',
    borderRadius: '12px',
    border: '2px solid',
    marginTop: '8px',
  },
  resultsCardSuccess: {
    backgroundColor: 'var(--bg-overlay)',
    borderColor: 'var(--text-primary)',
  },
  resultsCardWarning: {
    backgroundColor: 'var(--bg-overlay)',
    borderColor: 'var(--accent-primary)',
  },
  resultsCardError: {
    backgroundColor: 'var(--bg-overlay)',
    borderColor: '#C04534',
  },
  resultsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  resultsTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
  },
  resultLabel: {
    fontSize: '15px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },
  resultValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: theme.colors.primary,
  },
  resultDescription: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
    marginTop: '8px',
    marginBottom: '16px',
  },
  detailsBox: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: '8px',
  },
  detailsTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginBottom: '12px',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  errorMessage: {
    padding: '16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '8px',
  },
  errorTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#C04534',
    marginBottom: '8px',
  },
  warningMessage: {
    padding: '16px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '8px',
  },
  warningTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--accent-primary)',
    marginBottom: '8px',
  },
  tipsCard: {
    padding: '20px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '12px',
    border: '1px solid var(--bg-overlay)',
  },
  tipsTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
  tipsList: {
    margin: 0,
    paddingLeft: '20px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    lineHeight: '1.8',
  },
};

export default Step7TodParameters;
