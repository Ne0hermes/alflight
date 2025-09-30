// src/core/data/AeroDataProvider.js
/**
 * Interface abstraite pour les fournisseurs de données aéronautiques
 * Permet de découpler l'application de la source de données (OpenAIP, SIA, etc.)
 */

/**
 * @typedef {Object} AirspaceQuery
 * @property {string} [country] - Code pays (ex: 'FR')
 * @property {number[]} [bounds] - [minLat, minLon, maxLat, maxLon]
 * @property {string[]} [types] - Types d'espaces (CTR, TMA, D, P, R, etc.)
 */

/**
 * @typedef {Object} AirfieldQuery
 * @property {string} [country] - Code pays
 * @property {string} [icao] - Code ICAO
 * @property {string} [search] - Recherche textuelle
 * @property {Object} [nearPoint] - Recherche par proximité
 * @property {number} nearPoint.lat
 * @property {number} nearPoint.lon
 * @property {number} nearPoint.radius - Rayon en km
 */

/**
 * @typedef {Object} NavaidQuery
 * @property {string} [country] - Code pays
 * @property {string[]} [types] - Types (VOR, NDB, DME, etc.)
 */

/**
 * @typedef {Object} Airspace
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {number} lowerLimit
 * @property {number} upperLimit
 * @property {string} lowerLimitUnit
 * @property {string} upperLimitUnit
 * @property {Array} geometry
 */

/**
 * @typedef {Object} Airfield
 * @property {string} icao
 * @property {string} name
 * @property {string} [city]
 * @property {Object} coordinates
 * @property {number} coordinates.lat
 * @property {number} coordinates.lon
 * @property {number} [elevation]
 * @property {string} [type]
 * @property {Array} [runways]
 * @property {Array} [frequencies]
 */

/**
 * @typedef {Object} Navaid
 * @property {string} id
 * @property {string} identifier
 * @property {string} name
 * @property {string} type
 * @property {number} frequency
 * @property {Object} coordinates
 * @property {number} coordinates.lat
 * @property {number} coordinates.lon
 */

/**
 * @typedef {Object} ReportingPoint
 * @property {string} code
 * @property {string} name
 * @property {string} [type]
 * @property {boolean} [mandatory]
 * @property {Object} coordinates
 * @property {number} coordinates.lat
 * @property {number} coordinates.lon
 */

/**
 * Interface abstraite pour les providers de données aéronautiques
 */
export class AeroDataProvider {
  /**
   * Récupère les espaces aériens
   * @param {AirspaceQuery} params
   * @returns {Promise<Airspace[]>}
   */
  async getAirspaces(params) {
    throw new Error('getAirspaces must be implemented');
  }

  /**
   * Récupère les aérodromes
   * @param {AirfieldQuery} params
   * @returns {Promise<Airfield[]>}
   */
  async getAirfields(params) {
    throw new Error('getAirfields must be implemented');
  }

  /**
   * Récupère les balises de navigation
   * @param {NavaidQuery} params
   * @returns {Promise<Navaid[]>}
   */
  async getNavaids(params) {
    throw new Error('getNavaids must be implemented');
  }

  /**
   * Récupère les points de report VFR pour un aérodrome
   * @param {string} icao
   * @returns {Promise<ReportingPoint[]>}
   */
  async getReportingPoints(icao) {
    throw new Error('getReportingPoints must be implemented');
  }

  /**
   * Vérifie si le provider est disponible
   * @returns {boolean}
   */
  isAvailable() {
    return false;
  }

  /**
   * Retourne le nom du provider
   * @returns {string}
   */
  getProviderName() {
    return 'Unknown Provider';
  }

  /**
   * Retourne le statut du provider
   * @returns {Object}
   */
  getStatus() {
    return {
      available: this.isAvailable(),
      name: this.getProviderName(),
      message: null
    };
  }
}