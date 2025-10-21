/**
 * Serveur proxy OpenAIP pour les espaces aériens
 * Gère l'authentification API et les requêtes CORS
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.OPENAIP_PROXY_PORT || 3002;

// Configuration CORS pour permettre les requêtes depuis le frontend
app.use(cors({
  origin: [
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:4000', 'http://127.0.0.1:4000',
    'http://localhost:4001', 'http://127.0.0.1:4001',
    'http://localhost:4002', 'http://127.0.0.1:4002',
    'http://localhost:4003', 'http://127.0.0.1:4003',
    'http://localhost:4004', 'http://127.0.0.1:4004',
    'http://localhost:4005', 'http://127.0.0.1:4005',
    'http://localhost:4006', 'http://127.0.0.1:4006',
    'http://localhost:4007', 'http://127.0.0.1:4007',
    'http://localhost:4008', 'http://127.0.0.1:4008',
    'http://localhost:4009', 'http://127.0.0.1:4009',
    'http://localhost:4010', 'http://127.0.0.1:4010',
    'http://localhost:4011', 'http://127.0.0.1:4011',
    'http://localhost:4012', 'http://127.0.0.1:4012'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Configuration OpenAIP
const OPENAIP_API_BASE = 'https://api.core.openaip.net/api';
const OPENAIP_API_KEY = process.env.OPENAIP_API_KEY;

if (!OPENAIP_API_KEY) {
  console.warn('⚠️ OPENAIP_API_KEY non configurée - utilisez un fichier .env');
}

/**
 * Middleware pour vérifier la clé API
 */
const addApiKey = (req, res, next) => {
  if (!OPENAIP_API_KEY) {
    console.warn('⚠️ Clé API OpenAIP manquante');
  }
  next();
};

/**
 * Route proxy pour les espaces aériens
 * GET /api/airspaces?bbox=lon1,lat1,lon2,lat2&country=FR
 */
app.get('/api/airspaces', addApiKey, async (req, res) => {
  try {
    console.log('🔄 Requête espaces aériens OpenAIP:', req.query);

    // Construction de l'URL OpenAIP
    const params = new URLSearchParams();
    
    // Paramètres obligatoires
    if (req.query.bbox) {
      params.set('bbox', req.query.bbox);
    } else {
      // Bbox par défaut pour la France
      params.set('bbox', '-5.5,41.0,10.0,51.5');
    }

    // Paramètres optionnels
    if (req.query.country) params.set('country', req.query.country);
    if (req.query.format) params.set('format', req.query.format);
    
    // Toujours demander du GeoJSON
    params.set('format', 'geojson');
    
    // Ajouter la clé API comme paramètre de requête
    params.set('apiKey', OPENAIP_API_KEY);
    
    // Limite maximale autorisée par l'API
    params.set('limit', '1000');

    // Headers pour OpenAIP
    const headers = {
      'User-Agent': 'ALFlight/1.0.0',
      'Accept': 'application/json'
    };
    
    // Fonction pour récupérer une page
    const fetchPage = async (page) => {
      const pageParams = new URLSearchParams(params);
      pageParams.set('page', page.toString());
      
      const openAipUrl = `${OPENAIP_API_BASE}/airspaces?${pageParams}`;
      console.log(`📡 URL OpenAIP (page ${page}):`, openAipUrl);
      
      const response = await fetch(openAipUrl, {
        method: 'GET',
        headers,
        timeout: 15000 // 15 secondes timeout
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erreur OpenAIP ${response.status}:`, errorText);
        throw new Error(`OpenAIP Error: ${response.status} ${errorText || response.statusText}`);
      }
      
      return response.json();
    };
    
    // Récupérer la première page
    const firstPageData = await fetchPage(1);
    
    // Collecter toutes les features
    let allFeatures = [];
    
    if (firstPageData.items && Array.isArray(firstPageData.items)) {
      // L'API retourne un objet paginé
      const totalPages = firstPageData.totalPages || 1;
      const totalCount = firstPageData.totalCount || firstPageData.items.length;
      
      console.log(`📊 Total: ${totalCount} espaces aériens sur ${totalPages} page(s)`);
      
      // Convertir les items de la première page
      const page1Features = firstPageData.items.map(item => ({
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
          requestCompliance: item.requestCompliance
        },
        geometry: item.geometry
      }));
      
      allFeatures = [...page1Features];
      console.log(`✅ Page 1: ${page1Features.length} espaces aériens récupérés`);
      
      // Récupérer les pages suivantes si nécessaire
      if (totalPages > 1) {
        for (let page = 2; page <= totalPages; page++) {
          try {
            const pageData = await fetchPage(page);
            if (pageData.items && Array.isArray(pageData.items)) {
              const pageFeatures = pageData.items.map(item => ({
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
                  requestCompliance: item.requestCompliance
                },
                geometry: item.geometry
              }));
              
              allFeatures = [...allFeatures, ...pageFeatures];
              console.log(`✅ Page ${page}: ${pageFeatures.length} espaces aériens récupérés`);
            }
          } catch (pageError) {
            console.error(`⚠️ Erreur lors de la récupération de la page ${page}:`, pageError.message);
          }
        }
      }
    } else if (firstPageData.type === 'FeatureCollection') {
      // Déjà en GeoJSON
      allFeatures = firstPageData.features;
      console.log(`✅ ${allFeatures.length} espaces aériens récupérés (format GeoJSON direct)`);
    } else {
      // Format inattendu
      console.log('⚠️ Format de réponse inattendu');
    }
    
    // Créer le GeoJSON final
    const geojsonData = {
      type: 'FeatureCollection',
      features: allFeatures
    };
    
    console.log(`📊 Total final: ${allFeatures.length} espaces aériens`);

    // Ajout de métadonnées
    const responseData = {
      ...geojsonData,
      metadata: {
        source: 'OpenAIP',
        proxy: 'ALFlight',
        timestamp: new Date().toISOString(),
        count: geojsonData.features.length,
        bbox: req.query.bbox || '-5.5,41.0,10.0,51.5',
        country: req.query.country || 'FR'
      }
    };

    res.json(responseData);

  } catch (error) {
    console.error('❌ Erreur proxy OpenAIP:', error);
    
    res.status(500).json({
      error: 'Proxy Error',
      message: error.message,
      timestamp: new Date().toISOString(),
      fallback: 'Vérifiez la configuration OpenAIP'
    });
  }
});

/**
 * Route de test de santé
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'OpenAIP Airspaces Proxy',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!OPENAIP_API_KEY,
    endpoints: ['/api/airspaces', '/api/health']
  });
});

/**
 * Route pour tester l'API OpenAIP
 */
app.get('/api/test', addApiKey, async (req, res) => {
  try {
    console.log('🧪 Test connexion OpenAIP...');
    
    const testUrl = `${OPENAIP_API_BASE}/countries`;
    const headers = {
      'User-Agent': 'ALFlight/1.0.0',
      'Accept': 'application/json',
      'x-openaip-client-id': OPENAIP_API_KEY
    };

    const response = await fetch(testUrl, { headers });
    
    if (!response.ok) {
      return res.status(response.status).json({
        test: 'FAILED',
        status: response.status,
        message: response.statusText,
        suggestion: 'Vérifiez votre clé API OpenAIP'
      });
    }

    const data = await response.json();
    
    res.json({
      test: 'SUCCESS',
      message: 'Connexion OpenAIP OK',
      apiKeyStatus: OPENAIP_API_KEY ? 'Configurée' : 'Manquante',
      sampleData: Array.isArray(data) ? data.slice(0, 3) : data
    });

  } catch (error) {
    res.status(500).json({
      test: 'ERROR',
      message: error.message,
      suggestion: 'Problème de réseau ou configuration'
    });
  }
});

/**
 * Gestion des erreurs 404
 */
app.all('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    availableRoutes: ['/api/airspaces', '/api/health', '/api/test'],
    timestamp: new Date().toISOString()
  });
});

/**
 * Gestion globale des erreurs
 */
app.use((error, req, res, next) => {
  console.error('💥 Erreur serveur:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Proxy OpenAIP Airspaces démarré sur le port ${PORT}`);
  console.log(`📍 API Health: http://localhost:${PORT}/api/health`);
  console.log(`🧪 API Test: http://localhost:${PORT}/api/test`);
  console.log(`🌍 API Airspaces: http://localhost:${PORT}/api/airspaces`);
  console.log(`🔑 Clé API: ${OPENAIP_API_KEY ? '✅ Configurée' : '❌ Manquante'}`);
});

export default app;