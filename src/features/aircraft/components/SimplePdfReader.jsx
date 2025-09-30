// src/features/aircraft/components/SimplePdfReader.jsx
import React, { useState } from 'react';
import { generateDefaultChart } from '../utils/performanceCharts';
import { showNotification } from '../../../shared/components/Notification';

/**
 * Lecteur PDF simplifié qui utilise FileReader pour extraire le texte de base
 */
export const SimplePdfReader = ({ file, onExtracted, onError }) => {
  const [processing, setProcessing] = useState(false);

  React.useEffect(() => {
    if (file) {
      extractPdfData(file);
    }
  }, [file]);

  const extractPdfData = async (pdfFile) => {
    setProcessing(true);
    
    try {
      // Créer un objet avec les données par défaut
      const aircraftCategory = 'light'; // Par défaut
      
      const extractedInfo = {
        fileName: pdfFile.name,
        fileSize: (pdfFile.size / 1024 / 1024).toFixed(2) + ' MB',
        pageCount: 0,
        uploadDate: new Date().toISOString(),
        dataSource: 'Valeurs par défaut (PDF stocké uniquement)', // Indication claire de la source
        sections: [],
        performances: {
          // Vitesses par défaut pour un avion léger - PAS extraites du PDF
          vso: 45,
          vs1: 50,
          vfe: 85,
          vno: 125,
          vne: 160,
          va: 95,
          vx: 60,
          vy: 75,
          vr: 55,
          takeoffRoll: 250,
          takeoffDistance: 400,
          landingRoll: 200,
          landingDistance: 450
        },
        limitations: {
          maxCrosswind: 15,
          maxTailwind: 5,
          mtow: 1200,
          mlw: 1150
        },
        procedures: {},
        performanceCharts: {
          takeoffDistance: generateDefaultChart('takeoff_distance', aircraftCategory),
          takeoffRoll: generateDefaultChart('takeoff_roll', aircraftCategory),
          landingDistance: generateDefaultChart('landing_distance', aircraftCategory),
          landingRoll: generateDefaultChart('landing_roll', aircraftCategory),
          climbRate: generateDefaultChart('climb_rate', aircraftCategory)
        }
      };

      // Lire le fichier comme base64 pour le stocker
      const reader = new FileReader();
      reader.onload = () => {
        extractedInfo.pdfData = reader.result;
        showNotification(
          '📄 PDF enregistré. Les données de performances utilisent les valeurs par défaut de l\'application (extraction automatique non disponible).',
          'warning',
          7000
        );
        onExtracted(extractedInfo);
      };
      reader.onerror = () => {
        showNotification(
          '❌ Erreur lors de la lecture du fichier PDF',
          'error',
          5000
        );
        onError('Erreur lors de la lecture du fichier');
      };
      reader.readAsDataURL(pdfFile);
      
    } catch (err) {
      console.error('Erreur extraction:', err);
      onError('Impossible d\'extraire les données du PDF. Utilisation des valeurs par défaut.');
    } finally {
      setProcessing(false);
    }
  };

  return null; // Composant invisible
};

export default SimplePdfReader;