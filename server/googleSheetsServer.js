/**
 * Serveur backend pour gérer l'authentification Google Sheets avec Service Account
 * Ce serveur doit tourner en parallèle de l'application React
 */

import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin pour le fichier de log local de secours
const LOCAL_LOG_PATH = path.join(__dirname, '..', 'tracking', 'claude-updates.log');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// Forcer l'encodage UTF-8 pour toutes les réponses
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Configuration Google Sheets
const SPREADSHEET_ID = '1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k';
const SHEET_NAME = 'Tracking';
const CREDENTIALS_PATH = 'D:\\Applicator\\alfight-46443ca54259.json';

// Initialiser l'authentification Google Sheets
let sheetsClient = null;

async function initGoogleSheets() {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(`Fichier credentials non trouvé: ${CREDENTIALS_PATH}`);
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    sheetsClient = google.sheets({ version: 'v4', auth: authClient });

    console.log('✅ Authentification Google Sheets réussie');
    return sheetsClient;
  } catch (error) {
    console.error('❌ Erreur authentification Google Sheets:', error);
    throw error;
  }
}

// Vérifier que la feuille existe et créer les en-têtes si nécessaire
async function checkSheetExists() {
  try {
    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheet = response.data.sheets.find(s => s.properties.title === SHEET_NAME);

    if (!sheet) {
      console.log('📝 Création de la feuille Tracking...');
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: SHEET_NAME
              }
            }
          }]
        }
      });

      // Ajouter les en-têtes
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:H1`,
        valueInputOption: 'RAW',
        resource: {
          values: [['Date/Heure', 'Action', 'Composant', 'Résumé', 'Détails', 'Fichiers', 'Statut', 'Auteur']]
        }
      });

      console.log('✅ Feuille Tracking créée avec en-têtes');
    } else {
      console.log('✅ Feuille Tracking trouvée');
    }
  } catch (error) {
    console.error('Erreur vérification feuille:', error);
  }
}

// Fonction pour afficher la notification PowerShell
function showPowerShellNotification(action, component, files, details) {
  try {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'notify-update.ps1');

    // Échapper les guillemets et les caractères spéciaux
    const escapeArg = (str) => str.replace(/"/g, '`"').replace(/\$/g, '`$');

    const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -Action "${escapeArg(action)}" -Component "${escapeArg(component)}" -Files "${escapeArg(files)}" -Details "${escapeArg(details)}"`;

    execSync(command, { encoding: 'utf8', stdio: 'inherit' });
  } catch (error) {
    console.error('⚠️  Erreur notification PowerShell:', error.message);
  }
}

// Endpoint pour ajouter un log
app.post('/api/log', async (req, res) => {
  try {
    const { action, summary, details, status, component, files } = req.body;

    if (!sheetsClient) {
      throw new Error('Google Sheets client non initialisé');
    }

    // Fonction pour convertir les valeurs en chaînes simples pour Google Sheets
    const formatValue = (value) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return String(value);
      if (typeof value === 'boolean') return String(value);
      // Pour les objets et arrays, convertir en JSON string
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value, null, 0); // Pas d'indentation
        } catch (e) {
          return String(value);
        }
      }
      return String(value);
    };

    const values = [[
      new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
      formatValue(action),
      formatValue(component),
      formatValue(summary),
      formatValue(details),
      formatValue(files),
      formatValue(status) || 'completed',
      'Claude Assistant'
    ]];

    // D'abord, obtenir la prochaine ligne vide
    const getResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`
    });

    const nextRow = (getResponse.data.values?.length || 0) + 1;
    const targetRange = `${SHEET_NAME}!A${nextRow}:H${nextRow}`;

    // Insérer directement à la ligne spécifique pour éviter tout décalage
    const response = await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: targetRange,
      valueInputOption: 'RAW',
      resource: { values }
    });

    console.log(`📝 Log ajouté à Google Sheets: ${formatValue(action)}`);
    console.log(`✅ Ligne ${nextRow} ajoutée:`, response.data.updatedRange);

    // Afficher les détails du log pour débogage
    console.log('');
    console.log('================================================================================');
    console.log('  LOG GOOGLE SHEETS ENREGISTRÉ                                                ');
    console.log('================================================================================');
    console.log(`  Date/Heure: ${values[0][0]}`);
    console.log(`  Action:     ${values[0][1]}`);
    console.log(`  Composant:  ${values[0][2]}`);
    if (values[0][3]) console.log(`  Résumé:     ${values[0][3]}`);
    if (values[0][4]) console.log(`  Détails:    ${values[0][4].substring(0, 100)}${values[0][4].length > 100 ? '...' : ''}`);
    if (values[0][5]) console.log(`  Fichiers:   ${values[0][5]}`);
    console.log('================================================================================');
    console.log(`  Lien: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=0            `);
    console.log('================================================================================');
    console.log('');

    // Afficher la notification PowerShell avec formatage
    const formattedFiles = typeof files === 'string' ? files : formatValue(files);
    const formattedDetails = typeof details === 'string'
      ? details.substring(0, 100)
      : formatValue(details).substring(0, 100);

    showPowerShellNotification(
      formatValue(action) || 'Mise à jour',
      formatValue(component) || 'Application',
      formattedFiles,
      formattedDetails
    );

    // Sauvegarder localement en backup
    saveLocalLog({
      timestamp: values[0][0],
      action: values[0][1],
      component: values[0][2],
      summary: values[0][3],
      details: values[0][4],
      files: values[0][5],
      status: values[0][6]
    });

    res.json({
      success: true,
      message: 'Log ajouté à Google Sheets',
      spreadsheet: SPREADSHEET_ID,
      range: response.data.updatedRange || targetRange
    });

  } catch (error) {
    console.error('❌ Erreur ajout log:', error);

    // En cas d'erreur, sauvegarder quand même localement
    try {
      saveLocalLog({
        timestamp: new Date().toISOString(),
        action: formatValue(action),
        component: formatValue(component),
        summary: formatValue(summary),
        details: formatValue(details),
        files: formatValue(files),
        status: formatValue(status),
        error: error.message
      });
    } catch (localError) {
      console.error('❌ Impossible de sauvegarder localement:', localError.message);
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

// Fonction pour sauvegarder le log localement
function saveLocalLog(logData) {
  try {
    // Créer le dossier tracking s'il n'existe pas
    const trackingDir = path.dirname(LOCAL_LOG_PATH);
    if (!fs.existsSync(trackingDir)) {
      fs.mkdirSync(trackingDir, { recursive: true });
    }

    const logEntry = `[${new Date().toISOString()}] ${JSON.stringify(logData, null, 2)}\n\n`;
    fs.appendFileSync(LOCAL_LOG_PATH, logEntry, 'utf8');
    console.log(`Log local sauvegarde: ${LOCAL_LOG_PATH}`);
  } catch (error) {
    console.error('❌ Erreur sauvegarde locale:', error.message);
  }
}

// Endpoint de test
app.get('/api/test', async (req, res) => {
  try {
    if (!sheetsClient) {
      throw new Error('Google Sheets client non initialisé');
    }

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:H`
    });

    res.json({
      success: true,
      message: 'Google Sheets accessible',
      rows: response.data.values?.length || 0,
      spreadsheet: SPREADSHEET_ID
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint de santé
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Google Sheets Logger',
    spreadsheet: SPREADSHEET_ID,
    sheet: SHEET_NAME
  });
});

// Démarrer le serveur
app.listen(PORT, async () => {
  console.log(`\n🚀 Serveur Google Sheets Logger démarré sur http://localhost:${PORT}`);
  console.log('📊 Spreadsheet ID:', SPREADSHEET_ID);
  console.log('📄 Feuille:', SHEET_NAME);
  console.log('🔑 Credentials:', CREDENTIALS_PATH);
  console.log('\n⏳ Initialisation Google Sheets...');

  try {
    await initGoogleSheets();
    await checkSheetExists();
    console.log('\n✅ Serveur prêt à recevoir les logs\n');
  } catch (error) {
    console.error('\n❌ Erreur initialisation:', error);
    console.log('\nVérifiez que:');
    console.log('1. Le fichier credentials existe');
    console.log('2. Le service account a accès au spreadsheet');
    console.log('3. L\'API Google Sheets est activée\n');
  }
});