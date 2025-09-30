/**
 * Logger Excel local pour suivi des modifications
 * Utilise le localStorage pour stocker les logs en local
 */

class ExcelLogger {
  constructor() {
    this.logs = JSON.parse(localStorage.getItem('alflight_logs') || '[]');
  }

  /**
   * Ajouter un log
   */
  log(action, component, details, status = 'completed') {
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleString('fr-FR'),
      action,
      component,
      details,
      status,
      user: 'Developer'
    };

    this.logs.push(entry);
    this.save();

    console.log('📝 Log ajouté:', entry);
    return entry;
  }

  /**
   * Sauvegarder dans localStorage
   */
  save() {
    localStorage.setItem('alflight_logs', JSON.stringify(this.logs));
  }

  /**
   * Exporter en CSV pour Excel
   */
  exportToCSV() {
    const headers = ['Date', 'Action', 'Composant', 'Détails', 'Statut'];
    const rows = this.logs.map(log => [
      log.date,
      log.action,
      log.component,
      log.details,
      log.status
    ]);

    // Créer le CSV
    const csv = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    // Télécharger le fichier
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alflight_logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    console.log('✅ Fichier CSV exporté pour Excel');
  }

  /**
   * Afficher les logs dans la console
   */
  showLogs() {
    console.table(this.logs);
    return this.logs;
  }

  /**
   * Obtenir les derniers logs
   */
  getRecentLogs(count = 10) {
    return this.logs.slice(-count);
  }

  /**
   * Effacer les logs
   */
  clearLogs() {
    if (confirm('Effacer tous les logs ?')) {
      this.logs = [];
      this.save();
      console.log('🗑️ Logs effacés');
    }
  }
}

// Instance globale
window.excelLogger = new ExcelLogger();

// Exemples d'utilisation
console.log(`
📊 Excel Logger disponible !

Commandes:
- excelLogger.log('Action', 'Composant', 'Détails')
- excelLogger.exportToCSV()  // Télécharge le fichier Excel
- excelLogger.showLogs()      // Affiche dans la console
- excelLogger.getRecentLogs() // Derniers 10 logs
- excelLogger.clearLogs()     // Effacer tout
`);

export default ExcelLogger;