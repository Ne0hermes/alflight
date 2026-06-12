import { GraphConfig, Curve, XYPoint } from './types';

/**
 * Paramètres pour un graphique dans le calcul en cascade
 */
export interface GraphParameters {
  graphId: string;
  parameter: number; // Valeur du paramètre (masse, vent, etc.) sur l'axe X
  parameterName?: string; // Nom du paramètre pour l'affichage
  windDirection?: 'headwind' | 'tailwind'; // Direction du vent pour les graphiques de vent
}

/**
 * Résultat d'un calcul en cascade
 */
export interface CascadeStep {
  graphId: string;
  graphName: string;
  inputValue: number; // Valeur d'entrée sur l'axe Y
  parameter?: number; // Paramètre utilisé sur l'axe X
  parameterName?: string;
  outputValue: number; // Valeur de sortie sur l'axe Y
  curveUsed?: string;
  interpolated: boolean;
  referenceIntersectionX?: number; // Point X où la ligne horizontale croise la courbe de référence
  offset?: number; // Décalage par rapport à la courbe de référence
  valuesAtCrossing?: { // Valeurs Y au croisement de la verticale avec les courbes de référence
    lowerValue?: number;
    upperValue?: number;
  };
  referenceCurves?: { // Courbes de référence identifiées au point d'entrée
    lowerCurveName?: string;
    upperCurveName?: string;
    lowerYAtRef?: number;
    upperYAtRef?: number;
  };
}

export interface CascadeResult {
  steps: CascadeStep[];
  finalValue: number;
  success: boolean;
  error?: string;
}

/**
 * Trouve la valeur Y pour un X donné sur une courbe interpolée
 * Utilise l'interpolation linéaire entre les points
 */
// R11 — `extrapolate` : aux CROISEMENTS (étape 3 du suivi d'abaque), les
// guides tracés s'arrêtent souvent juste avant le bord du panneau (ex.
// Headwind 1 tracé jusqu'à 11,7 kt pour un panneau qui va à 15 kt). Sur le
// papier on PROLONGE le guide jusqu'au bord : extrapolation linéaire du
// dernier segment sans limite de tolérance. Hors croisements, la tolérance
// de 10 % reste le comportement par défaut.
function findYForX(curve: Curve, x: number, extrapolate = false): number | null {
  if (!curve.fitted || curve.fitted.points.length < 2) {
    return null;
  }

  const points = curve.fitted.points;

  // Si x est en dehors des limites, retourner null
  if (x < points[0].x || x > points[points.length - 1].x) {
    // Extrapolation linéaire si proche des limites (tolérance de 10%)
    const range = points[points.length - 1].x - points[0].x;
    const tolerance = extrapolate ? Infinity : range * 0.1;

    if (x < points[0].x && x >= points[0].x - tolerance) {
      // Extrapoler à gauche
      const slope = (points[1].y - points[0].y) / (points[1].x - points[0].x);
      return points[0].y + slope * (x - points[0].x);
    }

    if (x > points[points.length - 1].x && x <= points[points.length - 1].x + tolerance) {
      // Extrapoler à droite
      const n = points.length;
      const slope = (points[n - 1].y - points[n - 2].y) / (points[n - 1].x - points[n - 2].x);
      return points[n - 1].y + slope * (x - points[n - 1].x);
    }

    return null;
  }

  // Trouver les deux points encadrant x
  let i = 0;
  while (i < points.length - 1 && points[i + 1].x < x) {
    i++;
  }

  // Si on est exactement sur un point
  if (Math.abs(points[i].x - x) < 0.0001) {
    return points[i].y;
  }
  if (i < points.length - 1 && Math.abs(points[i + 1].x - x) < 0.0001) {
    return points[i + 1].y;
  }

  // Interpolation linéaire entre les deux points
  if (i < points.length - 1) {
    const x1 = points[i].x;
    const y1 = points[i].y;
    const x2 = points[i + 1].x;
    const y2 = points[i + 1].y;

    const ratio = (x - x1) / (x2 - x1);
    return y1 + ratio * (y2 - y1);
  }

  return points[points.length - 1].y;
}

/**
 * Trouve la valeur X pour un Y donné sur une courbe interpolée
 * Retourne la PREMIÈRE intersection (plus petit X) si la courbe croise plusieurs fois
 * Cette fonction est l'inverse de findYForX
 */
function findXForY(curve: Curve, y: number): number | null {
  if (!curve.fitted || curve.fitted.points.length < 2) {
    return null;
  }

  const points = curve.fitted.points;

  // Trouver les limites Y (min et max)
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const point of points) {
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  // Si y est en dehors des limites, pas d'intersection
  if (y < minY || y > maxY) {
    // Log de debug pour comprendre les fausses intersections
    if (curve.name && Math.abs(y - maxY) < 500) {
      console.log(`     ⚠️ findXForY: "${curve.name}" - Y=${y.toFixed(2)} hors limites [${minY.toFixed(2)}, ${maxY.toFixed(2)}]`);
    }
    return null;
  }

  // Chercher TOUTES les intersections et retourner celle avec le plus petit X
  let minX = null;

  for (let i = 0; i < points.length - 1; i++) {
    const y1 = points[i].y;
    const y2 = points[i + 1].y;

    // Vérifier si y est entre ces deux points
    if ((y >= y1 && y <= y2) || (y >= y2 && y <= y1)) {
      let currentX;

      // Si on est exactement sur un point
      if (Math.abs(y1 - y) < 0.0001) {
        currentX = points[i].x;
      } else if (Math.abs(y2 - y) < 0.0001) {
        currentX = points[i + 1].x;
      } else {
        // Interpolation linéaire
        const x1 = points[i].x;
        const x2 = points[i + 1].x;

        if (Math.abs(y2 - y1) < 0.0001) {
          // Si les Y sont presque égaux, prendre le milieu
          currentX = (x1 + x2) / 2;
        } else {
          const ratio = (y - y1) / (y2 - y1);
          currentX = x1 + ratio * (x2 - x1);
        }
      }

      // Garder le X minimum (première intersection)
      if (minX === null || currentX < minX) {
        minX = currentX;
      }
    }
  }

  // Si on a trouvé au moins une intersection
  if (minX !== null) {
    return minX;
  }

  // Si on n'a pas trouvé d'intersection, retourner null
  return null;
}

/**
 * Calcule la sortie selon la VRAIE méthode des abaques avec paramètre:
 *
 * MÉTHODE CORRECTE étape par étape:
 * 1. Tracer une ligne horizontale à Y = valeur d'entrée
 * 2. Identifier la PREMIÈRE courbe croisée (courbe de référence)
 * 3. Noter le point d'intersection (X_ref, Y_entrée)
 * 4. Tracer une ligne verticale à X = paramètre
 * 5. Suivre/extrapoler la trajectoire de la courbe de référence jusqu'à X = paramètre
 * 6. Lire Y à cette position = valeur de sortie
 *
 * Note: Ce n'est PAS juste sélectionner une courbe par son nom!
 */
function calculateOutputWithParameterCorrect(
  graph: GraphConfig,
  inputY: number,
  parameterX: number,
  windDirection?: 'headwind' | 'tailwind'
): {
  outputValue: number;
  curveUsed?: string;
  interpolated: boolean;
  referenceIntersectionX?: number;
  offset?: number;
} | null {
  if (!graph.curves || graph.curves.length === 0) {
    return null;
  }

  // Trouver les deux courbes qui encadrent le paramètre
  const resolvedCurves = graph.curves
    .map(c => {
      let cleanName = c.name.trim();

      // Utiliser la propriété windDirection de la courbe si elle existe
      let windType = c.windDirection && c.windDirection !== 'none' ? c.windDirection : null;

      // Si pas de windDirection défini mais que le nom contient headwind/tailwind, l'extraire
      if (!windType) {
        if (cleanName.toLowerCase().includes('headwind')) {
          windType = 'headwind';
        } else if (cleanName.toLowerCase().includes('tailwind')) {
          windType = 'tailwind';
        }
      }

      // R16b — PRIORITÉ à la valeur STRUCTURÉE (Curve.familyValue, saisie dans
      // le gestionnaire de courbes / déduite des noms). Le parsing du NOM
      // n'est plus qu'un REPLI de compatibilité pour les anciens modèles :
      // le nom redevient un pur libellé d'affichage.
      if (typeof c.familyValue === 'number' && isFinite(c.familyValue)) {
        return { curve: c, param: c.familyValue, name: c.name, windType };
      }

      // Extraire le paramètre numérique du nom
      // D'abord essayer d'extraire un nombre après headwind/tailwind
      let match = cleanName.match(/(?:headwind|tailwind)\s*(-?\d+(?:\.\d+)?)/i);
      if (!match) {
        // Sinon, enlever les unités et extraire le nombre
        cleanName = cleanName.replace(/\s*(kt|kg|°C|m|ft)\s*$/i, '');
        match = cleanName.match(/-?\d+(?:\.\d+)?/);
      }

      if (match) {
        const param = parseFloat(match[match.length === 2 ? 1 : 0]);
        return { curve: c, param, name: c.name, windType };
      }

      // Si pas de nombre trouvé, retourner NaN
      return { curve: c, param: NaN, name: c.name, windType };
    });

  // R16b — plus de DROP MUET : une courbe sans familyValue ET au nom non
  // numérique était silencieusement écartée du calcul (« Niveau mer » →
  // disparue). On la signale haut et fort.
  const droppedCurves = resolvedCurves.filter(cp => isNaN(cp.param));
  if (droppedCurves.length > 0) {
    console.warn(
      `⚠️ Graphe "${graph.name}" : ${droppedCurves.length} courbe(s) ÉCARTÉE(S) du calcul — ` +
      `ni valeur de famille saisie, ni nombre lisible dans le nom : ` +
      droppedCurves.map(d => `« ${d.name} »`).join(', ') +
      `. Renseigne la valeur de famille dans le gestionnaire de courbes.`
    );
  }

  let curvesWithParams = resolvedCurves.filter(cp => !isNaN(cp.param));

  // IMPORTANT: Si c'est un graphique de vent, filtrer selon la direction du vent
  if (graph.isWindRelated && windDirection && curvesWithParams.some(cp => cp.windType)) {
    console.log(`   🌬️ Graphique de vent détecté. Direction sélectionnée: ${windDirection}`);
    console.log(`   Courbes disponibles avant filtrage:`, curvesWithParams.map(c => `${c.name}(${c.windType})`));

    // Filtrer uniquement les courbes de la direction sélectionnée
    curvesWithParams = curvesWithParams.filter(cp => cp.windType === windDirection);

    console.log(`   Courbes après filtrage pour ${windDirection}:`, curvesWithParams.map(c => c.name));

    if (curvesWithParams.length === 0) {
      console.warn(`   ⚠️ Aucune courbe ${windDirection} trouvée dans le graphique`);
    }
  }

  // R11 — GARDE : on n'interpole JAMAIS entre deux familles de vent opposées.
  // Un guide « vent debout » DESCEND (le vent de face raccourcit la distance),
  // un guide « vent arrière » MONTE : toute paire mixte est physiquement
  // absurde (c'est exactement ce qui a produit 2968 ft au lieu de 1900 sur le
  // test de référence PA-28 : interpolation entre « tailwind 1 » et
  // « Headwind 2 »). Sans direction choisie, on REFUSE le calcul plutôt que
  // de rendre un résultat silencieusement faux.
  if (graph.isWindRelated && !windDirection) {
    const families = new Set(curvesWithParams.map(cp => cp.windType).filter(Boolean));
    if (families.size > 1) {
      console.warn('   ⛔ Graphe vent avec courbes vent de face ET vent arrière, aucune direction choisie — calcul refusé');
      return null;
    }
  }

  curvesWithParams = curvesWithParams.sort((a, b) => a.param - b.param);

  console.log(`🎯 Recherche pour paramètre ${parameterX}:`, curvesWithParams.map(c => `${c.name}(${c.param})`));

  // Si aucune courbe avec paramètre valide n'est trouvée
  if (curvesWithParams.length === 0) {
    console.error(`   ❌ Aucune courbe avec paramètre numérique trouvée dans le graphique "${graph.name}"`);
    console.log(`   Courbes disponibles:`, graph.curves.map(c => c.name));
    // Utiliser la première courbe par défaut si disponible
    if (graph.curves.length > 0) {
      const defaultCurve = graph.curves[0];
      const outputY = findYForX(defaultCurve, parameterX);
      if (outputY !== null) {
        console.log(`   ⚠️ Utilisation de la première courbe "${defaultCurve.name}" par défaut`);
        return {
          outputValue: outputY,
          curveUsed: defaultCurve.name + " (défaut)",
          interpolated: false
        };
      }
    }
    return null;
  }

  console.log(`\n🔄 === CALCUL AVEC PARAMÈTRE ===`);
  console.log(`📥 Entrée Y: ${inputY.toFixed(2)}`);
  console.log(`📊 Paramètre X: ${parameterX}`);

  // ÉTAPE 1: Tracer horizontalement à Y=inputY
  console.log(`\n📍 ÉTAPE 1: Ligne horizontale à Y=${inputY.toFixed(2)}`);

  // ÉTAPE 2: Analyser la position du point d'entrée par rapport aux courbes
  // Au lieu de chercher la première intersection, on doit déterminer entre quelles courbes on se trouve
  console.log(`📍 ÉTAPE 2: Analyse de la position Y=${inputY.toFixed(2)} par rapport aux courbes...`);

  // Pour chaque X, trouver entre quelles courbes on se trouve
  // D'abord, déterminer le X de la ligne de référence du panneau
  let xRef: number | null = null;

  // Plages X des guides : INTERSECTION (diagnostic) + UNION (repli sans axe)
  let xMinCommon = -Infinity;
  let xMaxCommon = Infinity;
  let xMinAll = Infinity;
  let xMaxAll = -Infinity;

  for (const cp of curvesWithParams) {
    if (cp.curve.fitted && cp.curve.fitted.points.length > 0) {
      const points = cp.curve.fitted.points;
      xMinCommon = Math.max(xMinCommon, points[0].x);
      xMaxCommon = Math.min(xMaxCommon, points[points.length - 1].x);
      xMinAll = Math.min(xMinAll, points[0].x);
      xMaxAll = Math.max(xMaxAll, points[points.length - 1].x);
    }
  }

  // R11 — L'ENTRÉE d'un panneau de correction se fait sur sa LIGNE DE
  // RÉFÉRENCE, qui est toujours au bord VISUEL GAUCHE du panneau (cf.
  // PA-28-181 : « ligne de référence 2550 lb » pour la masse, « ligne de
  // référence vent nul » pour le vent). En DONNÉES : gauche = xMin, SAUF axe
  // inversé (ex. masse décroissante vers la droite) où gauche = xMax.
  //
  // R20 — la ligne de référence est une propriété du PANNEAU (bord de son
  // AXE calibré), PAS de la couverture des tracés. L'ancien calcul prenait
  // le bord de la plage COMMUNE (intersection) des guides : UN seul guide
  // tronqué (ex. un guide haut qui sort par le plafond du graphe — cas
  // normal sur un abaque réel) repliait l'entrée au bout de CE guide, et le
  // suivi ne parcourait plus qu'un éclat du panneau. Cas réel PA-28 Flaps
  // TAKEOFF : guide « 11 » tronqué à 1089,9 kg ⇒ entrée à 1089,9 au lieu de
  // 1150 ⇒ correction de masse −0,2 % au lieu de −9 % ⇒ distance finale
  // +10 % (626 m au lieu de ~567). Les guides qui n'atteignent pas le bord
  // d'axe sont PROLONGÉS par leur pente de bord (findYForX extrapolate=true),
  // symétriquement au bout du suivi (R12) — le geste du crayon sur papier.
  // Repli si l'axe n'a pas de bornes finies : bord de l'ENVELOPPE (union)
  // des guides — jamais l'intersection, qui se contracte au moindre tronqué.
  const xAxisReversed = !!graph.axes?.xAxis?.reversed;
  const axisEdge = xAxisReversed ? graph.axes?.xAxis?.max : graph.axes?.xAxis?.min;
  const envelopeEdge = xAxisReversed ? xMaxAll : xMinAll;
  xRef = (typeof axisEdge === 'number' && isFinite(axisEdge)) ? axisEdge : envelopeEdge;

  if (!isFinite(xRef)) {
    console.error(`   ❌ Ligne de référence introuvable (axe sans bornes et guides sans points interpolés)`);
    return null;
  }

  console.log(`   X de référence = ligne de référence du panneau (bord d'axe visuel gauche${xAxisReversed ? ', axe inversé ⇒ xMax' : ''}): ${xRef.toFixed(2)}`);
  console.log(`   Plage X des guides — intersection: [${xMinCommon.toFixed(2)}, ${xMaxCommon.toFixed(2)}] · enveloppe: [${xMinAll.toFixed(2)}, ${xMaxAll.toFixed(2)}]`);

  // R20 — signale les guides qui n'atteignent pas la ligne de référence
  // (ils participent quand même, prolongés par leur pente de bord).
  const entryExtendedCurves = curvesWithParams.filter(cp => {
    const pts = cp.curve.fitted?.points;
    return pts && pts.length >= 2 && (xRef! < pts[0].x || xRef! > pts[pts.length - 1].x);
  });
  if (entryExtendedCurves.length > 0) {
    console.log(`   ✏ ${entryExtendedCurves.length} guide(s) prolongé(s) jusqu'à la ligne de référence : ${entryExtendedCurves.map(cp => `« ${cp.name} »`).join(', ')}`);
  }

  // Évaluer Y pour chaque courbe à X de référence
  // IMPORTANT: Pour le graphique de masse, on doit identifier les courbes par leur paramètre numérique
  // et non par leur position Y, car Y=732 doit être entre les courbes 2 et 3
  // R20 — extrapolate=true : un guide tronqué avant la ligne de référence
  // participe à l'encadrement, prolongé par sa pente de bord.
  const curvesAtRef = curvesWithParams
    .map(cp => {
      const y = findYForX(cp.curve, xRef, true);
      return { ...cp, yAtRef: y };
    })
    .filter(cp => cp.yAtRef !== null);

  // IMPORTANT: Trier par PARAMÈTRE et non par Y pour une identification correcte
  // Ceci est essentiel pour les graphiques de masse où les courbes sont numérotées
  const sortedByParam = [...curvesAtRef].sort((a, b) => a.param - b.param);

  console.log(`   Courbes triées par PARAMÈTRE:`);
  sortedByParam.forEach((cp, index) => {
    console.log(`     Courbe ${cp.param}: "${cp.name}" → Y=${cp.yAtRef!.toFixed(2)} à X=${xRef.toFixed(2)}`);
  });

  // Debug: vérifier les valeurs Y au bord d'entrée (R11 : bord de la ligne
  // de référence = premier point si axe normal, dernier si axe inversé)
  console.log(`   Valeurs Y des courbes au point de référence X=${xRef.toFixed(2)}:`);
  sortedByParam.forEach(cp => {
    if (cp.curve.fitted && cp.curve.fitted.points.length > 0) {
      const refPoint = xAxisReversed ?
        cp.curve.fitted.points[cp.curve.fitted.points.length - 1] :
        cp.curve.fitted.points[0];
      console.log(`     "${cp.name}" (param=${cp.param}): Y=${refPoint.y.toFixed(2)}`);
    }
  });

  console.log(`   🎯 Point d'entrée Y=${inputY.toFixed(2)} à comparer avec ces courbes`);

  // NOUVELLE APPROCHE: Trouver entre quelles courbes se situe le point Y d'entrée
  console.log(`\n📍 Analyse de la position de Y=${inputY.toFixed(2)} par rapport aux courbes triées par paramètre`);

  // Variables pour stocker les courbes encadrantes
  let lowerBoundCurve = null;
  let upperBoundCurve = null;
  let lowerBoundY = -Infinity;
  let upperBoundY = Infinity;

  // Utiliser les courbes triées par paramètre pour trouver l'encadrement
  let lowerCurve = null;
  let upperCurve = null;
  let lowerName = null;
  let upperName = null;
  let lowerParam = null;
  let upperParam = null;

  // Trouver les courbes qui encadrent le point Y
  // IMPORTANT: Créer une liste triée par Y pour trouver l'encadrement correct
  const sortedByY = [...sortedByParam]
    .filter(cp => cp.yAtRef !== null)
    .sort((a, b) => a.yAtRef! - b.yAtRef!);

  console.log(`   Courbes triées par valeur Y à X=${xRef.toFixed(2)}:`);
  sortedByY.forEach(cp => {
    console.log(`     "${cp.name}" (param=${cp.param}): Y=${cp.yAtRef!.toFixed(2)}`);
  });

  // Chercher l'encadrement dans les courbes triées par Y
  for (let i = 0; i < sortedByY.length - 1; i++) {
    const lower = sortedByY[i];
    const upper = sortedByY[i + 1];

    if (inputY >= lower.yAtRef! && inputY <= upper.yAtRef!) {
      lowerCurve = lower.curve;
      upperCurve = upper.curve;
      lowerName = lower.name;
      upperName = upper.name;
      lowerParam = lower.param;
      upperParam = upper.param;

      console.log(`   🎯 Point Y=${inputY.toFixed(2)} est ENTRE les courbes:`);
      console.log(`      - Courbe ${lowerParam} "${lowerName}": Y=${lower.yAtRef!.toFixed(2)}`);
      console.log(`      - Courbe ${upperParam} "${upperName}": Y=${upper.yAtRef!.toFixed(2)}`);
      break;
    }
  }

  // Variables pour stocker les courbes de référence
  let referenceCurve = null;
  let referenceName = null;
  let referenceX = xRef;

  // Déterminer si on est au-dessus, en dessous ou entre les courbes
  let isAboveAllCurves = false;
  let isBelowAllCurves = false;
  let positionRatio = 0;

  if (!lowerCurve && !upperCurve) {
    // Le point n'est pas entre deux courbes, vérifier s'il est au-dessus ou en dessous

    console.log(`   ⚠️ Pas trouvé entre deux courbes, analyse des limites...`);

    if (sortedByY.length > 0) {
      // Les limites Y min et max sont maintenant faciles à obtenir
      const minYCurve = sortedByY[0];
      const maxYCurve = sortedByY[sortedByY.length - 1];
      const minY = minYCurve.yAtRef!;
      const maxY = maxYCurve.yAtRef!;

      console.log(`   Plage Y des courbes:`);
      console.log(`     - Y minimum: ${minY.toFixed(2)} (courbe ${minYCurve.param} "${minYCurve.name}")`);
      console.log(`     - Y maximum: ${maxY.toFixed(2)} (courbe ${maxYCurve.param} "${maxYCurve.name}")`);
      console.log(`   Point Y d'entrée: ${inputY.toFixed(2)}`);

      if (inputY < minY) {
        isBelowAllCurves = true;
        lowerCurve = minYCurve.curve;
        lowerName = minYCurve.name;
        lowerParam = minYCurve.param;
        referenceCurve = lowerCurve;
        referenceName = lowerName;
        console.log(`   ⚠️ Point EN DESSOUS de la courbe ${lowerParam} (Y=${inputY.toFixed(2)} < min=${minY.toFixed(2)})`);
        console.log(`   📍 Utilisation de la courbe ${lowerParam} "${referenceName}" pour l'extrapolation`);
      } else if (inputY > maxY) {
        isAboveAllCurves = true;
        upperCurve = maxYCurve.curve;
        upperName = maxYCurve.name;
        upperParam = maxYCurve.param;
        referenceCurve = upperCurve;
        referenceName = upperName;
        console.log(`   ⚠️ Point AU-DESSUS de la courbe ${upperParam} (Y=${inputY.toFixed(2)} > max=${maxY.toFixed(2)})`);
        console.log(`   📍 Utilisation de la courbe ${upperParam} "${referenceName}" pour l'extrapolation`);
      } else {
        // Le point est dans la plage mais on n'a pas trouvé deux courbes encadrantes
        // OU le point est au-dessus/en-dessous mais on veut quand même trouver les deux courbes les plus proches
        console.log(`   ⚠️ Recherche des deux courbes les plus proches pour Y=${inputY.toFixed(2)}...`);

        // Rechercher manuellement les deux courbes les plus proches
        let closestBelow = null;
        let closestAbove = null;
        let closestBelowDist = Infinity;
        let closestAboveDist = Infinity;

        for (const cv of sortedByY) {
          if (cv.yAtRef !== null) {
            const diff = cv.yAtRef - inputY;
            if (diff <= 0 && Math.abs(diff) < closestBelowDist) {
              closestBelowDist = Math.abs(diff);
              closestBelow = cv;
            }
            if (diff >= 0 && Math.abs(diff) < closestAboveDist) {
              closestAboveDist = Math.abs(diff);
              closestAbove = cv;
            }
          }
        }

        if (closestBelow && closestAbove) {
          lowerCurve = closestBelow.curve;
          upperCurve = closestAbove.curve;
          lowerName = closestBelow.name;
          upperName = closestAbove.name;
          lowerParam = closestBelow.param;
          upperParam = closestAbove.param;

          const yLowerAtRef = closestBelow.yAtRef!;
          const yUpperAtRef = closestAbove.yAtRef!;
          positionRatio = (inputY - yLowerAtRef) / (yUpperAtRef - yLowerAtRef);

          console.log(`   ✅ Trouvé par recherche manuelle:`);
          console.log(`     Courbe inférieure: "${lowerName}" (Y=${yLowerAtRef.toFixed(2)})`);
          console.log(`     Courbe supérieure: "${upperName}" (Y=${yUpperAtRef.toFixed(2)})`);
          console.log(`     Ratio: ${positionRatio.toFixed(3)}`);
        } else {
          // Utiliser la courbe la plus proche
          const closest = closestBelow || closestAbove;
          if (closest) {
            referenceCurve = closest.curve;
            referenceName = closest.name;
            console.log(`   ⚠️ Une seule courbe proche trouvée: "${referenceName}"`);
          } else {
            console.error(`   ❌ Erreur: Impossible de trouver une courbe de référence`);
            return null;
          }
        }
      }
    } else {
      console.error(`   ❌ Aucune courbe disponible à X de référence`);
      return null;
    }
  } else {
    // On est entre deux courbes - calculer le ratio de position
    // R20 — extrapolate=true : la ligne de référence est au bord d'AXE,
    // possiblement au-delà du tracé des guides (prolongation par la pente).
    const yLowerAtRef = findYForX(lowerCurve, xRef, true);
    const yUpperAtRef = findYForX(upperCurve, xRef, true);

    if (yLowerAtRef !== null && yUpperAtRef !== null) {
      const range = yUpperAtRef - yLowerAtRef;
      positionRatio = (inputY - yLowerAtRef) / range;

      console.log(`   📏 Calcul du ratio de position à X=${xRef.toFixed(2)}:`);
      console.log(`     Courbe inférieure "${lowerName}": Y=${yLowerAtRef.toFixed(2)}`);
      console.log(`     Courbe supérieure "${upperName}": Y=${yUpperAtRef.toFixed(2)}`);
      console.log(`     Point d'entrée: Y=${inputY.toFixed(2)}`);
      console.log(`     Ratio: ${positionRatio.toFixed(3)} (0=courbe inférieure, 1=courbe supérieure)`);

      referenceCurve = lowerCurve;
      referenceName = `Entre ${lowerName} et ${upperName}`;
    }
  }

  // ÉTAPE 3: Application du ratio au paramètre X
  console.log(`\n📍 ÉTAPE 3: Application au paramètre X=${parameterX}`);
  console.log(`   État actuel:`);
  console.log(`     - isAboveAllCurves: ${isAboveAllCurves}`);
  console.log(`     - isBelowAllCurves: ${isBelowAllCurves}`);
  console.log(`     - lowerCurve: ${lowerCurve ? 'défini' : 'null'}`);
  console.log(`     - upperCurve: ${upperCurve ? 'défini' : 'null'}`);
  console.log(`     - referenceCurve: ${referenceCurve ? 'défini' : 'null'}`);

  let outputY = null;

  if (lowerCurve && upperCurve) {
    // MÉTHODE CORRECTE D'INTERPOLATION POUR LES ABAQUES
    // Étape 1: Le ratio de position a déjà été calculé (positionRatio)
    // Étape 2: Tracer une verticale à X=parameterX
    // Étape 3: Récupérer les valeurs Y sur les deux courbes de référence
    // Étape 4: Interpoler en utilisant le ratio de position initial

    console.log(`\n   📊 INTERPOLATION CORRECTE DES ABAQUES:`);
    console.log(`   Étape 1: Ratio de position Y = ${positionRatio.toFixed(4)} (${(positionRatio * 100).toFixed(2)}%)`);
    console.log(`   Étape 2: Tracé vertical à X=${parameterX}`);

    // Récupérer les valeurs Y de référence au point X de référence
    // R20 — extrapolate=true : cohérent avec le calcul du ratio (bord d'axe).
    const yLowerAtRef = findYForX(lowerCurve, xRef, true);
    const yUpperAtRef = findYForX(upperCurve, xRef, true);

    console.log(`   Courbes de référence au point d'entrée (X=${xRef.toFixed(2)}, Y=${inputY.toFixed(2)}):`);
    console.log(`     - Courbe inférieure "${lowerName}": Y=${yLowerAtRef?.toFixed(2) || 'non trouvé'}`);
    console.log(`     - Courbe supérieure "${upperName}": Y=${yUpperAtRef?.toFixed(2) || 'non trouvé'}`);
    console.log(`     - Ratio calculé: ${positionRatio.toFixed(4)}`);

    // Étape 3: Récupérer les valeurs sur les deux courbes de référence.
    // R11 — extrapolation FRANCHE au croisement : les guides tracés s'arrêtent
    // souvent avant le bord du panneau ; on les prolonge linéairement (comme
    // au crayon sur le papier) et on le signale.
    const yLowerAtParam = findYForX(lowerCurve, parameterX, true);
    const yUpperAtParam = findYForX(upperCurve, parameterX, true);
    const beyond = (c: Curve) => {
      const pts = c.fitted?.points;
      if (!pts || pts.length < 2) return false;
      return parameterX < pts[0].x || parameterX > pts[pts.length - 1].x;
    };
    const crossingExtrapolated = beyond(lowerCurve) || beyond(upperCurve);

    console.log(`   Étape 3: Valeurs croisées à X=${parameterX}${crossingExtrapolated ? ' (guide(s) prolongé(s) hors tracé)' : ''}:`);
    console.log(`     - Courbe inférieure "${lowerName}": Y=${yLowerAtParam?.toFixed(2) || 'non trouvé'}`);
    console.log(`     - Courbe supérieure "${upperName}": Y=${yUpperAtParam?.toFixed(2) || 'non trouvé'}`);

    if (yLowerAtParam !== null && yUpperAtParam !== null) {
      // Étape 4: Appliquer le ratio pour obtenir la valeur finale
      // 🔧 FIX J (réappliqué après restauration du fichier) : interpolation
      // PRINCIPIELLE — purge du facteur magique 1.914 et de la sortie forcée 870,
      // qui étaient calés sur UN seul point de test MANEX (inputY≈1115, paramX≈1050)
      // et faussaient le graphe de masse partout ailleurs. On applique directement
      // le ratio de position calculé entre les deux courbes encadrantes (bracket).
      // NB : ce fichier avait été MUTILÉ par une passe de strip de console.log
      // (oct. 2025) et ne compilait plus — restauré depuis a3a3ed6 (dernière
      // version syntaxiquement saine) lors de P4 (AUDIT_ABAC_CONSTRUCTION.md).
      const adjustedRatio = positionRatio;

      outputY = yLowerAtParam + adjustedRatio * (yUpperAtParam - yLowerAtParam);

      console.log(`   Étape 4: Interpolation finale:`);
      console.log(`     ${yLowerAtParam.toFixed(2)} + ${adjustedRatio.toFixed(4)} × (${yUpperAtParam.toFixed(2)} - ${yLowerAtParam.toFixed(2)})`);
      console.log(`     = ${yLowerAtParam.toFixed(2)} + ${(adjustedRatio * (yUpperAtParam - yLowerAtParam)).toFixed(2)}`);
      console.log(`   ✅ RÉSULTAT FINAL: Y=${outputY.toFixed(2)}`);

      // Stocker les valeurs de croisement pour l'affichage
      const result = {
        outputValue: outputY,
        curveUsed: `Entre ${lowerName} et ${upperName} (ratio ${positionRatio.toFixed(2)})${crossingExtrapolated ? ' — guide(s) prolongé(s) hors tracé' : ''}`,
        interpolated: true,
        referenceIntersectionX: referenceX,
        offset: positionRatio,
        valuesAtCrossing: {
          lowerValue: yLowerAtParam,
          upperValue: yUpperAtParam
        },
        referenceCurves: {
          lowerCurveName: lowerName,
          upperCurveName: upperName,
          lowerYAtRef: yLowerAtRef,
          upperYAtRef: yUpperAtRef
        }
      };
      console.log(`   📊 Valeurs de référence stockées:`, result.referenceCurves);
      return result;
    } else {
      // R11 — plus de « fallback par paramètre » : il comparait le X cible
      // (ex. 15 kt) aux NUMÉROS de famille des courbes (1, 2, 3…) — c'est lui
      // qui fabriquait des valeurs plausibles mais fausses quand un guide
      // s'arrêtait avant le X cible. Avec l'extrapolation franche de l'étape 3,
      // n'arrivent ici que les courbes sans `fitted` : on REFUSE le calcul.
      console.warn(`   ⛔ Valeurs introuvables sur les courbes de référence (fitted manquant ?) — calcul refusé`);
      return null;
    }
  } else if (isAboveAllCurves || isBelowAllCurves) {
    // Extrapolation avec décalage vertical — entrée AU-DESSUS/EN DESSOUS de
    // l'enveloppe des guides : on suit le guide le plus proche EN PARALLÈLE
    // (décalage vertical constant, le geste du crayon sur le papier).
    // R12 — extrapolation FRANCHE (true) ici aussi : si le guide tracé
    // s'arrête avant le X cible, on le prolonge SANS perdre le décalage.
    // (Avant : findYForX rendait null → un fallback rendait la valeur DU
    // guide, décalage perdu — sous-estimation possible au-dessus de
    // l'enveloppe, donc côté NON conservateur.)
    const yAtParam = findYForX(referenceCurve, parameterX, true);
    if (yAtParam !== null) {
      // Calculer le décalage vertical à maintenir
      // D'abord, essayer de trouver le Y de la courbe de référence à X de référence
      const yRefAtXRef = findYForX(referenceCurve, xRef, true);
      let verticalOffset = 0;

      if (yRefAtXRef !== null) {
        verticalOffset = inputY - yRefAtXRef;
      } else {
        // Fallback: trouver le point Y de la courbe de référence le plus proche de inputY
        let closestYOnCurve = null;
        let minDist = Infinity;

        if (referenceCurve.fitted && referenceCurve.fitted.points.length > 0) {
          for (const p of referenceCurve.fitted.points) {
            const dist = Math.abs(p.y - inputY);
            if (dist < minDist) {
              minDist = dist;
              closestYOnCurve = p.y;
            }
          }
        }

        if (closestYOnCurve !== null) {
          verticalOffset = inputY - closestYOnCurve;
        }
      }

      outputY = yAtParam + verticalOffset;

      console.log(`   📐 Extrapolation ${isAboveAllCurves ? 'AU-DESSUS' : 'EN DESSOUS'} avec décalage vertical`);
      console.log(`     Courbe de référence "${referenceName}" à X=${parameterX}: Y=${yAtParam.toFixed(2)}`);
      console.log(`     Décalage vertical maintenu: ${verticalOffset.toFixed(2)}`);
      console.log(`     Résultat: ${yAtParam.toFixed(2)} + ${verticalOffset.toFixed(2)} = Y=${outputY.toFixed(2)}`);
    }
  } else if (referenceCurve) {
    // Cas par défaut : suivre directement une courbe
    const yOnRefAtParameter = findYForX(referenceCurve, parameterX);
    if (yOnRefAtParameter !== null) {
      outputY = yOnRefAtParameter;
      console.log(`   Lecture directe sur "${referenceName}": Y=${outputY.toFixed(2)}`);
    }
  }

  if (outputY !== null) {
    console.log(`✅ RÉSULTAT FINAL: Y=${outputY.toFixed(2)}`);

    let curveDescription = referenceName;
    if (isAboveAllCurves) {
      curveDescription = `Au-dessus de la courbe ${upperParam} "${upperName}" (extrapolation)`;
    } else if (isBelowAllCurves) {
      curveDescription = `En dessous de la courbe ${lowerParam} "${lowerName}" (extrapolation)`;
    } else if (lowerCurve && upperCurve) {
      curveDescription = `Entre ${lowerName} et ${upperName} (ratio ${positionRatio.toFixed(2)})`;
    }

    const result = {
      outputValue: outputY,
      curveUsed: curveDescription,
      interpolated: lowerCurve && upperCurve,
      referenceIntersectionX: referenceX,
      offset: positionRatio,
      referenceCurves: lowerCurve && upperCurve ? {
        lowerCurveName: lowerName,
        upperCurveName: upperName,
        lowerYAtRef: findYForX(lowerCurve, xRef, true),
        upperYAtRef: findYForX(upperCurve, xRef, true)
      } : undefined
    };
    console.log(`   📊 Résultat final avec courbes de référence:`, result.referenceCurves);
    return result;
  } else {
    console.warn(`⚠️ Extrapolation nécessaire`);

    if (referenceCurve && referenceCurve.fitted && referenceCurve.fitted.points.length > 0) {
      const points = referenceCurve.fitted.points;
      const firstX = points[0].x;
      const lastX = points[points.length - 1].x;

      if (parameterX < firstX) {
        // Extrapolation à gauche
        const slope = (points[1].y - points[0].y) / (points[1].x - points[0].x);
        const extrapolatedY = points[0].y + slope * (parameterX - firstX);
        console.log(`   📉 Extrapolation gauche: Y=${extrapolatedY.toFixed(2)}`);
        return {
          outputValue: extrapolatedY,
          curveUsed: referenceName + " (extrapolé)",
          interpolated: true,
          referenceIntersectionX: referenceX,
          offset: 0
        };
      } else if (parameterX > lastX) {
        // Extrapolation à droite
        const n = points.length;
        const slope = (points[n-1].y - points[n-2].y) / (points[n-1].x - points[n-2].x);
        const extrapolatedY = points[n-1].y + slope * (parameterX - lastX);
        console.log(`   📈 Extrapolation droite: Y=${extrapolatedY.toFixed(2)}`);
        return {
          outputValue: extrapolatedY,
          curveUsed: referenceName + " (extrapolé)",
          interpolated: true,
          referenceIntersectionX: referenceX,
          offset: 0
        };
      }
    }

    console.error(`❌ Impossible de calculer une valeur`);
    return null;
  }
}

/**
 * Trouve la valeur Y de sortie pour une entrée Y donnée et un paramètre X
 * Utilise la courbe correspondant au paramètre ou interpole entre courbes
 *
 * @param graph Le graphique avec les courbes
 * @param inputY La valeur d'entrée sur l'axe Y
 * @param parameterX Le paramètre sur l'axe X (masse, vent, etc.)
 * @returns La valeur Y de sortie après avoir suivi la courbe
 */
function calculateOutputWithParameter(
  graph: GraphConfig,
  inputY: number,
  parameterX: number
): {
  outputValue: number;
  curveUsed?: string;
  interpolated: boolean;
  intersectionX?: number;
  parameterX?: number;
  inputY?: number;
} | null {
  if (!graph.curves || graph.curves.length === 0) {
    console.error(`❌ Pas de courbes dans le graphique ${graph.name}`);
    return null;
  }

  // Trouver la ou les courbes qui correspondent au paramètre X
  // Les courbes sont généralement nommées avec leur valeur de paramètre
  let bestCurve: Curve | null = null;
  let exactMatch = false;

  console.log(`🔍 Recherche de courbe pour paramètre ${parameterX} dans ${graph.name}`);
  console.log(`   Courbes disponibles: ${graph.curves.map(c => c.name).join(', ')}`);

  // Essayer de trouver une correspondance exacte
  for (const curve of graph.curves) {
    // Extraire la valeur numérique du nom de la courbe
    // Gérer les différents formats : "10", "-10", "10kt", etc.
    const curveName = curve.name.trim();
    // Retirer les unités communes
    const cleanName = curveName.replace(/\s*(kt|kg|°C|m|ft)\s*$/i, '');
    const curveParam = parseFloat(cleanName);

    console.log(`   Courbe "${curve.name}" → valeur: ${curveParam}`);

    if (!isNaN(curveParam) && Math.abs(curveParam - parameterX) < 0.1) {
      bestCurve = curve;
      exactMatch = true;
      console.log(`   ✅ Correspondance exacte trouvée: "${curve.name}"`);
      break;
    }
  }

  // Si pas de correspondance exacte, trouver les deux courbes encadrantes
  if (!bestCurve) {
    const curvesWithParams = graph.curves
      .map(c => {
        // R16b — même priorité que le résolveur paramétrique : la valeur
        // STRUCTURÉE d'abord, le parsing du nom en repli de compatibilité.
        if (typeof c.familyValue === 'number' && isFinite(c.familyValue)) {
          return { curve: c, param: c.familyValue };
        }
        const cleanName = c.name.trim().replace(/\s*(kt|kg|°C|m|ft)\s*$/i, '');
        return { curve: c, param: parseFloat(cleanName) };
      })
      .filter(cp => !isNaN(cp.param))
      .sort((a, b) => a.param - b.param);

    console.log(`   Courbes triées par paramètre:`, curvesWithParams.map(cp => `${cp.curve.name}(${cp.param})`));

    if (curvesWithParams.length === 0) {
      console.error(`❌ Impossible d'extraire les paramètres des courbes`);
      // Utiliser la première courbe par défaut
      bestCurve = graph.curves[0];
    } else if (curvesWithParams.length === 1) {
      bestCurve = curvesWithParams[0].curve;
    } else {
      // Trouver les deux courbes encadrantes
      let lowerCurve = null;
      let upperCurve = null;
      let lowerParam = -Infinity;
      let upperParam = Infinity;

      for (const cp of curvesWithParams) {
        if (cp.param <= parameterX && cp.param > lowerParam) {
          lowerCurve = cp.curve;
          lowerParam = cp.param;
        }
        if (cp.param >= parameterX && cp.param < upperParam) {
          upperCurve = cp.curve;
          upperParam = cp.param;
        }
      }

      // Si on a deux courbes encadrantes, interpoler
      if (lowerCurve && upperCurve && lowerCurve !== upperCurve) {
        // Trouver X pour Y sur chaque courbe
        const xLower = findXForY(lowerCurve, inputY);
        const xUpper = findXForY(upperCurve, inputY);

        if (xLower !== null && xUpper !== null) {
          // Interpoler entre les deux valeurs X selon le paramètre
          const ratio = (parameterX - lowerParam) / (upperParam - lowerParam);
          const interpolatedX = xLower + ratio * (xUpper - xLower);

          // Maintenant trouver Y pour ce X interpolé (en utilisant la courbe la plus proche)
          const outputY = ratio < 0.5
            ? findYForX(lowerCurve, interpolatedX)
            : findYForX(upperCurve, interpolatedX);

          if (outputY !== null) {
            return {
              outputValue: outputY,
              curveUsed: `Interpolé entre ${lowerCurve.name} et ${upperCurve.name}`,
              interpolated: true
            };
          }
        }
      }

      // Sinon utiliser la courbe la plus proche
      bestCurve = lowerCurve || upperCurve || graph.curves[0];
    }
  }

  // Utiliser la meilleure courbe trouvée
  console.log(`   Utilisation de la courbe: "${bestCurve.name}"`);

  // Dans un abaque avec paramètre :
  // 1. On entre avec une valeur Y (depuis le graphique précédent)
  // 2. On trace une ligne horizontale à cette valeur Y
  // 3. On trouve où cette ligne horizontale croise la courbe sélectionnée
  // 4. On descend verticalement pour lire la valeur X
  // 5. On monte jusqu'à la valeur du paramètre X
  // 6. On lit la valeur Y à ce point

  // Trouver X où la courbe croise la ligne horizontale Y=inputY
  const intersectionX = findXForY(bestCurve, inputY);

  if (intersectionX === null) {
    console.warn(`⚠️ Impossible de trouver l'intersection avec Y=${inputY} sur la courbe ${bestCurve.name}`);
    return null;
  }

  console.log(`   🎯 Intersection trouvée à X=${intersectionX.toFixed(2)} pour Y=${inputY}`);

  // Maintenant, trouver la valeur Y à X=parameterX sur la même courbe
  const outputY = findYForX(bestCurve, parameterX);

  if (outputY === null) {
    console.warn(`⚠️ Impossible de trouver Y pour X=${parameterX} sur la courbe ${bestCurve.name}`);
    // Essayons de trouver une valeur approchée
    if (bestCurve.fitted && bestCurve.fitted.points.length > 0) {
      // Prendre le point le plus proche
      const points = bestCurve.fitted.points;
      let closestPoint = points[0];
      let minDist = Math.abs(points[0].x - parameterX);

      for (const point of points) {
        const dist = Math.abs(point.x - parameterX);
        if (dist < minDist) {
          minDist = dist;
          closestPoint = point;
        }
      }

      console.log(`   Utilisation du point le plus proche: X=${closestPoint.x}, Y=${closestPoint.y}`);
      return {
        outputValue: closestPoint.y,
        curveUsed: bestCurve.name + ' (extrapolé)',
        interpolated: true
      };
    }
    return null;
  }

  console.log(`   🔢 Valeur Y trouvée: ${outputY} pour X=${parameterX}`);

  return {
    outputValue: outputY,
    curveUsed: bestCurve.name + (exactMatch ? '' : ' (approx)'),
    interpolated: !exactMatch,
    intersectionX,
    parameterX,
    inputY
  };
}

/**
 * Effectue un calcul en cascade à travers une série de graphiques chaînés avec paramètres
 * @param graphs Liste des graphiques dans l'ordre de chaînage
 * @param initialValue Valeur d'entrée initiale (pour le premier graphique sur X)
 * @param parameters Paramètres pour chaque graphique (masse, vent, etc.)
 * @returns Résultat du calcul en cascade avec toutes les étapes
 */
export function performCascadeCalculationWithParameters(
  graphs: GraphConfig[],
  initialValue: number,
  parameters: GraphParameters[] = []
): CascadeResult {
  console.log('🔄 === Début du calcul en cascade avec paramètres ===');
  console.log('📊 Graphiques:', graphs.map(g => g.name).join(' → '));
  console.log('📥 Valeur initiale:', initialValue);
  console.log('📋 Paramètres:', parameters);

  const steps: CascadeStep[] = [];
  let currentValue = initialValue;

  for (let i = 0; i < graphs.length; i++) {
    const graph = graphs[i];
    console.log(`\n📈 Étape ${i + 1}: ${graph.name}`);

    // Vérifier que le graphique a des axes configurés
    if (!graph.axes) {
      return {
        steps,
        finalValue: currentValue,
        success: false,
        error: `Le graphique "${graph.name}" n'a pas d'axes configurés`
      };
    }

    // Obtenir le paramètre pour ce graphique
    const graphParam = parameters.find(p => p.graphId === graph.id);

    let result: { outputValue: number; curveUsed?: string; interpolated: boolean; referenceIntersectionX?: number; offset?: number } | null;

    if (i === 0) {
      // Premier graphique : peut aussi avoir un paramètre (altitude pression)
      const paramValue = graphParam?.parameter;

      console.log(`  Entrée X (${graph.axes.xAxis.title}): ${currentValue}`);

      if (paramValue !== undefined) {
        // Si un paramètre est fourni (altitude), l'utiliser pour sélectionner la courbe
        console.log(`  Paramètre altitude: ${paramValue}`);

        // Trouver la courbe correspondant à l'altitude
        let selectedCurve: Curve | null = null;

        // R16b — même règle que les autres résolveurs : la valeur STRUCTURÉE
        // (Curve.familyValue) d'abord, le parsing du nom en repli de compat.
        const altitudeOf = (curve: Curve): number => {
          if (typeof curve.familyValue === 'number' && isFinite(curve.familyValue)) {
            return curve.familyValue;
          }
          return parseFloat(curve.name.trim().replace(/\s*(ft|m|FL)\s*$/i, ''));
        };

        // D'abord chercher une correspondance exacte
        for (const curve of graph.curves) {
          const curveAltitude = altitudeOf(curve);

          if (!isNaN(curveAltitude) && Math.abs(curveAltitude - paramValue) < 100) {
            selectedCurve = curve;
            console.log(`  ✅ Courbe altitude trouvée: "${curve.name}"`);
            break;
          }
        }

        // Si pas de correspondance exacte, trouver les courbes encadrantes
        if (!selectedCurve) {
          const curvesWithAltitudes = graph.curves
            .map(c => ({ curve: c, altitude: altitudeOf(c) }))
            .filter(ca => !isNaN(ca.altitude))
            .sort((a, b) => a.altitude - b.altitude);

          if (curvesWithAltitudes.length > 0) {
            // Trouver les deux courbes encadrantes ou la plus proche
            let lowerCurve = null;
            let upperCurve = null;
            let lowerAlt = -Infinity;
            let upperAlt = Infinity;

            for (const ca of curvesWithAltitudes) {
              if (ca.altitude <= paramValue && ca.altitude > lowerAlt) {
                lowerCurve = ca.curve;
                lowerAlt = ca.altitude;
              }
              if (ca.altitude >= paramValue && ca.altitude < upperAlt) {
                upperCurve = ca.curve;
                upperAlt = ca.altitude;
              }
            }

            // Si on a deux courbes encadrantes, interpoler
            if (lowerCurve && upperCurve && lowerCurve !== upperCurve) {
              const yLower = findYForX(lowerCurve, currentValue);
              const yUpper = findYForX(upperCurve, currentValue);

              if (yLower !== null && yUpper !== null) {
                const ratio = (paramValue - lowerAlt) / (upperAlt - lowerAlt);
                const interpolatedY = yLower + ratio * (yUpper - yLower);

                result = {
                  outputValue: interpolatedY,
                  curveUsed: `Interpolé entre ${lowerCurve.name} et ${upperCurve.name}`,
                  interpolated: true
                };

                console.log(`  Interpolation altitude: ${yLower.toFixed(2)} → ${interpolatedY.toFixed(2)} → ${yUpper.toFixed(2)}`);
              }
            } else {
              // Utiliser la courbe la plus proche
              selectedCurve = lowerCurve || upperCurve || graph.curves[0];
            }
          } else {
            // Pas de valeurs d'altitude : repli sur la première courbe — mais
            // R16b : PLUS JAMAIS en silence (c'est une lecture sur une courbe
            // arbitraire). Renseigner familyValue dans le gestionnaire.
            console.warn(
              `⚠️ Graphe "${graph.name}" : aucune courbe avec valeur de famille lisible ` +
              `(ni familyValue, ni nombre dans le nom) — repli sur la PREMIÈRE courbe ` +
              `« ${graph.curves[0]?.name} », résultat potentiellement faux.`
            );
            selectedCurve = graph.curves[0];
          }
        }

        // Si on a une courbe sélectionnée et pas encore de résultat
        if (selectedCurve && !result) {
          const outputY = findYForX(selectedCurve, currentValue);
          if (outputY === null) {
            return {
              steps,
              finalValue: currentValue,
              success: false,
              error: `Impossible de calculer Y pour X=${currentValue} sur la courbe "${selectedCurve.name}"`
            };
          }

          result = {
            outputValue: outputY,
            curveUsed: selectedCurve.name,
            interpolated: false
          };
        }
      } else {
        // Pas de paramètre altitude, utiliser la première courbe ou moyenne
        console.log(`  ⚠️ Pas d'altitude spécifiée, utilisation de la première courbe`);

        const curve = graph.curves[0];
        if (!curve) {
          return {
            steps,
            finalValue: currentValue,
            success: false,
            error: `Le graphique "${graph.name}" n'a pas de courbes`
          };
        }

        const outputY = findYForX(curve, currentValue);
        if (outputY === null) {
          return {
            steps,
            finalValue: currentValue,
            success: false,
            error: `Impossible de calculer Y pour X=${currentValue} sur le graphique "${graph.name}"`
          };
        }

        result = {
          outputValue: outputY,
          curveUsed: curve.name + " (par défaut)",
          interpolated: false
        };
      }

      console.log(`  Sortie Y: ${result.outputValue}`);
    } else {
      // Graphiques suivants : valeur sur Y avec paramètre sur X
      const paramValue = graphParam?.parameter;

      if (paramValue === undefined) {
        return {
          steps,
          finalValue: currentValue,
          success: false,
          error: `Paramètre manquant pour le graphique "${graph.name}". Veuillez spécifier ${graph.axes.xAxis.title}`
        };
      }

      console.log(`  Entrée Y: ${currentValue}`);
      console.log(`  Paramètre X (${graphParam.parameterName || graph.axes.xAxis.title}): ${paramValue}`);

      // Debug spécial pour le graphique de masse
      if (graph.name.toLowerCase().includes('masse')) {
        console.log(`  🔍 DEBUG GRAPHIQUE DE MASSE - AVANT CALCUL:`);
        console.log(`    - Entrée Y depuis graphique précédent: ${currentValue}`);
        console.log(`    - Paramètre masse X: ${paramValue}`);
        console.log(`    - Axes du graphique: X=[${graph.axes.xAxis.min}, ${graph.axes.xAxis.max}], Y=[${graph.axes.yAxis.min}, ${graph.axes.yAxis.max}]`);
        console.log(`    - Nombre de courbes: ${graph.curves.length}`);
        console.log(`    - Courbes disponibles:`, graph.curves.map(c => `${c.name} (${c.points.length} points)`));
      }

      // Si c'est un graphique de vent, passer la direction du vent
      const windDirection = graph.isWindRelated ? graphParam.windDirection : undefined;
      if (windDirection) {
        console.log(`  Direction du vent: ${windDirection}`);
      }

      result = calculateOutputWithParameterCorrect(graph, currentValue, paramValue, windDirection);

      if (!result) {
        // R11 — le refus le plus fréquent : graphe vent à familles mixtes sans
        // direction choisie (la garde anti-interpolation mixte a rendu null).
        const windHint = graph.isWindRelated && !windDirection
          ? ' Ce graphe contient des courbes vent de face ET vent arrière : choisis la direction du vent avant de calculer.'
          : '';
        return {
          steps,
          finalValue: currentValue,
          success: false,
          error: `Impossible de calculer la sortie pour Y=${currentValue} avec ${graph.axes.xAxis.title}=${paramValue} sur le graphique "${graph.name}".${windHint}`
        };
      }

      console.log(`  Sortie Y: ${result.outputValue}`);
    }

    console.log(`  Courbe: ${result.curveUsed || 'N/A'}`);
    console.log(`  Interpolé: ${result.interpolated ? 'Oui' : 'Non'}`);

    // Enregistrer l'étape
    steps.push({
      graphId: graph.id,
      graphName: graph.name,
      inputValue: currentValue,
      parameter: graphParam?.parameter,
      parameterName: graphParam?.parameterName,
      outputValue: result.outputValue,
      curveUsed: result.curveUsed,
      referenceIntersectionX: result.referenceIntersectionX,
      offset: result.offset,
      interpolated: result.interpolated,
      valuesAtCrossing: result.valuesAtCrossing,
      referenceCurves: result.referenceCurves
    });

    // La valeur de sortie devient l'entrée du prochain graphique
    currentValue = result.outputValue;
  }

  console.log('\n✅ Calcul en cascade terminé');
  console.log(`📊 Valeur finale: ${currentValue}`);
  console.log('🔄 === Fin du calcul en cascade ===\n');

  return {
    steps,
    finalValue: currentValue,
    success: true
  };
}

/**
 * Effectue un calcul en cascade simple (ancienne version pour compatibilité)
 * @param graphs Liste des graphiques dans l'ordre de chaînage
 * @param initialValue Valeur d'entrée initiale
 * @returns Résultat du calcul en cascade avec toutes les étapes
 */
export function performCascadeCalculation(
  graphs: GraphConfig[],
  initialValue: number
): CascadeResult {
  console.log('🔄 === Début du calcul en cascade ===');
  console.log('📊 Graphiques:', graphs.map(g => g.name).join(' → '));
  console.log('📥 Valeur initiale:', initialValue);

  const steps: CascadeStep[] = [];
  let currentValue = initialValue;

  for (let i = 0; i < graphs.length; i++) {
    const graph = graphs[i];
    console.log(`\n📈 Étape ${i + 1}: ${graph.name}`);

    // Vérifier que le graphique a des axes configurés
    if (!graph.axes) {
      return {
        steps,
        finalValue: currentValue,
        success: false,
        error: `Le graphique "${graph.name}" n'a pas d'axes configurés`
      };
    }

    // Déterminer sur quel axe reporter la valeur d'entrée
    // Par défaut, on utilise l'axe X, sauf si c'est un graphique chaîné et que
    // l'unité de sortie du graphique précédent correspond mieux à l'axe Y
    let inputAxis: 'x' | 'y' = 'x';

    // Pour les graphiques après le premier, vérifier si la valeur doit être sur Y
    if (i > 0) {
      const prevGraph = graphs[i - 1];

      // Si le graphique précédent a une sortie en Y et que ce graphique attend cette valeur en Y
      // On regarde si les unités correspondent mieux sur Y que sur X
      if (prevGraph.axes && graph.axes) {
        const prevOutputUnit = prevGraph.axes.yAxis.unit || prevGraph.axes.yAxis.title;
        const currentXUnit = graph.axes.xAxis.unit || graph.axes.xAxis.title;
        const currentYUnit = graph.axes.yAxis.unit || graph.axes.yAxis.title;

        // Si l'unité de sortie précédente correspond mieux à Y qu'à X
        // ou si la valeur est hors des limites de X mais dans les limites de Y
        const xInRange = currentValue >= graph.axes.xAxis.min && currentValue <= graph.axes.xAxis.max;
        const yInRange = currentValue >= graph.axes.yAxis.min && currentValue <= graph.axes.yAxis.max;

        if (!xInRange && yInRange) {
          inputAxis = 'y';
          console.log(`  ⚠️ Valeur ${currentValue} hors limites X [${graph.axes.xAxis.min}, ${graph.axes.xAxis.max}]`);
          console.log(`  ✅ Utilisation de l'axe Y [${graph.axes.yAxis.min}, ${graph.axes.yAxis.max}]`);
        }
      }
    }

    console.log(`  Entrée ${inputAxis.toUpperCase()}: ${currentValue}`);

    // Calculer la valeur de sortie
    const result = calculateOutputFromGraph(graph, currentValue, inputAxis);

    if (!result) {
      return {
        steps,
        finalValue: currentValue,
        success: false,
        error: `Impossible de calculer la valeur pour ${inputAxis.toUpperCase()}=${currentValue} sur le graphique "${graph.name}"`
      };
    }

    const outputAxis = inputAxis === 'x' ? 'Y' : 'X';
    console.log(`  Sortie ${outputAxis}: ${result.outputValue}`);
    console.log(`  Courbe: ${result.curveUsed || 'N/A'}`);
    console.log(`  Interpolé: ${result.interpolated ? 'Oui' : 'Non'}`);

    // Enregistrer l'étape
    steps.push({
      graphId: graph.id,
      graphName: graph.name,
      inputValue: currentValue,
      outputValue: result.outputValue,
      inputAxis: inputAxis,
      outputAxis: inputAxis === 'x' ? 'y' : 'x',
      curveUsed: result.curveUsed,
      interpolated: result.interpolated
    });

    // La valeur de sortie devient l'entrée du prochain graphique
    currentValue = result.outputValue;
  }

  console.log('\n✅ Calcul en cascade terminé');
  console.log(`📊 Valeur finale: ${currentValue}`);
  console.log('🔄 === Fin du calcul en cascade ===\n');

  return {
    steps,
    finalValue: currentValue,
    success: true
  };
}

/**
 * Trouve la chaîne de graphiques connectés à partir d'un graphique de départ
 */
export function findGraphChain(
  graphs: GraphConfig[],
  startGraphId: string
): GraphConfig[] {
  const chain: GraphConfig[] = [];
  const visited = new Set<string>();

  let currentGraph = graphs.find(g => g.id === startGraphId);

  while (currentGraph && !visited.has(currentGraph.id)) {
    chain.push(currentGraph);
    visited.add(currentGraph.id);

    // Trouver le prochain graphique dans la chaîne
    if (currentGraph.linkedTo && currentGraph.linkedTo.length > 0) {
      // Pour l'instant, on prend le premier lien
      const nextId = currentGraph.linkedTo[0];
      currentGraph = graphs.find(g => g.id === nextId);
    } else {
      break;
    }
  }

  return chain;
}

/**
 * Valide qu'une chaîne de graphiques est correctement configurée
 */
export function validateGraphChain(graphs: GraphConfig[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (let i = 0; i < graphs.length; i++) {
    const graph = graphs[i];

    // Vérifier les axes
    if (!graph.axes) {
      errors.push(`${graph.name}: Axes non configurés`);
    }

    // Vérifier les courbes
    if (!graph.curves || graph.curves.length === 0) {
      errors.push(`${graph.name}: Aucune courbe définie`);
    } else {
      // Vérifier que les courbes sont interpolées
      const nonInterpolated = graph.curves.filter(c => !c.fitted);
      if (nonInterpolated.length > 0) {
        errors.push(`${graph.name}: ${nonInterpolated.length} courbe(s) non interpolée(s)`);
      }
    }

    // Vérifier la cohérence des liaisons
    if (i < graphs.length - 1) {
      const nextGraph = graphs[i + 1];
      if (graph.linkedTo && !graph.linkedTo.includes(nextGraph.id)) {
        errors.push(`${graph.name}: Liaison manquante vers ${nextGraph.name}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}