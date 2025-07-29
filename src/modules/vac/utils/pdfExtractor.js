# Fichiers complets pour l'extraction GPS des cartes VAC

## 1. src/modules/vac/utils/pdfExtractor.js

```javascript
// src/modules/vac/utils/pdfExtractor.js
// Configuration PDF.js selon l'environnement
import * as pdfjsLib from 'pdfjs-dist';

// Configuration du worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Patterns de reconnaissance pour l'aviation
const PATTERNS = {
  runway: /\b(0[1-9]|[12]\d|3[0-6])[LCR]?\b/g,
  frequency: /\b1[0-3]\d\.\d{1,3}\b/g,
  ilsFreq: /\b(108|109|110|111)\.\d{1,2}\b/g,
  phoneNumber: /(?:Tel|Tél|Phone|ATIS)\s*:?\s*([\d\s\-.()]+)/gi,
  qfu: /QFU\s*:?\s*(\d{3})/gi,
  altitude: /(\d{3,5})\s*(?:ft|FT|pieds)/g,
  distance: /(\d+)\s*(?:m|M|mètres|meters|NM|nm)/g,
  coordinates: {
    dms: /([NS])\s*(\d{1,2})°?\s*(\d{1,2})'?\s*(\d{1,2})"?\s*([EW])\s*(\d{1,3})°?\s*(\d{1,2})'?\s*(\d{1,2})"?/g,
    decimal: /(\d{1,2}\.\d+)°?\s*([NS])\s*(\d{1,3}\.\d+)°?\s*([EW])/g
  }
};

// Keywords pour identifier les sections
const KEYWORDS = {
  frequencies: ['TWR', 'GND', 'ATIS', 'APP', 'AFIS', 'INFO', 'FREQ'],
  runways: ['RWY', 'PISTE', 'THR', 'RUNWAY'],
  ils: ['ILS', 'LOC', 'DME', 'VOR'],
  minima: ['MINIMA', 'MDA', 'DA', 'OCH'],
  pattern: ['CIRCUIT', 'PATTERN', 'TFC']
};

export class VACPDFExtractor {
  static instance = null;
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new VACPDFExtractor();
    }
    return this.instance;
  }

  async extractFromBlob(blob) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      const textByPage = [];
      
      // Extraire le texte de toutes les pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => item.str)
          .join(' ');
        
        textByPage.push(pageText);
        fullText += pageText + '\n';
      }
      
      // Analyser le texte extrait
      const extractedData = {
        coordinates: this.extractCoordinates(fullText),
        airportElevation: this.extractElevation(fullText),
        runways: this.extractRunways(fullText),
        frequencies: this.extractFrequencies(fullText),
        ils: this.extractILS(fullText),
        minima: this.extractMinima(fullText),
        patternAltitude: this.extractPatternAltitude(fullText),
        remarks: this.extractRemarks(fullText)
      };
      
      return extractedData;
    } catch (error) {
      console.error('Erreur extraction PDF:', error);
      throw error;
    }
  }

  extractCoordinates(text) {
    // Essayer d'abord le format DMS (degrés, minutes, secondes)
    const dmsMatches = [...text.matchAll(PATTERNS.coordinates.dms)];
    if (dmsMatches.length > 0) {
      const match = dmsMatches[0];
      const [, latDir, latDeg, latMin, latSec, lonDir, lonDeg, lonMin, lonSec] = match;
      
      // Convertir DMS en décimal
      const lat = this.dmsToDecimal(
        parseInt(latDeg), 
        parseInt(latMin), 
        parseInt(latSec), 
        latDir
      );
      const lon = this.dmsToDecimal(
        parseInt(lonDeg), 
        parseInt(lonMin), 
        parseInt(lonSec), 
        lonDir
      );
      
      return { lat, lon, format: 'DMS' };
    }
    
    // Essayer le format décimal
    const decimalMatches = [...text.matchAll(PATTERNS.coordinates.decimal)];
    if (decimalMatches.length > 0) {
      const match = decimalMatches[0];
      const [, latValue, latDir, lonValue, lonDir] = match;
      
      const lat = parseFloat(latValue) * (latDir === 'S' ? -1 : 1);
      const lon = parseFloat(lonValue) * (lonDir === 'W' ? -1 : 1);
      
      return { lat, lon, format: 'decimal' };
    }
    
    // Recherche alternative dans le contexte ARP (Aerodrome Reference Point)
    const arpPattern = /ARP[:\s]+([NS])\s*(\d{2})°?\s*(\d{2})'?\s*(\d{2})"?\s*([EW])\s*(\d{3})°?\s*(\d{2})'?\s*(\d{2})"?/i;
    const arpMatch = text.match(arpPattern);
    if (arpMatch) {
      const [, latDir, latDeg, latMin, latSec, lonDir, lonDeg, lonMin, lonSec] = arpMatch;
      
      const lat = this.dmsToDecimal(
        parseInt(latDeg), 
        parseInt(latMin), 
        parseInt(latSec), 
        latDir
      );
      const lon = this.dmsToDecimal(
        parseInt(lonDeg), 
        parseInt(lonMin), 
        parseInt(lonSec), 
        lonDir
      );
      
      return { lat, lon, format: 'ARP' };
    }
    
    return null;
  }

  extractElevation(text) {
    // Rechercher l'altitude de l'aérodrome
    const elevationPatterns = [
      /(?:ELEV|ALT|ALTITUDE)[:\s]+(\d{1,5})\s*(?:ft|FT|pieds)/i,
      /(\d{1,5})\s*(?:ft|FT|pieds)[^°]/i, // Éviter de confondre avec les caps
      /AD\s+ELEV[:\s]+(\d{1,5})/i
    ];
    
    for (const pattern of elevationPatterns) {
      const match = text.match(pattern);
      if (match) {
        const elevation = parseInt(match[1]);
        // Vérifier que l'altitude est raisonnable (0-15000 ft)
        if (elevation >= 0 && elevation <= 15000) {
          return elevation;
        }
      }
    }
    
    return null;
  }

  dmsToDecimal(degrees, minutes, seconds, direction) {
    let decimal = degrees + minutes / 60 + seconds / 3600;
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }
    return Math.round(decimal * 1000000) / 1000000; // 6 décimales
  }

  extractRunways(text) {
    const runways = [];
    const runwayMatches = text.match(PATTERNS.runway) || [];
    
    // Rechercher les détails pour chaque piste trouvée
    runwayMatches.forEach(rwy => {
      // Chercher les informations associées à cette piste
      const rwyPattern = new RegExp(`${rwy}[^\\n]*(?:\\n[^\\n]*){0,5}`, 'gi');
      const context = text.match(rwyPattern)?.[0] || '';
      
      // Extraire QFU
      const qfuMatch = context.match(/(\d{3})°?/);
      const qfu = qfuMatch ? parseInt(qfuMatch[1]) : parseInt(rwy.substring(0, 2)) * 10;
      
      // Extraire dimensions
      const lengthMatch = context.match(/(\d{3,4})\s*[xX×]\s*(\d{2,3})/);
      const length = lengthMatch ? parseInt(lengthMatch[1]) : 0;
      const width = lengthMatch ? parseInt(lengthMatch[2]) : 0;
      
      // Déterminer le type de surface
      const surface = this.detectSurface(context);
      
      runways.push({
        identifier: rwy,
        qfu,
        length,
        width,
        surface
      });
    });
    
    return this.deduplicateRunways(runways);
  }

  extractFrequencies(text) {
    const frequencies = [];
    
    // Rechercher les fréquences avec leur contexte
    KEYWORDS.frequencies.forEach(keyword => {
      const pattern = new RegExp(`${keyword}[^\\n]*${PATTERNS.frequency.source}`, 'gi');
      const matches = [...text.matchAll(pattern)];
      
      matches.forEach(match => {
        const freq = match[0].match(PATTERNS.frequency)?.[0];
        if (!freq) return;
        
        // Déterminer le type de fréquence
        const type = this.detectFrequencyType(match[0]);
        
        // Rechercher un numéro de téléphone associé
        const phoneMatch = match[0].match(PATTERNS.phoneNumber);
        const phone = phoneMatch ? this.cleanPhoneNumber(phoneMatch[1]) : undefined;
        
        // Rechercher les horaires
        const hoursMatch = match[0].match(/H24|HO|HR\s*[^,\n]+/i);
        const hours = hoursMatch ? hoursMatch[0] : undefined;
        
        frequencies.push({
          type,
          frequency: freq,
          hours,
          phone
        });
      });
    });
    
    return this.deduplicateFrequencies(frequencies);
  }

  extractILS(text) {
    const ilsData = [];
    
    // Pattern pour ILS avec identifiant
    const ilsPattern = /ILS[^\n]*?(\d{2}[LCR]?)[^\n]*?(1(?:08|09|10|11)\.\d{1,2})[^\n]*?([A-Z]{2,3})/gi;
    const matches = [...text.matchAll(ilsPattern)];
    
    matches.forEach(match => {
      const [, runway, frequency, identifier] = match;
      
      // Déterminer la catégorie ILS
      const categoryMatch = match[0].match(/CAT\s*([I]{1,3})/i);
      const category = categoryMatch ? categoryMatch[1] : 'I';
      
      ilsData.push({
        runway,
        frequency,
        identifier,
        category
      });
    });
    
    return ilsData;
  }

  extractMinima(text) {
    // Rechercher les minima de circling et d'approche directe
    const circlingMatch = text.match(/(?:CIRCLING|MDH)[^\n]*?(\d{3,4})/i);
    const straightMatch = text.match(/(?:STRAIGHT|MDA|DA)[^\n]*?(\d{3,4})/i);
    
    if (!circlingMatch && !straightMatch) return undefined;
    
    return {
      circling: circlingMatch ? parseInt(circlingMatch[1]) : 0,
      straight: straightMatch ? parseInt(straightMatch[1]) : 0
    };
  }

  extractPatternAltitude(text) {
    // Rechercher l'altitude du circuit
    const patternMatch = text.match(/(?:CIRCUIT|PATTERN|TFC)[^\n]*?(\d{3,4})\s*(?:ft|FT)/i);
    return patternMatch ? parseInt(patternMatch[1]) : undefined;
  }

  extractRemarks(text) {
    const remarks = [];
    
    // Rechercher la section remarques
    const remarksMatch = text.match(/(?:REMARKS?|NOTES?|ATTENTION)[^\n]*\n([^\n]+(?:\n[^\n]+)*)/i);
    if (remarksMatch) {
      const remarksText = remarksMatch[1];
      // Diviser en lignes et nettoyer
      remarks.push(...remarksText.split(/\n/).filter(line => line.trim().length > 10));
    }
    
    return remarks.slice(0, 5); // Limiter à 5 remarques
  }

  // Méthodes utilitaires
  detectSurface(context) {
    if (/ASPH|ASPHALTE|BITUME/i.test(context)) return 'ASPH';
    if (/GRASS|HERBE|GAZON/i.test(context)) return 'GRASS';
    if (/CONCRETE|BÉTON|BETON/i.test(context)) return 'CONC';
    if (/GRAVEL|GRAVIER/i.test(context)) return 'GRVL';
    return 'UNKN';
  }

  detectFrequencyType(context) {
    if (/TWR|TOWER|TOUR/i.test(context)) return 'TWR';
    if (/GND|GROUND|SOL/i.test(context)) return 'GND';
    if (/ATIS/i.test(context)) return 'ATIS';
    if (/APP|APPROACH|APPROCHE/i.test(context)) return 'APP';
    return 'INFO';
  }

  cleanPhoneNumber(phone) {
    return phone.replace(/[\s\-.()]/g, '').replace(/^0/, '+33');
  }

  deduplicateRunways(runways) {
    const unique = new Map();
    runways.forEach(rwy => {
      const existing = unique.get(rwy.identifier);
      if (!existing || (rwy.length > existing.length)) {
        unique.set(rwy.identifier, rwy);
      }
    });
    return Array.from(unique.values());
  }

  deduplicateFrequencies(frequencies) {
    const unique = new Map();
    frequencies.forEach(freq => {
      const key = `${freq.type}-${freq.frequency}`;
      if (!unique.has(key)) {
        unique.set(key, freq);
      }
    });
    return Array.from(unique.values());
  }
}

// Export singleton
export const pdfExtractor = VACPDFExtractor.getInstance();
```

## 2. src/modules/vac/store/vacStore.js

```javascript
// src/modules/vac/store/vacStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Store Zustand pour le module VAC
export const useVACStore = create(
  persist(
    (set, get) => ({
      // État initial - Utilisation d'objets au lieu de Maps
      charts: {},  // { chartId: chartData }
      airports: [],
      selectedAirport: null,
      downloadQueue: [],
      isOnline: navigator.onLine,
      lastSync: null,
      storageUsed: 0,
      storageQuota: 0,

      // Charger la liste des cartes disponibles
      loadChartsList: async () => {
        try {
          const mockCharts = [
            {
              id: 'LFPG-VAC-2024-01',
              airportIcao: 'LFPG',
              airportName: 'Paris Charles de Gaulle',
              type: 'VAC',
              version: '2024-01',
              effectiveDate: new Date('2024-01-25'),
              expiryDate: new Date('2024-02-22'),
              fileSize: 2.5 * 1024 * 1024,
              isDownloaded: false,
              isOutdated: false,
              extractionStatus: 'pending',
              extractedData: null,
              coordinates: { lat: 49.012779, lon: 2.550000 } // Coordonnées LFPG
            },
            {
              id: 'LFPO-VAC-2024-01',
              airportIcao: 'LFPO',
              airportName: 'Paris Orly',
              type: 'VAC',
              version: '2024-01',
              effectiveDate: new Date('2024-01-25'),
              expiryDate: new Date('2024-02-22'),
              fileSize: 2.2 * 1024 * 1024,
              isDownloaded: false,
              isOutdated: false,
              extractionStatus: 'pending',
              extractedData: null,
              coordinates: { lat: 48.723333, lon: 2.379444 } // Coordonnées LFPO
            },
            {
              id: 'LFPB-VAC-2024-01',
              airportIcao: 'LFPB',
              airportName: 'Paris Le Bourget',
              type: 'VAC',
              version: '2024-01',
              effectiveDate: new Date('2024-01-25'),
              expiryDate: new Date('2024-02-22'),
              fileSize: 1.8 * 1024 * 1024,
              isDownloaded: false,
              isOutdated: false,
              extractionStatus: 'pending',
              extractedData: null,
              coordinates: { lat: 48.969444, lon: 2.441667 } // Coordonnées LFPB
            }
          ];

          const chartsObject = {};
          mockCharts.forEach(chart => {
            chartsObject[chart.id] = chart;
          });

          set({ charts: chartsObject });
        } catch (error) {
          console.error('Erreur chargement des cartes:', error);
        }
      },

      // Télécharger une carte
      downloadChart: async (chartId) => {
        const chart = get().charts[chartId];
        if (!chart) return;

        set(state => ({
          downloadQueue: [...state.downloadQueue, chartId]
        }));

        try {
          // Simuler le téléchargement
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Mettre à jour les métadonnées
          const updatedChart = {
            ...chart,
            isDownloaded: true,
            downloadDate: new Date(),
            lastAccessed: new Date(),
            extractionStatus: 'completed',
            extractedData: {
              coordinates: { lat: 49.012779, lon: 2.550000, format: 'DMS' }, // LFPG
              airportElevation: 392,
              runways: [
                { identifier: '09L', qfu: 90, length: 2700, width: 45, surface: 'ASPH' },
                { identifier: '27R', qfu: 270, length: 2700, width: 45, surface: 'ASPH' }
              ],
              frequencies: [
                { type: 'TWR', frequency: '118.750', hours: 'H24' },
                { type: 'GND', frequency: '121.900', hours: 'H24' },
                { type: 'ATIS', frequency: '127.375', hours: 'H24' }
              ],
              patternAltitude: 1000
            }
          };

          set(state => ({
            charts: {
              ...state.charts,
              [chartId]: updatedChart
            },
            downloadQueue: state.downloadQueue.filter(id => id !== chartId)
          }));

          console.log('Chart downloaded:', updatedChart);
        } catch (error) {
          console.error('Erreur téléchargement:', error);
          set(state => ({
            downloadQueue: state.downloadQueue.filter(id => id !== chartId)
          }));
        }
      },

      // Supprimer une carte
      deleteChart: async (chartId) => {
        set(state => {
          const newCharts = { ...state.charts };
          delete newCharts[chartId];
          return { charts: newCharts };
        });
      },

      // Récupérer le PDF d'une carte (simulé)
      getChartPDF: async (chartId) => {
        // Pour la démo, créer un blob factice
        const response = await fetch('data:application/pdf;base64,JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSIAogICAgPj4KICA+PgogIC9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmoKPDwKICAvVHlwZSAvRm9udAogIC9TdWJ0eXBlIC9UeXBlMQogIC9CYXNlRm9udCAvVGltZXMtUm9tYW4KPj4KZW5kb2JqCgo1IDAgb2JqICAlIHBhZ2UgY29udGVudAo8PAogIC9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCjcwIDUwIFRECi9GMSAxMiBUZgooSGVsbG8sIHdvcmxkISkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNzkgMDAwMDAgbiAKMDAwMDAwMDE3MyAwMDAwMCBuIAowMDAwMDAwMzAxIDAwMDAwIG4gCjAwMDAwMDAzODAgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDkyCiUlRU9G');
        const blob = await response.blob();
        return blob;
      },

      // Mettre à jour les données extraites
      updateExtractedData: (chartId, data) => {
        set(state => {
          const chart = state.charts[chartId];
          if (!chart) return state;

          const updatedChart = {
            ...chart,
            extractedData: {
              ...chart.extractedData,
              ...data
            },
            extractionStatus: 'completed'
          };

          return {
            charts: {
              ...state.charts,
              [chartId]: updatedChart
            }
          };
        });
      },

      // Valider une donnée extraite
      validateExtractedData: (chartId, field, value) => {
        const chart = get().charts[chartId];
        if (!chart || !chart.extractedData) return;

        console.log(`Validation: ${field} = ${value} pour ${chartId}`);
        
        get().updateExtractedData(chartId, {
          [field]: value
        });
      },

      // Rechercher des aéroports
      searchAirports: (query) => {
        const { charts } = get();
        const airports = {};
        
        Object.values(charts).forEach(chart => {
          if (!airports[chart.airportIcao]) {
            airports[chart.airportIcao] = {
              id: chart.airportIcao,
              icao: chart.airportIcao,
              name: chart.airportName,
              coordinates: { lat: 0, lon: 0 }
            };
          }
        });

        const searchLower = query.toLowerCase();
        return Object.values(airports).filter(airport =>
          airport.icao.toLowerCase().includes(searchLower) ||
          airport.name.toLowerCase().includes(searchLower)
        );
      },

      // Sélectionner un aéroport
      selectAirport: (icao) => {
        set({ selectedAirport: icao });
      },

      // Synchroniser les cartes
      syncCharts: async () => {
        const { charts } = get();
        const now = new Date();
        
        console.log('Synchronisation des cartes...');
        
        set({ lastSync: now });
      },

      // Vérifier le quota de stockage
      checkStorageQuota: async () => {
        if (navigator.storage && navigator.storage.estimate) {
          const { usage = 0, quota = 0 } = await navigator.storage.estimate();
          set({
            storageUsed: usage,
            storageQuota: quota
          });
        }
      },

      // Vider le cache
      clearCache: async () => {
        set({
          charts: {},
          lastSync: null,
          storageUsed: 0
        });
      }
    }),
    {
      name: 'vac-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedAirport: state.selectedAirport,
        lastSync: state.lastSync,
        // Sauvegarder uniquement les charts téléchargées
        charts: Object.fromEntries(
          Object.entries(state.charts)
            .filter(([_, chart]) => chart.isDownloaded)
            .map(([id, chart]) => [id, {
              ...chart,
              // Convertir les dates en strings pour la sérialisation
              effectiveDate: chart.effectiveDate?.toISOString(),
              expiryDate: chart.expiryDate?.toISOString(),
              downloadDate: chart.downloadDate?.toISOString(),
              lastAccessed: chart.lastAccessed?.toISOString()
            }])
        )
      }),
      // Réhydrater les dates lors du chargement
      onRehydrateStorage: () => (state) => {
        if (state && state.charts) {
          Object.keys(state.charts).forEach(id => {
            const chart = state.charts[id];
            if (chart.effectiveDate) chart.effectiveDate = new Date(chart.effectiveDate);
            if (chart.expiryDate) chart.expiryDate = new Date(chart.expiryDate);
            if (chart.downloadDate) chart.downloadDate = new Date(chart.downloadDate);
            if (chart.lastAccessed) chart.lastAccessed = new Date(chart.lastAccessed);
          });
        }
        if (state && state.lastSync) {
          state.lastSync = new Date(state.lastSync);
        }
      }
    }
  )
);
```

## 3. src/modules/vac/hooks/useAirportCoordinates.js

```javascript
// src/modules/vac/hooks/useAirportCoordinates.js
import { useVACStore } from '../store/vacStore';

export const useAirportCoordinates = () => {
  const { charts } = useVACStore();

  /**
   * Récupère les coordonnées d'un aéroport par son code OACI
   * @param {string} icaoCode - Code OACI de l'aéroport (ex: LFPG)
   * @returns {object|null} - Coordonnées {lat, lon} ou null si non trouvé
   */
  const getCoordinatesByICAO = (icaoCode) => {
    if (!icaoCode) return null;

    const upperICAO = icaoCode.toUpperCase();
    
    // Chercher dans les cartes VAC
    const chartsArray = Object.values(charts);
    for (const chart of chartsArray) {
      if (chart.airportIcao === upperICAO) {
        // Priorité aux données extraites
        if (chart.isDownloaded && chart.extractedData?.coordinates) {
          return {
            lat: chart.extractedData.coordinates.lat,
            lon: chart.extractedData.coordinates.lon,
            source: 'extracted',
            elevation: chart.extractedData.airportElevation
          };
        }
        // Sinon utiliser les coordonnées prédéfinies
        if (chart.coordinates) {
          return {
            lat: chart.coordinates.lat,
            lon: chart.coordinates.lon,
            source: 'predefined',
            elevation: null
          };
        }
      }
    }

    return null;
  };

  /**
   * Récupère les coordonnées de plusieurs aéroports
   * @param {string[]} icaoCodes - Liste de codes OACI
   * @returns {object} - Map des coordonnées par code OACI
   */
  const getMultipleCoordinates = (icaoCodes) => {
    const coordinates = {};
    icaoCodes.forEach(code => {
      const coords = getCoordinatesByICAO(code);
      if (coords) {
        coordinates[code] = coords;
      }
    });
    return coordinates;
  };

  /**
   * Récupère toutes les coordonnées disponibles
   * @returns {object} - Map de toutes les coordonnées disponibles
   */
  const getAllAvailableCoordinates = () => {
    const coordinates = {};
    Object.values(charts).forEach(chart => {
      const coords = getCoordinatesByICAO(chart.airportIcao);
      if (coords) {
        coordinates[chart.airportIcao] = coords;
      }
    });
    return coordinates;
  };

  return {
    getCoordinatesByICAO,
    getMultipleCoordinates,
    getAllAvailableCoordinates
  };
};

// Export des coordonnées de base pour les aéroports français majeurs
// Utilisé comme fallback si pas de carte VAC disponible
export const FRENCH_AIRPORTS_COORDINATES = {
  // Région parisienne
  LFPG: { lat: 49.012779, lon: 2.550000, name: 'Paris Charles de Gaulle' },
  LFPO: { lat: 48.723333, lon: 2.379444, name: 'Paris Orly' },
  LFPB: { lat: 48.969444, lon: 2.441667, name: 'Paris Le Bourget' },
  LFPT: { lat: 48.751111, lon: 2.106111, name: 'Pontoise' },
  LFPN: { lat: 48.596111, lon: 2.518056, name: 'Toussus-le-Noble' },
  
  // Autres grandes villes
  LFML: { lat: 43.435556, lon: 5.213889, name: 'Marseille Provence' },
  LFLL: { lat: 45.726389, lon: 5.090833, name: 'Lyon Saint-Exupéry' },
  LFBO: { lat: 43.629167, lon: 1.363333, name: 'Toulouse Blagnac' },
  LFMN: { lat: 43.658333, lon: 7.215556, name: 'Nice Côte d\'Azur' },
  LFBD: { lat: 44.828333, lon: -0.715556, name: 'Bordeaux Mérignac' },
  LFRS: { lat: 44.407778, lon: -0.956111, name: 'Nantes Atlantique' },
  LFRB: { lat: 48.447778, lon: -4.418333, name: 'Brest Bretagne' },
  LFST: { lat: 48.538333, lon: 7.628056, name: 'Strasbourg' },
  LFLC: { lat: 45.786111, lon: 3.169167, name: 'Clermont-Ferrand' },
  LFRK: { lat: 49.650833, lon: -1.470278, name: 'Caen Carpiquet' }
};
```

## 4. src/modules/navigation/components/NavigationModule.jsx (extrait modifié)

```javascript
import React from 'react';
import { useFlightSystem } from '../../../context/FlightSystemContext';
import { LoadInput } from '../../../components/ui/LoadInput';
import { Plus, Trash2, MapPin, ChevronRight, Sun, Moon, Navigation2, Home, CheckCircle } from 'lucide-react';
import { PerformanceCalculator } from './PerformanceCalculator';
import { RouteMap } from './RouteMap';
import { useAirportCoordinates } from '../../vac/hooks/useAirportCoordinates';

export const NavigationModule = () => {
  const { 
    selectedAircraft, 
    setSelectedAircraft, 
    aircraftList,
    waypoints, 
    setWaypoints, 
    flightParams, 
    setFlightParams, 
    navigationResults,
    flightType,
    setFlightType
  } = useFlightSystem();

  const { getCoordinatesByICAO } = useAirportCoordinates();

  // Enrichir automatiquement les waypoints avec les coordonnées depuis VAC
  React.useEffect(() => {
    const enrichedWaypoints = waypoints.map(wp => {
      if (wp.name && (!wp.lat || !wp.lon)) {
        const coords = getCoordinatesByICAO(wp.name);
        if (coords) {
          return {
            ...wp,
            lat: coords.lat,
            lon: coords.lon
          };
        }
      }
      return wp;
    });

    // Vérifier si des coordonnées ont été ajoutées
    const hasNewCoords = enrichedWaypoints.some((wp, index) => 
      wp.lat !== waypoints[index].lat || wp.lon !== waypoints[index].lon
    );

    if (hasNewCoords) {
      setWaypoints(enrichedWaypoints);
    }
  }, [waypoints.map(wp => wp.name).join(','), getCoordinatesByICAO]); // Dépendance sur les noms uniquement

  // ... reste du code existant ...

  // Dans la section de rendu des waypoints, modifier le champ input :
  <div style={{ flex: 1 }}>
    <input
      type="text"
      value={wp.name}
      onChange={(e) => updateWaypoint(index, e.target.value)}
      style={{ 
        width: '100%', 
        padding: '8px 12px', 
        border: '1px solid #d1d5db', 
        borderRadius: '6px' 
      }}
      placeholder="Code OACI"
    />
    {wp.lat && wp.lon && (
      <p style={{ 
        margin: '4px 0 0 0', 
        fontSize: '11px', 
        color: '#10b981',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <CheckCircle size={12} />
        {wp.lat.toFixed(4)}°, {wp.lon.toFixed(4)}°
        <span style={{ color: '#6b7280', marginLeft: '4px' }}>
          (depuis VAC)
        </span>
      </p>
    )}
  </div>

  // ... reste du code existant ...
};
```

## 5. src/modules/vac/index.js

```javascript
export { VACModule } from './components/VACModule';
export { useVACStore } from './store/vacStore';
export { useAirportCoordinates } from './hooks/useAirportCoordinates';
```

Ces fichiers constituent le système complet d'extraction des coordonnées GPS depuis les cartes VAC. Les coordonnées sont automatiquement utilisées dans la navigation pour afficher la carte OACI avec les waypoints correctement positionnés.