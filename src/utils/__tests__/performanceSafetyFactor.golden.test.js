// Caractérisation (golden) du comportement ACTUEL de performanceSafetyFactor.
// Phase 2 / Vague 3 : filet posé AVANT le déplacement des moteurs de
// PERFORMANCES vers @alflight/calc-engine, pour prouver qu'aucune marge
// réglementaire ne bouge après la migration.
//
// ⚠️ Ces valeurs figent le comportement PRÉSENT, défauts compris. Elles ne
// disent PAS ce que le code devrait faire. Sont figés ici notamment :
//   - applySafetyFactor retombe SILENCIEUSEMENT sur la distance brute dans
//     TOUS les cas de refus (operationId inconnu ou mal orthographié, facteur
//     NaN, facteur passé en chaîne "1.15", facteur ≤ 1) : aucune exception,
//     aucun drapeau. Sur une distance de piste, la marge que le pilote croit
//     avoir sélectionnée disparaît sans bruit → SOUS-ESTIMATION possible ;
//   - un rawValue NaN / Infinity ressort tel quel (pas de garde amont) ;
//   - getSafetyFactor hérite du prototype d'Object : 'constructor',
//     'toString', '__proto__' renvoient un objet parasite AU LIEU du preset
//     par défaut, avec `value === undefined` ;
//   - isDistanceOperation juge sur `acceptedOutputs` du CATALOGUE, pas sur la
//     grandeur réellement produite par l'abaque.
// Chaque point est détaillé dans le compte rendu ("surprises").
//
// Toutes les valeurs attendues sont dérivées à la main du code du module et du
// catalogue canonique (src/abac/curves/core/operationCatalog.ts).

import { describe, it, expect } from 'vitest';
import {
  SAFETY_FACTOR_PRESETS,
  SAFETY_FACTOR_BY_ID,
  DEFAULT_SAFETY_FACTOR,
  isDistanceOperation,
  applySafetyFactor,
  getSafetyFactor,
} from '@utils/performanceSafetyFactor';

// Opérations « distance » du catalogue (toutes les sorties acceptées sont
// de kind 'distance').
const OPS_DISTANCE = [
  'takeoff_ground_roll',              // héritée (volets non précisés)
  'takeoff_50ft',                     // héritée (volets non précisés)
  'takeoff_ground_roll_flaps_up',
  'takeoff_50ft_flaps_up',
  'takeoff_ground_roll_flaps_to',
  'takeoff_50ft_flaps_to',
  'landing_50ft_flaps_landing',
  'landing_ground_roll_flaps_landing',
  'landing_50ft_flaps_up',
  'landing_ground_roll_flaps_up',
];

// Opérations NON-distance du catalogue (vitesse, taux/angle de montée).
const OPS_NON_DISTANCE = [
  'climb_takeoff',
  'climb_cruise',
  'cruise_speed',
  'go_around_climb',
];

// ───────────────────────────────────────────────────────────────────────────
describe('SAFETY_FACTOR_PRESETS — catalogue figé des préréglages', () => {
  it('contient exactement 4 préréglages, dans cet ordre', () => {
    expect(SAFETY_FACTOR_PRESETS).toHaveLength(4);
    expect(SAFETY_FACTOR_PRESETS.map(p => p.id)).toEqual([
      'raw',
      'vfr_private',
      'ifr_cat_easa',
      'public_transport',
    ]);
  });

  it('valeurs numériques exactes de chaque préréglage', () => {
    expect(SAFETY_FACTOR_PRESETS[0].value).toBeCloseTo(1.0, 10);
    expect(SAFETY_FACTOR_PRESETS[1].value).toBeCloseTo(1.15, 10);
    expect(SAFETY_FACTOR_PRESETS[2].value).toBeCloseTo(1.43, 10);
    expect(SAFETY_FACTOR_PRESETS[3].value).toBeCloseTo(1.67, 10);
  });

  it('préréglage « raw » : 1.0, brut manuel de vol, aucune marge', () => {
    const p = SAFETY_FACTOR_PRESETS[0];
    expect(p.id).toBe('raw');
    expect(p.value).toBeCloseTo(1.0, 10);
    expect(p.label).toBe('Brut manuel de vol (sans marge)');
    expect(p.description).toBe(
      'Valeurs strictement issues du manuel de vol. Aucun facteur appliqué.'
    );
  });

  it('préréglage « vfr_private » : × 1.15', () => {
    const p = SAFETY_FACTOR_PRESETS[1];
    expect(p.id).toBe('vfr_private');
    expect(p.value).toBeCloseTo(1.15, 10);
    expect(p.label).toBe('VFR privé (× 1.15)');
    expect(p.description).toBe('Marge recommandée VFR privé hors transport public.');
  });

  it('préréglage « ifr_cat_easa » : × 1.43', () => {
    const p = SAFETY_FACTOR_PRESETS[2];
    expect(p.id).toBe('ifr_cat_easa');
    expect(p.value).toBeCloseTo(1.43, 10);
    expect(p.label).toBe('IFR / CAT EASA (× 1.43)');
    expect(p.description).toBe('Transport aérien commercial CAT (EU-OPS Part-CAT.POL).');
  });

  it('préréglage « public_transport » : × 1.67', () => {
    const p = SAFETY_FACTOR_PRESETS[3];
    expect(p.id).toBe('public_transport');
    expect(p.value).toBeCloseTo(1.67, 10);
    expect(p.label).toBe('Transport public (× 1.67)');
    expect(p.description).toBe('Atterrissage public transport avec piste humide / glissante.');
  });

  it('les valeurs sont croissantes et ≥ 1 (aucune marge « réductrice »)', () => {
    const values = SAFETY_FACTOR_PRESETS.map(p => p.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    values.forEach(v => expect(v).toBeGreaterThanOrEqual(1));
  });

  it('chaque préréglage porte id / value / label / description', () => {
    SAFETY_FACTOR_PRESETS.forEach(p => {
      expect(typeof p.id).toBe('string');
      expect(typeof p.value).toBe('number');
      expect(typeof p.label).toBe('string');
      expect(typeof p.description).toBe('string');
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('SAFETY_FACTOR_BY_ID / DEFAULT_SAFETY_FACTOR — index et défaut', () => {
  it('indexe les 4 préréglages par id (mêmes objets, pas des copies)', () => {
    expect(Object.keys(SAFETY_FACTOR_BY_ID)).toEqual([
      'raw',
      'vfr_private',
      'ifr_cat_easa',
      'public_transport',
    ]);
    SAFETY_FACTOR_PRESETS.forEach(p => {
      expect(SAFETY_FACTOR_BY_ID[p.id]).toBe(p);
    });
  });

  it('le défaut est le premier préréglage : brut MANEX × 1.0', () => {
    expect(DEFAULT_SAFETY_FACTOR).toBe(SAFETY_FACTOR_PRESETS[0]);
    expect(DEFAULT_SAFETY_FACTOR).toBe(SAFETY_FACTOR_BY_ID.raw);
    expect(DEFAULT_SAFETY_FACTOR.id).toBe('raw');
    expect(DEFAULT_SAFETY_FACTOR.value).toBeCloseTo(1.0, 10);
  });

  it("l'index est un objet nu qui HÉRITE d'Object.prototype (pas de null-prototype)", () => {
    // Figé tel quel : c'est ce qui rend getSafetyFactor('constructor') parasite.
    expect(Object.getPrototypeOf(SAFETY_FACTOR_BY_ID)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(SAFETY_FACTOR_BY_ID, 'constructor')).toBe(false);
    expect(SAFETY_FACTOR_BY_ID.constructor).toBe(Object);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('isDistanceOperation — quelles opérations acceptent une marge', () => {
  it('toutes les opérations « distance » du catalogue → true', () => {
    OPS_DISTANCE.forEach(id => {
      expect(isDistanceOperation(id), id).toBe(true);
    });
  });

  it('les opérations héritées (volets non précisés) restent éligibles', () => {
    expect(isDistanceOperation('takeoff_ground_roll')).toBe(true);
    expect(isDistanceOperation('takeoff_50ft')).toBe(true);
  });

  it('vitesses, taux et angles de montée → false (ne se multiplient pas)', () => {
    OPS_NON_DISTANCE.forEach(id => {
      expect(isDistanceOperation(id), id).toBe(false);
    });
  });

  it('une opération à sorties MIXTES (ROC ou gradient) → false via every()', () => {
    // climb_takeoff accepte rate_of_climb ET climb_gradient : aucune n'est
    // 'distance', donc every() est faux.
    expect(isDistanceOperation('climb_takeoff')).toBe(false);
  });

  it('id inconnu / mal orthographié → false (aucune exception)', () => {
    expect(isDistanceOperation('takeof_groundroll')).toBe(false);
    expect(isDistanceOperation('TAKEOFF_50FT')).toBe(false); // sensible à la casse
    expect(isDistanceOperation('takeoff_50ft ')).toBe(false); // espace parasite
    expect(isDistanceOperation('landing_50ft')).toBe(false); // id sans variante volets
    expect(isDistanceOperation('inexistant')).toBe(false);
  });

  it('entrée absente / nulle / vide / NaN → false', () => {
    expect(isDistanceOperation(undefined)).toBe(false);
    expect(isDistanceOperation(null)).toBe(false);
    expect(isDistanceOperation('')).toBe(false);
    expect(isDistanceOperation(0)).toBe(false);
    expect(isDistanceOperation(NaN)).toBe(false);
    expect(isDistanceOperation(false)).toBe(false);
  });

  it('types non-chaîne non falsy → false (pas de coercition)', () => {
    expect(isDistanceOperation(42)).toBe(false);
    expect(isDistanceOperation({ id: 'takeoff_50ft' })).toBe(false);
    expect(isDistanceOperation(['takeoff_50ft'])).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('applySafetyFactor — application nominale (valeurs exactes)', () => {
  it('VFR privé × 1.15 sur une distance de décollage', () => {
    expect(applySafetyFactor(500, 'takeoff_50ft_flaps_to', 1.15)).toBeCloseTo(575, 6);
    expect(applySafetyFactor(300, 'takeoff_ground_roll_flaps_up', 1.15)).toBeCloseTo(345, 6);
  });

  it('IFR / CAT EASA × 1.43 sur une distance d\'atterrissage', () => {
    expect(applySafetyFactor(500, 'landing_50ft_flaps_landing', 1.43)).toBeCloseTo(715, 6);
    expect(applySafetyFactor(420, 'landing_ground_roll_flaps_landing', 1.43)).toBeCloseTo(600.6, 6);
  });

  it('Transport public × 1.67 sur une distance d\'atterrissage', () => {
    expect(applySafetyFactor(500, 'landing_50ft_flaps_landing', 1.67)).toBeCloseTo(835, 6);
    expect(applySafetyFactor(650, 'landing_50ft_flaps_up', 1.67)).toBeCloseTo(1085.5, 6);
  });

  it('multiplication brute : AUCUN arrondi, aucun plafond de piste', () => {
    const r = applySafetyFactor(333, 'takeoff_50ft_flaps_to', 1.15);
    expect(r).toBeCloseTo(382.95, 6);
    expect(Number.isInteger(r)).toBe(false); // pas de Math.round / Math.ceil
    expect(applySafetyFactor(1234.5, 'takeoff_50ft', 1.15)).toBeCloseTo(1419.675, 6);
  });

  it('s\'applique à TOUTES les opérations de distance du catalogue', () => {
    OPS_DISTANCE.forEach(id => {
      expect(applySafetyFactor(1000, id, 1.15), id).toBeCloseTo(1150, 6);
    });
  });

  it('facteur arbitraire hors préréglages : accepté tel quel', () => {
    expect(applySafetyFactor(1000, 'takeoff_50ft', 2)).toBeCloseTo(2000, 6);
    expect(applySafetyFactor(1000, 'takeoff_50ft', 1.0001)).toBeCloseTo(1000.1, 6);
  });

  it('0 mètre reste 0 (pas de plancher)', () => {
    expect(applySafetyFactor(0, 'takeoff_50ft', 1.43)).toBe(0);
  });

  it('distance NÉGATIVE : multipliée aussi (devient PLUS négative)', () => {
    // Aucune garde de signe : -100 × 1.15 = -115.
    expect(applySafetyFactor(-100, 'takeoff_50ft', 1.15)).toBeCloseTo(-115, 6);
  });

  it('facteur démesuré : débordement silencieux vers Infinity', () => {
    expect(applySafetyFactor(1e308, 'takeoff_50ft', 10)).toBe(Infinity);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('applySafetyFactor — replis SILENCIEUX sur la valeur brute (⚠️ risque de sous-estimation)', () => {
  it('opération NON-distance → valeur brute inchangée', () => {
    OPS_NON_DISTANCE.forEach(id => {
      expect(applySafetyFactor(700, id, 1.43), id).toBe(700);
    });
  });

  it('operationId inconnu ou mal orthographié → brut, SANS erreur ni signal', () => {
    // ⚠️ Une faute de frappe dans l'id fait disparaître la marge en silence.
    expect(applySafetyFactor(500, 'takeof_groundroll', 1.43)).toBe(500);
    expect(applySafetyFactor(500, 'landing_50ft', 1.67)).toBe(500);
    expect(applySafetyFactor(500, undefined, 1.43)).toBe(500);
    expect(applySafetyFactor(500, null, 1.43)).toBe(500);
    expect(applySafetyFactor(500, '', 1.43)).toBe(500);
  });

  it('facteur exactement 1 → brut (no-op documenté)', () => {
    expect(applySafetyFactor(500, 'takeoff_50ft', 1)).toBe(500);
    expect(applySafetyFactor(500, 'takeoff_50ft', 1.0)).toBe(500);
  });

  it('facteur < 1 → IGNORÉ, brut renvoyé (aucune distance réduite)', () => {
    expect(applySafetyFactor(500, 'takeoff_50ft', 0.9)).toBe(500);
    expect(applySafetyFactor(500, 'takeoff_50ft', 0)).toBe(500);
    expect(applySafetyFactor(500, 'takeoff_50ft', -1.15)).toBe(500);
  });

  it('facteur absent / NaN / Infinity → brut, SANS erreur', () => {
    // ⚠️ Le pilote croit avoir une marge, il obtient la valeur MANEX nue.
    expect(applySafetyFactor(500, 'takeoff_50ft', undefined)).toBe(500);
    expect(applySafetyFactor(500, 'takeoff_50ft', null)).toBe(500);
    expect(applySafetyFactor(500, 'takeoff_50ft', NaN)).toBe(500);
    expect(applySafetyFactor(500, 'takeoff_50ft', Infinity)).toBe(500);
    expect(applySafetyFactor(500, 'takeoff_50ft')).toBe(500); // argument omis
  });

  it('facteur passé en CHAÎNE "1.43" → brut (aucune coercition)', () => {
    // ⚠️ Un facteur venant d'un <input> non converti annule la marge en silence.
    expect(applySafetyFactor(500, 'takeoff_50ft', '1.43')).toBe(500);
    expect(applySafetyFactor(500, 'takeoff_50ft', '1.15')).toBe(500);
  });

  it('rawValue non numérique → renvoyé TEL QUEL (identité, pas de NaN fabriqué)', () => {
    expect(applySafetyFactor(undefined, 'takeoff_50ft', 1.43)).toBeUndefined();
    expect(applySafetyFactor(null, 'takeoff_50ft', 1.43)).toBeNull();
    expect(applySafetyFactor('500', 'takeoff_50ft', 1.43)).toBe('500');
    expect(applySafetyFactor('', 'takeoff_50ft', 1.43)).toBe('');
    expect(applySafetyFactor(false, 'takeoff_50ft', 1.43)).toBe(false);
    const obj = { d: 500 };
    expect(applySafetyFactor(obj, 'takeoff_50ft', 1.43)).toBe(obj);
  });

  it('rawValue NaN / Infinity → ressort tel quel, non marqué', () => {
    expect(applySafetyFactor(NaN, 'takeoff_50ft', 1.43)).toBeNaN();
    expect(applySafetyFactor(Infinity, 'takeoff_50ft', 1.43)).toBe(Infinity);
    expect(applySafetyFactor(-Infinity, 'takeoff_50ft', 1.43)).toBe(-Infinity);
  });

  it('ordre des gardes : rawValue invalide court-circuite AVANT l\'opération', () => {
    // Même avec un id d'opération inconnu, un rawValue invalide sort en premier
    // — dans les deux cas le résultat est le brut, aucune distinction possible.
    expect(applySafetyFactor(NaN, 'inexistant', NaN)).toBeNaN();
  });

  it('aucun des replis ne LÈVE d\'exception', () => {
    expect(() => applySafetyFactor(undefined, undefined, undefined)).not.toThrow();
    expect(() => applySafetyFactor(500, 42, 'x')).not.toThrow();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('getSafetyFactor — récupération d\'un préréglage par id', () => {
  it('chaque id connu renvoie SON préréglage (même référence)', () => {
    expect(getSafetyFactor('raw')).toBe(SAFETY_FACTOR_PRESETS[0]);
    expect(getSafetyFactor('vfr_private')).toBe(SAFETY_FACTOR_PRESETS[1]);
    expect(getSafetyFactor('ifr_cat_easa')).toBe(SAFETY_FACTOR_PRESETS[2]);
    expect(getSafetyFactor('public_transport')).toBe(SAFETY_FACTOR_PRESETS[3]);
  });

  it('valeurs numériques récupérées par id', () => {
    expect(getSafetyFactor('vfr_private').value).toBeCloseTo(1.15, 10);
    expect(getSafetyFactor('ifr_cat_easa').value).toBeCloseTo(1.43, 10);
    expect(getSafetyFactor('public_transport').value).toBeCloseTo(1.67, 10);
  });

  it('id inconnu → repli sur le défaut (brut × 1.0)', () => {
    expect(getSafetyFactor('inexistant')).toBe(DEFAULT_SAFETY_FACTOR);
    expect(getSafetyFactor('VFR_PRIVATE')).toBe(DEFAULT_SAFETY_FACTOR); // casse
    expect(getSafetyFactor('vfr privé')).toBe(DEFAULT_SAFETY_FACTOR);
  });

  it('entrée absente / nulle / vide → défaut', () => {
    expect(getSafetyFactor(undefined)).toBe(DEFAULT_SAFETY_FACTOR);
    expect(getSafetyFactor(null)).toBe(DEFAULT_SAFETY_FACTOR);
    expect(getSafetyFactor('')).toBe(DEFAULT_SAFETY_FACTOR);
    expect(getSafetyFactor(0)).toBe(DEFAULT_SAFETY_FACTOR);
    expect(getSafetyFactor(NaN)).toBe(DEFAULT_SAFETY_FACTOR);
  });

  it('⚠️ clés héritées d\'Object : renvoient un objet PARASITE, pas le défaut', () => {
    // SAFETY_FACTOR_BY_ID['constructor'] est truthy (Object.prototype),
    // donc le `||` ne déclenche PAS le repli.
    expect(getSafetyFactor('constructor')).toBe(Object);
    expect(getSafetyFactor('constructor')).not.toBe(DEFAULT_SAFETY_FACTOR);
    expect(getSafetyFactor('toString')).toBe(Object.prototype.toString);
    expect(getSafetyFactor('valueOf')).toBe(Object.prototype.valueOf);
    expect(getSafetyFactor('__proto__')).toBe(Object.prototype);
  });

  it('⚠️ le préréglage parasite a `value === undefined` → marge annulée en aval', () => {
    const parasite = getSafetyFactor('constructor');
    expect(parasite.value).toBeUndefined();
    // Enchaîné dans applySafetyFactor : facteur undefined → distance brute.
    expect(applySafetyFactor(500, 'takeoff_50ft', parasite.value)).toBe(500);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('chaîne bout-en-bout : préréglage → application à une distance', () => {
  const DISTANCE_BRUTE = 640; // m, sortie MANEX d'un abaque de décollage

  it('« raw » ne change rien à la distance', () => {
    const f = getSafetyFactor('raw').value;
    expect(applySafetyFactor(DISTANCE_BRUTE, 'takeoff_50ft_flaps_to', f)).toBe(640);
  });

  it('« vfr_private » : 640 m → 736 m', () => {
    const f = getSafetyFactor('vfr_private').value;
    expect(applySafetyFactor(DISTANCE_BRUTE, 'takeoff_50ft_flaps_to', f)).toBeCloseTo(736, 6);
  });

  it('« ifr_cat_easa » : 640 m → 915.2 m', () => {
    const f = getSafetyFactor('ifr_cat_easa').value;
    expect(applySafetyFactor(DISTANCE_BRUTE, 'landing_50ft_flaps_landing', f)).toBeCloseTo(915.2, 6);
  });

  it('« public_transport » : 640 m → 1068.8 m', () => {
    const f = getSafetyFactor('public_transport').value;
    expect(applySafetyFactor(DISTANCE_BRUTE, 'landing_50ft_flaps_landing', f)).toBeCloseTo(1068.8, 6);
  });

  it('un id de préréglage inconnu retombe sur « raw » → distance NON majorée', () => {
    // ⚠️ Chemin complet du risque : préréglage perdu (id renommé/absent en DB)
    // → facteur 1.0 → la distance affichée est la brute, sans avertissement.
    const f = getSafetyFactor('vfr_prive_typo').value;
    expect(f).toBeCloseTo(1.0, 10);
    expect(applySafetyFactor(DISTANCE_BRUTE, 'takeoff_50ft_flaps_to', f)).toBe(640);
  });

  it('un préréglage de distance appliqué à une montée reste inchangé', () => {
    const f = getSafetyFactor('public_transport').value;
    expect(applySafetyFactor(700, 'climb_takeoff', f)).toBe(700); // ft/min
    expect(applySafetyFactor(110, 'cruise_speed', f)).toBe(110);  // kt
  });
});
