// src/modules/vac/types/index.ts

export interface Airport {
  id: string;
  icao: string;
  name: string;
  coordinates: {
    lat: number;
    lon: number;
  };
}

export interface RunwayData {
  identifier: string; // Ex: "09L", "27R"
  qfu: number; // Orientation magnétique
  length: number; // En mètres
  width: number; // En mètres
  surface: string; // "ASPH", "GRASS", etc.
}

export interface FrequencyData {
  type: 'TWR' | 'GND' | 'ATIS' | 'APP' | 'INFO';
  frequency: string; // Ex: "118.750"
  hours?: string; // Horaires d'ouverture
  phone?: string; // Numéro de téléphone
}

export interface ILSData {
  runway: string;
  frequency: string;
  identifier: string; // Code ILS
  category: 'I' | 'II' | 'III';
}

export interface ChartData {
  id: string;
  airportIcao: string;
  airportName: string;
  type: 'VAC' | 'IAC' | 'STAR' | 'SID';
  version: string; // Version AIRAC
  effectiveDate: Date;
  expiryDate: Date;
  fileSize: number;
  downloadDate?: Date;
  lastAccessed?: Date;
  
  // Données extraites
  extractedData?: {
    runways: RunwayData[];
    frequencies: FrequencyData[];
    ils?: ILSData[];
    minima?: {
      circling: number;
      straight: number;
    };
    patternAltitude?: number;
    remarks?: string[];
  };
  
  // État
  isDownloaded: boolean;
  isOutdated: boolean;
  extractionStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'manual';
}

export interface VACModuleState {
  charts: Map<string, ChartData>;
  airports: Airport[];
  selectedAirport: string | null;
  downloadQueue: string[];
  isOnline: boolean;
  lastSync: Date | null;
  storageUsed: number;
  storageQuota: number;
}

export interface ExtractedDataValidation {
  chartId: string;
  field: keyof NonNullable<ChartData['extractedData']>;
  value: any;
  confidence: number; // 0-1
  needsValidation: boolean;
}