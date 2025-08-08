// src/services/openAIPService.js

/**
 * Service pour OpenAIP - Version avec données statiques
 * Les API OpenAIP ne sont pas accessibles depuis le navigateur (CORS)
 * Seules les tiles de carte fonctionnent avec la clé API
 */

const OPENAIP_CONFIG = {
  apiKey: import.meta.env.VITE_OPENAIP_API_KEY || '2717b9196e8100ee2456e09b82b5b08e',
  useStaticData: false, // Par défaut, essayer d'utiliser l'API si le proxy est disponible
  proxyUrl: import.meta.env.VITE_OPENAIP_PROXY_URL || 'http://localhost:3001/api/openaip',
  tileUrl: 'https://api.tiles.openaip.net/api/data/openaip',
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
    
    // Restaurer le mode depuis localStorage
    const savedMode = localStorage.getItem('openaip_use_static_data');
    if (savedMode !== null) {
      OPENAIP_CONFIG.useStaticData = savedMode === 'true';
    }
    
    console.log('🔧 Service OpenAIP initialisé');
    console.log(`📍 Mode: ${OPENAIP_CONFIG.useStaticData ? 'Données statiques' : 'API (via proxy)'}`);
    console.log('🗺️ Les tiles de carte OpenAIP fonctionnent avec votre clé API');
  }

  /**
   * Récupère tous les aérodromes français
   */
  async getAirports(countryCode = 'FR') {
    // Essayer d'abord le proxy si disponible
    console.log('📊 getAirports appelé - Mode:', OPENAIP_CONFIG.useStaticData ? 'Statique' : 'API');
    
    if (!OPENAIP_CONFIG.useStaticData && OPENAIP_CONFIG.proxyUrl) {
      try {
        console.log('🌐 Tentative de récupération via proxy...');
        console.log('📍 URL:', `${OPENAIP_CONFIG.proxyUrl}/airports?country=${countryCode}`);
        
        const response = await fetch(`${OPENAIP_CONFIG.proxyUrl}/airports?country=${countryCode}`);
        console.log('📡 Réponse reçue:', response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${data.items?.length || 0} aérodromes récupérés via l'API`);
          
          // Transformer les données API au format attendu
          const transformed = data.items.map(airport => ({
            id: airport._id || airport.id,
            icao: airport.icaoCode || airport.icao,
            name: airport.name,
            city: airport.city,
            type: airport.type,
            coordinates: {
              lat: airport.geometry.coordinates[1],
              lon: airport.geometry.coordinates[0]
            },
            elevation: airport.elevation?.value || airport.elevation,
            country: airport.country,
            runways: airport.runways || [],
            frequencies: airport.frequencies || []
          }));
          
          // Debug : vérifier si LFST est présent
          const lfst = transformed.find(a => a.icao === 'LFST');
          if (!lfst) {
            console.log('⚠️ LFST non trouvé dans l\'API. Ajout manuel...');
            // Ajouter LFST manuellement car il manque dans l'API
            const lfstData = STATIC_AIRPORTS.find(a => a.icao === 'LFST');
            if (lfstData) {
              transformed.push(lfstData);
              console.log('✅ LFST ajouté manuellement');
            }
          }
          
          // Ajouter d'autres aéroports importants manquants si nécessaire
          const importantMissing = ['LFPX', 'LFPH', 'LFPI', 'LFPK']; // Petits aérodromes parisiens
          importantMissing.forEach(icao => {
            if (!transformed.find(a => a.icao === icao)) {
              const staticAirport = STATIC_AIRPORTS.find(a => a.icao === icao);
              if (staticAirport) {
                transformed.push(staticAirport);
              }
            }
          });
          
          return transformed;
        } else {
          console.error('❌ Erreur HTTP:', response.status, await response.text());
        }
      } catch (error) {
        console.warn('⚠️ Erreur proxy, bascule sur données statiques:', error);
      }
    }
    
    // Fallback sur les données statiques
    console.log('📚 Utilisation des données statiques d\'aérodromes');
    
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
   * Récupère les espaces aériens dans une zone
   */
  async getAirspaces(countryCode = 'FR') {
    console.log('📊 getAirspaces appelé - Mode:', OPENAIP_CONFIG.useStaticData ? 'Statique' : 'API');
    
    if (!OPENAIP_CONFIG.useStaticData && OPENAIP_CONFIG.proxyUrl) {
      try {
        console.log('🌐 Tentative de récupération des espaces aériens via proxy...');
        
        // Utiliser le pays au lieu des bounds
        const url = `${OPENAIP_CONFIG.proxyUrl}/airspaces?country=${countryCode}&limit=500`;
        console.log('📍 URL:', url);
        
        const response = await fetch(url);
        console.log('📡 Réponse reçue:', response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${data.items?.length || 0} espaces aériens récupérés via l'API`);
          
          // Transformer les données de l'API au format attendu
          const transformedAirspaces = (data.items || []).map(airspace => {
            // Mapper les types OpenAIP vers nos classes
            const classMapping = {
              0: 'A',    // Class A
              1: 'B',    // Class B
              2: 'C',    // Class C
              3: 'D',    // Class D
              4: 'E',    // Class E
              5: 'F',    // Class F
              6: 'G',    // Class G
              7: 'CTR',  // Control Zone
              8: 'TMA',  // Terminal Area
              15: 'AWY', // Airway
              16: 'P',   // Prohibited
              17: 'R',   // Restricted
              18: 'D',   // Danger
              19: 'TSA'  // Temporary Segregated Area
            };
            
            const typeMapping = {
              0: 'CTR',
              1: 'TMA',
              2: 'TMA',
              3: 'TMA',
              4: 'FIR',
              5: 'UIR',
              6: 'ADIZ',
              7: 'ATZ',
              8: 'MATZ',
              9: 'Airway',
              10: 'MTR',
              11: 'Alert',
              12: 'Warning',
              13: 'Protected',
              14: 'HTZ',
              15: 'GLIDING',
              16: 'P',
              17: 'R',
              18: 'D',
              19: 'TSA',
              20: 'TRA',
              21: 'TFR',
              22: 'VFR_SECTOR',
              23: 'MTMA'
            };
            
            return {
              ...airspace,
              class: classMapping[airspace.icaoClass] || airspace.class || 'D',
              type: typeMapping[airspace.type] || airspace.type || 'TMA',
              name: airspace.name || 'Zone inconnue',
              floor: airspace.lowerLimit?.value || 0,
              ceiling: airspace.upperLimit?.value || 'FL999'
            };
          }).filter(airspace => {
            // Filtrer pour garder seulement les espaces pertinents
            const relevantTypes = ['CTR', 'TMA', 'D', 'R', 'P', 'TSA', 'ATZ'];
            const relevantClasses = ['A', 'B', 'C', 'D', 'E', 'CTR', 'TMA', 'P', 'R', 'D'];
            return relevantTypes.includes(airspace.type) || relevantClasses.includes(airspace.class);
          });
          
          console.log(`📊 ${transformedAirspaces.length} espaces aériens pertinents après filtrage`);
          return transformedAirspaces;
        } else {
          console.error('❌ Erreur HTTP:', response.status, await response.text());
        }
      } catch (error) {
        console.warn('⚠️ Erreur proxy pour les espaces aériens:', error);
      }
    }
    
    // Fallback sur des données statiques d'espaces aériens
    console.log('📚 Utilisation de données statiques d\'espaces aériens');
    
    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Retourner des espaces aériens statiques pour la France
    return [
        {
          _id: 'static-1',
          name: 'CTR PARIS',
          type: 'CTR',
          class: 'D',
          icaoCode: 'LFPG',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [2.4, 49.1],
              [2.7, 49.1],
              [2.7, 48.8],
              [2.4, 48.8],
              [2.4, 49.1]
            ]]
          },
          lowerLimit: { value: 0, unit: 'FT', referenceDatum: 'GND' },
          upperLimit: { value: 1500, unit: 'FT', referenceDatum: 'AMSL' },
          frequencies: [
            { name: 'PARIS TOUR', value: '119.250', type: 'TWR' },
            { name: 'PARIS SOL', value: '121.700', type: 'GND' }
          ]
        },
        {
          _id: 'static-2',
          name: 'TMA PARIS 1',
          type: 'TMA',
          class: 'A',
          icaoCode: 'LFPG',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [1.9, 49.3],
              [3.0, 49.3],
              [3.0, 48.5],
              [1.9, 48.5],
              [1.9, 49.3]
            ]]
          },
          lowerLimit: { value: 1500, unit: 'FT', referenceDatum: 'AMSL' },
          upperLimit: { value: 195, unit: 'FL', referenceDatum: 'STD' },
          frequencies: [
            { name: 'PARIS APPROCHE', value: '125.830', type: 'APP' }
          ]
        },
        {
          _id: 'static-3',
          name: 'R 45 N1',
          type: 'R',
          class: '',
          icaoCode: '',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [2.5, 48.9],
              [2.6, 48.9],
              [2.6, 48.8],
              [2.5, 48.8],
              [2.5, 48.9]
            ]]
          },
          lowerLimit: { value: 0, unit: 'FT', referenceDatum: 'GND' },
          upperLimit: { value: 3000, unit: 'FT', referenceDatum: 'AMSL' },
          remarks: 'Zone réglementée - Activité militaire'
        },
        {
          _id: 'static-4',
          name: 'D 126',
          type: 'D',
          class: '',
          icaoCode: '',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [2.3, 48.95],
              [2.35, 48.95],
              [2.35, 48.9],
              [2.3, 48.9],
              [2.3, 48.95]
            ]]
          },
          lowerLimit: { value: 0, unit: 'FT', referenceDatum: 'GND' },
          upperLimit: { value: 5000, unit: 'FT', referenceDatum: 'AMSL' },
          remarks: 'Zone dangereuse - Tir'
        }
      ];
  }

  /**
   * Récupère les balises de navigation (VOR, NDB, etc.)
   */
  async getNavaids(countryCode = 'FR') {
    console.log('📡 getNavaids appelé - Mode:', OPENAIP_CONFIG.useStaticData ? 'Statique' : 'API');
    
    // Données statiques des balises françaises principales
    const staticNavaids = [
      // VOR/DME principaux
      { id: 'ABB', ident: 'ABB', name: 'Abbeville', type: 'VOR-DME', coordinates: { lat: 50.135, lon: 1.854 }, frequency: '108.45', channel: '021Y' },
      { id: 'CGN', ident: 'CGN', name: 'Cognac', type: 'VOR-DME', coordinates: { lat: 45.668, lon: -0.317 }, frequency: '113.80', channel: '085X' },
      { id: 'DJL', ident: 'DJL', name: 'Dijon', type: 'VOR-DME', coordinates: { lat: 47.269, lon: 5.089 }, frequency: '115.75', channel: '105X' },
      { id: 'EPL', ident: 'EPL', name: 'Épinal', type: 'VOR-DME', coordinates: { lat: 48.219, lon: 6.070 }, frequency: '113.00', channel: '077X' },
      { id: 'MTD', ident: 'MTD', name: 'Montauban', type: 'VOR-DME', coordinates: { lat: 44.026, lon: 1.378 }, frequency: '114.70', channel: '094X' },
      { id: 'POI', ident: 'POI', name: 'Pontoise', type: 'VOR-DME', coordinates: { lat: 49.097, lon: 2.041 }, frequency: '112.60', channel: '073X' },
      { id: 'ROU', ident: 'ROU', name: 'Rouen', type: 'VOR-DME', coordinates: { lat: 49.384, lon: 1.175 }, frequency: '116.80', channel: '115X' },
      { id: 'TOU', ident: 'TOU', name: 'Toulouse', type: 'VOR-DME', coordinates: { lat: 43.576, lon: 1.377 }, frequency: '117.70', channel: '124X' },
      
      // NDB principaux
      { id: 'AG', ident: 'AG', name: 'Agen', type: 'NDB', coordinates: { lat: 44.175, lon: 0.597 }, frequency: '417' },
      { id: 'BT', ident: 'BT', name: 'Brest', type: 'NDB', coordinates: { lat: 48.448, lon: -4.418 }, frequency: '353' },
      { id: 'CM', ident: 'CM', name: 'Chambéry', type: 'NDB', coordinates: { lat: 45.638, lon: 5.880 }, frequency: '390' },
      { id: 'LN', ident: 'LN', name: 'Lyon', type: 'NDB', coordinates: { lat: 45.726, lon: 5.081 }, frequency: '398' },
      { id: 'MN', ident: 'MN', name: 'Marseille', type: 'NDB', coordinates: { lat: 43.437, lon: 5.215 }, frequency: '357' },
      { id: 'NC', ident: 'NC', name: 'Nice', type: 'NDB', coordinates: { lat: 43.658, lon: 7.216 }, frequency: '332' },
      { id: 'PG', ident: 'PG', name: 'Paris CDG', type: 'NDB', coordinates: { lat: 49.010, lon: 2.548 }, frequency: '368' },
      { id: 'PO', ident: 'PO', name: 'Paris Orly', type: 'NDB', coordinates: { lat: 48.723, lon: 2.379 }, frequency: '374' }
    ];
    
    if (!OPENAIP_CONFIG.useStaticData && OPENAIP_CONFIG.proxyUrl) {
      try {
        const response = await fetch(`${OPENAIP_CONFIG.proxyUrl}/navaids?country=${countryCode}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${data.length} balises récupérées depuis l'API`);
          return data;
        }
      } catch (error) {
        console.warn('⚠️ Erreur API navaids, utilisation des données statiques:', error);
      }
    }
    
    console.log(`📡 Retour de ${staticNavaids.length} balises statiques`);
    return staticNavaids;
  }

  /**
   * Récupère les détails d'un aérodrome avec ses pistes
   */
  async getAirportDetails(icao) {
    console.log(`📊 getAirportDetails appelé pour ${icao}`);
    
    // Chercher d'abord dans les données statiques
    const staticAirport = STATIC_AIRPORTS.find(a => a.icao === icao);
    
    if (!staticAirport) {
      console.log(`❌ Aérodrome ${icao} non trouvé`);
      return null;
    }
    
    // Vérifier si on a des données VAC téléchargées
    try {
      // Accéder au store VAC si disponible
      if (typeof window !== 'undefined' && window.vacStore) {
        const vacState = window.vacStore.getState();
        const vacChart = vacState.charts[icao];
        
        if (vacChart && vacChart.isDownloaded && vacChart.extractedData) {
          console.log(`📄 Utilisation des données VAC pour ${icao}`);
          
          // Convertir les données VAC au format attendu
          const vacRunways = vacChart.extractedData.runways.map((rwy, idx) => {
            // Extraire les identifiants des deux seuils
            const [le_ident, he_ident] = rwy.identifier.split('/');
            const le_heading = rwy.qfu;
            const he_heading = (rwy.qfu + 180) % 360;
            
            return {
              id: `${icao}-${rwy.identifier}`,
              designator: rwy.identifier,
              le_ident: le_ident || rwy.identifier,
              he_ident: he_ident || '',
              le_heading: le_heading,
              he_heading: he_heading,
              dimensions: {
                length: rwy.length,
                width: rwy.width,
                tora: rwy.length,
                toda: rwy.length,
                asda: rwy.length,
                lda: rwy.length
              },
              surface: { 
                type: rwy.surface.toLowerCase().includes('herbe') ? 'GRASS' : 'ASPH',
                condition: 'GOOD' 
              },
              lighting: null,
              le_displaced_threshold: 0,
              he_displaced_threshold: 0
            };
          });
          
          return {
            ...staticAirport,
            elevation: vacChart.extractedData.airportElevation,
            runways: vacRunways,
            vacData: {
              circuitAltitude: vacChart.extractedData.circuitAltitude,
              frequencies: vacChart.extractedData.frequencies,
              magneticVariation: vacChart.extractedData.magneticVariation,
              source: 'VAC',
              extractDate: new Date(vacChart.downloadDate).toISOString()
            },
            dataSource: 'vac',
            staticDataWarning: false,
            vacAvailable: true
          };
        }
      }
    } catch (error) {
      console.log('⚠️ Impossible d\'accéder aux données VAC:', error.message);
    }
    
    // Vérifier si une carte VAC existe pour cet aérodrome
    let vacAvailable = false;
    try {
      if (typeof window !== 'undefined' && window.vacStore) {
        const vacState = window.vacStore.getState();
        // Vérifier si l'aérodrome est dans la configuration VAC
        const VAC_CONFIG = vacState.constructor?.VAC_CONFIG || window.VAC_CONFIG || {};
        vacAvailable = !!(VAC_CONFIG.charts && VAC_CONFIG.charts[icao]);
      }
    } catch (error) {
      console.log('⚠️ Impossible de vérifier la disponibilité VAC:', error.message);
    }
    
    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Retourner les données avec indicateur de source
    return {
      ...staticAirport,
      runways: [],  // Pas de données de pistes statiques
      dataSource: 'static',
      vacAvailable,
      staticDataWarning: true,
      // Marqueur pour le nouveau système d'indicateurs
      source: 'static',
      reliability: 'low'
    };
    
    // Code des données statiques désactivé - on ne veut plus les utiliser
    /*
    const runwayData = {
      'LFPG': [
        {
          id: 'LFPG-09L-27R',
          designator: '09L/27R',
          le_ident: '09L',
          he_ident: '27R',
          le_heading: 87,
          he_heading: 267,
          dimensions: {
            length: 4200,
            width: 60,
            tora: 4200,
            toda: 4200,
            asda: 4200,
            lda: 3700
          },
          surface: { type: 'ASPH', condition: 'GOOD' },
          lighting: 'CAT III',
          le_displaced_threshold: 0,
          he_displaced_threshold: 500
        },
        {
          id: 'LFPG-09R-27L',
          designator: '09R/27L',
          le_ident: '09R',
          he_ident: '27L',
          le_heading: 87,
          he_heading: 267,
          dimensions: {
            length: 2700,
            width: 60,
            tora: 2700,
            toda: 2700,
            asda: 2700,
            lda: 2700
          },
          surface: { type: 'ASPH', condition: 'GOOD' },
          lighting: 'CAT III'
        },
        {
          id: 'LFPG-08L-26R',
          designator: '08L/26R',
          le_ident: '08L',
          he_ident: '26R',
          le_heading: 80,
          he_heading: 260,
          dimensions: {
            length: 3600,
            width: 45,
            tora: 3600,
            toda: 3600,
            asda: 3600,
            lda: 3600
          },
          surface: { type: 'ASPH', condition: 'GOOD' },
          lighting: 'CAT II'
        },
        {
          id: 'LFPG-08R-26L',
          designator: '08R/26L',
          le_ident: '08R',
          he_ident: '26L',
          le_heading: 80,
          he_heading: 260,
          dimensions: {
            length: 3900,
            width: 45,
            tora: 3900,
            toda: 3900,
            asda: 3900,
            lda: 3900
          },
          surface: { type: 'CONC', condition: 'GOOD' },
          lighting: 'CAT III'
        }
      ],
      'LFPO': [
        {
          id: 'LFPO-06-24',
          designator: '06/24',
          le_ident: '06',
          he_ident: '24',
          le_heading: 61,
          he_heading: 241,
          dimensions: {
            length: 3650,
            width: 45,
            tora: 3650,
            toda: 3650,
            asda: 3650,
            lda: 3320
          },
          surface: { type: 'ASPH', condition: 'GOOD' },
          lighting: 'CAT II'
        },
        {
          id: 'LFPO-07-25',
          designator: '07/25',
          le_ident: '07',
          he_ident: '25',
          le_heading: 75,
          he_heading: 255,
          dimensions: {
            length: 3320,
            width: 45,
            tora: 3320,
            toda: 3320,
            asda: 3320,
            lda: 3320
          },
          surface: { type: 'ASPH', condition: 'GOOD' },
          lighting: 'CAT I'
        },
        {
          id: 'LFPO-08-26',
          designator: '08/26',
          le_ident: '08',
          he_ident: '26',
          le_heading: 80,
          he_heading: 260,
          dimensions: {
            length: 2400,
            width: 45,
            tora: 2400,
            toda: 2400,
            asda: 2400,
            lda: 2400
          },
          surface: { type: 'ASPH', condition: 'GOOD' },
          lighting: 'HI/MI'
        }
      ],
      'LFPN': [
        {
          id: 'LFPN-07-25',
          designator: '07/25',
          le_ident: '07',
          he_ident: '25',
          le_heading: 72,
          he_heading: 252,
          dimensions: {
            length: 1845,
            width: 45,
            tora: 1845,
            toda: 1845,
            asda: 1845,
            lda: 1845
          },
          surface: { type: 'ASPH', condition: 'GOOD' },
          lighting: 'HI'
        }
      ],
      'LFPT': [
        {
          id: 'LFPT-05-23',
          designator: '05/23',
          le_ident: '05',
          he_ident: '23',
          le_heading: 54,
          he_heading: 234,
          dimensions: {
            length: 1400,
            width: 45,
            tora: 1400,
            toda: 1400,
            asda: 1400,
            lda: 1400
          },
          surface: { type: 'ASPH', condition: 'GOOD' },
          lighting: 'MI'
        },
        {
          id: 'LFPT-12-30',
          designator: '12/30',
          le_ident: '12',
          he_ident: '30',
          le_heading: 117,
          he_heading: 297,
          dimensions: {
            length: 1100,
            width: 100,
            tora: 1100,
            toda: 1100,
            asda: 1100,
            lda: 1100
          },
          surface: { type: 'GRASS', condition: 'GOOD' },
          lighting: null
        }
      ],
      'LFST': [
        {
          id: 'LFST-05-23',
          designator: '05/23',
          le_ident: '05',
          he_ident: '23',
          le_heading: 50,
          he_heading: 230,
          dimensions: {
            length: 2400,
            width: 45,
            tora: 2400,
            toda: 2400,
            asda: 2400,
            lda: 2400
          },
          surface: { type: 'ASPH', condition: 'GOOD' },
          lighting: 'CAT I'
        }
      ]
    };
    
    return {
      ...staticAirport,
      runways: runwayData[icao] || []
    };
    */
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
   * Basculer entre API (via proxy) et données statiques
   */
  toggleDataSource(useStatic = null) {
    if (useStatic !== null) {
      OPENAIP_CONFIG.useStaticData = useStatic;
    } else {
      OPENAIP_CONFIG.useStaticData = !OPENAIP_CONFIG.useStaticData;
    }
    
    // Sauvegarder le mode dans localStorage
    localStorage.setItem('openaip_use_static_data', OPENAIP_CONFIG.useStaticData.toString());
    
    console.log(`📍 Mode de données: ${OPENAIP_CONFIG.useStaticData ? 'Statique' : 'API (via proxy)'}`);
    this.clearCache();
    
    return OPENAIP_CONFIG.useStaticData;
  }

  /**
   * Vérifier si on utilise les données statiques
   */
  isUsingStaticData() {
    return OPENAIP_CONFIG.useStaticData;
  }

  /**
   * Tester la connexion au proxy ou aux données statiques
   */
  async testConnection() {
    console.log('🔍 Test de connexion - Mode actuel:', OPENAIP_CONFIG.useStaticData ? 'Statique' : 'API');
    
    if (!OPENAIP_CONFIG.useStaticData && OPENAIP_CONFIG.proxyUrl) {
      try {
        console.log('🌐 Test de connexion au proxy...');
        const response = await fetch(`${OPENAIP_CONFIG.proxyUrl.replace('/openaip', '')}/health`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Proxy connecté:', data);
          
          // Maintenant tester la vraie API
          try {
            const airportsResponse = await fetch(`${OPENAIP_CONFIG.proxyUrl}/airports?country=FR&limit=1`);
            if (airportsResponse.ok) {
              const airportsData = await airportsResponse.json();
              return { 
                connected: true, 
                mode: 'api', 
                proxyStatus: data,
                totalAirports: airportsData.totalCount || 0
              };
            }
          } catch (apiError) {
            console.warn('⚠️ API accessible mais erreur:', apiError);
            return { connected: true, mode: 'api-error', error: apiError.message };
          }
        }
      } catch (error) {
        console.warn('⚠️ Proxy non disponible:', error.message);
        // Fallback automatique sur les données statiques
        OPENAIP_CONFIG.useStaticData = true;
        localStorage.setItem('openaip_use_static_data', 'true');
      }
    }
    
    console.log('📚 Test avec données statiques...');
    const airports = await this.getAirports('FR');
    console.log(`✅ ${airports.length} aéroports disponibles`);
    return { connected: true, mode: 'static', airports: airports.length };
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