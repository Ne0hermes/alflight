import React, { useEffect, useState } from 'react';
import PerformanceWizard from '../PerformanceWizard';

const Step4Performance = ({ data, updateData, errors = {} }) => {
  // État local pour stocker les données de performance temporaires
  const [savedPerformanceData, setSavedPerformanceData] = useState(null);
  const [wizardStep, setWizardStep] = useState(1);

  console.log('🔵 Step4Performance - Montage du composant');
  console.log('🔵 Données reçues:', {
    hasAdvancedPerformance: !!data.advancedPerformance,
    hasPerformanceTables: !!data.performanceTables,
    hasPerformanceModels: !!data.performanceModels,
    advancedPerformance: data.advancedPerformance,
    performanceTables: data.performanceTables
  });

  // Restaurer les données sauvegardées au montage du composant
  useEffect(() => {
    console.log('🟡 useEffect - Vérification des données');
    // Vérifier si des données existent déjà dans le wizard
    if (data.advancedPerformance || data.performanceTables || data.performanceModels) {
      setSavedPerformanceData({
        advancedPerformance: data.advancedPerformance,
        performanceTables: data.performanceTables,
        performanceModels: data.performanceModels,
        flightManual: data.flightManual
      });
      // Si on a déjà des données, démarrer à l'étape 2
      console.log('🟢 CHANGEMENT wizardStep: 1 -> 2');
      setWizardStep(2);
      console.log('📥 Données de performance restaurées depuis le wizard - Démarrage à l\'étape 2');
    } else {
      // Sinon, essayer de récupérer depuis le localStorage
      const storedData = localStorage.getItem('wizard_performance_temp');
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          setSavedPerformanceData(parsedData);
          // Restaurer dans le wizard
          if (parsedData.advancedPerformance) {
            updateData('advancedPerformance', parsedData.advancedPerformance);
          }
          if (parsedData.performanceTables) {
            updateData('performanceTables', parsedData.performanceTables);
          }
          if (parsedData.performanceModels) {
            updateData('performanceModels', parsedData.performanceModels);
          }
          if (parsedData.flightManual) {
            updateData('flightManual', parsedData.flightManual);
          }
          // Si on a restauré des données, démarrer à l'étape 2
          if (parsedData.advancedPerformance || parsedData.performanceTables) {
            console.log('🟠 CHANGEMENT wizardStep depuis localStorage: 1 -> 2');
            setWizardStep(2);
          }
          console.log('📥 Données de performance restaurées depuis localStorage');
        } catch (e) {
          console.error('Erreur lors de la restauration des données:', e);
        }
      }
    }
  }, []);
  // Gestionnaire pour sauvegarder les données de performance
  const handlePerformanceUpdate = (performanceData) => {
    // Créer un objet pour stocker toutes les données
    const dataToSave = {
      advancedPerformance: data.advancedPerformance,
      performanceTables: data.performanceTables,
      performanceModels: data.performanceModels,
      flightManual: data.flightManual
    };
    // Mise à jour des données selon le type
    if (performanceData.advancedPerformance) {
      updateData('advancedPerformance', performanceData.advancedPerformance);
      dataToSave.advancedPerformance = performanceData.advancedPerformance;
    }

    if (performanceData.abacCurves) {
      const newModels = [
        ...(data.performanceModels || []),
        {
          id: `model_${Date.now()}`,
          name: performanceData.abacCurves.name || 'Nouveau modèle ABAC',
          type: 'abac',
          data: performanceData.abacCurves,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      updateData('performanceModels', newModels);
      dataToSave.performanceModels = newModels;
    }

    if (performanceData.tables) {
      updateData('performanceTables', performanceData.tables);
      dataToSave.performanceTables = performanceData.tables;
    }

    // Sauvegarder le manuel de vol avec la configuration
    if (performanceData.flightManual) {
      const manualData = {
        file: performanceData.flightManual,
        uploadDate: new Date().toISOString(),
        version: performanceData.manualVersion || 'Version non spécifiée'
      };
      updateData('flightManual', manualData);
      dataToSave.flightManual = manualData;
    }

    // Sauvegarder dans le localStorage pour persistance
    try {
      localStorage.setItem('wizard_performance_temp', JSON.stringify(dataToSave));
      console.log('💾 Données de performance sauvegardées dans localStorage');
    } catch (e) {
      console.error('Erreur lors de la sauvegarde:', e);
    }
  };

  // Données de l'avion pour contexte
  const aircraft = {
    registration: data.registration,
    model: data.model,
    manufacturer: data.manufacturer,
    type: data.aircraftType,
    category: data.category,
    manex: data.manex // Passer le MANEX existant
  };

  console.log('🔴 Rendu final - wizardStep:', wizardStep);
  console.log('🔴 savedPerformanceData:', savedPerformanceData);

  return (
    <PerformanceWizard
      aircraft={aircraft}
      onPerformanceUpdate={handlePerformanceUpdate}
      initialData={savedPerformanceData}
      startAtStep={wizardStep}
    />
  );
};

export default Step4Performance;