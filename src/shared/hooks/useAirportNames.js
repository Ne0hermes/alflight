// src/shared/hooks/useAirportNames.js
// ----------------------------------------------------------------------------
// Accès aux NOMS d'aérodromes depuis la SOURCE UNIQUE (provider GeoJSON/SIA),
// via le store useOpenAIPStore. Remplace le hardcodé src/data/airportNames.js.
//
// ⚠️ Ne crée AUCUNE source parallèle : ce sont de simples sélecteurs par-dessus
// le store (qui charge déjà `airports` via aeroDataProvider). Le store est
// préchargé au démarrage (cf. main.jsx → loadAirports()).
// ----------------------------------------------------------------------------
import { useMemo } from 'react';
import { useOpenAIPStore } from '@core/stores/openAIPStore';

// Particules françaises laissées en minuscule (sauf en tête de chaîne).
const PARTICLES = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'sur', 'en', 'et', 'aux', 'd', 'l']);

/**
 * Convertit un nom AIXM (MAJUSCULES) en casse de titre française.
 * "PARIS CHARLES DE GAULLE" -> "Paris Charles de Gaulle"
 * "TOULOUSE-FRANCAZAL"      -> "Toulouse-Francazal"
 * @param {string} str
 * @returns {string}
 */
export function toTitleCaseFr(str) {
  if (!str || typeof str !== 'string') return str || '';
  return str
    .toLowerCase()
    .split(/([\s\-']+)/) // garde les séparateurs (espace, tiret, apostrophe)
    .map((tok, i) => {
      if (tok === '' || /^[\s\-']+$/.test(tok)) return tok;
      if (i > 0 && PARTICLES.has(tok)) return tok; // particule (jamais en tête)
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    })
    .join('');
}

/**
 * Nom usuel (casse de titre) d'un aérodrome par code ICAO.
 * @param {string} icao
 * @returns {string|null} nom, ou null si inconnu / pas encore chargé
 */
export function useAirportName(icao) {
  const rawName = useOpenAIPStore((s) =>
    icao ? s.airports.find((a) => a.icao === icao)?.name : undefined
  );
  return rawName ? toTitleCaseFr(rawName) : null;
}

/**
 * Variante NON-HOOK : nom usuel par ICAO, pour les contextes hors-React
 * (parsing, callbacks, boucles). Lit le store déjà préchargé (snapshot, non réactif).
 * @param {string} icao
 * @returns {string|null}
 */
export function getAirportNameSync(icao) {
  if (!icao) return null;
  const airport = useOpenAIPStore.getState().airports.find((a) => a.icao === icao);
  return airport?.name ? toTitleCaseFr(airport.name) : null;
}

/**
 * NON-HOOK : élévation (ft) d'un aérodrome par ICAO, depuis le store préchargé.
 * Remplace airportDataService.getAirportElevation (source unique = SIA/GeoJSON).
 * @param {string} icao
 * @returns {number} élévation en pieds, ou 0 si inconnu
 */
export function getAirportElevationSync(icao) {
  if (!icao) return 0;
  const a = useOpenAIPStore.getState().airports.find((x) => x.icao === icao.toUpperCase());
  return Math.round(a?.elevation || 0);
}

/**
 * NON-HOOK : infos d'un aérodrome par ICAO (shape compatible airportDataService.getAirportInfo).
 * @param {string} icao
 * @returns {{icao,name,city,latitude,longitude,elevation,type,runways}|null}
 */
export function getAirportInfoSync(icao) {
  if (!icao) return null;
  const a = useOpenAIPStore.getState().airports.find((x) => x.icao === icao.toUpperCase());
  if (!a) return null;
  return {
    icao: a.icao,
    name: a.name,
    city: a.city,
    latitude: a.coordinates?.lat,
    longitude: a.coordinates?.lon,
    elevation: Math.round(a.elevation || 0),
    type: a.type,
    runways: a.runways || [],
  };
}

/**
 * Liste { icao, name } triée par nom (FR), pour les dropdowns/catalogues.
 * @returns {Array<{icao: string, name: string}>}
 */
export function useAirportsList() {
  const airports = useOpenAIPStore((s) => s.airports);
  return useMemo(
    () =>
      airports
        .filter((a) => a.icao)
        .map((a) => ({ icao: a.icao, name: toTitleCaseFr(a.name || a.icao) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [airports]
  );
}
