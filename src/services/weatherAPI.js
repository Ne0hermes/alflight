// src/services/weatherAPI.js

/**
 * Service API Météo - Version simplifiée AVWX uniquement
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

// Service API météo simplifié
export const weatherAPI = {
  // Récupérer le METAR
  async fetchMETAR(icao) {
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
            time: data.time?.dt || new Date().toISOString(),
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

  // Récupérer le TAF
  async fetchTAF(icao) {
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