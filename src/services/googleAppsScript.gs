/**
 * Script Google Apps Script pour recevoir les données de tracking
 *
 * INSTRUCTIONS D'INSTALLATION:
 * 1. Ouvrir Google Sheets: https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
 * 2. Aller dans Extensions > Apps Script
 * 3. Copier ce code dans l'éditeur
 * 4. Cliquer sur "Déployer" > "Nouveau déploiement"
 * 5. Type: "Application Web"
 * 6. Qui a accès: "Tout le monde"
 * 7. Copier l'URL de déploiement
 * 8. Ajouter l'URL dans le fichier .env: REACT_APP_GOOGLE_SCRIPT_URL=<votre_url>
 */

function doPost(e) {
  try {
    // Parser les données JSON reçues
    const data = JSON.parse(e.postData.contents);

    // Ouvrir la feuille de calcul
    const spreadsheet = SpreadsheetApp.openById('1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k');
    const sheet = spreadsheet.getSheetByName('Tracking') || spreadsheet.getSheetByName('Sheet1');

    // Préparer les données à insérer
    const row = [
      new Date().toLocaleString('fr-FR'),              // Date/Heure
      data.taskName || '',                              // Nom de la tâche
      data.status || 'completed',                       // Statut
      data.component || '',                              // Composant
      data.action || '',                                 // Action
      data.summary || '',                               // Résumé
      data.details || '',                                // Détails
      data.filesModified ? data.filesModified.join(', ') : '', // Fichiers modifiés
      data.errors || 'Aucune',                          // Erreurs
      data.duration || '',                              // Durée
      data.author || 'Claude Assistant'                 // Auteur
    ];

    // Ajouter la ligne à la feuille
    sheet.appendRow(row);

    // Retourner une réponse de succès
    return ContentService
      .createTextOutput(JSON.stringify({
        'result': 'success',
        'message': 'Données ajoutées avec succès',
        'row': row
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    // En cas d'erreur, retourner l'erreur
    return ContentService
      .createTextOutput(JSON.stringify({
        'result': 'error',
        'error': error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      'result': 'success',
      'message': 'Service de tracking actif'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Fonction pour créer les en-têtes de colonnes si nécessaire
 */
function setupHeaders() {
  const spreadsheet = SpreadsheetApp.openById('1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k');
  const sheet = spreadsheet.getSheetByName('Tracking') || spreadsheet.getSheetByName('Sheet1');

  const headers = [
    'Date/Heure',
    'Nom de la tâche',
    'Statut',
    'Composant',
    'Action',
    'Résumé',
    'Détails',
    'Fichiers modifiés',
    'Erreurs',
    'Durée',
    'Auteur'
  ];

  // Vérifier si les en-têtes existent déjà
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];

  if (firstRow[0] !== headers[0]) {
    // Insérer une nouvelle ligne en haut
    sheet.insertRowBefore(1);

    // Ajouter les en-têtes
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Formater les en-têtes
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#4285f4')
      .setFontColor('#ffffff')
      .setFontWeight('bold');

    // Figer la première ligne
    sheet.setFrozenRows(1);
  }

  return 'En-têtes configurés';
}