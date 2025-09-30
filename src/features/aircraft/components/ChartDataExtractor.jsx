import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Chip,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  TrendingUp as ChartIcon,
  Info as InfoIcon,
  Calculate as CalculateIcon,
  Clear as ClearIcon
} from '@mui/icons-material';

const ChartDataExtractor = ({ 
  chartImage, 
  chartType = 'performance',
  onDataExtracted,
  existingData = null
}) => {
  // Types de graphiques disponibles
  const chartTypes = {
    takeoff: {
      label: 'Décollage',
      parameters: ['altitude', 'temperature', 'weight'],
      outputs: ['groundRoll', 'distance50ft']
    },
    landing: {
      label: 'Atterrissage',
      parameters: ['altitude', 'temperature', 'weight', 'flaps'],
      outputs: ['groundRoll', 'totalDistance']
    },
    climb: {
      label: 'Montée',
      parameters: ['altitude', 'temperature', 'weight'],
      outputs: ['climbRate', 'climbSpeed']
    },
    cruise: {
      label: 'Croisière',
      parameters: ['altitude', 'rpm', 'temperature'],
      outputs: ['speed', 'fuelFlow']
    },
    range: {
      label: 'Autonomie',
      parameters: ['altitude', 'power', 'weight'],
      outputs: ['range', 'endurance']
    }
  };

  // S'assurer que le type de graphique initial est valide
  const initialChartType = chartTypes[chartType] ? chartType : 'takeoff';
  
  const [selectedChartType, setSelectedChartType] = useState(initialChartType);
  const [dataPoints, setDataPoints] = useState(existingData || []);
  const [currentPoint, setCurrentPoint] = useState({});
  const [interpolationMethod, setInterpolationMethod] = useState('linear');
  const [showInterpolated, setShowInterpolated] = useState(false);

  // Ajouter un point de données
  const addDataPoint = () => {
    // Vérifier qu'au moins un champ a une valeur
    const hasAnyValue = Object.values(currentPoint).some(value => 
      value !== undefined && value !== null && value !== ''
    );
    
    if (!hasAnyValue) {
      alert('Veuillez remplir au moins un champ avant d\'ajouter le point');
      return;
    }
    
    // Créer le nouveau point en conservant les valeurs null pour les champs vides
    const newPoint = {
      id: Date.now(),
      isManual: true
    };
    
    // Ajouter tous les paramètres et outputs, avec null pour les champs vides
    [...(chartTypes[selectedChartType]?.parameters || []), 
     ...(chartTypes[selectedChartType]?.outputs || [])].forEach(field => {
      newPoint[field] = currentPoint[field] !== undefined ? currentPoint[field] : null;
    });
    
    setDataPoints([...dataPoints, newPoint]);
    setCurrentPoint({});
  };

  // Supprimer un point
  const deleteDataPoint = (id) => {
    setDataPoints(dataPoints.filter(point => point.id !== id));
  };

  // Interpoler entre les points
  const interpolateData = () => {
    if (dataPoints.length < 2) {
      alert('Il faut au moins 2 points pour interpoler');
      return;
    }

    const interpolated = [];
    const sortedPoints = [...dataPoints].sort((a, b) => {
      const firstParam = chartTypes[selectedChartType]?.parameters?.[0];
      return a[firstParam] - b[firstParam];
    });

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const p1 = sortedPoints[i];
      const p2 = sortedPoints[i + 1];
      
      // Ajouter le point original
      interpolated.push(p1);
      
      // Calculer les points intermédiaires
      const steps = 5; // Nombre de points intermédiaires
      for (let j = 1; j < steps; j++) {
        const ratio = j / steps;
        const interpolatedPoint = { 
          id: Date.now() + j,
          isInterpolated: true 
        };
        
        // Interpoler chaque paramètre et sortie
        [...(chartTypes[selectedChartType]?.parameters || []), ...(chartTypes[selectedChartType]?.outputs || [])].forEach(key => {
          if (p1[key] !== undefined && p2[key] !== undefined) {
            if (interpolationMethod === 'linear') {
              interpolatedPoint[key] = p1[key] + (p2[key] - p1[key]) * ratio;
            } else if (interpolationMethod === 'cubic') {
              // Interpolation cubique simplifiée
              const t = ratio;
              const t2 = t * t;
              const t3 = t2 * t;
              interpolatedPoint[key] = p1[key] * (2*t3 - 3*t2 + 1) + 
                                       p2[key] * (-2*t3 + 3*t2);
            }
            interpolatedPoint[key] = Math.round(interpolatedPoint[key] * 100) / 100;
          }
        });
        
        interpolated.push(interpolatedPoint);
      }
    }
    
    // Ajouter le dernier point
    interpolated.push(sortedPoints[sortedPoints.length - 1]);
    
    setDataPoints(interpolated);
    setShowInterpolated(true);
  };

  // Supprimer les points interpolés
  const removeInterpolatedPoints = () => {
    const manualPointsOnly = dataPoints.filter(point => !point.isInterpolated);
    setDataPoints(manualPointsOnly);
    setShowInterpolated(false);
  };

  // Sauvegarder les données
  const saveData = () => {
    const chartData = {
      type: selectedChartType,
      chartType: chartTypes[selectedChartType]?.label || selectedChartType,
      dataPoints: dataPoints,
      interpolationMethod: interpolationMethod,
      parameters: chartTypes[selectedChartType]?.parameters || [],
      outputs: chartTypes[selectedChartType]?.outputs || [],
      extractedAt: new Date().toISOString()
    };
    
    if (onDataExtracted) {
      onDataExtracted(chartData);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          <ChartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Extraction de données d'abaque
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            1. Sélectionnez le type de graphique
            <br />
            2. Entrez les points de référence lus sur l'abaque
            <br />
            3. Le système interpolera automatiquement entre les points
          </Typography>
        </Alert>

        {/* Sélection du type de graphique */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Type de graphique</InputLabel>
              <Select
                value={selectedChartType}
                onChange={(e) => setSelectedChartType(e.target.value)}
                label="Type de graphique"
              >
                {Object.entries(chartTypes).map(([key, config]) => (
                  <MenuItem key={key} value={key}>
                    {config.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Méthode d'interpolation</InputLabel>
              <Select
                value={interpolationMethod}
                onChange={(e) => setInterpolationMethod(e.target.value)}
                label="Méthode d'interpolation"
              >
                <MenuItem value="linear">Linéaire</MenuItem>
                <MenuItem value="cubic">Cubique</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Affichage de l'image si fournie */}
        {chartImage && (
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <img 
              src={chartImage} 
              alt="Graphique à analyser"
              style={{ 
                maxWidth: '100%', 
                maxHeight: '400px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </Box>
        )}

        {/* Formulaire d'ajout de points */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Ajouter un point de données</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {/* Paramètres d'entrée */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Conditions (axe X)
                </Typography>
              </Grid>
              {chartTypes[selectedChartType]?.parameters?.map(param => (
                <Grid item xs={12} sm={6} md={3} key={param}>
                  <TextField
                    fullWidth
                    label={param.charAt(0).toUpperCase() + param.slice(1)}
                    type="number"
                    value={currentPoint[param] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCurrentPoint({
                        ...currentPoint,
                        [param]: value === '' ? undefined : parseFloat(value)
                      });
                    }}
                    size="small"
                  />
                </Grid>
              ))}
              
              {/* Valeurs de sortie */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="secondary" gutterBottom>
                  Résultats (axe Y)
                </Typography>
              </Grid>
              {chartTypes[selectedChartType]?.outputs?.map(output => (
                <Grid item xs={12} sm={6} md={3} key={output}>
                  <TextField
                    fullWidth
                    label={output.charAt(0).toUpperCase() + output.slice(1)}
                    type="number"
                    value={currentPoint[output] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCurrentPoint({
                        ...currentPoint,
                        [output]: value === '' ? undefined : parseFloat(value)
                      });
                    }}
                    size="small"
                  />
                </Grid>
              ))}
              
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={addDataPoint}
                  disabled={Object.keys(currentPoint).length === 0}
                >
                  Ajouter le point
                </Button>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Tableau des points extraits */}
        {dataPoints.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">
                Points extraits ({dataPoints.length})
                {showInterpolated && (
                  <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                    ({dataPoints.filter(p => !p.isInterpolated).length} manuels, {dataPoints.filter(p => p.isInterpolated).length} interpolés)
                  </Typography>
                )}
              </Typography>
              <Box>
                {showInterpolated && (
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<ClearIcon />}
                    onClick={removeInterpolatedPoints}
                    sx={{ mr: 1 }}
                  >
                    Supprimer interpolation
                  </Button>
                )}
                <Button
                  variant="outlined"
                  startIcon={<CalculateIcon />}
                  onClick={interpolateData}
                  sx={{ mr: 1 }}
                  disabled={dataPoints.length < 2}
                >
                  Interpoler
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<SaveIcon />}
                  onClick={saveData}
                >
                  Sauvegarder
                </Button>
              </Box>
            </Box>
            
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {chartTypes[selectedChartType]?.parameters?.map(param => (
                      <TableCell key={param}>
                        {param.charAt(0).toUpperCase() + param.slice(1)}
                      </TableCell>
                    ))}
                    {chartTypes[selectedChartType]?.outputs?.map(output => (
                      <TableCell key={output}>
                        {output.charAt(0).toUpperCase() + output.slice(1)}
                      </TableCell>
                    ))}
                    <TableCell>Type</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dataPoints.map((point) => (
                    <TableRow 
                      key={point.id}
                      sx={{ 
                        backgroundColor: point.isInterpolated ? '#f5f5f5' : 'white'
                      }}
                    >
                      {chartTypes[selectedChartType]?.parameters?.map(param => (
                        <TableCell key={param}>
                          {point[param] !== null && point[param] !== undefined ? point[param] : '-'}
                        </TableCell>
                      ))}
                      {chartTypes[selectedChartType]?.outputs?.map(output => (
                        <TableCell key={output}>
                          {point[output] !== null && point[output] !== undefined ? point[output] : '-'}
                        </TableCell>
                      ))}
                      <TableCell>
                        {point.isInterpolated ? (
                          <Chip label="Interpolé" size="small" color="info" />
                        ) : (
                          <Chip label="Manuel" size="small" color="success" />
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => deleteDataPoint(point.id)}
                          disabled={point.isInterpolated}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ChartDataExtractor;