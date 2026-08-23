// src/utils/tankVariants.js
// Variantes de réservoirs (Lot 5) — ex. « Standard » vs « Long Range ».
import { sumTotalLtr, sumUsableLtr, tankTotalLtr, tankUsableLtr } from '../fuel/tankCapacity.js';
//
// MODÈLE (refonte 23/08/2026, demande pilote) — DEUX niveaux distincts :
//
//   1. aircraft.additionalFuelTanks = le CATALOGUE des réservoirs que la
//      cellule peut recevoir. Ce pool n'est JAMAIS sommé pour donner la
//      capacité de l'avion : il contient des réservoirs qui s'EXCLUENT
//      (98 L standard OU 142 L longue distance). La somme du pool est un
//      nombre qui ne correspond à aucun avion réel — c'est elle qui a produit
//      le « 235 L » de F-GOFP (93 + 142) et le « 189 L » de F-GGZO (152 + 37).
//
//   2. aircraft.tankVariants = les CONFIGURATIONS réellement montables :
//        { id: 'v-...', name: 'Standard', isDefault: true, tankIds: ['12345', …] }
//      Une variante est une SÉLECTION de réservoirs du catalogue, pas un
//      réservoir. Les variantes RÉFÉRENCENT par id (String) — aucune
//      duplication de capacité/bras : la double écriture a déjà produit des
//      bugs de persistance dans ce code (cf. FIX 2026-06 du wizard).
//
// CAPACITÉ DE L'AVION = capacités de la variante PAR DÉFAUT (fiche avion) ou
// de la variante CHOISIE (préparation de vol) — cf. defaultVariantCapacities /
// variantCapacities / applyTankVariant. Jamais la somme du catalogue.
//
// RÉTRO-COMPATIBILITÉ : tankVariants absent/vide, ou variante introuvable →
// l'avion est retourné TEL QUEL (même référence d'objet) : les avions sans
// variantes gardent un comportement strictement identique. Les fiches sans
// variante sont recevables (tous les réservoirs déclarés sont installés
// ensemble) : ensureDefaultVariant leur en matérialise une, en mémoire.

// Clé canonique d'un réservoir — même convention que fuelStore (String(id ?? index))
export const tankKey = (tank, index) => String(tank?.id ?? index);

/** L'avion a-t-il des variantes ? (dès 1 : le sélecteur doit être VISIBLE,
 *  sinon une variante unique filtrerait les réservoirs sans aucun indice UI) */
export const hasTankVariants = (aircraft) =>
  Array.isArray(aircraft?.tankVariants) && aircraft.tankVariants.length >= 1;

/** Variante par défaut : isDefault, sinon la première. null sans variantes. */
export const getDefaultVariantId = (aircraft) => {
  const variants = Array.isArray(aircraft?.tankVariants) ? aircraft.tankVariants : [];
  if (variants.length === 0) return null;
  return (variants.find(v => v?.isDefault) || variants[0])?.id ?? null;
};

/** Nom et id de la configuration matérialisée par ensureDefaultVariant. */
export const DEFAULT_VARIANT_NAME = 'Configuration standard';
export const DEFAULT_VARIANT_ID = 'v-standard';

/** Réservoirs du catalogue (jamais undefined). */
const poolOf = (aircraft) =>
  (Array.isArray(aircraft?.additionalFuelTanks) ? aircraft.additionalFuelTanks : []);

/** Variantes déclarées (jamais undefined). */
const variantsOf = (aircraft) =>
  (Array.isArray(aircraft?.tankVariants) ? aircraft.tankVariants : []);

/**
 * MATÉRIALISE LA CONFIGURATION PAR DÉFAUT — un avion qui déclare des réservoirs
 * mais AUCUNE configuration signifie « tous les réservoirs déclarés sont
 * installés ensemble » (8 fiches de la flotte au 23/08). On rend cette lecture
 * EXPLICITE en créant « Configuration standard » (isDefault) qui les référence
 * tous : le reste de l'application n'a plus qu'un seul chemin de calcul —
 * la capacité vient TOUJOURS d'une configuration.
 *
 * PURE et IDEMPOTENTE : une variante déjà présente, un catalogue vide ou un
 * avion absent → même référence retournée, aucune capacité inventée.
 */
export const ensureDefaultVariant = (aircraft) => {
  if (!aircraft) return aircraft;
  const tanks = poolOf(aircraft);
  if (tanks.length === 0) return aircraft;               // rien à configurer
  if (variantsOf(aircraft).length > 0) return aircraft;  // déjà configuré
  return {
    ...aircraft,
    tankVariants: [{
      id: DEFAULT_VARIANT_ID,
      name: DEFAULT_VARIANT_NAME,
      isDefault: true,
      tankIds: tanks.map((t, i) => tankKey(t, i))
    }]
  };
};

/** Réservoirs du catalogue sélectionnés par une variante (ordre du catalogue).
 *  Variante inconnue → [] (l'appelant décide : jamais de repli silencieux sur
 *  le catalogue entier, qui re-sommerait des réservoirs exclusifs). */
export const variantTanks = (aircraft, variantId) => {
  const variant = variantsOf(aircraft).find(v => v?.id === variantId);
  if (!variant) return [];
  const wanted = new Set((Array.isArray(variant.tankIds) ? variant.tankIds : []).map(String));
  return poolOf(aircraft).filter((t, i) => wanted.has(tankKey(t, i)));
};

/** Somme STRICTE (fail-closed) : null dès qu'UN réservoir n'a pas la donnée —
 *  une capacité partielle serait plus dangereuse qu'une capacité absente
 *  (avitaillement ou autonomie sous-estimés sans le signaler). */
const strictSum = (tanks, pick) => {
  if (!Array.isArray(tanks) || tanks.length === 0) return null;
  let sum = 0;
  for (const t of tanks) {
    const v = pick(t);
    if (v === null || !Number.isFinite(v)) return null;
    sum += v;
  }
  return Math.round(sum * 100) / 100;
};

/**
 * CAPACITÉS D'UNE CONFIGURATION : { totalLtr, usableLtr }.
 *   • totalLtr   = Σ tankTotalLtr  (volume physique — avitaillement, doc)
 *   • usableLtr  = Σ tankUsableLtr (LA grandeur des moteurs — centrage, autonomie)
 * null si la variante est inconnue/vide ou si un seul réservoir manque la
 * donnée : on ne fabrique jamais un zéro ni une somme partielle.
 */
export const variantCapacities = (aircraft, variantId) => {
  const tanks = variantTanks(aircraft, variantId);
  return {
    totalLtr: strictSum(tanks, tankTotalLtr),
    usableLtr: strictSum(tanks, tankUsableLtr)
  };
};

/**
 * CAPACITÉS DE L'AVION = celles de sa configuration PAR DÉFAUT.
 * Compat : aucune variante déclarée → tout le catalogue (mêmes réservoirs que
 * ceux qu'ensureDefaultVariant regrouperait), pour que les fiches non migrées
 * rendent exactement la même valeur qu'après migration.
 */
export const defaultVariantCapacities = (aircraft) => {
  const variantId = getDefaultVariantId(aircraft);
  if (variantId) return variantCapacities(aircraft, variantId);
  const tanks = poolOf(aircraft);
  return {
    totalLtr: strictSum(tanks, tankTotalLtr),
    usableLtr: strictSum(tanks, tankUsableLtr)
  };
};

/**
 * AVION EFFECTIF : applique la variante choisie — additionalFuelTanks filtrés
 * aux réservoirs de la variante, fuelCapacity recalculée (somme des capacités
 * filtrées). Retourne l'avion INCHANGÉ (même référence) si la variante ne
 * s'applique pas.
 *
 * GARDE « variante couvrant tout le catalogue → avion inchangé » (l.↓) :
 * conservée volontairement. Dans ce cas la sélection = le catalogue entier,
 * donc les capacités de la variante SONT les sommes du catalogue — celles-là
 * mêmes que la fiche avion a écrites à la racine (defaultVariantCapacities).
 * Recalculer ne changerait aucune valeur mais casserait l'identité de
 * référence dont dépendent AircraftProvider (useMemo) et le contrat « avion
 * sans variantes = comportement strictement identique ».
 */
export const applyTankVariant = (aircraft, variantId) => {
  if (!aircraft || !variantId) return aircraft;
  const variants = Array.isArray(aircraft.tankVariants) ? aircraft.tankVariants : [];
  const variant = variants.find(v => v?.id === variantId);
  if (!variant || !Array.isArray(variant.tankIds)) return aircraft;

  const allTanks = Array.isArray(aircraft.additionalFuelTanks) ? aircraft.additionalFuelTanks : [];
  const wanted = new Set(variant.tankIds.map(String));
  const filteredTanks = allTanks.filter((t, i) => wanted.has(tankKey(t, i)));

  // Variante vide ou ne référençant plus aucun réservoir existant : ne rien
  // filtrer (fail-safe — un devis de masse sans aucun réservoir serait faux)
  if (filteredTanks.length === 0) return aircraft;
  // Variante couvrant tous les réservoirs : avion inchangé (identité préservée)
  if (filteredTanks.length === allTanks.length) return aircraft;

  // ⛽ DEUX sommes par configuration : le volume physique (documentation,
  // avitaillement) et l'utilisable (LA grandeur des moteurs). L'ancien
  // plafonnement min(usable, somme des capacity) mélangeait les deux
  // sémantiques ; chaque somme suit désormais son propre champ, avec repli
  // sur l'ancien `capacity` pour les fiches non migrées.
  const fuelCapacity = sumTotalLtr(filteredTanks) ?? 0;
  const fuelUsableCapacity = sumUsableLtr(filteredTanks) ?? aircraft.fuelUsableCapacity;

  return {
    ...aircraft,
    additionalFuelTanks: filteredTanks,
    fuelCapacity,
    fuelUsableCapacity,
    _tankVariantId: variantId
  };
};

/**
 * Assainit les variantes au SAVE du wizard avion : retire les références vers
 * des réservoirs supprimés, supprime les variantes vides, garantit un défaut.
 * Retourne un tableau (jamais undefined) — vide si aucune variante valide.
 */
export const sanitizeTankVariants = (tankVariants, additionalFuelTanks) => {
  const variants = Array.isArray(tankVariants) ? tankVariants : [];
  const tanks = Array.isArray(additionalFuelTanks) ? additionalFuelTanks : [];
  const validKeys = new Set(tanks.map((t, i) => tankKey(t, i)));

  const cleaned = variants
    .filter(v => v && typeof v.name === 'string' && v.name.trim() !== '')
    .map(v => ({
      id: v.id ?? `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: v.name.trim(),
      isDefault: !!v.isDefault,
      tankIds: (Array.isArray(v.tankIds) ? v.tankIds : []).map(String).filter(k => validKeys.has(k))
    }))
    .filter(v => v.tankIds.length > 0);

  // Exactement UN défaut : le premier isDefault gagne, les autres sont
  // dégradés (données importées/fusionnées pouvant en porter plusieurs)
  let defaultSeen = false;
  const singleDefault = cleaned.map(v => {
    if (v.isDefault) {
      if (defaultSeen) return { ...v, isDefault: false };
      defaultSeen = true;
    }
    return v;
  });
  if (singleDefault.length > 0 && !defaultSeen) {
    singleDefault[0] = { ...singleDefault[0], isDefault: true };
  }
  return singleDefault;
};
