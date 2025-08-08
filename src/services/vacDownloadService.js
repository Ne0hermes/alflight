// src/services/vacDownloadService.js

/**
 * Service pour télécharger les cartes VAC depuis différentes sources
 * Note: Les URLs du SIA changent à chaque cycle AIRAC (tous les 28 jours)
 */

export class VACDownloadService {
  constructor() {
    // Configuration des sources
    this.sources = {
      sia: {
        name: 'SIA France',
        baseUrl: 'https://www.sia.aviation-civile.gouv.fr',
        requiresUpdate: true, // URLs changent tous les 28 jours
        format: 'pdf'
      },
      openflightmaps: {
        name: 'OpenFlightMaps',
        baseUrl: 'https://www.openflightmaps.org',
        apiUrl: 'https://api.openflightmaps.org/api/v1',
        format: 'pdf',
        coverage: 'Europe'
      },
      vfrNav: {
        name: 'VFR Nav',
        baseUrl: 'https://vfrnav.com',
        format: 'image',
        coverage: 'France'
      }
    };

    // Cycle AIRAC actuel (à mettre à jour tous les 28 jours)
    this.currentAiracCycle = this.calculateAiracCycle();
  }

  /**
   * Calcule le cycle AIRAC actuel
   * Les cycles AIRAC changent tous les 28 jours, le jeudi
   */
  calculateAiracCycle() {
    const baseDate = new Date('2024-01-25'); // Date de référence AIRAC 2401
    const today = new Date();
    const daysDiff = Math.floor((today - baseDate) / (1000 * 60 * 60 * 24));
    const cyclesSince = Math.floor(daysDiff / 28);
    
    const year = today.getFullYear();
    const cycleNumber = (cyclesSince % 13) + 1; // 13 cycles par an
    
    return {
      year: year.toString().slice(-2),
      cycle: cycleNumber.toString().padStart(2, '0'),
      string: `${year}${cycleNumber.toString().padStart(2, '0')}`,
      nextChange: new Date(baseDate.getTime() + ((cyclesSince + 1) * 28 * 24 * 60 * 60 * 1000))
    };
  }

  /**
   * Méthode 1: Télécharger depuis le SIA (site officiel français)
   * Note: Les URLs changent à chaque cycle AIRAC
   */
  async downloadFromSIA(icao) {
    const upperIcao = icao.toUpperCase();
    
    // Patterns d'URL possibles du SIA (à adapter selon le cycle AIRAC)
    const urlPatterns = [
      // Pattern actuel (à mettre à jour)
      `${this.sources.sia.baseUrl}/dvd/eAIP_${this.currentAiracCycle.string}/FRANCE/AIRAC-${this.currentAiracCycle.string}/pdf/FR-AD-2-${upperIcao}.pdf`,
      `${this.sources.sia.baseUrl}/dvd/eAIP_${this.currentAiracCycle.string}/Atlas-VAC/PDF/${upperIcao}.pdf`,
      // Pattern alternatif
      `${this.sources.sia.baseUrl}/documents/VAC/${upperIcao}.pdf`,
    ];

    for (const url of urlPatterns) {
      try {
        const response = await fetch(url, {
          method: 'HEAD', // Vérifier si l'URL existe
          mode: 'no-cors' // Éviter les problèmes CORS
        });
        
        // Si pas d'erreur, l'URL existe probablement
        return {
          success: true,
          url: url,
          source: 'SIA',
          airacCycle: this.currentAiracCycle.string,
          format: 'pdf',
          message: 'URL trouvée - téléchargement manuel requis (CORS)'
        };
      } catch (error) {
        continue; // Essayer le pattern suivant
      }
    }

    return {
      success: false,
      error: 'Carte non trouvée sur le SIA',
      suggestion: 'Vérifiez le code ICAO ou téléchargez manuellement depuis sia.aviation-civile.gouv.fr'
    };
  }

  /**
   * Méthode 2: Utiliser OpenFlightMaps
   * API gratuite mais limitée
   */
  async downloadFromOpenFlightMaps(icao) {
    try {
      const upperIcao = icao.toUpperCase();
      
      // Note: OpenFlightMaps nécessite une clé API (gratuite)
      // Inscription sur https://www.openflightmaps.org/api-info
      const apiKey = localStorage.getItem('openflightmaps_api_key');
      
      if (!apiKey) {
        return {
          success: false,
          error: 'Clé API OpenFlightMaps non configurée',
          suggestion: 'Obtenez une clé gratuite sur openflightmaps.org/api-info'
        };
      }

      const response = await fetch(
        `${this.sources.openflightmaps.apiUrl}/airports/${upperIcao}/chart`,
        {
          headers: {
            'X-API-Key': apiKey
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          url: data.chartUrl,
          source: 'OpenFlightMaps',
          format: 'pdf',
          data: data
        };
      }

      return {
        success: false,
        error: 'Carte non disponible sur OpenFlightMaps'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Méthode 3: Générer un lien vers les services en ligne
   * Pour contourner les limitations CORS
   */
  generateOnlineLinks(icao) {
    const upperIcao = icao.toUpperCase();
    
    return {
      sia: `https://www.sia.aviation-civile.gouv.fr/vac-search?icao=${upperIcao}`,
      openflightmaps: `https://www.openflightmaps.org/airfield/${upperIcao}`,
      vfrNav: `https://vfrnav.com/airport/${upperIcao}`,
      skyvector: `https://skyvector.com/airport/${upperIcao}`,
      airnav: `https://www.airnav.com/airport/${upperIcao}`,
      suggestion: 'Ouvrez ces liens pour télécharger manuellement les cartes'
    };
  }

  /**
   * Méthode 4: Utiliser un proxy backend
   * Nécessite un serveur pour contourner CORS
   */
  async downloadViaProxy(icao) {
    try {
      // Utiliser votre proxy local si configuré
      const proxyUrl = 'http://localhost:3001/api/vac-download';
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ icao })
      });

      if (response.ok) {
        const blob = await response.blob();
        return {
          success: true,
          blob: blob,
          source: 'Proxy',
          format: 'pdf'
        };
      }

      return {
        success: false,
        error: 'Proxy non disponible'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Serveur proxy non configuré',
        suggestion: 'Configurez un serveur backend pour télécharger les cartes'
      };
    }
  }

  /**
   * Méthode principale : essayer toutes les sources
   */
  async downloadVAC(icao, options = {}) {
    const {
      preferredSource = 'auto',
      useProxy = false
    } = options;

    // Si proxy disponible, l'utiliser en priorité
    if (useProxy) {
      const proxyResult = await this.downloadViaProxy(icao);
      if (proxyResult.success) return proxyResult;
    }

    // Essayer OpenFlightMaps si configuré
    if (localStorage.getItem('openflightmaps_api_key')) {
      const ofmResult = await this.downloadFromOpenFlightMaps(icao);
      if (ofmResult.success) return ofmResult;
    }

    // Essayer de générer l'URL SIA
    const siaResult = await this.downloadFromSIA(icao);
    if (siaResult.success) {
      // Retourner l'URL pour téléchargement manuel
      return siaResult;
    }

    // En dernier recours, fournir les liens
    return {
      success: false,
      links: this.generateOnlineLinks(icao),
      error: 'Téléchargement automatique impossible - utilisez les liens fournis'
    };
  }

  /**
   * Obtenir les informations sur le cycle AIRAC actuel
   */
  getAiracInfo() {
    const cycle = this.currentAiracCycle;
    return {
      current: cycle.string,
      year: `20${cycle.year}`,
      cycle: cycle.cycle,
      nextChange: cycle.nextChange.toLocaleDateString('fr-FR'),
      daysUntilChange: Math.ceil((cycle.nextChange - new Date()) / (1000 * 60 * 60 * 24)),
      info: 'Les URLs du SIA changent à chaque nouveau cycle AIRAC (tous les 28 jours)'
    };
  }

  /**
   * Configurer une clé API
   */
  setApiKey(service, key) {
    localStorage.setItem(`${service}_api_key`, key);
  }

  /**
   * Vérifier la disponibilité des services
   */
  async checkServicesStatus() {
    const status = {
      sia: false,
      openflightmaps: false,
      proxy: false
    };

    // Vérifier SIA
    try {
      const response = await fetch(this.sources.sia.baseUrl, { 
        method: 'HEAD', 
        mode: 'no-cors' 
      });
      status.sia = true;
    } catch (e) {
      status.sia = false;
    }

    // Vérifier OpenFlightMaps
    status.openflightmaps = !!localStorage.getItem('openflightmaps_api_key');

    // Vérifier proxy
    try {
      const response = await fetch('http://localhost:3001/health');
      status.proxy = response.ok;
    } catch (e) {
      status.proxy = false;
    }

    return status;
  }
}

// Export singleton
export const vacDownloadService = new VACDownloadService();

// Export pour utilisation directe
export default vacDownloadService;