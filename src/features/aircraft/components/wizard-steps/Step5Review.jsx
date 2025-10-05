import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Alert,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Flight as FlightIcon,
  Speed as SpeedIcon,
  Scale as ScaleIcon,
  TrendingUp as TrendingUpIcon,
  Timeline as TimelineIcon,
  Balance as BalanceIcon,
  Assignment as AssignmentIcon,
  CloudUpload as CloudUploadIcon,
  Save as SaveIcon,
  Difference as DifferenceIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import CGEnvelopeChart from '../CgEnvelopeChart';
import SpeedLimitationChart from '../SpeedLimitationChart';

const Step5Review = ({ data, setCurrentStep, onSave }) => {
  const [showDifferencesDialog, setShowDifferencesDialog] = useState(false);
  const [submissionMode, setSubmissionMode] = useState(null);
  const [differences, setDifferences] = useState([]);

  // Calculer les différences avec l'avion de base (pour les variantes)
  const calculateVariantDifferences = () => {
    if (!data.baseAircraft) {
      return [];
    }

    const base = data.baseAircraft;
    const current = data;
    const diffs = [];

    // Mappage des champs pour un affichage plus clair avec unités
    const fieldConfig = {
      'registration': { label: 'Immatriculation', unit: '' },
      'model': { label: 'Modèle', unit: '' },
      'manufacturer': { label: 'Constructeur', unit: '' },
      'year': { label: 'Année', unit: '' },
      'mtow': { label: 'Masse max au décollage', unit: 'kg' },
      'emptyWeight': { label: 'Masse à vide', unit: 'kg' },
      'maxFuel': { label: 'Carburant max', unit: 'L' },
      'cruiseSpeed': { label: 'Vitesse de croisière', unit: 'kt' },
      'vne': { label: 'VNE', unit: 'kt' },
      'vs0': { label: 'VS0', unit: 'kt' },
      'vs1': { label: 'VS1', unit: 'kt' },
      'vx': { label: 'VX', unit: 'kt' },
      'vy': { label: 'VY', unit: 'kt' },
      'serviceCeiling': { label: 'Plafond pratique', unit: 'ft' },
      'takeoffDistance': { label: 'Distance de décollage', unit: 'm' },
      'landingDistance': { label: 'Distance d\'atterrissage', unit: 'm' },
      'fuelConsumption': { label: 'Consommation', unit: 'L/h' },
      'range': { label: 'Autonomie', unit: 'nm' },
      'engineType': { label: 'Type de moteur', unit: '' },
      'enginePower': { label: 'Puissance moteur', unit: 'hp' },
      'propType': { label: 'Type d\'hélice', unit: '' }
    };

    // Formater la valeur avec unité
    const formatFieldValue = (value, unit) => {
      if (value === null || value === undefined || value === '') return '-';
      if (unit) return `${value} ${unit}`;
      return value;
    };

    // Comparer les champs principaux
    const compareField = (fieldName) => {
      const config = fieldConfig[fieldName];
      if (!config) return;

      const baseValue = base[fieldName];
      const currentValue = current[fieldName];

      if (baseValue !== currentValue && currentValue !== undefined) {
        diffs.push({
          field: config.label,
          original: formatFieldValue(baseValue, config.unit),
          modified: formatFieldValue(currentValue, config.unit)
        });
      }
    };

    // Comparer tous les champs importants
    Object.keys(fieldConfig).forEach(field => {
      compareField(field);
    });

    return diffs;
  };

  // Calculer les différences si l'avion vient de la communauté
  const calculateDifferences = () => {
    if (!data.isImportedFromCommunity || !data.originalCommunityData) {
      return [];
    }

    const original = data.originalCommunityData;
    const current = data;
    const diffs = [];

    // Fonction récursive pour comparer les objets
    const compareObjects = (obj1, obj2, path = '') => {
      const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

      allKeys.forEach(key => {
        // Ignorer les clés de tracking
        if (['isImportedFromCommunity', 'originalCommunityData', 'communityVersion'].includes(key)) {
          return;
        }

        const newPath = path ? `${path}.${key}` : key;
        const val1 = obj1?.[key];
        const val2 = obj2?.[key];

        if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
          compareObjects(val1, val2, newPath);
        } else if (val1 !== val2) {
          diffs.push({
            field: newPath,
            original: val1,
            modified: val2
          });
        }
      });
    };

    compareObjects(original, current);
    return diffs;
  };

  // Gérer l'enregistrement avec options de soumission
  const handleSave = (saveMode = null) => {
    console.log('🔵 Step5Review - handleSave appelé avec mode:', saveMode);
    console.log('🔵 data.baseAircraft:', data.baseAircraft);
    console.log('🔵 data.isImportedFromCommunity:', data.isImportedFromCommunity);
    console.log('🔵 data.id:', data.id);

    // Si un mode est spécifié directement (pour les variantes)
    if (saveMode) {
      if (saveMode === 'local') {
        handleLocalSave();
      } else if (saveMode === 'community') {
        handleCommunitySubmission();
      }
      return;
    }

    // Si c'est une édition d'un avion existant (a un ID), sauvegarder localement
    if (data.id || data.aircraftId) {
      console.log('🔵 Édition d\'un avion existant, sauvegarde locale');
      handleLocalSave();
      return;
    }

    if (data.isImportedFromCommunity) {
      const diffs = calculateDifferences();
      setDifferences(diffs);
      console.log('🔵 Différences calculées:', diffs.length);

      if (diffs.length > 0) {
        // Des modifications ont été apportées
        console.log('🔵 Affichage du dialog des différences');
        setShowDifferencesDialog(true);
      } else {
        // Pas de modifications, enregistrement local simple
        console.log('🔵 Pas de modifications, enregistrement local');
        handleLocalSave();
      }
    } else {
      // Nouvel avion, proposition directe à la communauté
      console.log('🔵 Nouvel avion, soumission directe');
      handleDirectSubmission();
    }
  };

  const handleLocalSave = () => {
    console.log('🟢 handleLocalSave appelé');
    console.log('🟢 onSave existe?', !!onSave);
    if (onSave) {
      console.log('🟢 Appel de onSave avec mode: local');
      onSave({ mode: 'local', data });
    } else {
      console.error('❌ onSave n\'est pas défini!');
    }
    setShowDifferencesDialog(false);
  };

  const handleCommunitySubmission = () => {
    console.log('🟡 handleCommunitySubmission appelé');
    console.log('🟡 onSave existe?', !!onSave);
    if (onSave) {
      console.log('🟡 Appel de onSave avec mode: community et différences');
      onSave({
        mode: 'community',
        data,
        differences: differences.length > 0 ? differences : null
      });
    } else {
      console.error('❌ onSave n\'est pas défini!');
    }
    setShowDifferencesDialog(false);
  };

  // Gérer la soumission directe pour les nouveaux avions
  const handleDirectSubmission = () => {
    console.log('🟠 handleDirectSubmission appelé');
    console.log('🟠 onSave existe?', !!onSave);
    if (onSave) {
      console.log('🟠 Appel de onSave avec mode: community (nouvel avion)');
      onSave({
        mode: 'community',
        data,
        differences: null
      });
    } else {
      console.error('❌ onSave n\'est pas défini!');
    }
  };

  const formatValue = (value, unit = '') => {
    if (!value) return '-';
    return unit ? `${value} ${unit}` : value;
  };

  const renderSection = (title, icon, stepNumber, items, chart = null) => (
    <Paper 
      elevation={0} 
      sx={{ 
        mb: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden'
      }}
    >
      <Box 
        sx={{ 
          p: 2, 
          bgcolor: 'grey.50',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon}
          <Typography variant="h6" fontWeight={600}>
            {title}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => setCurrentStep(stepNumber)}
        >
          Modifier
        </Button>
      </Box>
      
      <Box sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {items.map((item, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  display: 'block',
                  mb: 0.5
                }}
              >
                {item.label}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {item.value}
              </Typography>
            </Grid>
          ))}
        </Grid>
        {chart && (
          <Box sx={{ mt: 3 }}>
            {chart}
          </Box>
        )}
      </Box>
    </Paper>
  );

  // Préparer les données pour le graphique d'enveloppe CG
  const cgEnvelopeData = {
    forwardPoints: data.cgEnvelope?.forwardPoints || [],
    aftMinWeight: data.cgEnvelope?.aftMinWeight,
    aftCG: data.cgEnvelope?.aftCG,
    aftMaxWeight: data.cgEnvelope?.aftMaxWeight
  };

  // Préparer les données pour le graphique de vitesses
  const speedsData = {
    vso: data.speeds?.vso,
    vs1: data.speeds?.vs1,
    vfeLdg: data.speeds?.vfeLdg,
    vfeTO: data.speeds?.vfeTO,
    vno: data.speeds?.vno,
    vne: data.speeds?.vne,
    vx: data.speeds?.vx,
    vy: data.speeds?.vy,
    vglide: data.speeds?.vglide,
    voRanges: data.speeds?.voRanges || []
  };

  // Vérifier si nous avons des données de vitesses
  const hasSpeedData = speedsData.vso || speedsData.vs1 || speedsData.vno || speedsData.vne;
  
  // Vérifier si nous avons des données CG
  const hasCGData = (cgEnvelopeData.forwardPoints && cgEnvelopeData.forwardPoints.length > 0) || 
                    cgEnvelopeData.aftCG;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 600,
            color: 'text.primary',
            mb: 1
          }}
        >
          Récapitulatif de votre avion
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'text.secondary',
            fontSize: '1rem'
          }}
        >
          Vérifiez toutes les informations avant d'enregistrer
        </Typography>
      </Box>

      {data.isImportedFromCommunity && (
        <Alert
          severity="info"
          icon={<CloudUploadIcon />}
          sx={{ mb: 4 }}
        >
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
            Avion importé de la base communautaire
          </Typography>
          <Typography variant="body2">
            Cet avion a été importé de la base de données communautaire (version {data.communityVersion || 1}).
            Vérifiez les informations et apportez vos modifications si nécessaire.
            À la fin, vous pourrez choisir de soumettre vos modifications à la communauté ou de les conserver localement.
          </Typography>
        </Alert>
      )}

      {!data.isImportedFromCommunity && (
        <Alert
          severity="success"
          icon={<CheckCircleIcon />}
          sx={{ mb: 4 }}
        >
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
            Nouvelle configuration
          </Typography>
          <Typography variant="body2">
            Cette configuration sera proposée à la communauté pour validation.
            Une fois approuvée (10 votes positifs), elle sera disponible pour tous les utilisateurs.
          </Typography>
        </Alert>
      )}

      {/* Informations de base */}
      {renderSection(
        'Informations générales',
        <FlightIcon color="primary" />,
        2,
        [
          { label: 'Immatriculation', value: data.registration || '-' },
          { label: 'Modèle', value: data.model || '-' },
          { label: 'Type de moteur', value: data.engineType || '-' },
          { label: 'Catégorie de turbulence', value: data.wakeTurbulenceCategory || '-' },
          { label: 'Type de carburant', value: data.fuelType || '-' },
          { label: 'Capacité carburant', value: formatValue(data.fuelCapacity, data.units?.fuel === 'gal' ? 'gal' : 'L') },
          { label: 'Consommation', value: formatValue(data.fuelConsumption, data.units?.fuel === 'gal' ? 'gal/h' : 'L/h') },
          { label: 'Vitesse de croisière', value: formatValue(data.cruiseSpeedKt, 'kt') },
          { label: 'Base Factor', value: data.baseFactor || '-' }
        ]
      )}

      {/* Vitesses avec graphique intégré */}
      {renderSection(
        'Vitesses caractéristiques',
        <SpeedIcon color="primary" />,
        3,
        [
          { label: 'VSO', value: formatValue(data.speeds?.vso, 'kt') },
          { label: 'VS1', value: formatValue(data.speeds?.vs1, 'kt') },
          { label: 'VFE Landing', value: formatValue(data.speeds?.vfeLdg, 'kt') },
          { label: 'VFE Takeoff', value: formatValue(data.speeds?.vfeTO, 'kt') },
          { label: 'VNO', value: formatValue(data.speeds?.vno, 'kt') },
          { label: 'VNE', value: formatValue(data.speeds?.vne, 'kt') },
          { label: 'VA', value: formatValue(data.speeds?.va, 'kt') },
          { label: 'V Glide', value: formatValue(data.speeds?.vglide, 'kt') }
        ],
        hasSpeedData ? (
          <SpeedLimitationChart speeds={speedsData} />
        ) : null
      )}

      {/* Masse et centrage avec graphique intégré */}
      {renderSection(
        'Masse et centrage',
        <ScaleIcon color="primary" />,
        4,
        [
          { label: 'Masse à vide', value: formatValue(data.weights?.emptyWeight, data.units?.weight === 'lbs' ? 'lbs' : 'kg') },
          { label: 'Bras de levier à vide', value: formatValue(data.arms?.empty, data.units?.armLength || 'mm') },
          { label: 'MTOW', value: formatValue(data.weights?.mtow, data.units?.weight === 'lbs' ? 'lbs' : 'kg') },
          { label: 'MLW', value: formatValue(data.weights?.mlw, data.units?.weight === 'lbs' ? 'lbs' : 'kg') },
          { label: 'MZFW', value: formatValue(data.weights?.mzfw, data.units?.weight === 'lbs' ? 'lbs' : 'kg') },
          { label: 'Carburant max', value: formatValue(data.fuel?.maxCapacity || data.fuelCapacity, data.units?.fuel === 'gal' ? 'gal' : 'L') },
          { label: 'Bras carburant', value: formatValue(data.arms?.fuel, data.units?.armLength || 'mm') },
          { label: 'Bras sièges avant', value: formatValue(data.arms?.frontSeats, data.units?.armLength || 'mm') },
          { label: 'Bras sièges arrière', value: formatValue(data.arms?.rearSeats, data.units?.armLength || 'mm') },
          { label: 'Bras bagages', value: formatValue(data.arms?.baggage, data.units?.armLength || 'mm') },
          { label: 'CG limite avant min', value: formatValue(data.cgEnvelope?.forwardPoints?.[0]?.cg, data.units?.armLength || 'mm') },
          { label: 'CG limite arrière', value: formatValue(data.cgEnvelope?.aftCG, data.units?.armLength || 'mm') }
        ],
        hasCGData ? (
          <Box sx={{ 
            p: 2, 
            bgcolor: 'grey.50', 
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider'
          }}>
            <CGEnvelopeChart 
              cgEnvelope={cgEnvelopeData}
              massUnit={data.units?.weight === 'lbs' ? 'lbs' : 'kg'}
            />
          </Box>
        ) : null
      )}

      {/* Performances */}
      <Paper 
        elevation={0} 
        sx={{ 
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden'
        }}
      >
        <Box 
          sx={{ 
            p: 2, 
            bgcolor: 'grey.50',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Performances
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setCurrentStep(4)}
          >
            Modifier
          </Button>
        </Box>
        
        <Box sx={{ p: 3 }}>
          {data.advancedPerformance || data.performanceTables ? (
            <Box>
              {/* Affichage des tableaux extraits depuis advancedPerformance */}
              {data.advancedPerformance?.tables && data.advancedPerformance.tables.length > 0 ? (
                data.advancedPerformance.tables.map((table, tableIndex) => (
                <Box key={tableIndex} sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    {table.title || `Tableau ${tableIndex + 1}`}
                  </Typography>
                  {table.headers && (
                    <Box sx={{ 
                      overflowX: 'auto',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1
                    }}>
                      <table style={{ 
                        width: '100%', 
                        borderCollapse: 'collapse',
                        fontSize: '0.875rem'
                      }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5f5f5' }}>
                            {table.headers.map((header, headerIndex) => (
                              <th key={headerIndex} style={{ 
                                padding: '8px',
                                borderBottom: '1px solid #e0e0e0',
                                borderRight: headerIndex < table.headers.length - 1 ? '1px solid #e0e0e0' : 'none',
                                textAlign: 'left',
                                fontWeight: 600
                              }}>
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows && table.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} style={{ 
                              backgroundColor: rowIndex % 2 === 0 ? 'white' : '#fafafa' 
                            }}>
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} style={{ 
                                  padding: '8px',
                                  borderBottom: rowIndex < table.rows.length - 1 ? '1px solid #e0e0e0' : 'none',
                                  borderRight: cellIndex < row.length - 1 ? '1px solid #e0e0e0' : 'none'
                                }}>
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Box>
                  )}
                </Box>
              ))
              ) : data.performanceTables && data.performanceTables.length > 0 ? (
                // Affichage des tableaux depuis performanceTables
                data.performanceTables.map((table, tableIndex) => (
                  <Box key={tableIndex} sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                      {table.table_name || `Tableau ${tableIndex + 1}`} - {table.table_type || 'Performance'}
                    </Typography>
                    {table.data && table.data.length > 0 && (
                      <Box sx={{
                        overflowX: 'auto',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1
                      }}>
                        <Typography variant="caption" color="text.secondary" sx={{ p: 1, display: 'block' }}>
                          {table.data.length} entrées disponibles
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ))
              ) : (
                <Box>
                  {/* Affichage des données de performance simple si pas de tableaux */}
                  <Typography variant="body2" color="text.secondary">
                    Les données de performances ont été enregistrées
                  </Typography>
                </Box>
              )}
              
              {/* Données de performances supplémentaires */}
              {(data.advancedPerformance?.serviceCeiling || data.advancedPerformance?.absoluteCeiling) && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Plafonds
                  </Typography>
                  <Grid container spacing={2}>
                    {data.advancedPerformance?.serviceCeiling && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Plafond pratique</Typography>
                        <Typography variant="body2">{data.advancedPerformance.serviceCeiling} ft</Typography>
                      </Grid>
                    )}
                    {data.advancedPerformance?.absoluteCeiling && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Plafond absolu</Typography>
                        <Typography variant="body2">{data.advancedPerformance.absoluteCeiling} ft</Typography>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Aucune donnée de performance disponible
            </Typography>
          )}
        </Box>
      </Paper>

      {/* Équipements */}
      {(data.equipmentCom || data.equipmentNav || data.equipmentSurv) && (
        <Paper 
          elevation={0} 
          sx={{ 
            mb: 3,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden'
          }}
        >
          <Box 
            sx={{ 
              p: 2, 
              bgcolor: 'grey.50',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TimelineIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Équipements
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setCurrentStep(5)}
            >
              Modifier
            </Button>
          </Box>
          
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {data.equipmentCom && Object.entries(data.equipmentCom).filter(([_, value]) => value).length > 0 && (
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Communication
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Object.entries(data.equipmentCom)
                      .filter(([_, value]) => value)
                      .map(([key, _]) => (
                        <Chip key={key} label={key.toUpperCase()} size="small" />
                      ))
                    }
                  </Box>
                </Grid>
              )}
              {data.equipmentNav && Object.entries(data.equipmentNav).filter(([_, value]) => value && typeof value === 'boolean').length > 0 && (
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Navigation
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Object.entries(data.equipmentNav)
                      .filter(([key, value]) => value && typeof value === 'boolean' && key !== 'rnavTypes' && key !== 'rnpTypes')
                      .map(([key, _]) => (
                        <Chip key={key} label={key.toUpperCase()} size="small" />
                      ))
                    }
                  </Box>
                </Grid>
              )}
              {data.equipmentSurv && Object.entries(data.equipmentSurv).filter(([_, value]) => value && typeof value === 'boolean').length > 0 && (
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Surveillance
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Object.entries(data.equipmentSurv)
                      .filter(([key, value]) => value && typeof value === 'boolean' && key !== 'transponderMode')
                      .map(([key, _]) => (
                        <Chip key={key} label={key.toUpperCase()} size="small" />
                      ))
                    }
                    {data.equipmentSurv.transponderMode && (
                      <Chip label={`Mode ${data.equipmentSurv.transponderMode}`} size="small" color="primary" />
                    )}
                  </Box>
                </Grid>
              )}
            </Grid>
          </Box>
        </Paper>
      )}

      {/* Opérations */}
      <Paper 
        elevation={0} 
        sx={{ 
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden'
        }}
      >
        <Box 
          sx={{ 
            p: 2, 
            bgcolor: 'grey.50',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssignmentIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Opérations
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setCurrentStep(6)}
          >
            Modifier
          </Button>
        </Box>
        
        <Box sx={{ p: 3 }}>
          <Grid container spacing={3}>
            {/* Règles de vol */}
            {data.approvedOperations && (
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>
                  Règles de vol
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {['vfrDay', 'vfrNight', 'ifrDay', 'ifrNight', 'svfr'].map((key) => {
                    const labels = {
                      vfrDay: 'VFR Jour',
                      vfrNight: 'VFR Nuit',
                      ifrDay: 'IFR Jour',
                      ifrNight: 'IFR Nuit',
                      svfr: 'SVFR'
                    };
                    if (data.approvedOperations[key]) {
                      return <Chip key={key} label={labels[key]} size="small" color="primary" variant="outlined" />;
                    }
                    return null;
                  }).filter(Boolean)}
                </Box>
              </Grid>
            )}
            
            {/* Opérations spéciales */}
            {data.approvedOperations && (
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'warning.main' }}>
                  Opérations spéciales
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {['formation', 'aerobatics', 'banner', 'glider', 'parachute', 'agricultural', 'aerial', 'training', 'charter'].map((key) => {
                    const labels = {
                      formation: 'Vol en formation',
                      aerobatics: 'Voltige',
                      banner: 'Remorquage bannière',
                      glider: 'Remorquage planeur',
                      parachute: 'Largage parachutistes',
                      agricultural: 'Épandage agricole',
                      aerial: 'Photo/Surveillance',
                      training: 'École de pilotage',
                      charter: 'Transport public'
                    };
                    if (data.approvedOperations[key]) {
                      return <Chip key={key} label={labels[key]} size="small" color="warning" variant="outlined" />;
                    }
                    return null;
                  }).filter(Boolean)}
                </Box>
              </Grid>
            )}
            
            {/* Environnement et usage */}
            {data.approvedOperations && (
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'success.main' }}>
                  Environnement et usage
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {['mountainous', 'seaplane', 'skiPlane', 'icing'].map((key) => {
                    const labels = {
                      mountainous: 'Vol en montagne',
                      seaplane: 'Hydravion',
                      skiPlane: 'Avion sur skis',
                      icing: 'Conditions givrantes'
                    };
                    if (data.approvedOperations[key]) {
                      return <Chip key={key} label={labels[key]} size="small" color="success" variant="outlined" />;
                    }
                    return null;
                  }).filter(Boolean)}
                </Box>
              </Grid>
            )}
          </Grid>
          
          {/* Si aucune opération n'est sélectionnée */}
          {(!data.approvedOperations || Object.values(data.approvedOperations).every(v => !v)) && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Aucune opération spéciale approuvée
            </Typography>
          )}
        </Box>
      </Paper>


      {/* Remarques */}
      {data.remarks && (
        <Paper 
          elevation={0} 
          sx={{ 
            mb: 3,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden'
          }}
        >
          <Box 
            sx={{ 
              p: 2, 
              bgcolor: 'grey.50',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EditIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Remarques
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setCurrentStep(7)}
            >
              Modifier
            </Button>
          </Box>
          
          <Box sx={{ p: 3 }}>
            <Typography 
              variant="body2" 
              sx={{ 
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6
              }}
            >
              {data.remarks}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Message et tableau comparatif pour les variantes */}
      {data.baseAircraft && (
        <>
          <Alert severity="info" sx={{ mb: 3, maxWidth: 800, mx: 'auto' }}>
            <Typography variant="body2">
              <strong>Configuration personnalisée</strong> - Cet avion est basé sur {data.baseAircraft.model} ({data.baseAircraft.registration}).
              Vous pouvez choisir de sauvegarder cette configuration uniquement pour votre usage personnel,
              ou de la proposer à la communauté comme une variante.
            </Typography>
          </Alert>

          {/* Tableau comparatif des modifications */}
          {(() => {
            const variantDiffs = calculateVariantDifferences();
            if (variantDiffs.length > 0) {
              return (
                <Paper elevation={2} sx={{ mb: 3, maxWidth: 1000, mx: 'auto', p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <DifferenceIcon color="primary" />
                    <Typography variant="h6">
                      Tableau comparatif des modifications
                    </Typography>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Paramètre</strong></TableCell>
                          <TableCell><strong>Valeur de base</strong></TableCell>
                          <TableCell><strong>Votre modification</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {variantDiffs.map((diff, index) => (
                          <TableRow key={index} sx={{
                            '&:hover': { bgcolor: 'action.hover' },
                            bgcolor: index % 2 === 0 ? 'grey.50' : 'white'
                          }}>
                            <TableCell>{diff.field}</TableCell>
                            <TableCell sx={{ color: 'text.secondary' }}>
                              {diff.original}
                            </TableCell>
                            <TableCell sx={{
                              color: 'primary.main',
                              fontWeight: 500
                            }}>
                              {diff.modified}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Box sx={{ mt: 2, p: 1, bgcolor: 'info.50', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {variantDiffs.length} modification{variantDiffs.length > 1 ? 's' : ''} détectée{variantDiffs.length > 1 ? 's' : ''} par rapport à la configuration de base
                    </Typography>
                  </Box>
                </Paper>
              );
            } else {
              return (
                <Alert severity="info" sx={{ mb: 3, maxWidth: 800, mx: 'auto' }}>
                  <Typography variant="body2">
                    Aucune modification détectée par rapport à la configuration de base.
                  </Typography>
                </Alert>
              );
            }
          })()}
        </>
      )}

      {/* Boutons d'action */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 4 }}>
        {data.baseAircraft ? (
          // Si c'est une variante (Option 3), montrer deux options
          <>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<SaveIcon />}
              onClick={() => handleSave('local')}
              sx={{ px: 4 }}
            >
              Sauvegarder localement
            </Button>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              startIcon={<CloudUploadIcon />}
              onClick={() => handleSave('community')}
              sx={{ px: 4 }}
            >
              Proposer à la communauté
            </Button>
          </>
        ) : (
          // Sinon, montrer le bouton unique
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<SaveIcon />}
            onClick={() => handleSave()}
            sx={{ px: 4 }}
          >
            Sauvegarder mon avion
          </Button>
        )}
      </Box>

      {/* Dialog pour les différences */}
      <Dialog
        open={showDifferencesDialog}
        onClose={() => setShowDifferencesDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DifferenceIcon color="primary" />
            Modifications détectées
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Vous avez modifié {differences.length} champ(s) par rapport à la version communautaire.
              Choisissez comment procéder :
            </Typography>
          </Alert>

          {differences.length > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Champ</strong></TableCell>
                    <TableCell><strong>Valeur originale</strong></TableCell>
                    <TableCell><strong>Nouvelle valeur</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {differences.slice(0, 10).map((diff, index) => (
                    <TableRow key={index}>
                      <TableCell>{diff.field}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {typeof diff.original === 'object' && diff.original !== null
                            ? JSON.stringify(diff.original)
                            : (diff.original || 'Non défini')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="primary">
                          {typeof diff.modified === 'object' && diff.modified !== null
                            ? JSON.stringify(diff.modified)
                            : (diff.modified || 'Non défini')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {differences.length > 10 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography variant="body2" color="text.secondary">
                          ... et {differences.length - 10} autre(s) modification(s)
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paper
              sx={{
                p: 2,
                border: '2px solid',
                borderColor: submissionMode === 'community' ? 'primary.main' : 'divider',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' }
              }}
              onClick={() => setSubmissionMode('community')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CloudUploadIcon color="primary" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Soumettre à la communauté
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Proposer vos modifications comme mise à jour de la configuration existante.
                    La communauté pourra voter pour valider vos changements.
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Paper
              sx={{
                p: 2,
                border: '2px solid',
                borderColor: submissionMode === 'local' ? 'primary.main' : 'divider',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' }
              }}
              onClick={() => setSubmissionMode('local')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <SaveIcon color="action" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Enregistrer localement
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Conserver vos modifications uniquement sur votre appareil.
                    Elles ne seront pas partagées avec la communauté.
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDifferencesDialog(false)}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={submissionMode === 'community' ? handleCommunitySubmission : handleLocalSave}
            disabled={!submissionMode}
          >
            {submissionMode === 'community' ? 'Soumettre' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Statistiques */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3,
          bgcolor: 'primary.lighter',
          border: '1px solid',
          borderColor: 'primary.light'
        }}
      >
        <Typography variant="h6" sx={{ mb: 2 }}>
          Résumé de la configuration
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary" fontWeight="bold">
                8
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sections complétées
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main" fontWeight="bold">
                100%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Données obligatoires
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main" fontWeight="bold">
                {data.seats || '4'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Places disponibles
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Step5Review;