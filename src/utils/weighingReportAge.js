// src/utils/weighingReportAge.js
//
// Âge du rapport de pesée — utilitaire UNIQUE partagé entre le wizard avion
// (Step3 M&C : date de pesée obligatoire) et la préparation de vol (Step6 :
// indicateur d'ancienneté sur le devis de masse).
//
// Règle opérationnelle (demande pilote) : au-delà de 10 ans, avertissement
// LÉGER (non bloquant) rappelant au CdB de vérifier qu'une pesée plus récente
// n'existe pas et, le cas échéant, d'importer le nouveau rapport dans la
// fiche avion.

export const WEIGHING_REPORT_WARN_YEARS = 10;

/**
 * Calcule l'âge d'un rapport de pesée à partir de sa date de certification.
 *
 * @param {string|Date|null|undefined} certificationDate — date portée sur le
 *   rapport (pas la date d'import dans l'app). Chaîne ISO `yyyy-mm-dd` ou Date.
 * @param {Date} [now] — horloge injectable (tests).
 * @returns {null | {
 *   date: Date,            // date de pesée parsée
 *   years: number,         // âge en années révolues (0 si < 1 an)
 *   isOld: boolean,        // true si >= WEIGHING_REPORT_WARN_YEARS
 *   ageLabel: string       // « 11 ans », « 1 an », « 8 mois », « ce mois-ci »
 * }} null si la date est absente ou invalide.
 */
export function getWeighingReportAge(certificationDate, now = new Date()) {
  if (!certificationDate) return null;
  const date = certificationDate instanceof Date ? certificationDate : new Date(certificationDate);
  if (isNaN(date.getTime())) return null;

  // Années révolues : anniversaire non encore passé → année en moins.
  let years = now.getFullYear() - date.getFullYear();
  const anniversary = new Date(date);
  anniversary.setFullYear(date.getFullYear() + years);
  if (anniversary > now) years -= 1;
  if (years < 0) years = 0; // date future (saisie incohérente) : pas d'âge négatif

  let ageLabel;
  if (years >= 1) {
    ageLabel = `${years} an${years > 1 ? 's' : ''}`;
  } else {
    const months = Math.max(
      0,
      (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth()) - (now.getDate() < date.getDate() ? 1 : 0)
    );
    ageLabel = months >= 1 ? `${months} mois` : 'ce mois-ci';
  }

  return { date, years, isOld: years >= WEIGHING_REPORT_WARN_YEARS, ageLabel };
}

/** Phrase de rappel CdB affichée quand la pesée dépasse le seuil. */
export const WEIGHING_REPORT_REMINDER =
  `Rapport de pesée de plus de ${WEIGHING_REPORT_WARN_YEARS} ans — vérifiez qu'il n'existe pas ` +
  `un rapport de pesée plus récent pour cet avion. S'il en existe un, importez-le dans la fiche ` +
  `avion (module Aéronefs) pour mettre à jour les calculs de masse et centrage.`;
