// ============================================================================
//  UnitsConfiguration — Refonte charte éditoriale ALFlight
//  ----------------------------------------------------------------------------
//  Remplace l'ancienne implémentation MUI (Paper / Accordion / Select /
//  StyledFormControl) qui créait :
//  - Une double/triple encapsulation visuelle (Paper > Accordion > FormControl
//    > Select wrapper > input) = "rectangles encapsulés"
//  - Un trait blanc résiduel autour de la notched outline MUI
//  - Une typo différente du reste de l'app (MUI default)
//
//  La nouvelle implémentation utilise :
//  - <select> natifs stylés en charte ALFlight (1 niveau, pas d'encapsulage)
//  - <details>/<summary> natifs pour les sections collapsibles (vs Accordion)
//  - Couleurs et fonts via variables CSS uniquement
//  - Bouton "Sauvegarder" cockpit orange (pas d'ombre bleue)
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Ruler as RulerIcon,
  Thermometer as ThermostatIcon,
  Fuel as FuelIcon,
  Globe as GlobeIcon,
  ChevronDown as ExpandMoreIcon,
} from 'lucide-react';
import { useUnitsStore, unitsSelectors } from '@core/stores/unitsStore';

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
    { value: 'europe',   label: 'Europe',         description: 'Métrique (L, kg, °C)' },
    { value: 'usa',      label: 'USA',            description: 'Impérial (gal, lbs, °F)' },
    { value: 'aviation', label: 'Aviation OACI',  description: 'Standard (kt, ft, °C)' },
    { value: 'metric',   label: 'Métrique pur',   description: 'Tout métrique' },
  ];

  const handleUnitChange = (key, value) => {
    setLocalUnits((prev) => ({ ...prev, [key]: value }));
    setUnit(key, value);
    localStorage.setItem('unitsConfigured', 'true');
  };

  const handlePresetSelect = (presetValue) => {
    setPreset(presetValue);
    localStorage.setItem('unitsConfigured', 'true');
  };

  return (
    <div style={styles.container}>
      {/* ─── Préréglages régionaux (1 select natif, plus de Paper MUI) ───── */}
      <div style={styles.section}>
        <label style={styles.fieldLabel}>
          <GlobeIcon size={14} style={styles.fieldIcon} />
          Préréglages régionaux
        </label>
        <select
          value={selectedPreset}
          onChange={(e) => {
            setSelectedPreset(e.target.value);
            handlePresetSelect(e.target.value);
          }}
          style={styles.select}
        >
          {presets.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label} — {preset.description}
            </option>
          ))}
        </select>
      </div>

      {/* ─── Configuration détaillée : <details> natifs (plus d'Accordion) ─── */}
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
                  <select
                    value={localUnits[unitConfig.key] || unitConfig.options[0].value}
                    onChange={(e) => handleUnitChange(unitConfig.key, e.target.value)}
                    style={styles.select}
                  >
                    {unitConfig.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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
//  Styles cockpit ALFlight — variables CSS uniquement
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  container: {
    maxWidth: '720px',
    margin: '0 auto',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
  },

  // Section "préréglages régionaux" — bloc simple (plus de Paper)
  section: {
    marginBottom: '16px',
    padding: '16px',
    backgroundColor: 'var(--bg-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
  },

  // <details> natif — un seul niveau d'encadré (plus de Paper + Accordion)
  details: {
    marginBottom: '16px',
    backgroundColor: 'var(--bg-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 16px',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--accent-primary)',
    listStyle: 'none', // retire la flèche disclosure native
    userSelect: 'none',
  },
  summaryIcon: {
    color: 'var(--accent-primary)',
    flexShrink: 0,
  },
  summaryLabel: {
    flex: 1,
  },
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
  },

  // Champ unité — label + select
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fieldLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: 'var(--text-tertiary)',
  },
  fieldIcon: {
    color: 'var(--accent-primary)',
  },

  // Select natif stylé cockpit ALFlight — chevron custom + pas d'outline blanc
  select: {
    width: '100%',
    padding: '10px 36px 10px 12px',
    backgroundColor: 'var(--app-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-regular)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage:
      "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A867E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '12px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
};

// Au focus, le select prend une bordure orange ALFlight
// (impossible à mettre en inline style, donc style global injecté)
if (typeof document !== 'undefined' && !document.getElementById('units-select-focus')) {
  const styleTag = document.createElement('style');
  styleTag.id = 'units-select-focus';
  styleTag.innerHTML = `
    /* Focus orange ALFlight */
    select[data-alflight-units]:focus,
    .alflight-units-section select:focus {
      border-color: var(--accent-primary) !important;
      outline: none !important;
    }
    /* Hover rotate chevron summary */
    details[open] > summary > svg:last-child {
      transform: rotate(180deg);
    }
  `;
  document.head.appendChild(styleTag);
}

export default UnitsConfiguration;
