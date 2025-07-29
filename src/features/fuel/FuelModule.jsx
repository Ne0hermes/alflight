// src/features/fuel/FuelModule.jsx
import React, { memo } from 'react';
import { useFuel, useAircraft, useNavigation } from '@core/contexts';
import { Fuel, AlertTriangle, CheckCircle } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

const FuelRow = memo(({ type, label, description, fuel, onChange, readonly = false, automatic = false }) => {
  const GAL_TO_LTR = 3.78541;
  
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
          value={fuel.gal.toFixed(1)}
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
          value={fuel.ltr.toFixed(1)}
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
          {((fuel.gal / (fuel.gal || 1)) * 100).toFixed(0)}%
        </span>
      </td>
    </tr>
  );
});

export const FuelModule = memo(() => {
  const { selectedAircraft } = useAircraft();
  const { navigationResults, flightType } = useNavigation();
  const { fuelData, setFuelData, fobFuel, setFobFuel, calculateTotal, isFobSufficient } = useFuel();

  const handleFuelChange = (type, values) => {
    if (type === 'trip' || type === 'contingency' || type === 'finalReserve') return;
    
    setFuelData({
      ...fuelData,
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

  const getReserveDescription = () => {
    if (!flightType || !navigationResults) return 'Définir type de vol';
    
    let desc = `${navigationResults.regulationReserveMinutes} min - `;
    desc += `${flightType.rules} `;
    desc += `${flightType.category === 'local' ? 'LOCAL' : 'NAV'} `;
    desc += flightType.period === 'nuit' ? 'NUIT' : 'JOUR';
    
    if (flightType.rules === 'IFR') desc += ' (+15 min)';
    
    return desc;
  };

  const fuelTypes = [
    { key: 'roulage', label: 'Roulage', description: 'Taxi et attente' },
    { key: 'trip', label: 'Trip Fuel', description: `Calculé depuis Navigation (${navigationResults?.totalDistance || 0} NM)`, readonly: true, automatic: true },
    { key: 'contingency', label: 'Contingency', description: '5% du trip (min 1 gal)', readonly: true },
    { key: 'alternate', label: 'Alternate', description: 'Vers dégagement' },
    { key: 'finalReserve', label: 'Final Reserve', description: getReserveDescription(), readonly: true },
    { key: 'additional', label: 'Additional', description: 'Météo, ATC, etc.' },
    { key: 'extra', label: 'Extra', description: 'Discrétion pilote' }
  ];

  return (
    <div>
      {/* Alerte automatisation */}
      {navigationResults?.fuelRequired > 0 && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.success, sx.spacing.mb(4))}>
          <div style={sx.flex.col}>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>
              🚀 Automatisation activée
            </p>
            <p style={sx.text.sm}>
              Trip, Contingency et Final Reserve calculés automatiquement depuis Navigation
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
              <th style={{ padding: '12px', textAlign: 'center' }}>Gallons</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Litres</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>%</th>
            </tr>
          </thead>
          <tbody>
            {fuelTypes.map(type => (
              <FuelRow
                key={type.key}
                type={type.key}
                label={type.label}
                description={type.description}
                fuel={fuelData[type.key]}
                onChange={(values) => handleFuelChange(type.key, values)}
                readonly={type.readonly}
                automatic={type.automatic}
              />
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${sx.theme.colors.gray[700]}` }}>
              <td style={{ padding: '12px', fontWeight: 'bold' }}>TOTAL</td>
              <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
                {calculateTotal('gal').toFixed(1)}
              </td>
              <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
                {calculateTotal('ltr').toFixed(1)}
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
              value={fobFuel.gal.toFixed(1)}
              onChange={(e) => handleFobChange('gal', e.target.value)}
              style={sx.components.input.base}
              step="0.1"
            />
          </div>
          <div>
            <label style={sx.components.label.base}>Litres</label>
            <input
              type="number"
              value={fobFuel.ltr.toFixed(1)}
              onChange={(e) => handleFobChange('ltr', e.target.value)}
              style={sx.components.input.base}
              step="0.1"
            />
          </div>
        </div>

        {/* Statut */}
        <div style={sx.combine(
          sx.components.alert.base,
          isFobSufficient() ? sx.components.alert.success : sx.components.alert.danger
        )}>
          {isFobSufficient() ? (
            <>
              <CheckCircle size={20} />
              <div>
                <p style={sx.text.bold}>Carburant SUFFISANT</p>
                <p style={sx.text.sm}>
                  Excédent: {Math.abs(fobFuel.ltr - calculateTotal('ltr')).toFixed(1)} L
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle size={20} />
              <div>
                <p style={sx.text.bold}>Carburant INSUFFISANT</p>
                <p style={sx.text.sm}>
                  Manque: {Math.abs(fobFuel.ltr - calculateTotal('ltr')).toFixed(1)} L
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

FuelModule.displayName = 'FuelModule';
FuelRow.displayName = 'FuelRow';

export default FuelModule;