/**
 * Source des points de report VFR (VRP) pour l'app.
 *
 * ⚠️ Historiquement, ce module parsait le XML AIXM 42 Mo au runtime (DOMParser) pour
 * extraire les <Dpn> VFR et les associer à un aérodrome. Or ce XML est gitignore
 * (public/data/*.xml) → ABSENT en prod (Vercel) → 404 → 0 point VFR. Cf. #11.
 *
 * Désormais il lit le GeoJSON dérivé VERSIONNÉ (/data/geojson/designated_points.geojson),
 * produit par l'ETL (scripts/sia_etl.ts) qui classe les points VFR (type VFR-*) et
 * renseigne aerodrome_icao (depuis AhpUidAssoc). SOURCE UNIQUE, comme le reste des
 * données SIA. L'API publique (loadVFRPoints / toGeoJSON / clearCache) est conservée.
 */

const DESIGNATED_POINTS_URL = '/data/geojson/designated_points.geojson';

class VFRPointsExtractor {
  constructor() {
    this.vfrPoints = [];
    this.loading = false;
    this.loaded = false;
  }

  /**
   * Charge les points VFR depuis le GeoJSON dérivé.
   */
  async loadVFRPoints() {
    if (this.loaded) return this.vfrPoints;
    if (this.loading) {
      // Attendre si déjà en cours de chargement
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.loading) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
      return this.vfrPoints;
    }

    this.loading = true;

    try {
      const response = await fetch(DESIGNATED_POINTS_URL);
      if (!response.ok) {
        throw new Error(`Erreur chargement designated_points: ${response.status}`);
      }
      const fc = await response.json();

      // Ne garder que les points de report VFR : ceux associés à un aérodrome
      // (aerodrome_icao, depuis AhpUidAssoc) ou typés VFR-* par l'ETL.
      this.vfrPoints = (fc.features || [])
        .filter(f => {
          const p = f?.properties || {};
          return p.aerodrome_icao || (typeof p.type === 'string' && p.type.startsWith('VFR'));
        })
        .map(f => {
          const p = f.properties || {};
          const coords = f.geometry?.coordinates || [];
          return {
            id: p.id || p.code,
            name: p.name || p.code,
            description: p.name || undefined,
            type: 'VRP',
            coordinates: { lat: coords[1], lon: coords[0] },
            aerodrome: p.aerodrome_icao || null,
            reference: p.type
          };
        })
        .filter(pt => pt.coordinates.lat != null && pt.coordinates.lon != null);

      this.loaded = true;
      return this.vfrPoints;

    } catch (error) {
      console.error('❌ Erreur chargement points VFR (GeoJSON):', error);
      return [];
    } finally {
      this.loading = false;
    }
  }

  /**
   * Points VFR groupés par aérodrome associé.
   */
  getVFRPointsByAerodrome() {
    const byAerodrome = new Map();
    for (const point of this.vfrPoints) {
      if (!point.aerodrome) continue;
      if (!byAerodrome.has(point.aerodrome)) byAerodrome.set(point.aerodrome, []);
      byAerodrome.get(point.aerodrome).push(point);
    }
    return byAerodrome;
  }

  /**
   * Convertit les points VFR en features GeoJSON (forme historique pour les consommateurs).
   */
  toGeoJSON() {
    return this.vfrPoints.map(point => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [point.coordinates.lon, point.coordinates.lat]
      },
      properties: {
        name: point.name,
        description: point.description,
        type: 'VFR',
        vfrType: point.type,
        aerodrome: point.aerodrome,
        identification: point.id,
        reference: point.reference
      }
    }));
  }

  /**
   * Réinitialise le cache pour forcer le rechargement.
   */
  clearCache() {
    this.vfrPoints = [];
    this.loaded = false;
    this.loading = false;
  }
}

// Export singleton
export const vfrPointsExtractor = new VFRPointsExtractor();
