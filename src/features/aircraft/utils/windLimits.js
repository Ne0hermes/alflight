// src/features/aircraft/utils/windLimits.js
// ============================================================================
// 🛡️ LIMITATIONS DE VENT — préservation du format ACTUEL (`limits[]`)
// ----------------------------------------------------------------------------
// PERTE DE DONNÉES CONSTATÉE LE 23/08/2026 (signalée par le pilote) : « sur la
// limitation des vents, il n'a pas enregistré, et alors que les données étaient
// présentes sur le serveur, en sauvegardant elles ont disparu. »
//
// Cause : les deux formulaires reconstruisaient `windLimits` à partir des SEULS
// trois champs historiques (maxCrosswind / maxTailwind / maxCrosswindWet). La
// liste `limits[]` — le format actuel, saisi à l'étape Vitesses du wizard —
// n'était pas dans l'état initial, donc absente de l'objet enregistré : elle
// disparaissait de la base sans qu'aucune modification n'ait été faite.
// Vérifié en base le 23/08 : F-BXNG, F-GNAM et F-HDIM avaient perdu leurs
// limites lors des sauvegardes du 21/08.
//
// Règle : un formulaire qui n'ÉDITE PAS un champ ne doit JAMAIS le supprimer.
// ============================================================================

/** Vrai si la valeur compte comme saisie (0 est une valeur, '' non). */
const renseigne = (v) => v !== '' && v !== null && v !== undefined;

/**
 * État initial du bloc « limitations de vent » d'un formulaire, à partir de la
 * fiche existante : les trois champs historiques éditables + TOUT le reste
 * conservé tel quel (au premier chef `limits[]`).
 */
export function initialWindLimits(aircraft) {
  const w = aircraft?.windLimits || {};
  const manex = aircraft?.manex?.limitations || {};
  return {
    ...w,
    maxCrosswind: w.maxCrosswind || manex.maxCrosswind || '',
    maxTailwind: w.maxTailwind || manex.maxTailwind || '',
    maxCrosswindWet: w.maxCrosswindWet || '',
    limits: Array.isArray(w.limits) ? w.limits : []
  };
}

/**
 * Objet `windLimits` à enregistrer : met à jour les trois champs historiques
 * saisis dans le formulaire SANS jamais perdre `limits[]` ni les autres clés.
 * Rend `undefined` seulement si l'avion n'a réellement aucune limitation.
 *
 * @param {object|null} existantes  aircraft.windLimits actuel (source de vérité)
 * @param {object|null} formulaire  { maxCrosswind, maxTailwind, maxCrosswindWet }
 * @param {(v:any, d:number)=>number} [toNumber]  conversion du formulaire legacy
 */
export function mergeWindLimitsForSave(existantes, formulaire, toNumber) {
  const w = existantes || {};
  const f = formulaire || {};
  const liste = Array.isArray(w.limits) ? w.limits : [];
  const legacySaisi = ['maxCrosswind', 'maxTailwind', 'maxCrosswindWet'].some((k) => renseigne(f[k]));

  if (!legacySaisi && liste.length === 0) {
    // Rien à enregistrer : ni liste, ni champ historique.
    const autresCles = Object.keys(w).filter((k) => k !== 'limits' && renseigne(w[k]));
    return autresCles.length > 0 ? { ...w } : undefined;
  }

  const conv = typeof toNumber === 'function' ? toNumber : (v) => (renseigne(v) ? Number(v) : v);
  return {
    ...w,
    ...(liste.length > 0 ? { limits: liste } : {}),
    ...(legacySaisi
      ? {
          maxCrosswind: conv(f.maxCrosswind, 0),
          maxTailwind: conv(f.maxTailwind, 0),
          maxCrosswindWet: conv(f.maxCrosswindWet, 0)
        }
      : {})
  };
}
