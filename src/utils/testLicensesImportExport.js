// Script de test automatisé pour les licences et qualifications
// À exécuter dans la console pour tester l'import/export

export const runFullTest = async () => {
  console.log('🚀 === DÉBUT DU TEST COMPLET ===');

  // Étape 1: Diagnostic initial
  console.log('\n📋 ÉTAPE 1: État initial');
  const initialState = localStorage.getItem('pilotCertifications');
  console.log('État initial du localStorage:', initialState);

  if (!initialState || initialState === '{}') {
    console.log('⚠️ Aucune donnée - Ajout de données de test...');

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
    console.log('✅ Données de test ajoutées:', testData);
  }

  // Étape 2: Vérifier après ajout
  console.log('\n📋 ÉTAPE 2: Vérification après ajout');
  const afterAdd = JSON.parse(localStorage.getItem('pilotCertifications') || '{}');
  console.log('Contenu de pilotCertifications:');
  console.log('  - Licences:', afterAdd.licenses?.length || 0);
  console.log('  - Qualifications:', afterAdd.ratings?.length || 0);
  console.log('  - Variantes:', afterAdd.endorsements?.length || 0);
  console.log('  - Formations:', afterAdd.training?.length || 0);

  // Étape 3: Simuler un export
  console.log('\n📋 ÉTAPE 3: Simulation d\'export');
  console.log('Pour tester l\'export:');
  console.log('1. Cliquez sur "Exporter le profil pilote"');
  console.log('2. Vérifiez les logs dans la console');
  console.log('3. Ouvrez le fichier JSON téléchargé');

  // Étape 4: Préparer pour l'import
  console.log('\n📋 ÉTAPE 4: Test d\'import');
  console.log('Pour tester l\'import:');
  console.log('1. Cliquez sur "Vider données (TEST)"');
  console.log('2. Rafraîchissez la page (F5)');
  console.log('3. Vérifiez que les données sont vides avec debugCert()');
  console.log('4. Importez le fichier précédemment exporté');
  console.log('5. Rafraîchissez et vérifiez avec debugCert()');

  console.log('\n✅ === FIN DU TEST ===');

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
  console.log('🗑️ Certifications réinitialisées');
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

    console.log('🔍 Structure validation:');
    console.log('  - licenses (array):', hasLicenses ? '✅' : '❌');
    console.log('  - ratings (array):', hasRatings ? '✅' : '❌');
    console.log('  - endorsements (array):', hasEndorsements ? '✅' : '❌');
    console.log('  - training (array):', hasTraining ? '✅' : '❌');

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