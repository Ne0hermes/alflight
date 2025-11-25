import React from 'react';
import { Calendar, Radio, Plane, Sun, Moon, MapPin, Navigation } from 'lucide-react';
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
      const aircraftData = {
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
      };

      // 🔧 FIX: S'assurer explicitement que weightBalance est copié ou créé
      if (selectedAircraft.weightBalance) {
        aircraftData.weightBalance = selectedAircraft.weightBalance;
        console.log('✅ [Step1] weightBalance copié explicitement:', aircraftData.weightBalance);
      } else if (selectedAircraft.arms) {
        // Créer weightBalance depuis arms (compatibilité structure F-HSTR)
        // ⚠️ SÉCURITÉ : AUCUNE valeur par défaut - null si données manquantes
        const arms = selectedAircraft.arms;

        // Helper pour parser ou retourner null
        const parseOrNull = (value) => {
          if (!value || value === '' || value === '0') return null;
          const parsed = parseFloat(value);
          return isNaN(parsed) ? null : parsed;
        };

        aircraftData.weightBalance = {
          // Bras pour les sièges (gauche = droit pour chaque rangée)
          frontLeftSeatArm: parseOrNull(arms.frontSeats) || parseOrNull(arms.frontSeat),
          frontRightSeatArm: parseOrNull(arms.frontSeats) || parseOrNull(arms.frontSeat),
          rearLeftSeatArm: parseOrNull(arms.rearSeats) || parseOrNull(arms.rearSeat),
          rearRightSeatArm: parseOrNull(arms.rearSeats) || parseOrNull(arms.rearSeat),

          // Bras carburant
          fuelArm: parseOrNull(arms.fuelMain) || parseOrNull(arms.fuel),

          // Bras masse à vide
          emptyWeightArm: parseOrNull(arms.empty),

          // Copier cgLimits depuis selectedAircraft
          // Si cgLimits existe mais que forward/aft sont vides, utiliser cgEnvelope
          cgLimits: (() => {
            const hasValidCgLimits = selectedAircraft.cgLimits &&
              selectedAircraft.cgLimits.forward !== '' &&
              selectedAircraft.cgLimits.aft !== '';

            if (hasValidCgLimits) {
              return selectedAircraft.cgLimits;
            }

            // Utiliser cgEnvelope comme fallback
            if (selectedAircraft.cgEnvelope) {
              return {
                forward: parseOrNull(selectedAircraft.cgEnvelope.forwardPoints?.[0]?.cg),
                aft: parseOrNull(selectedAircraft.cgEnvelope.aftCG),
                forwardVariable: selectedAircraft.cgEnvelope.forwardPoints || []
              };
            }

            // Dernier fallback
            return {
              forward: null,
              aft: null,
              forwardVariable: []
            };
          })(),

          // Préserver arms original pour référence
          _originalArms: arms
        };

        console.log('✅ [Step1] weightBalance créé depuis arms (null si manquant):', aircraftData.weightBalance);
      } else {
        console.error('❌ [Step1] Aucun weightBalance ni arms trouvé dans selectedAircraft');
      }

      // Copier aussi arms et baggageCompartments si disponibles
      if (selectedAircraft.arms) {
        aircraftData.arms = selectedAircraft.arms;
      }
      if (selectedAircraft.baggageCompartments) {
        aircraftData.baggageCompartments = selectedAircraft.baggageCompartments;
      }

      flightPlan.updateAircraft(aircraftData);
      console.log('✅ Avion pré-rempli avec toutes les propriétés:', selectedAircraft.registration);
      console.log('🔍 [Step1] flightPlan.aircraft.weightBalance:', flightPlan.aircraft.weightBalance);
      console.log('🔍 [Step1] flightPlan.aircraft.arms:', flightPlan.aircraft.arms);
    }

    onUpdate();
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  return (
    <div style={styles.container}>
      {/* Avion, Date et Type de vol côte à côte alignés par le bas */}
      <div style={styles.rowFieldsBottom}>
        {/* Sélection de l'avion */}
        <div style={styles.field}>
          <label style={styles.label}>
            <Plane size={18} style={styles.icon} />
            Avion
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
            Date du vol
          </label>
          <input
            type="date"
            style={styles.input}
            value={formatDate(flightPlan.generalInfo.date)}
            onChange={(e) => handleChange('date', new Date(e.target.value))}
            min={formatDate(new Date())}
          />
        </div>

        {/* Type de vol */}
        <div style={styles.field}>
          <label style={styles.label}>
            <Radio size={18} style={styles.icon} />
            Type de vol
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
  rowFieldsBottom: {
    display: 'flex',
    gap: '20px',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
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
    gap: '12px',
    flexWrap: 'wrap',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'rgba(10, 10, 10, 0.4)',
    cursor: 'pointer',
    transition: 'all 0.3s',
    flex: '1 1 auto',
    minWidth: 'fit-content',
  },
  radioLabelDisabled: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid rgba(128, 128, 128, 0.3)',
    backgroundColor: 'rgba(10, 10, 10, 0.2)',
    cursor: 'not-allowed',
    opacity: 0.5,
    transition: 'all 0.3s',
    flex: '1 1 auto',
    minWidth: 'fit-content',
    position: 'relative',
  },
  radio: {
    width: '18px',
    height: '18px',
    accentColor: theme.colors.primary,
    flexShrink: 0,
  },
  radioText: {
    fontSize: '16px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    whiteSpace: 'nowrap',
  },
  radioTextDisabled: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
    whiteSpace: 'nowrap',
  },
  radioDescription: {
    fontSize: '13px',
    color: theme.colors.textSecondary,
    marginLeft: 'auto',
    whiteSpace: 'nowrap',
  },
  badge: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#FFF',
    backgroundColor: '#F59E0B',
    padding: '3px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};

export default Step1GeneralInfo;