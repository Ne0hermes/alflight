/**
 * Excel Tracker avec mise à jour automatique
 * Sauvegarde les logs dans un fichier local et permet l'export Excel
 */

import * as XLSX from 'xlsx';

class ExcelTracker {
  constructor() {
    this.workbook = null;
    this.worksheet = null;
    this.filename = 'alflight_tracking.xlsx';
    this.autoSaveInterval = null;
    this.logs = [];

    // Charger les logs existants depuis localStorage
    this.loadFromStorage();

    // Auto-save toutes les 30 secondes
    this.startAutoSave();
  }

  /**
   * Initialiser ou charger le workbook Excel
   */
  initWorkbook() {
    try {
      // Créer un nouveau workbook
      this.workbook = XLSX.utils.book_new();

      // Créer les headers
      const headers = [
        'Date',
        'Heure',
        'Action',
        'Composant',
        'Détails',
        'Statut',
        'Utilisateur',
        'Version',
        'Durée (ms)'
      ];

      // Convertir les logs en format tableau
      const data = [headers];

      this.logs.forEach(log => {
        const date = new Date(log.timestamp);
        data.push([
          date.toLocaleDateString('fr-FR'),
          date.toLocaleTimeString('fr-FR'),
          log.action || '',
          log.component || '',
          log.details || '',
          log.status || 'completed',
          log.user || 'Developer',
          log.version || '1.0.0',
          log.duration || ''
        ]);
      });

      // Créer le worksheet
      this.worksheet = XLSX.utils.aoa_to_sheet(data);

      // Ajuster les largeurs de colonnes
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 10 }, // Heure
        { wch: 30 }, // Action
        { wch: 25 }, // Composant
        { wch: 50 }, // Détails
        { wch: 12 }, // Statut
        { wch: 15 }, // Utilisateur
        { wch: 10 }, // Version
        { wch: 12 }  // Durée
      ];
      this.worksheet['!cols'] = colWidths;

      // Ajouter le worksheet au workbook
      XLSX.utils.book_append_sheet(this.workbook, this.worksheet, 'Tracking');

      // Ajouter une feuille de statistiques
      this.addStatsSheet();

      return true;
    } catch (error) {
      console.error('Erreur init workbook:', error);
      return false;
    }
  }

  /**
   * Ajouter une feuille de statistiques
   */
  addStatsSheet() {
    const stats = this.calculateStats();

    const statsData = [
      ['Statistiques ALFlight Tracking'],
      [''],
      ['Période', `${stats.startDate} - ${stats.endDate}`],
      ['Total des actions', stats.totalActions],
      ['Actions par jour', stats.actionsPerDay.toFixed(2)],
      [''],
      ['Par composant:'],
      ...Object.entries(stats.byComponent).map(([comp, count]) => [comp, count]),
      [''],
      ['Par statut:'],
      ...Object.entries(stats.byStatus).map(([status, count]) => [status, count]),
      [''],
      ['Actions récentes (dernières 24h)', stats.recentActions],
      ['Temps moyen d\'exécution', `${stats.avgDuration.toFixed(0)} ms`]
    ];

    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
    statsSheet['!cols'] = [{ wch: 30 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(this.workbook, statsSheet, 'Statistiques');
  }

  /**
   * Calculer les statistiques
   */
  calculateStats() {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    const stats = {
      totalActions: this.logs.length,
      startDate: this.logs.length > 0
        ? new Date(this.logs[0].timestamp).toLocaleDateString('fr-FR')
        : 'N/A',
      endDate: this.logs.length > 0
        ? new Date(this.logs[this.logs.length - 1].timestamp).toLocaleDateString('fr-FR')
        : 'N/A',
      actionsPerDay: 0,
      byComponent: {},
      byStatus: {},
      recentActions: 0,
      avgDuration: 0
    };

    let totalDuration = 0;
    let durationCount = 0;

    this.logs.forEach(log => {
      // Par composant
      if (log.component) {
        stats.byComponent[log.component] = (stats.byComponent[log.component] || 0) + 1;
      }

      // Par statut
      const status = log.status || 'completed';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // Actions récentes
      if (log.timestamp > oneDayAgo) {
        stats.recentActions++;
      }

      // Durée moyenne
      if (log.duration) {
        totalDuration += log.duration;
        durationCount++;
      }
    });

    // Calculer les moyennes
    if (this.logs.length > 0) {
      const firstDate = new Date(this.logs[0].timestamp);
      const lastDate = new Date(this.logs[this.logs.length - 1].timestamp);
      const daysDiff = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)));
      stats.actionsPerDay = this.logs.length / daysDiff;
    }

    if (durationCount > 0) {
      stats.avgDuration = totalDuration / durationCount;
    }

    return stats;
  }

  /**
   * Ajouter un log avec mise à jour automatique
   */
  log(action, component, details, status = 'completed', duration = null) {
    const entry = {
      id: Date.now(),
      timestamp: Date.now(),
      action,
      component,
      details,
      status,
      user: 'Developer',
      version: '1.0.0',
      duration
    };

    this.logs.push(entry);
    this.saveToStorage();

    // Mettre à jour le workbook
    this.initWorkbook();

    

    // Déclencher un événement custom pour notifier l'UI
    window.dispatchEvent(new CustomEvent('excel-log-added', { detail: entry }));

    return entry;
  }

  /**
   * Sauvegarder dans localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem('alflight_excel_logs', JSON.stringify(this.logs));
      localStorage.setItem('alflight_excel_lastUpdate', new Date().toISOString());
    } catch (error) {
      console.error('Erreur sauvegarde localStorage:', error);
    }
  }

  /**
   * Charger depuis localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('alflight_excel_logs');
      if (stored) {
        this.logs = JSON.parse(stored);
        this.initWorkbook();
      }
    } catch (error) {
      console.error('Erreur chargement localStorage:', error);
      this.logs = [];
    }
  }

  /**
   * Exporter vers fichier Excel
   */
  exportToExcel() {
    try {
      this.initWorkbook();

      // Générer le fichier
      const filename = `alflight_tracking_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(this.workbook, filename);

      
      return true;
    } catch (error) {
      console.error('❌ Erreur export Excel:', error);
      return false;
    }
  }

  /**
   * Sauvegarder automatiquement
   */
  startAutoSave() {
    // Sauvegarder toutes les 30 secondes
    this.autoSaveInterval = setInterval(() => {
      this.saveToStorage();
      
    }, 30000);
  }

  /**
   * Arrêter l'auto-save
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Obtenir les logs récents
   */
  getRecentLogs(count = 10) {
    return this.logs.slice(-count);
  }

  /**
   * Filtrer les logs
   */
  filterLogs(filter) {
    return this.logs.filter(log => {
      if (filter.component && log.component !== filter.component) return false;
      if (filter.status && log.status !== filter.status) return false;
      if (filter.dateFrom && log.timestamp < filter.dateFrom) return false;
      if (filter.dateTo && log.timestamp > filter.dateTo) return false;
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const inAction = log.action?.toLowerCase().includes(searchLower);
        const inDetails = log.details?.toLowerCase().includes(searchLower);
        const inComponent = log.component?.toLowerCase().includes(searchLower);
        if (!inAction && !inDetails && !inComponent) return false;
      }
      return true;
    });
  }

  /**
   * Effacer tous les logs
   */
  clearLogs() {
    if (confirm('Effacer tous les logs ? Cette action est irréversible.')) {
      this.logs = [];
      this.saveToStorage();
      this.initWorkbook();
      
    }
  }

  /**
   * Obtenir un résumé
   */
  getSummary() {
    const stats = this.calculateStats();
    return {
      totalLogs: this.logs.length,
      lastUpdate: localStorage.getItem('alflight_excel_lastUpdate'),
      stats
    };
  }
}

// Instance globale
window.excelTracker = new ExcelTracker();

// Commandes disponibles dans la console

- excelTracker.exportToExcel()  // Télécharge le fichier .xlsx
- excelTracker.getRecentLogs()  // Derniers 10 logs
- excelTracker.getSummary()      // Résumé et stats
- excelTracker.filterLogs({component: 'PilotDashboard'})
- excelTracker.clearLogs()       // Effacer tout

Le fichier Excel est mis à jour automatiquement !
Auto-save toutes les 30 secondes.
export default ExcelTracker;