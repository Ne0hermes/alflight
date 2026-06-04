// src/features/weight-balance/scenarioColors.js
// ─────────────────────────────────────────────────────────────────────────────
// SOURCE UNIQUE des couleurs des 4 scénarios de masse & centrage.
// Utilisée À LA FOIS par les cartes (ScenarioCards) ET par le graphe
// (WeightBalanceChart) → garantit que la pastille d'un scénario a la même
// couleur dans la carte et sur le point/cartouche du diagramme.
// Les valeurs concrètes sont des tokens CSS définis dans index.css (--scenario-*),
// déclinés clair/sombre.
// ─────────────────────────────────────────────────────────────────────────────
export const SCENARIO_COLORS = {
  zfw: 'var(--scenario-zfw)',           // Masse sans carburant (ZFW)
  toCrm: 'var(--scenario-takeoff)',     // Masse au décollage (FOB)
  landing: 'var(--scenario-landing)',   // Masse à l'atterrissage
  fulltank: 'var(--scenario-fulltank)', // Réservoirs pleins
};

export default SCENARIO_COLORS;
