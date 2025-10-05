import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Alert,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  Avatar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import { StyledTextField, StyledFormControl } from './FormFieldStyles';
import {
  PhotoCamera as CameraIcon,
  Info as InfoIcon,
  Flight as FlightIcon,
  LocalGasStation as FuelIcon,
  Speed as SpeedIcon,
  ExpandMore as ExpandMoreIcon,
  Terrain as TerrainIcon,
  Warning as WarningIcon,
  CloudDownload as CloudIcon,
  Update as UpdateIcon
} from '@mui/icons-material';
import FormHelperText from '@mui/material/FormHelperText';
import { useUnitsStore, unitsSelectors } from '@core/stores/unitsStore';
import { convertValue, getUnitSymbol, fuelConsumptionConversions } from '@utils/unitConversions';
import UpdateAircraftDialog from '../UpdateAircraftDialog';
import aircraftVersioningService from '../../services/aircraftVersioningService';
import ImageEditor from '../../../../components/ImageEditor';

// Import de la base de données communautaire mock (en production, sera un appel API)
const COMMUNITY_DATABASE = [
  'F-GBYU', 'F-HXYZ', 'F-GJKL', 'F-GMNO', 'F-HABC', 'F-HDEF', 'F-GGHI'
];

const Step1BasicInfo = ({ data, updateData, errors = {} }) => {
  const [photoPreview, setPhotoPreview] = useState(data.photo || null);
  const units = unitsSelectors.useUnits();
  const [previousUnits, setPreviousUnits] = useState(units);
  const [expandedPanels, setExpandedPanels] = useState({
    identification: false,
    fuel: false,
    surfaces: false
  });
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);
  const [registrationExists, setRegistrationExists] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [existingAircraftData, setExistingAircraftData] = useState(null);

  const handlePanelChange = (panel) => (event, isExpanded) => {
    // Si on ouvre un panneau, on ferme tous les autres
    if (isExpanded) {
      setExpandedPanels({
        identification: false,
        fuel: false,
        surfaces: false,
        [panel]: true
      });
    } else {
      // Si on ferme un panneau, on le ferme simplement
      setExpandedPanels(prev => ({ ...prev, [panel]: false }));
    }
  };

  // Fonction de vérification de l'immatriculation
  const checkRegistrationExists = async (registration) => {
    if (!registration || registration.length < 5) return;

    setIsCheckingRegistration(true);

    // Simuler un appel API (en production, remplacer par un vrai appel)
    setTimeout(() => {
      const exists = COMMUNITY_DATABASE.includes(registration.toUpperCase());

      if (exists) {
        setRegistrationExists(true);
        // Simuler la récupération des données de l'avion existant
        setExistingAircraftData({
          registration: registration,
          model: 'Diamond DA40 NG',
          manufacturer: 'Diamond Aircraft',
          addedBy: 'Pilot123',
          verified: true
        });
        // Au lieu d'afficher le dialogue, on informe simplement l'utilisateur
        // Le dialogue sera géré dans Step0CommunityCheck
        // setShowDuplicateDialog(true);
      } else {
        setRegistrationExists(false);
        setExistingAircraftData(null);
      }

      setIsCheckingRegistration(false);
    }, 500);

    // En production :
    // try {
    //   const response = await fetch(`https://api.alflight.com/aircraft/check/${registration}`);
    //   const data = await response.json();
    //   setRegistrationExists(data.exists);
    //   setExistingAircraftData(data.aircraft);
    //   if (data.exists) setShowDuplicateDialog(true);
    // } catch (error) {
    //   console.error('Erreur lors de la vérification:', error);
    // } finally {
    //   setIsCheckingRegistration(false);
    // }
  };

  // Vérifier l'immatriculation lors de la saisie
  useEffect(() => {
    const timer = setTimeout(() => {
      if (data.registration) {
        checkRegistrationExists(data.registration);
      }
    }, 1000); // Délai pour éviter trop de requêtes

    return () => clearTimeout(timer);
  }, [data.registration]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) {
        alert('La photo est trop volumineuse. Veuillez choisir une image de moins de 5MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
        updateData('photo', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Calculer automatiquement le baseFactor
  const calculateBaseFactor = (cruiseSpeed) => {
    if (cruiseSpeed && parseFloat(cruiseSpeed) > 0) {
      return (60 / parseFloat(cruiseSpeed)).toFixed(3);
    }
    return '';
  };

  const handleCruiseSpeedChange = (value) => {
    updateData('cruiseSpeedKt', value);
    // Calculer et mettre à jour le baseFactor automatiquement
    const factor = calculateBaseFactor(value);
    if (factor) {
      updateData('baseFactor', factor);
    }
  };

  // Calculer le baseFactor au chargement initial si cruiseSpeedKt existe
  useEffect(() => {
    if (data.cruiseSpeedKt && !data.baseFactor) {
      const factor = calculateBaseFactor(data.cruiseSpeedKt);
      if (factor) {
        updateData('baseFactor', factor);
      }
    }
  }, []); // Execute uniquement au montage du composant

  const handleSurfaceChange = (surface) => (event) => {
    const currentSurfaces = data.compatibleRunwaySurfaces || [];
    const updatedSurfaces = event.target.checked 
      ? [...currentSurfaces, surface]
      : currentSurfaces.filter(s => s !== surface);
    updateData('compatibleRunwaySurfaces', updatedSurfaces);
  };

  // Gérer les conversions automatiques lors du changement d'unités
  useEffect(() => {
    // Convertir la capacité carburant
    if (previousUnits.fuel !== units.fuel && data.fuelCapacity) {
      const convertedCapacity = convertValue(
        data.fuelCapacity,
        previousUnits.fuel,
        units.fuel,
        'fuel'
      );
      if (convertedCapacity && convertedCapacity !== data.fuelCapacity) {
        updateData('fuelCapacity', Math.round(convertedCapacity * 100) / 100);
      }
    }

    // Convertir la consommation de carburant
    if (previousUnits.fuelConsumption !== units.fuelConsumption && data.fuelConsumption) {
      const convertedConsumption = convertValue(
        data.fuelConsumption,
        previousUnits.fuelConsumption,
        units.fuelConsumption,
        'fuelConsumption'
      );
      if (convertedConsumption && convertedConsumption !== data.fuelConsumption) {
        updateData('fuelConsumption', Math.round(convertedConsumption * 100) / 100);
      }
    }

    setPreviousUnits(units);
  }, [units, data.fuelCapacity, data.fuelConsumption, previousUnits]);

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>

      {/* Accordion: Identification de l'appareil */}
      <Accordion 
        expanded={expandedPanels.identification}
        onChange={handlePanelChange('identification')}
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
          <FlightIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Identification de l'appareil
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Immatriculation *"
                value={data.registration || ''}
                onChange={(e) => updateData('registration', e.target.value.toUpperCase())}
                placeholder="F-XXXX"
                error={!!errors.registration || registrationExists}
                helperText={
                  errors.registration ||
                  (isCheckingRegistration && "Vérification en cours...") ||
                  (registrationExists && "⚠️ Cette immatriculation existe déjà dans la base de données")
                }
                required
                InputProps={{
                  endAdornment: isCheckingRegistration ? (
                    <InputAdornment position="end">
                      <CircularProgress size={20} />
                    </InputAdornment>
                  ) : registrationExists ? (
                    <InputAdornment position="end">
                      <WarningIcon color="warning" />
                    </InputAdornment>
                  ) : null
                }}
              />
            </Grid>

            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Modèle *"
                value={data.model || ''}
                onChange={(e) => updateData('model', e.target.value)}
                placeholder="Ex: Cessna 172SP"
                error={!!errors.model}
                helperText={errors.model}
                required
              />
            </Grid>

            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              <StyledFormControl fullWidth variant="outlined">
                <InputLabel shrink id="engine-label">Type de moteur</InputLabel>
                <Select
                  labelId="engine-label"
                  value={data.engineType || ''}
                  onChange={(e) => updateData('engineType', e.target.value)}
                  label="Type de moteur"
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>Sélectionner un type</em>
                  </MenuItem>
                  <MenuItem value="singleEngine">Monomoteur</MenuItem>
                  <MenuItem value="twinEngine">Bimoteur</MenuItem>
                  <MenuItem value="turboprop">Turbopropulseur</MenuItem>
                  <MenuItem value="jet">Réacteur</MenuItem>
                </Select>
              </StyledFormControl>
            </Grid>

            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              <StyledFormControl fullWidth variant="outlined">
                <InputLabel shrink id="category-label">Catégorie</InputLabel>
                <Select
                  labelId="category-label"
                  value={data.wakeTurbulenceCategory || ''}
                  onChange={(e) => updateData('wakeTurbulenceCategory', e.target.value)}
                  label="Catégorie"
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>Sélectionner une catégorie</em>
                  </MenuItem>
                  <MenuItem value="L">Léger (L)</MenuItem>
                  <MenuItem value="M">Moyen (M)</MenuItem>
                  <MenuItem value="H">Lourd (H)</MenuItem>
                  <MenuItem value="S">Super (S)</MenuItem>
                </Select>
              </StyledFormControl>
            </Grid>

            {/* Photo upload section within identification */}
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350, textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 2, fontWeight: 500 }}>
                Photo de l'appareil (optionnel)
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <ImageEditor
                  src={photoPreview}
                  alt="Photo de l'avion"
                  width={200}
                  height={150}
                  shape="rectangle"
                  showControls={true}
                  onSave={(editedData) => {
                    // Sauvegarder les données d'édition
                    updateData('photoEditData', editedData);
                  }}
                  placeholder={
                    <Box
                      sx={{
                        width: 200,
                        height: 150,
                        border: '2px dashed',
                        borderColor: 'divider',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'background.paper'
                      }}
                    >
                      <CameraIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                    </Box>
                  }
                />

                <Button
                  variant="contained"
                  component="label"
                  startIcon={<CameraIcon />}
                  size="small"
                >
                  {photoPreview ? 'Changer la photo' : 'Ajouter une photo'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handlePhotoUpload}
                  />
                </Button>

                <Typography variant="caption" color="text.secondary">
                  Format: JPG, PNG (max 5MB) - Cliquez sur l'image pour éditer (zoom, repositionnement)
                </Typography>
              </Box>
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Accordion: Carburant et performances */}
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
            Carburant et performances
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              <StyledFormControl fullWidth variant="outlined">
                <InputLabel shrink id="fuel-label">Type de carburant *</InputLabel>
                <Select
                  labelId="fuel-label"
                  value={data.fuelType || ''}
                  onChange={(e) => updateData('fuelType', e.target.value)}
                  label="Type de carburant *"
                  displayEmpty
                  error={!!errors.fuelType}
                >
                  <MenuItem value="">
                    <em>Sélectionner un carburant</em>
                  </MenuItem>
                  <MenuItem value="AVGAS">AVGAS (100LL)</MenuItem>
                  <MenuItem value="JET-A1">JET A-1</MenuItem>
                  <MenuItem value="MOGAS">MOGAS</MenuItem>
                </Select>
                {errors.fuelType && <FormHelperText error>{errors.fuelType}</FormHelperText>}
              </StyledFormControl>
            </Grid>

            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Capacité carburant *"
                type="number"
                value={data.fuelCapacity || ''}
                onChange={(e) => updateData('fuelCapacity', e.target.value)}
                placeholder="Ex: 200"
                error={!!errors.fuelCapacity}
                helperText={errors.fuelCapacity || "Capacité totale des réservoirs"}
                required
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.fuel)}</InputAdornment>,
                }}
              />
            </Grid>

            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Consommation"
                type="number"
                value={data.fuelConsumption || ''}
                onChange={(e) => updateData('fuelConsumption', e.target.value)}
                placeholder="Ex: 35"
                helperText="Consommation moyenne en croisière"
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.fuelConsumption)}</InputAdornment>,
                }}
              />
            </Grid>

            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Vitesse de croisière *"
                type="number"
                value={data.cruiseSpeedKt || ''}
                onChange={(e) => handleCruiseSpeedChange(e.target.value)}
                placeholder="Ex: 120"
                error={!!errors.cruiseSpeedKt}
                helperText={errors.cruiseSpeedKt || "Vitesse de croisière typique"}
                required
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.speed)}</InputAdornment>,
                }}
              />
            </Grid>

            <Grid item xs={12} sx={{ width: '100%', maxWidth: 350 }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Base Factor"
                type="number"
                value={data.baseFactor || ''}
                placeholder="Auto-calculé"
                helperText="60 / vitesse de croisière (auto-calculé)"
                InputProps={{
                  readOnly: true,
                }}
              />
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Accordion: Surfaces compatibles */}
      <Accordion 
        expanded={expandedPanels.surfaces}
        onChange={handlePanelChange('surfaces')}
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
          <TerrainIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Surfaces compatibles
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 350, mx: 'auto' }}>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={(data.compatibleRunwaySurfaces || []).includes('ASPH')}
                    onChange={handleSurfaceChange('ASPH')}
                  />
                }
                label="Asphalte (ASPH)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={(data.compatibleRunwaySurfaces || []).includes('CONC')}
                    onChange={handleSurfaceChange('CONC')}
                  />
                }
                label="Béton (CONC)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={(data.compatibleRunwaySurfaces || []).includes('GRASS')}
                    onChange={handleSurfaceChange('GRASS')}
                  />
                }
                label="Herbe (GRASS)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={(data.compatibleRunwaySurfaces || []).includes('GRVL')}
                    onChange={handleSurfaceChange('GRVL')}
                  />
                }
                label="Gravier (GRVL)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={(data.compatibleRunwaySurfaces || []).includes('UNPAVED')}
                    onChange={handleSurfaceChange('UNPAVED')}
                  />
                }
                label="Terre (UNPAVED)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={(data.compatibleRunwaySurfaces || []).includes('SAND')}
                    onChange={handleSurfaceChange('SAND')}
                  />
                }
                label="Sable (SAND)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={(data.compatibleRunwaySurfaces || []).includes('SNOW')}
                    onChange={handleSurfaceChange('SNOW')}
                  />
                }
                label="Neige (SNOW)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={(data.compatibleRunwaySurfaces || []).includes('WATER')}
                    onChange={handleSurfaceChange('WATER')}
                  />
                }
                label="Eau - Hydravion (WATER)"
              />
            </FormGroup>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Notification d'immatriculation existante intégrée */}
      {registrationExists && existingAircraftData && (
        <Paper elevation={2} sx={{ p: 3, mt: 3, border: '2px solid', borderColor: 'warning.main', bgcolor: 'warning.50' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <WarningIcon color="warning" />
            <Typography variant="h6" color="warning.dark">
              Immatriculation déjà existante
            </Typography>
          </Box>

          <Typography variant="body2" sx={{ mb: 2 }}>
            L'immatriculation <strong>{data.registration}</strong> existe déjà dans notre base de données communautaire.
          </Typography>

          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.paper', mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom fontWeight="bold">
              Avion existant :
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Modèle :</strong> {existingAircraftData.model}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Constructeur :</strong> {existingAircraftData.manufacturer}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Ajouté par :</strong> {existingAircraftData.addedBy}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                {existingAircraftData.verified && (
                  <Typography variant="body2" color="success.main">
                    ✓ Configuration vérifiée
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Paper>

          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
            Options disponibles :
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: 'primary.50',
                  border: '1px solid',
                  borderColor: 'primary.200',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': {
                    bgcolor: 'primary.100',
                    transform: 'translateY(-2px)',
                    boxShadow: 2
                  }
                }}
                onClick={() => {
                  updateData('shouldReturnToStep0', true);
                  updateData('searchRegistration', data.registration);
                }}
              >
                <CloudIcon color="primary" sx={{ mb: 1 }} />
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Importer les données
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Utiliser la configuration déjà validée par la communauté
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: 'warning.50',
                  border: '1px solid',
                  borderColor: 'warning.200',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': {
                    bgcolor: 'warning.100',
                    transform: 'translateY(-2px)',
                    boxShadow: 2
                  }
                }}
                onClick={() => {
                  setShowUpdateDialog(true);
                }}
              >
                <UpdateIcon color="warning" sx={{ mb: 1 }} />
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Proposer une mise à jour
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Si vous avez des informations plus récentes ou corrigées
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: 'info.50',
                  border: '1px solid',
                  borderColor: 'info.200',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': {
                    bgcolor: 'info.100',
                    transform: 'translateY(-2px)',
                    boxShadow: 2
                  }
                }}
                onClick={() => {
                  // Continuer avec une variante personnalisée
                  setRegistrationExists(false);
                  setExistingAircraftData(null);
                }}
              >
                <InfoIcon color="info" sx={{ mb: 1 }} />
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Créer une variante
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Si votre avion a des modifications spécifiques
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Dialog pour avertir de l'existence de l'immatriculation - Désactivé */}
      {false && (
      <Dialog
        open={showDuplicateDialog}
        onClose={() => setShowDuplicateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Immatriculation déjà existante
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            L'immatriculation <strong>{data.registration}</strong> existe déjà dans notre base de données communautaire.
          </DialogContentText>

          {existingAircraftData && (
            <Paper elevation={0} sx={{ p: 2, mt: 2, bgcolor: 'warning.50' }}>
              <Typography variant="subtitle2" gutterBottom>
                Avion existant :
              </Typography>
              <Typography variant="body2">
                • Modèle : {existingAircraftData.model}
              </Typography>
              <Typography variant="body2">
                • Constructeur : {existingAircraftData.manufacturer}
              </Typography>
              <Typography variant="body2">
                • Ajouté par : {existingAircraftData.addedBy}
              </Typography>
              {existingAircraftData.verified && (
                <Typography variant="body2" color="success.main">
                  ✓ Configuration vérifiée par la communauté
                </Typography>
              )}
            </Paper>
          )}

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Options disponibles :</strong>
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              • <strong>Importer les données existantes</strong> : Utiliser la configuration déjà validée par la communauté
            </Typography>
            <Typography variant="body2">
              • <strong>Proposer une mise à jour</strong> : Si vous avez des informations plus récentes ou corrigées
            </Typography>
            <Typography variant="body2">
              • <strong>Créer une variante</strong> : Si votre avion a des modifications spécifiques
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Button
            onClick={() => setShowDuplicateDialog(false)}
            variant="outlined"
            size="small"
          >
            Annuler
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={() => {
                setShowDuplicateDialog(false);
                setShowUpdateDialog(true);
              }}
              variant="outlined"
              startIcon={<UpdateIcon />}
              color="warning"
            >
              Proposer une mise à jour
            </Button>
            <Button
              onClick={() => {
                // Retourner à l'étape de recherche communautaire
                window.location.href = '#/aircraft/wizard?step=0&search=' + data.registration;
                setShowDuplicateDialog(false);
              }}
              variant="contained"
              startIcon={<CloudIcon />}
              color="primary"
            >
              Importer les données
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
      )}

      {/* Dialog pour proposer une mise à jour */}
      <UpdateAircraftDialog
        open={showUpdateDialog}
        onClose={() => setShowUpdateDialog(false)}
        existingData={existingAircraftData}
        newData={data}
        onConfirm={async (updateInfo) => {
          try {
            // Créer la mise à jour dans le service de versioning
            const result = await aircraftVersioningService.createUpdate(
              data.registration,
              {
                updatedBy: 'CurrentUser', // En production, utiliser l'ID utilisateur réel
                reason: updateInfo.reason,
                data: updateInfo.data
              }
            );

            // Afficher un message de succès
            alert(`Mise à jour proposée avec succès !
              Mode: ${updateInfo.mode}
              Version: ${result.version}

              Votre proposition sera soumise à validation par la communauté.
              ${updateInfo.mode === 'replace' ? '20' : '10'} votes positifs nets sont nécessaires pour l'approuver.
            `);

            // Optionnel : naviguer vers une page de suivi
            // window.location.href = '#/aircraft/updates/' + result.id;
          } catch (error) {
            console.error('Erreur lors de la création de la mise à jour:', error);
            alert('Erreur lors de la soumission de la mise à jour');
          }
        }}
      />

    </Box>
  );
};

export default Step1BasicInfo;