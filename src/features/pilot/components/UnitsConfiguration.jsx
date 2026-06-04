// ============================================================================
//  UnitsConfiguration — Refonte charte éditoriale ALFlight (v2)
//  ----------------------------------------------------------------------------
//  Iteration v2 : remplacement des <select> natifs par un dropdown custom
//  React pour avoir le contrôle TOTAL du rendu de la liste d'options.
//
//  Pourquoi : les <option> d'un <select> natif sont rendues par l'OS
//  (Windows/macOS/Linux), donc :
//   - Angles vifs systèmes (impossible à arrondir via CSS)
//   - Hover/select en bleu système (pas d'orange ALFlight)
//   - Largeur du menu déroulant > largeur du select (déborde du cadre)
//   - Police du système (pas Century Gothic)
//
//  Solution : composant <CustomSelect> qui affiche un trigger button stylé
//  ALFlight + un dropdown HTML personnalisé (positionnement absolu, fond
//  --bg-surface, hover --accent-soft, sélectionné --accent-primary, etc.)
//  + gestion du click-outside et de la touche Escape.
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Ruler as RulerIcon,
  Thermometer as ThermostatIcon,
  Fuel as FuelIcon,
  Globe as GlobeIcon,
  ChevronDown as ExpandMoreIcon,
} from 'lucide-react';
import { unitsSelectors } from '@core/stores/unitsStore';
// Dropdown ALFlight partagé (factorisé pour réutilisation dans wizard avion, etc.)
import { CustomSelect } from '@shared/components/editorial';

// ─────────────────────────────────────────────────────────────────────────────
//  Composant principal — UnitsConfiguration
// ─────────────────────────────────────────────────────────────────────────────
const UnitsConfiguration = () => {
  const units = unitsSelectors.useUnits();
  const { setUnit, setPreset } = unitsSelectors.useUnitsActions();

  const [localUnits, setLocalUnits] = useState({
    distance: units.distance || 'nm',
    altitude: units.altitude || 'ft',
    speed: units.speed || 'kt',
    runway: units.runway || 'm',
    temperature: units.temperature || 'C',
    pressure: units.pressure || 'hPa',
    windSpeed: units.windSpeed || 'kt',
    visibility: units.visibility || 'km',
    weight: units.weight || 'kg',
    fuel: units.fuel || 'ltr',
    fuelConsumption: units.fuelConsumption || 'lph',
    armLength: units.armLength || 'mm',
    coordinates: units.coordinates || 'dms',
    timeFormat: units.timeFormat || '24h',
  });
  const [selectedPreset, setSelectedPreset] = useState('aviation');

  useEffect(() => {
    setLocalUnits({
      distance: units.distance || 'nm',
      altitude: units.altitude || 'ft',
      speed: units.speed || 'kt',
      runway: units.runway || 'm',
      temperature: units.temperature || 'C',
      pressure: units.pressure || 'hPa',
      windSpeed: units.windSpeed || 'kt',
      visibility: units.visibility || 'km',
      weight: units.weight || 'kg',
      fuel: units.fuel || 'ltr',
      fuelConsumption: units.fuelConsumption || 'lph',
      armLength: units.armLength || 'mm',
      coordinates: units.coordinates || 'dms',
      timeFormat: units.timeFormat || '24h',
    });
  }, [units]);

  const unitsConfig = {
    general: {
      title: 'Unités générales',
      Icon: RulerIcon,
      units: [
        { label: 'Distance', key: 'distance', options: [
          { value: 'nm', label: 'Milles nautiques (NM)' },
          { value: 'km', label: 'Kilomètres (km)' },
          { value: 'mi', label: 'Milles terrestres (mi)' },
        ]},
        { label: 'Altitude', key: 'altitude', options: [
          { value: 'ft', label: 'Pieds (ft)' },
          { value: 'm', label: 'Mètres (m)' },
        ]},
        { label: 'Vitesse', key: 'speed', options: [
          { value: 'kt', label: 'Nœuds (kt)' },
          { value: 'km/h', label: 'km/h' },
          { value: 'mph', label: 'mph' },
        ]},
        { label: 'Longueur de piste', key: 'runway', options: [
          { value: 'm', label: 'Mètres (m)' },
          { value: 'ft', label: 'Pieds (ft)' },
        ]},
      ],
    },
    weather: {
      title: 'Météo',
      Icon: ThermostatIcon,
      units: [
        { label: 'Température', key: 'temperature', options: [
          { value: 'C', label: 'Celsius (°C)' },
          { value: 'F', label: 'Fahrenheit (°F)' },
        ]},
        { label: 'Pression', key: 'pressure', options: [
          { value: 'hPa', label: 'hPa' },
          { value: 'inHg', label: 'inHg' },
          { value: 'mb', label: 'mb' },
        ]},
        { label: 'Vent', key: 'windSpeed', options: [
          { value: 'kt', label: 'Nœuds (kt)' },
          { value: 'km/h', label: 'km/h' },
          { value: 'mph', label: 'mph' },
          { value: 'm/s', label: 'm/s' },
        ]},
        { label: 'Visibilité', key: 'visibility', options: [
          { value: 'km', label: 'km' },
          { value: 'sm', label: 'SM' },
          { value: 'm', label: 'm' },
        ]},
      ],
    },
    fuel: {
      title: 'Carburant & Masse',
      Icon: FuelIcon,
      units: [
        { label: 'Masse', key: 'weight', options: [
          { value: 'kg', label: 'Kilogrammes (kg)' },
          { value: 'lbs', label: 'Livres (lbs)' },
        ]},
        { label: 'Carburant', key: 'fuel', options: [
          { value: 'ltr', label: 'Litres (L)' },
          { value: 'gal', label: 'Gallons US' },
          { value: 'kg', label: 'kg' },
          { value: 'lbs', label: 'lbs' },
        ]},
        { label: 'Consommation', key: 'fuelConsumption', options: [
          { value: 'lph', label: 'L/h' },
          { value: 'gph', label: 'gal/h' },
        ]},
        { label: 'Bras de levier', key: 'armLength', options: [
          { value: 'mm', label: 'Millimètres (mm)' },
          { value: 'cm', label: 'Centimètres (cm)' },
          { value: 'm', label: 'Mètres (m)' },
          { value: 'in', label: 'Pouces (in)' },
        ]},
      ],
    },
  };

  const presets = [
    { value: 'europe',   label: 'Europe — Métrique (L, kg, °C)' },
    { value: 'usa',      label: 'USA — Impérial (gal, lbs, °F)' },
    { value: 'aviation', label: 'Aviation OACI — Standard (kt, ft, °C)' },
    { value: 'metric',   label: 'Métrique pur — Tout métrique' },
  ];

  const handleUnitChange = (key, value) => {
    setLocalUnits((prev) => ({ ...prev, [key]: value }));
    setUnit(key, value);
    localStorage.setItem('unitsConfigured', 'true');
  };

  const handlePresetSelect = (presetValue) => {
    setSelectedPreset(presetValue);
    setPreset(presetValue);
    localStorage.setItem('unitsConfigured', 'true');
  };

  return (
    <div style={styles.container}>
      {/* ─── Préréglages régionaux ─── */}
      <div style={styles.section}>
        <label style={styles.fieldLabel}>
          <GlobeIcon size={14} style={styles.fieldIcon} />
          Préréglages régionaux
        </label>
        <CustomSelect
          value={selectedPreset}
          options={presets}
          onChange={handlePresetSelect}
          ariaLabel="Préréglages régionaux"
        />
      </div>

      {/* ─── Configuration détaillée : <details> natifs ─── */}
      {Object.entries(unitsConfig).map(([categoryKey, category]) => {
        const Icon = category.Icon;
        return (
          <details key={categoryKey} style={styles.details}>
            <summary style={styles.summary}>
              <Icon size={14} style={styles.summaryIcon} />
              <span style={styles.summaryLabel}>{category.title}</span>
              <ExpandMoreIcon size={14} style={styles.summaryChevron} />
            </summary>
            <div style={styles.detailsContent}>
              {category.units.map((unitConfig) => (
                <div key={unitConfig.key} style={styles.field}>
                  <label style={styles.fieldLabel}>{unitConfig.label}</label>
                  <CustomSelect
                    value={localUnits[unitConfig.key] || unitConfig.options[0].value}
                    options={unitConfig.options}
                    onChange={(val) => handleUnitChange(unitConfig.key, val)}
                    ariaLabel={unitConfig.label}
                  />
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Styles cockpit ALFlight — variables CSS uniquement + box-sizing: border-box
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  container: {
    maxWidth: '720px',
    margin: '0 auto',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
    width: '100%',
  },

  section: {
    marginBottom: '16px',
    padding: '16px',
    backgroundColor: 'var(--bg-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    boxSizing: 'border-box',
  },

  details: {
    marginBottom: '16px',
    backgroundColor: 'var(--bg-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    boxSizing: 'border-box',
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 16px',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--accent-primary)',
    listStyle: 'none',
    userSelect: 'none',
  },
  summaryIcon: {
    color: 'var(--accent-primary)',
    flexShrink: 0,
  },
  summaryLabel: { flex: 1 },
  summaryChevron: {
    color: 'var(--text-tertiary)',
    flexShrink: 0,
    transition: 'transform 0.2s ease',
  },
  detailsContent: {
    padding: '0 16px 16px',
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxSizing: 'border-box',
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0, // ← évite que les enfants flex débordent
  },
  fieldLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 500,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: 'var(--text-tertiary)',
  },
  fieldIcon: { color: 'var(--accent-primary)' },
};

// Inject CSS hint pour la rotation du chevron <details>
if (typeof document !== 'undefined' && !document.getElementById('units-details-css')) {
  const styleTag = document.createElement('style');
  styleTag.id = 'units-details-css';
  styleTag.innerHTML = `
    details[open] > summary > svg:last-child {
      transform: rotate(180deg);
    }
  `;
  document.head.appendChild(styleTag);
}

export default UnitsConfiguration;
