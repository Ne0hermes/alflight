/**
 * Script pour ajouter des logs au fichier Excel
 */

const XLSX = require('xlsx');
const path = require('path');
const { exec } = require('child_process');

// Chemin du fichier Excel
const excelPath = path.join(__dirname, 'tracking', 'alflight_tracking.xlsx');

console.log('📊 Ajout de logs au fichier Excel...');

// Charger le fichier existant
const workbook = XLSX.readFile(excelPath);
const worksheet = workbook.Sheets['Tracking'];

// Obtenir les données actuelles
let data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Si le fichier est vide, ajouter les headers
if (data.length === 0) {
  data = [['Date', 'Heure', 'Action', 'Composant', 'Détails', 'Statut', 'Utilisateur', 'Version']];
}

// Ajouter de nouveaux logs
const now = new Date();
const logs = [
  [
    now.toLocaleDateString('fr-FR'),
    now.toLocaleTimeString('fr-FR'),
    'Initialisation du système de tracking',
    'System',
    'Mise en place du tracking Excel local pour ALFlight',
    'Complété',
    'Developer',
    '1.0.0'
  ],
  [
    now.toLocaleDateString('fr-FR'),
    new Date(now.getTime() + 1000).toLocaleTimeString('fr-FR'),
    'Fix validation FI/CRI',
    'PilotDashboard',
    'Correction du problème de validation des heures instructeur dans les segments de vol',
    'Complété',
    'Developer',
    '1.0.0'
  ],
  [
    now.toLocaleDateString('fr-FR'),
    new Date(now.getTime() + 2000).toLocaleTimeString('fr-FR'),
    'Configuration iOS',
    'Codemagic',
    'Mise en place CI/CD pour déploiement TestFlight sans Mac',
    'En cours',
    'Developer',
    '1.0.0'
  ],
  [
    now.toLocaleDateString('fr-FR'),
    new Date(now.getTime() + 3000).toLocaleTimeString('fr-FR'),
    'Import/Export unités',
    'AircraftModule',
    'Ajout fonctionnalité import/export configuration des unités',
    'Complété',
    'Developer',
    '1.0.0'
  ],
  [
    now.toLocaleDateString('fr-FR'),
    new Date(now.getTime() + 4000).toLocaleTimeString('fr-FR'),
    'Tracking Excel local',
    'ExcelTracker',
    'Création du système de tracking avec fichier Excel physique',
    'Complété',
    'Developer',
    '1.0.0'
  ]
];

// Ajouter les logs aux données
logs.forEach(log => data.push(log));

// Créer une nouvelle feuille
const newWorksheet = XLSX.utils.aoa_to_sheet(data);

// Définir les largeurs de colonnes
newWorksheet['!cols'] = [
  { wch: 12 }, // Date
  { wch: 10 }, // Heure
  { wch: 40 }, // Action
  { wch: 25 }, // Composant
  { wch: 70 }, // Détails
  { wch: 12 }, // Statut
  { wch: 15 }, // Utilisateur
  { wch: 10 }  // Version
];

// Remplacer la feuille dans le workbook
workbook.Sheets['Tracking'] = newWorksheet;

// Ajouter une feuille de statistiques
const statsData = [
  ['📊 ALFlight - Statistiques de Tracking'],
  [''],
  ['📈 Résumé'],
  ['Total des actions', data.length - 1],
  ['Date de début', data.length > 1 ? data[1][0] : 'N/A'],
  ['Dernière mise à jour', now.toLocaleString('fr-FR')],
  [''],
  ['📋 Par composant'],
  ['PilotDashboard', '1 action'],
  ['Codemagic', '1 action'],
  ['AircraftModule', '1 action'],
  ['ExcelTracker', '1 action'],
  ['System', '1 action'],
  [''],
  ['✅ Par statut'],
  ['Complété', '4 actions'],
  ['En cours', '1 action']
];

const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
statsSheet['!cols'] = [{ wch: 40 }, { wch: 25 }];

// Ajouter ou remplacer la feuille de statistiques
workbook.Sheets['Statistiques'] = statsSheet;

// Sauvegarder le fichier
XLSX.writeFile(workbook, excelPath);

console.log('✅ Logs ajoutés avec succès !');
console.log(`📂 Fichier : ${excelPath}`);
console.log(`📊 Total : ${data.length - 1} logs`);

// Ouvrir le fichier dans Excel (Windows)
console.log('\n📂 Ouverture du fichier Excel...');
exec(`start "" "${excelPath}"`, (error) => {
  if (error) {
    console.log(`⚠️ Impossible d'ouvrir automatiquement. Ouvrez manuellement :`);
    console.log(`   ${excelPath}`);
  } else {
    console.log('✅ Fichier ouvert dans Excel !');
  }
});