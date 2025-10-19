// src/services/weatherAPI.js

/**
 * Service API Météo - Version simplifiée AVWX uniquement
 */

// Configuration AVWX avec votre clé
const AVWX_CONFIG = {
  // La clé peut venir du fichier .env.local ou utiliser la clé par défaut
  apiKey: import.meta.env.VITE_AVWX_API_KEY || 'EZyW9WVdH-sNEKPArsTjs5PIWLQxYkJmGJ1_CRJ0p1A',
  baseUrl: 'https://avwx.rest/api'
};

// Service API météo simplifié
export const weatherAPI = {
  // Récupérer le METAR
  async fetchMETAR(icao) {
    try {
            
      const response = await fetch(
        `${AVWX_CONFIG.baseUrl}/metar/${icao}?token=${AVWX_CONFIG.apiKey}`
      );

      if (!response.ok) {
        if (response.status === 404) {

          return this.getMockMETAR(icao);
        }
        if (response.status === 400) {

          return this.getMockMETAR(icao);
        }
                return this.getMockMETAR(icao);
      }

      // Vérifier que la réponse n'est pas vide
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
                return this.getMockMETAR(icao);
      }

      // Vérifier la taille de la réponse
      const text = await response.text();
      if (!text || text.trim() === '') {
                return this.getMockMETAR(icao);
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
                return this.getMockMETAR(icao);
      }
    } catch (error) {
      console.error(`❌ Erreur METAR ${icao}:`, error);
      
      // Retour de données simulées en cas d'erreur
      return this.getMockMETAR(icao);
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

  // Données simulées de secours
  getMockMETAR(icao) {
        
    const mockData = {
      LFPN: {
        raw: `METAR LFPN ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 27015KT 9999 SCT035 18/12 Q1013 NOSIG`,
        temp: 18, dewpoint: 12, wind: { dir: 270, speed: 15 }, pressure: 1013
      },
      LFPT: {
        raw: `METAR LFPT ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 26012KT 9999 FEW025 17/11 Q1013 NOSIG`,
        temp: 17, dewpoint: 11, wind: { dir: 260, speed: 12 }, pressure: 1013
      },
      LFPG: {
        raw: `METAR LFPG ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 27018G28KT 9999 SCT040 BKN100 19/12 Q1012 TEMPO 27020G35KT`,
        temp: 19, dewpoint: 12, wind: { dir: 270, speed: 18, gust: 28 }, pressure: 1012
      },
      LFPO: {
        raw: `METAR LFPO ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 28010KT CAVOK 20/11 Q1013 NOSIG`,
        temp: 20, dewpoint: 11, wind: { dir: 280, speed: 10 }, pressure: 1013
      },
      LFBO: {
        raw: `METAR LFBO ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 31008KT 9999 FEW040 22/14 Q1011 NOSIG`,
        temp: 22, dewpoint: 14, wind: { dir: 310, speed: 8 }, pressure: 1011
      },
      LFST: {
        raw: `METAR LFST ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 05010KT 9999 SCT030 16/10 Q1014 NOSIG`,
        temp: 16, dewpoint: 10, wind: { dir: 50, speed: 10 }, pressure: 1014
      },
      LFPB: {
        raw: `METAR LFPB ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 24008KT CAVOK 19/11 Q1013 NOSIG`,
        temp: 19, dewpoint: 11, wind: { dir: 240, speed: 8 }, pressure: 1013
      },
      LFML: {
        raw: `METAR LFML ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 32015KT 9999 FEW025 24/16 Q1010 NOSIG`,
        temp: 24, dewpoint: 16, wind: { dir: 320, speed: 15 }, pressure: 1010
      }
    };

    // Données par défaut si l'aéroport n'est pas dans la liste
    const data = mockData[icao] || {
      raw: `METAR ${icao} ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 00000KT 9999 NSC 15/10 Q1013 NOSIG`,
      temp: 15, dewpoint: 10, wind: { dir: 0, speed: 0 }, pressure: 1013
    };

    return {
      raw: data.raw,
      decoded: {
        station: icao,
        time: new Date().toISOString(),
        wind: {
          direction: data.wind.speed === 0 ? 'Calme' : data.wind.dir,
          speed: data.wind.speed,
          gust: data.wind.gust || null
        },
        visibility: data.raw.includes('CAVOK') ? 'CAVOK' : 9999,
        clouds: this.extractClouds(data.raw),
        temperature: data.temp,
        dewpoint: data.dewpoint,
        pressure: data.pressure
      }
    };
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