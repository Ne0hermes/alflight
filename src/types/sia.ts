// src/types/sia.ts
/**
 * Types stricts pour les données SIA (Service de l'Information Aéronautique)
 * Aucune donnée ne doit être inventée ou approximée
 */

import type { Feature, Polygon, MultiPolygon, Point, LineString } from 'geojson';

// Référence d'altitude
export type AltRef = "AMSL" | "AGL" | "STD" | "SFC" | "GND" | "UNL" | "UNDEFINED";

// Classes d'espaces aériens selon OACI
export type AirspaceClass = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "UNDEFINED";

// Types d'espaces spéciaux
export type SpecialAirspaceType = "P" | "R" | "D" | "TMZ" | "RMZ" | "TSA" | "TRA" | "CBA" | "OTHER";

// Types de navaids
export type NavaidType = "VOR" | "DME" | "NDB" | "TACAN" | "VORTAC" | "VOR-DME" | "ILS" | "LOC" | "GP" | "OTHER";

// Types de points désignés
export type DesignatedPointType = "VFR-RP" | "VFR-COMPULSORY" | "VFR-OPTIONAL" | "IFR" | "RNAV" | "OTHER";

// Types de services de fréquence
export type FrequencyService = "TWR" | "APP" | "ACC" | "AFIS" | "GND" | "ATIS" | "VOLMET" | "INFO" | "OTHER";

/**
 * Espace aérien
 */
export interface Airspace {
  id: string;                           // Identifiant unique SIA
  code_id?: string;                     // Code identifiant AIXM (ex: LF-P31)
  name?: string;                         // Nom de l'espace
  class?: AirspaceClass;                // Classe OACI
  type?: SpecialAirspaceType;           // Type spécial (P/R/D etc.)
  activity?: string;                    // Activité (MILITARY, SPORT, etc.)
  geometry: Polygon | MultiPolygon;     // Géométrie GeoJSON
  
  // Limites verticales
  floor?: number;                       // Plancher en pieds
  floor_ref?: AltRef;                   // Référence du plancher
  floor_raw?: string;                   // Valeur brute SIA (ex: "FL065")
  
  ceiling?: number;                     // Plafond en pieds
  ceiling_ref?: AltRef;                 // Référence du plafond
  ceiling_raw?: string;                 // Valeur brute SIA (ex: "FL195")
  
  // Horaires et activation
  schedule?: string;                     // Horaires d'activation
  remarks?: string;                      // Remarques
  
  // Métadonnées
  source: "SIA";
  airac: string;                        // Cycle AIRAC (YYYY-MM-DD)
  sia_uid?: string;                     // UID dans le fichier AIXM
}

/**
 * Aérodrome
 */
export interface Aerodrome {
  id: string;                           // Identifiant unique
  icao?: string;                        // Code OACI (peut être absent pour certains terrains)
  iata?: string;                        // Code IATA si disponible
  name: string;                         // Nom officiel
  city?: string;                        // Ville desservie
  
  // Position
  latitude: number;
  longitude: number;
  elevation_ft?: number;                // Élévation en pieds
  elevation_m?: number;                 // Élévation en mètres
  
  // Caractéristiques
  type?: "AD" | "HP" | "LS" | "OTHER"; // AD=Aerodrome, HP=Heliport, LS=Landing Site
  magnetic_variation?: number;          // Déclinaison magnétique
  transition_altitude?: number;         // Altitude de transition
  
  // Communications
  frequencies?: Frequency[];            // Fréquences radio
  
  // Métadonnées
  source: "SIA";
  airac: string;
  sia_uid?: string;
}

/**
 * Fréquence radio
 */
export interface Frequency {
  type: FrequencyService;
  value: string;                        // Format: "XXX.XXX" MHz
  callsign?: string;                    // Indicatif d'appel
  hours?: string;                        // Horaires de service
  remarks?: string;
}

/**
 * Piste
 */
export interface Runway {
  id: string;
  aerodrome_id: string;                 // Référence à l'aérodrome
  aerodrome_icao?: string;
  
  designation: string;                  // Ex: "09/27", "18L/36R"
  
  // Dimensions
  length_m?: number;
  length_ft?: number;
  width_m?: number;
  width_ft?: number;
  
  // Caractéristiques
  surface?: string;                     // ASPH, GRASS, CONC, etc.
  strength?: string;                     // PCN/résistance
  
  // Orientation
  magnetic_bearing?: number;             // QFU magnétique
  true_bearing?: number;                 // QFU vrai
  
  // Seuils
  threshold_elevation_ft?: number;
  displaced_threshold_m?: number;
  
  // Géométrie
  geometry?: LineString;                 // Axe de piste
  
  // Métadonnées
  source: "SIA";
  airac: string;
  sia_uid?: string;
}

/**
 * Aide à la navigation
 */
export interface Navaid {
  id: string;
  type: NavaidType;
  ident: string;                        // Identifiant radio (ex: "TOU")
  name?: string;                        // Nom complet
  
  // Position
  latitude: number;
  longitude: number;
  elevation_ft?: number;
  
  // Caractéristiques radio
  frequency?: string;                   // Fréquence en MHz ou kHz
  channel?: string;                     // Canal DME/TACAN
  range_nm?: number;                    // Portée en NM
  
  // Navigation
  magnetic_variation?: number;
  
  // Métadonnées
  source: "SIA";
  airac: string;
  sia_uid?: string;
}

/**
 * Point désigné (VFR/IFR)
 */
export interface DesignatedPoint {
  id: string;
  type: DesignatedPointType;
  code: string;                         // Code du point (ex: "N", "S", "E1")
  name: string;                         // Description (ex: "Nord de Toussus")
  
  // Position
  latitude: number;
  longitude: number;
  
  // Associations
  aerodrome_icao?: string;              // Aérodrome associé pour les points VFR
  mandatory?: boolean;                  // Point obligatoire ou optionnel
  
  // Métadonnées
  source: "SIA";
  airac: string;
  sia_uid?: string;
}

/**
 * Obstacle
 */
export interface Obstacle {
  id: string;
  type?: string;                        // ANTENNA, WINDTURBINE, CRANE, etc.
  name?: string;
  
  // Position
  latitude: number;
  longitude: number;
  
  // Altitudes
  elevation_ft?: number;                // Altitude du sol
  height_ft?: number;                   // Hauteur de l'obstacle
  total_height_ft?: number;             // Altitude totale (sol + hauteur)
  
  // Balisage
  lighting?: "LIT" | "UNLIT";
  marking?: string;
  
  // Métadonnées
  source: "SIA";
  airac: string;
  sia_uid?: string;
}

/**
 * Route ATS
 */
export interface ATSRoute {
  id: string;
  designation: string;                  // Ex: "UN460", "G4"
  type?: "AWY" | "RNAV" | "OTHER";
  
  // Limites verticales
  lower_limit?: number;
  lower_limit_ref?: AltRef;
  upper_limit?: number;
  upper_limit_ref?: AltRef;
  
  // Segments
  segments?: RouteSegment[];
  
  // Métadonnées
  source: "SIA";
  airac: string;
  sia_uid?: string;
}

/**
 * Segment de route
 */
export interface RouteSegment {
  from_point: string;                   // ID du point de départ
  to_point: string;                     // ID du point d'arrivée
  mea?: number;                         // MEA en pieds
  geometry?: LineString;                // Géométrie du segment
}

/**
 * Erreur SIA pour données manquantes
 */
export class SIAMissingDataError extends Error {
  constructor(
    public readonly dataType: string,
    public readonly identifier: string,
    message?: string
  ) {
    super(message || `SIA_MISSING:${dataType}:${identifier}`);
    this.name = 'SIAMissingDataError';
  }
}

/**
 * Feature GeoJSON typé pour Airspace
 */
export type AirspaceFeature = Feature<Polygon | MultiPolygon, Airspace>;

/**
 * Feature GeoJSON typé pour Aerodrome
 */
export type AerodromeFeature = Feature<Point, Aerodrome>;

/**
 * Feature GeoJSON typé pour Navaid
 */
export type NavaidFeature = Feature<Point, Navaid>;

/**
 * Feature GeoJSON typé pour DesignatedPoint
 */
export type DesignatedPointFeature = Feature<Point, DesignatedPoint>;

/**
 * Feature GeoJSON typé pour Obstacle
 */
export type ObstacleFeature = Feature<Point, Obstacle>;

/**
 * Feature GeoJSON typé pour Runway
 */
export type RunwayFeature = Feature<LineString, Runway>;