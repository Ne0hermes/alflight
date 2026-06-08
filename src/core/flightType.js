// src/core/flightType.js
//
// SOURCE UNIQUE DE VÉRITÉ — « type de vol » & réserve réglementaire.
//
// Vocabulaire canonique = celui du navigationStore.flightType :
//   { period: 'jour' | 'nuit', rules: 'VFR' | 'IFR', category: 'local' | 'navigation' }
//
// Le wizard conserve une PROJECTION anglaise dans FlightPlanData.generalInfo
// (dayNight / flightType / flightNature) pour la persistance Supabase, la
// synthèse et les tags PDF. Les helpers de mapping ci-dessous convertissent
// entre les deux : un seul sens fait foi (le store canonique) ; generalInfo
// n'en est qu'un miroir tenu à jour par Step1.
//
// La réserve réglementaire (EASA NCO.OP.125) est calculée ICI et NULLE PART
// AILLEURS : VFR jour = 30 min, VFR nuit = 45 min, IFR = +15 min. Le vol local
// NE réduit PAS le minimum VFR jour (l'ancien « 20 min local jour » était sous
// le seuil réglementaire). Tout consommateur (navigationStore, hooks de
// navigation, bilan carburant) DOIT passer par computeRegulatoryReserveMinutes —
// plus aucune copie de la règle 30/45/+15 ailleurs dans le code.

export const DEFAULT_FLIGHT_TYPE = Object.freeze({
  period: 'jour',
  rules: 'VFR',
  category: 'navigation',
});

// Durées réglementaires (minutes) — un seul endroit où ces nombres existent.
export const BASE_RESERVE_MINUTES = 30;   // VFR jour
export const NIGHT_RESERVE_MINUTES = 45;  // VFR nuit
export const IFR_SUPPLEMENT_MINUTES = 15; // supplément IFR

/**
 * Réserve finale réglementaire en minutes pour un type de vol canonique.
 * Toujours un nombre (défaut = base VFR jour) ; tolère un flightType partiel/absent.
 * @param {{period?: string, rules?: string, category?: string}} [flightType]
 * @returns {number} minutes
 */
export function computeRegulatoryReserveMinutes(flightType) {
  const period = flightType?.period;
  const rules = flightType?.rules;

  let minutes = period === 'nuit' ? NIGHT_RESERVE_MINUTES : BASE_RESERVE_MINUTES;
  if (rules === 'IFR') minutes += IFR_SUPPLEMENT_MINUTES;
  // NCO.OP.125 : category 'local' ne réduit PAS le minimum (pas de « 20 min »).
  return minutes;
}

/**
 * Réserve finale en litres. Fail-closed : consommation absente ⇒ null (on ne
 * fabrique pas de litres), cohérent avec la politique « pas d'invention » des
 * moteurs de navigation.
 * @param {object} [flightType]
 * @param {number|null|undefined} fuelConsumptionLph
 * @returns {number|null}
 */
export function computeRegulatoryReserveLiters(flightType, fuelConsumptionLph) {
  if (fuelConsumptionLph == null) return null;
  return (computeRegulatoryReserveMinutes(flightType) / 60) * fuelConsumptionLph;
}

/**
 * Projection canonique (period/rules/category) ⇐ generalInfo (dayNight/flightType/flightNature).
 * Sert à amorcer le store depuis le plan de vol restauré par le wizard.
 * @param {{dayNight?: string, flightType?: string, flightNature?: string}} [generalInfo]
 */
export function generalInfoToFlightType(generalInfo = {}) {
  return {
    period: generalInfo.dayNight === 'night' ? 'nuit' : 'jour',
    rules: generalInfo.flightType === 'IFR' ? 'IFR' : 'VFR',
    category: generalInfo.flightNature === 'local' ? 'local' : 'navigation',
  };
}

/**
 * Projection generalInfo (dayNight/flightType/flightNature) ⇐ canonique.
 * Sert à tenir generalInfo (persistance/synthèse/tags) à jour depuis le store.
 * @param {{period?: string, rules?: string, category?: string}} [flightType]
 */
export function flightTypeToGeneralInfo(flightType = {}) {
  return {
    dayNight: flightType.period === 'nuit' ? 'night' : 'day',
    flightType: flightType.rules === 'IFR' ? 'IFR' : 'VFR',
    flightNature: flightType.category === 'local' ? 'local' : 'navigation',
  };
}
