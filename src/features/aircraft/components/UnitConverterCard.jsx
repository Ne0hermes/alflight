// src/features/aircraft/components/UnitConverterCard.jsx
//
// Petit utilitaire visible en haut du wizard de création d'avion.
// Permet au pilote de vérifier rapidement n'importe quelle conversion
// d'unité utilisée dans l'application : il tape une valeur + une unité
// source, choisit l'unité cible, et lit le résultat à côté.
//
// Exemple : 2100 lbs → 952,5 kg
//
// L'objectif n'est PAS de modifier les données de l'avion — c'est
// uniquement un outil de vérification visuelle pour s'assurer que les
// conversions automatiques de l'app (extraction MANEX, saisie wizard, etc.)
// donnent bien les bonnes valeurs.

import React, { useState, useMemo } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Stack
} from '@mui/material';
import {
  Calculate as CalculateIcon,
  ExpandMore as ExpandMoreIcon,
  SwapHoriz as SwapHorizIcon
} from '@mui/icons-material';
import { convertValue } from '../../../utils/unitConversions';

// ─── Catalogue des catégories et unités supportées ──────────────────────
//
// On reprend toutes les catégories utilisées par convertValue()
// (cf. src/utils/unitConversions.js) en exposant des libellés français
// lisibles côté UI. Chaque catégorie liste ses unités { value, label }.
const CATEGORIES = [
  {
    key: 'weight',
    label: 'Poids / Masse',
    units: [
      { value: 'kg',  label: 'Kilogrammes (kg)' },
      { value: 'lbs', label: 'Livres (lbs)' }
    ]
  },
  {
    key: 'armLength',
    label: 'Bras de levier / Longueur',
    units: [
      { value: 'mm', label: 'Millimètres (mm)' },
      { value: 'cm', label: 'Centimètres (cm)' },
      { value: 'm',  label: 'Mètres (m)' },
      { value: 'in', label: 'Pouces (in)' }
    ]
  },
  {
    key: 'fuel',
    label: 'Carburant (volume)',
    units: [
      { value: 'ltr', label: 'Litres (L)' },
      { value: 'gal', label: 'Gallons US (gal)' }
    ]
  },
  {
    key: 'fuelConsumption',
    label: 'Consommation carburant',
    units: [
      { value: 'lph', label: 'Litres / heure (L/h)' },
      { value: 'gph', label: 'Gallons / heure (gal/h)' }
    ]
  },
  {
    key: 'speed',
    label: 'Vitesse',
    units: [
      { value: 'kt',  label: 'Nœuds (kt)' },
      { value: 'kmh', label: 'Km/h (km/h)' },
      { value: 'mph', label: 'Miles/h (mph)' },
      { value: 'm/s', label: 'Mètres/seconde (m/s)' }
    ]
  },
  {
    key: 'altitude',
    label: 'Altitude',
    units: [
      { value: 'ft', label: 'Pieds (ft)' },
      { value: 'm',  label: 'Mètres (m)' }
    ]
  },
  {
    key: 'runway',
    label: 'Longueur de piste',
    units: [
      { value: 'm',  label: 'Mètres (m)' },
      { value: 'ft', label: 'Pieds (ft)' }
    ]
  },
  {
    key: 'temperature',
    label: 'Température',
    units: [
      { value: 'C', label: 'Celsius (°C)' },
      { value: 'F', label: 'Fahrenheit (°F)' }
    ]
  },
  {
    key: 'distance',
    label: 'Distance',
    units: [
      { value: 'nm', label: 'Milles nautiques (NM)' },
      { value: 'km', label: 'Kilomètres (km)' },
      { value: 'mi', label: 'Milles terrestres (mi)' }
    ]
  },
  {
    key: 'pressure',
    label: 'Pression atmosphérique',
    units: [
      { value: 'hPa',  label: 'Hectopascals (hPa)' },
      { value: 'inHg', label: 'Pouces de mercure (inHg)' },
      { value: 'mb',   label: 'Millibars (mb)' }
    ]
  },
  {
    key: 'visibility',
    label: 'Visibilité',
    units: [
      { value: 'km', label: 'Kilomètres (km)' },
      { value: 'sm', label: 'Milles terrestres (sm)' }
    ]
  }
];

// Détermine le nombre de décimales d'affichage en fonction de la catégorie
const decimalsFor = (categoryKey) => {
  switch (categoryKey) {
    case 'armLength':   return 2;
    case 'fuel':
    case 'fuelConsumption':
    case 'distance':
    case 'visibility':  return 2;
    case 'weight':      return 2;
    case 'speed':       return 1;
    case 'altitude':
    case 'runway':      return 0;
    case 'temperature': return 1;
    case 'pressure':    return 2;
    default:            return 2;
  }
};

const formatNumber = (num, decimals) => {
  if (num === null || num === undefined || !Number.isFinite(num)) return '—';
  // Format français avec espace milliers + virgule décimale
  return num.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
};

/**
 * UnitConverterCard — widget visible en haut du wizard avion.
 * Pas de prop requise, totalement autonome.
 */
const UnitConverterCard = () => {
  const [categoryKey, setCategoryKey] = useState('weight');
  const [sourceUnit, setSourceUnit]   = useState('lbs');
  const [targetUnit, setTargetUnit]   = useState('kg');
  const [rawValue,   setRawValue]     = useState('2100'); // valeur de démarrage parlante

  const category = useMemo(
    () => CATEGORIES.find(c => c.key === categoryKey),
    [categoryKey]
  );

  // Quand on change de catégorie, on remet aux 2 premières unités
  const handleCategoryChange = (newKey) => {
    const newCat = CATEGORIES.find(c => c.key === newKey);
    if (!newCat) return;
    setCategoryKey(newKey);
    setSourceUnit(newCat.units[0].value);
    setTargetUnit(newCat.units[1]?.value || newCat.units[0].value);
  };

  // Inverse source ↔ cible
  const handleSwap = () => {
    setSourceUnit(targetUnit);
    setTargetUnit(sourceUnit);
    // On peut aussi remplir le champ avec le résultat actuel (UX optionnelle)
    if (result !== null && Number.isFinite(result)) {
      setRawValue(String(result));
    }
  };

  // Conversion live
  const result = useMemo(() => {
    const num = parseFloat(rawValue);
    if (!Number.isFinite(num)) return null;
    try {
      const converted = convertValue(num, sourceUnit, targetUnit, categoryKey);
      return Number.isFinite(converted) ? converted : null;
    } catch (err) {
      console.warn('[UnitConverterCard] conversion error', err);
      return null;
    }
  }, [rawValue, sourceUnit, targetUnit, categoryKey]);

  const decimals = decimalsFor(categoryKey);
  const resultText = formatNumber(result, decimals);

  return (
    <Accordion
      elevation={0}
      defaultExpanded
      sx={{
        mb: 3,
        border: '1px solid',
        borderColor: 'primary.light',
        bgcolor: 'primary.50',
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
          '& .MuiAccordionSummary-content.Mui-expanded': { margin: '8px 0' }
        }}
      >
        <CalculateIcon color="primary" />
        <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
          Vérificateur de conversion d'unités
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          (vérifie que les conversions automatiques sont justes)
        </Typography>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 1, pb: 2 }}>
        <Stack spacing={2}>
          {/* Sélecteur de catégorie */}
          <FormControl size="small" sx={{ minWidth: 240, maxWidth: 320 }}>
            <InputLabel id="conv-category-label">Catégorie</InputLabel>
            <Select
              labelId="conv-category-label"
              value={categoryKey}
              label="Catégorie"
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              {CATEGORIES.map(c => (
                <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Ligne de conversion source → cible */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              alignItems: 'center',
              bgcolor: 'background.paper',
              p: 1.5,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            {/* SOURCE — valeur + unité */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: '1 1 280px' }}>
              <TextField
                size="small"
                type="number"
                label="Valeur"
                value={rawValue}
                onChange={(e) => setRawValue(e.target.value)}
                inputProps={{
                  step: 'any',
                  style: { fontSize: 16, fontWeight: 600 }
                }}
                sx={{ width: 140 }}
              />
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel id="conv-source-unit-label">Unité source</InputLabel>
                <Select
                  labelId="conv-source-unit-label"
                  value={sourceUnit}
                  label="Unité source"
                  onChange={(e) => setSourceUnit(e.target.value)}
                >
                  {category.units.map(u => (
                    <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Bouton ↔ */}
            <Tooltip title="Inverser source ↔ cible">
              <IconButton
                onClick={handleSwap}
                size="medium"
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' }
                }}
              >
                <SwapHorizIcon />
              </IconButton>
            </Tooltip>

            {/* CIBLE — résultat + unité */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: '1 1 280px' }}>
              <TextField
                size="small"
                label="Résultat"
                value={resultText}
                InputProps={{
                  readOnly: true,
                  style: { fontSize: 16, fontWeight: 700, color: '#0f766e' }
                }}
                sx={{
                  width: 160,
                  '& .MuiInputBase-root': { bgcolor: '#ecfdf5' }
                }}
              />
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel id="conv-target-unit-label">Unité cible</InputLabel>
                <Select
                  labelId="conv-target-unit-label"
                  value={targetUnit}
                  label="Unité cible"
                  onChange={(e) => setTargetUnit(e.target.value)}
                >
                  {category.units.map(u => (
                    <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* Récap textuel explicite */}
          {result !== null && rawValue !== '' && (
            <Typography
              variant="body2"
              sx={{
                p: 1,
                bgcolor: 'background.paper',
                borderRadius: 1,
                border: '1px dashed',
                borderColor: 'primary.light',
                fontFamily: 'monospace',
                fontSize: 14
              }}
            >
              <strong>{formatNumber(parseFloat(rawValue), decimals)}</strong>{' '}
              {sourceUnit}{'  =  '}
              <strong style={{ color: '#0f766e' }}>{resultText}</strong>{' '}
              {targetUnit}
            </Typography>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

export default UnitConverterCard;
