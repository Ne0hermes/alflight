// Service de tracking des tâches avec Google Sheets
class TaskTrackingService {
  constructor() {
    // ID de votre Google Sheets
    this.spreadsheetId = '1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k';
    this.sheetName = 'Tracking'; // Nom de la feuille

    // Configuration de l'API (à remplacer par vos propres clés)
    this.apiKey = process.env.REACT_APP_GOOGLE_API_KEY || '';
    this.clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

    // URL de l'API Google Sheets
    this.baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

    // File d'attente des tâches à envoyer
    this.taskQueue = [];

    // État de la connexion
    this.isAuthenticated = false;
  }

  /**
   * Initialise le service avec l'authentification Google
   */
  async initialize() {
    try {
      // Charger l'API Google
      await this.loadGoogleAPI();

      // Authentifier l'utilisateur
      await this.authenticate();

      console.log('Service de tracking initialisé avec succès');
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du service de tracking:', error);
      return false;
    }
  }

  /**
   * Charge l'API Google
   */
  async loadGoogleAPI() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('client:auth2', async () => {
          try {
            await window.gapi.client.init({
              apiKey: this.apiKey,
              clientId: this.clientId,
              discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
              scope: 'https://www.googleapis.com/auth/spreadsheets'
            });
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  /**
   * Authentifie l'utilisateur avec Google
   */
  async authenticate() {
    try {
      const authInstance = window.gapi.auth2.getAuthInstance();

      if (!authInstance.isSignedIn.get()) {
        await authInstance.signIn();
      }

      this.isAuthenticated = true;
      return true;
    } catch (error) {
      console.error('Erreur d\'authentification:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * Enregistre un résumé de tâche dans Google Sheets
   * @param {Object} taskData - Données de la tâche
   */
  async logTaskCompletion(taskData) {
    const {
      taskName,
      status,
      startTime,
      endTime,
      duration,
      summary,
      details,
      errors,
      filesModified
    } = taskData;

    // Formater les données pour Google Sheets
    const row = [
      new Date().toLocaleString('fr-FR'), // Date/heure
      taskName || 'Tâche sans nom',
      status || 'completed',
      startTime ? new Date(startTime).toLocaleString('fr-FR') : '',
      endTime ? new Date(endTime).toLocaleString('fr-FR') : '',
      duration || '',
      summary || '',
      details || '',
      errors || 'Aucune',
      filesModified ? filesModified.join(', ') : ''
    ];

    try {
      // Si pas authentifié, mettre en file d'attente
      if (!this.isAuthenticated) {
        this.taskQueue.push(row);
        console.log('Tâche mise en file d\'attente (non authentifié)');
        return false;
      }

      // Envoyer vers Google Sheets
      await this.appendToSheet(row);

      // Traiter la file d'attente si elle existe
      if (this.taskQueue.length > 0) {
        await this.processQueue();
      }

      return true;
    } catch (error) {
      console.error('Erreur lors de l\'envoi vers Google Sheets:', error);
      this.taskQueue.push(row);
      return false;
    }
  }

  /**
   * Ajoute une ligne dans Google Sheets
   */
  async appendToSheet(row) {
    if (!window.gapi || !window.gapi.client) {
      throw new Error('API Google non disponible');
    }

    const range = `${this.sheetName}!A:J`;

    const response = await window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [row]
      }
    });

    console.log('Données envoyées vers Google Sheets:', response.result);
    return response.result;
  }

  /**
   * Traite la file d'attente des tâches
   */
  async processQueue() {
    if (this.taskQueue.length === 0) return;

    console.log(`Traitement de ${this.taskQueue.length} tâches en attente...`);

    const rows = [...this.taskQueue];
    this.taskQueue = [];

    try {
      const range = `${this.sheetName}!A:J`;

      await window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: rows
        }
      });

      console.log(`${rows.length} tâches envoyées avec succès`);
    } catch (error) {
      console.error('Erreur lors du traitement de la file d\'attente:', error);
      // Remettre les tâches en file d'attente
      this.taskQueue = [...rows, ...this.taskQueue];
    }
  }

  /**
   * Enregistre une tâche terminée avec résumé
   */
  async trackCompletedTask(taskName, summary, details = {}) {
    const taskData = {
      taskName,
      status: 'completed',
      startTime: details.startTime || new Date(),
      endTime: new Date(),
      duration: details.duration || 'N/A',
      summary,
      details: details.description || '',
      errors: details.errors || 'Aucune',
      filesModified: details.filesModified || []
    };

    return await this.logTaskCompletion(taskData);
  }

  /**
   * Format simplifié pour les résumés de fin de tâche
   */
  async logTaskSummary(summary) {
    const row = [
      new Date().toLocaleString('fr-FR'),
      'Résumé automatique',
      'info',
      '',
      '',
      '',
      summary,
      '',
      '',
      ''
    ];

    try {
      if (this.isAuthenticated) {
        await this.appendToSheet(row);
      } else {
        this.taskQueue.push(row);
        console.log('Résumé mis en file d\'attente');
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du résumé:', error);
    }
  }

  /**
   * Méthode alternative utilisant fetch (sans authentification OAuth)
   * Pour utiliser avec une Google Apps Script Web App
   */
  async sendViaWebhook(taskData) {
    // URL de votre Google Apps Script Web App (à créer)
    const webhookUrl = process.env.REACT_APP_GOOGLE_SCRIPT_URL || '';

    if (!webhookUrl) {
      console.warn('URL du webhook Google Scripts non configurée');
      return false;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId: this.spreadsheetId,
          sheetName: this.sheetName,
          data: taskData
        })
      });

      console.log('Données envoyées via webhook');
      return true;
    } catch (error) {
      console.error('Erreur webhook:', error);
      return false;
    }
  }
}

// Créer une instance singleton
const taskTrackingService = new TaskTrackingService();

// Fonction utilitaire pour enregistrer rapidement un résumé
export const logTaskSummary = async (summary) => {
  if (!taskTrackingService.isAuthenticated) {
    await taskTrackingService.initialize();
  }
  return taskTrackingService.logTaskSummary(summary);
};

// Fonction pour enregistrer une tâche complète
export const trackTask = async (taskName, summary, details) => {
  if (!taskTrackingService.isAuthenticated) {
    await taskTrackingService.initialize();
  }
  return taskTrackingService.trackCompletedTask(taskName, summary, details);
};

export default taskTrackingService;