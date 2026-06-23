// src/utils/numericInput.js
//
// Saisie numérique TOLÉRANTE pour les champs contrôlés (masse, carburant,
// bagages, bras…). Corrige le bug « la virgule / la suppression d'un chiffre
// remet le champ à 0 » : les `<input type="number">` blanchissent e.target.value
// dès qu'on tape une virgule (séparateur décimal FR invalide pour le format
// numérique HTML), et les handlers `parseFloat(v) || 0` transforment tout état
// transitoire ('', '4,', '4.') en 0.
//
// Règle : on saisit en `type="text" inputMode="decimal"`, on tolère la virgule
// ET les états transitoires, et on ne RÉINITIALISE jamais sur une saisie
// incomplète — c'est l'appelant qui décide quoi propager au modèle.

/**
 * Forme autorisée d'un champ décimal EN COURS de saisie (≥ 0) :
 * chiffres + UN séparateur décimal (point ou virgule) optionnel, parties
 * entière/décimale optionnelles → tolère '', '4', '4,', '4.', '4,5', '.5'.
 * Refuse lettres, séparateurs multiples, etc. (la saisie est alors ignorée
 * SANS reset).
 */
export const DECIMAL_INPUT_RE = /^\d*[.,]?\d*$/;

/** Idem mais autorise un signe `-` en tête (bras de levier, CG négatifs). */
export const SIGNED_DECIMAL_INPUT_RE = /^-?\d*[.,]?\d*$/;

/**
 * Parse une saisie décimale tolérante à la virgule. Renvoie un nombre FINI, ou
 * `null` si vide / incomplète / invalide ('', '4,', '.', '-', 'abc').
 *
 * IMPORTANT : ne renvoie JAMAIS 0 par défaut sur une saisie vide/incomplète —
 * c'est ce comportement (`|| 0`) qui causait les resets parasites. L'appelant
 * gère explicitement le cas `null`.
 *
 * @param {string|number|null|undefined} raw
 * @returns {number|null}
 */
export function parseDecimalInput(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim().replace(',', '.');
  if (s === '' || s === '.' || s === '-' || s === '-.' || s === '+') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Compare deux nombres à epsilon près (sync prop ↔ saisie sans faux positifs). */
export function numbersClose(a, b, eps = 1e-9) {
  const na = Number(a), nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return na === nb;
  return Math.abs(na - nb) <= eps;
}
