// ============================================================================
//  src/utils/runwaySurface.js
//  Normalisation et compatibilité des SURFACES de piste.
//  ----------------------------------------------------------------------------
//  Problème résolu : les composants comparaient la surface de piste à la liste
//  de l'avion par égalité STRICTE de chaîne (`includes`). Or les données réelles
//  (SIA/OpenAIP) contiennent des valeurs absentes du formulaire avion :
//    - surfaces COMBINÉES : "CONC+ASPH", "ASPH/GRASS"
//    - synonymes : "MACADAM", "BITUM", "TARMAC", "BETON", "HERBE"…
//  → tout ressortait « incompatible » à tort (faux négatif).
//
//  Ici : on normalise vers quelques FAMILLES canoniques. Tous les revêtements
//  durs (asphalte, béton, bitume, macadam…) sont assimilés à 'PAVED' : un avion
//  compatible avec un revêtement dur l'est avec les autres revêtements durs.
// ============================================================================

// Familles canoniques et leurs alias (toujours comparés en MAJUSCULES).
const SURFACE_FAMILIES = {
  PAVED: ['ASPH', 'ASPHALT', 'ASPHALTE', 'ASP', 'CONC', 'CONCRETE', 'BETON', 'BÉTON',
          'BITUM', 'BITUMINOUS', 'BITUMINEUX', 'MACADAM', 'TARMAC', 'PEM', 'PAVED',
          'HARD', 'DUR', 'REVÊTU', 'REVETU'],
  GRASS:  ['GRASS', 'TURF', 'HERBE', 'GAZON', 'GRS', 'GRS+'],
  GRAVEL: ['GRVL', 'GRAVEL', 'GRAVIER', 'GRAVE'],
  UNPAVED:['UNPAVED', 'DIRT', 'EARTH', 'SOIL', 'TERRE', 'GROUND', 'NATURAL', 'NATUREL', 'NON REVÊTU'],
  SAND:   ['SAND', 'SABLE'],
  SNOW:   ['SNOW', 'NEIGE', 'ICE', 'GLACE'],
  WATER:  ['WATER', 'EAU'],
};

// Index alias -> famille (construit une fois).
const ALIAS_TO_FAMILY = Object.entries(SURFACE_FAMILIES).reduce((acc, [family, aliases]) => {
  aliases.forEach((a) => { acc[a] = family; });
  return acc;
}, {});

/**
 * Normalise une valeur de surface brute (piste OU avion) vers une famille
 * canonique ('PAVED' | 'GRASS' | 'GRAVEL' | 'UNPAVED' | 'SAND' | 'SNOW' | 'WATER').
 * Renvoie la valeur en MAJUSCULES telle quelle si inconnue, ou null si vide.
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeSurface(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).toUpperCase().trim();
  if (!s) return null;
  // Marqueurs « surface inconnue » → traités comme absence d'info (non bloquant).
  if (['UNKNOWN', 'UNK', 'INCONNU', 'INCONNUE', 'NON SPÉCIFIÉE', 'NON SPECIFIEE', 'N/A', 'NA', '?', '-'].includes(s)) return null;
  if (ALIAS_TO_FAMILY[s]) return ALIAS_TO_FAMILY[s];
  // Heuristique de secours pour valeurs non listées exactement
  if (/(ASPH|CONC|BITUM|MACADAM|TARMAC|BETON|BÉTON|PAVED|HARD|PEM)/.test(s)) return 'PAVED';
  if (/(GRASS|TURF|HERBE|GAZON)/.test(s)) return 'GRASS';
  if (/(GRAV)/.test(s)) return 'GRAVEL';
  if (/(DIRT|EARTH|SOIL|TERRE|UNPAV|NATUR)/.test(s)) return 'UNPAVED';
  return s; // inconnu : ne matchera que par égalité exacte
}

/**
 * Indique si une surface de piste est compatible avec les surfaces acceptées
 * par l'avion. Tolère les surfaces combinées ("CONC+ASPH") et les synonymes.
 *
 * Règles :
 *  - liste avion vide/absente → tout compatible (pas de contrainte).
 *  - surface piste inconnue/absente → compatible (données SIA souvent incomplètes,
 *    on n'exclut pas sur une donnée manquante).
 *  - surface combinée → compatible si AU MOINS UN composant correspond.
 *
 * @param {string} runwaySurfaceRaw  surface brute de la piste (ex. "CONC+ASPH")
 * @param {string[]} aircraftSurfaces  surfaces acceptées par l'avion (ex. ["ASPH","GRASS"])
 * @returns {boolean}
 */
export function isSurfaceCompatible(runwaySurfaceRaw, aircraftSurfaces) {
  if (!Array.isArray(aircraftSurfaces) || aircraftSurfaces.length === 0) return true;
  if (runwaySurfaceRaw === null || runwaySurfaceRaw === undefined || runwaySurfaceRaw === '') return true;

  const allowed = new Set(
    aircraftSurfaces.map(normalizeSurface).filter(Boolean)
  );
  if (allowed.size === 0) return true;

  // Surfaces combinées : "CONC+ASPH", "ASPH/GRASS", "ASPH, GRASS"…
  const parts = String(runwaySurfaceRaw)
    .split(/[+/,&]/)
    .map((p) => normalizeSurface(p))
    .filter(Boolean);

  if (parts.length === 0) return true; // surface non parsable → ne pas exclure
  return parts.some((p) => allowed.has(p));
}

export default { normalizeSurface, isSurfaceCompatible };
