// server/openaip-proxy.js
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger d'abord le .env local du serveur
dotenv.config();

// Puis charger le .env.local du projet parent
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration CORS simplifiée et corrigée
app.use(cors({
  origin: true, // Accepter toutes les origines en développement
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  optionsSuccessStatus: 204
}));

// Headers CORS supplémentaires pour s'assurer que tout fonctionne
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

app.use(express.json());

// Configuration de l'API OpenAIP
const OPENAIP_API_KEY = process.env.VITE_OPENAIP_API_KEY;
const OPENAIP_BASE_URL = 'https://api.core.openaip.net/api';

// Middleware de logging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - Origin: ${req.get('origin')}`);
  next();
});

// Proxy pour les requêtes OpenAIP
app.get('/api/openaip/airports', async (req, res) => {
  try {
    const { country = 'FR', limit = 1000 } = req.query;
    console.log(`🔍 Requête aéroports - Country: ${country}, Limit: ${limit}`);
    
    const response = await axios.get(`${OPENAIP_BASE_URL}/airports`, {
      headers: {
        'x-openaip-api-key': OPENAIP_API_KEY,
        'Accept': 'application/json'
      },
      params: {
        country,
        limit
      }
    });
    
    console.log(`✅ Réponse OpenAIP: ${response.data.items?.length || 0} aéroports`);
    res.json(response.data);
  } catch (error) {
    console.error('❌ Erreur OpenAIP:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Erreur lors de la récupération des aéroports',
      details: error.response?.data || error.message
    });
  }
});

// Proxy pour les espaces aériens
app.get('/api/openaip/airspaces', async (req, res) => {
  try {
    const { country = 'FR', limit = 1000, minLat, maxLat, minLon, maxLon } = req.query;
    console.log(`🔍 Requête espaces aériens - Country: ${country}, Bounds: ${minLat},${minLon} - ${maxLat},${maxLon}`);
    
    // Construire les paramètres selon ce qui est fourni
    const params = {
      country,
      limit
    };
    
    // Si des bounds sont fournis, les ajouter
    if (minLat && maxLat && minLon && maxLon) {
      params.bbox = `${minLon},${minLat},${maxLon},${maxLat}`; // Format: minLon,minLat,maxLon,maxLat
    }
    
    const response = await axios.get(`${OPENAIP_BASE_URL}/airspaces`, {
      headers: {
        'x-openaip-api-key': OPENAIP_API_KEY,
        'Accept': 'application/json'
      },
      params
    });
    
    console.log(`✅ Réponse OpenAIP: ${response.data.items?.length || 0} espaces aériens`);
    res.json(response.data);
  } catch (error) {
    console.error('❌ Erreur OpenAIP:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Erreur lors de la récupération des espaces aériens',
      details: error.response?.data || error.message
    });
  }
});

// Proxy pour les points de report
app.get('/api/openaip/reporting-points', async (req, res) => {
  try {
    const { airportId } = req.query;
    
    if (!airportId) {
      return res.status(400).json({ error: 'airportId requis' });
    }
    
    const response = await axios.get(`${OPENAIP_BASE_URL}/airports/${airportId}/reporting-points`, {
      headers: {
        'x-openaip-api-key': OPENAIP_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Erreur OpenAIP:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Erreur lors de la récupération des points de report',
      details: error.response?.data || error.message
    });
  }
});

// Proxy pour les cartes VAC du SIA
app.get('/api/vac/:icao', async (req, res) => {
  try {
    const { icao } = req.params;
    const upperIcao = icao.toUpperCase();
    
    console.log(`📥 Téléchargement carte VAC ${upperIcao}...`);
    
    // URLs à essayer (plusieurs cycles AIRAC possibles)
    // Les cycles changent tous les 28 jours
    const possibleUrls = [
      // Cycle actuel supposé (août 2025)
      `https://www.sia.aviation-civile.gouv.fr/dvd/eAIP_14_AUG_2025/FRANCE/AIRAC-2025-08-14/pdf/FR-AD-2/AD-2.${upperIcao}-fr-FR.pdf`,
      // Cycle précédent (juillet 2025)
      `https://www.sia.aviation-civile.gouv.fr/dvd/eAIP_17_JUL_2025/FRANCE/AIRAC-2025-07-17/pdf/FR-AD-2/AD-2.${upperIcao}-fr-FR.pdf`,
      // Autre format possible avec /media/
      `https://www.sia.aviation-civile.gouv.fr/media/dvd/eAIP_14_AUG_2025/FRANCE/AIRAC-2025-08-14/pdf/FR-AD-2/AD-2.${upperIcao}-fr-FR.pdf`
    ];
    
    let response = null;
    let successUrl = null;
    
    // Essayer chaque URL jusqu'à en trouver une qui fonctionne
    for (const url of possibleUrls) {
      try {
        console.log(`  Essai avec : ${url.substring(0, 80)}...`);
        response = await axios.get(url, {
          responseType: 'arraybuffer',
          headers: {
            'Accept': 'application/pdf',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000 // 10 secondes timeout par essai
        });
        successUrl = url;
        console.log(`  ✓ URL trouvée !`);
        break;
      } catch (err) {
        console.log(`  ✗ ${err.response?.status || err.code}`);
        continue;
      }
    }
    
    if (!response) {
      throw new Error('Aucune URL valide trouvée');
    }
    
    // Convertir en base64 pour l'envoyer au client
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64}`;
    
    console.log(`✅ Carte VAC ${upperIcao} téléchargée (${(response.data.length / 1024).toFixed(1)} KB)`);
    
    res.json({
      success: true,
      icao: upperIcao,
      url: dataUrl,
      fileSize: (response.data.length / 1024 / 1024).toFixed(2), // En MB
      contentType: 'application/pdf'
    });
    
  } catch (error) {
    console.error(`❌ Erreur téléchargement VAC ${req.params.icao}:`, error.message);
    
    if (error.response?.status === 404) {
      res.status(404).json({
        error: 'Carte VAC non trouvée',
        details: `La carte VAC pour ${req.params.icao} n'existe pas sur le SIA`
      });
    } else {
      res.status(error.response?.status || 500).json({
        error: 'Erreur lors du téléchargement de la carte VAC',
        details: error.message
      });
    }
  }
});

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    apiKey: OPENAIP_API_KEY ? 'Configurée' : 'Manquante',
    timestamp: new Date().toISOString()
  });
});

// Gestion des erreurs globales
process.on('uncaughtException', (error) => {
  console.error('❌ Erreur non capturée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejetée non gérée:', reason);
});

// Démarrer le serveur
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur proxy OpenAIP démarré sur http://localhost:${PORT}`);
  console.log(`🔑 Clé API OpenAIP: ${OPENAIP_API_KEY ? 'Configurée' : '⚠️ MANQUANTE'}`);
  console.log(`📅 Version: ${new Date().toISOString()}`);
  console.log('✅ CORS configuré pour accepter toutes les origines');
});

server.on('error', (error) => {
  console.error('❌ Erreur serveur:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Le port ${PORT} est déjà utilisé`);
  }
});