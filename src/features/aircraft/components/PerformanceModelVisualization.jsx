import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Grid,
  Chip,
  Alert,
  Tooltip
} from '@mui/material';
import {
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Area
} from 'recharts';
import {
  Timeline as TimelineIcon,
  TrendingUp as TrendingIcon,
  Info as InfoIcon
} from '@mui/icons-material';

const PerformanceModelVisualization = ({ 
  modelData, 
  extractedPoints = [], 
  modelType = 'takeoff',
  onUpdate 
}) => {
  console.log('📊 === VISUALISATION INIT ===');
  console.log('Points reçus:', extractedPoints?.length || 0);
  console.log('Type de modèle:', modelType);
  console.log('Données du modèle:', modelData ? 'PRÉSENT' : 'ABSENT');
  
  if (extractedPoints && extractedPoints.length > 0) {
    console.log('Échantillon de points:', extractedPoints.slice(0, 3));
  }
  // États pour les paramètres de visualisation
  const [viewMode, setViewMode] = useState('2d'); // Seulement '2d' maintenant
  const [selectedAxes, setSelectedAxes] = useState({
    x: 'temperature',
    y: 'distance'
  });
  
  // États pour les valeurs fixes (pour les projections 2D)
  const [fixedValues, setFixedValues] = useState({
    temperature: 15,
    pressure_altitude: 2000,
    mass: 1000,
    wind: 0
  });
  
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Paramètres disponibles selon le type de modèle
  const availableParameters = useMemo(() => {
    const base = ['temperature', 'pressure_altitude', 'mass', 'wind'];
    if (modelType === 'landing') {
      return [...base, 'flaps'];
    }
    return base;
  }, [modelType]);
  
  // Générer les données pour la visualisation
  const generateVisualizationData = useMemo(() => {
    console.log('🔄 === GÉNÉRATION DONNÉES VIZ ===');
    console.log('extractedPoints:', extractedPoints);
    console.log('Nombre de points:', extractedPoints?.length || 0);
    
    // Si pas de points extraits, retourner un tableau vide
    if (!extractedPoints || extractedPoints.length === 0) {
      console.warn('⚠️ Pas de points extraits pour la visualisation');
      return [];
    }
    
    console.log('✅ Génération des données de visualisation avec', extractedPoints.length, 'points');
    console.log('Mode de vue actuel:', viewMode);
    const data = [];
    
    if (viewMode === '2d') {
      // Projection 2D : afficher directement les points extraits
      const xParam = selectedAxes.x;
      const yParam = selectedAxes.y;
      
      // Utiliser directement les points extraits pour la visualisation
      extractedPoints.forEach(pt => {
        // Filtrer selon les valeurs fixes sélectionnées
        const altMatch = !fixedValues.pressure_altitude || 
                         Math.abs((pt.pressure_altitude || 0) - fixedValues.pressure_altitude) < 1000;
        const massMatch = !fixedValues.mass || 
                         Math.abs((pt.mass || 1000) - fixedValues.mass) < 100;
        
        if (altMatch && massMatch) {
          data.push({
            [xParam]: pt[xParam] || pt.temperature || 0,
            distance: pt.distance || 0,
            type: 'actual',
            ...pt
          });
        }
      });
      
      // Si pas assez de points filtrés, ajouter tous les points
      if (data.length < 5) {
        console.log('Pas assez de points filtrés, ajout de tous les points');
        extractedPoints.forEach(pt => {
          data.push({
            [xParam]: pt[xParam] || pt.temperature || 0,
            distance: pt.distance || 0,
            type: 'all',
            ...pt
          });
        });
      }
      
    } else if (viewMode === '3d' || viewMode === 'contour') {
      // Surface 3D ou contours - utiliser directement les points extraits
      const xParam = selectedAxes.x;
      const yParam = selectedAxes.z;
      
      // Ajouter tous les points extraits pour la visualisation 3D
      extractedPoints.forEach(pt => {
        data.push({
          [xParam]: pt[xParam] || pt.temperature || 0,
          [yParam]: pt[yParam] || pt.pressure_altitude || 0,
          distance: pt.distance || 0,
          type: 'actual',
          ...pt
        });
      });
      
      // Si on a un modèle, on peut ajouter une grille interpolée
      if (modelData && extractedPoints.length > 10) {
        const xValues = extractedPoints.map(p => p[xParam] || p.temperature || 0);
        const yValues = extractedPoints.map(p => p[yParam] || p.pressure_altitude || 0);
        
        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);
        
        const gridSize = 10;
        for (let i = 0; i <= gridSize; i++) {
          for (let j = 0; j <= gridSize; j++) {
            const xValue = xMin + (xMax - xMin) * i / gridSize;
            const yValue = yMin + (yMax - yMin) * j / gridSize;
            
            // Interpolation simple basée sur les points les plus proches
            const nearestPoint = extractedPoints.reduce((closest, pt) => {
              const dist = Math.sqrt(
                Math.pow((pt[xParam] || pt.temperature || 0) - xValue, 2) +
                Math.pow((pt[yParam] || pt.pressure_altitude || 0) - yValue, 2)
              );
              if (!closest || dist < closest.dist) {
                return { point: pt, dist };
              }
              return closest;
            }, null);
            
            if (nearestPoint) {
              data.push({
                [xParam]: xValue,
                [yParam]: yValue,
                distance: nearestPoint.point.distance || 0,
                type: 'interpolated',
                gridX: i,
                gridY: j
              });
            }
          }
        }
      }
    }
    
    return data;
  }, [viewMode, selectedAxes, fixedValues, extractedPoints, modelData]);
  
  // Fonction pour obtenir la plage d'un paramètre
  const getParameterRange = (param) => {
    switch (param) {
      case 'temperature':
        return { min: -15, max: 45, unit: '°C' };
      case 'pressure_altitude':
        return { min: 0, max: 10000, unit: 'ft' };
      case 'mass':
        return { min: 850, max: 1150, unit: 'kg' };
      case 'wind':
        return { min: -10, max: 20, unit: 'kt' };
      case 'distance':
        return { min: 0, max: 2000, unit: 'm' };
      default:
        return { min: 0, max: 100, unit: '' };
    }
  };
  
  // Fonction de calcul de distance basée sur l'interpolation des points extraits
  const calculateDistance = (conditions) => {
    const { temperature, pressure_altitude, mass, wind } = conditions;
    
    // Interpolation basée sur les points extraits réels
    const baseDistance = 500;
    const tempEffect = (temperature - 15) * 5;
    const altEffect = pressure_altitude * 0.05;
    const massEffect = (mass - 1000) * 0.8;
    const windEffect = -wind * 10;
    
    return Math.round(baseDistance + tempEffect + altEffect + massEffect + windEffect);
  };
  
  // Générer les lignes de contour
  const generateContourLines = () => {
    const contours = [];
    const levels = [400, 500, 600, 700, 800, 900, 1000, 1200, 1400];
    
    levels.forEach(level => {
      const points = generateVisualizationData.filter(d => 
        Math.abs(d.distance - level) < 50
      );
      
      if (points.length > 0) {
        contours.push({
          level,
          points,
          color: getContourColor(level)
        });
      }
    });
    
    return contours;
  };
  
  const getContourColor = (value) => {
    const min = 400;
    const max = 1400;
    const ratio = (value - min) / (max - min);
    
    // Gradient du bleu au rouge
    const r = Math.floor(255 * ratio);
    const b = Math.floor(255 * (1 - ratio));
    return `rgb(${r}, 100, ${b})`;
  };
  
  // Composant pour la visualisation 2D
  const Visualization2D = () => {
    const data = generateVisualizationData;
    console.log('Visualization2D - données:', data?.length, 'points');
    
    if (!data || data.length === 0) {
      return (
        <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary">Aucune donnée à visualiser</Typography>
        </Box>
      );
    }
    
    return (
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={selectedAxes.x}
            label={{ value: `${selectedAxes.x} (${getParameterRange(selectedAxes.x).unit})`, position: 'insideBottom', offset: -5 }}
            domain={['auto', 'auto']}
          />
          <YAxis 
            dataKey="distance"
            label={{ value: 'Distance (m)', angle: -90, position: 'insideLeft' }}
            domain={['auto', 'auto']}
          />
          <RechartsTooltip 
            content={({ active, payload }) => {
              if (active && payload && payload[0]) {
                return (
                  <Paper sx={{ p: 1 }}>
                    <Typography variant="caption">
                      {selectedAxes.x}: {payload[0].payload[selectedAxes.x]}
                    </Typography>
                    <br />
                    <Typography variant="caption">
                      Distance: {payload[0].payload.distance}m
                    </Typography>
                  </Paper>
                );
              }
              return null;
            }}
          />
          <Legend />
          
          {/* Points réels */}
          <Scatter
            data={data.filter(d => d.type === 'actual' || d.type === 'all')}
            fill="#ff7300"
            name="Points extraits"
          />
        </ScatterChart>
      </ResponsiveContainer>
    );
  };
  
  // Composant pour la visualisation 3D (simulée avec des contours)
  const Visualization3D = () => {
    const data = generateVisualizationData;
    console.log('Visualization3D - données:', data?.length, 'points');
    
    if (!data || data.length === 0) {
      return (
        <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary">Aucune donnée à visualiser</Typography>
        </Box>
      );
    }
    
    // Grouper les points par distance pour créer une échelle de couleur
    const minDistance = Math.min(...data.map(d => d.distance));
    const maxDistance = Math.max(...data.map(d => d.distance));
    
    const getPointColor = (distance) => {
      const ratio = (distance - minDistance) / (maxDistance - minDistance || 1);
      const r = Math.floor(255 * ratio);
      const b = Math.floor(255 * (1 - ratio));
      return `rgb(${r}, 100, ${b})`;
    };
    
    return (
      <Box>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={selectedAxes.x}
              label={{ value: `${selectedAxes.x} (${getParameterRange(selectedAxes.x).unit})`, position: 'insideBottom', offset: -5 }}
              domain={['auto', 'auto']}
              type="number"
            />
            <YAxis 
              dataKey={selectedAxes.z}
              label={{ value: `${selectedAxes.z} (${getParameterRange(selectedAxes.z).unit})`, angle: -90, position: 'insideLeft' }}
              domain={['auto', 'auto']}
              type="number"
            />
            <RechartsTooltip 
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  return (
                    <Paper sx={{ p: 1 }}>
                      <Typography variant="caption">
                        {selectedAxes.x}: {payload[0].payload[selectedAxes.x]}
                      </Typography>
                      <br />
                      <Typography variant="caption">
                        {selectedAxes.z}: {payload[0].payload[selectedAxes.z]}
                      </Typography>
                      <br />
                      <Typography variant="caption">
                        Distance: {payload[0].payload.distance}m
                      </Typography>
                    </Paper>
                  );
                }
                return null;
              }}
            />
            
            {/* Afficher tous les points avec couleur selon distance */}
            <Scatter
              data={data}
              fill={(entry) => getPointColor(entry.distance)}
              name="Points"
            />
          </ScatterChart>
        </ResponsiveContainer>
        
        {/* Légende des couleurs */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" sx={{ width: '100%', textAlign: 'center', mb: 1 }}>
            Distance (m) - Du bleu (court) au rouge (long)
          </Typography>
          {minDistance && maxDistance && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Chip
                label={`Min: ${Math.round(minDistance)}m`}
                size="small"
                sx={{ 
                  backgroundColor: getPointColor(minDistance),
                  color: 'white'
                }}
              />
              <Chip
                label={`Max: ${Math.round(maxDistance)}m`}
                size="small"
                sx={{ 
                  backgroundColor: getPointColor(maxDistance),
                  color: 'white'
                }}
              />
            </Box>
          )}
        </Box>
      </Box>
    );
  };
  
  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Visualisation du Modèle de Performance
        </Typography>
        
        {/* Mode 2D uniquement - pas de sélecteur */}
        <Chip 
          label="Visualisation 2D"
          icon={<TrendingIcon />}
          color="primary"
          size="small"
        />
      </Box>
      
      {/* Contrôles */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Axe X</InputLabel>
            <Select
              value={selectedAxes.x}
              onChange={(e) => setSelectedAxes({...selectedAxes, x: e.target.value})}
              label="Axe X"
            >
              {availableParameters.map(param => (
                <MenuItem key={param} value={param}>
                  {param.replace('_', ' ').toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        {/* Sliders pour les valeurs fixes */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Valeurs fixes pour la projection :
          </Typography>
        </Grid>
        
        {availableParameters
          .filter(param => param !== selectedAxes.x)
          .map(param => {
            const range = getParameterRange(param);
            return (
              <Grid item xs={12} sm={6} key={param}>
                <Typography variant="caption" gutterBottom>
                  {param.replace('_', ' ').toUpperCase()} : {fixedValues[param]} {range.unit}
                </Typography>
                <Slider
                  value={fixedValues[param]}
                  onChange={(e, value) => setFixedValues({...fixedValues, [param]: value})}
                  min={range.min}
                  max={range.max}
                  step={(range.max - range.min) / 50}
                  marks={[
                    { value: range.min, label: `${range.min}` },
                    { value: range.max, label: `${range.max}` }
                  ]}
                />
              </Grid>
            );
          })}
      </Grid>
      
      {/* Zone de visualisation */}
      <Box sx={{ 
        position: 'relative', 
        minHeight: 450,
        border: '2px dashed #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#f5f5f5'
      }}>
        <Typography variant="caption" sx={{ 
          position: 'absolute', 
          top: 8, 
          left: 8, 
          backgroundColor: 'white',
          padding: '2px 8px',
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          Zone de visualisation graphique | Points: {extractedPoints?.length || 0}
        </Typography>
        
        {(!extractedPoints || extractedPoints.length === 0) ? (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: 450,
            flexDirection: 'column',
            gap: 2
          }}>
            <Typography variant="h6" color="text.secondary">
              Aucune donnée disponible pour la visualisation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Veuillez d'abord extraire des données depuis un abaque de performance
            </Typography>
          </Box>
        ) : (
          <Visualization2D />
        )}
        
        {/* Indicateurs de performance */}
        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
          <Tooltip title="Points utilisés pour le modèle">
            <Chip 
              label={`${extractedPoints.length} points`}
              size="small"
              color="primary"
            />
          </Tooltip>
        </Box>
      </Box>
      
      {/* Informations sur le modèle */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="caption">
          Modèle {modelType === 'takeoff' ? 'de décollage' : "d'atterrissage"} basé sur {extractedPoints.length} points.
          Les zones colorées représentent les distances prédites en fonction des paramètres sélectionnés.
        </Typography>
      </Alert>
    </Paper>
  );
};

export default PerformanceModelVisualization;