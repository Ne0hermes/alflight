// src/features/fuel/FuelModule.jsx

import React, { memo, useEffect } from 'react';
import { useFuel, useAircraft, useNavigation } from '@core/contexts';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useAlternatesForFuel } from '@features/alternates';
import { useFuelSync } from '@hooks/useFuelSync';
import { useUnits } from '@hooks/useUnits';
import { useUnitsWatcher } from '@hooks/useUnitsWatcher';
import { toUserUnit } from '@utils/unitsDisplay';
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
          <p style={sx.combine(sx.text.sm, sx.text.bold, { margin: 0, fontSize: '13px' })}>
            {label}
            {readonly && <span style={{ marginLeft: '4px', color: sx.theme.colors.gray[500], fontSize: '10px' }}>🔒</span>}
            {automatic && <span style={{ marginLeft: '4px', color: sx.theme.colors.success[500], fontSize: '10px' }}>⚡</span>}
          </p>
          <p style={sx.combine(sx.text.xs, sx.text.secondary, { margin: 0, fontSize: '10px', lineHeight: '1.3', wordBreak: 'break-word', overflow: 'hidden' })}>
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
              { width: '60px', textAlign: 'center', padding: '6px 2px', fontSize: '13px' },
              readonly && { backgroundColor: sx.theme.colors.gray[100], cursor: 'not-allowed' }
            )}
            step="0.1"
          />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>
            {getSymbol('fuel')}
          </span>
        </div>
      </td>
      <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
        <span style={sx.combine(sx.text.sm, sx.text.bold, { fontSize: '12px' })}>
          {totalGal > 0 ? ((safeFuel.gal / totalGal) * 100).toFixed(0) : 0}%
        </span>
      </td>
    </tr>
  );
});

export const FuelModule = memo(({ wizardMode = false, config = {} }) => {
  useFuelSync();
  const { format, convert, getSymbol, toStorage, getUnit } = useUnits();
  const units = useUnitsWatcher(); // Force re-render on units change

  const { selectedAircraft } = useAircraft();
  const { navigationResults, flightType } = useNavigation();
  const { fuelData, setFuelData, fobFuel, setFobFuel, calculateTotal, isFobSufficient } = useFuel();
  const alternatesData = useAlternatesForFuel();
  const {
    alternateFuelRequired,
    alternateFuelRequiredGal,
    alternatesCount,
    maxDistanceAlternate,
    hasAlternates
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
    extra: fuelData?.extra || { gal: 0, ltr: 0 }
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
      const consumptionLph = parseFloat(selectedAircraft.fuelConsumption) || 0;

      let tripLtr;
      if (consumptionLph > 0) {
        const cruiseSpeed = selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 100;
        const timeHours = navigationResults.totalDistance / cruiseSpeed;
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
      const reserveConsumptionLph = parseFloat(selectedAircraft.fuelConsumption) || 30;
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

  const handleFobChange = (unit, value) => {
    const numValue = parseFloat(value) || 0;
    if (unit === 'gal') {
      setFobFuel({
        gal: numValue,
        ltr: convert(numValue, 'fuel', 'gal', { toUnit: 'ltr' })
      });
    } else {
      setFobFuel({
        gal: convert(numValue, 'fuel', 'ltr', { toUnit: 'gal' }),
        ltr: numValue
      });
    }
  };

  // S'assurer que fobFuel existe avec des valeurs valides
  const safeFobFuel = {
    gal: (fobFuel && typeof fobFuel.gal === 'number') ? fobFuel.gal : 0,
    ltr: (fobFuel && typeof fobFuel.ltr === 'number') ? fobFuel.ltr : 0
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
    const consumptionCanonical = parseFloat(selectedAircraft?.fuelConsumption) || 30;
    const consumptionDisplay = toUserUnit(consumptionCanonical, 'fuelConsumption', consumptionUserUnit) || consumptionCanonical;
    const consumptionSymbol = getSymbol('fuelConsumption');

    let desc = `${reserveMinutes} min = ${reserveHours}h × ${consumptionDisplay.toFixed(1)} ${consumptionSymbol} - `;
    desc += `${flightType.rules} `;
    desc += `${flightType.category === 'local' ? 'LOCAL' : 'NAV'} `;
    desc += flightType.period === 'nuit' ? 'NUIT' : 'JOUR';

    if (flightType.rules === 'IFR') desc += ' (+15 min)';

    return desc;
  };

  const getAlternateDescription = () => {
    if (!hasAlternates) return 'Aucun déroutement sélectionné';
    if (!maxDistanceAlternate || maxDistanceAlternate.distance === 0) return 'Calcul en cours...';
    if (!selectedAircraft) return 'Avion non sélectionné';

    const distance = maxDistanceAlternate.distance.toFixed(1);
    const cruiseSpeed = selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 100;
    const timeHours = maxDistanceAlternate.distance / cruiseSpeed;

    // Arrondir à 2 décimales pour éviter d'afficher "0.0h"
    const timeFormatted = timeHours.toFixed(2);

    // CANONIQUE → user pref. La valeur du store est en lph (canonique).
    // On la convertit pour affichage selon les préférences utilisateur.
    // ⚠ getSymbol() du hook useUnits attend une CATÉGORIE, pas une unité.
    const consumptionUserUnit = getUnit('fuelConsumption');
    const consumptionCanonical = parseFloat(selectedAircraft?.fuelConsumption) || 30;
    const consumptionDisplay = toUserUnit(consumptionCanonical, 'fuelConsumption', consumptionUserUnit) || consumptionCanonical;
    const consumptionSymbol = getSymbol('fuelConsumption');

    // Formule simplifiée : la réserve finale (final reserve) est comptée séparément
    // Afficher l'ICAO de l'alternate de référence (le plus éloigné)
    const alternateIcao = maxDistanceAlternate.icao || maxDistanceAlternate.name || 'Alternate';
    return `${alternateIcao} : ${distance} NM ÷ ${cruiseSpeed} kt = ${timeFormatted}h × ${consumptionDisplay.toFixed(1)} ${consumptionSymbol}`;
  };

  const getTripFuelDescription = () => {
    if (!navigationResults || navigationResults.totalDistance === 0) {
      return 'Aucune route définie';
    }

    const distance = Math.round(navigationResults.totalDistance);
    const cruiseSpeed = selectedAircraft?.cruiseSpeedKt || selectedAircraft?.cruiseSpeed || 100;
    const timeHours = (navigationResults.totalDistance / cruiseSpeed).toFixed(1);

    // CANONIQUE → user pref. La valeur du store est en lph (canonique).
    // On la convertit pour affichage selon les préférences utilisateur.
    // ⚠ getSymbol() du hook useUnits attend une CATÉGORIE, pas une unité.
    const consumptionUserUnit = getUnit('fuelConsumption');
    const consumptionCanonical = parseFloat(selectedAircraft?.fuelConsumption) || 30;
    const consumptionDisplay = toUserUnit(consumptionCanonical, 'fuelConsumption', consumptionUserUnit) || consumptionCanonical;
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
    { key: 'extra', label: 'Extra', description: 'Discrétion pilote' }
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
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '13px' }}>Type</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: '13px' }}>Quantité</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: '13px' }}>%</th>
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
              <td style={{ padding: '8px 10px', fontWeight: 'bold', fontSize: '13px' }}>TOTAL</td>
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
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
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                100%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* FOB Section */}
      <div style={sx.combine(sx.components.card.base)}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
          ⛽ FOB - Carburant au décollage
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={sx.components.label.base}>Gallons</label>
            <input
              type="number"
              value={safeFobFuel.gal.toFixed(1)}
              onChange={(e) => handleFobChange('gal', e.target.value)}
              style={sx.components.input.base}
              step="0.1"
            />
          </div>
          <div>
            <label style={sx.components.label.base}>Litres</label>
            <input
              type="number"
              value={safeFobFuel.ltr.toFixed(1)}
              onChange={(e) => handleFobChange('ltr', e.target.value)}
              style={sx.components.input.base}
              step="0.1"
            />
          </div>
        </div>

        {/* Statut */}
        {(() => {
          // Vérifier si le carburant dépasse la capacité de l'avion
          // 🔧 FIX: fuelCapacity est TOUJOURS stocké en litres (unité de stockage standard)
          const fuelCapacityLtr = selectedAircraft?.fuelCapacity || 0;

          const exceedsCapacity = selectedAircraft && selectedAircraft.fuelCapacity && safeFobFuel.ltr > fuelCapacityLtr;
          const fillRatio = fuelCapacityLtr > 0 ? ((safeFobFuel.ltr / fuelCapacityLtr) * 100).toFixed(0) : 0;

          // 3 états possibles : Insuffisant (rouge), Capacité dépassée (orange), Suffisant (vert)
          const alertStyle = exceedsCapacity
            ? sx.components.alert.warning
            : (isFobSufficient && isFobSufficient() ? sx.components.alert.success : sx.components.alert.danger);

          return (
            <div style={sx.combine(sx.components.alert.base, alertStyle)}>
              {exceedsCapacity ? (
                <>
                  <AlertTriangle size={20} />
                  <div>
                    <p style={sx.text.bold}>⚠️ CAPACITÉ DÉPASSÉE</p>
                    <p style={sx.text.sm}>
                      Excédent par rapport à la capacité: {convert(Math.abs(safeFobFuel.ltr - fuelCapacityLtr), 'fuel', 'ltr').toFixed(1)} {getSymbol('fuel')}
                    </p>
                    <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                      Capacité max: {convert(fuelCapacityLtr, 'fuel', 'ltr').toFixed(1)} {getSymbol('fuel')} •
                      Remplissage: {fillRatio}% (impossible)
                    </p>
                  </div>
                </>
              ) : isFobSufficient && isFobSufficient() ? (
                <>
                  <CheckCircle size={20} />
                  <div>
                    <p style={sx.text.bold}>Carburant SUFFISANT</p>
                    <p style={sx.text.sm}>
                      Excédent: {convert(Math.abs(safeFobFuel.ltr - safeCalculateTotal('ltr')), 'fuel', 'ltr').toFixed(1)} {getSymbol('fuel')}
                    </p>
                    {selectedAircraft && selectedAircraft.fuelCapacity && (
                      <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                        Capacité max: {convert(fuelCapacityLtr, 'fuel', 'ltr').toFixed(1)} {getSymbol('fuel')} •
                        Remplissage: {fillRatio}%
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle size={20} />
                  <div>
                    <p style={sx.text.bold}>Carburant INSUFFISANT</p>
                    <p style={sx.text.sm}>
                      Manque: {convert(Math.abs(safeFobFuel.ltr - safeCalculateTotal('ltr')), 'fuel', 'ltr').toFixed(1)} {getSymbol('fuel')}
                    </p>
                    {selectedAircraft && selectedAircraft.fuelCapacity && (
                      <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                        Capacité max: {convert(fuelCapacityLtr, 'fuel', 'ltr').toFixed(1)} {getSymbol('fuel')} •
                        Remplissage: {fillRatio}%
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
});

FuelModule.displayName = 'FuelModule';
FuelRow.displayName = 'FuelRow';

export default FuelModule;