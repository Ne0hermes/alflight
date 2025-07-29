// src/data/airportElevations.js

// Altitudes des principaux aéroports français en pieds
export const AIRPORT_ELEVATIONS = {
  // Région parisienne
  'LFPG': 392,    // Paris CDG
  'LFPO': 291,    // Paris Orly
  'LFPB': 218,    // Le Bourget
  'LFPN': 538,    // Toussus-le-Noble
  'LFPT': 325,    // Pontoise-Cormeilles
  'LFPX': 436,    // Chavenay
  'LFPH': 318,    // Chelles
  'LFPI': 312,    // Persan-Beaumont
  
  // Grandes villes
  'LFML': 69,     // Marseille
  'LFMN': 13,     // Nice
  'LFLL': 821,    // Lyon Saint-Exupéry
  'LFBO': 499,    // Toulouse Blagnac
  'LFRN': 118,    // Rennes
  'LFRS': 90,     // Nantes
  'LFBD': 162,    // Bordeaux
  'LFLB': 779,    // Chambéry
  'LFLS': 1329,   // Grenoble
  'LFST': 505,    // Strasbourg
  'LFMT': 17,     // Montpellier
  'LFMP': 59,     // Perpignan
  'LFLC': 1090,   // Clermont-Ferrand
  'LFLD': 1024,   // Bourges
  'LFLX': 942,    // Châteauroux
  
  // Aérodromes d'aviation légère
  'LFAY': 295,    // Amiens
  'LFAC': 157,    // Calais
  'LFAT': 46,     // Le Touquet
  'LFAQ': 292,    // Albert
  'LFSB': 885,    // Bâle-Mulhouse
  'LFGA': 1519,   // Colmar
  'LFGJ': 666,    // Dole
  'LFSD': 1247,   // Dijon
  'LFSG': 761,    // Épinal
  'LFSC': 1033,   // Metz-Nancy
  
  // Altitude élevée
  'LFHM': 2877,   // Megève
  'LFKE': 5636,   // Courchevel
  'LFKD': 6588,   // Gap Tallard
  'LFNA': 4101,   // Gap
  'LFNC': 2989,   // Mont-Dauphin
  
  // Corse
  'LFKJ': 20,     // Ajaccio
  'LFKB': 33,     // Bastia
  'LFKC': 26,     // Calvi
  'LFKF': 17,     // Figari
  
  // DOM-TOM (exemples)
  'TFFR': 10,     // Pointe-à-Pitre
  'TFFF': 16,     // Fort-de-France
  'FMEE': 20,     // Saint-Denis
  'TFFJ': 50,     // Saint-Barthélemy
  'TFFS': 10,     // Saint-Martin
  
  // Défaut si non trouvé
  'DEFAULT': 0
};

// Coordonnées des principaux aéroports français
export const FRENCH_AIRPORTS_COORDINATES = {
  LFPG: { lat: 49.012779, lon: 2.550000, name: 'Paris Charles de Gaulle' },
  LFPO: { lat: 48.723333, lon: 2.379444, name: 'Paris Orly' },
  LFPB: { lat: 48.969444, lon: 2.441667, name: 'Paris Le Bourget' },
  LFPT: { lat: 48.751111, lon: 2.106111, name: 'Pontoise' },
  LFPN: { lat: 48.596111, lon: 2.518056, name: 'Toussus-le-Noble' },
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

// Fonction helper pour obtenir l'altitude
export const getAirportElevation = (icaoCode) => {
  return AIRPORT_ELEVATIONS[icaoCode] || AIRPORT_ELEVATIONS.DEFAULT;
};