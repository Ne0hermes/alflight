// src/services/terrainService.js
//
// Récupère l'altitude du TERRAIN (relief) le long d'une liste de points via
// l'API d'élévation open-meteo (gratuite, sans clé, modèle numérique de terrain
// ~90 m). Même fournisseur que les vents en altitude (windsAloftAPI).
//
// FAIL-CLOSED : en cas d'échec réseau/parse, renvoie null (jamais une altitude
// fabriquée). L'appelant DOIT interpréter null comme « relief non vérifié ».

const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';
const MAX_POINTS = 100; // limite open-meteo par requête

const M_TO_FT = 3.28084;

/**
 * @param {Array<{lat:number, lon:number}>} points  (≤ 100)
 * @returns {Promise<Array<number|null>|null>} élévations en PIEDS (MSL), ou null si l'appel échoue.
 *          Chaque entrée peut être null si l'API ne renvoie pas de valeur pour ce point.
 */
export async function fetchTerrainElevationsFt(points) {
  const pts = (points || []).filter(
    (p) => typeof p?.lat === 'number' && Number.isFinite(p.lat) &&
           typeof p?.lon === 'number' && Number.isFinite(p.lon)
  );
  if (pts.length === 0) return [];
  if (pts.length > MAX_POINTS) {
    // Sécurité : ne pas tronquer silencieusement — l'échantillonnage doit rester
    // sous la limite. On signale et on borne.
    console.warn(`[terrainService] ${pts.length} points > ${MAX_POINTS} — bornage à ${MAX_POINTS}.`);
  }
  const slice = pts.slice(0, MAX_POINTS);
  const lat = slice.map((p) => p.lat.toFixed(5)).join(',');
  const lon = slice.map((p) => p.lon.toFixed(5)).join(',');

  try {
    const res = await fetch(`${ELEVATION_URL}?latitude=${lat}&longitude=${lon}`);
    if (!res.ok) {
      console.warn(`[terrainService] HTTP ${res.status} — relief non vérifié`);
      return null;
    }
    const data = await res.json();
    const elev = data?.elevation;
    if (!Array.isArray(elev)) {
      console.warn('[terrainService] réponse inattendue — relief non vérifié');
      return null;
    }
    // open-meteo renvoie l'élévation en MÈTRES ; conversion en pieds.
    return elev.map((m) => (typeof m === 'number' && Number.isFinite(m) ? m * M_TO_FT : null));
  } catch (err) {
    console.warn('[terrainService] échec réseau — relief non vérifié:', err?.message || err);
    return null;
  }
}

export const __TERRAIN_LIMITS__ = { MAX_POINTS };
