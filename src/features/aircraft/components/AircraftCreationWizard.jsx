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
  Save as SaveIcon,
  Settings as SettingsIcon,
  Build as BuildIcon,
  FlightTakeoff as TakeoffIcon,
  Notes as NotesIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  CloudUpload as CloudUploadIcon,
  Refresh as RefreshIcon,
  VerifiedUser as VerifiedIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon
} from '@mui/icons-material';
import { useAircraft } from '../../../core/contexts';
import { useAircraftStore } from '../../../core/stores/aircraftStore';
import UnitConverterCard from './UnitConverterCard';

// 🔧 FIX MEMORY: Import LAZY des étapes pour éviter de charger tous les composants en mémoire d'un coup
// Avant : tous les steps chargés au démarrage du wizard (7 composants volumineux)
// Après : chaque step chargé uniquement quand il devient visible
const Step0CommunityCheck = React.lazy(() => import('./wizard-steps/Step0CommunityCheck'));
const Step1BasicInfo = React.lazy(() => import('./wizard-steps/Step1BasicInfo'));
const Step2Speeds = React.lazy(() => import('./wizard-steps/Step2Speeds'));
const Step3WeightBalance = React.lazy(() => import('./wizard-steps/Step3WeightBalance'));
const Step4Performance = React.lazy(() => import('./wizard-steps/Step4Performance'));
const Step5Equipment = React.lazy(() => import('./wizard-steps/Step5Equipment'));
const Step7Remarks = React.lazy(() => import('./wizard-steps/Step7Remarks'));
const Step5Review = React.lazy(() => import('./wizard-steps/Step5Review'));

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
  const { addAircraft, updateAircraft, setSelectedAircraft, aircraftList } = useAircraft();

  // Vérifier s'il y a un brouillon à reprendre
  const loadDraftIfExists = () => {
    // Si on a un existingAircraft, c'est qu'on édite, pas qu'on reprend un brouillon
    if (existingAircraft) return null;

    const draft = localStorage.getItem('aircraft_wizard_draft');
    if (draft) {
      try {
        // 🔧 FIX CRITIQUE: Vérifier la taille de la STRING AVANT JSON.parse
        // Le spike mémoire se produit PENDANT le parsing, pas après !
        const draftSizeKB = (draft.length * 2) / 1024; // Taille string en KB
        const draftSizeMB = draftSizeKB / 1024;

        // Limite stricte : 2MB de string (équivaut à ~1MB d'objet parsé)
        if (draftSizeMB > 2) {
          console.warn(`⚠️ Draft trop volumineux (${draftSizeMB.toFixed(1)}MB string) - Suppression AVANT parsing`);
          console.warn(`   → Évite spike mémoire de JSON.parse() qui causait le crash`);
          localStorage.removeItem('aircraft_wizard_draft');
          return null;
        }

        console.log(`✅ Draft acceptable (${draftSizeMB.toFixed(2)}MB string) - Parsing sécurisé`);
        const draftData = JSON.parse(draft);
        console.log(`📂 Reprise du brouillon détecté (${draftSizeMB.toFixed(1)}MB)`);

        // 🔧 FIX MEMORY: Nettoyer les éléments volumineux du draft
        // Le draft peut contenir un MANEX (20-50MB) ou photos volumineuses d'une session précédente
        if (draftData.aircraftData) {
          const cleanedData = { ...draftData };

          // Supprimer le MANEX s'il est présent (sera re-téléchargé si nécessaire)
          if (cleanedData.aircraftData.manex?.pdfData) {
            console.log('🗑️ MANEX supprimé du draft (trop volumineux)');
            delete cleanedData.aircraftData.manex;
          }

          // Supprimer les photos volumineuses (>500KB)
          if (cleanedData.aircraftData.photo && typeof cleanedData.aircraftData.photo === 'string') {
            const photoSizeKB = (cleanedData.aircraftData.photo.length * 0.75) / 1024;
            if (photoSizeKB > 500) {
              console.log(`🗑️ Photo volumineuse supprimée du draft (${photoSizeKB.toFixed(0)}KB)`);
              delete cleanedData.aircraftData.photo;
            }
          }

          console.log('✅ Draft nettoyé et chargé');
          return cleanedData;
        }

        return draftData;
      } catch (e) {
        console.error('❌ Erreur lors du chargement du brouillon:', e);
        // En cas d'erreur, supprimer le draft corrompu
        localStorage.removeItem('aircraft_wizard_draft');
      }
    }
    return null;
  };

  // 🔧 FIX DÉFINITIF: Draft réactivé avec vérification taille AVANT parsing
  const draft = loadDraftIfExists();

  // État principal - utilisant EXACTEMENT la même structure que AircraftModule
  const [aircraftData, setAircraftData] = useState(draft?.aircraftData || {
    id: existingAircraft?.id || existingAircraft?.aircraftId || undefined,
    aircraftId: existingAircraft?.aircraftId || existingAircraft?.id || undefined,
    // Conserver une copie de l'avion original pour détecter les modifications
    baseAircraft: existingAircraft ? JSON.parse(JSON.stringify(existingAircraft)) : undefined,
    registration: existingAircraft?.registration || '',
    model: existingAircraft?.model || '',
    // 🔧 FIX (2026-05) : champs OUBLIÉS dans la whitelist initiale → étaient
    // chargés à vide à chaque édition, ce qui écrasait la valeur sur Supabase
    // lors du save. À surveiller dès qu'on ajoute un nouveau champ avion.
    manufacturer: existingAircraft?.manufacturer || '',
    horsepower: existingAircraft?.horsepower ?? '',
    homeAeroclub: existingAircraft?.homeAeroclub || '',
    homeBase: existingAircraft?.homeBase || '',
    bypassedFields: Array.isArray(existingAircraft?.bypassedFields) ? existingAircraft.bypassedFields : [],
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
    // Rapport de pesée — fichier PDF base64 attaché à l'avion. DOIT être
    // rechargé en édition pour éviter de perdre le document quand le pilote
    // ouvre la fiche de l'avion existant.
    weighingReport: existingAircraft?.weighingReport || null,

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
    
    // 🔧 FIX (2026-05) : init MULTI-SOURCE pour les bras de levier.
    // Les arms peuvent être stockés à 3 emplacements selon l'origine de
    // l'avion (saisie manuelle / extraction MANEX / import Supabase legacy) :
    //   - aircraft.arms.* (forme canonique récente)
    //   - aircraft.weightBalance.* (forme alternative widgets M&C)
    //   - aircraft.armLengths.* (forme legacy)
    // On lit la 1re valeur non-vide trouvée pour éviter d'afficher un champ
    // vide alors que la donnée existe ailleurs → ce qui menait à un
    // écrasement à la sauvegarde si le pilote ne re-saisissait pas le champ.
    arms: (() => {
      const pick = (...candidates) => {
        for (const c of candidates) {
          if (c !== null && c !== undefined && c !== '') return c;
        }
        return '';
      };
      const a = existingAircraft?.arms || {};
      const wb = existingAircraft?.weightBalance || {};
      const al = existingAircraft?.armLengths || {};
      return {
        empty:      pick(a.empty,      wb.emptyWeightArm,    al.emptyMassArm),
        frontSeats: pick(a.frontSeats, wb.frontLeftSeatArm,  al.frontSeatArm),
        rearSeats:  pick(a.rearSeats,  wb.rearLeftSeatArm,   al.rearSeatArm),
        fuelMain:   pick(a.fuelMain,   wb.fuelArm,           al.fuelArm),
        baggageFwd: pick(a.baggageFwd, wb.baggageArm,        al.baggageFwdArm),
        baggageAft: pick(a.baggageAft, wb.auxiliaryArm,      al.baggageAftArm)
      };
    })(),

    cgLimits: (() => {
      const pick = (...candidates) => {
        for (const c of candidates) {
          if (c !== null && c !== undefined && c !== '') return c;
        }
        return '';
      };
      const cg = existingAircraft?.cgLimits || {};
      const wbCg = existingAircraft?.weightBalance?.cgLimits || {};
      const env = existingAircraft?.cgEnvelope || {};
      const fwdFromEnv = Array.isArray(env.forwardPoints) && env.forwardPoints.length > 0
        ? env.forwardPoints[0]?.cg
        : env.forwardCG;
      return {
        forward: pick(cg.forward, wbCg.forward, fwdFromEnv),
        aft:     pick(cg.aft,     wbCg.aft,     env.aftCG)
      };
    })(),

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
    approvedOperations: {
      // Règles de vol
      vfrDay: existingAircraft?.approvedOperations?.vfrDay || false,
      vfrNight: existingAircraft?.approvedOperations?.vfrNight || false,
      ifrDay: existingAircraft?.approvedOperations?.ifrDay || false,
      ifrNight: existingAircraft?.approvedOperations?.ifrNight || false,
      svfr: existingAircraft?.approvedOperations?.svfr || false,
      // Opérations spéciales
      formation: existingAircraft?.approvedOperations?.formation || false,
      aerobatics: existingAircraft?.approvedOperations?.aerobatics || false,
      banner: existingAircraft?.approvedOperations?.banner || false,
      glider: existingAircraft?.approvedOperations?.glider || false,
      parachute: existingAircraft?.approvedOperations?.parachute || false,
      agricultural: existingAircraft?.approvedOperations?.agricultural || false,
      aerial: existingAircraft?.approvedOperations?.aerial || false,
      // Search and Rescue (nouveaux champs - migration automatique)
      elt: existingAircraft?.approvedOperations?.elt || false,
      lifeVests: existingAircraft?.approvedOperations?.lifeVests || false,
      fireExtinguisherHalon: existingAircraft?.approvedOperations?.fireExtinguisherHalon || false,
      fireExtinguisherWater: existingAircraft?.approvedOperations?.fireExtinguisherWater || false,
      fireExtinguisherPowder: existingAircraft?.approvedOperations?.fireExtinguisherPowder || false,
      oxygenBottles: existingAircraft?.approvedOperations?.oxygenBottles || false,
      lifeRaft: existingAircraft?.approvedOperations?.lifeRaft || false,
      survivalKit: existingAircraft?.approvedOperations?.survivalKit || false,
      plb: existingAircraft?.approvedOperations?.plb || false,
      signalMirror: existingAircraft?.approvedOperations?.signalMirror || false,
      flares: existingAircraft?.approvedOperations?.flares || false,
      survivalRadio: existingAircraft?.approvedOperations?.survivalRadio || false,
      firstAidKit: existingAircraft?.approvedOperations?.firstAidKit || false,
      survivalClothing: existingAircraft?.approvedOperations?.survivalClothing || false,
      // Environnement et usage
      training: existingAircraft?.approvedOperations?.training || false,
      charter: existingAircraft?.approvedOperations?.charter || false,
      mountainous: existingAircraft?.approvedOperations?.mountainous || false,
      seaplane: existingAircraft?.approvedOperations?.seaplane || false,
      skiPlane: existingAircraft?.approvedOperations?.skiPlane || false,
      icing: existingAircraft?.approvedOperations?.icing || false
    },
    
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
  const [savingProgress, setSavingProgress] = useState({
    isOpen: false,
    steps: [],
    currentStepIndex: -1
  });
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success', closeable: true, duration: 6000 });
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Bypass de validation : modal de confirmation + suivi des champs ignorés
  const [showBypassDialog, setShowBypassDialog] = useState(false);
  const [pendingBypassErrors, setPendingBypassErrors] = useState({});
  // bypassedFields persisté sur l'avion sauvegardé : ['speeds.vne', 'weights.mtow', ...]
  const [bypassedFields, setBypassedFields] = useState(() => {
    return Array.isArray(draft?.aircraftData?.bypassedFields) ? draft.aircraftData.bypassedFields : [];
  });

  // Compteur pour déclencher l'ouverture du modal de validation MANEX depuis
  // n'importe quelle étape. À chaque incrément, Step0 (via un useEffect)
  // ouvre automatiquement le modal pré-rempli avec data.manexExtraction.
  const [manexReviewTrigger, setManexReviewTrigger] = useState(0);

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
  // 🔧 FIX DÉFINITIF: Réactivé avec protection taille
  const saveWizardState = () => {
    try {
      const wizardState = {
        aircraftData,
        currentStep,
        timestamp: new Date().toISOString(),
        isEdit: !!existingAircraft
      };

      // 🔧 FIX: Vérifier taille AVANT de sauvegarder
      const stateString = JSON.stringify(wizardState);
      const stateSizeMB = (stateString.length * 2) / (1024 * 1024);

      if (stateSizeMB > 2) {
        console.warn(`⚠️ État trop volumineux (${stateSizeMB.toFixed(1)}MB) - Pas de sauvegarde`);
        console.warn(`   → Contient probablement MANEX ou photos volumineuses`);
        return;
      }

      localStorage.setItem('aircraft_wizard_draft', stateString);
      console.log(`💾 État sauvegardé (${stateSizeMB.toFixed(2)}MB):`, {
        step: currentStep,
        registration: aircraftData.registration,
        hasManex: !!aircraftData.manex,
        hasPhoto: !!aircraftData.photo
      });
    } catch (error) {
      console.error('❌ Erreur sauvegarde draft:', error);
      // En cas d'erreur (ex: QuotaExceededError), ne pas bloquer l'utilisateur
    }
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
      label: 'Équipements & Opérations',
      description: 'Équipements et limitations opérationnelles',
      icon: <BuildIcon />
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

  /**
   * Parse un chemin pouvant contenir des index de tableau pour retourner une
   * liste de segments. Exemples :
   *   "arms.fuelMain"                    → ["arms", "fuelMain"]
   *   "baggageCompartments[0].arm"       → ["baggageCompartments", 0, "arm"]
   *   "additionalFuelTanks[2].momentAtFull" → ["additionalFuelTanks", 2, "momentAtFull"]
   *
   * Les segments numériques (index de tableau) sont retournés comme Number,
   * permettant à la logique de mise à jour de créer un tableau plutôt qu'un
   * objet quand on remonte la chaîne.
   */
  const parsePath = (path) => {
    const segments = [];
    const parts = path.split('.');
    for (const part of parts) {
      const match = part.match(/^([^\[]+)((?:\[\d+\])*)$/);
      if (!match) {
        segments.push(part);
        continue;
      }
      const [, key, indicesPart] = match;
      if (key) segments.push(key);
      if (indicesPart) {
        const indices = [...indicesPart.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1]));
        segments.push(...indices);
      }
    }
    return segments;
  };

  // Fonction de mise à jour des données (supporte chemins imbriqués + indices
  // de tableau, ex : "baggageCompartments[0].arm").
  const updateData = (path, value) => {
    console.log('Update Data - Path:', path, 'Value:', value);

    setAircraftData(prev => {
      const segments = parsePath(path);
      // Clonage profond le long du chemin pour ne pas muter prev
      const newData = Array.isArray(prev) ? [...prev] : { ...prev };
      let current = newData;
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        const nextSeg = segments[i + 1];
        // Détermine si le niveau suivant est un tableau (basé sur nextSeg numérique)
        if (current[seg] === undefined || current[seg] === null) {
          current[seg] = typeof nextSeg === 'number' ? [] : {};
        } else {
          // Clone shallow pour propager l'immuabilité
          current[seg] = Array.isArray(current[seg]) ? [...current[seg]] : { ...current[seg] };
        }
        current = current[seg];
      }
      current[segments[segments.length - 1]] = value;
      console.log('Updated aircraft data:', newData);
      return newData;
    });

    // Effacer l'erreur si elle existe (essayer clé complète "speeds.vso" ET clé courte "vso")
    const shortKey = path.includes('.') ? path.split('.').pop() : path;
    if (errors[path] || errors[shortKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[path];
        delete newErrors[shortKey];
        return newErrors;
      });
    }
  };

  // 🔧 FIX MEMORY: Fonction de mise à jour groupée (bulk update)
  // Évite les multiples setState qui copient l'état complet à chaque fois
  const updateDataBulk = (dataObject) => {
    console.log('Update Data Bulk - Keys:', Object.keys(dataObject).length);

    setAircraftData(prev => {
      // UNE SEULE copie au lieu de 50+
      return { ...prev, ...dataObject };
    });
  };

  // Validation des étapes
  const validateStep = (stepIndex) => {
    const newErrors = {};
    
    switch (stepIndex) {
      case 0: // Unités - pas de validation requise
        break;
        
      case 1: // Informations générales
        if (!aircraftData.registration) {
          newErrors.registration = "L'immatriculation est requise";
        } else {
          const normalized = String(aircraftData.registration).trim().toUpperCase();
          const editingId = existingAircraft?.id;
          const duplicate = (aircraftList || []).some(a =>
            a.id !== editingId &&
            String(a.registration || '').trim().toUpperCase() === normalized
          );
          if (duplicate) {
            newErrors.registration = "Cette immatriculation existe déjà dans votre flotte";
          }
        }
        if (!aircraftData.model) newErrors.model = "Le modèle est requis";
        if (!aircraftData.fuelCapacity) newErrors.fuelCapacity = "La capacité carburant est requise";
        // NOTE: cruiseSpeedKt validé dans case 3 (Step2 Vitesses), pas ici.
        break;

      case 2: // Masse et centrage
        if (!aircraftData.weights?.emptyWeight) newErrors.emptyWeight = "La masse à vide est requise";
        if (!aircraftData.weights?.mtow) newErrors.mtow = "La masse maximale est requise";
        // Rapport de pesée OBLIGATOIRE — justification réglementaire des
        // valeurs M&C saisies. Sans ce document, les calculs de centrage
        // ne reposent que sur déclaratif (risque sécurité opérationnelle).
        if (!aircraftData.weighingReport?.hasData) {
          newErrors.weighingReport = "Le rapport de pesée (PDF) est obligatoire. Il justifie la masse à vide et le bras de levier.";
        }
        break;

      case 3: // Vitesses
        // Vitesse de croisière (déplacée depuis case 1 — elle conditionne le baseFactor)
        if (!aircraftData.cruiseSpeedKt || aircraftData.cruiseSpeedKt === '') {
          newErrors.cruiseSpeedKt = "La vitesse de croisière est requise";
        }
        // Vitesses critiques requises (clés préfixées `speeds.` pour matcher Step2Speeds)
        if (!aircraftData.speeds?.vso || aircraftData.speeds.vso === '') {
          newErrors['speeds.vso'] = "VSO est requise";
        }
        if (!aircraftData.speeds?.vs1 || aircraftData.speeds.vs1 === '') {
          newErrors['speeds.vs1'] = "VS1 est requise";
        }
        if (!aircraftData.speeds?.vne || aircraftData.speeds.vne === '') {
          newErrors['speeds.vne'] = "VNE est requise";
        }
        if (!aircraftData.speeds?.vfeTO || aircraftData.speeds.vfeTO === '') {
          newErrors['speeds.vfeTO'] = "VFE T/O est requise";
        }
        if (!aircraftData.speeds?.vfeLdg || aircraftData.speeds.vfeLdg === '') {
          newErrors['speeds.vfeLdg'] = "VFE LDG est requise";
        }
        if (!aircraftData.speeds?.vno || aircraftData.speeds.vno === '') {
          newErrors['speeds.vno'] = "VNO est requise";
        }

        // Validation de l'ordre des vitesses (uniquement si valeurs renseignées et valides)
        {
          const num = (v) => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v);
          const vso = num(aircraftData.speeds?.vso);
          const vs1 = num(aircraftData.speeds?.vs1);
          const vno = num(aircraftData.speeds?.vno);
          const vne = num(aircraftData.speeds?.vne);
          const vfeTO = num(aircraftData.speeds?.vfeTO);
          const vfeLdg = num(aircraftData.speeds?.vfeLdg);
          const va = num(aircraftData.speeds?.va);

          if (vso !== null && vs1 !== null && vso >= vs1 && !newErrors['speeds.vs1']) {
            newErrors['speeds.vs1'] = "VS1 doit être supérieure à VSO";
          }
          if (vs1 !== null && vno !== null && vs1 >= vno && !newErrors['speeds.vno']) {
            newErrors['speeds.vno'] = "VNO doit être supérieure à VS1";
          }
          if (vno !== null && vne !== null && vno >= vne && !newErrors['speeds.vne']) {
            newErrors['speeds.vne'] = "VNE doit être supérieure à VNO";
          }
          if (vfeTO !== null && vne !== null && vfeTO > vne && !newErrors['speeds.vfeTO']) {
            newErrors['speeds.vfeTO'] = "VFE T/O doit être inférieure ou égale à VNE";
          }
          if (vfeLdg !== null && vne !== null && vfeLdg > vne && !newErrors['speeds.vfeLdg']) {
            newErrors['speeds.vfeLdg'] = "VFE LDG doit être inférieure ou égale à VNE";
          }
          if (vfeLdg !== null && vso !== null && vfeLdg < vso && !newErrors['speeds.vfeLdg']) {
            newErrors['speeds.vfeLdg'] = "VFE LDG doit être supérieure ou égale à VSO";
          }
          if (va !== null && vne !== null && va > vne) {
            newErrors['speeds.va'] = "VA doit être inférieure à VNE";
          }
        }

        // Limitations de vent : OPTIONNELLES (pas toujours documentées dans le MANEX,
        // surtout pour les avions GA légers). Le pilote peut continuer sans les saisir.
        // (Validation supprimée — anciennement bloquante alors que le format de stockage
        //  windLimits.limits[] / windLimits.maxXxx variait selon les avions.)
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
      // Validation échouée → proposer le bypass plutôt que de bloquer silencieusement
      setPendingBypassErrors(errors);
      setShowBypassDialog(true);
    }
  };

  // Bypass confirmé : on enregistre les champs ignorés sur l'avion et on avance.
  const handleBypassConfirm = () => {
    const fieldKeys = Object.keys(pendingBypassErrors);
    // Concat sans doublons
    const merged = Array.from(new Set([...bypassedFields, ...fieldKeys]));
    setBypassedFields(merged);
    // Persister immédiatement dans aircraftData pour qu'il soit sauvegardé même si on quitte
    setAircraftData(prev => ({ ...prev, bypassedFields: merged }));
    setShowBypassDialog(false);
    setErrors({}); // les erreurs sont "acceptées" — on ne les affiche plus
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const handleBypassCancel = () => {
    setShowBypassDialog(false);
    // On garde les erreurs affichées pour que l'utilisateur les voie
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleAircraftSave = async (saveData) => {
    console.log('=== handleAircraftSave appelé ===', saveData);

    // Initialiser les étapes de progression
    const progressSteps = [
      { id: 1, label: 'Validation des données', status: 'pending' },
      { id: 2, label: 'Préparation pour sauvegarde', status: 'pending' },
      { id: 3, label: 'Envoi vers Supabase', status: 'pending' },
      { id: 4, label: 'Rechargement de la liste', status: 'pending' },
      { id: 5, label: 'Vérification dans Aircraft Module', status: 'pending' },
      { id: 6, label: 'Finalisation', status: 'pending' }
    ];

    setSavingProgress({
      isOpen: true,
      steps: progressSteps,
      currentStepIndex: 0
    });

    const updateStep = (index, status, error = null) => {
      setSavingProgress(prev => ({
        ...prev,
        steps: prev.steps.map((step, i) =>
          i === index ? { ...step, status, error } : step
        ),
        currentStepIndex: index
      }));
    };

    try {
      // ÉTAPE 1: Validation des données
      updateStep(0, 'in_progress');
      await new Promise(resolve => setTimeout(resolve, 500)); // Petit délai pour visibilité

      // 🔧 FIX: Utiliser aircraftData du state qui contient baseAircraft
      const dataToSave = { ...aircraftData };

      // 🛡️ ANTI-ÉCRASEMENT : ne JAMAIS écraser un champ existant avec
      // une valeur vide. Si un champ est vide dans dataToSave mais
      // renseigné dans existingAircraft, on conserve l'ancienne valeur.
      //
      // Couvre les bugs où le wizard charge un avion incomplet (chemin
      // multi-source raté), affiche un champ vide, l'utilisateur ne saisit
      // pas la valeur et le save écrase la DB. Approche défensive.
      if (existingAircraft) {
        const isEmpty = (v) => v === null || v === undefined || v === '';
        const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
        const isArray = Array.isArray;

        // Merge récursif : pour chaque clé de existingAircraft, si dataToSave
        // a une valeur vide alors que existingAircraft a une vraie valeur, on
        // remet l'ancienne. Pour les sous-objets (arms, weights, speeds, etc.)
        // on descend récursivement.
        const mergeNonEmpty = (target, source, depth = 0) => {
          if (depth > 4) return target; // Garde-fou contre cycles
          for (const key of Object.keys(source || {})) {
            // Champs gérés explicitement séparément
            if (['id', 'aircraftId', 'baseAircraft', '_metadata', 'createdAt'].includes(key)) continue;

            const srcVal = source[key];
            const tgtVal = target[key];

            if (isEmpty(tgtVal) && !isEmpty(srcVal)) {
              // Le wizard a un champ vide mais l'avion existant l'avait : on restaure
              target[key] = srcVal;
              console.log(`🛡️ [Save Guard] Conserve ${key} = ${JSON.stringify(srcVal).slice(0, 80)} (était vide dans dataToSave)`);
            } else if (isObject(tgtVal) && isObject(srcVal)) {
              // Sous-objet : descendre
              mergeNonEmpty(tgtVal, srcVal, depth + 1);
            } else if (isArray(tgtVal) && isArray(srcVal) && tgtVal.length === 0 && srcVal.length > 0) {
              // Tableau vide alors qu'il était rempli : restaurer
              target[key] = srcVal;
              console.log(`🛡️ [Save Guard] Conserve ${key} (tableau ${srcVal.length} items) — était vide dans dataToSave`);
            }
          }
          return target;
        };
        mergeNonEmpty(dataToSave, existingAircraft);
      }

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
        delete dataToSave.flightManual;
      }

      // ─── Sync réservoir principal → champs legacy ──────────────────────
      // Le wizard moderne stocke le réservoir principal comme un élément
      // de `additionalFuelTanks` avec `type: 'main'`. Pour compatibilité
      // avec tout le reste de l'app (aircraftCompleteness, calcul M&B,
      // PDF, performance analyzer) on miroir aussi les valeurs dans les
      // anciens emplacements `arms.fuelMain`, `moments.fuelMain` et
      // `fuelUsableCapacity` / `fuelCapacity`. Sans ce sync, l'avion
      // apparaît comme « bras réservoir principal manquant » même après
      // que l'utilisateur a renseigné le tank dans Step3.
      try {
        const tanks = Array.isArray(dataToSave.additionalFuelTanks) ? dataToSave.additionalFuelTanks : [];
        const mainTank = tanks.find((t) => t && t.type === 'main');
        if (mainTank) {
          dataToSave.arms = { ...(dataToSave.arms || {}) };
          dataToSave.moments = { ...(dataToSave.moments || {}) };
          const armVal = parseFloat(mainTank.arm);
          const momVal = parseFloat(mainTank.momentAtFull);
          const capVal = parseFloat(mainTank.capacity);
          if (Number.isFinite(armVal) && armVal !== 0) dataToSave.arms.fuelMain = armVal;
          if (Number.isFinite(momVal) && momVal > 0) dataToSave.moments.fuelMain = momVal;
          if (Number.isFinite(capVal) && capVal > 0) {
            // fuelUsableCapacity = capacité utile du tank principal
            if (!Number.isFinite(parseFloat(dataToSave.fuelUsableCapacity))) {
              dataToSave.fuelUsableCapacity = capVal;
            }
          }
        }
        // fuelCapacity = somme totale de tous les réservoirs (s'il n'est pas déjà
        // défini explicitement). Step3 le fait déjà au runtime, mais on
        // sécurise ici au save pour les cas où la sync useEffect ne se
        // serait pas déclenchée (édition rapide, données héritées, etc.).
        if (tanks.length > 0) {
          const sum = tanks.reduce((s, t) => s + (parseFloat(t?.capacity) || 0), 0);
          const current = parseFloat(dataToSave.fuelCapacity);
          if (sum > 0 && (!Number.isFinite(current) || Math.abs(sum - current) > 0.5)) {
            dataToSave.fuelCapacity = sum;
          }
        }
        console.log('🔄 [Save] Sync additionalFuelTanks → arms.fuelMain / moments.fuelMain / fuelUsableCapacity', {
          fuelMain: dataToSave.arms?.fuelMain,
          momentMain: dataToSave.moments?.fuelMain,
          usable: dataToSave.fuelUsableCapacity,
          total: dataToSave.fuelCapacity
        });
      } catch (syncErr) {
        console.warn('⚠️ [Save] Sync tank principal échoué (non bloquant):', syncErr);
      }

      // Calculer le baseFactor si nécessaire
      if (dataToSave.cruiseSpeedKt && !dataToSave.baseFactor) {
        dataToSave.baseFactor = (60 / parseFloat(dataToSave.cruiseSpeedKt)).toFixed(3);
      }

      updateStep(0, 'completed');

      // ÉTAPE 2: Préparation pour sauvegarde
      updateStep(1, 'in_progress');
      await new Promise(resolve => setTimeout(resolve, 500));

      // 🔧 FIX: Détection intelligente des variants
      // Variant = VRAIE copie avec registration différente ou flag explicite
      // Import modifié = UPDATE du même preset (pas de variant)
      const isTrueVariant = dataToSave.isVariant && dataToSave.baseAircraft &&
                            dataToSave.registration !== dataToSave.baseAircraft.registration;

      if (isTrueVariant) {
        console.log('🔀 VRAI variant détecté (registration différente) - Génération d\'un nouvel ID');
        const newId = crypto.randomUUID();
        console.log(`   Ancien ID: ${dataToSave.id || dataToSave.aircraftId}`);
        console.log(`   Nouvel ID: ${newId}`);
        console.log(`   Registration originale: ${dataToSave.baseAircraft.registration}`);
        console.log(`   Nouvelle registration: ${dataToSave.registration}`);

        // Remplacer l'ID pour forcer la création d'un nouveau preset
        dataToSave.id = newId;
        dataToSave.aircraftId = newId;

        // Conserver la référence au preset original
        if (!dataToSave.communityPresetId && dataToSave.baseAircraft?.id) {
          dataToSave.communityPresetId = dataToSave.baseAircraft.id;
        }
      } else if (dataToSave.baseAircraft) {
        // Import modifié avec MÊME registration → UPDATE du preset existant
        console.log('📝 Preset importé modifié - Mise à jour du preset existant');
        console.log(`   ID du preset: ${dataToSave.baseAircraft.id}`);
        console.log(`   Registration: ${dataToSave.registration}`);

        // Garder l'ID du preset original pour faire UPDATE
        dataToSave.id = dataToSave.baseAircraft.id;
        dataToSave.aircraftId = dataToSave.baseAircraft.id;
        dataToSave.isVariant = false;  // Pas un variant, c'est un UPDATE
      }

      // Nettoyer le localStorage des données temporaires
      try {
        localStorage.removeItem('wizard_performance_temp');
        localStorage.removeItem('aircraft_wizard_draft');
        console.log('🧹 Données temporaires nettoyées du localStorage');
      } catch (e) {
        console.error('Erreur lors du nettoyage du localStorage:', e);
      }

      updateStep(1, 'completed');

      // ÉTAPE 3: Envoi vers Supabase
      updateStep(2, 'in_progress');

      console.log('📤 Envoi de l\'avion vers Supabase...');
      console.log('   ID de l\'avion:', dataToSave.id);
      console.log('   Registration:', dataToSave.registration);
      console.log('   isVariant:', dataToSave.isVariant);

      // 🔧 FIX CRITIQUE: Forcer les métadonnées à STORAGE units
      // Les données dans dataToSave sont DÉJÀ en STORAGE units (converties par Step1BasicInfo)
      // Mais les métadonnées peuvent dire 'gal'/'gph' ce qui causera une double conversion
      dataToSave._metadata = {
        ...dataToSave._metadata,
        units: {
          fuel: 'ltr',
          fuelConsumption: 'lph',
          weight: 'kg',
          speed: 'kt',
          distance: 'nm',
          altitude: 'ft',
          verticalSpeed: 'fpm'
        },
        note: 'STORAGE units - all values in ltr/lph/kg/kt',
        updatedAt: new Date().toISOString()
      };
      console.log('🔧 Métadonnées forcées à STORAGE units:', dataToSave._metadata.units);

      let savedAircraft = null;

      try {
        savedAircraft = await addAircraft(dataToSave);
        console.log('✅ Avion sauvegardé dans Supabase:', savedAircraft);
        updateStep(2, 'completed');
      } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde Supabase:', error);
        updateStep(2, 'error', error.message);
        throw new Error(`Échec de la sauvegarde: ${error.message}`);
      }

      // ÉTAPE 4: Rechargement de la liste
      updateStep(3, 'in_progress');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre que Supabase se synchronise

      // Le store recharge automatiquement après addAircraft, mais on attend un peu
      console.log('🔄 Attente de la synchronisation...');
      updateStep(3, 'completed');

      // ÉTAPE 5: Vérification dans Aircraft Module
      updateStep(4, 'in_progress');

      // 🔧 FIX: Utiliser l'ID retourné par Supabase, pas l'ID local généré
      // Pour les variants, Supabase crée un nouvel ID qui est différent de celui généré localement
      const searchId = savedAircraft?.id || savedAircraft?.aircraftId || dataToSave.id;
      const searchReg = dataToSave.registration;

      console.log('🔍 Recherche de l\'avion dans Aircraft Module...');
      console.log(`   ID local généré: ${dataToSave.id}`);
      console.log(`   ID Supabase retourné: ${savedAircraft?.id}`);
      console.log(`   ID recherché: ${searchId}`);
      console.log(`   Registration: ${searchReg}`);

      // Attendre que l'avion apparaisse dans la liste (max 10 secondes)
      let foundInList = false;
      let foundAircraft = null;
      let attempts = 0;
      const maxAttempts = 20; // 20 × 500ms = 10 secondes max

      while (!foundInList && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));

        // 🔧 FIX: Lire la liste FRAÎCHE depuis le store à chaque itération
        // Sinon on garde une référence à l'ancienne liste (closure)
        const currentList = useAircraftStore.getState().aircraftList || [];

        // Chercher par ID ou registration
        foundAircraft = currentList.find(a =>
          a.id === searchId ||
          a.aircraftId === searchId ||
          (a.registration === searchReg && a.id === searchId)
        );

        foundInList = !!foundAircraft;
        attempts++;

        console.log(`🔍 Tentative ${attempts}/${maxAttempts}`);
        console.log(`   Liste actuelle: ${currentList.length} avions`);
        console.log(`   IDs dans liste: ${currentList.map(a => a.id).join(', ')}`);
        console.log(`   Avion trouvé: ${foundInList ? `Oui (${foundAircraft.registration})` : 'Non'}`);
      }

      if (!foundInList) {
        console.warn('⚠️ L\'avion n\'apparaît pas encore dans la liste après 10s');
        console.warn(`   Recherché: ID=${searchId}, REG=${searchReg}`);
        console.warn(`   Dans liste: ${(aircraftList || []).map(a => `${a.registration}(${a.id})`).join(', ')}`);
        updateStep(4, 'completed'); // On continue quand même
      } else {
        console.log('✅ Avion confirmé dans Aircraft Module');
        console.log(`   Trouvé: ${foundAircraft.registration} (${foundAircraft.id})`);
        updateStep(4, 'completed');
      }

      // ÉTAPE 6: Finalisation
      updateStep(5, 'in_progress');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Sélectionner le nouvel avion (utiliser l'avion trouvé dans la liste)
      if (foundAircraft) {
        console.log('🎯 Sélection de l\'avion:', foundAircraft.registration);
        setSelectedAircraft(foundAircraft);
      } else {
        console.warn('⚠️ Impossible de sélectionner l\'avion - non trouvé dans la liste');
      }

      updateStep(5, 'completed');

      // Notification de succès
      setNotification({
        open: true,
        message: `✅ L'avion ${dataToSave.registration} a été enregistré avec succès !`,
        severity: 'success',
        duration: 3000
      });

      // Attendre 1.5s puis rediriger
      setTimeout(() => {
        setSavingProgress(prev => ({ ...prev, isOpen: false }));

        // Navigation vers Aircraft Module
        console.log('🏠 Navigation vers Aircraft Module...');
        const aircraftTab = document.querySelector('[data-tab-id="aircraft"]');
        if (aircraftTab) {
          aircraftTab.click();
          console.log('✅ Navigation réussie');
        } else {
          const homeTab = document.querySelector('[data-tab-id="home"]') ||
                         document.querySelector('[data-tab-id="dashboard"]');
          if (homeTab) {
            homeTab.click();
          } else {
            window.location.reload();
          }
        }

        // Appeler onComplete si défini
        if (onComplete) {
          onComplete(dataToSave);
        }
      }, 1500);

    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);

      // Marquer l'étape courante comme erreur
      const currentStepIdx = savingProgress.currentStepIndex;
      updateStep(currentStepIdx, 'error', error.message);

      setNotification({
        open: true,
        message: `❌ Erreur: ${error.message}`,
        severity: 'error'
      });

      // Fermer la dialog de progression après 3s
      setTimeout(() => {
        setSavingProgress(prev => ({ ...prev, isOpen: false }));
      }, 3000);
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

      // 🔧 FIX: Mapper weights.emptyWeight → emptyWeight (propriété racine)
      // Le code qui lit les données s'attend à aircraft.emptyWeight (pas aircraft.weights.emptyWeight)
      if (dataToSave.weights?.emptyWeight) {
        dataToSave.emptyWeight = parseFloat(dataToSave.weights.emptyWeight);
        console.log('✅ [Wizard] Mapped weights.emptyWeight → emptyWeight:', dataToSave.emptyWeight);
      }
      if (dataToSave.weights?.mtow) {
        dataToSave.maxTakeoffWeight = parseFloat(dataToSave.weights.mtow);
      }

      // 🔧 DEBUG: Vérifier les performanceTables avant sauvegarde
      console.log('🔍 [Wizard] Données avant sauvegarde:', {
        registration: dataToSave.registration,
        hasPerformanceTables: !!dataToSave.performanceTables,
        performanceTablesCount: dataToSave.performanceTables?.length || 0,
        performanceTablesTypes: dataToSave.performanceTables?.map(t => t.type) || [],
        hasAdvancedPerformance: !!dataToSave.advancedPerformance,
        advancedPerformanceTablesCount: dataToSave.advancedPerformance?.tables?.length || 0,
        advancedPerformanceTypes: dataToSave.advancedPerformance?.tables?.map(t => t.type) || []
      });

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
        return <Step0CommunityCheck
                  data={aircraftData}
                  updateData={updateData}
                  updateDataBulk={updateDataBulk}
                  onSkip={() => handleNext()}
                  onComplete={onComplete}
                  manexReviewTrigger={manexReviewTrigger}
                />;
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
        return <Step7Remarks data={aircraftData} updateData={updateData} errors={errors} />;
      case 7:
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
    <Container
      maxWidth="lg"
      sx={{
        py: 4,
        backgroundColor: 'var(--app-bg)',
        color: 'var(--text-primary)',
        minHeight: '100vh',
      }}
    >
      {/* 🎨 En-tête éditorial ALFlight — espacement standardisé mb: 3 (24px)
          partout pour rythme vertical cohérent entre toutes les sections. */}
      <Box sx={{ mb: 3 }}>
        <Box
          component="span"
          sx={{
            display: 'block',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            mb: 1.5,
          }}
        >
          WIZARD · ASSISTANT
        </Box>
        <Typography
          variant="h3"
          sx={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--text-primary)',
            m: 0,
          }}
        >
          Création d'avion
        </Typography>
      </Box>

      {/* 🎨 Stepper compact ALFlight — unifié desktop ET mobile.
          Plus de scroll horizontal ni de liste complète. Pattern unique :
          icône + numéro/total + nom étape + % complétion.
          (Ancienne vue desktop "alternativeLabel" supprimée car elle
          générait une barre de scroll horizontale gênante.) */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3, // Standardisé sur 24px (= section MANEX + Paper Content)
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 'var(--radius-sm)', // Arrondi cohérent avec le reste de l'app
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            {/* Pastille icône — orange ALFlight */}
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'var(--accent-primary)',
                color: 'var(--text-inverse)',
                flexShrink: 0,
              }}
            >
              {steps[currentStep].icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                  lineHeight: 1.2,
                }}
              >
                Étape {currentStep + 1} / {steps.length}
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {steps[currentStep].label}
              </Typography>
            </Box>
          </Box>
          {/* Chip % complétion — orange ALFlight */}
          <Chip
            label={`${Math.round(((currentStep + 1) / steps.length) * 100)}%`}
            sx={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              borderRadius: 'var(--radius-sm)',
              flexShrink: 0,
            }}
          />
        </Box>
      </Paper>

      {/* ─── Bandeau MANEX extraction (accès direct depuis toutes étapes) ──
          Visible quand une extraction est disponible dans le wizard et
          qu'on n'est pas déjà sur Step0 (où le bouton existe déjà). Permet
          au pilote de réouvrir le modal de validation des données extraites
          en un clic sans relancer l'analyse IA. */}
      {currentStep > 0 && aircraftData.manexExtraction?.items?.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            // Demande utilisateur : aligner espacement avec les autres sections.
            // mb: 2 (16px) → mb: 3 (24px) = même rythme vertical que Paper Content.
            mb: 3,
            p: 2,
            border: '1px solid var(--accent-primary)',
            borderLeft: '3px solid var(--accent-primary)',
            backgroundColor: 'var(--accent-soft)',
            borderRadius: 'var(--radius-sm)', // Arrondi cohérent avec le reste de l'app
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Box
              component="span"
              sx={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--accent-primary)',
                mb: 0.5,
              }}
            >
              MANEX · EXTRACTION DISPONIBLE
            </Box>
            <Typography
              variant="body2"
              sx={{ color: 'var(--text-primary)', fontSize: '13px' }}
            >
              {aircraftData.manexExtraction.fileName || 'fichier'} ·{' '}
              {aircraftData.manexExtraction.items.length} champs
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            onClick={() => {
              setCurrentStep(0);
              setManexReviewTrigger((t) => t + 1);
            }}
          >
            Voir les données
          </Button>
        </Paper>
      )}

      {/* Vérificateur de conversion d'unités RETIRÉ DU WIZARD — demande
          utilisateur. La carte UnitConverterCard apparaît encore dans la
          modale de validation MANEX (ManexExtractionReview) là où elle
          est utile pour vérifier les unités extraites. */}

      {/* Content */}
      <Paper
        elevation={0}
        sx={{
          p: 0,
          mb: 3,
          // minHeight retiré : le Paper s'adapte maintenant à la hauteur réelle
          // de son contenu. Quand tous les accordéons sont fermés, plus
          // d'espace vide en bas. Le minHeight reste sur le fallback Suspense.
          border: 'none',
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          boxShadow: 'none',
        }}
      >
        {/* 🔧 FIX MEMORY: Suspense pour le chargement lazy des steps */}
        <React.Suspense fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <CircularProgress />
          </Box>
        }>
          {renderStepContent()}
        </React.Suspense>
      </Paper>

      {/* 🎨 Navigation footer — boutons cockpit harmonisés */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          pb: 'max(env(safe-area-inset-bottom), 16px)',
          pl: 'max(env(safe-area-inset-left), 16px)',
          pr: 'max(env(safe-area-inset-right), 16px)',
          borderTop: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
          gap: 1.5,
          backgroundColor: 'var(--app-bg)',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {/* Bouton Annuler — ghost neutre (pas rouge agressif) */}
          <Button
            variant="text"
            onClick={handleCancel}
            sx={{
              color: 'var(--text-tertiary)',
              '&:hover': {
                backgroundColor: 'rgba(245, 242, 236, 0.04)',
                color: 'var(--text-primary)',
              },
            }}
          >
            Annuler
          </Button>

          {currentStep > 0 && (
            <Button
              variant="outlined"
              onClick={handlePrevious}
            >
              ← Précédent
            </Button>
          )}
        </Box>

        {currentStep !== 0 && currentStep !== steps.length - 1 && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="contained"
              onClick={handleNext}
            >
              Suivant →
            </Button>
          </Box>
        )}
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

      {/* Dialog de bypass de validation : permet de passer outre les erreurs avec
          confirmation explicite. Les champs ignorés sont mémorisés dans bypassedFields
          et affichés sur la carte avion dans "Mes Avions". */}
      <Dialog
        open={showBypassDialog}
        onClose={handleBypassCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'var(--accent-primary)' }}>
          <WarningIcon color="warning" />
          Ignorer les validations obligatoires
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Les champs suivants ne sont pas renseignés mais sont normalement obligatoires :
          </DialogContentText>
          <Box sx={{
            backgroundColor: 'var(--bg-overlay)',
            border: '1px solid var(--border-subtle)',
            borderLeft: '3px solid var(--accent-primary)',
            borderRadius: 'var(--radius-sm)',
            p: 2,
            mb: 2,
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            {Object.entries(pendingBypassErrors).map(([key, msg]) => (
              <Box key={key} sx={{ display: 'flex', gap: 1, mb: 0.5, fontSize: '14px', color: 'var(--text-primary)' }}>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>•</span>
                <span><strong>{key}</strong> — {msg}</span>
              </Box>
            ))}
          </Box>
          <Alert severity="warning" sx={{ mb: 1 }}>
            En continuant, l'avion sera créé avec ces données manquantes. Un indicateur visible
            sera affiché sur la carte de l'avion dans <strong>Mes Avions</strong> avec la liste
            des champs à compléter.
          </Alert>
          <Alert severity="error">
            <strong>Sécurité opérationnelle :</strong> tant que <strong>Performance</strong>,
            <strong> Masse & Centrage</strong> ou les <strong>vitesses critiques</strong> sont
            incomplètes, l'avion ne devrait pas être utilisé pour un vol réel — uniquement pour
            préparation/étude.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleBypassCancel} variant="contained" color="primary">
            Revenir et compléter
          </Button>
          <Button onClick={handleBypassConfirm} variant="outlined" color="error">
            Je confirme — passer outre
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

      {/* Progress Dialog - Saving steps */}
      <Dialog
        open={savingProgress.isOpen}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 2 }}>
          <CloudUploadIcon color="primary" />
          Sauvegarde en cours...
        </DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            {savingProgress.steps.map((step, index) => {
              const isCompleted = step.status === 'completed';
              const isInProgress = step.status === 'in_progress';
              const isError = step.status === 'error';
              const isPending = step.status === 'pending';

              return (
                <Box
                  key={step.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    py: 2,
                    borderBottom: index < savingProgress.steps.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                    opacity: isPending ? 0.5 : 1,
                    transition: 'all 0.3s ease'
                  }}
                >
                  {/* Icon */}
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isCompleted
                        ? 'success.light'
                        : isError
                        ? 'error.light'
                        : isInProgress
                        ? 'primary.light'
                        : 'grey.200',
                      color: isCompleted
                        ? 'success.dark'
                        : isError
                        ? 'error.dark'
                        : isInProgress
                        ? 'primary.dark'
                        : 'text.disabled'
                    }}
                  >
                    {isCompleted && <CheckCircleIcon />}
                    {isError && <ErrorIcon />}
                    {isInProgress && <CircularProgress size={24} thickness={4} />}
                    {isPending && <PendingIcon />}
                  </Box>

                  {/* Label */}
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: isInProgress ? 600 : 400,
                        color: isError ? 'error.main' : 'text.primary'
                      }}
                    >
                      {step.label}
                    </Typography>
                    {step.error && (
                      <Typography variant="caption" color="error">
                        {step.error}
                      </Typography>
                    )}
                  </Box>

                  {/* Status chip */}
                  {isCompleted && (
                    <Chip label="Terminé" size="small" color="success" />
                  )}
                  {isInProgress && (
                    <Chip label="En cours..." size="small" color="primary" />
                  )}
                  {isError && (
                    <Chip label="Erreur" size="small" color="error" />
                  )}
                </Box>
              );
            })}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Loading Dialog (fallback for handleSave) */}
      <Dialog
        open={isLoading}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
              gap: 3
            }}
          >
            <CircularProgress size={60} thickness={4} />
            <Typography variant="h6" sx={{ fontWeight: 500, textAlign: 'center' }}>
              Enregistrement en cours...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Veuillez patienter pendant que nous sauvegardons la configuration de votre avion.
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </Container>
  );
}

export default AircraftCreationWizard;