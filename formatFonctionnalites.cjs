/**
 * Script pour formater et mettre en page l'onglet Fonctionnalités
 * Organise les améliorations faites et à faire
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

class FonctionnalitesFormatter {
  constructor() {
    this.excelPath = path.join(__dirname, 'tracking', 'alflight_tracking_v2.xlsx');
  }

  /**
   * Nettoyer et améliorer le texte
   */
  cleanAndImprove(text) {
    if (!text) return '';

    // Corriger les caractères
    let cleaned = String(text)
      .replace(/�/g, 'é')
      .replace(/�/g, 'è')
      .replace(/�/g, 'à')
      .replace(/�/g, 'ç')
      .replace(/\u0000/g, '')
      .trim();

    // Capitaliser la première lettre
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
  }

  /**
   * Déterminer la priorité automatiquement
   */
  getPriority(statut, categorie) {
    if (statut === 'À faire' && categorie === 'Critique') return '🔴 Haute';
    if (statut === 'À faire' && categorie === 'Important') return '🟠 Moyenne';
    if (statut === 'En cours') return '🟡 En cours';
    if (statut === 'Terminé') return '🟢 Fait';
    return '⚪ Normale';
  }

  /**
   * Formater l'onglet Fonctionnalités
   */
  async formatFonctionnalites() {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║       📋 FORMATAGE ONGLET FONCTIONNALITÉS                 ║
╚════════════════════════════════════════════════════════════╝

Attendez de coller vos données dans l'onglet "Fonctionnalités"...
`);

    try {
      // Lire le fichier existant
      let workbook;
      if (fs.existsSync(this.excelPath)) {
        workbook = XLSX.readFile(this.excelPath);
      } else {
        workbook = XLSX.utils.book_new();
      }

      // Vérifier si l'onglet Fonctionnalités existe
      let fonctionnalitesSheet = workbook.Sheets['Fonctionnalités'];

      if (!fonctionnalitesSheet) {
        console.log('📝 Création de l\'onglet Fonctionnalités avec structure de base...');

        // Créer la structure de base
        const headers = [
          'ID',
          'Catégorie',
          'Fonctionnalité',
          'Description',
          'Statut',
          'Priorité',
          'Module',
          'Complexité',
          'Date création',
          'Date réalisation',
          'Notes'
        ];

        // Données d'exemple pour vous guider
        const exemplesData = [
          headers,
          [
            '1',
            'Interface',
            'Dashboard pilote',
            'Tableau de bord avec statistiques de vol, validations et alertes',
            'Terminé',
            '🟢 Fait',
            'PilotDashboard',
            'Élevée',
            '25/09/2025',
            '28/09/2025',
            'Validation SEP/MEP, heures FI/CRI'
          ],
          [
            '2',
            'Carnet de vol',
            'Segments de vol multiples',
            'Permettre plusieurs segments par vol avec fonction et temps différents',
            'Terminé',
            '🟢 Fait',
            'PilotLogbook',
            'Moyenne',
            '26/09/2025',
            '29/09/2025',
            'CDB/OPL/FI-CRI par segment'
          ],
          [
            '3',
            'Export/Import',
            'Export profil complet',
            'Exporter tout le profil pilote avec licences et carnet',
            'Terminé',
            '🟢 Fait',
            'Export',
            'Moyenne',
            '27/09/2025',
            '29/09/2025',
            'Format JSON unifié'
          ],
          [
            '4',
            'iOS',
            'Déploiement TestFlight',
            'Configuration CI/CD pour déploiement iOS sans Mac',
            'En cours',
            '🟡 En cours',
            'DevOps',
            'Élevée',
            '30/09/2025',
            '',
            'Codemagic + GitHub Actions'
          ],
          [
            '5',
            'Performance',
            'Optimisation chargement',
            'Améliorer les temps de chargement et la réactivité',
            'À faire',
            '🟠 Moyenne',
            'Core',
            'Moyenne',
            '30/09/2025',
            '',
            'Lazy loading, code splitting'
          ],
          [
            '6',
            'Météo',
            'Intégration METAR/TAF',
            'Affichage météo aviation temps réel pour les aérodromes',
            'À faire',
            '🔴 Haute',
            'Weather',
            'Élevée',
            '30/09/2025',
            '',
            'API aviation météo'
          ]
        ];

        fonctionnalitesSheet = XLSX.utils.aoa_to_sheet(exemplesData);

        // Largeurs de colonnes optimisées
        fonctionnalitesSheet['!cols'] = [
          { wch: 5 },   // ID
          { wch: 15 },  // Catégorie
          { wch: 30 },  // Fonctionnalité
          { wch: 50 },  // Description
          { wch: 12 },  // Statut
          { wch: 15 },  // Priorité
          { wch: 20 },  // Module
          { wch: 12 },  // Complexité
          { wch: 12 },  // Date création
          { wch: 15 },  // Date réalisation
          { wch: 40 }   // Notes
        ];

        XLSX.utils.book_append_sheet(workbook, fonctionnalitesSheet, 'Fonctionnalités');

      } else {
        // Formater les données existantes
        console.log('📊 Formatage des données existantes...');

        const data = XLSX.utils.sheet_to_json(fonctionnalitesSheet, { header: 1 });

        if (data.length > 0) {
          const formattedData = [];

          // Headers améliorés
          const headers = [
            'ID',
            'Catégorie',
            'Fonctionnalité',
            'Description',
            'Statut',
            'Priorité',
            'Module',
            'Complexité',
            'Date création',
            'Date réalisation',
            'Notes'
          ];

          formattedData.push(headers);

          // Formater chaque ligne
          for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (!row || row.length === 0) continue;

            const id = row[0] || i;
            const categorie = this.cleanAndImprove(row[1] || 'Général');
            const fonctionnalite = this.cleanAndImprove(row[2] || '');
            const description = this.cleanAndImprove(row[3] || '');
            const statut = this.cleanAndImprove(row[4] || 'À faire');
            const priorite = row[5] || this.getPriority(statut, categorie);
            const module = this.cleanAndImprove(row[6] || '');
            const complexite = this.cleanAndImprove(row[7] || 'Moyenne');
            const dateCreation = row[8] || new Date().toLocaleDateString('fr-FR');
            const dateRealisation = row[9] || '';
            const notes = this.cleanAndImprove(row[10] || '');

            formattedData.push([
              id,
              categorie,
              fonctionnalite,
              description,
              statut,
              priorite,
              module,
              complexite,
              dateCreation,
              dateRealisation,
              notes
            ]);
          }

          // Recréer la feuille avec les données formatées
          fonctionnalitesSheet = XLSX.utils.aoa_to_sheet(formattedData);

          // Largeurs optimisées
          fonctionnalitesSheet['!cols'] = [
            { wch: 5 },   // ID
            { wch: 15 },  // Catégorie
            { wch: 30 },  // Fonctionnalité
            { wch: 50 },  // Description
            { wch: 12 },  // Statut
            { wch: 15 },  // Priorité
            { wch: 20 },  // Module
            { wch: 12 },  // Complexité
            { wch: 12 },  // Date création
            { wch: 15 },  // Date réalisation
            { wch: 40 }   // Notes
          ];

          workbook.Sheets['Fonctionnalités'] = fonctionnalitesSheet;

          console.log(`✅ ${formattedData.length - 1} fonctionnalités formatées`);
        }
      }

      // Créer aussi une feuille Roadmap
      this.createRoadmap(workbook);

      // Sauvegarder
      XLSX.writeFile(workbook, this.excelPath);

      console.log(`
╔════════════════════════════════════════════════════════════╗
║              ✅ ONGLET FONCTIONNALITÉS CRÉÉ               ║
╚════════════════════════════════════════════════════════════╝

📊 Structure créée :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Onglet "Fonctionnalités" avec colonnes formatées
• Onglet "Roadmap" avec vue d'ensemble
• Exemples de données pour vous guider

💡 Comment utiliser :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Ouvrez le fichier Excel
2. Allez dans l'onglet "Fonctionnalités"
3. Remplacez/ajoutez vos données
4. Sauvegardez et relancez ce script pour reformater

📂 Fichier : ${this.excelPath}
`);

      // Ouvrir le fichier
      require('child_process').exec(`start "" "${this.excelPath}"`);

    } catch (error) {
      console.error('❌ Erreur:', error.message);
    }
  }

  /**
   * Créer une feuille Roadmap
   */
  createRoadmap(workbook) {
    const roadmapData = [
      ['📅 ROADMAP ALFLIGHT'],
      [''],
      ['🟢 TERMINÉ'],
      ['• Dashboard pilote avec validations'],
      ['• Carnet de vol avec segments multiples'],
      ['• Export/Import profil complet'],
      ['• Système de tracking Excel'],
      ['• Configuration des unités'],
      [''],
      ['🟡 EN COURS'],
      ['• Déploiement iOS TestFlight'],
      ['• Progressive Web App (PWA)'],
      ['• Synchronisation Google Sheets'],
      [''],
      ['🔴 À FAIRE - PRIORITÉ HAUTE'],
      ['• Intégration météo METAR/TAF'],
      ['• Base de données aérodromes'],
      ['• Calculs de performance avion'],
      [''],
      ['🟠 À FAIRE - PRIORITÉ MOYENNE'],
      ['• Mode hors ligne complet'],
      ['• Export PDF format EASA'],
      ['• Import depuis ForeFlight'],
      ['• Statistiques avancées'],
      [''],
      ['⚪ FUTURES AMÉLIORATIONS'],
      ['• Application mobile native'],
      ['• Synchronisation multi-appareils'],
      ['• Partage de vols entre pilotes'],
      ['• Intégration planning vol']
    ];

    const roadmapSheet = XLSX.utils.aoa_to_sheet(roadmapData);
    roadmapSheet['!cols'] = [{ wch: 60 }];

    workbook.Sheets['Roadmap'] = roadmapSheet;
  }
}

// Lancer le formatage
const formatter = new FonctionnalitesFormatter();
formatter.formatFonctionnalites().catch(console.error);