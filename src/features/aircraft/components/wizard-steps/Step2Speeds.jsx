import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Grid, 
  Paper, 
  Alert, 
  Button,
  InputAdornment,
  Divider,
  Chip,
  IconButton,
  FormControlLabel,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { 
  Speed as SpeedIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Air as WindIcon,
  ExpandMore as ExpandMoreIcon,
  PriorityHigh as CriticalIcon,
  CheckCircle as OptionalIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useUnitsStore, unitsSelectors } from '@core/stores/unitsStore';
import { getUnitSymbol } from '@utils/unitConversions';
import { StyledTextField } from './FormFieldStyles';

const Step2Speeds = ({ data, updateData, errors = {} }) => {
  const units = unitsSelectors.useUnits();
  const unit = units.speed; // Utiliser l'unité de vitesse depuis le store
  const [expandedPanels, setExpandedPanels] = useState({
    flapsOut: false,
    clean: false,
    vne: false,
    vo: false,
    optional: false,
    wind: false
  });

  const handlePanelChange = (panel) => (event, isExpanded) => {
    if (isExpanded) {
      // When opening a panel, close all others and open this one
      setExpandedPanels({
        flapsOut: false,
        clean: false,
        vne: false,
        vo: false,
        optional: false,
        wind: false,
        [panel]: true
      });
    } else {
      // When closing a panel, just close it
      setExpandedPanels(prev => ({ ...prev, [panel]: false }));
    }
  };

  // Initialiser les plages VO si elles n'existent pas
  const [voRanges, setVoRanges] = useState(data.speeds?.voRanges || [
    { minWeight: '', maxWeight: '', speed: '' }
  ]);


  const addVoRange = () => {
    const newRanges = [...voRanges, { minWeight: '', maxWeight: '', speed: '' }];
    setVoRanges(newRanges);
    updateData('speeds.voRanges', newRanges);
  };

  const removeVoRange = (index) => {
    const newRanges = voRanges.filter((_, i) => i !== index);
    setVoRanges(newRanges);
    updateData('speeds.voRanges', newRanges);
  };

  const updateVoRange = (index, field, value) => {
    const newRanges = [...voRanges];
    newRanges[index][field] = value;
    setVoRanges(newRanges);
    updateData('speeds.voRanges', newRanges);
  };

  // Vitesses critiques (obligatoires) - incluant VO
  const criticalSpeeds = {
    vso: {
      name: "VSO",
      label: "Vitesse de décrochage volets sortis",
      description: "Vitesse minimale de sustentation en configuration atterrissage",
      color: "#ffffff",
      category: "critical",
      required: true
    },
    vfeLdg: {
      name: "VFE LDG",
      label: "Vitesse max volets atterrissage",
      description: "Vitesse maximale avec volets en configuration atterrissage",
      color: "#ffffff",
      category: "critical",
      required: true
    },
    vfeTO: {
      name: "VFE T/O",
      label: "Vitesse max volets décollage",
      description: "Vitesse maximale avec volets en configuration décollage",
      color: "#ffffff",
      category: "critical",
      required: true
    },
    vs1: {
      name: "VS1",
      label: "Vitesse de décrochage lisse",
      description: "Vitesse minimale de sustentation en configuration lisse",
      color: "#28a745",
      category: "critical",
      required: true
    },
    vno: {
      name: "VNO",
      label: "Vitesse maximale de croisière",
      description: "Vitesse maximale pour opérations normales",
      color: "#ffc107",
      category: "critical",
      required: true
    },
    vne: {
      name: "VNE",
      label: "Vitesse à ne jamais dépasser",
      description: "Vitesse maximale absolue de l'avion",
      color: "#dc3545",
      category: "critical",
      required: true
    }
  };

  // Vitesses facultatives (avec VA)
  const optionalSpeeds = {
    va: {
      name: "VA",
      label: "VA - Vitesse de manœuvre",
      description: "Vitesse maximale pour manœuvres à plein débattement",
      color: "#9c27b0",
      category: "optional",
      required: false
    },
    vr: {
      name: "VR",
      label: "VR - Vitesse de rotation",
      description: "Vitesse à laquelle le pilote tire sur le manche pour décoller",
      color: "#17a2b8",
      category: "optional",
      required: false
    },
    vx: {
      name: "VX",
      label: "VX - Vitesse de meilleur angle de montée",
      description: "Vitesse pour la pente de montée maximale",
      color: "#6610f2",
      category: "optional",
      required: false
    },
    vy: {
      name: "VY",
      label: "VY - Vitesse de meilleur taux de montée",
      description: "Vitesse pour le taux de montée maximal",
      color: "#e83e8c",
      category: "optional",
      required: false
    },
    initialClimb: {
      name: "V Montée initiale",
      label: "V Montée initiale - Vitesse de montée initiale",
      description: "Vitesse recommandée pour la montée initiale après décollage",
      color: "#795548",
      category: "optional",
      required: false
    },
    vglide: {
      name: "V Glide",
      label: "V Glide - Vitesse de plané optimal",
      description: "Vitesse pour la meilleure finesse",
      color: "#007bff",
      category: "optional",
      required: false
    },
    vle: {
      name: "VLE",
      label: "VLE - Vitesse max train sorti",
      description: "Vitesse maximale avec train d'atterrissage sorti",
      color: "#fd7e14",
      category: "optional",
      required: false
    },
    vlo: {
      name: "VLO",
      label: "VLO - Vitesse max manœuvre train",
      description: "Vitesse maximale pour sortir/rentrer le train",
      color: "#20c997",
      category: "optional",
      required: false
    }
  };

  const renderSpeedInput = (key, speed) => {
    const value = data.speeds?.[key] || '';
    const isRequired = speed.required;
    const displayLabel = speed.label || `${speed.name} - ${speed.label || speed.description}`;
    
    return (
      <StyledTextField
        key={key}
        fullWidth
        variant="outlined"
        label={displayLabel}
        type="number"
        value={value}
        onChange={(e) => updateData(`speeds.${key}`, e.target.value)}
        placeholder="---"
        error={!!errors[`speeds.${key}`]}
        helperText={errors[`speeds.${key}`] || speed.description}
        required={isRequired}
        InputProps={{
          endAdornment: <InputAdornment position="end">{getUnitSymbol(units.speed)}</InputAdornment>,
          sx: { height: '56px' }
        }}
        InputLabelProps={{
          shrink: true,
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'background.default',
            height: '56px'
          }
        }}
      />
    );
  };

  const renderSpeedChart = () => {
    const speeds = data.speeds || {};
    const maxSpeed = Math.max(
      parseFloat(speeds.vne) || 200,
      200
    );

    const getPosition = (speed) => {
      if (!speed) return 0;
      return (parseFloat(speed) / maxSpeed) * 100;
    };

    return (
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SpeedIcon />
          Visualisation de l'arc de vitesses
        </Typography>
        
        <Box sx={{ 
          position: 'relative', 
          height: 60, 
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          mb: 2
        }}>
          {/* Arc blanc - VSO à VFE LDG */}
          {speeds.vso && speeds.vfeLdg && (
            <Box
              sx={{
                position: 'absolute',
                left: `${getPosition(speeds.vso)}%`,
                width: `${getPosition(speeds.vfeLdg) - getPosition(speeds.vso)}%`,
                height: '100%',
                bgcolor: 'grey.100',
                border: '2px solid',
                borderColor: 'grey.300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}
            >
              Arc blanc
            </Box>
          )}
          
          {/* Arc vert - VS1 à VNO */}
          {speeds.vs1 && speeds.vno && (
            <Box
              sx={{
                position: 'absolute',
                left: `${getPosition(speeds.vs1)}%`,
                width: `${getPosition(speeds.vno) - getPosition(speeds.vs1)}%`,
                height: '100%',
                bgcolor: 'success.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}
            >
              Arc vert
            </Box>
          )}
          
          {/* Arc jaune - VNO à VNE */}
          {speeds.vno && speeds.vne && (
            <Box
              sx={{
                position: 'absolute',
                left: `${getPosition(speeds.vno)}%`,
                width: `${getPosition(speeds.vne) - getPosition(speeds.vno)}%`,
                height: '100%',
                bgcolor: 'warning.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.primary',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}
            >
              Arc jaune
            </Box>
          )}
          
          {/* Trait rouge - VNE */}
          {speeds.vne && (
            <Box
              sx={{
                position: 'absolute',
                left: `${getPosition(speeds.vne)}%`,
                width: '3px',
                height: '100%',
                bgcolor: 'error.main'
              }}
            />
          )}

          {/* Indicateurs VO dynamiques */}
          {voRanges && voRanges.map((range, index) => {
            if (!range.speed) return null;
            return (
              <Box
                key={`vo-${index}`}
                sx={{
                  position: 'absolute',
                  left: `${getPosition(range.speed)}%`,
                  width: '2px',
                  height: '50%',
                  top: '25%',
                  bgcolor: 'purple',
                  '&::after': {
                    content: `"VO${index + 1}"`,
                    position: 'absolute',
                    bottom: '-18px',
                    left: '-12px',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    color: 'purple'
                  }
                }}
              />
            );
          })}
        </Box>
        
        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: 'success.main', borderRadius: 0.5 }} />
              Arc vert: Plage normale d'utilisation
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: 'grey.200', border: '1px solid', borderColor: 'grey.400', borderRadius: 0.5 }} />
              Arc blanc: Plage volets sortis
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: 'warning.main', borderRadius: 0.5 }} />
              Arc jaune: Précaution (air calme)
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: 'error.main', borderRadius: 0.5 }} />
              Trait rouge: Ne jamais dépasser
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    );
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>

      {/* 1. Configuration volets sortis (obligatoire) */}
      <Accordion 
        expanded={expandedPanels.flapsOut}
        onChange={handlePanelChange('flapsOut')}
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
          <CriticalIcon color="error" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Configuration volets sortis (obligatoire)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('vso', {
                name: "VSO",
                label: "VSO - Vitesse de décrochage volets sortis *",
                description: "Vitesse minimale de sustentation en configuration atterrissage",
                color: "#ffffff",
                category: "critical",
                required: true
              })}
            </Grid>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('vfeLdg', {
                name: "VFE LDG",
                label: "VFE LDG - Vitesse max volets atterrissage *",
                description: "Vitesse maximale avec volets en configuration atterrissage",
                color: "#ffffff",
                category: "critical",
                required: true
              })}
            </Grid>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('vfeTO', {
                name: "VFE T/O",
                label: "VFE T/O - Vitesse max volets décollage *",
                description: "Vitesse maximale avec volets en configuration décollage",
                color: "#ffffff",
                category: "critical",
                required: true
              })}
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 2. Configuration lisse (obligatoire) */}
      <Accordion 
        expanded={expandedPanels.clean}
        onChange={handlePanelChange('clean')}
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
          <CriticalIcon color="error" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Configuration lisse (obligatoire)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('vs1', {
                name: "VS1",
                label: "VS1 - Vitesse de décrochage lisse *",
                description: "Vitesse minimale de sustentation en configuration lisse",
                color: "#28a745",
                category: "critical",
                required: true
              })}
            </Grid>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('vno', {
                name: "VNO",
                label: "VNO - Vitesse max en air calme *",
                description: "Vitesse maximale pour opérations normales",
                color: "#ffc107",
                category: "critical",
                required: true
              })}
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 3. VNE (obligatoire) */}
      <Accordion 
        expanded={expandedPanels.vne}
        onChange={handlePanelChange('vne')}
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
          <CriticalIcon color="error" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            VNE (obligatoire)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('vne', {
                name: "VNE",
                label: "VNE - Vitesse à ne jamais dépasser *",
                description: "Vitesse maximale absolue de l'avion",
                color: "#dc3545",
                category: "critical",
                required: true
              })}
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 4. VO - Vitesses de manœuvre */}
      <Accordion 
        expanded={expandedPanels.vo}
        onChange={handlePanelChange('vo')}
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
          <CriticalIcon color="error" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            VO - Vitesses de manœuvre
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
              Vitesse maximale pour manœuvres complètes selon la masse
            </Typography>
            
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addVoRange}
                size="small"
              >
                Ajouter une plage
              </Button>
            </Box>

            <Grid container spacing={2} justifyContent="center">
              {voRanges.map((range, index) => (
                <Grid item xs={12} key={index} sx={{ maxWidth: 600 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 2, 
                    alignItems: 'flex-start',
                    p: 2,
                    bgcolor: 'background.default',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}>
                    <Chip 
                      label={`VO${index + 1}`}
                      sx={{ 
                        bgcolor: 'purple',
                        color: 'white',
                        mt: 1.5,
                        fontWeight: 'bold'
                      }}
                    />
                    
                    <Grid container spacing={2} sx={{ flex: 1 }}>
                      <Grid item xs={12} md={4}>
                        <StyledTextField
                          fullWidth
                          label="Masse min"
                          type="number"
                          value={range.minWeight || ''}
                          onChange={(e) => updateVoRange(index, 'minWeight', e.target.value)}
                          placeholder={index === 0 ? "0" : "900"}
                          variant="outlined"
                          size="medium"
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <StyledTextField
                          fullWidth
                          label="Masse max *"
                          type="number"
                          value={range.maxWeight || ''}
                          onChange={(e) => updateVoRange(index, 'maxWeight', e.target.value)}
                          placeholder="1150"
                          variant="outlined"
                          size="medium"
                          required
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={3}>
                        <StyledTextField
                          fullWidth
                          label="Vitesse VO *"
                          type="number"
                          value={range.speed || ''}
                          onChange={(e) => updateVoRange(index, 'speed', e.target.value)}
                          placeholder="95"
                          variant="outlined"
                          size="medium"
                          required
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.speed)}</InputAdornment>,
                          }}
                        />
                      </Grid>
                    </Grid>
                    
                    <IconButton
                      onClick={() => removeVoRange(index)}
                      disabled={voRanges.length === 1}
                      color="error"
                      sx={{ mt: 1 }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Grid>
              ))}
            </Grid>
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
              Définissez les vitesses de manœuvre pour différentes plages de masse
            </Typography>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 5. Autres vitesses (facultatif) */}
      <Accordion 
        expanded={expandedPanels.optional}
        onChange={handlePanelChange('optional')}
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
          <OptionalIcon color="success" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Autres vitesses (facultatif)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('vr', optionalSpeeds.vr)}
            </Grid>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('vx', optionalSpeeds.vx)}
            </Grid>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('vy', optionalSpeeds.vy)}
            </Grid>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('vapp', {
                name: "VApp",
                label: "VApp - Vitesse d'approche",
                description: "Vitesse de référence en approche finale",
                color: "#17a2b8",
                category: "optional",
                required: false
              })}
            </Grid>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('initialClimb', optionalSpeeds.initialClimb)}
            </Grid>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('vglide', optionalSpeeds.vglide)}
            </Grid>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('vle', optionalSpeeds.vle)}
            </Grid>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              {renderSpeedInput('vlo', optionalSpeeds.vlo)}
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 6. Limitations de vent */}
      <Accordion 
        expanded={expandedPanels.wind}
        onChange={handlePanelChange('wind')}
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
          <WindIcon color="warning" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Limitations de vent
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Vent de travers max *"
                type="number"
                value={data.windLimits?.maxCrosswind || ''}
                onChange={(e) => updateData('windLimits.maxCrosswind', e.target.value)}
                placeholder="Ex: 17"
                required
                error={!!errors['windLimits.maxCrosswind']}
                helperText={errors['windLimits.maxCrosswind']}
                InputLabelProps={{
                  shrink: true,
                }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.speed)}</InputAdornment>,
                  sx: { height: '56px' }
                }}
                sx={{ '& .MuiOutlinedInput-root': { height: '56px' } }}
              />
            </Grid>
            
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Vent arrière max *"
                type="number"
                value={data.windLimits?.maxTailwind || ''}
                onChange={(e) => updateData('windLimits.maxTailwind', e.target.value)}
                placeholder="Ex: 10"
                required
                error={!!errors['windLimits.maxTailwind']}
                helperText={errors['windLimits.maxTailwind']}
                InputLabelProps={{
                  shrink: true,
                }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.speed)}</InputAdornment>,
                  sx: { height: '56px' }
                }}
                sx={{ '& .MuiOutlinedInput-root': { height: '56px' } }}
              />
            </Grid>
            
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Vent travers piste mouillée *"
                type="number"
                value={data.windLimits?.maxCrosswindWet || ''}
                onChange={(e) => updateData('windLimits.maxCrosswindWet', e.target.value)}
                placeholder="Ex: 13"
                required
                error={!!errors['windLimits.maxCrosswindWet']}
                helperText={errors['windLimits.maxCrosswindWet']}
                InputLabelProps={{
                  shrink: true,
                }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.speed)}</InputAdornment>,
                  sx: { height: '56px' }
                }}
                sx={{ '& .MuiOutlinedInput-root': { height: '56px' } }}
              />
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Visualisation graphique */}
      {renderSpeedChart()}

    </Box>
  );
};

export default Step2Speeds;