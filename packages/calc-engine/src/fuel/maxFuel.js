// src/utils/maxFuel.js
// Bouton « Volume Max » (Lot 5) : carburant maximal embarquable, borné par la
// masse disponible jusqu'à la MTOW ET par la capacité des réservoirs cochés.
//
// Convention P0 du projet : fail-closed — aucune densité ni masse inventée.
// Répartition DANS L'ORDRE DE LA LISTE des réservoirs (même convention
// déterministe que la consommation à l'atterrissage, cf. fuelArm.js : l'ordre
// de la liste est la séquence réelle d'utilisation validée par le pilote).
import { getFuelDensity } from '../units/fuelDensity.js';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * @param {object} aircraft - avion EFFECTIF (variante déjà appliquée)
 * @param {number} zfwKg - masse à vide + charges hors carburant (kg)
 * @param {string[]|null} activeTankIds - clés des réservoirs cochés
 *   (String(id ?? index)) ; null = config non engagée → tous les réservoirs
 * @returns {{ ok:true, litresMax:number, perTank:Array<{key:string, ltr:number}>,
 *            limitedBy:'mtow'|'capacity', massAvailableKg:number }
 *          | { ok:false, error:'fuelDensity'|'weights'|'noTanks' }}
 */
export function computeMaxFuel({ aircraft, zfwKg, activeTankIds = null }) {
  const density = getFuelDensity(aircraft?.fuelType);
  if (density == null) return { ok: false, error: 'fuelDensity' };

  const mtow = num(aircraft?.weights?.mtow) ?? num(aircraft?.maxTakeoffWeight);
  const zfw = num(zfwKg);
  if (mtow == null || zfw == null) return { ok: false, error: 'weights' };

  const massAvailableKg = Math.max(0, mtow - zfw);
  const litresFromMass = massAvailableKg / density;

  const tanks = Array.isArray(aircraft?.additionalFuelTanks) ? aircraft.additionalFuelTanks : [];
  const activeSet = activeTankIds == null ? null : new Set(activeTankIds.map(String));

  // Réservoirs considérés : cochés (ou tous si config non engagée), capacité > 0
  const usable = tanks
    .map((t, i) => ({ key: String(t?.id ?? i), cap: num(t?.capacity) ?? 0 }))
    .filter(t => t.cap > 0)
    .filter(t => activeSet == null || activeSet.has(t.key));

  // ⚠️ Le repli « capacité globale » n'existe QUE pour les avions legacy SANS
  // réservoirs détaillés. Des réservoirs déclarés mais aucun d'utilisable
  // (pilote a tout décoché : activeTankIds = []) = erreur explicite, pas un
  // remplissage silencieux sur une capacité fantôme.
  if (tanks.length > 0 && usable.length === 0) return { ok: false, error: 'noTanks' };

  const capacityLtr = usable.length > 0
    ? usable.reduce((s, t) => s + t.cap, 0)
    : (num(aircraft?.fuelCapacity) ?? 0);
  if (capacityLtr <= 0) return { ok: false, error: 'noTanks' };

  // Arrondi vers le BAS (0,1 L) : un arrondi au plus proche pouvait dépasser
  // la MTOW de quelques dizaines de grammes ou la capacité d'un réservoir de
  // 0,05 L — et déclencher les alertes de dépassement au clic même du bouton.
  const floor1 = (v) => Math.floor(v * 10) / 10;
  const litresMax = floor1(Math.min(capacityLtr, litresFromMass));
  const limitedBy = litresFromMass < capacityLtr ? 'mtow' : 'capacity';

  // Répartition dans l'ordre de la liste : chaque réservoir coché reçoit
  // min(sa capacité, le reste) — déterministe et retouchable après coup.
  let remaining = litresMax;
  const perTank = usable.map(t => {
    const take = floor1(Math.min(t.cap, Math.max(0, remaining)));
    remaining = Math.max(0, remaining - take);
    return { key: t.key, ltr: take };
  });

  return {
    ok: true,
    litresMax,
    perTank,
    limitedBy,
    massAvailableKg: Math.round(massAvailableKg * 10) / 10
  };
}
