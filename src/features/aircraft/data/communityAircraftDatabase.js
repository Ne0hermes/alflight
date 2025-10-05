// Base de données centralisée des avions communautaires
// Cette base unique est utilisée par l'assistant de création et le service de versioning

export const COMMUNITY_AIRCRAFT_DATABASE = [
  {
    registration: 'F-GBYU',
    model: 'Diamond DA40 NG',
    manufacturer: 'Diamond Aircraft',
    type: 'DA40 NG',
    addedBy: 'Pilot123',
    dateAdded: '2024-03-15',
    lastUpdated: '2024-03-15',
    downloads: 156,
    verified: true,
    votes: { up: 42, down: 2 },
    validationThreshold: 10,
    hasFlightManual: true,
    manualVersion: 'Rev. 7 - 2023',
    adminVerified: true,
    data: {
      // Données complètes de l'avion
      cruiseSpeed: 127,
      maxSpeed: 154,
      stallSpeed: 49,
      serviceCeiling: 16400,
      fuelCapacity: 148,
      emptyWeight: 795,
      maxTakeoffWeight: 1280
    }
  },
  {
    registration: 'F-HXYZ',
    model: 'Cessna 172S',
    manufacturer: 'Cessna',
    type: 'C172S',
    addedBy: 'AeroClub75',
    dateAdded: '2024-02-28',
    lastUpdated: '2024-02-28',
    downloads: 89,
    verified: true,
    votes: { up: 28, down: 1 },
    validationThreshold: 10,
    hasFlightManual: true,
    manualVersion: 'Rev. 5 - 2022',
    adminVerified: true,
    data: {
      cruiseSpeed: 122,
      maxSpeed: 140,
      stallSpeed: 47,
      serviceCeiling: 14000,
      fuelCapacity: 212,
      emptyWeight: 767,
      maxTakeoffWeight: 1157
    }
  },
  {
    registration: 'F-GJKL',
    model: 'Piper PA-28-181',
    manufacturer: 'Piper',
    type: 'PA28',
    addedBy: 'FlightSchool',
    dateAdded: '2024-01-10',
    lastUpdated: '2024-01-10',
    downloads: 234,
    verified: false,
    votes: { up: 8, down: 3 },
    validationThreshold: 10,
    hasFlightManual: true,
    manualVersion: 'Report 2215 - 2021',
    adminVerified: false,
    data: {
      cruiseSpeed: 123,
      maxSpeed: 144,
      stallSpeed: 50,
      serviceCeiling: 13800,
      fuelCapacity: 189,
      emptyWeight: 619,
      maxTakeoffWeight: 1157
    }
  },
  {
    registration: 'F-GMNO',
    model: 'Robin DR400-140B',
    manufacturer: 'Robin',
    type: 'DR400',
    addedBy: 'FrenchPilot',
    dateAdded: '2024-03-01',
    lastUpdated: '2024-03-01',
    downloads: 67,
    verified: true,
    votes: { up: 15, down: 0 },
    validationThreshold: 10,
    hasFlightManual: true,
    manualVersion: 'Edition 3 - 2020',
    adminVerified: true,
    data: {
      cruiseSpeed: 120,
      maxSpeed: 151,
      stallSpeed: 55,
      serviceCeiling: 13100,
      fuelCapacity: 120,
      emptyWeight: 580,
      maxTakeoffWeight: 950
    }
  }
];

// Fonction utilitaire pour récupérer un avion par immatriculation
export const getAircraftByRegistration = (registration) => {
  return COMMUNITY_AIRCRAFT_DATABASE.find(
    ac => ac.registration.toUpperCase() === registration.toUpperCase()
  );
};

// Fonction utilitaire pour vérifier si un avion existe
export const aircraftExists = (registration) => {
  return COMMUNITY_AIRCRAFT_DATABASE.some(
    ac => ac.registration.toUpperCase() === registration.toUpperCase()
  );
};
