// Refonte 23/08/2026 — CATALOGUE de réservoirs vs CONFIGURATIONS (variantes).
//
// Règle métier : `additionalFuelTanks` est le catalogue des réservoirs que la
// cellule peut recevoir (dont des réservoirs qui S'EXCLUENT) ; il n'est JAMAIS
// sommé pour donner la capacité de l'avion. La capacité vient de la
// configuration PAR DÉFAUT (fiche avion) ou CHOISIE (préparation de vol).
//
// Les fixtures reproduisent l'état réel de la flotte au 23/08/2026 : trois
// fiches dont la capacité racine est la somme (fausse) du catalogue, une fiche
// correcte à préserver, une fiche sans configuration à migrer.
import { describe, it, expect } from 'vitest';
import {
  ensureDefaultVariant,
  variantCapacities,
  defaultVariantCapacities,
  variantTanks,
  getDefaultVariantId,
  applyTankVariant,
  DEFAULT_VARIANT_ID,
  DEFAULT_VARIANT_NAME
} from '../tankVariants.js';

// ───────────────────────── Fixtures « flotte réelle » ─────────────────────────

// F-GOFP (Cessna F152) — catalogue 98 L + 147 L, deux configurations exclusives
// (98 L standard / 142 L grande capacité). Racine EN BASE = 235 (93 + 142),
// somme du catalogue : c'est le bug signalé par le pilote.
const F_GOFP = {
  registration: 'F-GOFP',
  fuelCapacity: 235,
  fuelUsableCapacity: 93,
  additionalFuelTanks: [
    { id: 'gofp-std', name: 'Réservoir principal', type: 'main', capacity: 93, totalCapacity: 98, usableCapacity: 93, arm: 1.08 },
    { id: 'gofp-gc', name: 'Réservoir grande capacité', capacity: 142, totalCapacity: 147, usableCapacity: 142, arm: 0.7, optional: true }
  ],
  tankVariants: [
    { id: 'v-98', name: 'Variante 98L', isDefault: true, tankIds: ['gofp-std'] },
    { id: 'v-142', name: 'Variante 142L', isDefault: false, tankIds: ['gofp-gc'] }
  ]
};

// F-GGZO — racine 189 = 152 + 37 (anciens `capacity` des deux réservoirs
// exclusifs), alors que les configurations valent 163 L et 204 L.
const F_GGZO = {
  registration: 'F-GGZO',
  fuelCapacity: 189,
  fuelUsableCapacity: 141,
  additionalFuelTanks: [
    { id: 'ggzo-std', name: 'Réservoirs standard', capacity: 152, totalCapacity: 163, usableCapacity: 152, arm: 2.41 },
    { id: 'ggzo-lr', name: 'Réservoirs longue distance', capacity: 37, totalCapacity: 204, usableCapacity: 189, arm: 2.41, optional: true }
  ],
  tankVariants: [
    { id: 'v-163', name: 'Variante 163L', isDefault: true, tankIds: ['ggzo-std'] },
    { id: 'v-204', name: 'Variante 204L', isDefault: false, tankIds: ['ggzo-lr'] }
  ]
};

// F-BXNG — fiche CORRECTE : racine = configuration par défaut (98 / 85).
// Comportement à préserver strictement.
const F_BXNG = {
  registration: 'F-BXNG',
  fuelCapacity: 98,
  fuelUsableCapacity: 85,
  additionalFuelTanks: [
    { id: 'bxng-std', name: "Réservoir d'aile Standard", capacity: 98, totalCapacity: 98, usableCapacity: 85, arm: 1.07 },
    { id: 'bxng-lr', name: "Réservoir d'aile Long Range", totalCapacity: 144, usableCapacity: 132.5, arm: 1.07, optional: true }
  ],
  tankVariants: [
    { id: 'v-98', name: 'Variante 98L', isDefault: true, tankIds: ['bxng-std'] },
    { id: 'v-144', name: 'Variante 144L', isDefault: false, tankIds: ['bxng-lr'] }
  ]
};

// F-HFGI — 3 réservoirs, AUCUNE configuration : tous installés ensemble
// (Σ 241 L total / 240 L utilisable ; la racine 240/239 est antérieure au
// modèle deux-contenances).
const F_HFGI = {
  registration: 'F-HFGI',
  fuelCapacity: 240,
  fuelUsableCapacity: 239,
  additionalFuelTanks: [
    { id: 'hfgi-g', name: 'Aile gauche', totalCapacity: 95, usableCapacity: 95, arm: 2.2 },
    { id: 'hfgi-d', name: 'Aile droite', totalCapacity: 95, usableCapacity: 95, arm: 2.2 },
    { id: 'hfgi-opt', name: 'Réservoir optionnel', totalCapacity: 51, usableCapacity: 50, arm: 2.4, optional: true }
  ]
};

// ───────────────────────────── ensureDefaultVariant ───────────────────────────

describe('ensureDefaultVariant — matérialise « Configuration standard »', () => {
  it('avion avec réservoirs et SANS variante : crée une configuration par défaut couvrant TOUT le catalogue', () => {
    const migrated = ensureDefaultVariant(F_HFGI);
    expect(migrated).not.toBe(F_HFGI);
    expect(migrated.tankVariants).toHaveLength(1);
    const [v] = migrated.tankVariants;
    expect(v.id).toBe(DEFAULT_VARIANT_ID);
    expect(v.name).toBe(DEFAULT_VARIANT_NAME);
    expect(v.isDefault).toBe(true);
    expect(v.tankIds).toEqual(['hfgi-g', 'hfgi-d', 'hfgi-opt']);
    // Aucune capacité inventée : le catalogue n'est pas touché
    expect(migrated.additionalFuelTanks).toBe(F_HFGI.additionalFuelTanks);
    expect(migrated.fuelCapacity).toBe(240);
  });

  it('avion ayant DÉJÀ une variante : strictement inchangé (même référence)', () => {
    expect(ensureDefaultVariant(F_GOFP)).toBe(F_GOFP);
    expect(ensureDefaultVariant(F_BXNG)).toBe(F_BXNG);
  });

  it('idempotente : une seconde application ne change plus rien', () => {
    const once = ensureDefaultVariant(F_HFGI);
    expect(ensureDefaultVariant(once)).toBe(once);
  });

  it('catalogue vide / avion absent : inchangé, aucune variante fantôme', () => {
    const noTanks = { registration: 'F-XXXX', additionalFuelTanks: [] };
    expect(ensureDefaultVariant(noTanks)).toBe(noTanks);
    const noField = { registration: 'F-XXXX' };
    expect(ensureDefaultVariant(noField)).toBe(noField);
    expect(ensureDefaultVariant(null)).toBeNull();
    expect(ensureDefaultVariant(undefined)).toBeUndefined();
  });

  it('réservoirs SANS id : référence par index (convention fuelStore)', () => {
    const ac = { additionalFuelTanks: [{ totalCapacity: 100 }, { totalCapacity: 50 }] };
    expect(ensureDefaultVariant(ac).tankVariants[0].tankIds).toEqual(['0', '1']);
  });
});

// ───────────────────────────── variantCapacities ──────────────────────────────

describe('variantCapacities — deux contenances, jamais un zéro fabriqué', () => {
  it('rend le TOTAL et l’UTILISABLE de la configuration', () => {
    expect(variantCapacities(F_GOFP, 'v-98')).toEqual({ totalLtr: 98, usableLtr: 93 });
    expect(variantCapacities(F_GOFP, 'v-142')).toEqual({ totalLtr: 147, usableLtr: 142 });
    expect(variantCapacities(F_GGZO, 'v-163')).toEqual({ totalLtr: 163, usableLtr: 152 });
    expect(variantCapacities(F_GGZO, 'v-204')).toEqual({ totalLtr: 204, usableLtr: 189 });
  });

  it('somme les réservoirs d’une configuration multi-réservoirs', () => {
    const migrated = ensureDefaultVariant(F_HFGI);
    expect(variantCapacities(migrated, DEFAULT_VARIANT_ID)).toEqual({ totalLtr: 241, usableLtr: 240 });
  });

  it('un réservoir sans contenance TOTALE → totalLtr null (utilisable conservé)', () => {
    const ac = {
      additionalFuelTanks: [
        { id: 'a', totalCapacity: 98, usableCapacity: 85 },
        { id: 'b', usableCapacity: 40 }   // total inconnu : jamais déduit
      ],
      tankVariants: [{ id: 'v', name: 'Les deux', isDefault: true, tankIds: ['a', 'b'] }]
    };
    expect(variantCapacities(ac, 'v')).toEqual({ totalLtr: null, usableLtr: 125 });
  });

  it('un réservoir sans UTILISABLE (ni legacy capacity) → usableLtr null', () => {
    const ac = {
      additionalFuelTanks: [
        { id: 'a', totalCapacity: 98, usableCapacity: 85 },
        { id: 'b', totalCapacity: 40 }
      ],
      tankVariants: [{ id: 'v', name: 'Les deux', isDefault: true, tankIds: ['a', 'b'] }]
    };
    expect(variantCapacities(ac, 'v')).toEqual({ totalLtr: 138, usableLtr: null });
  });

  it('legacy : l’ancien champ `capacity` sert des DEUX contenances', () => {
    const ac = {
      additionalFuelTanks: [{ id: 'a', capacity: 110 }],
      tankVariants: [{ id: 'v', name: 'Std', isDefault: true, tankIds: ['a'] }]
    };
    expect(variantCapacities(ac, 'v')).toEqual({ totalLtr: 110, usableLtr: 110 });
  });

  it('variante inconnue ou vide → null/null (pas de repli sur le catalogue)', () => {
    expect(variantCapacities(F_GOFP, 'v-inexistante')).toEqual({ totalLtr: null, usableLtr: null });
    const vide = { ...F_GOFP, tankVariants: [{ id: 'v-vide', name: 'Vide', tankIds: [] }] };
    expect(variantCapacities(vide, 'v-vide')).toEqual({ totalLtr: null, usableLtr: null });
  });

  it('variantTanks rend les réservoirs sélectionnés dans l’ordre du catalogue', () => {
    expect(variantTanks(F_GOFP, 'v-142').map(t => t.id)).toEqual(['gofp-gc']);
    expect(variantTanks(F_GOFP, 'v-inexistante')).toEqual([]);
  });
});

// ──────────────────────── defaultVariantCapacities (cas réels) ────────────────

describe('defaultVariantCapacities — la capacité de l’avion vient de la config par défaut', () => {
  it('F-GOFP : 98 L total / 93 L utilisables — PAS les 235 L du catalogue', () => {
    const caps = defaultVariantCapacities(F_GOFP);
    expect(caps).toEqual({ totalLtr: 98, usableLtr: 93 });
    expect(caps.totalLtr).not.toBe(235);
    // La racine EN BASE reste fausse tant que la fiche n'est pas ré-enregistrée
    expect(F_GOFP.fuelCapacity).toBe(235);
  });

  it('F-GGZO : 163 L total / 152 L utilisables — PAS les 189 L du catalogue', () => {
    expect(defaultVariantCapacities(F_GGZO)).toEqual({ totalLtr: 163, usableLtr: 152 });
  });

  it('F-BXNG : 98 / 85 — la fiche correcte est INCHANGÉE', () => {
    const caps = defaultVariantCapacities(F_BXNG);
    expect(caps).toEqual({ totalLtr: 98, usableLtr: 85 });
    expect(caps.totalLtr).toBe(F_BXNG.fuelCapacity);
    expect(caps.usableLtr).toBe(F_BXNG.fuelUsableCapacity);
  });

  it('F-HFGI (sans configuration) : tout le catalogue, 241 / 240 — avant comme après migration', () => {
    expect(defaultVariantCapacities(F_HFGI)).toEqual({ totalLtr: 241, usableLtr: 240 });
    expect(defaultVariantCapacities(ensureDefaultVariant(F_HFGI))).toEqual({ totalLtr: 241, usableLtr: 240 });
  });

  it('sans réservoir ni variante : null/null (aucune capacité fabriquée)', () => {
    expect(defaultVariantCapacities({})).toEqual({ totalLtr: null, usableLtr: null });
    expect(defaultVariantCapacities(null)).toEqual({ totalLtr: null, usableLtr: null });
  });
});

// ─────────────────────── cohérence avec le chemin « en vol » ──────────────────

describe('applyTankVariant reste la source de vérité en vol', () => {
  it('la variante choisie filtre le catalogue et pose SES capacités', () => {
    const eff = applyTankVariant(F_GOFP, 'v-142');
    expect(eff.additionalFuelTanks.map(t => t.id)).toEqual(['gofp-gc']);
    expect(eff.fuelCapacity).toBe(147);
    expect(eff.fuelUsableCapacity).toBe(142);
    expect(eff._tankVariantId).toBe('v-142');
  });

  it('la variante PAR DÉFAUT en vol donne les mêmes capacités que la fiche avion', () => {
    const eff = applyTankVariant(F_GOFP, getDefaultVariantId(F_GOFP));
    const caps = defaultVariantCapacities(F_GOFP);
    expect(eff.fuelCapacity).toBe(caps.totalLtr);
    expect(eff.fuelUsableCapacity).toBe(caps.usableLtr);
  });

  it('configuration couvrant TOUT le catalogue : avion inchangé (identité) — ses capacités SONT celles du catalogue', () => {
    const migrated = ensureDefaultVariant(F_HFGI);
    expect(applyTankVariant(migrated, DEFAULT_VARIANT_ID)).toBe(migrated);
    // et la fiche avion écrira bien 241/240 à la racine
    expect(defaultVariantCapacities(migrated)).toEqual({ totalLtr: 241, usableLtr: 240 });
  });
});
