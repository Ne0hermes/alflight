// TESTS D'OR (caractérisation) — src/features/aircraft/utils/centrogramMath.js
//
// Phase 2 : ce module va être DÉPLACÉ dans un paquet autonome. Ces tests figent
// le comportement ACTUEL, tel quel, y compris ses replis silencieux et ses
// valeurs discutables. Ils ne décrivent PAS ce que le code devrait faire : ils
// servent de preuve d'iso-comportement avant/après déplacement.
//
// ⚠️ Ne JAMAIS « corriger » un attendu pour le rendre plus joli : si un attendu
// devient faux après le déplacement, c'est le déplacement qui a cassé quelque
// chose.
import { describe, it, expect } from 'vitest';
import {
  pixelToData,
  linearRegression,
  predictMoment,
  convertArmUnit,
  buildStageList,
  CENTROGRAM_STAGES,
  FUEL_TANK_TYPES,
} from '@features/aircraft/utils/centrogramMath';

// ───────────────────────────────────────────────────────────────────────────
// pixelToData — calibration linéaire par morceaux (pixel → donnée)
// ───────────────────────────────────────────────────────────────────────────
describe('pixelToData — calibration multi-points linéaire par morceaux', () => {
  const TICKS = [
    { value: 0, pixel: 0 },
    { value: 40, pixel: 50 },
    { value: 100, pixel: 200 },
  ];

  it('cas nominal : interpolation dans le premier segment', () => {
    // 25 px = moitié du segment 0→50 px, qui vaut 0→40 → 20
    expect(pixelToData(25, TICKS)).toBeCloseTo(20, 10);
  });

  it('cas nominal : interpolation dans le second segment (pente différente)', () => {
    // 125 px = moitié du segment 50→200 px, qui vaut 40→100 → 70
    expect(pixelToData(125, TICKS)).toBeCloseTo(70, 10);
  });

  it('un tick exactement sur une graduation renvoie sa valeur', () => {
    expect(pixelToData(0, TICKS)).toBeCloseTo(0, 10);
    expect(pixelToData(50, TICKS)).toBeCloseTo(40, 10);
    expect(pixelToData(200, TICKS)).toBeCloseTo(100, 10);
  });

  it('EXTRAPOLE à gauche du premier tick (pente des 2 premiers ticks)', () => {
    // Pas de bornage : -50 px avec 2 ticks 0→200 px / 0→100 donne -25
    expect(pixelToData(-50, [{ value: 0, pixel: 0 }, { value: 100, pixel: 200 }])).toBeCloseTo(-25, 10);
  });

  it('EXTRAPOLE à droite du dernier tick (pente des 2 derniers ticks)', () => {
    expect(pixelToData(300, [{ value: 0, pixel: 0 }, { value: 100, pixel: 200 }])).toBeCloseTo(150, 10);
  });

  it('les ticks sont triés par pixel : l\'ordre de saisie du pilote est indifférent', () => {
    const desordre = [
      { value: 100, pixel: 200 },
      { value: 0, pixel: 0 },
      { value: 40, pixel: 50 },
    ];
    expect(pixelToData(150, desordre)).toBeCloseTo(80, 10);
    expect(pixelToData(150, desordre)).toBeCloseTo(pixelToData(150, TICKS), 10);
  });

  it('ne mute PAS le tableau de ticks reçu (tri sur une copie)', () => {
    const ticks = [{ value: 100, pixel: 200 }, { value: 0, pixel: 0 }];
    pixelToData(50, ticks);
    expect(ticks.map((t) => t.pixel)).toEqual([200, 0]);
  });

  it('axe inversé (valeur qui décroît avec le pixel) : géré sans cas particulier', () => {
    // Axe Y SVG : le pixel croît vers le bas alors que la valeur décroît.
    expect(pixelToData(150, [{ value: 0, pixel: 300 }, { value: 100, pixel: 100 }])).toBeCloseTo(75, 10);
  });

  it('moins de 2 ticks / ticks absents → NaN', () => {
    expect(pixelToData(50, [{ value: 0, pixel: 0 }])).toBeNaN();
    expect(pixelToData(50, [])).toBeNaN();
    expect(pixelToData(50, null)).toBeNaN();
    expect(pixelToData(50, undefined)).toBeNaN();
    expect(pixelToData(50, 'pas un tableau')).toBeNaN();
  });

  it('pixel NaN → NaN (aucune comparaison ne matche)', () => {
    expect(pixelToData(NaN, TICKS)).toBeNaN();
  });

  it('2 ticks au MÊME pixel (calibration dégénérée) → NaN', () => {
    // Division par zéro dans la pente d'extrapolation : Infinity × 0 = NaN.
    expect(pixelToData(100, [{ value: 0, pixel: 100 }, { value: 10, pixel: 100 }])).toBeNaN();
  });

  it('pixel 0 et valeurs négatives : aucune valeur n\'est bornée', () => {
    expect(pixelToData(0, [{ value: -50, pixel: 0 }, { value: 50, pixel: 100 }])).toBeCloseTo(-50, 10);
    expect(pixelToData(25, [{ value: -50, pixel: 0 }, { value: 50, pixel: 100 }])).toBeCloseTo(-25, 10);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// linearRegression — moindres carrés y = a·x + b
// ───────────────────────────────────────────────────────────────────────────
describe('linearRegression — moindres carrés (a, b, r2, n)', () => {
  it('points parfaitement alignés : a et b exacts, r2 = 1', () => {
    const r = linearRegression([{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }]);
    expect(r.a).toBeCloseTo(2, 10);
    expect(r.b).toBeCloseTo(0, 10);
    expect(r.r2).toBeCloseTo(1, 10);
    expect(r.n).toBe(3);
  });

  it('droite avec ordonnée à l\'origine (moment cumulé) : a = bras, b = offset', () => {
    const r = linearRegression([{ x: 0, y: 500 }, { x: 100, y: 650 }, { x: 200, y: 800 }]);
    expect(r.a).toBeCloseTo(1.5, 10);
    expect(r.b).toBeCloseTo(500, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });

  it('pente négative : figée telle quelle (aucun garde-fou de signe)', () => {
    const r = linearRegression([{ x: 0, y: 10 }, { x: 1, y: 8 }, { x: 2, y: 6 }]);
    expect(r.a).toBeCloseTo(-2, 10);
    expect(r.b).toBeCloseTo(10, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });

  it('points MAL alignés : valeurs exactes de a, b et r2', () => {
    const r = linearRegression([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 3 }]);
    expect(r.a).toBeCloseTo(1.5, 10);
    expect(r.b).toBeCloseTo(-1 / 6, 10);        // -0.16666666666666666
    expect(r.r2).toBeCloseTo(0.9642857142857143, 12);
    expect(r.n).toBe(3);
  });

  it('exactement 2 points : toujours r2 = 1 (une droite passe par 2 points)', () => {
    const r = linearRegression([{ x: 10, y: 21 }, { x: 30, y: 63 }]);
    expect(r.a).toBeCloseTo(2.1, 10);
    expect(r.b).toBeCloseTo(0, 10);
    expect(r.r2).toBeCloseTo(1, 10);
    expect(r.n).toBe(2);
  });

  it('droite HORIZONTALE (tous les y égaux) : r2 = 1 par convention ssTot ≈ 0', () => {
    // Discutable : la variance expliquée est indéfinie (0/0), le code renvoie 1.
    const r = linearRegression([{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }]);
    expect(r.a).toBeCloseTo(0, 10);
    expect(r.b).toBeCloseTo(5, 10);
    expect(r.r2).toBe(1);
  });

  it('tous les x identiques (droite verticale) → null', () => {
    expect(linearRegression([{ x: 3, y: 0 }, { x: 3, y: 9 }])).toBeNull();
    expect(linearRegression([{ x: 3, y: 0 }, { x: 3, y: 9 }, { x: 3, y: 4 }])).toBeNull();
  });

  it('les points non finis sont FILTRÉS et n ne compte que les valides', () => {
    const r = linearRegression([
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: NaN, y: 5 },        // rejeté
      { x: 3, y: '6' },        // rejeté : chaîne, Number.isFinite('6') = false
      { x: Infinity, y: 1 },   // rejeté
      { x: 4, y: null },       // rejeté
      { x: 5, y: undefined },  // rejeté
    ]);
    expect(r.a).toBeCloseTo(2, 10);
    expect(r.b).toBeCloseTo(0, 10);
    expect(r.n).toBe(2);
  });

  it('moins de 2 points valides → null', () => {
    expect(linearRegression([{ x: 1, y: 1 }])).toBeNull();
    expect(linearRegression([])).toBeNull();
    expect(linearRegression(null)).toBeNull();
    expect(linearRegression(undefined)).toBeNull();
    expect(linearRegression('pas un tableau')).toBeNull();
    expect(linearRegression([{}, {}])).toBeNull();
    expect(linearRegression([{ x: 1, y: 1 }, { x: NaN, y: NaN }])).toBeNull();
  });

  it('SEUIL 1e-12 : des x distincts mais très resserrés sont refusés (null)', () => {
    // denom = n·Σx² − (Σx)² = 1e-14 < 1e-12 → traité comme « x identiques ».
    expect(linearRegression([{ x: 1e-7, y: 1 }, { x: 2e-7, y: 2 }])).toBeNull();
  });

  it('LÈVE une TypeError sur un élément null dans le tableau', () => {
    // Le filtre lit p.x avant toute vérification de p → pas de garde.
    expect(() => linearRegression([null, { x: 1, y: 1 }])).toThrow(TypeError);
  });

  it('ne mute PAS le tableau de points reçu', () => {
    const points = [{ x: 0, y: 0 }, { x: 1, y: 2 }];
    linearRegression(points);
    expect(points).toEqual([{ x: 0, y: 0 }, { x: 1, y: 2 }]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// predictMoment — f(x) = a·x + b
// ───────────────────────────────────────────────────────────────────────────
describe('predictMoment — vérification rapide du pilote', () => {
  it('cas nominal : a·x + b', () => {
    expect(predictMoment(50, 2.4, 100)).toBeCloseTo(220, 10);
    expect(predictMoment(0, 2.4, 100)).toBeCloseTo(100, 10);
    expect(predictMoment(-10, 2.4, 100)).toBeCloseTo(76, 10);
  });

  it('pente et offset nuls : 0 est une entrée valide (pas un repli)', () => {
    expect(predictMoment(50, 0, 0)).toBe(0);
  });

  it('toute entrée non finie → NaN', () => {
    expect(predictMoment(NaN, 1, 1)).toBeNaN();
    expect(predictMoment(1, undefined, 1)).toBeNaN();
    expect(predictMoment(1, 1, null)).toBeNaN();
    expect(predictMoment('50', 1, 1)).toBeNaN();
    expect(predictMoment(1, Infinity, 1)).toBeNaN();
    expect(predictMoment(undefined, undefined, undefined)).toBeNaN();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// convertArmUnit — conversion du bras (pente) entre m / cm / mm / in
// ───────────────────────────────────────────────────────────────────────────
describe('convertArmUnit — conversion d\'unité de bras', () => {
  it('même unité → valeur inchangée (aucun calcul)', () => {
    expect(convertArmUnit(2.4, 'm', 'm')).toBe(2.4);
    expect(convertArmUnit(240, 'cm', 'cm')).toBe(240);
  });

  it('m → cm (cas FR le plus courant)', () => {
    expect(convertArmUnit(2.4, 'm', 'cm')).toBeCloseTo(240, 9);
    expect(convertArmUnit(1.1, 'm', 'cm')).toBeCloseTo(110, 9);
  });

  it('cm → m', () => {
    expect(convertArmUnit(250, 'cm', 'm')).toBeCloseTo(2.5, 12);
  });

  it('mm → m et mm → cm', () => {
    expect(convertArmUnit(2100, 'mm', 'm')).toBeCloseTo(2.1, 12);
    expect(convertArmUnit(805.9, 'mm', 'cm')).toBeCloseTo(80.59, 9);
  });

  it('m → mm', () => {
    expect(convertArmUnit(1.5, 'm', 'mm')).toBeCloseTo(1500, 8);
  });

  it('in → m / in → cm (1 in = 0.0254 m exactement)', () => {
    expect(convertArmUnit(1, 'in', 'm')).toBeCloseTo(0.0254, 12);
    expect(convertArmUnit(100, 'in', 'cm')).toBeCloseTo(254, 9);
  });

  it('cm → in et m → in (aller-retour cohérent)', () => {
    expect(convertArmUnit(254, 'cm', 'in')).toBeCloseTo(100, 9);
    expect(convertArmUnit(2.54, 'm', 'in')).toBeCloseTo(100, 9);
    expect(convertArmUnit(convertArmUnit(2.4, 'm', 'in'), 'in', 'm')).toBeCloseTo(2.4, 12);
  });

  it('zéro et valeurs négatives sont converties normalement', () => {
    expect(convertArmUnit(0, 'm', 'cm')).toBe(0);
    expect(convertArmUnit(-2.4, 'm', 'cm')).toBeCloseTo(-240, 9);
  });

  it('REPLI SILENCIEUX : unité inconnue → pente renvoyée TELLE QUELLE', () => {
    // Aucune erreur, aucun NaN : la valeur passe sans conversion.
    expect(convertArmUnit(7, 'ft', 'cm')).toBe(7);
    expect(convertArmUnit(7, 'm', 'ft')).toBe(7);
    expect(convertArmUnit(7, 'ft', 'ft')).toBe(7);   // court-circuit fromUnit === toUnit
    expect(convertArmUnit(7, undefined, 'cm')).toBe(7);
    expect(convertArmUnit(7, 'm', null)).toBe(7);
  });

  it('pente non finie → NaN (avant toute conversion)', () => {
    expect(convertArmUnit(NaN, 'm', 'cm')).toBeNaN();
    expect(convertArmUnit(null, 'm', 'cm')).toBeNaN();
    expect(convertArmUnit(undefined, 'm', 'cm')).toBeNaN();
    expect(convertArmUnit('2.4', 'm', 'cm')).toBeNaN();   // chaîne non convertie
    expect(convertArmUnit(Infinity, 'm', 'cm')).toBeNaN();
  });

  it('CHAÎNE DE PROTOTYPE : une unité héritée d\'Object donne NaN', () => {
    // `fromUnit in toMeters` remonte le prototype → 'constructor' passe le test
    // puis sert de facteur multiplicatif (une fonction) → NaN.
    expect(convertArmUnit(2, 'constructor', 'm')).toBeNaN();
    expect(convertArmUnit(2, 'm', 'toString')).toBeNaN();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CENTROGRAM_STAGES — constante exportée
// ───────────────────────────────────────────────────────────────────────────
describe('CENTROGRAM_STAGES — stages fixes déclarés', () => {
  it('contient 4 stages dans cet ordre, fuelMain INCLUS dans la constante', () => {
    expect(CENTROGRAM_STAGES.map((s) => s.key)).toEqual([
      'empty', 'frontSeats', 'rearSeats', 'fuelMain',
    ]);
  });

  it('« empty » est le seul stage à valeur unique', () => {
    expect(CENTROGRAM_STAGES.filter((s) => s.singleValue).map((s) => s.key)).toEqual(['empty']);
    expect(CENTROGRAM_STAGES[0].aircraftPath).toBe('arms.empty');
    expect(CENTROGRAM_STAGES[0].category).toBe('fixe');
  });

  it('catégories et chemins avion des stages fixes', () => {
    expect(CENTROGRAM_STAGES.map((s) => s.category)).toEqual(['fixe', 'seats', 'seats', 'fuel']);
    expect(CENTROGRAM_STAGES.map((s) => s.aircraftPath)).toEqual([
      'arms.empty', 'arms.frontSeats', 'arms.rearSeats', 'arms.fuelMain',
    ]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// buildStageList — liste dynamique des étapes
// ───────────────────────────────────────────────────────────────────────────
describe('buildStageList — stages fixes après retrait de fuelMain', () => {
  it('avion vide → 3 stages fixes SEULEMENT (fuelMain retiré)', () => {
    expect(buildStageList({}).map((s) => s.key)).toEqual(['empty', 'frontSeats', 'rearSeats']);
  });

  it('aucun stage « fuelMain » / « arms.fuelMain » ne subsiste (bouton fantôme supprimé)', () => {
    const stages = buildStageList({ additionalFuelTanks: [{ id: 'M', type: 'main' }] });
    expect(stages.find((s) => s.key === 'fuelMain')).toBeUndefined();
    expect(stages.find((s) => s.aircraftPath === 'arms.fuelMain')).toBeUndefined();
    // Le carburant ne vient plus QUE de additionalFuelTanks.
    expect(stages.filter((s) => s.category === 'fuel').map((s) => s.aircraftPath))
      .toEqual(['additionalFuelTanks[0].arm']);
  });

  it('data null / undefined → les 3 stages fixes, sans lever d\'erreur', () => {
    expect(buildStageList(null).map((s) => s.key)).toEqual(['empty', 'frontSeats', 'rearSeats']);
    expect(buildStageList(undefined).map((s) => s.key)).toEqual(['empty', 'frontSeats', 'rearSeats']);
    expect(buildStageList().map((s) => s.key)).toEqual(['empty', 'frontSeats', 'rearSeats']);
  });

  it('PARTAGE DE RÉFÉRENCES : les stages fixes sont les objets de CENTROGRAM_STAGES', () => {
    // filter() copie le tableau mais pas les objets : muter un stage fixe
    // renvoyé corromprait la constante du module.
    const stages = buildStageList({});
    expect(stages[0]).toBe(CENTROGRAM_STAGES[0]);
    expect(stages[1]).toBe(CENTROGRAM_STAGES[1]);
    expect(stages[2]).toBe(CENTROGRAM_STAGES[2]);
  });

  it('un NOUVEAU tableau est renvoyé à chaque appel', () => {
    expect(buildStageList({})).not.toBe(buildStageList({}));
    expect(buildStageList({})).toEqual(buildStageList({}));
  });
});

describe('buildStageList — réservoirs (additionalFuelTanks)', () => {
  it('réservoir nommé : label emoji + nom, chemin indexé, métadonnées complètes', () => {
    const stages = buildStageList({
      additionalFuelTanks: [{ id: 'M', name: 'Principal', type: 'main', arm: 1.1 }],
    });
    expect(stages).toHaveLength(4);
    expect(stages[3]).toEqual({
      key: 'fuelTank_M',
      label: '⛽ Principal',
      aircraftPath: 'additionalFuelTanks[0].arm',
      helper: 'Mini-graphique "Principal". Clique 3-5 points sur la droite affine. Pour un réservoir non-linéaire, prends la pente moyenne.',
      singleValue: false,
      dynamicIndex: 0,
      dynamicType: 'fuelTank',
      tankType: 'main',
      category: 'fuel',
    });
  });

  it('réservoir SANS nom : repli sur le libellé du type, MAJUSCULES dans le helper', () => {
    const stages = buildStageList({ additionalFuelTanks: [{ id: 'W', type: 'wing' }] });
    expect(stages[3].label).toBe('✈️ Réservoir d\'aile');
    expect(stages[3].helper).toBe('Mini-graphique "RÉSERVOIR D\'AILE". Clique 3-5 points sur la droite affine. Pour un réservoir non-linéaire, prends la pente moyenne.');
  });

  it('libellé et emoji figés pour chacun des 5 types connus', () => {
    const labels = buildStageList({
      additionalFuelTanks: [
        { id: 'a', type: 'main' },
        { id: 'b', type: 'wing' },
        { id: 'c', type: 'optional' },
        { id: 'd', type: 'tip' },
        { id: 'e', type: 'aux' },
      ],
    }).slice(3).map((s) => s.label);
    expect(labels).toEqual([
      '⛽ Réservoir principal',
      '✈️ Réservoir d\'aile',
      '🔋 Réservoir optionnel',
      '🛢️ Réservoir d\'extrémité (tip tank)',
      '🔧 Réservoir auxiliaire',
    ]);
  });

  it('type inconnu ou absent → « Réservoir » + emoji ⛽, tankType conservé tel quel', () => {
    const stages = buildStageList({
      additionalFuelTanks: [{ id: 'Z', type: 'inconnu' }, { id: 'Y' }],
    });
    expect(stages[3].label).toBe('⛽ Réservoir');
    expect(stages[3].tankType).toBe('inconnu');
    expect(stages[4].label).toBe('⛽ Réservoir');
    expect(stages[4].tankType).toBeUndefined();
  });

  it('nom vide → traité comme absent (repli sur le type)', () => {
    expect(buildStageList({ additionalFuelTanks: [{ id: 'M', name: '', type: 'main' }] })[3].label)
      .toBe('⛽ Réservoir principal');
  });

  it('CLÉ NON UNIQUE : réservoirs sans id → « fuelTank_undefined » en double', () => {
    const keys = buildStageList({
      additionalFuelTanks: [{ type: 'main' }, { type: 'wing' }],
    }).slice(3).map((s) => s.key);
    expect(keys).toEqual(['fuelTank_undefined', 'fuelTank_undefined']);
  });

  it('dynamicIndex suit l\'index du tableau, pas l\'id', () => {
    const stages = buildStageList({
      additionalFuelTanks: [{ id: 'X' }, { id: 'Y' }, { id: 'Z' }],
    }).slice(3);
    expect(stages.map((s) => s.dynamicIndex)).toEqual([0, 1, 2]);
    expect(stages.map((s) => s.aircraftPath)).toEqual([
      'additionalFuelTanks[0].arm',
      'additionalFuelTanks[1].arm',
      'additionalFuelTanks[2].arm',
    ]);
  });
});

describe('buildStageList — bagages (baggageCompartments)', () => {
  it('compartiment nommé : label et helper reprennent le nom', () => {
    const stages = buildStageList({ baggageCompartments: [{ id: 'B1', name: 'Soute avant' }] });
    expect(stages[3]).toEqual({
      key: 'baggage_B1',
      label: '🧳 Bagages — Soute avant',
      aircraftPath: 'baggageCompartments[0].arm',
      helper: 'Mini-graphique "Soute avant". Clique 3-5 points sur la droite affine.',
      singleValue: false,
      dynamicIndex: 0,
      dynamicType: 'baggage',
      category: 'baggage',
    });
  });

  it('compartiment SANS nom : « Compartiment N » (1-indexé) mais helper « BAGAGES »', () => {
    const stages = buildStageList({ baggageCompartments: [{ id: 'B1' }, { id: 'B2' }] });
    expect(stages[3].label).toBe('🧳 Bagages — Compartiment 1');
    expect(stages[4].label).toBe('🧳 Bagages — Compartiment 2');
    expect(stages[4].helper).toBe('Mini-graphique "BAGAGES". Clique 3-5 points sur la droite affine.');
  });

  it('pas de tankType sur un stage bagages', () => {
    expect(buildStageList({ baggageCompartments: [{ id: 'B1' }] })[3]).not.toHaveProperty('tankType');
  });
});

describe('buildStageList — sièges additionnels (additionalSeats)', () => {
  it('siège nommé : label 💺 + nom', () => {
    const stages = buildStageList({ additionalSeats: [{ id: 'S1', name: 'Strapontin' }] });
    expect(stages[3]).toEqual({
      key: 'seat_S1',
      label: '💺 Strapontin',
      aircraftPath: 'additionalSeats[0].arm',
      helper: 'Mini-graphique "Strapontin". Clique 3-5 points sur la droite affine.',
      singleValue: false,
      dynamicIndex: 0,
      dynamicType: 'seat',
      category: 'seats',
    });
  });

  it('siège SANS nom : « Siège additionnel N » (1-indexé) mais helper « SIÈGE »', () => {
    const stages = buildStageList({ additionalSeats: [{ id: 'S1' }, { id: 'S2' }] });
    expect(stages[3].label).toBe('💺 Siège additionnel 1');
    expect(stages[4].label).toBe('💺 Siège additionnel 2');
    expect(stages[4].helper).toBe('Mini-graphique "SIÈGE". Clique 3-5 points sur la droite affine.');
  });

  it('catégorie « seats » partagée avec les sièges fixes', () => {
    const stages = buildStageList({ additionalSeats: [{ id: 'S1' }] });
    expect(stages.filter((s) => s.category === 'seats').map((s) => s.key))
      .toEqual(['frontSeats', 'rearSeats', 'seat_S1']);
  });
});

describe('buildStageList — avion complet : ordre et intégrité de la liste', () => {
  const AVION = {
    additionalFuelTanks: [
      { id: 'M', name: 'Principal', type: 'main', arm: 1.1 },
      { id: 'W', type: 'wing' },
    ],
    baggageCompartments: [{ id: 'B1', name: 'Soute avant' }],
    additionalSeats: [{ id: 'S1', name: 'Strapontin' }],
  };

  it('ORDRE figé : fixes → carburant → bagages → sièges additionnels', () => {
    expect(buildStageList(AVION).map((s) => s.key)).toEqual([
      'empty',
      'frontSeats',
      'rearSeats',
      'fuelTank_M',
      'fuelTank_W',
      'baggage_B1',
      'seat_S1',
    ]);
  });

  it('aucun stage dynamique n\'est à valeur unique', () => {
    expect(buildStageList(AVION).filter((s) => s.singleValue).map((s) => s.key)).toEqual(['empty']);
  });

  it('tout stage dynamique porte dynamicType + dynamicIndex ; les fixes non', () => {
    const stages = buildStageList(AVION);
    expect(stages.slice(0, 3).every((s) => s.dynamicType === undefined)).toBe(true);
    expect(stages.slice(3).map((s) => s.dynamicType))
      .toEqual(['fuelTank', 'fuelTank', 'baggage', 'seat']);
  });

  it('ne mute PAS l\'objet avion reçu', () => {
    const copie = JSON.parse(JSON.stringify(AVION));
    buildStageList(AVION);
    expect(AVION).toEqual(copie);
  });

  it('collections non tableau (donnée corrompue) → LÈVE une TypeError', () => {
    // `data.x || []` ne protège que du falsy : une chaîne ou un nombre passent.
    expect(() => buildStageList({ additionalFuelTanks: 'abc' })).toThrow(TypeError);
    expect(() => buildStageList({ baggageCompartments: 123 })).toThrow(TypeError);
    expect(() => buildStageList({ additionalSeats: {} })).toThrow(TypeError);
  });

  it('collections falsy (null, 0, chaîne vide) → ignorées silencieusement', () => {
    expect(buildStageList({ additionalFuelTanks: null, baggageCompartments: 0, additionalSeats: '' })
      .map((s) => s.key)).toEqual(['empty', 'frontSeats', 'rearSeats']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// FUEL_TANK_TYPES — constante d'UI
// ───────────────────────────────────────────────────────────────────────────
describe('FUEL_TANK_TYPES — options du sélecteur de type', () => {
  it('5 types, dans cet ordre, avec ces libellés exacts', () => {
    expect(FUEL_TANK_TYPES).toEqual([
      { value: 'main', label: 'Principal' },
      { value: 'wing', label: 'Aile' },
      { value: 'optional', label: 'Optionnel' },
      { value: 'tip', label: 'Extrémité (tip tank)' },
      { value: 'aux', label: 'Auxiliaire' },
    ]);
  });

  it('chaque valeur est reconnue par buildStageList (aucun repli « Réservoir »)', () => {
    const stages = buildStageList({
      additionalFuelTanks: FUEL_TANK_TYPES.map((t, i) => ({ id: `t${i}`, type: t.value })),
    }).slice(3);
    expect(stages.every((s) => s.label !== '⛽ Réservoir')).toBe(true);
  });
});
