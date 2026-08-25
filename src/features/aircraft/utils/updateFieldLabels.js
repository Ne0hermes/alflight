// src/features/aircraft/utils/updateFieldLabels.js
// ============================================================================
// Libellés français des champs top-level du journal de mise à jour
// (_updateHistory), partagés entre la bannière « avion mis à jour »
// (AircraftUpdatesBanner) et le journal des mises à jour communautaire
// (CommunityChangelogDialog). Un champ inconnu est montré tel quel — mieux
// qu'un libellé inventé (fail-closed).
// ============================================================================

export const CHAMP_LABELS = {
  weightBalance: 'masse et centrage',
  weights: 'masses',
  arms: 'bras de levier',
  seatLimits: 'limites sièges',
  speeds: 'vitesses',
  performance: 'performances',
  advancedPerformance: 'tables de performances',
  performanceModels: 'modèles de performance (abaques)',
  performanceCorrections: 'règles de correction',
  tankVariants: 'configurations de réservoirs',
  fuelTanks: 'réservoirs',
  additionalFuelTanks: 'réservoirs additionnels',
  fuelType: 'type de carburant',
  approvedOperations: 'opérations approuvées',
  equipment: 'équipements',
  weighingReport: 'fiche de pesée',
  compartments: 'compartiments',
  photo: 'photo',
  registration: 'immatriculation',
  model: 'modèle',
};

// Champs techniques du journal, sans intérêt pour le pilote
export const CHAMPS_MASQUES = new Set(['version', '_updateHistory', '_metadata', 'updatedAt']);

/** Liste lisible (français) des champs modifiés d'une entrée du journal,
 *  ou null si l'entrée ne contient que des champs techniques. */
export const libelleChamps = (champs) => {
  // Array.isArray (pas juste || []) : un `champs` truthy non-tableau venu d'un
  // journal malformé ne doit pas faire crasher un rendu (leçon getRandomColor).
  const utiles = (Array.isArray(champs) ? champs : []).filter((c) => !CHAMPS_MASQUES.has(c));
  if (utiles.length === 0) return null;
  return utiles.map((c) => CHAMP_LABELS[c] || c).join(', ');
};
