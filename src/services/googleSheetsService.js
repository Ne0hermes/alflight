/**
 * Service d'intégration avec Google Sheets utilisant un Service Account
 * Utilise les credentials JSON pour l'authentification
 */

class GoogleSheetsService {
  constructor() {
    // ID de votre spreadsheet
    this.spreadsheetId = '1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k';
    this.sheetName = 'Tracking';

    // Service Account credentials
    this.credentials = null;
    this.accessToken = null;
    this.tokenExpiry = null;

    // Configuration
    this.isEnabled = localStorage.getItem('sheetsServiceEnabled') === 'true';
    this.queue = JSON.parse(localStorage.getItem('sheetsQueue') || '[]');

    // Auto-load credentials if available
    this.loadCredentials();
  }

  /**
   * Charge les credentials depuis le localStorage ou un fichier
   */
  loadCredentials() {
    const savedCreds = localStorage.getItem('googleServiceAccountCreds');
    if (savedCreds) {
      try {
        this.credentials = JSON.parse(savedCreds);
              } catch (e) {
        console.error('Erreur lors du chargement des credentials:', e);
      }
    }
  }

  /**
   * Configure le service avec les credentials du fichier JSON
   */
  setCredentials(credentialsJson) {
    this.credentials = credentialsJson;
    localStorage.setItem('googleServiceAccountCreds', JSON.stringify(credentialsJson));
      }

  /**
   * Active/désactive le service
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    localStorage.setItem('sheetsServiceEnabled', enabled.toString());
  }

  /**
   * Obtient un access token en utilisant le Service Account
   * Note: En production, ceci devrait être fait côté serveur pour sécuriser la clé privée
   */
  async getAccessToken() {
    if (!this.credentials) {
      throw new Error('Credentials non configurés');
    }

    // Vérifier si le token est encore valide
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Pour un Service Account, nous devons utiliser un serveur backend
    // car la signature JWT nécessite la clé privée qui ne doit pas être exposée côté client
    // Ici, nous utilisons une approche simplifiée avec un proxy ou une Cloud Function

    try {
      // Option 1: Utiliser une Cloud Function ou un endpoint backend
      const response = await fetch('YOUR_BACKEND_ENDPOINT/get-sheets-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentials: this.credentials
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'obtention du token');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000));

      return this.accessToken;
    } catch (error) {
      console.error('Erreur d\'authentification:', error);

      // Option 2: Utiliser l'API Key publique (moins sécurisé mais fonctionne côté client)
      // Cette méthode utilise une approche différente sans Service Account
      return null;
    }
  }

  /**
   * Envoie des données vers Google Sheets via l'API
   */
  async appendToSheet(values) {
    if (!this.isEnabled) {
            return false;
    }

    try {
      // Pour l'instant, utiliser l'approche avec webhook Google Apps Script
      // car l'authentification Service Account nécessite un backend
      return await this.sendViaWebhook(values);
    } catch (error) {
      console.error('Erreur envoi Google Sheets:', error);
      this.addToQueue(values);
      return false;
    }
  }

  /**
   * Méthode alternative: utiliser un webhook Google Apps Script
   */
  async sendViaWebhook(values) {
    // URL du webhook déployé (à configurer)
    const webhookUrl = localStorage.getItem('googleScriptWebhookUrl') || '';

    if (!webhookUrl) {
            return false;
    }

    const payload = {
      spreadsheetId: this.spreadsheetId,
      sheetName: this.sheetName,
      values: values,
      timestamp: new Date().toISOString()
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(payload)
      });

            return true;
    } catch (error) {
      console.error('Erreur webhook:', error);
      return false;
    }
  }

  /**
   * Ajoute des données à la file d'attente
   */
  addToQueue(data) {
    this.queue.push({
      data: data,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('sheetsQueue', JSON.stringify(this.queue));

  }

  /**
   * Traite la file d'attente
   */
  async processQueue() {
    if (this.queue.length === 0) return;

    
    const processed = [];
    const failed = [];

    for (const item of this.queue) {
      try {
        const success = await this.appendToSheet(item.data);
        if (success) {
          processed.push(item);
        } else {
          failed.push(item);
        }
      } catch (error) {
        failed.push(item);
      }
    }

    this.queue = failed;
    localStorage.setItem('sheetsQueue', JSON.stringify(this.queue));

      }

  /**
   * Envoie un résumé de tâche formaté
   */
  async logTaskSummary(summary, details = {}) {
    const row = [
      new Date().toLocaleString('fr-FR'),
      details.taskName || 'Tâche',
      details.status || 'completed',
      details.component || '',
      summary,
      details.description || '',
      details.filesModified ? details.filesModified.join(', ') : '',
      details.errors || 'Aucune',
      details.duration || '',
      'Claude Assistant'
    ];

    return await this.appendToSheet(row);
  }

  /**
   * Enregistre la dernière mise à jour (ImageEditor)
   */
  async logImageEditorUpdate() {
    const summary = `Correction du zoom dans l'éditeur d'images:
    - Résolu: Le zoom fonctionne maintenant correctement pour les photos de profil
    - Ajusté: objectFit dynamique selon le niveau de zoom
    - Amélioré: Gestion des dimensions pour les formes circulaires
    - Corrigé: Les photos ne sont plus tronquées lors du zoom`;

    return await this.logTaskSummary(summary, {
      taskName: 'Correction ImageEditor',
      component: 'ImageEditor.jsx',
      filesModified: ['src/components/ImageEditor.jsx'],
      status: 'completed'
    });
  }
}

// Script Google Apps Script à déployer
const GOOGLE_APPS_SCRIPT = `
/**
 * Script Google Apps Script pour recevoir les données
 * À copier dans votre projet Google Apps Script
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Ouvrir la feuille
    const sheet = SpreadsheetApp.openById(data.spreadsheetId)
      .getSheetByName(data.sheetName);

    // Ajouter les données
    if (data.values && Array.isArray(data.values)) {
      sheet.appendRow(data.values);
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        'result': 'success',
        'row': data.values,
        'timestamp': data.timestamp

      .setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        'result': 'error',
        'error': error.toString()

      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput('Service de tracking actif')
    .setMimeType(ContentService.MimeType.TEXT);
}
`;

// Instance singleton
const sheetsService = new GoogleSheetsService();

// Exposer globalement pour debug
if (typeof window !== 'undefined') {
  window.sheetsService = sheetsService;
);}

// Exports
export const configureSheetsService = (credentials) => {
  sheetsService.setCredentials(credentials);
};

export const enableSheetsService = (enabled) => {
  sheetsService.setEnabled(enabled);
};

export const logToSheets = (summary, details) => {
  return sheetsService.logTaskSummary(summary, details);
};

export const getGoogleAppsScript = () => GOOGLE_APPS_SCRIPT;

export default sheetsService;