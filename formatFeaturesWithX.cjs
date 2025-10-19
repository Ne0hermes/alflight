/**
 * Script pour formater les fonctionnalités avec X = Terminé
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

class FeaturesFormatter {
  constructor() {
    this.excelPath = path.join(__dirname, 'tracking', 'alflight_tracking_v2.xlsx');
  }

  /**
   * Nettoyer et améliorer le texte
   */
  cleanText(text) {
    if (!text) return '';

    return String(text)
      .replace(/�/g, 'é')
      .replace(/�/g, 'è')
      .replace(/�/g, 'à')
      .replace(/�/g, 'ù')
      .replace(/�/g, 'ê')
      .replace(/�/g, 'ç')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Déterminer le statut selon la présence de X
   */
  getStatus(row) {
    // Vérifier si une cellule contient X ou x
    const rowStr = row.join(' ').toLowerCase();
    if (rowStr.includes('x')) {
      return 'Terminé';
    }
    return 'À faire';
  }

  /**
   * Formater les fonctionnalités
   */
  async format() {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║    📋 FORMATAGE DES FONCTIONNALITÉS AVEC X                ║
╚════════════════════════════════════════════════════════════╝
`);

    try {
      // Lire le fichier
      const workbook = XLSX.readFile(this.excelPath);
      const sheet = workbook.Sheets['Fonctionnalités'];

      if (!sheet) {
        console.error('❌ Onglet Fonctionnalités non trouvé');
        return;
      }

      // Convertir en tableau
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      console.log(`📊 ${data.length} lignes trouvées`);

      // Nouvelles données formatées
      const formattedData = [];

      // Headers améliorés
      const headers = [
        'ID',
        'Catégorie',
        'Fonctionnalité',
        'Description détaillée',
        'Statut',
        'Priorité',
        'Module concerné',
        'Complexité',
        'Progression',
        'Notes techniques'
      ];

      formattedData.push(headers);

      // Analyser chaque ligne de données
      let idCounter = 1;
      let completedCount = 0;
      let todoCount = 0;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        // Extraire le texte de la fonctionnalité
        let featureText = '';
        let hasX = false;

        // Chercher le X et le texte
        for (let j = 0; j < row.length; j++) {
          const cell = String(row[j] || '').trim();

          if (cell.toLowerCase() === 'x') {
            hasX = true;
          } else if (cell && cell.length > 3) {
            // C'est probablement le texte de la feature
            featureText = this.cleanText(cell);
          }
        }

        if (!featureText) continue;

        // Analyser et catégoriser la fonctionnalité
        const analysis = this.analyzeFeature(featureText);

        // Déterminer le statut
        const statut = hasX ? 'Terminé' : 'À faire';

        // Déterminer la priorité
        let priorite = '⚪ Normale';
        if (statut === 'Terminé') {
          priorite = '🟢 Fait';
          completedCount++;
        } else {
          todoCount++;
          // Analyser la priorité selon les mots-clés
          if (featureText.toLowerCase().includes('urgent') ||
              featureText.toLowerCase().includes('critique') ||
              featureText.toLowerCase().includes('important')) {
            priorite = '🔴 Haute';
          } else if (featureText.toLowerCase().includes('amélioration') ||
                     featureText.toLowerCase().includes('optimisation')) {
            priorite = '🟠 Moyenne';
          }
        }

        // Déterminer la progression
        const progression = hasX ? '100%' : '0%';

        formattedData.push([
          idCounter++,
          analysis.categorie,
          analysis.nom,
          analysis.description,
          statut,
          priorite,
          analysis.module,
          analysis.complexite,
          progression,
          analysis.notes
        ]);
      }

      console.log(`\n📊 Analyse terminée :`);
      console.log(`  ✅ Terminées : ${completedCount}`);
      console.log(`  📝 À faire : ${todoCount}`);

      // Trier : Terminé d'abord, puis par priorité
      const sortedData = [headers, ...formattedData.slice(1).sort((a, b) => {
        if (a[4] === 'Terminé' && b[4] !== 'Terminé') return -1;
        if (a[4] !== 'Terminé' && b[4] === 'Terminé') return 1;
        return 0;
      })];

      // Recréer la feuille
      const newSheet = XLSX.utils.aoa_to_sheet(sortedData);

      // Largeurs optimisées
      newSheet['!cols'] = [
        { wch: 5 },   // ID
        { wch: 20 },  // Catégorie
        { wch: 35 },  // Fonctionnalité
        { wch: 60 },  // Description
        { wch: 12 },  // Statut
        { wch: 15 },  // Priorité
        { wch: 25 },  // Module
        { wch: 12 },  // Complexité
        { wch: 12 },  // Progression
        { wch: 40 }   // Notes
      ];

      workbook.Sheets['Fonctionnalités'] = newSheet;

      // Mettre à jour la Roadmap
      this.updateRoadmap(workbook, formattedData);

      // Sauvegarder
      let attempts = 0;
      let saved = false;

      while (!saved && attempts < 3) {
        try {
          XLSX.writeFile(workbook, this.excelPath);
          saved = true;
          console.log('\n✅ Fichier sauvegardé avec succès !');
        } catch (err) {
          attempts++;
          if (attempts >= 3) {
            console.log('\n⚠️ Fermez Excel et relancez le script');
            return;
          }
          console.log(`⏳ Tentative ${attempts}/3...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`
╔════════════════════════════════════════════════════════════╗
║              ✅ FORMATAGE TERMINÉ                         ║
╚════════════════════════════════════════════════════════════╝

📂 Fichier : ${this.excelPath}

💡 Les fonctionnalités avec X ont été marquées comme "Terminé"
   Les autres sont "À faire" avec priorités assignées
`);

      // Ouvrir le fichier
      require('child_process').exec(`start "" "${this.excelPath}"`);

    } catch (error) {
      console.error('❌ Erreur:', error.message);
    }
  }

  /**
   * Analyser une fonctionnalité pour extraire les détails
   */
  analyzeFeature(text) {
    const lower = text.toLowerCase();

    // Déterminer la catégorie
    let categorie = 'Général';
    if (lower.includes('carnet') || lower.includes('vol') || lower.includes('logbook')) {
      categorie = 'Carnet de vol';
    } else if (lower.includes('pilot') || lower.includes('profil') || lower.includes('licence')) {
      categorie = 'Profil pilote';
    } else if (lower.includes('avion') || lower.includes('aircraft') || lower.includes('appareil')) {
      categorie = 'Gestion avions';
    } else if (lower.includes('météo') || lower.includes('metar') || lower.includes('weather')) {
      categorie = 'Météo';
    } else if (lower.includes('carte') || lower.includes('map') || lower.includes('navigation')) {
      categorie = 'Cartes';
    } else if (lower.includes('export') || lower.includes('import') || lower.includes('pdf')) {
      categorie = 'Export/Import';
    } else if (lower.includes('stat') || lower.includes('dashboard') || lower.includes('tableau')) {
      categorie = 'Statistiques';
    } else if (lower.includes('checklist') || lower.includes('liste')) {
      categorie = 'Checklists';
    } else if (lower.includes('plan') || lower.includes('route')) {
      categorie = 'Planning vol';
    }

    // Extraire le nom court (premiers mots significatifs)
    const words = text.split(' ').filter(w => w.length > 2);
    const nom = words.slice(0, 4).join(' ');

    // Description complète
    const description = this.cleanText(text);

    // Déterminer le module
    const module = categorie.replace(/ /g, '') + 'Module';

    // Complexité selon la longueur et les mots-clés
    let complexite = 'Moyenne';
    if (lower.includes('simple') || lower.includes('basique') || words.length < 5) {
      complexite = 'Simple';
    } else if (lower.includes('complexe') || lower.includes('avancé') || lower.includes('complet')) {
      complexite = 'Élevée';
    }

    // Notes techniques
    let notes = '';
    if (lower.includes('api')) notes += 'Nécessite API externe. ';
    if (lower.includes('offline') || lower.includes('hors ligne')) notes += 'Mode hors ligne requis. ';
    if (lower.includes('sync')) notes += 'Synchronisation nécessaire. ';
    if (lower.includes('ios') || lower.includes('android')) notes += 'App mobile. ';

    return {
      categorie,
      nom,
      description,
      module,
      complexite,
      notes: notes || 'À définir'
    };
  }

  /**
   * Mettre à jour la Roadmap
   */
  updateRoadmap(workbook, features) {
    const completed = features.filter(f => f[4] === 'Terminé');
    const todo = features.filter(f => f[4] === 'À faire');
    const high = todo.filter(f => f[5].includes('🔴'));
    const medium = todo.filter(f => f[5].includes('🟠'));
    const normal = todo.filter(f => f[5].includes('⚪'));

    const roadmapData = [
      ['📅 ROADMAP ALFLIGHT - Mise à jour automatique'],
      [''],
      [`🟢 TERMINÉ (${completed.length - 1} fonctionnalités)`],
      ...completed.slice(1).map(f => [`• ${f[2]}`]),
      [''],
      [`🔴 À FAIRE - PRIORITÉ HAUTE (${high.length})`],
      ...high.map(f => [`• ${f[2]}`]),
      [''],
      [`🟠 À FAIRE - PRIORITÉ MOYENNE (${medium.length})`],
      ...medium.map(f => [`• ${f[2]}`]),
      [''],
      [`⚪ À FAIRE - PRIORITÉ NORMALE (${normal.length})`],
      ...normal.map(f => [`• ${f[2]}`]),
      [''],
      ['📊 STATISTIQUES'],
      [`Total : ${features.length - 1} fonctionnalités`],
      [`Complété : ${Math.round((completed.length - 1) / (features.length - 1) * 100)}%`],
      [`Dernière mise à jour : ${new Date().toLocaleString('fr-FR')}`]
    ];

    const roadmapSheet = XLSX.utils.aoa_to_sheet(roadmapData);
    roadmapSheet['!cols'] = [{ wch: 80 }];

    workbook.Sheets['Roadmap'] = roadmapSheet;
  }
}

// Lancer le formatage
const formatter = new FeaturesFormatter();
formatter.format().catch(console.error);