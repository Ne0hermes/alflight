/**
 * API Route Vercel - Proxy AEROWEB (Météo-France aviation)
 * 🔧 LOT 6-C (volet images) — cartes officielles TEMSI / WINTEM pour le
 * briefing de vol. Deux modes :
 *   1. Liste de cartes : /api/aeroweb?produit=temsi|wintem[&zone=FRANCE|EUROC][&altitude=020]
 *      → JSON { status, cartes: [{ type, niveau, zone, dateRun, echeance, url, proxyUrl }] }
 *   2. Proxy d'image : /api/aeroweb?image=<url aviation.meteo.fr encodée>
 *      → flux binaire avec CORS ouvert (nécessaire à la capture html2canvas du PDF,
 *        sinon canvas « tainted »).
 *
 * Le code d'accès AEROWEB (convention gratuite Météo-France) est lu depuis la
 * variable d'environnement Vercel AEROWEB_USER_CODE. Tant qu'elle n'est pas
 * configurée, l'API répond 503 { status: 'not_configured' } et le client
 * affiche « en attente d'activation » (règle A5 : rien n'est fabriqué).
 *
 * Endpoints AEROWEB (documentés par le projet Weather-Logger) :
 *   https://aviation.meteo.fr/FR/aviation/serveur_donnees.jsp
 *     ?ID=<code>&TYPE_DONNEES=CARTES&VUE_CARTE=AERO_TEMSI&ZONE=AERO_FRANCE
 *     ?ID=<code>&TYPE_DONNEES=CARTES&VUE_CARTE=AERO_WINTEM&ALTITUDE=020&ZONE=AERO_FRANCE
 *   Réponse : XML avec des blocs <carte> contenant <lien> vers l'image/PDF.
 */

export const config = {
  runtime: 'edge',
  regions: ['cdg1'], // Paris — au plus près d'aviation.meteo.fr
};

const AEROWEB_BASE = 'https://aviation.meteo.fr/FR/aviation/serveur_donnees.jsp';

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

// Extraction minimaliste des blocs <carte> du XML AEROWEB (pas de DOMParser
// dans le runtime edge — regex suffisantes pour ce format plat et stable)
const extractTag = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`, 'i'));
  return m ? m[1].trim() : null;
};

const parseCartes = (xml) => {
  const cartes = [];
  const blocks = xml.match(/<carte>[\s\S]*?<\/carte>/gi) || [];
  for (const block of blocks) {
    const lien = extractTag(block, 'lien');
    if (!lien) continue;
    // Les liens du XML peuvent être relatifs (/FR/aviation/...) ou en http://
    // → résolution contre l'origine AEROWEB + montée en https, sinon le proxy
    // image (https + *.meteo.fr uniquement) les refuserait (revue lot 7).
    let resolved;
    try {
      resolved = new URL(lien.replace(/&amp;/g, '&'), AEROWEB_BASE);
    } catch {
      continue; // lien inexploitable → carte ignorée (fail-closed, A5)
    }
    if (resolved.protocol === 'http:') resolved.protocol = 'https:';
    cartes.push({
      type: extractTag(block, 'type'),
      niveau: extractTag(block, 'niveau'),
      zone: extractTag(block, 'zone_carte'),
      dateRun: extractTag(block, 'date_run'),
      echeance: extractTag(block, 'echeance') || extractTag(block, 'date_echeance'),
      url: resolved.href,
    });
  }
  return cartes;
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  try {
    const url = new URL(request.url);

    // ── Mode 2 : proxy d'image (CORS-safe pour html2canvas) ────────────────
    const imageUrl = url.searchParams.get('image');
    if (imageUrl) {
      let target;
      try {
        target = new URL(imageUrl);
      } catch {
        return jsonResponse({ status: 'error', message: 'URL image invalide' }, 400);
      }
      // Garde anti-SSRF : uniquement les hôtes Météo-France aviation
      const allowedHost = target.hostname === 'aviation.meteo.fr' ||
        target.hostname.endsWith('.meteo.fr');
      if (target.protocol !== 'https:' || !allowedHost) {
        return jsonResponse({ status: 'error', message: 'Hôte non autorisé' }, 403);
      }
      const upstream = await fetch(target.toString(), {
        headers: { 'User-Agent': 'ALFlight/1.0.0' },
      });
      if (!upstream.ok) {
        return jsonResponse({ status: 'error', message: `Image indisponible (${upstream.status})` }, 502);
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'image/png',
          'Cache-Control': 'public, max-age=900', // 15 min — les cartes changent par run
          ...CORS_HEADERS,
        },
      });
    }

    // ── Mode 1 : liste des cartes d'un produit ─────────────────────────────
    const userCode = process.env.AEROWEB_USER_CODE;
    if (!userCode) {
      return jsonResponse({
        status: 'not_configured',
        message: 'AEROWEB_USER_CODE non configurée sur Vercel (code d\'accès en attente de Météo-France)',
      }, 503);
    }

    const produit = (url.searchParams.get('produit') || 'temsi').toLowerCase();
    const zone = (url.searchParams.get('zone') || 'FRANCE').toUpperCase();
    const altitude = url.searchParams.get('altitude') || '020';

    const params = new URLSearchParams({
      ID: userCode,
      TYPE_DONNEES: 'CARTES',
      ZONE: `AERO_${zone}`,
    });
    if (produit === 'wintem') {
      params.set('VUE_CARTE', 'AERO_WINTEM');
      params.set('ALTITUDE', altitude);
    } else {
      params.set('VUE_CARTE', 'AERO_TEMSI');
    }

    const upstream = await fetch(`${AEROWEB_BASE}?${params}`, {
      headers: { 'User-Agent': 'ALFlight/1.0.0', 'Accept': 'application/xml,text/xml' },
    });
    if (!upstream.ok) {
      return jsonResponse({ status: 'error', message: `AEROWEB HTTP ${upstream.status}` }, 502);
    }
    const xml = await upstream.text();

    // Code d'accès refusé / erreur serveur AEROWEB (XML d'erreur dédié)
    if (/acc[eè]s\s+refus|code_erreur|<erreur>/i.test(xml)) {
      return jsonResponse({
        status: 'error',
        message: 'AEROWEB a refusé la requête (code d\'accès invalide ou expiré ?)',
      }, 502);
    }

    const cartes = parseCartes(xml).map(c => ({
      ...c,
      // URL passant par ce proxy → affichable ET capturable dans le PDF
      proxyUrl: `/api/aeroweb?image=${encodeURIComponent(c.url)}`,
    }));

    return jsonResponse({
      status: 'ok',
      produit,
      zone,
      ...(produit === 'wintem' ? { altitude } : {}),
      cartes,
      timestamp: new Date().toISOString(),
    }, 200, { 'Cache-Control': 'public, max-age=900' });
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.message }, 500);
  }
}
