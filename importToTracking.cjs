/**
 * Script d'import de données depuis Google Sheets ou Excel
 * vers notre système de tracking unifié
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const tracker = require('./server/trackingSystem.cjs');

class DataImporter {
  constructor() {
    this.supportedFormats = ['.xlsx', '.xls', '.csv', '.json'];
  }

  /**
   * Lire un fichier Excel/CSV et retourner les données
   */
  readFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier non trouvé : ${filePath}`);
    }

    console.log(`📖 Lecture du fichier : ${filePath}`);

    switch (ext) {
      case '.xlsx':
      case '.xls':
        return this.readExcel(filePath);

      case '.csv':
        return this.readCSV(filePath);

      case '.json':
        return this.readJSON(filePath);

      default:
        throw new Error(`Format non supporté : ${ext}`);
    }
  }

  /**
   * Lire un fichier Excel
   */
  readExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Première feuille
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`✅ ${data.length} lignes trouvées dans la feuille "${sheetName}"`);

    return this.parseData(data);
  }

  /**
   * Lire un fichier CSV
   */
  readCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').map(line => line.split(';'));

    return this.parseData(lines);
  }

  /**
   * Lire un fichier JSON
   */
  readJSON(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Parser les données en format standard
   */
  parseData(rawData) {
    if (!rawData || rawData.length < 2) {
      throw new Error('Fichier vide ou invalide');
    }

    const headers = rawData[0];
    const records = [];

    // Mapper les headers possibles vers notre format
    const headerMap = {
      'date': ['date', 'Date', 'DATE', 'date/heure', 'Date/Heure'],
      'heure': ['heure', 'Heure', 'HEURE', 'time', 'Time'],
      'action': ['action', 'Action', 'ACTION', 'tâche', 'Tâche', 'task'],
      'composant': ['composant', 'Composant', 'COMPOSANT', 'module', 'Module', 'component'],
      'resume': ['resume', 'Resume', 'Résumé', 'résumé', 'RESUME', 'summary', 'titre'],
      'details': ['details', 'Details', 'Détails', 'détails', 'DETAILS', 'description'],
      'fichiers': ['fichiers', 'Fichiers', 'FICHIERS', 'files', 'Files', 'file'],
      'statut': ['statut', 'Statut', 'STATUT', 'status', 'Status', 'état'],
      'auteur': ['auteur', 'Auteur', 'AUTEUR', 'author', 'Author', 'user'],
      'version': ['version', 'Version', 'VERSION']
    };

    // Trouver les index des colonnes
    const columnIndexes = {};

    for (const [field, possibleNames] of Object.entries(headerMap)) {
      for (let i = 0; i < headers.length; i++) {
        const header = String(headers[i]).trim();
        if (possibleNames.some(name => header.toLowerCase().includes(name.toLowerCase()))) {
          columnIndexes[field] = i;
          break;
        }
      }
    }

    console.log('📊 Colonnes détectées :', columnIndexes);

    // Parser chaque ligne
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];

      if (!row || row.length === 0 || !row[0]) continue; // Ignorer les lignes vides

      const record = {
        date: columnIndexes.date !== undefined ? row[columnIndexes.date] : '',
        heure: columnIndexes.heure !== undefined ? row[columnIndexes.heure] : '',
        action: columnIndexes.action !== undefined ? row[columnIndexes.action] : '',
        composant: columnIndexes.composant !== undefined ? row[columnIndexes.composant] : '',
        resume: columnIndexes.resume !== undefined ? row[columnIndexes.resume] : '',
        details: columnIndexes.details !== undefined ? row[columnIndexes.details] : '',
        fichiers: columnIndexes.fichiers !== undefined ? row[columnIndexes.fichiers] : '',
        statut: columnIndexes.statut !== undefined ? row[columnIndexes.statut] : 'Importé',
        auteur: columnIndexes.auteur !== undefined ? row[columnIndexes.auteur] : 'Import',
        version: columnIndexes.version !== undefined ? row[columnIndexes.version] : ''
      };

      // Combiner date et heure si nécessaire
      if (record.date && !record.heure) {
        // Si la date contient déjà l'heure
        const parts = String(record.date).split(' ');
        if (parts.length > 1) {
          record.date = parts[0];
          record.heure = parts.slice(1).join(' ');
        }
      }

      // Ne garder que les lignes avec au moins une action ou un composant
      if (record.action || record.composant) {
        records.push(record);
      }
    }

    console.log(`✅ ${records.length} enregistrements valides trouvés`);

    return records;
  }

  /**
   * Importer les données dans notre système de tracking
   */
  async importToTracking(filePath, options = {}) {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║           📥 IMPORT DE DONNÉES VERS TRACKING              ║
╚════════════════════════════════════════════════════════════╝
`);

    try {
      // Lire les données
      const records = this.readFile(filePath);

      if (records.length === 0) {
        console.log('⚠️ Aucune donnée à importer');
        return;
      }

      console.log(`
📊 Résumé de l'import :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fichier source : ${path.basename(filePath)}
Nombre de lignes : ${records.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

      // Demander confirmation
      if (!options.skipConfirmation) {
        console.log('🔄 Import en cours...\n');
      }

      let imported = 0;
      let skipped = 0;

      // Importer chaque enregistrement
      for (const record of records) {
        try {
          // Préparer les données
          const action = record.action || 'Action importée';
          const composant = record.composant || 'Import';
          const resume = record.resume || action.substring(0, 40);
          const details = record.details || `Importé depuis ${path.basename(filePath)}`;

          // Gérer les fichiers (peut être une chaîne ou un tableau)
          let fichiers = [];
          if (record.fichiers) {
            if (typeof record.fichiers === 'string') {
              fichiers = record.fichiers.split(',').map(f => f.trim()).filter(f => f);
            } else if (Array.isArray(record.fichiers)) {
              fichiers = record.fichiers;
            }
          }

          const statut = record.statut || 'Importé';
          const auteur = record.auteur || 'Import automatique';

          // Ajouter au tracking avec versioning automatique
          tracker.addLog(
            action,
            composant,
            resume,
            details,
            fichiers,
            statut,
            auteur
          );

          imported++;

          // Afficher la progression
          if (imported % 5 === 0) {
            console.log(`  ✓ ${imported}/${records.length} importés...`);
          }

        } catch (error) {
          console.error(`  ✗ Erreur ligne ${imported + skipped + 1}: ${error.message}`);
          skipped++;
        }
      }

      // Résumé final
      const summary = tracker.getSummary();

      console.log(`
╔════════════════════════════════════════════════════════════╗
║                  ✅ IMPORT TERMINÉ                        ║
╚════════════════════════════════════════════════════════════╝

📈 Résultats :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Importés avec succès : ${imported}
⚠️  Ignorés (erreurs)    : ${skipped}
📊 Total dans tracking  : ${summary.totalLogs}
🏷️  Version actuelle     : ${summary.version}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Fichier de tracking mis à jour :
   ${summary.excelPath}
`);

      // Ouvrir le fichier Excel
      if (!options.noOpen) {
        console.log('📊 Ouverture du fichier Excel...');
        tracker.openExcel();
      }

      return {
        success: true,
        imported,
        skipped,
        total: records.length
      };

    } catch (error) {
      console.error(`❌ Erreur lors de l'import : ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Créer une instance
const importer = new DataImporter();

// Si le script est exécuté directement avec un argument
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
📥 UTILISATION :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
node importToTracking.cjs <fichier>

Formats supportés :
• Excel (.xlsx, .xls)
• CSV (.csv)
• JSON (.json)

Exemples :
node importToTracking.cjs tracking/old_data.xlsx
node importToTracking.cjs exports/google_sheets_export.csv
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  } else {
    // Importer le fichier spécifié
    importer.importToTracking(args[0]);
  }
}

module.exports = importer;