// src/features/aircraft/components/PdfExtractor.jsx
import React, { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { extractPerformanceCharts, generateDefaultChart } from '../utils/performanceCharts';
import { showNotification } from '../../../shared/components/Notification';

// Configuration du worker PDF.js pour Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

/**
 * Composant pour extraire les données d'un PDF MANEX
 */
export const PdfExtractor = ({ file, onExtracted, onError }) => {
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    if (file && !extracting) {
      extractPdfData(file);
    }
  }, [file]);

  const extractPdfData = async (pdfFile) => {
    setExtracting(true);
    
    try {
      // Lire le fichier comme ArrayBuffer
      const arrayBuffer = await pdfFile.arrayBuffer();
      
      // Charger le PDF avec PDF.js
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
            
      // Créer l'objet de données extraites
      const extractedInfo = {
        fileName: pdfFile.name,
        fileSize: (pdfFile.size / 1024 / 1024).toFixed(2) + ' MB',
        pageCount: pdf.numPages,
        uploadDate: new Date().toISOString(),
        dataSource: 'Extraction automatique du PDF',
        sections: [],
        performances: {},
        limitations: {},
        procedures: {},
        weightBalance: {},
        systems: {},
        performanceCharts: {},
        // Nouveau: tracker pour savoir quelles valeurs ont été extraites vs par défaut
        extractionDetails: {
          performances: {},
          limitations: {}
        }
      };

      // Extraire le texte de toutes les pages (limité à 50 pages pour performance)
      let fullText = '';
      const maxPages = Math.min(pdf.numPages, 50);
      
      for (let i = 1; i <= maxPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map(item => item.str)
            .join(' ');
          fullText += pageText + '\n';
          
          // Mise à jour du progrès
                  } catch (pageError) {
                  }
      }

      // Analyser le contenu extrait
      extractedInfo.sections = extractSections(fullText);
      
      // Chercher les performances dans le texte complet et dans les sections spécifiques
      let performanceText = fullText;
      
      // Si on a une section "PERFORMANCES" ou "LIMITATION", extraire son contenu
      const perfSectionMatch = fullText.match(/(?:SECTION\s*4|PERFORMANCES|CERTIFIED LIMITATION)[\s\S]{0,5000}/i);
      if (perfSectionMatch) {
        performanceText = perfSectionMatch[0] + '\n' + fullText; // Ajouter au texte complet
              }
      
      const { data: performanceData, details: performanceDetails } = extractPerformanceData(performanceText);
      extractedInfo.performances = performanceData;
      extractedInfo.extractionDetails.performances = performanceDetails;
      
      const { data: limitationData, details: limitationDetails } = extractLimitations(performanceText);
      extractedInfo.limitations = limitationData;
      extractedInfo.extractionDetails.limitations = limitationDetails;
      extractedInfo.procedures = extractProcedures(fullText);
      
      // Extraire les abaques de performances
      const charts = extractPerformanceCharts(fullText);
      
      // Si aucun abaque n'est trouvé, générer des abaques par défaut
      const aircraftCategory = 'light'; // Par défaut, pourrait être déterminé par le contenu
      
      extractedInfo.performanceCharts = {
        takeoffDistance: charts.takeoffDistance || generateDefaultChart('takeoff_distance', aircraftCategory),
        takeoffRoll: charts.takeoffRoll || generateDefaultChart('takeoff_roll', aircraftCategory),
        landingDistance: charts.landingDistance || generateDefaultChart('landing_distance', aircraftCategory),
        landingRoll: charts.landingRoll || generateDefaultChart('landing_roll', aircraftCategory),
        climbRate: charts.climbRate || generateDefaultChart('climb_rate', aircraftCategory)
      };
      
      // Stocker le fichier PDF en base64
      const reader = new FileReader();
      reader.onload = () => {
        extractedInfo.pdfData = reader.result;
        
        // Déterminer si des données ont été vraiment extraites
        const hasExtractedData = 
          Object.keys(extractedInfo.performances).length > 0 ||
          Object.keys(extractedInfo.limitations).length > 0 ||
          extractedInfo.sections.length > 0;
        
        if (hasExtractedData) {
          extractedInfo.dataSource = 'Données extraites du PDF';
          showNotification(
            `✅ Données extraites avec succès du PDF (${Object.keys(extractedInfo.performances).length} performances trouvées)`,
            'success',
            5000
        } else {
          extractedInfo.dataSource = 'PDF stocké - Extraction limitée (valeurs par défaut utilisées)';
          showNotification(
            '⚠️ Extraction partielle du PDF. Utilisation de valeurs par défaut pour les données manquantes.',
            'warning',
            6000
          
          // Ajouter des valeurs par défaut si rien n'a été extrait
          if (Object.keys(extractedInfo.performances).length === 0) {
            extractedInfo.performances = getDefaultPerformances(aircraftCategory);
            // Marquer toutes les performances comme valeurs par défaut
            Object.keys(extractedInfo.performances).forEach(key => {
              extractedInfo.extractionDetails.performances[key] = 'default';
            });
          } else {
            // Compléter avec les valeurs manquantes
            const defaults = getDefaultPerformances(aircraftCategory);
            Object.keys(defaults).forEach(key => {
              if (!extractedInfo.performances[key]) {
                extractedInfo.performances[key] = defaults[key];
                extractedInfo.extractionDetails.performances[key] = 'default';
              }
            });
          }
          
          if (Object.keys(extractedInfo.limitations).length === 0) {
            extractedInfo.limitations = getDefaultLimitations(aircraftCategory);
            // Marquer toutes les limitations comme valeurs par défaut
            Object.keys(extractedInfo.limitations).forEach(key => {
              extractedInfo.extractionDetails.limitations[key] = 'default';
            });
          } else {
            // Compléter avec les valeurs manquantes
            const defaults = getDefaultLimitations(aircraftCategory);
            Object.keys(defaults).forEach(key => {
              if (!extractedInfo.limitations[key]) {
                extractedInfo.limitations[key] = defaults[key];
                extractedInfo.extractionDetails.limitations[key] = 'default';
              }
            });
          }
        }
        
        onExtracted(extractedInfo);
      };
      
      reader.onerror = () => {
        throw new Error('Erreur lors de la conversion en base64');
      };
      
      reader.readAsDataURL(pdfFile);
      
    } catch (err) {
      console.error('Erreur extraction PDF:', err);
      showNotification(
        `❌ Erreur lors de l'extraction: ${err.message}`,
        'error',
        5000
      
      // En cas d'erreur, utiliser le SimplePdfReader comme fallback
      if (onError) {
        onError(err.message);
      }
    } finally {
      setExtracting(false);
    }
  };

  // Fonctions d'extraction
  const extractSections = (text) => {
    const sections = [];
    const patterns = [
      /SECTION\s+(\d+)[:\s-]+([^\n]+)/gi,
      /CHAPITRE\s+(\d+)[:\s-]+([^\n]+)/gi,
      /CHAPTER\s+(\d+)[:\s-]+([^\n]+)/gi,
      /(\d+)\.\s+([A-Z][^\n]{5,50})/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        sections.push({
          number: match[1],
          title: match[2].trim()
        });
      }
    });

    return sections.slice(0, 30); // Limiter à 30 sections
  };

  const extractPerformanceData = (text) => {
    const data = {};
    const details = {}; // Pour tracker la source de chaque valeur
    
    // D'abord, chercher les définitions de vitesses dans le format MANEX
    // Format typique: "v S0 : Stalling Speed..." suivi plus loin de la valeur
    const speedDefinitions = {
      vso: ['v S0', 'v SO', 'VSO', 'Stalling Speed.*landing configuration'],
      vs: ['v S[^0-9]', 'VS[^0-9]', 'Stalling Speed.*given configuration'],
      vs1: ['v S1', 'VS1'],
      vfe: ['v FE', 'VFE', 'Maximum Flaps Extended'],
      vno: ['v NO', 'VNO', 'Maximum Structural Cruising'],
      vne: ['v NE', 'VNE', 'Never Exceed Speed'],
      vo: ['v O', 'Operating Maneuvering Speed'],
      vx: ['v x', 'Best Angle.*Climb'],
      vy: ['v y', 'Best Rate.*Climb'],
      vr: ['v R', 'Rotation Speed'],
      v50: ['v 50', 'Speed at 50 ft']
    };
    
    // Chercher chaque vitesse avec ses différents formats possibles
    Object.keys(speedDefinitions).forEach(speedKey => {
      const patterns = speedDefinitions[speedKey];
      
      for (const pattern of patterns) {
        // Créer une regex pour chercher la définition suivie de la valeur
        const regex = new RegExp(
          `${pattern}[^0-9]{0,200}(\\d{2,3})\\s*(?:kt|KT|kts|KTS|KIAS|knots|KCAS)?`,
          'i'
        
        const match = text.match(regex);
        if (match && match[1]) {
          const value = parseInt(match[1]);
          if (value > 20 && value < 500 && !data[speedKey]) {
            data[speedKey] = value;
            details[speedKey] = 'extracted'; // Marquer comme extrait du PDF

          }
        }
      }
    });

    // Distances
    const distancePatterns = {
      takeoffRoll: /(?:takeoff roll|ground roll|roulage décollage)\s*[:\s=]+\s*(\d+)\s*(?:m|ft|mètres|meters)/i,
      takeoffDistance: /(?:takeoff distance|distance décollage|take-off distance)\s*[:\s=]+\s*(\d+)\s*(?:m|ft|mètres|meters)/i,
      landingRoll: /(?:landing roll|roulage atterrissage)\s*[:\s=]+\s*(\d+)\s*(?:m|ft|mètres|meters)/i,
      landingDistance: /(?:landing distance|distance atterrissage)\s*[:\s=]+\s*(\d+)\s*(?:m|ft|mètres|meters)/i
    };

    Object.keys(distancePatterns).forEach(key => {
      const match = text.match(distancePatterns[key]);
      if (match && match[1]) {
        const value = parseInt(match[1]);
        if (value > 0 && value < 10000) { // Validation basique
          data[key] = value;
          details[key] = 'extracted';
                  }
      }
    });

    return { data, details };
  };

  const extractLimitations = (text) => {
    const limitations = {};
    const details = {};
    
    // Limites de vent
    const windPatterns = {
      maxCrosswind: /(?:vent traversier max|max crosswind|maximum crosswind)\s*[:\s=]+\s*(\d+)\s*(?:kt|KT|kts|knots)/i,
      maxTailwind: /(?:vent arrière max|max tailwind|maximum tailwind)\s*[:\s=]+\s*(\d+)\s*(?:kt|KT|kts|knots)/i
    };

    Object.keys(windPatterns).forEach(key => {
      const match = text.match(windPatterns[key]);
      if (match && match[1]) {
        const value = parseInt(match[1]);
        if (value > 0 && value < 100) {
          limitations[key] = value;
          details[key] = 'extracted';
                  }
      }
    });

    // Masses
    const weightPatterns = {
      mtow: /(?:MTOW|masse max décollage|max takeoff weight|maximum takeoff)\s*[:\s=]+\s*(\d+)\s*(?:kg|lbs|kilos)/i,
      mlw: /(?:MLW|masse max atterrissage|max landing weight|maximum landing)\s*[:\s=]+\s*(\d+)\s*(?:kg|lbs|kilos)/i,
      mzfw: /(?:MZFW|masse max sans carburant|max zero fuel|maximum zero fuel)\s*[:\s=]+\s*(\d+)\s*(?:kg|lbs|kilos)/i
    };

    Object.keys(weightPatterns).forEach(key => {
      const match = text.match(weightPatterns[key]);
      if (match && match[1]) {
        const value = parseInt(match[1]);
        if (value > 100 && value < 1000000) {
          limitations[key] = value;
          details[key] = 'extracted';
                  }
      }
    });

    return { data: limitations, details };
  };

  const extractProcedures = (text) => {
    const procedures = {
      normal: [],
      emergency: [],
      abnormal: []
    };

    // Recherche simplifiée de procédures
    const normalMatch = text.match(/(?:procédures normales|normal procedures|normal operations)([\s\S]{0,2000})/i);
    if (normalMatch) {
      const items = normalMatch[1].split('\n')
        .filter(line => line.trim().length > 10 && line.trim().length < 200)
        .slice(0, 10);
      procedures.normal = items;
    }

    const emergencyMatch = text.match(/(?:procédures d'urgence|emergency procedures|emergency)([\s\S]{0,2000})/i);
    if (emergencyMatch) {
      const items = emergencyMatch[1].split('\n')
        .filter(line => line.trim().length > 10 && line.trim().length < 200)
        .slice(0, 10);
      procedures.emergency = items;
    }

    return procedures;
  };

  const getDefaultPerformances = (category) => {
    const defaults = {
      light: { vso: 45, vs1: 50, vfe: 85, vno: 125, vne: 160, va: 95, vx: 60, vy: 75, vr: 55 },
      medium: { vso: 60, vs1: 70, vfe: 120, vno: 180, vne: 220, va: 130, vx: 85, vy: 95, vr: 75 },
      heavy: { vso: 110, vs1: 125, vfe: 180, vno: 250, vne: 320, va: 180, vx: 140, vy: 160, vr: 130 }
    };
    return defaults[category] || defaults.light;
  };

  const getDefaultLimitations = (category) => {
    const defaults = {
      light: { maxCrosswind: 15, maxTailwind: 5, mtow: 1200, mlw: 1150 },
      medium: { maxCrosswind: 25, maxTailwind: 10, mtow: 5700, mlw: 5400 },
      heavy: { maxCrosswind: 35, maxTailwind: 10, mtow: 79000, mlw: 66000 }
    };
    return defaults[category] || defaults.light;
  };

  return null; // Composant invisible
};

export default PdfExtractor;