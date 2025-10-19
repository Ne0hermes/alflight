/**
 * Service de logging des mises à jour vers Google Drive
 * Crée automatiquement des documents de suivi dans Google Drive
 */

class UpdateLoggerService {
  constructor() {
    this.logs = JSON.parse(localStorage.getItem('updateLogs') || '[]');
    this.driveEnabled = localStorage.getItem('driveLoggingEnabled') === 'true';
    this.folderId = localStorage.getItem('driveFolderId') || '';

    // Configuration Google Drive API
    this.CLIENT_ID = localStorage.getItem('googleClientId') || '';
    this.API_KEY = localStorage.getItem('googleApiKey') || '';
    this.DISCOVERY_DOCS = [
      'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
      'https://docs.googleapis.com/$discovery/rest?version=v1'
    ];
    this.SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents';

    this.isInitialized = false;
    this.isSignedIn = false;
  }

  /**
   * Initialise l'API Google
   */
  async initialize() {
    if (!this.CLIENT_ID || !this.API_KEY) {
            return false;
    }

    try {
      await this.loadGoogleAPI();
      await window.gapi.client.init({
        apiKey: this.API_KEY,
        clientId: this.CLIENT_ID,
        discoveryDocs: this.DISCOVERY_DOCS,
        scope: this.SCOPES
      });

      // Vérifier l'état de connexion
      this.isSignedIn = window.gapi.auth2.getAuthInstance().isSignedIn.get();
      this.isInitialized = true;

      if (!this.isSignedIn) {
        await this.signIn();
      }

      return true;
    } catch (error) {
      console.error('Erreur d\'initialisation Google API:', error);
      return false;
    }
  }

  /**
   * Charge l'API Google
   */
  loadGoogleAPI() {
    return new Promise((resolve, reject) => {
      if (window.gapi && window.gapi.client) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('client:auth2', resolve);
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  /**
   * Connexion à Google
   */
  async signIn() {
    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signIn();
      this.isSignedIn = true;
            return true;
    } catch (error) {
      console.error('Erreur de connexion:', error);
      return false;
    }
  }

  /**
   * Crée un log de mise à jour et l'envoie vers Google Drive
   */
  async logUpdate(updateData) {
    const log = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleString('fr-FR'),
      title: updateData.title || 'Mise à jour',
      summary: updateData.summary || '',
      details: updateData.details || [],
      features: updateData.features || [],
      fixes: updateData.fixes || [],
      filesModified: updateData.filesModified || [],
      author: 'Claude Assistant',
      version: updateData.version || '1.0.0'
    };

    // Sauvegarder localement
    this.logs.push(log);
    localStorage.setItem('updateLogs', JSON.stringify(this.logs));

    // Envoyer vers Google Drive si activé
    if (this.driveEnabled && this.isInitialized) {
      await this.sendToGoogleDrive(log);
    }

    return log;
  }

  /**
   * Envoie un log vers Google Drive
   */
  async sendToGoogleDrive(log) {
    if (!this.isSignedIn) {
            return false;
    }

    try {
      // Créer le contenu du document
      const content = this.formatLogAsDocument(log);

      // Créer un nouveau Google Doc
      const doc = await this.createGoogleDoc(log.title, content);

      // Déplacer dans le dossier spécifié si configuré
      if (this.folderId && doc.id) {
        await this.moveToFolder(doc.id, this.folderId);
      }

            return doc;
    } catch (error) {
      console.error('Erreur envoi Google Drive:', error);
      return false;
    }
  }

  /**
   * Crée un Google Doc avec le contenu du log
   */
  async createGoogleDoc(title, content) {
    const metadata = {
      name: `[LOG] ${title} - ${new Date().toLocaleDateString('fr-FR')}`,
      mimeType: 'application/vnd.google-apps.document'
    };

    const fileContent = new Blob([content], { type: 'text/html' });

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileContent);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token}`
      },
      body: form
    });

    return response.json();
  }

  /**
   * Déplace un fichier dans un dossier
   */
  async moveToFolder(fileId, folderId) {
    try {
      await window.gapi.client.drive.files.update({
        fileId: fileId,
        addParents: folderId,
        fields: 'id, parents'
      });
          } catch (error) {
      console.error('Erreur déplacement:', error);
    }
  }

  /**
   * Formate le log en HTML pour Google Docs
   */
  formatLogAsDocument(log) {
    let html = `
      <html>
        <body>
          <h1>${log.title}</h1>
          <p><strong>Date:</strong> ${log.date}</p>
          <p><strong>Version:</strong> ${log.version}</p>
          <p><strong>Auteur:</strong> ${log.author}</p>

          <hr>

          <h2>📝 Résumé</h2>
          <p>${log.summary}</p>
    `;

    if (log.features.length > 0) {
      html += `
        <h2>✨ Nouvelles fonctionnalités</h2>
        <ul>
      `;
      log.features.forEach(feature => {
        html += `<li>${feature}</li>`;
      });
      html += '</ul>';
    }

    if (log.fixes.length > 0) {
      html += `
        <h2>🐛 Corrections</h2>
        <ul>
      `;
      log.fixes.forEach(fix => {
        html += `<li>${fix}</li>`;
      });
      html += '</ul>';
    }

    if (log.details.length > 0) {
      html += `
        <h2>📋 Détails techniques</h2>
        <ul>
      `;
      log.details.forEach(detail => {
        html += `<li>${detail}</li>`;
      });
      html += '</ul>';
    }

    if (log.filesModified.length > 0) {
      html += `
        <h2>📁 Fichiers modifiés</h2>
        <ul>
      `;
      log.filesModified.forEach(file => {
        html += `<li><code>${file}</code></li>`;
      });
      html += '</ul>';
    }

    html += `
          <hr>
          <p><small>Log généré automatiquement le ${log.date}</small></p>
        </body>
      </html>
    `;

    return html;
  }

  /**
   * Configure le service
   */
  configure(config) {
    if (config.clientId) {
      this.CLIENT_ID = config.clientId;
      localStorage.setItem('googleClientId', config.clientId);
    }
    if (config.apiKey) {
      this.API_KEY = config.apiKey;
      localStorage.setItem('googleApiKey', config.apiKey);
    }
    if (config.folderId !== undefined) {
      this.folderId = config.folderId;
      localStorage.setItem('driveFolderId', config.folderId);
    }
    if (config.enabled !== undefined) {
      this.driveEnabled = config.enabled;
      localStorage.setItem('driveLoggingEnabled', config.enabled.toString());
    }
  }

  /**
   * Récupère tous les logs
   */
  getAllLogs() {
    return this.logs;
  }

  /**
   * Exporte les logs en JSON
   */
  exportLogsAsJSON() {
    const dataStr = JSON.stringify(this.logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `update-logs-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  }

  /**
   * Enregistre la dernière mise à jour (édition d'images)
   */
  async logLastImageEditorUpdate() {
    const updateData = {
      title: 'Système d\'édition d\'images - Refonte complète',
      version: '2.0.0',
      summary: 'Refonte complète du composant ImageEditor avec correction des bugs et ajout de nouvelles fonctionnalités pour améliorer l\'expérience utilisateur.',
      features: [
        'Cadre de visualisation bleu en pointillés montrant la zone visible',
        'Zone assombrie autour du cadre pour le recadrage',
        'Formes adaptées (circulaire pour pilote, rectangulaire pour avion)',
        'Zoom par boutons et molette (30% à 500%)',
        'Rotation par pas de 90°',
        'Bouton de réinitialisation',
        'Mode plein écran pour l\'édition',
        'Instructions claires pour l\'utilisateur',
        'Indicateurs visuels en temps réel'
      ],
      fixes: [
        'Correction du problème d\'édition qui ne fonctionnait pas',
        'Gestion correcte du chargement des images',
        'Amélioration de la réactivité des contrôles',
        'Correction des erreurs de positionnement'
      ],
      details: [
        'Implémentation d\'un système de drag & drop fluide',
        'Ajout d\'un overlay sombre pour le mode édition',
        'Gestion des événements souris optimisée',
        'Support des formes circle, square et rectangle',
        'Sauvegarde des paramètres de zoom et position'
      ],
      filesModified: [
        'src/components/ImageEditor.jsx',
        'src/features/pilot/components/PilotProfile.jsx',
        'src/features/aircraft/components/wizard-steps/Step1BasicInfo.jsx'
      ]
    };

    return await this.logUpdate(updateData);
  }
}

// Créer l'instance singleton
const updateLogger = new UpdateLoggerService();

// Fonctions exportées
export const logUpdate = (data) => updateLogger.logUpdate(data);
export const configureLogger = (config) => updateLogger.configure(config);
export const initializeLogger = () => updateLogger.initialize();
export const exportLogs = () => updateLogger.exportLogsAsJSON();

// Enregistrer automatiquement la dernière mise à jour
if (typeof window !== 'undefined') {
  window.updateLogger = updateLogger;

  // Attendre que la page soit chargée
  window.addEventListener('load', async () => {
    // Vérifier si la dernière mise à jour a déjà été loggée
    const lastLogged = localStorage.getItem('lastImageEditorUpdateLogged');
    if (!lastLogged) {
      await updateLogger.logLastImageEditorUpdate();
      localStorage.setItem('lastImageEditorUpdateLogged', 'true');
    }
  });
}

export default updateLogger;