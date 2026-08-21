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
//     mode: 'factor_per_step'    // × facteur par tranche de stepKt      (vent)
//         | 'percent_per_step'   // ± X % par tranche de stepKt (linéaire, vent)
//         | 'percent_fixed'      // ± X % fixe                           (tous)
//         | 'factor_fixed'       // × facteur fixe                       (surface/état)
//         | 'factor_table'       // TABLEAU DE TRANCHES : un facteur par palier (vent)
//         | 'percent_table',     // TABLEAU DE TRANCHES : un pourcentage par palier (vent)
//     value: number,             // facteur (0.85, 1.15) ou pourcentage (10, 15)
//     stepKt?: number,           // tranche de vent (modes *_per_step)
//     brackets?: Array<{ fromKt: number, value: number }> }  // modes *_table
//
// MODES PAR FAMILLE (kind) DE CONDITION (2026-08-21, demande César) :
//   - kind 'wind'    (headwind, tailwind) : les 5 modes ci-dessus sauf factor_fixed ;
//   - kind 'surface' (grass — détectée automatiquement depuis la piste) et
//     kind 'manual'  (high_grass, wet_grass, wet_paved, soft_ground, other —
//     DÉCLARÉS par le pilote) : 'percent_fixed' (+15 %) ou 'factor_fixed' (×1,15).
//   COMPAT : une règle de surface/état héritée en 'factor_per_step' (ancien
//   contournement de l'éditeur) reste lue comme un FACTEUR BRUT fixe — elle
//   n'est jamais élevée à une puissance, stepKt y est ignoré.
//
// CONDITIONS D'APPLICATION (paramètre `conditions` d'applyPerformanceCorrections) :
//   { windComponentKt,          // composante signée (>0 = face)
//     surface,                  // 'grass'|'paved'|null — pilote le type 'grass'
//     runwayStates?,            // tableau des états DÉCLARÉS par le pilote parmi
//                               // les types de kind 'manual' (ex. ['wet_grass'])
//     windAppliedByAbac? }      // true : la distance sort d'un abaque à PANNEAU
//                               // VENT — les règles de kind 'wind' ne sont PAS
//                               // appliquées (étape explicative), sinon le vent
//                               // compterait deux fois (2026-08-21, F-HFGI)
//   - runwayStates ABSENT (appelant non câblé) : les règles 'manual' ne sont
//     jamais appliquées, une note « à appliquer manuellement » est émise ;
//   - runwayStates PRÉSENT : une règle 'manual' s'applique SI ET SEULEMENT SI
//     son type y est déclaré ; non déclarée, elle est sans objet (ignorée
//     silencieusement, comme une règle herbe sur une piste revêtue).
//
// POURQUOI LES TABLEAUX DE TRANCHES (2026-08-17) :
//   Beaucoup de manuels ne donnent PAS un facteur récurrent mais une table :
//     « Influence du vent de face : pour 10 kt ×0,85, pour 20 kt ×0,65,
//       pour 30 kt ×0,55 » (manuel DR401).
//   Saisir ces trois lignes comme trois règles « par tranche » était le piège :
//   le moteur les multipliait toutes. À 30 kt, 0,614 × 0,65 × 0,55 = 0,2195 —
//   il ne restait que 22 % de la distance. Un tableau se LIT, il ne se cumule
//   pas : une seule règle porte désormais tous ses paliers.
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
  const kind = CORRECTION_TYPES[c.type]?.kind;
  let effect = '';
  if (isTable(c)) {
    const paliers = normalizeBrackets(c.brackets, c.mode);
    effect = paliers.length
      ? paliers.map((p) => `${p.fromKt} kt → ${fmtFactor(p.factor)}`).join(' · ')
      : 'tableau vide';
  } else if (c.mode === 'factor_fixed' || (c.mode === 'factor_per_step' && kind !== 'wind')) {
    // Facteur fixe (surface/état) — inclut la compat des règles héritées en
    // factor_per_step hors vent, que le moteur lit comme un facteur brut.
    effect = `${fmtFactor(Number(c.value))} fixe`;
  } else if (c.mode === 'factor_per_step') {
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

/** La règle porte-t-elle un tableau de tranches ? */
export function isTable(c) {
  return c?.mode === 'factor_table' || c?.mode === 'percent_table';
}

/**
 * Paliers triés par vent croissant, valeurs ramenées à des FACTEURS
 * multiplicatifs (un « +15 % » devient 1,15). Les entrées mal saisies sont
 * écartées : un palier sans vent ou sans valeur ne peut rien signifier.
 */
export function normalizeBrackets(brackets, mode) {
  if (!Array.isArray(brackets)) return [];
  return brackets
    .map((b) => {
      const fromKt = Number(b?.fromKt);
      const v = Number(b?.value);
      if (!Number.isFinite(fromKt) || fromKt < 0 || !Number.isFinite(v)) return null;
      return { fromKt, factor: mode === 'percent_table' ? 1 + v / 100 : v };
    })
    .filter(Boolean)
    .sort((a, b) => a.fromKt - b.fromKt);
}

/**
 * Choisit le palier applicable — TOUJOURS dans le sens conservateur.
 *
 *  • vent de FACE (raccourcit la distance) : on prend le palier ATTEINT, jamais
 *    le suivant. À 15 kt sur une table 10/20/30, c'est le palier 10 kt (×0,85)
 *    et non une interpolation vers 0,65 : on ne crédite pas un gain non
 *    démontré par le manuel.
 *  • vent ARRIÈRE (allonge la distance) : on prend le palier SUIVANT, dès qu'il
 *    est entamé. À 7 kt sur une table 5/10, c'est le palier 10 kt : on ne
 *    sous-estime jamais une pénalité.
 *
 * `horsDomaine` signale que la demande dépasse le dernier palier du manuel.
 * Pour un vent arrière, c'est une SOUS-ESTIMATION : l'appelant doit le dire.
 */
export function pickBracket(paliers, composante, type) {
  if (!paliers.length) return { bracket: null, horsDomaine: false };
  const dernier = paliers[paliers.length - 1];
  if (type === 'headwind') {
    let choisi = null;
    for (const p of paliers) if (composante >= p.fromKt) choisi = p;
    return { bracket: choisi, horsDomaine: !!choisi && composante > dernier.fromKt };
  }
  const suivant = paliers.find((p) => composante <= p.fromKt);
  return { bracket: suivant || dernier, horsDomaine: !suivant };
}

/**
 * Applique les facteurs correctifs d'un avion à une distance calculée.
 *
 * @param {Object} p
 * @param {number} p.distance          distance de base (unité libre, retournée telle quelle)
 * @param {'takeoff'|'landing'} p.phase
 * @param {Array}  p.corrections       aircraft.performanceCorrections
 * @param {Object} p.conditions        { windComponentKt (signé, >0 = face),
 *                                       surface ('grass'|'paved'|…|null),
 *                                       runwayStates?, windAppliedByAbac? }
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
  // États de piste DÉCLARÉS par le pilote (null = appelant non câblé → les
  // règles 'manual' restent de simples rappels, jamais appliquées).
  const runwayStates = Array.isArray(conditions?.runwayStates) ? conditions.runwayStates : null;
  // 🛡️ VENT DÉJÀ INTÉGRÉ PAR L'ABAQUE (2026-08-21, ré-audit F-HFGI) : la distance
  // sort d'une chaîne à panneau vent (596 ft vent nul → 520 ft à +8 kt → 775 ft
  // à −5 kt). Appliquer EN PLUS les règles de vent comptait le vent deux fois
  // (×1,3 sur les 775 ft). Les règles de kind 'wind' sont alors SIGNALÉES, jamais
  // multipliées ; surface et états de piste restent corrigés normalement.
  const windAppliedByAbac = conditions?.windAppliedByAbac === true;
  let current = base;

  // 🛡️ GARDE ANTI-CUMUL (2026-08-17, étendue à TOUS les types le 2026-08-21).
  // Deux règles du même type pour la même phase sont AMBIGUËS : le moteur les
  // multipliait, ce qui a produit sur F-HFGI une distance de 220 m là où le
  // manuel en donne 550. Le cas type est la recopie d'un tableau du manuel en
  // trois règles séparées ; pour une surface, c'est une double saisie
  // (« Herbe +15 % » et « Herbe ×1,2 ») qui donnerait ×1,38 au lieu de l'une.
  // On ne devine pas laquelle retenir : on n'applique AUCUNE des règles du type
  // concerné et on le dit. Mieux vaut une distance non corrigée — donc la
  // distance brute, plus longue — qu'une distance fausse et trop courte.
  const applicables = corrections.filter((c) => c && (c.appliesTo === 'both' || c.appliesTo === phase));
  const ambigus = new Set();
  for (const type of Object.keys(CORRECTION_TYPES)) {
    const memeType = applicables.filter((c) => c.type === type);
    if (memeType.length > 1) {
      ambigus.add(type);
      const conseil = CORRECTION_TYPES[type].kind === 'wind'
        ? `Si le manuel donne un tableau (10 kt → ×0,85, 20 kt → ×0,65…), saisissez UNE règle avec ses paliers.`
        : `Gardez une seule règle de ce type par phase sur la fiche avion.`;
      result.steps.push({
        id: `ambigu-${type}`,
        label: CORRECTION_TYPES[type].label,
        detail: '',
        factor: null, before: null, after: null,
        note: `${memeType.length} règles de ce type pour la même phase — AUCUNE appliquée. `
            + `Elles se multiplieraient au lieu de se lire. ${conseil}`,
      });
    }
  }

  // Facteur FIXE d'une règle de surface/état : 'factor_fixed' (×1,15) ou
  // 'percent_fixed' (+15 % → ×1,15). COMPAT : une règle héritée en
  // 'factor_per_step' (ancien contournement) est lue comme un facteur brut.
  const fixedFactor = (c) => (c.mode === 'factor_fixed' || c.mode === 'factor_per_step')
    ? Number(c.value)
    : 1 + (Number(c.value) / 100);
  // « Herbe mouillée » → « herbe mouillée » pour le détail lisible.
  const minuscule = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

  for (const c of corrections) {
    if (!c || (c.appliesTo !== 'both' && c.appliesTo !== phase)) continue;
    if (ambigus.has(c.type)) continue;
    const label = c.label?.trim() || CORRECTION_TYPES[c.type]?.label || c.type;
    const kind = CORRECTION_TYPES[c.type]?.kind;

    if (kind === 'wind' && windAppliedByAbac) {
      // Étape VISIBLE (pas un silence) : le pilote voit pourquoi sa règle de
      // vent n'a pas joué sur cette opération.
      result.steps.push({ id: c.id, label, detail: '', factor: null, before: null, after: null,
        note: 'vent déjà intégré par l\'abaque (panneau vent) — règle non appliquée' });
      continue;
    }

    let factor = null;
    let detail = '';
    let note = null;

    if ((c.type === 'headwind' || c.type === 'tailwind') && isTable(c)) {
      // ── TABLEAU DE TRANCHES : on LIT le palier, on ne cumule rien ──────────
      const paliers = normalizeBrackets(c.brackets, c.mode);
      if (!paliers.length) continue;                       // règle vide : ignorée
      const composante = c.type === 'headwind' ? wind : -wind;
      if (!Number.isFinite(wind)) {
        note = 'composante de vent indisponible — non appliqué';
      } else if (composante <= 0) {
        continue;                                          // vent dans l'autre sens
      } else {
        const pick = pickBracket(paliers, composante, c.type);
        if (!pick.bracket) {
          note = `${c.type === 'headwind' ? 'vent de face' : 'vent arrière'} ${Math.round(composante)} kt `
               + `sous le premier palier (${paliers[0].fromKt} kt) — non appliqué (conservateur)`;
        } else {
          factor = pick.bracket.factor;
          detail = `${c.type === 'headwind' ? 'vent de face' : 'vent arrière'} ${Math.round(composante)} kt → `
                 + `palier ${pick.bracket.fromKt} kt → ${fmtFactor(factor)}`;
          if (pick.horsDomaine) {
            note = `au-delà du dernier palier du manuel (${paliers[paliers.length - 1].fromKt} kt) — `
                 + `palier le plus fort appliqué, À VÉRIFIER au manuel de vol`;
          }
        }
      }
    } else if (c.type === 'headwind' || c.type === 'tailwind') {
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
        factor = fixedFactor(c);
        detail = `surface « ${surface === 'grass' ? 'herbe' : surface} » → ${fmtFactor(factor)}`;
      }
    } else if (runwayStates === null) {
      // Appelant non câblé : conditions non détectables automatiquement (herbe
      // haute, piste mouillée, terrain meuble…) jamais appliquées en silence —
      // signalées au pilote pour application manuelle.
      note = 'condition non détectable automatiquement — à appliquer manuellement si concerné';
    } else if (!runwayStates.includes(c.type)) {
      continue; // état non déclaré par le pilote : règle sans objet
    } else {
      // État DÉCLARÉ par le pilote (2026-08-21) : la règle s'applique comme un
      // facteur fixe ; le détail rappelle que c'est une déclaration, pas une
      // détection, pour que le pilote la vérifie.
      factor = fixedFactor(c);
      detail = `état « ${minuscule(CORRECTION_TYPES[c.type]?.label || c.type)} » déclaré → ${fmtFactor(factor)}`;
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
        // La note est CONSERVÉE même quand le facteur s'applique : c'est ainsi
        // qu'on signale « au-delà du dernier palier du manuel » sur une valeur
        // pourtant calculée. Elle était écrasée par null, donc invisible.
        id: c.id, label, detail, factor,
        before: Math.round(before), after: Math.round(current), note: note || null
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
