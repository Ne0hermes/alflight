// Service pour gérer les interactions avec la base de données communautaire Supabase

import { createClient } from '@supabase/supabase-js';
import { normalizeAircraftImport } from '@utils/aircraftNormalizer';

// ⚠️ IMPORTANT: Remplacer par vos vraies clés Supabase
// Obtenir ces clés depuis: https://app.supabase.com/project/YOUR_PROJECT/settings/api
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Debug: vérifier les variables d'environnement chargées

// Initialiser le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Service pour gérer les presets communautaires
 */
class CommunityService {
  /**
   * Récupérer tous les presets actifs
   * @returns {Promise<Array>} Liste des presets
   */
  async getAllPresets() {
    try {
      
      const { data, error } = await supabase
        .from('community_presets')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        throw error;
      }

      
      // Log du premier preset pour debug
            // Transformer les données pour correspondre au format attendu
      return data.map(preset => {
        // Normaliser aircraft_data si présent
        const normalizedAircraftData = preset.aircraft_data
          ? normalizeAircraftImport(preset.aircraft_data)
          : null;

        const mapped = {
          id: preset.id,
          registration: preset.registration,
          model: preset.model,
          manufacturer: preset.manufacturer,
          type: preset.aircraft_type,
          category: preset.category,
          addedBy: preset.submitted_by,
          dateAdded: preset.submitted_at,
          downloads: preset.downloads_count || 0,
          votes: {
            up: preset.votes_up || 0,
            down: preset.votes_down || 0
          },
          verified: preset.verified,
          adminVerified: preset.admin_verified,
          description: preset.description,
          // Données complètes de l'avion - NORMALIZED!
          aircraftData: normalizedAircraftData,
          version: preset.version || 1,
          // Indiquer si le MANEX est disponible dans Supabase
          hasManex: preset.has_manex || false
        };


        return mapped;
      });
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des presets:', error);
      // Retourner un tableau vide au lieu de throw pour éviter le crash
      return [];
    }
  }

  /**
   * Rechercher des presets par immatriculation, modèle ou constructeur
   * @param {string} searchTerm
   * @returns {Promise<Array>}
   */
  async searchPresets(searchTerm) {
    try {
      const { data, error } = await supabase
        .from('presets_with_stats')
        .select('*')
        .or(`registration.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,manufacturer.ilike.%${searchTerm}%`)
        .order('verified', { ascending: false })
        .order('net_votes', { ascending: false });

      if (error) throw error;

      return data.map(preset => ({
        id: preset.id,
        registration: preset.registration,
        model: preset.model,
        manufacturer: preset.manufacturer,
        type: preset.aircraft_type,
        verified: preset.verified,
        votes: {
          up: preset.votes_up,
          down: preset.votes_down
        }
      }));
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      throw error;
    }
  }

  /**
   * Récupérer un preset spécifique avec toutes ses données
   * @param {string} presetId
   * @returns {Promise<Object>}
   */
  async getPresetById(presetId) {
    try {
      const { data, error } = await supabase
        .from('community_presets')
        .select('*, manex_files(filename, file_path, file_size)')
        .eq('id', presetId)
        .single();

      if (error) throw error;

      // Retourner les données complètes de aircraft_data avec les métadonnées
      const fullAircraft = {
        ...data.aircraft_data,
        // Ne PAS écraser les données de aircraft_data, les garder intactes
        // Les champs ci-dessous sont uniquement pour référence/tracking
        importedFromCommunity: true,
        communityPresetId: data.id,
        // 🔧 FIX: Propager hasManex depuis Supabase (n'est pas dans aircraft_data)
        hasManex: data.has_manex || false
      };

      // Télécharger automatiquement le MANEX s'il existe
      if (data.has_manex && data.manex_files && data.manex_files.file_path) {
        
        try {
          // Télécharger le MANEX depuis Supabase Storage
          const manexBlob = await this.downloadManex(data.manex_files.file_path);

          // Convertir le blob en base64
          const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(manexBlob);
          });

          // Ajouter le MANEX aux données de l'avion
          fullAircraft.manex = {
            fileName: data.manex_files.filename,
            fileSize: data.manex_files.file_size,
            pdfData: base64Data, // Format base64 pour stockage
            uploadDate: new Date().toISOString(),
            uploadedToSupabase: true,
            supabasePath: data.manex_files.file_path,
            hasData: true
          };
          // Confirmer explicitement que le MANEX est présent
          fullAircraft.hasManex = true;

                  } catch (manexError) {
          console.error('⚠️ Erreur lors du téléchargement du MANEX (non-bloquant):', manexError);
          // Ne pas bloquer si le téléchargement du MANEX échoue
          // Ajouter juste les métadonnées
          fullAircraft.manexAvailableInSupabase = {
            fileName: data.manex_files.filename,
            filePath: data.manex_files.file_path,
            fileSize: data.manex_files.file_size
          };
        }
      }

      // Normaliser les unités à l'import
      const normalizedAircraft = normalizeAircraftImport(fullAircraft);

      console.log('📥 [CommunityService] Aircraft imported and normalized:', {
        registration: normalizedAircraft.registration,
        hadMetadata: !!fullAircraft._metadata
      });

      return normalizedAircraft;
    } catch (error) {
      console.error('Erreur lors de la récupération du preset:', error);
      throw error;
    }
  }

  /**
   * Obtenir l'URL de téléchargement d'un MANEX
   * @param {string} filePath
   * @returns {string}
   */
  getManexDownloadUrl(filePath) {
    const { data } = supabase.storage
      .from('manex-files')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Enregistrer un téléchargement
   * @param {string} presetId
   * @param {string} userId
   */
  async recordDownload(presetId, userId = null) {
    try {
      await supabase
        .from('preset_downloads')
        .insert({ preset_id: presetId, user_id: userId });
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du téléchargement:', error);
      // Ne pas bloquer si ça échoue
    }
  }

  /**
   * Voter pour un preset
   * @param {string} presetId
   * @param {string} userId
   * @param {string} voteType - 'up' ou 'down'
   */
  async votePreset(presetId, userId, voteType) {
    try {
      // Vérifier si l'utilisateur a déjà voté
      const { data: existingVote } = await supabase
        .from('preset_votes')
        .select('*')
        .eq('preset_id', presetId)
        .eq('user_id', userId)
        .single();

      if (existingVote) {
        // Mettre à jour le vote existant
        const { error } = await supabase
          .from('preset_votes')
          .update({ vote_type: voteType })
          .eq('id', existingVote.id);

        if (error) throw error;
      } else {
        // Créer un nouveau vote
        const { error } = await supabase
          .from('preset_votes')
          .insert({ preset_id: presetId, user_id: userId, vote_type: voteType });

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Erreur lors du vote:', error);
      throw error;
    }
  }

  /**
   * Récupérer le vote de l'utilisateur pour un preset
   * @param {string} presetId
   * @param {string} userId
   * @returns {Promise<string|null>} 'up', 'down' ou null
   */
  async getUserVote(presetId, userId) {
    try {
      const { data, error } = await supabase
        .from('preset_votes')
        .select('vote_type')
        .eq('preset_id', presetId)
        .eq('user_id', userId)
        .single();

      if (error) return null;
      return data?.vote_type || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Soumettre un nouveau preset (crée OU met à jour)
   * @param {Object} presetData
   * @param {File} manexFile
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async submitPreset(presetData, manexFile, userId) {
    try {
      
      // 1. Vérifier si un preset existe déjà pour cette immatriculation
      const { data: existingPresets, error: searchError } = await supabase
        .from('community_presets')
        .select('id, version')
        .eq('registration', presetData.registration)
        .eq('status', 'active')
        .limit(1);

      if (searchError) {
        console.error('❌ Erreur lors de la recherche de presets existants:', searchError);
        throw searchError;
      }

      // 2. Si le preset existe déjà, faire une mise à jour au lieu d'une création
      if (existingPresets && existingPresets.length > 0) {
        const existingPreset = existingPresets[0];
        console.log('✅ Preset existant trouvé - Mise à jour au lieu de création');

        // Utiliser la méthode updateCommunityPreset existante
        return await this.updateCommunityPreset(
          existingPreset.id,
          presetData.aircraft_data || presetData,
          manexFile,
          manexFile?.name,
          userId
        );
      }

      
      let manexFileId = null;

      // 3. Uploader le MANEX si fourni
      if (manexFile) {
        const filePath = `${presetData.model}/${Date.now()}_${manexFile.name}`;

        // Upload vers Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('manex-files')
          .upload(filePath, manexFile);

        if (uploadError) throw uploadError;

        // Enregistrer les métadonnées du fichier
        const { data: fileData, error: fileError } = await supabase
          .from('manex_files')
          .insert({
            filename: manexFile.name,
            file_path: filePath,
            file_size: manexFile.size,
            uploaded_by: userId,
            aircraft_model: presetData.model
          })
          .select()
          .single();

        if (fileError) throw fileError;

        manexFileId = fileData.id;
      }

      // 4. Préparer aircraft_data SANS les fichiers volumineux (MANEX, photo volumineuse)
      const cleanedData = { ...presetData.aircraft_data || presetData };

      // Supprimer le MANEX (stocké séparément dans Supabase Storage)
      delete cleanedData.manex;

      // Supprimer la photo UNIQUEMENT si elle est volumineuse (>1MB en base64)
      if (cleanedData.photo && typeof cleanedData.photo === 'string') {
        const photoSize = cleanedData.photo.length;

        if (photoSize > 1000000) {
          delete cleanedData.photo;
        }
      }

      // Supprimer les métadonnées de tracking inutiles pour la communauté
      delete cleanedData.baseAircraft;
      delete cleanedData.isImportedFromCommunity;
      delete cleanedData.originalCommunityData;
      delete cleanedData.importDate;

      // 5. Créer le preset
      const { data, error } = await supabase
        .from('community_presets')
        .insert({
          registration: presetData.registration,
          model: presetData.model,
          manufacturer: presetData.manufacturer,
          aircraft_type: presetData.aircraftType || presetData.type,
          category: presetData.category,
          aircraft_data: cleanedData, // Données nettoyées
          submitted_by: userId,
          description: presetData.description || '',
          manex_file_id: manexFileId,
          has_manex: !!manexFile,
          status: 'active' // Ou 'pending' si modération requise
        })
        .select()
        .single();

      if (error) throw error;

            return data;
    } catch (error) {
      console.error('Erreur lors de la soumission du preset:', error);
      throw error;
    }
  }

  /**
   * Uploader un MANEX vers Supabase Storage
   * @param {string} registration - Immatriculation de l'avion
   * @param {File|Blob} manexFile - Fichier MANEX à uploader
   * @returns {Promise<string>} URL publique du fichier uploadé
   */
  async uploadManex(registration, manexFile) {
    try {
      
      // Créer le nom du fichier: [IMMATRICULATION] - manex.pdf
      const fileName = `${registration} - manex.pdf`;
      const filePath = `${registration}/${fileName}`;

      
      // Uploader vers Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('manex-files')
        .upload(filePath, manexFile, {
          cacheControl: '3600',
          upsert: true // Remplacer si existe déjà
        });

      if (uploadError) {
        console.error('❌ Erreur upload:', uploadError);
        throw uploadError;
      }

      
      // Obtenir l'URL publique
      const { data: urlData } = supabase.storage
        .from('manex-files')
        .getPublicUrl(filePath);

      
      return {
        filePath: filePath,
        publicUrl: urlData.publicUrl,
        fileName: fileName
      };
    } catch (error) {
      console.error('❌ Erreur lors de l\'upload du MANEX:', error);
      throw error;
    }
  }

  /**
   * Télécharger le MANEX d'un preset
   * @param {string} filePath
   * @returns {Promise<Blob>}
   */
  async downloadManex(filePath) {
    try {
      
      // Méthode 1: Essayer avec .download() (nécessite authentification)
      try {
        const { data, error } = await supabase.storage
          .from('manex-files')
          .download(filePath);

        if (!error && data) {

          return data;
        }
      } catch (downloadError) {
        // Fallback to public URL
      }

      // Méthode 2: Utiliser l'URL publique (fallback)
      const { data: urlData } = supabase.storage
        .from('manex-files')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Impossible d\'obtenir l\'URL publique du MANEX');
      }

      
      // Télécharger via fetch
      const response = await fetch(urlData.publicUrl);
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status} lors du téléchargement`);
      }

      const blob = await response.blob();
      
      return blob;
    } catch (error) {
      console.error('❌ Erreur lors du téléchargement du MANEX:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour un preset communautaire existant avec les modifications locales
   * @param {string} presetId - ID du preset à mettre à jour
   * @param {Object} updatedData - Données mises à jour
   * @param {File|Blob} manexFile - Fichier MANEX optionnel
   * @param {string} manexFileName - Nom du fichier MANEX
   * @param {string} userId - ID de l'utilisateur effectuant la mise à jour
   * @returns {Promise<Object>}
   */
  async updateCommunityPreset(presetId, updatedData, manexFile = null, manexFileName = null, userId) {
    try {
      
      let manexFileId = null;

      // 1. Uploader le nouveau MANEX si fourni
      if (manexFile) {
        // Utiliser le nom fourni ou un nom par défaut
        const fileName = manexFileName || `${updatedData.registration || 'aircraft'} - manex.pdf`;
        const filePath = `${updatedData.model}/${Date.now()}_${fileName}`;

        // Upload vers Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('manex-files')
          .upload(filePath, manexFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Enregistrer les métadonnées du fichier
        const { data: fileData, error: fileError } = await supabase
          .from('manex_files')
          .insert({
            filename: fileName,
            file_path: filePath,
            file_size: manexFile.size,
            uploaded_by: userId,
            aircraft_model: updatedData.model
          })
          .select()
          .single();

        if (fileError) throw fileError;

        manexFileId = fileData.id;
              }

      // 2. Préparer aircraft_data SANS les fichiers volumineux (MANEX, photo volumineuse)
      const cleanedData = { ...updatedData };

      // Supprimer le MANEX (stocké séparément dans Supabase Storage)
      delete cleanedData.manex;

      // Supprimer la photo UNIQUEMENT si elle est volumineuse (>1MB en base64)
      // Les petites photos sont conservées car elles sont importantes pour l'UI
      if (cleanedData.photo && typeof cleanedData.photo === 'string') {
        const photoSize = cleanedData.photo.length;
        
        // Supprimer uniquement si > 1MB (1,000,000 caractères en base64)
        if (photoSize > 1000000) {
          delete cleanedData.photo;
        }
      }

      // Supprimer les métadonnées de tracking inutiles pour la communauté
      delete cleanedData.baseAircraft;
      delete cleanedData.isImportedFromCommunity;
      delete cleanedData.originalCommunityData;
      delete cleanedData.importDate;

      // 3. Mettre à jour le preset dans Supabase
      const updatePayload = {
        registration: updatedData.registration,
        model: updatedData.model,
        manufacturer: updatedData.manufacturer || 'Inconnu',
        aircraft_type: updatedData.aircraftType || 'Avion',
        category: updatedData.category || 'SEP',
        aircraft_data: cleanedData, // Données SANS MANEX ni fichiers volumineux
        description: updatedData.description || `Configuration ${updatedData.model} - ${updatedData.registration}`,
        version: (updatedData.version || 1) + 1, // Incrémenter la version
        updated_at: new Date().toISOString()
      };

      // 4. Ajouter le manex_file_id seulement si un nouveau MANEX a été uploadé
      if (manexFileId) {
        updatePayload.manex_file_id = manexFileId;
        updatePayload.has_manex = true;
      }

      const { data, error } = await supabase
        .from('community_presets')
        .update(updatePayload)
        .eq('id', presetId)
        .select()
        .single();

      if (error) throw error;

            return data;
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du preset:', error);
      throw error;
    }
  }
}

// Exporter une instance unique
const communityService = new CommunityService();
export default communityService;

// Exporter aussi le client Supabase pour usage avancé
export { supabase };
