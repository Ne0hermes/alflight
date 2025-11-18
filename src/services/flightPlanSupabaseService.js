// src/services/flightPlanSupabaseService.js
import { supabase } from '../lib/supabaseClient';

/**
 * Service pour sauvegarder et récupérer les plans de vol depuis Supabase
 */
export const flightPlanSupabaseService = {
  /**
   * Sauvegarde un plan de vol complété dans Supabase
   * @param {FlightPlanData} flightPlan - Instance du plan de vol
   * @param {Array} waypoints - Waypoints de navigation avec toutes les données
   * @param {Object} segmentAltitudes - Altitudes par segment
   * @param {Object} navigationResults - Résultats de navigation calculés
   * @param {string} pilotName - Nom du pilote
   * @returns {Promise<{success: boolean, data: any, error: any}>}
   */
  async saveFlightPlan(flightPlan, waypoints = [], segmentAltitudes = {}, navigationResults = null, pilotName = '') {
    try {
      console.log('💾 [Supabase] Début sauvegarde flight plan:', {
        callsign: flightPlan.generalInfo.callsign,
        departure: flightPlan.route.departure.icao,
        arrival: flightPlan.route.arrival.icao,
        waypointsCount: waypoints.length
      });

      // Préparer les données pour Supabase
      const flightPlanData = {
        completed_at: new Date().toISOString(),

        // Informations générales
        callsign: flightPlan.generalInfo.callsign || null,
        flight_type: flightPlan.generalInfo.flightType,
        day_night: flightPlan.generalInfo.dayNight,
        flight_nature: flightPlan.generalInfo.flightNature,
        flight_date: flightPlan.generalInfo.date ? new Date(flightPlan.generalInfo.date).toISOString().split('T')[0] : null,

        // Aéronef
        aircraft_registration: flightPlan.aircraft.registration,
        aircraft_type: flightPlan.aircraft.type || null,
        aircraft_model: flightPlan.aircraft.model || null,

        // Route
        departure_icao: flightPlan.route.departure.icao,
        departure_name: flightPlan.route.departure.name || null,
        departure_coordinates: flightPlan.route.departure.coordinates || null,
        arrival_icao: flightPlan.route.arrival.icao,
        arrival_name: flightPlan.route.arrival.name || null,
        arrival_coordinates: flightPlan.route.arrival.coordinates || null,
        total_distance: navigationResults?.totalDistance || flightPlan.route.distance || null,
        estimated_time: navigationResults?.totalTime || flightPlan.route.estimatedTime || null,

        // Navigation complète avec altitudes
        navigation_waypoints: waypoints.map(wp => ({
          name: wp.name || wp.icao,
          icao: wp.icao || null,
          type: wp.type,
          lat: wp.lat,
          lon: wp.lon,
          elevation: wp.elevation || null,
          frequency: wp.frequency || null,
          // Altitude assignée pour ce waypoint
          altitude: segmentAltitudes?.[waypoints.indexOf(wp)] || null
        })),
        segment_altitudes: segmentAltitudes || null,

        // Déroutements
        alternates: flightPlan.alternates || [],

        // Météo
        weather_data: {
          departure: flightPlan.weather.departure || {},
          arrival: flightPlan.weather.arrival || {},
          alternates: flightPlan.weather.alternates || [],
          notamsChecked: flightPlan.weather.notamsChecked,
          weatherAcceptable: flightPlan.weather.weatherAcceptable
        },

        // Carburant
        fuel_total_required: flightPlan.fuel.total || 0,
        fuel_confirmed: flightPlan.fuel.confirmed || 0,
        fuel_breakdown: {
          taxi: flightPlan.fuel.taxi || 0,
          climb: flightPlan.fuel.climb || 0,
          cruise: flightPlan.fuel.cruise || 0,
          alternate: flightPlan.fuel.alternate || 0,
          reserve: flightPlan.fuel.reserve || 0,
          contingency: flightPlan.fuel.contingency || 0
        },

        // Masse et centrage
        weight_balance: flightPlan.weightBalance || {},

        // Performances
        performance_data: flightPlan.performance || {},

        // TOD
        tod_parameters: flightPlan.todParameters || {},

        // Backup complet
        full_flight_plan: flightPlan.toJSON(),

        // Métadonnées
        version: flightPlan.metadata?.version || '1.0',
        pilot_name: pilotName || null,
        notes: null
      };

      // Insertion dans Supabase
      const { data, error } = await supabase
        .from('flight_plans')
        .insert([flightPlanData])
        .select()
        .single();

      if (error) {
        console.error('❌ [Supabase] Erreur sauvegarde:', error);
        return { success: false, data: null, error };
      }

      console.log('✅ [Supabase] Flight plan sauvegardé avec succès:', data.id);
      return { success: true, data, error: null };

    } catch (error) {
      console.error('❌ [Supabase] Exception lors de la sauvegarde:', error);
      return { success: false, data: null, error };
    }
  },

  /**
   * Récupère tous les plans de vol
   * @param {number} limit - Nombre maximum de résultats
   * @returns {Promise<Array>}
   */
  async getAllFlightPlans(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('flight_plans')
        .select('*')
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ [Supabase] Erreur récupération flight plans:', error);
        return [];
      }

      console.log(`✅ [Supabase] ${data.length} flight plans récupérés`);
      return data;

    } catch (error) {
      console.error('❌ [Supabase] Exception récupération flight plans:', error);
      return [];
    }
  },

  /**
   * Récupère un plan de vol par ID
   * @param {string} id - UUID du plan de vol
   * @returns {Promise<Object|null>}
   */
  async getFlightPlanById(id) {
    try {
      const { data, error } = await supabase
        .from('flight_plans')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ [Supabase] Erreur récupération flight plan:', error);
        return null;
      }

      console.log('✅ [Supabase] Flight plan récupéré:', data.id);
      return data;

    } catch (error) {
      console.error('❌ [Supabase] Exception récupération flight plan:', error);
      return null;
    }
  },

  /**
   * Recherche des plans de vol par critères
   * @param {Object} filters - Filtres de recherche
   * @returns {Promise<Array>}
   */
  async searchFlightPlans(filters = {}) {
    try {
      let query = supabase
        .from('flight_plans')
        .select('*');

      // Appliquer les filtres
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

      query = query.order('completed_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('❌ [Supabase] Erreur recherche flight plans:', error);
        return [];
      }

      console.log(`✅ [Supabase] ${data.length} flight plans trouvés`);
      return data;

    } catch (error) {
      console.error('❌ [Supabase] Exception recherche flight plans:', error);
      return [];
    }
  }
};

export default flightPlanSupabaseService;
