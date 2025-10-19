// src/features/aircraft/components/PerformanceModelManager.jsx

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Tooltip,
  Badge,
  LinearProgress
} from '@mui/material';
import {
  FlightTakeoff,
  FlightLand,
  TrendingUp,
  Speed,
  LocalGasStation,
  Balance,
  Add,
  Edit,
  Delete,
  Visibility,
  Star,
  StarBorder,
  Upload,
  Download,
  Settings,
  CheckCircle,
  Warning,
  Info
} from '@mui/icons-material';
import AircraftPerformanceModel from '../../../models/PerformanceModels';

const PerformanceModelManager = ({ 
  aircraft, 
  performanceModel,
  onModelUpdate,
  onChartSelect 
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedChart, setSelectedChart] = useState(null);
  const [showChartDialog, setShowChartDialog] = useState(false);
  const [model, setModel] = useState(null);

  // Icônes et labels pour chaque catégorie
  const categories = [
    { 
      key: 'takeoff', 
      label: 'Décollage', 
      icon: <FlightTakeoff />,
      color: '#4CAF50',
      description: 'Distances de décollage, roulage et passage 50ft'
    },
    { 
      key: 'landing', 
      label: 'Atterrissage', 
      icon: <FlightLand />,
      color: '#FF9800',
      description: 'Distances d\'atterrissage et de freinage'
    },
    { 
      key: 'climb', 
      label: 'Montée', 
      icon: <TrendingUp />,
      color: '#2196F3',
      description: 'Taux de montée et performances en altitude'
    },
    { 
      key: 'cruise', 
      label: 'Croisière', 
      icon: <Speed />,
      color: '#9C27B0',
      description: 'Vitesses, consommation et autonomie'
    },
    { 
      key: 'fuel', 
      label: 'Carburant', 
      icon: <LocalGasStation />,
      color: '#F44336',
      description: 'Consommation et planification carburant'
    },
    { 
      key: 'weight', 
      label: 'Masse & Centrage', 
      icon: <Balance />,
      color: '#795548',
      description: 'Limites de masse et enveloppe de centrage'
    }
  ];

  useEffect(() => {
    // Initialiser ou charger le modèle
    if (performanceModel) {
      setModel(performanceModel);
    } else if (aircraft?.performanceModel) {
      // Charger depuis les données de l'avion
      const loadedModel = AircraftPerformanceModel.fromJSON(aircraft.performanceModel);
      setModel(loadedModel);
    } else {
      // Créer un nouveau modèle
      const newModel = new AircraftPerformanceModel();
      newModel.metadata.registration = aircraft?.registration || '';
      newModel.metadata.aircraftType = aircraft?.type || '';
      setModel(newModel);
    }
  }, [performanceModel, aircraft]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const getChartsForCategory = (categoryKey) => {
    if (!model) return [];
    return model.getChartsByCategory(categoryKey);
  };

  const handleAddChart = (category) => {
    
    setSelectedChart({ category, action: 'add' });
    setShowChartDialog(true);
  };

  const handleEditChart = (category, chartId) => {
    const chart = model[`${category}Charts`].getChart(chartId);
    setSelectedChart({ category, chartId, chart, action: 'edit' });
    setShowChartDialog(true);
  };

  const handleDeleteChart = (category, chartId) => {
    if (window.confirm('Supprimer cet abaque ?')) {
      model[`${category}Charts`].removeChart(chartId);
      setModel({ ...model });
      if (onModelUpdate) {
        onModelUpdate(model);
      }
    }
  };

  const handleSetDefault = (category, chartId) => {
    model[`${category}Charts`].setDefaultChart(chartId);
    setModel({ ...model });
    if (onModelUpdate) {
      onModelUpdate(model);
    }
  };

  const handleViewChart = (category, chartId) => {
    const chart = model[`${category}Charts`].getChart(chartId);
    if (onChartSelect) {
      onChartSelect(chart, category);
    }
  };

  const exportModel = () => {
    const json = model.toJSON();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance_model_${aircraft?.registration || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderCategoryContent = (category) => {
    const charts = getChartsForCategory(category.key);
    const defaultChartId = model?.[`${category.key}Charts`]?.defaultChart;

    return (
      <Box sx={{ p: 2 }}>
        {/* En-tête de catégorie */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              color: category.color, 
              display: 'flex', 
              alignItems: 'center',
              fontSize: '2rem'
            }}>
              {category.icon}
            </Box>
            <Box>
              <Typography variant="h5" sx={{ color: category.color }}>
                {category.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {category.description}
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleAddChart(category.key)}
            sx={{ bgcolor: category.color }}
          >
            Ajouter un abaque
          </Button>
        </Box>

        {/* Liste des abaques */}
        {charts.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography>Aucun abaque {category.label.toLowerCase()} disponible.</Typography>
            <Typography variant="body2">
              Cliquez sur "Ajouter un abaque" pour importer ou créer un nouvel abaque.
            </Typography>
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {charts.map((chart) => (
              <Grid item xs={12} md={6} lg={4} key={chart.id}>
                <Card 
                  elevation={chart.id === defaultChartId ? 4 : 1}
                  sx={{ 
                    border: chart.id === defaultChartId ? `2px solid ${category.color}` : 'none',
                    position: 'relative'
                  }}
                >
                  {chart.id === defaultChartId && (
                    <Chip
                      label="Par défaut"
                      size="small"
                      icon={<Star />}
                      sx={{ 
                        position: 'absolute', 
                        top: 8, 
                        right: 8,
                        bgcolor: category.color,
                        color: 'white'
                      }}
                    />
                  )}
                  
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {chart.name}
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Conditions:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        {Object.entries(chart.conditions || {}).slice(0, 3).map(([key, value]) => (
                          <Chip 
                            key={key} 
                            label={`${key}: ${value}`} 
                            size="small" 
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>

                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Points de données
                        </Typography>
                        <Typography variant="body2">
                          {chart.dataPoints?.length || 0}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Confiance
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={(chart.confidence || 0) * 100} 
                            sx={{ flexGrow: 1, height: 6 }}
                          />
                          <Typography variant="body2">
                            {Math.round((chart.confidence || 0) * 100)}%
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Source: {chart.source || 'Manuel'} | 
                        Ajouté: {new Date(chart.dateAdded).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </CardContent>

                  <CardActions>
                    <Tooltip title="Visualiser">
                      <IconButton 
                        size="small"
                        onClick={() => handleViewChart(category.key, chart.id)}
                        sx={{ color: category.color }}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="Modifier">
                      <IconButton 
                        size="small"
                        onClick={() => handleEditChart(category.key, chart.id)}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    
                    {chart.id !== defaultChartId && (
                      <Tooltip title="Définir par défaut">
                        <IconButton 
                          size="small"
                          onClick={() => handleSetDefault(category.key, chart.id)}
                        >
                          <StarBorder />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    <Tooltip title="Supprimer">
                      <IconButton 
                        size="small"
                        onClick={() => handleDeleteChart(category.key, chart.id)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Statistiques de la catégorie */}
        {charts.length > 0 && (
          <Paper sx={{ mt: 3, p: 2, bgcolor: 'background.default' }}>
            <Typography variant="subtitle2" gutterBottom>
              Statistiques {category.label}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={3}>
                <Typography variant="caption" color="text.secondary">
                  Total abaques
                </Typography>
                <Typography variant="h6">
                  {charts.length}
                </Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="caption" color="text.secondary">
                  Points totaux
                </Typography>
                <Typography variant="h6">
                  {charts.reduce((sum, c) => sum + (c.dataPoints?.length || 0), 0)}
                </Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="caption" color="text.secondary">
                  Confiance moyenne
                </Typography>
                <Typography variant="h6">
                  {Math.round(
                    charts.reduce((sum, c) => sum + (c.confidence || 0), 0) / charts.length * 100
                  )}%
                </Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="caption" color="text.secondary">
                  Dernière mise à jour
                </Typography>
                <Typography variant="h6">
                  {new Date(model?.metadata?.lastUpdated).toLocaleDateString()}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}
      </Box>

  if (!model) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Chargement du modèle de performances...</Typography>
      </Box>
    );
  }

  return (
    <Paper elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* En-tête avec métadonnées */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Grid container alignItems="center" justifyContent="space-between">
          <Grid item>
            <Typography variant="h5">
              Modèle de Performances - {model.metadata.registration || 'Non défini'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {model.metadata.aircraftType} | Dernière mise à jour: {
                new Date(model.metadata.lastUpdated).toLocaleString()
              }
            </Typography>
          </Grid>
          <Grid item>
            <Button
              startIcon={<Download />}
              onClick={exportModel}
              variant="outlined"
            >
              Exporter
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Onglets de catégories */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {categories.map((category, index) => (
          <Tab
            key={category.key}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {category.icon}
                <span>{category.label}</span>
                <Badge 
                  badgeContent={getChartsForCategory(category.key).length} 
                  color="primary"
                  sx={{ ml: 1 }}
                />
              </Box>
            }
          />
        ))}
      </Tabs>

      {/* Contenu de l'onglet actif */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {renderCategoryContent(categories[activeTab])}
      </Box>

      {/* Dialog pour ajouter/modifier un abaque */}
      <Dialog
        open={showChartDialog}
        onClose={() => setShowChartDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedChart?.action === 'add' ? 'Ajouter' : 'Modifier'} un abaque
        </DialogTitle>
        <DialogContent>
          <Typography>
            Interface d'ajout/modification d'abaque à implémenter
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowChartDialog(false)}>
            Annuler
          </Button>
          <Button variant="contained" onClick={() => setShowChartDialog(false)}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
};

export default PerformanceModelManager;