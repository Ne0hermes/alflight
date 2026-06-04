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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress
} from '@mui/material';
import { StyledTextField, StyledFormControl } from './FormFieldStyles';
import {
  PhotoCamera as CameraIcon,
  Info as InfoIcon,
  Flight as FlightIcon,
  LocalGasStation as FuelIcon,
  ExpandMore as ExpandMoreIcon,
  Terrain as TerrainIcon,
  Warning as WarningIcon,
  CloudDownload as CloudIcon,
  Update as UpdateIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';
import FormHelperText from '@mui/material/FormHelperText';
import { unitsSelectors } from '@core/stores/unitsStore';
import { convertValue, getUnitSymbol } from '@utils/unitConversions';
import { formatCanonical } from '@utils/unitsDisplay';
import UpdateAircraftDialog from '../UpdateAircraftDialog';
import aircraftVersioningService from '../../services/aircraftVersioningService';
import ImageEditor from '../../../../components/ImageEditor';
import { Description as DescriptionIcon, CloudUpload as CloudUploadIcon, Delete as DeleteIcon } from '@mui/icons-material';
import communityService from '../../../../services/communityService';
import AeroclubAutocomplete from '../AeroclubAutocomplete';
import { useAirportName } from '@shared/hooks/useAirportNames';

// Import de la base de données communautaire mock (en production, sera un appel API)
const COMMUNITY_DATABASE = [
  'F-GBYU', 'F-HXYZ', 'F-GJKL', 'F-GMNO', 'F-HABC', 'F-HDEF', 'F-GGHI'
];

const Step1BasicInfo = ({ data, updateData, errors = {}, onNext, onPrevious }) => {
  const [photoPreview, setPhotoPreview] = useState(data.photo || null);
  const [manexFile, setManexFile] = useState(data.manex || null);
  const [uploadingToSupabase, setUploadingToSupabase] = useState(false);
  const units = unitsSelectors.useUnits();
  const [expandedPanels, setExpandedPanels] = useState({
    identification: false,
    fuel: false,
    surfaces: false,
    manex: false
  });
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);
  const [registrationExists, setRegistrationExists] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [existingAircraftData, setExistingAircraftData] = useState(null);

  // Nom usuel du terrain de base — source unique (provider GeoJSON/SIA)
  const homeBaseName = useAirportName(data.homeBase);

  const handlePanelChange = (panel) => (event, isExpanded) => {
    // Si on ouvre un panneau, on ferme tous les autres
    if (isExpanded) {
      setExpandedPanels({
        identification: false,
        fuel: false,
        surfaces: false,
        manex: false,
        [panel]: true
      });
    } else {
      // Si on ferme un panneau, on le ferme simplement
      setExpandedPanels(prev => ({ ...prev, [panel]: false }));
    }
  };

  // Gestionnaire pour l'upload du MANEX
  const handleManexUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      if (file.size > 50 * 1024 * 1024) {
        alert('Le fichier MANEX est trop volumineux. Veuillez choisir un fichier de moins de 50MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const manexData = {
          fileName: file.name,
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          uploadDate: new Date().toISOString(),
          hasData: true,
          file: reader.result // Base64 encoded PDF
        };
        setManexFile(manexData);
        updateData('manex', manexData);
        
      };
      reader.readAsDataURL(file);
    } else {
      alert('Veuillez sélectionner un fichier PDF valide.');
    }
  };

  const handleManexDelete = () => {
    setManexFile(null);
    updateData('manex', null);
    
  };

  // Upload vers Supabase Storage
  const handleUploadToSupabase = async () => {
    if (!data.registration) {
      alert('Veuillez d\'abord renseigner l\'immatriculation');
      return;
    }

    // Récupérer le fichier depuis manexFile ou data.manex
    const fileSource = manexFile || data.manex;

    if (!fileSource) {
      alert('Aucun fichier MANEX à uploader');
      console.error('❌ Aucune source de fichier trouvée');
      return;
    }

    try {
      setUploadingToSupabase(true);
      let blob;

      // CAS 1: Le fichier existe déjà sur Supabase (remoteUrl présent)
      // On le télécharge depuis Supabase et on le réupload avec la bonne immatriculation
      if (fileSource.remoteUrl) {
        

        try {
          // Si on a le filePath, utiliser downloadManex
          if (fileSource.filePath) {
            blob = await communityService.downloadManex(fileSource.filePath);
          }
          // Sinon, extraire le filePath depuis l'URL et télécharger
          else {
            // Extraire le filePath depuis l'URL publique
            // Format: https://...supabase.co/storage/v1/object/public/manex-files/{filePath}
            const urlParts = fileSource.remoteUrl.split('/manex-files/');
            if (urlParts.length < 2) {
              throw new Error('URL Supabase invalide');
            }
            const extractedFilePath = decodeURIComponent(urlParts[1]);
            

            blob = await communityService.downloadManex(extractedFilePath);
          }

          
        } catch (downloadError) {
          console.error('❌ Erreur téléchargement depuis Supabase:', downloadError);
          throw new Error(`Impossible de télécharger le MANEX depuis Supabase: ${downloadError.message}`);
        }
      }
      // CAS 2: Le fichier est en base64 local
      else {
        // Chercher les données dans différentes propriétés possibles
        const fileData = fileSource.file || fileSource.data || fileSource.pdfData;

        if (!fileData) {
          console.error('❌ Aucune donnée trouvée dans:', {
            hasFile: !!fileSource.file,
            hasData: !!fileSource.data,
            hasPdfData: !!fileSource.pdfData,
            allKeys: Object.keys(fileSource)
          });
          throw new Error('Aucune donnée de fichier disponible (ni local ni Supabase)');
        }

        

        // Convertir base64 en Blob
        const base64Data = fileData.split(',')[1];
        if (!base64Data) {
          throw new Error('Données base64 invalides');
        }

        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: 'application/pdf' });
      }

      // Upload vers Supabase avec la bonne immatriculation
      
      const result = await communityService.uploadManex(data.registration, blob);

      // Mettre à jour les données avec l'URL Supabase
      const updatedManexData = {
        fileName: fileSource.fileName,
        fileSize: fileSource.fileSize,
        uploadDate: fileSource.uploadDate || new Date().toISOString(),
        hasData: true,
        remoteUrl: result.publicUrl,
        filePath: result.filePath,
        uploadedToSupabase: true
      };

      setManexFile(updatedManexData);
      updateData('manex', updatedManexData);

      alert(`✅ MANEX uploadé sur Supabase!\nURL: ${result.publicUrl}`);
      
    } catch (error) {
      console.error('❌ Erreur upload Supabase:', error);
      alert(`❌ Erreur lors de l'upload: ${error.message}`);
    } finally {
      setUploadingToSupabase(false);
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

  // Redimensionne et compresse une image avant stockage en base64.
  // Pourquoi : les photos de smartphone font 2-5 MB JPEG (= 3-7 MB base64),
  // ce qui dépasse les seuils Supabase JSONB et causait un strip silencieux
  // à l'upload → photo invisible après téléchargement. On normalise tout à
  // 1200px max côté long en JPEG 0.85 → typiquement < 500 KB.
  const resizeAndCompressImage = (file, maxDim = 1200, quality = 0.85) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          // Calcule les nouvelles dimensions
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          // Dessine sur un canvas et exporte en JPEG compressé
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({ dataUrl, width, height, sizeKB: (dataUrl.length * 0.75) / 1024 });
        };
        img.onerror = () => reject(new Error('Image invalide'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Lecture fichier échouée'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('La photo source est trop volumineuse (> 20 MB). Choisis une image plus légère.');
      return;
    }

    try {
      const { dataUrl, width, height, sizeKB } = await resizeAndCompressImage(file, 1200, 0.85);
      console.log(`📷 Photo redimensionnée : ${width}×${height}, ${sizeKB.toFixed(0)} KB (depuis ${(file.size/1024).toFixed(0)} KB)`);
      setPhotoPreview(dataUrl);
      updateData('photo', dataUrl);
    } catch (err) {
      console.error('Erreur traitement photo :', err);
      alert('Erreur lors du traitement de la photo : ' + err.message);
    }
  };

  // NOTE: la vitesse de croisière (cruiseSpeedKt) et le calcul du baseFactor
  // ont été déplacés vers Step2Speeds (le baseFactor découle directement d'une
  // vitesse, sa place naturelle est avec les autres vitesses de l'avion).

  const handleSurfaceChange = (surface) => (event) => {
    const currentSurfaces = data.compatibleRunwaySurfaces || [];
    const updatedSurfaces = event.target.checked 
      ? [...currentSurfaces, surface]
      : currentSurfaces.filter(s => s !== surface);
    updateData('compatibleRunwaySurfaces', updatedSurfaces);
  };

  // NOTE: pas de conversion automatique au changement de pref utilisateur.
  // data.fuelCapacity et data.fuelConsumption sont stockés en unités STORAGE (L, L/h),
  // l'affichage est converti à la volée par les `value=` (lignes ~623 et ~661).
  // Convertir la valeur stockée ici provoquerait une double conversion à chaque render.

  return (
    // Demande utilisateur : aligner la largeur du Step1 sur celle du
    // stepper / section MANEX du wizard parent. Avant : maxWidth 1000 →
    // visuellement plus étroit. Après : 100% du Container parent (lg=1200).
    <Box sx={{ width: '100%', mx: 'auto' }}>

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
          <Typography variant="subtitle1" sx={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>
            Identification de l'appareil
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Box sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
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
            </Box>

            <Box sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Marque / Constructeur"
                value={data.manufacturer || ''}
                onChange={(e) => updateData('manufacturer', e.target.value)}
                placeholder="Ex: Cessna, Robin, Diamond, Piper, Cirrus…"
                helperText="Constructeur de l'avion (extrait du MANEX si présent)"
              />
            </Box>

            <Box sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Modèle *"
                value={data.model || ''}
                onChange={(e) => updateData('model', e.target.value)}
                placeholder="Ex: 172SP, DR400-180, DA40 NG, PA-28-181"
                error={!!errors.model}
                helperText={errors.model || "Désignation officielle du modèle (sans la marque)"}
                required
              />
            </Box>

            <Box sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
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
            </Box>

            <Box sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              <StyledTextField
                fullWidth
                type="number"
                variant="outlined"
                label="Puissance moteur (CV)"
                value={data.horsepower ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  updateData('horsepower', v === '' ? undefined : Number(v));
                }}
                placeholder="Ex: 180"
                inputProps={{ min: 0, step: 1 }}
                error={!!errors.horsepower}
                helperText={errors.horsepower || "Puissance nominale au régime maxi continu, en chevaux (HP)"}
              />
            </Box>

            <Box sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
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
            </Box>

            {/* Aéroclub d'attache (avec autocomplétion + ajout manuel).
                Quand un aéroclub avec un OACI connu est sélectionné, on
                pré-remplit automatiquement le terrain de base si celui-ci
                est encore vide. */}
            <Box sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              <AeroclubAutocomplete
                value={data.homeAeroclub || ''}
                onChange={(newName) => updateData('homeAeroclub', newName || '')}
                onSelectIcao={(icao) => {
                  if (icao && !data.homeBase) {
                    updateData('homeBase', icao.toUpperCase());
                  }
                }}
                label="Aéroclub d'attache"
                helperText=""
              />
            </Box>

            {/* Terrain de base (code OACI) */}
            <Box sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Terrain de base (OACI)"
                value={data.homeBase || ''}
                onChange={(e) =>
                  updateData('homeBase', e.target.value.toUpperCase().slice(0, 4))
                }
                placeholder="Ex: LFPN"
                inputProps={{ maxLength: 4, style: { textTransform: 'uppercase' } }}
                helperText={
                  homeBaseName
                    ? `✈️ ${homeBaseName}`
                    : "Code OACI à 4 lettres du terrain où l'avion est basé"
                }
              />
            </Box>

            {/* Photo upload section within identification */}
            <Box sx={{ width: '100%', maxWidth: 350, textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 2, fontWeight: 500 }}>
                Photo de l'appareil (optionnel)
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2, width: '100%' }}>
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <ImageEditor
                    src={photoPreview}
                    alt="Photo de l'avion"
                    width={350}
                    height={200}
                    shape="rectangle"
                    showControls={true}
                    onSave={(editedData) => {
                      // Sauvegarder les données d'édition
                      updateData('photoEditData', editedData);
                    }}
                    placeholder={
                      <Box
                        sx={{
                          width: 350,
                          height: 200,
                          border: '2px dashed',
                          borderColor: 'divider',
                          borderRadius: '8px',
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
                </Box>

                <Button
                  variant="contained"
                  component="label"
                  startIcon={<CameraIcon />}
                  size="small"
                  fullWidth
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
            </Box>
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
          <Typography variant="subtitle1" sx={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>
            Carburant et performances
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Box sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
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
            </Box>

            <Box sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Capacité totale carburant *"
                type="number"
                value={
                  data.fuelCapacity
                    ? Math.round(convertValue(data.fuelCapacity, 'ltr', units.fuel, 'fuel') * 10) / 10
                    : ''
                }
                onChange={(e) => {
                  const valueInStorageUnit = convertValue(e.target.value, units.fuel, 'ltr', 'fuel');
                  updateData('fuelCapacity', valueInStorageUnit);
                }}
                placeholder="Ex: 200"
                error={!!errors.fuelCapacity}
                helperText={errors.fuelCapacity || (data.fuelCapacity
                  ? `≈ ${formatCanonical(data.fuelCapacity, 'fuel', units, { both: true })}`
                  : 'Volume physique total de tous les réservoirs (capacity)')}
                required
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.fuel)}</InputAdornment>,
                }}
              />
            </Box>

            <Box sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Volume utilisable"
                type="number"
                value={
                  data.fuelUsableCapacity
                    ? Math.round(convertValue(data.fuelUsableCapacity, 'ltr', units.fuel, 'fuel') * 10) / 10
                    : ''
                }
                onChange={(e) => {
                  const valueInStorageUnit = convertValue(e.target.value, units.fuel, 'ltr', 'fuel');
                  updateData('fuelUsableCapacity', valueInStorageUnit);
                }}
                placeholder="Ex: 195"
                helperText={data.fuelUsableCapacity
                  ? `≈ ${formatCanonical(data.fuelUsableCapacity, 'fuel', units, { both: true })} (carburant réellement consommable)`
                  : 'Volume utilisable (souvent < capacité totale, sans la résiduelle non aspirable). Utilisé pour M&C et autonomie.'}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.fuel)}</InputAdornment>,
                }}
              />
            </Box>

            <Box sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              <StyledTextField
                fullWidth
                variant="outlined"
                label="Consommation"
                type="number"
                value={
                  data.fuelConsumption
                    ? Math.round(convertValue(data.fuelConsumption, 'lph', units.fuelConsumption, 'fuelConsumption') * 10) / 10
                    : ''
                }
                onChange={(e) => {
                  const valueInStorageUnit = convertValue(e.target.value, units.fuelConsumption, 'lph', 'fuelConsumption');
                  updateData('fuelConsumption', valueInStorageUnit);
                }}
                placeholder="Ex: 35"
                helperText={data.fuelConsumption
                  ? `≈ ${formatCanonical(data.fuelConsumption, 'fuelConsumption', units, { both: true })}`
                  : 'Consommation moyenne en croisière (les 2 unités s\'afficheront après saisie)'}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.fuelConsumption)}</InputAdornment>,
                }}
              />
            </Box>

            {/* NOTE: champ "Base Factor" déplacé vers Step2Speeds avec la vitesse
                de croisière (le baseFactor découle directement de cette vitesse). */}
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
          <Typography variant="subtitle1" sx={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>
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

      {/* Accordion: Manuel d'exploitation (MANEX) */}
      <Accordion
        expanded={expandedPanels.manex}
        onChange={handlePanelChange('manex')}
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
          <DescriptionIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>
            Manuel d'exploitation (MANEX)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 2 }}>
            {/* Alerte: MANEX requis pour les performances */}
            {!manexFile && (
              <Alert severity="warning" sx={{ width: '100%', maxWidth: 500 }}>
                <Typography variant="body2" fontWeight="600" gutterBottom>
                  ⚠️ MANEX requis pour les données de performance
                </Typography>
                <Typography variant="caption">
                  Pour extraire automatiquement les tableaux et abaques de performance à l'étape suivante,
                  vous devez d'abord importer le manuel d'exploitation (MANEX) en PDF.
                </Typography>
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 500 }}>
              Le MANEX sera stocké avec l'avion pour référence future. Vous pourrez le consulter ou le télécharger à tout moment depuis la fiche de l'avion.
            </Typography>

            {manexFile ? (
              <Paper
                elevation={2}
                sx={{
                  p: 2,
                  width: '100%',
                  maxWidth: 400,
                  bgcolor: manexFile.uploadedToSupabase ? 'success.50' : 'warning.50',
                  border: '1px solid',
                  borderColor: manexFile.uploadedToSupabase ? 'success.200' : 'warning.200'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'start', gap: 2, mb: 2 }}>
                  <DescriptionIcon
                    color={manexFile.uploadedToSupabase ? 'success' : 'warning'}
                    sx={{ fontSize: 40, mt: 0.5 }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      {manexFile.fileName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {manexFile.fileSize} • Importé le {new Date(manexFile.uploadDate).toLocaleDateString('fr-FR')}
                    </Typography>
                    {manexFile.uploadedToSupabase && (
                      <Typography variant="caption" color="success.main" display="block" sx={{ mt: 0.5 }}>
                        ✅ Uploadé sur Supabase
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    startIcon={<CloudIcon />}
                    onClick={() => {
                      // Télécharger le MANEX
                      const fileData = manexFile.file || manexFile.data || manexFile.pdfData;

                      if (fileData) {
                        // Créer un lien de téléchargement
                        const link = document.createElement('a');
                        link.href = fileData;
                        link.download = manexFile.fileName || 'MANEX.pdf';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      } else if (manexFile.remoteUrl) {
                        // Ouvrir l'URL Supabase dans un nouvel onglet
                        window.open(manexFile.remoteUrl, '_blank');
                      } else {
                        alert('Impossible de télécharger le MANEX');
                      }
                    }}
                    sx={{ flex: { sm: 1 } }}
                  >
                    Télécharger
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={handleManexDelete}
                    sx={{ flex: { sm: 1 } }}
                  >
                    Supprimer
                  </Button>
                </Box>
                {!manexFile.uploadedToSupabase && (
                  <Typography variant="caption" color="info.main" display="block" sx={{ mt: 1 }}>
                    ℹ️ Le MANEX pourra être uploadé sur Supabase à la fin du récapitulatif
                  </Typography>
                )}
              </Paper>
            ) : data.manexAvailableInSupabase ? (
              // MANEX disponible dans Supabase mais pas téléchargé localement
              <Paper
                elevation={2}
                sx={{
                  p: 2,
                  width: '100%',
                  maxWidth: 400,
                  bgcolor: 'info.50',
                  border: '1px solid',
                  borderColor: 'info.200'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'start', gap: 2, mb: 2 }}>
                  <CloudIcon color="info" sx={{ fontSize: 40, mt: 0.5 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      MANEX disponible sur Supabase
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {data.manexAvailableInSupabase.fileName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {(data.manexAvailableInSupabase.fileSize / 1024 / 1024).toFixed(2)} MB
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="contained"
                  color="info"
                  size="small"
                  startIcon={<CloudIcon />}
                  onClick={async () => {
                    try {
                      setUploadingToSupabase(true);
                      

                      // Télécharger le MANEX
                      const blob = await communityService.downloadManex(data.manexAvailableInSupabase.filePath);

                      // Convertir en base64
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const manexData = {
                          fileName: data.manexAvailableInSupabase.fileName,
                          fileSize: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
                          uploadDate: new Date().toISOString(),
                          hasData: true,
                          file: reader.result,
                          uploadedToSupabase: true,
                          remoteUrl: communityService.getManexDownloadUrl(data.manexAvailableInSupabase.filePath),
                          filePath: data.manexAvailableInSupabase.filePath
                        };
                        setManexFile(manexData);
                        updateData('manex', manexData);
                        
                        setUploadingToSupabase(false);
                      };
                      reader.readAsDataURL(blob);
                    } catch (error) {
                      console.error('❌ Erreur téléchargement MANEX:', error);
                      alert(`❌ Erreur: ${error.message}`);
                      setUploadingToSupabase(false);
                    }
                  }}
                  disabled={uploadingToSupabase}
                >
                  {uploadingToSupabase ? 'Téléchargement...' : 'Télécharger depuis Supabase'}
                </Button>
              </Paper>
            ) : (
              <Button
                variant="contained"
                component="label"
                startIcon={<CloudUploadIcon />}
                size="large"
              >
                Importer le MANEX (PDF)
                <input
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={handleManexUpload}
                />
              </Button>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 500 }}>
              Format: PDF uniquement (max 50MB)
            </Typography>
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
              <Grid size={6}>
                <Typography variant="body2">
                  <strong>Modèle :</strong> {existingAircraftData.model}
                </Typography>
              </Grid>
              <Grid size={6}>
                <Typography variant="body2">
                  <strong>Constructeur :</strong> {existingAircraftData.manufacturer}
                </Typography>
              </Grid>
              <Grid size={6}>
                <Typography variant="body2">
                  <strong>Ajouté par :</strong> {existingAircraftData.addedBy}
                </Typography>
              </Grid>
              {existingAircraftData.verified && (
                <Grid size={6}>
                  <Typography variant="body2" color="success.main">
                    ✓ Configuration vérifiée
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>

          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
            Options disponibles :
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
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

            <Grid size={{ xs: 12, md: 4 }}>
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

            <Grid size={{ xs: 12, md: 4 }}>
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
              ${updateInfo.mode === 'replace' ? '20' : '10'} votes positifs nets sont nécessaires pour l'approuver.`);
            // Optionnel : naviguer vers une page de suivi
            // window.location.href = '#/aircraft/updates/' + result.id;
          } catch (error) {
            console.error('Erreur lors de la création de la mise à jour:', error);
            alert('Erreur lors de la soumission de la mise à jour');
          }
        }}
      />

      {/* Boutons de navigation — affichés UNIQUEMENT si onNext OU
          onPrevious sont fournis. Auparavant le Box restait rendu même
          vide (avec mt: 3 = 24px), créant un espace blanc parasite en
          dessous du bouton "Importer le MANEX". */}
      {(onPrevious || onNext) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
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
      )}
    </Box>
  );
};

export default Step1BasicInfo;