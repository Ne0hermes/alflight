/**
 * Source des espaces aériens pour l'app.
 *
 * ⚠️ Historiquement, ce module parsait le XML AIXM 42 Mo au runtime (DOMParser).
 * Or ce XML est gitignore (public/data/*.xml) → ABSENT en prod (Vercel) → 404, et même
 * en local sa géométrie n'était jamais reconstruite (les <Abd> sont des éléments séparés
 * de l'<Ase>, jamais des descendants) → 0 espace → 1 CTR factice. Cf. #11/#14.
 *
 * Désormais il lit le GeoJSON dérivé VERSIONNÉ (/data/geojson/airspaces.geojson), produit
 * par l'ETL (scripts/sia_etl.ts) — SOURCE UNIQUE, comme le reste des données SIA. L'API
 * publique (loadAndParse / updateAirspace / …) est conservée pour ses consommateurs
 * (hybridAirspacesService).
 */

const AIRSPACES_GEOJSON_URL = '/data/geojson/airspaces.geojson';

class AIXMAirspacesParser {
  constructor() {
    this.airspaces = [];
    this.isLoading = false;
    this.loadPromise = null;
    this.lastModified = null;
  }

  /**
   * Charge les espaces aériens depuis le GeoJSON dérivé et les met à la forme
   * attendue par les consommateurs (Feature avec properties éditables).
   */
  async loadAndParse() {
    if (this.loadPromise) {
      return await this.loadPromise;
    }

    if (this.airspaces.length > 0 && !this.isLoading) {
      return this.airspaces;
    }

    this.isLoading = true;

    this.loadPromise = (async () => {
      try {
        const response = await fetch(AIRSPACES_GEOJSON_URL);
        if (!response.ok) {
          throw new Error(`airspaces.geojson: ${response.status}`);
        }
        const fc = await response.json();

        this.airspaces = (fc.features || [])
          .filter(f => f && f.geometry && f.properties)
          .map(f => this.fromGeoJSONFeature(f));

        // Trier par type puis par nom (CTR/TMA d'abord).
        const typeOrder = ['CTR', 'TMA', 'CTA', 'AWY', 'R', 'P', 'D', 'TMZ', 'RMZ', 'TSA', 'TRA', 'FIR', 'UIR', 'ATZ'];
        this.airspaces.sort((a, b) => {
          const ai = typeOrder.indexOf(a.properties.type);
          const bi = typeOrder.indexOf(b.properties.type);
          const aIdx = ai === -1 ? 999 : ai;
          const bIdx = bi === -1 ? 999 : bi;
          if (aIdx !== bIdx) return aIdx - bIdx;
          return (a.properties.name || '').localeCompare(b.properties.name || '');
        });

        // Ré-appliquer les éditions locales éventuelles.
        this.loadModifications();

        this.isLoading = false;
        return this.airspaces;

      } catch (error) {
        console.error('❌ Erreur chargement espaces aériens (GeoJSON):', error);
        this.isLoading = false;
        this.loadPromise = null;
        return this.getDefaultAirspaces();
      }
    })();

    return await this.loadPromise;
  }

  /**
   * Convertit une feature GeoJSON dérivée vers la forme historique attendue par les
   * consommateurs (mêmes clés que l'ancien parser XML).
   */
  fromGeoJSONFeature(feature) {
    const p = feature.properties || {};
    return {
      type: 'Feature',
      id: p.id || `${p.type}_${p.code_id}`.replace(/\s+/g, '_'),
      geometry: feature.geometry,
      properties: {
        type: p.type,
        code: p.code_id,
        name: p.name || `${p.type || ''} ${p.code_id || ''}`.trim(),
        class: p.class,
        originalClass: p.class,
        floor: p.floor ?? 0,
        ceiling: p.ceiling ?? 0,
        floor_raw: p.floor_raw || 'SFC',
        ceiling_raw: p.ceiling_raw || '',
        floor_ref: p.floor_ref,
        ceiling_ref: p.ceiling_ref,
        activity: p.activity,
        schedule: p.schedule,
        remarks: p.remarks,
        source: p.source || 'SIA',
        airac: p.airac,
        editable: true,
        modified: false
      }
    };
  }

  /**
   * Espace aérien par défaut (filet de sécurité si le GeoJSON est indisponible).
   */
  getDefaultAirspaces() {
    return [
      {
        type: 'Feature',
        id: 'CTR_LFPG_DEFAULT',
        geometry: {
          type: 'Polygon',
          coordinates: [[[2.35, 48.95], [2.65, 48.95], [2.65, 49.15], [2.35, 49.15], [2.35, 48.95]]]
        },
        properties: {
          type: 'CTR',
          code: 'LFPG',
          name: 'PARIS CDG CTR',
          class: 'D',
          floor: 0,
          ceiling: 1500,
          floor_raw: 'SFC',
          ceiling_raw: '1500 ft',
          source: 'DEFAULT',
          editable: true
        }
      }
    ];
  }

  /**
   * Met à jour un espace aérien (édition manuelle) + persiste en localStorage.
   */
  updateAirspace(id, updates) {
    const airspace = this.airspaces.find(a => a.id === id);
    if (airspace) {
      Object.assign(airspace.properties, updates, { modified: true });
      this.saveModifications();
      return true;
    }
    return false;
  }

  /**
   * Sauvegarde les éditions manuelles dans le localStorage.
   */
  saveModifications() {
    const modifications = {};
    this.airspaces.forEach(airspace => {
      if (airspace.properties.modified) {
        modifications[airspace.id] = airspace.properties;
      }
    });
    localStorage.setItem('aixm_airspaces_modifications', JSON.stringify(modifications));
  }

  /**
   * Recharge les éditions manuelles depuis le localStorage.
   */
  loadModifications() {
    const saved = localStorage.getItem('aixm_airspaces_modifications');
    if (saved) {
      const modifications = JSON.parse(saved);
      Object.keys(modifications).forEach(id => {
        const airspace = this.airspaces.find(a => a.id === id);
        if (airspace) {
          Object.assign(airspace.properties, modifications[id]);
        }
      });
    }
  }

  /**
   * Réinitialise les éditions manuelles.
   */
  resetModifications() {
    localStorage.removeItem('aixm_airspaces_modifications');
    this.airspaces.forEach(airspace => {
      airspace.properties.modified = false;
    });
  }
}

// Export singleton
export const aixmAirspacesParser = new AIXMAirspacesParser();
