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
   * Réserve (prévisualise) le prochain numéro de vol VP-YYYY-NNNN via la fonction DB
   * `generate_validated_pdf_number()`. Best-effort : retourne null si la RPC est
   * indisponible (le trigger DB générera alors le numéro à l'insertion). Permet
   * d'IMPRIMER le numéro sur le PDF AVANT l'upload (audit QA — D1 Document 2).
   * @returns {Promise<string|null>}
   */
  async getNextFlightNumber() {
    try {
      const { data, error } = await supabase.rpc('generate_validated_pdf_number');
      if (error) {
        console.warn('⚠️ [ValidatedPDF] RPC generate_validated_pdf_number indisponible:', error.message);
        return null;
      }
      return typeof data === 'string' && data.trim() ? data.trim() : null;
    } catch (e) {
      console.warn('⚠️ [ValidatedPDF] Exception getNextFlightNumber:', e?.message || e);
      return null;
    }
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

      // Nettoyer le filename (trim, normaliser)
      filename = filename?.trim() || '';

      console.log('📁 [ValidatedPDF] Chemin de stockage:', storagePath);
      console.log('📄 [ValidatedPDF] Filename extrait:', filename);
      console.log('📄 [ValidatedPDF] Filename length:', filename.length);
      console.log('📄 [ValidatedPDF] Filename charCodes:', Array.from(filename).map(c => c.charCodeAt(0)).join(','));
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
      // Construire le trajet complet avec waypoints
      const fullRoute = [
        metadata.departureIcao,
        ...(metadata.waypoints || []),
        metadata.arrivalIcao
      ].filter(Boolean).join('→');

      const pdfMetadata = {
        flight_plan_id: metadata.flightPlanId || null,
        // Numéro réservé côté client et imprimé sur le PDF (audit QA D1). Le trigger DB
        // `auto_set_validated_pdf_number` ne génère que si la valeur est NULL → rétro-compatible.
        flight_number: metadata.flightNumber || null,
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
        full_route: fullRoute, // Trajet complet avec waypoints
        validation_timestamp: new Date().toISOString(),
        version: '1.0',
        notes: metadata.notes || null,
        tags: metadata.tags || []
      };

      console.log('💾 [ValidatedPDF] Métadonnées à insérer:', JSON.stringify(pdfMetadata, null, 2));
      console.log('📄 [ValidatedPDF] pdf_filename dans metadata:', pdfMetadata.pdf_filename);
      console.log('✅ [ValidatedPDF] pdf_filename non vide:', !!pdfMetadata.pdf_filename);
      console.log('✅ [ValidatedPDF] pdf_filename se termine par .pdf:', pdfMetadata.pdf_filename?.endsWith('.pdf'));

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
