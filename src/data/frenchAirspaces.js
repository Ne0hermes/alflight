// src/data/frenchAirspaces.js

/**
 * Base de données des espaces aériens français
 * Comprend les CTR, TMA, zones réglementées et FIR
 */

export const FRENCH_AIRSPACES = {
  // CTR (Control Zone) - Zones de contrôle d'aérodrome
  CTR: [
    // Région parisienne
    {
      id: 'CTR_LFPG',
      name: 'Paris CDG CTR',
      type: 'CTR',
      class: 'D',
      center: { lat: 49.0097, lon: 2.5478 },
      radius: 15,
      floor: 'SFC',
      ceiling: '2000',
      frequency: '119.250',
      unit: 'DE GAULLE Tour',
      airports: ['LFPG']
    },
    {
      id: 'CTR_LFPO',
      name: 'Paris Orly CTR',
      type: 'CTR',
      class: 'D',
      center: { lat: 48.7233, lon: 2.3794 },
      radius: 10,
      floor: 'SFC',
      ceiling: '1500',
      frequency: '118.700',
      unit: 'ORLY Tour',
      airports: ['LFPO']
    },
    {
      id: 'CTR_LFPB',
      name: 'Le Bourget CTR',
      type: 'CTR',
      class: 'D',
      center: { lat: 48.9694, lon: 2.4414 },
      radius: 8,
      floor: 'SFC',
      ceiling: '1500',
      frequency: '118.400',
      unit: 'LE BOURGET Tour',
      airports: ['LFPB']
    },
    
    // Grandes villes
    {
      id: 'CTR_LFST',
      name: 'Strasbourg CTR',
      type: 'CTR',
      class: 'D',
      center: { lat: 48.5444, lon: 7.6283 },
      radius: 8,
      floor: 'SFC',
      ceiling: '2000',
      frequency: '120.775',
      unit: 'STRASBOURG Tour',
      airports: ['LFST']
    },
    {
      id: 'CTR_LFMN',
      name: 'Nice CTR',
      type: 'CTR',
      class: 'D',
      center: { lat: 43.6584, lon: 7.2158 },
      radius: 12,
      floor: 'SFC',
      ceiling: '2000',
      frequency: '118.700',
      unit: 'NICE Tour',
      airports: ['LFMN']
    },
    {
      id: 'CTR_LFML',
      name: 'Marseille CTR',
      type: 'CTR',
      class: 'D',
      center: { lat: 43.4367, lon: 5.2150 },
      radius: 10,
      floor: 'SFC',
      ceiling: '2000',
      frequency: '118.100',
      unit: 'MARSEILLE Tour',
      airports: ['LFML']
    },
    {
      id: 'CTR_LFLL',
      name: 'Lyon CTR',
      type: 'CTR',
      class: 'D',
      center: { lat: 45.7256, lon: 5.0811 },
      radius: 10,
      floor: 'SFC',
      ceiling: '3500',
      frequency: '118.600',
      unit: 'LYON Tour',
      airports: ['LFLL']
    },
    {
      id: 'CTR_LFBO',
      name: 'Toulouse CTR',
      type: 'CTR',
      class: 'D',
      center: { lat: 43.6293, lon: 1.3638 },
      radius: 10,
      floor: 'SFC',
      ceiling: '3000',
      frequency: '118.100',
      unit: 'BLAGNAC Tour',
      airports: ['LFBO']
    },
    {
      id: 'CTR_LFBD',
      name: 'Bordeaux CTR',
      type: 'CTR',
      class: 'D',
      center: { lat: 44.8283, lon: -0.7156 },
      radius: 8,
      floor: 'SFC',
      ceiling: '2000',
      frequency: '118.300',
      unit: 'MERIGNAC Tour',
      airports: ['LFBD']
    }
  ],
  
  // TMA (Terminal Control Area)
  TMA: [
    {
      id: 'TMA_PARIS_1',
      name: 'Paris TMA 1',
      type: 'TMA',
      class: 'A',
      center: { lat: 48.8566, lon: 2.3522 },
      radius: 50,
      floor: '1500',
      ceiling: 'FL195',
      frequency: '121.150',
      unit: 'PARIS Approche',
      sectors: ['Nord', 'Sud', 'Est', 'Ouest']
    },
    {
      id: 'TMA_PARIS_2',
      name: 'Paris TMA 2',
      type: 'TMA',
      class: 'D',
      center: { lat: 48.8566, lon: 2.3522 },
      radius: 70,
      floor: '2500',
      ceiling: 'FL085',
      frequency: '121.150',
      unit: 'PARIS Approche'
    },
    {
      id: 'TMA_NICE',
      name: 'Nice TMA',
      type: 'TMA',
      class: 'A',
      center: { lat: 43.7, lon: 7.3 },
      radius: 40,
      floor: '2000',
      ceiling: 'FL195',
      frequency: '125.350',
      unit: 'NICE Approche'
    },
    {
      id: 'TMA_MARSEILLE',
      name: 'Marseille TMA',
      type: 'TMA',
      class: 'A',
      center: { lat: 43.4367, lon: 5.2150 },
      radius: 45,
      floor: '1500',
      ceiling: 'FL195',
      frequency: '136.075',
      unit: 'MARSEILLE Approche'
    },
    {
      id: 'TMA_LYON',
      name: 'Lyon TMA',
      type: 'TMA',
      class: 'D',
      center: { lat: 45.7256, lon: 5.0811 },
      radius: 35,
      floor: '3500',
      ceiling: 'FL115',
      frequency: '120.850',
      unit: 'LYON Approche'
    },
    {
      id: 'TMA_TOULOUSE',
      name: 'Toulouse TMA',
      type: 'TMA',
      class: 'D',
      center: { lat: 43.6293, lon: 1.3638 },
      radius: 35,
      floor: '3000',
      ceiling: 'FL115',
      frequency: '121.250',
      unit: 'TOULOUSE Approche'
    },
    {
      id: 'TMA_STRASBOURG',
      name: 'Strasbourg TMA',
      type: 'TMA',
      class: 'D',
      center: { lat: 48.5833, lon: 7.75 },
      radius: 30,
      floor: '2000',
      ceiling: 'FL115',
      frequency: '120.100',
      unit: 'STRASBOURG Approche'
    }
  ],
  
  // Zones réglementées, dangereuses et interdites
  RESTRICTED: [
    // Zones militaires
    {
      id: 'LF_R45',
      name: 'LF-R45 Mourmelon',
      type: 'R',
      class: 'R',
      center: { lat: 49.1167, lon: 4.3667 },
      radius: 20,
      floor: 'SFC',
      ceiling: 'FL660',
      frequency: '126.350',
      unit: 'Reims INFO',
      activity: 'Tir et essais militaires',
      hours: 'HO'
    },
    {
      id: 'LF_R108',
      name: 'LF-R108 Cazaux',
      type: 'R',
      class: 'R',
      center: { lat: 44.5333, lon: -1.1250 },
      radius: 15,
      floor: 'SFC',
      ceiling: 'UNL',
      frequency: '120.050',
      unit: 'Cazaux APP',
      activity: 'Tir air-sol',
      hours: 'HO'
    },
    
    // Zones interdites
    {
      id: 'LF_P23',
      name: 'LF-P23 Paris',
      type: 'P',
      class: 'P',
      center: { lat: 48.8566, lon: 2.3522 },
      radius: 3,
      floor: 'SFC',
      ceiling: '5000',
      frequency: 'N/A',
      unit: 'Zone interdite',
      activity: 'Protection Palais de l\'Élysée',
      hours: 'H24'
    },
    {
      id: 'LF_P6',
      name: 'LF-P6 La Hague',
      type: 'P',
      class: 'P',
      center: { lat: 49.6767, lon: -1.9397 },
      radius: 5,
      floor: 'SFC',
      ceiling: '5000',
      frequency: 'N/A',
      unit: 'Zone interdite',
      activity: 'Installation nucléaire',
      hours: 'H24'
    },
    
    // Zones dangereuses
    {
      id: 'LF_D54',
      name: 'LF-D54 Istres',
      type: 'D',
      class: 'D',
      center: { lat: 43.5225, lon: 4.9239 },
      radius: 25,
      floor: 'SFC',
      ceiling: 'FL660',
      frequency: '126.250',
      unit: 'Istres APP',
      activity: 'Essais en vol',
      hours: 'HO'
    }
  ],
  
  // FIR (Flight Information Region)
  FIR: [
    {
      id: 'LFFF',
      name: 'Paris FIR',
      type: 'FIR',
      class: 'G/E',
      center: { lat: 48.0, lon: 2.0 },
      radius: 300,
      floor: 'SFC',
      ceiling: 'UNL',
      frequency: '134.875',
      unit: 'PARIS Info',
      alternateFreq: ['121.500', '124.375']
    },
    {
      id: 'LFMM',
      name: 'Marseille FIR',
      type: 'FIR',
      class: 'G/E',
      center: { lat: 43.5, lon: 5.0 },
      radius: 250,
      floor: 'SFC',
      ceiling: 'UNL',
      frequency: '127.800',
      unit: 'MARSEILLE Info',
      alternateFreq: ['133.825', '126.650']
    },
    {
      id: 'LFBB',
      name: 'Bordeaux FIR',
      type: 'FIR',
      class: 'G/E',
      center: { lat: 45.0, lon: -0.5 },
      radius: 200,
      floor: 'SFC',
      ceiling: 'UNL',
      frequency: '133.800',
      unit: 'BORDEAUX Info',
      alternateFreq: ['124.700', '119.875']
    },
    {
      id: 'LFEE',
      name: 'Reims FIR',
      type: 'FIR',
      class: 'G/E',
      center: { lat: 49.5, lon: 4.0 },
      radius: 150,
      floor: 'SFC',
      ceiling: 'UNL',
      frequency: '135.225',
      unit: 'REIMS Info',
      alternateFreq: ['134.350']
    },
    {
      id: 'LFRR',
      name: 'Brest FIR',
      type: 'FIR',
      class: 'G/E',
      center: { lat: 48.0, lon: -4.0 },
      radius: 200,
      floor: 'SFC',
      ceiling: 'UNL',
      frequency: '135.850',
      unit: 'BREST Info',
      alternateFreq: ['119.475', '124.425']
    }
  ],
  
  // SIV (Service d'Information de Vol) - zones spécifiques
  SIV: [
    {
      id: 'SIV_ALPES',
      name: 'SIV Alpes',
      type: 'SIV',
      center: { lat: 45.5, lon: 6.5 },
      radius: 50,
      floor: '3000',
      ceiling: 'FL195',
      frequency: '120.275',
      unit: 'Alpes Information',
      activity: 'Vol montagne'
    },
    {
      id: 'SIV_PYRENEES',
      name: 'SIV Pyrénées',
      type: 'SIV',
      center: { lat: 42.8, lon: 0.5 },
      radius: 60,
      floor: '3000',
      ceiling: 'FL195',
      frequency: '122.100',
      unit: 'Pyrénées Information',
      activity: 'Vol montagne'
    }
  ]
};

// Fonction pour obtenir tous les espaces aériens
export const getAllAirspaces = () => {
  return [
    ...FRENCH_AIRSPACES.CTR,
    ...FRENCH_AIRSPACES.TMA,
    ...FRENCH_AIRSPACES.RESTRICTED,
    ...FRENCH_AIRSPACES.FIR,
    ...FRENCH_AIRSPACES.SIV
  ];
};

// Fonction pour obtenir les espaces par type
export const getAirspacesByType = (type) => {
  return FRENCH_AIRSPACES[type] || [];
};

// Fonction pour obtenir un espace spécifique par ID
export const getAirspaceById = (id) => {
  return getAllAirspaces().find(airspace => airspace.id === id);
};

// Export par défaut
export default FRENCH_AIRSPACES;