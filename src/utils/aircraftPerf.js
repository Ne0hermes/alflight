// src/utils/aircraftPerf.js
//
// SOURCE UNIQUE de la vitesse de croisière et de la consommation horaire avion.
// 🔧 A6/P0 — Retourne null si la donnée n'est pas renseignée, AU LIEU de fabriquer
// des valeurs divergentes selon l'écran (cruiseSpeed 100 vs 120 ; fuelConsumption
// 30 vs 40 vs 0). L'appelant bloque alors le calcul dépendant (pas de chiffre
// inventé) et signale « non renseigné ».

/**
 * Vitesse de croisière (kt) : cruiseSpeedKt prioritaire, sinon cruiseSpeed.
 * @returns {number|null} kt, ou null si absente/≤0.
 */
export function getCruiseSpeedKt(aircraft) {
  if (!aircraft) return null;
  const v = parseFloat(aircraft.cruiseSpeedKt ?? aircraft.cruiseSpeed);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Consommation horaire (L/h) — convention canonique : fuelConsumption est en lph.
 * @returns {number|null} lph, ou null si absente/≤0.
 */
export function getFuelConsumptionLph(aircraft) {
  if (!aircraft) return null;
  const v = parseFloat(aircraft.fuelConsumption);
  return Number.isFinite(v) && v > 0 ? v : null;
}
