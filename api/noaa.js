/**
 * API Route Vercel — Proxy NOAA aviationweather.gov (METAR / TAF)
 *
 * 🐛 POURQUOI CE PROXY (16/08) : l'application appelait aviationweather.gov
 * DIRECTEMENT depuis le navigateur. Cette API ne renvoie pas d'en-tête
 * `Access-Control-Allow-Origin`, donc le navigateur bloque la réponse :
 *
 *   « Access to fetch at 'https://aviationweather.gov/api/data/metar?ids=LFGU…'
 *     from origin 'https://alflight.vercel.app' has been blocked by CORS policy »
 *
 * Résultat : plus AUCUN METAR/TAF ne remontait de la source primaire (le
 * commentaire du service affirmait « CORS ouvert » — ce n'est plus vrai).
 * Un appel serveur→serveur n'est, lui, pas soumis à la politique CORS : on
 * relaie donc la requête ici et on renvoie la réponse avec les bons en-têtes.
 *
 * Usage client :  /api/noaa?type=metar&ids=LFGU     →  JSON NOAA tel quel
 *                 /api/noaa?type=taf&ids=LFST
 *
 * Règle A5 (jamais de météo fabriquée) : en cas d'échec amont, on propage le
 * statut et un corps d'erreur explicite — jamais de données inventées.
 */

export const config = {
  runtime: 'edge',
  regions: ['cdg1'],
};

const NOAA_BASE = 'https://aviationweather.gov/api/data';
const ALLOWED_TYPES = new Set(['metar', 'taf']);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const jsonResponse = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extraHeaders },
  });

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const { searchParams } = new URL(request.url);
  const type = String(searchParams.get('type') || '').toLowerCase();
  const ids = String(searchParams.get('ids') || '').trim().toUpperCase();

  // Garde-fou : on ne relaie que les deux points d'entrée météo attendus, et
  // uniquement des codes OACI (pas de proxy ouvert vers un domaine tiers).
  if (!ALLOWED_TYPES.has(type)) {
    return jsonResponse({ error: 'Paramètre "type" attendu : metar ou taf.' }, 400);
  }
  if (!/^[A-Z0-9]{3,4}(,[A-Z0-9]{3,4})*$/.test(ids)) {
    return jsonResponse({ error: 'Paramètre "ids" attendu : un ou plusieurs codes OACI séparés par des virgules.' }, 400);
  }

  const upstream = `${NOAA_BASE}/${type}?ids=${encodeURIComponent(ids)}&format=json`;

  try {
    const resp = await fetch(upstream, {
      headers: { Accept: 'application/json', 'User-Agent': 'ALFlight/1.0 (VFR flight preparation)' },
    });

    if (!resp.ok) {
      return jsonResponse(
        { error: `Source NOAA indisponible (HTTP ${resp.status}).`, upstreamStatus: resp.status },
        502
      );
    }

    // 204 (aucune observation pour ce terrain) : tableau vide, pas une erreur.
    if (resp.status === 204) return jsonResponse([], 200);

    const text = await resp.text();
    if (!text.trim()) return jsonResponse([], 200);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return jsonResponse({ error: 'Réponse NOAA illisible (JSON invalide).' }, 502);
    }

    // Cache court : la météo évolue, mais on évite de marteler la source
    // quand plusieurs terrains sont interrogés en rafale.
    return jsonResponse(data, 200, { 'Cache-Control': 'public, max-age=120, s-maxage=120' });
  } catch (error) {
    return jsonResponse({ error: `Appel NOAA échoué : ${error?.message || 'erreur réseau'}` }, 502);
  }
}
