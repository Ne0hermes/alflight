// src/features/fuel/FuelModule.jsx

import React, { memo, useEffect } from 'react';
import { useFuel, useAircraft, useNavigation } from '@core/contexts';
import { Fuel, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useAlternatesForFuel } from '@features/alternates';
import { useFuelSync } from '@hooks/useFuelSync';
import { DataField } from '@shared/components';
import { useUnits } from '@hooks/useUnits';
import { useUnitsWatcher } from '@hooks/useUnitsWatcher';

const FuelRow = memo(({ type, label, description, fuel, onChange, readonly = false, automatic = false, totalGal }) => {
  const { format, convert, getSymbol, toStorage, getUnit } = useUnits();
  const units = useUnitsWatcher(); // Force re-render on units change
  const GAL_TO_LTR = 3.78541;
  
  // Valeurs par défaut si fuel est undefined
  const safeFuel = fuel || { gal: 0, ltr: 0 };
  
  // Gérer les changements selon l'unité préférée
  const handleFuelChange = (value) => {
    const numValue = parseFloat(value) || 0;
    const userUnit = getUnit('fuel');
    
    // Convertir vers les unités de stockage (L et gal)
    let ltr, gal;
    
    if (userUnit === 'ltr') {
      ltr = numValue;
      gal = ltr / GAL_TO_LTR;
    } else if (userUnit === 'gal') {
      gal = numValue;
      ltr = gal * GAL_TO_LTR;
    } else if (userUnit === 'kg') {
      // Densité du carburant: ~0.8 kg/L pour AVGAS
      ltr = numValue / 0.8;
      gal = ltr / GAL_TO_LTR;
    } else if (userUnit === 'lbs') {
      // 1 lbs = 0.453592 kg
      const kg = numValue * 0.453592;
      ltr = kg / 0.8;
      gal = ltr / GAL_TO_LTR;
    }
    
    onChange({
      gal: gal,
      ltr: ltr
    });
  };
  
  // Obtenir la valeur à afficher selon l'unité préférée
  const getDisplayValue = () => {
    const userUnit = getUnit('fuel');
    
    if (userUnit === 'ltr') {
      return safeFuel.ltr.toFixed(1);
    } else if (userUnit === 'gal') {
      return safeFuel.gal.toFixed(1);
    } else if (userUnit === 'kg') {
      return (safeFuel.ltr * 0.8).toFixed(1);
    } else if (userUnit === 'lbs') {
      return (safeFuel.ltr * 0.8 * 2.20462).toFixed(1);
    }
    return safeFuel.ltr.toFixed(1);
  };

  return (
    <tr style={{ borderBottom: `1px solid ${sx.theme.colors.gray[200]}` }}>
      <td style={{ padding: '12px' }}>
        <div>
          <p style={sx.combine(sx.text.sm, sx.text.bold, { margin: 0 })}>
            {label}
            {readonly && <span style={{ marginLeft: '8px', color: sx.theme.colors.gray[500] }}>🔒</span>}
            {automatic && <span style={{ marginLeft: '8px', color: sx.theme.colors.success[500] }}>⚡</span>}
          </p>
          <p style={sx.combine(sx.text.xs, sx.text.secondary, { margin: 0 })}>
            {description}
          </p>
        </div>
      </td>
      <td style={{ padding: '12px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <input
            type="number"
            value={getDisplayValue()}
            onChange={(e) => handleFuelChange(e.target.value)}
            disabled={readonly}
            style={sx.combine(
              sx.components.input.base,
              { width: '100px', textAlign: 'center' },
              readonly && { backgroundColor: sx.theme.colors.gray[100], cursor: 'not-allowed' }
            )}
            step="0.1"
          />
          <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
            {getSymbol('fuel')}
          </span>
        </div>
      </td>
      <td style={{ padding: '12px', textAlign: 'center' }}>
        <span style={sx.combine(sx.text.sm, sx.text.bold)}>
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

    const GAL_TO_LTR = 3.78541;
    
    // Toujours calculer le trip fuel si on a une distance
    if (navigationResults.totalDistance > 0) {
      // Si fuelRequired est 0, le calculer manuellement
      let tripLtr = navigationResults.fuelRequired;
      
      if (tripLtr === 0 && selectedAircraft.fuelConsumption > 0) {
        // Recalculer manuellement
        const cruiseSpeed = selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 100;
        const timeHours = navigationResults.totalDistance / cruiseSpeed;
        tripLtr = timeHours * selectedAircraft.fuelConsumption;
        console.log('⚠️ Fuel sync: Recalculated manually:', {
          distance: navigationResults.totalDistance,
          speed: cruiseSpeed,
          timeHours,
          consumption: selectedAircraft.fuelConsumption,
          tripLtr
        });
      }
      
      const tripGal = tripLtr / GAL_TO_LTR;
      
      // Calculer contingency (5% du trip, minimum 1 gallon)
      const contingencyGal = Math.max(1, tripGal * 0.05);
      const contingencyLtr = contingencyGal * GAL_TO_LTR;
      
      // Calculer final reserve
      const reserveMinutes = navigationResults.regulationReserveMinutes || 30;
      const reserveHours = reserveMinutes / 60;
      const reserveLtr = (selectedAircraft.fuelConsumption || 30) * reserveHours;
      const reserveGal = reserveLtr / GAL_TO_LTR;
      
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
        ltr: numValue * 3.78541
      });
    } else {
      setFobFuel({
        gal: numValue / 3.78541,
        ltr: numValue
      });
    }
  };

  // S'assurer que fobFuel existe
  const safeFobFuel = fobFuel || { gal: 0, ltr: 0 };
  
  // S'assurer que calculateTotal retourne toujours un nombre
  const safeCalculateTotal = (unit) => {
    const total = calculateTotal ? calculateTotal(unit) : 0;
    return typeof total === 'number' ? total : 0;
  };

  const getReserveDescription = () => {
    if (!flightType || !navigationResults) return 'Définir type de vol';
    
    let desc = `${navigationResults.regulationReserveMinutes} min - `;
    desc += `${flightType.rules} `;
    desc += `${flightType.category === 'local' ? 'LOCAL' : 'NAV'} `;
    desc += flightType.period === 'nuit' ? 'NUIT' : 'JOUR';
    
    if (flightType.rules === 'IFR') desc += ' (+15 min)';
    
    return desc;
  };

  const getAlternateDescription = () => {
    if (!hasAlternates) return 'Aucun déroutement sélectionné';
    if (!maxDistanceAlternate || maxDistanceAlternate.distance === 0) return 'Calcul en cours...';
    
    const refPoint = maxDistanceAlternate.referencePoint || (maxDistanceAlternate.type === 'departure' ? 'Départ' : 'Arrivée');
    return `${maxDistanceAlternate.icao} depuis ${refPoint} (${maxDistanceAlternate.distance.toFixed(1)} NM)`;
  };

  const fuelTypes = [
    { key: 'roulage', label: 'Roulage', description: 'Taxi et attente' },
    { key: 'trip', label: 'Trip Fuel', description: `Calculé depuis Navigation (${Math.round(navigationResults?.totalDistance || 0)} NM)`, readonly: true, automatic: true },
    { key: 'contingency', label: 'Contingency', description: '5% du trip (min 1 gal)', readonly: true },
    { key: 'alternate', label: 'Alternate', description: getAlternateDescription(), readonly: true, automatic: true },
    { key: 'finalReserve', label: 'Final Reserve', description: getReserveDescription(), readonly: true },
    { key: 'extra', label: 'Extra', description: 'Discrétion pilote' }
  ];

  return (
    <div>
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
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
          <Fuel size={20} style={{ marginRight: '8px' }} />
          Bilan carburant
        </h3>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${sx.theme.colors.gray[300]}` }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Quantité</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>%</th>
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
              <td style={{ padding: '12px', fontWeight: 'bold' }}>TOTAL</td>
              <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
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
              <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                100%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* FOB Section */}
      <div style={sx.combine(sx.components.card.base)}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
          ⛽ Carburant CRM (Constaté à bord)
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
        <div style={sx.combine(
          sx.components.alert.base,
          isFobSufficient && isFobSufficient() ? sx.components.alert.success : sx.components.alert.danger
        )}>
          {isFobSufficient && isFobSufficient() ? (
            <>
              <CheckCircle size={20} />
              <div>
                <p style={sx.text.bold}>Carburant SUFFISANT</p>
                <p style={sx.text.sm}>
                  Excédent: {Math.abs(safeFobFuel.ltr - safeCalculateTotal('ltr')).toFixed(1)} L
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle size={20} />
              <div>
                <p style={sx.text.bold}>Carburant INSUFFISANT</p>
                <p style={sx.text.sm}>
                  Manque: {Math.abs(safeFobFuel.ltr - safeCalculateTotal('ltr')).toFixed(1)} L
                </p>
              </div>
            </>
          )}
        </div>

        {/* Note sur le rayon d'action */}
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(3))}>
          <Info size={16} />
          <p style={sx.text.sm}>
            💡 Pour visualiser votre rayon d'action, consultez la carte dans l'onglet Navigation. 
            Le bouton "Afficher rayon" affichera les cercles de distance maximale et aller-retour 
            basés sur votre carburant utilisable.
          </p>
        </div>

        {/* Détails des déroutements si sélectionnés */}
        {hasAlternates && maxDistanceAlternate && maxDistanceAlternate.distance > 0 && (
          <div style={sx.combine(sx.components.card.base, sx.spacing.mt(4))}>
            <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
              🛬 Analyse des déroutements ({alternatesCount} sélectionnés)
            </h4>
            <DataField
              label="Aérodrome de référence pour le calcul"
              value={`${maxDistanceAlternate.icao} - ${maxDistanceAlternate.name || 'N/A'}`}
              dataSource={maxDistanceAlternate.dataSource || 'static'}
              emphasis={true}
            />
            <DataField
              label={`Distance depuis ${maxDistanceAlternate.referencePoint || 'le point de référence'}`}
              value={maxDistanceAlternate.distance.toFixed(1)}
              unit="NM"
              dataSource="calculated"
              size="sm"
              style={{ marginTop: '8px' }}
            />
            {selectedAircraft && (
              <>
                <div style={sx.combine(sx.spacing.mt(2), sx.spacing.pt(2), { borderTop: '1px solid #e5e7eb' })}>
                  <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
                    Calcul du carburant de déroutement :
                  </p>
                  <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                    • Distance max : {maxDistanceAlternate.distance.toFixed(1)} NM
                  </p>
                  <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                    • Vitesse croisière : {selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 100} kt
                  </p>
                  <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                    • Temps de vol : {(maxDistanceAlternate.distance / (selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 100) * 60).toFixed(0)} min
                  </p>
                  <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                    • Réserve approche : 30 min
                  </p>
                  <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                    • Consommation : {selectedAircraft.fuelConsumption || 30} L/h
                  </p>
                  <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mt(1))}>
                    • Total requis : {alternateFuelRequired} L ({alternateFuelRequiredGal.toFixed(1)} gal)
                  </p>
                </div>
              </>
            )}
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(2))}>
              <Info size={14} />
              <p style={sx.combine(sx.text.xs)}>
                Le carburant de dégagement est calculé automatiquement pour l'aérodrome le plus éloigné 
                de son point de référence (départ ou arrivée), garantissant ainsi une couverture complète 
                pour tous les déroutements possibles.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

FuelModule.displayName = 'FuelModule';
FuelRow.displayName = 'FuelRow';

export default FuelModule;