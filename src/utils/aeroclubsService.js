/**
 * Aeroclubs service — merges the static FFA aeroclub database with
 * user-added entries persisted in localStorage.
 *
 * The static file (src/data/aeroclubsFR.json) is bundled at build time.
 * User additions live in localStorage under USER_AEROCLUBS_KEY and are merged
 * back into the catalog on every read.
 *
 * Public API:
 *   getAllAeroclubs()             -> Array of merged aeroclubs
 *   addUserAeroclub(aeroclub)     -> Persists a new entry, returns updated list
 *   searchAeroclubs(query, opts)  -> Filtered list for autocomplete UIs
 *   removeUserAeroclub(name)      -> Removes a user-added entry by name
 *   isUserEntry(aeroclub)         -> True if entry was added by the user
 */

import staticData from '../data/aeroclubsFR.json';

const USER_AEROCLUBS_KEY = 'alflight_user_aeroclubs';

// Normalize text for fuzzy match (lowercase, strip accents, collapse spaces)
const normalize = (str = '') =>
  str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Load user-added aeroclubs from localStorage.
 * Returns [] on parse error or when nothing is stored.
 */
const loadUserAeroclubs = () => {
  try {
    const raw = localStorage.getItem(USER_AEROCLUBS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[aeroclubsService] Failed to load user aeroclubs:', err);
    return [];
  }
};

const saveUserAeroclubs = (list) => {
  try {
    localStorage.setItem(USER_AEROCLUBS_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    console.error('[aeroclubsService] Failed to save user aeroclubs:', err);
    return false;
  }
};

/**
 * Returns the merged catalog: static FFA entries + user-added ones.
 * User entries get an `_userAdded: true` flag so the UI can mark them.
 */
export const getAllAeroclubs = () => {
  const staticList = (staticData?.aeroclubs || []).map((a) => ({
    ...a,
    _userAdded: false
  }));
  const userList = loadUserAeroclubs().map((a) => ({
    ...a,
    _userAdded: true
  }));

  // De-duplicate by normalized name (user entries override static ones)
  const byName = new Map();
  for (const entry of staticList) {
    byName.set(normalize(entry.name), entry);
  }
  for (const entry of userList) {
    byName.set(normalize(entry.name), entry);
  }

  return Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
  );
};

/**
 * Persist a new aeroclub. Returns the updated full list.
 * Required: name. Optional: icao, city, region.
 */
export const addUserAeroclub = (aeroclub) => {
  if (!aeroclub || !aeroclub.name || !aeroclub.name.trim()) {
    throw new Error("Le nom de l'aéroclub est requis");
  }

  const normalized = {
    name: aeroclub.name.trim(),
    icao: (aeroclub.icao || '').toUpperCase().trim() || undefined,
    city: (aeroclub.city || '').trim() || undefined,
    region: (aeroclub.region || '').trim() || undefined,
    addedAt: new Date().toISOString()
  };

  const current = loadUserAeroclubs();
  const existingIndex = current.findIndex(
    (a) => normalize(a.name) === normalize(normalized.name)
  );

  if (existingIndex >= 0) {
    // Update existing user entry
    current[existingIndex] = { ...current[existingIndex], ...normalized };
  } else {
    current.push(normalized);
  }

  saveUserAeroclubs(current);
  return getAllAeroclubs();
};

/**
 * Remove a user-added aeroclub by name. Static entries cannot be removed.
 * Returns the updated full list.
 */
export const removeUserAeroclub = (name) => {
  const current = loadUserAeroclubs();
  const filtered = current.filter(
    (a) => normalize(a.name) !== normalize(name)
  );
  saveUserAeroclubs(filtered);
  return getAllAeroclubs();
};

/**
 * True if the given aeroclub name corresponds to a user-added entry.
 */
export const isUserEntry = (aeroclubOrName) => {
  const name =
    typeof aeroclubOrName === 'string' ? aeroclubOrName : aeroclubOrName?.name;
  if (!name) return false;
  const userList = loadUserAeroclubs();
  return userList.some((a) => normalize(a.name) === normalize(name));
};

/**
 * Search the merged catalog for a query string. Matches against:
 *   - name
 *   - icao
 *   - city
 *   - region
 *
 * Options:
 *   - limit (default 50): maximum number of results
 */
export const searchAeroclubs = (query = '', options = {}) => {
  const { limit = 50 } = options;
  const all = getAllAeroclubs();
  const q = normalize(query);

  if (!q) {
    return all.slice(0, limit);
  }

  const scored = [];
  for (const entry of all) {
    const name = normalize(entry.name);
    const icao = normalize(entry.icao);
    const city = normalize(entry.city);
    const region = normalize(entry.region);

    let score = 0;
    if (name.startsWith(q)) score += 100;
    else if (name.includes(q)) score += 50;

    if (icao && icao.startsWith(q)) score += 80;
    else if (icao && icao.includes(q)) score += 30;

    if (city && city.startsWith(q)) score += 40;
    else if (city && city.includes(q)) score += 20;

    if (region && region.includes(q)) score += 10;

    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
};

/**
 * Metadata helper — returns counts for diagnostics.
 */
export const getAeroclubsStats = () => {
  const userCount = loadUserAeroclubs().length;
  const staticCount = (staticData?.aeroclubs || []).length;
  return {
    static: staticCount,
    user: userCount,
    total: getAllAeroclubs().length,
    version: staticData?._meta?.version || 'unknown'
  };
};

export default {
  getAllAeroclubs,
  addUserAeroclub,
  removeUserAeroclub,
  isUserEntry,
  searchAeroclubs,
  getAeroclubsStats
};
