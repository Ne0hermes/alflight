// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  TESTS D'OR (caractérisation) — src/services/abacInterpolation.js        ║
// ║                                                                          ║
// ║  VAGUE 3 / PHASE 2 : filet de sécurité AVANT le déplacement des moteurs  ║
// ║  de performances vers @alflight/calc-engine.                             ║
// ║                                                                          ║
// ║  ⚠️ Ces tests décrivent ce que le code FAIT AUJOURD'HUI, pas ce qu'il    ║
// ║  devrait faire. Plusieurs comportements figés ici sont DISCUTABLES        ║
// ║  (voire dangereux pour une distance de piste) : ils sont marqués          ║
// ║  « ⚠️ SURPRISE » et remontés dans le compte rendu, PAS corrigés.         ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { describe, it, expect } from 'vitest';
import {
  InterpolationStatus,
  inputsToConditions,
  extractPoints,
  idwInterpolate,
  bracketInterpolateGraph,
  slopeFollowInterpolateGraph,
  evaluateAbacCascade,
  inspectAbacByGraph,
  interpolateAbac
} from '@services/abacInterpolation';

// ─────────────────────────────────────────────────────────────────────────
// Fixtures partagées
// ─────────────────────────────────────────────────────────────────────────

/** Abaque décollage classique : X = température, famille = altitude pression. */
const makeGraphAltitudeFamily = () => ({
  id: 'g-alt',
  axes: {
    xAxis: { title: 'temperature', unit: '°C' },
    yAxis: { title: 'takeoff_distance', unit: 'm' }
  },
  curves: [
    { name: '0 ft',    points: [{ x: 0, y: 300 }, { x: 40, y: 500 }] },
    { name: '2000 ft', points: [{ x: 0, y: 400 }, { x: 40, y: 640 }] },
    { name: '4000 ft', points: [{ x: 0, y: 520 }, { x: 40, y: 820 }] }
  ]
});
// Lectures utiles à T = 20 °C : 0ft → 400, 2000ft → 520, 4000ft → 670

/** Graphe mono-courbe (pas de famille). */
const makeMonoGraph = () => ({
  id: 'g-mono',
  axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
  curves: [{ name: 'unique', points: [{ x: 0, y: 300 }, { x: 40, y: 500 }] }]
});

/** Graphe à famille DÉCLARÉE (familyAxisVariable + familyValue). */
const makeManualFamilyGraph = () => ({
  id: 'g-manual',
  axes: { xAxis: { title: 'pressure_altitude' }, yAxis: { title: 'distance' } },
  familyAxisVariable: 'mass',
  curves: [
    { name: 'léger', familyValue: 800,  points: [{ x: 0, y: 200 }, { x: 4000, y: 300 }] },
    { name: 'lourd', familyValue: 1000, points: [{ x: 0, y: 300 }, { x: 4000, y: 460 }] }
  ]
});

/** Graphe vent avec courbes headwind ET tailwind (types mixtes). */
const makeMixedWindGraph = () => ({
  id: 'g-wind',
  axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
  familyAxisVariable: 'headwind',
  curves: [
    { name: 'HW 10', familyValue: 10, windDirection: 'headwind', points: [{ x: 0, y: 280 }, { x: 40, y: 460 }] },
    { name: 'HW 0',  familyValue: 0,  windDirection: 'headwind', points: [{ x: 0, y: 300 }, { x: 40, y: 500 }] },
    { name: 'TW 5',  familyValue: 5,  windDirection: 'tailwind', points: [{ x: 0, y: 360 }, { x: 40, y: 600 }] },
    { name: 'TW 10', familyValue: 10, windDirection: 'tailwind', points: [{ x: 0, y: 420 }, { x: 40, y: 700 }] }
  ]
});
// Lectures à T = 20 °C : HW10 → 370, HW0 → 400, TW5 → 480, TW10 → 560

/** Graphe de guides sans valeur familiale (slope-follow). */
const makeSlopeGraph = () => ({
  id: 'g-slope',
  axes: { xAxis: { title: 'temperature', min: 0, max: 40 } },
  curves: [
    { name: 'g1', points: [{ x: 0, y: 100 }, { x: 40, y: 200 }] },
    { name: 'g2', points: [{ x: 0, y: 200 }, { x: 40, y: 340 }] },
    { name: 'g3', points: [{ x: 0, y: 300 }, { x: 40, y: 500 }] }
  ]
});
// Lectures à X = 20 : g1 → 150, g2 → 270, g3 → 400

// ═════════════════════════════════════════════════════════════════════════
describe('InterpolationStatus', () => {
  it('expose les 4 statuts et l\'objet est gelé', () => {
    expect(InterpolationStatus).toEqual({
      OK: 'OK', NO_POINTS: 'NO_POINTS', NO_GRAPH: 'NO_GRAPH', ERROR: 'ERROR'
    });
    expect(Object.isFrozen(InterpolationStatus)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('inputsToConditions — conversion des entrées', () => {
  it('cas nominal : toutes les entrées présentes', () => {
    expect(inputsToConditions({ oat: 20, pressureAltitude: 500, mass: 950, headwind: 8 }))
      .toEqual({ temperature: 20, pressure_altitude: 500, mass: 950, wind: 8 });
  });

  it('ordre des alias : oat > temperature, pressureAltitude > pressure_altitude', () => {
    const c = inputsToConditions({
      oat: 10, temperature: 99,
      pressureAltitude: 1000, pressure_altitude: 9999
    });
    expect(c.temperature).toBe(10);
    expect(c.pressure_altitude).toBe(1000);
  });

  it('alias de repli utilisés si le principal est absent', () => {
    const c = inputsToConditions({ temperature: 12, pressure_altitude: 700, massTakeoff: 880, windComponent: -4 });
    expect(c).toEqual({ temperature: 12, pressure_altitude: 700, mass: 880, wind: -4 });
  });

  it('masse : mass > massTakeoff > massLanding', () => {
    expect(inputsToConditions({ massLanding: 700 }).mass).toBe(700);
    expect(inputsToConditions({ massTakeoff: 800, massLanding: 700 }).mass).toBe(800);
    expect(inputsToConditions({ mass: 900, massTakeoff: 800, massLanding: 700 }).mass).toBe(900);
  });

  it('vent : headwind > windComponent > wind > 0 (défaut conservateur)', () => {
    expect(inputsToConditions({ wind: 3 }).wind).toBe(3);
    expect(inputsToConditions({ windComponent: 5, wind: 3 }).wind).toBe(5);
    expect(inputsToConditions({}).wind).toBe(0);
  });

  it('les zéros sont conservés (pas confondus avec absent)', () => {
    const c = inputsToConditions({ oat: 0, pressureAltitude: 0, mass: 0, headwind: 0 });
    expect(c).toEqual({ temperature: 0, pressure_altitude: 0, mass: 0, wind: 0 });
  });

  it('entrées absentes → null (aucun défaut ISA fabriqué), sauf vent = 0', () => {
    expect(inputsToConditions({})).toEqual({
      temperature: null, pressure_altitude: null, mass: null, wind: 0
    });
    expect(inputsToConditions()).toEqual({
      temperature: null, pressure_altitude: null, mass: null, wind: 0
    });
  });

  it('NaN / Infinity / string sont traités comme absents', () => {
    const c = inputsToConditions({ oat: NaN, pressureAltitude: Infinity, mass: '900', headwind: NaN });
    expect(c).toEqual({ temperature: null, pressure_altitude: null, mass: null, wind: 0 });
  });

  it('NaN sur l\'alias principal retombe sur l\'alias secondaire', () => {
    expect(inputsToConditions({ oat: NaN, temperature: 17 }).temperature).toBe(17);
  });

  it('⚠️ SURPRISE : inputsToConditions(null) lève une TypeError (le défaut ne couvre que undefined)', () => {
    expect(() => inputsToConditions(null)).toThrow(TypeError);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('extractPoints — aplatissement de l\'abaque en nuage 4D', () => {
  it('abaque falsy → tableau vide', () => {
    expect(extractPoints(null)).toEqual([]);
    expect(extractPoints(undefined)).toEqual([]);
    expect(extractPoints(0)).toEqual([]);
  });

  it('objet sans graphs ni curves → tableau vide', () => {
    expect(extractPoints({})).toEqual([]);
    expect(extractPoints({ graphs: [] })).toEqual([]);
  });

  it('cas nominal : X=température, Y=distance, famille=altitude parsée du nom', () => {
    const pts = extractPoints(makeGraphAltitudeFamily(), { temperature: 20, pressure_altitude: 1000, mass: 900, wind: 3 });
    expect(pts).toHaveLength(6);
    expect(pts[0]).toEqual({ temperature: 0,  pressure_altitude: 0, mass: 900, wind: 3, distance: 300 });
    expect(pts[1]).toEqual({ temperature: 40, pressure_altitude: 0, mass: 900, wind: 3, distance: 500 });
    expect(pts[2].pressure_altitude).toBe(2000);
    expect(pts[5]).toEqual({ temperature: 40, pressure_altitude: 4000, mass: 900, wind: 3, distance: 820 });
  });

  it('defaultCond vide → défauts internes 15 °C / 0 ft / 1000 kg / 0 kt', () => {
    const pts = extractPoints(makeGraphAltitudeFamily());
    expect(pts[0].mass).toBe(1000);
    expect(pts[0].wind).toBe(0);
    // temperature/pressure_altitude sont écrasés ici par X et le nom de courbe
    const noAxis = extractPoints({ curves: [{ name: 'courbe X', points: [{ x: 1, y: 2 }] }] });
    expect(noAxis[0]).toEqual({ temperature: 15, pressure_altitude: 0, mass: 1000, wind: 0, distance: 0 });
  });

  it('⚠️ SURPRISE : defaultCond avec des null retombe sur les défauts internes (null ?? 15)', () => {
    const pts = extractPoints(
      { curves: [{ name: 'courbe X', points: [{ x: 1, y: 2 }] }] },
      { temperature: null, pressure_altitude: null, mass: null, wind: null }
    );
    expect(pts[0]).toEqual({ temperature: 15, pressure_altitude: 0, mass: 1000, wind: 0, distance: 0 });
  });

  it('accepte un graphe isolé (objet avec .curves) aussi bien qu\'un abaque (.graphs)', () => {
    const graph = makeGraphAltitudeFamily();
    expect(extractPoints(graph)).toHaveLength(6);
    expect(extractPoints({ graphs: [graph] })).toHaveLength(6);
  });

  it('accepte les axes déclarés à plat (graph.xAxis / graph.yAxis)', () => {
    const pts = extractPoints({
      curves: [{ name: '0 ft', points: [{ x: 12, y: 345 }] }],
      xAxis: { title: 'Température (°C)' },
      yAxis: { title: 'Distance de décollage' }
    });
    expect(pts[0].temperature).toBe(12);
    expect(pts[0].distance).toBe(345);
  });

  it('titres reconnus : oat / masse-weight / vent / altitude', () => {
    const mk = (xTitle, yTitle) => extractPoints({
      curves: [{ name: 'courbe X', points: [{ x: 7, y: 11 }] }],
      xAxis: { title: xTitle }, yAxis: { title: yTitle }
    })[0];
    expect(mk('OAT', 'distance').temperature).toBe(7);
    expect(mk('weight', 'distance').mass).toBe(7);
    expect(mk('Vent effectif', 'distance').wind).toBe(7);
    expect(mk('Altitude pression', 'distance').pressure_altitude).toBe(7);
    expect(mk('pa', 'distance').pressure_altitude).toBe(7);
  });

  it('⚠️ SURPRISE (SOUS-ESTIMATION) : titre d\'axe Y non reconnu → distance = 0 silencieusement', () => {
    const pts = extractPoints({
      curves: [{ name: '0 ft', points: [{ x: 10, y: 850 }] }],
      xAxis: { title: 'temperature' },
      yAxis: { title: 'Longueur de roulement' } // ne contient aucun mot-clé reconnu
    });
    expect(pts[0].distance).toBe(0); // la vraie valeur 850 est PERDUE
  });

  it('les courbes vides sont ignorées', () => {
    const pts = extractPoints({
      curves: [{ name: '0 ft', points: [] }, { name: '2000 ft', points: [{ x: 0, y: 1 }] }],
      xAxis: { title: 'temperature' }, yAxis: { title: 'distance' }
    });
    expect(pts).toHaveLength(1);
    expect(pts[0].pressure_altitude).toBe(2000);
  });

  describe('parsing du nom de courbe (paramètre familial)', () => {
    const kindOf = (name) => extractPoints({
      curves: [{ name, points: [{ x: 5, y: 100 }] }],
      xAxis: { title: 'inconnu' }, yAxis: { title: 'distance' }
    })[0];

    it('"2000 ft" / "2000" / "0ft" → altitude', () => {
      expect(kindOf('2000 ft').pressure_altitude).toBe(2000);
      expect(kindOf('2000').pressure_altitude).toBe(2000);   // nombre nu = convention legacy
      expect(kindOf('0ft').pressure_altitude).toBe(0);
      expect(kindOf('-500 ft').pressure_altitude).toBe(-500);
      expect(kindOf('65 FL').pressure_altitude).toBe(65);
    });

    it('"20°C" → température, "850 kg" → masse', () => {
      expect(kindOf('20°C').temperature).toBe(20);
      expect(kindOf('-5 °C').temperature).toBe(-5);
      expect(kindOf('850 kg').mass).toBe(850);
      expect(kindOf('1800 lb').mass).toBe(1800);
    });

    it('nom ne commençant pas par un chiffre → ignoré (défauts conservés)', () => {
      const p = kindOf('headwind 1');
      expect(p.pressure_altitude).toBe(0);
      expect(p.temperature).toBe(15);
      expect(kindOf('FL065').pressure_altitude).toBe(0); // "FL065" ne commence pas par un chiffre
    });

    it('unité inconnue ("10 kt") → aucune dimension appliquée', () => {
      const p = kindOf('10 kt');
      expect(p.pressure_altitude).toBe(0);
      expect(p.temperature).toBe(15);
      expect(p.mass).toBe(1000);
      expect(p.wind).toBe(0);
    });

    it('⚠️ SURPRISE : "10 mph" est lu comme une ALTITUDE de 10 (regex /^(ft|m|fl)/)', () => {
      expect(kindOf('10 mph').pressure_altitude).toBe(10);
    });

    it('⚠️ SURPRISE : "1 000 ft" (espace milliers) est lu comme altitude 1', () => {
      expect(kindOf('1 000 ft').pressure_altitude).toBe(1);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('idwInterpolate — interpolation par distance inverse', () => {
  const P = (temperature, pressure_altitude, mass, wind, distance) =>
    ({ temperature, pressure_altitude, mass, wind, distance });

  const twoPoints = [P(0, 0, 1000, 0, 300), P(30, 0, 1000, 0, 400)];
  const cond = { temperature: 15, pressure_altitude: 0, mass: 1000, wind: 0 };

  it('liste de points vide ou nulle → null', () => {
    expect(idwInterpolate([], cond)).toBeNull();
    expect(idwInterpolate(null, cond)).toBeNull();
    expect(idwInterpolate(undefined, cond)).toBeNull();
  });

  it('cas nominal : équidistant → moyenne, confiance = f(distance normalisée)', () => {
    const r = idwInterpolate(twoPoints, cond);
    expect(r.value).toBeCloseTo(350, 10);
    expect(r.confidence).toBe(50); // d0 = 15/30 = 0.5 → (1-0.5)*100
    expect(r.nearestPoints).toHaveLength(2);
  });

  it('point exact (distance < 1e-6) → valeur brute + confiance 100', () => {
    const r = idwInterpolate(twoPoints, { ...cond, temperature: 0 });
    expect(r.value).toBe(300);
    expect(r.confidence).toBe(100);
  });

  it('échelles de normalisation : 30 °C, 2000 ft, 100 kg, 10 kt', () => {
    // Un écart de 30 °C, 2000 ft, 100 kg ou 10 kt vaut exactement 1 → confiance 0
    const one = [P(30, 0, 1000, 0, 500)];
    expect(idwInterpolate(one, { temperature: 0, pressure_altitude: 0, mass: 1000, wind: 0 }).confidence).toBe(0);
    const oneAlt = [P(0, 2000, 1000, 0, 500)];
    expect(idwInterpolate(oneAlt, { temperature: 0, pressure_altitude: 0, mass: 1000, wind: 0 }).confidence).toBe(0);
    const oneMass = [P(0, 0, 1100, 0, 500)];
    expect(idwInterpolate(oneMass, { temperature: 0, pressure_altitude: 0, mass: 1000, wind: 0 }).confidence).toBe(0);
    const oneWind = [P(0, 0, 1000, 10, 500)];
    expect(idwInterpolate(oneWind, { temperature: 0, pressure_altitude: 0, mass: 1000, wind: 0 }).confidence).toBe(0);
  });

  it('confiance plafonnée à 0 au-delà d\'une distance normalisée de 1', () => {
    const far = [P(300, 0, 1000, 0, 500)];
    expect(idwInterpolate(far, { temperature: 0, pressure_altitude: 0, mass: 1000, wind: 0 }).confidence).toBe(0);
  });

  it('k limite le nombre de voisins (k=1 → valeur du point le plus proche)', () => {
    const r = idwInterpolate(twoPoints, { ...cond, temperature: 10 }, { k: 1 });
    expect(r.value).toBeCloseTo(300, 10);
    expect(r.nearestPoints).toHaveLength(1);
    expect(r.confidence).toBe(67); // 1 - 10/30 = 0.6667
  });

  it('k > nombre de points → tous les points utilisés', () => {
    expect(idwInterpolate(twoPoints, cond, { k: 99 }).nearestPoints).toHaveLength(2);
  });

  it('pondération 1/(d+0.001) : le point le plus proche domine', () => {
    // d1 = 1/30 ≈ 0.03333, d2 = 29/30 ≈ 0.96667
    const r = idwInterpolate(twoPoints, { ...cond, temperature: 1 });
    const d1 = 1 / 30, d2 = 29 / 30;
    const w1 = 1 / (d1 + 0.001), w2 = 1 / (d2 + 0.001);
    expect(r.value).toBeCloseTo((300 * w1 + 400 * w2) / (w1 + w2), 8);
    expect(r.value).toBeCloseTo(303.4265, 3);
  });

  it('⚠️ SURPRISE : une condition null est arithmétiquement lue comme 0', () => {
    const r = idwInterpolate([P(0, 0, 0, 0, 111)], { temperature: 0, pressure_altitude: 0, mass: null, wind: 0 });
    expect(r.value).toBe(111);
    expect(r.confidence).toBe(100); // « point exact » alors que la masse est INCONNUE
  });

  it('⚠️ SURPRISE : une condition undefined produit value = NaN et confidence = NaN', () => {
    const r = idwInterpolate(twoPoints, { pressure_altitude: 0, mass: 1000, wind: 0 });
    expect(Number.isNaN(r.value)).toBe(true);
    expect(Number.isNaN(r.confidence)).toBe(true);
  });

  it('⚠️ SURPRISE : opts.k = 0 lève une TypeError (?? ne rattrape pas 0)', () => {
    expect(() => idwInterpolate(twoPoints, cond, { k: 0 })).toThrow(TypeError);
  });

  it('⚠️ SURPRISE : conditions absentes lève une TypeError', () => {
    expect(() => idwInterpolate(twoPoints, undefined)).toThrow(TypeError);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('bracketInterpolateGraph — lecture pilote 2D', () => {
  const baseCond = { temperature: 20, pressure_altitude: 1000, mass: 900, wind: 0 };

  it('graphe absent / sans courbes → null', () => {
    expect(bracketInterpolateGraph(null, baseCond)).toBeNull();
    expect(bracketInterpolateGraph({}, baseCond)).toBeNull();
    expect(bracketInterpolateGraph({ curves: [] }, baseCond)).toBeNull();
  });

  it('axe X non mappable → { error: "X axis non identifié" }', () => {
    const g = makeGraphAltitudeFamily();
    g.axes.xAxis.title = 'takeoff_distance'; // "distance" n'est PAS une dimension de conditions
    const r = bracketInterpolateGraph(g, baseCond);
    expect(r.error).toBe('X axis non identifié');
    expect(r.xTitle).toBe('takeoff_distance');
  });

  describe('famille déduite du nom de courbe (source "parsed")', () => {
    it('cas nominal : PA = 1000 entre 0 ft et 2000 ft', () => {
      const r = bracketInterpolateGraph(makeGraphAltitudeFamily(), baseCond);
      expect(r.error).toBeUndefined();
      expect(r.value).toBeCloseTo(460, 10); // 400 + 0.5 * (520 - 400)
      expect(r.method).toBe('Bracket 2D');
      expect(r.source).toBe('parsed');
      expect(r.xDim).toBe('temperature');
      expect(r.familyDim).toBe('pressure_altitude');
      expect(r.queryX).toBe(20);
      expect(r.queryFamily).toBe(1000);
      expect(r.familyT).toBeCloseTo(0.5, 10);
      expect(r.familyRange).toBe(2000);
      expect(r.extrapolated).toBeNull();
      expect(r.lowerCurve).toEqual({ name: '0 ft', familyValue: 0, windDirection: null, y: 400 });
      expect(r.upperCurve).toEqual({ name: '2000 ft', familyValue: 2000, windDirection: null, y: 520 });
      expect(r.availableFamilyValues).toEqual([0, 2000, 4000]);
      expect(r.windFilter).toBeNull();
    });

    it('borne basse du domaine familial (PA = 0) → t = 0', () => {
      const r = bracketInterpolateGraph(makeGraphAltitudeFamily(), { ...baseCond, pressure_altitude: 0 });
      expect(r.value).toBeCloseTo(400, 10);
      expect(r.familyT).toBe(0);
      expect(r.extrapolated).toBeNull();
    });

    it('borne haute du domaine familial (PA = 4000) → t = 1, PAS d\'extrapolation', () => {
      const r = bracketInterpolateGraph(makeGraphAltitudeFamily(), { ...baseCond, pressure_altitude: 4000 });
      expect(r.value).toBeCloseTo(670, 10);
      expect(r.familyT).toBe(1);
      expect(r.extrapolated).toBeNull();
      expect(r.lowerCurve.familyValue).toBe(2000);
      expect(r.upperCurve.familyValue).toBe(4000);
    });

    it('EXTRAPOLATION au-dessus du domaine (PA = 6000) → 2 courbes hautes, t = 2', () => {
      const r = bracketInterpolateGraph(makeGraphAltitudeFamily(), { ...baseCond, pressure_altitude: 6000 });
      expect(r.extrapolated).toBe('above');
      expect(r.familyT).toBeCloseTo(2, 10);
      expect(r.lowerCurve.familyValue).toBe(2000);
      expect(r.upperCurve.familyValue).toBe(4000);
      expect(r.value).toBeCloseTo(820, 10); // 520 + 2 * (670 - 520) — pente préservée
    });

    it('EXTRAPOLATION sous le domaine (PA = -1000) → 2 courbes basses, t = -0.5', () => {
      const r = bracketInterpolateGraph(makeGraphAltitudeFamily(), { ...baseCond, pressure_altitude: -1000 });
      expect(r.extrapolated).toBe('below');
      expect(r.familyT).toBeCloseTo(-0.5, 10);
      expect(r.value).toBeCloseTo(340, 10); // 400 - 0.5 * 120 — sous la plus basse courbe
    });

    it('⚠️ SURPRISE (SOUS-ESTIMATION) : hors domaine sur l\'axe X, la lecture est CLAMPÉE sans aucun signal', () => {
      // T = 60 °C alors que les courbes s'arrêtent à 40 °C
      const chaud = bracketInterpolateGraph(makeGraphAltitudeFamily(), { ...baseCond, temperature: 60 });
      expect(chaud.value).toBeCloseTo(570, 10); // = lecture à 40 °C, PAS d'extrapolation
      expect(chaud.extrapolated).toBeNull();    // aucun drapeau
      expect(chaud.lowerCurve.y).toBe(500);     // valeur du dernier point de la courbe 0 ft
      // T = -10 °C sous la plage
      const froid = bracketInterpolateGraph(makeGraphAltitudeFamily(), { ...baseCond, temperature: -10 });
      expect(froid.value).toBeCloseTo(350, 10);
      expect(froid.extrapolated).toBeNull();
    });

    it('aucun nom de courbe parsable → erreur explicite', () => {
      const g = makeGraphAltitudeFamily();
      g.curves.forEach((c, i) => { c.name = `courbe ${String.fromCharCode(65 + i)}`; });
      const r = bracketInterpolateGraph(g, baseCond);
      expect(r.error).toMatch(/Aucun paramètre familial/);
      expect(r.curveNames).toEqual(['courbe A', 'courbe B', 'courbe C']);
    });

    it('la dimension familiale ne peut pas être la dimension X', () => {
      const g = makeGraphAltitudeFamily();
      g.axes.xAxis.title = 'pressure_altitude'; // X = altitude, courbes nommées en altitude
      const r = bracketInterpolateGraph(g, baseCond);
      expect(r.error).toMatch(/Aucun paramètre familial/);
    });

    it('une seule courbe familiale valide (mais ≥ 2 courbes) → erreur bracket impossible', () => {
      const g = {
        axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
        curves: [
          { name: '2000 ft',    points: [{ x: 0, y: 400 }, { x: 40, y: 640 }] },
          { name: 'guide bleu', points: [{ x: 0, y: 300 }, { x: 40, y: 500 }] }
        ]
      };
      const r = bracketInterpolateGraph(g, baseCond);
      expect(r.error).toMatch(/Une seule courbe avec valeur familiale/);
      expect(r.validCurveCount).toBe(1);
    });
  });

  describe('famille DÉCLARÉE (source "manual")', () => {
    it('cas nominal : familyAxisVariable + familyValue', () => {
      const r = bracketInterpolateGraph(makeManualFamilyGraph(),
        { temperature: 15, pressure_altitude: 2000, mass: 900, wind: 0 });
      expect(r.source).toBe('manual');
      expect(r.xDim).toBe('pressure_altitude');
      expect(r.familyDim).toBe('mass');
      expect(r.value).toBeCloseTo(315, 10); // 250 + 0.5 * (380 - 250)
      expect(r.availableFamilyValues).toEqual([800, 1000]);
    });

    it('familyAxisVariable non mappable → erreur', () => {
      const g = makeManualFamilyGraph();
      g.familyAxisVariable = 'flaps';
      const r = bracketInterpolateGraph(g, { temperature: 15, pressure_altitude: 2000, mass: 900, wind: 0 });
      expect(r.error).toMatch(/non mappable à une dimension/);
    });

    it('familyAxisVariable déclaré mais aucune familyValue numérique → erreur pédagogique', () => {
      const g = makeManualFamilyGraph();
      g.curves.forEach(c => { delete c.familyValue; });
      const r = bracketInterpolateGraph(g, { temperature: 15, pressure_altitude: 2000, mass: 900, wind: 0 });
      expect(r.error).toMatch(/aucune courbe n'a de familyValue numérique/);
      expect(r.familyDim).toBe('mass');
    });

    it('⚠️ SURPRISE : familyAxisVariable désactive le raccourci mono-courbe → erreur au lieu d\'une lecture 1D', () => {
      const g = makeManualFamilyGraph();
      g.curves = [g.curves[0]];
      const r = bracketInterpolateGraph(g, { temperature: 15, pressure_altitude: 2000, mass: 900, wind: 0 });
      expect(r.error).toMatch(/Une seule courbe avec valeur familiale/);
    });
  });

  describe('cas mono-courbe (1 courbe, pas de familyAxisVariable)', () => {
    it('interpolation 1D directe le long de X', () => {
      const r = bracketInterpolateGraph(makeMonoGraph(), { ...baseCond, temperature: 10 });
      expect(r.value).toBeCloseTo(350, 10);
      expect(r.method).toBe('Interpolation 1D (mono-courbe)');
      expect(r.source).toBe('mono-curve');
      expect(r.familyDim).toBeNull();
      expect(r.familyT).toBe(0);
      expect(r.familyRange).toBe(0);
      expect(r.extrapolated).toBeNull();
      expect(r.availableFamilyValues).toEqual([]);
      expect(r.lowerCurve).toEqual({ name: 'unique', familyValue: null, y: 350 });
      expect(r.upperCurve).toEqual({ name: 'unique', familyValue: null, y: 350 });
    });

    it('⚠️ SURPRISE (SOUS-ESTIMATION) : X hors plage → clampé aux extrémités, extrapolated reste null', () => {
      expect(bracketInterpolateGraph(makeMonoGraph(), { ...baseCond, temperature: 200 }).value).toBe(500);
      expect(bracketInterpolateGraph(makeMonoGraph(), { ...baseCond, temperature: -200 }).value).toBe(300);
      expect(bracketInterpolateGraph(makeMonoGraph(), { ...baseCond, temperature: 200 }).extrapolated).toBeNull();
    });

    it('donnée X manquante (null / undefined / NaN) → erreur explicite', () => {
      for (const t of [null, undefined, NaN]) {
        const r = bracketInterpolateGraph(makeMonoGraph(), { ...baseCond, temperature: t });
        expect(r.error).toBe("Donnée manquante pour l'axe X (temperature)");
        expect(r.xDim).toBe('temperature');
      }
    });

    it('courbe sans point → "Lecture impossible sur la courbe"', () => {
      const g = makeMonoGraph();
      g.curves[0].points = [];
      const r = bracketInterpolateGraph(g, { ...baseCond, temperature: 10 });
      expect(r.error).toMatch(/Lecture impossible sur la courbe/);
    });

    it('⚠️ SURPRISE : courbe à 1 seul point → valeur CONSTANTE quel que soit X', () => {
      const g = makeMonoGraph();
      g.curves[0].points = [{ x: 0, y: 300 }];
      expect(bracketInterpolateGraph(g, { ...baseCond, temperature: 40 }).value).toBe(300);
    });
  });

  describe('données manquantes sur la dimension familiale', () => {
    it('queryFamily null/undefined/NaN → erreur explicite', () => {
      for (const pa of [null, undefined, NaN]) {
        const r = bracketInterpolateGraph(makeGraphAltitudeFamily(), { ...baseCond, pressure_altitude: pa });
        expect(r.error).toBe('Donnée manquante pour la famille de courbes (pressure_altitude)');
        expect(r.familyDim).toBe('pressure_altitude');
      }
    });
  });

  describe('filtrage par direction du vent', () => {
    it('vent de face → seules les courbes headwind sont conservées', () => {
      const r = bracketInterpolateGraph(makeMixedWindGraph(), { temperature: 20, pressure_altitude: 0, mass: 900, wind: 5 });
      expect(r.value).toBeCloseTo(385, 10); // entre HW0 (400) et HW10 (370)
      expect(r.familyDim).toBe('wind');
      expect(r.windFilter).toEqual({
        applied: true,
        actualDirection: 'headwind',
        keptCount: 2,
        excludedCount: 2,
        excludedNames: ['TW 5', 'TW 10'],
        queryWindUsed: 5
      });
      expect(r.availableFamilyValues).toEqual([0, 10]);
    });

    it('vent arrière → courbes tailwind + query wind passée en valeur absolue', () => {
      const r = bracketInterpolateGraph(makeMixedWindGraph(), { temperature: 20, pressure_altitude: 0, mass: 900, wind: -8 });
      expect(r.queryFamily).toBe(8);           // abs(-8)
      expect(r.value).toBeCloseTo(528, 10);    // 480 + 0.6 * (560 - 480)
      expect(r.windFilter.actualDirection).toBe('tailwind');
      expect(r.windFilter.excludedNames).toEqual(['HW 10', 'HW 0']);
      expect(r.windFilter.queryWindUsed).toBe(8);
      expect(r.lowerCurve.windDirection).toBe('tailwind');
      expect(r.upperCurve.windDirection).toBe('tailwind');
    });

    it('|vent| < 0.5 → direction "none" ; aucune courbe neutre → TOUTES les courbes gardées', () => {
      const r = bracketInterpolateGraph(makeMixedWindGraph(), { temperature: 20, pressure_altitude: 0, mass: 900, wind: 0 });
      expect(r.windFilter.actualDirection).toBe('none');
      expect(r.windFilter.keptCount).toBe(4);
      expect(r.windFilter.excludedCount).toBe(0);
      expect(r.availableFamilyValues).toEqual([0, 5, 10, 10]);
    });

    it('⚠️ SURPRISE : vent quasi nul (0.3 kt) → bracket ENTRE une courbe headwind et une courbe tailwind', () => {
      const r = bracketInterpolateGraph(makeMixedWindGraph(), { temperature: 20, pressure_altitude: 0, mass: 900, wind: 0.3 });
      expect(r.lowerCurve.windDirection).toBe('headwind'); // HW 0
      expect(r.upperCurve.windDirection).toBe('tailwind'); // TW 5
      expect(r.value).toBeCloseTo(404.8, 6); // 400 + 0.06 * (480 - 400)
    });

    it('vent null → direction indéterminée, filtre non appliqué', () => {
      const r = bracketInterpolateGraph(makeMixedWindGraph(), { temperature: 20, pressure_altitude: 0, mass: 900, wind: null });
      expect(r.error).toBe('Donnée manquante pour la famille de courbes (wind)');
    });

    it('⚠️ SURPRISE (SOUS-ESTIMATION) : filtre trop restrictif → repli sur TOUTES les courbes, puis familyRange = 0 écrase t à 0', () => {
      const g = {
        axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
        familyAxisVariable: 'headwind',
        curves: [
          { name: 'HW 10', familyValue: 10, windDirection: 'headwind', points: [{ x: 0, y: 280 }, { x: 40, y: 460 }] },
          { name: 'TW 10', familyValue: 10, windDirection: 'tailwind', points: [{ x: 0, y: 420 }, { x: 40, y: 700 }] }
        ]
      };
      // Vent de face 5 kt : une seule courbe headwind → bracket impossible → repli
      const r = bracketInterpolateGraph(g, { temperature: 20, pressure_altitude: 0, mass: 900, wind: 5 });
      expect(r.windFilter.applied).toBe(false);
      expect(r.windFilter.reason).toMatch(/ne garderait que 1 courbe\(s\)/);
      expect(r.extrapolated).toBe('below');
      expect(r.familyRange).toBe(0);
      expect(r.familyT).toBe(0);
      // Résultat = lecture de la courbe 10 kt de FACE pour une demande à 5 kt : distance TROP COURTE
      expect(r.value).toBeCloseTo(370, 10);
    });

    it('un graphe sans windDirection mixte n\'active aucun filtre (windFilter = null)', () => {
      const r = bracketInterpolateGraph(makeGraphAltitudeFamily(), baseCond);
      expect(r.windFilter).toBeNull();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('slopeFollowInterpolateGraph — suivi de pente', () => {
  it('graphe absent / sans courbes → null', () => {
    expect(slopeFollowInterpolateGraph(null, 150, 20)).toBeNull();
    expect(slopeFollowInterpolateGraph({ curves: [] }, 150, 20)).toBeNull();
  });

  it('entryY manquant (null / undefined / NaN) → erreur', () => {
    for (const y of [null, undefined, NaN]) {
      expect(slopeFollowInterpolateGraph(makeSlopeGraph(), y, 20).error)
        .toBe("Valeur d'entrée (Y_in) manquante pour le suivi de pente");
    }
  });

  it('targetX manquant → erreur', () => {
    for (const x of [null, undefined, NaN]) {
      expect(slopeFollowInterpolateGraph(makeSlopeGraph(), 150, x).error)
        .toBe('Valeur cible (X_target) manquante');
    }
  });

  it('cas nominal : Y_in encadré par 2 guides, ratio conservé jusqu\'à X cible', () => {
    const r = slopeFollowInterpolateGraph(makeSlopeGraph(), 150, 20);
    expect(r.value).toBeCloseTo(210, 10); // 150 + 0.5 * (270 - 150)
    expect(r.method).toBe('Slope-follow (suivi de pente)');
    expect(r.source).toBe('slope-follow');
    expect(r.t).toBeCloseTo(0.5, 10);
    expect(r.extrapolated).toBeNull();
    expect(r.axisReversed).toBe(false);
    expect(r.xLeftVisual).toBe(0);
    expect(r.xMin).toBe(0);
    expect(r.xMinSource).toBe('declared');
    expect(r.entryYSource).toBe('first-point');
    expect(r.availableEntryYs).toEqual([100, 200, 300]);
    expect(r.lowerCurve).toMatchObject({ name: 'g1', entryY: 100, firstPointX: 0, yAtTargetX: 150 });
    expect(r.upperCurve).toMatchObject({ name: 'g2', entryY: 200, firstPointX: 0, yAtTargetX: 270 });
    expect(r.windFilter).toBeNull();
  });

  it('EXTRAPOLATION au-dessus des guides (Y_in = 400) → t = 2, pente préservée', () => {
    const r = slopeFollowInterpolateGraph(makeSlopeGraph(), 400, 20);
    expect(r.extrapolated).toBe('above');
    expect(r.t).toBeCloseTo(2, 10);
    expect(r.lowerCurve.name).toBe('g2');
    expect(r.upperCurve.name).toBe('g3');
    expect(r.value).toBeCloseTo(530, 10); // 270 + 2 * (400 - 270)
  });

  it('EXTRAPOLATION sous les guides (Y_in = 50) → t = -0.5', () => {
    const r = slopeFollowInterpolateGraph(makeSlopeGraph(), 50, 20);
    expect(r.extrapolated).toBe('below');
    expect(r.t).toBeCloseTo(-0.5, 10);
    expect(r.value).toBeCloseTo(90, 10); // 150 - 0.5 * 120
  });

  it('bornes exactes du domaine d\'entrée (Y_in = 100 puis 300)', () => {
    const bas = slopeFollowInterpolateGraph(makeSlopeGraph(), 100, 20);
    expect(bas.t).toBe(0);
    expect(bas.extrapolated).toBeNull();
    expect(bas.value).toBeCloseTo(150, 10);
    const haut = slopeFollowInterpolateGraph(makeSlopeGraph(), 300, 20);
    expect(haut.t).toBe(1);
    expect(haut.extrapolated).toBeNull();
    expect(haut.value).toBeCloseTo(400, 10);
  });

  it('⚠️ SURPRISE (SOUS-ESTIMATION) : X cible hors plage tracée → clampé, sans drapeau', () => {
    const r = slopeFollowInterpolateGraph(makeSlopeGraph(), 150, 100); // courbes tracées jusqu'à X = 40
    expect(r.targetX).toBe(100);
    expect(r.extrapolated).toBeNull();
    expect(r.value).toBeCloseTo(270, 10); // = lecture à X = 40
  });

  it('moins de 2 courbes exploitables → erreur', () => {
    const g = { curves: [{ name: 'seule', points: [{ x: 0, y: 100 }] }] };
    expect(slopeFollowInterpolateGraph(g, 150, 20).error)
      .toBe('Moins de 2 courbes exploitables (1). Suivi de pente impossible.');
    const g2 = { curves: [{ name: 'a', points: [] }, { name: 'b', points: [] }] };
    expect(slopeFollowInterpolateGraph(g2, 150, 20).error)
      .toBe('Moins de 2 courbes exploitables (0). Suivi de pente impossible.');
  });

  it('axe X inversé (reversed) → l\'entrée est lue au X MAX (bord gauche visuel)', () => {
    const g = {
      axes: { xAxis: { title: 'mass', min: 700, max: 1000, reversed: true } },
      curves: [
        { name: 'g1', points: [{ x: 700, y: 100 }, { x: 1000, y: 50 }] },
        { name: 'g2', points: [{ x: 700, y: 200 }, { x: 1000, y: 120 }] }
      ]
    };
    const r = slopeFollowInterpolateGraph(g, 85, 700);
    expect(r.axisReversed).toBe(true);
    expect(r.xLeftVisual).toBe(1000);
    expect(r.availableEntryYs).toEqual([50, 120]);
    expect(r.t).toBeCloseTo(0.5, 10);
    expect(r.value).toBeCloseTo(150, 10); // 100 + 0.5 * (200 - 100)
  });

  it('sans axes déclarés → xLeftVisual null et xMinSource "unused"', () => {
    const g = { curves: makeSlopeGraph().curves };
    const r = slopeFollowInterpolateGraph(g, 150, 20);
    expect(r.xLeftVisual).toBeNull();
    expect(r.xMinSource).toBe('unused');
    expect(r.value).toBeCloseTo(210, 10); // le calcul n'utilise PAS xMin
  });

  it('curve.entryY manuel prend le pas sur le 1er point', () => {
    const g = makeSlopeGraph();
    g.curves[0].entryY = 500; // g1 passe artificiellement au-dessus de g3
    g.curves[1].entryY = 600;
    g.curves[2].entryY = 700;
    const r = slopeFollowInterpolateGraph(g, 550, 20);
    expect(r.entryYSource).toBe('manual');
    expect(r.availableEntryYs).toEqual([500, 600, 700]);
    expect(r.lowerCurve.entryYSource).toBe('manual');
    expect(r.lowerCurve.firstPointX).toBeNull();
    expect(r.value).toBeCloseTo(210, 10);
  });

  it('entryY manuel partiel → entryYSource = "mixed"', () => {
    const g = makeSlopeGraph();
    g.curves[0].entryY = 100;
    const r = slopeFollowInterpolateGraph(g, 150, 20);
    expect(r.entryYSource).toBe('mixed');
    expect(r.lowerCurve.entryYSource).toBe('manual');
    expect(r.upperCurve.entryYSource).toBe('first-point');
  });

  it('⚠️ SURPRISE : guides d\'entrée tous égaux → t forcé à 0, on lit la 1re courbe', () => {
    const g = {
      curves: [
        { name: 'a', points: [{ x: 0, y: 100 }, { x: 40, y: 200 }] },
        { name: 'b', points: [{ x: 0, y: 100 }, { x: 40, y: 900 }] }
      ]
    };
    const r = slopeFollowInterpolateGraph(g, 100, 40);
    expect(r.t).toBe(0);
    expect(r.value).toBe(200); // la courbe b (900) est ignorée
  });

  it('filtre vent appliqué quand conditions est fourni et le graphe a des types mixtes', () => {
    const g = {
      axes: { xAxis: { title: 'temperature' } },
      curves: [
        { name: 'h1', windDirection: 'headwind', points: [{ x: 0, y: 100 }, { x: 40, y: 200 }] },
        { name: 'h2', windDirection: 'headwind', points: [{ x: 0, y: 200 }, { x: 40, y: 340 }] },
        { name: 't1', windDirection: 'tailwind', points: [{ x: 0, y: 300 }, { x: 40, y: 500 }] },
        { name: 't2', windDirection: 'tailwind', points: [{ x: 0, y: 400 }, { x: 40, y: 700 }] }
      ]
    };
    const sansCond = slopeFollowInterpolateGraph(g, 150, 20);
    expect(sansCond.windFilter).toBeNull();
    expect(sansCond.availableEntryYs).toEqual([100, 200, 300, 400]);

    const avecCond = slopeFollowInterpolateGraph(g, 150, 20, { temperature: 20, wind: 10 });
    expect(avecCond.windFilter.applied).toBe(true);
    expect(avecCond.windFilter.actualDirection).toBe('headwind');
    expect(avecCond.availableEntryYs).toEqual([100, 200]);
    expect(avecCond.value).toBeCloseTo(210, 10);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('evaluateAbacCascade — évaluation en cascade (DÉPRÉCIÉ mais exporté)', () => {
  it('abaque vide / absent → erreur globale', () => {
    expect(evaluateAbacCascade(null, {})).toEqual({ steps: [], finalValue: null, error: "Aucun graphe dans l'abaque." });
    expect(evaluateAbacCascade({ graphs: [] }, {})).toEqual({ steps: [], finalValue: null, error: "Aucun graphe dans l'abaque." });
  });

  it('cas nominal : intermédiaire (mono) puis primaire (slope-follow)', () => {
    const abaque = {
      graphs: [
        {
          id: 'g1', role: 'intermediate', cascadeOrder: 1, interpolationMode: 'mono',
          axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
          curves: [{ name: 'c', points: [{ x: 0, y: 100 }, { x: 40, y: 300 }] }]
        },
        {
          id: 'g2', role: 'primary', interpolationMode: 'slope-follow',
          axes: { xAxis: { title: 'mass', min: 800, max: 1200 }, yAxis: { title: 'distance' } },
          curves: [
            { name: 'a', points: [{ x: 800, y: 100 }, { x: 1200, y: 200 }] },
            { name: 'b', points: [{ x: 800, y: 300 }, { x: 1200, y: 500 }] }
          ]
        }
      ]
    };
    const res = evaluateAbacCascade(abaque, { temperature: 20, pressure_altitude: 0, mass: 1000, wind: 0 });
    expect(res.error).toBeNull();
    expect(res.steps).toHaveLength(2);

    expect(res.steps[0]).toMatchObject({
      graphId: 'g1', role: 'intermediate', cascadeOrder: 1, mode: 'mono', modeDeclared: true,
      xDim: 'temperature', queryX: 20, entryY: null, used: 'bracket'
    });
    expect(res.steps[0].output).toBeCloseTo(200, 10);

    expect(res.steps[1]).toMatchObject({
      graphId: 'g2', role: 'primary', mode: 'slope-follow', xDim: 'mass', queryX: 1000, entryY: 200, used: 'slope-follow'
    });
    expect(res.steps[1].output).toBeCloseTo(275, 10); // 150 + 0.5 * (400 - 150)
    expect(res.finalValue).toBeCloseTo(275, 10);
  });

  it('les intermédiaires sont triés par cascadeOrder, le primaire passe EN DERNIER', () => {
    const mono = (id, cascadeOrder, role) => ({
      id, role, cascadeOrder, interpolationMode: 'mono',
      axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
      curves: [{ name: 'c', points: [{ x: 0, y: 10 }, { x: 40, y: 50 }] }]
    });
    const abaque = { graphs: [mono('P', null, 'primary'), mono('T2', 2, 'intermediate'), mono('T1', 1, 'intermediate')] };
    const res = evaluateAbacCascade(abaque, { temperature: 20, pressure_altitude: 0, mass: 1000, wind: 0 });
    expect(res.steps.map(s => s.graphId)).toEqual(['T1', 'T2', 'P']);
  });

  it('cascade family : l\'output précédent ÉCRASE la condition de l\'axe X du graphe suivant', () => {
    const abaque = {
      graphs: [
        {
          id: 'i1', role: 'intermediate', cascadeOrder: 1, interpolationMode: 'mono',
          axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
          curves: [{ name: 'c', points: [{ x: 0, y: 800 }, { x: 40, y: 1200 }] }]
        },
        {
          id: 'p1', role: 'primary', interpolationMode: 'family', familyAxisVariable: 'pressure_altitude',
          axes: { xAxis: { title: 'mass' }, yAxis: { title: 'distance' } },
          curves: [
            { name: 'bas',  familyValue: 0,    points: [{ x: 800, y: 300 }, { x: 1200, y: 500 }] },
            { name: 'haut', familyValue: 2000, points: [{ x: 800, y: 400 }, { x: 1200, y: 700 }] }
          ]
        }
      ]
    };
    const res = evaluateAbacCascade(abaque, { temperature: 20, pressure_altitude: 1000, mass: 900, wind: 0 });
    expect(res.steps[0].output).toBeCloseTo(1000, 10);
    // La masse pilote (900) a été REMPLACÉE par l'output précédent (1000)
    expect(res.steps[1].queryX).toBeCloseTo(1000, 10);
    expect(res.steps[1].bracketResult.queryX).toBeCloseTo(1000, 10);
    expect(res.steps[1].output).toBeCloseTo(475, 10); // 400 + 0.5 * (550 - 400)
    expect(res.finalValue).toBeCloseTo(475, 10);
  });

  it('⚠️ SURPRISE : deux graphes sans rôle → seul le PREMIER est évalué, le second est ignoré', () => {
    const mono = (id, y) => ({
      id,
      axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
      curves: [{ name: 'c', points: [{ x: 0, y }, { x: 40, y: y * 2 }] }]
    });
    const res = evaluateAbacCascade({ graphs: [mono('A', 100), mono('B', 900)] },
      { temperature: 0, pressure_altitude: 0, mass: 1000, wind: 0 });
    expect(res.steps).toHaveLength(1);
    expect(res.steps[0].graphId).toBe('A');
    expect(res.finalValue).toBe(100);
  });

  it('aucun rôle reconnu (role custom) → tous les graphes sont pris dans l\'ordre du tableau', () => {
    const mono = (id, y) => ({
      id, role: 'annexe',
      axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
      curves: [{ name: 'c', points: [{ x: 0, y }, { x: 40, y: y * 2 }] }]
    });
    const res = evaluateAbacCascade({ graphs: [mono('A', 100), mono('B', 900)] },
      { temperature: 0, pressure_altitude: 0, mass: 1000, wind: 0 });
    expect(res.steps.map(s => s.graphId)).toEqual(['A', 'B']);
  });

  it('⚠️ SURPRISE : repli IDW silencieux quand le bracket échoue et que le mode n\'est PAS déclaré', () => {
    const abaque = {
      graphs: [{
        id: 'g',
        axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
        curves: [
          { name: 'courbe A', points: [{ x: 0, y: 300 }, { x: 40, y: 500 }] },
          { name: 'courbe B', points: [{ x: 0, y: 400 }, { x: 40, y: 660 }] }
        ]
      }]
    };
    const res = evaluateAbacCascade(abaque, { temperature: 20, pressure_altitude: 1000, mass: 1000, wind: 0 });
    expect(res.steps[0].mode).toBe('family');
    expect(res.steps[0].modeDeclared).toBe(false);
    expect(res.steps[0].bracketResult.error).toMatch(/Aucun paramètre familial/);
    expect(res.steps[0].used).toBe('idw');
    expect(res.steps[0].error).toBeNull();       // l'erreur de bracket est EFFACÉE
    expect(res.steps[0].output).toBeCloseTo(465, 10);
    expect(res.steps[0].idwResult.confidence).toBe(33);
  });

  it('mode DÉCLARÉ en échec → pas de repli IDW, erreur remontée', () => {
    const abaque = {
      graphs: [{
        id: 'g', interpolationMode: 'family',
        axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
        curves: [
          { name: 'courbe A', points: [{ x: 0, y: 300 }, { x: 40, y: 500 }] },
          { name: 'courbe B', points: [{ x: 0, y: 400 }, { x: 40, y: 660 }] }
        ]
      }]
    };
    const res = evaluateAbacCascade(abaque, { temperature: 20, pressure_altitude: 1000, mass: 1000, wind: 0 });
    expect(res.steps[0].used).toBeNull();
    expect(res.steps[0].idwResult).toBeNull();
    expect(res.steps[0].error).toMatch(/Aucun paramètre familial/);
    expect(res.finalValue).toBeNull();
    expect(res.error).toBe("Aucun graphe n'a produit de valeur exploitable.");
  });

  it('⚠️ SURPRISE : mode déclaré inconnu → step muet (output null, error null), aucune branche exécutée', () => {
    const abaque = {
      graphs: [{
        id: 'g', interpolationMode: 'spline',
        axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
        curves: [{ name: 'c', points: [{ x: 0, y: 300 }, { x: 40, y: 500 }] }]
      }]
    };
    const res = evaluateAbacCascade(abaque, { temperature: 20, pressure_altitude: 0, mass: 1000, wind: 0 });
    expect(res.steps[0].mode).toBe('spline');
    expect(res.steps[0].used).toBeNull();
    expect(res.steps[0].error).toBeNull();   // aucune erreur de step !
    expect(res.steps[0].output).toBeNull();
    expect(res.error).toBe("Aucun graphe n'a produit de valeur exploitable.");
  });

  it('slope-follow déclaré en 1re position → erreur explicite (pas de Y_in)', () => {
    const abaque = {
      graphs: [{
        id: 'g', interpolationMode: 'slope-follow',
        axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
        curves: [
          { name: 'a', points: [{ x: 0, y: 100 }, { x: 40, y: 200 }] },
          { name: 'b', points: [{ x: 0, y: 200 }, { x: 40, y: 340 }] }
        ]
      }]
    };
    const res = evaluateAbacCascade(abaque, { temperature: 20, pressure_altitude: 0, mass: 1000, wind: 0 });
    expect(res.steps[0].error).toMatch(/aucune valeur d'entrée Y_in disponible/);
    expect(res.finalValue).toBeNull();
  });

  it('auto-détection : 2e graphe sans famille en cascade → slope-follow', () => {
    const abaque = {
      graphs: [
        {
          id: 'i', role: 'intermediate', cascadeOrder: 1,
          axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
          curves: [{ name: 'c', points: [{ x: 0, y: 100 }, { x: 40, y: 300 }] }]
        },
        {
          id: 'p', role: 'primary',
          axes: { xAxis: { title: 'mass' }, yAxis: { title: 'distance' } },
          curves: [
            { name: 'guide bas',  points: [{ x: 800, y: 100 }, { x: 1200, y: 200 }] },
            { name: 'guide haut', points: [{ x: 800, y: 300 }, { x: 1200, y: 500 }] }
          ]
        }
      ]
    };
    const res = evaluateAbacCascade(abaque, { temperature: 20, pressure_altitude: 0, mass: 1000, wind: 0 });
    expect(res.steps[0].mode).toBe('mono');
    expect(res.steps[1].mode).toBe('slope-follow');
    expect(res.steps[1].used).toBe('slope-follow');
    expect(res.finalValue).toBeCloseTo(275, 10);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('inspectAbacByGraph — inspection par sous-graphique', () => {
  const cond = { temperature: 20, pressure_altitude: 1000, mass: 900, wind: 0 };

  it('abaque absent / sans graphs → { graphs: [] }', () => {
    expect(inspectAbacByGraph(null, cond)).toEqual({ graphs: [] });
    expect(inspectAbacByGraph({}, cond)).toEqual({ graphs: [] });
  });

  it('mode déclaré "family" → SEUL bracketResult est rempli', () => {
    const g = { ...makeGraphAltitudeFamily(), interpolationMode: 'family', name: 'Décollage' };
    const { graphs } = inspectAbacByGraph({ graphs: [g] }, cond);
    expect(graphs).toHaveLength(1);
    const r = graphs[0];
    expect(r.graphId).toBe('g-alt');
    expect(r.graphName).toBe('Décollage');
    expect(r.role).toBe('primary');           // défaut
    expect(r.interpolationMode).toBe('family');
    expect(r.modeDeclared).toBe(true);
    expect(r.effectiveMode).toBe('family');
    expect(r.curveCount).toBe(3);
    expect(r.pointCount).toBe(6);
    expect(r.axes).toEqual({ xTitle: 'temperature', yTitle: 'takeoff_distance', xUnit: '°C', yUnit: 'm' });
    expect(r.isolatedResult).toBeNull();
    expect(r.slopeResult).toBeNull();
    expect(r.bracketResult.value).toBeCloseTo(460, 10);
  });

  it('curveAnalysis rapporte le paramètre familial détecté (nomenclature "altitude")', () => {
    const g = { ...makeGraphAltitudeFamily(), interpolationMode: 'family' };
    g.curves.push({ name: 'guide bleu', points: [{ x: 0, y: 1 }] });
    const { graphs } = inspectAbacByGraph({ graphs: [g] }, cond);
    expect(graphs[0].curveAnalysis).toEqual([
      { name: '0 ft',       pointCount: 2, familyValue: 0,    familyKind: 'altitude', familyParsed: true },
      { name: '2000 ft',    pointCount: 2, familyValue: 2000, familyKind: 'altitude', familyParsed: true },
      { name: '4000 ft',    pointCount: 2, familyValue: 4000, familyKind: 'altitude', familyParsed: true },
      { name: 'guide bleu', pointCount: 1, familyValue: null, familyKind: null,       familyParsed: false }
    ]);
  });

  it('mode NON déclaré → mode "(auto)", les 3 méthodes sont tentées (IDW inclus)', () => {
    const { graphs } = inspectAbacByGraph({ graphs: [makeGraphAltitudeFamily()] }, cond);
    const r = graphs[0];
    expect(r.interpolationMode).toBe('(auto)');
    expect(r.modeDeclared).toBe(false);
    expect(r.effectiveMode).toBe('(auto)');
    expect(r.isolatedResult).not.toBeNull();
    expect(r.isolatedResult.nearestPointCount).toBe(4);
    expect(r.isolatedResult.nearestPoints).toHaveLength(4);
    expect(r.bracketResult.value).toBeCloseTo(460, 10);
    expect(r.slopeResult).toBeNull(); // pas de cascadeSteps → pas de Y_in
  });

  it('mode "slope-follow" hors cascade → erreur explicite sur Y_in', () => {
    const g = { ...makeSlopeGraph(), interpolationMode: 'slope-follow' };
    const { graphs } = inspectAbacByGraph({ graphs: [g] }, cond);
    expect(graphs[0].slopeResult.error).toMatch(/Slope-follow nécessite un Y_in/);
    expect(graphs[0].bracketResult).toBeNull();
  });

  it('cascadeSteps fournis → le vrai Y_in est réinjecté en slope-follow', () => {
    const g = { ...makeSlopeGraph(), interpolationMode: 'slope-follow' };
    const steps = [{ graphId: 'g-slope', entryY: 150, queryX: 20 }];
    const { graphs } = inspectAbacByGraph({ graphs: [g] }, cond, steps);
    expect(graphs[0].slopeResult.error).toBeUndefined();
    expect(graphs[0].slopeResult.value).toBeCloseTo(210, 10);
  });

  it('graphe sans nom / sans axes → libellés de repli', () => {
    const { graphs } = inspectAbacByGraph({ graphs: [{ curves: [] }] }, cond);
    expect(graphs[0].graphName).toBe('(graphique 1)');
    expect(graphs[0].axes).toEqual({ xTitle: '(non défini)', yTitle: '(non défini)', xUnit: '', yUnit: '' });
    expect(graphs[0].curveCount).toBe(0);
    expect(graphs[0].pointCount).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('interpolateAbac — API principale (IDW global)', () => {
  const abaque = {
    graphs: [{
      axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'distance' } },
      curves: [
        { name: '0 ft',    points: [{ x: 0, y: 300 }, { x: 40, y: 500 }] },
        { name: '2000 ft', points: [{ x: 0, y: 400 }, { x: 40, y: 660 }] }
      ]
    }]
  };

  it('abaque absent → NO_GRAPH', () => {
    expect(interpolateAbac(null, {})).toEqual({
      status: InterpolationStatus.NO_GRAPH, reason: 'Aucun abaque fourni.'
    });
  });

  it('abaque sans point exploitable → NO_POINTS', () => {
    expect(interpolateAbac({ graphs: [] }, {})).toEqual({
      status: InterpolationStatus.NO_POINTS, reason: "Aucun point exploitable dans l'abaque."
    });
    expect(interpolateAbac({ graphs: [{ curves: [{ name: '0 ft', points: [] }] }] }, {}).status)
      .toBe(InterpolationStatus.NO_POINTS);
  });

  it('cas nominal : IDW sur les 4 points, valeur et confiance exactes', () => {
    const r = interpolateAbac(abaque, { temperature: 20, pressure_altitude: 1000, mass: 1000, wind: 0 });
    expect(r.status).toBe(InterpolationStatus.OK);
    expect(r.value).toBeCloseTo(465, 10);  // moyenne des 4 sommets (équidistants)
    expect(r.confidence).toBe(17);
    expect(r.totalPoints).toBe(4);
    expect(r.nearestPoints).toHaveLength(4);
  });

  it('condition tombant pile sur un point → valeur exacte, confiance 100', () => {
    const r = interpolateAbac(abaque, { temperature: 40, pressure_altitude: 2000, mass: 1000, wind: 0 });
    expect(r.value).toBe(660);
    expect(r.confidence).toBe(100);
  });

  it('⚠️ SURPRISE (SOUS-ESTIMATION) : hors domaine, l\'IDW ne peut PAS dépasser la valeur max des points', () => {
    // PA = 20000 ft, T = 60 °C : très au-delà de l'abaque
    const r = interpolateAbac(abaque, { temperature: 60, pressure_altitude: 20000, mass: 1000, wind: 0 });
    expect(r.status).toBe(InterpolationStatus.OK);   // aucun statut hors-domaine
    expect(r.value).toBeLessThan(660);               // borné par le point le plus long de l'abaque
    expect(r.value).toBeCloseTo(469.48, 1);
    expect(r.confidence).toBe(0);                    // seul indice : confiance nulle
  });

  it('⚠️ SURPRISE : température null → lue comme 0 °C, statut OK et confiance 100', () => {
    const r = interpolateAbac(abaque, { temperature: null, pressure_altitude: 0, mass: 1000, wind: 0 });
    expect(r.status).toBe(InterpolationStatus.OK);
    expect(r.value).toBe(300);        // valeur à 0 °C / 0 ft
    expect(r.confidence).toBe(100);   // « point exact » alors que la température est INCONNUE
  });

  it('⚠️ SURPRISE : condition absente (undefined) → statut OK avec value = NaN', () => {
    const r = interpolateAbac(abaque, { pressure_altitude: 0, mass: 1000, wind: 0 });
    expect(r.status).toBe(InterpolationStatus.OK);
    expect(Number.isNaN(r.value)).toBe(true);
    expect(Number.isNaN(r.confidence)).toBe(true);
  });

  it('⚠️ SURPRISE (SOUS-ESTIMATION) : axe Y non reconnu → toutes les distances valent 0, statut OK', () => {
    const bad = {
      graphs: [{
        axes: { xAxis: { title: 'temperature' }, yAxis: { title: 'Roulement au décollage' } },
        curves: [{ name: '0 ft', points: [{ x: 0, y: 300 }, { x: 40, y: 500 }] }]
      }]
    };
    const r = interpolateAbac(bad, { temperature: 20, pressure_altitude: 0, mass: 1000, wind: 0 });
    expect(r.status).toBe(InterpolationStatus.OK);
    expect(r.value).toBe(0);
  });

  it('conditions sert AUSSI de defaultCond pour les dimensions non couvertes par le graphe', () => {
    const r = interpolateAbac(abaque, { temperature: 0, pressure_altitude: 0, mass: 1234, wind: 7 });
    expect(r.nearestPoints[0].mass).toBe(1234);
    expect(r.nearestPoints[0].wind).toBe(7);
    expect(r.value).toBe(300); // masse/vent n'influencent rien : ils sont identiques sur tous les points
  });
});
