/**
 * Script pour formater et corriger les données Excel copiées manuellement
 * Nettoie les caractères spéciaux et réorganise le versioning
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

class ExcelFormatter {
  constructor() {
    this.excelPath = path.join(__dirname, 'tracking', 'alflight_tracking_v2.xlsx');
    this.backupPath = path.join(__dirname, 'tracking', 'backup_before_format.xlsx');
  }

  /**
   * Nettoyer les caractères spéciaux
   */
  cleanText(text) {
    if (!text) return '';

    // Remplacer les caractères mal encodés
    return String(text)
      .replace(/�/g, 'é')
      .replace(/�/g, 'è')
      .replace(/�/g, 'à')
      .replace(/�/g, 'ç')
      .replace(/�/g, 'ê')
      .replace(/�/g, 'ù')
      .replace(/�/g, 'ô')
      .replace(/�/g, 'î')
      .replace(/�/g, 'â')
      .replace(/\?/g, '→')
      .replace(/\u0000/g, '')
      .trim();
  }

  /**
   * Formater une date/heure
   */
  formatDateTime(value) {
    if (!value) {
      const now = new Date();
      return `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR')}`;
    }

    // Si c'est déjà au bon format
    if (String(value).match(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/)) {
      return value;
    }

    // Essayer de parser et reformater
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return `${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR')}`;
      }
    } catch (e) {
      // Ignorer
    }

    return String(value);
  }

  /**
   * Générer une version basée sur l'index
   */
  generateVersion(index, startVersion = '1.0.0') {
    const parts = startVersion.split('.').map(Number);
    let [major, minor, patch] = parts;

    // Ajouter l'index au patch
    patch += index;

    // Gérer les débordements
    while (patch >= 10) {
      patch -= 10;
      minor += 1;
    }

    while (minor >= 10) {
      minor -= 10;
      major += 1;
    }

    return `${major}.${minor}.${patch}`;
  }

  /**
   * Lire et formater le fichier Excel
   */
  async formatExcel() {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║         📊 FORMATAGE DU FICHIER EXCEL                     ║
╚════════════════════════════════════════════════════════════╝
`);

    try {
      // Vérifier que le fichier existe
      if (!fs.existsSync(this.excelPath)) {
        console.error('❌ Fichier non trouvé:', this.excelPath);
        console.log('Créez d\'abord le fichier ou copiez vos données dedans.');
        return;
      }

      // Faire une sauvegarde
      console.log('💾 Création d\'une sauvegarde...');
      fs.copyFileSync(this.excelPath, this.backupPath);

      // Lire le fichier
      console.log('📖 Lecture du fichier Excel...');
      const workbook = XLSX.readFile(this.excelPath);

      // Traiter la feuille Tracking
      const trackingSheet = workbook.Sheets['Tracking'];
      if (!trackingSheet) {
        console.error('❌ Feuille "Tracking" non trouvée');
        return;
      }

      // Convertir en tableau
      const data = XLSX.utils.sheet_to_json(trackingSheet, { header: 1 });

      if (data.length < 2) {
        console.log('⚠️ Pas de données à formater');
        return;
      }

      console.log(`✅ ${data.length - 1} lignes de données trouvées`);

      // Headers corrects
      const headers = [
        'Date/Heure',
        'Action',
        'Composant',
        'Résumé',
        'Détails',
        'Fichiers',
        'Statut',
        'Auteur',
        'Version'
      ];

      // Formater les données
      const formattedData = [headers];
      let lastValidVersion = '1.0.0';

      for (let i = 1; i < data.length; i++) {
        const row = data[i];

        // Ignorer les lignes vides
        if (!row || row.length === 0 || (!row[0] && !row[1] && !row[2])) {
          continue;
        }

        // Extraire et nettoyer les données
        const dateHeure = this.formatDateTime(row[0]);
        const action = this.cleanText(row[1] || 'Action non spécifiée');
        const composant = this.cleanText(row[2] || 'Composant');
        const resume = this.cleanText(row[3] || action.substring(0, 40));
        const details = this.cleanText(row[4] || '');
        const fichiers = this.cleanText(row[5] || '');
        const statut = this.cleanText(row[6] || 'Complété');
        const auteur = this.cleanText(row[7] || 'Claude AI');

        // Gérer la version
        let version = row[8];
        if (!version || version === '' || version === 'undefined') {
          // Générer une nouvelle version
          version = this.generateVersion(i - 1, lastValidVersion);
        } else {
          version = this.cleanText(version);
          // Vérifier que c'est un format valide
          if (!version.match(/^\d+\.\d+\.\d+$/)) {
            version = this.generateVersion(i - 1, lastValidVersion);
          }
        }
        lastValidVersion = version;

        formattedData.push([
          dateHeure,
          action,
          composant,
          resume,
          details,
          fichiers,
          statut,
          auteur,
          version
        ]);
      }

      console.log(`\n📊 Données formatées : ${formattedData.length - 1} lignes`);

      // Créer un nouveau workbook
      const newWorkbook = XLSX.utils.book_new();

      // Créer la feuille Tracking
      const newTrackingSheet = XLSX.utils.aoa_to_sheet(formattedData);

      // Définir les largeurs de colonnes
      newTrackingSheet['!cols'] = [
        { wch: 20 }, // Date/Heure
        { wch: 40 }, // Action
        { wch: 25 }, // Composant
        { wch: 45 }, // Résumé
        { wch: 70 }, // Détails
        { wch: 45 }, // Fichiers
        { wch: 15 }, // Statut
        { wch: 18 }, // Auteur
        { wch: 12 }  // Version
      ];

      XLSX.utils.book_append_sheet(newWorkbook, newTrackingSheet, 'Tracking');

      // Créer la feuille Dashboard
      const dashboardData = this.createDashboard(formattedData);
      const dashboardSheet = XLSX.utils.aoa_to_sheet(dashboardData);
      dashboardSheet['!cols'] = [{ wch: 40 }, { wch: 30 }];

      XLSX.utils.book_append_sheet(newWorkbook, dashboardSheet, 'Dashboard');

      // Sauvegarder
      console.log('\n💾 Sauvegarde du fichier formaté...');
      XLSX.writeFile(newWorkbook, this.excelPath);

      console.log(`
╔════════════════════════════════════════════════════════════╗
║                  ✅ FORMATAGE TERMINÉ                     ║
╚════════════════════════════════════════════════════════════╝

📊 Résultats :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Lignes formatées    : ${formattedData.length - 1}
🏷️  Version finale      : ${lastValidVersion}
📂 Fichier mis à jour  : ${this.excelPath}
💾 Sauvegarde          : ${this.backupPath}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Corrections appliquées :
• Caractères spéciaux corrigés (é, è, à, ç, etc.)
• Dates/heures formatées
• Versions auto-générées si manquantes
• Colonnes alignées et largeurs optimisées
`);

      // Ouvrir le fichier
      require('child_process').exec(`start "" "${this.excelPath}"`);

    } catch (error) {
      console.error('❌ Erreur:', error.message);
      console.log('\n💡 Si le fichier est ouvert dans Excel, fermez-le et réessayez.');
    }
  }

  /**
   * Créer le dashboard
   */
  createDashboard(data) {
    const totalLogs = data.length - 1;
    const lastVersion = totalLogs > 0 ? data[data.length - 1][8] : '1.0.0';

    // Compter les statuts
    const statusCount = {};
    const componentCount = {};

    for (let i = 1; i < data.length; i++) {
      const status = data[i][6] || 'Inconnu';
      const component = data[i][2] || 'Inconnu';

      statusCount[status] = (statusCount[status] || 0) + 1;
      componentCount[component] = (componentCount[component] || 0) + 1;
    }

    const dashboardData = [
      ['📊 TABLEAU DE BORD - TRACKING ALFLIGHT'],
      [''],
      ['📈 STATISTIQUES GÉNÉRALES'],
      ['Total des logs', totalLogs],
      ['Version actuelle', lastVersion],
      ['Dernière mise à jour', new Date().toLocaleString('fr-FR')],
      [''],
      ['📊 PAR STATUT'],
      ...Object.entries(statusCount).map(([status, count]) => [status, count]),
      [''],
      ['🔧 PAR COMPOSANT (Top 10)'],
      ...Object.entries(componentCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([comp, count]) => [comp, count])
    ];

    return dashboardData;
  }
}

// Lancer le formatage
const formatter = new ExcelFormatter();
formatter.formatExcel().catch(console.error);