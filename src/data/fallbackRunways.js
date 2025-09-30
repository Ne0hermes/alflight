// Données de pistes de secours pour les aérodromes non référencés
// Source: cartes VAC et AIP

export const FALLBACK_RUNWAYS = {
  // LFSH - Sallanches Mont-Blanc
  LFSH: {
    icao: 'LFSH',
    name: 'Sallanches Mont-Blanc',
    runways: [
      {
        identifier: '05/23',
        le_ident: '05',
        he_ident: '23',
        le_heading: 50,
        he_heading: 230,
        length: 900,
        width: 20,
        surface: 'ASPH'
      }
    ]
  },
  
  // Ajouter d'autres aérodromes au besoin
  LFHM: {
    icao: 'LFHM',
    name: 'Megève',
    runways: [
      {
        identifier: '16/34',
        le_ident: '16',
        he_ident: '34',
        le_heading: 160,
        he_heading: 340,
        length: 1400,
        width: 30,
        surface: 'ASPH'
      }
    ]
  },
  
  LFHZ: {
    icao: 'LFHZ',
    name: 'Sallanches Côte 2000',
    runways: [
      {
        identifier: '11/29',
        le_ident: '11',
        he_ident: '29',
        le_heading: 110,
        he_heading: 290,
        length: 350,
        width: 30,
        surface: 'GRASS'
      }
    ]
  },
  
  LFHU: {
    icao: 'LFHU',
    name: 'Albertville',
    runways: [
      {
        identifier: '05/23',
        le_ident: '05',
        he_ident: '23',
        le_heading: 50,
        he_heading: 230,
        length: 800,
        width: 20,
        surface: 'ASPH'
      }
    ]
  },
  
  LFHE: {
    icao: 'LFHE',
    name: 'Romans-Saint-Paul',
    runways: [
      {
        identifier: '01/19',
        le_ident: '01',
        he_ident: '19',
        le_heading: 10,
        he_heading: 190,
        length: 850,
        width: 20,
        surface: 'ASPH'
      }
    ]
  },
  
  LFLU: {
    icao: 'LFLU',
    name: 'Valence-Chabeuil',
    runways: [
      {
        identifier: '02/20',
        le_ident: '02',
        he_ident: '20',
        le_heading: 20,
        he_heading: 200,
        length: 2100,
        width: 30,
        surface: 'ASPH'
      },
      {
        identifier: '11/29',
        le_ident: '11',
        he_ident: '29',
        le_heading: 110,
        he_heading: 290,
        length: 800,
        width: 60,
        surface: 'GRASS'
      }
    ]
  }
};

// Fonction pour obtenir les pistes d'un aérodrome
export const getFallbackRunways = (icao) => {
  return FALLBACK_RUNWAYS[icao]?.runways || null;
};

// Fonction pour obtenir les données complètes d'un aérodrome
export const getFallbackAirport = (icao) => {
  return FALLBACK_RUNWAYS[icao] || null;
};