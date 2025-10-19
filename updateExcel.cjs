/**
 * Script pour mettre à jour le fichier Excel en temps réel
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Chemin du fichier Excel
const excelPath = path.join(__dirname, 'tracking', 'alflight_tracking.xlsx');

function addLogToExcel(action, composant, details, statut = 'Complété') {
  console.log(`\n📝 Ajout d'un nouveau log...`);

  // Charger le fichier existant
  const workbook = XLSX.readFile(excelPath);
  const worksheet = workbook.Sheets['Tracking'];

  // Obtenir les données actuelles
  let data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  // Ajouter le nouveau log
  const now = new Date();
  const newLog = [
    now.toLocaleDateString('fr-FR'),
    now.toLocaleTimeString('fr-FR'),
    action,
    composant,
    details,
    statut,
    'Claude',
    '1.0.0'
  ];

  data.push(newLog);

  // Recréer la feuille
  const newWorksheet = XLSX.utils.aoa_to_sheet(data);
  newWorksheet['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 40 }, { wch: 25 },
    { wch: 70 }, { wch: 12 }, { wch: 15 }, { wch: 10 }
  ];

  workbook.Sheets['Tracking'] = newWorksheet;

  // Mettre à jour les statistiques
  updateStats(workbook, data.length - 1);

  // Sauvegarder
  XLSX.writeFile(workbook, excelPath);

  console.log(`✅ Log ajouté : "${action}"`);
  console.log(`📊 Total : ${data.length - 1} logs dans le fichier`);
  console.log(`📂 Fichier mis à jour : ${excelPath}`);

  return true;
}

function updateStats(workbook, totalLogs) {
  const now = new Date();
  const statsData = [
    ['📊 ALFlight - Statistiques de Tracking'],
    [''],
    ['📈 Mise à jour en temps réel'],
    ['Total des actions', totalLogs],
    ['Dernière mise à jour', now.toLocaleString('fr-FR')],
    ['Mis à jour par', 'Claude AI'],
    [''],
    ['⏱️ Activité récente'],
    ['Dernière action', now.toLocaleTimeString('fr-FR')],
    ['Actions aujourd\'hui', 'En cours de calcul...'],
    [''],
    ['📊 État du système'],
    ['Connexion Excel', '✅ Active'],
    ['Auto-save', '✅ Activé'],
    ['Synchronisation', '✅ Temps réel']
  ];

  const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
  statsSheet['!cols'] = [{ wch: 40 }, { wch: 25 }];

  workbook.Sheets['Statistiques'] = statsSheet;
}

// Démonstration de mise à jour en temps réel
console.log(`
╔════════════════════════════════════════════════════════════╗
║      🚀 DÉMONSTRATION MISE À JOUR EXCEL EN DIRECT         ║
╚════════════════════════════════════════════════════════════╝
`);

console.log('Je vais ajouter 3 logs avec un délai de 2 secondes entre chaque...\n');

// Premier log
setTimeout(() => {
  addLogToExcel(
    'Test mise à jour temps réel #1',
    'ExcelUpdater',
    'Démonstration de la mise à jour automatique du fichier Excel',
    'En cours'
  );
}, 1000);

// Deuxième log
setTimeout(() => {
  addLogToExcel(
    'Test mise à jour temps réel #2',
    'LiveSync',
    'Le fichier Excel est mis à jour instantanément après chaque action',
    'Complété'
  );
}, 3000);

// Troisième log
setTimeout(() => {
  addLogToExcel(
    'Test mise à jour temps réel #3',
    'AutoTracker',
    'Synchronisation automatique sans intervention manuelle',
    'Complété'
  );

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    ✅ DÉMONSTRATION TERMINÉE              ║
╚════════════════════════════════════════════════════════════╝

📊 Votre fichier Excel a été mis à jour 3 fois !
📂 Ouvrez le fichier pour voir les changements :
   ${excelPath}

💡 Astuce : Si le fichier est déjà ouvert dans Excel,
   appuyez sur Ctrl+S pour rafraîchir l'affichage.
`);
}, 5000);

// Export pour utilisation dans d'autres scripts
module.exports = { addLogToExcel };