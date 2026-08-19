// packages/calc-engine/src/fuel/tankCapacity.js
//
// ⛽ DEUX CONTENANCES PAR RÉSERVOIR (17/08/2026, validé par César).
//
// Le manuel de vol donne presque toujours DEUX volumes : la capacité TOTALE
// (F150M : 98 L) et le carburant UTILISABLE (85 L). L'ancien modèle n'avait
// qu'un champ `capacity`, à la sémantique ambiguë — et le champ racine
// `fuelCapacity`, recalculé comme somme des réservoirs, écrasait le total du
// manuel (cas F-BXQT : 98 → 85, sans recours possible, champ grisé).
//
// CONVENTION (aéronautique, non négociable) :
//   • la masse à vide d'une pesée INCLUT le carburant inutilisable ;
//   • la ligne « carburant » d'un devis de masse est donc l'UTILISABLE seul —
//     compter le total pèserait l'inutilisable deux fois (+9,4 kg sur F-BXQT) ;
//   • autonomie, bilan carburant, escales : UTILISABLE ;
//   • avitaillement, documentation : TOTALE.
//
// COMPATIBILITÉ : les fiches antérieures n'ont que `capacity`. On le lit comme
// l'UTILISABLE (`usableCapacity ?? capacity`) : c'est exact pour les fiches du
// wizard moderne et l'extraction par réservoir, et déduire l'utilisable d'un
// total exigerait un facteur inventé — interdit. Aucune écriture de masse en
// base : un champ absent reste absent, la fiche est signalée incomplète tant
// que le pilote n'a pas saisi les deux valeurs.

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

/** Litres UTILISABLES d'un réservoir — LA grandeur des moteurs de calcul. */
export function tankUsableLtr(tank) {
  return num(tank?.usableCapacity) ?? num(tank?.capacity);
}

/** Litres TOTAUX d'un réservoir — avitaillement et documentation. */
export function tankTotalLtr(tank) {
  return num(tank?.totalCapacity) ?? num(tank?.capacity);
}

/** Litres INUTILISABLES d'un réservoir — dérivé, jamais stocké. null si l'un
 *  des deux volumes manque (fail-closed : on ne fabrique pas un zéro). */
export function tankUnusableLtr(tank) {
  const total = num(tank?.totalCapacity);
  const usable = num(tank?.usableCapacity);
  if (total === null || usable === null) return null;
  return Math.max(0, total - usable);
}

/** Somme des litres utilisables d'une liste de réservoirs (ceux à contenance
 *  exploitable), ou null si la liste est vide. */
export function sumUsableLtr(tanks) {
  const list = Array.isArray(tanks) ? tanks : [];
  const vals = list.map(tankUsableLtr).filter((v) => v !== null && v > 0);
  return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
}

/** Somme des litres totaux, mêmes règles. */
export function sumTotalLtr(tanks) {
  const list = Array.isArray(tanks) ? tanks : [];
  const vals = list.map(tankTotalLtr).filter((v) => v !== null && v > 0);
  return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
}
