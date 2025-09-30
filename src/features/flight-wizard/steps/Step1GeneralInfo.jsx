import React from 'react';
import { Calendar, Radio, Plane, Sun, Moon, MapPin, Navigation } from 'lucide-react';
import { theme } from '../../../styles/theme';

/**
 * Étape 1 : Informations générales du vol
 * - Indicatif du vol
 * - Type de vol (VFR/IFR)
 * - Date prévue
 */
export const Step1GeneralInfo = ({ flightPlan, onUpdate }) => {
  const handleChange = (field, value) => {
    flightPlan.updateGeneralInfo({ [field]: value });
    onUpdate();
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  return (
    <div style={styles.container}>
      {/* Indicatif du vol */}
      <div style={styles.field}>
        <label style={styles.label}>
          <Plane size={18} style={styles.icon} />
          Quel est l'indicatif de votre vol ?
        </label>
        <input
          type="text"
          style={styles.input}
          placeholder="Ex: AFR123, FGBCD"
          value={flightPlan.generalInfo.callsign || ''}
          onChange={(e) => handleChange('callsign', e.target.value.toUpperCase())}
          maxLength={10}
        />
        <p style={styles.hint}>
          Entrez l'indicatif radio ou l'immatriculation de l'aéronef
        </p>
      </div>

      {/* Type de vol */}
      <div style={styles.field}>
        <label style={styles.label}>
          <Radio size={18} style={styles.icon} />
          Quel type de vol prévoyez-vous ?
        </label>
        <div style={styles.radioGroup}>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="flightType"
              value="VFR"
              checked={flightPlan.generalInfo.flightType === 'VFR'}
              onChange={(e) => handleChange('flightType', e.target.value)}
              style={styles.radio}
            />
            <span style={styles.radioText}>VFR</span>
            <span style={styles.radioDescription}>Vol à vue</span>
          </label>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="flightType"
              value="IFR"
              checked={flightPlan.generalInfo.flightType === 'IFR'}
              onChange={(e) => handleChange('flightType', e.target.value)}
              style={styles.radio}
            />
            <span style={styles.radioText}>IFR</span>
            <span style={styles.radioDescription}>Vol aux instruments</span>
          </label>
        </div>
      </div>

      {/* Période du vol (jour/nuit) */}
      <div style={styles.field}>
        <label style={styles.label}>
          <Sun size={18} style={styles.icon} />
          Quelle est la période de vol ?
        </label>
        <div style={styles.radioGroup}>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="dayNight"
              value="day"
              checked={flightPlan.generalInfo.dayNight === 'day'}
              onChange={(e) => handleChange('dayNight', e.target.value)}
              style={styles.radio}
            />
            <Sun size={18} style={{ color: theme.colors.primary }} />
            <span style={styles.radioText}>Jour</span>
          </label>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="dayNight"
              value="night"
              checked={flightPlan.generalInfo.dayNight === 'night'}
              onChange={(e) => handleChange('dayNight', e.target.value)}
              style={styles.radio}
            />
            <Moon size={18} style={{ color: theme.colors.primary }} />
            <span style={styles.radioText}>Nuit</span>
          </label>
        </div>
      </div>

      {/* Nature du vol (local/navigation) */}
      <div style={styles.field}>
        <label style={styles.label}>
          <Navigation size={18} style={styles.icon} />
          Quelle est la nature du vol ?
        </label>
        <div style={styles.radioGroup}>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="flightNature"
              value="local"
              checked={flightPlan.generalInfo.flightNature === 'local'}
              onChange={(e) => handleChange('flightNature', e.target.value)}
              style={styles.radio}
            />
            <MapPin size={18} style={{ color: theme.colors.primary }} />
            <span style={styles.radioText}>Local</span>
            <span style={styles.radioDescription}>Tour de piste</span>
          </label>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="flightNature"
              value="navigation"
              checked={flightPlan.generalInfo.flightNature === 'navigation'}
              onChange={(e) => handleChange('flightNature', e.target.value)}
              style={styles.radio}
            />
            <Navigation size={18} style={{ color: theme.colors.primary }} />
            <span style={styles.radioText}>Navigation</span>
            <span style={styles.radioDescription}>Vol de voyage</span>
          </label>
        </div>
      </div>

      {/* Date du vol */}
      <div style={styles.field}>
        <label style={styles.label}>
          <Calendar size={18} style={styles.icon} />
          Quelle est la date prévue du vol ?
        </label>
        <input
          type="date"
          style={styles.input}
          value={formatDate(flightPlan.generalInfo.date)}
          onChange={(e) => handleChange('date', new Date(e.target.value))}
          min={formatDate(new Date())}
        />
        <p style={styles.hint}>
          Sélectionnez la date de départ prévue
        </p>
      </div>

      {/* Résumé */}
      <div style={styles.summary}>
        <h3 style={styles.summaryTitle}>Résumé</h3>
        <div style={styles.summaryContent}>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Indicatif :</span>
            <span style={styles.summaryValue}>
              {flightPlan.generalInfo.callsign || 'Non défini'}
            </span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Type :</span>
            <span style={styles.summaryValue}>
              {flightPlan.generalInfo.flightType}
            </span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Période :</span>
            <span style={styles.summaryValue}>
              {flightPlan.generalInfo.dayNight === 'day' ? 'Jour' : 
               flightPlan.generalInfo.dayNight === 'night' ? 'Nuit' : 'Non défini'}
            </span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Nature :</span>
            <span style={styles.summaryValue}>
              {flightPlan.generalInfo.flightNature === 'local' ? 'Vol local' : 
               flightPlan.generalInfo.flightNature === 'navigation' ? 'Navigation' : 'Non défini'}
            </span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>Date :</span>
            <span style={styles.summaryValue}>
              {flightPlan.generalInfo.date 
                ? new Date(flightPlan.generalInfo.date).toLocaleDateString('fr-FR')
                : 'Non définie'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
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
  icon: {
    color: theme.colors.primary,
  },
  input: {
    padding: '14px 16px',
    fontSize: '16px',
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.primary,
    transition: 'all 0.3s',
  },
  hint: {
    fontSize: '12px',
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  radioGroup: {
    display: 'flex',
    gap: '20px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'rgba(10, 10, 10, 0.4)',
    cursor: 'pointer',
    transition: 'all 0.3s',
    flex: 1,
  },
  radio: {
    width: '20px',
    height: '20px',
    accentColor: theme.colors.primary,
  },
  radioText: {
    fontSize: '18px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  radioDescription: {
    fontSize: '14px',
    color: theme.colors.textSecondary,
    marginLeft: 'auto',
  },
  summary: {
    marginTop: '20px',
    padding: '20px',
    backgroundColor: 'rgba(147, 22, 60, 0.05)',
    borderRadius: '12px',
    border: `1px solid ${theme.colors.border}`,
  },
  summaryTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: '16px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  summaryContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  summaryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
  },
  summaryLabel: {
    color: theme.colors.textSecondary,
  },
  summaryValue: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
};

export default Step1GeneralInfo;