// src/services/validatedPdfService.js
import { supabase } from '../lib/supabaseClient';

/**
 * Service pour gérer les PDFs de plans de vol validés dans Supabase
 */
export const validatedPdfService = {
  /**
   * Génère un chemin de stockage unique pour le PDF
   * @param {string} registration - Immatriculation de l'avion
   * @param {string} departureIcao - Code ICAO départ
   * @param {string} arrivalIcao - Code ICAO arrivée
   * @param {Date|string} flightDate - Date du vol
   * @returns {string} - Chemin de stockage (ex: 2024/01/F-HSTR-LFST-LFGA-20240115-123456789.pdf)
   */
  generatePdfPath(registration, departureIcao, arrivalIcao, flightDate) {
    const date = new Date(flightDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const timestamp = Date.now();

    const filename = [
      (registration || 'UNKNOWN').toUpperCase(),
      (departureIcao || 'XXXX').toUpperCase(),
      (arrivalIcao || 'XXXX').toUpperCase(),
      dateStr,
      timestamp
    ].join('-') + '.pdf';

    return `${year}/${month}/${filename}`;
  },

  /**
   * Upload un PDF dans le bucket Supabase et sauvegarde les métadonnées
   * @param {Blob} pdfBlob - Le blob du PDF à uploader
   * @param {Object} metadata - Métadonnées du vol
   * @returns {Promise<{success: boolean, data: any, error: any}>}
   */
  async uploadValidatedPdf(pdfBlob, metadata) {
    try {
      console.log('📤 [ValidatedPDF] Début upload PDF:', {
        pilotName: metadata.pilotName,
        flightDate: metadata.flightDate,
        departure: metadata.departureIcao,
        arrival: metadata.arrivalIcao
      });

      // Générer le chemin de stockage
      const storagePath = this.generatePdfPath(
        metadata.aircraftRegistration,
        metadata.departureIcao,
        metadata.arrivalIcao,
        metadata.flightDate
      );

      let filename = storagePath.split('/').pop();

      console.log('📁 [ValidatedPDF] Chemin de stockage:', storagePath);
      console.log('📄 [ValidatedPDF] Filename extrait:', filename);
      console.log('✅ [ValidatedPDF] Filename valide (.pdf):', filename?.endsWith('.pdf'));

      // Vérification et correction du filename si nécessaire
      if (!filename || !filename.endsWith('.pdf')) {
        console.warn('⚠️ [ValidatedPDF] Filename invalide, génération d\'un nom par défaut');
        const timestamp = Date.now();
        filename = `flight-plan-${metadata.aircraftRegistration || 'UNKNOWN'}-${timestamp}.pdf`;
        console.log('📄 [ValidatedPDF] Nouveau filename:', filename);
      }

      // 1. Upload du PDF dans le bucket storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('flight-plan-pdfs')
        .upload(storagePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: false // Ne pas écraser si existe déjà
        });

      if (uploadError) {
        console.error('❌ [ValidatedPDF] Erreur upload PDF:', uploadError);
        return { success: false, data: null, error: uploadError };
      }

      console.log('✅ [ValidatedPDF] PDF uploadé avec succès:', uploadData.path);

      // 2. Sauvegarder les métadonnées dans la table
      const pdfMetadata = {
        flight_plan_id: metadata.flightPlanId || null,
        pdf_filename: filename,
        pdf_storage_path: storagePath,
        pdf_size_bytes: pdfBlob.size,
        pilot_name: metadata.pilotName,
        flight_date: new Date(metadata.flightDate).toISOString().split('T')[0],
        callsign: metadata.callsign || null,
        aircraft_registration: metadata.aircraftRegistration || null,
        aircraft_type: metadata.aircraftType || null,
        departure_icao: metadata.departureIcao || null,
        departure_name: metadata.departureName || null,
        arrival_icao: metadata.arrivalIcao || null,
        arrival_name: metadata.arrivalName || null,
        validation_timestamp: new Date().toISOString(),
        version: '1.0',
        notes: metadata.notes || null,
        tags: metadata.tags || []
      };

      const { data: insertData, error: insertError } = await supabase
        .from('validated_flight_pdfs')
        .insert([pdfMetadata])
        .select()
        .single();

      if (insertError) {
        console.error('❌ [ValidatedPDF] Erreur sauvegarde métadonnées:', insertError);
        // Tenter de supprimer le PDF uploadé si l'insertion échoue
        await supabase.storage
          .from('flight-plan-pdfs')
          .remove([storagePath]);
        return { success: false, data: null, error: insertError };
      }

      console.log('✅ [ValidatedPDF] Métadonnées sauvegardées avec succès:', insertData.id);

      return {
        success: true,
        data: {
          ...insertData,
          pdfUrl: this.getPdfPublicUrl(storagePath)
        },
        error: null
      };

    } catch (error) {
      console.error('❌ [ValidatedPDF] Exception lors de l\'upload:', error);
      return { success: false, data: null, error };
    }
  },

  /**
   * Récupère l'URL publique d'un PDF
   * @param {string} storagePath - Chemin du PDF dans le bucket
   * @returns {string} - URL publique du PDF
   */
  getPdfPublicUrl(storagePath) {
    const { data } = supabase.storage
      .from('flight-plan-pdfs')
      .getPublicUrl(storagePath);
    return data.publicUrl;
  },

  /**
   * Récupère l'URL signée (privée) d'un PDF avec expiration
   * @param {string} storagePath - Chemin du PDF dans le bucket
   * @param {number} expiresIn - Durée de validité en secondes (défaut: 3600 = 1h)
   * @returns {Promise<string|null>} - URL signée ou null
   */
  async getPdfSignedUrl(storagePath, expiresIn = 3600) {
    try {
      const { data, error } = await supabase.storage
        .from('flight-plan-pdfs')
        .createSignedUrl(storagePath, expiresIn);

      if (error) {
        console.error('❌ [ValidatedPDF] Erreur génération URL signée:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('❌ [ValidatedPDF] Exception génération URL signée:', error);
      return null;
    }
  },

  /**
   * Récupère tous les PDFs validés
   * @param {number} limit - Nombre maximum de résultats
   * @returns {Promise<Array>}
   */
  async getAllValidatedPdfs(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('validated_flight_pdfs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ [ValidatedPDF] Erreur récupération PDFs:', error);
        return [];
      }

      console.log(`✅ [ValidatedPDF] ${data.length} PDFs récupérés`);
      return data;

    } catch (error) {
      console.error('❌ [ValidatedPDF] Exception récupération PDFs:', error);
      return [];
    }
  },

  /**
   * Récupère un PDF validé par ID
   * @param {string} id - UUID du PDF
   * @returns {Promise<Object|null>}
   */
  async getValidatedPdfById(id) {
    try {
      const { data, error } = await supabase
        .from('validated_flight_pdfs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ [ValidatedPDF] Erreur récupération PDF:', error);
        return null;
      }

      console.log('✅ [ValidatedPDF] PDF récupéré:', data.id);
      return data;

    } catch (error) {
      console.error('❌ [ValidatedPDF] Exception récupération PDF:', error);
      return null;
    }
  },

  /**
   * Recherche des PDFs validés par critères
   * @param {Object} filters - Filtres de recherche
   * @returns {Promise<Array>}
   */
  async searchValidatedPdfs(filters = {}) {
    try {
      let query = supabase
        .from('validated_flight_pdfs')
        .select('*');

      // Appliquer les filtres
      if (filters.pilotName) {
        query = query.ilike('pilot_name', `%${filters.pilotName}%`);
      }
      if (filters.callsign) {
        query = query.ilike('callsign', `%${filters.callsign}%`);
      }
      if (filters.registration) {
        query = query.eq('aircraft_registration', filters.registration);
      }
      if (filters.departureIcao) {
        query = query.eq('departure_icao', filters.departureIcao);
      }
      if (filters.arrivalIcao) {
        query = query.eq('arrival_icao', filters.arrivalIcao);
      }
      if (filters.fromDate) {
        query = query.gte('flight_date', filters.fromDate);
      }
      if (filters.toDate) {
        query = query.lte('flight_date', filters.toDate);
      }
      if (filters.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('❌ [ValidatedPDF] Erreur recherche PDFs:', error);
        return [];
      }

      console.log(`✅ [ValidatedPDF] ${data.length} PDFs trouvés`);
      return data;

    } catch (error) {
      console.error('❌ [ValidatedPDF] Exception recherche PDFs:', error);
      return [];
    }
  },

  /**
   * Récupère les PDFs par nom de pilote
   * @param {string} pilotName - Nom du pilote
   * @param {number} limit - Nombre maximum de résultats
   * @returns {Promise<Array>}
   */
  async getPdfsByPilot(pilotName, limit = 50) {
    return this.searchValidatedPdfs({ pilotName, limit });
  },

  /**
   * Récupère les PDFs par date
   * @param {string} date - Date du vol (format YYYY-MM-DD)
   * @returns {Promise<Array>}
   */
  async getPdfsByDate(date) {
    return this.searchValidatedPdfs({ fromDate: date, toDate: date });
  },

  /**
   * Supprime un PDF validé (métadonnées + fichier storage)
   * @param {string} id - UUID du PDF
   * @returns {Promise<{success: boolean, error: any}>}
   */
  async deleteValidatedPdf(id) {
    try {
      // 1. Récupérer les métadonnées pour obtenir le storage_path
      const pdfMetadata = await this.getValidatedPdfById(id);
      if (!pdfMetadata) {
        return { success: false, error: 'PDF non trouvé' };
      }

      // 2. Supprimer le fichier du storage
      const { error: storageError } = await supabase.storage
        .from('flight-plan-pdfs')
        .remove([pdfMetadata.pdf_storage_path]);

      if (storageError) {
        console.error('❌ [ValidatedPDF] Erreur suppression fichier storage:', storageError);
        // Continuer quand même pour supprimer les métadonnées
      }

      // 3. Supprimer les métadonnées de la table
      const { error: deleteError } = await supabase
        .from('validated_flight_pdfs')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('❌ [ValidatedPDF] Erreur suppression métadonnées:', deleteError);
        return { success: false, error: deleteError };
      }

      console.log('✅ [ValidatedPDF] PDF supprimé avec succès:', id);
      return { success: true, error: null };

    } catch (error) {
      console.error('❌ [ValidatedPDF] Exception lors de la suppression:', error);
      return { success: false, error };
    }
  },

  /**
   * Met à jour les notes d'un PDF validé
   * @param {string} id - UUID du PDF
   * @param {string} notes - Nouvelles notes
   * @returns {Promise<{success: boolean, data: any, error: any}>}
   */
  async updatePdfNotes(id, notes) {
    try {
      const { data, error } = await supabase
        .from('validated_flight_pdfs')
        .update({ notes })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ [ValidatedPDF] Erreur mise à jour notes:', error);
        return { success: false, data: null, error };
      }

      console.log('✅ [ValidatedPDF] Notes mises à jour:', id);
      return { success: true, data, error: null };

    } catch (error) {
      console.error('❌ [ValidatedPDF] Exception mise à jour notes:', error);
      return { success: false, data: null, error };
    }
  },

  /**
   * Met à jour les tags d'un PDF validé
   * @param {string} id - UUID du PDF
   * @param {Array<string>} tags - Nouveaux tags
   * @returns {Promise<{success: boolean, data: any, error: any}>}
   */
  async updatePdfTags(id, tags) {
    try {
      const { data, error } = await supabase
        .from('validated_flight_pdfs')
        .update({ tags })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ [ValidatedPDF] Erreur mise à jour tags:', error);
        return { success: false, data: null, error };
      }

      console.log('✅ [ValidatedPDF] Tags mis à jour:', id);
      return { success: true, data, error: null };

    } catch (error) {
      console.error('❌ [ValidatedPDF] Exception mise à jour tags:', error);
      return { success: false, data: null, error };
    }
  },

  /**
   * Récupère les statistiques des PDFs
   * @returns {Promise<Object|null>}
   */
  async getStatistics() {
    try {
      const { data, error } = await supabase
        .from('validated_pdfs_stats')
        .select('*');

      if (error) {
        console.error('❌ [ValidatedPDF] Erreur récupération statistiques:', error);
        return null;
      }

      console.log('✅ [ValidatedPDF] Statistiques récupérées');
      return data;

    } catch (error) {
      console.error('❌ [ValidatedPDF] Exception récupération statistiques:', error);
      return null;
    }
  }
};

export default validatedPdfService;
