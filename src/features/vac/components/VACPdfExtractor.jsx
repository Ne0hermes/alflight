// src/features/vac/components/VACPdfExtractor.jsx
import React, { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { showNotification } from '../../../shared/components/Notification';

// Configuration du worker PDF.js pour Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

/**
 * Composant pour extraire les données d'une carte VAC PDF
 * Extrait les fréquences, pistes, minima, et autres informations aéronautiques
 */
export const VACPdfExtractor = ({ file, onExtracted, onError }) => {
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    if (file && !extracting) {
      extractVACData(file);
    }
  }, [file]);

  const extractVACData = async (pdfFile) => {
    setExtracting(true);
    
    try {
      // Lire le fichier comme ArrayBuffer
      const arrayBuffer = await pdfFile.arrayBuffer();
      
      // Charger le PDF avec PDF.js
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      console.log(`VAC PDF chargé: ${pdf.numPages} pages`);
      
      // Créer l'objet de données extraites
      const extractedInfo = {
        fileName: pdfFile.name,
        fileSize: (pdfFile.size / 1024 / 1024).toFixed(2) + ' MB',
        pageCount: pdf.numPages,
        uploadDate: new Date().toISOString(),
        dataSource: 'Extraction automatique du PDF VAC',
        icao: extractICAOFromFileName(pdfFile.name),
        airportName: '',
        runways: [],
        frequencies: {},
        navaids: [],
        minima: {},
        procedures: {
          arrival: [],
          departure: [],
          approach: []
        },
        obstacles: [],
        remarks: [],
        coordinates: null,
        elevation: null,
        magneticVariation: null,
        transitionAltitude: null,
        circuitAltitude: null
      };

      // Extraire le texte de toutes les pages
      let fullText = '';
      const pageTexts = {};
      
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map(item => item.str)
            .join(' ');
          
          pageTexts[`page_${i}`] = pageText;
          fullText += pageText + '\n';
          
          // Mise à jour du progrès
          if (i % 2 === 0) {
            console.log(`Extraction VAC: ${i}/${pdf.numPages} pages`);
          }
        } catch (pageError) {
          console.warn(`Erreur page ${i}:`, pageError);
        }
      }

      // Analyser le contenu extrait pour les données VAC
      extractedInfo.icao = extractICAO(fullText) || extractedInfo.icao;
      extractedInfo.airportName = extractAirportName(fullText);
      extractedInfo.coordinates = extractCoordinates(fullText);
      extractedInfo.elevation = extractElevation(fullText);
      extractedInfo.runways = extractRunways(fullText);
      extractedInfo.frequencies = extractFrequencies(fullText);
      extractedInfo.navaids = extractNavaids(fullText);
      extractedInfo.minima = extractMinima(fullText);
      extractedInfo.procedures = extractProcedures(fullText);
      extractedInfo.obstacles = extractObstacles(fullText);
      extractedInfo.magneticVariation = extractMagneticVariation(fullText);
      extractedInfo.transitionAltitude = extractTransitionAltitude(fullText);
      extractedInfo.circuitAltitude = extractCircuitAltitude(fullText);
      extractedInfo.remarks = extractRemarks(fullText);
      
      // Stocker le fichier PDF en base64
      const reader = new FileReader();
      reader.onload = () => {
        extractedInfo.pdfData = reader.result;
        
        // Déterminer si des données ont été vraiment extraites
        const hasExtractedData = 
          extractedInfo.runways.length > 0 ||
          Object.keys(extractedInfo.frequencies).length > 0 ||
          extractedInfo.navaids.length > 0;
        
        if (hasExtractedData) {
          extractedInfo.dataSource = 'Données extraites du PDF VAC';
          showNotification(
            `✅ Carte VAC extraite avec succès (${extractedInfo.runways.length} piste(s), ${Object.keys(extractedInfo.frequencies).length} fréquence(s))`,
            'success',
            5000
          );
        } else {
          extractedInfo.dataSource = 'PDF VAC stocké - Extraction limitée';
          showNotification(
            '⚠️ Extraction partielle du PDF VAC. Certaines données devront être entrées manuellement.',
            'warning',
            6000
          );
        }
        
        onExtracted(extractedInfo);
      };
      
      reader.onerror = () => {
        throw new Error('Erreur lors de la conversion en base64');
      };
      
      reader.readAsDataURL(pdfFile);
      
    } catch (err) {
      console.error('Erreur extraction VAC PDF:', err);
      showNotification(
        `❌ Erreur lors de l'extraction VAC: ${err.message}`,
        'error',
        5000
      );
      
      if (onError) {
        onError(err.message);
      }
    } finally {
      setExtracting(false);
    }
  };

  // Fonctions d'extraction spécifiques aux cartes VAC

  const extractICAOFromFileName = (fileName) => {
    const match = fileName.match(/\b([A-Z]{4})\b/);
    return match ? match[1] : '';
  };

  const extractICAO = (text) => {
    // Patterns pour trouver le code ICAO
    const patterns = [
      /\b([A-Z]{4})\s*(?:\/|-)/, // LFPG / ou LFPG -
      /AD\s+([A-Z]{4})/,          // AD LFPG
      /^([A-Z]{4})\s/m,           // LFPG en début de ligne
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  const extractAirportName = (text) => {
    const patterns = [
      /(?:AÉRODROME|AERODROME|AIRPORT)\s+(?:DE\s+)?([A-ZÀ-Ÿ\s-]+?)(?:\n|RWY|RUNWAY|PISTE)/i,
      /([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s-]{3,30})\s*(?:\(|\/)\s*[A-Z]{4}/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return '';
  };

  const extractCoordinates = (text) => {
    // Pattern pour les coordonnées (format: 48°43'N 002°22'E)
    const pattern = /(\d{1,2})°(\d{1,2})'?(?:(\d{1,2})"?)?\s*([NS])\s+(\d{1,3})°(\d{1,2})'?(?:(\d{1,2})"?)?\s*([EW])/;
    const match = text.match(pattern);
    
    if (match) {
      const lat = parseInt(match[1]) + parseInt(match[2])/60 + (match[3] ? parseInt(match[3])/3600 : 0);
      const lon = parseInt(match[5]) + parseInt(match[6])/60 + (match[7] ? parseInt(match[7])/3600 : 0);
      
      return {
        latitude: match[4] === 'S' ? -lat : lat,
        longitude: match[8] === 'W' ? -lon : lon,
        formatted: `${match[1]}°${match[2]}'${match[3] || '00'}"${match[4]} ${match[5]}°${match[6]}'${match[7] || '00'}"${match[8]}`
      };
    }
    return null;
  };

  const extractElevation = (text) => {
    const patterns = [
      /(?:ÉLÉVATION|ELEVATION|ELEV|ALT)\s*:?\s*(\d{1,5})\s*(?:ft|FT|pieds)/i,
      /(\d{1,5})\s*ft\s*(?:AMSL|MSL)/i,
      /(?:AD|AIRPORT)\s+ELEV\s*:?\s*(\d{1,5})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1]);
      }
    }
    return null;
  };

  const extractRunways = (text) => {
    const runways = [];
    
    // Pattern pour les pistes (ex: 08L/26R, 09/27, etc.)
    const runwayPattern = /\b(\d{2}[LRC]?)\/(\d{2}[LRC]?)\b/g;
    const matches = text.matchAll(runwayPattern);
    
    for (const match of matches) {
      const runway = {
        designation: `${match[1]}/${match[2]}`,
        heading1: parseInt(match[1].substring(0, 2)) * 10,
        heading2: parseInt(match[2].substring(0, 2)) * 10,
        length: null,
        width: null,
        surface: null,
        lighting: null
      };

      // Chercher les dimensions à proximité
      const contextStart = Math.max(0, match.index - 200);
      const contextEnd = Math.min(text.length, match.index + 200);
      const context = text.substring(contextStart, contextEnd);
      
      // Longueur x Largeur
      const dimensionPattern = /(\d{3,4})\s*[xX×]\s*(\d{2,3})\s*(?:m|M)/;
      const dimMatch = context.match(dimensionPattern);
      if (dimMatch) {
        runway.length = parseInt(dimMatch[1]);
        runway.width = parseInt(dimMatch[2]);
      }

      // Surface
      const surfacePattern = /(?:REVÊTEMENT|SURFACE|REVETEMENT)\s*:?\s*([A-ZÀ-Ÿ]+)/i;
      const surfaceMatch = context.match(surfacePattern);
      if (surfaceMatch) {
        runway.surface = surfaceMatch[1];
      }

      // Éviter les doublons
      if (!runways.some(r => r.designation === runway.designation)) {
        runways.push(runway);
      }
    }
    
    return runways;
  };

  const extractFrequencies = (text) => {
    const frequencies = {};
    
    // Patterns pour les différents types de fréquences
    const freqPatterns = {
      TWR: /(?:TOUR|TWR|TOWER)\s*:?\s*(1\d{2}\.\d{1,3})/gi,
      GND: /(?:SOL|GND|GROUND)\s*:?\s*(1\d{2}\.\d{1,3})/gi,
      APP: /(?:APP|APPROCHE|APPROACH)\s*:?\s*(1\d{2}\.\d{1,3})/gi,
      DEP: /(?:DEP|DÉPART|DEPARTURE)\s*:?\s*(1\d{2}\.\d{1,3})/gi,
      ATIS: /(?:ATIS)\s*:?\s*(1\d{2}\.\d{1,3})/gi,
      INFO: /(?:INFO|INFORMATION)\s*:?\s*(1\d{2}\.\d{1,3})/gi,
      AFIS: /(?:AFIS|A\/A)\s*:?\s*(1\d{2}\.\d{1,3})/gi,
      DELIVERY: /(?:CLAIRANCE|DELIVERY|PRÉVOL)\s*:?\s*(1\d{2}\.\d{1,3})/gi
    };

    Object.keys(freqPatterns).forEach(service => {
      const matches = text.matchAll(freqPatterns[service]);
      for (const match of matches) {
        if (match[1]) {
          const freq = parseFloat(match[1]);
          if (freq >= 118.0 && freq <= 137.0) {
            if (!frequencies[service]) {
              frequencies[service] = [];
            }
            if (!frequencies[service].includes(freq)) {
              frequencies[service].push(freq);
            }
          }
        }
      }
    });

    return frequencies;
  };

  const extractNavaids = (text) => {
    const navaids = [];
    
    // VOR/DME
    const vorPattern = /\b([A-Z]{2,3})\s+(?:VOR|DME|VORDME|VOR\/DME)\s+(1\d{2}\.\d{1,2})/g;
    const vorMatches = text.matchAll(vorPattern);
    for (const match of vorMatches) {
      navaids.push({
        type: 'VOR/DME',
        identifier: match[1],
        frequency: match[2]
      });
    }

    // NDB
    const ndbPattern = /\b([A-Z]{2,3})\s+(?:NDB|ADF)\s+(\d{3,4})\s*(?:kHz|KHZ)?/gi;
    const ndbMatches = text.matchAll(ndbPattern);
    for (const match of ndbMatches) {
      navaids.push({
        type: 'NDB',
        identifier: match[1],
        frequency: match[2] + ' kHz'
      });
    }

    // ILS
    const ilsPattern = /ILS\s+(?:RWY\s*)?(\d{2}[LRC]?)\s+(1\d{2}\.\d{1,2})/gi;
    const ilsMatches = text.matchAll(ilsPattern);
    for (const match of ilsMatches) {
      navaids.push({
        type: 'ILS',
        runway: match[1],
        frequency: match[2]
      });
    }

    return navaids;
  };

  const extractMinima = (text) => {
    const minima = {};
    
    // Pattern pour les minima (MDH, DH, MDA, etc.)
    const minimaPatterns = {
      circling: /(?:CIRCLING|MVL)\s*:?\s*(\d{3,4})\s*(?:ft|FT)/gi,
      mdh: /MDH\s*:?\s*(\d{3,4})\s*(?:ft|FT)/gi,
      dh: /DH\s*:?\s*(\d{2,3})\s*(?:ft|FT)/gi,
      visibility: /(?:VIS|VISIBILITÉ)\s*:?\s*(\d{1,4})\s*(?:m|M)/gi
    };

    Object.keys(minimaPatterns).forEach(type => {
      const match = text.match(minimaPatterns[type]);
      if (match && match[1]) {
        minima[type] = parseInt(match[1]);
      }
    });

    return minima;
  };

  const extractProcedures = (text) => {
    const procedures = {
      arrival: [],
      departure: [],
      approach: []
    };

    // Procédures d'arrivée (STAR)
    const starPattern = /\b([A-Z]{3,6}\d[A-Z]?)\s+(?:STAR|ARRIVÉE)/gi;
    const starMatches = text.matchAll(starPattern);
    for (const match of starMatches) {
      procedures.arrival.push(match[1]);
    }

    // Procédures de départ (SID)
    const sidPattern = /\b([A-Z]{3,6}\d[A-Z]?)\s+(?:SID|DÉPART)/gi;
    const sidMatches = text.matchAll(sidPattern);
    for (const match of sidMatches) {
      procedures.departure.push(match[1]);
    }

    // Approches
    const approachPattern = /(?:ILS|VOR|NDB|RNAV|RNP|LOC)\s+(?:RWY\s*)?(\d{2}[LRC]?)/gi;
    const approachMatches = text.matchAll(approachPattern);
    for (const match of approachMatches) {
      const approach = `${match[0]}`;
      if (!procedures.approach.includes(approach)) {
        procedures.approach.push(approach);
      }
    }

    return procedures;
  };

  const extractObstacles = (text) => {
    const obstacles = [];
    
    // Pattern pour les obstacles (tours, antennes, etc.)
    const obstaclePattern = /(?:OBSTACLE|TOUR|ANTENNE|PYLÔNE|CHÂTEAU D'EAU)\s*:?\s*(\d{3,4})\s*(?:ft|FT|m|M)/gi;
    const matches = text.matchAll(obstaclePattern);
    
    for (const match of matches) {
      obstacles.push({
        type: match[0].split(/\s+/)[0],
        height: parseInt(match[1]),
        unit: match[0].includes('ft') || match[0].includes('FT') ? 'ft' : 'm'
      });
    }

    return obstacles;
  };

  const extractMagneticVariation = (text) => {
    const pattern = /(?:VAR|VARIATION|DÉCLINAISON)\s*:?\s*(\d{1,2})°?\s*([EW])/i;
    const match = text.match(pattern);
    
    if (match) {
      const value = parseInt(match[1]);
      return match[2] === 'W' ? -value : value;
    }
    return null;
  };

  const extractTransitionAltitude = (text) => {
    const pattern = /(?:TA|TRANSITION\s+ALTITUDE)\s*:?\s*(\d{4,5})\s*(?:ft|FT)?/i;
    const match = text.match(pattern);
    return match ? parseInt(match[1]) : null;
  };

  const extractCircuitAltitude = (text) => {
    const pattern = /(?:CIRCUIT|TOUR DE PISTE|TDP|PATTERN)\s*:?\s*(\d{3,4})\s*(?:ft|FT)/i;
    const match = text.match(pattern);
    return match ? parseInt(match[1]) : null;
  };

  const extractRemarks = (text) => {
    const remarks = [];
    
    // Chercher les sections de remarques
    const remarkPattern = /(?:REMARQUE|REMARK|NOTE|ATTENTION|CAUTION|WARNING)[\s:]+([^\n]{10,200})/gi;
    const matches = text.matchAll(remarkPattern);
    
    for (const match of matches) {
      const remark = match[1].trim();
      if (remark && !remarks.includes(remark)) {
        remarks.push(remark);
      }
    }

    return remarks;
  };

  return null; // Composant invisible
};

export default VACPdfExtractor;