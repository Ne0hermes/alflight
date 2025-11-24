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
  CenterFocusStrong as CenterIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';
import { useUnitsStore, unitsSelectors } from '@core/stores/unitsStore';
import { convertValue, getUnitSymbol } from '@utils/unitConversions';
import CGEnvelopeChart from '../CgEnvelopeChart';
import { StyledTextField } from './FormFieldStyles';

const Step3WeightBalance = ({ data, updateData, errors = {}, onNext, onPrevious }) => {
  const [expandedPanels, setExpandedPanels] = useState({
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
  
  // État pour Most Forward CG - liste de points
  const [forwardCGPoints, setForwardCGPoints] = useState(() => {
    // Si des données existent dans le nouveau format (forwardPoints)
    if (data.cgEnvelope?.forwardPoints && data.cgEnvelope.forwardPoints.length > 0) {
      return data.cgEnvelope.forwardPoints;
    }
    // Sinon, migrer depuis l'ancien format si disponible
    if (data.cgEnvelope?.forwardMinWeight || data.cgEnvelope?.forwardMaxWeight || data.cgEnvelope?.forwardCG) {
      const points = [];
      if (data.cgEnvelope.forwardMinWeight && data.cgEnvelope.forwardCG) {
        points.push({
          id: Date.now() + Math.random(),
          weight: data.cgEnvelope.forwardMinWeight,
          cg: data.cgEnvelope.forwardCG
        });
      }
      if (data.cgEnvelope.forwardMaxWeight && data.cgEnvelope.forwardCG &&
          data.cgEnvelope.forwardMaxWeight !== data.cgEnvelope.forwardMinWeight) {
        points.push({
          id: Date.now() + Math.random() + 1,
          weight: data.cgEnvelope.forwardMaxWeight,
          cg: data.cgEnvelope.forwardCG
        });
      }
      return points;
    }
    return [];
  });

  // État pour Most Rearward CG - formulaire simple (minWeight, maxWeight, un seul CG)
  const [aftCG, setAftCG] = useState({
    minWeight: data.cgEnvelope?.aftMinWeight || '',
    maxWeight: data.cgEnvelope?.aftMaxWeight || '',
    cg: data.cgEnvelope?.aftCG || ''
  });

  // État pour les points intermédiaires de l'enveloppe CG
  const [intermediatePoints, setIntermediatePoints] = useState(data.cgEnvelope?.intermediatePoints || []);
  const [additionalSeats, setAdditionalSeats] = useState(data.additionalSeats || []);
  const [baggageCompartments, setBaggageCompartments] = useState(data.baggageCompartments && data.baggageCompartments.length > 0
      ? data.baggageCompartments
      : [] // Vide par défaut
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
      'weights.mzfw',
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

    // Convertir les points Forward CG
    if (forwardCGPoints.length > 0) {
      const convertedForwardPoints = forwardCGPoints.map(point => ({
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
      setForwardCGPoints(convertedForwardPoints);
      updateData('cgEnvelope.forwardPoints', convertedForwardPoints);
    }

    // Convertir les données Aft CG
    if (aftCG.minWeight || aftCG.maxWeight || aftCG.cg) {
      const convertedAft = {
        minWeight: aftCG.minWeight && previousUnits.weight !== units.weight ?
          Math.round(convertValue(
            aftCG.minWeight,
            previousUnits.weight,
            units.weight,
            'weight'
          ) * 10) / 10 : aftCG.minWeight,
        maxWeight: aftCG.maxWeight && previousUnits.weight !== units.weight ?
          Math.round(convertValue(
            aftCG.maxWeight,
            previousUnits.weight,
            units.weight,
            'weight'
          ) * 10) / 10 : aftCG.maxWeight,
        cg: aftCG.cg && previousUnits.armLength !== units.armLength ?
          Math.round(convertValue(
            aftCG.cg,
            previousUnits.armLength || 'mm',
            units.armLength || 'mm',
            'armLength'
          ) * 10000) / 10000 : aftCG.cg
      };
      setAftCG(convertedAft);
    }

    // Convertir les points intermédiaires
    if (intermediatePoints.length > 0) {
      const convertedPoints = intermediatePoints.map(point => ({
        ...point,
        minWeight: point.minWeight && previousUnits.weight !== units.weight ?
          Math.round(convertValue(
            point.minWeight,
            previousUnits.weight,
            units.weight,
            'weight'
          ) * 10) / 10 : point.minWeight,
        maxWeight: point.maxWeight && previousUnits.weight !== units.weight ?
          Math.round(convertValue(
            point.maxWeight,
            previousUnits.weight,
            units.weight,
            'weight'
          ) * 10) / 10 : point.maxWeight,
        cg: point.cg && previousUnits.armLength !== units.armLength ?
          Math.round(convertValue(
            point.cg,
            previousUnits.armLength || 'mm',
            units.armLength || 'mm',
            'armLength'
          ) * 10000) / 10000 : point.cg
      }));
      setIntermediatePoints(convertedPoints);
      updateData('cgEnvelope.intermediatePoints', convertedPoints);
    }

    setPreviousUnits(units);
  }, [units]);

  // Gestion des points Forward CG
  const addForwardPoint = () => {
    const newPoint = {
      id: Date.now() + Math.random(),
      weight: '',
      cg: ''
    };
    const updatedPoints = [...forwardCGPoints, newPoint];
    setForwardCGPoints(updatedPoints);
    updateData('cgEnvelope.forwardPoints', updatedPoints);
  };

  const removeForwardPoint = (pointId) => {
    const updatedPoints = forwardCGPoints.filter(p => p.id !== pointId);
    setForwardCGPoints(updatedPoints);
    updateData('cgEnvelope.forwardPoints', updatedPoints);
  };

  const updateForwardPoint = (pointId, field, value) => {
    const updatedPoints = forwardCGPoints.map(p =>
      p.id === pointId ? { ...p, [field]: value } : p
    );
    setForwardCGPoints(updatedPoints);
    updateData('cgEnvelope.forwardPoints', updatedPoints);
  };

  // Fonction de validation et sauvegarde Most Rearward CG
  const handleValidateAftCG = () => {
    let finalMinWeight = aftCG.minWeight;
    let finalMaxWeight = aftCG.maxWeight;

    // Auto-complétion intelligente
    if (!finalMinWeight && finalMaxWeight) {
      // Si masse min manquante, utiliser la masse minimale de vol
      finalMinWeight = data.weights?.minTakeoffWeight || '';
    }

    if (!finalMaxWeight && finalMinWeight) {
      // Si masse max manquante, utiliser MTOW
      finalMaxWeight = data.weights?.mtow || '';
    }

    // Mettre à jour l'état local
    const updatedAft = {
      minWeight: finalMinWeight,
      maxWeight: finalMaxWeight,
      cg: aftCG.cg
    };

    setAftCG(updatedAft);

    // Sauvegarder dans les données principales
    updateData('cgEnvelope.aftMinWeight', finalMinWeight);
    updateData('cgEnvelope.aftMaxWeight', finalMaxWeight);
    updateData('cgEnvelope.aftCG', aftCG.cg);

    return true;
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

  // Gestion des points intermédiaires de l'enveloppe CG
  const addIntermediatePoint = () => {
    // Déterminer la masse min du nouveau point (masse max du point précédent)
    let autoMinWeight = '';

    if (intermediatePoints.length > 0) {
      // Si des points intermédiaires existent, prendre la masse max du dernier
      const lastPoint = intermediatePoints[intermediatePoints.length - 1];
      autoMinWeight = lastPoint.maxWeight || '';
    } else if (forwardCGPoints.length > 0) {
      // Si aucun point intermédiaire, prendre la masse du dernier point Forward CG
      const lastForwardPoint = forwardCGPoints[forwardCGPoints.length - 1];
      autoMinWeight = lastForwardPoint.weight || '';
    }

    const newPoint = {
      id: Date.now() + Math.random(),
      minWeight: autoMinWeight,
      maxWeight: '',
      cg: ''
    };
    const updatedPoints = [...intermediatePoints, newPoint];
    setIntermediatePoints(updatedPoints);
    updateData('cgEnvelope.intermediatePoints', updatedPoints);
  };

  const removeIntermediatePoint = (pointId) => {
    const updatedPoints = intermediatePoints.filter(p => p.id !== pointId);
    setIntermediatePoints(updatedPoints);
    updateData('cgEnvelope.intermediatePoints', updatedPoints);
  };

  const updateIntermediatePoint = (pointId, field, value) => {
    const updatedPoints = intermediatePoints.map(p =>
      p.id === pointId ? { ...p, [field]: value } : p
    );
    setIntermediatePoints(updatedPoints);
    updateData('cgEnvelope.intermediatePoints', updatedPoints);
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>


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
            Capacité utilisable
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
                  <Box key={compartment.id} sx={{ width: '100%', maxWidth: 700, mb: index < baggageCompartments.length - 1 ? 2 : 0 }}>
                    {index > 0 && <Divider sx={{ mb: 2 }} />}

                    <Grid container spacing={2}>
                      {/* Nom du compartiment + Bouton supprimer */}
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                          <StyledTextField
                            fullWidth
                            size="small"
                            label="Nom du compartiment"
                            value={compartment.name}
                            onChange={(e) => updateBaggageCompartment(compartment.id, 'name', e.target.value)}
                            placeholder={`Compartiment ${index + 1}`}
                          />
                          {baggageCompartments.length > 0 && (
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
                      </Grid>

                      {/* Bras de levier et Masse max sur la même ligne */}
                      <Grid item xs={12} sm={6}>
                        <StyledTextField
                          fullWidth
                          size="small"
                          label="Bras de levier"
                          type="number"
                          value={compartment.arm}
                          onChange={(e) => updateBaggageCompartment(compartment.id, 'arm', e.target.value)}
                          placeholder="Station"
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <StyledTextField
                          fullWidth
                          size="small"
                          label="Masse max"
                          type="number"
                          value={compartment.maxWeight}
                          onChange={(e) => updateBaggageCompartment(compartment.id, 'maxWeight', e.target.value)}
                          placeholder="Charge max"
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                          }}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Masses limites (fusion de Masse à vide + Masses limites) */}
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
            {/* Masse à vide + Bras de levier sur la même ligne */}
            <Box sx={{ width: '100%', maxWidth: 700, mb: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <StyledTextField
                  fullWidth
                  size="small"
                  label="Masse à vide *"
                  type="number"
                  value={data.weights?.emptyWeight || ''}
                  onChange={(e) => updateData('weights.emptyWeight', e.target.value)}
                  error={!!errors['weights.emptyWeight']}
                  helperText={errors['weights.emptyWeight']}
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                  }}
                />
                <StyledTextField
                  fullWidth
                  size="small"
                  label="Bras de levier"
                  type="number"
                  value={data.arms?.empty || ''}
                  onChange={(e) => updateData('arms.empty', e.target.value)}
                  error={!!errors['arms.empty']}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                récupérer l'information dans le rapport de masse et centrage joint au manex
              </Typography>
            </Box>

            <Box sx={{ width: '100%', maxWidth: 700, mb: 1.5 }}>
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

            <Box sx={{ width: '100%', maxWidth: 700, mb: 1.5 }}>
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

            <Box sx={{ width: '100%', maxWidth: 700, mb: 1.5 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="MZFW"
                type="number"
                value={data.weights?.mzfw || ''}
                onChange={(e) => updateData('weights.mzfw', e.target.value)}
                error={!!errors['weights.mzfw']}
                helperText={errors['weights.mzfw'] || "Maximum Zero Fuel Weight (MZFW)"}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                }}
              />
            </Box>

            <Box sx={{ width: '100%', maxWidth: 700 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="Masse minimale de vol"
                type="number"
                value={data.weights?.minTakeoffWeight || ''}
                onChange={(e) => updateData('weights.minTakeoffWeight', e.target.value)}
                error={!!errors['weights.minTakeoffWeight']}
                helperText={errors['weights.minTakeoffWeight'] || "Masse minimale de vol (Minimum Flight Mass)"}
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
            {/* CG Avant (Most forward) - Liste de points */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', fontSize: '14px' }}>
                📍 Most Forward CG (Limite avant)
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addForwardPoint}
                  sx={{ textTransform: 'none' }}
                >
                  Ajouter un point
                </Button>
              </Box>

              {forwardCGPoints.length === 0 ? (
                <Alert severity="info" sx={{ maxWidth: 700, mx: 'auto' }}>
                  <Typography variant="body2">
                    💡 Aucun point défini. Cliquez sur "Ajouter un point" pour commencer.
                  </Typography>
                </Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                  {forwardCGPoints.map((point, index) => (
                    <Box
                      key={point.id}
                      sx={{
                        width: '100%',
                        maxWidth: 700,
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.paper'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: '13px' }}>
                          Point Forward #{index + 1}
                        </Typography>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeForwardPoint(point.id)}
                          sx={{ ml: 1 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <StyledTextField
                          fullWidth
                          size="small"
                          label="Masse *"
                          type="number"
                          value={point.weight}
                          onChange={(e) => updateForwardPoint(point.id, 'weight', e.target.value)}
                          required
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                          }}
                        />
                        <StyledTextField
                          fullWidth
                          size="small"
                          label="Bras de levier (CG) *"
                          type="number"
                          value={point.cg}
                          onChange={(e) => updateForwardPoint(point.id, 'cg', e.target.value)}
                          inputProps={{ step: "0.0001" }}
                          required
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                          }}
                        />
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              <Alert severity="info" sx={{ mt: 2, maxWidth: 700, mx: 'auto' }}>
                <Typography variant="body2">
                  💡 <strong>Info :</strong> Pour une masse donnée, vous rentrez un bras de levier (CG). Vous pouvez ajouter autant de points que nécessaire pour définir la limite avant de l'enveloppe.
                </Typography>
              </Alert>
            </Box>

            {/* CG Arrière (Most rearward) */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', fontSize: '14px' }}>
                📍 Most Rearward CG (Limite arrière)
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <Box sx={{ width: '100%', maxWidth: 700, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                  {/* Masse min et max sur la même ligne */}
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <StyledTextField
                      fullWidth
                      size="small"
                      label="Masse min *"
                      type="number"
                      value={aftCG.minWeight}
                      onChange={(e) => setAftCG(prev => ({ ...prev, minWeight: e.target.value }))}
                      placeholder={data.weights?.minTakeoffWeight || "940"}
                      required
                      InputProps={{
                        endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                      }}
                      helperText={!aftCG.minWeight && data.weights?.minTakeoffWeight ? "Auto: Masse min de vol" : ""}
                    />
                    <StyledTextField
                      fullWidth
                      size="small"
                      label="Masse max *"
                      type="number"
                      value={aftCG.maxWeight}
                      onChange={(e) => setAftCG(prev => ({ ...prev, maxWeight: e.target.value }))}
                      placeholder={data.weights?.mtow || "1310"}
                      required
                      InputProps={{
                        endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                      }}
                      helperText={!aftCG.maxWeight && data.weights?.mtow ? "Auto: MTOW" : ""}
                    />
                  </Box>

                  {/* Bras de levier (CG position) */}
                  <Box sx={{ mb: 2 }}>
                    <StyledTextField
                      fullWidth
                      size="small"
                      label="Bras de levier (CG arrière) *"
                      type="number"
                      value={aftCG.cg}
                      onChange={(e) => setAftCG(prev => ({ ...prev, cg: e.target.value }))}
                      placeholder="2.5300"
                      inputProps={{ step: "0.0001" }}
                      required
                      InputProps={{
                        endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                      }}
                    />
                  </Box>

                  {/* Bouton de validation */}
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleValidateAftCG}
                      disabled={!aftCG.cg || (!aftCG.minWeight && !aftCG.maxWeight)}
                      sx={{ textTransform: 'none' }}
                    >
                      ✓ Valider Most Rearward CG
                    </Button>
                  </Box>
                </Box>

              </Box>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Graphique de l'enveloppe de centrage */}
      <CGEnvelopeChart
        cgEnvelope={{
          forwardPoints: forwardCGPoints,
          aftMinWeight: data.cgEnvelope?.aftMinWeight || aftCG.minWeight,
          aftCG: data.cgEnvelope?.aftCG || aftCG.cg,
          aftMaxWeight: data.cgEnvelope?.aftMaxWeight || aftCG.maxWeight
        }}
        massUnit={getUnitSymbol(units.weight)}
      />

      {/* Boutons de navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        {/* Bouton Précédent */}
        {onPrevious && (
          <Button
            variant="outlined"
            color="primary"
            size="large"
            onClick={onPrevious}
            startIcon={<ChevronLeftIcon />}
          >
            Précédent
          </Button>
        )}

        {/* Bouton Suivant */}
        {onNext && (
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={onNext}
            endIcon={<ChevronRightIcon />}
          >
            Suivant
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default Step3WeightBalance;