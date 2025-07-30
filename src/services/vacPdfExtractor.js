// src/services/vacPdfExtractor.js
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.entry';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export class SIAVACExtractor {
  constructor() {
    this.patterns = {
      // Patterns spécifiques aux cartes SIA
      icao: /\b(LF[A-Z]{2})\b/,
      altitude: {
        // Format: ALT AD : 505 (19 hPa)
        header: /ALT\s*AD\s*:\s*(\d{3,4})\s*\((\d+)\s*hPa\)/,
        // Format dans le texte: Altitude de référence/Airport elevation
        text: /(?:Altitude de référence|Airport elevation).*?:\s*(\d{3,4})\s*ft/i
      },
      variation: /VAR\s*:\s*(\d+)°([EW])\s*\((\d{4})\)/,
      
      runway: {
        // Format tableau: RWY | QFU | Dimensions | Nature | Résistance
        table: /(?:RWY|Piste)\s+(\d{2}[LRC]?(?:\/\d{2}[LRC]?)?)\s+(\d{3})\s+(\d{3,4})\s*x\s*(\d{2,3})/g,
        // Format dans le texte
        text: /(?:RWY|Piste)\s*(\d{2}[LRC]?\/\d{2}[LRC]?)\s*.*?(\d{3,4})\s*×\s*(\d{2,3})\s*m/g
      },
      
      frequencies: {
        twr: /TWR\s*:\s*(1\d{2}\.\d{3})/,
        gnd: /(?:GND|SOL)\s*:\s*(1\d{2}\.\d{3})/,
        atis: /ATIS\s*:\s*(1\d{2}\.\d{3})/,
        app: /APP\s*:\s*STRASBOURG.*?(1\d{2}\.\d{3})/,
        fis: /FIS\s*:\s*STRASBOURG.*?(1\d{2}\.\d{3})/
      },
      
      circuit: {
        // Tour de piste / Circuit altitude
        altitude: /(?:Tour de piste|Circuit.*?altitude).*?(\d{3,4})\s*ft/i,
        // Pattern alternatif
        tpa: /(?:TPA|Altitude.*?circuit).*?(\d{3,4})/i
      },
      
      // Coordonnées
      coordinates: {
        lat: /LAT\s*:\s*(\d{2})\s*(\d{2})\s*(\d{2})\s*N/,
        lon: /LONG\s*:\s*(\d{3})\s*(\d{2})\s*(\d{2})\s*E/
      }
    };
  }

  async extractFromFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    return this.extractFromPDF(data);
  }

  async extractFromPDF(pdfData) {
    try {
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      
      // Extraire le texte de toutes les pages
      const pageTexts = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Analyser la structure du texte pour mieux reconstituer les tableaux
        const pageText = this.reconstructText(textContent);
        pageTexts.push({
          pageNumber: i,
          text: pageText,
          items: textContent.items
        });
      }
      
      // Analyser les données
      return this.parseVACData(pageTexts);
    } catch (error) {
      console.error('Erreur extraction PDF:', error);
      throw error;
    }
  }

  reconstructText(textContent) {
    // Grouper les éléments par ligne basé sur leur position Y
    const lines = [];
    let currentLine = [];
    let lastY = null;
    
    textContent.items.forEach(item => {
      const y = Math.round(item.transform[5]);
      
      if (lastY !== null && Math.abs(y - lastY) > 5) {
        // Nouvelle ligne
        lines.push(currentLine.join(' '));
        currentLine = [];
      }
      
      currentLine.push(item.str);
      lastY = y;
    });
    
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }
    
    return lines.join('\n');
  }

  parseVACData(pageTexts) {
    const data = {
      icao: null,
      airportElevation: null,
      runways: [],
      frequencies: {},
      circuitAltitude: null,
      magneticVariation: null,
      coordinates: null,
      extractionDate: new Date().toISOString(),
      source: 'SIA France'
    };

    // Parcourir toutes les pages
    pageTexts.forEach(({ pageNumber, text }) => {
      // Code OACI
      if (!data.icao) {
        const icaoMatch = text.match(this.patterns.icao);
        if (icaoMatch) {
          data.icao = icaoMatch[1];
        }
      }

      // Altitude (page 1 généralement)
      if (!data.airportElevation) {
        const altMatch = text.match(this.patterns.altitude.header);
        if (altMatch) {
          data.airportElevation = parseInt(altMatch[1]);
          data.qnh = parseInt(altMatch[2]);
        } else {
          // Fallback sur le pattern texte
          const altTextMatch = text.match(this.patterns.altitude.text);
          if (altTextMatch) {
            data.airportElevation = parseInt(altTextMatch[1]);
          }
        }
      }

      // Variation magnétique
      if (!data.magneticVariation) {
        const varMatch = text.match(this.patterns.variation);
        if (varMatch) {
          data.magneticVariation = {
            value: parseInt(varMatch[1]),
            direction: varMatch[2],
            year: parseInt(varMatch[3])
          };
        }
      }

      // Pistes (page 3 généralement)
      if (pageNumber === 3 || text.includes('Visual landing')) {
        this.extractRunways(text, data);
      }

      // Fréquences
      this.extractFrequencies(text, data);

      // Altitude de circuit
      if (!data.circuitAltitude) {
        const circuitMatch = text.match(this.patterns.circuit.altitude) || 
                           text.match(this.patterns.circuit.tpa);
        if (circuitMatch) {
          data.circuitAltitude = parseInt(circuitMatch[1]);
        }
      }

      // Coordonnées
      if (!data.coordinates) {
        this.extractCoordinates(text, data);
      }
    });

    // Post-traitement
    this.postProcess(data);

    return data;
  }

  extractRunways(text, data) {
    // Rechercher dans le format tableau
    const lines = text.split('\n');
    
    // Chercher la ligne qui contient RWY et les données
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Pattern pour LFST : "05 046 2400 x 45"
      const runwayMatch = line.match(/(\d{2})\s+(\d{3})\s+(\d{3,4})\s*x\s*(\d{2,3})/);
      if (runwayMatch) {
        const rwyNum = runwayMatch[1];
        const qfu = parseInt(runwayMatch[2]);
        const length = parseInt(runwayMatch[3]);
        const width = parseInt(runwayMatch[4]);
        
        // Chercher la surface dans les lignes suivantes
        let surface = 'Revêtue'; // Par défaut
        for (let j = i; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j].includes('Revêtue') || lines[j].includes('Paved')) {
            surface = 'Revêtue';
            break;
          } else if (lines[j].includes('Herbe') || lines[j].includes('Grass')) {
            surface = 'Herbe';
            break;
          }
        }

        // Chercher la piste opposée
        const oppositeNum = this.getOppositeRunway(rwyNum);
        
        data.runways.push({
          identifier: `${rwyNum}/${oppositeNum}`,
          numbers: [rwyNum, oppositeNum],
          qfu: qfu,
          length: length,
          width: width,
          surface: surface,
          bearing: qfu
        });
      }
    }
    
    // Dédupliquer les pistes
    const uniqueRunways = [];
    const seen = new Set();
    
    data.runways.forEach(rwy => {
      const key = [rwy.length, rwy.width].sort().join('-');
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRunways.push(rwy);
      }
    });
    
    data.runways = uniqueRunways;
  }

  extractFrequencies(text, data) {
    Object.entries(this.patterns.frequencies).forEach(([type, pattern]) => {
      if (!data.frequencies[type]) {
        const match = text.match(pattern);
        if (match) {
          data.frequencies[type] = match[1];
        }
      }
    });
  }

  extractCoordinates(text, data) {
    const latMatch = text.match(this.patterns.coordinates.lat);
    const lonMatch = text.match(this.patterns.coordinates.lon);
    
    if (latMatch && lonMatch) {
      data.coordinates = {
        lat: this.dmsToDecimal(
          parseInt(latMatch[1]),
          parseInt(latMatch[2]),
          parseInt(latMatch[3]),
          'N'
        ),
        lon: this.dmsToDecimal(
          parseInt(lonMatch[1]),
          parseInt(lonMatch[2]),
          parseInt(lonMatch[3]),
          'E'
        )
      };
    }
  }

  getOppositeRunway(runway) {
    const num = parseInt(runway);
    const opposite = num > 18 ? num - 18 : num + 18;
    return opposite.toString().padStart(2, '0');
  }

  dmsToDecimal(degrees, minutes, seconds, direction) {
    let decimal = degrees + minutes / 60 + seconds / 3600;
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }
    return parseFloat(decimal.toFixed(6));
  }

  postProcess(data) {
    // Calculer le QFU opposé pour chaque piste
    data.runways.forEach(runway => {
      if (runway.qfu && !runway.oppositeQfu) {
        runway.oppositeQfu = (runway.qfu + 180) % 360;
      }
    });

    // Si pas d'altitude de circuit, calculer par défaut
    if (!data.circuitAltitude && data.airportElevation) {
      data.circuitAltitude = data.airportElevation + 1000;
    }

    // Nettoyer les données
    if (data.magneticVariation) {
      data.magneticVariation.numeric = data.magneticVariation.value * 
        (data.magneticVariation.direction === 'W' ? -1 : 1);
    }
  }
}

// Fonction helper pour l'intégration
export const extractVACFromPDF = async (file) => {
  const extractor = new SIAVACExtractor();
  return await extractor.extractFromFile(file);
};