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
      console.log('Fetching all public VFR points');

      const { data, error } = await supabase
        .from('vfr_points')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        throw error;
      }

      console.log(`${data.length} points VFR chargé(s) depuis Supabase`);

      // DEBUG: Afficher les points avec photos
      const pointsWithPhotos = data.filter(p => p.photo_url);
      console.log(`📸 ${pointsWithPhotos.length} points avec photo:`, pointsWithPhotos.map(p => ({
        name: p.name,
        photo_url: p.photo_url
      })));

      return data;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des points VFR:', error);
      return [];
    }
  }

  /**
   * Uploader une photo vers Supabase Storage
   * @param {File} file - Fichier photo à uploader
   * @param {string} pointName - Nom du point (utilisé pour nommer le fichier)
   * @returns {Promise<string>} - URL publique de la photo
   */
  async uploadPhoto(file, pointName) {
    try {
      console.log('📸 Upload photo:', file.name);

      // Générer un nom de fichier unique
      const timestamp = Date.now();
      const cleanName = pointName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const fileExt = file.name.split('.').pop();
      const fileName = `${cleanName}_${timestamp}.${fileExt}`;

      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from('vfr-points-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('❌ Erreur upload photo:', error);
        throw error;
      }

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('vfr-points-photos')
        .getPublicUrl(fileName);

      console.log('✅ Photo uploadée:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('❌ Erreur lors de l\'upload de la photo:', error);
      throw error;
    }
  }

  /**
   * Uploader un point VFR vers Supabase
   * @param {Object} point - Point VFR à uploader
   * @param {string} userId - ID de l'utilisateur
   * @param {string} photoUrl - URL de la photo (optionnel)
   * @returns {Promise<Object>}
   */
  async uploadPoint(point, userId = 'anonymous', photoUrl = null) {
    try {
      console.log('Uploading VFR point:', point.name);

      const { data, error} = await supabase
        .from('vfr_points')
        .insert({
          name: point.name,
          type: point.type || 'VRP',
          lat: parseFloat(point.lat),
          lon: parseFloat(point.lon),
          altitude: point.altitude ? parseInt(point.altitude) : null,
          description: point.description || '',
          aerodrome: point.aerodrome || null,
          frequency: point.frequency || null,
          airspace: point.airspace || null,
          airspace_class: point.airspaceClass || null,
          country: point.country || 'France',
          aeronautical_remarks: point.aeronauticalRemarks || null,
          photo_url: photoUrl,
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

      console.log('Point uploaded successfully');
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
      console.log(`Uploading ${points.length} VFR points...`);

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

      console.log(`${data.length} points VFR uploadé(s)`);
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
      console.log('Syncing with Supabase...');

      const supabasePoints = await this.getAllPublicPoints();

      // Créer une Map des points locaux par nom pour éviter les doublons
      const localPointsMap = new Map(
        localPoints.map(p => [p.name.toLowerCase(), p])
      );

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

      console.log(`${newPoints.length} new point(s) synchronized`);
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
   * Mettre à jour un point VFR (seulement si créé par l'utilisateur)
   * @param {string} pointId
   * @param {Object} updates
   * @param {string} userId
   * @param {string} photoUrl - URL de la photo (optionnel)
   * @returns {Promise<Object>}
   */
  async updatePoint(pointId, updates, userId, photoUrl = null) {
    try {
      console.log('Updating VFR point:', pointId);

      const updateData = {
        name: updates.name,
        type: updates.type,
        lat: parseFloat(updates.lat),
        lon: parseFloat(updates.lon),
        altitude: updates.altitude ? parseInt(updates.altitude) : null,
        description: updates.description || '',
        aerodrome: updates.aerodrome || null,
        frequency: updates.frequency || null,
        airspace: updates.airspace || null,
        airspace_class: updates.airspaceClass || null,
        country: updates.country || 'France',
        aeronautical_remarks: updates.aeronauticalRemarks || null,
        updated_at: new Date().toISOString()
      };

      // Ajouter photo_url seulement si fournie
      if (photoUrl !== null) {
        updateData.photo_url = photoUrl;
      }

      // Vérifier d'abord si le point existe et qui est le propriétaire
      const { data: existingPoint, error: checkError } = await supabase
        .from('vfr_points')
        .select('id, uploaded_by')
        .eq('id', pointId)
        .single();

      if (checkError || !existingPoint) {
        throw new Error('Point VFR introuvable');
      }

      // MODE DEV: Permettre la modification de tous les points
      // En production, décommenter la vérification ci-dessous
      /*
      if (existingPoint.uploaded_by !== userId) {
        throw new Error('Vous ne pouvez modifier que vos propres points');
      }
      */

      // Mise à jour sans filtrage par uploaded_by (mode dev)
      const { data, error } = await supabase
        .from('vfr_points')
        .update(updateData)
        .eq('id', pointId)
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur update:', error);
        throw error;
      }

      console.log('✅ Point updated successfully');
      return data;
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour:', error);
      throw error;
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
      // MODE DEV: Permettre la suppression de tous les points
      // En production, ajouter .eq('uploaded_by', userId)
      const { error } = await supabase
        .from('vfr_points')
        .delete()
        .eq('id', pointId);

      if (error) throw error;

      console.log('✅ Point deleted successfully');
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
}

// Exporter une instance unique
const vfrPointsService = new VFRPointsService();
export default vfrPointsService;
