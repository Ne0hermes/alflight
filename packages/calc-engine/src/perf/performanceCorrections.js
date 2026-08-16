// src/utils/performanceCorrections.js
// ============================================================================
// ✈️ FACTEURS CORRECTIFS DE PERFORMANCE (2026-08-16, validé par César)
// ----------------------------------------------------------------------------
// La plupart des manuels de vol ne donnent pas de tableaux pour le vent ou
// l'état de piste mais des FACTEURS : « ×0,85 par 10 kt de vent de face »,
// « +10 % par tranche de 2 kt de vent arrière », « +15 % piste en herbe ».
//
// Modèle stocké sur l'avion (aircraft.performanceCorrections, saisi par
// l'admin dans le wizard — étape Performances) :
//   { id, type: 'headwind'|'tailwind'|'grass'|'wet_grass'|'wet_paved'|
//           'soft_ground'|'high_grass'|'other',
//     label?,                    // libellé libre (sinon libellé auto)
//     appliesTo: 'takeoff'|'landing'|'both',
//     mode: 'factor_per_step'    // × facteur par tranche de stepKt
//         | 'percent_per_step'   // ± X % par tranche de stepKt (linéaire)
//         | 'percent_fixed',     // ± X % fixe
//     value: number,             // facteur (0.85) ou pourcentage (10, 15)
//     stepKt?: number }          // tranche de vent (modes *_per_step)
//
// RÈGLES DE SÉCURITÉ (arrondis TOUJOURS conservateurs) :
//   - vent de FACE (réduit la distance) : tranches COMPLÈTES uniquement
//     (floor) — on ne crédite jamais une tranche entamée ;
//   - vent ARRIÈRE (augmente la distance) : toute tranche ENTAMÉE compte
//     (ceil) ;
//   - facteur borné à [0.3, 10] — hors bornes : NON appliqué + note ;
//   - surface inconnue : le facteur de surface n'est PAS appliqué et une
//     note explicite le dit (jamais de correction silencieusement omise).
//
// Chaque application produit un DÉTAIL visuel (critère, calcul, résultat)
// pour que le pilote puisse vérifier contre son manuel de vol.
// ============================================================================

export const CORRECTION_TYPES = Object.freeze({
  headwind:    { label: 'Vent de face',        kind: 'wind' },
  tailwind:    { label: 'Vent arrière',        kind: 'wind' },
  grass:       { label: 'Piste en herbe',      kind: 'surface', surfaces: ['grass'] },
  high_grass:  { label: 'Herbe haute',         kind: 'manual' },
  wet_grass:   { label: 'Herbe mouillée',      kind: 'manual' },
  wet_paved:   { label: 'Piste dure mouillée', kind: 'manual' },
  soft_ground: { label: 'Terrain meuble',      kind: 'manual' },
  other:       { label: 'Autre',               kind: 'manual' },
});

const PHASE_LABELS = { takeoff: 'décollage', landing: 'atterrissage', both: 'décollage et atterrissage' };

const fmtFactor = (f) => `×${(Math.round(f * 1000) / 1000).toLocaleString('fr-FR')}`;

/** Phrase FR lisible décrivant une règle (wizard, récapitulatif, breakdown). */
export function describeCorrection(c) {
  if (!c) return '';
  const typeLabel = c.label?.trim() || CORRECTION_TYPES[c.type]?.label || c.type;
  let effect = '';
  if (c.mode === 'factor_per_step') {
    effect = `${fmtFactor(Number(c.value))} par ${c.stepKt} kt`;
  } else if (c.mode === 'percent_per_step') {
    const sign = c.type === 'headwind' ? '−' : '+';
    effect = `${sign}${c.value} % par ${c.stepKt} kt`;
  } else {
    const v = Number(c.value);
    effect = v >= 0 ? `+${v} %` : `${v} %`;
  }
  return `${typeLabel} : ${effect} (${PHASE_LABELS[c.appliesTo] || c.appliesTo})`;
}

const FACTOR_MIN = 0.3;
const FACTOR_MAX = 10;

/**
 * Applique les facteurs correctifs d'un avion à une distance calculée.
 *
 * @param {Object} p
 * @param {number} p.distance          distance de base (unité libre, retournée telle quelle)
 * @param {'takeoff'|'landing'} p.phase
 * @param {Array}  p.corrections       aircraft.performanceCorrections
 * @param {Object} p.conditions        { windComponentKt (signé, >0 = face),
 *                                       surface ('grass'|'paved'|…|null) }
 * @returns {{ base, corrected, totalFactor, applied, steps: Array<{
 *   id, label, detail, factor|null, before|null, after|null, note|null }> }}
 */
export function applyPerformanceCorrections({ distance, phase, corrections, conditions }) {
  const base = Number(distance);
  const result = { base, corrected: base, totalFactor: 1, applied: false, steps: [] };
  if (!Number.isFinite(base) || base <= 0 || !Array.isArray(corrections) || corrections.length === 0) {
    return result;
  }

  const wind = Number(conditions?.windComponentKt);
  const surface = conditions?.surface || null;
  let current = base;

  for (const c of corrections) {
    if (!c || (c.appliesTo !== 'both' && c.appliesTo !== phase)) continue;
    const label = c.label?.trim() || CORRECTION_TYPES[c.type]?.label || c.type;
    const kind = CORRECTION_TYPES[c.type]?.kind;

    let factor = null;
    let detail = '';
    let note = null;

    if (c.type === 'headwind' || c.type === 'tailwind') {
      const stepKt = Number(c.stepKt);
      if (!Number.isFinite(stepKt) || stepKt <= 0) continue; // règle mal saisie : ignorée
      if (!Number.isFinite(wind)) {
        note = 'composante de vent indisponible — non appliqué';
      } else if (c.type === 'headwind') {
        if (wind <= 0) continue; // pas de vent de face : rien à créditer
        // 🛡️ Conservateur : tranches COMPLÈTES uniquement
        const n = Math.floor(wind / stepKt);
        if (n <= 0) {
          note = `vent de face ${Math.round(wind)} kt < tranche de ${stepKt} kt — non appliqué (conservateur)`;
        } else {
          factor = c.mode === 'factor_per_step'
            ? Math.pow(Number(c.value), n)
            : 1 - (Number(c.value) / 100) * n;
          detail = `vent de face ${Math.round(wind)} kt → ${n} tranche${n > 1 ? 's' : ''} complète${n > 1 ? 's' : ''} de ${stepKt} kt → ${fmtFactor(factor)}`;
        }
      } else {
        if (wind >= 0) continue; // pas de vent arrière
        const tail = -wind;
        // 🛡️ Conservateur : toute tranche ENTAMÉE compte
        const n = Math.ceil(tail / stepKt);
        factor = c.mode === 'factor_per_step'
          ? Math.pow(Number(c.value), n)
          : 1 + (Number(c.value) / 100) * n;
        detail = `vent arrière ${Math.round(tail)} kt → ${n} tranche${n > 1 ? 's' : ''} de ${stepKt} kt (entamée = due) → ${fmtFactor(factor)}`;
      }
    } else if (kind === 'surface') {
      if (!surface) {
        note = 'surface de piste inconnue — non appliqué : vérifiez manuellement';
      } else if (!CORRECTION_TYPES[c.type].surfaces.includes(surface)) {
        continue; // surface différente (ex. dur) : facteur sans objet
      } else {
        factor = c.mode === 'factor_per_step' ? Number(c.value) : 1 + (Number(c.value) / 100);
        detail = `surface « ${surface === 'grass' ? 'herbe' : surface} » → ${fmtFactor(factor)}`;
      }
    } else {
      // Conditions non détectables automatiquement (herbe haute, piste
      // mouillée, terrain meuble…) : jamais appliqué en silence — signalé
      // au pilote pour application manuelle.
      note = 'condition non détectable automatiquement — à appliquer manuellement si concerné';
    }

    if (factor !== null) {
      if (!Number.isFinite(factor) || factor < FACTOR_MIN || factor > FACTOR_MAX) {
        result.steps.push({ id: c.id, label, detail: '', factor: null, before: null, after: null,
          note: `facteur ${Number.isFinite(factor) ? fmtFactor(factor) : 'invalide'} hors bornes — NON appliqué, vérifiez la règle` });
        continue;
      }
      const before = current;
      current = current * factor;
      result.steps.push({
        id: c.id, label, detail, factor,
        before: Math.round(before), after: Math.round(current), note: null
      });
      result.applied = true;
    } else if (note) {
      result.steps.push({ id: c.id, label, detail: '', factor: null, before: null, after: null, note });
    }
  }

  result.corrected = current;
  result.totalFactor = base > 0 ? current / base : 1;
  return result;
}
