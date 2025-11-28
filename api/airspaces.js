/**
 * API Route Vercel - Proxy OpenAIP Airspaces
 * Cette fonction serverless permet d'appeler l'API OpenAIP sans problème CORS
 */

export const config = {
  runtime: 'edge',
  regions: ['cdg1'], // Paris - proche de la France pour les données aéro
};

const OPENAIP_API_BASE = 'https://api.core.openaip.net/api';

export default async function handler(request) {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const url = new URL(request.url);
    const bbox = url.searchParams.get('bbox') || '-5.5,41.0,10.0,51.5';
    const country = url.searchParams.get('country') || 'FR';

    // Clé API depuis les variables d'environnement Vercel
    const apiKey = process.env.OPENAIP_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Configuration Error',
          message: 'OPENAIP_API_KEY non configurée sur Vercel',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Construction des paramètres pour OpenAIP
    const params = new URLSearchParams({
      bbox: bbox,
      country: country,
      format: 'geojson',
      apiKey: apiKey,
      limit: '1000',
    });

    // Fonction pour récupérer une page
    const fetchPage = async (page) => {
      const pageParams = new URLSearchParams(params);
      pageParams.set('page', page.toString());

      const openAipUrl = `${OPENAIP_API_BASE}/airspaces?${pageParams}`;

      const response = await fetch(openAipUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'ALFlight/1.0.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAIP Error: ${response.status} ${errorText || response.statusText}`);
      }

      return response.json();
    };

    // Récupérer la première page
    const firstPageData = await fetchPage(1);

    // Collecter toutes les features
    let allFeatures = [];

    if (firstPageData.items && Array.isArray(firstPageData.items)) {
      const totalPages = firstPageData.totalPages || 1;

      // Convertir les items en features GeoJSON
      const convertItems = (items) =>
        items.map((item) => ({
          type: 'Feature',
          properties: {
            id: item._id,
            name: item.name || 'Sans nom',
            type: item.type,
            icaoClass: item.icaoClass,
            activity: item.activity,
            country: item.country,
            upperLimit: item.upperLimit,
            lowerLimit: item.lowerLimit,
            hoursOfOperation: item.hoursOfOperation,
            onDemand: item.onDemand,
            onRequest: item.onRequest,
            byNotam: item.byNotam,
            specialAgreement: item.specialAgreement,
            requestCompliance: item.requestCompliance,
          },
          geometry: item.geometry,
        }));

      allFeatures = convertItems(firstPageData.items);

      // Récupérer les pages suivantes si nécessaire (max 5 pages pour éviter timeout)
      const maxPages = Math.min(totalPages, 5);
      for (let page = 2; page <= maxPages; page++) {
        try {
          const pageData = await fetchPage(page);
          if (pageData.items && Array.isArray(pageData.items)) {
            allFeatures = [...allFeatures, ...convertItems(pageData.items)];
          }
        } catch (pageError) {
          console.error(`Erreur page ${page}:`, pageError.message);
        }
      }
    } else if (firstPageData.type === 'FeatureCollection') {
      allFeatures = firstPageData.features;
    }

    // Créer le GeoJSON final
    const responseData = {
      type: 'FeatureCollection',
      features: allFeatures,
      metadata: {
        source: 'OpenAIP',
        proxy: 'ALFlight-Vercel',
        timestamp: new Date().toISOString(),
        count: allFeatures.length,
        bbox: bbox,
        country: country,
      },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=1800', // Cache 30 minutes
      },
    });
  } catch (error) {
    console.error('Erreur proxy OpenAIP:', error);

    return new Response(
      JSON.stringify({
        error: 'Proxy Error',
        message: error.message,
        timestamp: new Date().toISOString(),
        fallback: 'Utilisez les données AIXM locales',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
