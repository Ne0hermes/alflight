import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Slider,
  Grid,
  Chip,
  Alert,
  TextField,
  Button,
  Divider
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ComposedChart,
  Area
} from 'recharts';
import { PlayArrow as TestIcon } from '@mui/icons-material';

const AbaqueVisualization = ({ 
  extractedPoints = [], 
  axes = {},
  chartImage = null,
  testConditions = null,
  onTestConditionsChange = null,
  interpolationPath = null 
}) => {
  ,
    hasImage: !!chartImage,
    hasTest: !!testConditions
  });

  // État pour les paramètres de test locaux
  const [localTestConditions, setLocalTestConditions] = useState({
    temperature: 15,
    pressure_altitude: 2000,
    mass: 1000,
    wind: 0
  });

  const [showOriginalImage, setShowOriginalImage] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showInterpolation, setShowInterpolation] = useState(false);
  const [interpolatedResult, setInterpolatedResult] = useState(null);

  // Utiliser les conditions de test passées ou les locales
  const activeTestConditions = testConditions || localTestConditions;

  // Grouper les points par courbes (par exemple par altitude)
  const groupedData = useMemo(() => {
    if (!extractedPoints || extractedPoints.length === 0) return {};

    // Grouper par altitude de pression
    const groups = {};
    extractedPoints.forEach(point => {
      const altKey = `${point.pressure_altitude}ft`;
      if (!groups[altKey]) {
        groups[altKey] = [];
      }
      groups[altKey].push(point);
    });

    // Trier les points dans chaque groupe par température
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.temperature - b.temperature);
    });

    .map(k => `${k}: ${groups[k].length} points`));
    return groups;
  }, [extractedPoints]);

  // Grouper aussi par masse pour les courbes secondaires
  const groupedByMass = useMemo(() => {
    if (!extractedPoints || extractedPoints.length === 0) return {};

    const groups = {};
    extractedPoints.forEach(point => {
      const massKey = `${point.mass}kg`;
      if (!groups[massKey]) {
        groups[massKey] = [];
      }
      groups[massKey].push(point);
    });

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.temperature - b.temperature);
    });

    return groups;
  }, [extractedPoints]);

  // Calculer l'interpolation pour les conditions de test
  const calculateInterpolation = () => {
    if (!extractedPoints || extractedPoints.length === 0) return;

    

    // Trouver les 4 points les plus proches (IDW)
    const distances = extractedPoints.map(point => {
      const tempDiff = (point.temperature - activeTestConditions.temperature) / 30;
      const altDiff = (point.pressure_altitude - activeTestConditions.pressure_altitude) / 2000;
      const massDiff = (point.mass - activeTestConditions.mass) / 100;
      const windDiff = (point.wind - activeTestConditions.wind) / 10;
      
      const distance = Math.sqrt(
        tempDiff * tempDiff + 
        altDiff * altDiff + 
        massDiff * massDiff + 
        windDiff * windDiff
      
      return { point, distance };
    });

    distances.sort((a, b) => a.distance - b.distance);
    const nearestPoints = distances.slice(0, 4);

    // Interpolation IDW
    let totalWeight = 0;
    let weightedSum = 0;

    nearestPoints.forEach(({ point, distance }) => {
      const weight = 1 / (distance + 0.001);
      totalWeight += weight;
      weightedSum += point.distance * weight;
    });

    const interpolatedDistance = Math.round(weightedSum / totalWeight);
    
    setInterpolatedResult({
      distance: interpolatedDistance,
      nearestPoints: nearestPoints.map(p => p.point),
      confidence: Math.round((1 - nearestPoints[0].distance) * 100)
    });

    
    setShowInterpolation(true);
  };

  // Générer les couleurs pour les courbes
  const getColor = (index, total) => {
    const hue = (index * 360) / total;
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Préparer les données pour le graphique principal
  const chartData = useMemo(() => {
    const allPoints = [];
    
    // Ajouter tous les points avec leurs groupes
    Object.entries(groupedData).forEach(([altitude, points]) => {
      points.forEach(point => {
        allPoints.push({
          ...point,
          altitudeGroup: altitude,
          massGroup: `${point.mass}kg`
        });
      });
    });

    return allPoints.sort((a, b) => a.temperature - b.temperature);
  }, [groupedData]);

  // Domaines pour les axes
  const xDomain = axes.temperature ? 
    [axes.temperature.min, axes.temperature.max] : 
    [-15, 45];
  
  const yDomain = axes.distance ? 
    [axes.distance.min, axes.distance.max] : 
    [150, 1850];

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          🎯 Reproduction de l'Abaque Original
        </Typography>
        
        {/* Contrôles */}
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid item>
            <FormControlLabel
              control={
                <Switch 
                  checked={showOriginalImage} 
                  onChange={(e) => setShowOriginalImage(e.target.checked)}
                  disabled={!chartImage}
                />
              }
              label="Image originale"
            />
          </Grid>
          <Grid item>
            <FormControlLabel
              control={
                <Switch 
                  checked={showGrid} 
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
              }
              label="Grille"
            />
          </Grid>
          <Grid item>
            <FormControlLabel
              control={
                <Switch 
                  checked={showInterpolation} 
                  onChange={(e) => setShowInterpolation(e.target.checked)}
                />
              }
              label="Trajectoire test"
            />
          </Grid>
        </Grid>

        {/* Légende des courbes */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Courbes d'altitude détectées:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Object.keys(groupedData).map((altitude, index) => (
              <Chip
                key={altitude}
                label={`${altitude} (${groupedData[altitude].length} pts)`}
                size="small"
                style={{
                  backgroundColor: getColor(index, Object.keys(groupedData).length),
                  color: 'white'
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>

      {/* Zone de visualisation principale */}
      <Box sx={{ position: 'relative', width: '100%', height: 500 }}>
        {/* Image originale en arrière-plan */}
        {showOriginalImage && chartImage && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.3,
              backgroundImage: `url(${chartImage})`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              pointerEvents: 'none',
              zIndex: 0
            }}
          />
        )}

        {/* Graphique principal */}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 50, bottom: 60 }}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
            
            <XAxis 
              dataKey="temperature"
              domain={xDomain}
              type="number"
              label={{ 
                value: 'Température (°C)', 
                position: 'insideBottom', 
                offset: -10 
              }}
              ticks={Array.from(
                { length: (xDomain[1] - xDomain[0]) / 5 + 1 }, 
                (_, i) => xDomain[0] + i * 5
              )}
            />
            
            <YAxis 
              domain={yDomain}
              type="number"
              label={{ 
                value: 'Distance (m)', 
                angle: -90, 
                position: 'insideLeft' 
              }}
              ticks={Array.from(
                { length: (yDomain[1] - yDomain[0]) / 100 + 1 }, 
                (_, i) => yDomain[0] + i * 100
              )}
            />
            
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const data = payload[0].payload;
                  return (
                    <Paper sx={{ p: 1 }}>
                      <Typography variant="caption" display="block">
                        Temp: {data.temperature}°C
                      </Typography>
                      <Typography variant="caption" display="block">
                        Distance: {data.distance}m
                      </Typography>
                      <Typography variant="caption" display="block">
                        Alt: {data.pressure_altitude}ft
                      </Typography>
                      <Typography variant="caption" display="block">
                        Masse: {data.mass}kg
                      </Typography>
                      <Typography variant="caption" display="block">
                        Vent: {data.wind}kt
                      </Typography>
                    </Paper>
                  );
                }
                return null;
              }}
            />
            
            <Legend />

            {/* Tracer une ligne pour chaque groupe d'altitude */}
            {Object.entries(groupedData).map(([altitude, points], index) => (
              <Line
                key={altitude}
                data={points}
                dataKey="distance"
                stroke={getColor(index, Object.keys(groupedData).length)}
                strokeWidth={2}
                name={altitude}
                dot={{ r: 3 }}
                connectNulls
                type="monotone"
              />
            ))}

            {/* Points d'interpolation si test actif */}
            {showInterpolation && interpolatedResult && (
              <>
                {/* Ligne horizontale pour la température de test */}
                <ReferenceLine 
                  x={activeTestConditions.temperature} 
                  stroke="red" 
                  strokeDasharray="5 5"
                  label="Test Temp"
                />
                
                {/* Ligne horizontale pour le résultat */}
                <ReferenceLine 
                  y={interpolatedResult.distance} 
                  stroke="red" 
                  strokeDasharray="5 5"
                  label={`Résultat: ${interpolatedResult.distance}m`}
                />

                {/* Points utilisés pour l'interpolation */}
                <Scatter
                  data={interpolatedResult.nearestPoints}
                  fill="red"
                  shape="star"
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Panneau de test */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          🧪 Test d'Interpolation
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={3}>
            <TextField
              label="Température (°C)"
              type="number"
              size="small"
              fullWidth
              value={activeTestConditions.temperature}
              onChange={(e) => {
                const newConditions = {
                  ...activeTestConditions,
                  temperature: parseFloat(e.target.value) || 0
                };
                if (onTestConditionsChange) {
                  onTestConditionsChange(newConditions);
                } else {
                  setLocalTestConditions(newConditions);
                }
              }}
            />
          </Grid>
          <Grid item xs={3}>
            <TextField
              label="Altitude (ft)"
              type="number"
              size="small"
              fullWidth
              value={activeTestConditions.pressure_altitude}
              onChange={(e) => {
                const newConditions = {
                  ...activeTestConditions,
                  pressure_altitude: parseFloat(e.target.value) || 0
                };
                if (onTestConditionsChange) {
                  onTestConditionsChange(newConditions);
                } else {
                  setLocalTestConditions(newConditions);
                }
              }}
            />
          </Grid>
          <Grid item xs={3}>
            <TextField
              label="Masse (kg)"
              type="number"
              size="small"
              fullWidth
              value={activeTestConditions.mass}
              onChange={(e) => {
                const newConditions = {
                  ...activeTestConditions,
                  mass: parseFloat(e.target.value) || 0
                };
                if (onTestConditionsChange) {
                  onTestConditionsChange(newConditions);
                } else {
                  setLocalTestConditions(newConditions);
                }
              }}
            />
          </Grid>
          <Grid item xs={3}>
            <TextField
              label="Vent (kt)"
              type="number"
              size="small"
              fullWidth
              value={activeTestConditions.wind}
              onChange={(e) => {
                const newConditions = {
                  ...activeTestConditions,
                  wind: parseFloat(e.target.value) || 0
                };
                if (onTestConditionsChange) {
                  onTestConditionsChange(newConditions);
                } else {
                  setLocalTestConditions(newConditions);
                }
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              startIcon={<TestIcon />}
              onClick={calculateInterpolation}
              fullWidth
            >
              Calculer l'Interpolation
            </Button>
          </Grid>
        </Grid>

        {/* Résultat de l'interpolation */}
        {interpolatedResult && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Résultat de l'interpolation:
            </Typography>
            <Typography variant="body2">
              Distance prédite: <strong>{interpolatedResult.distance}m</strong>
            </Typography>
            <Typography variant="caption" display="block">
              Confiance: {interpolatedResult.confidence}%
            </Typography>
            <Typography variant="caption" display="block">
              Basé sur {interpolatedResult.nearestPoints.length} points voisins
            </Typography>
          </Alert>
        )}
      </Box>

      {/* Informations */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="caption">
          Cette visualisation reproduit l'abaque original avec {extractedPoints.length} points extraits.
          Les courbes représentent différentes altitudes de pression.
          Utilisez le panneau de test pour voir la trajectoire d'interpolation.
        </Typography>
      </Alert>
    </Paper>
};

export default AbaqueVisualization;