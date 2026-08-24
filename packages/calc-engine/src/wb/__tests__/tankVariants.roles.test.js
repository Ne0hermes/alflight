// packages/calc-engine/src/wb/__tests__/tankVariants.roles.test.js
//
// 🎭 LE RÔLE APPARTIENT À LA CONFIGURATION (refonte 24/08/2026, demande pilote).
//
// DEUX rôles seulement, après fusion le même jour : « Principal » et « Annexe »
// ne portaient aucune information exploitable — un réservoir d'aile qui ne se
// démonte pas remplit le même office qu'un principal central. Ce qui compte
// tient en une question : ce réservoir est-il TOUJOURS à bord ?
//
//   • inamovible (fixed)     → porte la capacité annoncée de la configuration ;
//   • amovible   (removable) → compté À PART, jamais dans le total annoncé.
//
// Ce test verrouille la NON-RÉGRESSION sur les formes réellement en base : les
// 13 fiches portent encore leur `type` / `optional` de catalogue, aucune n'a été
// migrée. Le nouveau code doit leur répondre comme l'ancien.

import { describe, it, expect } from 'vitest';
import {
  TANK_ROLES,
  variantEntries,
  resolveTankRole,
  variantFixedTanks,
  defaultVariantFixedTank,
  fixedTanksArm,
  fixedTanksMoment,
  variantCapacityBreakdown,
  isTankRemovable,
  ensureDefaultVariant,
  getDefaultVariantId,
  sanitizeTankVariants
} from '../tankVariants.js';

const tank = (id, name, extra = {}) => ({ id, name, arm: 1, ...extra });

describe('vocabulaire des rôles', () => {
  it('deux rôles : inamovible et amovible', () => {
    expect(TANK_ROLES.map(r => r.value)).toEqual(['fixed', 'removable']);
    expect(TANK_ROLES.map(r => r.label)).toEqual(['Inamovible', 'Amovible']);
  });
});

describe('variantEntries — point d’entrée unique', () => {
  it('lit la forme neuve `tanks` avec ses rôles', () => {
    expect(variantEntries({ tanks: [{ id: 'a', role: 'fixed' }, { id: 'b' }] }))
      .toEqual([{ id: 'a', role: 'fixed' }, { id: 'b', role: undefined }]);
  });

  it('dérive de `tankIds` (forme historique) avec un rôle inconnu', () => {
    expect(variantEntries({ tankIds: ['a', 'b'] }))
      .toEqual([{ id: 'a', role: undefined }, { id: 'b', role: undefined }]);
  });

  it('une variante sans rien rend une liste vide, jamais undefined', () => {
    expect(variantEntries({})).toEqual([]);
    expect(variantEntries(null)).toEqual([]);
  });
});

describe('résolution du rôle', () => {
  it('le rôle de la configuration gagne sur le type legacy', () => {
    const a = {
      additionalFuelTanks: [tank('t1', 'Aile', { type: 'main' })],
      tankVariants: [{ id: 'v1', isDefault: true, tanks: [{ id: 't1', role: 'removable' }, { id: 't2' }] }]
    };
    expect(resolveTankRole(a, 'v1', a.additionalFuelTanks[0], 0)).toBe('removable');
  });

  it('relit les rôles de la version éphémère à 3 rôles (main/aux → fixed)', () => {
    const a = {
      additionalFuelTanks: [tank('t1', 'A'), tank('t2', 'B'), tank('t3', 'C')],
      tankVariants: [{ id: 'v1', isDefault: true, tanks: [
        { id: 't1', role: 'main' }, { id: 't2', role: 'aux' }, { id: 't3', role: 'optional' }
      ] }]
    };
    expect(resolveTankRole(a, 'v1', a.additionalFuelTanks[0], 0)).toBe('fixed');
    expect(resolveTankRole(a, 'v1', a.additionalFuelTanks[1], 1)).toBe('fixed');
    expect(resolveTankRole(a, 'v1', a.additionalFuelTanks[2], 2)).toBe('removable');
  });

  it('configuration à UN seul réservoir : il est forcément à bord', () => {
    // Forme F-HSTR : un réservoir unique de type 'wing'. AMÉLIORATION ASSUMÉE —
    // l'ancien code n'y voyait aucun principal et n'alimentait jamais
    // arms.fuelMain. La valeur ne bouge pas (2,63 y était déjà).
    const a = ensureDefaultVariant({
      additionalFuelTanks: [tank('t1', 'Réservoir aile 1', { type: 'wing', arm: 2.63 })]
    });
    expect(defaultVariantFixedTank(a)?.arm).toBe(2.63);
  });

  it('types legacy traduits : main et aux → inamovible, optional et tip → amovible', () => {
    const a = {
      additionalFuelTanks: [
        tank('t1', 'A', { type: 'main' }), tank('t2', 'B', { type: 'aux' }),
        tank('t3', 'C', { type: 'optional' }), tank('t4', 'D', { type: 'tip' })
      ],
      tankVariants: [{ id: 'v1', isDefault: true, tankIds: ['t1', 't2', 't3', 't4'] }]
    };
    const r = (i) => resolveTankRole(a, 'v1', a.additionalFuelTanks[i], i);
    expect([r(0), r(1), r(2), r(3)]).toEqual(['fixed', 'fixed', 'removable', 'removable']);
  });

  it('sans rôle ni type exploitable : INCONNU, jamais un rôle par défaut', () => {
    const a = {
      additionalFuelTanks: [tank('t1', 'A', { type: 'wing' }), tank('t2', 'B', { type: 'wing' })],
      tankVariants: [{ id: 'v1', isDefault: true, tankIds: ['t1', 't2'] }]
    };
    expect(resolveTankRole(a, 'v1', a.additionalFuelTanks[0], 0)).toBeUndefined();
    expect(defaultVariantFixedTank(a)).toBeNull();
  });
});

describe('PLUSIEURS réservoirs inamovibles — le cas F-HFGI', () => {
  // Un principal central + deux réservoirs d'aile qui ne se démontent pas, plus
  // un optionnel montable. Les trois premiers sont inamovibles.
  const flotte = {
    additionalFuelTanks: [
      tank('c', 'Central', { arm: 1.10, totalCapacity: 110, usableCapacity: 109, momentAtFull: 120 }),
      tank('g', 'Aile gauche', { arm: 1.10, totalCapacity: 40, usableCapacity: 40, momentAtFull: 44 }),
      tank('d', 'Aile droite', { arm: 1.10, totalCapacity: 40, usableCapacity: 40, momentAtFull: 44 }),
      tank('o', 'Convoyage', { arm: 1.80, totalCapacity: 50, usableCapacity: 50, momentAtFull: 90 })
    ],
    tankVariants: [{ id: 'v1', name: 'Standard', isDefault: true, tanks: [
      { id: 'c', role: 'fixed' }, { id: 'g', role: 'fixed' },
      { id: 'd', role: 'fixed' }, { id: 'o', role: 'removable' }
    ] }]
  };

  it('trois inamovibles coexistent — aucun n’est dégradé', () => {
    expect(variantFixedTanks(flotte, 'v1').map(t => t.name))
      .toEqual(['Central', 'Aile gauche', 'Aile droite']);
  });

  it('bras unique quand tous les inamovibles le partagent', () => {
    expect(fixedTanksArm(flotte, 'v1')).toBe(1.10);
    // Moment = SOMME des inamovibles (ils sont pleins ensemble).
    expect(fixedTanksMoment(flotte, 'v1')).toBe(208);
  });

  it('bras DIFFÉRENTS → aucun bras, jamais une moyenne', () => {
    const a = {
      ...flotte,
      additionalFuelTanks: [
        { ...flotte.additionalFuelTanks[0], arm: 1.10 },
        { ...flotte.additionalFuelTanks[1], arm: 1.45 },
        flotte.additionalFuelTanks[2], flotte.additionalFuelTanks[3]
      ]
    };
    expect(fixedTanksArm(a, 'v1')).toBeNull();
    expect(fixedTanksMoment(a, 'v1')).toBeNull();
  });

  it('le total annoncé EXCLUT l’amovible, qui est compté à part', () => {
    const r = variantCapacityBreakdown(flotte, 'v1');
    expect(r.base).toEqual({ totalLtr: 190, usableLtr: 189 });
    expect(r.options).toEqual({ count: 1, totalLtr: 50, usableLtr: 50 });
  });

  it('un volume manquant sur un inamovible vide la base, sans somme partielle', () => {
    const a = {
      ...flotte,
      additionalFuelTanks: [
        { id: 'c', name: 'Central', arm: 1.1 }, // aucun volume
        ...flotte.additionalFuelTanks.slice(1)
      ]
    };
    expect(variantCapacityBreakdown(a, 'v1').base).toEqual({ totalLtr: null, usableLtr: null });
  });
});

describe('un même réservoir change de rôle selon la configuration', () => {
  const a = {
    additionalFuelTanks: [tank('t1', 'Standard'), tank('t2', 'Long range')],
    tankVariants: [
      { id: 'court', isDefault: true, tanks: [{ id: 't1', role: 'fixed' }] },
      { id: 'long', tanks: [{ id: 't1', role: 'fixed' }, { id: 't2', role: 'removable' }] }
    ]
  };

  it('inamovible partout, l’autre amovible seulement en configuration longue', () => {
    expect(variantFixedTanks(a, 'court').map(t => t.name)).toEqual(['Standard']);
    expect(variantFixedTanks(a, 'long').map(t => t.name)).toEqual(['Standard']);
    expect(isTankRemovable(a, 'long', a.additionalFuelTanks[1], 1)).toBe(true);
  });

  it('un réservoir absent de la configuration n’y tient aucun rôle', () => {
    expect(variantFixedTanks(a, 'court').map(t => t.id)).toEqual(['t1']);
  });
});

describe('amovibilité — le booléen explicite du catalogue reste prioritaire', () => {
  it('type "optional" AVEC optional:false → NON amovible (formes F-GGZO et F-GOFP)', () => {
    // RÉGRESSION ÉVITÉE : seul un rôle venu de la CONFIGURATION tranche. Deux
    // fiches de la flotte disent « pas amovible, quoi qu'en dise le type ».
    const a = {
      additionalFuelTanks: [
        tank('t1', 'Aile standard', { type: 'main', optional: false }),
        tank('t2', 'Aile long range', { type: 'optional', optional: false })
      ],
      tankVariants: [{ id: 'v1', isDefault: true, tankIds: ['t1'] }]
    };
    expect(isTankRemovable(a, 'v1', a.additionalFuelTanks[1], 1)).toBe(false);
  });

  it('type "tip" sans booléen → amovible (repli legacy inchangé)', () => {
    const a = { additionalFuelTanks: [tank('t1', 'Tip', { type: 'tip' })], tankVariants: [] };
    expect(isTankRemovable(a, null, a.additionalFuelTanks[0], 0)).toBe(true);
  });

  it('un rôle posé dans la configuration prime sur le catalogue', () => {
    const a = {
      additionalFuelTanks: [tank('t1', 'A'), tank('t2', 'B', { optional: false })],
      tankVariants: [{ id: 'v1', isDefault: true, tanks: [{ id: 't1', role: 'fixed' }, { id: 't2', role: 'removable' }] }]
    };
    expect(isTankRemovable(a, 'v1', a.additionalFuelTanks[1], 1)).toBe(true);
    expect(isTankRemovable(a, 'v1', a.additionalFuelTanks[0], 0)).toBe(false);
  });
});

describe('sanitizeTankVariants', () => {
  const tanks = [tank('t1', 'A'), tank('t2', 'B'), tank('t3', 'C')];

  it('normalise vers `tanks` et écrit `tankIds` en miroir dérivé', () => {
    const out = sanitizeTankVariants(
      [{ id: 'v1', name: 'Standard', isDefault: true, tanks: [{ id: 't1', role: 'fixed' }, { id: 't2' }] }],
      tanks
    );
    expect(out[0].tanks).toEqual([{ id: 't1', role: 'fixed' }, { id: 't2' }]);
    expect(out[0].tankIds).toEqual(['t1', 't2']);
  });

  it('PLUSIEURS inamovibles sont conservés — plus aucune dégradation', () => {
    const out = sanitizeTankVariants(
      [{ id: 'v1', name: 'X', isDefault: true, tanks: [{ id: 't1', role: 'fixed' }, { id: 't2', role: 'fixed' }] }],
      tanks
    );
    expect(out[0].tanks).toEqual([{ id: 't1', role: 'fixed' }, { id: 't2', role: 'fixed' }]);
  });

  it('une entrée pointant un réservoir supprimé du catalogue disparaît', () => {
    const out = sanitizeTankVariants(
      [{ id: 'v1', name: 'X', isDefault: true, tanks: [{ id: 't1', role: 'fixed' }, { id: 'disparu', role: 'removable' }] }],
      tanks
    );
    expect(out[0].tanks).toEqual([{ id: 't1', role: 'fixed' }]);
    expect(out[0].tankIds).toEqual(['t1']);
  });

  it('une configuration historique (tankIds seuls) traverse sans perte', () => {
    const out = sanitizeTankVariants([{ id: 'v1', name: 'Legacy', isDefault: true, tankIds: ['t1', 't3'] }], tanks);
    expect(out[0].tanks).toEqual([{ id: 't1' }, { id: 't3' }]);
    expect(out[0].tankIds).toEqual(['t1', 't3']);
  });
});

describe('fiches sans configuration déclarée', () => {
  it('ensureDefaultVariant matérialise une configuration couvrant tout le catalogue', () => {
    const a = ensureDefaultVariant({ additionalFuelTanks: [tank('t1', 'A'), tank('t2', 'B')] });
    expect(variantEntries(a.tankVariants[0]).map(e => e.id)).toEqual(['t1', 't2']);
    expect(getDefaultVariantId(a)).toBeTruthy();
  });
});
