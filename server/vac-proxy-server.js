// server/vac-proxy-server.js

/**
 * Serveur proxy pour télécharger les cartes VAC
 * Contourne les limitations CORS des sites officiels
 */

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;

// Configuration CORS
app.use(cors());
app.use(express.json());

// Cache local pour les cartes
const CACHE_DIR = path.join(__dirname, 'vac-cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Calculer le cycle AIRAC actuel
 */
function getCurrentAiracCycle() {
  const baseDate = new Date('2024-01-25'); // AIRAC 2401
  const today = new Date();
  const daysDiff = Math.floor((today - baseDate) / (1000 * 60 * 60 * 24));
  const cyclesSince = Math.floor(daysDiff / 28);
  
  const year = today.getFullYear();
  const cycleNumber = (cyclesSince % 13) + 1;
  
  return {
    year: year.toString().slice(-2),
    cycle: cycleNumber.toString().padStart(2, '0'),
    string: `${year}${cycleNumber.toString().padStart(2, '0')}`,
    full: `${year}-${cycleNumber.toString().padStart(2, '0')}`
  };
}

/**
 * Endpoint pour télécharger une carte VAC
 */
app.post('/api/vac-download', async (req, res) => {
  const { icao } = req.body;
  
  if (!icao || !icao.match(/^[A-Z]{4}$/)) {
    return res.status(400).json({ error: 'Code ICAO invalide' });
  }

  const upperIcao = icao.toUpperCase();
  const airac = getCurrentAiracCycle();

  // Vérifier le cache local
  const cacheFile = path.join(CACHE_DIR, `${upperIcao}_${airac.string}.pdf`);
  if (fs.existsSync(cacheFile)) {
    console.log(`✅ Carte ${upperIcao} trouvée dans le cache`);
    return res.sendFile(cacheFile);
  }

  // URLs possibles du SIA
  const urls = [
    `https://www.sia.aviation-civile.gouv.fr/dvd/eAIP_${airac.full}/FRANCE/AIRAC-${airac.string}/pdf/FR-AD-2-${upperIcao}.pdf`,
    `https://www.sia.aviation-civile.gouv.fr/dvd/eAIP_${airac.string}/Atlas-VAC/PDF/${upperIcao}.pdf`,
    `https://www.sia.aviation-civile.gouv.fr/documents/supaip/vac/${upperIcao}.pdf`
  ];

  // Essayer chaque URL
  for (const url of urls) {
    try {
      console.log(`🔍 Tentative: ${url}`);
      
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.status === 200) {
        // Sauvegarder dans le cache
        fs.writeFileSync(cacheFile, response.data);
        console.log(`✅ Carte ${upperIcao} téléchargée et mise en cache`);
        
        // Envoyer le fichier
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `attachment; filename="${upperIcao}.pdf"`);
        return res.send(response.data);
      }
    } catch (error) {
      console.log(`❌ Échec pour ${url}: ${error.message}`);
      continue;
    }
  }

  // Si aucune URL ne fonctionne
  // Note: Puppeteer désactivé pour l'instant

  // Échec total
  res.status(404).json({
    error: 'Carte VAC non trouvée',
    icao: upperIcao,
    airac: airac.string,
    suggestion: 'Téléchargez manuellement depuis sia.aviation-civile.gouv.fr'
  });
});

// Fonction scraping désactivée temporairement
// Pour l'activer, installer puppeteer : npm install puppeteer

/**
 * Endpoint pour obtenir les infos AIRAC
 */
app.get('/api/airac-info', (req, res) => {
  const cycle = getCurrentAiracCycle();
  const nextChange = new Date();
  nextChange.setDate(nextChange.getDate() + (28 - (nextChange.getDate() % 28)));
  
  res.json({
    current: cycle.string,
    year: `20${cycle.year}`,
    cycle: cycle.cycle,
    nextChange: nextChange.toISOString(),
    daysUntilChange: Math.ceil((nextChange - new Date()) / (1000 * 60 * 60 * 24))
  });
});

/**
 * Endpoint pour vider le cache
 */
app.post('/api/clear-cache', (req, res) => {
  const files = fs.readdirSync(CACHE_DIR);
  files.forEach(file => {
    fs.unlinkSync(path.join(CACHE_DIR, file));
  });
  
  res.json({ 
    message: 'Cache vidé', 
    filesDeleted: files.length 
  });
});

/**
 * Endpoint de santé
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'VAC Proxy Server',
    airac: getCurrentAiracCycle().string
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 VAC Proxy Server démarré sur http://localhost:${PORT}`);
  console.log(`📅 Cycle AIRAC actuel: ${getCurrentAiracCycle().string}`);
  console.log(`📁 Cache: ${CACHE_DIR}`);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('⏹️ Arrêt du serveur...');
  process.exit(0);
});