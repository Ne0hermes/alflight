import React, { useState, useEffect, Fragment } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Grid, 
  Paper, 
  Alert, 
  Button,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { 
  Scale as ScaleIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  LocalGasStation as FuelIcon,
  AirlineSeatReclineNormal as SeatIcon,
  Luggage as LuggageIcon,
  FitnessCenter as WeightIcon,
  CenterFocusStrong as CenterIcon
} from '@mui/icons-material';
import { useUnitsStore, unitsSelectors } from '@core/stores/unitsStore';
import { convertValue, getUnitSymbol } from '@utils/unitConversions';
import CGEnvelopeChart from '../CgEnvelopeChart';
import { StyledTextField } from './FormFieldStyles';

const Step3WeightBalance = ({ data, updateData, errors = {} }) => {
  const [expandedPanels, setExpandedPanels] = useState({
    emptyWeight: false,
    fuel: false,
    seats: false,
    baggage: false,
    limits: false,
    cgEnvelope: false
  });
  
  const handlePanelChange = (panel) => (event, isExpanded) => {
    if (isExpanded) {
      // When opening a panel, close all others and open this one
      setExpandedPanels({
        emptyWeight: false,
        fuel: false,
        seats: false,
        baggage: false,
        limits: false,
        cgEnvelope: false,
        [panel]: true
      });
    } else {
      // When closing a panel, just close it
      setExpandedPanels(prev => ({ ...prev, [panel]: false }));
    }
  };
  
  const [forwardPoints, setForwardPoints] = useState(
    data.cgEnvelope?.forwardPoints && data.cgEnvelope.forwardPoints.length > 0
      ? data.cgEnvelope.forwardPoints
      : [{ weight: '', cg: '', id: Date.now() + Math.random() }]
  );
  const [additionalSeats, setAdditionalSeats] = useState(data.additionalSeats || []);
  const [baggageCompartments, setBaggageCompartments] = useState(
    data.baggageCompartments && data.baggageCompartments.length > 0
      ? data.baggageCompartments
      : [
          { 
            id: Date.now() + Math.random(), 
            name: 'Compartiment avant', 
            arm: data.arms?.baggageFwd || '', 
            maxWeight: data.weights?.maxBaggageFwd || '' 
          },
          { 
            id: Date.now() + Math.random() + 1, 
            name: 'Compartiment arrière', 
            arm: data.arms?.baggageAft || '', 
            maxWeight: data.weights?.maxBaggageAft || '' 
          }
        ]
  );
  const units = unitsSelectors.useUnits();
  const [previousUnits, setPreviousUnits] = useState(units);

  // Gérer les conversions automatiques lors du changement d'unités
  useEffect(() => {
    // Convertir toutes les masses
    const weightFields = [
      'weights.emptyWeight',
      'weights.mtow',
      'weights.mlw',
      'weights.minTakeoffWeight',
      'weights.maxBaggageFwd',
      'weights.maxBaggageAft'
    ];
    
    if (previousUnits.weight !== units.weight) {
      weightFields.forEach(field => {
        const keys = field.split('.');
        const value = keys.reduce((obj, key) => obj?.[key], data);
        if (value) {
          const convertedValue = convertValue(
            value,
            previousUnits.weight,
            units.weight,
            'weight'
          );
          if (convertedValue && convertedValue !== value) {
            updateData(field, Math.round(convertedValue * 10) / 10);
          }
        }
      });

    }

    // Convertir les bras de levier
    const armFields = [
      'arms.empty',
      'arms.frontSeats',
      'arms.rearSeats',
      'arms.fuelMain',
      'arms.baggageFwd',
      'arms.baggageAft',
      'cgLimits.forward',
      'cgLimits.aft'
    ];
    
    if (previousUnits.armLength !== units.armLength) {
      armFields.forEach(field => {
        const keys = field.split('.');
        const value = keys.reduce((obj, key) => obj?.[key], data);
        if (value) {
          const convertedValue = convertValue(
            value,
            previousUnits.armLength || 'mm',
            units.armLength || 'mm',
            'armLength'
          );
          if (convertedValue && convertedValue !== value) {
            updateData(field, Math.round(convertedValue * 100) / 100);
          }
        }
      });

      // Convertir les sièges supplémentaires
      if (additionalSeats.length > 0) {
        const convertedSeats = additionalSeats.map(seat => ({
          ...seat,
          arm: seat.arm ? Math.round(convertValue(
            seat.arm,
            previousUnits.armLength || 'mm',
            units.armLength || 'mm',
            'armLength'
          ) * 100) / 100 : ''
        }));
        setAdditionalSeats(convertedSeats);
        updateData('additionalSeats', convertedSeats);
      }

      // Convertir les compartiments bagages
      if (baggageCompartments.length > 0) {
        const convertedCompartments = baggageCompartments.map(compartment => ({
          ...compartment,
          arm: compartment.arm ? Math.round(convertValue(
            compartment.arm,
            previousUnits.armLength || 'mm',
            units.armLength || 'mm',
            'armLength'
          ) * 100) / 100 : '',
          maxWeight: compartment.maxWeight && previousUnits.weight !== units.weight ? 
            Math.round(convertValue(
              compartment.maxWeight,
              previousUnits.weight,
              units.weight,
              'weight'
            ) * 10) / 10 : compartment.maxWeight
        }));
        setBaggageCompartments(convertedCompartments);
        updateData('baggageCompartments', convertedCompartments);
      }

    }

    // Convertir les points CG avant
    if (forwardPoints.length > 0) {
      const convertedPoints = forwardPoints.map(point => ({
        ...point,
        weight: point.weight && previousUnits.weight !== units.weight ? 
          Math.round(convertValue(
            point.weight,
            previousUnits.weight,
            units.weight,
            'weight'
          ) * 10) / 10 : point.weight,
        cg: point.cg && previousUnits.armLength !== units.armLength ? 
          Math.round(convertValue(
            point.cg,
            previousUnits.armLength || 'mm',
            units.armLength || 'mm',
            'armLength'
          ) * 10000) / 10000 : point.cg
      }));
      setForwardPoints(convertedPoints);
      updateData('cgEnvelope.forwardPoints', convertedPoints);
    }

    setPreviousUnits(units);
  }, [units]);

  // Fonctions pour gérer les points CG avant
  const addForwardPoint = () => {
    const newPoint = { weight: '', cg: '', id: Date.now() + Math.random() };
    const updatedPoints = [...forwardPoints, newPoint];
    setForwardPoints(updatedPoints);
    updateData('cgEnvelope.forwardPoints', updatedPoints);
  };

  const removeForwardPoint = (pointId) => {
    const updatedPoints = forwardPoints.filter(point => point.id !== pointId);
    setForwardPoints(updatedPoints);
    updateData('cgEnvelope.forwardPoints', updatedPoints);
  };

  const updateForwardPoint = (pointId, field, value) => {
    const updatedPoints = forwardPoints.map(point => 
      point.id === pointId ? { ...point, [field]: value } : point
    );
    setForwardPoints(updatedPoints);
    updateData('cgEnvelope.forwardPoints', updatedPoints);
  };

  // Gestion des sièges supplémentaires
  const addSeat = () => {
    const newSeat = { 
      id: Date.now(), 
      name: `Siège ${additionalSeats.length + 3}`, 
      arm: '' 
    };
    const updatedSeats = [...additionalSeats, newSeat];
    setAdditionalSeats(updatedSeats);
    updateData('additionalSeats', updatedSeats);
  };

  const removeSeat = (id) => {
    const updatedSeats = additionalSeats.filter(seat => seat.id !== id);
    setAdditionalSeats(updatedSeats);
    updateData('additionalSeats', updatedSeats);
  };

  const updateSeat = (id, field, value) => {
    const updatedSeats = additionalSeats.map(seat => 
      seat.id === id ? { ...seat, [field]: value } : seat
    );
    setAdditionalSeats(updatedSeats);
    updateData('additionalSeats', updatedSeats);
  };

  // Gestion des compartiments bagages
  const addBaggageCompartment = () => {
    const newCompartment = { 
      id: Date.now() + Math.random(), 
      name: `Compartiment ${baggageCompartments.length + 1}`, 
      arm: '', 
      maxWeight: '' 
    };
    const updatedCompartments = [...baggageCompartments, newCompartment];
    setBaggageCompartments(updatedCompartments);
    updateData('baggageCompartments', updatedCompartments);
  };

  const removeBaggageCompartment = (compartmentId) => {
    const updatedCompartments = baggageCompartments.filter(c => c.id !== compartmentId);
    setBaggageCompartments(updatedCompartments);
    updateData('baggageCompartments', updatedCompartments);
  };

  const updateBaggageCompartment = (compartmentId, field, value) => {
    const updatedCompartments = baggageCompartments.map(c => 
      c.id === compartmentId ? { ...c, [field]: value } : c
    );
    setBaggageCompartments(updatedCompartments);
    updateData('baggageCompartments', updatedCompartments);
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>

      {/* Masse à vide */}
      <Accordion 
        expanded={expandedPanels.emptyWeight}
        onChange={handlePanelChange('emptyWeight')}
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
          <ScaleIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Masse à vide
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <Box sx={{ width: '100%', maxWidth: 350, mb: 1.5 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="Masse à vide *"
                type="number"
                value={data.weights?.emptyWeight || ''}
                onChange={(e) => updateData('weights.emptyWeight', e.target.value)}
                error={!!errors['weights.emptyWeight']}
                helperText={errors['weights.emptyWeight'] || "Masse de l'avion sans carburant ni chargement"}
                required
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                }}
              />
            </Box>
            
            <Box sx={{ width: '100%', maxWidth: 350 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="Bras de levier"
                type="number"
                value={data.arms?.empty || ''}
                onChange={(e) => updateData('arms.empty', e.target.value)}
                error={!!errors['arms.empty']}
                helperText="Distance depuis la référence"
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                }}
              />
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Carburant */}
      <Accordion 
        expanded={expandedPanels.fuel}
        onChange={handlePanelChange('fuel')}
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
          <FuelIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Carburant
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <Box sx={{ width: '100%', maxWidth: 350, mb: 1.5 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="Capacité maximale (importée)"
                type="number"
                value={data.fuelCapacity || ''}
                disabled
                helperText="✓ Valeur importée depuis les informations générales"
                InputProps={{
                  readOnly: true,
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.fuel)}</InputAdornment>,
                }}
                sx={{
                  '& .MuiInputBase-input.Mui-disabled': {
                    color: 'text.primary',
                    WebkitTextFillColor: 'unset',
                  },
                  '& .MuiOutlinedInput-root.Mui-disabled': {
                    '& fieldset': {
                      borderColor: 'success.main',
                      borderStyle: 'dashed'
                    }
                  }
                }}
              />
            </Box>
            
            <Box sx={{ width: '100%', maxWidth: 350 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="Bras de levier carburant"
                type="number"
                value={data.arms?.fuelMain || ''}
                onChange={(e) => updateData('arms.fuelMain', e.target.value)}
                error={!!errors['arms.fuelMain']}
                helperText="Centre de gravité du réservoir"
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                }}
              />
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Sièges */}
      <Accordion 
        expanded={expandedPanels.seats}
        onChange={handlePanelChange('seats')}
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
          <SeatIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Sièges (bras de levier)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={addSeat}
              >
                Ajouter un siège
              </Button>
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <Box sx={{ width: '100%', maxWidth: 350, mb: 1.5 }}>
                <StyledTextField
                  fullWidth
                  size="small"
                  label="Sièges avant (Pilote + Copilote)"
                  type="number"
                  value={data.arms?.frontSeats || ''}
                  onChange={(e) => updateData('arms.frontSeats', e.target.value)}
                  error={!!errors['arms.frontSeats']}
                  helperText="Station des sièges avant"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                  }}
                />
              </Box>
              
              <Box sx={{ width: '100%', maxWidth: 350, mb: additionalSeats.length > 0 ? 1.5 : 0 }}>
                <StyledTextField
                  fullWidth
                  size="small"
                  label="Sièges arrière (Rangée 2)"
                  type="number"
                  value={data.arms?.rearSeats || ''}
                  onChange={(e) => updateData('arms.rearSeats', e.target.value)}
                  error={!!errors['arms.rearSeats']}
                  helperText="Station des sièges arrière"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                  }}
                />
              </Box>
              
              {/* Sièges supplémentaires */}
              {additionalSeats.map((seat, index) => (
                <Box key={seat.id} sx={{ width: '100%', maxWidth: 350, mb: index < additionalSeats.length - 1 ? 1.5 : 0 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <StyledTextField
                      fullWidth
                      size="small"
                      label={seat.name}
                      type="number"
                      value={seat.arm}
                      onChange={(e) => updateSeat(seat.id, 'arm', e.target.value)}
                      placeholder="Station du siège"
                      InputProps={{
                        endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                      }}
                    />
                    <IconButton
                      color="error"
                      onClick={() => removeSeat(seat.id)}
                      size="small"
                      sx={{ mt: 0.5 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </Box>
            
            {additionalSeats.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
                Les sièges supplémentaires permettent de gérer les configurations spéciales
              </Typography>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Compartiments bagages */}
      <Accordion 
        expanded={expandedPanels.baggage}
        onChange={handlePanelChange('baggage')}
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
          <LuggageIcon color="warning" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Compartiments bagages
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Button
                variant="contained"
                color="warning"
                size="small"
                startIcon={<AddIcon />}
                onClick={addBaggageCompartment}
                sx={{ textTransform: 'none' }}
              >
                Ajouter un compartiment
              </Button>
            </Box>
            
            {baggageCompartments.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                Aucun compartiment défini. Cliquez sur "Ajouter un compartiment" pour commencer.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                {baggageCompartments.map((compartment, index) => (
                  <Box key={compartment.id} sx={{ width: '100%', maxWidth: 500, mb: index < baggageCompartments.length - 1 ? 2 : 0 }}>
                    {index > 0 && <Divider sx={{ mb: 2 }} />}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, textAlign: 'center' }}>
                      {compartment.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', justifyContent: 'center' }}>
                      <StyledTextField
                        size="small"
                        label="Bras de levier"
                        type="number"
                        value={compartment.arm}
                        onChange={(e) => updateBaggageCompartment(compartment.id, 'arm', e.target.value)}
                        placeholder="Station"
                        sx={{ width: 180 }}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                        }}
                      />
                      <StyledTextField
                        size="small"
                        label="Masse max"
                        type="number"
                        value={compartment.maxWeight}
                        onChange={(e) => updateBaggageCompartment(compartment.id, 'maxWeight', e.target.value)}
                        placeholder="Charge max"
                        sx={{ width: 180 }}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                        }}
                      />
                      {baggageCompartments.length > 1 && (
                        <IconButton
                          color="error"
                          onClick={() => removeBaggageCompartment(compartment.id)}
                          size="small"
                          sx={{ mt: 0.5 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Masses limites */}
      <Accordion 
        expanded={expandedPanels.limits}
        onChange={handlePanelChange('limits')}
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
          <WeightIcon color="error" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Masses limites
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <Box sx={{ width: '100%', maxWidth: 350, mb: 1.5 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="MTOW *"
                type="number"
                value={data.weights?.mtow || ''}
                onChange={(e) => updateData('weights.mtow', e.target.value)}
                error={!!errors['weights.mtow']}
                helperText={errors['weights.mtow'] || "Masse maximale au décollage"}
                required
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                }}
              />
            </Box>
            
            <Box sx={{ width: '100%', maxWidth: 350, mb: 1.5 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="MLW"
                type="number"
                value={data.weights?.mlw || ''}
                onChange={(e) => updateData('weights.mlw', e.target.value)}
                error={!!errors['weights.mlw']}
                helperText={errors['weights.mlw'] || "Masse maximale à l'atterrissage"}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                }}
              />
            </Box>
            
            <Box sx={{ width: '100%', maxWidth: 350 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="Masse min au décollage"
                type="number"
                value={data.weights?.minTakeoffWeight || ''}
                onChange={(e) => updateData('weights.minTakeoffWeight', e.target.value)}
                error={!!errors['weights.minTakeoffWeight']}
                helperText={errors['weights.minTakeoffWeight'] || "Masse minimale autorisée au décollage"}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                }}
              />
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* CENTER OF GRAVITY - Enveloppe de centrage */}
      <Accordion 
        expanded={expandedPanels.cgEnvelope}
        onChange={handlePanelChange('cgEnvelope')}
        elevation={0}
        sx={{ 
          mb: 2,
          border: '2px solid',
          borderColor: 'error.main',
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
          <CenterIcon color="error" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600, color: 'error.main' }}>
            CENTER OF GRAVITY - Enveloppe de centrage
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ width: '100%' }}>
            {/* CG Avant (Most forward) - Points dynamiques */}
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '14px' }}>
                  📍 Most Forward CG (Limite avant)
                </Typography>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addForwardPoint}
                  sx={{ textTransform: 'none' }}
                >
                  Ajouter un point
                </Button>
              </Box>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                {forwardPoints.map((point, index) => (
                  <Box key={point.id} sx={{ width: '100%', maxWidth: 500, mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, textAlign: 'center' }}>
                      Point {index + 1}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <StyledTextField
                        size="small"
                        label={`Masse Point ${index + 1}`}
                        type="number"
                        value={point.weight}
                        onChange={(e) => updateForwardPoint(point.id, 'weight', e.target.value)}
                        placeholder="940"
                        sx={{ width: 180 }}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                        }}
                      />
                      <StyledTextField
                        size="small"
                        label={`CG Point ${index + 1}`}
                        type="number"
                        value={point.cg}
                        onChange={(e) => updateForwardPoint(point.id, 'cg', e.target.value)}
                        placeholder="2.4000"
                        inputProps={{ step: "0.0001" }}
                        sx={{ width: 180 }}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                        }}
                      />
                      {forwardPoints.length > 1 && (
                        <IconButton
                          color="error"
                          onClick={() => removeForwardPoint(point.id)}
                          size="small"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
              
              {forwardPoints.length === 0 && (
                <Alert severity="warning">
                  <Typography variant="body2">
                    Aucun point défini. Cliquez sur "Ajouter un point" pour commencer.
                  </Typography>
                </Alert>
              )}
            </Box>

            {/* CG Arrière (Most rearward) */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', fontSize: '14px' }}>
                📍 Most Rearward CG (Limite arrière)
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <Box sx={{ width: '100%', maxWidth: 350, mb: 1.5 }}>
                  <StyledTextField
                    fullWidth
                    size="small"
                    label="Masse min"
                    type="number"
                    value={data.cgEnvelope?.aftMinWeight || ''}
                    onChange={(e) => updateData('cgEnvelope.aftMinWeight', e.target.value)}
                    placeholder="940"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                    }}
                    helperText="Masse minimale pour la limite CG arrière"
                  />
                </Box>
                <Box sx={{ width: '100%', maxWidth: 350, mb: 1.5 }}>
                  <StyledTextField
                    fullWidth
                    size="small"
                    label="CG arrière constant"
                    type="number"
                    value={data.cgEnvelope?.aftCG || ''}
                    onChange={(e) => updateData('cgEnvelope.aftCG', e.target.value)}
                    placeholder="2.5300"
                    inputProps={{ step: "0.0001" }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                    }}
                    helperText="Position CG arrière (constante)"
                  />
                </Box>
                <Box sx={{ width: '100%', maxWidth: 350 }}>
                  <StyledTextField
                    fullWidth
                    size="small"
                    label="Masse max"
                    type="number"
                    value={data.cgEnvelope?.aftMaxWeight || ''}
                    onChange={(e) => updateData('cgEnvelope.aftMaxWeight', e.target.value)}
                    placeholder="1225"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                    }}
                    helperText="Masse maximale pour la limite CG arrière"
                  />
                </Box>
              </Box>
              
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Le CG arrière est généralement constant. Entrez les masses min et max pour définir la plage.
                </Typography>
              </Alert>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Graphique de l'enveloppe de centrage */}
      <CGEnvelopeChart 
        cgEnvelope={{
          forwardPoints: forwardPoints,
          aftMinWeight: data.cgEnvelope?.aftMinWeight,
          aftCG: data.cgEnvelope?.aftCG,
          aftMaxWeight: data.cgEnvelope?.aftMaxWeight
        }}
        massUnit={getUnitSymbol(units.weight)}
      />
    </Box>
  );
};

export default Step3WeightBalance;