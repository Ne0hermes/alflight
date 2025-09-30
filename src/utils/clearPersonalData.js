// Utilitaire pour vider les données personnelles du localStorage
// À utiliser dans la console du navigateur pour tester les imports

export const clearPersonalData = () => {
  console.log('=== SUPPRESSION DES DONNÉES PERSONNELLES ===');

  const keysToRemove = [
    'personalInfo',
    'pilotProfile',
    'pilotLicenses',
    'pilotMedicalRecords',
    'pilotQualifications',
    'pilotCertifications',
    'certifications',
    'unitsConfig',
    'medicalRecords',
    'licenses',
    'qualifications'  // Ajouter cette clé manquante
  ];

  let removedCount = 0;

  keysToRemove.forEach(key => {
    const data = localStorage.getItem(key);
    if (data) {
      const sizeMB = (data.length / 1024 / 1024).toFixed(2);
      localStorage.removeItem(key);
      console.log(`✅ Supprimé: ${key} (${sizeMB}MB)`);
      removedCount++;
    } else {
      console.log(`⏭️ ${key} - déjà vide`);
    }
  });

  // Afficher le résumé
  console.log('\n📊 RÉSUMÉ:');
  console.log(`${removedCount} clés supprimées`);

  // Calculer l'espace restant
  let totalSize = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      totalSize += localStorage[key].length;
    }
  }

  console.log(`Espace utilisé restant: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
  console.log('\n✅ Données personnelles supprimées avec succès!');
  console.log('Actualisez la page pour voir les changements.');

  return {
    success: true,
    removedCount,
    remainingStorageMB: (totalSize / 1024 / 1024).toFixed(2)
  };
};

// Fonction pour tout nettoyer (ATTENTION: supprime TOUT)
export const clearAllStorage = () => {
  if (confirm('⚠️ ATTENTION: Ceci va supprimer TOUTES les données stockées. Continuer?')) {
    localStorage.clear();
    console.log('🗑️ Tout le localStorage a été vidé');
    alert('Toutes les données ont été supprimées. Rechargez la page.');
    return true;
  }
  return false;
};

// Export par défaut
export default {
  clearPersonalData,
  clearAllStorage
};