import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Alert,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  Fullscreen,
  GridView,
  ViewColumn,
  ViewModule
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  ComposedChart
} from 'recharts';

const MultiChartVisualization = ({ 
  chartsData = [], // Array of chart data objects
  testConditions = null,
  onTestConditionsChange = null,
  originalImage = null
}) => {
  const [layout, setLayout] = useState('auto'); // 'auto', '1x1', '1x2', '2x2', '2x3'
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showOriginalImage, setShowOriginalImage] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedCharts, setSelectedCharts] = useState([]);

  // Déterminer automatiquement la mise en page basée sur le nombre d'abaques
  useEffect(() => {
    if (layout === 'auto') {
      const count = chartsData.length;
      if (count <= 1) setLayout('1x1');
      else if (count <= 2) setLayout('1x2');
      else if (count <= 4) setLayout('2x2');
      else if (count <= 6) setLayout('2x3');
      else setLayout('3x3');
    }
  }, [chartsData.length, layout]);

  // Calculer les dimensions de la grille
  const gridDimensions = useMemo(() => {
    const layoutMap = {
      '1x1': { cols: 1, rows: 1 },
      '1x2': { cols: 2, rows: 1 },
      '2x1': { cols: 1, rows: 2 },
      '2x2': { cols: 2, rows: 2 },
      '2x3': { cols: 3, rows: 2 },
      '3x3': { cols: 3, rows: 3 }
    };
    return layoutMap[layout === 'auto' ? '2x2' : layout] || { cols: 2, rows: 2 };
  }, [layout]);

  // Générer des couleurs distinctes pour chaque courbe
  const generateColor = (index, total) => {
    const hue = (index * 360) / total;
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Fonction pour regrouper les points par courbes
  const processChartData = (chartData) => {
    if (!chartData || !chartData.extractedPoints) return { groups: {}, allPoints: [] };

    const groups = {};
    const allPoints = [];

    // Grouper par altitude ou autre paramètre dominant
    chartData.extractedPoints.forEach(point => {
      // Identifier la clé de groupement (altitude, masse, etc.)
      const groupKey = chartData.groupBy || 'pressure_altitude';
      const groupValue = point[groupKey];
      const groupLabel = `${groupValue}${chartData.groupUnit || 'ft'}`;

      if (!groups[groupLabel]) {
        groups[groupLabel] = [];
      }
      groups[groupLabel].push(point);
      allPoints.push({
        ...point,
        group: groupLabel
      });
    });

    // Trier les points dans chaque groupe
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const sortKey = chartData.sortBy || 'temperature';
        return a[sortKey] - b[sortKey];
      });
    });

    return { groups, allPoints };
  };

  // Rendu d'un graphique individuel
  const renderChart = (chartData, index) => {
    const { groups, allPoints } = processChartData(chartData);
    const groupKeys = Object.keys(groups);
    
    // Déterminer les domaines des axes
    const xAxis = chartData.axes?.x || { key: 'temperature', label: 'Température (°C)', min: -15, max: 45 };
    const yAxis = chartData.axes?.y || { key: 'distance', label: 'Distance (m)', min: 0, max: 2000 };

    return (
      <Paper 
        key={index} 
        elevation={2} 
        sx={{ 
          p: 2, 
          height: '100%',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Titre du graphique */}
        <Box sx={{ mb: 1 }}>
          <Typography variant="h6" gutterBottom>
            {chartData.title || `Abaque ${index + 1}`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {chartData.description || `${allPoints.length} points - ${groupKeys.length} courbes`}
          </Typography>
        </Box>

        {/* Légende des courbes */}
        {showLegend && (
          <Box sx={{ mb: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {groupKeys.map((key, idx) => (
              <Chip
                key={key}
                label={`${key} (${groups[key].length} pts)`}
                size="small"
                style={{
                  backgroundColor: generateColor(idx, groupKeys.length),
                  color: 'white',
                  fontSize: '0.7rem'
                }}
              />
            ))}
          </Box>
        )}

        {/* Image originale en arrière-plan si demandé */}
        {showOriginalImage && (chartData.originalImage || originalImage) && (
          <Box
            sx={{
              position: 'absolute',
              top: 60,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.3,
              backgroundImage: `url(${chartData.originalImage || originalImage})`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              pointerEvents: 'none',
              zIndex: 1
            }}
          />
        )}

        {/* Graphique */}
        <Box sx={{ position: 'relative', zIndex: 2 }}>
          <ResponsiveContainer width="100%" height={300 * zoom}>
            <ComposedChart
              data={allPoints}
              margin={{ top: 5, right: 5, left: 5, bottom: 25 }}
            >
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
            
            <XAxis 
              dataKey={xAxis.key}
              domain={[xAxis.min, xAxis.max]}
              type="number"
              label={{ 
                value: xAxis.label, 
                position: 'insideBottom', 
                offset: -5,
                style: { fontSize: 10 }
              }}
              tick={{ fontSize: 10 }}
            />
            
            <YAxis 
              domain={[yAxis.min, yAxis.max]}
              type="number"
              label={{ 
                value: yAxis.label, 
                angle: -90, 
                position: 'insideLeft',
                style: { fontSize: 10 }
              }}
              tick={{ fontSize: 10 }}
            />
            
            <ChartTooltip 
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const data = payload[0].payload;
                  return (
                    <Paper sx={{ p: 1 }}>
                      {Object.entries(data).slice(0, 5).map(([key, value]) => (
                        <Typography key={key} variant="caption" display="block">
                          {key}: {typeof value === 'number' ? value.toFixed(1) : value}
                        </Typography>
                      ))}
                    </Paper>
                  );
                }
                return null;
              }}
            />

            {/* Tracer une ligne pour chaque groupe */}
            {groupKeys.map((groupKey, idx) => (
              <Line
                key={groupKey}
                data={groups[groupKey]}
                dataKey={yAxis.key}
                stroke={generateColor(idx, groupKeys.length)}
                strokeWidth={2}
                name={groupKey}
                dot={{ r: 2 }}
                connectNulls
                type="monotone"
              />
            ))}

            {/* Lignes de référence pour les conditions de test */}
            {testConditions && (
              <>
                <ReferenceLine 
                  x={testConditions[xAxis.key]} 
                  stroke="red" 
                  strokeDasharray="5 5"
                  strokeWidth={1}
                />
                <ReferenceLine 
                  y={testConditions[yAxis.key]} 
                  stroke="red" 
                  strokeDasharray="5 5"
                  strokeWidth={1}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
        </Box>
      </Paper>
    );
  };

  return (
    <Box>
      {/* Barre d'outils */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Grid container alignItems="center" spacing={2}>
          <Grid item>
            <Typography variant="h6">
              Visualisation Multi-Abaques ({chartsData.length} graphiques)
            </Typography>
          </Grid>
          
          <Grid item xs />
          
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
                  checked={showLegend} 
                  onChange={(e) => setShowLegend(e.target.checked)}
                />
              }
              label="Légende"
            />
          </Grid>
          
          <Grid item>
            <FormControlLabel
              control={
                <Switch 
                  checked={showOriginalImage} 
                  onChange={(e) => setShowOriginalImage(e.target.checked)}
                />
              }
              label="Image originale"
            />
          </Grid>

          <Grid item>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Zoom -">
                <IconButton 
                  size="small"
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                >
                  <ZoomOut />
                </IconButton>
              </Tooltip>
              
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                {Math.round(zoom * 100)}%
              </Typography>
              
              <Tooltip title="Zoom +">
                <IconButton 
                  size="small"
                  onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                >
                  <ZoomIn />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>

          <Grid item>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="1x1">
                <IconButton 
                  size="small"
                  onClick={() => setLayout('1x1')}
                  color={layout === '1x1' ? 'primary' : 'default'}
                >
                  <Fullscreen />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="1x2">
                <IconButton 
                  size="small"
                  onClick={() => setLayout('1x2')}
                  color={layout === '1x2' ? 'primary' : 'default'}
                >
                  <ViewColumn />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="2x2">
                <IconButton 
                  size="small"
                  onClick={() => setLayout('2x2')}
                  color={layout === '2x2' ? 'primary' : 'default'}
                >
                  <GridView />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="2x3">
                <IconButton 
                  size="small"
                  onClick={() => setLayout('2x3')}
                  color={layout === '2x3' ? 'primary' : 'default'}
                >
                  <ViewModule />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Grille de graphiques */}
      {chartsData.length === 0 ? (
        <Alert severity="info">
          Aucun abaque à afficher. Importez ou créez des abaques pour commencer.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {chartsData.map((chartData, index) => (
            <Grid 
              item 
              key={index}
              xs={12}
              sm={12 / gridDimensions.cols}
              md={12 / gridDimensions.cols}
              lg={12 / gridDimensions.cols}
            >
              {renderChart(chartData, index)}
            </Grid>
          ))}
        </Grid>
      )}

      {/* Panneau d'informations */}
      {chartsData.length > 0 && (
        <Paper elevation={1} sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Statistiques globales
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary">
                Total de points
              </Typography>
              <Typography variant="h6">
                {chartsData.reduce((sum, chart) => 
                  sum + (chart.extractedPoints?.length || 0), 0
                )}
              </Typography>
            </Grid>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary">
                Total de courbes
              </Typography>
              <Typography variant="h6">
                {chartsData.reduce((sum, chart) => {
                  const { groups } = processChartData(chart);
                  return sum + Object.keys(groups).length;
                }, 0)}
              </Typography>
            </Grid>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary">
                Confiance moyenne
              </Typography>
              <Typography variant="h6">
                {Math.round(
                  chartsData.reduce((sum, chart) => 
                    sum + (chart.confidence || 0), 0
                  ) / chartsData.length * 100
                )}%
              </Typography>
            </Grid>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary">
                Mise en page
              </Typography>
              <Typography variant="h6">
                {gridDimensions.cols}×{gridDimensions.rows}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default MultiChartVisualization;