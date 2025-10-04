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

    const values = [[
      new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
      action || '',
      component || '',
      summary || '',
      details || '',
      files || '',
      status || 'completed',
      'Claude Assistant'
    ]];

    const response = await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:H`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values }
    });

    console.log(`📝 Log ajouté à Google Sheets: ${action}`);
    console.log(`✅ Ligne ajoutée:`, response.data.updates.updatedRange);

    // Afficher la notification PowerShell
    showPowerShellNotification(
      action || 'Mise à jour',
      component || 'Application',
      files || '',
      details ? details.substring(0, 100) : ''
    );

    res.json({
      success: true,
      message: 'Log ajouté à Google Sheets',
      spreadsheet: SPREADSHEET_ID,
      range: response.data.updates.updatedRange
    });

  } catch (error) {
    console.error('❌ Erreur ajout log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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