/**
 * Service de logging automatique direct vers Google Sheets
 * Utilise le serveur backend pour l'authentification avec Service Account
 */

class DirectGoogleSheetsLogger {
  constructor() {
    this.serverUrl = 'http://localhost:3001';
    this.queue = [];
    this.isProcessing = false;

    // Charger la file d'attente sauvegardée
    this.loadQueue();

    // Démarrer le traitement automatique
    this.startAutoProcessing();

    // Vérifier la connexion au serveur
    this.checkServerHealth();

      }

  /**
   * Vérifie que le serveur backend est accessible
   */
  async checkServerHealth() {
    try {
      const response = await fetch(`${this.serverUrl}/health`);
      const data = await response.json();

          } catch (error) {
                }
  }

  /**
   * Envoie un log vers Google Sheets
   */
  async log(action, summary, details = {}) {
    const logEntry = {
      action: action,
      component: details.component || window.location.pathname,
      summary: summary,
      details: typeof details === 'object' ? JSON.stringify(details) : details,
      files: Array.isArray(details.files) ? details.files.join(', ') : '',
      status: details.status || 'completed',
      timestamp: new Date().toISOString()
    };

    // Ajouter à la file d'attente
    this.queue.push(logEntry);
    this.saveQueue();

    // Traiter immédiatement si possible
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Traite la file d'attente
   */
  async processQueue() {
    if (this.queue.length === 0 || this.isProcessing) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const entry = this.queue[0];

      try {
        const response = await fetch(`${this.serverUrl}/api/log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(entry)
        });

        if (response.ok) {
                    this.queue.shift(); // Retirer de la file
        } else {
          throw new Error('Erreur serveur');
        }
      } catch (error) {

        break; // Arrêter et réessayer plus tard
      }

      // Petit délai entre les envois
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
    this.saveQueue();
  }

  /**
   * Sauvegarde la file d'attente
   */
  saveQueue() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sheetsLoggerQueue', JSON.stringify(this.queue));
    }
  }

  /**
   * Charge la file d'attente
   */
  loadQueue() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('sheetsLoggerQueue');
      if (saved) {
        try {
          this.queue = JSON.parse(saved);
                  } catch (e) {
          this.queue = [];
        }
      }
    }
  }

  /**
   * Démarre le traitement automatique périodique
   */
  startAutoProcessing() {
    // Traiter la file toutes les 10 secondes
    setInterval(() => {
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }, 10000);

    // Traiter immédiatement s'il y a des logs en attente
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 2000);
    }
  }

  /**
   * Méthodes utilitaires pour différents types de logs
   */
  logUpdate(summary, details) {
    this.log('Mise à jour', summary, details);
  }

  logError(error, component) {
    this.log('Erreur', error.message || error, {
      component: component,
      stack: error.stack,
      status: 'error'
    });
  }

  logAction(action, summary, component, files = []) {
    this.log(action, summary, {
      component: component,
      files: files,
      status: 'completed'
    });
  }
}

// Créer l'instance singleton
const logger = new DirectGoogleSheetsLogger();

// Exposer globalement pour utilisation
if (typeof window !== 'undefined') {
  window.sheetsLogger = logger;

  // Logger automatiquement les erreurs
  window.addEventListener('error', (event) => {
    logger.logError(event.error || event.message, event.filename);
  });

  // Logger automatiquement les changements de route
  let lastPath = window.location.pathname;
  setInterval(() => {
    if (window.location.pathname !== lastPath) {
      logger.log('Navigation', `Navigation vers ${window.location.pathname}`, {
        from: lastPath,
        to: window.location.pathname
      });
      lastPath = window.location.pathname;
    }
  }, 1000);
}

// Envoyer un log initial pour confirmer que le système fonctionne
setTimeout(() => {
  logger.log(
    'Système initialisé',
    'Service de logging Google Sheets direct activé',
    {
      component: 'directGoogleSheetsLogger.js',
      status: 'initialized'
    }

  // Logger la correction du zoom (dernière mise à jour)
  logger.log(
    'Correction appliquée',
    'Problème de zoom dans l\'éditeur d\'images corrigé',
    {
      component: 'ImageEditor.jsx',
      files: ['src/components/ImageEditor.jsx'],
      details: 'Le zoom fonctionne maintenant correctement, les photos ne sont plus tronquées'
    }
}, 3000);

export default logger;