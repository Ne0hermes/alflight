// src/utils/tankVariants.js
// Variantes de réservoirs (Lot 5) — ex. « Standard » vs « Long Range ».
//
// MODÈLE : aircraft.tankVariants = [
//   { id: 'v-...', name: 'Standard', isDefault: true, tankIds: ['12345', ...] }
// ]
// Les variantes RÉFÉRENCENT les réservoirs de aircraft.additionalFuelTanks par
// id (String) — aucune duplication de capacité/bras : la double écriture a déjà
// produit des bugs de persistance dans ce code (cf. FIX 2026-06 du wizard).
//
// RÉTRO-COMPATIBILITÉ : tankVariants absent/vide, ou variante introuvable →
// l'avion est retourné TEL QUEL (même référence d'objet) : les avions sans
// variantes gardent un comportement strictement identique.

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

/**
 * AVION EFFECTIF : applique la variante choisie — additionalFuelTanks filtrés
 * aux réservoirs de la variante, fuelCapacity recalculée (somme des capacités
 * filtrées). Retourne l'avion INCHANGÉ (même référence) si la variante ne
 * s'applique pas.
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

  const fuelCapacity = filteredTanks.reduce((s, t) => s + (parseFloat(t?.capacity) || 0), 0);

  return {
    ...aircraft,
    additionalFuelTanks: filteredTanks,
    fuelCapacity,
    // Capacité utile plafonnée à la capacité de la variante (si renseignée)
    fuelUsableCapacity: Number.isFinite(parseFloat(aircraft.fuelUsableCapacity))
      ? Math.min(parseFloat(aircraft.fuelUsableCapacity), fuelCapacity)
      : aircraft.fuelUsableCapacity,
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
