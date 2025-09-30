// src/features/units/components/UnitsPreferences.jsx
import React, { useState, useEffect } from 'react';
import { Settings, Globe, Ruler, Thermometer, Gauge, Clock, MapPin, Save, Check, AlertCircle } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useUnitsStore, unitsSelectors } from '@core/stores/unitsStore';

const UnitsPreferences = () => {
  const units = unitsSelectors.useUnits();
  const { setUnit, setPreset } = unitsSelectors.useUnitsActions();
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialUnits, setInitialUnits] = useState(units);

  // Détecter les changements
  useEffect(() => {
    const changed = JSON.stringify(units) !== JSON.stringify(initialUnits);
    setHasChanges(changed);
  }, [units, initialUnits]);

  // Sauvegarder les préférences
  const handleSave = () => {
    // Les données sont déjà persistées automatiquement par Zustand
    // Mais on ajoute un feedback visuel
    setSaved(true);
    setHasChanges(false);
    setInitialUnits(units);
    
    // Afficher un message de succès temporaire
    setTimeout(() => {
      setSaved(false);
    }, 3000);
    
    // Forcer un rafraîchissement global de l'application
    window.dispatchEvent(new CustomEvent('unitsUpdated', { detail: units }));
  };

  // Configuration des catégories d'unités
  const unitsConfig = {
    general: {
      title: 'Unités générales',
      icon: Ruler,
      units: [
        {
          label: 'Distance',
          key: 'distance',
          options: [
            { value: 'nm', label: 'Milles nautiques (NM)' },
            { value: 'km', label: 'Kilomètres (km)' },
            { value: 'mi', label: 'Milles terrestres (mi)' }
          ]
        },
        {
          label: 'Altitude',
          key: 'altitude',
          options: [
            { value: 'ft', label: 'Pieds (ft)' },
            { value: 'm', label: 'Mètres (m)' },
            { value: 'FL', label: 'Niveau de vol (FL)' }
          ]
        },
        {
          label: 'Vitesse',
          key: 'speed',
          options: [
            { value: 'kt', label: 'Nœuds (kt)' },
            { value: 'km/h', label: 'Kilomètres/heure (km/h)' },
            { value: 'mph', label: 'Miles/heure (mph)' },
            { value: 'm/s', label: 'Mètres/seconde (m/s)' }
          ]
        },
        {
          label: 'Longueur de piste',
          key: 'runway',
          options: [
            { value: 'm', label: 'Mètres (m)' },
            { value: 'ft', label: 'Pieds (ft)' }
          ]
        }
      ]
    },
    weather: {
      title: 'Météo',
      icon: Thermometer,
      units: [
        {
          label: 'Température',
          key: 'temperature',
          options: [
            { value: 'C', label: 'Celsius (°C)' },
            { value: 'F', label: 'Fahrenheit (°F)' }
          ]
        },
        {
          label: 'Pression',
          key: 'pressure',
          options: [
            { value: 'hPa', label: 'Hectopascals (hPa)' },
            { value: 'inHg', label: 'Pouces de mercure (inHg)' },
            { value: 'mb', label: 'Millibars (mb)' }
          ]
        },
        {
          label: 'Vent',
          key: 'windSpeed',
          options: [
            { value: 'kt', label: 'Nœuds (kt)' },
            { value: 'km/h', label: 'Kilomètres/heure (km/h)' },
            { value: 'mph', label: 'Miles/heure (mph)' },
            { value: 'm/s', label: 'Mètres/seconde (m/s)' }
          ]
        },
        {
          label: 'Visibilité',
          key: 'visibility',
          options: [
            { value: 'km', label: 'Kilomètres (km)' },
            { value: 'sm', label: 'Milles terrestres (SM)' },
            { value: 'm', label: 'Mètres (m)' }
          ]
        }
      ]
    },
    fuel: {
      title: 'Carburant & Masse',
      icon: Gauge,
      units: [
        {
          label: 'Masse',
          key: 'weight',
          options: [
            { value: 'kg', label: 'Kilogrammes (kg)' },
            { value: 'lbs', label: 'Livres (lbs)' }
          ]
        },
        {
          label: 'Carburant',
          key: 'fuel',
          options: [
            { value: 'ltr', label: 'Litres (L)' },
            { value: 'gal', label: 'Gallons US (gal)' },
            { value: 'kg', label: 'Kilogrammes (kg)' },
            { value: 'lbs', label: 'Livres (lbs)' }
          ]
        },
        {
          label: 'Consommation',
          key: 'fuelConsumption',
          options: [
            { value: 'lph', label: 'Litres/heure (L/h)' },
            { value: 'gph', label: 'Gallons/heure (gal/h)' }
          ]
        }
      ]
    },
    format: {
      title: 'Formats',
      icon: MapPin,
      units: [
        {
          label: 'Coordonnées',
          key: 'coordinates',
          options: [
            { value: 'dms', label: 'Degrés Minutes Secondes (DMS)' },
            { value: 'dd', label: 'Degrés décimaux (DD)' }
          ]
        },
        {
          label: 'Format horaire',
          key: 'timeFormat',
          options: [
            { value: '24h', label: '24 heures' },
            { value: '12h', label: '12 heures (AM/PM)' }
          ]
        }
      ]
    }
  };

  // Préréglages régionaux
  const presets = [
    { value: 'europe', label: '🇪🇺 Europe', description: 'Standard européen (Litres, °C)' },
    { value: 'usa', label: '🇺🇸 USA / Impérial', description: 'Standard américain (Gallons, °C)' },
    { value: 'aviation', label: '✈️ Aviation', description: 'Standard OACI (kg carburant, °C)' },
    { value: 'metric', label: '📐 Métrique', description: 'Système métrique (Litres, °C)' }
  ];

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
      <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
        <Settings size={20} style={{ marginRight: '8px' }} />
        Préférences d'unités
      </h3>

      {/* Préréglages rapides */}
      <div style={sx.spacing.mb(4)}>
        <h4 style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(2))}>
          Préréglages régionaux
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {presets.map(preset => (
            <button
              key={preset.value}
              onClick={() => setPreset(preset.value)}
              style={{
                ...sx.components.button.base,
                ...sx.components.button.secondary,
                padding: '12px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start'
              }}
            >
              <div style={sx.combine(sx.text.base, sx.text.bold)}>
                {preset.label}
              </div>
              <div style={sx.combine(sx.text.xs, sx.text.secondary)}>
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Onglets de catégories */}
      <div style={sx.combine(sx.flex.row, sx.spacing.gap(2), sx.spacing.mb(4))}>
        {Object.entries(unitsConfig).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                ...sx.components.button.base,
                ...(activeTab === key ? sx.components.button.primary : sx.components.button.secondary),
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Icon size={16} />
              <span style={{ fontSize: '14px' }}>{config.title}</span>
            </button>
          );
        })}
      </div>

      {/* Configuration détaillée */}
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '16px'
      }}>
        {unitsConfig[activeTab].units.map(unitConfig => (
          <div key={unitConfig.key} style={sx.spacing.mb(3)}>
            <label style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2), { display: 'block' })}>
              {unitConfig.label}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              {unitConfig.options.map(option => (
                <label
                  key={option.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    backgroundColor: units[unitConfig.key] === option.value ? '#3b82f6' : 'white',
                    color: units[unitConfig.key] === option.value ? 'white' : '#374151',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '1px solid',
                    borderColor: units[unitConfig.key] === option.value ? '#3b82f6' : '#e5e7eb'
                  }}
                >
                  <input
                    type="radio"
                    name={unitConfig.key}
                    value={option.value}
                    checked={units[unitConfig.key] === option.value}
                    onChange={(e) => setUnit(unitConfig.key, e.target.value)}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontSize: '14px' }}>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Résumé des unités actuelles */}
      <div style={{
        marginTop: '20px',
        padding: '16px',
        backgroundColor: '#eff6ff',
        borderRadius: '8px',
        border: '1px solid #3b82f6'
      }}>
        <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
          Configuration actuelle
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          fontSize: '12px'
        }}>
          <div>Distance: <strong>{units.distance.toUpperCase()}</strong></div>
          <div>Altitude: <strong>{units.altitude.toUpperCase()}</strong></div>
          <div>Vitesse: <strong>{units.speed.toUpperCase()}</strong></div>
          <div>Température: <strong>°{units.temperature}</strong></div>
          <div>Pression: <strong>{units.pressure}</strong></div>
          <div>Carburant: <strong>{units.fuel.toUpperCase()}</strong></div>
        </div>
      </div>

      {/* Bouton de sauvegarde et messages */}
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Message de changements non sauvegardés */}
        {hasChanges && !saved && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fef3c7',
            borderRadius: '6px',
            border: '1px solid #fbbf24',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '14px', color: '#92400e' }}>
              Des modifications non sauvegardées sont en attente
            </span>
          </div>
        )}
        
        {/* Message de succès */}
        {saved && (
          <div style={{
            padding: '12px',
            backgroundColor: '#d1fae5',
            borderRadius: '6px',
            border: '1px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Check size={16} style={{ color: '#059669' }} />
            <span style={{ fontSize: '14px', color: '#065f46' }}>
              Préférences sauvegardées et appliquées dans toute l'application !
            </span>
          </div>
        )}
        
        {/* Bouton de sauvegarde */}
        <button
          onClick={handleSave}
          disabled={!hasChanges || saved}
          style={{
            ...sx.components.button.base,
            ...(hasChanges && !saved ? sx.components.button.primary : sx.components.button.secondary),
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '16px',
            fontWeight: '600',
            opacity: (!hasChanges || saved) ? 0.5 : 1,
            cursor: (!hasChanges || saved) ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s'
          }}
        >
          {saved ? (
            <>
              <Check size={20} />
              Sauvegardé
            </>
          ) : (
            <>
              <Save size={20} />
              Sauvegarder et appliquer
            </>
          )}
        </button>
      </div>

      {/* Note d'information */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#fef3c7',
        borderRadius: '6px',
        fontSize: '13px',
        color: '#92400e'
      }}>
        <strong>Note :</strong> Les changements d'unités s'appliquent immédiatement à toute l'application. 
        Les valeurs sont automatiquement converties dans les nouvelles unités sélectionnées.
      </div>
    </div>
  );
};

export default UnitsPreferences;