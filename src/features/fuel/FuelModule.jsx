// src/features/fuel/FuelModule.jsx

import React, { memo, useEffect } from 'react';
import { getRouteEffectiveSpeedKt } from '@features/navigation/utils/effectiveSpeed';
import { useFuel, useAircraft, useNavigation } from '@core/contexts';
import { AlertTriangle } from 'lucide-react';
import { activeTankIdsFrom } from '@core/stores/fuelStore';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { sx } from '@shared/styles/styleSystem';
import { useAlternatesForFuel } from '@features/alternates';
import { useFuelSync } from '@hooks/useFuelSync';
import { useUnits } from '@hooks/useUnits';
import { useUnitsWatcher } from '@hooks/useUnitsWatcher';
import { toUserUnit } from '@utils/unitsDisplay';
import { getCruiseSpeedKt, getFuelConsumptionLph, getFuelCapacityLtr, getFuelUsableCapacityLtr } from '@utils/aircraftPerf';
import { computeLegFuelPlans } from './utils/legFuelPlan';
import { tankUsableLtr } from '@alflight/calc-engine/fuel/tankCapacity';
// 🎨 Charte éditoriale ALFlight
import { ModuleHero } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

const FuelRow = memo(({ type, label, description, fuel, onChange, readonly = false, automatic = false, totalGal }) => {
  const { format, convert, getSymbol, toStorage, getUnit } = useUnits();
  const units = useUnitsWatcher(); // Force re-render on units change


  // Valeurs par défaut si fuel est undefined
  const safeFuel = fuel || { gal: 0, ltr: 0 };

  // Gérer les changements selon l'unité préférée
  const handleFuelChange = (value) => {
    const numValue = parseFloat(value) || 0;
    const userUnit = getUnit('fuel');

    // Convertir vers les unités de stockage (L et gal)
    // Utilise la densité standard définie dans unitConversions.js (0.72 pour AVGAS)
    const ltr = convert(numValue, 'fuel', userUnit, { toUnit: 'ltr' });
    const gal = convert(numValue, 'fuel', userUnit, { toUnit: 'gal' });

    onChange({
      gal: gal,
      ltr: ltr
    });
  };

  // Obtenir la valeur à afficher selon l'unité préférée
  const getDisplayValue = () => {
    const userUnit = getUnit('fuel');
    // Convertir depuis l'unité de stockage (ltr) vers l'unité utilisateur
    return convert(safeFuel.ltr, 'fuel', 'ltr', { toUnit: userUnit }).toFixed(1);
  };

  return (
    <tr style={{ borderBottom: `1px solid ${sx.theme.colors.gray[200]}` }}>
      <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
        <div>
          <p style={sx.combine(sx.text.sm, sx.text.bold, { margin: 0, fontSize: 'var(--fs-body)' })}>
            {label}
            {readonly && <span style={{ marginLeft: '4px', color: sx.theme.colors.gray[500], fontSize: 'var(--fs-caption)' }}>🔒</span>}
            {automatic && <span style={{ marginLeft: '4px', color: sx.theme.colors.success[500], fontSize: 'var(--fs-caption)' }}>⚡</span>}
          </p>
          <p style={sx.combine(sx.text.xs, sx.text.secondary, { margin: 0, fontSize: 'var(--fs-caption)', lineHeight: '1.3', wordBreak: 'break-word', overflow: 'hidden' })}>
            {description}
          </p>
        </div>
      </td>
      <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
          <input
            type="number"
            value={getDisplayValue()}
            onChange={(e) => handleFuelChange(e.target.value)}
            disabled={readonly}
            style={sx.combine(
              sx.components.input.base,
              { width: '60px', textAlign: 'center', padding: '6px 2px', fontSize: 'var(--fs-body)' },
              readonly && { backgroundColor: sx.theme.colors.gray[100], cursor: 'not-allowed' }
            )}
            step="0.1"
          />
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', fontWeight: '500' }}>
            {getSymbol('fuel')}
          </span>
        </div>
      </td>
      <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
        <span style={sx.combine(sx.text.sm, sx.text.bold, { fontSize: 'var(--fs-body)' })}>
          {totalGal > 0 ? ((safeFuel.gal / totalGal) * 100).toFixed(0) : 0}%
        </span>
      </td>
    </tr>
  );
});

// ─── Configuration réservoirs par vol ────────────────────────────────────────
// 🔧 LOT 9-C : l'UI de cochage des réservoirs et de saisie du FOB a déménagé à
// l'étape Masse & Centrage (TankPlanningBlock dans Step6WeightBalance) — le
// bilan carburant garde uniquement la lecture de la config (bandeau capacité).

export const FuelModule = memo(({ wizardMode = false, config = {} }) => {
  useFuelSync();
  const { format, convert, getSymbol, toStorage, getUnit } = useUnits();
  const units = useUnitsWatcher(); // Force re-render on units change

  const { selectedAircraft } = useAircraft();
  const { navigationResults, flightType, waypoints } = useNavigation();
  const {
    fuelData, setFuelData, calculateTotal,
    tankConfig
  } = useFuel();

  // ─── Lecture de la config réservoirs (saisie déplacée en Masse & Centrage) ─
  const aircraftTanks = Array.isArray(selectedAircraft?.additionalFuelTanks)
    ? selectedAircraft.additionalFuelTanks : [];
  const hasTanks = aircraftTanks.length > 0;

  // Config qui FAIT FOI = engagée pour cet avion ET au moins une case touchée
  // (une config vierge — reload de brouillon — n'écrase rien, cf. fuelStore).
  const flightTankIds = activeTankIdsFrom(tankConfig, selectedAircraft);
  const tankConfigAuthoritative = hasTanks && flightTankIds != null;
  // Somme des capacités UTILISABLES des réservoirs COCHÉS. tankUsableLtr, pas
  // t.capacity : sur une fiche à deux contenances (17/08/2026), le champ legacy
  // `capacity` peut être resté sur une vieille valeur — F-GNAM portait 91 L
  // (une aile) face à usableCapacity = 182 L, et le module carburant plafonnait
  // le vol à 91 L. L'utilisable EST la grandeur des moteurs.
  // 🔧 25/08/2026 (Lot 1.0) — somme STRICTE : un réservoir COCHÉ dont le
  // volume utilisable est illisible rend la capacité du vol INCONNUE (null).
  // L'ancien « || 0 » le comptait pour zéro : total amputé d'apparence
  // normale, alertes de dépassement éteintes.
  const checkedCapacityLtr = aircraftTanks.reduce((somme, t, i) => {
    if (somme === null) return null;
    if (!tankConfig?.tanks?.[String(t?.id ?? i)]?.active) return somme;
    const u = tankUsableLtr(t);
    return u === null ? null : somme + u;
  }, 0);
  // Capacité EFFECTIVE du vol = somme des réservoirs cochés quand la config
  // fait foi (base des alertes de dépassement et du % remplissage — plus
  // jamais la capacité long-range quand l'avion vole en standard). Config
  // vierge/non engagée : capacité historique de l'avion.
  const effectiveCapacityLtr = tankConfigAuthoritative
    ? checkedCapacityLtr
    // Capacité historique absente ⇒ null (inconnue), plus jamais 0.
    : (selectedAircraft?.fuelCapacity ?? null);

  // 🔧 LOT 7 — Le bouton « Volume Max (jusqu'à MTOW) » a été retiré à la
  // demande de César (emplacement à redéfinir). La logique de calcul reste
  // disponible dans utils/maxFuel.js (computeMaxFuel) pour son futur retour.

  const alternatesData = useAlternatesForFuel();
  const {
    alternateFuelRequired,
    alternateFuelRequiredGal,
    alternatesCount,
    maxDistanceAlternate,
    hasAlternates,
    diversionAnalysis
  } = alternatesData;


  // S'assurer que fuelData existe avec des valeurs par défaut
  // Utiliser les valeurs de fuelData si elles existent, sinon les valeurs par défaut
  const safeFuelData = {
    roulage: fuelData?.roulage || { gal: 0, ltr: 0 },
    trip: fuelData?.trip || { gal: 0, ltr: 0 },
    contingency: fuelData?.contingency || { gal: 0, ltr: 0 },
    alternate: fuelData?.alternate || { gal: 0, ltr: 0 },
    finalReserve: fuelData?.finalReserve || { gal: 0, ltr: 0 },
    additional: fuelData?.additional || { gal: 0, ltr: 0 },
    extra: fuelData?.extra || { gal: 0, ltr: 0 },
    discretionary: fuelData?.discretionary || { gal: 0, ltr: 0 }
  };

  // Synchronisation automatique du carburant depuis la navigation
  useEffect(() => {
    if (!navigationResults || !selectedAircraft) {
      console.log('🚫 Fuel sync: Missing navigationResults or selectedAircraft');
      return;
    }

    console.log('🔄 Fuel sync: navigationResults', navigationResults);
    console.log('🔄 Fuel sync: selectedAircraft', selectedAircraft);

    // Toujours calculer le trip fuel si on a une distance
    if (navigationResults.totalDistance > 0) {
      // CONVENTION CANONIQUE : selectedAircraft.fuelConsumption est TOUJOURS en lph.
      // Aucune détection d'unité nécessaire — les calculs internes sont en SI.
      const consumptionLph = getFuelConsumptionLph(selectedAircraft) || 0;
      const cruiseSpeed = getCruiseSpeedKt(selectedAircraft);

      // 🔧 25/08/2026 (Lot 1.0) — consommation ou vitesse absentes : on ne
      // FABRIQUE plus un trip à 0 L ni une réserve à 0 L. Les postes gardent
      // leur valeur (zéro initial du store, plus aucun litre pré-rempli) et
      // le pilote voit un bilan qui n'a PAS été calculé, au lieu d'un bilan
      // faux qui a l'air complet.
      if (!(consumptionLph > 0) || !cruiseSpeed) {
        return;
      }
      let tripLtr;
      if (consumptionLph > 0 && cruiseSpeed) {
        // 🔧 C2 (Lot 0.4) : temps CORRIGÉ DU VENT — priorité au temps total du
        // moteur de navigation (déjà vent-corrigé), sinon vitesse sol moyenne
        // effective, en dernier recours TAS. Fin de la divergence « ETE corrigé
        // du vent à l'écran, trip fuel calculé sans vent ».
        const timeHours = navigationResults.totalTime > 0
          ? navigationResults.totalTime / 60
          : navigationResults.totalDistance / (navigationResults.effectiveSpeedKt || cruiseSpeed);
        tripLtr = timeHours * consumptionLph;
      } else {
        tripLtr = 0;
      }

      // Calculer contingency (5% du trip, minimum 1 gallon)
      const tripGal = convert(tripLtr, 'fuel', 'ltr', { toUnit: 'gal' });
      const contingencyGal = Math.max(1, tripGal * 0.05);
      const contingencyLtr = convert(contingencyGal, 'fuel', 'gal', { toUnit: 'ltr' });

      // Calculer final reserve (conso TOUJOURS en lph)
      const reserveMinutes = navigationResults.regulationReserveMinutes || 30;
      const reserveHours = reserveMinutes / 60;
      const reserveConsumptionLph = getFuelConsumptionLph(selectedAircraft) || 0;
      const reserveLtr = reserveConsumptionLph * reserveHours;

      const reserveGal = convert(reserveLtr, 'fuel', 'ltr', { toUnit: 'gal' });

      console.log('🔄 Fuel sync: Updating fuel data:', {
        trip: { gal: tripGal, ltr: tripLtr },
        contingency: { gal: contingencyGal, ltr: contingencyLtr },
        finalReserve: { gal: reserveGal, ltr: reserveLtr }
      });

      // Mettre à jour les données
      setFuelData(prev => ({
        ...prev,
        trip: {
          gal: parseFloat(tripGal.toFixed(1)),
          ltr: parseFloat(tripLtr.toFixed(1))
        },
        contingency: {
          gal: parseFloat(contingencyGal.toFixed(1)),
          ltr: parseFloat(contingencyLtr.toFixed(1))
        },
        finalReserve: {
          gal: parseFloat(reserveGal.toFixed(1)),
          ltr: parseFloat(reserveLtr.toFixed(1))
        }
      }));
    } else {
      console.log('⚠️ Fuel sync: No distance, resetting to 0');
      // Réinitialiser si pas de distance
      setFuelData(prev => ({
        ...prev,
        trip: { gal: 0, ltr: 0 },
        contingency: { gal: 0, ltr: 0 },
        finalReserve: { gal: 0, ltr: 0 }
      }));
    }
  }, [navigationResults, selectedAircraft]); // Retiré setFuelData des dépendances

  // Mettre à jour automatiquement le carburant alternate quand il change
  useEffect(() => {
    console.log('📊 Fuel Update - Alternates:', {
      hasAlternates,
      alternateFuelRequired,
      alternateFuelRequiredGal,
      alternatesCount,
      maxDistanceAlternate
    });

    if (hasAlternates) {
      // Toujours mettre à jour si on a des alternates, même si le fuel calculé est 0
      console.log('📊 Mise à jour du carburant alternate:', alternateFuelRequired, 'L');
      setFuelData(prev => ({
        ...prev,
        alternate: {
          gal: parseFloat((alternateFuelRequiredGal || 0).toFixed(1)),
          ltr: parseFloat((alternateFuelRequired || 0).toFixed(1))
        }
      }));
    } else {
      // Remettre à zéro si aucun alternate sélectionné
      console.log('📊 Reset carburant alternate (pas d\'alternates)');
      setFuelData(prev => ({
        ...prev,
        alternate: {
          gal: 0,
          ltr: 0
        }
      }));
    }
  }, [alternateFuelRequired, alternateFuelRequiredGal, hasAlternates, alternatesCount]); // Retiré setFuelData et maxDistanceAlternate des dépendances

  const handleFuelChange = (type, values) => {
    // Ne pas permettre la modification manuelle de ces types (calculés automatiquement)
    if (type === 'trip' || type === 'contingency' || type === 'finalReserve' || type === 'alternate') return;

    setFuelData({
      ...safeFuelData,
      [type]: values
    });
  };

  // S'assurer que calculateTotal retourne toujours un nombre
  // Arrondir à l'unité supérieure pour éviter les valeurs décimales longues
  const safeCalculateTotal = (unit) => {
    const total = calculateTotal ? calculateTotal(unit) : 0;
    const validTotal = typeof total === 'number' ? total : 0;
    return Math.ceil(validTotal);
  };

  const getReserveDescription = () => {
    if (!flightType || !navigationResults) return 'Définir type de vol';

    const reserveMinutes = navigationResults.regulationReserveMinutes || 30;
    const reserveHours = (reserveMinutes / 60).toFixed(1);

    // CANONIQUE → user pref. La valeur du store est en lph (canonique).
    // On la convertit pour affichage selon les préférences utilisateur.
    // ⚠ getSymbol() du hook useUnits attend une CATÉGORIE, pas une unité.
    const consumptionUserUnit = getUnit('fuelConsumption');
    // 🔒 P0 : conso via helper canonique (null si non renseignée) — plus de 30 L/h fabriqué.
    const consumptionCanonical = getFuelConsumptionLph(selectedAircraft);
    if (consumptionCanonical == null) {
      return `${reserveMinutes} min — consommation carburant non renseignée`;
    }
    const consumptionDisplay = toUserUnit(consumptionCanonical, 'fuelConsumption', consumptionUserUnit) || consumptionCanonical;
    const consumptionSymbol = getSymbol('fuelConsumption');

    let desc = `${reserveMinutes} min = ${reserveHours}h × ${consumptionDisplay.toFixed(1)} ${consumptionSymbol} - `;
    desc += `${flightType.rules} `;
    desc += `${flightType.category === 'local' ? 'LOCAL' : 'NAV'} `;
    desc += flightType.period === 'nuit' ? 'NUIT' : 'JOUR';

    if (flightType.rules === 'IFR') desc += ' (+15 min)';

    return desc;
  };

  // 🔧 LOT 2 — Verdict de l'algorithme de la perpendiculaire, avec causes
  // EXPLICITES en cas de calcul impossible (fini le « Calcul en cours... »
  // éternel qui masquait les données manquantes).
  const getAlternateDescription = () => {
    if (!hasAlternates) return 'Aucun déroutement sélectionné';
    if (!selectedAircraft) return 'Avion non sélectionné';

    const worst = diversionAnalysis?.worst;
    if (!worst) {
      const firstError = diversionAnalysis?.errors?.[0];
      switch (firstError?.status) {
        case 'missing-position':
          return `Position du déroutement ${firstError.icao || ''} indisponible — resélectionnez-le à l'étape Déroutements`;
        case 'missing-aircraft-data':
          return 'Vitesse de croisière ou consommation manquante (avion incomplet)';
        case 'missing-route':
          return 'Route incomplète : renseignez départ et arrivée pour calculer le dégagement';
        default:
          return 'Calcul du dégagement impossible (données manquantes)';
      }
    }

    // A = carburant pied de perpendiculaire → arrivée ; B = pied → déroutement
    const a = worst.fuelToArrivalLtr;
    const b = worst.fuelToAlternateLtr;
    const icao = worst.icao || worst.name || 'Alternate';

    if (worst.isSufficient) {
      return `✓ ${icao} : carburant suffisant si le déroutement est décidé au passage du travers — le rejoindre (${b.toFixed(1)} L) demande moins que finir la navigation (${a.toFixed(1)} L)`;
    }
    return `${icao} : supplément ${worst.supplementLtr} L = rejoindre le déroutement (${b.toFixed(1)} L) − finir la navigation (${a.toFixed(1)} L), depuis le travers à ${worst.distFootToAlternateNM.toFixed(1)} NM`;
  };

  const getTripFuelDescription = () => {
    if (!navigationResults || navigationResults.totalDistance === 0) {
      return 'Aucune route définie';
    }

    const distance = Math.round(navigationResults.totalDistance);
    // 🔧 FIX D (fin Phase 4.2) : source unique getCruiseSpeedKt/getFuelConsumptionLph —
    // plus de fallback fabriqué (|| 100 kt / || 30 lph). Avion incomplet → on ne fabrique
    // pas une équation fausse, on le signale.
    const cruiseSpeed = getCruiseSpeedKt(selectedAircraft);
    const consumptionLph = getFuelConsumptionLph(selectedAircraft);
    if (!cruiseSpeed || !consumptionLph) {
      return 'Vitesse de croisière ou consommation manquante (avion incomplet)';
    }
    // Arrondi à 2 décimales (cohérent avec l'alternate) : 28/120 = 0,23 et non « 0,2 »
    const timeHours = (navigationResults.totalDistance / cruiseSpeed).toFixed(2);

    // Conso canonique (lph) → préférence utilisateur. getSymbol attend une CATÉGORIE.
    const consumptionUserUnit = getUnit('fuelConsumption');
    const consumptionDisplay = toUserUnit(consumptionLph, 'fuelConsumption', consumptionUserUnit) || consumptionLph;
    const consumptionSymbol = getSymbol('fuelConsumption');

    return `${distance} NM ÷ ${cruiseSpeed} kt = ${timeHours}h × ${consumptionDisplay.toFixed(1)} ${consumptionSymbol}`;
  };

  const getContingencyDescription = () => {
    if (!safeFuelData?.trip || safeFuelData.trip.gal === 0) {
      return '5% du trip (min 1 gal)';
    }

    const userUnit = getUnit('fuel');
    const tripValue = userUnit === 'gal' ? safeFuelData.trip.gal : safeFuelData.trip.ltr;
    const contingencyValue = userUnit === 'gal' ? safeFuelData.contingency.gal : safeFuelData.contingency.ltr;
    const unitSymbol = getSymbol('fuel');

    return `5% × ${tripValue.toFixed(1)} ${unitSymbol} = ${contingencyValue.toFixed(1)} ${unitSymbol} (min 1 gal)`;
  };

  const fuelTypes = [
    { key: 'roulage', label: 'Roulage', description: 'Taxi et attente' },
    { key: 'trip', label: 'Trip Fuel', description: getTripFuelDescription(), readonly: true, automatic: true },
    { key: 'contingency', label: 'Contingency', description: getContingencyDescription(), readonly: true, automatic: true },
    { key: 'alternate', label: 'Alternate', description: getAlternateDescription(), readonly: true, automatic: true },
    { key: 'finalReserve', label: 'Final Reserve', description: getReserveDescription(), readonly: true, automatic: true },
    { key: 'additional', label: 'Additional', description: 'Si requis par le type d\'opération' },
    { key: 'extra', label: 'Extra', description: 'Retards prévus / contraintes opérationnelles' },
    { key: 'discretionary', label: 'Discretionary', description: 'À la discrétion du commandant de bord' }
  ];

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: tokens.fontFamily.sans,
        minHeight: '100vh',
        padding: wizardMode
          ? 0
          : `clamp(${tokens.spacing[6]}, 4vw, ${tokens.spacing[9]}) clamp(${tokens.spacing[5]}, 3vw, ${tokens.spacing[8]})`,
        boxSizing: 'border-box',
      }}
    >
      {/* 🎨 Hero éditorial unifié (compressé via scripts/compress-hero-photos.mjs) */}
      {!wizardMode && (
        <ModuleHero
          image="/assets/photos/hero-fuel.jpg"
          eyebrow="FUEL · BILAN CARBURANT"
          title="Bilan carburant"
        />
      )}

      {/* Alerte si l'avion manque de données */}
      {selectedAircraft && (!selectedAircraft.fuelConsumption || (!selectedAircraft.cruiseSpeedKt && !selectedAircraft.cruiseSpeed)) && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
          <AlertTriangle size={20} />
          <div style={sx.flex.col}>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>
              ⚠️ Données avion incomplètes
            </p>
            <p style={sx.text.sm}>
              {!selectedAircraft.fuelConsumption && 'Consommation carburant non définie. '}
              {(!selectedAircraft.cruiseSpeedKt && !selectedAircraft.cruiseSpeed) && 'Vitesse de croisière non définie. '}
              Modifiez l'avion dans l'onglet "Gestion Avions".
            </p>
          </div>
        </div>
      )}

      {/* Tableau principal */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6), { padding: '0' })}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '55%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: `2px solid ${sx.theme.colors.gray[300]}` }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 'var(--fs-body)' }}>Type</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 'var(--fs-body)' }}>Quantité</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 'var(--fs-body)' }}>%</th>
            </tr>
          </thead>
          <tbody>
            {fuelTypes.map(type => {
              // S'assurer que la propriété existe dans fuelData
              const fuelValue = safeFuelData && safeFuelData[type.key]
                ? safeFuelData[type.key]
                : { gal: 0, ltr: 0 };

              return (
                <FuelRow
                  key={type.key}
                  type={type.key}
                  label={type.label}
                  description={type.description}
                  fuel={fuelValue}
                  onChange={(values) => handleFuelChange(type.key, values)}
                  readonly={type.readonly}
                  automatic={type.automatic}
                  totalGal={safeCalculateTotal('gal')}
                />
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${sx.theme.colors.gray[700]}` }}>
              <td style={{ padding: '8px 10px', fontWeight: 'bold', fontSize: 'var(--fs-body)' }}>TOTAL</td>
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', fontSize: 'var(--fs-body)' }}>
                {(() => {
                  const totalLtr = safeCalculateTotal('ltr');
                  const userUnit = getUnit('fuel');

                  if (userUnit === 'ltr') {
                    return `${totalLtr.toFixed(1)} ${getSymbol('fuel')}`;
                  } else if (userUnit === 'gal') {
                    return `${safeCalculateTotal('gal').toFixed(1)} ${getSymbol('fuel')}`;
                  } else if (userUnit === 'kg') {
                    return `${(totalLtr * 0.8).toFixed(1)} ${getSymbol('fuel')}`;
                  } else if (userUnit === 'lbs') {
                    return `${(totalLtr * 0.8 * 2.20462).toFixed(1)} ${getSymbol('fuel')}`;
                  }
                  return `${totalLtr.toFixed(1)} L`;
                })()}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', fontSize: 'var(--fs-body)' }}>
                100%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 🔧 LOT 8 — le total requis dépasse la capacité embarquable : escale
          avitaillement obligatoire (le bandeau détaillé + suggestions vit à
          l'étape Trajet). Capacité de référence : réservoirs cochés si la
          config fait foi, sinon capacité totale de l'avion. */}
      {(() => {
        const totalRequiredLtr = safeCalculateTotal('ltr');
        // 🔧 REVUE LOT 8 — même source de capacité que l'alerte de l'étape
        // Trajet (getFuelCapacityLtr) quand la config réservoirs ne fait pas
        // foi, sinon les deux écrans se contredisaient
        const capacityRef = tankConfigAuthoritative
          ? (effectiveCapacityLtr > 0 ? effectiveCapacityLtr : null)
          : getFuelUsableCapacityLtr(selectedAircraft); // ⛽ borne = utilisable

        // 🔧 CRAN 3 — avec une escale avitaillement, le bilan pertinent est
        // PAR TRONÇON (plein refait à l'escale) : le tableau ci-dessous
        // remplace le total « d'une traite ».
        const plan = computeLegFuelPlans({
          waypoints,
          cruiseSpeedKt: getCruiseSpeedKt(selectedAircraft),
          // 🔧 C2 : vitesse sol corrigée du vent (null si vents non chargés → TAS)
          effectiveSpeedKt: getRouteEffectiveSpeedKt(waypoints, getCruiseSpeedKt(selectedAircraft)),
          fuelConsumptionLph: getFuelConsumptionLph(selectedAircraft),
          taxiLtr: safeFuelData.roulage?.ltr || 0,
          finalReserveLtr: safeFuelData.finalReserve?.ltr || 0,
          alternateLtr: safeFuelData.alternate?.ltr || 0,
          // Revue cran 3 : supplément de déroutement PAR TRONÇON
          alternates: useAlternatesStore.getState().selectedAlternates,
          aircraft: selectedAircraft
        });

        if (plan?.isMultiLeg) {
          const cell = { padding: '6px 8px', border: '1px solid var(--border-subtle)', textAlign: 'center', fontSize: 'var(--fs-caption)' };
          // ⛔ Lot 1.0 : totalLtr peut être null (dégagement incalculable) —
          // null > x est faux, un some() nu aurait rendu « ✓ tient » à tort.
          const anyIncomputable = (plan.incomputableLegs || 0) > 0;
          const anyOver = capacityRef && plan.legs.some(l => Number.isFinite(l.totalLtr) && l.totalLtr > capacityRef);
          return (
            <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
              <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(2))}>
                ⛽ Bilan par tronçon — vol via {plan.legs.slice(0, -1).map(l => l.to.icao || l.to.name).join(', ')}
              </h3>
              <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(2))}>
                Plein refait à chaque escale : embarquez au moins le TOTAL de chaque
                tronçon à son départ (roulage, contingence 5 %, réserve finale par
                tronçon ; dégagement sur le dernier ; hors extras).
              </p>
              <div style={{ overflowX: 'auto' }} className="pdf-avoid-break">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                      <th style={{ ...cell, textAlign: 'left' }}>Tronçon</th>
                      <th style={cell}>Dist. (NM)</th>
                      <th style={cell}>Trip (L)</th>
                      <th style={cell}>Conting. (L)</th>
                      <th style={cell}>Roulage (L)</th>
                      <th style={cell}>Réserve (L)</th>
                      <th style={cell}>Dégag. (L)</th>
                      <th style={cell}>TOTAL (L)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.legs.map(l => {
                      const over = capacityRef && Number.isFinite(l.totalLtr) && l.totalLtr > capacityRef;
                      return (
                        <tr key={l.index}>
                          <td style={{ ...cell, textAlign: 'left', fontWeight: 600 }}>{l.label}</td>
                          <td style={cell}>{l.distanceNM.toFixed(0)}</td>
                          <td style={cell}>{l.tripLtr.toFixed(1)}</td>
                          <td style={cell}>{l.contingencyLtr.toFixed(1)}</td>
                          <td style={cell}>{l.taxiLtr.toFixed(1)}</td>
                          <td style={cell}>{l.finalReserveLtr.toFixed(1)}</td>
                          <td style={cell}>
                            {l.alternateLtr === null
                              ? <span style={{ color: 'var(--color-red-critical)', fontWeight: 600 }} title="Dégagement incalculable sur ce tronçon (déroutement ou données avion manquants) — l'ancien affichage montrait un faux 0.">⚠ n/c</span>
                              : <>
                                  {l.alternateLtr > 0 ? l.alternateLtr.toFixed(1) : '—'}
                                  {l.alternateStatus === 'partial' && (
                                    <span style={{ color: 'var(--color-orange-warning, #b45309)', fontWeight: 600 }} title="Au moins un déroutement sélectionné n'a pas pu être vérifié (position manquante) — le supplément affiché peut sous-estimer le pire cas."> ⚠</span>
                                  )}
                                </>}
                          </td>
                          <td style={{ ...cell, fontWeight: 700, color: over ? 'var(--color-red-critical)' : 'var(--text-primary)' }}>
                            {Number.isFinite(l.totalLtr) ? <>{Math.ceil(l.totalLtr)}{over ? ' ⚠' : ''}</> : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {capacityRef && (
                <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-body)', fontWeight: 600, color: anyOver || anyIncomputable ? 'var(--color-red-critical)' : 'var(--text-primary)' }}>
                  {/* Revue cran 3 : distinguer « dépasse la capacité TOTALE de
                      l'avion » (→ escale) de « dépasse seulement les réservoirs
                      cochés » (→ cocher plus de réservoirs, l'escale n'y peut rien).
                      ⛔ Lot 1.0 : dégagement incalculable → AUCUN verdict — un
                      « ✓ tient » sur un total incomplet serait un mensonge. */}
                  {anyIncomputable
                    ? `⚠️ Dégagement incalculable sur ${plan.incomputableLegs} tronçon${plan.incomputableLegs > 1 ? 's' : ''} (déroutement ou données avion manquants — voir l'étape Déroutements) : verdict d'emport indisponible.`
                    : anyOver
                      ? (plan.worstLeg.totalLtr > (getFuelCapacityLtr(selectedAircraft) || Infinity)
                        ? `⚠️ Un tronçon dépasse les ${Math.round(capacityRef)} L embarquables — déplacez l'escale ou ajoutez-en une (étape Trajet).`
                        : `⚠️ Un tronçon dépasse les ${Math.round(capacityRef)} L des réservoirs cochés — cochez des réservoirs supplémentaires à l'étape Masse & Centrage (capacité totale avion : ${Math.round(getFuelCapacityLtr(selectedAircraft) || 0)} L).`)
                      : `✓ Chaque tronçon tient dans les ${Math.round(capacityRef)} L embarquables${tankConfigAuthoritative ? ' (réservoirs cochés)' : ''} — tronçon le plus exigeant : ${Math.ceil(plan.worstLeg.totalLtr)} L.`}
                </p>
              )}
            </div>
          );
        }

        if (!capacityRef || totalRequiredLtr <= capacityRef) return null;
        return (
          <div style={{
            padding: '12px 16px',
            marginBottom: '16px',
            backgroundColor: 'rgba(220, 38, 38, 0.08)',
            border: '2px solid var(--color-red-critical)',
            borderLeft: '6px solid var(--color-red-critical)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--fs-body)',
            fontWeight: 600,
            color: 'var(--color-red-critical)'
          }}>
            ⛽ Bilan impossible d'une traite : {Math.ceil(totalRequiredLtr)} L requis pour{' '}
            {Math.round(capacityRef)} L embarquables
            {tankConfigAuthoritative && ' (réservoirs cochés)'}.
            {' '}Retournez à l'étape Trajet pour insérer une escale avitaillement
            (l'alerte y propose des terrains sur votre route).
          </div>
        );
      })()}

      {/* 🔧 LOT 9-C — la saisie du FOB et la configuration des réservoirs ont
          DÉMÉNAGÉ à l'étape Masse & Centrage (demande pilote) : le bilan
          carburant reste une VUE du carburant requis et du minimum
          réglementaire ; la répartition par réservoir (bras de levier,
          enveloppe) se fait là où vivent les masses. */}
      <div style={sx.combine(sx.components.card.base)}>
        <p style={sx.combine(sx.text.sm, sx.text.secondary, { margin: 0 })}>
          💡 La saisie du <strong>carburant embarqué (FOB)</strong> et la
          répartition par réservoir se font à l'étape <strong>Masse &amp;
          Centrage</strong>, avec les autres masses — le carburant requis
          calculé ci-dessus y sert de référence (avec une escale
          avitaillement&nbsp;: le TOTAL du <strong>tronçon&nbsp;1</strong>,
          le plein étant refait à l'escale).
        </p>
      </div>
    </div>
  );
});

FuelModule.displayName = 'FuelModule';
FuelRow.displayName = 'FuelRow';

export default FuelModule;