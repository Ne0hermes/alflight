// Utilitaire pour vérifier et créer le bucket Supabase Storage
import { supabase } from '../services/communityService';

/**
 * Vérifie si le bucket existe, sinon le crée
 * @param {string} bucketName - Nom du bucket
 * @returns {Promise<boolean>} True si le bucket existe ou a été créé
 */
export async function ensureBucketExists(bucketName = 'manex-files') {
  try {
    
    // Lister tous les buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Erreur lors de la liste des buckets:', listError);
      throw listError;
    }


    // Vérifier si le bucket existe
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);

    if (bucketExists) {
            return true;
    }

    // Créer le bucket s'il n'existe pas
    
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: true, // Fichiers publiquement accessibles
      fileSizeLimit: 52428800, // 50 MB max
      allowedMimeTypes: ['application/pdf'] // Seulement les PDFs
    });

    if (error) {
      console.error('❌ Erreur lors de la création du bucket:', error);
      throw error;
    }

        return true;
  } catch (error) {
    console.error('❌ Erreur lors de la gestion du bucket:', error);
    return false;
  }
}

/**
 * Test de connexion et création du bucket au démarrage de l'app
 */
export async function initializeSupabaseStorage() {
  try {
    
    // Vérifier/créer le bucket manex-files
    await ensureBucketExists('manex-files');

        return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de Supabase Storage:', error);
    return false;
  }
}
