/**
 * Utilitaire pour la détection des zones dangereuses
 * Utilisé pour la détection automatique en arrière-plan
 */

import { geoJSONDataService } from '../services/GeoJSONDataService';

export async function detectDangerousZones(waypoints, segmentAltitudes) {
  const zones = {};
  
  if (!waypoints || waypoints.length < 2) {
    return zones;
  }
  
  try {
    // Charger les espaces aériens
    const airspaces = await geoJSONDataService.getAirspaces();
    
    // Pour chaque segment
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      const segmentId = `${from.id}-${to.id}`;
      const altitude = segmentAltitudes[segmentId]?.startAlt || 3000;
      
      // Créer une ligne entre les deux points
      const route = [[from.lon, from.lat], [to.lon, to.lat]];
      
      // Détecter les intersections
      const intersected = await geoJSONDataService.getIntersectedAirspaces(route, altitude);
      
      // Filtrer les zones dangereuses (zones R, D, P)
      const dangerous = intersected.filter(airspace => {
        const type = airspace.properties?.type;
        return type && (type.startsWith('R') || type.startsWith('D') || type.startsWith('P'));
      });
      
      if (dangerous.length > 0) {
        zones[segmentId] = dangerous.map(z => ({
          name: z.properties?.name || 'Zone inconnue',
          type: z.properties?.type,
          floor: z.properties?.floor || 0,
          ceiling: z.properties?.ceiling || 99999,
          penetration: z.penetration
        }));
      }
    }
  } catch (error) {
    console.error('Erreur détection zones dangereuses:', error);
  }
  
  return zones;
}