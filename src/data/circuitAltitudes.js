// Altitudes de circuit et d'intégration pour les aérodromes français
// Source: Cartes VAC du SIA France
// Format: code OACI -> { circuitAltitude: altitude en ft AAL, integrationAltitude: altitude en ft AAL }
// AAL = Above Aerodrome Level (hauteur au-dessus de l'aérodrome)

export const circuitAltitudes = {
  // Aérodromes majeurs
  'LFPG': { 
    circuitAltitude: 1500,  // Tours de piste non autorisés
    integrationAltitude: null,
    remarks: 'Tours de piste non autorisés'
  },
  'LFPO': { 
    circuitAltitude: 1500,
    integrationAltitude: 2000,
    remarks: 'Circuit VFR restreint'
  },
  'LFPB': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit standard'
  },
  'LFPN': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit publié sur VAC'
  },
  'LFPT': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit main droite piste 25'
  },
  
  // Aérodromes régionaux
  'LFST': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit standard'
  },
  'LFLB': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit publié'
  },
  'LFLC': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit standard'
  },
  'LFLS': { 
    circuitAltitude: 1500,
    integrationAltitude: 2000,
    remarks: 'Altitude élevée due au relief'
  },
  'LFLP': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit publié'
  },
  'LFLL': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit restreint'
  },
  'LFML': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit côtier'
  },
  'LFMN': { 
    circuitAltitude: 1500,
    integrationAltitude: 2000,
    remarks: 'Circuit mer uniquement'
  },
  'LFBD': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit standard'
  },
  'LFBO': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit publié'
  },
  'LFRB': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit standard'
  },
  'LFRS': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit publié'
  },
  'LFBH': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit standard'
  },
  'LFBI': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit standard'
  },
  'LFBP': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit publié'
  },
  
  // Aérodromes avec particularités
  'LFMT': { 
    circuitAltitude: 1500,
    integrationAltitude: 2000,
    remarks: 'Circuit montagne - altitude adaptée'
  },
  'LFKJ': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit côtier Corse'
  },
  'LFKB': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit publié Corse'
  },
  'LFKC': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit standard Corse'
  },
  'LFKF': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit publié Corse'
  },
  
  // Aérodromes DOM-TOM
  'TFFF': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit standard Martinique'
  },
  'TFFR': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit standard Guadeloupe'
  },
  'FMEP': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Circuit standard Réunion'
  },
  'FMEE': { 
    circuitAltitude: 1500,
    integrationAltitude: 2000,
    remarks: 'Circuit océanique Réunion'
  },
  
  // Valeurs par défaut pour les aérodromes non listés
  'DEFAULT': { 
    circuitAltitude: 1000,
    integrationAltitude: 1500,
    remarks: 'Valeurs standard - vérifier VAC'
  }
};

// Fonction pour obtenir les altitudes d'un aérodrome
export const getCircuitAltitudes = (icaoCode) => {
  const upperCode = icaoCode?.toUpperCase();
  return circuitAltitudes[upperCode] || circuitAltitudes['DEFAULT'];
};

// Fonction pour obtenir l'altitude en QNH (approximative)
export const getCircuitAltitudeQNH = (icaoCode, elevation) => {
  const altitudes = getCircuitAltitudes(icaoCode);
  if (!elevation) return altitudes;
  
  return {
    ...altitudes,
    circuitAltitudeQNH: altitudes.circuitAltitude + elevation,
    integrationAltitudeQNH: altitudes.integrationAltitude ? altitudes.integrationAltitude + elevation : null
  };
};

export default circuitAltitudes;