// Service pour gérer les points VFR globaux avec Supabase
import { supabase } from './communityService';

/**
 * Service pour gérer les points VFR globaux partagés
 */
class VFRPointsService {
  /**
   * Récupérer tous les points VFR publics depuis Supabase
   * @returns {Promise<Array>}
   */
  async getAllPublicPoints() {
    try {
      

      const { data, error } = await supabase
        .from('vfr_points')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        throw error;
      }

       VFR chargé(s) depuis Supabase`);
      return data;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des points VFR:', error);
      return [];
    }
  }

  /**
   * Uploader un point VFR vers Supabase
   * @param {Object} point - Point VFR à uploader
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>}
   */
  async uploadPoint(point, userId = 'anonymous') {
    try {
      

      const { data, error } = await supabase
        .from('vfr_points')
        .insert({
          name: point.name,
          type: point.type || 'VRP',
          lat: parseFloat(point.lat),
          lon: parseFloat(point.lon),
          altitude: point.altitude ? parseInt(point.altitude) : null,
          description: point.description || '',
          aerodrome: point.aerodrome || null,
          is_public: true,
          uploaded_by: userId,
          downloads_count: 0
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur upload:', error);
        throw error;
      }

      
      return data;
    } catch (error) {
      console.error('❌ Erreur lors de l\'upload:', error);
      throw error;
    }
  }

  /**
   * Uploader plusieurs points VFR en une seule fois
   * @param {Array} points - Points VFR à uploader
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array>}
   */
  async uploadMultiplePoints(points, userId = 'anonymous') {
    try {
       VFR...`);

      const pointsData = points.map(point => ({
        name: point.name,
        type: point.type || 'VRP',
        lat: parseFloat(point.lat),
        lon: parseFloat(point.lon),
        altitude: point.altitude ? parseInt(point.altitude) : null,
        description: point.description || '',
        aerodrome: point.aerodrome || null,
        is_public: true,
        uploaded_by: userId,
        downloads_count: 0
      }));

      const { data, error } = await supabase
        .from('vfr_points')
        .insert(pointsData)
        .select();

      if (error) {
        console.error('❌ Erreur upload multiple:', error);
        throw error;
      }

       VFR uploadé(s)`);
      return data;
    } catch (error) {
      console.error('❌ Erreur lors de l\'upload multiple:', error);
      throw error;
    }
  }

  /**
   * Télécharger tous les points VFR publics et les fusionner avec les points locaux
   * @param {Array} localPoints - Points VFR locaux existants
   * @returns {Promise<Array>}
   */
  async syncWithSupabase(localPoints) {
    try {
      

      const supabasePoints = await this.getAllPublicPoints();

      // Créer une Map des points locaux par nom pour éviter les doublons
      const localPointsMap = new Map(
        localPoints.map(p => [p.name.toLowerCase(), p])

      // Ajouter les points Supabase qui ne sont pas déjà en local
      const newPoints = [];
      for (const point of supabasePoints) {
        if (!localPointsMap.has(point.name.toLowerCase())) {
          newPoints.push({
            id: `vfr-${point.id}`, // Préfixe pour identifier les points Supabase
            name: point.name,
            type: point.type,
            lat: point.lat,
            lon: point.lon,
            altitude: point.altitude,
            description: point.description,
            aerodrome: point.aerodrome,
            fromSupabase: true,
            supabaseId: point.id
          });
        }
      }

       point(s) synchronisé(s)`);
      return newPoints;
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation:', error);
      return [];
    }
  }

  /**
   * Rechercher des points VFR par nom
   * @param {string} searchTerm
   * @returns {Promise<Array>}
   */
  async searchPoints(searchTerm) {
    try {
      const { data, error } = await supabase
        .from('vfr_points')
        .select('*')
        .eq('is_public', true)
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order('downloads_count', { ascending: false });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      throw error;
    }
  }

  /**
   * Enregistrer un téléchargement
   * @param {string} pointId
   */
  async recordDownload(pointId) {
    try {
      await supabase.rpc('increment_vfr_download', { point_id: pointId });
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du téléchargement:', error);
    }
  }

  /**
   * Supprimer un point VFR (seulement si créé par l'utilisateur)
   * @param {string} pointId
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async deletePoint(pointId, userId) {
    try {
      const { error } = await supabase
        .from('vfr_points')
        .delete()
        .eq('id', pointId)
        .eq('uploaded_by', userId);

      if (error) throw error;

      
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
      throw error;
    }
  }

  /**
   * Vérifier si un point existe déjà dans Supabase
   * @param {string} name
   * @param {number} lat
   * @param {number} lon
   * @returns {Promise<boolean>}
   */
  async pointExists(name, lat, lon) {
    try {
      const { data, error } = await supabase
        .from('vfr_points')
        .select('id')
        .eq('name', name)
        .eq('lat', lat)
        .eq('lon', lon)
        .limit(1);

      if (error) throw error;

      return data && data.length > 0;
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      return false;
    }
  }
);}

// Exporter une instance unique
const vfrPointsService = new VFRPointsService();
export default vfrPointsService;
