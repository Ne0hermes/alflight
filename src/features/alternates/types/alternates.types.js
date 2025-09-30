// src/features/alternates/types/alternates.types.js

import PropTypes from 'prop-types';

/**
 * Types pour le module Alternates avec système dual
 */

// Type pour un aérodrome de base
export const AirportType = PropTypes.shape({
  icao: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['large_airport', 'medium_airport', 'small_airport', 'closed', 'heliport']),
  lat: PropTypes.number.isRequired,
  lon: PropTypes.number.isRequired,
  coordinates: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lon: PropTypes.number.isRequired
  }),
  elevation: PropTypes.number,
  runways: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    length: PropTypes.number,
    width: PropTypes.number,
    surface: PropTypes.string,
    lighting: PropTypes.bool
  })),
  fuel: PropTypes.bool,
  services: PropTypes.shape({
    fuel: PropTypes.bool,
    atc: PropTypes.bool,
    lighting: PropTypes.bool,
    maintenance: PropTypes.bool,
    customs: PropTypes.bool,
    handling: PropTypes.bool
  }),
  frequencies: PropTypes.arrayOf(PropTypes.shape({
    type: PropTypes.string,
    frequency: PropTypes.string
  }))
});

// Type pour un aérodrome avec scoring
export const ScoredAirportType = PropTypes.shape({
  ...AirportType,
  score: PropTypes.number.isRequired,
  scoreFactors: PropTypes.shape({
    distance: PropTypes.number,
    infrastructure: PropTypes.number,
    services: PropTypes.number,
    weather: PropTypes.number,
    strategic: PropTypes.number
  }),
  rank: PropTypes.oneOf(['EXCELLENT', 'GOOD', 'ACCEPTABLE', 'MARGINAL', 'POOR']),
  recommendation: PropTypes.string,
  distance: PropTypes.number,
  side: PropTypes.oneOf(['departure', 'arrival']),
  selectionType: PropTypes.oneOf(['departure', 'arrival'])
});

// Type pour la zone de recherche
export const SearchZoneType = PropTypes.shape({
  type: PropTypes.oneOf(['pill', 'rectangle', 'triangle', 'boundingBox']).isRequired,
  vertices: PropTypes.arrayOf(PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lon: PropTypes.number.isRequired
  })),
  area: PropTypes.number,
  center: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lon: PropTypes.number.isRequired
  }),
  radius: PropTypes.number,
  length: PropTypes.number,
  width: PropTypes.number,
  departure: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lon: PropTypes.number.isRequired
  }).isRequired,
  arrival: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lon: PropTypes.number.isRequired
  }).isRequired,
  bearing: PropTypes.number,
  perpendicular: PropTypes.shape({
    midpoint: PropTypes.shape({
      lat: PropTypes.number.isRequired,
      lon: PropTypes.number.isRequired
    }),
    point1: PropTypes.shape({
      lat: PropTypes.number.isRequired,
      lon: PropTypes.number.isRequired
    }),
    point2: PropTypes.shape({
      lat: PropTypes.number.isRequired,
      lon: PropTypes.number.isRequired
    }),
    bearing: PropTypes.number
  }),
  turnPoints: PropTypes.arrayOf(PropTypes.shape({
    lat: PropTypes.number,
    lon: PropTypes.number,
    turnAngle: PropTypes.number,
    bufferRadius: PropTypes.number
  }))
});

// Type pour les paramètres dynamiques
export const DynamicParamsType = PropTypes.shape({
  requiredRunwayLength: PropTypes.number.isRequired,
  maxRadiusNM: PropTypes.number,
  flightRules: PropTypes.oneOf(['VFR', 'IFR']),
  isDayFlight: PropTypes.bool
});

// Type pour les critères de filtrage
export const FilterCriteriaType = PropTypes.shape({
  maxRadiusNM: PropTypes.number,
  requiredRunwayLength: PropTypes.number,
  requireFuel: PropTypes.bool,
  requireATC: PropTypes.bool,
  requireVAC: PropTypes.bool,
  isDayFlight: PropTypes.bool,
  flightRules: PropTypes.oneOf(['VFR', 'IFR']),
  weatherMinima: PropTypes.shape({
    vfr: PropTypes.shape({
      ceiling: PropTypes.number,
      visibility: PropTypes.number
    }),
    ifr: PropTypes.shape({
      ceiling: PropTypes.number,
      visibility: PropTypes.number
    })
  }),
  requiredSide: PropTypes.oneOf(['departure', 'arrival'])
});

// Type pour le contexte de scoring
export const ScoringContextType = PropTypes.shape({
  departure: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lon: PropTypes.number.isRequired
  }).isRequired,
  arrival: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lon: PropTypes.number.isRequired
  }).isRequired,
  waypoints: PropTypes.arrayOf(PropTypes.shape({
    lat: PropTypes.number,
    lon: PropTypes.number,
    name: PropTypes.string
  })),
  aircraft: PropTypes.shape({
    model: PropTypes.string,
    fuelConsumption: PropTypes.number,
    cruiseSpeedKt: PropTypes.number,
    performances: PropTypes.shape({
      landingDistance: PropTypes.number
    })
  }),
  weather: PropTypes.object,
  flightType: PropTypes.shape({
    rules: PropTypes.oneOf(['VFR', 'IFR']),
    period: PropTypes.oneOf(['jour', 'nuit'])
  })
});

// Type pour les statistiques
export const StatisticsType = PropTypes.shape({
  totalCandidates: PropTypes.number,
  scoredCandidates: PropTypes.number,
  selectedCount: PropTypes.number,
  averageScore: PropTypes.number,
  departureSideCount: PropTypes.number,
  arrivalSideCount: PropTypes.number
});

// Type pour un alternate formaté pour l'affichage
export const FormattedAlternateType = PropTypes.shape({
  ...ScoredAirportType,
  displayIndex: PropTypes.number,
  displayName: PropTypes.string,
  displayDistance: PropTypes.string,
  displayRunway: PropTypes.string,
  displayServices: PropTypes.string,
  displayWeather: PropTypes.string,
  displayScore: PropTypes.string,
  displayRank: PropTypes.string,
  distanceToDeparture: PropTypes.number,
  distanceToArrival: PropTypes.number,
  vac: PropTypes.shape({
    available: PropTypes.bool,
    downloaded: PropTypes.bool
  })
});

// PropTypes pour les composants
export const AlternatesModulePropTypes = {
  // Pas de props requises, utilise les contexts
};

export const AlternateMapPropTypes = {
  searchZone: SearchZoneType,
  alternates: PropTypes.arrayOf(ScoredAirportType)
};

export const AlternateDetailsPropTypes = {
  alternates: PropTypes.arrayOf(ScoredAirportType)
};

export const AlternateSelectorPropTypes = {
  candidates: PropTypes.arrayOf(ScoredAirportType),
  selected: PropTypes.arrayOf(ScoredAirportType)
};

// Types d'entrée depuis les autres modules
export const AlternateModuleInputTypes = {
  navigation: PropTypes.shape({
    departure: PropTypes.shape({
      icao: PropTypes.string,
      lat: PropTypes.number.isRequired,
      lon: PropTypes.number.isRequired
    }).isRequired,
    arrival: PropTypes.shape({
      icao: PropTypes.string,
      lat: PropTypes.number.isRequired,
      lon: PropTypes.number.isRequired
    }).isRequired,
    waypoints: PropTypes.arrayOf(PropTypes.shape({
      lat: PropTypes.number,
      lon: PropTypes.number,
      name: PropTypes.string
    })),
    distance: PropTypes.number
  }),
  aircraft: PropTypes.shape({
    model: PropTypes.string,
    registration: PropTypes.string,
    fuelConsumption: PropTypes.number,
    cruiseSpeedKt: PropTypes.number,
    performances: PropTypes.shape({
      landingDistance: PropTypes.number,
      takeoffDistance: PropTypes.number
    })
  }),
  fuel: PropTypes.shape({
    fob: PropTypes.number,
    reserves: PropTypes.shape({
      final: PropTypes.number,
      alternate: PropTypes.number
    })
  }),
  flightType: PropTypes.shape({
    rules: PropTypes.oneOf(['VFR', 'IFR']),
    period: PropTypes.oneOf(['jour', 'nuit']),
    category: PropTypes.oneOf(['local', 'voyage'])
  })
};

// Types de sortie du module
export const AlternateModuleOutputTypes = {
  selectedAlternates: PropTypes.arrayOf(ScoredAirportType),
  departureAlternate: ScoredAirportType,
  arrivalAlternate: ScoredAirportType,
  searchZone: SearchZoneType,
  statistics: StatisticsType,
  isReady: PropTypes.bool
};

// Export des types TypeScript si nécessaire (pour documentation)
export const TypeScriptTypes = `
interface Airport {
  icao: string;
  name: string;
  type: 'large_airport' | 'medium_airport' | 'small_airport' | 'closed' | 'heliport';
  lat: number;
  lon: number;
  coordinates: {
    lat: number;
    lon: number;
  };
  elevation?: number;
  runways: Array<{
    id?: string;
    length?: number;
    width?: number;
    surface?: string;
    lighting?: boolean;
  }>;
  fuel?: boolean;
  services?: {
    fuel?: boolean;
    atc?: boolean;
    lighting?: boolean;
    maintenance?: boolean;
    customs?: boolean;
    handling?: boolean;
  };
  frequencies?: Array<{
    type: string;
    frequency: string;
  }>;
}

interface ScoredAirport extends Airport {
  score: number;
  scoreFactors: {
    distance?: number;
    infrastructure?: number;
    services?: number;
    weather?: number;
    strategic?: number;
  };
  rank: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'MARGINAL' | 'POOR';
  recommendation?: string;
  distance: number;
  side: 'departure' | 'arrival';
  selectionType: 'departure' | 'arrival';
}

interface SearchZone {
  type: 'pill' | 'rectangle' | 'triangle' | 'boundingBox';
  vertices?: Array<{ lat: number; lon: number }>;
  area?: number;
  center?: { lat: number; lon: number };
  radius?: number;
  length?: number;
  width?: number;
  departure: { lat: number; lon: number };
  arrival: { lat: number; lon: number };
  bearing?: number;
  perpendicular?: {
    midpoint: { lat: number; lon: number };
    point1: { lat: number; lon: number };
    point2: { lat: number; lon: number };
    bearing: number;
  };
  turnPoints?: Array<{
    lat?: number;
    lon?: number;
    turnAngle?: number;
    bufferRadius?: number;
  }>;
}
`;