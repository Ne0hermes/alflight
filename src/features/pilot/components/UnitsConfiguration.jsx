import React, { useState, useEffect } from 'react';
import { useAccordion } from '@hooks/useAccordion';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Select,
  MenuItem,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { StyledFormControl } from './FormFieldStyles';
import {
  Settings as SettingsIcon,
  Speed as SpeedIcon,
  Straighten as RulerIcon,
  Thermostat as ThermostatIcon,
  LocalGasStation as FuelIcon,
  Public as GlobeIcon,
  Save as SaveIcon,
  Check as CheckIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useUnitsStore, unitsSelectors } from '@core/stores/unitsStore';

const UnitsConfiguration = () => {
  const units = unitsSelectors.useUnits();
  const { setUnit, setPreset } = unitsSelectors.useUnitsActions();
  
  // Initialiser avec des valeurs par défaut pour éviter undefined
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
    timeFormat: units.timeFormat || '24h'
  });
  const [selectedPreset, setSelectedPreset] = useState('aviation');
  const { expanded, handleChange } = useAccordion();

  // Synchroniser avec le store global
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
      timeFormat: units.timeFormat || '24h'
    });
  }, [units]);

  // Configuration des catégories d'unités
  const unitsConfig = {
    general: {
      title: 'Unités générales',
      icon: <RulerIcon />,
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
            { value: 'm', label: 'Mètres (m)' }
          ]
        },
        {
          label: 'Vitesse',
          key: 'speed',
          options: [
            { value: 'kt', label: 'Nœuds (kt)' },
            { value: 'km/h', label: 'km/h' },
            { value: 'mph', label: 'mph' }
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
      icon: <ThermostatIcon />,
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
            { value: 'hPa', label: 'hPa' },
            { value: 'inHg', label: 'inHg' },
            { value: 'mb', label: 'mb' }
          ]
        },
        {
          label: 'Vent',
          key: 'windSpeed',
          options: [
            { value: 'kt', label: 'Nœuds (kt)' },
            { value: 'km/h', label: 'km/h' },
            { value: 'mph', label: 'mph' },
            { value: 'm/s', label: 'm/s' }
          ]
        },
        {
          label: 'Visibilité',
          key: 'visibility',
          options: [
            { value: 'km', label: 'km' },
            { value: 'sm', label: 'SM' },
            { value: 'm', label: 'm' }
          ]
        }
      ]
    },
    fuel: {
      title: 'Carburant & Masse',
      icon: <FuelIcon />,
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
            { value: 'gal', label: 'Gallons US' },
            { value: 'kg', label: 'kg' },
            { value: 'lbs', label: 'lbs' }
          ]
        },
        {
          label: 'Consommation',
          key: 'fuelConsumption',
          options: [
            { value: 'lph', label: 'L/h' },
            { value: 'gph', label: 'gal/h' }
          ]
        },
        {
          label: 'Bras de levier',
          key: 'armLength',
          options: [
            { value: 'mm', label: 'Millimètres (mm)' },
            { value: 'cm', label: 'Centimètres (cm)' },
            { value: 'm', label: 'Mètres (m)' },
            { value: 'in', label: 'Pouces (in)' }
          ]
        }
      ]
    }
  };

  // Préréglages régionaux
  const presets = [
    { 
      value: 'europe', 
      label: '🇪🇺 Europe', 
      description: 'Métrique (L, kg, °C)',
      color: 'primary'
    },
    { 
      value: 'usa', 
      label: '🇺🇸 USA', 
      description: 'Impérial (gal, lbs, °F)',
      color: 'error'
    },
    { 
      value: 'aviation', 
      label: '✈️ Aviation OACI', 
      description: 'Standard (kt, ft, °C)',
      color: 'info'
    },
    { 
      value: 'metric', 
      label: '📐 Métrique pur', 
      description: 'Tout métrique',
      color: 'success'
    }
  ];

  // Fonctions de conversion
  const convertValue = (value, fromUnit, toUnit, type) => {
    if (!value || isNaN(value)) return value;
    const numValue = parseFloat(value);
    
    // Conversions de vitesse
    if (type === 'speed') {
      if (fromUnit === 'kt' && toUnit === 'kmh') return Math.round(numValue * 1.852);
      if (fromUnit === 'kmh' && toUnit === 'kt') return Math.round(numValue / 1.852);
      if (fromUnit === 'kt' && toUnit === 'mph') return Math.round(numValue * 1.15078);
      if (fromUnit === 'mph' && toUnit === 'kt') return Math.round(numValue / 1.15078);
      if (fromUnit === 'kmh' && toUnit === 'mph') return Math.round(numValue * 0.621371);
      if (fromUnit === 'mph' && toUnit === 'kmh') return Math.round(numValue / 0.621371);
    }
    
    // Conversions de poids
    if (type === 'weight') {
      if (fromUnit === 'kg' && toUnit === 'lbs') return Math.round(numValue * 2.20462);
      if (fromUnit === 'lbs' && toUnit === 'kg') return Math.round(numValue / 2.20462);
    }
    
    // Conversions de carburant
    if (type === 'fuel') {
      if (fromUnit === 'ltr' && toUnit === 'gal') return Math.round(numValue * 0.264172 * 100) / 100;
      if (fromUnit === 'gal' && toUnit === 'ltr') return Math.round(numValue / 0.264172 * 100) / 100;
      if (fromUnit === 'ltr' && toUnit === 'kg') return Math.round(numValue * 0.72 * 100) / 100; // Densité AVGAS
      if (fromUnit === 'kg' && toUnit === 'ltr') return Math.round(numValue / 0.72 * 100) / 100;
      if (fromUnit === 'ltr' && toUnit === 'lbs') return Math.round(numValue * 0.72 * 2.20462 * 100) / 100;
      if (fromUnit === 'lbs' && toUnit === 'ltr') return Math.round(numValue / (0.72 * 2.20462) * 100) / 100;
    }
    
    // Conversions de consommation
    if (type === 'fuelConsumption') {
      if (fromUnit === 'lph' && toUnit === 'gph') return Math.round(numValue * 0.264172 * 100) / 100;
      if (fromUnit === 'gph' && toUnit === 'lph') return Math.round(numValue / 0.264172 * 100) / 100;
    }
    
    return value; // Retourner la valeur originale si pas de conversion
  };

  const handleUnitChange = (key, value) => {
    const newUnits = { ...localUnits, [key]: value };
    setLocalUnits(newUnits);
    setUnit(key, value);

    // Marquer que les unités ont été configurées
    localStorage.setItem('unitsConfigured', 'true');

    // Les conversions de valeurs seront gérées par les modules qui utilisent ces unités
    // Cette configuration définit simplement les préférences d'unités globales
  };

  const handlePresetSelect = (presetValue) => {
    setPreset(presetValue);
    // Marquer que les unités ont été configurées
    localStorage.setItem('unitsConfigured', 'true');
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>

      {/* Préréglages rapides */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <StyledFormControl fullWidth>
              <InputLabel>Préréglages régionaux</InputLabel>
              <Select
                value={selectedPreset}
                label="Préréglages régionaux"
                onChange={(e) => {
                  setSelectedPreset(e.target.value);
                  handlePresetSelect(e.target.value);
                }}
              >
                {presets.map(preset => (
                  <MenuItem key={preset.value} value={preset.value}>
                    {preset.label} - {preset.description}
                  </MenuItem>
                ))}
              </Select>
            </StyledFormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Configuration détaillée */}
      {Object.entries(unitsConfig).map(([categoryKey, category]) => (
        <Accordion
          key={categoryKey}
          expanded={expanded === categoryKey}
          onChange={handleChange(categoryKey)}
          elevation={0}
          sx={{ 
            mb: 2,
            border: '1px solid',
            borderColor: 'divider',
            '&:before': { display: 'none' }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{ 
              minHeight: '40px',
              '&.Mui-expanded': { minHeight: '40px' },
              '& .MuiAccordionSummary-content': { 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                margin: '8px 0'
              },
              '& .MuiAccordionSummary-content.Mui-expanded': {
                margin: '8px 0'
              }
            }}
          >
            {category.icon}
            <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
              {category.title}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 1, pb: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              {category.units.map((unitConfig, index) => (
                <Box key={unitConfig.key} sx={{ width: '100%', maxWidth: 350, mb: index < category.units.length - 1 ? 1.5 : 0 }}>
                  <StyledFormControl fullWidth size="small">
                    <InputLabel>{unitConfig.label}</InputLabel>
                    <Select
                      value={localUnits[unitConfig.key] || unitConfig.options[0].value}
                      label={unitConfig.label}
                      onChange={(e) => handleUnitChange(unitConfig.key, e.target.value)}
                    >
                      {unitConfig.options.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </StyledFormControl>
                </Box>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

    </Box>

};

export default UnitsConfiguration;