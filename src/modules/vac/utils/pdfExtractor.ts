// src/modules/vac/utils/pdfExtractor.ts
import * as pdfjsLib from 'pdfjs-dist';
import { ChartData, RunwayData, FrequencyData, ILSData } from '../types';

// Configuration PDF.js
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
  private static instance: VACPDFExtractor;
  
  static getInstance(): VACPDFExtractor {
    if (!this.instance) {
      this.instance = new VACPDFExtractor();
    }
    return this.instance;
  }

  async extractFromBlob(blob: Blob): Promise<Partial<ChartData['extractedData']>> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      const textByPage: string[] = [];
      
      // Extraire le texte de toutes les pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        textByPage.push(pageText);
        fullText += pageText + '\n';
      }
      
      // Analyser le texte extrait
      const extractedData: Partial<ChartData['extractedData']> = {
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

  private extractRunways(text: string): RunwayData[] {
    const runways: RunwayData[] = [];
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

  private extractFrequencies(text: string): FrequencyData[] {
    const frequencies: FrequencyData[] = [];
    
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
          type: type as any,
          frequency: freq,
          hours,
          phone
        });
      });
    });
    
    return this.deduplicateFrequencies(frequencies);
  }

  private extractILS(text: string): ILSData[] {
    const ilsData: ILSData[] = [];
    
    // Pattern pour ILS avec identifiant
    const ilsPattern = /ILS[^\\n]*?(\d{2}[LCR]?)[^\\n]*?(1(?:08|09|10|11)\.\d{1,2})[^\\n]*?([A-Z]{2,3})/gi;
    const matches = [...text.matchAll(ilsPattern)];
    
    matches.forEach(match => {
      const [, runway, frequency, identifier] = match;
      
      // Déterminer la catégorie ILS
      const categoryMatch = match[0].match(/CAT\s*([I]{1,3})/i);
      const category = categoryMatch ? categoryMatch[1] as any : 'I';
      
      ilsData.push({
        runway,
        frequency,
        identifier,
        category
      });
    });
    
    return ilsData;
  }

  private extractMinima(text: string): { circling: number; straight: number } | undefined {
    // Rechercher les minima de circling et d'approche directe
    const circlingMatch = text.match(/(?:CIRCLING|MDH)[^\\n]*?(\d{3,4})/i);
    const straightMatch = text.match(/(?:STRAIGHT|MDA|DA)[^\\n]*?(\d{3,4})/i);
    
    if (!circlingMatch && !straightMatch) return undefined;
    
    return {
      circling: circlingMatch ? parseInt(circlingMatch[1]) : 0,
      straight: straightMatch ? parseInt(straightMatch[1]) : 0
    };
  }

  private extractPatternAltitude(text: string): number | undefined {
    // Rechercher l'altitude du circuit
    const patternMatch = text.match(/(?:CIRCUIT|PATTERN|TFC)[^\\n]*?(\d{3,4})\s*(?:ft|FT)/i);
    return patternMatch ? parseInt(patternMatch[1]) : undefined;
  }

  private extractRemarks(text: string): string[] {
    const remarks: string[] = [];
    
    // Rechercher la section remarques
    const remarksMatch = text.match(/(?:REMARKS?|NOTES?|ATTENTION)[^\\n]*\\n([^\\n]+(?:\\n[^\\n]+)*)/i);
    if (remarksMatch) {
      const remarksText = remarksMatch[1];
      // Diviser en lignes et nettoyer
      remarks.push(...remarksText.split(/\\n/).filter(line => line.trim().length > 10));
    }
    
    return remarks.slice(0, 5); // Limiter à 5 remarques
  }

  // Méthodes utilitaires
  private detectSurface(context: string): string {
    if (/ASPH|ASPHALTE|BITUME/i.test(context)) return 'ASPH';
    if (/GRASS|HERBE|GAZON/i.test(context)) return 'GRASS';
    if (/CONCRETE|BÉTON|BETON/i.test(context)) return 'CONC';
    if (/GRAVEL|GRAVIER/i.test(context)) return 'GRVL';
    return 'UNKN';
  }

  private detectFrequencyType(context: string): string {
    if (/TWR|TOWER|TOUR/i.test(context)) return 'TWR';
    if (/GND|GROUND|SOL/i.test(context)) return 'GND';
    if (/ATIS/i.test(context)) return 'ATIS';
    if (/APP|APPROACH|APPROCHE/i.test(context)) return 'APP';
    return 'INFO';
  }

  private cleanPhoneNumber(phone: string): string {
    return phone.replace(/[\s\-.()]/g, '').replace(/^0/, '+33');
  }

  private deduplicateRunways(runways: RunwayData[]): RunwayData[] {
    const unique = new Map<string, RunwayData>();
    runways.forEach(rwy => {
      const existing = unique.get(rwy.identifier);
      if (!existing || (rwy.length > existing.length)) {
        unique.set(rwy.identifier, rwy);
      }
    });
    return Array.from(unique.values());
  }

  private deduplicateFrequencies(frequencies: FrequencyData[]): FrequencyData[] {
    const unique = new Map<string, FrequencyData>();
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