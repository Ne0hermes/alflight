// src/services/abacInterpolation.js
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║   INTERPOLATION IDW MULTI-COURBE POUR LES ABAQUES                   ║
// ║                                                                      ║
// ║   Source de vérité unique partagée entre :                           ║
// ║   - AbaqueTestSections (PerformanceModule, "tests d'interpolation") ║
// ║   - operationResolver (résolveur Phase 2 → matrice de couverture)   ║
// ║                                                                      ║
// ║   Stratégie : aplatir toutes les courbes de tous les graphes en un   ║
// ║   nuage de points 4D {temperature, pressure_altitude, mass, wind},   ║
// ║   chaque point portant la distance Y associée. Pour une condition    ║
// ║   donnée, on cherche les 4 points les plus proches en distance       ║
// ║   euclidienne (avec poids par dimension) et on interpole en IDW.     ║
// ║                                                                      ║
// ║   Cette approche traite naturellement les abaques multi-courbes      ║
// ║   paramétrés (ex: courbes par altitude "0ft", "2000ft", "4000ft"),  ║
// ║   à condition que les noms de courbes contiennent une valeur         ║
// ║   numérique parsable (regex /\d+/).                                  ║
// ║                                                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

/** Statuts retournés. */
export const InterpolationStatus = Object.freeze({
  OK:          'OK',
  NO_POINTS:   'NO_POINTS',
  NO_GRAPH:    'NO_GRAPH',
  ERROR:       'ERROR'
});

/**
 * Convertit des inputs "matrice" (format operationResolver) vers le format
 * conditions attendu par l'interpolateur IDW.
 */
export function inputsToConditions(inputs = {}) {
  return {
    temperature:       inputs.oat            ?? inputs.temperature       ?? 15,
    pressure_altitude: inputs.pressureAltitude ?? inputs.pressure_altitude ?? 0,
    mass:              inputs.mass           ?? inputs.massTakeoff       ?? inputs.massLanding ?? 1000,
    wind:              inputs.headwind       ?? inputs.windComponent     ?? inputs.wind ?? 0
  };
}

/**
 * Extrait tous les points d'un abaque (toutes courbes, tous graphes) sous
 * forme de points 4D : {temperature, pressure_altitude, mass, wind, distance}.
 *
 * - Parcourt `abaqueData.graphs[].curves[].points[]`
 * - Mappe `point.x` selon le titre/type de l'axe X (temperature / mass / wind / distance)
 * - Mappe `point.y` selon le titre/type de l'axe Y (en général : distance)
 * - Extrait la valeur du paramètre familial depuis le nom de courbe (regex /\d+/)
 *   et la stocke dans `pressure_altitude` (cas le plus courant : courbes paramétrées par alt)
 *
 * @param {object} abaqueData     L'objet `model.data` (AbacCurvesJSON) ou `graph` directement
 * @param {object} defaultCond    Conditions par défaut pour combler les dimensions non couvertes
 * @returns {Array<object>}       Liste de points 4D + distance
 */
export function extractPoints(abaqueData, defaultCond = {}) {
  const out = [];
  if (!abaqueData) return out;

  // Accepte soit un abaque complet (avec .graphs[]) soit un graph isolé (avec .curves[])
  const graphs = Array.isArray(abaqueData.graphs) ? abaqueData.graphs
                : (Array.isArray(abaqueData.curves) ? [abaqueData] : []);

  for (const graph of graphs) {
    if (!Array.isArray(graph.curves)) continue;

    const xAxis = graph.axes?.xAxis || graph.xAxis || {};
    const yAxis = graph.axes?.yAxis || graph.yAxis || {};
    const xTitle = String(xAxis.title || '').toLowerCase();
    const yTitle = String(yAxis.title || '').toLowerCase();

    /** Mappe un nombre brut vers la dimension correspondante. */
    const mapAxis = (rawTitle, value, target) => {
      if (rawTitle.includes('temp') || rawTitle === 'oat') target.temperature = value;
      else if (rawTitle.includes('mass') || rawTitle.includes('weight')) target.mass = value;
      else if (rawTitle.includes('wind') || rawTitle.includes('vent') || rawTitle.includes('headwind') || rawTitle.includes('tailwind')) target.wind = value;
      else if (rawTitle.includes('pressure_alt') || rawTitle.includes('altitude') || rawTitle.includes('pression') || rawTitle === 'pa') target.pressure_altitude = value;
      else if (rawTitle.includes('distance') || rawTitle.includes('takeoff_distance') || rawTitle.includes('landing_distance') || rawTitle.includes('intermediate_distance')) target.distance = value;
      // Sinon, on ignore : variable inconnue
    };

    for (const curve of graph.curves) {
      const pts = Array.isArray(curve.points) ? curve.points : [];
      if (pts.length === 0) continue;

      // Extraction STRICTE du paramètre familial depuis le nom de courbe :
      //   - Le nom doit COMMENCER par un nombre (sinon on ignore — évite que
      //     "headwind 1" se fasse interpréter comme altitude=1)
      //   - L'unité optionnelle après le nombre détermine la dimension :
      //       "ft" / "m" / "fl" → altitude pression
      //       "°c" / "°f"       → température
      //       "kg" / "lb"       → masse
      //   - Cas spécial : nombre seul sans unité → altitude (comportement legacy
      //     `parseInt(curve.name)` qui marche pour les noms "0", "2000", etc.)
      //
      // Exemples :
      //   "0 ft"     → altitude=0          ✓
      //   "2000 ft"  → altitude=2000       ✓
      //   "20°C"     → temperature=20      ✓
      //   "850 kg"   → mass=850            ✓
      //   "2000"     → altitude=2000       ✓ (bare number = legacy convention)
      //   "headwind 1" → null              ✗ ne commence pas par un chiffre → ignoré
      //   "courbe 2"   → null              ✗ idem
      const curveName = String(curve.name || '').trim();
      const leadingNum = curveName.match(/^(-?\d+(?:\.\d+)?)\s*([a-z°]*)/i);
      let familyValue = null;
      let familyKind = null; // 'altitude' | 'temperature' | 'mass' | null
      if (leadingNum) {
        familyValue = parseFloat(leadingNum[1]);
        const unit = (leadingNum[2] || '').toLowerCase();
        if (/^(ft|m|fl)/.test(unit))          familyKind = 'altitude';
        else if (/^°?[cf]$/.test(unit))       familyKind = 'temperature';
        else if (/^(kg|lb)/.test(unit))       familyKind = 'mass';
        else if (unit === '')                  familyKind = 'altitude'; // bare number convention
        else                                   familyKind = null;
      }

      for (const point of pts) {
        const pt = {
          temperature:       defaultCond.temperature       ?? 15,
          pressure_altitude: defaultCond.pressure_altitude ?? 0,
          mass:              defaultCond.mass              ?? 1000,
          wind:              defaultCond.wind              ?? 0,
          distance:          0
        };

        // Mapper le X / Y selon les axes
        mapAxis(xTitle, point.x, pt);
        mapAxis(yTitle, point.y, pt);

        // Appliquer le paramètre familial UNIQUEMENT si on a identifié sa dimension
        if (familyValue !== null && familyKind) {
          if (familyKind === 'altitude')       pt.pressure_altitude = familyValue;
          else if (familyKind === 'temperature') pt.temperature     = familyValue;
          else if (familyKind === 'mass')      pt.mass              = familyValue;
        }
        // Sinon (ex: "headwind 1"), on garde les valeurs héritées de defaultCond

        out.push(pt);
      }
    }
  }

  return out;
}

/**
 * Cœur de l'algorithme : interpolation IDW 4D entre les k points les plus proches.
 *
 * @param {Array}  points       Tableau de points {temperature, pressure_altitude, mass, wind, distance}
 * @param {object} conditions   {temperature, pressure_altitude, mass, wind}
 * @param {object} [opts]
 * @param {number} [opts.k=4]   Nombre de voisins
 * @returns {{ value, confidence, nearestPoints }}
 */
export function idwInterpolate(points, conditions, opts = {}) {
  const k = opts.k ?? 4;
  if (!points || points.length === 0) return null;

  // Échelles de normalisation (mêmes que le legacy AbaqueTestSections)
  const distances = points.map(point => {
    const tempDiff = (point.temperature      - conditions.temperature)       / 30;
    const altDiff  = (point.pressure_altitude - conditions.pressure_altitude) / 2000;
    const massDiff = (point.mass             - conditions.mass)              / 100;
    const windDiff = (point.wind             - conditions.wind)              / 10;
    const distance = Math.sqrt(tempDiff*tempDiff + altDiff*altDiff + massDiff*massDiff + windDiff*windDiff);
    return { point, distance };
  });

  distances.sort((a, b) => a.distance - b.distance);
  const nearestPoints = distances.slice(0, k);

  // Si on tombe pile sur un point (distance ~ 0), on retourne directement sa valeur
  if (nearestPoints[0].distance < 1e-6) {
    return {
      value: nearestPoints[0].point.distance,
      confidence: 100,
      nearestPoints: nearestPoints.map(p => p.point)
    };
  }

  let totalWeight = 0;
  let weightedSum = 0;
  for (const { point, distance } of nearestPoints) {
    const weight = 1 / (distance + 0.001); // éviter div/0
    totalWeight += weight;
    weightedSum += point.distance * weight;
  }

  const value = weightedSum / totalWeight;
  const confidence = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, nearestPoints[0].distance)) * 100)));

  return {
    value,
    confidence,
    nearestPoints: nearestPoints.map(p => p.point)
  };
}

// ─────────────────────────────────────────────────────────────────────────
// INTERPOLATION BRACKET 2D — "lecture pilote"
// ─────────────────────────────────────────────────────────────────────────

/** Mappe un titre d'axe (operationId de variable canonique) vers une dimension de conditions. */
function mapTitleToConditionDim(title) {
  const t = String(title || '').toLowerCase();
  if (t.includes('temp') || t === 'oat')                                     return 'temperature';
  if (t.includes('mass') || t.includes('weight'))                            return 'mass';
  if (t.includes('headwind') || t.includes('tailwind') || t.includes('wind_component') || t.includes('wind') || t.includes('vent')) return 'wind';
  if (t.includes('pressure_alt') || t.includes('altitude') || t.includes('pression') || t === 'pa') return 'pressure_altitude';
  return null;
}

/** Parse le nom d'une courbe pour extraire son paramètre familial et sa dimension. */
function parseCurveFamily(curveName) {
  const name = String(curveName || '').trim();
  const m = name.match(/^(-?\d+(?:\.\d+)?)\s*([a-z°]*)/i);
  if (!m) return { value: null, kind: null };
  const value = parseFloat(m[1]);
  const unit = (m[2] || '').toLowerCase();
  let kind = null;
  if (/^(ft|m|fl)/.test(unit))         kind = 'pressure_altitude';
  else if (/^°?[cf]$/.test(unit))      kind = 'temperature';
  else if (/^(kg|lb)/.test(unit))      kind = 'mass';
  else if (unit === '')                 kind = 'pressure_altitude'; // convention legacy : nombre seul = altitude
  return { value, kind };
}

// ─────────────────────────────────────────────────────────────────────────
// FILTRAGE PAR DIRECTION DE VENT (headwind / tailwind)
// ─────────────────────────────────────────────────────────────────────────
//
// Quand un graphe a des courbes mixtes (certaines `windDirection: 'headwind'`,
// d'autres `windDirection: 'tailwind'`), il est IMPÉRATIF de filtrer pour
// n'utiliser que les courbes correspondant au vent réel — sinon le bracket
// mélange des courbes physiquement opposées et produit un résultat invalide.

/** Détecte la direction de vent depuis conditions.wind (positif = headwind par convention). */
function detectWindDirection(conditions) {
  const w = conditions?.wind;
  if (typeof w !== 'number' || !Number.isFinite(w)) return null;
  if (Math.abs(w) < 0.5) return 'none';
  return w > 0 ? 'headwind' : 'tailwind';
}

/** Renvoie true si les courbes du graphe ont au moins 2 windDirection distinctes parmi {headwind, tailwind}. */
function graphHasMixedWindTypes(graph) {
  if (!graph?.curves) return false;
  const types = new Set();
  for (const c of graph.curves) {
    if (c.windDirection === 'headwind' || c.windDirection === 'tailwind') {
      types.add(c.windDirection);
    }
    if (types.size > 1) return true;
  }
  return false;
}

/** Filtre les courbes pour ne garder que celles correspondant à la direction du vent.
 *  Les courbes 'none' / sans windDirection sont gardées comme référence "vent calme". */
function filterCurvesByWindDirection(curves, expectedDirection) {
  if (!Array.isArray(curves)) return [];
  if (!expectedDirection || expectedDirection === 'none') {
    // Vent calme : préférer les courbes 'none', sinon garder toutes
    const noneOrUntagged = curves.filter(c => !c.windDirection || c.windDirection === 'none');
    return noneOrUntagged.length > 0 ? noneOrUntagged : curves;
  }
  return curves.filter(c =>
    !c.windDirection || c.windDirection === 'none' || c.windDirection === expectedDirection
  );
}

/** Applique le filtre vent à un graphe et renvoie un objet `{ curves, info, queryWindOverride }`.
 *  - curves : tableau des courbes à utiliser
 *  - info   : payload diagnostic (actualDirection, applied, excludedNames, etc.)
 *  - queryWindOverride : valeur à utiliser pour la query "wind" (abs(wind) si tailwind),
 *                       ou null si pas de changement */
function applyWindFilterToGraph(graph, conditions) {
  if (!graphHasMixedWindTypes(graph)) {
    return { curves: graph.curves, info: null, queryWindOverride: null };
  }
  const actualDir = detectWindDirection(conditions);
  if (actualDir === null) {
    return {
      curves: graph.curves,
      info: {
        applied: false,
        actualDirection: null,
        reason: 'Direction de vent indéterminée (conditions.wind manquant)',
        keptCount: graph.curves.length
      },
      queryWindOverride: null
    };
  }
  const filtered = filterCurvesByWindDirection(graph.curves, actualDir);
  const keptNames = new Set(filtered.map(c => c.id || c.name));
  const excludedCurves = graph.curves.filter(c => !keptNames.has(c.id || c.name));

  if (filtered.length < 2) {
    // Filtre trop restrictif : on garde toutes les courbes mais on signale
    return {
      curves: graph.curves,
      info: {
        applied: false,
        actualDirection: actualDir,
        reason: `Filtre ${actualDir} ne garderait que ${filtered.length} courbe(s) — bracket impossible. Fallback toutes courbes.`,
        keptCount: graph.curves.length,
        wouldHaveExcluded: excludedCurves.map(c => c.name)
      },
      queryWindOverride: null
    };
  }

  // Override wind query : si tailwind, on utilise abs() car les familyValues sont
  // typiquement des magnitudes positives même pour tailwind
  const queryWindOverride = (actualDir === 'tailwind' && typeof conditions.wind === 'number')
    ? Math.abs(conditions.wind)
    : null;

  return {
    curves: filtered,
    info: {
      applied: true,
      actualDirection: actualDir,
      keptCount: filtered.length,
      excludedCount: excludedCurves.length,
      excludedNames: excludedCurves.map(c => c.name),
      queryWindUsed: queryWindOverride !== null ? queryWindOverride : conditions.wind
    },
    queryWindOverride
  };
}

/** Interpolation linéaire 1D sur une liste de points triés (ou non) par x. */
function interpolate1D(points, x) {
  if (!Array.isArray(points) || points.length === 0) return null;
  if (points.length === 1) return points[0].y;
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (x <= sorted[0].x)                    return sorted[0].y;
  if (x >= sorted[sorted.length - 1].x)    return sorted[sorted.length - 1].y;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].x <= x && sorted[i + 1].x >= x) {
      const dx = sorted[i + 1].x - sorted[i].x;
      if (dx === 0) return sorted[i].y;
      const t = (x - sorted[i].x) / dx;
      return sorted[i].y + t * (sorted[i + 1].y - sorted[i].y);
    }
  }
  return null;
}

/**
 * Interpolation BRACKET 2D pour un graphe paramétré :
 *
 * 1. Scanne TOUTES les courbes du graphe, parse leur paramètre familial.
 * 2. Identifie la dimension familiale (altitude, masse, température...) la plus
 *    cohérente parmi les courbes.
 * 3. Lit la valeur cible de cette dimension dans les conditions.
 * 4. Trie les courbes par valeur familiale et trouve la PAIRE ENCADRANTE
 *    la plus proche (ex: pour PA=392, prend 0ft et 2000ft parmi 0/2000/4000/6000/8000/10000).
 * 5. Sur CHAQUE courbe de la paire, fait une interpolation 1D linéaire sur l'axe X
 *    à la valeur cible (ex: T=13°C) → obtient Y_bas et Y_haut.
 * 6. Interpole entre Y_bas et Y_haut selon le ratio familial
 *    (ex: 392/2000 = 0.196 → Y_final = Y_bas + 0.196 * (Y_haut - Y_bas)).
 *
 * @returns {object|null} { value, lowerCurve, upperCurve, familyDim, familyT, ... } ou null si pas applicable
 */
export function bracketInterpolateGraph(graph, conditions) {
  if (!graph || !Array.isArray(graph.curves) || graph.curves.length === 0) return null;

  // 1. Identifier la dimension X (axe horizontal du graphe)
  const xTitle = graph.axes?.xAxis?.title || graph.xAxis?.title || '';
  const xDim = mapTitleToConditionDim(xTitle);
  if (!xDim) return { error: 'X axis non identifié', xTitle };

  // ── PRÉ-FILTRAGE par direction du vent ──
  // Si le graphe a des courbes avec windDirection mixtes (headwind + tailwind),
  // on filtre selon le vent réel pour éviter de mélanger les types.
  const windFilter = applyWindFilterToGraph(graph, conditions);
  const effectiveCurves = windFilter.curves;
  // Si tailwind : conditions modifiées pour utiliser abs(wind) sur la query wind
  const effectiveConditions = windFilter.queryWindOverride !== null
    ? { ...conditions, wind: windFilter.queryWindOverride }
    : conditions;

  // ⚡ CAS MONO-COURBE : pas de famille à brancher, juste interpolation 1D directe
  //    le long de l'axe X. Renvoie directement la valeur Y à X=queryX.
  if (effectiveCurves.length === 1 && !graph.familyAxisVariable) {
    const onlyCurve = effectiveCurves[0];
    const queryX = effectiveConditions[xDim];
    if (queryX === undefined || queryX === null || Number.isNaN(queryX)) {
      return { error: `Input manquant pour l'axe X (${xDim})`, xDim };
    }
    const y = interpolate1D(onlyCurve.points, queryX);
    if (y === null) {
      return { error: 'Échec interpolation 1D sur la courbe unique' };
    }
    return {
      value: y,
      method: 'Interpolation 1D (mono-courbe)',
      source: 'mono-curve',
      xDim,
      familyDim: null,
      queryX,
      queryFamily: null,
      lowerCurve: { name: onlyCurve.name, familyValue: null, y },
      upperCurve: { name: onlyCurve.name, familyValue: null, y },
      familyT: 0,
      familyRange: 0,
      extrapolated: null,
      availableFamilyValues: [],
      windFilter: windFilter.info
    };
  }

  // 2. PRIORITÉ : utiliser la déclaration manuelle (graph.familyAxisVariable + curve.familyValue)
  //    Sinon, fallback : parser le nom de courbe pour deviner la dimension et la valeur.
  let familyDim = null;
  let validCurves = [];
  let source = null; // 'manual' | 'parsed'

  if (graph.familyAxisVariable) {
    // Déclaration manuelle au niveau du graphe
    familyDim = mapTitleToConditionDim(graph.familyAxisVariable);
    if (!familyDim) {
      return { error: `familyAxisVariable "${graph.familyAxisVariable}" non mappable à une dimension de conditions`, windFilter: windFilter.info };
    }
    validCurves = effectiveCurves
      .filter(c => typeof c.familyValue === 'number' && !Number.isNaN(c.familyValue))
      .map(c => ({ curve: c, familyValue: c.familyValue, familyKind: familyDim }))
      .sort((a, b) => a.familyValue - b.familyValue);
    if (validCurves.length === 0) {
      return {
        error: `Le graphe déclare familyAxisVariable="${graph.familyAxisVariable}" mais aucune courbe n'a de familyValue numérique. Saisir la valeur de chaque courbe dans le wizard (sous-étape 5).`,
        familyDim,
        windFilter: windFilter.info
      };
    }
    source = 'manual';
  } else {
    // Fallback : parser les noms (comportement Phase 3.6 initial)
    const parsedCurves = effectiveCurves.map(curve => {
      const parsed = parseCurveFamily(curve.name);
      return { curve, familyValue: parsed.value, familyKind: parsed.kind };
    });
    const kindCounts = {};
    parsedCurves.forEach(c => {
      if (c.familyKind && c.familyValue !== null) {
        kindCounts[c.familyKind] = (kindCounts[c.familyKind] || 0) + 1;
      }
    });
    const candidates = Object.entries(kindCounts)
      .filter(([kind]) => kind !== xDim)
      .sort((a, b) => b[1] - a[1]);
    if (candidates.length === 0) {
      return {
        error: 'Aucun paramètre familial. Soit déclarer `familyAxisVariable` au niveau du graphe + `familyValue` sur chaque courbe (recommandé), soit nommer les courbes avec un préfixe numérique reconnu ("0 ft", "20°C", "850 kg"...).',
        curveNames: effectiveCurves.map(c => c.name),
        windFilter: windFilter.info
      };
    }
    familyDim = candidates[0][0];
    validCurves = parsedCurves
      .filter(c => c.familyKind === familyDim && c.familyValue !== null)
      .sort((a, b) => a.familyValue - b.familyValue);
    if (validCurves.length === 0) {
      return { error: 'Aucune courbe avec paramètre familial valide pour ' + familyDim, windFilter: windFilter.info };
    }
    source = 'parsed';
  }

  // 5. Valeurs cibles dans les conditions (avec override de wind si tailwind)
  const queryX = effectiveConditions[xDim];
  const queryFamily = effectiveConditions[familyDim];
  if (queryX === undefined || queryX === null || Number.isNaN(queryX)) {
    return { error: `Input manquant pour l'axe X (${xDim})`, xDim, familyDim, windFilter: windFilter.info };
  }
  if (queryFamily === undefined || queryFamily === null || Number.isNaN(queryFamily)) {
    return { error: `Input manquant pour la dimension familiale (${familyDim})`, xDim, familyDim, windFilter: windFilter.info };
  }

  // 6. Bracket : trouve les 2 courbes encadrant queryFamily AVEC extrapolation propre
  //    - Dans la plage : paire encadrante normale
  //    - Sous la plage : 2 courbes les plus basses (t<0, extrapolation préservant la pente)
  //    - Au-dessus : 2 courbes les plus hautes (t>1)
  let lowerCurve = null;
  let upperCurve = null;
  let extrapolated = null;

  if (validCurves.length < 2) {
    // Une seule courbe valide → impossible de bracketer correctement
    return { error: `Une seule courbe avec valeur familiale (${validCurves.length}). Bracket nécessite au moins 2 courbes.`, validCurveCount: validCurves.length };
  }

  const firstFamily = validCurves[0].familyValue;
  const lastFamily  = validCurves[validCurves.length - 1].familyValue;

  if (queryFamily < firstFamily) {
    // Sous toutes les courbes → extrapole avec les 2 plus basses
    lowerCurve = validCurves[0];
    upperCurve = validCurves[1];
    extrapolated = 'below';
  } else if (queryFamily > lastFamily) {
    // Au-dessus → extrapole avec les 2 plus hautes
    lowerCurve = validCurves[validCurves.length - 2];
    upperCurve = validCurves[validCurves.length - 1];
    extrapolated = 'above';
  } else {
    // Dans la plage : paire encadrante normale
    for (let i = 0; i < validCurves.length - 1; i++) {
      if (validCurves[i].familyValue <= queryFamily && validCurves[i + 1].familyValue >= queryFamily) {
        lowerCurve = validCurves[i];
        upperCurve = validCurves[i + 1];
        break;
      }
    }
    // Cas dégénéré : query pile sur la dernière courbe
    if (!lowerCurve || !upperCurve) {
      lowerCurve = validCurves[validCurves.length - 2];
      upperCurve = validCurves[validCurves.length - 1];
    }
  }

  // 7. Interpolation 1D sur chaque courbe encadrante à X = queryX
  const yLower = interpolate1D(lowerCurve.curve.points, queryX);
  const yUpper = interpolate1D(upperCurve.curve.points, queryX);
  if (yLower === null || yUpper === null) {
    return { error: 'Échec interpolation 1D sur une courbe encadrante' };
  }

  // 8. Interpolation finale entre Y_bas et Y_haut par ratio familial
  const familyRange = upperCurve.familyValue - lowerCurve.familyValue;
  const familyT = (familyRange === 0) ? 0 : (queryFamily - lowerCurve.familyValue) / familyRange;
  const value = yLower + familyT * (yUpper - yLower);

  return {
    value,
    method: 'Bracket 2D',
    source, // 'manual' | 'parsed'
    xDim,
    familyDim,
    queryX,
    queryFamily,
    lowerCurve: {
      name: lowerCurve.curve.name,
      familyValue: lowerCurve.familyValue,
      windDirection: lowerCurve.curve.windDirection || null,
      y: yLower
    },
    upperCurve: {
      name: upperCurve.curve.name,
      familyValue: upperCurve.familyValue,
      windDirection: upperCurve.curve.windDirection || null,
      y: yUpper
    },
    familyT,
    familyRange,
    extrapolated, // null | 'below' | 'above'
    availableFamilyValues: validCurves.map(c => c.familyValue),
    windFilter: windFilter.info // null si aucun filtre vent ne s'applique
  };
}

/**
 * Interpolation par SUIVI DE PENTE (slope-follow) — "lecture pilote" pour
 * les graphes intermédiaires dont les courbes sont des guides SANS valeur
 * familiale explicite.
 *
 * Procédure mathématique :
 *   1. Pour chaque courbe c_i, calculer entry_yᵢ = c_i(X = X_min)
 *      (X_min = bord gauche du graphe, calculé depuis les points)
 *   2. Trier les courbes par entry_y
 *   3. Trouver c_lower et c_upper qui encadrent Y_entry
 *   4. Calculer ratio t = (Y_entry − entry_y_lower) / (entry_y_upper − entry_y_lower)
 *   5. Évaluer c_lower et c_upper à X = X_cible (input condition)
 *   6. Y_out = y_lower_cible + t × (y_upper_cible − y_lower_cible)
 *
 * @param {object} graph    Le graphe à évaluer
 * @param {number} entryY   Valeur d'entrée à X = X_min (typiquement output du graphe précédent)
 * @param {number} targetX  Valeur cible sur l'axe X (input condition du graphe courant)
 * @returns {object|null}   { value, lowerCurve, upperCurve, t, ... } ou erreur
 */
export function slopeFollowInterpolateGraph(graph, entryY, targetX, conditions = null) {
  if (!graph || !Array.isArray(graph.curves) || graph.curves.length === 0) return null;
  if (entryY === null || entryY === undefined || Number.isNaN(entryY)) {
    return { error: 'Valeur d\'entrée (Y_in) manquante pour le suivi de pente' };
  }
  if (targetX === null || targetX === undefined || Number.isNaN(targetX)) {
    return { error: 'Valeur cible (X_target) manquante' };
  }

  // ── PRÉ-FILTRAGE par direction du vent ──
  // Si le graphe a des courbes avec windDirection mixtes ET on a un objet
  // conditions (qui contient le vent réel), on filtre.
  // Note : pour slope-follow on n'a pas besoin de modifier la query wind
  // (l'algorithme ne consulte pas familyValue, il bracket sur entry_y).
  const windFilter = conditions
    ? applyWindFilterToGraph(graph, conditions)
    : { curves: graph.curves, info: null, queryWindOverride: null };
  // Travailler sur un graphe virtuel avec les courbes filtrées
  const graphForAlgo = windFilter.curves === graph.curves
    ? graph
    : { ...graph, curves: windFilter.curves };

  // 1. Détection du sens de lecture de l'axe X.
  //    - reversed === true → axe X décroissant : le BORD GAUCHE VISUEL du graphe
  //      correspond au X MAX. Le "premier point" pilote est donc le point avec
  //      le plus grand X.
  //    - reversed !== true (par défaut) → axe X croissant : le bord gauche
  //      visuel est X MIN. Le premier point pilote est celui avec le plus petit X.
  const axisReversed = graph.axes?.xAxis?.reversed === true;
  const declaredXMin = graph.axes?.xAxis?.min;
  const declaredXMax = graph.axes?.xAxis?.max;
  // X au bord gauche visuel (= X_max si reversed, X_min sinon)
  const xLeftVisual = axisReversed
    ? (typeof declaredXMax === 'number' && Number.isFinite(declaredXMax) ? declaredXMax : null)
    : (typeof declaredXMin === 'number' && Number.isFinite(declaredXMin) ? declaredXMin : null);

  // 2. Pour chaque courbe, récupérer Y au BORD GAUCHE VISUEL du graphe.
  //    Sens de tri dépendant de `reversed` :
  //      - axe croissant : sort ascending par X → premier = X min
  //      - axe décroissant : sort descending par X → premier = X max
  //    Avantages :
  //      - Respecte la sémantique pilote (entrée au bord gauche visuel)
  //      - Mise à jour automatique si on déplace le 1er point
  //      - Pas besoin de saisie manuelle systématique
  //
  //    OVERRIDE : si `curve.entryY` est saisi manuellement, il prend le pas
  //    sur la valeur auto-déduite.
  const totalCurves = graphForAlgo.curves.length;
  const curvesWithManualEntry = graphForAlgo.curves.filter(c => typeof c.entryY === 'number' && Number.isFinite(c.entryY)).length;
  const allManual = totalCurves > 0 && curvesWithManualEntry === totalCurves;

  let entryYSource;
  if (allManual)                          entryYSource = 'manual';
  else if (curvesWithManualEntry === 0)   entryYSource = 'first-point';
  else                                    entryYSource = 'mixed';

  const entryRows = graphForAlgo.curves
    .map(c => {
      let yEntry = null;
      let perCurveSource = null;
      let firstPointX = null;
      if (typeof c.entryY === 'number' && Number.isFinite(c.entryY)) {
        yEntry = c.entryY;
        perCurveSource = 'manual';
      } else if (Array.isArray(c.points) && c.points.length > 0) {
        // Tri par X selon le sens de l'axe et prise du premier point côté
        // bord gauche visuel.
        const sortedByX = [...c.points]
          .filter(p => typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y))
          .sort((a, b) => axisReversed ? b.x - a.x : a.x - b.x);
        if (sortedByX.length > 0) {
          yEntry = sortedByX[0].y;
          firstPointX = sortedByX[0].x;
          perCurveSource = 'first-point';
        }
      }
      return { curve: c, entryY: yEntry, entryYSource: perCurveSource, firstPointX };
    })
    .filter(r => r.entryY !== null && Number.isFinite(r.entryY))
    .sort((a, b) => a.entryY - b.entryY);

  if (entryRows.length < 2) {
    return { error: `Moins de 2 courbes exploitables (${entryRows.length}). Suivi de pente impossible.` };
  }

  // 3. Bracket Y_entry sur les entry_y AVEC extrapolation propre
  //    - Si Y_entry est dans la plage : on trouve la paire encadrante
  //    - Si Y_entry est en-dessous de toutes : on prend les 2 PLUS BASSES (extrapolation t<0)
  //    - Si Y_entry est au-dessus de toutes : on prend les 2 PLUS HAUTES (extrapolation t>1)
  //    Ceci préserve la pente locale au-delà des courbes connues.
  let lower = null, upper = null;
  let extrapolated = null;

  const firstEntryY = entryRows[0].entryY;
  const lastEntryY  = entryRows[entryRows.length - 1].entryY;

  if (entryY < firstEntryY) {
    // Sous toutes les courbes → extrapole avec les 2 plus basses
    lower = entryRows[0];
    upper = entryRows[1]; // existe car length >= 2
    extrapolated = 'below';
  } else if (entryY > lastEntryY) {
    // Au-dessus de toutes → extrapole avec les 2 plus hautes
    lower = entryRows[entryRows.length - 2];
    upper = entryRows[entryRows.length - 1];
    extrapolated = 'above';
  } else {
    // Dans la plage : trouver la paire encadrante
    for (let i = 0; i < entryRows.length - 1; i++) {
      if (entryRows[i].entryY <= entryY && entryRows[i + 1].entryY >= entryY) {
        lower = entryRows[i];
        upper = entryRows[i + 1];
        break;
      }
    }
    // Cas dégénéré : tous les entry_y égaux → prend les 2 premiers
    if (!lower || !upper) {
      lower = entryRows[0];
      upper = entryRows[1];
    }
  }

  // 4. Ratio d'entrée (peut être <0 ou >1 si extrapolation)
  const range = upper.entryY - lower.entryY;
  const t = (range === 0) ? 0 : (entryY - lower.entryY) / range;

  // 5. Évaluer lower et upper à X = targetX
  const yLowerTarget = interpolate1D(lower.curve.points, targetX);
  const yUpperTarget = interpolate1D(upper.curve.points, targetX);
  if (yLowerTarget === null || yUpperTarget === null) {
    return { error: 'Échec interpolation 1D sur une courbe à X = targetX' };
  }

  // 6. Output final en conservant le même ratio t entre les 2 courbes
  const value = yLowerTarget + t * (yUpperTarget - yLowerTarget);

  return {
    value,
    method: 'Slope-follow (suivi de pente)',
    source: 'slope-follow',
    axisReversed, // ← NOUVEAU : true si l'axe X est décroissant (lecture pilote droite→gauche inversée)
    xLeftVisual,  // ← NOUVEAU : X au bord gauche VISUEL (= xMax si reversed, sinon xMin)
    // Pour rétro-compat avec ancien code UI :
    xMin: xLeftVisual,
    xMinSource: xLeftVisual !== null ? 'declared' : 'unused',
    targetX,
    entryY,
    t,
    extrapolated,
    entryYSource, // 'manual' | 'first-point' | 'mixed'
    lowerCurve: {
      name: lower.curve.name,
      entryY: lower.entryY,
      entryYSource: lower.entryYSource,
      firstPointX: lower.firstPointX,
      windDirection: lower.curve.windDirection || null,
      yAtTargetX: yLowerTarget
    },
    upperCurve: {
      name: upper.curve.name,
      entryY: upper.entryY,
      entryYSource: upper.entryYSource,
      firstPointX: upper.firstPointX,
      windDirection: upper.curve.windDirection || null,
      yAtTargetX: yUpperTarget
    },
    availableEntryYs: entryRows.map(r => r.entryY),
    availableEntryRows: entryRows.map(r => ({
      name: r.curve.name,
      entryY: r.entryY,
      entryYSource: r.entryYSource,
      firstPointX: r.firstPointX,
      windDirection: r.curve.windDirection || null
    })),
    windFilter: windFilter.info
  };
}

/**
 * Évalue un abaque en CASCADE :
 *   - Trie les graphes intermédiaires par `cascadeOrder` (T1, T2, …),
 *     suivis du graphe primaire en dernier.
 *   - Évalue chaque graphe avec son propre bracket 2D (chaque graphe a
 *     son couple familyAxisVariable + familyValue).
 *   - Pour les graphes après le premier : l'output du précédent devient
 *     le nouvel X (override de la valeur de conditions sur l'axe X).
 *
 * @param {object} abaqueData       Le `model.data` (AbacCurvesJSON)
 * @param {object} initialConditions {temperature, pressure_altitude, mass, wind}
 * @returns {{ steps: Array<object>, finalValue: number|null, error?: string }}
 *
 * Chaque step contient :
 *   { graphId, graphName, role, cascadeOrder, xDim, queryX, queryFamily,
 *     bracketResult, idwResult, used: 'bracket'|'idw'|null, output: number|null }
 */
export function evaluateAbacCascade(abaqueData, initialConditions) {
  if (!abaqueData?.graphs || !Array.isArray(abaqueData.graphs) || abaqueData.graphs.length === 0) {
    return { steps: [], finalValue: null, error: 'Aucun graphe dans l\'abaque.' };
  }

  // 1. Trier les graphes : intermédiaires par cascadeOrder croissant, puis le primaire en dernier.
  const intermediates = abaqueData.graphs
    .filter(g => g.role === 'intermediate')
    .sort((a, b) => (a.cascadeOrder ?? 99) - (b.cascadeOrder ?? 99));
  const primary = abaqueData.graphs.find(g => (g.role || 'primary') === 'primary');

  const orderedGraphs = [...intermediates];
  if (primary) orderedGraphs.push(primary);

  // 2. Si pas de primaire et pas d'intermédiaires (cas mono-graphe sans rôle déclaré),
  //    on prend tous les graphes dans l'ordre du tableau.
  if (orderedGraphs.length === 0) {
    orderedGraphs.push(...abaqueData.graphs);
  }

  // 3. Évaluation séquentielle
  const conditions = { ...initialConditions };
  const steps = [];
  let previousOutput = null;

  for (let i = 0; i < orderedGraphs.length; i++) {
    const graph = orderedGraphs[i];
    const xTitle = graph.axes?.xAxis?.title || '';
    const xDim = mapTitleToConditionDim(xTitle);

    // Détermine le mode d'interpolation : explicite (déclaré par l'utilisateur)
    // OU auto-détecté. Si déclaré, on est en mode STRICT : aucune méthode
    // alternative n'est tentée. Si l'évaluation échoue, le step renvoie une
    // erreur explicite plutôt qu'un faux calcul issu d'un fallback.
    const modeDeclared = !!graph.interpolationMode;
    let mode = graph.interpolationMode;
    if (!mode) {
      if (graph.curves?.length === 1) mode = 'mono';
      else if (graph.familyAxisVariable) mode = 'family';
      else if (i > 0 && previousOutput !== null) mode = 'slope-follow'; // graphe en cascade sans famille → suivi de pente
      else mode = 'family'; // fallback à bracket sur nom
    }

    let output = null;
    let used = null;
    let stepError = null;
    let bracketResult = null;
    let slopeResult = null;
    let idwResult = null;

    if (mode === 'slope-follow') {
      // SUIVI DE PENTE : entryY = output précédent, targetX = condition[xDim]
      if (i > 0 && previousOutput !== null) {
        const targetX = xDim ? conditions[xDim] : null;
        slopeResult = slopeFollowInterpolateGraph(graph, previousOutput, targetX, conditions);
        if (slopeResult && !slopeResult.error && slopeResult.value !== undefined) {
          output = slopeResult.value;
          used = 'slope-follow';
        } else {
          stepError = slopeResult?.error || 'Slope-follow : aucune valeur produite.';
        }
      } else {
        stepError = `Slope-follow déclaré mais aucune valeur d'entrée Y_in disponible (le graphe précédent n'a pas produit d'output, ou ce graphe est en première position de la cascade).`;
      }
    } else if (mode === 'family' || mode === 'mono') {
      // FAMILY : bracket par valeur familiale
      // Override X si on est dans une cascade
      if (i > 0 && previousOutput !== null && xDim) {
        conditions[xDim] = previousOutput;
      }
      bracketResult = bracketInterpolateGraph(graph, conditions);
      if (bracketResult && !bracketResult.error && bracketResult.value !== undefined) {
        output = bracketResult.value;
        used = 'bracket';
      } else {
        stepError = bracketResult?.error || 'Bracket : aucune valeur produite.';
      }
    }

    // IDW : UNIQUEMENT en fallback ultime SI le mode n'a pas été déclaré par l'utilisateur.
    // Si mode explicite et échec → on remonte l'erreur, pas de faux calcul.
    if (used === null && !modeDeclared) {
      if (i > 0 && previousOutput !== null && xDim) {
        conditions[xDim] = previousOutput;
      }
      const pts = extractPoints({ graphs: [graph] }, conditions);
      idwResult = idwInterpolate(pts, conditions);
      if (idwResult) {
        output = idwResult.value;
        used = 'idw';
        stepError = null; // l'IDW a sauvé le calcul
      }
    }

    steps.push({
      graphId: graph.id,
      graphName: graph.name || `Graphique ${i + 1}`,
      role: graph.role || 'primary',
      cascadeOrder: graph.cascadeOrder ?? null,
      operationId: graph.operationId || null,
      mode,
      modeDeclared,
      xDim,
      xTitle,
      yTitle: graph.axes?.yAxis?.title || '',
      queryX: xDim ? conditions[xDim] : null,
      entryY: i > 0 ? previousOutput : null,
      bracketResult,
      slopeResult,
      idwResult,
      used,
      output,
      error: stepError
    });

    previousOutput = output;
  }

  return {
    steps,
    finalValue: previousOutput,
    error: previousOutput === null ? 'Aucun graphe n\'a produit de valeur exploitable.' : null
  };
}

/**
 * Inspection détaillée par sous-graphique : pour chaque graphe de l'abaque,
 * retourne ses métadonnées (axes, courbes, points) ET le résultat de LA
 * méthode déclarée par le graphe (interpolationMode).
 *
 * Comportement strict :
 *   - mode = 'slope-follow' → uniquement slope-follow (Y_in vient du cascade
 *     step correspondant si fourni, sinon erreur explicite)
 *   - mode = 'family' / 'mono' → uniquement bracket
 *   - mode non déclaré → auto-détection comme dans evaluateAbacCascade,
 *     avec fallback IDW autorisé (mode legacy)
 *
 * @param {object} abaqueData
 * @param {object} conditions
 * @param {Array}  [cascadeSteps] Steps déjà calculés par evaluateAbacCascade,
 *                                utilisés pour récupérer le vrai Y_in en
 *                                slope-follow (output du graphe précédent).
 * @returns {{ graphs: Array<object> }}
 */
export function inspectAbacByGraph(abaqueData, conditions, cascadeSteps = null) {
  const out = [];
  if (!abaqueData?.graphs || !Array.isArray(abaqueData.graphs)) return { graphs: out };

  // Map graphId → step pour récupérer l'entryY réel utilisé en cascade
  const stepByGraphId = {};
  if (Array.isArray(cascadeSteps)) {
    for (const s of cascadeSteps) {
      if (s.graphId) stepByGraphId[s.graphId] = s;
    }
  }

  for (const graph of abaqueData.graphs) {
    // Analyse des noms de courbes pour rapporter le paramètre familial détecté
    const curveAnalysis = (graph.curves || []).map(curve => {
      const name = String(curve.name || '').trim();
      const leadingNum = name.match(/^(-?\d+(?:\.\d+)?)\s*([a-z°]*)/i);
      let familyValue = null;
      let familyKind = null;
      if (leadingNum) {
        familyValue = parseFloat(leadingNum[1]);
        const unit = (leadingNum[2] || '').toLowerCase();
        if (/^(ft|m|fl)/.test(unit))          familyKind = 'altitude';
        else if (/^°?[cf]$/.test(unit))       familyKind = 'temperature';
        else if (/^(kg|lb)/.test(unit))       familyKind = 'mass';
        else if (unit === '')                  familyKind = 'altitude';
      }
      return {
        name: curve.name || '(sans nom)',
        pointCount: curve.points?.length || 0,
        familyValue,
        familyKind,
        familyParsed: familyValue !== null && familyKind !== null
      };
    });

    const declaredMode = graph.interpolationMode || null;
    const modeDeclared = !!declaredMode;
    const xTitle = graph.axes?.xAxis?.title || '';
    const xDim = mapTitleToConditionDim(xTitle);
    const targetXForSlope = xDim ? conditions[xDim] : null;

    // Récupère le step cascade correspondant (s'il y en a un)
    const matchingStep = stepByGraphId[graph.id] || null;

    // STRICT : on ne calcule QUE la méthode déclarée
    let bracketResult = null;
    let slopeResult = null;
    let isolatedResult = null;
    let isolatedPointsCount = 0;
    let effectiveMode = declaredMode;

    if (declaredMode === 'slope-follow') {
      // Y_in vient du cascade step correspondant (vrai output du graphe précédent),
      // sinon on ne peut pas évaluer en isolation → erreur explicite.
      const entryY = matchingStep?.entryY;
      if (entryY !== null && entryY !== undefined && Number.isFinite(entryY)) {
        slopeResult = slopeFollowInterpolateGraph(graph, entryY, targetXForSlope, conditions);
      } else {
        slopeResult = {
          error: 'Slope-follow nécessite un Y_in (output du graphe précédent dans la cascade). En inspection isolée hors cascade, ce calcul n\'est pas possible.'
        };
      }
    } else if (declaredMode === 'family' || declaredMode === 'mono') {
      // Override X depuis cascade si dispo (pour cohérence avec ce qui est réellement utilisé)
      const condsForBracket = { ...conditions };
      if (matchingStep && matchingStep.entryY !== null && matchingStep.entryY !== undefined && xDim) {
        condsForBracket[xDim] = matchingStep.queryX !== null ? matchingStep.queryX : matchingStep.entryY;
      }
      bracketResult = bracketInterpolateGraph(graph, condsForBracket);
    } else {
      // Mode NON déclaré → auto-détection (legacy). Calcule les 3 méthodes
      // pour transparence, mais reporte clairement qu'aucune n'est imposée.
      effectiveMode = '(auto)';
      const isolatedPoints = extractPoints({ graphs: [graph] }, conditions);
      isolatedPointsCount = isolatedPoints.length;
      isolatedResult = idwInterpolate(isolatedPoints, conditions);
      bracketResult = bracketInterpolateGraph(graph, conditions);
      // Slope-follow en mode auto seulement si on a un Y_in via cascade
      const entryY = matchingStep?.entryY;
      if (entryY !== null && entryY !== undefined && Number.isFinite(entryY)) {
        slopeResult = slopeFollowInterpolateGraph(graph, entryY, targetXForSlope, conditions);
      }
    }

    // Toujours compter les points pour info (sans les exposer)
    if (isolatedPointsCount === 0) {
      const pts = extractPoints({ graphs: [graph] }, conditions);
      isolatedPointsCount = pts.length;
    }

    out.push({
      graphId: graph.id,
      graphName: graph.name || `(graphique ${out.length + 1})`,
      role: graph.role || 'primary',
      cascadeOrder: graph.cascadeOrder ?? null,
      operationId: graph.operationId || null,
      interpolationMode: declaredMode || '(auto)',
      modeDeclared,
      effectiveMode,
      familyAxisVariable: graph.familyAxisVariable || null,
      axes: {
        xTitle: graph.axes?.xAxis?.title || '(non défini)',
        yTitle: graph.axes?.yAxis?.title || '(non défini)',
        xUnit:  graph.axes?.xAxis?.unit  || '',
        yUnit:  graph.axes?.yAxis?.unit  || ''
      },
      curveCount: graph.curves?.length || 0,
      pointCount: isolatedPointsCount,
      curveAnalysis,
      // En mode strict (déclaré), seul le résultat de la méthode déclarée est rempli.
      // En mode auto, les trois peuvent l'être pour transparence.
      isolatedResult: isolatedResult ? {
        value: isolatedResult.value,
        confidence: isolatedResult.confidence,
        nearestPointCount: isolatedResult.nearestPoints?.length || 0,
        nearestPoints: (isolatedResult.nearestPoints || []).slice(0, 4)
      } : null,
      bracketResult: bracketResult || null,
      slopeResult: slopeResult || null
    });
  }

  return { graphs: out };
}

/**
 * API principale partagée : interpole une distance / valeur de sortie pour
 * un ensemble de conditions données.
 *
 * @param {object} abaqueData   Le `model.data` (AbacCurvesJSON) — ou un objet équivalent
 * @param {object} conditions   {temperature, pressure_altitude, mass, wind}
 * @returns {{ status, value?, confidence?, nearestPoints?, reason?, totalPoints? }}
 */
export function interpolateAbac(abaqueData, conditions) {
  if (!abaqueData) {
    return { status: InterpolationStatus.NO_GRAPH, reason: 'Aucun abaque fourni.' };
  }
  const points = extractPoints(abaqueData, conditions);
  if (points.length === 0) {
    return { status: InterpolationStatus.NO_POINTS, reason: 'Aucun point exploitable dans l\'abaque.' };
  }
  const result = idwInterpolate(points, conditions);
  if (!result) {
    return { status: InterpolationStatus.ERROR, reason: 'Échec interpolation IDW.', totalPoints: points.length };
  }
  return {
    status: InterpolationStatus.OK,
    value: result.value,
    confidence: result.confidence,
    nearestPoints: result.nearestPoints,
    totalPoints: points.length
  };
}
