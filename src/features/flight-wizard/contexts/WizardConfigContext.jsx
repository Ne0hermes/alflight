// src/features/flight-wizard/contexts/WizardConfigContext.jsx
import React, { createContext, useContext } from 'react';

// Configuration par défaut pour le wizard
const defaultWizardConfig = {
  navigation: {
    showMap: true,
    showVFRTable: true,
    showWindAnalysis: false, // Masquer par défaut
    showAirspaceAnalysis: false, // Masquer par défaut
    showRunwayAnalysis: true,
    showTopOfDescent: false, // Masquer par défaut
    showWaypointManager: true,
    showExportButtons: false,
    showPrintButton: false,
    simplifiedView: true
  },
  alternates: {
    showMap: true,
    showAutoSearch: true,
    showWeather: false, // Masquer la météo détaillée
    showScoring: true,
    maxAlternates: 3, // Limiter à 3 alternates
    showStatistics: false, // Masquer les statistiques
    simplifiedView: true
  },
  fuel: {
    showDetailedCalculations: true,
    showGraphs: false, // Masquer les graphiques
    showHistory: false, // Masquer l'historique
    showAdvancedOptions: false, // Masquer les options avancées
    simplifiedView: true
  },
  weightBalance: {
    showChart: true,
    showTable: true,
    showScenarios: true,
    showInfo: false, // Masquer les infos détaillées
    showAdvancedInputs: false, // Masquer les entrées avancées
    simplifiedView: true
  },
  global: {
    isWizardMode: true,
    showHeaders: false,
    showFooters: false,
    compactMode: true
  }
};

// Créer le contexte
const WizardConfigContext = createContext(defaultWizardConfig);

// Provider pour wrapper les étapes du wizard
export const WizardConfigProvider = ({ children, customConfig = {} }) => {
  // Fusionner la config par défaut avec la config personnalisée
  const config = {
    ...defaultWizardConfig,
    ...customConfig,
    navigation: { ...defaultWizardConfig.navigation, ...customConfig.navigation },
    alternates: { ...defaultWizardConfig.alternates, ...customConfig.alternates },
    fuel: { ...defaultWizardConfig.fuel, ...customConfig.fuel },
    weightBalance: { ...defaultWizardConfig.weightBalance, ...customConfig.weightBalance },
    global: { ...defaultWizardConfig.global, ...customConfig.global }
  };

  return (
    <WizardConfigContext.Provider value={config}>
      {children}
    </WizardConfigContext.Provider>
  );
};

// Hook pour utiliser la configuration
export const useWizardConfig = () => {
  const context = useContext(WizardConfigContext);
  if (!context) {
    // Si pas dans le wizard, retourner une config qui montre tout
    return {
      navigation: {
        showMap: true,
        showVFRTable: true,
        showWindAnalysis: true,
        showAirspaceAnalysis: true,
        showRunwayAnalysis: true,
        showTopOfDescent: true,
        showWaypointManager: true,
        showExportButtons: true,
        showPrintButton: true,
        simplifiedView: false
      },
      alternates: {
        showMap: true,
        showAutoSearch: true,
        showWeather: true,
        showScoring: true,
        maxAlternates: 10,
        showStatistics: true,
        simplifiedView: false
      },
      fuel: {
        showDetailedCalculations: true,
        showGraphs: true,
        showHistory: true,
        showAdvancedOptions: true,
        simplifiedView: false
      },
      weightBalance: {
        showChart: true,
        showTable: true,
        showScenarios: true,
        showInfo: true,
        showAdvancedInputs: true,
        simplifiedView: false
      },
      global: {
        isWizardMode: false,
        showHeaders: true,
        showFooters: true,
        compactMode: false
      }
    };
  }
  return context;
};

export default WizardConfigContext;