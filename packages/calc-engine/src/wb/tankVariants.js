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

// ─────────────────────────────────────────────────────────────────────────────
// 🎭 RÔLES — LE RÔLE APPARTIENT À LA CONFIGURATION, PAS AU RÉSERVOIR
// (refonte 24/08/2026, demande pilote : « il n'est plus utile de marquer si
// c'est un type principal ou optionnel quand je déclare les réservoirs ; c'est
// lorsque je crée les variantes que je dis si c'est principal, optionnel,
// annexe. Sinon ça ne veut plus rien dire. »)
//
// POURQUOI. Le catalogue décrit ce que la CELLULE peut recevoir : un volume,
// un bras, un moment. « Principal » n'y a pas de sens — le même réservoir peut
// être principal dans une configuration et annexe dans une autre. Le rôle est
// une propriété de l'INSTALLATION, donc de la configuration.
//
// FORME. Une variante porte désormais tanks: [{ id, role }]. Le tableau
// tankIds est conservé en MIROIR dérivé (écrit par sanitizeTankVariants) : les
// fiches déjà en base, les imports communautaires et tout code non encore
// migré continuent de fonctionner à l'identique. On n'enlève rien, on enrichit.
//
// AUCUNE MIGRATION EN BASE. Les champs type / optional des 13 fiches restent
// en place : ils sont le DERNIER repli de lecture. Un champ qu'on ne sait plus
// écrire mais qu'on sait encore lire ne gêne personne ; l'effacer avant que
// les rôles soient saisis, si.
// ─────────────────────────────────────────────────────────────────────────────

/** Les 3 rôles qu'un réservoir peut tenir DANS une configuration. */
export const TANK_ROLES = [
  { value: 'main',     label: 'Principal' },
  { value: 'aux',      label: 'Annexe' },
  { value: 'optional', label: 'Optionnel (amovible)' }
];

/** Types legacy du catalogue traduits en rôle. 'wing' et '' n'en portent AUCUN :
 *  une aile n'est ni principale ni annexe en soi — la configuration le dit. */
const ROLE_FROM_LEGACY_TYPE = { main: 'main', aux: 'aux', optional: 'optional', tip: 'optional' };

/**
 * ENTRÉES D'UNE VARIANTE — point d'entrée UNIQUE : [{ id, role }].
 * Lit `tanks` s'il existe, sinon dérive de `tankIds` (rôle inconnu).
 * Aucun autre code ne doit lire tankIds/tanks directement.
 */
export const variantEntries = (variant) => {
  if (Array.isArray(variant?.tanks)) {
    return variant.tanks
      .filter(e => e && e.id !== undefined && e.id !== null)
      .map(e => ({ id: String(e.id), role: e.role || undefined }));
  }
  return (Array.isArray(variant?.tankIds) ? variant.tankIds : [])
    .map(id => ({ id: String(id), role: undefined }));
};

/**
 * RÔLE D'UN RÉSERVOIR DANS UNE CONFIGURATION — ordre de résolution, du plus
 * explicite au plus ancien. Le premier qui répond gagne ; aucun n'invente.
 *   1. rôle déclaré dans la variante (la vérité neuve) ;
 *   2. variante à UN SEUL réservoir → il est forcément le principal (rien
 *      d'autre ne peut l'être ; même règle que singleFuelArm dans fuelArm.js) ;
 *   3. type legacy du catalogue, traduit (fiches non encore migrées) ;
 *   4. undefined — rôle INCONNU, jamais un rôle par défaut.
 */
const roleFromVariant = (aircraft, variantId, tank, index) => {
  const variant = variantsOf(aircraft).find(v => v?.id === variantId);
  if (!variant) return undefined;
  const key = tankKey(tank, index);
  const entries = variantEntries(variant);
  const mine = entries.find(e => e.id === key);
  if (mine?.role) return mine.role;
  // Configuration à UN SEUL réservoir : il est forcément le principal.
  if (entries.length === 1 && mine) return 'main';
  return undefined;
};

export const resolveTankRole = (aircraft, variantId, tank, index) =>
  roleFromVariant(aircraft, variantId, tank, index)
  ?? ROLE_FROM_LEGACY_TYPE[tank?.type]
  ?? undefined;

/** Réservoir PRINCIPAL d'une configuration, ou null. Jamais un repli sur le
 *  premier réservoir venu : sans rôle principal, il n'y a pas de principal. */
export const variantMainTank = (aircraft, variantId) => {
  const tanks = poolOf(aircraft);
  const variant = variantsOf(aircraft).find(v => v?.id === variantId);
  const keys = variant ? new Set(variantEntries(variant).map(e => e.id)) : null;
  for (let i = 0; i < tanks.length; i++) {
    if (resolveTankRole(aircraft, variantId, tanks[i], i) !== 'main') continue;
    // Le réservoir doit AUSSI appartenir à la configuration.
    if (!keys || keys.has(tankKey(tanks[i], i))) return tanks[i];
  }
  return null;
};

/** Réservoir principal de la configuration PAR DÉFAUT (celle de la fiche). */
export const defaultVariantMainTank = (aircraft) =>
  variantMainTank(aircraft, getDefaultVariantId(aircraft));

/**
 * Le réservoir est-il AMOVIBLE dans cette configuration ?
 * ORDRE IMPÉRATIF : un rôle connu tranche SEUL ; le repli legacy ne sert que
 * si la configuration ne dit rien — sinon un vieux `optional: true` du
 * catalogue contredirait le rôle que le pilote vient de poser.
 */
export const isTankRemovable = (aircraft, variantId, tank, index) => {
  // SEUL un rôle venu de la CONFIGURATION tranche. Un rôle DÉDUIT du `type`
  // legacy ne suffit pas : dans l'ancien modèle, le booléen `optional` primait
  // sur le type (`optional ?? typeInclut`), et deux fiches de la flotte en
  // dépendent — F-GGZO et F-GOFP portent type: 'optional' AVEC optional: false,
  // c'est-à-dire « ce réservoir n'est pas amovible, quoi qu'en dise son type ».
  // Faire trancher le type traduit inverserait leur réponse en silence.
  const role = roleFromVariant(aircraft, variantId, tank, index);
  if (role === 'optional') return true;
  if (role) return false;
  return tank?.optional ?? ['aux', 'optional', 'tip'].includes(tank?.type);
};


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
  const wanted = new Set(variantEntries(variant).map(e => e.id));
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
  // Une variante peut porter `tanks` (forme neuve, avec rôles) OU `tankIds`
  // (forme historique) : variantEntries lit les deux. Une variante qui ne
  // porte NI l'un NI l'autre ne s'applique pas — avion inchangé.
  if (!variant || (!Array.isArray(variant.tanks) && !Array.isArray(variant.tankIds))) return aircraft;

  const allTanks = Array.isArray(aircraft.additionalFuelTanks) ? aircraft.additionalFuelTanks : [];
  const wanted = new Set(variantEntries(variant).map(e => e.id));
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
    .map(v => {
      // Forme canonique : tanks[{id, role}]. Les entrées pointant un réservoir
      // supprimé du catalogue disparaissent (UNE passe, pas de récursion).
      const entries = variantEntries(v)
        .filter(e => validKeys.has(e.id))
        .map(e => ({ id: e.id, ...(e.role ? { role: e.role } : {}) }));

      // UN SEUL principal par configuration : le premier gagne, les suivants
      // sont dégradés en annexe (même politique que isDefault ci-dessous).
      // Deux principaux rendraient arbitraire le choix de arms.fuelMain.
      let mainSeen = false;
      const withRoles = entries.map(e => {
        if (e.role !== 'main') return e;
        if (mainSeen) return { ...e, role: 'aux' };
        mainSeen = true;
        return e;
      });

      return {
        id: v.id ?? `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: v.name.trim(),
        isDefault: !!v.isDefault,
        tanks: withRoles,
        // MIROIR dérivé : conservé pour les lecteurs non migrés, les fiches
        // déjà en base et l'import communautaire. Jamais la source de vérité.
        tankIds: withRoles.map(e => e.id)
      };
    })
    .filter(v => v.tanks.length > 0);

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
