// src/services/weatherAPI.js

/**
 * Service API Météo — 🔧 LOT 6-C : NOAA aviationweather.gov EN PREMIER
 * (gratuit, SANS CLÉ, CORS ouvert, couverture mondiale dont LFxx), AVWX en
 * SECOURS (clé inlinée au build : absente/rotée = échec systématique).
 * Le contrat de sortie { raw, decoded } est IDENTIQUE quel que soit la source —
 * tout l'aval (weatherStore, PerformanceModule, useActiveRunwayWind, synthèse)
 * traverse sans modification. Règle A5 : jamais de météo fabriquée (null).
 */

// Configuration AVWX
const AVWX_CONFIG = {
  // 🔒 SEC-001 : clé lue UNIQUEMENT depuis l'environnement (.env.local). Le
  // littéral en dur a été retiré du code. ⚠️ Limites : le préfixe VITE_ inline
  // quand même la valeur dans le bundle au build → la vraie correction (proxy
  // serveur) relève du chantier Zero-Trust. Et cette clé ayant été commitée,
  // elle DOIT être rotée côté AVWX.
  apiKey: import.meta.env.VITE_AVWX_API_KEY,
  baseUrl: 'https://avwx.rest/api'
};

// 🐛 FIX CORS (16/08) : aviationweather.gov ne renvoie PAS d'en-tête
// Access-Control-Allow-Origin — l'appel DIRECT depuis le navigateur était
// bloqué (« blocked by CORS policy »), donc plus aucun METAR/TAF ne remontait
// de la source primaire. On passe par un relais serveur (api/noaa.js, edge
// Vercel) : un appel serveur→serveur n'est pas soumis à la politique CORS.
// En développement, /api est proxifié vers le serveur local (vite.config) ;
// s'il n'est pas lancé, NOAA échoue proprement et AVWX prend le relais —
// jamais de météo fabriquée (règle A5).
const NOAA_PROXY = '/api/noaa';

/**
 * Mappe un METAR NOAA vers le contrat `decoded` EXACT d'AVWX (voir plus bas).
 * Pièges d'unités NOAA gérés : obsTime en epoch SECONDES, visibilité en
 * STATUTE MILES (ou string "10+"), plafonds nuageux DÉJÀ en pieds (pas de
 * ×100 contrairement à AVWX), wdir peut être "VRB" ou 0 (calme).
 * Exportée pour les tests.
 */
export function mapNoaaMetar(m, icao) {
  if (!m || !m.rawOb) return null;

  // Visibilité : statute miles → mètres, convention européenne 9999 conservée
  let visibility = 9999;
  const sm = parseFloat(String(m.visib));
  if (Number.isFinite(sm)) {
    visibility = sm >= 6 ? 9999 : Math.round(sm * 1609.34);
  }

  const speed = Number.isFinite(m.wspd) ? m.wspd : 0;
  const direction = (typeof m.wdir === 'number' && m.wdir > 0)
    ? m.wdir
    : (speed === 0 ? 'Calme' : 'Variable'); // "VRB"/0 → même sémantique qu'AVWX

  return {
    raw: m.rawOb,
    source: 'noaa',
    decoded: {
      station: m.icaoId || icao,
      time: Number.isFinite(m.obsTime) ? new Date(m.obsTime * 1000).toISOString() : null,
      wind: {
        direction,
        speed,
        gust: Number.isFinite(m.wgst) ? m.wgst : null
      },
      visibility,
      clouds: (m.clouds || [])
        .filter(c => Number.isFinite(c?.base))
        .map(c => ({ type: c.cover || 'Unknown', altitude: c.base })), // base DÉJÀ en ft
      temperature: Number.isFinite(m.temp) ? m.temp : null,
      dewpoint: Number.isFinite(m.dewp) ? m.dewp : null,
      pressure: Number.isFinite(m.altim) ? Math.round(m.altim) : null // hPa
    }
  };
}

async function fetchJsonNoaa(type, icao) {
  const response = await fetch(`${NOAA_PROXY}?type=${type}&ids=${encodeURIComponent(icao)}`);
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) return null;
  const data = await response.json();
  return data;
}

async function fetchMetarNoaa(icao) {
  try {
    const data = await fetchJsonNoaa('metar', icao);
    if (!Array.isArray(data) || data.length === 0) return null;
    return mapNoaaMetar(data[0], icao);
  } catch (e) {
    console.warn(`⚠️ [weatherAPI] METAR NOAA ${icao} :`, e?.message);
    return null;
  }
}

async function fetchTafNoaa(icao) {
  try {
    const data = await fetchJsonNoaa('taf', icao);
    if (!Array.isArray(data) || data.length === 0 || !data[0]?.rawTAF) return null;
    // Seul decoded.time.dt est consommé en aval (Step7Summary « TAF émis le »)
    const issue = data[0].issueTime
      ? new Date(typeof data[0].issueTime === 'number' ? data[0].issueTime * 1000 : data[0].issueTime).toISOString()
      : null;
    return {
      raw: data[0].rawTAF,
      source: 'noaa',
      decoded: issue ? { time: { dt: issue } } : {}
    };
  } catch (e) {
    console.warn(`⚠️ [weatherAPI] TAF NOAA ${icao} :`, e?.message);
    return null;
  }
}

// Service API météo simplifié
export const weatherAPI = {
  // Récupérer le METAR — 🔧 LOT 6-C : NOAA d'abord (sans clé), AVWX en secours
  async fetchMETAR(icao) {
    const noaa = await fetchMetarNoaa(icao);
    if (noaa) return noaa;

    // ─── Secours AVWX (comportement historique) ─────────────────────────────
    // 🔑 Garde-fou clé : VITE_AVWX_API_KEY est inlinée AU BUILD. Si elle est
    // absente du bundle exécuté, c'est qu'il a été construit sans clé →
    // renseigner .env.local PUIS reconstruire (npm run build).
    if (!AVWX_CONFIG.apiKey) {
      console.error(
        `❌ [weatherAPI] METAR ${icao} : VITE_AVWX_API_KEY absente du bundle. ` +
        `Renseignez .env.local PUIS reconstruisez (npm run build) — la clé est inlinée au build.`
      );
      return null /* A5 : plus de météo fabriquée — indisponible */;
    }
    try {
      const response = await fetch(
        `${AVWX_CONFIG.baseUrl}/metar/${icao}?token=${AVWX_CONFIG.apiKey}`
      );

      if (!response.ok) {
        // 401/403 = clé invalide ou RÉVOQUÉE. Cas le plus courant : le bundle
        // embarque une ancienne clé rotée. On le crie fort — sinon l'échec est
        // muet et l'UI affiche « Météo non disponible » sans cause visible.
        if (response.status === 401 || response.status === 403) {
          console.error(
            `❌ [weatherAPI] METAR ${icao} : AVWX refuse la clé (HTTP ${response.status}). ` +
            `Clé VITE_AVWX_API_KEY invalide/révoquée OU bundle construit avec une ancienne clé. ` +
            `Mettez à jour .env.local et RECONSTRUISEZ (npm run build).`
          );
          return null /* A5 : plus de météo fabriquée — indisponible */;
        }
        if (response.status === 429) {
          console.warn(`⚠️ [weatherAPI] METAR ${icao} : quota AVWX dépassé (HTTP 429).`);
          return null /* A5 : plus de météo fabriquée — indisponible */;
        }
        if (response.status === 404) {
          // Normal pour beaucoup de petits aérodromes sans station METAR.
          console.info(`ℹ️ [weatherAPI] METAR ${icao} : aucune station (HTTP 404).`);
          return null /* A5 : plus de météo fabriquée — indisponible */;
        }
        console.warn(`⚠️ [weatherAPI] METAR ${icao} indisponible (HTTP ${response.status}).`);
        return null /* A5 : plus de météo fabriquée — indisponible */;
      }

      // Vérifier que la réponse n'est pas vide
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn(`⚠️ [weatherAPI] METAR ${icao} : réponse non-JSON (content-type: ${contentType}).`);
        return null /* A5 : plus de météo fabriquée — indisponible */;
      }

      // Vérifier la taille de la réponse
      const text = await response.text();
      if (!text || text.trim() === '') {
        console.warn(`⚠️ [weatherAPI] METAR ${icao} : réponse vide.`);
        return null /* A5 : plus de météo fabriquée — indisponible */;
      }

      // Parser le JSON
      try {
        const data = JSON.parse(text);
                 // Debug log
        
        // Déterminer la pression correctement
        let pressure = null;
        if (data.altimeter) {
          // AVWX peut retourner la pression en différents formats
          if (data.altimeter.value > 2000) {
            // Si > 2000, c'est probablement en Pa ou en centièmes de inHg
            if (data.altimeter.value > 30000) {
              // Probablement en Pa, convertir en hPa
              pressure = Math.round(data.altimeter.value / 100);
            } else {
              // Probablement en centièmes de inHg (ex: 2992 = 29.92 inHg)
              pressure = Math.round((data.altimeter.value / 100) * 33.8639);
            }
          } else if (data.altimeter.value > 100) {
            // Probablement déjà en hPa
            pressure = Math.round(data.altimeter.value);
          } else {
            // Probablement en inHg (ex: 29.92)
            pressure = Math.round(data.altimeter.value * 33.8639);
          }
        }
        
        // Formatage des données pour l'application
        return {
          raw: data.raw || 'METAR non disponible',
          decoded: {
            station: data.station || icao,
            // 🔧 LOT 3 : null si AVWX ne fournit pas l'heure d'observation — le
      // fallback new Date() fabriquait une fausse heure (heure du fetch)
      // affichée comme « observé le » dans la synthèse/PDF.
      time: data.time?.dt || null,
            wind: {
              direction: data.wind_direction?.value || (data.wind_speed?.value === 0 ? 'Calme' : 'Variable'),
              speed: data.wind_speed?.value || 0,
              gust: data.wind_gust?.value || null
            },
            visibility: data.visibility?.value || 9999,
            clouds: (data.clouds || []).map(c => ({
              type: c.type || 'Unknown',
              altitude: (c.altitude || 0) * 100
            })),
            temperature: data.temperature?.value ?? null,
            dewpoint: data.dewpoint?.value ?? null,
            pressure: pressure
          }
        };
      } catch (parseError) {
        console.warn(`⚠️ [weatherAPI] METAR ${icao} : JSON illisible`, parseError);
        return null /* A5 : plus de météo fabriquée — indisponible */;
      }
    } catch (error) {
      console.error(`❌ [weatherAPI] METAR ${icao} : échec réseau (fetch). ` +
        `Vérifiez la connexion / un éventuel blocage CORS.`, error);
      return null /* A5 : plus de météo fabriquée — indisponible */;
    }
  },

  // Récupérer le TAF — 🔧 LOT 6-C : NOAA d'abord (sans clé), AVWX en secours
  async fetchTAF(icao) {
    const noaa = await fetchTafNoaa(icao);
    if (noaa) return noaa;

    try {

      const response = await fetch(
        `${AVWX_CONFIG.baseUrl}/taf/${icao}?token=${AVWX_CONFIG.apiKey}`
      );

      if (!response.ok) {
        if (response.status === 404) {
                    return null;
        }
        if (response.status === 400) {

          return null;
        }
                return null;
      }

      // Vérifier que la réponse n'est pas vide
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
                return null;
      }

      // Vérifier la taille de la réponse
      const text = await response.text();
      if (!text || text.trim() === '') {
                return null;
      }

      // Parser le JSON
      try {
        const data = JSON.parse(text);
                
        return {
          raw: data.raw || 'TAF non disponible',
          decoded: data
        };
      } catch (parseError) {
                return null;
      }
    } catch (error) {
      console.error(`❌ Erreur TAF ${icao}:`, error);
      return null;
    }
  },

  // 🔧 A5 — getMockMETAR SUPPRIMÉ : plus aucune météo fabriquée. En cas d'échec
  // de l'API AVWX, fetchMETAR renvoie null → le store marque « Météo non disponible »
  // et l'UI l'affiche, au lieu d'injecter un faux METAR (15 °C/calme déguisé).

  // 🔧 LOT 6-C — SIGMET internationaux (phénomènes significatifs officiels,
  // en JSON structuré). Filtrés sur les FIR françaises (LF**) par défaut.
  // @returns Array<{ firId, hazard, qualifier, rawSigmet, validTimeFrom,
  //          validTimeTo, coords? }> | null (A5 : null si échec, jamais [])
  async fetchSigmets({ firPrefix = 'LF' } = {}) {
    try {
      const data = await fetchJsonNoaa('/isigmet?format=json');
      if (!Array.isArray(data)) return null;
      return data.filter(s => !firPrefix || String(s?.firId || '').startsWith(firPrefix));
    } catch (e) {
      console.warn('⚠️ [weatherAPI] SIGMET NOAA :', e?.message);
      return null;
    }
  },

  // Extraction des nuages depuis le METAR brut
  extractClouds(raw) {
    const clouds = [];
    const cloudTypes = {
      'FEW': 'Quelques',
      'SCT': 'Épars',
      'BKN': 'Fragmenté',
      'OVC': 'Couvert'
    };
    
    const regex = /(FEW|SCT|BKN|OVC)(\d{3})/g;
    let match;
    
    while ((match = regex.exec(raw)) !== null) {
      clouds.push({
        type: cloudTypes[match[1]] || match[1],
        altitude: parseInt(match[2]) * 100
      });
    }
    
    return clouds;
  },

  // Vérifier le statut de l'API
  checkAPIStatus() {

          }
};

// Vérifier le statut au chargement
weatherAPI.checkAPIStatus();

// Export par défaut
export default weatherAPI;