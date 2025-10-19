// Script de débogage pour les certifications
// À utiliser dans la console du navigateur

export const debugCertifications = () => {
  

  // 1. Vérifier le contenu de pilotCertifications
  const certRaw = localStorage.getItem('pilotCertifications');
  if (certRaw) {
    try {
      const certParsed = JSON.parse(certRaw);
      console.log('Ratings:', certParsed.ratings?.length || 0, 'éléments');
      console.log('Endorsements:', certParsed.endorsements?.length || 0, 'éléments');
      console.log('Training:', certParsed.training?.length || 0, 'éléments');

      if (certParsed.licenses?.length > 0) {
        
        certParsed.licenses.forEach((l, i) => {
          
        });
      }

      if (certParsed.ratings?.length > 0) {
        
        certParsed.ratings.forEach((r, i) => {
          
        });
      }

    } catch (e) {
      console.error('❌ Erreur de parsing:', e);
    }
  } else {
    
  }

  // 2. Vérifier les anciennes clés potentielles
  
  const oldKeys = ['licenses', 'qualifications', 'pilotLicenses', 'pilotQualifications', 'certifications'];

  oldKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        const parsed = JSON.parse(value);
        console.log(`${key}:`, Array.isArray(parsed) ? parsed.length : 'objet', 'éléments');
      } catch (e) {
        
      }
    } else {
      
    }
  });

  
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