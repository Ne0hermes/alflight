import React, { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, Plane, TestTube } from 'lucide-react';
import { theme } from '../../styles/theme';
import { FlightPlanData } from './models/FlightPlanData';
import { WizardConfigProvider } from './contexts/WizardConfigContext';

// Import des étapes
import { Step1GeneralInfo } from './steps/Step1GeneralInfo';
import { Step2Aircraft } from './steps/Step2Aircraft';
import { Step3Route } from './steps/Step3Route';
import { Step4Alternates } from './steps/Step4Alternates';
import { Step5Fuel } from './steps/Step5Fuel';
import { Step6WeightBalance } from './steps/Step6WeightBalance';
import { Step7Summary } from './steps/Step7Summary';

/**
 * Composant principal du wizard de préparation de vol
 * Gère la navigation entre les étapes et l'état global du plan de vol
 */
export const FlightPlanWizard = ({ onComplete, onCancel }) => {
  // Mode test activé via URL param ou localStorage
  const [testMode, setTestMode] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('testMode') === 'true' || localStorage.getItem('flightWizardTestMode') === 'true';
  });

  // État principal : instance du modèle de données
  const [flightPlan] = useState(() => {
    let plan = new FlightPlanData();

    // Si mode test, pré-remplir avec des données de test
    if (testMode) {
      plan.generalInfo = {
        callsign: 'F-TEST',
        date: new Date().toISOString().split('T')[0],
        flightType: 'VFR',
        pilotName: 'Test Pilot',
        remarks: 'Vol de test'
      };
      plan.aircraft = {
        registration: 'F-GKXS',
        type: 'DR400',
        cruiseSpeed: 120,
        fuelCapacity: 110,
        emptyWeight: 640,
        maxTakeoffWeight: 1100
      };
      plan.route = {
        departure: { icao: 'LFST', name: 'Strasbourg' },
        arrival: { icao: 'LFGA', name: 'Colmar' },
        waypoints: [],
        cruiseLevel: 3500,
        distance: 45,
        estimatedTime: 25
      };
      plan.alternates = [{ icao: 'LFGC', name: 'Strasbourg Neuhof' }];
      plan.fuel = {
        trip: 15,
        contingency: 2,
        reserve: 10,
        alternate: 5,
        extra: 5,
        confirmed: 37
      };
      plan.weightBalance = {
        emptyWeight: 640,
        pilot: 80,
        passenger: 75,
        baggage: 20,
        fuel: 27,
        totalWeight: 842,
        withinLimits: true
      };
    } else {
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
    }

    return plan;
  });

  // État de navigation - Restaurer depuis localStorage
  const [currentStep, setCurrentStep] = useState(() => {
    try {
      const saved = localStorage.getItem('flightPlanCurrentStep');
      return saved ? parseInt(saved, 10) : 1;
    } catch {
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
      localStorage.setItem('flightPlanDraft', flightPlan.toJSON());
      console.log('💾 Brouillon sauvegardé automatiquement');
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
    }

    // Forcer le re-render
    forceUpdate({});
  }, [flightPlan]);

  // Configuration des étapes
  const steps = [
    {
      number: 1,
      title: 'Informations Générales',
      description: 'Indicatif, type de vol et date',
      component: Step1GeneralInfo,
      validate: () => Boolean(
        flightPlan.generalInfo.callsign &&
        flightPlan.generalInfo.date
      )
    },
    {
      number: 2,
      title: 'Sélection de l\'Aéronef',
      description: 'Choisir votre appareil',
      component: Step2Aircraft,
      validate: () => Boolean(flightPlan.aircraft.registration)
    },
    {
      number: 3,
      title: 'Définition du Trajet',
      description: 'Départ, arrivée et waypoints',
      component: Step3Route,
      validate: () => Boolean(
        flightPlan.route.departure.icao &&
        flightPlan.route.arrival.icao
      )
    },
    {
      number: 4,
      title: 'Aérodromes de Déroutement',
      description: 'Sélectionner les alternates',
      component: Step4Alternates,
      validate: () => flightPlan.alternates.length > 0
    },
    {
      number: 5,
      title: 'Bilan Carburant',
      description: 'CRM et complément',
      component: Step5Fuel,
      validate: () => flightPlan.fuel.confirmed > 0
    },
    {
      number: 6,
      title: 'Masse et Centrage',
      description: 'Passagers et bagages',
      component: Step6WeightBalance,
      validate: () => flightPlan.weightBalance.withinLimits !== false
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

  /**
   * Marque l'étape courante comme complétée et passe à la suivante
   */
  const handleNext = useCallback(() => {
    if (currentStepConfig.validate()) {
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
      alert('Veuillez compléter tous les champs requis');
    }
  }, [currentStep, currentStepConfig, steps.length, completedSteps]);

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

      // Archiver le plan complété
      try {
        const completedPlans = JSON.parse(localStorage.getItem('completedFlightPlans') || '[]');
        completedPlans.push({
          ...flightPlan,
          completedAt: new Date().toISOString(),
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

      // Callback de complétion
      if (onComplete) {
        await onComplete(flightPlan, summary);
      }

      // Log pour debug
      console.log('Plan de vol complété:', summary);
      console.log('Données complètes:', flightPlan);

    } catch (error) {
      console.error('Erreur lors de la finalisation:', error);
      alert('Une erreur est survenue lors de la génération du rapport');
    } finally {
      setIsLoading(false);
    }
  }, [flightPlan, onComplete]);

  /**
   * Recommencer le wizard en effaçant le brouillon
   */
  const handleRestart = useCallback(() => {
    if (confirm('Voulez-vous vraiment recommencer ? Toutes les données actuelles seront perdues.')) {
      localStorage.removeItem('flightPlanDraft');
      localStorage.removeItem('flightPlanCurrentStep');
      localStorage.removeItem('flightPlanCompletedSteps');
      window.location.reload();
    }
  }, []);

  // Vérifier si un brouillon existe
  const hasDraft = Boolean(localStorage.getItem('flightPlanDraft'));

  return (
    <WizardConfigProvider>
      <div style={styles.container}>
        {/* Header avec progression */}
        <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={styles.title}>
            <Plane size={24} style={{ marginRight: '12px' }} />
            Je prépare mon vol
            {testMode && (
              <span style={{
                fontSize: '14px',
                marginLeft: '12px',
                padding: '4px 12px',
                backgroundColor: '#fbbf24',
                color: '#000',
                borderRadius: '12px',
                fontWeight: 'normal'
              }}>
                🧪 MODE TEST
              </span>
            )}
            {hasDraft && !testMode && (
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
            {hasDraft && !testMode && (
              <button
                onClick={handleRestart}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
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

            {/* Bouton pour activer/désactiver le mode test */}
            <button
              onClick={() => {
                const newTestMode = !testMode;
                setTestMode(newTestMode);
                localStorage.setItem('flightWizardTestMode', newTestMode.toString());
                if (newTestMode) {
                  window.location.reload(); // Recharger pour appliquer les données de test
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: testMode ? '#ef4444' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              title={testMode ? 'Désactiver le mode test' : 'Activer le mode test pour pré-remplir les données'}
            >
              <TestTube size={16} />
              {testMode ? 'Désactiver Test' : 'Mode Test'}
            </button>
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
        <div style={styles.stepHeader}>
          <h2 style={styles.stepTitle}>
            Étape {currentStep} : {currentStepConfig.title}
          </h2>
          <p style={styles.stepDescription}>
            {currentStepConfig.description}
          </p>
        </div>

        <div style={styles.stepContent}>
          <StepComponent
            flightPlan={flightPlan}
            onUpdate={updateFlightPlan}
          />
        </div>
      </div>

      {/* Barre de navigation */}
      <div style={styles.navigation}>
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
            disabled={!flightPlan.isComplete() || isLoading}
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
    border: `1px solid ${theme.colors.border}`,
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
    border: 'none',
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