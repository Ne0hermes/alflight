/**
 * Espaces aériens français principaux avec géométries manuelles
 * Données approximatives pour démonstration
 */

export const FRENCH_AIRSPACES_MANUAL = {
  type: "FeatureCollection",
  features: [
    // CTR Paris Charles de Gaulle
    {
      type: "Feature",
      id: "CTR_LFPG",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [2.35, 48.95],
          [2.65, 48.95],
          [2.65, 49.15],
          [2.35, 49.15],
          [2.35, 48.95]
        ]]
      },
      properties: {
        id: "CTR_LFPG",
        code_id: "LFPG",
        name: "Paris Charles de Gaulle CTR",
        class: "D",
        type: "CTR",
        floor: 0,
        floor_ref: "SFC",
        floor_raw: "SFC",
        ceiling: 1500,
        ceiling_ref: "AMSL",
        ceiling_raw: "1500 ft AMSL",
        source: "MANUAL",
        airac: "2025-09-04"
      }
    },
    
    // TMA Paris
    {
      type: "Feature",
      id: "TMA_PARIS",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [1.8, 48.5],
          [3.0, 48.5],
          [3.0, 49.3],
          [1.8, 49.3],
          [1.8, 48.5]
        ]]
      },
      properties: {
        id: "TMA_PARIS",
        code_id: "PARIS",
        name: "Paris TMA",
        class: "A",
        type: "TMA",
        floor: 1500,
        floor_ref: "AMSL",
        floor_raw: "1500 ft",
        ceiling: 19500,
        ceiling_ref: "STD",
        ceiling_raw: "FL195",
        source: "MANUAL",
        airac: "2025-09-04"
      }
    },
    
    // Zone R (Restreinte) militaire
    {
      type: "Feature",
      id: "R_45",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [1.5, 47.0],
          [2.0, 47.0],
          [2.0, 47.3],
          [1.5, 47.3],
          [1.5, 47.0]
        ]]
      },
      properties: {
        id: "R_45",
        code_id: "R45",
        name: "Zone R 45 - Bricy",
        class: "UNDEFINED",
        type: "R",
        activity: "MILITARY",
        floor: 0,
        floor_ref: "SFC",
        floor_raw: "SFC",
        ceiling: 5000,
        ceiling_ref: "AMSL",
        ceiling_raw: "5000 ft",
        schedule: "HO",
        remarks: "Zone militaire activable par NOTAM",
        source: "MANUAL",
        airac: "2025-09-04"
      }
    },
    
    // Zone P (Prohibited) - Centrale nucléaire
    {
      type: "Feature",
      id: "P_23",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [4.75, 47.50],
          [4.85, 47.50],
          [4.85, 47.55],
          [4.75, 47.55],
          [4.75, 47.50]
        ]]
      },
      properties: {
        id: "P_23",
        code_id: "P23",
        name: "Zone P 23 - Belleville",
        class: "UNDEFINED",
        type: "P",
        activity: "NUCLEAR",
        floor: 0,
        floor_ref: "SFC",
        floor_raw: "SFC",
        ceiling: 3300,
        ceiling_ref: "AMSL",
        ceiling_raw: "3300 ft",
        schedule: "H24",
        remarks: "Survol interdit - Centrale nucléaire",
        source: "MANUAL",
        airac: "2025-09-04"
      }
    },
    
    // Zone D (Danger) - Parachutage
    {
      type: "Feature",
      id: "D_126",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [0.2, 48.8],
          [0.3, 48.8],
          [0.3, 48.9],
          [0.2, 48.9],
          [0.2, 48.8]
        ]]
      },
      properties: {
        id: "D_126",
        code_id: "D126",
        name: "Zone D 126 - Gap Tallard",
        class: "UNDEFINED",
        type: "D",
        activity: "PARACHUTING",
        floor: 0,
        floor_ref: "SFC",
        floor_raw: "SFC",
        ceiling: 15000,
        ceiling_ref: "AMSL",
        ceiling_raw: "15000 ft",
        schedule: "Sunrise to Sunset",
        remarks: "Parachutage intensif",
        source: "MANUAL",
        airac: "2025-09-04"
      }
    },
    
    // CTR Nice
    {
      type: "Feature",
      id: "CTR_LFMN",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [7.1, 43.6],
          [7.3, 43.6],
          [7.3, 43.7],
          [7.1, 43.7],
          [7.1, 43.6]
        ]]
      },
      properties: {
        id: "CTR_LFMN",
        code_id: "LFMN",
        name: "Nice Côte d'Azur CTR",
        class: "D",
        type: "CTR",
        floor: 0,
        floor_ref: "SFC",
        floor_raw: "SFC",
        ceiling: 3000,
        ceiling_ref: "AMSL",
        ceiling_raw: "3000 ft",
        source: "MANUAL",
        airac: "2025-09-04"
      }
    },
    
    // TMA Lyon
    {
      type: "Feature",
      id: "TMA_LYON",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [4.6, 45.5],
          [5.2, 45.5],
          [5.2, 46.0],
          [4.6, 46.0],
          [4.6, 45.5]
        ]]
      },
      properties: {
        id: "TMA_LYON",
        code_id: "LYON",
        name: "Lyon TMA",
        class: "D",
        type: "TMA",
        floor: 2000,
        floor_ref: "AMSL",
        floor_raw: "2000 ft",
        ceiling: 11500,
        ceiling_ref: "STD",
        ceiling_raw: "FL115",
        source: "MANUAL",
        airac: "2025-09-04"
      }
    },
    
    // Zone TSA (Temporary Segregated Area)
    {
      type: "Feature",
      id: "TSA_42",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-1.0, 44.5],
          [-0.5, 44.5],
          [-0.5, 45.0],
          [-1.0, 45.0],
          [-1.0, 44.5]
        ]]
      },
      properties: {
        id: "TSA_42",
        code_id: "TSA42",
        name: "TSA 42 - Bordeaux",
        class: "UNDEFINED",
        type: "TSA",
        activity: "MILITARY",
        floor: 5000,
        floor_ref: "AMSL",
        floor_raw: "5000 ft",
        ceiling: 24500,
        ceiling_ref: "STD",
        ceiling_raw: "FL245",
        schedule: "Activable par NOTAM",
        remarks: "Zone militaire temporaire",
        source: "MANUAL",
        airac: "2025-09-04"
      }
    }
  ]
};

/**
 * Obtient les espaces aériens manuels
 */
export function getManualAirspaces() {
  return FRENCH_AIRSPACES_MANUAL.features;
}