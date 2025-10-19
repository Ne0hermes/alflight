/**
 * Script pour récupérer les données depuis Google Sheets
 * et les importer dans notre système de tracking
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const importer = require('./importToTracking.cjs');

class GoogleSheetsImporter {
  constructor() {
    this.SPREADSHEET_ID = '1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k';
    this.RANGE = 'Tracking!A:I'; // Colonnes A à I de la feuille Tracking
    this.auth = null;
  }

  /**
   * Authentification Google Sheets
   */
  async authenticate() {
    try {
      // Vérifier si les credentials existent
      const credentialsPath = path.join(__dirname, 'server', 'credentials.json');

      if (!fs.existsSync(credentialsPath)) {
        console.error(`
❌ Fichier credentials.json non trouvé !

Pour récupérer les données depuis Google Sheets, vous avez 3 options :

📋 OPTION 1 : Export manuel (Recommandé)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Ouvrez votre Google Sheets
2. Fichier → Télécharger → CSV (.csv)
3. Sauvegardez comme : tracking/google_sheets_tracking.csv
4. Lancez : node importToTracking.cjs tracking/google_sheets_tracking.csv

📋 OPTION 2 : Copier-coller les données
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Sélectionnez toutes les données dans Google Sheets
2. Copiez (Ctrl+C)
3. Collez dans un fichier Excel temporaire
4. Sauvegardez et importez

📋 OPTION 3 : Configurer l'API Google
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Créez credentials.json depuis Google Cloud Console
2. Placez-le dans server/credentials.json
3. Relancez ce script
`);
        return null;
      }

      // Charger les credentials
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

      // Créer le client d'authentification
      this.auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });

      console.log('✅ Authentification Google Sheets réussie');
      return this.auth;

    } catch (error) {
      console.error('❌ Erreur d\'authentification:', error.message);
      return null;
    }
  }

  /**
   * Récupérer les données depuis Google Sheets
   */
  async fetchData() {
    if (!this.auth) {
      this.auth = await this.authenticate();
      if (!this.auth) return null;
    }

    try {
      const sheets = google.sheets({ version: 'v4', auth: this.auth });

      console.log('📥 Récupération des données depuis Google Sheets...');

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.SPREADSHEET_ID,
        range: this.RANGE
      });

      const rows = response.data.values;

      if (!rows || rows.length === 0) {
        console.log('⚠️ Aucune donnée trouvée dans la feuille');
        return null;
      }

      console.log(`✅ ${rows.length} lignes récupérées`);

      return rows;

    } catch (error) {
      console.error('❌ Erreur lors de la récupération:', error.message);

      if (error.message.includes('401') || error.message.includes('403')) {
        console.log(`
⚠️ Problème d'accès au Google Sheets.

Solutions :
1. Vérifiez que le document est partagé avec le compte de service
2. Ou exportez manuellement le fichier en CSV
`);
      }

      return null;
    }
  }

  /**
   * Convertir les données Google Sheets en CSV
   */
  convertToCSV(rows) {
    // Créer le fichier CSV temporaire
    const csvPath = path.join(__dirname, 'tracking', 'google_sheets_import.csv');

    // Convertir en CSV avec point-virgule
    const csvContent = rows.map(row => {
      // Gérer les cellules vides et les caractères spéciaux
      return row.map(cell => {
        const value = cell || '';
        // Échapper les point-virgules et guillemets
        if (value.includes(';') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(';');
    }).join('\n');

    fs.writeFileSync(csvPath, csvContent, 'utf8');

    console.log(`✅ Fichier CSV créé : ${csvPath}`);

    return csvPath;
  }

  /**
   * Importer les données dans notre système de tracking
   */
  async importToTracking() {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║      📥 IMPORT GOOGLE SHEETS → TRACKING EXCEL             ║
╚════════════════════════════════════════════════════════════╝
`);

    // Récupérer les données
    const rows = await this.fetchData();

    if (!rows) {
      console.log(`
💡 Alternative : Export manuel
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Dans Google Sheets : Fichier → Télécharger → CSV
2. Sauvegardez le fichier
3. Lancez : node importToTracking.cjs [chemin-du-fichier.csv]
`);
      return;
    }

    // Convertir en CSV
    const csvPath = this.convertToCSV(rows);

    // Importer avec notre système
    console.log('\n🔄 Import dans le système de tracking...\n');

    const result = await importer.importToTracking(csvPath, {
      skipConfirmation: true
    });

    if (result.success) {
      console.log(`
✅ Import Google Sheets terminé avec succès !

Vous pouvez maintenant supprimer le fichier temporaire :
${csvPath}
`);
    }
  }
}

// Script d'exemple pour export manuel
function createManualImportTemplate() {
  const templatePath = path.join(__dirname, 'tracking', 'import_template.csv');

  const template = `Date/Heure;Action;Composant;Résumé;Détails;Fichiers;Statut;Auteur;Version
30/09/2025 10:00;Configuration initiale;Setup;Mise en place du projet;Installation des dépendances et configuration initiale;package.json;Complété;Developer;1.0.0
30/09/2025 11:00;Création composants;Frontend;Développement interface utilisateur;Création des composants React principaux;src/components/*;En cours;Developer;1.0.1
30/09/2025 12:00;Tests unitaires;Testing;Ajout des tests;Mise en place des tests Jest et React Testing Library;src/__tests__/*;Complété;Developer;1.0.2`;

  fs.writeFileSync(templatePath, template, 'utf8');

  console.log(`
📝 Template créé : ${templatePath}

Vous pouvez :
1. Modifier ce fichier avec vos données
2. Ou copier vos données Google Sheets dans ce format
3. Puis lancer : node importToTracking.cjs tracking/import_template.csv
`);
}

// Exécution principale
async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--template') {
    createManualImportTemplate();
    return;
  }

  if (args[0] === '--help') {
    console.log(`
📥 UTILISATION :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
node fetchGoogleSheetsData.cjs          # Import automatique
node fetchGoogleSheetsData.cjs --template # Créer un template
node fetchGoogleSheetsData.cjs --help    # Aide
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    return;
  }

  // Tenter l'import automatique
  const importer = new GoogleSheetsImporter();
  await importer.importToTracking();
}

// Lancer si exécuté directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = GoogleSheetsImporter;