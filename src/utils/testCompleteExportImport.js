// Script de test pour le système d'export/import complet

/**
 * Ajoute des données de test complètes
 */
export const addCompleteTestData = () => {
  

  // 1. Informations personnelles
  const personalInfo = {
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean.dupont@example.com',
    phone: '+33 6 12 34 56 78',
    address: '123 Rue de l\'Aviation',
    city: 'Paris',
    postalCode: '75000',
    country: 'France',
    nationality: 'Française',
    birthDate: '1985-06-15',
    birthPlace: 'Lyon',
    licenseNumber: 'FR.FCL.12345',
    emergencyContact: 'Marie Dupont',
    emergencyPhone: '+33 6 98 76 54 32'
  };
  localStorage.setItem('personalInfo', JSON.stringify(personalInfo));
  

  // 2. Profil pilote
  const pilotProfile = {
    photo: null, // Pas de photo dans le test
    totalHours: 1250,
    lastFlight: '2024-12-15',
    homeBase: 'LFPG'
  };
  localStorage.setItem('pilotProfile', JSON.stringify(pilotProfile));
  

  // 3. Certifications complètes
  const pilotCertifications = {
    licenses: [
      {
        id: Date.now(),
        type: 'PPL(A) - Private Pilot License (Avion)',
        issueDate: '2010-06-15',
        document: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: Date.now() + 1,
        type: 'CPL(A) - Commercial Pilot License (Avion)',
        issueDate: '2015-03-20',
        document: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: Date.now() + 2,
        type: 'ATPL(A) - Airline Transport Pilot License (Avion)',
        issueDate: '2020-11-10',
        document: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    ratings: [
      {
        id: Date.now() + 3,
        type: 'IR - Instrument Rating',
        issueDate: '2012-09-01',
        expiryDate: '2025-09-01',
        document: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: Date.now() + 4,
        type: 'Night Rating',
        issueDate: '2011-04-15',
        expiryDate: '',
        document: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: Date.now() + 5,
        type: 'MEP - Multi Engine Piston',
        issueDate: '2016-07-20',
        expiryDate: '2025-07-20',
        document: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    endorsements: [
      {
        id: Date.now() + 6,
        type: 'Tailwheel',
        issueDate: '2018-05-10',
        expiryDate: '',
        document: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: Date.now() + 7,
        type: 'Complex Aircraft',
        issueDate: '2017-08-25',
        expiryDate: '',
        document: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    training: [
      {
        id: Date.now() + 8,
        type: 'CRM - Crew Resource Management',
        issueDate: '2021-03-15',
        expiryDate: '2024-03-15',
        document: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: Date.now() + 9,
        type: 'UPRT - Upset Prevention and Recovery Training',
        issueDate: '2022-06-20',
        expiryDate: '2025-06-20',
        document: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  };
  localStorage.setItem('pilotCertifications', JSON.stringify(pilotCertifications));
  
  
  
  
  

  // 4. Suivi médical
  const medicalRecords = [
    {
      id: Date.now() + 10,
      type: 'Classe 1',
      issueDate: '2024-01-15',
      expiryDate: '2025-01-15',
      doctor: 'Dr. Martin',
      center: 'Centre Aéromédical de Paris',
      limitations: 'VDL - Doit porter des verres correcteurs',
      document: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: Date.now() + 11,
      type: 'Classe 2',
      issueDate: '2023-06-01',
      expiryDate: '2024-06-01',
      doctor: 'Dr. Dubois',
      center: 'Centre Médical Aéronautique Lyon',
      limitations: '',
      document: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  localStorage.setItem('pilotMedicalRecords', JSON.stringify(medicalRecords));
  

  // 5. Configuration des unités
  const unitsConfig = {
    distance: 'nm',
    altitude: 'ft',
    speed: 'kt',
    weight: 'kg',
    fuel: 'l',
    temperature: 'c',
    pressure: 'hPa',
    visibility: 'km'
  };
  localStorage.setItem('unitsConfig', JSON.stringify(unitsConfig));
  return {
    personalInfo,
    pilotProfile,
    pilotCertifications,
    medicalRecords,
    unitsConfig
  };
};

/**
 * Vérifie l'état complet du profil
 */
export const verifyCompleteProfile = () => {
  

  const results = {
    personalInfo: false,
    pilotProfile: false,
    certifications: false,
    medical: false,
    units: false
  };

  // 1. Vérifier les informations personnelles
  const personalInfo = localStorage.getItem('personalInfo');
  if (personalInfo) {
    const data = JSON.parse(personalInfo);
    results.personalInfo = Object.keys(data).length > 0;
    console.log('✅ Infos personnelles:', Object.keys(data).length, 'champs');
  } else {
    console.log('❌ Pas d\'infos personnelles');
  }

  // 2. Vérifier le profil pilote
  const pilotProfile = localStorage.getItem('pilotProfile');
  if (pilotProfile) {
    const data = JSON.parse(pilotProfile);
    results.pilotProfile = Object.keys(data).length > 0;
    console.log('✓ Profil pilote:', Object.keys(data).length, 'champs');
  } else {
    console.log('❌ Pas de profil pilote');
  }

  // 3. Vérifier les certifications
  const pilotCertifications = localStorage.getItem('pilotCertifications');
  if (pilotCertifications) {
    const data = JSON.parse(pilotCertifications);
    const total = (data.licenses?.length || 0) +
                  (data.ratings?.length || 0) +
                  (data.endorsements?.length || 0) +
                  (data.training?.length || 0);
    results.certifications = total > 0;
    
    
    
    
    
  } else {
    
  }

  // 4. Vérifier le suivi médical
  const medicalRecords = localStorage.getItem('pilotMedicalRecords');
  if (medicalRecords) {
    const data = JSON.parse(medicalRecords);
    results.medical = data.length > 0;
    
  } else {
    
  }

  // 5. Vérifier la configuration des unités
  const unitsConfig = localStorage.getItem('unitsConfig');
  if (unitsConfig) {
    const data = JSON.parse(unitsConfig);
    results.units = Object.keys(data).length > 0;
    console.log('✓ Configuration unités:', Object.keys(data).length, 'paramètres');
  } else {
    console.log('❌ Pas de configuration unités');
  }

  // Résumé
  const allOk = Object.values(results).every(v => v === true);
  
  
  
  
  
  
  

  return results;
};

/**
 * Vide toutes les données du profil
 */
export const clearAllProfileData = () => {
  

  const keys = [
    'personalInfo',
    'pilotProfile',
    'pilotCertifications',
    'pilotMedicalRecords',
    'unitsConfig'
  ];

  keys.forEach(key => {
    localStorage.removeItem(key);
    
  });

  
  return true;
};

/**
 * Test complet du système
 */
export const runCompleteSystemTest = () => {
  

  
  addCompleteTestData();
  const verification = verifyCompleteProfile();

  console.log('\n📋 Données de test complètes ajoutées !');
  console.log('💡 Utilisez clearAllData() pour vider les données');
  console.log('💡 Utilisez verifyCompleteProfile() pour vérifier');

  return verification;
};

// Export par défaut
export default {
  addCompleteTestData,
  verifyCompleteProfile,
  clearAllProfileData,
  runCompleteSystemTest
};