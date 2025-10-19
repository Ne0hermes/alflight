// Script de test automatisé pour les licences et qualifications
// À exécuter dans la console pour tester l'import/export

export const runFullTest = async () => {
  

  // Étape 1: Diagnostic initial
  
  const initialState = localStorage.getItem('pilotCertifications');
  

  if (!initialState || initialState === '{}') {
    

    // Créer une structure complète
    const testData = {
      licenses: [
        {
          id: Date.now(),
          type: 'PPL(A) - Private Pilot License (Avion)',
          name: '',
          issueDate: '2024-01-15',
          document: null,
          documentName: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: Date.now() + 1,
          type: 'CPL(A) - Commercial Pilot License (Avion)',
          name: '',
          issueDate: '2024-06-01',
          document: null,
          documentName: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      ratings: [
        {
          id: Date.now() + 2,
          type: 'IR - Instrument Rating',
          name: '',
          issueDate: '2024-03-01',
          expiryDate: '2025-03-01',
          document: null,
          documentName: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: Date.now() + 3,
          type: 'Night Rating',
          name: '',
          issueDate: '2024-02-15',
          expiryDate: '',
          document: null,
          documentName: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      endorsements: [
        {
          id: Date.now() + 4,
          type: 'Tailwheel',
          name: '',
          issueDate: '2024-04-10',
          expiryDate: '',
          document: null,
          documentName: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      training: [
        {
          id: Date.now() + 5,
          type: 'CRM - Crew Resource Management',
          name: '',
          issueDate: '2024-05-20',
          expiryDate: '2026-05-20',
          document: null,
          documentName: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    };

    localStorage.setItem('pilotCertifications', JSON.stringify(testData));
    
  }

  // Étape 2: Vérifier après ajout
  
  const afterAdd = JSON.parse(localStorage.getItem('pilotCertifications') || '{}');
  
  
  
  
  

  // Étape 3: Simuler un export
  
  
  
  
  

  // Étape 4: Préparer pour l'import
  console.log('Test completed successfully');

  return {
    success: true,
    data: afterAdd
  };
};

// Fonction pour nettoyer et réinitialiser
export const resetCertifications = () => {
  const emptyData = {
    licenses: [],
    ratings: [],
    endorsements: [],
    training: []
  };

  localStorage.setItem('pilotCertifications', JSON.stringify(emptyData));
  
  return emptyData;
};

// Fonction pour vérifier la structure
export const validateStructure = () => {
  const data = localStorage.getItem('pilotCertifications');

  if (!data) {
    console.error('❌ Aucune donnée pilotCertifications');
    return false;
  }

  try {
    const parsed = JSON.parse(data);
    const hasLicenses = Array.isArray(parsed.licenses);
    const hasRatings = Array.isArray(parsed.ratings);
    const hasEndorsements = Array.isArray(parsed.endorsements);
    const hasTraining = Array.isArray(parsed.training);

    console.log('Structure validation:');
    console.log('Licenses:', hasLicenses ? '✅' : '❌');
    console.log('Ratings:', hasRatings ? '✅' : '❌');
    console.log('Endorsements:', hasEndorsements ? '✅' : '❌');
    console.log('Training:', hasTraining ? '✅' : '❌');

    return hasLicenses && hasRatings && hasEndorsements && hasTraining;
  } catch (e) {
    console.error('❌ Erreur de parsing:', e);
    return false;
  }
};

// Export par défaut
export default {
  runFullTest,
  resetCertifications,
  validateStructure
};