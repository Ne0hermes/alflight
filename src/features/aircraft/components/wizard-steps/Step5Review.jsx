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
  TableRow,
  CircularProgress
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
  Warning as WarningIcon,
  Sync as SyncIcon,
  Description as DescriptionIcon,
  CloudQueue as CloudQueueIcon
} from '@mui/icons-material';
import CGEnvelopeChart from '../CgEnvelopeChart';
import SpeedLimitationChart from '../SpeedLimitationChart';
import communityService from '../../../../services/communityService';
import { trackingActions } from '../../../../utils/autoTracking';
import { useUnitsStore } from '@core/stores/unitsStore';
import { getUnitSymbol } from '@utils/unitConversions';

const Step5Review = ({ data, setCurrentStep, onSave }) => {
  // Récupérer les préférences d'unités de l'utilisateur
  const units = useUnitsStore(state => state.units);
  const [showDifferencesDialog, setShowDifferencesDialog] = useState(false);
  const [submissionMode, setSubmissionMode] = useState(null);
  const [differences, setDifferences] = useState([]);
  const [isUpdatingSupabase, setIsUpdatingSupabase] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [isUploadingManex, setIsUploadingManex] = useState(false);
  const [manexUploadSuccess, setManexUploadSuccess] = useState(false);
  const [manexUploadError, setManexUploadError] = useState(null);

  // Calculer les différences avec l'avion de base (pour les variantes)
  const calculateVariantDifferences = () => {
    if (!data.baseAircraft) {
      return [];
    }

    const base = data.baseAircraft;
    const current = data;
    const diffs = [];

    
    
    

    // Labels et unités pour l'affichage (optionnel, avec fallback sur le nom du champ)
    const fieldLabels = {
      'registration': 'Immatriculation',
      'model': 'Modèle',
      'manufacturer': 'Constructeur',
      'year': 'Année',
      'mtow': 'Masse max au décollage (kg)',
      'emptyWeight': 'Masse à vide (kg)',
      'maxFuel': 'Carburant max (L)',
      'cruiseSpeed': 'Vitesse de croisière (kt)',
      'vne': 'VNE (kt)',
      'vs0': 'VS0 (kt)',
      'vs1': 'VS1 (kt)',
      'vx': 'VX (kt)',
      'vy': 'VY (kt)',
      'va': 'VA (kt)',
      'vfe': 'VFE (kt)',
      'vno': 'VNO (kt)',
      'vlo': 'VLO (kt)',
      'vr': 'VR (kt)',
      'serviceCeiling': 'Plafond pratique (ft)',
      'takeoffDistance': 'Distance de décollage (m)',
      'landingDistance': 'Distance d\'atterrissage (m)',
      'fuelConsumption': `Consommation (${getUnitSymbol(units.fuelConsumption)})`,
      'range': 'Autonomie (nm)',
      'engineType': 'Type de moteur',
      'enginePower': 'Puissance moteur (hp)',
      'propType': 'Type d\'hélice',
      'remarks': 'Remarques',
      'category': 'Catégorie',
      'aircraftType': 'Type d\'appareil',
      'fuelType': 'Type de carburant',
      'seats': 'Nombre de sièges',
      'maxLandingWeight': 'Masse max à l\'atterrissage (kg)',
      'usefulLoad': 'Charge utile (kg)',
      'maxRange': 'Autonomie max (nm)',
      'fuelCapacity': `Capacité carburant (${getUnitSymbol(units.fuel)})`,
      'engineModel': 'Modèle moteur',
      'minimumRunwayLength': 'Longueur piste minimale (m)',
      'photo': 'Photo de l\'avion',
      'manex': 'Manuel d\'exploitation (MANEX)',
      'hasManex': 'Présence du MANEX',
      // Sous-objets speeds
      'speeds.vr': 'VR - Vitesse de rotation (kt)',
      'speeds.v2': 'V2 - Vitesse de sécurité au décollage (kt)',
      'speeds.vref': 'VREF - Vitesse de référence (kt)',
      // Sous-objets specialCapabilities
      'specialCapabilities.rnav': 'Capacité RNAV',
      'specialCapabilities.rnavApproach': 'Approche RNAV',
      'specialCapabilities.pbn': 'Navigation basée sur les performances (PBN)',
      'specialCapabilities.mnps': 'Spécifications minimales de navigation (MNPS)',
      'specialCapabilities.rvsm': 'Séparation verticale minimale réduite (RVSM)',
      'specialCapabilities.catII': 'Atterrissage CAT II',
      'specialCapabilities.catIII': 'Atterrissage CAT III',
      'specialCapabilities.etops': 'Opérations bimoteur à distance (ETOPS)',
      'specialCapabilities.tcas': 'Système anti-collision (TCAS)',
      'specialCapabilities.ads': 'Surveillance dépendante automatique (ADS)',
      // Sous-objets approvedOperations
      'approvedOperations.svfr': 'Vol VFR spécial',
      'approvedOperations.icing': 'Vol en conditions givrantes',
      'approvedOperations.aerial': 'Travail aérien',
      'approvedOperations.banner': 'Remorquage de banderoles',
      'approvedOperations.glider': 'Remorquage de planeurs',
      'approvedOperations.parachute': 'Largage de parachutistes',
      'approvedOperations.night': 'Vol de nuit',
      'approvedOperations.ifr': 'Vol IFR'
    };

    // Champs à ignorer dans la comparaison (métadonnées techniques)
    const fieldsToIgnore = [
      'id', 'baseAircraft', 'isImportedFromCommunity', 'originalCommunityData',
      'communityPresetId', 'importedFromCommunity',
      'createdAt', 'updatedAt', 'version',
      // Métadonnées de la communauté
      'type', 'addedBy', 'dateAdded', 'downloads', 'verified', 'adminVerified',
      'hasFlightManual', 'manualVersion', 'description', 'aircraftId',
      'isVariant', 'hasPerformance', 'communityVersion', 'importDate',
      // Données internes
      'baseFactor', 'wakeTurbulenceCategory', 'baggageCompartments',
      'compatibleRunwaySurfaces', 'cruiseSpeedKt',
      // Les abaques sont traités séparément dans le tableau comparatif
      'performanceModels',
      // MANEX et flightManual - ignorer car structure peut varier sans modification réelle
      'manex', 'flightManual'
    ];

    // Normaliser les valeurs vides
    const normalizeValue = (val) => {
      if (val === null || val === undefined || val === '') return null;
      if (Array.isArray(val) && val.length === 0) return null;
      // Ne pas normaliser les objets (photo, manex, etc.) - ils seront comparés par leur présence/absence
      return val;
    };

    // Formater la valeur pour affichage
    const formatValue = (value) => {
      if (value === null || value === undefined || value === '') return '-';
      if (Array.isArray(value)) return value.join(', ');
      if (typeof value === 'object') {
        // Pour les objets photo, afficher juste "Photo présente"
        if (value.data || value.url || value.base64) return 'Photo présente';
        // Pour les objets MANEX, afficher "MANEX présent"
        if (value.fileName || value.fileUrl || value.uploadedAt) return 'MANEX présent';
        return JSON.stringify(value);
      }
      return String(value);
    };

    // Fonction récursive pour comparer les objets en profondeur
    const compareNestedObjects = (basePath, baseObj, currentObj) => {
      if (!baseObj && !currentObj) return;

      // Si l'un des deux est null/undefined, créer un objet vide
      const baseObject = baseObj || {};
      const currentObject = currentObj || {};

      const allKeys = new Set([...Object.keys(baseObject), ...Object.keys(currentObject)]);

      allKeys.forEach(key => {
        const fullPath = basePath ? `${basePath}.${key}` : key;

        // Ignorer les champs exclus
        if (fieldsToIgnore.includes(key)) return;

        const baseValue = baseObject[key];
        const currentValue = currentObject[key];

        // Si les deux valeurs sont des objets (non-array, non-null), comparer récursivement
        if (
          typeof baseValue === 'object' && baseValue !== null && !Array.isArray(baseValue) &&
          typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue)
        ) {
          compareNestedObjects(fullPath, baseValue, currentValue);
          return;
        }

        const normalizedBase = normalizeValue(baseValue);
        const normalizedCurrent = normalizeValue(currentValue);

        // Comparer avec stringify pour les arrays et objets
        const baseStr = JSON.stringify(normalizedBase);
        const currentStr = JSON.stringify(normalizedCurrent);

        // Détecter les modifications, ajouts et suppressions
        if (baseStr !== currentStr) {
          const isModification = normalizedBase !== null && normalizedCurrent !== null;
          const isAddition = normalizedBase === null && normalizedCurrent !== null;
          const isDeletion = normalizedBase !== null && normalizedCurrent === null;

          if (isModification || isAddition || isDeletion) {
            const label = fieldLabels[fullPath] || fieldLabels[key] || fullPath;
            diffs.push({
              field: label,
              original: formatValue(baseValue),
              modified: formatValue(currentValue)
            });

            const changeType = isAddition ? '➕ Ajout' : isDeletion ? '➖ Suppression' : '✏️ Modification';
            
          }
        }
      });
    };

    // Récupérer tous les champs uniques des deux objets
    const allFields = new Set([...Object.keys(base), ...Object.keys(current)]);

    // Comparer tous les champs
    allFields.forEach(fieldName => {
      // Ignorer les champs exclus
      if (fieldsToIgnore.includes(fieldName)) return;

      const baseValue = base[fieldName];
      const currentValue = current[fieldName];

      // Si les deux valeurs sont des objets (non-array, non-null), comparer récursivement
      if (
        typeof baseValue === 'object' && baseValue !== null && !Array.isArray(baseValue) &&
        typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue)
      ) {
        compareNestedObjects(fieldName, baseValue, currentValue);
        return;
      }

      const normalizedBase = normalizeValue(baseValue);
      const normalizedCurrent = normalizeValue(currentValue);

      // Comparer avec stringify pour les arrays
      const baseStr = JSON.stringify(normalizedBase);
      const currentStr = JSON.stringify(normalizedCurrent);

      // Détecter les modifications, ajouts et suppressions
      if (baseStr !== currentStr) {
        const isModification = normalizedBase !== null && normalizedCurrent !== null;
        const isAddition = normalizedBase === null && normalizedCurrent !== null;
        const isDeletion = normalizedBase !== null && normalizedCurrent === null;

        if (isModification || isAddition || isDeletion) {
          const label = fieldLabels[fieldName] || fieldName;
          diffs.push({
            field: label,
            original: formatValue(baseValue),
            modified: formatValue(currentValue)
          });

          const changeType = isAddition ? '➕ Ajout' : isDeletion ? '➖ Suppression' : '✏️ Modification';
          
        }
      }
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
      
      handleLocalSave();
      return;
    }

    if (data.isImportedFromCommunity) {
      const diffs = calculateDifferences();
      setDifferences(diffs);
      

      if (diffs.length > 0) {
        // Des modifications ont été apportées
        
        setShowDifferencesDialog(true);
      } else {
        // Pas de modifications, enregistrement local simple
        
        handleLocalSave();
      }
    } else {
      // Nouvel avion, proposition directe à la communauté
      
      handleDirectSubmission();
    }
  };

  const handleLocalSave = () => {
    
    

    // Logger les abaques si présents
    if (data.performanceModels && data.performanceModels.length > 0) {
      const totalGraphs = data.performanceModels.reduce((sum, model) =>
        sum + (model.data?.graphs?.length || 0), 0);
      const totalCurves = data.performanceModels.reduce((sum, model) =>
        sum + (model.data?.graphs?.reduce((gSum, graph) =>
          gSum + (graph.curves?.length || 0), 0) || 0), 0);
      const totalPoints = data.performanceModels.reduce((sum, model) =>
        sum + (model.data?.graphs?.reduce((gSum, graph) =>
          gSum + (graph.curves?.reduce((cSum, curve) =>
            cSum + (curve.points?.length || 0), 0) || 0), 0) || 0), 0);

      trackingActions.performanceModelsConfigured(
        data.registration || 'Unknown',
        data.performanceModels.length,
        totalGraphs,
        totalCurves,
        totalPoints
      );
    }

    if (onSave) {
      
      onSave({ mode: 'local', data });
    } else {
      console.error('❌ onSave n\'est pas défini!');
    }
    setShowDifferencesDialog(false);
  };

  const handleCommunitySubmission = () => {
    
    
    if (onSave) {
      
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
    
    
    if (onSave) {
      onSave({
        mode: 'community',
        data,
        differences: null
      });
    } else {
      console.error('❌ onSave n\'est pas défini!');
    }
  };

  // Mettre à jour les données dans Supabase
  const handleUpdateSupabase = async () => {
    if (!data.communityPresetId) {
      setUpdateError('Impossible de trouver l\'ID du preset communautaire');
      return;
    }

    setIsUpdatingSupabase(true);
    setUpdateError(null);

    try {



      // 🔧 FIX: Ne pas sauvegarder localement ici - handleSaveAndUpload s'en charge
      // Cela évite le double appel à handleAircraftSave

      // Préparer les données à envoyer
      const dataToUpdate = { ...data };

      // Supprimer le MANEX des données (il ne doit pas être dans aircraft_data)
      delete dataToUpdate.manex;

      // 🔧 FIX: Ne pas uploader le MANEX s'il est déjà sur Supabase
      let manexFile = null;
      const manexData = data.manex?.pdfData || data.manex?.file;
      const manexAlreadyOnSupabase = data.manex?.uploadedToSupabase || false;

      if (manexData && !manexAlreadyOnSupabase) {
        console.log('📤 Conversion MANEX pour upload Supabase...');
        // Convertir le base64 en blob avec le bon type MIME
        try {
          // Extraire la partie base64 de la data URL
          const base64Data = manexData.includes(',') ? manexData.split(',')[1] : manexData;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          // IMPORTANT: Spécifier explicitement le type MIME comme application/pdf
          manexFile = new Blob([byteArray], { type: 'application/pdf' });

        } catch (conversionError) {
          console.error('❌ Erreur conversion MANEX:', conversionError);
          throw new Error('Erreur lors de la conversion du MANEX');
        }
      } else if (manexAlreadyOnSupabase) {
        console.log('ℹ️ MANEX déjà sur Supabase - Skip upload');
      }

      // Appeler la fonction de mise à jour
      await communityService.updateCommunityPreset(
        data.communityPresetId,
        dataToUpdate,
        manexFile,
        data.manex?.fileName || 'manex.pdf', // Nom du fichier MANEX
        'current-user-id' // En prod: récupérer l'ID utilisateur réel
      );

      // 🔧 FIX: Sauvegarder le MANEX dans IndexedDB localement après upload Supabase
      if (data.manex && data.id) {
        console.log('💾 Sauvegarde du MANEX dans IndexedDB après upload Supabase...');
        console.log('📦 MANEX à sauvegarder:', {
          fileName: data.manex.fileName,
          fileSize: data.manex.fileSize,
          hasPdfData: !!data.manex.pdfData,
          hasFile: !!data.manex.file,
          pdfDataLength: data.manex.pdfData ? data.manex.pdfData.length : 0,
          fileLength: data.manex.file ? data.manex.file.length : 0,
          keys: Object.keys(data.manex)
        });

        // 🔧 FIX: Normaliser le format - le champ peut s'appeler "file" ou "pdfData"
        const normalizedManex = {
          ...data.manex,
          pdfData: data.manex.pdfData || data.manex.file,
          hasData: true
        };

        console.log('✅ MANEX normalisé:', {
          hasPdfData: !!normalizedManex.pdfData,
          pdfDataLength: normalizedManex.pdfData ? normalizedManex.pdfData.length : 0
        });

        try {
          const { default: dataBackupManager } = await import('@utils/dataBackupManager');
          const currentData = await dataBackupManager.getAircraftData(data.id) || {};
          await dataBackupManager.saveAircraftData({
            ...currentData,
            ...data,
            hasManex: true,
            manex: normalizedManex
          });
          console.log('✅ MANEX sauvegardé dans IndexedDB');
        } catch (err) {
          console.error('⚠️ Erreur sauvegarde MANEX IndexedDB:', err);
        }
      }

      setUpdateSuccess(true);
      setIsUpdatingSupabase(false);

      // Afficher un message de succès pendant 3 secondes
      setTimeout(() => {
        setUpdateSuccess(false);
      }, 3000);


    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour Supabase:', error);
      setUpdateError(error.message || 'Erreur lors de la mise à jour');
      setIsUpdatingSupabase(false);
    }
  };

  // Uploader le MANEX vers Supabase
  const handleUploadManexToSupabase = async () => {
    if (!data.registration) {
      setManexUploadError('Immatriculation requise pour uploader le MANEX');
      return;
    }

    if (!data.manex || (!data.manex.file && !data.manex.pdfData)) {
      setManexUploadError('Aucun MANEX à uploader');
      return;
    }

    setIsUploadingManex(true);
    setManexUploadError(null);

    try {


      // 🔧 FIX: Ne pas sauvegarder localement ici - handleSaveAndUpload s'en charge
      // Cela évite le double appel à handleAircraftSave

      // Convertir base64 en blob
      const fileData = data.manex.file || data.manex.pdfData;
      const base64Data = fileData.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Upload vers Supabase
      const result = await communityService.uploadManex(data.registration, blob);

      setManexUploadSuccess(true);
      setTimeout(() => setManexUploadSuccess(false), 3000);

      
    } catch (error) {
      console.error('❌ Erreur upload MANEX:', error);
      setManexUploadError(error.message);
    } finally {
      setIsUploadingManex(false);
    }
  };

  // Fonction fusionnée : Sauvegarder localement ET uploader sur Supabase
  const handleSaveAndUpload = async () => {
    

    // Si un MANEX est présent, uploader vers Supabase
    if (data.manex && (data.manex.file || data.manex.pdfData)) {
      

      // Si c'est un avion de la communauté avec preset ID, mettre à jour
      if (data.isImportedFromCommunity && data.communityPresetId) {
        await handleUpdateSupabase();
      } else {
        // Sinon, uploader le MANEX
        await handleUploadManexToSupabase();
      }
    }

    // Toujours sauvegarder localement et naviguer vers le module aircraft
    
    handleLocalSave();
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

  // 🔍 DEBUG: Vérifier la présence du MANEX
  

  // 🔍 DEBUG: Vérifier la présence des abaques
  
  
  
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
            Vous pouvez les conserver localement ou mettre à jour la base communautaire.
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
          { label: 'Capacité carburant', value: formatValue(data.fuelCapacity, getUnitSymbol(units.fuel)) },
          { label: 'Consommation', value: formatValue(data.fuelConsumption, getUnitSymbol(units.fuelConsumption)) },
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
      {(() => {
        // Construire dynamiquement la liste des champs
        const weightBalanceFields = [
          { label: 'Masse à vide', value: formatValue(data.weights?.emptyWeight, getUnitSymbol(units.weight)) },
          { label: 'Bras de levier à vide', value: formatValue(data.arms?.empty, getUnitSymbol(units.armLength)) },
          { label: 'MTOW', value: formatValue(data.weights?.mtow, getUnitSymbol(units.weight)) },
          { label: 'MLW', value: formatValue(data.weights?.mlw, getUnitSymbol(units.weight)) },
          { label: 'MZFW', value: formatValue(data.weights?.mzfw, getUnitSymbol(units.weight)) },
          { label: 'Carburant max', value: formatValue(data.fuel?.maxCapacity || data.fuelCapacity, getUnitSymbol(units.fuel)) },
          { label: 'Bras carburant', value: formatValue(data.arms?.fuelMain, getUnitSymbol(units.armLength)) },
          { label: 'Bras sièges avant', value: formatValue(data.arms?.frontSeats, getUnitSymbol(units.armLength)) },
          { label: 'Bras sièges arrière', value: formatValue(data.arms?.rearSeats, getUnitSymbol(units.armLength)) }
        ];

        // Ajouter dynamiquement les compartiments bagages configurés par le pilote
        if (data.baggageCompartments && data.baggageCompartments.length > 0) {
          data.baggageCompartments.forEach(compartment => {
            weightBalanceFields.push({
              label: `${compartment.name || 'Compartiment'}${compartment.maxWeight ? ` (max ${compartment.maxWeight} ${getUnitSymbol(units.weight)})` : ''}`,
              value: formatValue(compartment.arm, getUnitSymbol(units.armLength))
            });
          });
        }

        // Ajouter les limites CG
        weightBalanceFields.push(
          { label: 'CG limite avant min', value: formatValue(data.cgEnvelope?.forwardPoints?.[0]?.cg, getUnitSymbol(units.armLength)) },
          { label: 'CG limite arrière', value: formatValue(data.cgEnvelope?.aftCG, getUnitSymbol(units.armLength)) }
        );

        return renderSection(
          'Masse et centrage',
          <ScaleIcon color="primary" />,
          4,
          weightBalanceFields,
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
        );
      })()}

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
          {data.advancedPerformance || data.performanceTables || data.performanceModels ? (
            <Box>
              {/* Affichage des abaques depuis performanceModels */}
              {data.performanceModels && data.performanceModels.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                    Abaques de Performance ({data.performanceModels.length})
                  </Typography>
                  {data.performanceModels.map((model, index) => {
                    // Compter les courbes et points
                    const totalCurves = model.data?.graphs?.reduce((sum, graph) =>
                      sum + (graph.curves?.length || 0), 0) || 0;
                    const totalPoints = model.data?.graphs?.reduce((sum, graph) =>
                      sum + (graph.curves?.reduce((curveSum, curve) =>
                        curveSum + (curve.points?.length || 0), 0) || 0), 0) || 0;

                    return (
                      <Box
                        key={index}
                        sx={{
                          mb: 2,
                          p: 1.5,
                          bgcolor: '#f0f9ff',
                          borderRadius: '6px',
                          border: '2px solid #2196F3'
                        }}
                      >
                        <Typography sx={{ fontWeight: 500, mb: 1, fontSize: '15px' }}>
                          {model.name || `Abaque ${index + 1}`}
                        </Typography>
                        <Typography sx={{ fontSize: '14px', color: '#6b7280' }}>
                          Type: {model.type || 'abaque'}
                        </Typography>
                        {model.data?.graphs && (
                          <>
                            <Typography sx={{ fontSize: '14px', color: '#6b7280', mt: 0.5 }}>
                              📊 {model.data.graphs.length} graphique(s)
                            </Typography>
                            {totalCurves > 0 && (
                              <Typography sx={{ fontSize: '14px', color: '#6b7280', mt: 0.5 }}>
                                📈 {totalCurves} courbe(s)
                              </Typography>
                            )}
                            {totalPoints > 0 && (
                              <Typography sx={{ fontSize: '14px', color: '#6b7280', mt: 0.5 }}>
                                📍 {totalPoints} point(s) de données
                              </Typography>
                            )}
                          </>
                        )}
                      </Box>
                    );
})}
                </Box>
              )}

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
                    ))}
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
                    ))}
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
                    ))}
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
          {/* Tableau comparatif des modifications */}
          {(() => {
            const variantDiffs = calculateVariantDifferences();

            // Détecter les modifications d'abaques - comparaison intelligente par NOM (pas par index)
            const baseAbaques = data.baseAircraft?.performanceModels || [];
            const currentAbaques = data.performanceModels || [];

            // Créer des maps par nom pour faciliter la comparaison
            const baseAbaquesMap = new Map(baseAbaques.map(a => [a.name, a]));
            const currentAbaquesMap = new Map(currentAbaques.map(a => [a.name, a]));

            // Déterminer quels abaques ont été ajoutés, modifiés ou supprimés
            const modifiedAbaques = [];
            let hasAbaqueChanges = false;

            // Vérifier les abaques ajoutés et modifiés
            currentAbaques.forEach(currentAbaque => {
              const abaqueName = currentAbaque.name;
              const baseAbaque = baseAbaquesMap.get(abaqueName);

              if (!baseAbaque) {
                // Abaque ajouté
                hasAbaqueChanges = true;
                modifiedAbaques.push(currentAbaque);
                
              } else {
                // Abaque existe, vérifier s'il a été modifié
                let isModified = false;

                // Comparer type
                if (baseAbaque.type !== currentAbaque.type) {
                  isModified = true;
                  
                }

                // Comparer le nombre de graphiques
                const baseGraphCount = baseAbaque.data?.graphs?.length || 0;
                const currentGraphCount = currentAbaque.data?.graphs?.length || 0;
                if (baseGraphCount !== currentGraphCount) {
                  isModified = true;
                  
                }

                // Comparer chaque graphique en détail
                if (baseAbaque.data?.graphs && currentAbaque.data?.graphs) {
                  for (let j = 0; j < Math.max(baseGraphCount, currentGraphCount); j++) {
                    const baseGraph = baseAbaque.data.graphs[j];
                    const currentGraph = currentAbaque.data.graphs[j];

                    if (!baseGraph || !currentGraph) {
                      isModified = true;
                      
                      break;
                    }

                    // Comparer les axes
                    const baseAxes = JSON.stringify(baseGraph.axes || {});
                    const currentAxes = JSON.stringify(currentGraph.axes || {});
                    if (baseAxes !== currentAxes) {
                      isModified = true;
                      
                      break;
                    }

                    // Comparer le nombre de courbes
                    const baseCurveCount = baseGraph.curves?.length || 0;
                    const currentCurveCount = currentGraph.curves?.length || 0;
                    if (baseCurveCount !== currentCurveCount) {
                      isModified = true;
                      
                      break;
                    }

                    // Comparer chaque courbe (nombre de points)
                    if (baseGraph.curves && currentGraph.curves) {
                      for (let k = 0; k < baseGraph.curves.length; k++) {
                        const baseCurve = baseGraph.curves[k];
                        const currentCurve = currentGraph.curves[k];

                        const basePointCount = baseCurve.points?.length || 0;
                        const currentPointCount = currentCurve.points?.length || 0;
                        if (basePointCount !== currentPointCount) {
                          isModified = true;
                          
                          break;
                        }
                      }
                    }

                    if (isModified) break;
                  }
                }

                if (isModified) {
                  hasAbaqueChanges = true;
                  modifiedAbaques.push(currentAbaque);
                  
                }
              }
            });

            // Vérifier les abaques supprimés
            baseAbaques.forEach(baseAbaque => {
              if (!currentAbaquesMap.has(baseAbaque.name)) {
                hasAbaqueChanges = true;
                
              }
            });

            // 🔍 DEBUG: Vérifier la comparaison des abaques
            
            
            
            
            
            
            
            
            
            

            if (variantDiffs.length > 0 || hasAbaqueChanges) {
              return (
                <Paper elevation={2} sx={{ mb: 3, maxWidth: 1000, mx: 'auto', p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <DifferenceIcon color="primary" />
                    <Typography variant="h6">
                      Tableau comparatif des modifications
                    </Typography>
                  </Box>

                  {/* Section Abaques si modifiés */}
                  {hasAbaqueChanges && modifiedAbaques.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                        📊 Systèmes d'abaques ajoutés/modifiés
                      </Typography>
                      {modifiedAbaques.map((model, index) => {
                        const totalCurves = model.data?.graphs?.reduce((sum, graph) =>
                          sum + (graph.curves?.length || 0), 0) || 0;
                        const totalPoints = model.data?.graphs?.reduce((sum, graph) =>
                          sum + (graph.curves?.reduce((curveSum, curve) =>
                            curveSum + (curve.points?.length || 0), 0) || 0), 0) || 0;

                        return (
                          <Box
                            key={index}
                            sx={{
                              mb: 2,
                              p: 1.5,
                              bgcolor: '#f0f9ff',
                              borderRadius: '6px',
                              border: '2px solid #2196F3'
                            }}
                          >
                            <Typography sx={{ fontWeight: 500, mb: 1, fontSize: '15px' }}>
                              {model.name || `Abaque ${index + 1}`}
                            </Typography>
                            <Typography sx={{ fontSize: '14px', color: '#6b7280' }}>
                              Type: {model.type || 'abaque'}
                            </Typography>
                            {model.data?.graphs && (
                              <>
                                <Typography sx={{ fontSize: '14px', color: '#6b7280', mt: 0.5 }}>
                                  📊 {model.data.graphs.length} graphique(s)
                                </Typography>
                                {totalCurves > 0 && (
                                  <Typography sx={{ fontSize: '14px', color: '#6b7280', mt: 0.5 }}>
                                    📈 {totalCurves} courbe(s)
                                  </Typography>
                                )}
                                {totalPoints > 0 && (
                                  <Typography sx={{ fontSize: '14px', color: '#6b7280', mt: 0.5 }}>
                                    📍 {totalPoints} point(s) de données
                                  </Typography>
                                )}
                              </>
                            )}
                          </Box>
                        );
})}
                    </Box>
                  )}

                  {/* Tableau des autres modifications */}
                  {variantDiffs.length > 0 && (
                    <>
                      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                        Autres modifications
                      </Typography>
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
                    </>
                  )}

                  <Box sx={{ mt: 2, p: 1, bgcolor: 'info.50', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {variantDiffs.length + (hasAbaqueChanges ? modifiedAbaques.length : 0)} modification{(variantDiffs.length + (hasAbaqueChanges ? modifiedAbaques.length : 0)) > 1 ? 's' : ''} détectée{(variantDiffs.length + (hasAbaqueChanges ? modifiedAbaques.length : 0)) > 1 ? 's' : ''} par rapport à la configuration de base
                      {hasAbaqueChanges && ` (dont ${modifiedAbaques.length} abaque${modifiedAbaques.length > 1 ? 's' : ''})`}
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

      {/* Messages de mise à jour Supabase */}
      {updateError && (
        <Alert severity="error" sx={{ mb: 3, maxWidth: 800, mx: 'auto' }}>
          {updateError}
        </Alert>
      )}
      {updateSuccess && (
        <Alert severity="success" sx={{ mb: 3, maxWidth: 800, mx: 'auto' }}>
          ✅ Mise à jour Supabase réussie ! La version a été incrémentée.
        </Alert>
      )}

      {/* Messages d'upload MANEX */}
      {manexUploadError && (
        <Alert severity="error" sx={{ mb: 3, maxWidth: 800, mx: 'auto' }}>
          {manexUploadError}
        </Alert>
      )}
      {manexUploadSuccess && (
        <Alert severity="success" sx={{ mb: 3, maxWidth: 800, mx: 'auto' }}>
          ✅ MANEX uploadé vers Supabase avec succès !
        </Alert>
      )}

      {/* Boutons d'action */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 4 }}>
        {/* Bouton fusionné : Ajouter à ma liste d'avion + Upload Supabase */}
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={(isUpdatingSupabase || isUploadingManex) ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={handleSaveAndUpload}
          disabled={isUpdatingSupabase || isUploadingManex}
          sx={{ px: 4 }}
        >
          {isUpdatingSupabase || isUploadingManex ? 'Traitement en cours...' : 'Ajouter à ma liste d\'avion'}
        </Button>
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
                  {differences.slice(0, 10).map((diff, index) => {
                    // Fonction pour afficher la valeur (texte ou image)
                    const renderValue = (value, isOriginal = false) => {
                      // Si c'est un objet photo
                      if (typeof value === 'object' && value !== null &&
                          (value.data || value.url || value.base64)) {
                        const imgSrc = value.data || value.url || value.base64;
                        return (
                          <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
                            <img
                              src={imgSrc}
                              alt={isOriginal ? "Photo originale" : "Nouvelle photo"}
                              style={{
                                maxWidth: '150px',
                                maxHeight: '150px',
                                objectFit: 'contain',
                                borderRadius: '4px',
                                border: '1px solid #ddd'
                              }}
                            />
                          </Box>
                        );
                      }
                      // Sinon afficher le texte normalement
                      return (
                        <Typography variant="body2" color={isOriginal ? "text.secondary" : "primary"}>
                          {typeof value === 'object' && value !== null
                            ? JSON.stringify(value)
                            : (value || 'Non défini')}
                        </Typography>
                      );
                    };

                    return (
                      <TableRow key={index}>
                        <TableCell>{diff.field}</TableCell>
                        <TableCell>
                          {renderValue(diff.original, true)}
                        </TableCell>
                        <TableCell>
                          {renderValue(diff.modified, false)}
                        </TableCell>
                      </TableRow>
                    );
})}
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
            {/* DÉSACTIVÉ TEMPORAIREMENT - À réimplémenter plus tard
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
            */}

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
            onClick={handleLocalSave}
          >
            Enregistrer
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