import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepIcon,
  Button,
  Paper,
  CircularProgress,
  Alert,
  styled,
  FormControlLabel,
  Checkbox,
  useMediaQuery,
  useTheme,
  Chip,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Flight as FlightIcon,
  Speed as SpeedIcon,
  Scale as ScaleIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Save as SaveIcon,
  Settings as SettingsIcon,
  Build as BuildIcon,
  FlightTakeoff as TakeoffIcon,
  Notes as NotesIcon,
  Close as CloseIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAircraft } from '../../../core/contexts';

// Import des étapes
import Step0CommunityCheck from './wizard-steps/Step0CommunityCheck';
import Step1BasicInfo from './wizard-steps/Step1BasicInfo';
import Step2Speeds from './wizard-steps/Step2Speeds';
import Step3WeightBalance from './wizard-steps/Step3WeightBalance';
import Step4Performance from './wizard-steps/Step4Performance';
import Step5Equipment from './wizard-steps/Step5Equipment';
import Step6Operations from './wizard-steps/Step6Operations';
import Step7Remarks from './wizard-steps/Step7Remarks';
import Step5Review from './wizard-steps/Step5Review';

// Style personnalisé pour le Stepper
const CustomStepIcon = styled(StepIcon)(({ theme, ownerState }) => ({
  '&.Mui-active': {
    color: theme.palette.primary.main,
  },
  '&.Mui-completed': {
    color: theme.palette.success.main,
  },
}));

function AircraftCreationWizard({ onComplete, onCancel, onClose, existingAircraft = null }) {
  // Hook pour accéder au contexte des avions
  const { addAircraft, updateAircraft, setSelectedAircraft } = useAircraft();

  // Vérifier s'il y a un brouillon à reprendre
  const loadDraftIfExists = () => {
    // Si on a un existingAircraft, c'est qu'on édite, pas qu'on reprend un brouillon
    if (existingAircraft) return null;

    const draft = localStorage.getItem('aircraft_wizard_draft');
    if (draft) {
      try {
        const draftData = JSON.parse(draft);
        console.log('📂 Reprise du brouillon:', draftData);
        return draftData;
      } catch (e) {
        console.error('❌ Erreur lors du chargement du brouillon:', e);
      }
    }
    return null;
  };

  const draft = loadDraftIfExists();

  // État principal - utilisant EXACTEMENT la même structure que AircraftModule
  const [aircraftData, setAircraftData] = useState(draft?.aircraftData || {
    id: existingAircraft?.id || existingAircraft?.aircraftId || undefined,
    aircraftId: existingAircraft?.aircraftId || existingAircraft?.id || undefined,
    registration: existingAircraft?.registration || '',
    model: existingAircraft?.model || '',
    fuelType: existingAircraft?.fuelType || 'AVGAS',
    fuelCapacity: existingAircraft?.fuelCapacity || '',
    cruiseSpeedKt: existingAircraft?.cruiseSpeedKt || existingAircraft?.cruiseSpeed || '',
    baseFactor: existingAircraft?.baseFactor || '',
    fuelConsumption: existingAircraft?.fuelConsumption || '',
    wakeTurbulenceCategory: existingAircraft?.wakeTurbulenceCategory || 'L',
    engineType: existingAircraft?.engineType || 'singleEngine',
    compatibleRunwaySurfaces: existingAircraft?.compatibleRunwaySurfaces || [],
    photo: existingAircraft?.photo || null,
    manex: existingAircraft?.manex || null,

    // Vitesses caractéristiques
    speeds: {
      vso: existingAircraft?.speeds?.vso || '',
      vs1: existingAircraft?.speeds?.vs1 || '',
      vfe: existingAircraft?.speeds?.vfe || '',
      vfeLdg: existingAircraft?.speeds?.vfeLdg || '',
      vfeTO: existingAircraft?.speeds?.vfeTO || '',
      vno: existingAircraft?.speeds?.vno || '',
      vne: existingAircraft?.speeds?.vne || '',
      vr: existingAircraft?.speeds?.vr || '',
      vx: existingAircraft?.speeds?.vx || '',
      vy: existingAircraft?.speeds?.vy || '',
      vapp: existingAircraft?.speeds?.vapp || '',
      vglide: existingAircraft?.speeds?.vglide || '',
      vle: existingAircraft?.speeds?.vle || '',
      vlo: existingAircraft?.speeds?.vlo || '',
      initialClimb: existingAircraft?.speeds?.initialClimb || '',
      voRanges: existingAircraft?.speeds?.voRanges || []
    },
    
    // Masses et centrage
    weights: {
      emptyWeight: existingAircraft?.weights?.emptyWeight || '',
      mtow: existingAircraft?.weights?.mtow || '',
      mlw: existingAircraft?.weights?.mlw || '',
      minTakeoffWeight: existingAircraft?.weights?.minTakeoffWeight || '',
      maxPayload: existingAircraft?.weights?.maxPayload || '',
      maxBaggageFwd: existingAircraft?.weights?.maxBaggageFwd || '',
      maxBaggageAft: existingAircraft?.weights?.maxBaggageAft || ''
    },
    
    arms: {
      empty: existingAircraft?.arms?.empty || '',
      frontSeats: existingAircraft?.arms?.frontSeats || '',
      rearSeats: existingAircraft?.arms?.rearSeats || '',
      fuelMain: existingAircraft?.arms?.fuelMain || '',
      baggageFwd: existingAircraft?.arms?.baggageFwd || '',
      baggageAft: existingAircraft?.arms?.baggageAft || ''
    },
    
    cgLimits: {
      forward: existingAircraft?.cgLimits?.forward || '',
      aft: existingAircraft?.cgLimits?.aft || ''
    },

    // Enveloppe de centrage (CG Envelope)
    cgEnvelope: {
      // Points Forward CG (nouveau format)
      forwardPoints: (() => {
        // Si le nouveau format existe déjà, l'utiliser
        if (existingAircraft?.cgEnvelope?.forwardPoints && existingAircraft.cgEnvelope.forwardPoints.length > 0) {
          return existingAircraft.cgEnvelope.forwardPoints;
        }
        // Sinon, migrer depuis l'ancien format si disponible
        if (existingAircraft?.cgEnvelope?.forwardMinWeight || existingAircraft?.cgEnvelope?.forwardMaxWeight || existingAircraft?.cgEnvelope?.forwardCG) {
          const points = [];
          if (existingAircraft.cgEnvelope.forwardMinWeight && existingAircraft.cgEnvelope.forwardCG) {
            points.push({
              id: Date.now() + Math.random(),
              weight: existingAircraft.cgEnvelope.forwardMinWeight,
              cg: existingAircraft.cgEnvelope.forwardCG
            });
          }
          if (existingAircraft.cgEnvelope.forwardMaxWeight && existingAircraft.cgEnvelope.forwardCG &&
              existingAircraft.cgEnvelope.forwardMaxWeight !== existingAircraft.cgEnvelope.forwardMinWeight) {
            points.push({
              id: Date.now() + Math.random() + 1,
              weight: existingAircraft.cgEnvelope.forwardMaxWeight,
              cg: existingAircraft.cgEnvelope.forwardCG
            });
          }
          return points;
        }
        return [];
      })(),
      aftMinWeight: existingAircraft?.cgEnvelope?.aftMinWeight || '',
      aftCG: existingAircraft?.cgEnvelope?.aftCG || '',
      aftMaxWeight: existingAircraft?.cgEnvelope?.aftMaxWeight || ''
    },

    envelope: {
      points: existingAircraft?.envelope?.points || []
    },

    // Compartiments bagages
    baggageCompartments: existingAircraft?.baggageCompartments || [],

    // Sièges supplémentaires
    additionalSeats: existingAircraft?.additionalSeats || [],

    // Performances
    advancedPerformance: existingAircraft?.advancedPerformance || null,
    performanceTables: existingAircraft?.performanceTables || null,
    performanceModels: existingAircraft?.performanceModels || null,
    performance: {
      takeoff: {
        groundRoll: existingAircraft?.performance?.takeoff?.groundRoll || '',
        fiftyFeet: existingAircraft?.performance?.takeoff?.fiftyFeet || '',
        climbRate: existingAircraft?.performance?.takeoff?.climbRate || '',
        serviceCeiling: existingAircraft?.performance?.takeoff?.serviceCeiling || ''
      },
      landing: {
        groundRoll: existingAircraft?.performance?.landing?.groundRoll || '',
        fiftyFeet: existingAircraft?.performance?.landing?.fiftyFeet || ''
      },
      cruise: {
        speed75: existingAircraft?.performance?.cruise?.speed75 || '',
        speed65: existingAircraft?.performance?.cruise?.speed65 || '',
        endurance: existingAircraft?.performance?.cruise?.endurance || '',
        range: existingAircraft?.performance?.cruise?.range || ''
      },
      fuel: {
        cruise: existingAircraft?.performance?.fuel?.cruise || '',
        takeoff: existingAircraft?.performance?.fuel?.takeoff || '',
        economy: existingAircraft?.performance?.fuel?.economy || ''
      }
    },
    
    // Limitations de vent
    windLimits: {
      maxCrosswind: existingAircraft?.windLimits?.maxCrosswind || '',
      maxTailwind: existingAircraft?.windLimits?.maxTailwind || '',
      maxCrosswindWet: existingAircraft?.windLimits?.maxCrosswindWet || ''
    },
    
    // Équipements
    equipmentCom: existingAircraft?.equipmentCom || {
      vhf1: true,
      vhf2: true,
      hf: false,
      satcom: false,
      elt: true,
      acars: false,
      cpdlc: false
    },
    equipmentNav: existingAircraft?.equipmentNav || {
      vor: true,
      dme: true,
      adf: false,
      gnss: true,
      ils: true,
      mls: false,
      gbas: false,
      lpv: false,
      rnav: false,
      rnavTypes: '',
      rnp: false,
      rnpTypes: ''
    },
    equipmentSurv: existingAircraft?.equipmentSurv || {
      transponderMode: 'C',
      adsb: false,
      adsc: false,
      tcas: false,
      acas: false,
      taws: false,
      cvr: false,
      fdr: false,
      weather: false
    },
    specialCapabilities: existingAircraft?.specialCapabilities || {
      pbn: false,
      lvto: false,
      catII: false,
      catIIIa: false,
      catIIIb: false,
      catIIIc: false,
      etops: false,
      rvsm: false,
      mnps: false,
      icing: false
    },
    
    // Opérations
    minimumRunwayLength: existingAircraft?.minimumRunwayLength || '',
    serviceCeiling: existingAircraft?.serviceCeiling || '',
    approvedOperations: existingAircraft?.approvedOperations || {},
    
    // Remarques
    remarks: existingAircraft?.remarks || '',
    
    // Unités préférées (synchronisées avec le store global)
    units: {}
  });

  // En mode édition (existingAircraft présent), commencer à l'étape 1
  // Si on reprend un brouillon, commencer à l'étape sauvegardée
  const [currentStep, setCurrentStep] = useState(
    draft?.currentStep ?? (existingAircraft ? 1 : 0)
  );
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success', closeable: true, duration: 6000 });
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Effet pour gérer le retour à l'étape 0 quand on détecte une immatriculation existante
  useEffect(() => {
    if (aircraftData.shouldReturnToStep0) {
      setCurrentStep(0);
      // Nettoyer le flag
      setAircraftData(prev => {
        const newData = { ...prev };
        delete newData.shouldReturnToStep0;
        return newData;
      });
    }
  }, [aircraftData.shouldReturnToStep0]);

  // Sauvegarder l'état de l'assistant dans localStorage
  const saveWizardState = () => {
    const wizardState = {
      aircraftData,
      currentStep,
      timestamp: new Date().toISOString(),
      isEdit: !!existingAircraft
    };
    localStorage.setItem('aircraft_wizard_draft', JSON.stringify(wizardState));
    console.log('💾 État de l\'assistant sauvegardé:', wizardState);
  };


  // Annuler et sauvegarder l'état
  const handleCancel = () => {
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = (saveState) => {
    const closeCallback = onClose || onCancel;

    if (saveState) {
      saveWizardState();
      setNotification({
        open: true,
        message: 'Configuration sauvegardée. Vous pourrez la reprendre depuis le tableau de bord.',
        severity: 'info'
      });

      setShowCancelDialog(false);

      // Fermer l'assistant après un court délai
      setTimeout(() => {
        if (closeCallback) {
          closeCallback();
        }
      }, 500);
    } else {
      // Supprimer le brouillon
      localStorage.removeItem('aircraft_wizard_draft');

      setShowCancelDialog(false);

      // Fermer l'assistant
      if (closeCallback) {
        closeCallback();
      }
    }
  };

  // Configuration des étapes
  const steps = [
    {
      label: 'Base de données',
      description: 'Vérification communautaire',
      icon: <FlightIcon />
    },
    {
      label: 'Informations générales',
      description: "Identification de l'appareil",
      icon: <FlightIcon />
    },
    {
      label: 'Masse & Centrage',
      description: 'Poids et équilibrage',
      icon: <ScaleIcon />
    },
    {
      label: 'Vitesses',
      description: 'Vitesses caractéristiques',
      icon: <SpeedIcon />
    },
    {
      label: 'Performances Avancées',
      description: 'Abaques interactifs et extraction de tableaux',
      icon: <TrendingUpIcon />
    },
    {
      label: 'Équipements',
      description: 'Équipements de bord',
      icon: <BuildIcon />
    },
    {
      label: 'Opérations',
      description: 'Limitations opérationnelles',
      icon: <TakeoffIcon />
    },
    {
      label: 'Remarques',
      description: 'Notes additionnelles',
      icon: <NotesIcon />
    },
    {
      label: 'Vérification',
      description: 'Révision finale',
      icon: <CheckCircleIcon />
    }
  ];

  // Fonction de mise à jour des données
  const updateData = (path, value) => {
    console.log('Update Data - Path:', path, 'Value:', value);
    
    setAircraftData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
      
      current[keys[keys.length - 1]] = value;
      console.log('Updated aircraft data:', newData);
      return newData;
    });
    
    // Effacer l'erreur si elle existe
    const errorKey = path.includes('.') ? path.split('.').pop() : path;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  // Validation des étapes
  const validateStep = (stepIndex) => {
    const newErrors = {};
    
    switch (stepIndex) {
      case 0: // Unités - pas de validation requise
        break;
        
      case 1: // Informations générales
        if (!aircraftData.registration) newErrors.registration = "L'immatriculation est requise";
        if (!aircraftData.model) newErrors.model = "Le modèle est requis";
        if (!aircraftData.fuelCapacity) newErrors.fuelCapacity = "La capacité carburant est requise";
        if (!aircraftData.cruiseSpeedKt) newErrors.cruiseSpeedKt = "La vitesse de croisière est requise";
        break;
        
      case 2: // Masse et centrage
        if (!aircraftData.weights?.emptyWeight) newErrors.emptyWeight = "La masse à vide est requise";
        if (!aircraftData.weights?.mtow) newErrors.mtow = "La masse maximale est requise";
        break;

      case 3: // Vitesses
        // Vitesses critiques requises uniquement
        if (!aircraftData.speeds?.vso || aircraftData.speeds.vso === '') {
          newErrors.vso = "VSO est requise";
        }
        if (!aircraftData.speeds?.vs1 || aircraftData.speeds.vs1 === '') {
          newErrors.vs1 = "VS1 est requise";
        }
        if (!aircraftData.speeds?.vne || aircraftData.speeds.vne === '') {
          newErrors.vne = "VNE est requise";
        }
        if (!aircraftData.speeds?.vfeTO || aircraftData.speeds.vfeTO === '') {
          newErrors.vfeTO = "VFE T/O est requise";
        }
        if (!aircraftData.speeds?.vfeLdg || aircraftData.speeds.vfeLdg === '') {
          newErrors.vfeLdg = "VFE LDG est requise";
        }
        if (!aircraftData.speeds?.vno || aircraftData.speeds.vno === '') {
          newErrors.vno = "VNO est requise";
        }
        // Les vitesses suivantes sont facultatives - pas de validation
        // VA, VR, VX, VY, initialClimb, vglide sont facultatives
        // VO ranges sont facultatives

        // Limitations de vent requises
        if (!aircraftData.windLimits?.maxCrosswind || aircraftData.windLimits.maxCrosswind === '') {
          newErrors.maxCrosswind = "Le vent traversier max est requis";
        }
        if (!aircraftData.windLimits?.maxTailwind || aircraftData.windLimits.maxTailwind === '') {
          newErrors.maxTailwind = "Le vent arrière max est requis";
        }
        if (!aircraftData.windLimits?.maxCrosswindWet || aircraftData.windLimits.maxCrosswindWet === '') {
          newErrors.maxCrosswindWet = "Le vent traversier max sur piste mouillée est requis";
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigation
  const handleNext = () => {
    const isValid = validateStep(currentStep);

    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    } else {
      // Les erreurs sont déjà affichées dans les composants
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleAircraftSave = async (saveData) => {
    console.log('=== handleAircraftSave appelé ===', saveData);
    setIsLoading(true);
    try {
      const dataToSave = saveData.data;

      // Convertir flightManual en manex si présent
      if (dataToSave.flightManual?.file) {
        console.log('🔄 Conversion flightManual → manex:', dataToSave.flightManual.file.name);
        dataToSave.manex = {
          fileName: dataToSave.flightManual.file.name || 'MANEX.pdf',
          fileSize: dataToSave.flightManual.file.size ?
            (dataToSave.flightManual.file.size / 1024 / 1024).toFixed(2) + ' MB' :
            'Taille inconnue',
          uploadDate: dataToSave.flightManual.uploadDate || new Date().toISOString(),
          pdfData: dataToSave.flightManual.file
        };
        // Retirer flightManual des données à sauvegarder
        delete dataToSave.flightManual;
        console.log('✅ manex créé:', dataToSave.manex.fileName, dataToSave.manex.fileSize);
      }

      // Calculer le baseFactor si nécessaire
      if (dataToSave.cruiseSpeedKt && !dataToSave.baseFactor) {
        dataToSave.baseFactor = (60 / parseFloat(dataToSave.cruiseSpeedKt)).toFixed(3);
      }

      if (saveData.mode === 'community') {
        // Soumission à la communauté
        console.log('Soumission à la communauté:', dataToSave);

        // Si c'est une mise à jour (avion importé avec modifications)
        if (saveData.differences) {
          console.log('Différences détectées:', saveData.differences);
          // TODO: Appeler l'API pour soumettre les modifications
          // await submitAircraftUpdate(dataToSave.registration, dataToSave, saveData.differences);
        } else {
          // Nouvelle configuration
          // TODO: Appeler l'API pour soumettre la nouvelle configuration
          // await submitNewAircraft(dataToSave);
        }

        // Message de succès pour soumission communautaire
        console.log('📢 Configuration de la notification pour soumission communautaire');
        const notif = {
          open: true,
          message: `Configuration soumise à la communauté pour ${dataToSave.registration}. Elle sera validée après 10 votes positifs.`,
          severity: 'success'
        };
        console.log('📢 Notification communautaire:', notif);
        setNotification(notif);
        console.log('📢 État notification après setNotification:', notification);
      } else {
        // Enregistrement local uniquement
        console.log('Enregistrement local:', dataToSave);
      }

      // Déterminer s'il faut ajouter ou mettre à jour
      let savedAircraft;
      if (dataToSave.id || dataToSave.aircraftId) {
        console.log('Appel de updateAircraft avec:', dataToSave);
        savedAircraft = updateAircraft(dataToSave);
        console.log('Résultat de updateAircraft:', savedAircraft);
      } else {
        console.log('Appel de addAircraft avec:', dataToSave);
        savedAircraft = await addAircraft(dataToSave);
        console.log('Résultat de addAircraft:', savedAircraft);
      }

      // Sélectionner le nouvel avion
      if (savedAircraft) {
        console.log('Avion sauvegardé avec succès, sélection...');
        setSelectedAircraft(savedAircraft);

        if (saveData.mode === 'local') {
          console.log('📢 Configuration de la notification pour enregistrement local');
          const notif = {
            open: true,
            message: `L'avion ${dataToSave.registration} a été enregistré localement avec succès !`,
            severity: 'success'
          };
          console.log('📢 Notification:', notif);
          setNotification(notif);
          console.log('📢 État notification après setNotification:', notification);
        }

        // Afficher un message de succès et fermer le wizard après un délai
        console.log('Enregistrement réussi, appel de onComplete dans 0.5s...');

        // Nettoyer le localStorage des données temporaires
        try {
          localStorage.removeItem('wizard_performance_temp');
          localStorage.removeItem('aircraft_wizard_draft'); // Supprimer le brouillon
          console.log('🧹 Données temporaires nettoyées du localStorage');
        } catch (e) {
          console.error('Erreur lors du nettoyage du localStorage:', e);
        }

        setTimeout(() => {
          console.log('Timeout exécuté, onComplete existe?', !!onComplete);
          // Si onComplete existe, l'appeler pour fermer le wizard
          if (onComplete) {
            console.log('Appel de onComplete avec:', dataToSave);
            onComplete(dataToSave);
          } else {
            console.log('onComplete non défini, tentative de retour à la page d\'accueil');
            // Retourner à la page d'accueil en utilisant le système de navigation
            // Recherche du bouton "Avions" dans la navigation et simule un clic
            const aircraftTab = document.querySelector('[data-tab-id="aircraft"]');
            if (aircraftTab) {
              aircraftTab.click();
            } else {
              // Fallback: recharger la page
              window.location.reload();
            }
          }
        }, 500);
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
      setNotification({
        open: true,
        message: `Erreur lors de l'enregistrement: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Calculer le baseFactor si nécessaire
      if (aircraftData.cruiseSpeedKt && !aircraftData.baseFactor) {
        aircraftData.baseFactor = (60 / parseFloat(aircraftData.cruiseSpeedKt)).toFixed(3);
      }

      // Convertir flightManual en manex si présent
      const dataToSave = { ...aircraftData };
      if (aircraftData.flightManual?.file) {
        dataToSave.manex = {
          fileName: aircraftData.flightManual.file.name || 'MANEX.pdf',
          fileSize: aircraftData.flightManual.file.size ?
            (aircraftData.flightManual.file.size / 1024 / 1024).toFixed(2) + ' MB' :
            'Taille inconnue',
          uploadDate: aircraftData.flightManual.uploadDate || new Date().toISOString(),
          pdfData: aircraftData.flightManual.file
        };
        // Retirer flightManual des données à sauvegarder
        delete dataToSave.flightManual;
      }

      // Ajouter l'avion au store
      const savedAircraft = await addAircraft(dataToSave);

      // Sélectionner le nouvel avion
      if (savedAircraft) {
        setSelectedAircraft(savedAircraft);

        // Afficher notification de succès
        setNotification({
          open: true,
          message: `L'avion ${aircraftData.registration} a été enregistré avec succès !`,
          severity: 'success'
        });

        // Fermer le wizard après un délai
        setTimeout(() => {
          if (onComplete) {
            onComplete(dataToSave);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setNotification({
        open: true,
        message: `Erreur lors de la sauvegarde: ${error.message || 'Erreur inconnue'}`,
        severity: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Rendu du contenu de l'étape
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <Step0CommunityCheck data={aircraftData} updateData={updateData} onSkip={() => handleNext()} onComplete={onComplete} />;
      case 1:
        return <Step1BasicInfo data={aircraftData} updateData={updateData} errors={errors} />;
      case 2:
        return <Step3WeightBalance data={aircraftData} updateData={updateData} errors={errors} />;
      case 3:
        return <Step2Speeds data={aircraftData} updateData={updateData} errors={errors} />;
      case 4:
        return <Step4Performance data={aircraftData} updateData={updateData} errors={errors} />;
      case 5:
        return <Step5Equipment data={aircraftData} updateData={updateData} errors={errors} />;
      case 6:
        return <Step6Operations data={aircraftData} updateData={updateData} errors={errors} />;
      case 7:
        return <Step7Remarks data={aircraftData} updateData={updateData} errors={errors} />;
      case 8:
        return (
          <Step5Review
            data={aircraftData}
            setCurrentStep={setCurrentStep}
            onSave={handleAircraftSave}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            color: 'primary.main',
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2
          }}
        >
          <FlightIcon sx={{ fontSize: 40 }} />
          Assistant de création d'avion
        </Typography>
      </Box>

      {/* Stepper - Vue desktop */}
      <Paper elevation={0} sx={{ 
        p: { xs: 2, sm: 3 }, 
        mb: 4, 
        border: '1px solid', 
        borderColor: 'divider',
        overflow: 'auto',
        display: { xs: 'none', md: 'block' }
      }}>
        <Stepper 
          activeStep={currentStep} 
          alternativeLabel
        >
          {steps.map((step, index) => (
            <Step key={index}>
              <StepLabel
                StepIconComponent={(props) => (
                  <Box
                    sx={{
                      width: { xs: 36, sm: 48 },
                      height: { xs: 36, sm: 48 },
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: props.active 
                        ? 'primary.main' 
                        : props.completed 
                          ? 'success.main' 
                          : 'grey.300',
                      color: props.active || props.completed ? 'white' : 'text.disabled',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      fontSize: { xs: '0.9rem', sm: '1rem' }
                    }}
                    onClick={() => {
                      // Permettre de naviguer vers les étapes précédentes
                      if (index < currentStep) {
                        setCurrentStep(index);
                      }
                    }}
                  >
                    {props.completed ? <CheckCircleIcon /> : step.icon}
                  </Box>
                )}
              >
                <Typography variant="subtitle2" fontWeight={600} sx={{ display: { xs: 'none', sm: 'block' } }}>
                  {step.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
                  {step.description}
                </Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>
      
      {/* Stepper - Vue mobile (seulement l'étape en cours) */}
      <Paper elevation={0} sx={{ 
        p: 2, 
        mb: 4, 
        border: '1px solid', 
        borderColor: 'divider',
        display: { xs: 'block', md: 'none' }
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'primary.main',
                color: 'white'
              }}
            >
              {steps[currentStep].icon}
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>
                Étape {currentStep + 1} / {steps.length}
              </Typography>
              <Typography variant="body2">
                {steps[currentStep].label}
              </Typography>
            </Box>
          </Box>
          <Chip 
            label={`${Math.round(((currentStep + 1) / steps.length) * 100)}%`} 
            color="primary" 
            size="small"
          />
        </Box>
      </Paper>

      {/* Content */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 4, 
          mb: 3,
          minHeight: 400,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        {renderStepContent()}
      </Paper>

      {/* Navigation */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Bouton Annuler */}
          <Button
            variant="outlined"
            color="error"
            onClick={handleCancel}
            startIcon={<CloseIcon />}
            size="large"
          >
            Annuler
          </Button>

          {currentStep > 0 && (
            <Button
              variant="outlined"
              onClick={handlePrevious}
              startIcon={<ChevronLeftIcon />}
              size="large"
            >
              Précédent
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {currentStep !== steps.length - 1 && (
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={<ChevronRightIcon />}
              size="large"
            >
              Suivant
            </Button>
          )}
        </Box>
      </Box>

      {/* Dialog de confirmation d'annulation */}
      <Dialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Quitter l'assistant de création
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Vous êtes sur le point de quitter l'assistant. La configuration de <strong>{aircraftData.registration || 'cet avion'}</strong> n'est pas terminée.
          </DialogContentText>
          <Alert severity="info" sx={{ mt: 2 }}>
            Vous pouvez sauvegarder votre progression et reprendre plus tard, ou annuler complètement cette configuration.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setShowCancelDialog(false)}
            variant="outlined"
          >
            Continuer l'édition
          </Button>
          <Button
            onClick={() => handleConfirmCancel(false)}
            variant="outlined"
            color="error"
          >
            Annuler sans sauvegarder
          </Button>
          <Button
            onClick={() => handleConfirmCancel(true)}
            variant="contained"
            color="primary"
          >
            Sauvegarder et reprendre plus tard
          </Button>
        </DialogActions>
      </Dialog>

      {/* Affichage des erreurs globales */}
      {Object.keys(errors).length > 0 && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
            Veuillez corriger les erreurs suivantes :
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {Object.entries(errors).map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </Alert>
      )}
      
      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={notification.duration || 6000}
        onClose={notification.closeable !== false ? () => setNotification({ ...notification, open: false }) : undefined}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={notification.closeable !== false ? () => setNotification({ ...notification, open: false }) : undefined}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default AircraftCreationWizard;