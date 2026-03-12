// src/features/pilot/utils/exportUtils.js

/**
 * Système d'export/import complet pour le profil pilote
 * Exporte TOUS les éléments : infos personnelles, licences, qualifications, suivi médical, unités
 * Les données volumineuses (photos) sont stockées dans IndexedDB pour éviter les QuotaExceededError
 */

/**
 * Récupère la photo du profil depuis IndexedDB si elle n'est pas dans localStorage
 */
const getProfilePhotoFromDB = async () => {
  try {
    const { default: dataBackupManager } = await import('../../../utils/dataBackupManager');
    await dataBackupManager.initPromise;
    const protectedProfile = await dataBackupManager.getProtectedData('pilotProfilePhoto');
    return protectedProfile?.photo || null;
  } catch (error) {
    console.warn('⚠️ Impossible de récupérer la photo depuis IndexedDB:', error);
    return null;
  }
};

/**
 * Sauvegarde la photo du profil dans IndexedDB
 */
const saveProfilePhotoToDB = async (photo) => {
  try {
    const { default: dataBackupManager } = await import('../../../utils/dataBackupManager');
    await dataBackupManager.initPromise;
    await dataBackupManager.saveProtectedData('pilotProfilePhoto', { photo }, 'pilotPhoto');
    console.log('✅ Photo de profil sauvegardée dans IndexedDB');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde de la photo dans IndexedDB:', error);
    return false;
  }
};

/**
 * Stocke des données dans localStorage en gérant le quota.
 * Pour pilotProfile, la photo est extraite et stockée dans IndexedDB.
 */
const safeStoreProfileData = async (key, data) => {
  if (key === 'pilotProfile' || key === 'personalInfo') {
    // Extraire la photo pour la stocker séparément dans IndexedDB
    const { photo, ...lightData } = data;
    if (photo) {
      await saveProfilePhotoToDB(photo);
      // Stocker un marqueur pour savoir qu'il y a une photo dans IndexedDB
      lightData.hasPhotoInDB = true;
    }
    try {
      localStorage.setItem(key, JSON.stringify(lightData));
    } catch (quotaError) {
      if (quotaError.name === 'QuotaExceededError') {
        // Même sans photo, si ça dépasse encore, tenter un nettoyage
        console.warn(`⚠️ QuotaExceededError pour ${key} même sans photo, tentative de nettoyage...`);
        const { safeSetItem } = await import('../../../utils/storageUtils');
        safeSetItem(key, JSON.stringify(lightData));
      } else {
        throw quotaError;
      }
    }
  } else {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (quotaError) {
      if (quotaError.name === 'QuotaExceededError') {
        const { safeSetItem } = await import('../../../utils/storageUtils');
        safeSetItem(key, JSON.stringify(data));
      } else {
        throw quotaError;
      }
    }
  }
};

/**
 * Export complet du profil pilote au format JSON
 */
export const exportPilotData = async () => {

  try {
    // 1. Récupérer TOUTES les données du profil pilote
    const pilotProfile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
    const personalInfo = JSON.parse(localStorage.getItem('personalInfo') || '{}');

    // Récupérer la photo depuis IndexedDB si elle n'est pas dans le profil localStorage
    if (!pilotProfile.photo && pilotProfile.hasPhotoInDB) {
      const dbPhoto = await getProfilePhotoFromDB();
      if (dbPhoto) {
        pilotProfile.photo = dbPhoto;
      }
    }
    // Aussi vérifier dans personalInfo
    if (!personalInfo.photo && personalInfo.hasPhotoInDB) {
      const dbPhoto = await getProfilePhotoFromDB();
      if (dbPhoto) {
        personalInfo.photo = dbPhoto;
      }
    }

    // Récupérer les unités depuis le store Zustand
    const unitsPreferences = JSON.parse(localStorage.getItem('units-preferences') || '{}');
    const unitsConfig = unitsPreferences.state?.units || {};

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
      version: '2.0',
      exportDate: new Date().toISOString(),
      type: 'pilot_complete',
      data: {
        // Informations personnelles
        personalInfo: {
          ...personalInfo,
          photo: pilotProfile.photo || personalInfo.photo || null
        },

        // Profil pilote (avec photo restaurée depuis IndexedDB)
        pilotProfile: pilotProfile,

        // Licences et qualifications
        certifications: {
          licenses: certifications.licenses,
          qualifications: certifications.ratings,
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
 * Les photos sont stockées dans IndexedDB pour éviter les QuotaExceededError
 */
export const importPilotData = (file) => {
  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        // Parser le JSON
        const importData = JSON.parse(e.target.result);

        // Vérifier la version et le type
        if (!importData.version || !importData.type) {
          throw new Error('Format de fichier invalide');
        }

        // Vérifier que c'est le bon type
        if (importData.type !== 'pilot_complete' && importData.type !== 'pilot') {
          throw new Error(`Type de fichier non supporté: ${importData.type}`);
        }

        const data = importData.data;

        // 1. Importer les informations personnelles (photo stockée dans IndexedDB)
        if (data.personalInfo) {
          await safeStoreProfileData('personalInfo', data.personalInfo);
        }

        // 2. Importer le profil pilote (photo stockée dans IndexedDB)
        if (data.pilotProfile) {
          await safeStoreProfileData('pilotProfile', data.pilotProfile);
        } else if (data.personalInfo?.photo) {
          await safeStoreProfileData('pilotProfile', { photo: data.personalInfo.photo });
        }

        // 3. Importer les certifications
        if (data.certifications) {
          const pilotCertifications = {
            licenses: data.certifications.licenses || [],
            ratings: data.certifications.qualifications || data.certifications.ratings || [],
            endorsements: data.certifications.endorsements || [],
            training: data.certifications.training || []
          };
          await safeStoreProfileData('pilotCertifications', pilotCertifications);
        }

        // Compatibilité avec l'ancien format
        else if (data.licenses || data.qualifications || data.pilotCertifications) {
          const pilotCertifications = data.pilotCertifications || {
            licenses: data.licenses || [],
            ratings: data.qualifications || [],
            endorsements: data.endorsements || [],
            training: data.training || []
          };
          await safeStoreProfileData('pilotCertifications', pilotCertifications);
        }

        // 4. Importer le suivi médical
        if (data.medicalRecords) {
          await safeStoreProfileData('pilotMedicalRecords', data.medicalRecords);
        }

        // 5. Importer la configuration des unités
        if (data.unitsConfig && Object.keys(data.unitsConfig).length > 0) {
          const unitsPreferences = {
            state: {
              units: data.unitsConfig
            },
            version: 0
          };
          await safeStoreProfileData('units-preferences', unitsPreferences);
          localStorage.setItem('unitsConfigured', 'true');
        }

        // Vérification finale
        const verif = {
          personalInfo: localStorage.getItem('personalInfo') !== null,
          pilotProfile: localStorage.getItem('pilotProfile') !== null,
          certifications: localStorage.getItem('pilotCertifications') !== null,
          medical: localStorage.getItem('pilotMedicalRecords') !== null,
          units: localStorage.getItem('units-preferences') !== null
        };
        console.log('✅ Import vérifié:', verif);

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
 * Export de la flotte d'avions avec données de performance
 */
export const exportAircraft = async () => {
  try {
    // Récupérer la liste des avions depuis le store Zustand
    const aircraftStore = JSON.parse(localStorage.getItem('aircraft-storage') || '{}');
    const aircraft = aircraftStore.state?.aircraftList || [];
    const selectedId = aircraftStore.state?.selectedId || null;

    // Charger les données volumineuses depuis IndexedDB
    const { default: dataBackupManager } = await import('../../../utils/dataBackupManager');
    await dataBackupManager.initPromise;

    // Pour chaque avion, récupérer les données volumineuses si présentes
    const enrichedAircraft = await Promise.all(
      aircraft.map(async (ac) => {
        if (ac.hasPhoto || ac.hasManex || ac.hasPerformance) {
          try {
            const fullData = await dataBackupManager.getAircraftData(ac.id);
            if (fullData) {
              return {
                ...ac,
                photo: fullData.photo || null,
                manex: fullData.manex || null,
                advancedPerformance: fullData.advancedPerformance || null,
                performanceTables: fullData.performanceTables || null,
                performanceModels: fullData.performanceModels || null
              };
            }
          } catch (error) {
          }
        }
        return ac;
      })
    );

    const exportData = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      type: 'aircraft',
      data: {
        fleet: enrichedAircraft,
        selectedId: selectedId,
        totalAircraft: enrichedAircraft.length
      },
      stats: {
        totalAircraft: enrichedAircraft.length,
        withPhoto: enrichedAircraft.filter(a => a.hasPhoto).length,
        withManex: enrichedAircraft.filter(a => a.hasManex).length,
        withPerformance: enrichedAircraft.filter(a => a.hasPerformance).length
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    downloadFile(blob, `aircraft-fleet-${formatDateFile(new Date())}.json`);

    return exportData;
  } catch (error) {
    console.error('❌ Erreur lors de l\'export des avions:', error);
    alert('Erreur lors de l\'export: ' + error.message);

    // Fallback: export sans données volumineuses
    const aircraftStore = JSON.parse(localStorage.getItem('aircraft-storage') || '{}');
    const aircraft = aircraftStore.state?.aircraftList || [];
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      type: 'aircraft',
      data: {
        fleet: aircraft,
        selectedId: aircraftStore.state?.selectedId || null,
        totalAircraft: aircraft.length
      }
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    downloadFile(blob, `aircraft-fleet-${formatDateFile(new Date())}.json`);
    return exportData;
  }
};

/**
 * Charge le profil pilote complet (localStorage + photo IndexedDB)
 * Utilisé par PilotProfile.jsx pour le chargement initial
 */
export const loadFullPilotProfile = async () => {
  const profile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');

  // Si la photo est dans IndexedDB, la récupérer
  if (profile.hasPhotoInDB && !profile.photo) {
    const dbPhoto = await getProfilePhotoFromDB();
    if (dbPhoto) {
      profile.photo = dbPhoto;
    }
  }

  return profile;
};

/**
 * Sauvegarde le profil pilote (photo dans IndexedDB, reste dans localStorage)
 * Utilisé par PilotProfile.jsx pour la sauvegarde
 */
export const savePilotProfile = async (profile) => {
  await safeStoreProfileData('pilotProfile', profile);
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