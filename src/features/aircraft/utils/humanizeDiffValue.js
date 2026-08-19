// src/features/aircraft/utils/humanizeDiffValue.js
//
// 🔎 AFFICHAGE LISIBLE DES VALEURS DU RÉCAPITULATIF (17/08/2026).
//
// Le tableau « ce qui change » de l'étape Synthèse affichait « [object Object] »
// pour tout tableau d'objets (réservoirs, variantes, limites de vent…) :
// `array.join(', ')` appelle toString() sur chaque élément. Le pilote validait
// une publication sans pouvoir lire CE qu'il modifiait.
//
// Ici : chaque structure connue de la fiche avion se décrit en français, avec
// ses vraies valeurs. Une structure inconnue tombe sur un résumé générique de
// ses champs simples — jamais un JSON brut ni un [object Object].

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};
const fmt = (v) => {
  const n = num(v);
  if (n === null) return String(v);
  return Number.isInteger(n) ? String(n) : n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
};

/** Décrit UN objet selon sa forme (réservoir, variante, limite de vent…). */
function humanizeObject(value) {
  if (value === null || value === undefined) return 'non défini';

  // Réservoir : { name, type, totalCapacity/usableCapacity/capacity, arm }
  if (value.arm !== undefined || value.totalCapacity !== undefined || value.usableCapacity !== undefined || value.capacity !== undefined) {
    const parts = [];
    const total = num(value.totalCapacity);
    const usable = num(value.usableCapacity) ?? num(value.capacity);
    if (total !== null) parts.push(`total ${fmt(total)} L`);
    if (usable !== null) parts.push(`utilisable ${fmt(usable)} L`);
    if (num(value.arm) !== null) parts.push(`bras ${fmt(value.arm)} m`);
    if (num(value.maxWeight) !== null) parts.push(`maxi ${fmt(value.maxWeight)} kg`);
    const nom = value.name || (value.type === 'main' ? 'Réservoir principal' : 'Élément');
    return parts.length ? `${nom} (${parts.join(', ')})` : nom;
  }

  // Variante de réservoirs : { name, isDefault, tankIds }
  if (Array.isArray(value.tankIds)) {
    const n = value.tankIds.length;
    return `${value.name || 'Variante'}${value.isDefault ? ' (par défaut)' : ''} — ${n} réservoir${n > 1 ? 's' : ''} coché${n > 1 ? 's' : ''}`;
  }

  // Plage VO : { minWeight, maxWeight, speed }
  if (value.speed !== undefined && (value.minWeight !== undefined || value.maxWeight !== undefined)) {
    return `${fmt(value.minWeight)}–${fmt(value.maxWeight)} kg → VA ${fmt(value.speed)} kt`;
  }

  // Limite de vent : { type, value }
  if (value.type !== undefined && value.value !== undefined) {
    const libelles = {
      maxCrosswind: 'vent traversier maxi', maxTailwind: 'vent arrière maxi',
      maxCrosswindWet: 'traversier maxi piste mouillée',
    };
    return `${libelles[value.type] || value.type} : ${fmt(value.value)} kt`;
  }

  // Photo / manuel : jamais leur contenu.
  if (value.data || value.url || value.base64) return 'photo présente';
  if (value.fileName || value.fileUrl || value.pdfData) return `document présent${value.fileName ? ` (${value.fileName})` : ''}`;

  // Générique : les champs simples, en clair, bornés.
  const entries = Object.entries(value)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object' && typeof v !== 'function')
    .slice(0, 6)
    .map(([k, v]) => `${k} : ${typeof v === 'boolean' ? (v ? 'oui' : 'non') : fmt(v)}`);
  return entries.length ? entries.join(', ') : 'objet vide';
}

/**
 * Valeur → texte lisible pour le tableau des différences.
 * Tableaux : chaque élément décrit, séparés par « · ».
 */
export function humanizeDiffValue(value) {
  if (value === null || value === undefined || value === '') return null; // l'appelant affiche « Non défini »
  if (Array.isArray(value)) {
    if (value.length === 0) return 'liste vide';
    const items = value.map((v) => (typeof v === 'object' ? humanizeObject(v) : String(v)));
    return items.join('  ·  ');
  }
  if (typeof value === 'object') return humanizeObject(value);
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  return String(value);
}
