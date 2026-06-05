// ============================================================================
//  src/utils/runwayDirections.js
//  Séparation d'une piste bidirectionnelle (ex. "05/23") en ses DEUX QFU,
//  chacun avec son cap (QFU) et SES distances déclarées propres.
//  ----------------------------------------------------------------------------
//  Pourquoi : une même piste peut avoir des distances déclarées (TORA/TODA/
//  ASDA/LDA) DIFFÉRENTES selon le sens d'utilisation. L'affichage groupé
//  "05/23" mélange les deux et n'expose qu'un seul QFU (bug "QFU 50" pour une
//  piste 05/23). On éclate donc en deux entrées : "05" (QFU 050) et "23"
//  (QFU 230), chacune avec ses propres distances.
//
//  Source de données (cf. GeoJSONProvider.buildVACRunway) :
//   - runway.declaredDistances = { "05": { TORA, TODA, ASDA, LDA }, "23": {...} }
//     (clés MAJUSCULES, par sens). Fallback : valeurs à plat runway.tora/...
// ============================================================================

function pickDistance(perDir, runway, upper, lower) {
  const v = (perDir && (perDir[upper] ?? perDir[lower])) ?? runway[lower];
  return (v === undefined || v === null || v === '') ? null : v;
}

/**
 * @param {object} runway  piste telle que fournie par aeroDataProvider
 * @returns {Array<object>} une entrée par sens : { ...runway, runwayNumber, qfu, tora, toda, asda, lda }
 */
export function separateRunwayDirections(runway) {
  if (!runway) return [];

  const designator = String(
    runway.designation || runway.identifier || runway.designator || runway.id || ''
  ).trim();

  // declaredDistances (provider) ou distancesByDirection (legacy alternates)
  const decl = runway.declaredDistances || runway.distancesByDirection || {};

  const buildDir = (rawIdent) => {
    const ident = String(rawIdent).trim();
    const perDir = decl[ident] || decl[ident.replace(/[LRC]$/, '')] || null;
    const qfuNum = parseInt(ident, 10);
    return {
      ...runway,
      runwayNumber: ident,                                   // ex. "05"
      qfu: Number.isFinite(qfuNum) ? ((qfuNum * 10) % 360) : (runway.qfu ?? null),
      tora: pickDistance(perDir, runway, 'TORA', 'tora'),
      toda: pickDistance(perDir, runway, 'TODA', 'toda'),
      asda: pickDistance(perDir, runway, 'ASDA', 'asda'),
      lda:  pickDistance(perDir, runway, 'LDA',  'lda'),
    };
  };

  if (designator.includes('/')) {
    return designator.split('/').map((s) => buildDir(s)).filter((d) => d.runwayNumber);
  }
  if (designator) return [buildDir(designator)];
  // Pas de désignateur exploitable : on renvoie la piste telle quelle.
  return [{ ...runway, runwayNumber: designator, qfu: runway.qfu ?? null }];
}

/** Aplati une liste de pistes en liste de directions (QFU). */
export function expandRunwaysByDirection(runways) {
  if (!Array.isArray(runways)) return [];
  return runways.flatMap(separateRunwayDirections);
}

export default { separateRunwayDirections, expandRunwaysByDirection };
