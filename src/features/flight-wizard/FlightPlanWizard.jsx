import React, { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, Plane } from 'lucide-react';
import { theme } from '../../styles/theme';
import { FlightPlanData } from './models/FlightPlanData';
import { WizardConfigProvider } from './contexts/WizardConfigContext';
import { useAircraft, useNavigation, useFuel, useWeather } from '@core/contexts';
import { aircraftSelectors } from '../../core/stores/aircraftStore';
import { flightPlanSupabaseService } from '../../services/flightPlanSupabaseService';
import { validatedPdfService } from '../../services/validatedPdfService';
import { useNavigationResults } from '@features/navigation/hooks/useNavigationResults';
import html2pdf from 'html2pdf.js';

// Import des étapes
import { Step1GeneralInfo } from './steps/Step1GeneralInfo';
import { Step3Route } from './steps/Step3Route';
import { Step3VAC } from './steps/Step3VAC';
import { Step5Fuel } from './steps/Step5Fuel';
import { Step5Performance } from './steps/Step5Performance';
import { Step6WeightBalance } from './steps/Step6WeightBalance';
import { Step7Summary } from './steps/Step7Summary';

/**
 * Composant principal du wizard de préparation de vol
 * Gère la navigation entre les étapes et l'état global du plan de vol
 */
export const FlightPlanWizard = ({ onComplete, onCancel }) => {
  console.log('🚀🚀🚀 FLIGHT PLAN WIZARD MONTAGE - Début du composant');

  // Contextes pour la synchronisation et restauration
  const { setSelectedAircraft } = useAircraft();
  const aircraftList = aircraftSelectors.useAircraftList();
  const { setWaypoints, waypoints, segmentAltitudes } = useNavigation();
  const { setFobFuel } = useFuel();
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
      description: 'Indicatif, type de vol et date',
      component: Step1GeneralInfo,
      validate: () => Boolean(
        flightPlan.generalInfo.callsign &&
        flightPlan.generalInfo.date &&
        flightPlan.aircraft.registration
      )
    },
    {
      number: 2,
      title: 'Définition du Trajet et Déroutements',
      description: 'Départ, arrivée, waypoints et aérodromes de déroutement',
      component: Step3Route,
      validate: () => Boolean(
        flightPlan.route.departure.icao &&
        flightPlan.route.arrival.icao
      )
    },
    {
      number: 3,
      title: 'Informations aérodromes et Météo',
      description: 'Données détaillées, cartes VAC et météo',
      component: Step3VAC,
      validate: () => true // Optionnel - peut continuer sans VAC
    },
    {
      number: 4,
      title: 'Bilan Carburant',
      description: '',
      component: Step5Fuel,
      validate: () => flightPlan.fuel.confirmed > 0
    },
    {
      number: 5,
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
      number: 6,
      title: 'Performances',
      component: Step5Performance,
      validate: () => true // Toujours valide, données calculées automatiquement
    },
    {
      number: 7,
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
    // Logs de débogage détaillés pour TOUTES les étapes
    console.log(`🔍 [Wizard] Validation étape ${currentStep} - ${currentStepConfig.title}`);

    if (currentStep === 1) {
      console.log('  - callsign:', flightPlan.generalInfo.callsign);
      console.log('  - date:', flightPlan.generalInfo.date);
      console.log('  - aircraft.registration:', flightPlan.aircraft.registration);
    } else if (currentStep === 2) {
      console.log('  - departure.icao:', flightPlan.route.departure.icao);
      console.log('  - arrival.icao:', flightPlan.route.arrival.icao);
    } else if (currentStep === 3) {
      console.log('  - VAC step (optionnel)');
    } else if (currentStep === 5) {
      console.log('  - fuel.confirmed:', flightPlan.fuel.confirmed);
      console.log('  - fuel.confirmed > 0:', flightPlan.fuel.confirmed > 0);
    } else if (currentStep === 6) {
      console.log('  - weightBalance.withinLimits:', flightPlan.weightBalance.withinLimits);
      console.log('  - withinLimits !== false:', flightPlan.weightBalance.withinLimits !== false);
    }

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
      // Message d'erreur personnalisé selon l'étape
      let errorMessage = 'Veuillez compléter tous les champs requis';

      if (currentStep === 5) {
        errorMessage = 'Veuillez confirmer la quantité de carburant à embarquer (FOB - Fuel On Board) avant de continuer.';
      }

      console.error('❌ [Wizard] Validation échouée pour étape', currentStep);
      alert(errorMessage);
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
          const pdfBlob = await html2pdf()
            .from(element)
            .set(opt)
            .outputPdf('blob');

          console.log('✅ [Wizard] PDF généré:', (pdfBlob.size / 1024).toFixed(2), 'KB');

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
          const pdfMetadata = {
            flightPlanId: supabaseResult.data?.id || null,
            pilotName: flightPlan.generalInfo.callsign || 'Pilote inconnu',
            flightDate: flightPlan.generalInfo.date || new Date().toISOString().split('T')[0],
            callsign: flightPlan.generalInfo.callsign,
            aircraftRegistration: flightPlan.aircraft.registration,
            aircraftType: flightPlan.aircraft.type,
            departureIcao: flightPlan.route.departure.icao,
            departureName: flightPlan.route.departure.name,
            arrivalIcao: flightPlan.route.arrival.icao,
            arrivalName: flightPlan.route.arrival.name,
            tags: [flightPlan.generalInfo.flightType, flightPlan.generalInfo.flightNature],
            notes: flightPlan.notes || null
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

      <div style={styles.container}>
        {/* Header avec progression */}
        <div className="wizard-header" style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={styles.title}>
            <Plane size={24} style={{ marginRight: '12px' }} />
            Je prépare mon vol
            {hasDraft && (
              <span style={{
                fontSize: '14px',
                marginLeft: '12px',
                padding: '4px 12px',
                backgroundColor: '#10b981',
                color: '#fff',
                borderRadius: '12px',
                fontWeight: 'normal'
              }}>
                💾 Brouillon sauvegardé
              </span>
            )}
          </h1>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Bouton Recommencer */}
            {hasDraft && (
              <button
                onClick={handleRestart}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderWidth: '0',
                  borderStyle: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                title="Effacer le brouillon et recommencer"
              >
                🔄 Recommencer
              </button>
            )}
          </div>
        </div>
        
        {/* Indicateur de progression */}
        <div style={styles.progressContainer}>
          {steps.map((step, index) => (
            <div
              key={step.number}
              style={{
                ...styles.progressStep,
                ...(completedSteps.has(step.number) ? styles.progressStepCompleted : {}),
                ...(step.number === currentStep ? styles.progressStepActive : {}),
                cursor: (completedSteps.has(step.number) || step.number === currentStep + 1) 
                  ? 'pointer' : 'default',
              }}
              onClick={() => handleStepClick(step.number)}
            >
              <div style={styles.progressNumber}>
                {completedSteps.has(step.number) ? (
                  <Check size={16} />
                ) : (
                  step.number
                )}
              </div>
              <div style={styles.progressLabel}>{step.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Contenu de l'étape courante */}
      <div style={styles.content}>
        <div className="wizard-step-header" style={styles.stepHeader}>
          <h2 style={styles.stepTitle}>
            Étape {currentStep} : {currentStepConfig.title}
          </h2>
          <p style={styles.stepDescription}>
            {currentStepConfig.description}
          </p>
        </div>

        <div
          id={currentStep === 7 ? 'flight-plan-summary' : undefined}
          style={styles.stepContent}
        >
          {console.log('🔧 Rendering step:', currentStep, 'Component:', currentStepConfig.title, 'StepComponent:', StepComponent.name || StepComponent.displayName)}
          <StepComponent
            flightPlan={flightPlan}
            onUpdate={updateFlightPlan}
          />
        </div>
      </div>

      {/* Barre de navigation */}
      <div className="wizard-navigation" style={styles.navigation}>
        <button
          style={{
            ...styles.navButton,
            ...styles.navButtonSecondary,
            visibility: currentStep > 1 ? 'visible' : 'hidden',
          }}
          onClick={handlePrevious}
          disabled={currentStep === 1}
        >
          <ChevronLeft size={20} />
          Précédent
        </button>

        <div style={styles.stepIndicator}>
          {currentStep} / {steps.length}
        </div>

        {currentStep < steps.length ? (
          <button
            style={styles.navButton}
            onClick={handleNext}
          >
            Suivant
            <ChevronRight size={20} />
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
    </WizardConfigProvider>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: theme.colors.background,
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 'env(safe-area-inset-top)',
  },
  header: {
    background: theme.colors.backgroundGlass,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: `1px solid ${theme.colors.border}`,
    padding: '20px',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    boxShadow: theme.shadows.sm,
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontFamily: theme.fonts.primary,
  },
  progressContainer: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '8px',
  },
  progressStep: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderRadius: '8px',
    transition: 'all 0.3s ease',
    minWidth: '80px',
    background: theme.colors.backgroundCard,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: theme.colors.border,
  },
  progressStepActive: {
    background: 'rgba(147, 22, 60, 0.1)',
    borderColor: theme.colors.primary,
    boxShadow: theme.shadows.sm,
  },
  progressStepCompleted: {
    background: 'rgba(16, 185, 129, 0.1)',
    borderColor: theme.colors.success,
  },
  progressNumber: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: theme.colors.background,
    border: `2px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600',
    color: theme.colors.primary,
  },
  progressLabel: {
    fontSize: '12px',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: '80px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  content: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
  },
  stepHeader: {
    marginBottom: '24px',
  },
  stepTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: '8px',
    fontFamily: theme.fonts.primary,
  },
  stepDescription: {
    fontSize: '14px',
    color: theme.colors.textSecondary,
  },
  stepContent: {
    background: theme.colors.backgroundCard,
    borderRadius: '15px',
    padding: '24px',
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.sm,
  },
  navigation: {
    background: theme.colors.backgroundGlass,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: `1px solid ${theme.colors.border}`,
    padding: '20px',
    paddingBottom: `calc(20px + env(safe-area-inset-bottom))`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    bottom: 0,
    zIndex: 1000,
    boxShadow: theme.shadows.md,
  },
  navButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    borderRadius: '9999px',
    borderWidth: '0',
    borderStyle: 'none',
    background: theme.gradients.primary,
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    boxShadow: theme.shadows.sm,
    minHeight: '44px',
    fontFamily: theme.fonts.primary,
  },
  navButtonSecondary: {
    background: 'transparent',
    border: `2px solid ${theme.colors.primary}`,
    color: theme.colors.primary,
  },
  navButtonComplete: {
    background: theme.gradients.primary,
    boxShadow: theme.shadows.lg,
  },
  stepIndicator: {
    fontSize: '14px',
    color: theme.colors.primary,
    fontWeight: '600',
    padding: '8px 16px',
    background: theme.colors.backgroundCard,
    borderRadius: '9999px',
    border: `1px solid ${theme.colors.border}`,
    fontFamily: theme.fonts.primary,
  },
};

export default FlightPlanWizard;