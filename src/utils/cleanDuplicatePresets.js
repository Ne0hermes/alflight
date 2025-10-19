/**
 * Script de nettoyage des doublons dans la table community_presets
 *
 * Ce script:
 * 1. Récupère tous les presets actifs
 * 2. Identifie les doublons (même immatriculation)
 * 3. Garde uniquement le preset le plus récent pour chaque immatriculation
 * 4. Supprime les anciens doublons
 *
 * ATTENTION: Ce script modifie la base de données. Utilisez-le avec précaution!
 */

import { supabase } from '../services/communityService.js';

/**
 * Nettoie les doublons de presets dans Supabase
 * @returns {Promise<Object>} Résultat du nettoyage
 */
export async function cleanDuplicatePresets() {
  try {
    

    // 1. Récupérer tous les presets actifs
    const { data: allPresets, error: fetchError } = await supabase
      .from('community_presets')
      .select('id, registration, created_at, updated_at, version')
      .eq('status', 'active')
      .order('registration', { ascending: true })
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Erreur lors de la récupération des presets:', fetchError);
      throw fetchError;
    }

    

    // 2. Identifier les doublons par immatriculation
    const presetsByRegistration = {};
    allPresets.forEach(preset => {
      if (!presetsByRegistration[preset.registration]) {
        presetsByRegistration[preset.registration] = [];
      }
      presetsByRegistration[preset.registration].push(preset);
    });

    // 3. Trouver les immatriculations avec doublons
    const duplicates = {};
    Object.entries(presetsByRegistration).forEach(([registration, presets]) => {
      if (presets.length > 1) {
        duplicates[registration] = presets;
      }
    });

    const duplicateCount = Object.keys(duplicates).length;
    // avec doublons trouvée(s)`);

    if (duplicateCount === 0) {
      
      return {
        success: true,
        duplicatesFound: 0,
        presetsDeleted: 0,
        message: 'Aucun doublon trouvé'
      };
    }

    // 4. Pour chaque groupe de doublons, supprimer tous sauf le plus récent
    const idsToDelete = [];
    const presetsToKeep = [];

    Object.entries(duplicates).forEach(([registration, presets]) => {
      // Trier par date de mise à jour (plus récent en premier), puis par version
      const sortedPresets = [...presets].sort((a, b) => {
        // Comparer d'abord par updated_at
        const dateA = new Date(a.updated_at || a.created_at);
        const dateB = new Date(b.updated_at || b.created_at);
        if (dateB - dateA !== 0) return dateB - dateA;

        // Si même date, comparer par version
        return (b.version || 1) - (a.version || 1);
      });

      // Le premier est le plus récent, on le garde
      const toKeep = sortedPresets[0];
      presetsToKeep.push(toKeep);
      // Les autres sont des doublons à supprimer
      sortedPresets.slice(1).forEach(preset => {
        idsToDelete.push(preset.id);
      });
    });

    
    
    

    if (idsToDelete.length === 0) {
      
      return {
        success: true,
        duplicatesFound: duplicateCount,
        presetsDeleted: 0,
        message: 'Aucune suppression nécessaire'
      };
    }

    // 5. Supprimer les doublons
    
    const { data: deletedData, error: deleteError } = await supabase
      .from('community_presets')
      .delete()
      .in('id', idsToDelete)
      .select();

    if (deleteError) {
      console.error('❌ Erreur lors de la suppression:', deleteError);
      throw deleteError;
    }

    console.log(`✅ ${idsToDelete.length} doublon(s) supprimé(s) avec succès!`);

    return {
      success: true,
      duplicatesFound: duplicateCount,
      presetsDeleted: idsToDelete.length,
      presetsKept: presetsToKeep,
      deletedIds: idsToDelete,
      message: `${idsToDelete.length} doublon(s) supprimé(s), ${presetsToKeep.length} preset(s) conservé(s)`
    };

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage des doublons:', error);
    return {
      success: false,
      error: error.message,
      message: `Erreur: ${error.message}`
    };
  }
}

/**
 * Mode dry-run: Affiche ce qui serait supprimé sans réellement supprimer
 * @returns {Promise<Object>} Aperçu des suppressions
 */
export async function previewCleanDuplicatePresets() {
  try {
    

    // 1. Récupérer tous les presets actifs
    const { data: allPresets, error: fetchError } = await supabase
      .from('community_presets')
      .select('id, registration, created_at, updated_at, version')
      .eq('status', 'active')
      .order('registration', { ascending: true })
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;

    // 2. Identifier les doublons
    const presetsByRegistration = {};
    allPresets.forEach(preset => {
      if (!presetsByRegistration[preset.registration]) {
        presetsByRegistration[preset.registration] = [];
      }
      presetsByRegistration[preset.registration].push(preset);
    });

    const duplicates = {};
    Object.entries(presetsByRegistration).forEach(([registration, presets]) => {
      if (presets.length > 1) {
        duplicates[registration] = presets;
      }
    });

    const duplicateCount = Object.keys(duplicates).length;
    console.log(`🔍 ${duplicateCount} immatriculation(s) avec doublons`);

    if (duplicateCount === 0) {
      return {
        success: true,
        duplicatesFound: 0,
        wouldDelete: 0,
        message: 'Aucun doublon trouvé'
      };
    }

    let wouldDeleteCount = 0;
    Object.entries(duplicates).forEach(([registration, presets]) => {
      
      wouldDeleteCount += presets.length - 1; // -1 car on garde le plus récent
    });

    return {
      success: true,
      duplicatesFound: duplicateCount,
      wouldDelete: wouldDeleteCount,
      duplicates: duplicates,
      message: `${wouldDeleteCount} doublon(s) seraient supprimé(s)`
    };

  } catch (error) {
    console.error('❌ Erreur lors de l\'aperçu:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export par défaut pour utilisation directe
export default {
  clean: cleanDuplicatePresets,
  preview: previewCleanDuplicatePresets
};
