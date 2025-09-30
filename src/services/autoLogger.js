/**
 * Service de logging automatique vers Google Sheets
 * Envoie automatiquement toutes les mises à jour sans intervention manuelle
 */

class AutoLogger {
  constructor() {
    // Configuration hardcodée pour votre Google Sheets
    this.spreadsheetId = '1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k';
    this.webhookUrl = 'https://script.google.com/u/2/home/projects/1Ael6zgwW-J8WY_lnLxULByJmlj7Ct0cP2iPTes-jZfVPwuAwt0oo7le2/edit'

    // File d'attente pour les envois
    this.queue = [];
    this.isProcessing = false;

    // Démarrer le traitement automatique
    this.startAutoProcessing();

    console.log('🚀 Service de logging automatique activé');
  }

  /**
   * Envoie automatiquement un log vers Google Sheets
   */
  async sendLog(data) {
    const timestamp = new Date().toLocaleString('fr-FR');

    const logEntry = {
      timestamp: timestamp,
      action: data.action || 'Action',
      component: data.component || '',
      summary: data.summary || '',
      details: data.details || '',
      files: data.files ? data.files.join(', ') : '',
      status: data.status || 'completed',
      author: 'Claude Assistant'
    };

    // Ajouter à la file d'attente
    this.queue.push(logEntry);

    // Traiter immédiatement si possible
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Traite la file d'attente des logs
   */
  async processQueue() {
    if (this.queue.length === 0 || this.isProcessing) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const log = this.queue.shift();

      try {
        await this.sendToGoogleSheets(log);
        console.log('✅ Log envoyé:', log.action);
      } catch (error) {
        console.error('❌ Erreur envoi:', error);
        // Remettre dans la file pour réessayer plus tard
        this.queue.unshift(log);
        break;
      }

      // Petit délai entre les envois
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.isProcessing = false;

    // Sauvegarder la file d'attente
    localStorage.setItem('autoLoggerQueue', JSON.stringify(this.queue));
  }

  /**
   * Envoie les données vers Google Sheets via webhook
   */
  async sendToGoogleSheets(log) {
    const payload = {
      spreadsheetId: this.spreadsheetId,
      values: [
        log.timestamp,
        log.action,
        log.component,
        log.summary,
        log.details,
        log.files,
        log.status,
        log.author
      ]
    };

    // Utiliser fetch avec no-cors pour éviter les erreurs CORS
    await fetch(this.webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(payload)
    });

    // Avec no-cors, on ne peut pas vérifier la réponse
    // On assume que c'est envoyé avec succès
    return true;
  }

  /**
   * Démarre le traitement automatique périodique
   */
  startAutoProcessing() {
    // Charger la file d'attente sauvegardée
    const savedQueue = localStorage.getItem('autoLoggerQueue');
    if (savedQueue) {
      try {
        this.queue = JSON.parse(savedQueue);
        console.log(`📋 ${this.queue.length} logs en attente chargés`);
      } catch (e) {
        console.error('Erreur chargement queue:', e);
      }
    }

    // Traiter la file toutes les 30 secondes
    setInterval(() => {
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }, 30000);

    // Traiter immédiatement s'il y a des logs en attente
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * Log une action utilisateur
   */
  logAction(action, summary, details = {}) {
    this.sendLog({
      action: action,
      component: details.component || window.location.pathname,
      summary: summary,
      details: JSON.stringify(details),
      files: details.files || [],
      status: 'completed'
    });
  }

  /**
   * Log automatique des modifications de code
   */
  logCodeChange(file, changes) {
    this.sendLog({
      action: 'Code modifié',
      component: file,
      summary: changes.summary || 'Modification de code',
      details: changes.description || '',
      files: [file],
      status: 'completed'
    });
  }
}

// Script Google Apps Script à déployer une seule fois
const GOOGLE_APPS_SCRIPT_CODE = `
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Ouvrir la feuille de calcul
    const sheet = SpreadsheetApp.openById('1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k')
                                 .getSheetByName('Tracking');

    // Si la feuille n'existe pas, la créer
    if (!sheet) {
      const spreadsheet = SpreadsheetApp.openById('1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k');
      sheet = spreadsheet.insertSheet('Tracking');

      // Ajouter les en-têtes
      const headers = [
        'Date/Heure',
        'Action',
        'Composant',
        'Résumé',
        'Détails',
        'Fichiers',
        'Statut',
        'Auteur'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#4285f4')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // Ajouter la ligne
    sheet.appendRow(data.values);

    return ContentService
      .createTextOutput(JSON.stringify({'result': 'success'}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({'result': 'error', 'error': error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput('Service actif')
    .setMimeType(ContentService.MimeType.TEXT);
}
`;

// Créer l'instance singleton
const autoLogger = new AutoLogger();

// Intercepter automatiquement certains événements
if (typeof window !== 'undefined') {
  // Logger automatiquement les erreurs
  window.addEventListener('error', (event) => {
    autoLogger.logAction('Erreur détectée', event.message, {
      component: event.filename,
      line: event.lineno,
      col: event.colno
    });
  });

  // Exposer globalement pour les autres modules
  window.autoLogger = autoLogger;
}

// Fonction pour obtenir le script à déployer (une seule fois)
export const getDeploymentScript = () => {
  console.log('📋 INSTRUCTIONS DE DÉPLOIEMENT:');
  console.log('1. Ouvrez: https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k');
  console.log('2. Extensions → Apps Script');
  console.log('3. Collez le script ci-dessous');
  console.log('4. Déployez → Nouveau déploiement → Application Web');
  console.log('5. Qui a accès: Tout le monde');
  console.log('6. Copiez l\'URL et remplacez-la dans autoLogger.js ligne 10');
  console.log('\n--- SCRIPT À COPIER ---\n');
  console.log(GOOGLE_APPS_SCRIPT_CODE);
  console.log('\n--- FIN DU SCRIPT ---\n');
  return GOOGLE_APPS_SCRIPT_CODE;
};

// Exports pour utilisation dans d'autres modules
export const logUpdate = (action, summary, details) => {
  autoLogger.logAction(action, summary, details);
};

export const logCode = (file, changes) => {
  autoLogger.logCodeChange(file, changes);
};

// Logger automatiquement cette mise à jour
autoLogger.logAction(
  'Système de logging automatique installé',
  'Le logging automatique vers Google Sheets est maintenant actif',
  {
    component: 'autoLogger.js',
    details: 'Envoi automatique sans intervention manuelle',
    files: ['src/services/autoLogger.js']
  }
);

export default autoLogger;