/**
 * Tracker Excel avec fichier .xlsx physique
 * Génère et maintient un vrai fichier Excel sur le disque
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

class ExcelFileTracker {
  constructor() {
    // Chemin du fichier Excel sur votre disque
    this.excelPath = path.join(__dirname, '..', 'tracking', 'alflight_tracking.xlsx');
    this.backupPath = path.join(__dirname, '..', 'tracking', 'backups');
    this.logs = [];

    // Créer le dossier tracking s'il n'existe pas
    this.ensureDirectories();

    // Charger le fichier existant ou créer un nouveau
    this.loadOrCreateExcel();
  }

  /**
   * Créer les dossiers nécessaires
   */
  ensureDirectories() {
    const trackingDir = path.join(__dirname, '..', 'tracking');
    if (!fs.existsSync(trackingDir)) {
      fs.mkdirSync(trackingDir, { recursive: true });
      console.log('📁 Dossier tracking créé:', trackingDir);
    }

    if (!fs.existsSync(this.backupPath)) {
      fs.mkdirSync(this.backupPath, { recursive: true });
      console.log('📁 Dossier backups créé:', this.backupPath);
    }
  }

  /**
   * Charger le fichier Excel existant ou en créer un nouveau
   */
  loadOrCreateExcel() {
    try {
      if (fs.existsSync(this.excelPath)) {
        // Charger le fichier existant
        const workbook = XLSX.readFile(this.excelPath);
        const worksheet = workbook.Sheets['Tracking'];

        if (worksheet) {
          // Convertir en JSON
          const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // Ignorer la première ligne (headers)
          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row && row[0]) {
              this.logs.push({
                date: row[0],
                heure: row[1],
                action: row[2],
                composant: row[3],
                details: row[4],
                statut: row[5],
                utilisateur: row[6],
                version: row[7]
              });
            }
          }

          console.log(`✅ Fichier Excel chargé: ${this.logs.length} logs existants`);
        }
      } else {
        // Créer un nouveau fichier
        this.createNewExcel();
        console.log('✨ Nouveau fichier Excel créé:', this.excelPath);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement du fichier Excel:', error);
      this.createNewExcel();
    }
  }

  /**
   * Créer un nouveau fichier Excel
   */
  createNewExcel() {
    const workbook = XLSX.utils.book_new();

    // Créer la feuille Tracking
    const trackingData = [
      ['Date', 'Heure', 'Action', 'Composant', 'Détails', 'Statut', 'Utilisateur', 'Version']
    ];

    const trackingSheet = XLSX.utils.aoa_to_sheet(trackingData);

    // Définir les largeurs de colonnes
    trackingSheet['!cols'] = [
      { wch: 12 }, // Date
      { wch: 10 }, // Heure
      { wch: 35 }, // Action
      { wch: 25 }, // Composant
      { wch: 60 }, // Détails
      { wch: 12 }, // Statut
      { wch: 15 }, // Utilisateur
      { wch: 10 }  // Version
    ];

    XLSX.utils.book_append_sheet(workbook, trackingSheet, 'Tracking');

    // Créer la feuille Statistiques
    this.addStatsSheet(workbook);

    // Sauvegarder
    XLSX.writeFile(workbook, this.excelPath);
  }

  /**
   * Ajouter un nouveau log
   */
  addLog(action, composant, details, statut = 'Complété', utilisateur = 'Developer') {
    const now = new Date();
    const entry = {
      date: now.toLocaleDateString('fr-FR'),
      heure: now.toLocaleTimeString('fr-FR'),
      action: action,
      composant: composant,
      details: details,
      statut: statut,
      utilisateur: utilisateur,
      version: '1.0.0'
    };

    this.logs.push(entry);

    // Mettre à jour le fichier Excel
    this.updateExcel();

    console.log('📝 Log ajouté au fichier Excel:', entry);

    return entry;
  }

  /**
   * Mettre à jour le fichier Excel avec les nouveaux logs
   */
  updateExcel() {
    try {
      // Créer un backup avant modification
      this.createBackup();

      const workbook = XLSX.utils.book_new();

      // Préparer les données pour la feuille Tracking
      const trackingData = [
        ['Date', 'Heure', 'Action', 'Composant', 'Détails', 'Statut', 'Utilisateur', 'Version']
      ];

      // Ajouter tous les logs
      this.logs.forEach(log => {
        trackingData.push([
          log.date,
          log.heure,
          log.action,
          log.composant,
          log.details,
          log.statut,
          log.utilisateur,
          log.version
        ]);
      });

      const trackingSheet = XLSX.utils.aoa_to_sheet(trackingData);

      // Définir les largeurs de colonnes
      trackingSheet['!cols'] = [
        { wch: 12 }, // Date
        { wch: 10 }, // Heure
        { wch: 35 }, // Action
        { wch: 25 }, // Composant
        { wch: 60 }, // Détails
        { wch: 12 }, // Statut
        { wch: 15 }, // Utilisateur
        { wch: 10 }  // Version
      ];

      // Ajouter un style de header (gras)
      const range = XLSX.utils.decode_range(trackingSheet['!ref']);
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!trackingSheet[addr]) continue;
        if (!trackingSheet[addr].s) trackingSheet[addr].s = {};
        trackingSheet[addr].s.font = { bold: true };
      }

      XLSX.utils.book_append_sheet(workbook, trackingSheet, 'Tracking');

      // Ajouter la feuille Statistiques
      this.addStatsSheet(workbook);

      // Sauvegarder le fichier
      XLSX.writeFile(workbook, this.excelPath);

      console.log(`✅ Fichier Excel mis à jour: ${this.excelPath}`);
      console.log(`   ${this.logs.length} logs au total`);

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du fichier Excel:', error);
    }
  }

  /**
   * Créer une feuille de statistiques
   */
  addStatsSheet(workbook) {
    const stats = this.calculateStats();

    const statsData = [
      ['ALFlight - Statistiques de Tracking'],
      [''],
      ['Informations générales'],
      ['Total des actions', stats.total],
      ['Première entrée', stats.firstDate],
      ['Dernière entrée', stats.lastDate],
      [''],
      ['Statistiques par composant'],
      ...Object.entries(stats.byComponent).map(([comp, count]) => [comp, count]),
      [''],
      ['Statistiques par statut'],
      ...Object.entries(stats.byStatus).map(([status, count]) => [status, count]),
      [''],
      ['Actions par jour'],
      ...Object.entries(stats.byDay).map(([day, count]) => [day, count])
    ];

    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);

    // Largeurs de colonnes
    statsSheet['!cols'] = [
      { wch: 40 },
      { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistiques');
  }

  /**
   * Calculer les statistiques
   */
  calculateStats() {
    const stats = {
      total: this.logs.length,
      firstDate: this.logs.length > 0 ? `${this.logs[0].date} ${this.logs[0].heure}` : 'N/A',
      lastDate: this.logs.length > 0 ? `${this.logs[this.logs.length - 1].date} ${this.logs[this.logs.length - 1].heure}` : 'N/A',
      byComponent: {},
      byStatus: {},
      byDay: {}
    };

    this.logs.forEach(log => {
      // Par composant
      stats.byComponent[log.composant] = (stats.byComponent[log.composant] || 0) + 1;

      // Par statut
      stats.byStatus[log.statut] = (stats.byStatus[log.statut] || 0) + 1;

      // Par jour
      stats.byDay[log.date] = (stats.byDay[log.date] || 0) + 1;
    });

    return stats;
  }

  /**
   * Créer une sauvegarde du fichier Excel
   */
  createBackup() {
    try {
      if (fs.existsSync(this.excelPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const backupFile = path.join(this.backupPath, `backup_${timestamp}.xlsx`);

        // Garder seulement les 5 dernières sauvegardes
        this.cleanOldBackups();

        fs.copyFileSync(this.excelPath, backupFile);
        console.log('💾 Backup créé:', backupFile);
      }
    } catch (error) {
      console.error('⚠️ Erreur lors de la création du backup:', error);
    }
  }

  /**
   * Nettoyer les anciennes sauvegardes
   */
  cleanOldBackups() {
    try {
      const files = fs.readdirSync(this.backupPath)
        .filter(f => f.startsWith('backup_'))
        .sort()
        .reverse();

      // Garder seulement les 5 plus récents
      if (files.length >= 5) {
        for (let i = 5; i < files.length; i++) {
          fs.unlinkSync(path.join(this.backupPath, files[i]));
        }
      }
    } catch (error) {
      console.error('⚠️ Erreur lors du nettoyage des backups:', error);
    }
  }

  /**
   * Obtenir le chemin du fichier Excel
   */
  getExcelPath() {
    return this.excelPath;
  }

  /**
   * Ouvrir le fichier Excel (Windows)
   */
  openExcel() {
    if (process.platform === 'win32') {
      require('child_process').exec(`start "" "${this.excelPath}"`);
      console.log('📊 Ouverture du fichier Excel...');
    } else {
      console.log(`📊 Ouvrez le fichier: ${this.excelPath}`);
    }
  }
}

// Créer l'instance
const tracker = new ExcelFileTracker();

// Exemples d'utilisation
console.log(`
╔════════════════════════════════════════════════════════════╗
║            📊 TRACKER EXCEL PHYSIQUE ACTIVÉ               ║
╚════════════════════════════════════════════════════════════╝

📂 Fichier Excel: ${tracker.getExcelPath()}

Commandes disponibles:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• tracker.addLog('Action', 'Composant', 'Détails')
• tracker.openExcel()  // Ouvre le fichier dans Excel
• tracker.getExcelPath()  // Chemin du fichier

Le fichier Excel est automatiquement mis à jour à chaque log !
`);

// Export
module.exports = tracker;