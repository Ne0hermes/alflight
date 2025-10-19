/**
 * Serveur pour gérer le fichier Excel de tracking
 * Lance un serveur qui maintient le fichier Excel à jour
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Importer le tracker Excel
const ExcelFileTracker = require('./excelFileTracker.cjs');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Instance du tracker
const tracker = new ExcelFileTracker();

// Route pour ajouter un log
app.post('/api/excel/log', (req, res) => {
  try {
    const { action, composant, details, statut } = req.body;

    if (!action || !composant) {
      return res.status(400).json({ error: 'Action et composant requis' });
    }

    const entry = tracker.addLog(action, composant, details, statut);

    res.json({
      success: true,
      entry,
      excelPath: tracker.getExcelPath(),
      totalLogs: tracker.logs.length
    });
  } catch (error) {
    console.error('Erreur lors de l\'ajout du log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour obtenir les logs
app.get('/api/excel/logs', (req, res) => {
  res.json({
    logs: tracker.logs,
    excelPath: tracker.getExcelPath(),
    stats: tracker.calculateStats()
  });
});

// Route pour ouvrir le fichier Excel
app.get('/api/excel/open', (req, res) => {
  try {
    tracker.openExcel();
    res.json({ success: true, message: 'Fichier Excel ouvert' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route pour télécharger le fichier Excel
app.get('/api/excel/download', (req, res) => {
  const filePath = tracker.getExcelPath();

  if (fs.existsSync(filePath)) {
    res.download(filePath, 'alflight_tracking.xlsx');
  } else {
    res.status(404).json({ error: 'Fichier non trouvé' });
  }
});

// Route pour obtenir le chemin du fichier
app.get('/api/excel/path', (req, res) => {
  res.json({
    path: tracker.getExcelPath(),
    absolutePath: path.resolve(tracker.getExcelPath())
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         📊 SERVEUR EXCEL TRACKER DÉMARRÉ                  ║
╚════════════════════════════════════════════════════════════╝

🌐 Serveur: http://localhost:${PORT}
📂 Fichier Excel: ${tracker.getExcelPath()}

Endpoints disponibles:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST /api/excel/log      - Ajouter un log
GET  /api/excel/logs     - Voir tous les logs
GET  /api/excel/open     - Ouvrir dans Excel
GET  /api/excel/download - Télécharger le fichier
GET  /api/excel/path     - Obtenir le chemin

Test rapide avec curl:
curl -X POST http://localhost:${PORT}/api/excel/log \\
  -H "Content-Type: application/json" \\
  -d '{"action":"Test","composant":"Server","details":"Test serveur"}'
`);

  // Ajouter un log de démarrage
  tracker.addLog('Serveur démarré', 'ExcelServer', `Serveur Excel Tracker démarré sur le port ${PORT}`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n📊 Sauvegarde finale du fichier Excel...');
  tracker.updateExcel();
  console.log('✅ Fichier Excel sauvegardé');
  console.log(`📂 Fichier disponible: ${tracker.getExcelPath()}`);
  process.exit(0);
});

module.exports = app;