// Caractérisation (golden) du comportement ACTUEL de runwayWindUtils.
// Phase 2 : poser le filet AVANT le déplacement du module vers le paquet
// autonome, pour prouver qu'aucune valeur ne bouge après la migration.
//
// ⚠️ Ces valeurs figent le comportement PRÉSENT, défauts compris. Elles ne
// disent PAS ce que le code devrait faire. Notamment sont figés ici :
//   - calculateAngleDifference renvoie une valeur NÉGATIVE si un cap sort de
//     [0, 360[ (ex. 370 vs 0 → -10 au lieu de 10) ;
//   - le `else if` de expandRunwayThresholds est rattaché au bloc `he_`, donc
//     un objet hybride (le_ + identifier/qfu) est déplié DEUX fois ;
//   - le score headwind*2 − crosswind préfère un vent arrière PLEIN à un vent
//     arrière de 3/4 ;
//   - une vitesse de vent NÉGATIVE inverse la piste choisie.
// Chaque point est détaillé dans le compte rendu ("surprises").
//
// Toutes les valeurs attendues sont calculées à la main depuis le code de
// runwayWindUtils.js.

import { describe, it, expect } from 'vitest';
import {
  calculateAngleDifference,
  calculateHeadwindComponent,
  calculateCrosswindComponent,
  expandRunwayThresholds,
  selectBestRunwayForWind,
} from '@utils/runwayWindUtils';

// Piste unique 05/23 au format VAC (QFU 050 → seuil opposé 230).
const VAC_05_23 = { identifier: '05/23', qfu: 50, length: 900 };
// Même piste au format GeoJSON.
const GEO_05_23 = { le_ident: '05', le_heading: 50, he_ident: '23', he_heading: 230 };

/** Retire la référence `runway` (volumineuse) pour comparer le reste. */
const sansRunway = (r) => {
  if (!r) return r;
  const { runway, ...rest } = r;
  return rest;
};

// ───────────────────────────────────────────────────────────────────────────
describe('calculateAngleDifference — golden', () => {
  it('cas nominal : écart replié sur [0, 180]', () => {
    expect(calculateAngleDifference(50, 50)).toBe(0);
    expect(calculateAngleDifference(90, 50)).toBe(40);
    expect(calculateAngleDifference(50, 90)).toBe(40); // symétrique
    expect(calculateAngleDifference(230, 50)).toBe(180);
  });

  it('passage par le nord : 350 vs 010 → 20 (et non 340)', () => {
    expect(calculateAngleDifference(350, 10)).toBe(20);
    expect(calculateAngleDifference(10, 350)).toBe(20);
    expect(calculateAngleDifference(359, 1)).toBe(2);
  });

  it('0 et 360 sont traités comme des caps DIFFÉRENTS (écart 0 quand même)', () => {
    // |0 - 360| = 360 > 180 → 360 - 360 = 0
    expect(calculateAngleDifference(0, 360)).toBe(0);
    expect(calculateAngleDifference(360, 360)).toBe(0);
  });

  it('DÉFAUT FIGÉ : cap hors [0, 360[ → écart NÉGATIF', () => {
    // diff = |370 - 0| = 370 > 180 → 360 - 370 = -10 (au lieu de +10)
    expect(calculateAngleDifference(370, 0)).toBe(-10);
    expect(calculateAngleDifference(0, 400)).toBe(-40);
    expect(calculateAngleDifference(720, 0)).toBe(-360);
  });

  it('aucune validation de type : coercition arithmétique brute', () => {
    expect(calculateAngleDifference(null, 0)).toBe(0);        // null → 0
    expect(calculateAngleDifference('350', 10)).toBe(20);     // chaîne numérique soustraite
    expect(calculateAngleDifference(undefined, 0)).toBeNaN(); // undefined → NaN
    expect(calculateAngleDifference(NaN, 0)).toBeNaN();
    expect(calculateAngleDifference('abc', 0)).toBeNaN();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('calculateHeadwindComponent — golden', () => {
  it('vent pile dans l’axe → composante = vitesse entière', () => {
    expect(calculateHeadwindComponent(50, 20, 50)).toBe(20);
    expect(calculateHeadwindComponent(0, 15, 360)).toBe(15); // |0-360| replié à 0
  });

  it('vent arrière pile (180°) → composante = −vitesse EXACTEMENT', () => {
    // cos(180°) vaut exactement -1 en flottant
    expect(calculateHeadwindComponent(230, 20, 50)).toBe(-20);
  });

  it('travers pur (90°) : ~0 mais PAS zéro exact (résidu du cosinus)', () => {
    const h = calculateHeadwindComponent(140, 20, 50);
    expect(h).toBeCloseTo(0, 10);
    expect(h).not.toBe(0);
    expect(h).toBeCloseTo(1.2246467991473533e-15, 20);
    expect(h).toBeGreaterThan(0); // résidu POSITIF → isTailwind restera false
  });

  it('angles intermédiaires : valeurs numériques exactes', () => {
    // 20° d'écart, 15 kt : 15 * cos(20°) = 15 * 0,93969262 = 14,09538931
    expect(calculateHeadwindComponent(70, 15, 50)).toBeCloseTo(14.095389311788626, 10);
    // 50° d'écart, 20 kt : 20 * cos(50°) = 20 * 0,64278761 = 12,85575219
    expect(calculateHeadwindComponent(0, 20, 50)).toBeCloseTo(12.855752193730785, 10);
    // 120° d'écart, 10 kt : 10 * cos(120°) = -5
    expect(calculateHeadwindComponent(170, 10, 50)).toBeCloseTo(-5, 10);
  });

  it('vent calme (0 kt) → 0', () => {
    expect(calculateHeadwindComponent(50, 0, 50)).toBe(0);
    // ATTENTION : à 180° le produit donne -0 (égal à 0 mais signe négatif)
    expect(calculateHeadwindComponent(230, 0, 50)).toBe(-0);
    expect(Object.is(calculateHeadwindComponent(230, 0, 50), -0)).toBe(true);
  });

  it('repli : tout argument non-`number` → 0 (indistinguable d’un vrai 0)', () => {
    expect(calculateHeadwindComponent(null, 20, 50)).toBe(0);
    expect(calculateHeadwindComponent(undefined, 20, 50)).toBe(0);
    expect(calculateHeadwindComponent('50', 20, 50)).toBe(0);
    expect(calculateHeadwindComponent('VRB', 20, 50)).toBe(0);
    expect(calculateHeadwindComponent(50, '20', 50)).toBe(0);
    expect(calculateHeadwindComponent(50, 20, '50')).toBe(0);
    expect(calculateHeadwindComponent(50, 20, null)).toBe(0);
    expect(calculateHeadwindComponent()).toBe(0);
  });

  it('DÉFAUT FIGÉ : NaN traverse le garde-fou (typeof NaN === "number")', () => {
    expect(calculateHeadwindComponent(NaN, 20, 50)).toBeNaN();
    expect(calculateHeadwindComponent(50, NaN, 50)).toBeNaN();
    expect(calculateHeadwindComponent(50, 20, NaN)).toBeNaN();
  });

  it('vitesse NÉGATIVE acceptée telle quelle → signe inversé', () => {
    expect(calculateHeadwindComponent(50, -20, 50)).toBe(-20);
    expect(calculateHeadwindComponent(230, -20, 50)).toBe(20);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('calculateCrosswindComponent — golden', () => {
  it('vent dans l’axe (0° ou 180°) → traversier nul ou quasi nul', () => {
    expect(calculateCrosswindComponent(50, 20, 50)).toBe(0); // sin(0) = 0 exact
    // à 180° le sinus laisse un résidu flottant, ce n'est PAS un zéro exact
    const c180 = calculateCrosswindComponent(230, 20, 50);
    expect(c180).toBeCloseTo(0, 10);
    expect(c180).not.toBe(0);
    expect(c180).toBeCloseTo(2.4492935982947065e-15, 20);
  });

  it('travers pur (90°) → traversier = vitesse entière', () => {
    expect(calculateCrosswindComponent(140, 20, 50)).toBeCloseTo(20, 10);
    expect(calculateCrosswindComponent(320, 20, 50)).toBeCloseTo(20, 10); // autre bord
  });

  it('angles intermédiaires : valeurs numériques exactes', () => {
    // 20° d'écart, 15 kt : 15 * sin(20°) = 15 * 0,34202014 = 5,13030215
    expect(calculateCrosswindComponent(70, 15, 50)).toBeCloseTo(5.130302149885031, 10);
    // 30° d'écart, 20 kt : 20 * sin(30°) = 10
    expect(calculateCrosswindComponent(80, 20, 50)).toBeCloseTo(10, 10);
    // 150° d'écart, 20 kt : |20 * sin(150°)| = 10 (magnitude, malgré le vent arrière)
    expect(calculateCrosswindComponent(200, 20, 50)).toBeCloseTo(10, 10);
  });

  it('toujours ≥ 0 : les deux bords donnent la même magnitude', () => {
    const gauche = calculateCrosswindComponent(20, 20, 50); // vent de gauche
    const droite = calculateCrosswindComponent(80, 20, 50); // vent de droite
    expect(gauche).toBeGreaterThan(0);
    expect(droite).toBeGreaterThan(0);
    expect(gauche).toBeCloseTo(droite, 10);
  });

  it('vent calme (0 kt) → 0', () => {
    expect(calculateCrosswindComponent(140, 0, 50)).toBe(0);
  });

  it('repli : tout argument non-`number` → 0', () => {
    expect(calculateCrosswindComponent(null, 20, 50)).toBe(0);
    expect(calculateCrosswindComponent(undefined, 20, 50)).toBe(0);
    expect(calculateCrosswindComponent('140', 20, 50)).toBe(0);
    expect(calculateCrosswindComponent(140, '20', 50)).toBe(0);
    expect(calculateCrosswindComponent(140, 20, undefined)).toBe(0);
    expect(calculateCrosswindComponent()).toBe(0);
  });

  it('DÉFAUT FIGÉ : NaN traverse le garde-fou', () => {
    expect(calculateCrosswindComponent(NaN, 20, 50)).toBeNaN();
    expect(calculateCrosswindComponent(140, NaN, 50)).toBeNaN();
  });

  it('DÉFAUT FIGÉ : vitesse NÉGATIVE → traversier POSITIF (Math.abs masque)', () => {
    expect(calculateCrosswindComponent(140, -20, 50)).toBeCloseTo(20, 10);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('expandRunwayThresholds — golden', () => {
  it('format VAC "05/23" + qfu → 2 seuils, QFU opposés', () => {
    const out = expandRunwayThresholds([VAC_05_23]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ ident: '05', heading: 50 });
    expect(out[1]).toMatchObject({ ident: '23', heading: 230 });
    // la piste d'origine est conservée PAR RÉFÉRENCE sur chaque seuil
    expect(out[0].runway).toBe(VAC_05_23);
    expect(out[1].runway).toBe(VAC_05_23);
  });

  it('format VAC : QFU opposé replié modulo 360', () => {
    expect(expandRunwayThresholds([{ identifier: '35/17', qfu: 350 }]).map((t) => t.heading))
      .toEqual([350, 170]);
    expect(expandRunwayThresholds([{ identifier: '36/18', qfu: 0 }]).map((t) => t.heading))
      .toEqual([0, 180]); // qfu 0 est bien un nombre → accepté
    expect(expandRunwayThresholds([{ identifier: '23/05', qfu: 230 }]).map((t) => t.heading))
      .toEqual([230, 50]);
  });

  it('format VAC sans "/" → un seul seuil (l’opposé n’est pas inventé)', () => {
    const out = expandRunwayThresholds([{ identifier: '18', qfu: 180 }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ident: '18', heading: 180 });
  });

  it('format VAC : partie vide ignorée, mais le CAP reste celui de sa position', () => {
    // "/23" → parts[0] = "" (ignoré), parts[1] = "23" → cap OPPOSÉ = 230
    const out = expandRunwayThresholds([{ identifier: '/23', qfu: 50 }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ident: '23', heading: 230 });
  });

  it('format GeoJSON le_/he_ → 2 seuils dans l’ordre le_ puis he_', () => {
    const out = expandRunwayThresholds([GEO_05_23]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ ident: '05', heading: 50 });
    expect(out[1]).toMatchObject({ ident: '23', heading: 230 });
    expect(out[0].runway).toBe(GEO_05_23);
  });

  it('format GeoJSON : cap 0 accepté (test de type, pas de véracité)', () => {
    const out = expandRunwayThresholds([{ le_ident: '36', le_heading: 0, he_ident: '18', he_heading: 180 }]);
    expect(out.map((t) => [t.ident, t.heading])).toEqual([['36', 0], ['18', 180]]);
  });

  it('format GeoJSON partiel : seul le seuil complet est déplié', () => {
    expect(expandRunwayThresholds([{ le_ident: '05', le_heading: 50 }]))
      .toEqual([{ ident: '05', heading: 50, runway: { le_ident: '05', le_heading: 50 } }]);
    expect(expandRunwayThresholds([{ he_ident: '23', he_heading: 230 }]))
      .toEqual([{ ident: '23', heading: 230, runway: { he_ident: '23', he_heading: 230 } }]);
    // cap non numérique → seuil rejeté
    expect(expandRunwayThresholds([{ le_ident: '05', le_heading: '50' }])).toEqual([]);
  });

  it('DÉFAUT FIGÉ : objet HYBRIDE (le_ + identifier/qfu) → 3 seuils, "05" en DOUBLE', () => {
    // Le `else if` porte sur le bloc `he_`, pas sur le bloc `le_` : le seuil le_
    // est poussé, puis le repli VAC repousse les DEUX seuils.
    const hybride = { le_ident: '05', le_heading: 50, identifier: '05/23', qfu: 50 };
    const out = expandRunwayThresholds([hybride]);
    expect(out).toHaveLength(3);
    expect(out.map((t) => t.ident)).toEqual(['05', '05', '23']);
    expect(out.map((t) => t.heading)).toEqual([50, 50, 230]);
  });

  it('en revanche `he_` + identifier/qfu → 1 seul seuil (le repli VAC est court-circuité)', () => {
    const out = expandRunwayThresholds([{ he_ident: '23', he_heading: 230, identifier: '05/23', qfu: 50 }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ident: '23', heading: 230 });
  });

  it('plusieurs pistes → concaténation dans l’ordre de déclaration', () => {
    const out = expandRunwayThresholds([VAC_05_23, { identifier: '09/27', qfu: 90 }]);
    expect(out.map((t) => t.ident)).toEqual(['05', '23', '09', '27']);
    expect(out.map((t) => t.heading)).toEqual([50, 230, 90, 270]);
  });

  it('repli : entrée non-tableau ou vide → []', () => {
    expect(expandRunwayThresholds(undefined)).toEqual([]);
    expect(expandRunwayThresholds(null)).toEqual([]);
    expect(expandRunwayThresholds('05/23')).toEqual([]);
    expect(expandRunwayThresholds(0)).toEqual([]);
    expect(expandRunwayThresholds({ identifier: '05/23', qfu: 50 })).toEqual([]); // objet nu
    expect(expandRunwayThresholds([])).toEqual([]);
  });

  it('piste sans champ reconnu → ignorée silencieusement', () => {
    expect(expandRunwayThresholds([{ foo: 1 }])).toEqual([]);
    expect(expandRunwayThresholds([{ identifier: '05/23' }])).toEqual([]);         // qfu manquant
    expect(expandRunwayThresholds([{ identifier: '05/23', qfu: '50' }])).toEqual([]); // qfu chaîne
    expect(expandRunwayThresholds([{ identifier: '', qfu: 50 }])).toEqual([]);     // identifier vide
  });

  it('DÉFAUT FIGÉ : élément null/undefined dans le tableau → TypeError (pas de garde)', () => {
    expect(() => expandRunwayThresholds([null])).toThrow(TypeError);
    expect(() => expandRunwayThresholds([undefined])).toThrow(TypeError);
    expect(() => expandRunwayThresholds([VAC_05_23, null])).toThrow(TypeError);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('selectBestRunwayForWind — golden', () => {
  it('cas nominal : vent pile dans l’axe du 05 → seuil 05 retenu', () => {
    const r = selectBestRunwayForWind([VAC_05_23], { direction: 50, speed: 20 });
    expect(sansRunway(r)).toEqual({
      ident: '05',
      heading: 50,
      headwind: 20,
      crosswind: 0,
      angleDiff: 0,
      isTailwind: false,
      score: 40, // 20*2 - 0
    });
    expect(r.runway).toBe(VAC_05_23); // référence d'origine conservée
  });

  it('QFU OPPOSÉS : le vent bascule le choix d’un seuil à l’autre', () => {
    const face05 = selectBestRunwayForWind([VAC_05_23], { direction: 50, speed: 20 });
    const face23 = selectBestRunwayForWind([VAC_05_23], { direction: 230, speed: 20 });
    expect(face05.ident).toBe('05');
    expect(face05.heading).toBe(50);
    expect(face23.ident).toBe('23');
    expect(face23.heading).toBe(230);
    expect(face23.headwind).toBe(20);
    expect(face23.isTailwind).toBe(false);
  });

  it('QFU opposés : le seuil retenu n’est jamais celui en vent arrière', () => {
    // vent du 200° : 23 (cap 230) a 30° d'écart, 05 (cap 50) en a 150°
    const r = selectBestRunwayForWind([VAC_05_23], { direction: 200, speed: 20 });
    expect(r.ident).toBe('23');
    expect(r.angleDiff).toBe(30);
    expect(r.headwind).toBeCloseTo(17.320508075688775, 10); // 20*cos(30°)
    expect(r.crosswind).toBeCloseTo(10, 10);                 // 20*sin(30°)
    expect(r.score).toBeCloseTo(24.64101615137755, 10);      // 2*17,3205 - 10
  });

  it('VENT CALME (0 kt) : premier seuil déplié, aucune composante, isTailwind false', () => {
    const r = selectBestRunwayForWind([VAC_05_23], { direction: 0, speed: 0 });
    expect(sansRunway(r)).toEqual({
      ident: '05',
      heading: 50,
      headwind: 0,
      crosswind: 0,
      angleDiff: 50,
      isTailwind: false,
      score: 0,
    });
  });

  it('vent calme sur plusieurs pistes → la PREMIÈRE déclarée gagne (tri stable)', () => {
    const r = selectBestRunwayForWind(
      [{ identifier: '09/27', qfu: 90 }, VAC_05_23],
      { direction: 180, speed: 0 }
    );
    expect(r.ident).toBe('09');
  });

  it('VENT VARIABLE : direction non numérique → null (aucune piste devinée)', () => {
    expect(selectBestRunwayForWind([VAC_05_23], { direction: 'VRB', speed: 10 })).toBeNull();
    expect(selectBestRunwayForWind([VAC_05_23], { direction: 'Variable', speed: 10 })).toBeNull();
    expect(selectBestRunwayForWind([VAC_05_23], { direction: null, speed: 10 })).toBeNull();
    expect(selectBestRunwayForWind([VAC_05_23], { direction: undefined, speed: 10 })).toBeNull();
    expect(selectBestRunwayForWind([VAC_05_23], { direction: '050', speed: 10 })).toBeNull();
  });

  it('TRAVERS PUR (90°) : les 2 seuils sont à égalité → premier déplié retenu', () => {
    // vent du 140° : écart 90° avec le cap 050 ET avec le cap 230
    const r = selectBestRunwayForWind([VAC_05_23], { direction: 140, speed: 20 });
    expect(r.ident).toBe('05');
    expect(r.angleDiff).toBe(90);
    expect(r.crosswind).toBeCloseTo(20, 10);
    expect(r.headwind).toBeCloseTo(0, 10);
    expect(r.headwind).toBeGreaterThan(0);   // résidu positif du cosinus…
    expect(r.isTailwind).toBe(false);        // …donc PAS classé vent arrière
    expect(r.score).toBeCloseTo(-19.999999999999996, 10);
  });

  it('VENT ARRIÈRE inévitable : isTailwind true, headwind négatif', () => {
    // piste unique au cap 180, vent du nord
    const r = selectBestRunwayForWind([{ le_ident: '18', le_heading: 180 }], { direction: 0, speed: 15 });
    expect(r.ident).toBe('18');
    expect(r.headwind).toBe(-15);
    expect(r.isTailwind).toBe(true);
    expect(r.angleDiff).toBe(180);
    expect(r.crosswind).toBeCloseTo(0, 10);
    expect(r.score).toBeCloseTo(-30, 10);
  });

  it('DÉFAUT FIGÉ : entre deux vents arrière, le PLEIN arrière (180°) l’emporte sur le 3/4', () => {
    // score(θ) = 2·V·cosθ − V·sinθ atteint son MINIMUM vers 153,4°, pas à 180°.
    //   cap 180 (écart 180°) : score = -20
    //   cap 153 (écart 153°) : score = -22,360…  → moins bon
    const r = selectBestRunwayForWind(
      [{ le_ident: '18', le_heading: 180, he_ident: '15', he_heading: 153 }],
      { direction: 0, speed: 10 }
    );
    expect(r.ident).toBe('18');
    expect(r.heading).toBe(180);
    expect(r.score).toBeCloseTo(-20, 10);
    expect(r.isTailwind).toBe(true);
    // le seuil 153 aurait pourtant 1,09 kt de vent arrière EN MOINS
    expect(calculateHeadwindComponent(0, 10, 153)).toBeCloseTo(-8.910065241883679, 10);
  });

  it('plusieurs pistes : la mieux orientée l’emporte (score headwind*2 − crosswind)', () => {
    const pistes = [{ identifier: '05/23', qfu: 50 }, { identifier: '09/27', qfu: 90 }];
    const r = selectBestRunwayForWind(pistes, { direction: 95, speed: 15 });
    expect(r.ident).toBe('09');
    expect(r.angleDiff).toBe(5);
    expect(r.headwind).toBeCloseTo(14.942920471376183, 10);  // 15*cos(5°)
    expect(r.crosswind).toBeCloseTo(1.3073361412148726, 10);  // 15*sin(5°)
    expect(r.score).toBeCloseTo(28.578504801537494, 10);
  });

  it('vent EXACTEMENT entre deux pistes → égalité tranchée par l’ordre de déclaration', () => {
    // vent du 070° : 20° d'écart avec le cap 050 comme avec le cap 090
    const r = selectBestRunwayForWind(
      [{ identifier: '05/23', qfu: 50 }, { identifier: '09/27', qfu: 90 }],
      { direction: 70, speed: 15 }
    );
    expect(r.ident).toBe('05');
    expect(r.angleDiff).toBe(20);
    expect(r.headwind).toBeCloseTo(14.095389311788626, 10);
    expect(r.crosswind).toBeCloseTo(5.130302149885031, 10);
    expect(r.score).toBeCloseTo(23.06047647369222, 10);
  });

  it('le score ARBITRE bien entre face et travers (pénalité du traversier)', () => {
    // Un seuil à 60° d'écart (score 1,34) perd contre un seuil à 30° (score 12,32)
    const pistes = [{ le_ident: 'A', le_heading: 60 }, { le_ident: 'B', le_heading: 30 }];
    const r = selectBestRunwayForWind(pistes, { direction: 0, speed: 10 });
    expect(r.ident).toBe('B');
    expect(r.score).toBeCloseTo(12.320508075688775, 10);
  });

  it('repli : vent absent ou incomplet → null', () => {
    expect(selectBestRunwayForWind([VAC_05_23], null)).toBeNull();
    expect(selectBestRunwayForWind([VAC_05_23], undefined)).toBeNull();
    expect(selectBestRunwayForWind([VAC_05_23], {})).toBeNull();
    expect(selectBestRunwayForWind([VAC_05_23], { direction: 50 })).toBeNull();  // vitesse manquante
    expect(selectBestRunwayForWind([VAC_05_23], { speed: 20 })).toBeNull();      // direction manquante
    expect(selectBestRunwayForWind([VAC_05_23], { direction: 50, speed: '20' })).toBeNull();
    expect(selectBestRunwayForWind([VAC_05_23], 'calme')).toBeNull();
  });

  it('repli : aucune piste exploitable → null', () => {
    const vent = { direction: 50, speed: 20 };
    expect(selectBestRunwayForWind([], vent)).toBeNull();
    expect(selectBestRunwayForWind(null, vent)).toBeNull();
    expect(selectBestRunwayForWind(undefined, vent)).toBeNull();
    expect(selectBestRunwayForWind([{ foo: 1 }], vent)).toBeNull();
    expect(selectBestRunwayForWind([{ identifier: '05/23', qfu: '50' }], vent)).toBeNull();
  });

  it('DÉFAUT FIGÉ : vitesse NaN → seuil retourné quand même, composantes NaN', () => {
    const r = selectBestRunwayForWind([VAC_05_23], { direction: 0, speed: NaN });
    expect(r).not.toBeNull();
    expect(r.ident).toBe('05');       // tri neutralisé par NaN → premier déplié
    expect(r.headwind).toBeNaN();
    expect(r.crosswind).toBeNaN();
    expect(r.score).toBeNaN();
    expect(r.angleDiff).toBe(50);     // l'écart, lui, reste juste
    expect(r.isTailwind).toBe(false); // NaN < 0 est faux
  });

  it('DÉFAUT FIGÉ : vitesse NÉGATIVE → le seuil SOUS LE VENT est choisi', () => {
    // vent « du 050 à -10 kt » : le seuil 23 (dos au vent) affiche +10 kt de face
    const r = selectBestRunwayForWind([VAC_05_23], { direction: 50, speed: -10 });
    expect(r.ident).toBe('23');
    expect(r.headwind).toBe(10);
    expect(r.isTailwind).toBe(false);
    expect(r.score).toBeCloseTo(20, 10);
  });

  it('DÉFAUT FIGÉ : piste hybride → le seuil dupliqué reste candidat (sans effet ici)', () => {
    const hybride = { le_ident: '05', le_heading: 50, identifier: '05/23', qfu: 50 };
    const r = selectBestRunwayForWind([hybride], { direction: 50, speed: 20 });
    expect(r.ident).toBe('05');
    expect(r.headwind).toBe(20);
    expect(expandRunwayThresholds([hybride])).toHaveLength(3); // rappel du doublon
  });

  it('format GeoJSON et format VAC donnent le MÊME résultat pour la même piste', () => {
    const vent = { direction: 200, speed: 18 };
    const vac = sansRunway(selectBestRunwayForWind([VAC_05_23], vent));
    const geo = sansRunway(selectBestRunwayForWind([GEO_05_23], vent));
    expect(geo).toEqual(vac);
  });

  it('l’objet retourné expose toujours les 8 mêmes clés', () => {
    const r = selectBestRunwayForWind([VAC_05_23], { direction: 50, speed: 20 });
    expect(Object.keys(r).sort()).toEqual(
      ['angleDiff', 'crosswind', 'headwind', 'ident', 'isTailwind', 'heading', 'runway', 'score'].sort()
    );
  });
});
