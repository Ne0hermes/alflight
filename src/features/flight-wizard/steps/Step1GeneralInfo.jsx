import React, { useEffect, useRef } from 'react';
import { Calendar, Radio, Plane, Sun, Moon, MapPin, Navigation, Fuel } from 'lucide-react';
import { theme } from '../../../styles/theme';
import { aircraftSelectors } from '../../../core/stores/aircraftStore';
import { useAircraft, useNavigation } from '@core/contexts';
import { flightTypeToGeneralInfo } from '@core/flightType';
import { useFuelStore } from '@core/stores/fuelStore';
import { useWeightBalanceStore } from '@core/stores/weightBalanceStore';
import { applyTankVariant, hasTankVariants, getDefaultVariantId, variantCapacities, variantCapacityBreakdown } from '@utils/tankVariants';
// 🎨 24/08/2026 — les <select> NATIFS déroulent une liste dessinée par l'OS :
// angles vifs sous Windows, surlignage bleu système, police système. Impossible
// à arrondir en CSS. CustomSelect existe précisément pour ça (cf. son en-tête),
// et c'est lui qu'utilise le reste de l'application — d'où l'écart signalé.
import { CustomSelect } from '@shared/components/editorial';

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
  // 🔧 LOT 5 : rawSelectedAircraft = avion SANS overlay de variante (source des
  // variantes disponibles) ; selectedTankVariantId/setSelectedTankVariant =
  // variante active (l'avion effectif est dérivé dans AircraftProvider)
  const {
    setSelectedAircraft,
    rawSelectedAircraft,
    selectedTankVariantId,
    setSelectedTankVariant
  } = useAircraft();

  // 🔒 SOURCE UNIQUE « type de vol » : period/rules/category vivent dans le
  // navigationStore (cf. @core/flightType). Le sélecteur de cette étape écrit
  // DIRECTEMENT dessus — c'est lui qui pilote la réserve réglementaire affichée
  // au bilan carburant. (Avant : Step1 écrivait generalInfo, que seul du code mort
  // lisait → choisir jour/nuit/nature n'avait aucun effet sur la réserve.)
  const { flightType, setFlightType } = useNavigation();
  const updateFlightType = (patch) => setFlightType({ ...flightType, ...patch });

  // Miroir SSOT → generalInfo : la projection anglaise (dayNight/flightType/
  // flightNature) sert encore à la persistance Supabase, à la synthèse et aux
  // tags PDF. On la tient à jour à chaque changement, mais on SAUTE la 1re passe
  // (montage) pour ne pas écraser le plan restauré avant l'amorçage du store par
  // le wizard (FlightPlanWizard amorce flightType depuis generalInfo au montage).
  const mirrorPrimed = useRef(false);
  useEffect(() => {
    if (!mirrorPrimed.current) {
      mirrorPrimed.current = true;
      return;
    }
    const projected = flightTypeToGeneralInfo(flightType);
    const gi = flightPlan.generalInfo;
    if (
      gi.dayNight !== projected.dayNight ||
      gi.flightType !== projected.flightType ||
      gi.flightNature !== projected.flightNature
    ) {
      flightPlan.updateGeneralInfo(projected);
      onUpdate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightType]);

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

      // 🔧 LOT 5 : appliquer la variante de réservoirs PAR DÉFAUT de l'avion
      // (setSelectedAircraft vient de remettre la variante à null si l'avion
      // a changé). L'avion effectif du contexte suivra automatiquement.
      const defaultVariantId = getDefaultVariantId(selectedAircraft);
      setSelectedTankVariant(defaultVariantId);
      const effectiveAircraft = applyTankVariant(selectedAircraft, defaultVariantId);

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
      // 🔧 LOT 5 : on copie l'avion EFFECTIF (variante par défaut appliquée :
      // additionalFuelTanks/fuelCapacity filtrés) + tankVariantId pour le brouillon
      const aircraftData = {
        ...effectiveAircraft, // Copier TOUTES les propriétés de l'avion (effectif)
        tankVariantId: defaultVariantId,
        // S'assurer que les propriétés essentielles sont bien définies
        registration: selectedAircraft.registration,
        type: selectedAircraft.aircraftType || selectedAircraft.type || '',
        model: selectedAircraft.model || '',
        // ⛔ Lot 1.0 (tranche 3, 25/08) : plus de miroirs à 0 fabriqué.
        // `cruiseSpeed: 0` était un miroir MORT (la clé canonique cruiseSpeedKt
        // survit au spread ; cruiseSpeed est undefined sur les 13 fiches) —
        // ligne supprimée. Capacité/conso absentes → null, jamais 0 : le 0
        // réinjectait par la porte de derrière la valeur bannie des écrivains
        // (AircraftModule), des lecteurs (FuelModule) et du moteur.
        fuelConsumption: selectedAircraft.fuelConsumption ?? null,
        fuelCapacity: effectiveAircraft.fuelCapacity ?? null,
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
            // ⚖️ 24/08/2026 — L'ENVELOPPE SAISIE FAIT FOI, le champ plat cgLimits
            // n'est plus qu'un repli. L'ancien ordre copiait dans le plan de vol un
            // miroir invisible et non éditable : F-GUVV portait {2,05–2,31} alors
            // que sa fiche de pesée PROUVE 2,40–2,59 (exemple de chargement officiel
            // à CG 2,555 m / 1150 kg). Aligné sur computeWeightBalance.
            const envPts = selectedAircraft.cgEnvelope?.forwardPoints;
            const envAft = parseOrNull(selectedAircraft.cgEnvelope?.aftCG);
            if ((Array.isArray(envPts) && envPts.length > 0) || envAft !== null) {
              return {
                forward: parseOrNull(envPts?.[0]?.cg),
                aft: envAft,
                forwardVariable: envPts || []
              };
            }

            const hasValidCgLimits = selectedAircraft.cgLimits &&
              selectedAircraft.cgLimits.forward !== '' &&
              selectedAircraft.cgLimits.aft !== '';
            if (hasValidCgLimits) {
              return selectedAircraft.cgLimits;
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

  // 🔧 LOT 5 : changement de variante de réservoirs pour ce vol
  const handleTankVariantSelection = (variantId) => {
    const id = variantId || null;
    setSelectedTankVariant(id);
    // Le cochage par vol doit être re-vérifié : la clé du tankConfig
    // (aircraft.id) ne change pas avec la variante
    useFuelStore.getState().resetTankConfig();
    // ⚠️ Purger AUSSI le FOB et les charges carburant du devis de masse :
    // un réservoir retiré par la variante garderait sinon un load fantôme
    // (l'effet FuelProvider ne remet à zéro que les réservoirs de la liste
    // COURANTE) et le FOB conserverait les litres de l'ancienne config.
    useFuelStore.getState().setFobFuel(0);
    const wbStore = useWeightBalanceStore.getState();
    Object.keys(wbStore.loads || {}).forEach((k) => {
      if (k === 'fuel' || k.startsWith('fuel_')) wbStore.updateLoad(k, 0);
    });
    if (rawSelectedAircraft) {
      const eff = applyTankVariant(rawSelectedAircraft, id);
      flightPlan.updateAircraft({
        tankVariantId: id,
        additionalFuelTanks: eff.additionalFuelTanks,
        fuelCapacity: eff.fuelCapacity,
        fuelUsableCapacity: eff.fuelUsableCapacity
      });
    }
    onUpdate();
  };

  // 🛢️ 23/08/2026 — libellé d'une configuration : ses capacités viennent du
  // moteur (variantCapacities : Σ totale et Σ utilisable de ses réservoirs, avec
  // repli legacy `capacity`). L'ancienne somme locale de `capacity` affichait
  // « 0 L » pour les réservoirs au modèle deux-contenances.
  // 🛢️ 24/08/2026 — la capacité ANNONCÉE ne compte que les réservoirs
  // INAMOVIBLES, ceux qui sont toujours à bord. Les réservoirs AMOVIBLES sont
  // signalés à part, avec le volume qu'ils ajoutent s'ils sont montés :
  // les additionner d'office annoncerait une contenance que l'avion n'a pas
  // ce jour-là, et c'est sur cette ligne que le pilote choisit sa configuration.
  const variantLabel = (aircraft, variant) => {
    const { base, options } = variantCapacityBreakdown(aircraft, variant?.id);
    const parts = [];
    if (base.totalLtr != null) parts.push(`${base.totalLtr.toFixed(0)} L total`);
    if (base.usableLtr != null) parts.push(`${base.usableLtr.toFixed(0)} L utilisables`);
    const texte = parts.length > 0 ? parts.join(' · ') : 'capacité incomplète';
    if (options.count === 0) return texte;
    const pluriel = options.count > 1 ? 's' : '';
    const volume = options.usableLtr != null ? ` : +${options.usableLtr.toFixed(0)} L utilisables` : '';
    return `${texte} (${options.count} option${pluriel} de réservoir${volume})`;
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  return (
    <div style={styles.container}>
      {/* Sélection de l'avion - ligne 1 */}
      <div style={styles.field}>
        <label style={styles.label}>
          <Plane size={18} style={styles.icon} />
          Avion
        </label>
        <CustomSelect
          ariaLabel="Avion"
          placeholder="— Sélectionnez un avion —"
          value={flightPlan.generalInfo.callsign || ''}
          onChange={handleAircraftSelection}
          options={aircraftList.map((aircraft) => ({
            value: aircraft.registration,
            label: `${aircraft.registration} — ${aircraft.model}`
          }))}
        />
      </div>

      {/* 🔧 LOT 5 : Configuration de réservoirs (variante) — visible seulement
          si l'avion sélectionné a au moins 2 variantes définies */}
      {hasTankVariants(rawSelectedAircraft) && (
        <div style={styles.field}>
          <label style={styles.label}>
            <Fuel size={18} style={styles.icon} />
            Configuration réservoirs
          </label>
          {/* 🛢️ 23/08/2026 — l'option « Tous les réservoirs » a été RETIRÉE :
              elle sommait le CATALOGUE de l'avion, y compris des réservoirs
              qui s'excluent (F-GOFP : 98 L OU 147 L ⇒ « 245 L » d'un avion
              qui n'existe pas). Le vol se fait TOUJOURS dans une configuration
              déclarée. Le placeholder tient lieu d'état « rien de choisi »
              (brouillon d'avant les configurations) — il n'est pas
              sélectionnable, donc on ne peut pas revenir à « aucune ». */}
          <CustomSelect
            ariaLabel="Configuration réservoirs"
            placeholder="— Choisir une configuration —"
            value={selectedTankVariantId || ''}
            onChange={handleTankVariantSelection}
            options={(rawSelectedAircraft.tankVariants || []).map((variant) => ({
              value: variant.id,
              label: `${variant.name} — ${variantLabel(rawSelectedAircraft, variant)}${variant.isDefault ? ' (défaut)' : ''}`
            }))}
          />
        </div>
      )}

      {/* Date du vol - ligne 2 */}
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

      {/* Type de vol - ligne 3 */}
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
              checked={flightType.rules === 'VFR'}
              onChange={() => updateFlightType({ rules: 'VFR' })}
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
              checked={flightType.rules === 'IFR'}
              onChange={() => updateFlightType({ rules: 'IFR' })}
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
              value="jour"
              checked={flightType.period === 'jour'}
              onChange={() => updateFlightType({ period: 'jour' })}
              style={styles.radio}
            />
            <Sun size={18} style={{ color: theme.colors.primary }} />
            <span style={styles.radioText}>Jour</span>
          </label>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="dayNight"
              value="nuit"
              checked={flightType.period === 'nuit'}
              onChange={() => updateFlightType({ period: 'nuit' })}
              style={styles.radio}
            />
            <Moon size={18} style={{ color: theme.colors.primary }} />
            <span style={styles.radioText}>Nuit</span>
            <span style={styles.radioDescription}>Réserve finale 45 min</span>
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
              checked={flightType.category === 'local'}
              onChange={() => updateFlightType({ category: 'local' })}
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
              checked={flightType.category === 'navigation'}
              onChange={() => updateFlightType({ category: 'navigation' })}
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
    fontSize: 'var(--fs-body)',
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
    fontSize: 'var(--fs-body)',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'var(--app-bg-alpha-80)',
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.primary,
    transition: 'all 0.3s',
  },
  select: {
    padding: '14px 16px',
    fontSize: 'var(--fs-body)',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'var(--app-bg-alpha-80)',
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.primary,
    transition: 'all 0.3s',
    cursor: 'pointer',
    minHeight: '48px',
  },
  hint: {
    fontSize: 'var(--fs-body)',
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
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'var(--app-bg-alpha-40)',
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
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(128, 128, 128, 0.3)',
    backgroundColor: 'var(--app-bg-alpha-20)',
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
    fontSize: 'var(--fs-body)',
    fontWeight: '400',
    color: theme.colors.textPrimary,
    whiteSpace: 'nowrap',
  },
  radioTextDisabled: {
    fontSize: 'var(--fs-body)',
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.4)',
    whiteSpace: 'nowrap',
  },
  radioDescription: {
    fontSize: 'var(--fs-body)',
    color: theme.colors.textSecondary,
    marginLeft: 'auto',
    whiteSpace: 'nowrap',
  },
  badge: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '600',
    color: 'var(--bg-surface)',
    backgroundColor: 'var(--accent-primary)',
    padding: '3px 6px',
    borderRadius: 'var(--radius-sm)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};

export default Step1GeneralInfo;