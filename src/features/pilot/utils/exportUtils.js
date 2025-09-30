// src/features/pilot/utils/exportUtils.js

/**
 * Système d'export/import complet pour le profil pilote
 * Exporte TOUS les éléments : infos personnelles, licences, qualifications, suivi médical, unités
 */

/**
 * Export complet du profil pilote au format JSON
 */
export const exportPilotData = () => {
  console.log('=== DÉBUT EXPORT COMPLET ===');

  try {
    // 1. Récupérer TOUTES les données du profil pilote
    const pilotProfile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
    const personalInfo = JSON.parse(localStorage.getItem('personalInfo') || '{}');
    const unitsConfig = JSON.parse(localStorage.getItem('unitsConfig') || '{}');

    // 2. Récupérer les certifications (licences, qualifications, etc.)
    const pilotCertifications = JSON.parse(localStorage.getItem('pilotCertifications') || '{}');

    // S'assurer que la structure existe
    const certifications = {
      licenses: pilotCertifications.licenses || [],
      ratings: pilotCertifications.ratings || [],
      endorsements: pilotCertifications.endorsements || [],
      training: pilotCertifications.training || []
    };

    // 3. Récupérer le suivi médical
    const medicalRecords = JSON.parse(localStorage.getItem('pilotMedicalRecords') || '[]');

    // 4. Créer l'objet d'export complet
    const exportData = {
      version: '2.0', // Nouvelle version pour le format complet
      exportDate: new Date().toISOString(),
      type: 'pilot_complete',
      data: {
        // Informations personnelles
        personalInfo: {
          ...personalInfo,
          photo: pilotProfile.photo || null // Inclure la photo si présente
        },

        // Profil pilote
        pilotProfile: pilotProfile,

        // Licences et qualifications
        certifications: {
          licenses: certifications.licenses,
          qualifications: certifications.ratings, // ratings = qualifications
          endorsements: certifications.endorsements,
          training: certifications.training
        },

        // Suivi médical
        medicalRecords: medicalRecords,

        // Configuration des unités
        unitsConfig: unitsConfig
      },

      // Statistiques pour vérification
      stats: {
        licensesCount: certifications.licenses.length,
        qualificationsCount: certifications.ratings.length,
        endorsementsCount: certifications.endorsements.length,
        trainingsCount: certifications.training.length,
        medicalRecordsCount: medicalRecords.length,
        hasPersonalInfo: Object.keys(personalInfo).length > 0,
        hasUnitsConfig: Object.keys(unitsConfig).length > 0
      }
    };

    // Logs de vérification
    console.log('📊 Résumé de l\'export:');
    console.log('  ✅ Informations personnelles:', exportData.stats.hasPersonalInfo ? 'Oui' : 'Non');
    console.log('  ✅ Licences:', exportData.stats.licensesCount);
    console.log('  ✅ Qualifications:', exportData.stats.qualificationsCount);
    console.log('  ✅ Variantes:', exportData.stats.endorsementsCount);
    console.log('  ✅ Formations:', exportData.stats.trainingsCount);
    console.log('  ✅ Dossiers médicaux:', exportData.stats.medicalRecordsCount);
    console.log('  ✅ Configuration unités:', exportData.stats.hasUnitsConfig ? 'Oui' : 'Non');

    console.log('Export complet:', exportData);
    console.log('=== FIN EXPORT ===');

    // Créer et télécharger le fichier
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profil-pilote-complet-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return exportData;
  } catch (error) {
    console.error('❌ Erreur lors de l\'export:', error);
    alert('Erreur lors de l\'export: ' + error.message);
    return null;
  }
};

/**
 * Import complet du profil pilote depuis un fichier JSON
 */
export const importPilotData = (file) => {
  return new Promise((resolve, reject) => {
    console.log('=== DÉBUT IMPORT COMPLET ===');

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        // Parser le JSON
        const importData = JSON.parse(e.target.result);
        console.log('Données importées:', importData);

        // Vérifier la version et le type
        if (!importData.version || !importData.type) {
          throw new Error('Format de fichier invalide');
        }

        // Vérifier que c'est le bon type
        if (importData.type !== 'pilot_complete' && importData.type !== 'pilot') {
          throw new Error(`Type de fichier non supporté: ${importData.type}`);
        }

        const data = importData.data;

        // 1. Importer les informations personnelles
        if (data.personalInfo) {
          localStorage.setItem('personalInfo', JSON.stringify(data.personalInfo));
          console.log('✅ Informations personnelles importées');
        }

        // 2. Importer le profil pilote
        if (data.pilotProfile) {
          localStorage.setItem('pilotProfile', JSON.stringify(data.pilotProfile));
          console.log('✅ Profil pilote importé');
        } else if (data.personalInfo?.photo) {
          // Si pas de pilotProfile mais une photo dans personalInfo
          localStorage.setItem('pilotProfile', JSON.stringify({ photo: data.personalInfo.photo }));
        }

        // 3. Importer les certifications
        if (data.certifications) {
          const pilotCertifications = {
            licenses: data.certifications.licenses || [],
            ratings: data.certifications.qualifications || data.certifications.ratings || [],
            endorsements: data.certifications.endorsements || [],
            training: data.certifications.training || []
          };
          localStorage.setItem('pilotCertifications', JSON.stringify(pilotCertifications));
          console.log('✅ Certifications importées:');
          console.log('  - Licences:', pilotCertifications.licenses.length);
          console.log('  - Qualifications:', pilotCertifications.ratings.length);
          console.log('  - Variantes:', pilotCertifications.endorsements.length);
          console.log('  - Formations:', pilotCertifications.training.length);
        }

        // Compatibilité avec l'ancien format
        else if (data.licenses || data.qualifications || data.pilotCertifications) {
          const pilotCertifications = data.pilotCertifications || {
            licenses: data.licenses || [],
            ratings: data.qualifications || [],
            endorsements: data.endorsements || [],
            training: data.training || []
          };
          localStorage.setItem('pilotCertifications', JSON.stringify(pilotCertifications));
          console.log('✅ Certifications importées (ancien format)');
        }

        // 4. Importer le suivi médical
        if (data.medicalRecords) {
          localStorage.setItem('pilotMedicalRecords', JSON.stringify(data.medicalRecords));
          console.log('✅ Suivi médical importé:', data.medicalRecords.length, 'dossiers');
        }

        // 5. Importer la configuration des unités
        if (data.unitsConfig) {
          localStorage.setItem('unitsConfig', JSON.stringify(data.unitsConfig));
          console.log('✅ Configuration des unités importée');
        }

        // Vérification finale
        console.log('📊 Résumé de l\'import:');
        const verif = {
          personalInfo: localStorage.getItem('personalInfo') !== null,
          pilotProfile: localStorage.getItem('pilotProfile') !== null,
          certifications: localStorage.getItem('pilotCertifications') !== null,
          medical: localStorage.getItem('pilotMedicalRecords') !== null,
          units: localStorage.getItem('unitsConfig') !== null
        };
        console.log('  ✅ Informations personnelles:', verif.personalInfo ? 'OK' : 'Manquant');
        console.log('  ✅ Profil pilote:', verif.pilotProfile ? 'OK' : 'Manquant');
        console.log('  ✅ Certifications:', verif.certifications ? 'OK' : 'Manquant');
        console.log('  ✅ Suivi médical:', verif.medical ? 'OK' : 'Manquant');
        console.log('  ✅ Configuration unités:', verif.units ? 'OK' : 'Manquant');

        console.log('=== FIN IMPORT ===');

        resolve({
          success: true,
          message: 'Import réussi',
          stats: importData.stats || {}
        });

      } catch (error) {
        console.error('❌ Erreur lors de l\'import:', error);
        reject(error);
      }
    };

    reader.onerror = () => {
      const error = new Error('Erreur de lecture du fichier');
      console.error('❌', error);
      reject(error);
    };

    // Lire le fichier
    reader.readAsText(file);
  });
};

/**
 * Export du carnet de vol (inchangé)
 */
export const exportLogbook = () => {
  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');
  const stats = calculateStatistics(logbook);

  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    type: 'logbook',
    data: {
      entries: logbook,
      statistics: stats,
      totalFlights: logbook.length
    }
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  downloadFile(blob, `logbook-${formatDateFile(new Date())}.json`);
};

/**
 * Export de la flotte d'avions (inchangé)
 */
export const exportAircraft = () => {
  const aircraft = JSON.parse(localStorage.getItem('userAircraft') || '[]');
  const selectedAircraft = JSON.parse(localStorage.getItem('selectedAircraft') || '{}');

  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    type: 'aircraft',
    data: {
      fleet: aircraft,
      selectedAircraft: selectedAircraft,
      totalAircraft: aircraft.length
    }
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  downloadFile(blob, `aircraft-${formatDateFile(new Date())}.json`);
};

/**
 * Fonction utilitaire pour télécharger un fichier
 */
const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Fonction utilitaire pour formater la date dans le nom de fichier
 */
const formatDateFile = (date) => {
  return date.toISOString().split('T')[0];
};

/**
 * Calculer les statistiques du carnet de vol
 */
const calculateStatistics = (logbook) => {
  if (!logbook || logbook.length === 0) {
    return {
      totalFlights: 0,
      totalHours: 0,
      totalLandings: 0
    };
  }

  return logbook.reduce((stats, entry) => {
    return {
      totalFlights: stats.totalFlights + 1,
      totalHours: stats.totalHours + (parseFloat(entry.totalTime) || 0),
      totalLandings: stats.totalLandings + (parseInt(entry.landings) || 0)
    };
  }, { totalFlights: 0, totalHours: 0, totalLandings: 0 });
};

// Fonction wrapper pour l'import depuis un événement
export const importData = (file, options = {}) => {
  return importPilotData(file);
};