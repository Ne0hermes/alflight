import React from 'react';
import { Calendar, Radio, Plane, Sun, Moon, MapPin, Navigation, Fuel } from 'lucide-react';
import { theme } from '../../../styles/theme';
import { aircraftSelectors } from '../../../core/stores/aircraftStore';
import { useAircraft } from '@core/contexts';

/**
 * Étape 1 : Informations générales du vol
 * - Indicatif du vol
 * - Type de vol (VFR/IFR)
 * - Date prévue
 */
export const Step1GeneralInfo = ({ flightPlan, onUpdate }) => {
  // Récupérer la liste des avions disponibles
  const aircraftList = aircraftSelectors.useAircraftList();
  // Récupérer le contexte Aircraft pour mettre à jour l'avion sélectionné globalement
  const { setSelectedAircraft } = useAircraft();

  const handleChange = (field, value) => {
    flightPlan.updateGeneralInfo({ [field]: value });
    onUpdate();
  };

  // Gérer la sélection d'avion : pré-remplir automatiquement les données de l'aéronef
  const handleAircraftSelection = (registration) => {
    // Mettre à jour le callsign dans generalInfo
    flightPlan.updateGeneralInfo({ callsign: registration });

    // Trouver l'avion complet dans la liste
    const selectedAircraft = aircraftList.find(ac => ac.registration === registration);

    if (selectedAircraft) {
      // 🔧 CORRECTION : Mettre à jour le contexte Aircraft global pour les autres modules (alternates, etc.)
      // IMPORTANT: Passer l'OBJET complet, pas seulement l'ID
      setSelectedAircraft(selectedAircraft);
      console.log('🛩️ Contexte Aircraft mis à jour:', selectedAircraft.registration);

      // 🔍 DEBUG : Vérifier si weightBalance existe dans selectedAircraft
      console.log('🔍 [Step1] selectedAircraft has weightBalance?', !!selectedAircraft.weightBalance);
      console.log('🔍 [Step1] selectedAircraft has arms?', !!selectedAircraft.arms);
      if (selectedAircraft.weightBalance) {
        console.log('✓ [Step1] weightBalance exists:', selectedAircraft.weightBalance);
      } else if (selectedAircraft.arms) {
        console.log('⚠️ [Step1] arms exists but NOT mapped to weightBalance:', selectedAircraft.arms);
      } else {
        console.error('❌ [Step1] NO weightBalance NOR arms in selectedAircraft');
      }

      // Pré-remplir automatiquement TOUTES les données de l'avion dans le flightPlan
      // Copier l'objet complet pour que Step6 (Weight & Balance) ait accès à toutes les propriétés
      flightPlan.updateAircraft({
        ...selectedAircraft, // Copier TOUTES les propriétés de l'avion
        // S'assurer que les propriétés essentielles sont bien définies
        registration: selectedAircraft.registration,
        type: selectedAircraft.aircraftType || selectedAircraft.type || '',
        model: selectedAircraft.model || '',
        cruiseSpeed: selectedAircraft.cruiseSpeed || 0,
        fuelConsumption: selectedAircraft.fuelConsumption || 0,
        fuelCapacity: selectedAircraft.fuelCapacity || 0,
        emptyWeight: selectedAircraft.emptyWeight || 0,
        maxWeight: selectedAircraft.maxWeight || selectedAircraft.maxTakeoffWeight || 0,
        // Les propriétés suivantes sont maintenant incluses via ...selectedAircraft :
        // - weightBalance (bras de levier et limites CG)
        // - armLengths (bras de levier depuis AIXM)
        // - baggageCompartments (compartiments bagages dynamiques)
        // - masses (masses diverses)
        // - limitations (limitations diverses)
        // - cgEnvelope (enveloppe de centrage)
        // Et toutes les autres propriétés de l'avion
      });
      console.log('✅ Avion pré-rempli automatiquement avec toutes les propriétés:', selectedAircraft.registration);
    }

    onUpdate();
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  // Calculer la réserve réglementaire selon les règles
  const calculateRegulatoryReserve = () => {
    let regulationReserveMinutes = 30;

    // Nuit = 45 minutes
    if (flightPlan.generalInfo.dayNight === 'night') {
      regulationReserveMinutes = 45;
    }

    // IFR = +15 minutes
    if (flightPlan.generalInfo.flightType === 'IFR') {
      regulationReserveMinutes += 15;
    }

    // Local + Jour = 20 minutes
    if (flightPlan.generalInfo.flightNature === 'local' && flightPlan.generalInfo.dayNight === 'day') {
      regulationReserveMinutes = 20;
    }

    return regulationReserveMinutes;
  };

  const reserveMinutes = calculateRegulatoryReserve();

  // Description de la réserve
  const getReserveDescription = () => {
    const parts = [];

    if (flightPlan.generalInfo.flightType) {
      parts.push(flightPlan.generalInfo.flightType);
    }

    if (flightPlan.generalInfo.flightNature) {
      parts.push(flightPlan.generalInfo.flightNature === 'local' ? 'LOCAL' : 'NAV');
    }

    if (flightPlan.generalInfo.dayNight) {
      parts.push(flightPlan.generalInfo.dayNight === 'night' ? 'NUIT' : 'JOUR');
    }

    return parts.length > 0 ? parts.join(' - ') : 'Complétez les informations ci-dessus';
  };

  return (
    <div style={styles.container}>
      {/* Avion et Date côte à côte */}
      <div style={styles.rowFields}>
        {/* Sélection de l'avion */}
        <div style={styles.field}>
          <label style={styles.label}>
            <Plane size={18} style={styles.icon} />
            Quel avion allez-vous utiliser ?
          </label>
          <select
            style={styles.select}
            value={flightPlan.generalInfo.callsign || ''}
            onChange={(e) => handleAircraftSelection(e.target.value)}
          >
            <option value="">-- Sélectionnez un avion --</option>
            {aircraftList.map((aircraft) => (
              <option key={aircraft.id} value={aircraft.registration}>
                {aircraft.registration} - {aircraft.model}
              </option>
            ))}
          </select>
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
        </div>
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
          <label style={styles.radioLabelDisabled} title="Fonctionnalité en développement">
            <input
              type="radio"
              name="flightType"
              value="IFR"
              checked={flightPlan.generalInfo.flightType === 'IFR'}
              onChange={(e) => handleChange('flightType', e.target.value)}
              style={styles.radio}
              disabled
            />
            <span style={styles.radioTextDisabled}>IFR</span>
            <span style={styles.radioDescription}>Vol aux instruments</span>
            <span style={styles.badge}>À venir</span>
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
          <label style={styles.radioLabelDisabled} title="Fonctionnalité en développement">
            <input
              type="radio"
              name="dayNight"
              value="night"
              checked={flightPlan.generalInfo.dayNight === 'night'}
              onChange={(e) => handleChange('dayNight', e.target.value)}
              style={styles.radio}
              disabled
            />
            <Moon size={18} style={{ color: 'rgba(255, 255, 255, 0.4)' }} />
            <span style={styles.radioTextDisabled}>Nuit</span>
            <span style={styles.badge}>À venir</span>
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

      {/* Réserve réglementaire calculée */}
      <div style={styles.reserveCard}>
        <Fuel size={16} style={styles.icon} />
        <div style={styles.reserveContent}>
          <span style={styles.reserveLabel}>Réserve réglementaire :</span>
          <span style={styles.reserveMinutes}>{reserveMinutes} min</span>
          <span style={styles.reserveDescription}>({getReserveDescription()})</span>
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
  rowFields: {
    display: 'flex',
    gap: '20px',
    alignItems: 'flex-start',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
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
  select: {
    padding: '14px 16px',
    fontSize: '16px',
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.primary,
    transition: 'all 0.3s',
    cursor: 'pointer',
    minHeight: '48px',
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
  radioLabelDisabled: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    borderRadius: '8px',
    border: '1px solid rgba(128, 128, 128, 0.3)',
    backgroundColor: 'rgba(10, 10, 10, 0.2)',
    cursor: 'not-allowed',
    opacity: 0.5,
    transition: 'all 0.3s',
    flex: 1,
    position: 'relative',
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
  radioTextDisabled: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  radioDescription: {
    fontSize: '14px',
    color: theme.colors.textSecondary,
    marginLeft: 'auto',
  },
  badge: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#FFF',
    backgroundColor: '#F59E0B',
    padding: '4px 8px',
    borderRadius: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  reserveCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  reserveContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  },
  reserveLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  reserveMinutes: {
    fontSize: '18px',
    fontWeight: '700',
    color: theme.colors.primary,
  },
  reserveDescription: {
    fontSize: '13px',
    fontWeight: '500',
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
};

export default Step1GeneralInfo;