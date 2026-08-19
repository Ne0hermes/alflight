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

/**
 * 🔧 LOT 8 — Capacité carburant TOTALE (L) : fuelCapacity prioritaire, sinon
 * fuel.capacity. Convention CANONIQUE litres (aircraftStore) — PAS d'heuristique
 * gallons ici : elle gonflerait ×3,785 la capacité d'un ULM à 55 L et
 * SUPPRIMERAIT l'alerte d'autonomie (fail-open interdit, règle A5). Une vieille
 * donnée réellement en gallons sous-estime la capacité → alerte à tort, jamais
 * l'inverse. Null si absente/≤0 (fail-closed).
 * @returns {number|null} litres, ou null.
 */
export function getFuelCapacityLtr(aircraft) {
  if (!aircraft) return null;
  const raw = parseFloat(aircraft.fuelCapacity ?? aircraft.fuel?.capacity);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

/**
 * ⛽ Carburant UTILISABLE en litres — LA borne des calculs d'autonomie, de
 * bilan et d'escales (17/08/2026). La capacité PHYSIQUE (getFuelCapacityLtr)
 * servait partout de borne « ça tient dans les réservoirs » : elle surestimait
 * l'embarquable de l'inutilisable (13 L sur un F150M) et pouvait masquer le
 * besoin d'une escale carburant. Priorité au champ dédié, repli sur l'ancien
 * `fuel.unusable` (vieux schéma : total − inutilisable), puis sur la capacité
 * physique — mieux vaut l'ancienne borne que pas de borne du tout, et la fiche
 * reste signalée incomplète tant que l'utilisable n'est pas saisi.
 * @returns {number|null} litres, ou null.
 */
export function getFuelUsableCapacityLtr(aircraft) {
  if (!aircraft) return null;
  const usable = parseFloat(aircraft.fuelUsableCapacity);
  if (Number.isFinite(usable) && usable > 0) return usable;
  const total = getFuelCapacityLtr(aircraft);
  const unusable = parseFloat(aircraft.fuel?.unusable);
  if (total !== null && Number.isFinite(unusable) && unusable >= 0 && unusable < total) {
    return total - unusable;
  }
  return total;
}

/**
 * 🔧 R3 (audit score déroutements) — Distance d'atterrissage POH en MÈTRES.
 * Source : aircraft.distances.landingDistance50ft (convention POH en PIEDS,
 * cf. RunwayAnalyzer/runwayCompatibility qui comparent ces champs à des ft),
 * repli landingDistance15m. Null si absente/≤0 (fail-closed) : l'appelant
 * choisit son propre repli ET le signale — pas de valeur inventée ici.
 * @returns {number|null} mètres, ou null.
 */
export function getLandingDistanceM(aircraft) {
  if (!aircraft) return null;
  const ft = parseFloat(
    aircraft.distances?.landingDistance50ft ?? aircraft.distances?.landingDistance15m
  );
  return Number.isFinite(ft) && ft > 0 ? ft * 0.3048 : null;
}
