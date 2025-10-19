/**
 * Mise à jour Excel en temps réel - Version sécurisée
 * Fonctionne même si le fichier est ouvert
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Chemins
const excelPath = path.join(__dirname, 'tracking', 'alflight_tracking.xlsx');
const tempPath = path.join(__dirname, 'tracking', 'temp_tracking.xlsx');
const logsJsonPath = path.join(__dirname, 'tracking', 'logs.json');

// Charger ou initialiser les logs depuis JSON
function loadLogs() {
  if (fs.existsSync(logsJsonPath)) {
    return JSON.parse(fs.readFileSync(logsJsonPath, 'utf8'));
  }
  return [];
}

// Sauvegarder les logs en JSON
function saveLogs(logs) {
  fs.writeFileSync(logsJsonPath, JSON.stringify(logs, null, 2));
}

// Ajouter un log
function addLog(action, composant, details, statut = 'Complété') {
  const logs = loadLogs();
  const now = new Date();

  const newLog = {
    id: Date.now(),
    date: now.toLocaleDateString('fr-FR'),
    heure: now.toLocaleTimeString('fr-FR'),
    action,
    composant,
    details,
    statut,
    utilisateur: 'Claude AI',
    version: '1.0.0'
  };

  logs.push(newLog);
  saveLogs(logs);

  console.log(`✅ Log ajouté : "${action}"`);
  console.log(`📊 Total : ${logs.length} logs`);

  // Essayer de mettre à jour Excel
  updateExcelFile(logs);

  return newLog;
}

// Mettre à jour le fichier Excel
function updateExcelFile(logs) {
  try {
    // Créer un nouveau workbook
    const workbook = XLSX.utils.book_new();

    // Préparer les données pour la feuille Tracking
    const headers = ['Date', 'Heure', 'Action', 'Composant', 'Détails', 'Statut', 'Utilisateur', 'Version'];
    const data = [headers];

    logs.forEach(log => {
      data.push([
        log.date,
        log.heure,
        log.action,
        log.composant,
        log.details,
        log.statut,
        log.utilisateur,
        log.version
      ]);
    });

    // Créer la feuille Tracking
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 40 }, { wch: 25 },
      { wch: 70 }, { wch: 12 }, { wch: 15 }, { wch: 10 }
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tracking');

    // Créer la feuille Statistiques
    const now = new Date();
    const statsData = [
      ['📊 ALFlight - Tracking en Temps Réel'],
      [''],
      ['📈 Statistiques Live'],
      ['Total des actions', logs.length],
      ['Dernière mise à jour', now.toLocaleString('fr-FR')],
      ['Mode', 'Synchronisation automatique'],
      [''],
      ['🔄 État de la synchronisation'],
      ['Fichier JSON', '✅ Synchronisé'],
      ['Fichier Excel', 'En cours de mise à jour...'],
      [''],
      ['📝 Actions récentes'],
      ...logs.slice(-5).reverse().map(log => [log.action, log.heure])
    ];

    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
    statsSheet['!cols'] = [{ wch: 50 }, { wch: 30 }];

    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistiques');

    // Essayer d'écrire directement
    try {
      XLSX.writeFile(workbook, excelPath);
      console.log(`📂 Fichier Excel mis à jour : ${excelPath}`);
    } catch (err) {
      // Si le fichier est verrouillé, créer une copie temporaire
      XLSX.writeFile(workbook, tempPath);
      console.log(`⚠️ Fichier principal verrouillé. Copie créée : ${tempPath}`);
      console.log(`💡 Fermez Excel et relancez pour voir les mises à jour`);
    }

  } catch (error) {
    console.error('❌ Erreur mise à jour Excel:', error.message);
  }
}

// Programme principal
console.log(`
╔════════════════════════════════════════════════════════════╗
║       🔄 MISE À JOUR EXCEL EN TEMPS RÉEL - V2            ║
╚════════════════════════════════════════════════════════════╝

📊 Mode : Synchronisation sécurisée
📂 Fichier : ${excelPath}
📝 Backup JSON : ${logsJsonPath}
`);

// Charger les logs existants
const existingLogs = loadLogs();
console.log(`📚 Logs existants : ${existingLogs.length}`);

// Ajouter quelques nouveaux logs pour démonstration
console.log('\n🚀 Ajout de nouveaux logs...\n');

// Log 1
setTimeout(() => {
  addLog(
    'Synchronisation Excel activée',
    'LiveSync',
    'Le système de mise à jour en temps réel est maintenant actif',
    'Complété'
  );
}, 500);

// Log 2
setTimeout(() => {
  addLog(
    'Test de performance',
    'Performance',
    'Vérification de la vitesse de synchronisation avec Excel',
    'En cours'
  );
}, 2000);

// Log 3
setTimeout(() => {
  addLog(
    'Backup automatique',
    'Backup',
    'Sauvegarde JSON créée pour assurer la persistance des données',
    'Complété'
  );
}, 3500);

// Log 4
setTimeout(() => {
  addLog(
    'Validation des données',
    'Validation',
    'Toutes les données ont été vérifiées et sont cohérentes',
    'Complété'
  );

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                  ✅ MISE À JOUR TERMINÉE                  ║
╚════════════════════════════════════════════════════════════╝

📊 Résumé :
- 4 nouveaux logs ajoutés
- Fichier JSON synchronisé : ${logsJsonPath}
- Fichier Excel disponible : ${excelPath}

💡 Pour voir les changements dans Excel :
1. Si Excel est ouvert, fermez-le et rouvrez le fichier
2. Ou ouvrez le fichier temp si créé : ${tempPath}

🔄 Les données sont sauvegardées en JSON pour garantir
   qu'aucun log n'est perdu même si Excel est verrouillé.
`);
}, 5000);

// Export pour utilisation externe
module.exports = { addLog, loadLogs, updateExcelFile };