// src/features/alternates/types/alternates.types.js

/**
 * Types pour le module Alternates
 */

// Types d'entrée depuis les autres modules
export const AlternateModuleInputTypes = {
  navigation: {
    departure: { icao: String, lat: Number, lon: Number },
    arrival: { icao: String, lat: Number, lon: Number },
    route: Array,
    distance: Number // NM
  },
  // ... reste des types
};

// Types de sortie du module
export const AlternateModuleOutputTypes = {
  selectedAlternates: Array,
  searchZone: Object,
  statistics: Object
};

// Ou utiliser PropTypes si vous préférez
import PropTypes from 'prop-types';

export const AlternatesPropTypes = {
  navigation: PropTypes.shape({
    departure: PropTypes.shape({
      icao: PropTypes.string.isRequired,
      lat: PropTypes.number.isRequired,
      lon: PropTypes.number.isRequired
    }).isRequired,
    // ...
  })
};