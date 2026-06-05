// src/utils/windComponent.js
//
// Composante de vent SIGNÉE pour le calcul de performance.
// Convention : > 0 = vent de face (réduit la distance), < 0 = vent arrière (augmente).
//
// 🔧 A5 — Si la direction du vent est INDÉTERMINÉE (vent « Variable »/« Calme »,
// pas de piste sélectionnable, ou donnée non numérique), on NE suppose PAS un
// vent de face favorable : compter une vitesse brute « en face » sous-estimerait
// dangereusement les distances de décollage/atterrissage. On retourne alors 0
// (conservateur) + unknown=true pour que l'UI puisse le signaler.

/**
 * @param {number} runwayHeadwindComponent  Composante signée sur la piste active (kt).
 * @returns {{component:number, unknown:boolean}}
 */
export function resolveWindComponent(runwayHeadwindComponent) {
  if (typeof runwayHeadwindComponent === 'number' && Number.isFinite(runwayHeadwindComponent)) {
    return { component: runwayHeadwindComponent, unknown: false };
  }
  return { component: 0, unknown: true };
}
