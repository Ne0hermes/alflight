// src/core/stores/navigationStore.js
// Version avec Zustand pour être cohérent avec aircraft-storage, etc.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCruiseSpeedKt, getFuelConsumptionLph } from '@utils/aircraftPerf';
import { computeRegulatoryReserveMinutes, DEFAULT_FLIGHT_TYPE } from '@core/flightType';
import { computeRouteWindTimes } from '@utils/routeWindTimes';
import { useWindsAloftStore } from '@core/stores/windsAloftStore';

// 🔧 C2 : altitude par défaut d'échantillonnage du vent (cf. useNavigationResults)
const DEFAULT_WIND_ALT_FT = 3000;

// Réassigne les rôles départ/arrivée selon la POSITION après un déplacement :
// premier = 'departure', dernier = 'arrival' ; un ancien départ/arrivée déplacé
// au milieu redevient 'waypoint' (les types spécifiques des points intermédiaires
// — points VFR, etc. — sont conservés). Sans cette normalisation, les
// consommateurs par TYPE (cartes VAC, marqueurs carte, PDF, déroutements)
// divergent des consommateurs par INDEX (labels Départ/Arrivée de la liste).
export const normalizeWaypointRoles = (waypoints) => waypoints.map((wp, i) => {
  const desired = i === 0 ? 'departure' : (i === waypoints.length - 1 ? 'arrival' : null);
  if (desired) {
    return wp.type === desired ? wp : { ...wp, type: desired };
  }
  return (wp.type === 'departure' || wp.type === 'arrival') ? { ...wp, type: 'waypoint' } : wp;
});

// Fonction de calcul des résultats de navigation
const calculateNavigationResults = (waypoints, flightType, selectedAircraft) => {
  if (!selectedAircraft || !waypoints || waypoints.length < 2) {
    return null;
  }

  const validWaypoints = waypoints.filter(wp => wp.lat && wp.lon);
  if (validWaypoints.length < 2) {
    return null;
  }

  let totalDistance = 0;
  const legs = [];

  for (let i = 0; i < validWaypoints.length - 1; i++) {
    const wp1 = validWaypoints[i];
    const wp2 = validWaypoints[i + 1];
    
    const R = 3440.065;
    const dLat = (wp2.lat - wp1.lat) * Math.PI / 180;
    const dLon = (wp2.lon - wp1.lon) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(wp1.lat * Math.PI / 180) * Math.cos(wp2.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    totalDistance += distance;
    
    const y = Math.sin(dLon) * Math.cos(wp2.lat * Math.PI / 180);
    const x = Math.cos(wp1.lat * Math.PI / 180) * Math.sin(wp2.lat * Math.PI / 180) -
              Math.sin(wp1.lat * Math.PI / 180) * Math.cos(wp2.lat * Math.PI / 180) * Math.cos(dLon);
    const heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    
    legs.push({
      from: wp1.name || `WP${i+1}`,
      to: wp2.name || `WP${i+2}`,
      distance: distance,
      heading: Math.round(heading)
    });
  }

  // 🔒 P0 : vitesse/conso via les helpers canoniques (null si absentes du profil
  // avion). On NE fabrique plus 100 kt / 30 L/h. Donnée manquante ⇒ temps /
  // carburant = null (consommateurs fail-closed : useFuelSync n'écrit pas de trip
  // fuel ; l'UI affiche « — »). cf. utils/aircraftPerf (testé).
  const cruiseSpeed = getCruiseSpeedKt(selectedAircraft);
  // 🔧 C2 (Lot 0.4) : temps de vol CORRIGÉ DU VENT (source unique
  // routeWindTimes, même vent que le tableau de nav : manuel > Open-Meteo).
  // Repli TAS si aucun vent en cache (windCorrected: 'none' — le recalcul se
  // fait au prochain changement de route, une fois les vents chargés).
  const windTimes = (cruiseSpeed && totalDistance > 0)
    ? computeRouteWindTimes({
        waypoints: validWaypoints,
        cruiseSpeedKt: cruiseSpeed,
        windProvider: (lat, lon) =>
          useWindsAloftStore.getState().getWindAt(lat, lon, DEFAULT_WIND_ALT_FT, new Date())
      })
    : null;
  const totalTime = windTimes ? Math.round(windTimes.totalTimeMin) : null;
  const fuelConsumption = getFuelConsumptionLph(selectedAircraft);
  const fuelRequired = (fuelConsumption != null && totalTime != null) ? (totalTime / 60) * fuelConsumption : null;

  // 🔒 SSOT : réserve réglementaire via le calculateur canonique unique
  // (@core/flightType). Plus de règle 30/45/+15 dupliquée ici. Conformité
  // EASA NCO.OP.125 (le vol local ne réduit pas le minimum VFR jour).
  const regulationReserveMinutes = computeRegulatoryReserveMinutes(flightType);

  const regulationReserveLiters = fuelConsumption != null ? (regulationReserveMinutes / 60) * fuelConsumption : null;

  return {
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalTime,
    // null préservé (pas de Math.round(null)→0 qui maquillerait l'absence).
    fuelRequired: fuelRequired != null ? Math.round(fuelRequired * 10) / 10 : null,
    regulationReserveMinutes,
    regulationReserveLiters: regulationReserveLiters != null ? Math.round(regulationReserveLiters * 10) / 10 : null,
    cruiseSpeed,
    fuelConsumption,
    // 🔧 C2 : vitesse sol moyenne pondérée + statut de correction du vent —
    // à consommer par la chaîne carburant (trip, tronçons, escales).
    effectiveSpeedKt: windTimes ? Math.round(windTimes.effectiveSpeedKt * 10) / 10 : null,
    windCorrected: windTimes ? windTimes.windCorrected : 'none',
    untenableSegments: windTimes ? windTimes.untenableSegments : 0,
    // Lot 1.0 — tronçons SANS donnée de vent (temps air immobile), à afficher
    noWindSegments: windTimes ? windTimes.noWindSegments : 0,
    segmentCount: windTimes ? windTimes.segmentCount : 0,
    legs
  };
};

// Store Zustand
export const useNavigationStore = create(
  persist(
    (set, get) => ({
      // États
      waypoints: [
        { id: 1, name: '', lat: null, lon: null, type: 'departure' },
        { id: 2, name: '', lat: null, lon: null, type: 'arrival' }
      ],
      
      // Source unique « type de vol » (cf. @core/flightType). Le sélecteur du
      // wizard (Step1) et celui de NavigationModule écrivent tous deux ici.
      flightType: { ...DEFAULT_FLIGHT_TYPE },
      
      flightParams: {
        altitude: 3000,
        speed: 100,
        heading: 0
      },
      
      // Altitudes par segment (clé: "waypointId1-waypointId2")
      segmentAltitudes: {},

      // Actions
      setWaypoints: (waypoints) => set({ waypoints }),
      
      setSegmentAltitude: (segmentId, altitudeData) => {
        set(state => ({
          segmentAltitudes: {
            ...state.segmentAltitudes,
            [segmentId]: altitudeData
          }
        }));
      },
      
      getSegmentAltitude: (segmentId) => {
        const state = get();
        return state.segmentAltitudes[segmentId] || {
          startAlt: state.flightParams.altitude,
          endAlt: state.flightParams.altitude,
          type: 'level'
        };
      },
      
      setFlightType: (flightType) => set({ flightType }),
      
      setFlightParams: (flightParams) => set({ flightParams }),
      
      addWaypoint: () => {
        const newWaypoint = {
          id: Date.now(),
          name: '',
          lat: null,
          lon: null,
          type: 'waypoint'
        };
        set(state => ({ 
          waypoints: [...state.waypoints, newWaypoint] 
        }));
      },
      
      removeWaypoint: (id) => {
        const waypoints = get().waypoints;
        if (waypoints.length > 2) {
          set({ waypoints: waypoints.filter(wp => wp.id !== id) });
        }
      },
      
      updateWaypoint: (id, updates) => {
        set(state => ({
          waypoints: state.waypoints.map(wp =>
            wp.id === id ? { ...wp, ...updates } : wp
          )
        }));
      },
      
      clearRoute: () => {
        set({
          waypoints: [
            { id: Date.now(), name: '', lat: null, lon: null, type: 'departure' },
            { id: Date.now() + 1, name: '', lat: null, lon: null, type: 'arrival' }
          ]
        });
      },

      // Déplacer un waypoint vers le haut
      moveWaypointUp: (id) => {
        const waypoints = get().waypoints;
        const index = waypoints.findIndex(wp => wp.id === id);

        // Ne pas déplacer si c'est le premier (ou id introuvable, index -1)
        if (index <= 0) return;

        const newWaypoints = [...waypoints];
        [newWaypoints[index - 1], newWaypoints[index]] = [newWaypoints[index], newWaypoints[index - 1]];
        set({ waypoints: normalizeWaypointRoles(newWaypoints) });
      },

      // Déplacer un waypoint vers le bas
      moveWaypointDown: (id) => {
        const waypoints = get().waypoints;
        const index = waypoints.findIndex(wp => wp.id === id);

        // Ne pas déplacer si c'est le dernier (ou id introuvable via findIndex)
        if (index < 0 || index >= waypoints.length - 1) return;

        const newWaypoints = [...waypoints];
        [newWaypoints[index], newWaypoints[index + 1]] = [newWaypoints[index + 1], newWaypoints[index]];
        set({ waypoints: normalizeWaypointRoles(newWaypoints) });
      },
      
      // Getter pour les résultats (calculé à la volée)
      getNavigationResults: (selectedAircraft) => {
        const state = get();
        return calculateNavigationResults(state.waypoints, state.flightType, selectedAircraft);
      }
    }),
    {
      name: 'navigation-storage',
      version: 0
    }
  )
);