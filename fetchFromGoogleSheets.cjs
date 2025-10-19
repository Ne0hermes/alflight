/**
 * Script pour récupérer les données depuis votre Google Sheets
 * et les importer dans le système de tracking Excel
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const tracker = require('./server/trackingSystem.cjs');

async function fetchAndImport() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║      📥 IMPORT GOOGLE SHEETS → TRACKING EXCEL             ║
╚════════════════════════════════════════════════════════════╝
`);

  try {
    // Charger les credentials
    const credentialsPath = 'D:\\Applicator\\alfight-46443ca54259.json';

    if (!fs.existsSync(credentialsPath)) {
      console.error('❌ Fichier credentials non trouvé:', credentialsPath);
      return;
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

    // Configurer l'authentification
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ID de votre Google Sheets et plage à lire
    const spreadsheetId = '1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k';
    const range = 'Tracking!A:I'; // Colonnes A à I de la feuille Tracking

    console.log('📊 Connexion à Google Sheets...');

    // Récupérer les données
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      console.log('⚠️ Aucune donnée trouvée');
      return;
    }

    console.log(`✅ ${rows.length} lignes trouvées dans Google Sheets`);

    // Analyser les headers
    const headers = rows[0];
    console.log('📋 Colonnes détectées:', headers);

    // Importer chaque ligne (sauf les headers)
    let imported = 0;
    let skipped = 0;

    console.log('\n🔄 Import des données...\n');

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      // Ignorer les lignes vides
      if (!row || row.length === 0 || !row[0]) {
        skipped++;
        continue;
      }

      try {
        // Mapper les données selon les colonnes
        const dateHeure = row[0] || '';
        const action = row[1] || '';
        const composant = row[2] || '';
        const resume = row[3] || action.substring(0, 40);
        const details = row[4] || '';
        const fichiers = row[5] ? row[5].split(',').map(f => f.trim()) : [];
        const statut = row[6] || 'Importé';
        const auteur = row[7] || 'Import Google Sheets';
        // La version sera auto-incrémentée par le tracker

        // Vérifier qu'on a au moins une action
        if (!action && !composant) {
          skipped++;
          continue;
        }

        // Ajouter au tracker avec versioning automatique
        tracker.addLog(
          action,
          composant,
          resume,
          details,
          fichiers,
          statut,
          auteur
        );

        imported++;

        // Afficher la progression
        if (imported % 5 === 0 || imported === 1) {
          console.log(`  ✓ ${imported} entrées importées...`);
        }

      } catch (error) {
        console.error(`  ✗ Erreur ligne ${i + 1}: ${error.message}`);
        skipped++;
      }
    }

    // Résumé final
    const summary = tracker.getSummary();

    console.log(`
╔════════════════════════════════════════════════════════════╗
║                  ✅ IMPORT TERMINÉ                        ║
╚════════════════════════════════════════════════════════════╝

📈 Résultats de l'import Google Sheets :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 Source : Google Sheets (${spreadsheetId})
✅ Importés avec succès : ${imported}
⚠️  Lignes ignorées      : ${skipped}
📊 Total dans tracking   : ${summary.totalLogs}
🏷️  Version actuelle      : ${summary.version}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Fichier Excel mis à jour :
   ${summary.excelPath}

💡 Les versions ont été automatiquement incrémentées !
`);

    // Ouvrir le fichier Excel
    console.log('📊 Ouverture du fichier Excel...');
    tracker.openExcel();

  } catch (error) {
    console.error('❌ Erreur:', error.message);

    if (error.message.includes('PERMISSION_DENIED')) {
      console.log(`
⚠️ Erreur d'autorisation. Solutions :

1. Vérifiez que le Google Sheets est partagé avec le compte de service :
   ${credentials.client_email}

2. Ou exportez manuellement :
   - Dans Google Sheets : Fichier → Télécharger → CSV
   - Puis : node importToTracking.cjs [fichier.csv]
`);
    }
  }
}

// Lancer l'import
fetchAndImport().catch(console.error);