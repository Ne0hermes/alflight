// src/services/aerowebAPI.js
// 🔧 LOT 6-C (volet images) — cartes officielles TEMSI / WINTEM via le proxy
// serverless /api/aeroweb (code d'accès AEROWEB côté serveur uniquement).
// Statuts retournés (règle A5 — rien n'est fabriqué) :
//   'ok'             → cartes disponibles
//   'not_configured' → code AEROWEB pas encore configuré sur Vercel
//   'empty'          → AEROWEB a répondu mais aucune carte (run absent, format)
//   'unavailable'    → proxy absent (dev local sans fonctions Vercel) ou réseau
//   'error'          → AEROWEB a répondu mais en échec

const API_BASE = '/api/aeroweb';

async function fetchProduct(produit, { zone = 'FRANCE', altitude } = {}) {
  const params = new URLSearchParams({ produit, zone });
  if (altitude) params.set('altitude', altitude);
  try {
    const response = await fetch(`${API_BASE}?${params}`);
    // Vite dev sans fonctions Vercel : 404 HTML → indisponible (pas une erreur)
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      return { status: 'unavailable', produit, cartes: [] };
    }
    const data = await response.json();
    if (data.status === 'ok') {
      return { status: 'ok', produit, zone, altitude, cartes: data.cartes || [] };
    }
    if (data.status === 'not_configured') {
      return { status: 'not_configured', produit, cartes: [] };
    }
    return { status: 'error', produit, message: data.message, cartes: [] };
  } catch (e) {
    console.warn(`⚠️ [aerowebAPI] ${produit} :`, e?.message);
    return { status: 'unavailable', produit, cartes: [] };
  }
}

/**
 * Cartes du briefing de fin de préparation : TEMSI France + WINTEM aux
 * niveaux VFR utiles (FL020 / FL050 / FL100).
 * @returns {{ status, products: Array }} status global :
 *   'ok' si AU MOINS un produit a des cartes, sinon le statut le plus informatif.
 */
export async function fetchBriefingCharts() {
  const requests = [
    { key: 'TEMSI France', promise: fetchProduct('temsi', { zone: 'FRANCE' }) },
    { key: 'WINTEM FL020', promise: fetchProduct('wintem', { zone: 'FRANCE', altitude: '020' }) },
    { key: 'WINTEM FL050', promise: fetchProduct('wintem', { zone: 'FRANCE', altitude: '050' }) },
    { key: 'WINTEM FL100', promise: fetchProduct('wintem', { zone: 'FRANCE', altitude: '100' }) }
  ];
  const results = await Promise.all(requests.map(r => r.promise));
  const products = results.map((r, i) => ({ label: requests[i].key, ...r }));

  let status;
  if (products.some(p => p.status === 'ok' && p.cartes.length > 0)) {
    status = 'ok';
  } else if (products.some(p => p.status === 'not_configured')) {
    status = 'not_configured';
  } else if (products.some(p => p.status === 'error')) {
    status = 'error';
  } else if (products.some(p => p.status === 'ok')) {
    // Service joignable et configuré, mais AUCUNE carte parsée : distinct de
    // « injoignable » pour ne pas afficher un faux « en attente d'activation »
    status = 'empty';
  } else {
    status = 'unavailable';
  }
  return { status, products };
}

export const aerowebAPI = { fetchProduct, fetchBriefingCharts };
export default aerowebAPI;
