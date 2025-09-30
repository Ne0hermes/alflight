// Script de débogage pour les certifications
// À utiliser dans la console du navigateur

export const debugCertifications = () => {
  console.log('=== DIAGNOSTIC CERTIFICATIONS ===');

  // 1. Vérifier le contenu de pilotCertifications
  const certRaw = localStorage.getItem('pilotCertifications');
  console.log('1. pilotCertifications (raw):', certRaw);

  if (certRaw) {
    try {
      const certParsed = JSON.parse(certRaw);
      console.log('2. pilotCertifications (parsed):', certParsed);

      console.log('\n📊 RÉSUMÉ:');
      console.log('- Licences:', certParsed.licenses?.length || 0, 'éléments');
      console.log('- Qualifications (ratings):', certParsed.ratings?.length || 0, 'éléments');
      console.log('- Variantes (endorsements):', certParsed.endorsements?.length || 0, 'éléments');
      console.log('- Formations (training):', certParsed.training?.length || 0, 'éléments');

      if (certParsed.licenses?.length > 0) {
        console.log('\n📜 DÉTAIL LICENCES:');
        certParsed.licenses.forEach((l, i) => {
          console.log(`  ${i+1}. ${l.type || l.name} - Délivré: ${l.issueDate || 'N/A'}`);
        });
      }

      if (certParsed.ratings?.length > 0) {
        console.log('\n🎯 DÉTAIL QUALIFICATIONS:');
        certParsed.ratings.forEach((r, i) => {
          console.log(`  ${i+1}. ${r.type || r.name} - Expire: ${r.expiryDate || 'N/A'}`);
        });
      }

    } catch (e) {
      console.error('❌ Erreur de parsing:', e);
    }
  } else {
    console.log('⚠️ Aucune donnée pilotCertifications trouvée');
  }

  // 2. Vérifier les anciennes clés potentielles
  console.log('\n=== VÉRIFICATION ANCIENNES CLÉS ===');
  const oldKeys = ['licenses', 'qualifications', 'pilotLicenses', 'pilotQualifications', 'certifications'];

  oldKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) {
      console.log(`✅ ${key}: trouvé (${value.length} caractères)`);
      try {
        const parsed = JSON.parse(value);
        console.log(`   → ${Array.isArray(parsed) ? parsed.length : 'objet'} éléments`);
      } catch (e) {
        console.log(`   → Non parsable`);
      }
    } else {
      console.log(`❌ ${key}: vide`);
    }
  });

  console.log('\n=== FIN DIAGNOSTIC ===');
};

// Fonction pour ajouter une licence de test
export const addTestLicense = () => {
  const cert = JSON.parse(localStorage.getItem('pilotCertifications') || '{"licenses":[],"ratings":[],"endorsements":[],"training":[]}');

  cert.licenses.push({
    id: Date.now(),
    type: 'PPL(A) - Private Pilot License (Avion)',
    name: '',
    issueDate: '2024-01-15',
    expiryDate: '',
    document: null,
    documentName: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  localStorage.setItem('pilotCertifications', JSON.stringify(cert));
  console.log('✅ Licence de test ajoutée');
  console.log('Rechargez la page pour voir les changements');
};

// Fonction pour ajouter une qualification de test
export const addTestRating = () => {
  const cert = JSON.parse(localStorage.getItem('pilotCertifications') || '{"licenses":[],"ratings":[],"endorsements":[],"training":[]}');

  cert.ratings.push({
    id: Date.now(),
    type: 'IR - Instrument Rating',
    name: '',
    issueDate: '2024-06-01',
    expiryDate: '2025-06-01',
    document: null,
    documentName: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  localStorage.setItem('pilotCertifications', JSON.stringify(cert));
  console.log('✅ Qualification de test ajoutée');
  console.log('Rechargez la page pour voir les changements');
};

// Export par défaut
export default {
  debugCertifications,
  addTestLicense,
  addTestRating
};

// Pour utiliser dans la console :
// import debug from './utils/debugCertifications.js';
// debug.debugCertifications();
// debug.addTestLicense();
// debug.addTestRating();