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
  
  // Grandes villes
  { id: '10', icao: 'LFML', name: 'Marseille Provence', city: 'Marseille', type: 'AIRPORT', coordinates: { lat: 43.4367, lon: 5.2150 }, elevation: 69 },
  { id: '11', icao: 'LFMN', name: 'Nice Côte d\'Azur', city: 'Nice', type: 'AIRPORT', coordinates: { lat: 43.6584, lon: 7.2158 }, elevation: 13 },
  { id: '12', icao: 'LFLL', name: 'Lyon Saint-Exupéry', city: 'Lyon', type: 'AIRPORT', coordinates: { lat: 45.7256, lon: 5.0811 }, elevation: 821 },
  { id: '13', icao: 'LFBO', name: 'Toulouse Blagnac', city: 'Toulouse', type: 'AIRPORT', coordinates: { lat: 43.6293, lon: 1.3638 }, elevation: 499 },
  { id: '14', icao: 'LFBD', name: 'Bordeaux Mérignac', city: 'Bordeaux', type: 'AIRPORT', coordinates: { lat: 44.8283, lon: -0.7156 }, elevation: 162 },
  { id: '15', icao: 'LFRS', name: 'Nantes Atlantique', city: 'Nantes', type: 'AIRPORT', coordinates: { lat: 47.1532, lon: -1.6107 }, elevation: 90 },
  { id: '16', icao: 'LFRN', name: 'Rennes Saint-Jacques', city: 'Rennes', type: 'AIRPORT', coordinates: { lat: 48.0695, lon: -1.7348 }, elevation: 118 },
  { id: '17', icao: 'LFST', name: 'Strasbourg-Entzheim', city: 'Strasbourg', type: 'AIRPORT', coordinates: { lat: 48.5444, lon: 7.6283 }, elevation: 505 },
  { id: '18', icao: 'LFLS', name: 'Grenoble-Isère', city: 'Grenoble', type: 'AIRPORT', coordinates: { lat: 45.3629, lon: 5.3296 }, elevation: 1329 },
  { id: '19', icao: 'LFLB', name: 'Chambéry-Aix-les-Bains', city: 'Chambéry', type: 'AIRPORT', coordinates: { lat: 45.6381, lon: 5.8802 }, elevation: 779 },
  { id: '20', icao: 'LFMT', name: 'Montpellier', city: 'Montpellier', type: 'AIRPORT', coordinates: { lat: 43.5762, lon: 3.9630 }, elevation: 17 },
  { id: '21', icao: 'LFMP', name: 'Perpignan', city: 'Perpignan', type: 'AIRPORT', coordinates: { lat: 42.7409, lon: 2.8709 }, elevation: 59 },
  { id: '22', icao: 'LFLC', name: 'Clermont-Ferrand', city: 'Clermont-Ferrand', type: 'AIRPORT', coordinates: { lat: 45.7867, lon: 3.1692 }, elevation: 1090 },
  { id: '23', icao: 'LFRB', name: 'Brest Bretagne', city: 'Brest', type: 'AIRPORT', coordinates: { lat: 48.4479, lon: -4.4185 }, elevation: 325 },
  { id: '24', icao: 'LFRK', name: 'Caen Carpiquet', city: 'Caen', type: 'AIRPORT', coordinates: { lat: 49.1801, lon: -0.4525 }, elevation: 220 },
  
  // Aérodromes d'aviation légère populaires
  { id: '30', icao: 'LFAY', name: 'Amiens-Glisy', city: 'Amiens', type: 'AIRFIELD', coordinates: { lat: 49.8731, lon: 2.3870 }, elevation: 295 },
  { id: '31', icao: 'LFAC', name: 'Calais-Dunkerque', city: 'Calais', type: 'AIRPORT', coordinates: { lat: 50.9621, lon: 1.9548 }, elevation: 157 },
  { id: '32', icao: 'LFAT', name: 'Le Touquet', city: 'Le Touquet', type: 'AIRPORT', coordinates: { lat: 50.5144, lon: 1.6267 }, elevation: 46 },
  { id: '33', icao: 'LFSB', name: 'Bâle-Mulhouse', city: 'Bâle', type: 'AIRPORT', coordinates: { lat: 47.5896, lon: 7.5299 }, elevation: 885 },
  { id: '34', icao: 'LFGA', name: 'Colmar-Houssen', city: 'Colmar', type: 'AIRFIELD', coordinates: { lat: 48.1098, lon: 7.3593 }, elevation: 666 },
  { id: '35', icao: 'LFGJ', name: 'Dole-Tavaux', city: 'Dole', type: 'AIRPORT', coordinates: { lat: 47.0427, lon: 5.4273 }, elevation: 666 },
  { id: '36', icao: 'LFSD', name: 'Dijon-Longvic', city: 'Dijon', type: 'AIRPORT', coordinates: { lat: 47.2689, lon: 5.0883 }, elevation: 1247 },
  { id: '37', icao: 'LFSG', name: 'Épinal-Mirecourt', city: 'Épinal', type: 'AIRPORT', coordinates: { lat: 48.3250, lon: 6.0698 }, elevation: 761 },
  { id: '38', icao: 'LFSC', name: 'Metz-Nancy-Lorraine', city: 'Metz', type: 'AIRPORT', coordinates: { lat: 48.9821, lon: 6.2513 }, elevation: 1033 },
  { id: '39', icao: 'LFLD', name: 'Bourges', city: 'Bourges', type: 'AIRPORT', coordinates: { lat: 47.0581, lon: 2.3728 }, elevation: 1024 },
  
  // Corse
  { id: '40', icao: 'LFKJ', name: 'Ajaccio Napoléon Bonaparte', city: 'Ajaccio', type: 'AIRPORT', coordinates: { lat: 41.9236, lon: 8.8029 }, elevation: 20 },
  { id: '41', icao: 'LFKB', name: 'Bastia Poretta', city: 'Bastia', type: 'AIRPORT', coordinates: { lat: 42.5527, lon: 9.4837 }, elevation: 33 },
  { id: '42', icao: 'LFKC', name: 'Calvi Sainte-Catherine', city: 'Calvi', type: 'AIRPORT', coordinates: { lat: 42.5244, lon: 8.7931 }, elevation: 26 },
  { id: '43', icao: 'LFKF', name: 'Figari Sud Corse', city: 'Figari', type: 'AIRPORT', coordinates: { lat: 41.5006, lon: 9.0978 }, elevation: 17 }
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