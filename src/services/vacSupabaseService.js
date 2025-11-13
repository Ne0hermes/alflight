// src/services/vacSupabaseService.js
import { supabase } from '../lib/supabaseClient';

/**
 * Service Supabase pour la gestion automatisée des cartes VAC
 * Permet l'upload, le téléchargement et la synchronisation des cartes VAC
 */

const BUCKET_NAME = 'vac-charts';

export const vacSupabaseService = {
  /**
   * Uploader une carte VAC vers Supabase Storage
   * @param {string} icao - Code ICAO de l'aérodrome
   * @param {File} file - Fichier à uploader
   * @param {Object} metadata - Métadonnées de la carte
   * @returns {Promise<Object>} - Résultat de l'upload
   */
  async uploadVACChart(icao, file, metadata = {}) {
    try {
      const upperIcao = icao.toUpperCase();

      // 1. Uploader le fichier vers Supabase Storage
      const filePath = `${upperIcao}/${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true // Remplacer si existe déjà
        });

      if (uploadError) {
        throw new Error(`Erreur upload fichier: ${uploadError.message}`);
      }

      console.log('✅ Fichier uploadé vers Supabase:', uploadData);

      // 2. Obtenir l'URL publique du fichier
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      if (!urlData) {
        throw new Error('Erreur récupération URL publique');
      }

      const publicUrl = urlData.publicUrl;

      // 3. Calculer le checksum MD5 du fichier
      const md5Checksum = await this._calculateMD5(file);

      // 4. Insérer les métadonnées dans la table vac_charts
      const chartData = {
        icao: upperIcao,
        aerodrome_name: metadata.aerodromeName || upperIcao,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        checksum_md5: md5Checksum,
        chart_type: metadata.chartType || 'VAC',
        effective_date: metadata.effectiveDate || null,
        expiration_date: metadata.expirationDate || null,
        airac_cycle: metadata.airacCycle || null,
        source: metadata.source || 'manual',
        download_url: publicUrl,
        uploaded_by: metadata.uploadedBy || 'anonymous',
        notes: metadata.notes || null
      };

      const { data: insertData, error: insertError } = await supabase
        .from('vac_charts')
        .upsert(chartData, {
          onConflict: 'icao',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Erreur insertion métadonnées:', insertError);
        throw new Error(`Erreur sauvegarde métadonnées: ${insertError.message}`);
      }

      console.log('✅ Métadonnées sauvegardées dans Supabase:', insertData);

      return {
        success: true,
        chart: insertData,
        publicUrl
      };
    } catch (error) {
      console.error('❌ Erreur uploadVACChart:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Télécharger une carte VAC depuis Supabase
   * @param {string} icao - Code ICAO de l'aérodrome
   * @returns {Promise<Object>} - Données de la carte
   */
  async downloadVACChart(icao) {
    try {
      const upperIcao = icao.toUpperCase();

      // 1. Récupérer les métadonnées depuis la table
      const { data: chartData, error: chartError } = await supabase
        .from('vac_charts')
        .select('*')
        .eq('icao', upperIcao)
        .eq('status', 'active')
        .single();

      if (chartError || !chartData) {
        return {
          success: false,
          error: 'Aucune carte VAC trouvée pour cet aérodrome'
        };
      }

      // 2. Logger le téléchargement
      await this._logDownload(chartData.id);

      // 3. Retourner l'URL publique et les métadonnées
      return {
        success: true,
        chart: chartData,
        publicUrl: chartData.download_url
      };
    } catch (error) {
      console.error('❌ Erreur downloadVACChart:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Récupérer toutes les cartes VAC disponibles
   * @param {Object} filters - Filtres optionnels
   * @returns {Promise<Array>} - Liste des cartes VAC
   */
  async getAllVACCharts(filters = {}) {
    try {
      let query = supabase
        .from('vac_charts_active')
        .select('*');

      // Appliquer les filtres
      if (filters.icao) {
        query = query.ilike('icao', `%${filters.icao}%`);
      }

      if (filters.validOnly) {
        query = query.eq('validity_status', 'valid');
      }

      if (filters.verifiedOnly) {
        query = query.or('verified.eq.true,admin_verified.eq.true');
      }

      const { data, error } = await query.order('icao', { ascending: true });

      if (error) {
        throw new Error(`Erreur récupération cartes VAC: ${error.message}`);
      }

      return {
        success: true,
        charts: data || []
      };
    } catch (error) {
      console.error('❌ Erreur getAllVACCharts:', error);
      return {
        success: false,
        error: error.message,
        charts: []
      };
    }
  },

  /**
   * Vérifier si une carte VAC existe pour un aérodrome
   * @param {string} icao - Code ICAO
   * @returns {Promise<Boolean>}
   */
  async hasVACChart(icao) {
    try {
      const upperIcao = icao.toUpperCase();

      const { data, error } = await supabase
        .from('vac_charts')
        .select('id')
        .eq('icao', upperIcao)
        .eq('status', 'active')
        .single();

      return !error && data !== null;
    } catch (error) {
      console.error('❌ Erreur hasVACChart:', error);
      return false;
    }
  },

  /**
   * Supprimer une carte VAC
   * @param {string} icao - Code ICAO
   * @returns {Promise<Object>}
   */
  async deleteVACChart(icao) {
    try {
      const upperIcao = icao.toUpperCase();

      // 1. Récupérer le chemin du fichier
      const { data: chartData } = await supabase
        .from('vac_charts')
        .select('file_path')
        .eq('icao', upperIcao)
        .single();

      if (!chartData) {
        throw new Error('Carte VAC non trouvée');
      }

      // 2. Supprimer le fichier du storage
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([chartData.file_path]);

      if (storageError) {
        console.warn('⚠️ Erreur suppression fichier storage:', storageError);
      }

      // 3. Marquer comme archivé (soft delete)
      const { error: updateError } = await supabase
        .from('vac_charts')
        .update({ status: 'archived' })
        .eq('icao', upperIcao);

      if (updateError) {
        throw new Error(`Erreur suppression carte: ${updateError.message}`);
      }

      return {
        success: true,
        message: 'Carte VAC supprimée avec succès'
      };
    } catch (error) {
      console.error('❌ Erreur deleteVACChart:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Logger un téléchargement (interne)
   * @private
   */
  async _logDownload(chartId, userId = null) {
    try {
      await supabase
        .from('vac_download_history')
        .insert({
          chart_id: chartId,
          user_id: userId
        });
    } catch (error) {
      console.warn('⚠️ Erreur log téléchargement:', error);
    }
  },

  /**
   * Calculer le checksum MD5 d'un fichier (interne)
   * @private
   */
  async _calculateMD5(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('MD5', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.warn('⚠️ Erreur calcul MD5, utilisation fallback:', error);
      // Fallback: utiliser la taille + nom + date comme pseudo-checksum
      return `${file.size}-${file.name}-${Date.now()}`.substring(0, 32);
    }
  },

  /**
   * Archiver automatiquement les cartes VAC expirées
   * @returns {Promise<Object>}
   */
  async archiveExpiredCharts() {
    try {
      const { data, error } = await supabase.rpc('archive_expired_vac_charts');

      if (error) {
        throw new Error(`Erreur archivage: ${error.message}`);
      }

      return {
        success: true,
        archivedCount: data || 0
      };
    } catch (error) {
      console.error('❌ Erreur archiveExpiredCharts:', error);
      return {
        success: false,
        error: error.message,
        archivedCount: 0
      };
    }
  }
};

export default vacSupabaseService;
