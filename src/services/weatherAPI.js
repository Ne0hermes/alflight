// src/services/weatherAPI.js

/**
 * Service d'API météo avec support pour plusieurs fournisseurs
 * Configurez votre clé API et choisissez votre fournisseur préféré
 */

// Configuration - À mettre dans vos variables d'environnement (.env)
const API_CONFIG = {EZyW9WVdH-sNEKPArsTjs5PIWLQxYkJmGJ1_CRJ0p1A}

  // Option 1: AVWX API (Recommandé pour l'aviation)
  AVWX: {
    enabled: true, // ← Mettez true pour activer AVWX
    apiKey: import.meta.env.VITE_AVWX_API_KEY || '', // Obtenez une clé sur https://avwx.rest
    baseUrl: 'https://avwx.rest/api'
  },
};

// Décodeurs METAR/TAF
class MetarDecoder {
  static decode(raw) {
    const metar = {
      raw,
      station: null,
      time: null,
      wind: { direction: null, speed: null, gust: null },
      visibility: null,
      clouds: [],
      temperature: null,
      dewpoint: null,
      pressure: null,
      remarks: []
    };

    const parts = raw.trim().split(/\s+/);
    let index = 0;

    // Type et station
    if (parts[index] === 'METAR' || parts[index] === 'SPECI') {
      index++;
    }
    metar.station = parts[index++];

    // Date/heure
    if (parts[index] && parts[index].match(/^\d{6}Z$/)) {
      metar.time = parts[index++];
    }

    // Vent
    if (parts[index] && parts[index].match(/^(\d{3}|VRB)(\d{2,3})(G\d{2,3})?KT$/)) {
      const windMatch = parts[index].match(/^(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT$/);
      metar.wind = {
        direction: windMatch[1] === 'VRB' ? 'Variable' : parseInt(windMatch[1]),
        speed: parseInt(windMatch[2]),
        gust: windMatch[4] ? parseInt(windMatch[4]) : null
      };
      index++;
    }

    // Visibilité
    while (index < parts.length) {
      const part = parts[index];
      
      // CAVOK
      if (part === 'CAVOK') {
        metar.visibility = 'CAVOK';
        metar.clouds = [];
        index++;
        break;
      }
      
      // Visibilité en mètres
      if (part.match(/^\d{4}$/)) {
        metar.visibility = parseInt(part);
        index++;
      }
      
      // Nuages
      else if (part.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})/)) {
        const cloudMatch = part.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})/);
        metar.clouds.push({
          type: cloudMatch[1],
          altitude: parseInt(cloudMatch[2]) * 100
        });
        index++;
      }
      
      // Température et point de rosée
      else if (part.match(/^M?\d{2}\/M?\d{2}$/)) {
        const tempMatch = part.match(/^(M?)(\d{2})\/(M?)(\d{2})$/);
        metar.temperature = parseInt(tempMatch[2]) * (tempMatch[1] ? -1 : 1);
        metar.dewpoint = parseInt(tempMatch[4]) * (tempMatch[3] ? -1 : 1);
        index++;
      }
      
      // Pression
      else if (part.match(/^Q\d{4}$/)) {
        metar.pressure = parseInt(part.substring(1));
        index++;
      }
      
      else {
        index++;
      }
    }

    return metar;
  }
}

// Implémentations des API
const weatherAPIs = {
  // AVWX API (Recommandé)
  AVWX: {
    async fetchMETAR(icao) {
      if (!API_CONFIG.AVWX.apiKey) {
        throw new Error('Clé API AVWX non configurée');
      }

      const response = await fetch(
        `${API_CONFIG.AVWX.baseUrl}/metar/${icao}?token=${API_CONFIG.AVWX.apiKey}`,
        {
          headers: {
            'Authorization': `TOKEN ${API_CONFIG.AVWX.apiKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur AVWX: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        raw: data.raw,
        decoded: {
          station: data.station,
          time: data.time.dt,
          wind: {
            direction: data.wind_direction?.value || 'Calme',
            speed: data.wind_speed?.value || 0,
            gust: data.wind_gust?.value || null
          },
          visibility: data.visibility?.value || 9999,
          clouds: data.clouds?.map(c => ({
            type: c.type,
            altitude: c.altitude * 100
          })) || [],
          temperature: data.temperature?.value || null,
          dewpoint: data.dewpoint?.value || null,
          pressure: data.altimeter?.value || null
        }
      };
    },

    async fetchTAF(icao) {
      if (!API_CONFIG.AVWX.apiKey) {
        throw new Error('Clé API AVWX non configurée');
      }

      const response = await fetch(
        `${API_CONFIG.AVWX.baseUrl}/taf/${icao}?token=${API_CONFIG.AVWX.apiKey}`,
        {
          headers: {
            'Authorization': `TOKEN ${API_CONFIG.AVWX.apiKey}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) return null; // Pas de TAF disponible
        throw new Error(`Erreur AVWX: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        raw: data.raw,
        decoded: data // AVWX retourne déjà les données décodées
      };
    }
  },

  // CheckWX API
  CHECKWX: {
    async fetchMETAR(icao) {
      if (!API_CONFIG.CHECKWX.apiKey) {
        throw new Error('Clé API CheckWX non configurée');
      }

      const response = await fetch(
        `${API_CONFIG.CHECKWX.baseUrl}/metar/${icao}/decoded`,
        {
          headers: {
            'X-API-Key': API_CONFIG.CHECKWX.apiKey
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur CheckWX: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        throw new Error(`Pas de METAR pour ${icao}`);
      }

      const metar = data.data[0];
      
      return {
        raw: metar.raw_text,
        decoded: {
          station: metar.icao,
          time: metar.observed,
          wind: {
            direction: metar.wind?.degrees || 'Calme',
            speed: metar.wind?.speed_kts || 0,
            gust: metar.wind?.gust_kts || null
          },
          visibility: metar.visibility?.meters || 9999,
          clouds: metar.clouds?.map(c => ({
            type: c.code,
            altitude: c.feet || 0
          })) || [],
          temperature: metar.temperature?.celsius || null,
          dewpoint: metar.dewpoint?.celsius || null,
          pressure: metar.barometer?.mb || null
        }
      };
    },

    async fetchTAF(icao) {
      if (!API_CONFIG.CHECKWX.apiKey) {
        throw new Error('Clé API CheckWX non configurée');
      }

      const response = await fetch(
        `${API_CONFIG.CHECKWX.baseUrl}/taf/${icao}/decoded`,
        {
          headers: {
            'X-API-Key': API_CONFIG.CHECKWX.apiKey
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Erreur CheckWX: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        return null;
      }

      return {
        raw: data.data[0].raw_text,
        decoded: data.data[0]
      };
    }
  },

  // Météo-France AEROWEB (pour la France)
  AEROWEB: {
    async authenticate() {
      // Implémenter l'authentification OAuth2 si nécessaire
      // Pour l'instant, utilisation basique
      return btoa(`${API_CONFIG.AEROWEB.username}:${API_CONFIG.AEROWEB.password}`);
    },

    async fetchMETAR(icao) {
      if (!API_CONFIG.AEROWEB.username || !API_CONFIG.AEROWEB.password) {
        throw new Error('Identifiants AEROWEB non configurés');
      }

      const auth = await this.authenticate();
      
      const response = await fetch(
        `${API_CONFIG.AEROWEB.baseUrl}/opmet/messages/metar?stations=${icao}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur AEROWEB: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.messages || data.messages.length === 0) {
        throw new Error(`Pas de METAR pour ${icao}`);
      }

      const raw = data.messages[0].message;
      
      return {
        raw,
        decoded: MetarDecoder.decode(raw)
      };
    },

    async fetchTAF(icao) {
      if (!API_CONFIG.AEROWEB.username || !API_CONFIG.AEROWEB.password) {
        throw new Error('Identifiants AEROWEB non configurés');
      }

      const auth = await this.authenticate();
      
      const response = await fetch(
        `${API_CONFIG.AEROWEB.baseUrl}/opmet/messages/taf?stations=${icao}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Erreur AEROWEB: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.messages || data.messages.length === 0) {
        return null;
      }

      return {
        raw: data.messages[0].message,
        decoded: data.messages[0] // Simplifier selon le format réel
      };
    }
  }
};

// Service principal d'API météo
export const weatherAPI = {
  // Déterminer quelle API utiliser
  getActiveAPI() {
    // Chercher la première API activée
    for (const [name, config] of Object.entries(API_CONFIG)) {
      if (config.enabled && (config.apiKey || config.username)) {
        return name;
      }
    }
    
    // Si aucune API n'est configurée, utiliser les données simulées
    return null;
  },

  async fetchMETAR(icao) {
    const activeAPI = this.getActiveAPI();
    
    if (!activeAPI) {
      // Utiliser les données simulées si aucune API n'est configurée
      console.warn('Aucune API météo configurée, utilisation des données simulées');
      return mockWeatherAPI.fetchMETAR(icao);
    }

    try {
      return await weatherAPIs[activeAPI].fetchMETAR(icao);
    } catch (error) {
      console.error(`Erreur ${activeAPI} pour METAR ${icao}:`, error);
      throw error;
    }
  },

  async fetchTAF(icao) {
    const activeAPI = this.getActiveAPI();
    
    if (!activeAPI) {
      console.warn('Aucune API météo configurée, utilisation des données simulées');
      return mockWeatherAPI.fetchTAF(icao);
    }

    try {
      return await weatherAPIs[activeAPI].fetchTAF(icao);
    } catch (error) {
      console.error(`Erreur ${activeAPI} pour TAF ${icao}:`, error);
      // Le TAF n'est pas toujours disponible, on retourne null
      return null;
    }
  }
};

// Mock API pour le développement (comme avant)
const mockWeatherAPI = {
  async fetchMETAR(icao) {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const metarData = {
      LFPN: `METAR LFPN ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 27015KT 9999 SCT035 18/12 Q1013 NOSIG`,
      LFPT: `METAR LFPT ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 26012KT 9999 FEW025 17/11 Q1013 NOSIG`,
      LFPG: `METAR LFPG ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 27018G28KT 9999 SCT040 BKN100 19/12 Q1012 TEMPO 27020G35KT`,
      LFPO: `METAR LFPO ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 28010KT CAVOK 20/11 Q1013 NOSIG`,
      LFBO: `METAR LFBO ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 31008KT 9999 FEW040 22/14 Q1011 NOSIG`
    };
    
    if (!metarData[icao]) {
      throw new Error(`Pas de données METAR pour ${icao}`);
    }
    
    return {
      raw: metarData[icao],
      decoded: MetarDecoder.decode(metarData[icao])
    };
  },
  
  async fetchTAF(icao) {
    await new Promise(resolve => setTimeout(resolve, 700));
    
    const tafData = {
      LFPN: `TAF LFPN ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0700Z ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0806 27015KT 9999 SCT035 TEMPO 0812 27020G30KT`,
      LFPT: `TAF LFPT ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0700Z ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0806 26012KT 9999 FEW025 BECMG 1214 SCT030`,
      LFPG: `TAF LFPG ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0600Z ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0706 27018G28KT 9999 SCT040 BKN100 TEMPO 0915 27020G35KT 5000 SHRA SCT015TCU`,
      LFPO: `TAF LFPO ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0600Z ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0706 28010KT CAVOK BECMG 1517 24008KT SCT045`,
      LFBO: `TAF LFBO ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0600Z ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0706 31008KT 9999 FEW040 PROB30 TEMPO 1621 17015G25KT 3000 TSRA SCT015CB`
    };
    
    if (!tafData[icao]) {
      return null;
    }
    
    return {
      raw: tafData[icao],
      decoded: "TAF décodé (fonctionnalité simplifiée)"
    };
  }
};