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

// Charger les credentials du service account
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const SPREADSHEET_ID = '1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k';
const SHEET_NAME = 'Tracking';

let auth;
let sheets;

// Initialiser l'authentification Google
async function initializeGoogle() {
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));

    auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    await auth.authorize();
    sheets = google.sheets({ version: 'v4', auth });

    console.log('✅ Authentification Google Sheets réussie');
    console.log(`📊 Connecté avec: ${credentials.client_email}`);

    // Vérifier que la feuille existe
    await checkSheet();

  } catch (error) {
    console.error('❌ Erreur d\'authentification:', error);
  }
}

// Vérifier/créer la feuille Tracking
async function checkSheet() {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const trackingSheet = response.data.sheets.find(
      sheet => sheet.properties.title === SHEET_NAME
    );

    if (!trackingSheet) {
      console.log('📝 Création de la feuille Tracking...');
      await createTrackingSheet();
    } else {
      console.log('✅ Feuille Tracking trouvée');
    }
  } catch (error) {
    console.error('Erreur vérification feuille:', error);
  }
}

// Créer la feuille Tracking avec les en-têtes
async function createTrackingSheet() {
  try {
    // Ajouter une nouvelle feuille
    await sheets.spreadsheets.batchUpdate({
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
    const headers = [
      ['Date/Heure', 'Action', 'Composant', 'Résumé', 'Détails', 'Fichiers', 'Statut', 'Auteur']
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:H1`,
      valueInputOption: 'RAW',
      resource: {
        values: headers
      }
    });

    console.log('✅ Feuille Tracking créée avec succès');
  } catch (error) {
    console.error('Erreur création feuille:', error);
  }
}

// Endpoint pour ajouter un log
app.post('/api/log', async (req, res) => {
  try {
    if (!sheets) {
      throw new Error('Service non initialise');
    }

    const { action, component, summary, details, files, status } = req.body;

    // Fonction pour retirer les accents et nettoyer les chaines
    const removeAccents = (str) => {
      if (!str) return '';
      // Normaliser et retirer les accents
      return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Retire les accents
        .replace(/[àâä]/gi, 'a')
        .replace(/[éèêë]/gi, 'e')
        .replace(/[îï]/gi, 'i')
        .replace(/[ôö]/gi, 'o')
        .replace(/[ùûü]/gi, 'u')
        .replace(/[ç]/gi, 'c')
        .replace(/[œ]/gi, 'oe')
        .replace(/[æ]/gi, 'ae')
        .replace(/[ñ]/gi, 'n');
    };

    // Fonction pour nettoyer et encoder correctement les chaines
    const cleanString = (str) => {
      if (!str) return '';
      // Retirer les accents puis encoder
      return removeAccents(str);
    };

    // S'assurer que toutes les chaînes sont correctement encodées en UTF-8
    const values = [[
      new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
      cleanString(action),
      cleanString(component),
      cleanString(summary),
      cleanString(details),
      cleanString(files),
      cleanString(status) || 'completed',
      'Claude Assistant'
    ]];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:H`,
      valueInputOption: 'RAW',  // Changé de USER_ENTERED à RAW pour préserver l'encodage
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: values
      }
    });

    console.log(`📝 Log ajoute: ${removeAccents(action)}`);
    res.json({ success: true, data: response.data });

  } catch (error) {
    console.error('Erreur ajout log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint de test
app.get('/api/test', async (req, res) => {
  try {
    if (!sheets) {
      throw new Error('Service non initialisé');
    }

    // Lire les dernières lignes pour vérifier
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:H10`
    });

    res.json({
      success: true,
      message: 'Connexion Google Sheets OK',
      rows: response.data.values?.length || 0
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
    authenticated: !!sheets
  });
});

// Démarrer le serveur
app.listen(PORT, async () => {
  console.log(`\n🚀 Serveur Google Sheets démarré sur http://localhost:${PORT}`);
  console.log('📊 Spreadsheet ID:', SPREADSHEET_ID);
  console.log('📄 Feuille:', SHEET_NAME);
  console.log('\n⏳ Initialisation de Google Sheets...');
  await initializeGoogle();
  console.log('\n✅ Serveur prêt à recevoir les logs\n');
});