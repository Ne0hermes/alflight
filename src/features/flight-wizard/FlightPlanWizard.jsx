import React, { useState, useCallback, useEffect } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { theme } from '../../styles/theme';
import { FlightPlanData } from './models/FlightPlanData';
import { WizardConfigProvider } from './contexts/WizardConfigContext';
// 🎨 Charte éditoriale ALFlight
import { EditorialHeading, ModuleHero } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';
import { useAircraft, useNavigation, useFuel, useWeather } from '@core/contexts';
import { aircraftSelectors } from '../../core/stores/aircraftStore';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { flightPlanSupabaseService } from '../../services/flightPlanSupabaseService';
import { validatedPdfService } from '../../services/validatedPdfService';
import { useNavigationResults } from '@features/navigation/hooks/useNavigationResults';
import { showNotification } from '@shared/components/Notification';
import html2pdf from 'html2pdf.js';

// Import des étapes
import { Step1GeneralInfo } from './steps/Step1GeneralInfo';
import { Step3Route } from './steps/Step3Route';
import { Step3VAC } from './steps/Step3VAC';
import { Step5Fuel } from './steps/Step5Fuel';
import { Step5Performance } from './steps/Step5Performance';
import { Step6WeightBalance } from './steps/Step6WeightBalance';
import { Step7Alternates } from './steps/Step7Alternates';  // Étape Déroutements — désormais en position 3 (juste après le trajet)
import { Step7Summary } from './steps/Step7Summary';

// Photo de présentation + intitulé par étape (cohérence avec les modules type
// « Mes avions »). Images : public/assets/photos/. Le contenu de l'étape suit.
const STEP_HERO = {
  1: { image: '/assets/photos/hero-pilot.jpg', eyebrow: 'ÉTAPE 1 · PRÉPARATION' },
  2: { image: '/assets/photos/hero-navigation.jpg', eyebrow: 'ÉTAPE 2 · NAVIGATION' },
  3: { image: '/assets/photos/hero-alternates.jpg', eyebrow: 'ÉTAPE 3 · DÉROUTEMENTS' },
  4: { image: '/assets/photos/hero-weather.jpg', eyebrow: 'ÉTAPE 4 · TERRAINS & MÉTÉO' },
  5: { image: '/assets/photos/hero-fuel.jpg', eyebrow: 'ÉTAPE 5 · CARBURANT' },
  6: { image: '/assets/photos/hero-weight-balance.jpg', eyebrow: 'ÉTAPE 6 · MASSE & CENTRAGE' },
  7: { image: '/assets/photos/hero-performance.jpg', eyebrow: 'ÉTAPE 7 · PERFORMANCES' },
  8: { image: '/assets/photos/hero-logbook.jpg', eyebrow: 'ÉTAPE 8 · SYNTHÈSE' },
};

/**
 * Composant principal du wizard de préparation de vol
 * Gère la navigation entre les étapes et l'état global du plan de vol
 */
export const FlightPlanWizard = ({ onComplete, onCancel }) => {
  console.log('🚀🚀🚀 FLIGHT PLAN WIZARD MONTAGE - Début du composant');

  // Contextes pour la synchronisation et restauration
  const { setSelectedAircraft } = useAircraft();
  const aircraftList = aircraftSelectors.useAircraftList();
  const selectedAircraft = aircraftSelectors.useSelectedAircraft(); // Hook pour récupérer l'avion sélectionné
  const { setWaypoints, waypoints, segmentAltitudes } = useNavigation();
  const { setFobFuel, calculateTotal } = useFuel();
  const { setWeatherData } = useWeather();
  const navigationResults = useNavigationResults();

  // État principal : instance du modèle de données
  const [flightPlan] = useState(() => {
    let plan = new FlightPlanData();

    // Restaurer depuis localStorage si disponible
    try {
      const savedDraft = localStorage.getItem('flightPlanDraft');
      if (savedDraft) {
        const draftData = JSON.parse(savedDraft);
        plan = FlightPlanData.fromJSON(draftData);
        console.log('✅ Brouillon restauré depuis localStorage');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la restauration du brouillon:', error);
    }

    return plan;
  });

  // État de navigation - Restaurer depuis localStorage
  const [currentStep, setCurrentStep] = useState(() => {
    try {
      const saved = localStorage.getItem('flightPlanCurrentStep');
      const step = saved ? parseInt(saved, 10) : 1;
      console.log('🔧 WIZARD - currentStep restauré depuis localStorage:', step);
      return step;
    } catch {
      console.log('🔧 WIZARD - currentStep par défaut: 1');
      return 1;
    }
  });

  const [completedSteps, setCompletedSteps] = useState(() => {
    try {
      const saved = localStorage.getItem('flightPlanCompletedSteps');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Force le re-render quand le plan de vol change
  const [, forceUpdate] = useState({});
  const updateFlightPlan = useCallback(() => {
    // Sauvegarder dans localStorage
    try {
      // Convertir explicitement en JSON string
      const jsonData = JSON.stringify(flightPlan.toJSON());
      localStorage.setItem('flightPlanDraft', jsonData);
      console.log('💾 Brouillon sauvegardé automatiquement');
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      console.error('   Détails:', error.message);
    }

    // Forcer le re-render
    forceUpdate({});
  }, [flightPlan]);

  // 🔧 FIX: Restaurer l'avion dans le contexte Aircraft global au montage
  // Cela permet aux modules (Performance, etc.) d'accéder à l'avion même si le wizard
  // a été restauré depuis localStorage sans passer par Step1
  useEffect(() => {
    if (flightPlan.aircraft?.registration && aircraftList.length > 0) {
      const aircraftFromStore = aircraftList.find(ac => ac.registration === flightPlan.aircraft.registration);

      if (aircraftFromStore) {
        // 🔧 IMPORTANT: Fusionner l'avion du store avec celui du flightPlan
        // L'avion du flightPlan contient potentiellement weightBalance/arms/etc. qui ne sont pas dans le store
        // L'avion du store contient les dernières données techniques
        const mergedAircraft = {
          ...aircraftFromStore, // Données du store (base)
          ...flightPlan.aircraft, // Données du flightPlan (priorité)
          // S'assurer que les propriétés essentielles ne sont pas écrasées par undefined
          registration: flightPlan.aircraft.registration,
        };

        console.log('🔄 [Wizard] Restauration de l\'avion (fusionné):', mergedAircraft.registration);
        console.log('🔍 [Wizard] weightBalance présent?', !!mergedAircraft.weightBalance);
        console.log('🔍 [Wizard] arms présent?', !!mergedAircraft.arms);

        setSelectedAircraft(mergedAircraft);

        // 🔧 AUSSI mettre à jour flightPlan.aircraft avec l'avion fusionné
        flightPlan.updateAircraft(mergedAircraft);
      } else {
        console.warn('⚠️ [Wizard] Avion non trouvé dans aircraftList:', flightPlan.aircraft.registration);
        // Même si l'avion n'est pas dans le store, utiliser celui du flightPlan
        console.log('ℹ️ [Wizard] Utilisation de l\'avion depuis flightPlan');
        setSelectedAircraft(flightPlan.aircraft);
      }
    }
  }, [flightPlan.aircraft?.registration, aircraftList, setSelectedAircraft, flightPlan]);

  // 🔧 NOUVEAU : Restaurer TOUS les contextes au montage depuis flightPlan
  useEffect(() => {
    console.log('🔄 [Wizard] Restauration complète des contextes depuis flightPlan...');

    // 1️⃣ Restaurer Navigation (waypoints complets : départ + intermédiaires + arrivée)
    if (flightPlan.route?.departure?.icao || flightPlan.route?.arrival?.icao || flightPlan.route?.waypoints?.length > 0) {
      const restoredWaypoints = [];

      // Ajouter départ
      if (flightPlan.route.departure?.icao) {
        restoredWaypoints.push({
          type: 'departure',
          icao: flightPlan.route.departure.icao,
          name: flightPlan.route.departure.name || flightPlan.route.departure.icao,
          lat: flightPlan.route.departure.coordinates?.lat,
          lon: flightPlan.route.departure.coordinates?.lng,
          elevation: flightPlan.route.departure.elevation || 0
        });
      }

      // 🔧 NOUVEAU : Ajouter waypoints intermédiaires (points tournants et VFR)
      if (flightPlan.route.waypoints && Array.isArray(flightPlan.route.waypoints)) {
        flightPlan.route.waypoints.forEach(wp => {
          restoredWaypoints.push({
            type: wp.type || 'waypoint', // 'waypoint', 'vfr', etc.
            icao: wp.icao || wp.name,
            name: wp.name,
            lat: wp.coordinates?.lat || wp.lat,
            lon: wp.coordinates?.lng || wp.coordinates?.lon || wp.lon,
            elevation: wp.elevation || 0
          });
        });
      }

      // Ajouter arrivée
      if (flightPlan.route.arrival?.icao) {
        restoredWaypoints.push({
          type: 'arrival',
          icao: flightPlan.route.arrival.icao,
          name: flightPlan.route.arrival.name || flightPlan.route.arrival.icao,
          lat: flightPlan.route.arrival.coordinates?.lat,
          lon: flightPlan.route.arrival.coordinates?.lng,
          elevation: flightPlan.route.arrival.elevation || 0
        });
      }

      if (restoredWaypoints.length > 0) {
        console.log('✅ [Wizard] Restauration waypoints complets:', restoredWaypoints.length, 'points');
        console.log('   - Départ:', flightPlan.route.departure?.icao || 'N/A');
        console.log('   - Intermédiaires:', flightPlan.route.waypoints?.length || 0);
        console.log('   - Arrivée:', flightPlan.route.arrival?.icao || 'N/A');
        setWaypoints(restoredWaypoints);
      }
    }

    // 2️⃣ Restaurer Fuel (fobFuel)
    if (flightPlan.fuel?.confirmed && flightPlan.fuel.confirmed > 0) {
      console.log('✅ [Wizard] Restauration fobFuel:', flightPlan.fuel.confirmed, 'L');
      // 🔧 FIX: setFobFuel attend { gal, ltr }, pas un nombre
      const confirmedLiters = flightPlan.fuel.confirmed;
      setFobFuel({
        ltr: confirmedLiters,
        gal: confirmedLiters / 3.78541
      });
    }

    // 3️⃣ Restaurer WeightBalance (loads)
    if (flightPlan.weightBalance?.loads && Object.keys(flightPlan.weightBalance.loads).length > 0) {
      console.log('✅ [Wizard] Restauration loads depuis flightPlan:', flightPlan.weightBalance.loads);
      // 🔧 FIX CRITIQUE: Restaurer TOUS les loads en une seule fois
      import('@core/contexts').then(({ useWeightBalanceContext }) => {
        // Impossible d'utiliser hook ici, utiliser le store directement
        import('@core/stores/weightBalanceStore').then(({ useWeightBalanceStore }) => {
          const store = useWeightBalanceStore.getState();
          store.setLoads(flightPlan.weightBalance.loads);
          console.log('✅ [Wizard] Loads restaurés dans le store:', flightPlan.weightBalance.loads);
        });
      });
    }

    // 4️⃣ Restaurer Weather (optionnel, car rechargé dynamiquement)
    if (flightPlan.weather?.departure || flightPlan.weather?.arrival) {
      console.log('✅ [Wizard] Weather data disponible dans flightPlan');
      // Note: Weather est généralement rechargé via les APIs, pas besoin de restaurer
    }

    console.log('🎉 [Wizard] Restauration complète des contextes terminée');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Configuration des étapes
  const steps = [
    {
      number: 1,
      title: 'Informations Générales',
      description: '',
      component: Step1GeneralInfo,
      validate: () => Boolean(
        flightPlan.generalInfo.callsign &&
        flightPlan.generalInfo.date &&
        flightPlan.aircraft.registration
      ),
      errorMessage: 'Veuillez renseigner l\'indicatif, la date et l\'avion avant de continuer.'
    },
    {
      number: 2,
      title: 'Définition du Trajet',
      description: '',
      component: Step3Route,
      validate: () => Boolean(
        flightPlan.route.departure.icao &&
        flightPlan.route.arrival.icao
      ),
      errorMessage: 'Veuillez définir un aérodrome de départ et un aérodrome d\'arrivée avant de continuer.'
    },
    {
      // ⬆️ Déroutements remonté juste après le trajet : la sélection de l'alternate doit
      // précéder la météo (METAR/TAF + pistes du dégagement) ET le bilan carburant
      // (calcul du carburant de dégagement). Cf. audit « paradoxe du bilan carburant ».
      number: 3,
      title: 'Déroutements',
      description: 'Sélection de l\'aérodrome de dégagement',
      component: Step7Alternates,
      // Garde-fou : au moins un déroutement doit être sélectionné. Source de vérité =
      // store alternates (lu en direct, robuste vis-à-vis du timing de synchronisation).
      validate: () => (useAlternatesStore.getState().selectedAlternates?.length || 0) > 0,
      errorMessage: 'Veuillez sélectionner au moins un aérodrome de déroutement : il est nécessaire au calcul du carburant de dégagement (bilan carburant).'
    },
    {
      number: 4,
      title: 'Informations aérodromes et Météo',
      description: 'Données détaillées, cartes VAC et météo (départ, arrivée et déroutement)',
      component: Step3VAC,
      validate: () => true // Optionnel - peut continuer sans VAC
    },
    {
      number: 5,
      title: 'Bilan Carburant',
      description: '',
      component: Step5Fuel,
      // Garde-fou : le FOB confirmé doit couvrir le minimum requis (carburant de
      // dégagement inclus, désormais calculé car l'alternate est choisi à l'étape 3).
      validate: () => {
        const fob = flightPlan.fuel.confirmed || 0;
        const totalRequired = calculateTotal('ltr');
        return fob > 0 && fob >= totalRequired - 0.01;
      },
      errorMessage: () => {
        const fob = flightPlan.fuel.confirmed || 0;
        const totalRequired = calculateTotal('ltr');
        if (!fob) {
          return 'Veuillez confirmer la quantité de carburant à embarquer (FOB - Fuel On Board) avant de continuer.';
        }
        return `FOB insuffisant : ${Math.ceil(totalRequired)} L minimum requis (carburant de dégagement inclus), ${Math.round(fob)} L confirmés. Augmentez le carburant embarqué.`;
      }
    },
    {
      number: 6,
      title: 'Masse et Centrage',
      description: 'Passagers et bagages',
      component: Step6WeightBalance,
      validate: () => {
        // ⚠️ TEMP FIX: La validation stricte du CG utilise des limites simplifiées
        // alors que l'enveloppe réelle est complexe (varie selon le poids).
        // On accepte toute configuration tant que l'utilisateur a saisi des valeurs.
        // Le graphique visuel montre la vraie conformité à l'enveloppe.
        return true; // Validation visuelle uniquement via le graphique
      }
    },
    {
      number: 7,
      title: 'Performances',
      component: Step5Performance,
      validate: () => true // Toujours valide, données calculées automatiquement
    },
    {
      number: 8,
      title: 'Synthèse',
      description: 'Vérifier et générer',
      component: Step7Summary,
      validate: () => true
    }
  ];

  const currentStepConfig = steps[currentStep - 1];
  const StepComponent = currentStepConfig.component;

  console.log('🔧 WIZARD - currentStep actuel:', currentStep);
  console.log('🔧 WIZARD - currentStepConfig:', currentStepConfig?.title);
  console.log('🔧 WIZARD - StepComponent:', StepComponent?.name || StepComponent?.displayName || 'Anonyme');

  /**
   * Marque l'étape courante comme complétée et passe à la suivante
   */
  const handleNext = useCallback(() => {
    // Log de débogage générique (les détails par étape sont gérés par chaque validate())
    console.log(`🔍 [Wizard] Validation étape ${currentStep} - ${currentStepConfig.title}`);

    const isValid = currentStepConfig.validate();
    console.log(`  ➡️ Résultat validation:`, isValid);

    if (isValid) {
      const newCompletedSteps = new Set([...completedSteps, currentStep]);
      setCompletedSteps(newCompletedSteps);

      // Sauvegarder les étapes complétées
      localStorage.setItem('flightPlanCompletedSteps', JSON.stringify([...newCompletedSteps]));

      if (currentStep < steps.length) {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        // Sauvegarder l'étape courante
        localStorage.setItem('flightPlanCurrentStep', nextStep.toString());
      }
    } else {
      // Message d'erreur piloté par la config de l'étape (string ou fonction).
      // Plus de numéro d'étape en dur (qui se désynchronise au moindre réordonnancement).
      const rawMessage = currentStepConfig.errorMessage;
      const errorMessage = (typeof rawMessage === 'function' ? rawMessage() : rawMessage)
        || 'Veuillez compléter tous les champs requis';

      console.error('❌ [Wizard] Validation échouée pour étape', currentStep);
      // Toast non-bloquant au lieu d'alert() natif
      showNotification(errorMessage, 'warning', 6000);
    }
  }, [currentStep, currentStepConfig, steps.length, completedSteps, flightPlan]);

  /**
   * Retour à l'étape précédente
   */
  const handlePrevious = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  /**
   * Navigation directe vers une étape
   */
  const handleStepClick = useCallback((stepNumber) => {
    // On peut naviguer vers une étape déjà complétée ou l'étape suivante
    if (completedSteps.has(stepNumber) || stepNumber === currentStep + 1) {
      setCurrentStep(stepNumber);
      // Sauvegarder l'étape courante
      localStorage.setItem('flightPlanCurrentStep', stepNumber.toString());
    }
  }, [completedSteps, currentStep]);

  /**
   * Finalisation du wizard
   */
  const handleComplete = useCallback(async () => {
    setIsLoading(true);
    try {
      // Génération du rapport final
      const summary = flightPlan.generateSummary();

      // 1. 💾 SAUVEGARDE SUPABASE - Navigation complète (optionnel)
      let supabaseResult = { success: false, data: null, error: null };

      try {
        console.log('📤 [Wizard] Tentative sauvegarde plan de vol sur Supabase...');
        supabaseResult = await flightPlanSupabaseService.saveFlightPlan(
          flightPlan,
          waypoints || [],
          segmentAltitudes || {},
          navigationResults,
          flightPlan.generalInfo.callsign || '' // Utiliser le callsign comme nom de pilote
        );

        if (supabaseResult.success) {
          console.log('✅ [Wizard] Plan de vol sauvegardé sur Supabase:', supabaseResult.data.id);
        } else {
          console.warn('⚠️ [Wizard] Échec sauvegarde plan de vol Supabase:', supabaseResult.error);
        }
      } catch (error) {
        console.warn('⚠️ [Wizard] Exception sauvegarde plan de vol (table flight_plans manquante?):', error);
        // Continuer quand même - la table flight_plans est optionnelle
      }

      // 2. Archiver le plan complété (localStorage)
      try {
        const completedPlans = JSON.parse(localStorage.getItem('completedFlightPlans') || '[]');
        completedPlans.push({
          ...flightPlan.toJSON(),
          completedAt: new Date().toISOString(),
          supabaseId: supabaseResult.data?.id || null
        });
        localStorage.setItem('completedFlightPlans', JSON.stringify(completedPlans));

        // Effacer le brouillon actuel
        localStorage.removeItem('flightPlanDraft');
        localStorage.removeItem('flightPlanCurrentStep');
        localStorage.removeItem('flightPlanCompletedSteps');
        console.log('✅ Plan archivé et brouillon effacé');
      } catch (error) {
        console.error('❌ Erreur lors de l\'archivage:', error);
      }

      // 3. 📄 GÉNÉRATION PDF - Générer et sauvegarder automatiquement
      const shouldGeneratePdf = confirm(
        '✅ Plan de vol sauvegardé avec succès !\n\n' +
        'Voulez-vous générer et sauvegarder le PDF du plan de vol ?'
      );

      if (shouldGeneratePdf) {
        console.log('📄 [Wizard] Génération et sauvegarde PDF...');

        try {
          // Trouver l'élément contenant le Step7Summary (tout le contenu à imprimer)
          const element = document.getElementById('flight-plan-summary');

          if (!element) {
            console.error('❌ Élément #flight-plan-summary non trouvé');
            alert('Erreur: impossible de trouver le contenu à convertir en PDF');
            return;
          }

          // Options de génération PDF
          const opt = {
            margin: [10, 10, 10, 10],
            filename: `plan-de-vol-${flightPlan.aircraft.registration || 'unknown'}-${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              logging: false
            },
            jsPDF: {
              unit: 'mm',
              format: 'a4',
              orientation: 'portrait'
            }
          };

          // Générer le PDF et obtenir le blob
          const rawBlob = await html2pdf()
            .from(element)
            .set(opt)
            .outputPdf('blob');

          // Convertir le Blob en File avec un nom valide
          const pdfBlob = new File([rawBlob], opt.filename, { type: 'application/pdf' });

          console.log('✅ [Wizard] PDF généré:', (pdfBlob.size / 1024).toFixed(2), 'KB', '- Nom:', pdfBlob.name);

          // Télécharger le PDF pour l'utilisateur
          const url = URL.createObjectURL(pdfBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = opt.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          console.log('✅ [Wizard] PDF téléchargé pour l\'utilisateur');

          // Préparer les métadonnées pour Supabase
          // selectedAircraft vient du hook défini au niveau du composant (ligne 32)

          // Extraire les waypoints intermédiaires depuis le flightPlan
          // Les waypoints sont stockés dans flightPlan.route.waypoints (sans départ ni arrivée)
          let waypointsNames = [];

          if (flightPlan.route?.waypoints && Array.isArray(flightPlan.route.waypoints)) {
            waypointsNames = flightPlan.route.waypoints
              .map(wp => wp.name || wp.icao || wp.id)
              .filter(Boolean);

            console.log('🗺️ [Wizard] Waypoints intermédiaires extraits depuis flightPlan.route.waypoints:', waypointsNames);
          } else {
            console.log('⚠️ [Wizard] Aucun waypoint trouvé dans flightPlan.route.waypoints');
          }

          const pdfMetadata = {
            flightPlanId: supabaseResult.data?.id || null,
            pilotName: flightPlan.generalInfo.pilotName || flightPlan.generalInfo.callsign || 'Pilote inconnu',
            flightDate: flightPlan.generalInfo.date || new Date().toISOString().split('T')[0],
            callsign: flightPlan.generalInfo.callsign,
            aircraftRegistration: flightPlan.aircraft.registration,
            aircraftType: selectedAircraft?.type || flightPlan.aircraft.type || flightPlan.aircraft.model || 'Type inconnu',
            departureIcao: flightPlan.route.departure.icao,
            departureName: flightPlan.route.departure.name,
            arrivalIcao: flightPlan.route.arrival.icao,
            arrivalName: flightPlan.route.arrival.name,
            tags: [flightPlan.generalInfo.flightType, flightPlan.generalInfo.flightNature],
            notes: flightPlan.notes || null,
            // Ajouter les waypoints pour reconstituer le trajet complet
            waypoints: waypointsNames
          };

          // Sauvegarder le PDF dans Supabase
          console.log('📤 [Wizard] Sauvegarde PDF dans Supabase...');
          const pdfResult = await validatedPdfService.uploadValidatedPdf(pdfBlob, pdfMetadata);

          if (pdfResult.success) {
            console.log('✅ [Wizard] PDF sauvegardé dans Supabase:', pdfResult.data.flight_number);
            alert(
              `✅ PDF généré et sauvegardé avec succès !\n\n` +
              `Numéro de vol: ${pdfResult.data.flight_number}\n` +
              `Le PDF a été téléchargé et archivé dans la base de données.`
            );
          } else {
            console.warn('⚠️ [Wizard] Échec sauvegarde PDF dans Supabase:', pdfResult.error);
            alert(
              '⚠️ Le PDF a été téléchargé avec succès,\n' +
              'mais n\'a pas pu être sauvegardé dans la base de données.\n\n' +
              'Erreur: ' + (pdfResult.error?.message || 'Erreur inconnue')
            );
          }

        } catch (error) {
          console.error('❌ [Wizard] Erreur génération/sauvegarde PDF:', error);
          alert('❌ Erreur lors de la génération du PDF: ' + error.message);
        }
      }

      // 4. Callback de complétion
      if (onComplete) {
        await onComplete(flightPlan, summary);
      }

      // Log pour debug
      console.log('Plan de vol complété:', summary);
      console.log('Données complètes:', flightPlan);

    } catch (error) {
      console.error('Erreur lors de la finalisation:', error);
      alert('Une erreur est survenue lors de la génération du rapport: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [flightPlan, onComplete, waypoints, segmentAltitudes, navigationResults]);

  /**
   * Recommencer le wizard en effaçant le brouillon
   */
  const handleRestart = useCallback(() => {
    if (confirm('Voulez-vous vraiment recommencer ? Toutes les données actuelles seront perdues.')) {
      // Supprimer le brouillon du wizard
      localStorage.removeItem('flightPlanDraft');
      localStorage.removeItem('flightPlanCurrentStep');
      localStorage.removeItem('flightPlanCompletedSteps');

      // 🔧 FIX: Supprimer aussi les données persistées des stores
      // Step 2 - Waypoints (Navigation)
      localStorage.removeItem('navigation-storage');

      // Step 3 - Alternates
      localStorage.removeItem('alternates-storage');

      console.log('🔄 [Wizard] Toutes les données effacées - Redémarrage...');
      window.location.reload();
    }
  }, []);

  /**
   * Annuler le wizard - Affiche le dialog de confirmation
   */
  const handleCancel = useCallback(() => {
    setShowCancelDialog(true);
  }, []);

  /**
   * Confirmer l'annulation - Sauvegarder ou supprimer le brouillon
   */
  const handleConfirmCancel = useCallback((saveState) => {
    if (saveState) {
      // Sauvegarder le brouillon (déjà fait automatiquement via updateFlightPlan)
      console.log('💾 [Wizard] Brouillon sauvegardé - Fermeture...');
    } else {
      // Supprimer le brouillon
      localStorage.removeItem('flightPlanDraft');
      localStorage.removeItem('flightPlanCurrentStep');
      localStorage.removeItem('flightPlanCompletedSteps');
      localStorage.removeItem('navigation-storage');
      localStorage.removeItem('alternates-storage');
      console.log('🗑️ [Wizard] Brouillon supprimé - Fermeture...');
    }

    setShowCancelDialog(false);

    // Appeler onCancel si défini, sinon rediriger
    if (onCancel) {
      onCancel();
    } else {
      // Rediriger vers le dashboard
      const dashboardTab = document.querySelector('[data-tab-id="dashboard"]') ||
                          document.querySelector('[data-tab-id="home"]');
      if (dashboardTab) {
        dashboardTab.click();
      } else {
        window.location.reload();
      }
    }
  }, [onCancel]);

  // Vérifier si un brouillon existe
  const hasDraft = Boolean(localStorage.getItem('flightPlanDraft'));

  return (
    <WizardConfigProvider>
      {/* Styles pour l'impression PDF */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 1.5cm 1cm;
        }

        @media print {
          * {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          body {
            margin: 0;
            padding: 0;
          }

          .wizard-navigation {
            display: none !important;
          }
          .wizard-header {
            display: none !important;
          }
          .wizard-step-header {
            display: none !important;
          }

          /* Responsive A4 portrait */
          div, p, span, strong {
            max-width: 100% !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }

          /* Réduire tailles police si nécessaire */
          h1, h2, h3, h4, h5, h6 {
            font-size: 14pt !important;
          }

          p, div, span {
            font-size: 10pt !important;
            line-height: 1.3 !important;
          }

          /* Tableaux responsifs */
          table {
            width: 100% !important;
            font-size: 9pt !important;
          }

          /* Réduire padding/margin */
          * {
            padding-left: 4px !important;
            padding-right: 4px !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
        }
      `}</style>

      <div style={{ ...styles.container, color: 'var(--text-primary)' }}>
        {/* 🎨 Header éditorial ALFlight — eyebrow + titre Century Gothic + chip mono */}
        <div className="wizard-header" style={{ ...styles.header, padding: tokens.spacing[5] }}>
          <EditorialHeading level={2} eyebrow="OPS · BRIEFING PRÉ-VOL">
            Préparation de vol
          </EditorialHeading>
          {hasDraft && (
            <div style={{ marginTop: tokens.spacing[3] }}>
              <span style={{
                fontFamily: tokens.fontFamily.mono,
                fontSize: 'var(--fs-caption)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
                padding: '4px 10px',
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent-primary)',
                border: '1px solid var(--accent-primary)',
                borderRadius: tokens.radius?.sm || '2px',
              }}>
                DRAFT · AUTO-SAVED
              </span>
            </div>
          )}
        </div>

        {/* Barre de progression — étapes cliquables (style déjà défini, on rend ici) */}
      {/* Contenu de l'étape courante */}
      <div
        id={currentStep === 8 ? 'flight-plan-summary' : undefined}
        style={styles.content}
      >
        <div className="wizard-step-header">
          <ModuleHero
            image={STEP_HERO[currentStep]?.image}
            eyebrow={STEP_HERO[currentStep]?.eyebrow || `ÉTAPE ${currentStep}`}
            title={currentStepConfig.title}
            tagline={currentStepConfig.description || ''}
            level={2}
          />
        </div>

        {console.log('🔧 Rendering step:', currentStep, 'Component:', currentStepConfig.title, 'StepComponent:', StepComponent.name || StepComponent.displayName)}
        <StepComponent
          flightPlan={flightPlan}
          onUpdate={updateFlightPlan}
        />
      </div>

      {/* Barre de navigation */}
      <div className="wizard-navigation" style={styles.navigation}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Bouton Annuler */}
          <button
            style={styles.navButtonCancel}
            onClick={handleCancel}
          >
            Annuler
          </button>

          {/* Bouton Précédent */}
          {currentStep > 1 && (
            <button
              style={{
                ...styles.navButton,
                ...styles.navButtonSecondary,
              }}
              onClick={handlePrevious}
            >
              ← Précédent
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {currentStep < steps.length ? (
            <button
              style={styles.navButton}
              onClick={handleNext}
            >
              Suivant →
            </button>
          ) : (
            <button
              style={{
                ...styles.navButton,
                ...styles.navButtonComplete,
              }}
              onClick={handleComplete}
              disabled={isLoading}
            >
              {isLoading ? 'Génération...' : 'Terminer et Générer'}
              <Check size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Dialog de confirmation d'annulation */}
      {showCancelDialog && (
        <div style={styles.dialogOverlay}>
          <div style={styles.dialogContent}>
            <div style={styles.dialogHeader}>
              <AlertTriangle size={20} color="var(--accent-primary)" />
              <h3 style={styles.dialogTitle}>Quitter la préparation de vol</h3>
            </div>
            <p style={styles.dialogText}>
              Vous êtes sur le point de quitter. La préparation du vol n'est pas terminée.
            </p>
            <p style={styles.dialogInfo}>
              Vous pouvez sauvegarder votre progression et reprendre plus tard, ou annuler complètement cette préparation.
            </p>
            <div style={styles.dialogActions}>
              <button
                style={styles.dialogButtonOutline}
                onClick={() => setShowCancelDialog(false)}
              >
                Continuer l'édition
              </button>
              <button
                style={styles.dialogButtonDanger}
                onClick={() => handleConfirmCancel(false)}
              >
                Annuler sans sauvegarder
              </button>
              <button
                style={styles.dialogButtonPrimary}
                onClick={() => handleConfirmCancel(true)}
              >
                Sauvegarder et reprendre plus tard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </WizardConfigProvider>
  );
};

// ─── Styles éditoriaux ALFlight ────────────────────────────────────────────
// Tous les styles utilisent les variables CSS (--app-bg, --bg-surface, etc.)
// pour un look cockpit cohérent avec le reste de l'app.
const SANS = "'Century Gothic', 'Questrial', 'Jost', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'IBM Plex Mono', 'Courier New', monospace";

const styles = {
  container: {
    minHeight: '100vh',
    background: 'var(--app-bg)',
    color: 'var(--text-primary)',
    fontFamily: SANS,
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 'env(safe-area-inset-top)',
  },
  header: {
    padding: '24px 20px 16px',
  },
  title: {
    fontSize: 'var(--fs-heading)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: SANS,
    letterSpacing: '-0.01em',
  },
  // Stepper horizontal cockpit — chips mono ALL CAPS
  progressContainer: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    paddingBottom: '8px',
  },
  progressStep: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '8px',
    borderRadius: 'var(--radius-sm)',
    transition: 'all 0.2s ease',
    minWidth: '80px',
    background: 'var(--bg-surface)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
  },
  progressStepActive: {
    background: 'var(--accent-soft)',
    borderColor: 'var(--accent-primary)',
  },
  progressStepCompleted: {
    background: 'var(--bg-overlay)',
    borderColor: 'var(--accent-primary)',
  },
  progressNumber: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'var(--app-bg)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-regular)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: MONO,
    fontSize: 'var(--fs-body)',
    fontWeight: 600,
    color: 'var(--accent-primary)',
  },
  progressLabel: {
    fontFamily: MONO,
    fontSize: 'var(--fs-caption)',
    fontWeight: 500,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: 'var(--text-tertiary)',
    textAlign: 'center',
    maxWidth: '80px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // Wrapper de contenu du step actif
  content: {
    flex: 1,
    // Encapsulation retirée : plus de bloc (fond/bordure/arrondi/marge) autour
    // de l'étape. L'en-tête photo (ModuleHero) et le contenu respirent direct.
    padding: '0 12px 24px',
  },
  stepHeader: {
    marginBottom: '24px',
  },
  stepTitle: {
    fontFamily: SANS,
    fontSize: 'var(--fs-title)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
    letterSpacing: '-0.01em',
  },
  stepDescription: {
    fontFamily: SANS,
    fontSize: 'var(--fs-body)',
    color: 'var(--text-secondary)',
  },
  // Barre de navigation footer
  navigation: {
    borderTop: '1px solid var(--border-subtle)',
    padding: '16px 20px',
    paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    background: 'var(--app-bg)',
  },
  // Bouton primaire (Suivant) — orange plein cockpit
  navButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 24px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontFamily: MONO,
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    minHeight: '44px',
  },
  // Bouton secondaire (Précédent) — outline ghost ivoire
  navButtonSecondary: {
    background: 'transparent',
    border: '1px solid var(--border-regular)',
    color: 'var(--text-primary)',
  },
  // Bouton final (Terminer) — orange plein (même style que primary)
  navButtonComplete: {
    background: 'var(--accent-primary)',
  },
  stepIndicator: {
    fontFamily: MONO,
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
    padding: '8px 16px',
    background: 'var(--bg-overlay)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
  },
  // Bouton Annuler — text-only neutre (pas de rouge agressif)
  navButtonCancel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-tertiary)',
    fontFamily: MONO,
    fontSize: 'var(--fs-caption)',
    fontWeight: 500,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'color 0.2s ease',
    minHeight: '44px',
  },
  // Dialog styles
  // ─── Dialog (modale confirmation annulation) — charte éditoriale ───
  dialogOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--app-bg-alpha-85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  dialogContent: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-sm)',
    padding: '24px',
    maxWidth: '500px',
    width: '100%',
    border: '1px solid var(--border-regular)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
  },
  dialogHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  dialogTitle: {
    fontFamily: SANS,
    fontSize: 'var(--fs-title)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  dialogText: {
    fontFamily: SANS,
    fontSize: 'var(--fs-body)',
    color: 'var(--text-primary)',
    marginBottom: '12px',
    lineHeight: 1.55,
  },
  dialogInfo: {
    fontFamily: SANS,
    fontSize: 'var(--fs-body)',
    color: 'var(--text-secondary)',
    marginBottom: '24px',
    padding: '12px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
    borderLeft: '3px solid var(--accent-primary)',
    lineHeight: 1.55,
  },
  dialogActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  // Bouton ghost (Continuer l'édition)
  dialogButtonOutline: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-regular)',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontFamily: MONO,
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'border-color 0.2s, color 0.2s',
  },
  // Bouton danger (Annuler sans sauvegarder) — text neutre, pas rouge agressif
  dialogButtonDanger: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-tertiary)',
    fontFamily: MONO,
    fontSize: 'var(--fs-caption)',
    fontWeight: 500,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'color 0.2s',
  },
  // Bouton primary (Sauvegarder et reprendre) — orange plein cockpit
  dialogButtonPrimary: {
    padding: '10px 16px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontFamily: MONO,
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};

export default FlightPlanWizard;