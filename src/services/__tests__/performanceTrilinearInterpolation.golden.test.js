// Caractérisation (golden) du comportement ACTUEL de
// performanceTrilinearInterpolation — moteur d'interpolation à trois entrées
// (masse × altitude × température) des tableaux de PERFORMANCES du manuel.
//
// Phase 2 / Vague 3 : filet posé AVANT le déplacement du module vers le paquet
// autonome @alflight/calc-engine, pour prouver qu'aucune distance ne bouge
// après la migration.
//
// ⚠️ Ces valeurs figent le comportement PRÉSENT, défauts compris. Elles ne
// disent PAS ce que le code devrait faire. Sont notamment figés ici, et
// SIGNALÉS car ils peuvent SOUS-ESTIMER une distance de piste :
//   - hors domaine en ALTITUDE et en TEMPÉRATURE vers le BAS (plancher, froid) :
//     clamp SILENCIEUX sur la première courbe, sans alerte, avec
//     `method: 'interpolation'` et `warning: null` (seule la MASSE est
//     surveillée) — conservateur, donc conservé. Vers le HAUT (plafond, chaud)
//     le clamp était OPTIMISTE : depuis le 21/08/2026 le moteur REFUSE (null),
//     cf. le bloc « hors domaine » ci-dessous ;
//   - une entrée NaN / undefined / null retombe sur l'indice 0, c'est-à-dire
//     la masse MINIMALE, l'altitude la plus BASSE et la température la plus
//     BASSE — donc la distance la plus courte du tableau ;
//   - une case manquante (null) dans le tableau est remplacée en silence par
//     la case voisine (interpolateIfPossible) ;
//   - le repli `clamped` renvoie une distance INFÉRIEURE à l'extrapolation
//     quand l'avion est plus lourd que la dernière masse du tableau ;
//   - hors plage de masse, la forme du retour CHANGE ({extrapolated, clamped}
//     au lieu de {value, method, massUsed, warning}) ;
//   - un tableau trié en ORDRE DÉCROISSANT n'est pas détecté et renvoie la
//     mauvaise ligne de masse ;
//   - des valeurs de tableau en CHAÎNE produisent une concaténation ;
//   - l'extrapolation de masse peut produire une distance NÉGATIVE ;
//   - `calculatePerformanceWithExtrapolation` LÈVE une TypeError si `masses`
//     est absent (alors que `calculatePerformanceDistance` renvoie null).
// Chaque point est détaillé dans le compte rendu ("surprises").
//
// Toutes les valeurs attendues sont calculées à la main depuis le code du
// module (ordre d'interpolation : température → altitude → masse).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import perfDefault, {
  trilinearInterpolate,
  calculatePerformanceDistance,
  calculatePerformanceWithExtrapolation,
} from '../performanceTrilinearInterpolation';

// ───────────────────────────────────────────────────────────────────────────
// Grille de référence 3 × 3 × 3, volontairement AFFINE pour que chaque valeur
// attendue soit vérifiable de tête :
//     V(m, a, t) = 300 + 0,2·(m − 900) + 0,05·a + 2·t
// Une variation propre à chaque axe (0,2 / 0,05 / 2) garantit qu'une
// inversion d'indices masse/altitude/température serait détectée.
const MASSES = [900, 1000, 1100];          // kg
const ALTITUDES = [0, 2000, 4000];         // ft
const TEMPERATURES = [0, 20, 40];          // °C

const VALUES = [
  // masse 900 kg
  [
    [300, 340, 380],   // 0 ft    → 0 / 20 / 40 °C
    [400, 440, 480],   // 2000 ft
    [500, 540, 580],   // 4000 ft
  ],
  // masse 1000 kg
  [
    [320, 360, 400],
    [420, 460, 500],
    [520, 560, 600],
  ],
  // masse 1100 kg
  [
    [340, 380, 420],
    [440, 480, 520],
    [540, 580, 620],
  ],
];

const FIELD = 'Distance_roulement';

/** Enveloppe `groupData` attendue par les deux fonctions de haut niveau. */
const groupe = (values = VALUES, over = {}) => ({
  masses: MASSES,
  altitudes: ALTITUDES,
  temperatures: TEMPERATURES,
  values: { [FIELD]: values },
  ...over,
});

/** Appel abrégé sur la grille de référence. */
const tri = (m, a, t) => trilinearInterpolate(MASSES, ALTITUDES, TEMPERATURES, VALUES, m, a, t);

// Le module produit 26 sorties console : on les capture pour garder la sortie
// de test lisible (le module lui-même n'est pas modifié).
let logSpy;
let warnSpy;
let errorSpy;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

// ───────────────────────────────────────────────────────────────────────────
describe('trilinearInterpolate — point exactement sur un nœud', () => {
  it('nœud intérieur : la valeur brute du tableau est renvoyée telle quelle', () => {
    expect(tri(1000, 2000, 20)).toBe(460);
  });

  it('coin bas du domaine (masse min, 0 ft, 0 °C)', () => {
    expect(tri(900, 0, 0)).toBe(300);
  });

  it('coin haut du domaine (masse max, 4000 ft, 40 °C)', () => {
    expect(tri(1100, 4000, 40)).toBe(620);
  });

  it('tolérance de 0,001 : 2000,0005 ft est considéré comme le nœud 2000 ft', () => {
    expect(tri(1000, 2000.0005, 20)).toBe(460);
  });

  it('au-delà de la tolérance, on repasse par l’interpolation (même valeur ici)', () => {
    expect(tri(1000, 2000.5, 20)).toBeCloseTo(460.025, 6); // +0,05 ft⁻¹ × 0,5 ft
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('trilinearInterpolate — point entre nœuds', () => {
  it('milieu de cube sur les trois axes (950 kg / 1000 ft / 10 °C)', () => {
    // temp 0,5 → 320 / 420 / 340 / 440 ; alt 0,5 → 370 / 390 ; masse 0,5 → 380
    expect(tri(950, 1000, 10)).toBeCloseTo(380, 6);
  });

  it('deux axes exacts, un seul interpolé (1000 kg / 2000 ft / 30 °C)', () => {
    expect(tri(1000, 2000, 30)).toBeCloseTo(480, 6);
  });

  it('interpolation sur la masse seule (950 kg / 0 ft / 0 °C)', () => {
    expect(tri(950, 0, 0)).toBeCloseTo(310, 6);
  });

  it('interpolation sur l’altitude seule (900 kg / 3000 ft / 0 °C)', () => {
    expect(tri(900, 3000, 0)).toBeCloseTo(450, 6);
  });

  it('interpolation sur la température seule (900 kg / 0 ft / 25 °C)', () => {
    expect(tri(900, 0, 25)).toBeCloseTo(350, 6);
  });

  it('cube 2×2×2 non affine : l’ordre température → altitude → masse est figé', () => {
    // Table volontairement « courbe » (terme croisé) pour épingler l’arithmétique.
    const m = [900, 1100];
    const a = [0, 4000];
    const t = [0, 40];
    const v = [
      [[300, 380], [500, 700]],   // 900 kg
      [[340, 420], [560, 800]],   // 1100 kg
    ];

    // Centre exact du cube = moyenne des 8 sommets = 4000 / 8.
    expect(trilinearInterpolate(m, a, t, v, 1000, 2000, 20)).toBeCloseTo(500, 6);

    // Point à 25 % sur chaque axe :
    // temp → 320 / 550 / 360 / 620 ; alt → 377,5 / 425 ; masse → 389,375
    expect(trilinearInterpolate(m, a, t, v, 950, 1000, 10)).toBeCloseTo(389.375, 6);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// COMPORTEMENT DÉLIBÉRÉMENT MODIFIÉ — 21/08/2026 (ré-audit F-BXQT / F-BXNG)
//
// AVANT : au-dessus du plafond de la grille, `findBracketingIndices` ramenait la
//   cible sur le dernier nœud : 6000 ft rendait la distance de 4000 ft, 50 °C
//   celle de 40 °C. Or une altitude-pression plus haute ou une journée plus
//   chaude ALLONGENT la distance réelle : l'écrêtage vers le haut est OPTIMISTE.
//   Constaté sur la base réelle : F-BXQT (Cessna F150, grille réduite à la
//   ligne ISA) rendait à (726 kg, 0 ft, 25 °C) la distance des 15 °C.
//
// APRÈS : altitude ou température au-delà du plafond → `null` (refus). Le
//   résolveur remonte un ERROR motivé, le pilote lit « — ». L'écrêtage vers le
//   BAS (plancher, froid) rend une distance PLUS LONGUE que la réalité : il est
//   conservé tel quel. La MASSE n'est pas concernée (gérée par l'adaptateur :
//   extrapolation ou « tableau le plus proche », décision pilote 2026-06-23).
//
// Assertions changées : les trois « au-dessus du domaine » passent de la
// valeur du plafond à `toBeNull()`. Celles « en dessous » sont inchangées.
// ─────────────────────────────────────────────────────────────────────────
describe('trilinearInterpolate — hors domaine : REFUS vers le haut (alt/temp), clamp vers le bas', () => {
  it('masse, altitude ET température au-dessus du domaine → null (refus), plus jamais le coin 1100 kg / 4000 ft / 40 °C', () => {
    // 1200 kg / 6000 ft / 50 °C ne sont couverts par AUCUNE courbe :
    // la valeur rendue était celle du coin 1100 kg / 4000 ft / 40 °C (620).
    expect(tri(1200, 6000, 50)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('au-delà du plafond de la grille'),
      expect.objectContaining({ targetAlt: 6000, plafondAlt: 4000, targetTemp: 50, plafondTemp: 40 })
    );
  });

  it('altitude au-dessus du plafond seule → null (était la distance du plafond, 560 : sous-estimation)', () => {
    expect(tri(1000, 99000, 20)).toBeNull();
  });

  it('température au-dessus du plafond seule → null (était la dernière colonne, 500)', () => {
    expect(tri(1000, 2000, 60)).toBeNull();
  });

  it('pile sur le plafond (4000 ft / 40 °C) → valeur du plafond, pas de refus', () => {
    expect(tri(1000, 4000, 40)).toBe(600);
  });

  it('tolérance du nœud : 4000,0005 ft / 40,0005 °C est encore le plafond ; 4000,01 ft ne l’est plus', () => {
    expect(tri(1000, 4000.0005, 40.0005)).toBe(600);
    expect(tri(1000, 4000.01, 40)).toBeNull();
    expect(tri(1000, 4000, 40.01)).toBeNull();
  });

  it('température seule SOUS le plancher → clamp sur la première colonne (conservateur, conservé)', () => {
    expect(tri(1000, 2000, -10)).toBeCloseTo(420, 6);  // = V(1000, 2000 ft, 0 °C)
  });

  it('altitude seule SOUS le plancher → clamp sur le premier palier (conservateur, conservé)', () => {
    expect(tri(1000, -500, 20)).toBeCloseTo(360, 6);   // = V(1000, 0 ft, 20 °C)
  });

  it('en dessous du domaine → première courbe (masse min / 0 ft / 0 °C)', () => {
    expect(tri(800, -1000, -10)).toBe(300);
  });

  it('clamp partiel : masse hors domaine, altitude et température interpolées', () => {
    expect(tri(1200, 1000, 10)).toBeCloseTo(410, 6);   // = V(1100 kg, 1000 ft, 10 °C)
  });

  it('l’extrapolation n’est JAMAIS faite par trilinearInterpolate lui-même', () => {
    // 1200 kg donne exactement la même valeur que 1100 kg : aucune pente prolongée.
    expect(tri(1200, 2000, 20)).toBe(tri(1100, 2000, 20));
    expect(tri(5000, 2000, 20)).toBe(480);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('trilinearInterpolate — entrées absentes, nulles ou NaN', () => {
  it('un tableau d’axes manquant (null/undefined) → null + console.warn', () => {
    expect(trilinearInterpolate(null, ALTITUDES, TEMPERATURES, VALUES, 1000, 2000, 20)).toBeNull();
    expect(trilinearInterpolate(MASSES, undefined, TEMPERATURES, VALUES, 1000, 2000, 20)).toBeNull();
    expect(trilinearInterpolate(MASSES, ALTITUDES, null, VALUES, 1000, 2000, 20)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('[TrilinearInterpolation] Données manquantes');
  });

  it('le tableau de valeurs manquant → null + console.warn', () => {
    expect(trilinearInterpolate(MASSES, ALTITUDES, TEMPERATURES, null, 1000, 2000, 20)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('[TrilinearInterpolation] Données manquantes');
  });

  it('un axe VIDE → null + console.warn « Tableaux vides »', () => {
    expect(trilinearInterpolate([], ALTITUDES, TEMPERATURES, VALUES, 1000, 2000, 20)).toBeNull();
    expect(trilinearInterpolate(MASSES, [], TEMPERATURES, VALUES, 1000, 2000, 20)).toBeNull();
    expect(trilinearInterpolate(MASSES, ALTITUDES, [], VALUES, 1000, 2000, 20)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('[TrilinearInterpolation] Tableaux vides');
  });

  it('tableau de VALEURS vide (axes présents) → null, mais AUCUNE alerte', () => {
    expect(trilinearInterpolate(MASSES, ALTITUDES, TEMPERATURES, [], 1000, 2000, 20)).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('⚠️ masse NaN → repli SILENCIEUX sur la masse MINIMALE du tableau', () => {
    expect(tri(NaN, 2000, 20)).toBeCloseTo(440, 6);    // = V(900 kg, 2000 ft, 20 °C)
  });

  it('⚠️ altitude NaN → repli silencieux sur l’altitude la plus basse (0 ft)', () => {
    expect(tri(1000, NaN, 20)).toBeCloseTo(360, 6);    // = V(1000 kg, 0 ft, 20 °C)
  });

  it('⚠️ température NaN → repli silencieux sur la température la plus basse (0 °C)', () => {
    expect(tri(1000, 2000, NaN)).toBeCloseTo(420, 6);  // = V(1000 kg, 2000 ft, 0 °C)
  });

  it('⚠️ les trois entrées NaN → coin le plus favorable du tableau, sans alerte', () => {
    expect(tri(NaN, NaN, NaN)).toBeCloseTo(300, 6);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('⚠️ entrées undefined → même repli que NaN (coin bas du tableau)', () => {
    expect(tri(undefined, undefined, undefined)).toBeCloseTo(300, 6);
  });

  it('⚠️ entrées null → converties en 0 : 0 °C et 0 ft sont pris pour des valeurs EXACTES', () => {
    // null → 0 : altitude et température tombent pile sur le premier nœud,
    // la masse (null → 0 kg) est clampée sur 900 kg.
    expect(tri(null, null, null)).toBeCloseTo(300, 6);
    // Température null sur un point par ailleurs nominal → traitée comme 0 °C.
    expect(tri(1000, 2000, null)).toBeCloseTo(420, 6);
  });

  it('chaîne numérique en entrée : coercition implicite, pas de rejet', () => {
    expect(trilinearInterpolate(MASSES, ALTITUDES, TEMPERATURES, VALUES, '1000', '2000', '20')).toBe(460);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('trilinearInterpolate — tableaux dégénérés', () => {
  it('tableau à UNE SEULE masse : toute masse renvoie cette unique ligne', () => {
    const m = [1089];
    const a = [0, 4000];
    const t = [0, 40];
    const v = [[[400, 460], [520, 600]]];

    expect(trilinearInterpolate(m, a, t, v, 1089, 0, 0)).toBe(400);   // nœud exact
    expect(trilinearInterpolate(m, a, t, v, 800, 0, 0)).toBe(400);    // ⚠️ bien plus léger
    expect(trilinearInterpolate(m, a, t, v, 1500, 0, 0)).toBeCloseTo(400, 6); // ⚠️ bien plus lourd
    // Altitude/température restent, elles, correctement interpolées.
    expect(trilinearInterpolate(m, a, t, v, 1089, 2000, 20)).toBeCloseTo(495, 6);
  });

  it('tableau à UN SEUL point (1×1×1) : renvoyé pour toute MASSE, refusé au-dessus du point en altitude/température', () => {
    // 21/08/2026 : avant, (1234 kg, 9999 ft, 99 °C) rendait 555 — l'unique case,
    // pour n'importe quelle entrée. Le refus au-delà du plafond s'applique
    // aussi à cette grille dégénérée ; seule la masse reste écrêtée.
    expect(trilinearInterpolate([1000], [0], [0], [[[555]]], 1234, 0, 0)).toBeCloseTo(555, 6);
    expect(trilinearInterpolate([1000], [0], [0], [[[555]]], 1234, 9999, 99)).toBeNull();
    expect(trilinearInterpolate([1000], [0], [0], [[[555]]], 1000, 0, 1)).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // COMPORTEMENT DÉLIBÉRÉMENT MODIFIÉ — Phase 0, 17/08/2026
  //
  // AVANT : une case absente était remplacée en silence par la case voisine, et
  //   la distance ressortait avec le statut « calculé ». Ce test l'attestait :
  //   `trilinearInterpolate(m, a, t, v, 1000, 0, 0)` valait 400, soit la distance
  //   de la masse la plus LÉGÈRE appliquée à un avion 100 kg plus lourd.
  //   Constaté sur la base réelle : cinq des treize avions ont des grilles
  //   trouées ; F-BXNG rendait à 1500 ft la distance du niveau de la mer.
  //
  // APRÈS : une borne manquante rend `null`. Le résolveur remonte l'échec et le
  //   pilote lit « — » plutôt qu'un chiffre faux.
  //
  // Assertion changée : la première, `toBe(400)` → `toBeNull()`.
  // La seconde (tous sommets nuls → null) est inchangée.
  // ─────────────────────────────────────────────────────────────────────────
  it('case manquante (null) : refus de calculer, jamais de repli sur la voisine', () => {
    const m = [900, 1100];
    const a = [0];
    const t = [0];
    const v = [[[400]], [[null]]];       // valeur absente à 1100 kg

    // À 1000 kg, le sommet 1100 kg est nul → on REFUSE de calculer.
    expect(trilinearInterpolate(m, a, t, v, 1000, 0, 0)).toBeNull();
    // À 1100 kg pile, tous les sommets sont nuls → null (inchangé).
    expect(trilinearInterpolate(m, a, t, v, 1100, 0, 0)).toBeNull();
  });

  it('⚠️ axe trié en ORDRE DÉCROISSANT : non détecté, mauvaise ligne renvoyée', () => {
    const m = [1100, 900];              // décroissant
    const a = [0];
    const t = [0];
    const v = [[[340]], [[300]]];       // 340 → 1100 kg, 300 → 900 kg

    // 1000 kg (entre les deux) → renvoie la valeur de 1100 kg, sans interpoler.
    expect(trilinearInterpolate(m, a, t, v, 1000, 0, 0)).toBe(340);
    // 1150 kg (plus lourd que tout) → renvoie la valeur de 900 kg : SOUS-ESTIMATION.
    expect(trilinearInterpolate(m, a, t, v, 1150, 0, 0)).toBe(300);
  });

  it('⚠️ valeurs de tableau en CHAÎNE : concaténation au lieu d’une addition', () => {
    const m = [900, 1100];
    const v = [[['400']], [['500']]];

    // Nœud exact : la chaîne est renvoyée telle quelle (type non normalisé).
    expect(trilinearInterpolate(m, [0], [0], v, 900, 0, 0)).toBe('400');
    // Interpolation : '400' + 50 → '40050'.
    expect(trilinearInterpolate(m, [0], [0], v, 1000, 0, 0)).toBe('40050');
  });

  it('valeur 0 sur un nœud exact : renvoyée (0 n’est pas confondu avec null)', () => {
    expect(trilinearInterpolate([1000], [0], [0], [[[0]]], 1000, 0, 0)).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('calculatePerformanceDistance', () => {
  it('cas nominal : délègue à l’interpolation trilinéaire', () => {
    expect(calculatePerformanceDistance(groupe(), FIELD, 950, 1000, 10)).toBeCloseTo(380, 6);
  });

  it('groupData absent → null + alerte', () => {
    expect(calculatePerformanceDistance(null, FIELD, 950, 1000, 10)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('[PerformanceDistance] Données de groupe invalides');
  });

  it('champ demandé absent du groupe → null + alerte', () => {
    expect(calculatePerformanceDistance(groupe(), 'Distance_passage_15m', 950, 1000, 10)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('[PerformanceDistance] Données de groupe invalides');
  });

  it('groupe sans `values` → null + alerte', () => {
    expect(calculatePerformanceDistance({ masses: MASSES }, FIELD, 950, 1000, 10)).toBeNull();
  });

  it('axes absents du groupe → null (relayé par trilinearInterpolate), sans exception', () => {
    expect(calculatePerformanceDistance({ values: { [FIELD]: VALUES } }, FIELD, 950, 1000, 10)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('[TrilinearInterpolation] Données manquantes');
  });

  it('au-dessus du plafond (8000 ft / 55 °C) → null depuis le 21/08/2026 (rendait 620, le coin du tableau)', () => {
    expect(calculatePerformanceDistance(groupe(), FIELD, 1400, 8000, 55)).toBeNull();
  });

  it('⚠️ masse seule hors domaine : distance clampée, indistinguable d’un calcul valide', () => {
    // Aucune métadonnée, aucun signal : le résultat ressemble à un calcul normal.
    expect(calculatePerformanceDistance(groupe(), FIELD, 1400, 4000, 40)).toBe(620);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('calculatePerformanceWithExtrapolation — masse DANS la plage', () => {
  it('cas nominal : objet plat {value, method, massUsed, warning}', () => {
    const res = calculatePerformanceWithExtrapolation(groupe(), FIELD, 950, 1000, 10);
    expect(res).toEqual({
      value: 380,
      method: 'interpolation',
      massUsed: 950,
      warning: null,
    });
  });

  it('masse pile sur une borne (900 et 1100 kg) → interpolation, pas de clamp', () => {
    expect(calculatePerformanceWithExtrapolation(groupe(), FIELD, 900, 0, 0).method).toBe('interpolation');
    expect(calculatePerformanceWithExtrapolation(groupe(), FIELD, 1100, 4000, 40).value).toBe(620);
  });

  it('altitude ET température au-dessus du plafond → null depuis le 21/08/2026 (rendait 600 en « interpolation » sans alerte)', () => {
    // 6000 ft / 50 °C sortent du tableau par le haut : le moteur refuse, la
    // masse étant dans la plage aucun repli n'existe → null (et non un objet).
    expect(calculatePerformanceWithExtrapolation(groupe(), FIELD, 1000, 6000, 50)).toBeNull();
  });

  it('⚠️ altitude ET température SOUS le plancher → method:"interpolation", warning:null (clamp conservateur, silencieux)', () => {
    // Seule la MASSE est surveillée : −1000 ft / −10 °C sortent du tableau par
    // le bas sans qu’aucune alerte ne soit levée ; la distance est celle de
    // 0 ft / 0 °C — plus longue que la réalité, donc conservatrice.
    const res = calculatePerformanceWithExtrapolation(groupe(), FIELD, 1000, -1000, -10);
    expect(res.value).toBe(320);
    expect(res.method).toBe('interpolation');
    expect(res.warning).toBeNull();
    expect(res.massUsed).toBe(1000);
  });

  it('masse dans la plage mais tableau de valeurs vide → null (et non un objet)', () => {
    const res = calculatePerformanceWithExtrapolation(groupe([]), FIELD, 1000, 2000, 20);
    expect(res).toBeNull();
  });

  it('groupData ou champ invalide → null + alerte', () => {
    expect(calculatePerformanceWithExtrapolation(null, FIELD, 1000, 2000, 20)).toBeNull();
    expect(calculatePerformanceWithExtrapolation(groupe(), 'inconnu', 1000, 2000, 20)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('[PerformanceDistance] Données de groupe invalides');
  });

  it('⚠️ groupe SANS `masses` → lève une TypeError (contrairement à calculatePerformanceDistance)', () => {
    expect(() => calculatePerformanceWithExtrapolation({ values: { [FIELD]: VALUES } }, FIELD, 1000, 2000, 20))
      .toThrow(TypeError);
  });

  it('liste de masses VIDE → null (aucun résultat exploitable)', () => {
    const res = calculatePerformanceWithExtrapolation(groupe(VALUES, { masses: [] }), FIELD, 1000, 2000, 20);
    expect(res).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('calculatePerformanceWithExtrapolation — masse HORS plage', () => {
  it('⚠️ la FORME du retour change : {extrapolated, clamped}, sans `value` à la racine', () => {
    const res = calculatePerformanceWithExtrapolation(groupe(), FIELD, 1200, 2000, 20);
    expect(res.value).toBeUndefined();
    expect(Object.keys(res).sort()).toEqual(['clamped', 'extrapolated']);
  });

  it('masse SUPÉRIEURE au tableau : extrapolation linéaire sur les deux dernières masses', () => {
    const res = calculatePerformanceWithExtrapolation(groupe(), FIELD, 1200, 2000, 20);
    // Pente entre 1000 kg (460) et 1100 kg (480) prolongée jusqu’à 1200 kg.
    expect(res.extrapolated.value).toBeCloseTo(500, 6);
    expect(res.extrapolated.method).toBe('extrapolation');
    expect(res.extrapolated.massUsed).toBe(1200);
    expect(res.extrapolated.warning)
      .toBe('Masse 1200 kg supérieure à la masse maximale du tableau (1100 kg). Valeur extrapolée.');
  });

  it('⚠️ le repli `clamped` renvoie une distance PLUS COURTE que l’extrapolation', () => {
    const res = calculatePerformanceWithExtrapolation(groupe(), FIELD, 1200, 2000, 20);
    expect(res.clamped.value).toBe(480);               // valeur à 1100 kg
    expect(res.clamped.method).toBe('clamped');
    expect(res.clamped.massUsed).toBe(1100);
    expect(res.clamped.warning)
      .toBe('Masse réelle 1200 kg > masse max 1100 kg. Calcul avec masse maximale.');
    // 20 m de moins pour un avion plus lourd : sous-estimation si le consommateur
    // retient `clamped`.
    expect(res.clamped.value).toBeLessThan(res.extrapolated.value);
  });

  it('masse INFÉRIEURE au tableau : extrapolation sur les deux premières masses', () => {
    const res = calculatePerformanceWithExtrapolation(groupe(), FIELD, 800, 2000, 20);
    expect(res.extrapolated.value).toBeCloseTo(420, 6);  // pente 900→1000 prolongée
    expect(res.extrapolated.warning)
      .toBe('Masse 800 kg inférieure à la masse minimale du tableau (900 kg). Valeur extrapolée.');
    expect(res.clamped.value).toBe(440);                // valeur à 900 kg
    expect(res.clamped.massUsed).toBe(900);
    expect(res.clamped.warning)
      .toBe('Masse réelle 800 kg < masse min 900 kg. Calcul avec masse minimale.');
  });

  it('⚠️ l’extrapolation n’est pas bornée : elle peut renvoyer une distance NÉGATIVE', () => {
    const g = {
      masses: [1000, 1100],
      altitudes: [0],
      temperatures: [0],
      values: { [FIELD]: [[[400]], [[600]]] },   // pente 2 m/kg
    };
    const res = calculatePerformanceWithExtrapolation(g, FIELD, 500, 0, 0);
    expect(res.extrapolated.value).toBeCloseTo(-600, 6);  // 400 − 2 × 500
    expect(res.clamped.value).toBe(400);
  });

  it('tableau MONO-MASSE hors plage : pas d’extrapolation possible, seul `clamped` existe', () => {
    const g = {
      masses: [1089],
      altitudes: [0, 4000],
      temperatures: [0, 40],
      values: { [FIELD]: [[[400, 460], [520, 600]]] },
    };
    const res = calculatePerformanceWithExtrapolation(g, FIELD, 1078, 0, 0);
    expect(res.extrapolated).toBeUndefined();
    expect(Object.keys(res)).toEqual(['clamped']);
    expect(res.clamped.value).toBe(400);
    expect(res.clamped.massUsed).toBe(1089);
    expect(res.clamped.warning)
      .toBe('Masse réelle 1078 kg < masse min 1089 kg. Calcul avec masse minimale.');
  });

  it('⚠️ masse NaN : classée hors plage, repli sur la masse MIN, alerte annonçant la masse MAX', () => {
    const res = calculatePerformanceWithExtrapolation(groupe(), FIELD, NaN, 2000, 20);
    expect(res.extrapolated).toBeUndefined();
    expect(res.clamped.value).toBeCloseTo(440, 6);       // = V(900 kg, 2000 ft, 20 °C)
    expect(Number.isNaN(res.clamped.massUsed)).toBe(true);
    // Message trompeur : il parle de la masse MAXIMALE alors que la valeur
    // utilisée est celle de la masse MINIMALE.
    expect(res.clamped.warning)
      .toBe('Masse réelle NaN kg > masse max 1100 kg. Calcul avec masse maximale.');
  });

  it('l’altitude et la température restent interpolées pendant l’extrapolation de masse', () => {
    const res = calculatePerformanceWithExtrapolation(groupe(), FIELD, 1200, 1000, 10);
    // V(1000, 1000, 10) = 390 ; V(1100, 1000, 10) = 410 ; prolongé à 1200 → 430
    expect(res.extrapolated.value).toBeCloseTo(430, 6);
    expect(res.clamped.value).toBeCloseTo(410, 6);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('surface publique du module', () => {
  it('export par défaut : les trois fonctions publiques', () => {
    expect(Object.keys(perfDefault).sort()).toEqual([
      'calculatePerformanceDistance',
      'calculatePerformanceWithExtrapolation',
      'trilinearInterpolate',
    ]);
    expect(perfDefault.trilinearInterpolate).toBe(trilinearInterpolate);
    expect(perfDefault.calculatePerformanceDistance).toBe(calculatePerformanceDistance);
    expect(perfDefault.calculatePerformanceWithExtrapolation).toBe(calculatePerformanceWithExtrapolation);
  });
});
