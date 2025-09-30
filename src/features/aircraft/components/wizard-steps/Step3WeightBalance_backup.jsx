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
  Divider
} from '@mui/material';
import { 
  Scale as ScaleIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useUnitsStore, unitsSelectors } from '@core/stores/unitsStore';
import { convertValue, getUnitSymbol } from '@utils/unitConversions';

const Step3WeightBalance = ({ data, updateData, errors = {} }) => {
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
  }, [units, data, previousUnits, forwardPoints, additionalSeats, baggageCompartments]);

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
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 600,
            color: 'text.primary',
            mb: 1
          }}
        >
          Masse et centrage
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'text.secondary',
            fontSize: '1rem'
          }}
        >
          Renseignez les données de masse et centrage de votre appareil
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
          <InfoIcon sx={{ fontSize: 20, verticalAlign: 'middle', mr: 1 }} />
          Informations importantes
        </Typography>
        Ces données sont essentielles pour calculer le centrage de votre avion avant chaque vol.
        Référez-vous au manuel de vol (POH) pour obtenir les valeurs exactes.
      </Alert>

      {/* Masses et bras de levier regroupés */}
      
      {/* Masse à vide */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'grey.50'
        }}
      >
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <ScaleIcon color="primary" />
          Masse à vide
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Masse à vide *"
              type="number"
              value={data.weights?.emptyWeight || ''}
              onChange={(e) => updateData('weights.emptyWeight', e.target.value)}
              error={!!errors['weights.emptyWeight']}
              helperText={errors['weights.emptyWeight'] || "Masse de l'avion sans carburant ni chargement"}
              required
              InputProps={{
                endAdornment: <InputAdornment position="end">{getUnitSymbol('weight', units)}</InputAdornment>,
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Bras de levier"
              type="number"
              value={data.arms?.empty || ''}
              onChange={(e) => updateData('arms.empty', e.target.value)}
              error={!!errors['arms.empty']}
              helperText="Distance depuis la référence"
              InputProps={{
                endAdornment: <InputAdornment position="end">{getUnitSymbol('armLength', units)}</InputAdornment>,
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Carburant */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'blue.50'
        }}
      >
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <ScaleIcon color="primary" />
          Carburant
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Capacité maximale (importée)"
              type="number"
              value={data.fuelCapacity || ''}
              disabled
              helperText="✓ Valeur importée depuis les informations générales (Section 2)"
              InputProps={{
                readOnly: true,
                endAdornment: <InputAdornment position="end">{getUnitSymbol('fuel', units)}</InputAdornment>,
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
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Bras de levier carburant"
              type="number"
              value={data.arms?.fuelMain || ''}
              onChange={(e) => updateData('arms.fuelMain', e.target.value)}
              error={!!errors['arms.fuelMain']}
              helperText="Centre de gravité du réservoir"
              InputProps={{
                endAdornment: <InputAdornment position="end">{getUnitSymbol('armLength', units)}</InputAdornment>,
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Sièges */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 2
        }}>
          <Typography 
            variant="h6" 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <ScaleIcon color="primary" />
            Sièges (bras de levier)
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={addSeat}
          >
            Ajouter un siège
          </Button>
        </Box>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Sièges avant (Pilote + Copilote)"
              type="number"
              value={data.arms?.frontSeats || ''}
              onChange={(e) => updateData('arms.frontSeats', e.target.value)}
              error={!!errors['arms.frontSeats']}
              helperText="Station des sièges avant"
              InputProps={{
                endAdornment: <InputAdornment position="end">{getUnitSymbol('armLength', units)}</InputAdornment>,
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Sièges arrière (Rangée 2)"
              type="number"
              value={data.arms?.rearSeats || ''}
              onChange={(e) => updateData('arms.rearSeats', e.target.value)}
              error={!!errors['arms.rearSeats']}
              helperText="Station des sièges arrière"
              InputProps={{
                endAdornment: <InputAdornment position="end">{getUnitSymbol('armLength', units)}</InputAdornment>,
              }}
            />
          </Grid>
          
          {/* Sièges supplémentaires */}
          {additionalSeats.map((seat) => (
            <React.Fragment key={seat.id}>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  label="Nom du siège"
                  value={seat.name}
                  onChange={(e) => updateSeat(seat.id, 'name', e.target.value)}
                  placeholder="Ex: Rangée 3, Siège central"
                />
              </Grid>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  label="Bras de levier"
                  type="number"
                  value={seat.arm}
                  onChange={(e) => updateSeat(seat.id, 'arm', e.target.value)}
                  placeholder="Station du siège"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{getUnitSymbol('armLength', units)}</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <IconButton
                  color="error"
                  onClick={() => removeSeat(seat.id)}
                  sx={{ mt: 1 }}
                >
                  <DeleteIcon />
                </IconButton>
              </Grid>
            </React.Fragment>
          ))}
        </Grid>
        
        {additionalSeats.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Les sièges supplémentaires permettent de gérer les configurations spéciales (6+ places, sièges club, etc.)
          </Typography>
        )}
      </Paper>

      {/* Compartiments bagages dynamiques */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3,
          border: '1px solid',
          borderColor: 'warning.main',
          bgcolor: 'warning.50'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <ScaleIcon color="warning" />
            Compartiments bagages
          </Typography>
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
          <Grid container spacing={2}>
            {baggageCompartments.map((compartment) => (
              <React.Fragment key={compartment.id}>
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Nom du compartiment"
                    value={compartment.name}
                    onChange={(e) => updateBaggageCompartment(compartment.id, 'name', e.target.value)}
                    placeholder="Ex: Soute avant"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Bras de levier"
                    type="number"
                    value={compartment.arm}
                    onChange={(e) => updateBaggageCompartment(compartment.id, 'arm', e.target.value)}
                    placeholder="Station du compartiment"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{getUnitSymbol('armLength', units)}</InputAdornment>,
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Masse maximale"
                    type="number"
                    value={compartment.maxWeight}
                    onChange={(e) => updateBaggageCompartment(compartment.id, 'maxWeight', e.target.value)}
                    placeholder="Charge max"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{getUnitSymbol('weight', units)}</InputAdornment>,
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  {baggageCompartments.length > 1 && (
                    <IconButton
                      color="error"
                      onClick={() => removeBaggageCompartment(compartment.id)}
                      sx={{ mt: 1 }}
                      title="Supprimer ce compartiment"
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Grid>
              </React.Fragment>
            ))}
          </Grid>
        )}
        
        {baggageCompartments.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Configurez les compartiments bagages de votre appareil (soutes, coffres, etc.)
          </Typography>
        )}
      </Paper>

      {/* Masses limites */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'red.50'
        }}
      >
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <ScaleIcon color="error" />
          Masses limites
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="MTOW *"
              type="number"
              value={data.weights?.mtow || ''}
              onChange={(e) => updateData('weights.mtow', e.target.value)}
              error={!!errors['weights.mtow']}
              helperText={errors['weights.mtow'] || "Masse maximale au décollage"}
              required
              InputProps={{
                endAdornment: <InputAdornment position="end">{getUnitSymbol('weight', units)}</InputAdornment>,
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="MLW"
              type="number"
              value={data.weights?.mlw || ''}
              onChange={(e) => updateData('weights.mlw', e.target.value)}
              error={!!errors['weights.mlw']}
              helperText={errors['weights.mlw'] || "Masse maximale à l'atterrissage"}
              InputProps={{
                endAdornment: <InputAdornment position="end">{getUnitSymbol('weight', units)}</InputAdornment>,
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Masse min au décollage"
              type="number"
              value={data.weights?.minTakeoffWeight || ''}
              onChange={(e) => updateData('weights.minTakeoffWeight', e.target.value)}
              error={!!errors['weights.minTakeoffWeight']}
              helperText={errors['weights.minTakeoffWeight'] || "Masse minimale autorisée au décollage"}
              InputProps={{
                endAdornment: <InputAdornment position="end">{getUnitSymbol('weight', units)}</InputAdornment>,
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Limites de centrage */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <ScaleIcon color="primary" />
          Limites de centrage
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="CG avant minimal"
              type="number"
              value={data.cgLimits?.forward || ''}
              onChange={(e) => updateData('cgLimits.forward', e.target.value)}
              error={!!errors['cgLimits.forward']}
              helperText="Limite avant du centre de gravité"
              required
              InputProps={{
                endAdornment: <InputAdornment position="end">{getUnitSymbol('armLength', units)}</InputAdornment>,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'background.default',
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="CG arrière maximal"
              type="number"
              value={data.cgLimits?.aft || ''}
              onChange={(e) => updateData('cgLimits.aft', e.target.value)}
              error={!!errors['cgLimits.aft']}
              helperText="Limite arrière du centre de gravité"
              required
              InputProps={{
                endAdornment: <InputAdornment position="end">{getUnitSymbol('armLength', units)}</InputAdornment>,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'background.default',
                }
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Enveloppe de centrage */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <ScaleIcon color="primary" />
            Enveloppe de centrage
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={addEnvelopePoint}
            size="small"
          >
            Ajouter un point
          </Button>
        </Box>

        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Définissez les points de l'enveloppe de centrage dans l'ordre (sens horaire ou anti-horaire).
            Consultez le diagramme de centrage dans votre POH.
          </Typography>
        </Alert>

        {envelopePoints.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell>Masse ({getUnitSymbol('weight', units)})</TableCell>
                  <TableCell>CG ({getUnitSymbol('armLength', units)})</TableCell>
                  <TableCell width={60}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {envelopePoints.map((point, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        value={point.name || ''}
                        onChange={(e) => updateEnvelopePoint(index, 'name', e.target.value)}
                        placeholder="Ex: Avant max MTOW"
                        variant="standard"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={point.weight || ''}
                        onChange={(e) => updateEnvelopePoint(index, 'weight', e.target.value)}
                        variant="standard"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={point.cg || ''}
                        onChange={(e) => updateEnvelopePoint(index, 'cg', e.target.value)}
                        variant="standard"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => removeEnvelopePoint(index)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            Aucun point défini. Cliquez sur "Ajouter un point" pour commencer.
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default Step3WeightBalance;