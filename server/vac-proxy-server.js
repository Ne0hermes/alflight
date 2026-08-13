// server/vac-proxy-server.js

/**
 * Serveur proxy pour télécharger les cartes VAC depuis le site du SIA.
 * Nécessaire car le SIA n'envoie aucun en-tête CORS : un fetch navigateur
 * direct est bloqué — le téléchargement doit passer par ce proxy.
 *
 * Patterns d'URL VÉRIFIÉS en direct le 2026-07-05 (HTTP 200, application/pdf) :
 *   VAC aérodrome  : /media/dvd/eAIP_{JJ_MON_AAAA}/Atlas-VAC/PDF_AIPparSSection/VAC/AD/AD-2.{OACI}.pdf
 *   VAC hélistation: /media/dvd/eAIP_{JJ_MON_AAAA}/Atlas-VAC/PDF_AIPparSSection/VACH/AD/AD-3.{OACI}.pdf
 * ⚠ L'ancien préfixe /dvd/ (sans /media/) renvoie 404 depuis la migration du site.
 * ⚠ Seul le cycle AIRAC COURANT est en ligne (cycles adjacents → 404) ; autour
 *   des dates de bascule on essaie donc courant → précédent → suivant.
 *
 * Licence Ouverte SIA : réutilisation autorisée avec attribution — les réponses
 * portent les en-têtes X-Source / X-Airac-Cycle, à afficher côté client
 * (« Source : SIA — cycle AIRAC du {date} », PDF servi non modifié).
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
// Port DÉDIÉ (3003) : openaip-airspaces-proxy occupe déjà 3002 (démarré par npm run dev).
const PORT = process.env.VAC_PROXY_PORT || 3003;

// Configuration CORS
// 🔒 Lot 0.3 : restreint aux origines de dev locales (était ouvert à toutes).
const ALLOWED_ORIGINS = [
  'http://localhost:5173', 'http://127.0.0.1:5173',
  ...Array.from({ length: 13 }, (_, i) => [`http://localhost:${4000 + i}`, `http://127.0.0.1:${4000 + i}`]).flat()
];
app.use(cors({ origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'], credentials: false }));
app.use(express.json());

// Cache local pour les cartes (un fichier par OACI × cycle → invalidation
// automatique à chaque nouveau cycle, les anciens fichiers devenant orphelins)
const CACHE_DIR = path.join(__dirname, 'vac-cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// ─── Calcul AIRAC ───
// Cycles FIXES de 28 jours. Ancre vérifiée : 2020-01-02 = début AIRAC 2001,
// et 2020-01-02 + 84 × 28 j = 2026-06-11, cycle réellement en ligne au moment
// de la vérification (« en vigueur du 11/06/2026 au 08/07/2026 » côté SIA).
// Tout en UTC : l'ancien calcul (base locale + numéro de cycle non recalé au
// 1er janvier) donnait des identifiants faux en changement d'année.
const AIRAC_EPOCH_UTC = Date.UTC(2020, 0, 2);
const CYCLE_MS = 28 * 24 * 60 * 60 * 1000;
const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Début (UTC) du cycle AIRAC contenant `date`. */
function cycleStartForDate(date = new Date()) {
  const n = Math.floor((date.getTime() - AIRAC_EPOCH_UTC) / CYCLE_MS);
  return new Date(AIRAC_EPOCH_UTC + n * CYCLE_MS);
}

/** Nom de dossier SIA du cycle : « 11_JUN_2026 » (mois anglais 3 lettres MAJ). */
function formatCycleDir(cycleStart) {
  const d = String(cycleStart.getUTCDate()).padStart(2, '0');
  return `${d}_${MONTHS_EN[cycleStart.getUTCMonth()]}_${cycleStart.getUTCFullYear()}`;
}

/** Identifiant AIRAC « YYNN » (NN = rang du cycle dans l'année civile de son début). */
function airacIdent(cycleStart) {
  const year = cycleStart.getUTCFullYear();
  const firstIdxOfYear = Math.ceil((Date.UTC(year, 0, 1) - AIRAC_EPOCH_UTC) / CYCLE_MS);
  const idx = Math.round((cycleStart.getTime() - AIRAC_EPOCH_UTC) / CYCLE_MS);
  const num = idx - firstIdxOfYear + 1;
  return `${String(year).slice(-2)}${String(num).padStart(2, '0')}`;
}

/** Descripteur complet d'un cycle (dossier SIA, identifiant, dates de validité). */
function describeCycle(cycleStart) {
  return {
    dir: formatCycleDir(cycleStart),
    ident: airacIdent(cycleStart),
    effectiveFrom: cycleStart.toISOString().slice(0, 10),
    effectiveTo: new Date(cycleStart.getTime() + CYCLE_MS - 1).toISOString().slice(0, 10)
  };
}

/** Cycles à essayer, dans l'ordre : courant, précédent, suivant (bascules AIRAC). */
function candidateCycles(now = new Date()) {
  const cur = cycleStartForDate(now);
  return [cur, new Date(cur.getTime() - CYCLE_MS), new Date(cur.getTime() + CYCLE_MS)].map(describeCycle);
}

/** URLs SIA candidates pour un OACI dans un cycle : VAC (AD-2) puis VACH (AD-3). */
function vacUrlCandidates(icao, cycleDir) {
  const base = `https://www.sia.aviation-civile.gouv.fr/media/dvd/eAIP_${cycleDir}/Atlas-VAC/PDF_AIPparSSection`;
  return [
    { url: `${base}/VAC/AD/AD-2.${icao}.pdf`, type: 'VAC' },
    { url: `${base}/VACH/AD/AD-3.${icao}.pdf`, type: 'VACH' }
  ];
}

/** Un vrai PDF commence par « %PDF » — écarte toute page HTML renvoyée en 200. */
function isPdf(buffer) {
  return buffer && buffer.length > 4 && buffer.slice(0, 4).toString('latin1') === '%PDF';
}

/**
 * Télécharge la VAC d'un OACI : cache d'abord, puis SIA (cycles courant/±1, VAC puis VACH).
 * @returns {{ data: Buffer, cycle: object, type: string, fromCache: boolean } | null}
 */
async function fetchVac(icao) {
  const cycles = candidateCycles();

  // 1. Cache local (indexé OACI × cycle × type)
  for (const cycle of cycles) {
    for (const type of ['VAC', 'VACH']) {
      const cacheFile = path.join(CACHE_DIR, `${icao}_${cycle.dir}_${type}.pdf`);
      if (fs.existsSync(cacheFile)) {
        console.log(`✅ ${icao} servi depuis le cache (${cycle.dir}, ${type})`);
        return { data: fs.readFileSync(cacheFile), cycle, type, fromCache: true };
      }
    }
  }

  // 2. Téléchargement SIA
  for (const cycle of cycles) {
    for (const { url, type } of vacUrlCandidates(icao, cycle.dir)) {
      try {
        console.log(`🔍 Tentative: ${url}`);
        const response = await axios({
          method: 'GET',
          url,
          responseType: 'arraybuffer',
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const data = Buffer.from(response.data);
        if (response.status === 200 && isPdf(data)) {
          const cacheFile = path.join(CACHE_DIR, `${icao}_${cycle.dir}_${type}.pdf`);
          fs.writeFileSync(cacheFile, data);
          console.log(`✅ ${icao} téléchargé (${cycle.dir}, ${type}) et mis en cache`);
          return { data, cycle, type, fromCache: false };
        }
        console.log(`⚠️ Réponse 200 mais pas un PDF pour ${url}`);
      } catch (error) {
        console.log(`❌ Échec pour ${url}: ${error.message}`);
      }
    }
  }

  return null;
}

/** Envoie le PDF avec les en-têtes d'attribution SIA (Licence Ouverte). */
function sendVacPdf(res, icao, result) {
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${icao}_${result.cycle.dir}.pdf"`);
  res.set('X-Source', 'SIA - sia.aviation-civile.gouv.fr (Licence Ouverte)');
  res.set('X-Airac-Cycle', result.cycle.ident);
  res.set('X-Airac-Effective', result.cycle.effectiveFrom);
  res.set('X-Vac-Type', result.type); // VAC (aérodrome) ou VACH (hélistation)
  res.set('Access-Control-Expose-Headers', 'X-Source, X-Airac-Cycle, X-Airac-Effective, X-Vac-Type');
  return res.send(result.data);
}

/** Réponse 404 commune (OACI introuvable dans l'Atlas VAC des cycles testés). */
function sendVacNotFound(res, icao) {
  return res.status(404).json({
    error: 'Carte VAC non trouvée',
    icao,
    airac: candidateCycles()[0].ident,
    cyclesTried: candidateCycles().map(c => c.dir),
    suggestion: 'Vérifiez le code OACI (terrain sans VAC publiée ? outre-mer ?) ou téléchargez manuellement depuis sia.aviation-civile.gouv.fr'
  });
}

/**
 * Endpoint principal : GET /api/vac/:icao → PDF
 * (pratique côté client : fetch simple, URL utilisable dans un <a>/<embed>)
 */
app.get('/api/vac/:icao', async (req, res) => {
  const icao = String(req.params.icao || '').trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(icao)) {
    return res.status(400).json({ error: 'Code ICAO invalide' });
  }
  const result = await fetchVac(icao);
  if (result) return sendVacPdf(res, icao, result);
  return sendVacNotFound(res, icao);
});

/**
 * Endpoint historique conservé : POST /api/vac-download { icao } → PDF
 */
app.post('/api/vac-download', async (req, res) => {
  const icao = String(req.body?.icao || '').trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(icao)) {
    return res.status(400).json({ error: 'Code ICAO invalide' });
  }
  const result = await fetchVac(icao);
  if (result) return sendVacPdf(res, icao, result);
  return sendVacNotFound(res, icao);
});

/**
 * Endpoint pour obtenir les infos AIRAC
 */
app.get('/api/airac-info', (req, res) => {
  const current = describeCycle(cycleStartForDate());
  const next = describeCycle(new Date(cycleStartForDate().getTime() + CYCLE_MS));

  res.json({
    current: current.ident,
    cycleDir: current.dir,
    effectiveFrom: current.effectiveFrom,
    effectiveTo: current.effectiveTo,
    nextChange: next.effectiveFrom,
    daysUntilChange: Math.ceil((new Date(`${next.effectiveFrom}T00:00:00Z`) - Date.now()) / (1000 * 60 * 60 * 24)),
    source: 'SIA - sia.aviation-civile.gouv.fr (Licence Ouverte, attribution requise)'
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
    port: PORT,
    airac: describeCycle(cycleStartForDate())
  });
});

// Démarrer le serveur — 🔒 lié à 127.0.0.1 : inaccessible depuis le réseau local
app.listen(PORT, '127.0.0.1', () => {
  const cycle = describeCycle(cycleStartForDate());
  console.log(`🚀 VAC Proxy Server démarré sur http://localhost:${PORT}`);
  console.log(`📅 Cycle AIRAC actuel: ${cycle.ident} (${cycle.dir}, du ${cycle.effectiveFrom} au ${cycle.effectiveTo})`);
  console.log(`📁 Cache: ${CACHE_DIR}`);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('⏹️ Arrêt du serveur...');
  process.exit(0);
});
