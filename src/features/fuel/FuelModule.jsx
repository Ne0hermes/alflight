// src/features/fuel/FuelModule.jsx

import React, { memo, useEffect } from 'react';
import { useFuel, useAircraft, useNavigation } from '@core/contexts';
import { Fuel, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useAlternatesForFuel } from '@features/alternates';
import { useAutoFuelSync } from '@hooks/useAutoFuelSync';

const FuelRow = memo(({ type, label, description, fuel, onChange, readonly = false, automatic = false, totalGal }) => {
  const GAL_TO_LTR = 3.78541;
  
  // Valeurs par défaut si fuel est undefined
  const safeFuel = fuel || { gal: 0, ltr: 0 };
  
  const handleGalChange = (value) => {
    const gal = parseFloat(value) || 0;
    onChange({
      gal: gal,
      ltr: gal * GAL_TO_LTR
    });
  };
  
  const handleLtrChange = (value) => {
    const ltr = parseFloat(value) || 0;
    onChange({
      gal: ltr / GAL_TO_LTR,
      ltr: ltr
    });
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
        <input
          type="number"
          value={safeFuel.gal.toFixed(1)}
          onChange={(e) => handleGalChange(e.target.value)}
          disabled={readonly}
          style={sx.combine(
            sx.components.input.base,
            { width: '80px', textAlign: 'center' },
            readonly && { backgroundColor: sx.theme.colors.gray[100], cursor: 'not-allowed' }
          )}
          step="0.1"
        />
      </td>
      <td style={{ padding: '12px', textAlign: 'center' }}>
        <input
          type="number"
          value={safeFuel.ltr.toFixed(1)}
          onChange={(e) => handleLtrChange(e.target.value)}
          disabled={readonly}
          style={sx.combine(
            sx.components.input.base,
            { width: '80px', textAlign: 'center' },
            readonly && { backgroundColor: sx.theme.colors.gray[100], cursor: 'not-allowed' }
          )}
          step="0.1"
        />
      </td>
      <td style={{ padding: '12px', textAlign: 'center' }}>
        <span style={sx.combine(sx.text.sm, sx.text.bold)}>
          {totalGal > 0 ? ((safeFuel.gal / totalGal) * 100).toFixed(0) : 0}%
        </span>
      </td>
    </tr>
  );
});

export const FuelModule = memo(() => {
  useAutoFuelSync();
  const { selectedAircraft } = useAircraft();
  const { navigationResults, flightType } = useNavigation();
  const { fuelData, setFuelData, fobFuel, setFobFuel, calculateTotal, isFobSufficient } = useFuel();
  const { 
    alternateFuelRequired, 
    alternateFuelRequiredGal, 
    alternatesCount, 
    maxDistanceAlternate,
    hasAlternates 
  } = useAlternatesForFuel();

  // S'assurer que fuelData existe avec des valeurs par défaut
  const safeFuelData = fuelData || {
    roulage: { gal: 0, ltr: 0 },
    trip: { gal: 0, ltr: 0 },
    contingency: { gal: 0, ltr: 0 },
    alternate: { gal: 0, ltr: 0 },
    finalReserve: { gal: 0, ltr: 0 },
    additional: { gal: 0, ltr: 0 },
    extra: { gal: 0, ltr: 0 }
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
  }, [navigationResults, selectedAircraft, setFuelData]);

  // Mettre à jour automatiquement le carburant alternate quand il change
  useEffect(() => {
    if (hasAlternates && alternateFuelRequired > 0) {
      setFuelData(prev => ({
        ...prev,
        alternate: {
          gal: alternateFuelRequiredGal || 0,
          ltr: alternateFuelRequired || 0
        }
      }));
    } else if (!hasAlternates) {
      // Remettre à zéro si aucun alternate sélectionné
      setFuelData(prev => ({
        ...prev,
        alternate: {
          gal: 0,
          ltr: 0
        }
      }));
    }
  }, [alternateFuelRequired, alternateFuelRequiredGal, hasAlternates, setFuelData, selectedAircraft]);

  const handleFuelChange = (type, values) => {
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
    
    return `Vers ${maxDistanceAlternate.icao} (${maxDistanceAlternate.distance.toFixed(1)} NM)`;
  };

  const fuelTypes = [
    { key: 'roulage', label: 'Roulage', description: 'Taxi et attente' },
    { key: 'trip', label: 'Trip Fuel', description: `Calculé depuis Navigation (${Math.round(navigationResults?.totalDistance || 0)} NM)`, readonly: true, automatic: true },
    { key: 'contingency', label: 'Contingency', description: '5% du trip (min 1 gal)', readonly: true },
    { key: 'alternate', label: 'Alternate', description: getAlternateDescription(), readonly: true, automatic: true },
    { key: 'finalReserve', label: 'Final Reserve', description: getReserveDescription(), readonly: true },
    { key: 'additional', label: 'Additional', description: 'Météo, ATC, etc.' },
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

      {/* Alerte automatisation */}
      {(navigationResults?.fuelRequired > 0 || hasAlternates) && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.success, sx.spacing.mb(4))}>
          <div style={sx.flex.col}>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>
              🚀 Automatisation activée
            </p>
            <p style={sx.text.sm}>
              {navigationResults?.fuelRequired > 0 && 'Trip, Contingency et Final Reserve calculés depuis Navigation.'}
              {navigationResults?.fuelRequired > 0 && hasAlternates && ' '}
              {hasAlternates && `Carburant Alternate calculé pour ${alternatesCount} déroutement${alternatesCount > 1 ? 's' : ''}.`}
            </p>
          </div>
        </div>
      )}

      {/* DEBUG: Affichage temporaire pour diagnostic */}
      {navigationResults && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
          <div style={sx.flex.col}>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>🔍 Debug Navigation Results:</p>
            <p style={sx.combine(sx.text.xs)}>
              Distance: {navigationResults.totalDistance} NM | 
              Temps: {navigationResults.totalTime} min | 
              Fuel Required: {navigationResults.fuelRequired} L
            </p>
            {selectedAircraft && (
              <p style={sx.combine(sx.text.xs)}>
                Avion: {selectedAircraft.registration} | 
                Vitesse: {selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 'N/A'} kt | 
                Conso: {selectedAircraft.fuelConsumption || 'N/A'} L/h
              </p>
            )}
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
              <th style={{ padding: '12px', textAlign: 'center' }}>Gallons</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Litres</th>
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
                {safeCalculateTotal('gal').toFixed(1)}
              </td>
              <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
                {safeCalculateTotal('ltr').toFixed(1)}
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
        {hasAlternates && maxDistanceAlternate && (
          <div style={sx.combine(sx.components.card.base, sx.spacing.mt(4))}>
            <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
              🛬 Déroutements sélectionnés
            </h4>
            <p style={sx.text.sm}>
              <strong>Aérodrome le plus éloigné :</strong> {maxDistanceAlternate.icao} - {maxDistanceAlternate.name || 'N/A'}
            </p>
            <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
              Distance depuis l'arrivée : {maxDistanceAlternate.distance.toFixed(1)} NM
            </p>
            {selectedAircraft && (
              <>
                <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                  Temps de vol estimé : {(maxDistanceAlternate.distance / (selectedAircraft.cruiseSpeedKt || 100) * 60).toFixed(0)} min
                  {' '}(+ 30 min approche)
                </p>
                <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                  Consommation : {selectedAircraft.fuelConsumption || 30} L/h × {((maxDistanceAlternate.distance / (selectedAircraft.cruiseSpeedKt || 100)) + 0.5).toFixed(1)} h
                  {' '}= {alternateFuelRequired} L
                </p>
              </>
            )}
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(2))}>
              <Info size={14} />
              <p style={sx.combine(sx.text.xs)}>
                Le carburant de dégagement est calculé automatiquement pour l'aérodrome le plus éloigné 
                parmi vos sélections, garantissant ainsi une couverture pour tous les déroutements possibles.
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