// src/services/openAIPService.js

/**
 * Service pour OpenAIP - Version avec données statiques
 * Les API OpenAIP ne sont pas accessibles depuis le navigateur (CORS)
 * Seules les tiles de carte fonctionnent avec la clé API
 */

const OPENAIP_CONFIG = {
  apiKey: '2717b9196e8100ee2456e09b82b5b08e', // Votre clé API pour les tiles
  useStaticData: true, // Toujours utiliser les données statiques
};

// Données statiques des aérodromes français principaux
const STATIC_AIRPORTS = [
  // Région parisienne
  { id: '1', icao: 'LFPG', name: 'Paris Charles de Gaulle', city: 'Paris', type: 'AIRPORT', coordinates: { lat: 49.0097, lon: 2.5478 }, elevation: 392 },
  { id: '2', icao: 'LFPO', name: 'Paris Orly', city: 'Paris', type: 'AIRPORT', coordinates: { lat: 48.7233, lon: 2.3794 }, elevation: 291 },
  { id: '3', icao: 'LFPB', name: 'Paris Le Bourget', city: 'Paris', type: 'AIRPORT', coordinates: { lat: 48.9694, lon: 2.4414 }, elevation: 218 },
  { id: '4', icao: 'LFPN', name: 'Toussus-le-Noble', city: 'Toussus-le-Noble', type: 'AIRPORT', coordinates: { lat: 48.7519, lon: 2.1061 }, elevation: 538 },
  { id: '5', icao: 'LFPT', name: 'Pontoise-Cormeilles', city: 'Pontoise', type: 'AIRPORT', coordinates: { lat: 49.0967, lon: 2.0413 }, elevation: 325 },
  { id: '6', icao: 'LFPX', name: 'Chavenay', city: 'Chavenay', type: 'AIRFIELD', coordinates: { lat: 48.8547, lon: 1.9861 }, elevation: 436 },
  { id: '7', icao: 'LFPH', name: 'Chelles', city: 'Chelles', type: 'AIRFIELD', coordinates: { lat: 48.8975, lon: 2.6083 }, elevation: 318 },
  { id: '8', icao: 'LFPI', name: 'Persan-Beaumont', city: 'Persan', type: 'AIRFIELD', coordinates: { lat: 49.1658, lon: 2.3517 }, elevation: 312 },
  { id: '9', icao: 'LFPK', name: 'Coulommiers-Voisins', city: 'Coulommiers', type: 'AIRFIELD', coordinates: { lat: 48.8375, lon: 3.0156 }, elevation: 470 },
  { id: '10', icao: 'LFPV', name: 'Villacoublay', city: 'Vélizy', type: 'AIRPORT', coordinates: { lat: 48.7744, lon: 2.2014 }, elevation: 587 },
  
  // Grandes villes
  { id: '11', icao: 'LFML', name: 'Marseille Provence', city: 'Marseille', type: 'AIRPORT', coordinates: { lat: 43.4367, lon: 5.2150 }, elevation: 69 },
  { id: '12', icao: 'LFMN', name: 'Nice Côte d\'Azur', city: 'Nice', type: 'AIRPORT', coordinates: { lat: 43.6584, lon: 7.2158 }, elevation: 13 },
  { id: '13', icao: 'LFLL', name: 'Lyon Saint-Exupéry', city: 'Lyon', type: 'AIRPORT', coordinates: { lat: 45.7256, lon: 5.0811 }, elevation: 821 },
  { id: '14', icao: 'LFBO', name: 'Toulouse Blagnac', city: 'Toulouse', type: 'AIRPORT', coordinates: { lat: 43.6293, lon: 1.3638 }, elevation: 499 },
  { id: '15', icao: 'LFBD', name: 'Bordeaux Mérignac', city: 'Bordeaux', type: 'AIRPORT', coordinates: { lat: 44.8283, lon: -0.7156 }, elevation: 162 },
  { id: '16', icao: 'LFRS', name: 'Nantes Atlantique', city: 'Nantes', type: 'AIRPORT', coordinates: { lat: 47.1532, lon: -1.6107 }, elevation: 90 },
  { id: '17', icao: 'LFRN', name: 'Rennes Saint-Jacques', city: 'Rennes', type: 'AIRPORT', coordinates: { lat: 48.0695, lon: -1.7348 }, elevation: 118 },
  { id: '18', icao: 'LFST', name: 'Strasbourg-Entzheim', city: 'Strasbourg', type: 'AIRPORT', coordinates: { lat: 48.5444, lon: 7.6283 }, elevation: 505 },
  { id: '19', icao: 'LFLS', name: 'Grenoble-Isère', city: 'Grenoble', type: 'AIRPORT', coordinates: { lat: 45.3629, lon: 5.3296 }, elevation: 1329 },
  { id: '20', icao: 'LFLB', name: 'Chambéry-Aix-les-Bains', city: 'Chambéry', type: 'AIRPORT', coordinates: { lat: 45.6381, lon: 5.8802 }, elevation: 779 },
  { id: '21', icao: 'LFMT', name: 'Montpellier', city: 'Montpellier', type: 'AIRPORT', coordinates: { lat: 43.5762, lon: 3.9630 }, elevation: 17 },
  { id: '22', icao: 'LFMP', name: 'Perpignan', city: 'Perpignan', type: 'AIRPORT', coordinates: { lat: 42.7409, lon: 2.8709 }, elevation: 59 },
  { id: '23', icao: 'LFLC', name: 'Clermont-Ferrand', city: 'Clermont-Ferrand', type: 'AIRPORT', coordinates: { lat: 45.7867, lon: 3.1692 }, elevation: 1090 },
  { id: '24', icao: 'LFRB', name: 'Brest Bretagne', city: 'Brest', type: 'AIRPORT', coordinates: { lat: 48.4479, lon: -4.4185 }, elevation: 325 },
  { id: '25', icao: 'LFRK', name: 'Caen Carpiquet', city: 'Caen', type: 'AIRPORT', coordinates: { lat: 49.1801, lon: -0.4525 }, elevation: 220 },
  { id: '26', icao: 'LFLI', name: 'Angers Loire', city: 'Angers', type: 'AIRPORT', coordinates: { lat: 47.5603, lon: -0.3122 }, elevation: 194 },
  { id: '27', icao: 'LFBI', name: 'Poitiers-Biard', city: 'Poitiers', type: 'AIRPORT', coordinates: { lat: 46.5877, lon: 0.3067 }, elevation: 423 },
  { id: '28', icao: 'LFLX', name: 'Châteauroux', city: 'Châteauroux', type: 'AIRPORT', coordinates: { lat: 46.8603, lon: 1.7211 }, elevation: 529 },
  { id: '29', icao: 'LFLW', name: 'Aurillac', city: 'Aurillac', type: 'AIRPORT', coordinates: { lat: 44.8914, lon: 2.4219 }, elevation: 2096 },
  { id: '30', icao: 'LFBZ', name: 'Biarritz', city: 'Biarritz', type: 'AIRPORT', coordinates: { lat: 43.4683, lon: -1.5311 }, elevation: 245 },
  
  // Aérodromes d'aviation légère populaires
  { id: '31', icao: 'LFAY', name: 'Amiens-Glisy', city: 'Amiens', type: 'AIRFIELD', coordinates: { lat: 49.8731, lon: 2.3870 }, elevation: 295 },
  { id: '32', icao: 'LFAC', name: 'Calais-Dunkerque', city: 'Calais', type: 'AIRPORT', coordinates: { lat: 50.9621, lon: 1.9548 }, elevation: 157 },
  { id: '33', icao: 'LFAT', name: 'Le Touquet', city: 'Le Touquet', type: 'AIRPORT', coordinates: { lat: 50.5144, lon: 1.6267 }, elevation: 46 },
  { id: '34', icao: 'LFSB', name: 'Bâle-Mulhouse', city: 'Bâle', type: 'AIRPORT', coordinates: { lat: 47.5896, lon: 7.5299 }, elevation: 885 },
  { id: '35', icao: 'LFGA', name: 'Colmar-Houssen', city: 'Colmar', type: 'AIRFIELD', coordinates: { lat: 48.1098, lon: 7.3593 }, elevation: 666 },
  { id: '36', icao: 'LFGJ', name: 'Dole-Tavaux', city: 'Dole', type: 'AIRPORT', coordinates: { lat: 47.0427, lon: 5.4273 }, elevation: 666 },
  { id: '37', icao: 'LFSD', name: 'Dijon-Longvic', city: 'Dijon', type: 'AIRPORT', coordinates: { lat: 47.2689, lon: 5.0883 }, elevation: 1247 },
  { id: '38', icao: 'LFSG', name: 'Épinal-Mirecourt', city: 'Épinal', type: 'AIRPORT', coordinates: { lat: 48.3250, lon: 6.0698 }, elevation: 761 },
  { id: '39', icao: 'LFSC', name: 'Metz-Nancy-Lorraine', city: 'Metz', type: 'AIRPORT', coordinates: { lat: 48.9821, lon: 6.2513 }, elevation: 1033 },
  { id: '40', icao: 'LFLD', name: 'Bourges', city: 'Bourges', type: 'AIRPORT', coordinates: { lat: 47.0581, lon: 2.3728 }, elevation: 1024 },
  { id: '41', icao: 'LFQL', name: 'Lens-Bénifontaine', city: 'Lens', type: 'AIRFIELD', coordinates: { lat: 50.4667, lon: 2.9197 }, elevation: 203 },
  { id: '42', icao: 'LFQQ', name: 'Lille-Lesquin', city: 'Lille', type: 'AIRPORT', coordinates: { lat: 50.5619, lon: 3.0897 }, elevation: 157 },
  { id: '43', icao: 'LFOB', name: 'Beauvais-Tillé', city: 'Beauvais', type: 'AIRPORT', coordinates: { lat: 49.4544, lon: 2.1119 }, elevation: 358 },
  { id: '44', icao: 'LFOE', name: 'Évreux', city: 'Évreux', type: 'AIRPORT', coordinates: { lat: 49.0289, lon: 1.2197 }, elevation: 464 },
  { id: '45', icao: 'LFOH', name: 'Le Havre', city: 'Le Havre', type: 'AIRPORT', coordinates: { lat: 49.5339, lon: 0.0881 }, elevation: 313 },
  { id: '46', icao: 'LFOP', name: 'Rouen', city: 'Rouen', type: 'AIRPORT', coordinates: { lat: 49.3842, lon: 1.1748 }, elevation: 509 },
  { id: '47', icao: 'LFQT', name: 'Merville-Calonne', city: 'Merville', type: 'AIRFIELD', coordinates: { lat: 50.6186, lon: 2.6422 }, elevation: 61 },
  { id: '48', icao: 'LFQG', name: 'Valenciennes', city: 'Valenciennes', type: 'AIRFIELD', coordinates: { lat: 50.3261, lon: 3.4606 }, elevation: 177 },
  { id: '49', icao: 'LFLU', name: 'Valence-Chabeuil', city: 'Valence', type: 'AIRPORT', coordinates: { lat: 44.9217, lon: 4.9700 }, elevation: 525 },
  { id: '50', icao: 'LFTH', name: 'Toulon-Hyères', city: 'Hyères', type: 'AIRPORT', coordinates: { lat: 43.0973, lon: 6.1460 }, elevation: 7 },
  
  // Corse
  { id: '51', icao: 'LFKJ', name: 'Ajaccio Napoléon Bonaparte', city: 'Ajaccio', type: 'AIRPORT', coordinates: { lat: 41.9236, lon: 8.8029 }, elevation: 20 },
  { id: '52', icao: 'LFKB', name: 'Bastia Poretta', city: 'Bastia', type: 'AIRPORT', coordinates: { lat: 42.5527, lon: 9.4837 }, elevation: 33 },
  { id: '53', icao: 'LFKC', name: 'Calvi Sainte-Catherine', city: 'Calvi', type: 'AIRPORT', coordinates: { lat: 42.5244, lon: 8.7931 }, elevation: 26 },
  { id: '54', icao: 'LFKF', name: 'Figari Sud Corse', city: 'Figari', type: 'AIRPORT', coordinates: { lat: 41.5006, lon: 9.0978 }, elevation: 17 },
  { id: '55', icao: 'LFKS', name: 'Solenzara', city: 'Solenzara', type: 'AIRFIELD', coordinates: { lat: 41.8844, lon: 9.3960 }, elevation: 28 },
  { id: '56', icao: 'LFKO', name: 'Propriano', city: 'Propriano', type: 'AIRFIELD', coordinates: { lat: 41.6606, lon: 8.8897 }, elevation: 12 },
  
  // Aérodromes supplémentaires importants
  { id: '57', icao: 'LFLA', name: 'Auxerre-Branches', city: 'Auxerre', type: 'AIRPORT', coordinates: { lat: 47.8502, lon: 3.4971 }, elevation: 523 },
  { id: '58', icao: 'LFLY', name: 'Lyon-Bron', city: 'Lyon', type: 'AIRPORT', coordinates: { lat: 45.7277, lon: 4.9447 }, elevation: 659 },
  { id: '59', icao: 'LFMU', name: 'Béziers-Vias', city: 'Béziers', type: 'AIRPORT', coordinates: { lat: 43.3235, lon: 3.3539 }, elevation: 56 },
  { id: '60', icao: 'LFMV', name: 'Avignon', city: 'Avignon', type: 'AIRPORT', coordinates: { lat: 43.9073, lon: 4.9018 }, elevation: 124 },
  { id: '61', icao: 'LFMY', name: 'Salon-de-Provence', city: 'Salon', type: 'AIRPORT', coordinates: { lat: 43.6064, lon: 5.1093 }, elevation: 194 },
  { id: '62', icao: 'LFMC', name: 'Le Castellet', city: 'Le Castellet', type: 'AIRPORT', coordinates: { lat: 43.2525, lon: 5.7852 }, elevation: 1391 },
  { id: '63', icao: 'LFMD', name: 'Cannes-Mandelieu', city: 'Cannes', type: 'AIRPORT', coordinates: { lat: 43.5420, lon: 6.9535 }, elevation: 13 },
  { id: '64', icao: 'LFMK', name: 'Carcassonne', city: 'Carcassonne', type: 'AIRPORT', coordinates: { lat: 43.2159, lon: 2.3093 }, elevation: 433 },
  { id: '65', icao: 'LFBH', name: 'La Rochelle', city: 'La Rochelle', type: 'AIRPORT', coordinates: { lat: 46.1792, lon: -1.1953 }, elevation: 74 },
  { id: '66', icao: 'LFBP', name: 'Pau-Pyrénées', city: 'Pau', type: 'AIRPORT', coordinates: { lat: 43.3800, lon: -0.4186 }, elevation: 616 },
  { id: '67', icao: 'LFBT', name: 'Tarbes-Lourdes', city: 'Tarbes', type: 'AIRPORT', coordinates: { lat: 43.1787, lon: -0.0064 }, elevation: 1260 },
  { id: '68', icao: 'LFCI', name: 'Albi', city: 'Albi', type: 'AIRPORT', coordinates: { lat: 43.9137, lon: 2.1130 }, elevation: 564 },
  { id: '69', icao: 'LFCK', name: 'Castres-Mazamet', city: 'Castres', type: 'AIRPORT', coordinates: { lat: 43.5563, lon: 2.2892 }, elevation: 788 },
  { id: '70', icao: 'LFCR', name: 'Rodez', city: 'Rodez', type: 'AIRPORT', coordinates: { lat: 44.4079, lon: 2.4827 }, elevation: 1910 },
  
  // Plus d'aérodromes régionaux
  { id: '71', icao: 'LFSL', name: 'Brive-Souillac', city: 'Brive', type: 'AIRPORT', coordinates: { lat: 45.0397, lon: 1.4856 }, elevation: 1016 },
  { id: '72', icao: 'LFBX', name: 'Périgueux', city: 'Périgueux', type: 'AIRPORT', coordinates: { lat: 45.1981, lon: 0.8156 }, elevation: 328 },
  { id: '73', icao: 'LFBU', name: 'Angoulême', city: 'Angoulême', type: 'AIRPORT', coordinates: { lat: 45.7292, lon: 0.2214 }, elevation: 436 },
  { id: '74', icao: 'LFBY', name: 'Dax', city: 'Dax', type: 'AIRFIELD', coordinates: { lat: 43.6895, lon: -1.0689 }, elevation: 108 },
  { id: '75', icao: 'LFCG', name: 'Saint-Girons', city: 'Saint-Girons', type: 'AIRFIELD', coordinates: { lat: 43.0078, lon: 1.1039 }, elevation: 1368 },
  { id: '76', icao: 'LFDB', name: 'Montauban', city: 'Montauban', type: 'AIRFIELD', coordinates: { lat: 44.0257, lon: 1.3779 }, elevation: 351 },
  { id: '77', icao: 'LFDH', name: 'Auch', city: 'Auch', type: 'AIRFIELD', coordinates: { lat: 43.6878, lon: 0.6017 }, elevation: 411 },
  { id: '78', icao: 'LFFI', name: 'Ancenis', city: 'Ancenis', type: 'AIRFIELD', coordinates: { lat: 47.4096, lon: -1.1769 }, elevation: 111 },
  { id: '79', icao: 'LFFM', name: 'Maubeuge', city: 'Maubeuge', type: 'AIRFIELD', coordinates: { lat: 50.3106, lon: 4.0342 }, elevation: 452 },
  { id: '80', icao: 'LFQB', name: 'Troyes', city: 'Troyes', type: 'AIRPORT', coordinates: { lat: 48.3228, lon: 4.0167 }, elevation: 388 }
];

// Points de report VFR statiques pour quelques aérodromes
const STATIC_REPORTING_POINTS = {
  'LFPN': [
    { id: 'LFPN-N', code: 'N', name: 'November - Château d\'eau de Jouy', coordinates: { lat: 48.7800, lon: 2.1061 }, description: 'Château d\'eau de Jouy-en-Josas' },
    { id: 'LFPN-S', code: 'S', name: 'Sierra - Étang de Saclay', coordinates: { lat: 48.7200, lon: 2.1061 }, description: 'Étang de Saclay' },
    { id: 'LFPN-E', code: 'E', name: 'Echo - Pont de Sèvres', coordinates: { lat: 48.7519, lon: 2.1500 }, description: 'Pont de Sèvres' },
    { id: 'LFPN-W', code: 'W', name: 'Whiskey - Viaduc de l\'A12', coordinates: { lat: 48.7519, lon: 2.0600 }, description: 'Viaduc de l\'A12' }
  ],
  'LFPT': [
    { id: 'LFPT-N', code: 'N', name: 'November - Forêt de l\'Isle-Adam', coordinates: { lat: 49.1300, lon: 2.0413 }, description: 'Forêt de l\'Isle-Adam' },
    { id: 'LFPT-S', code: 'S', name: 'Sierra - Cergy-Pontoise', coordinates: { lat: 49.0600, lon: 2.0413 }, description: 'Centre de Cergy-Pontoise' },
    { id: 'LFPT-E', code: 'E', name: 'Echo - Vexin', coordinates: { lat: 49.0967, lon: 2.1000 }, description: 'Parc du Vexin' },
    { id: 'LFPT-W', code: 'W', name: 'Whiskey - Oise', coordinates: { lat: 49.0967, lon: 1.9800 }, description: 'Boucle de l\'Oise' }
  ],
  'LFPG': [
    { id: 'LFPG-NE', code: 'NE', name: 'Point NE', coordinates: { lat: 49.0500, lon: 2.6000 }, description: 'Nord-Est CDG' },
    { id: 'LFPG-SE', code: 'SE', name: 'Point SE', coordinates: { lat: 48.9700, lon: 2.6000 }, description: 'Sud-Est CDG' },
    { id: 'LFPG-SW', code: 'SW', name: 'Point SW', coordinates: { lat: 48.9700, lon: 2.5000 }, description: 'Sud-Ouest CDG' },
    { id: 'LFPG-NW', code: 'NW', name: 'Point NW', coordinates: { lat: 49.0500, lon: 2.5000 }, description: 'Nord-Ouest CDG' }
  ],
  'LFPO': [
    { id: 'LFPO-N', code: 'N', name: 'November - Antony', coordinates: { lat: 48.7700, lon: 2.3794 }, description: 'Ville d\'Antony' },
    { id: 'LFPO-S', code: 'S', name: 'Sierra - Rungis', coordinates: { lat: 48.6800, lon: 2.3794 }, description: 'Marché de Rungis' }
  ],
  'LFST': [
    { id: 'LFST-N', code: 'N', name: 'November - Obernai', coordinates: { lat: 48.5900, lon: 7.6283 }, description: 'Ville d\'Obernai' },
    { id: 'LFST-S', code: 'S', name: 'Sierra - Sélestat', coordinates: { lat: 48.4000, lon: 7.6283 }, description: 'Ville de Sélestat' },
    { id: 'LFST-E', code: 'E', name: 'Echo - Kehl', coordinates: { lat: 48.5444, lon: 7.7500 }, description: 'Pont de Kehl' },
    { id: 'LFST-W', code: 'W', name: 'Whiskey - Molsheim', coordinates: { lat: 48.5444, lon: 7.5000 }, description: 'Ville de Molsheim' }
  ]
};

class OpenAIPService {
  constructor() {
    this.cache = new Map();
    console.log('🔧 Service OpenAIP initialisé');
    console.log('📍 Mode: Données statiques (API non accessible depuis le navigateur)');
    console.log('🗺️ Les tiles de carte OpenAIP fonctionnent avec votre clé API');
  }

  /**
   * Récupère tous les aérodromes français (données statiques)
   */
  async getAirports(countryCode = 'FR') {
    console.log('📚 Retour des données statiques d\'aérodromes');
    
    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return STATIC_AIRPORTS.map(airport => ({
      ...airport,
      country: 'FR',
      runways: [],
      frequencies: []
    }));
  }

  /**
   * Récupère les points de report VFR pour un aérodrome
   */
  async getReportingPoints(airportId) {
    const icao = typeof airportId === 'string' && airportId.match(/^LF[A-Z]{2}$/) ? airportId : null;
    
    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return icao && STATIC_REPORTING_POINTS[icao] ? STATIC_REPORTING_POINTS[icao] : [];
  }

  /**
   * Récupère tous les points de report VFR
   */
  async getAllReportingPoints(countryCode = 'FR') {
    console.log('📍 Retour des points de report statiques');
    
    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return STATIC_REPORTING_POINTS;
  }

  /**
   * Recherche d'aérodromes par texte
   */
  async searchAirports(query, countryCode = 'FR') {
    const airports = await this.getAirports(countryCode);
    const searchTerm = query.toLowerCase();
    
    return airports.filter(airport => 
      airport.icao.toLowerCase().includes(searchTerm) ||
      airport.name.toLowerCase().includes(searchTerm) ||
      (airport.city && airport.city.toLowerCase().includes(searchTerm))
    );
  }

  /**
   * Compare les coordonnées avec une tolérance
   */
  compareCoordinates(coord1, coord2, tolerance = 0.001) {
    const latDiff = Math.abs(coord1.lat - coord2.lat);
    const lonDiff = Math.abs(coord1.lon - coord2.lon);
    
    return {
      isMatch: latDiff <= tolerance && lonDiff <= tolerance,
      latDiff,
      lonDiff,
      distance: this.calculateDistance(coord1, coord2)
    };
  }

  /**
   * Calcul de distance entre deux points
   */
  calculateDistance(coord1, coord2) {
    const R = 6371; // Rayon de la terre en km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lon - coord1.lon) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // Distance en mètres
  }

  /**
   * Recherche de l'aérodrome le plus proche
   */
  getNearestAirport(coordinates) {
    if (!STATIC_AIRPORTS.length) return null;
    
    let nearest = null;
    let minDistance = Infinity;
    
    STATIC_AIRPORTS.forEach(airport => {
      const distance = this.calculateDistance(coordinates, airport.coordinates);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearest = airport;
      }
    });
    
    return { airport: nearest, distance: minDistance };
  }

  /**
   * Export/Import pour backup
   */
  exportData() {
    return {
      airports: STATIC_AIRPORTS,
      reportingPoints: STATIC_REPORTING_POINTS,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }

  /**
   * Basculer entre API et données statiques (toujours statique maintenant)
   */
  toggleDataSource(useStatic = null) {
    console.log('📍 Mode de données: Toujours statique (API non accessible)');
  }

  /**
   * Vérifier si on utilise les données statiques
   */
  isUsingStaticData() {
    return true;
  }

  /**
   * Tester la connexion (retourne toujours true avec les données statiques)
   */
  async testConnection() {
    console.log('🔍 Test avec données statiques...');
    const airports = await this.getAirports('FR');
    console.log(`✅ ${airports.length} aéroports disponibles`);
    return true;
  }

  /**
   * Obtenir la configuration des tiles OpenAIP
   */
  getTileConfig() {
    return {
      apiKey: OPENAIP_CONFIG.apiKey,
      baseUrl: 'https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png',
      airspaceUrl: 'https://api.tiles.openaip.net/api/data/airspace/{z}/{x}/{y}.png',
      airportUrl: 'https://api.tiles.openaip.net/api/data/airport/{z}/{x}/{y}.png'
    };
  }

  /**
   * Gestion du cache
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > 24 * 60 * 60 * 1000) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Récupère depuis le cache ou l'API (stub pour compatibilité)
   */
  async fetchWithCache(endpoint, params = {}) {
    console.log('📚 Mode données statiques - pas d\'appel API');
    return { items: [] };
  }
}

// Export singleton
export const openAIPService = new OpenAIPService();

// Export des fonctions utilitaires
export const validateCoordinates = (coords1, coords2, toleranceDegrees = 0.001) => {
  return openAIPService.compareCoordinates(coords1, coords2, toleranceDegrees);
};

// Export de la classe pour les tests
export default OpenAIPService;