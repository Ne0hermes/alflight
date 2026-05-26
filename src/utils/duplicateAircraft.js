// Utility pour dupliquer un avion existant dans Supabase
import communityService from '@services/communityService';
import { useAircraftStore } from '@core/stores/aircraftStore';

/**
 * Dupliquer un avion existant pour en créer un nouveau
 * @param {string} sourceAircraftId - ID de l'avion source à dupliquer
 * @param {Object} newDetails - Nouvelles données pour l'avion dupliqué
 * @param {string} newDetails.registration - Nouvelle immatriculation (requis)
 * @param {string} newDetails.model - Nouveau modèle (optionnel)
 * @param {string} newDetails.manufacturer - Nouveau constructeur (optionnel)
 * @param {string} newDetails.category - Nouvelle catégorie (optionnel)
 * @param {Object} newDetails.overrides - Autres champs à modifier (optionnel)
 * @returns {Promise<Object>} Le nouvel avion créé
 */
export async function duplicateAircraft(sourceAircraftId, newDetails) {
  try {
    console.log('🔄 Début de la duplication de l\'avion:', sourceAircraftId);

    // 1. Récupérer l'avion source complet depuis Supabase
    const sourceAircraft = await communityService.getPresetById(sourceAircraftId);

    if (!sourceAircraft) {
      throw new Error('Avion source non trouvé');
    }

    console.log('📥 Avion source récupéré:', {
      registration: sourceAircraft.registration,
      model: sourceAircraft.model,
      manufacturer: sourceAircraft.manufacturer
    });

    // 2. Créer une copie complète des données
    const duplicatedAircraft = JSON.parse(JSON.stringify(sourceAircraft));

    // 3. Supprimer les champs qui ne doivent pas être dupliqués
    delete duplicatedAircraft.id;
    delete duplicatedAircraft.aircraftId;
    delete duplicatedAircraft.communityPresetId;
    delete duplicatedAircraft.importedFromCommunity;
    delete duplicatedAircraft.importDate;
    delete duplicatedAircraft.hasManex; // Sera recalculé si MANEX présent

    // 4. Appliquer les nouvelles données
    duplicatedAircraft.registration = newDetails.registration;

    if (newDetails.model) {
      duplicatedAircraft.model = newDetails.model;
    }

    if (newDetails.manufacturer) {
      duplicatedAircraft.manufacturer = newDetails.manufacturer;
    }

    if (newDetails.category) {
      duplicatedAircraft.category = newDetails.category;
    }

    if (newDetails.aircraftType) {
      duplicatedAircraft.aircraftType = newDetails.aircraftType;
    }

    // 5. Appliquer les surcharges personnalisées
    if (newDetails.overrides) {
      Object.assign(duplicatedAircraft, newDetails.overrides);
    }

    // 6. Mettre à jour les métadonnées
    if (duplicatedAircraft._metadata) {
      duplicatedAircraft._metadata.exportedAt = new Date().toISOString();
      duplicatedAircraft._metadata.duplicatedFrom = sourceAircraft.registration;
    }

    console.log('✏️ Nouvelle configuration:', {
      registration: duplicatedAircraft.registration,
      model: duplicatedAircraft.model,
      manufacturer: duplicatedAircraft.manufacturer,
      category: duplicatedAircraft.category
    });

    // 7. Créer le nouvel avion dans Supabase via le store
    const aircraftStore = useAircraftStore.getState();
    const result = await aircraftStore.addAircraft(duplicatedAircraft);

    console.log('✅ Avion dupliqué avec succès!');

    return result;
  } catch (error) {
    console.error('❌ Erreur lors de la duplication:', error);
    throw error;
  }
}

/**
 * Récupérer la liste des avions disponibles pour duplication
 * @returns {Promise<Array>} Liste des avions avec leurs informations de base
 */
export async function getAvailableAircraftForDuplication() {
  try {
    const presets = await communityService.getAllPresets();

    return presets.map(preset => ({
      id: preset.id,
      registration: preset.registration,
      model: preset.model,
      manufacturer: preset.manufacturer,
      category: preset.category,
      hasManex: preset.hasManex || false
    }));
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des avions:', error);
    throw error;
  }
}

/**
 * Fonction helper pour ouvrir la console de duplication
 * Utilisation dans la console navigateur:
 *
 * import { openDuplicationConsole } from './utils/duplicateAircraft'
 * openDuplicationConsole()
 */
export function openDuplicationConsole() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         CONSOLE DE DUPLICATION D'AVION                     ║
╚════════════════════════════════════════════════════════════╝

Pour dupliquer un avion, suivez ces étapes:

1️⃣ Lister les avions disponibles:
   const aircrafts = await getAvailableAircraftForDuplication()
   console.table(aircrafts)

2️⃣ Dupliquer un avion:
   await duplicateAircraft('ID_SOURCE', {
     registration: 'F-XXXX',
     model: 'Nouveau Modèle',
     manufacturer: 'Nouveau Constructeur',
     category: 'SEP',
     overrides: {
       // Autres modifications...
     }
   })

Exemple complet:
-----------------
const aircrafts = await getAvailableAircraftForDuplication()
console.table(aircrafts)

// Dupliquer F-HSTR pour créer F-ABCD
await duplicateAircraft(aircrafts[0].id, {
  registration: 'F-ABCD',
  model: 'DR400-180',
  manufacturer: 'Robin',
  category: 'SEP',
  overrides: {
    weights: {
      emptyWeight: '650',
      maxWeight: '1100'
    }
  }
})
  `);
}

// Export des fonctions
export default {
  duplicateAircraft,
  getAvailableAircraftForDuplication,
  openDuplicationConsole
};
