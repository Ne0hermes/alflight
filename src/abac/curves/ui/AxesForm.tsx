import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AxesConfig } from '../core/types';

interface AxesFormProps {
  onSubmit: (config: AxesConfig) => void;
  initialConfig?: AxesConfig;
  isWindRelated?: boolean;
  onWindRelatedChange?: (isWindRelated: boolean) => void;
  onDelete?: () => void;
  graphName?: string;
  graphNumber?: number;
}

// Options prédéfinies pour les axes avec leurs unités par défaut
const AXIS_OPTIONS = {
  'altitude_pression': {
    label: 'Altitude Pression',
    defaultUnit: 'ft',
    alternativeUnits: ['ft', 'm', 'FL'],
    defaultMin: 0,
    defaultMax: 15000
  },
  'masse': {
    label: 'Masse',
    defaultUnit: 'kg',
    alternativeUnits: ['kg', 'lbs'],
    defaultMin: 500,
    defaultMax: 2500
  },
  'vent': {
    label: 'Vent',
    defaultUnit: 'kt',
    alternativeUnits: ['kt', 'm/s', 'km/h'],
    defaultMin: -50,
    defaultMax: 50
  },
  'temperature': {
    label: 'Température',
    defaultUnit: '°C',
    alternativeUnits: ['°C', '°F', 'K'],
    defaultMin: -20,
    defaultMax: 50
  },
  'distance': {
    label: 'Distance',
    defaultUnit: 'm',
    alternativeUnits: ['m', 'ft', 'nm'],
    defaultMin: 0,
    defaultMax: 5000
  },
  'vitesse': {
    label: 'Vitesse',
    defaultUnit: 'kt',
    alternativeUnits: ['kt', 'km/h', 'm/s', 'mph'],
    defaultMin: 0,
    defaultMax: 200
  },
  'taux_montee': {
    label: 'Taux de Montée',
    defaultUnit: 'ft/min',
    alternativeUnits: ['ft/min', 'm/s'],
    defaultMin: 0,
    defaultMax: 2000
  },
  'consommation': {
    label: 'Consommation',
    defaultUnit: 'L/h',
    alternativeUnits: ['L/h', 'gal/h', 'kg/h'],
    defaultMin: 0,
    defaultMax: 100
  },
  'puissance': {
    label: 'Puissance',
    defaultUnit: '%',
    alternativeUnits: ['%', 'hp', 'kW'],
    defaultMin: 0,
    defaultMax: 100
  },
  'valeurs_intermediaires': {
    label: 'Valeurs Intermédiaires',
    defaultUnit: '',
    alternativeUnits: ['', '%', 'ratio', 'coef'],
    defaultMin: 0,
    defaultMax: 10
  },
  'angle': {
    label: 'Angle',
    defaultUnit: '°',
    alternativeUnits: ['°', 'rad'],
    defaultMin: -45,
    defaultMax: 45
  },
  'temps': {
    label: 'Temps',
    defaultUnit: 's',
    alternativeUnits: ['s', 'min', 'h'],
    defaultMin: 0,
    defaultMax: 3600
  },
  'carburant': {
    label: 'Carburant',
    defaultUnit: 'L',
    alternativeUnits: ['L', 'gal', 'kg'],
    defaultMin: 0,
    defaultMax: 500
  },
  'coefficient': {
    label: 'Coefficient',
    defaultUnit: '',
    alternativeUnits: [''],
    defaultMin: 0,
    defaultMax: 2
  },
  'custom': {
    label: 'Personnalisé',
    defaultUnit: '',
    alternativeUnits: [],
    defaultMin: 0,
    defaultMax: 100
  }
};

const styles = {
  form: {
    padding: '10px',
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  section: {
    marginBottom: '16px'
  },
  sectionTitle: {
    marginBottom: '12px',
    color: '#333',
    fontSize: '16px',
    fontWeight: 600
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px'
  },
  group: {
    display: 'flex',
    flexDirection: 'column' as const
  },
  label: {
    marginBottom: '4px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#555'
  },
  input: {
    padding: '8px 10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    transition: 'border-color 0.2s',
    width: '100%',
    boxSizing: 'border-box' as const
  },
  select: {
    padding: '8px 10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    transition: 'border-color 0.2s',
    backgroundColor: 'white',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box' as const
  },
  inputError: {
    padding: '8px 10px',
    border: '1px solid #f44336',
    borderRadius: '4px',
    fontSize: '14px',
    transition: 'border-color 0.2s',
    width: '100%',
    boxSizing: 'border-box' as const
  },
  errorMessage: {
    color: '#f44336',
    fontSize: '12px',
    marginTop: '4px'
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '24px'
  },
  button: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    backgroundColor: '#4CAF50',
    color: 'white',
    transition: 'background-color 0.2s'
  },
  helperText: {
    fontSize: '11px',
    color: '#666',
    marginTop: '4px',
    fontStyle: 'italic'
  },
  formTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1976d2',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '2px solid #e0e0e0'
  }
};

export const AxesForm: React.FC<AxesFormProps> = ({ onSubmit, initialConfig, isWindRelated = false, onWindRelatedChange, onDelete, graphName, graphNumber }) => {
  const [xAxisExpanded, setXAxisExpanded] = useState(true);
  const [yAxisExpanded, setYAxisExpanded] = useState(true);
  const isInitialMount = useRef(true);

  // Déterminer le type initial basé sur la config existante
  const getInitialAxisType = (axisTitle: string | undefined, defaultType: string) => {
    if (!axisTitle) return defaultType;

    // Chercher le type correspondant au titre
    for (const [key, option] of Object.entries(AXIS_OPTIONS)) {
      if (option.label === axisTitle) {
        return key;
      }
    }
    return 'custom';
  };

  const [xAxisType, setXAxisType] = useState<string>(
    initialConfig ? getInitialAxisType(initialConfig.xAxis?.title, 'altitude_pression') : 'altitude_pression'
  );
  const [yAxisType, setYAxisType] = useState<string>(
    initialConfig ? getInitialAxisType(initialConfig.yAxis?.title, 'distance') : 'distance'
  );

  const [customXTitle, setCustomXTitle] = useState(xAxisType === 'custom' ? (initialConfig?.xAxis?.title || '') : '');
  const [customYTitle, setCustomYTitle] = useState(yAxisType === 'custom' ? (initialConfig?.yAxis?.title || '') : '');

  const [config, setConfig] = useState<AxesConfig>(() => {
    if (initialConfig) {
      return initialConfig;
    }
    return {
      xAxis: {
        min: AXIS_OPTIONS.altitude_pression.defaultMin,
        max: AXIS_OPTIONS.altitude_pression.defaultMax,
        unit: AXIS_OPTIONS.altitude_pression.defaultUnit,
        title: AXIS_OPTIONS.altitude_pression.label
      },
      yAxis: {
        min: AXIS_OPTIONS.distance.defaultMin,
        max: AXIS_OPTIONS.distance.defaultMax,
        unit: AXIS_OPTIONS.distance.defaultUnit,
        title: AXIS_OPTIONS.distance.label
      }
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const isLoadingInitialConfig = useRef(false);

  // Réinitialiser le formulaire quand initialConfig change
  useEffect(() => {
    if (initialConfig) {
      isLoadingInitialConfig.current = true;
      setConfig(initialConfig);
      setXAxisType(getInitialAxisType(initialConfig.xAxis?.title, 'altitude_pression'));
      setYAxisType(getInitialAxisType(initialConfig.yAxis?.title, 'distance'));
      const xType = getInitialAxisType(initialConfig.xAxis?.title, 'altitude_pression');
      const yType = getInitialAxisType(initialConfig.yAxis?.title, 'distance');
      setCustomXTitle(xType === 'custom' ? (initialConfig.xAxis?.title || '') : '');
      setCustomYTitle(yType === 'custom' ? (initialConfig.yAxis?.title || '') : '');
      // Reset the flag after all state updates are done
      setTimeout(() => {
        isLoadingInitialConfig.current = false;
      }, 0);
    }
  }, [initialConfig]);

  // Effect pour mettre à jour la configuration quand le type d'axe change
  // Mais ne pas écraser les valeurs existantes lors du premier rendu
  useEffect(() => {
    if (xAxisType !== 'custom' && !initialConfig) {
      const option = AXIS_OPTIONS[xAxisType];
      setConfig(prev => ({
        ...prev,
        xAxis: {
          ...prev.xAxis,
          title: option.label,
          unit: prev.xAxis.unit || option.defaultUnit,
          min: prev.xAxis.min !== undefined ? prev.xAxis.min : option.defaultMin,
          max: prev.xAxis.max !== undefined ? prev.xAxis.max : option.defaultMax
        }
      }));
    }
  }, [xAxisType]);

  useEffect(() => {
    if (yAxisType !== 'custom' && !initialConfig) {
      const option = AXIS_OPTIONS[yAxisType];
      setConfig(prev => ({
        ...prev,
        yAxis: {
          ...prev.yAxis,
          title: option.label,
          unit: prev.yAxis.unit || option.defaultUnit,
          min: prev.yAxis.min !== undefined ? prev.yAxis.min : option.defaultMin,
          max: prev.yAxis.max !== undefined ? prev.yAxis.max : option.defaultMax
        }
      }));
    }
  }, [yAxisType]);

  const handleXAxisTypeChange = useCallback((value: string) => {
    setXAxisType(value);
    if (value === 'custom') {
      setConfig(prev => ({
        ...prev,
        xAxis: {
          ...prev.xAxis,
          title: customXTitle || 'Custom X Axis'
        }
      }));
    } else if (value in AXIS_OPTIONS) {
      const option = AXIS_OPTIONS[value];
      setConfig(prev => ({
        ...prev,
        xAxis: {
          title: option.label,
          unit: option.defaultUnit,
          min: option.defaultMin,
          max: option.defaultMax
        }
      }));
    }
  }, [customXTitle]);

  const handleYAxisTypeChange = useCallback((value: string) => {
    setYAxisType(value);
    if (value === 'custom') {
      setConfig(prev => ({
        ...prev,
        yAxis: {
          ...prev.yAxis,
          title: customYTitle || 'Custom Y Axis'
        }
      }));
    } else if (value in AXIS_OPTIONS) {
      const option = AXIS_OPTIONS[value];
      setConfig(prev => ({
        ...prev,
        yAxis: {
          title: option.label,
          unit: option.defaultUnit,
          min: option.defaultMin,
          max: option.defaultMax
        }
      }));
    }
  }, [customYTitle]);

  const handleChange = useCallback((axis: 'xAxis' | 'yAxis', field: string, value: string | number) => {
    setConfig(prev => ({
      ...prev,
      [axis]: {
        ...prev[axis],
        [field]: field === 'min' || field === 'max' ? Number(value) : value
      }
    }));
    setErrors({});
  }, []);

  const handleCustomTitleChange = useCallback((axis: 'xAxis' | 'yAxis', value: string) => {
    if (axis === 'xAxis') {
      setCustomXTitle(value);
      if (xAxisType === 'custom') {
        handleChange('xAxis', 'title', value);
      }
    } else {
      setCustomYTitle(value);
      if (yAxisType === 'custom') {
        handleChange('yAxis', 'title', value);
      }
    }
  }, [xAxisType, yAxisType, handleChange]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (config.xAxis.min >= config.xAxis.max) {
      newErrors.xMin = 'X min doit être inférieur à X max';
    }

    if (config.yAxis.min >= config.yAxis.max) {
      newErrors.yMin = 'Y min doit être inférieur à Y max';
    }

    if (!config.xAxis.title.trim()) {
      newErrors.xTitle = 'Le titre de l\'axe X est requis';
    }

    if (!config.yAxis.title.trim()) {
      newErrors.yTitle = 'Le titre de l\'axe Y est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Détection automatique du mode vent basé sur les axes
  useEffect(() => {
    const xTitle = config.xAxis.title?.toLowerCase() || '';
    const yTitle = config.yAxis.title?.toLowerCase() || '';
    const xUnit = config.xAxis.unit?.toLowerCase() || '';
    const yUnit = config.yAxis.unit?.toLowerCase() || '';

    const windKeywords = ['vent', 'wind', 'headwind', 'tailwind', 'crosswind'];

    const isWind = windKeywords.some(keyword =>
      xTitle.includes(keyword) ||
      yTitle.includes(keyword) ||
      xUnit.includes(keyword) ||
      yUnit.includes(keyword) ||
      xAxisType === 'vent' ||
      yAxisType === 'vent'
    );

    if (isWind !== isWindRelated && onWindRelatedChange) {
      onWindRelatedChange(isWind);
    }
  }, [config.xAxis.title, config.xAxis.unit, config.yAxis.title, config.yAxis.unit, xAxisType, yAxisType, isWindRelated, onWindRelatedChange]);

  // Sauvegarder automatiquement les changements
  useEffect(() => {
    // Skip auto-save on initial mount to avoid infinite loops
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Skip auto-save when loading initial config
    if (isLoadingInitialConfig.current) {
      return;
    }

    if (validate()) {
      const enrichedConfig = {
        ...config,
        xAxis: {
          ...config.xAxis,
          type: xAxisType
        },
        yAxis: {
          ...config.yAxis,
          type: yAxisType
        }
      };
      onSubmit(enrichedConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, xAxisType, yAxisType]);

  return (
    <div style={styles.form}>
      {/* Titre du graphique avec bouton de suppression */}
      {graphNumber && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #e0e0e0' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1976d2', margin: 0 }}>
            Graphique {graphNumber} - {AXIS_OPTIONS[xAxisType]?.label || config.xAxis.title} / {AXIS_OPTIONS[yAxisType]?.label || config.yAxis.title}
          </h2>
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Supprimer le graphique "${graphName || 'ce graphique'}" ?\n\nToutes les courbes et points associés seront supprimés.`)) {
                  onDelete();
                }
              }}
              style={{
                padding: '6px 10px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '20px',
                fontWeight: 'bold',
                lineHeight: '1',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Supprimer ce graphique"
            >
              ×
            </button>
          )}
        </div>
      )}
      <div style={styles.section}>
        <h3
          style={{
            ...styles.sectionTitle,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none'
          }}
          onClick={() => setXAxisExpanded(!xAxisExpanded)}
        >
          <span>Configuration Axe X</span>
          <span style={{ fontSize: '16px' }}>{xAxisExpanded ? '▼' : '▶'}</span>
        </h3>
        {xAxisExpanded && (
        <div style={styles.grid}>
          <div style={styles.group}>
            <label htmlFor="x-type" style={styles.label}>Type d'axe</label>
            <select
              id="x-type"
              value={xAxisType}
              onChange={(e) => handleXAxisTypeChange(e.target.value)}
              style={styles.select}
            >
              {Object.entries(AXIS_OPTIONS).map(([key, option]) => (
                <option key={key} value={key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.group}>
            <label htmlFor="x-min" style={styles.label}>Min</label>
            <input
              id="x-min"
              type="number"
              value={config.xAxis.min}
              onChange={(e) => handleChange('xAxis', 'min', e.target.value)}
              style={errors.xMin ? styles.inputError : styles.input}
            />
            {errors.xMin && <span style={styles.errorMessage}>{errors.xMin}</span>}
          </div>

          <div style={styles.group}>
            <label htmlFor="x-max" style={styles.label}>Max</label>
            <input
              id="x-max"
              type="number"
              value={config.xAxis.max}
              onChange={(e) => handleChange('xAxis', 'max', e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.group}>
            <label style={styles.label}>Ordre de l'axe</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="x-order"
                  checked={!config.xAxis.reversed}
                  onChange={() => handleChange('xAxis', 'reversed', false)}
                  style={{ marginRight: '6px' }}
                />
                <span style={{ fontSize: '13px' }}>Croissant (→)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="x-order"
                  checked={config.xAxis.reversed === true}
                  onChange={() => handleChange('xAxis', 'reversed', true)}
                  style={{ marginRight: '6px' }}
                />
                <span style={{ fontSize: '13px' }}>Décroissant (←)</span>
              </label>
            </div>
          </div>
        </div>
        )}
        {xAxisExpanded && (
        <div style={styles.helperText}>
          <strong>Variable système:</strong> <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: '3px', fontFamily: 'monospace' }}>{xAxisType}</code>
          {xAxisType !== 'custom' && (
            <span style={{ marginLeft: '12px' }}>
              <strong>Titre affiché:</strong> {config.xAxis.title}
            </span>
          )}
        </div>
        )}
      </div>

      <div style={styles.section}>
        <h3
          style={{
            ...styles.sectionTitle,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none'
          }}
          onClick={() => setYAxisExpanded(!yAxisExpanded)}
        >
          <span>Configuration Axe Y</span>
          <span style={{ fontSize: '16px' }}>{yAxisExpanded ? '▼' : '▶'}</span>
        </h3>
        {yAxisExpanded && (
        <div style={styles.grid}>
          <div style={styles.group}>
            <label htmlFor="y-type" style={styles.label}>Type d'axe</label>
            <select
              id="y-type"
              value={yAxisType}
              onChange={(e) => handleYAxisTypeChange(e.target.value)}
              style={styles.select}
            >
              {Object.entries(AXIS_OPTIONS).map(([key, option]) => (
                <option key={key} value={key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.group}>
            <label htmlFor="y-min" style={styles.label}>Min</label>
            <input
              id="y-min"
              type="number"
              value={config.yAxis.min}
              onChange={(e) => handleChange('yAxis', 'min', e.target.value)}
              style={errors.yMin ? styles.inputError : styles.input}
            />
            {errors.yMin && <span style={styles.errorMessage}>{errors.yMin}</span>}
          </div>

          <div style={styles.group}>
            <label htmlFor="y-max" style={styles.label}>Max</label>
            <input
              id="y-max"
              type="number"
              value={config.yAxis.max}
              onChange={(e) => handleChange('yAxis', 'max', e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.group}>
            <label style={styles.label}>Ordre de l'axe</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="y-order"
                  checked={!config.yAxis.reversed}
                  onChange={() => handleChange('yAxis', 'reversed', false)}
                  style={{ marginRight: '6px' }}
                />
                <span style={{ fontSize: '13px' }}>Croissant (↑)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="y-order"
                  checked={config.yAxis.reversed === true}
                  onChange={() => handleChange('yAxis', 'reversed', true)}
                  style={{ marginRight: '6px' }}
                />
                <span style={{ fontSize: '13px' }}>Décroissant (↓)</span>
              </label>
            </div>
          </div>
        </div>
        )}
        {yAxisExpanded && (
        <div style={styles.helperText}>
          <strong>Variable système:</strong> <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: '3px', fontFamily: 'monospace' }}>{yAxisType}</code>
          {yAxisType !== 'custom' && (
            <span style={{ marginLeft: '12px' }}>
              <strong>Titre affiché:</strong> {config.yAxis.title}
            </span>
          )}
        </div>
        )}
      </div>

      {/* Indicateur automatique du mode vent */}
      {isWindRelated && (
        <div style={styles.section}>
          <div style={{
            padding: '12px',
            backgroundColor: '#e3f2fd',
            borderRadius: '6px',
            border: '1px solid #2196F3'
          }}>
            <div style={{ fontWeight: 600, color: '#1976d2', marginBottom: '4px' }}>
              💨 Mode vent activé automatiquement
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Ce graphique a été détecté comme lié au vent. Vous pourrez spécifier la direction du vent (vent de face/arrière) pour chaque courbe.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};