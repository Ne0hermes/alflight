/**
 * Service de logging automatique pour toutes les modifications Claude
 * Se connecte au Google Sheet via le serveur backend
 */

class ClaudeUpdateLogger {
  constructor() {
    this.serverUrl = 'http://localhost:3001';
    this.isEnabled = true;
    this.pendingLogs = [];
  }

  /**
   * Log une modification de fichier
   */
  async logFileModification(filePath, action, details = '') {
    const fileName = filePath.split(/[\\/]/).pop();
    const fileType = this.getFileType(fileName);

    const logEntry = {
      action: `${action}: ${fileName}`,
      component: this.detectComponent(filePath),
      summary: details || `Modification de ${fileName}`,
      details: `Fichier: ${filePath}\nAction: ${action}\n${details}`,
      files: fileName,
      status: 'completed'
    };

    return await this.sendLog(logEntry);
  }

  /**
   * Log une tâche complétée
   */
  async logTaskCompleted(taskName, details = {}) {
    const logEntry = {
      action: taskName,
      component: details.component || 'Application',
      summary: details.summary || taskName,
      details: details.description || '',
      files: details.filesModified || '',
      status: 'completed'
    };

    return await this.sendLog(logEntry);
  }

  /**
   * Log une erreur corrigée
   */
  async logBugFix(bugDescription, solution, filesAffected = []) {
    const logEntry = {
      action: `Correction: ${bugDescription}`,
      component: this.detectComponent(filesAffected[0] || ''),
      summary: solution,
      details: `Bug: ${bugDescription}\nSolution: ${solution}`,
      files: filesAffected.join(', '),
      status: 'completed'
    };

    return await this.sendLog(logEntry);
  }

  /**
   * Log l'ajout d'une nouvelle fonctionnalité
   */
  async logFeatureAdded(featureName, description, filesModified = []) {
    const logEntry = {
      action: `Nouvelle fonctionnalité: ${featureName}`,
      component: this.detectComponent(filesModified[0] || ''),
      summary: description,
      details: `Fonctionnalité: ${featureName}\n${description}`,
      files: filesModified.join(', '),
      status: 'completed'
    };

    return await this.sendLog(logEntry);
  }

  /**
   * Envoie le log au serveur backend qui se connecte à Google Sheets
   */
  async sendLog(logEntry) {
    if (!this.isEnabled) {
      
      return false;
    }

    try {
      const response = await fetch(`${this.serverUrl}/api/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      // Afficher confirmation PowerShell
      this.showPowerShellConfirmation(logEntry);

      
      return true;

    } catch (error) {
      console.error('❌ Erreur envoi log:', error);
      this.pendingLogs.push(logEntry);
      
      return false;
    }
  }

  /**
   * Affiche une confirmation PowerShell
   */
  showPowerShellConfirmation(logEntry) {
    const timestamp = new Date().toLocaleString('fr-FR');
    const message = `
╔════════════════════════════════════════════════════════════════╗
║  ✅ LOG GOOGLE SHEETS ENREGISTRÉ                              ║
╠════════════════════════════════════════════════════════════════╣
║  📅 Date/Heure: ${timestamp.padEnd(40)} ║
║  🎯 Action:     ${logEntry.action.substring(0, 40).padEnd(40)} ║
║  📦 Composant:  ${logEntry.component.substring(0, 40).padEnd(40)} ║
║  📄 Fichiers:   ${(logEntry.files || 'N/A').substring(0, 40).padEnd(40)} ║
╚════════════════════════════════════════════════════════════════╝
    `.trim();

    
  }

  /**
   * Détecte le composant basé sur le chemin du fichier
   */
  detectComponent(filePath) {
    if (!filePath) return 'Application';

    const path = filePath.toLowerCase();

    if (path.includes('aircraft')) return 'Avions';
    if (path.includes('pilot')) return 'Pilotes';
    if (path.includes('logbook')) return 'Carnet de vol';
    if (path.includes('flight')) return 'Vols';
    if (path.includes('wizard')) return 'Assistant';
    if (path.includes('chart') || path.includes('performance')) return 'Performances';
    if (path.includes('export') || path.includes('import')) return 'Import/Export';
    if (path.includes('stat')) return 'Statistiques';
    if (path.includes('map')) return 'Carte';
    if (path.includes('weather')) return 'Météo';

    return 'Application';
  }

  /**
   * Détecte le type de fichier
   */
  getFileType(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();

    const types = {
      'jsx': 'Composant React',
      'js': 'JavaScript',
      'ts': 'TypeScript',
      'tsx': 'Composant TypeScript',
      'css': 'Styles',
      'json': 'Configuration',
      'md': 'Documentation',
      'html': 'HTML'
    };

    return types[ext] || 'Fichier';
  }

  /**
   * Retente d'envoyer les logs en attente
   */
  async retryPendingLogs() {
    if (this.pendingLogs.length === 0) {
      
      return;
    }

    

    const toRetry = [...this.pendingLogs];
    this.pendingLogs = [];

    for (const log of toRetry) {
      const success = await this.sendLog(log);
      if (!success) {
        // Si l'envoi échoue, il sera ré-ajouté automatiquement
      }
    }

    
  }

  /**
   * Active/désactive le logging
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    
  }
}

// Instance singleton
const logger = new ClaudeUpdateLogger();

// Exposer globalement
if (typeof window !== 'undefined') {
  window.claudeLogger = logger;
);}

// Exports
export const logFileModification = (filePath, action, details) =>
  logger.logFileModification(filePath, action, details);

export const logTaskCompleted = (taskName, details) =>
  logger.logTaskCompleted(taskName, details);

export const logBugFix = (bugDescription, solution, filesAffected) =>
  logger.logBugFix(bugDescription, solution, filesAffected);

export const logFeatureAdded = (featureName, description, filesModified) =>
  logger.logFeatureAdded(featureName, description, filesModified);

export const retryPendingLogs = () =>
  logger.retryPendingLogs();

export const setLoggingEnabled = (enabled) =>
  logger.setEnabled(enabled);

export default logger;
