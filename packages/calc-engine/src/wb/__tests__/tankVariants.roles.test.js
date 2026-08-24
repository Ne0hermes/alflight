// packages/calc-engine/src/wb/__tests__/tankVariants.roles.test.js
//
// 🎭 LE RÔLE APPARTIENT À LA CONFIGURATION (refonte 24/08/2026, demande pilote :
// « il n'est plus utile de marquer si c'est un type principal ou optionnel quand
// je déclare les réservoirs ; c'est lorsque je crée les variantes que je dis si
// c'est principal, optionnel, annexe »).
//
// Ce test verrouille la NON-RÉGRESSION sur les formes réellement présentes dans
// la flotte : les 13 fiches en base portent encore leur `type` / `optional` de
// catalogue, et aucune n'a été migrée. Le nouveau code doit leur répondre
// EXACTEMENT comme l'ancien — sauf là où l'amélioration est voulue et nommée.

import { describe, it, expect } from 'vitest';
import {
  TANK_ROLES,
  variantEntries,
  resolveTankRole,
  variantMainTank,
  defaultVariantMainTank,
  isTankRemovable,
  ensureDefaultVariant,
  getDefaultVariantId,
  sanitizeTankVariants
} from '../tankVariants.js';

const tank = (id, name, extra = {}) => ({ id, name, arm: 1, ...extra });

describe('vocabulaire des rôles', () => {
  it('trois rôles, aucune position (la position vit dans le nom)', () => {
    expect(TANK_ROLES.map(r => r.value)).toEqual(['main', 'aux', 'optional']);
  });
});

describe('variantEntries — point d’entrée unique', () => {
  it('lit la forme neuve `tanks` avec ses rôles', () => {
    expect(variantEntries({ tanks: [{ id: 'a', role: 'main' }, { id: 'b' }] }))
      .toEqual([{ id: 'a', role: 'main' }, { id: 'b', role: undefined }]);
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

describe('résolution du rôle — ordre du plus explicite au plus ancien', () => {
  it('1. le rôle déclaré dans la configuration gagne sur le type legacy', () => {
    const a = {
      additionalFuelTanks: [tank('t1', 'Aile', { type: 'main' }), tank('t2', 'Long range')],
      tankVariants: [{ id: 'v1', isDefault: true, tanks: [{ id: 't1', role: 'aux' }, { id: 't2', role: 'main' }] }]
    };
    expect(resolveTankRole(a, 'v1', a.additionalFuelTanks[0], 0)).toBe('aux');
    expect(defaultVariantMainTank(a).name).toBe('Long range');
  });

  it('2. configuration à UN seul réservoir : il est forcément le principal', () => {
    // Forme F-HSTR : un réservoir unique de type 'wing', aucun 'main' déclaré.
    // AMÉLIORATION ASSUMÉE — l'ancien code ne trouvait aucun principal et
    // n'alimentait donc jamais arms.fuelMain depuis le réservoir. La valeur
    // n'en bouge pas pour autant (F-HSTR portait déjà 2,63, le bras du seul
    // réservoir) : on entretient désormais un miroir qui était figé.
    const a = ensureDefaultVariant({
      additionalFuelTanks: [tank('t1', 'Réservoir aile 1', { type: 'wing', arm: 2.63 })]
    });
    expect(defaultVariantMainTank(a)?.arm).toBe(2.63);
  });

  it('3. à défaut, le type legacy du catalogue est traduit', () => {
    const a = {
      additionalFuelTanks: [tank('t1', 'Principal', { type: 'main' }), tank('t2', 'Aux', { type: 'aux' })],
      tankVariants: [{ id: 'v1', isDefault: true, tankIds: ['t1', 't2'] }]
    };
    expect(resolveTankRole(a, 'v1', a.additionalFuelTanks[0], 0)).toBe('main');
    expect(resolveTankRole(a, 'v1', a.additionalFuelTanks[1], 1)).toBe('aux');
  });

  it('4. rien de tout cela : rôle INCONNU, jamais un rôle par défaut', () => {
    const a = {
      additionalFuelTanks: [tank('t1', 'A', { type: 'wing' }), tank('t2', 'B', { type: 'wing' })],
      tankVariants: [{ id: 'v1', isDefault: true, tankIds: ['t1', 't2'] }]
    };
    expect(resolveTankRole(a, 'v1', a.additionalFuelTanks[0], 0)).toBeUndefined();
    expect(defaultVariantMainTank(a)).toBeNull();
  });
});

describe('un même réservoir tient des rôles différents selon la configuration', () => {
  // C'est le cœur de la demande pilote : « sinon ça ne veut plus rien dire ».
  const a = {
    additionalFuelTanks: [tank('t1', 'Standard'), tank('t2', 'Long range')],
    tankVariants: [
      { id: 'court', isDefault: true, tanks: [{ id: 't1', role: 'main' }] },
      { id: 'long', tanks: [{ id: 't1', role: 'aux' }, { id: 't2', role: 'main' }] }
    ]
  };

  it('principal en configuration courte, annexe en configuration longue', () => {
    expect(variantMainTank(a, 'court').name).toBe('Standard');
    expect(variantMainTank(a, 'long').name).toBe('Long range');
    expect(resolveTankRole(a, 'long', a.additionalFuelTanks[0], 0)).toBe('aux');
  });

  it('un réservoir absent de la configuration n’en est jamais le principal', () => {
    // t2 porte le rôle 'main' dans « long » mais n'appartient pas à « court ».
    expect(variantMainTank(a, 'court').id).toBe('t1');
  });
});

describe('amovibilité — le booléen explicite du catalogue reste prioritaire', () => {
  it('type "optional" AVEC optional:false → NON amovible (formes F-GGZO et F-GOFP)', () => {
    // RÉGRESSION ÉVITÉE : faire trancher le type traduit inverserait la réponse
    // de deux fiches de la flotte, qui disent « ce réservoir n'est pas amovible,
    // quoi qu'en dise son type ». Seul un rôle venu de la CONFIGURATION tranche.
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
      tankVariants: [{ id: 'v1', isDefault: true, tanks: [{ id: 't1', role: 'main' }, { id: 't2', role: 'optional' }] }]
    };
    expect(isTankRemovable(a, 'v1', a.additionalFuelTanks[1], 1)).toBe(true);
    expect(isTankRemovable(a, 'v1', a.additionalFuelTanks[0], 0)).toBe(false);
  });
});

describe('sanitizeTankVariants — forme canonique et garde-fous', () => {
  const tanks = [tank('t1', 'A'), tank('t2', 'B'), tank('t3', 'C')];

  it('normalise vers `tanks` et écrit `tankIds` en miroir dérivé', () => {
    const out = sanitizeTankVariants(
      [{ id: 'v1', name: 'Standard', isDefault: true, tanks: [{ id: 't1', role: 'main' }, { id: 't2' }] }],
      tanks
    );
    expect(out[0].tanks).toEqual([{ id: 't1', role: 'main' }, { id: 't2' }]);
    expect(out[0].tankIds).toEqual(['t1', 't2']);
  });

  it('UN SEUL principal par configuration : le suivant est dégradé en annexe', () => {
    const out = sanitizeTankVariants(
      [{ id: 'v1', name: 'X', isDefault: true, tanks: [{ id: 't1', role: 'main' }, { id: 't2', role: 'main' }] }],
      tanks
    );
    expect(out[0].tanks).toEqual([{ id: 't1', role: 'main' }, { id: 't2', role: 'aux' }]);
  });

  it('une entrée pointant un réservoir supprimé du catalogue disparaît', () => {
    const out = sanitizeTankVariants(
      [{ id: 'v1', name: 'X', isDefault: true, tanks: [{ id: 't1', role: 'main' }, { id: 'disparu', role: 'aux' }] }],
      tanks
    );
    expect(out[0].tanks).toEqual([{ id: 't1', role: 'main' }]);
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
