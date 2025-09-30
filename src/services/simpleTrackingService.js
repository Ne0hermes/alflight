/**
 * Service de tracking simplifié pour envoyer les résumés vers Google Sheets
 * Utilise Google Apps Script comme webhook (sans authentification OAuth)
 */

class SimpleTrackingService {
  constructor() {
    // URL du webhook Google Apps Script (à configurer après déploiement)
    this.webhookUrl = localStorage.getItem('googleScriptUrl') || '';
    this.isEnabled = localStorage.getItem('trackingEnabled') === 'true';

    // File d'attente pour les envois échoués
    this.queue = JSON.parse(localStorage.getItem('trackingQueue') || '[]');

    // Initialiser l'envoi automatique
    this.initAutoSend();
  }

  /**
   * Configure l'URL du webhook
   */
  setWebhookUrl(url) {
    this.webhookUrl = url;
    localStorage.setItem('googleScriptUrl', url);
    console.log('URL du webhook configurée:', url);
  }

  /**
   * Active/désactive le tracking
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    localStorage.setItem('trackingEnabled', enabled.toString());
  }

  /**
   * Envoie un résumé de tâche vers Google Sheets
   */
  async sendTaskSummary(data) {
    if (!this.isEnabled) {
      console.log('Tracking désactivé');
      return false;
    }

    if (!this.webhookUrl) {
      console.warn('URL du webhook non configurée. Ajout à la file d\'attente.');
      this.addToQueue(data);
      return false;
    }

    const payload = {
      taskName: data.taskName || 'Tâche',
      status: data.status || 'completed',
      component: data.component || '',
      action: data.action || '',
      summary: data.summary || '',
      details: data.details || '',
      filesModified: data.filesModified || [],
      errors: data.errors || '',
      duration: data.duration || '',
      timestamp: new Date().toISOString()
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        mode: 'no-cors', // Important pour éviter les erreurs CORS
        headers: {
          'Content-Type': 'text/plain', // Utiliser text/plain pour éviter le preflight CORS
        },
        body: JSON.stringify(payload)
      });

      console.log('Résumé envoyé vers Google Sheets');

      // Traiter la file d'attente si succès
      if (this.queue.length > 0) {
        await this.processQueue();
      }

      return true;
    } catch (error) {
      console.error('Erreur lors de l\'envoi:', error);
      this.addToQueue(payload);
      return false;
    }
  }

  /**
   * Ajoute un élément à la file d'attente
   */
  addToQueue(data) {
    this.queue.push(data);
    localStorage.setItem('trackingQueue', JSON.stringify(this.queue));
    console.log(`Ajouté à la file d\'attente (${this.queue.length} éléments en attente)`);
  }

  /**
   * Traite la file d'attente
   */
  async processQueue() {
    if (this.queue.length === 0 || !this.webhookUrl) return;

    console.log(`Traitement de ${this.queue.length} éléments en file d\'attente...`);

    const queueCopy = [...this.queue];
    this.queue = [];

    for (const item of queueCopy) {
      try {
        await fetch(this.webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: JSON.stringify(item)
        });

        console.log('Élément de la file envoyé');
      } catch (error) {
        console.error('Erreur lors de l\'envoi d\'un élément de la file:', error);
        this.queue.push(item);
      }
    }

    localStorage.setItem('trackingQueue', JSON.stringify(this.queue));
  }

  /**
   * Initialise l'envoi automatique de la file d'attente
   */
  initAutoSend() {
    // Essayer d'envoyer la file d'attente toutes les 5 minutes
    setInterval(() => {
      if (this.queue.length > 0 && this.webhookUrl) {
        this.processQueue();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Méthode helper pour enregistrer une action complétée
   */
  async trackAction(action, summary, details = {}) {
    const data = {
      taskName: action,
      status: 'completed',
      component: details.component || window.location.pathname,
      action: action,
      summary: summary,
      details: details.description || '',
      filesModified: details.files || [],
      errors: details.errors || '',
      duration: details.duration || ''
    };

    return await this.sendTaskSummary(data);
  }

  /**
   * Enregistre automatiquement les résumés de mes actions
   */
  async logMyActionSummary(summary) {
    const data = {
      taskName: 'Action automatique Claude',
      status: 'completed',
      component: 'Assistant',
      action: 'Résumé automatique',
      summary: summary,
      details: '',
      filesModified: [],
      errors: '',
      duration: ''
    };

    return await this.sendTaskSummary(data);
  }
}

// Créer l'instance singleton
const tracker = new SimpleTrackingService();

// Exposer globalement pour debug
window.taskTracker = tracker;

// Export des fonctions utilitaires
export const trackAction = (action, summary, details) => {
  return tracker.trackAction(action, summary, details);
};

export const setTrackingUrl = (url) => {
  tracker.setWebhookUrl(url);
};

export const enableTracking = (enabled) => {
  tracker.setEnabled(enabled);
};

// Fonction spéciale pour mes résumés automatiques
export const logClaudeSummary = (summary) => {
  return tracker.logMyActionSummary(summary);
};

export default tracker;