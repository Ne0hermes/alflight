// src/utils/performanceExcelExport.js
//
// Exporte les modèles de performance d'un avion vers un fichier Excel (.xlsx).
//
// Format produit :
//   - Feuille « INDEX » : récapitulatif (1 ligne par modèle)
//   - Une feuille par modèle de performance avec :
//       * Bloc métadonnées en haut (nom, type, classification…)
//       * Bloc données : 1 ligne par point (graph, curve, X, Y)
//
// Ce format est ROUND-TRIPPABLE avec performanceExcelImport.js : le pilote
// peut modifier le fichier dans Excel/LibreOffice puis le réimporter.

import * as XLSX from 'xlsx';

/**
 * Sanitize un nom de feuille Excel (max 31 chars, pas de caractères spéciaux).
 */
const sanitizeSheetName = (name, fallback = 'Modèle') => {
  if (!name) return fallback;
  return String(name)
    .slice(0, 30)
    .replace(/[\\/?*[\]:]/g, '_')
    .trim() || fallback;
};

/**
 * Exporte la liste des modèles de performance d'un avion vers un .xlsx.
 * Déclenche automatiquement le téléchargement côté navigateur.
 *
 * @param {Array} models  Liste de data.performanceModels
 * @param {string} aircraftReg  Immatriculation (utilisée dans le nom du fichier)
 * @returns {string} Nom du fichier généré
 */
export function exportPerformanceModelsToExcel(models, aircraftReg = 'UNKNOWN') {
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error('Aucun modèle de performance à exporter.');
  }

  const wb = XLSX.utils.book_new();

  // ─── Feuille INDEX : récapitulatif ─────────────────────────────────────
  const indexRows = [
    ['ALFlight — Export performances'],
    ['Aéronef', aircraftReg],
    ['Date export', new Date().toISOString()],
    ['Nombre de modèles', models.length],
    [],
    ['Pour modifier : édite les valeurs X / Y dans chaque feuille modèle.'],
    ['NE PAS modifier les colonnes Graph ID, Curve ID — elles servent de clés.'],
    ['Les lignes peuvent être ajoutées/supprimées librement.'],
    [],
    ['ID', 'Nom', 'Type', 'Classification', 'Nb graphs', 'Nb courbes', 'Nb points']
  ];

  models.forEach((m) => {
    const nbGraphs = m.data?.graphs?.length || 0;
    let nbCurves = 0;
    let nbPoints = 0;
    (m.data?.graphs || []).forEach((g) => {
      nbCurves += (g.curves || []).length;
      (g.curves || []).forEach((c) => {
        nbPoints += (c.points || []).length;
      });
    });
    indexRows.push([
      m.id || '',
      m.name || '',
      m.type || '',
      m.classification || '',
      nbGraphs,
      nbCurves,
      nbPoints
    ]);
  });

  const wsIndex = XLSX.utils.aoa_to_sheet(indexRows);
  // Largeur de colonnes pour la lisibilité
  wsIndex['!cols'] = [
    { wch: 22 }, { wch: 30 }, { wch: 12 }, { wch: 20 },
    { wch: 11 }, { wch: 11 }, { wch: 11 }
  ];
  XLSX.utils.book_append_sheet(wb, wsIndex, 'INDEX');

  // ─── Une feuille par modèle ────────────────────────────────────────────
  const usedNames = new Set(['INDEX']);
  models.forEach((m, idx) => {
    const rows = [];

    // Bloc métadonnées
    rows.push(['--- MÉTADONNÉES ---']);
    rows.push(['Nom', m.name || '']);
    rows.push(['Type', m.type || '']);
    rows.push(['Classification', m.classification || '']);
    rows.push(['Valeur classification', m.classificationValue ?? '']);
    rows.push(['ID interne', m.id || '']);
    rows.push(['Créé le', m.createdAt || '']);
    rows.push(['Modifié le', m.updatedAt || '']);
    if (m.data?.metadata?.systemType) {
      rows.push(['System Type', m.data.metadata.systemType]);
    }
    if (m.data?.metadata?.sourcePage) {
      rows.push(['Page source MANEX', m.data.metadata.sourcePage]);
    }
    rows.push([]);

    // Bloc données : entête + points
    rows.push(['--- DONNÉES ---']);
    rows.push([
      'Graph ID', 'Graph Name', 'Graph Role', 'Operation ID',
      'Curve ID', 'Curve Name', 'Curve Value',
      'X', 'Y'
    ]);

    (m.data?.graphs || []).forEach((g) => {
      const role = g.role || 'primary';
      const opId = g.operationId || '';
      const graphName = g.name || g.title || '';
      (g.curves || []).forEach((c) => {
        const curveValue = c.value !== undefined && c.value !== null ? c.value : '';
        (c.points || []).forEach((p) => {
          rows.push([
            g.id || '',
            graphName,
            role,
            opId,
            c.id || '',
            c.name || '',
            curveValue,
            Number.isFinite(p.x) ? p.x : '',
            Number.isFinite(p.y) ? p.y : ''
          ]);
        });
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 18 }, { wch: 24 }, { wch: 10 }, { wch: 16 },
      { wch: 18 }, { wch: 20 }, { wch: 14 },
      { wch: 10 }, { wch: 10 }
    ];

    // Sheet name unique (Excel n'accepte pas 2 feuilles homonymes)
    let safeName = sanitizeSheetName(m.name, `Modèle_${idx + 1}`);
    let suffix = 1;
    while (usedNames.has(safeName)) {
      safeName = sanitizeSheetName(`${m.name || 'Modèle'}_${++suffix}`, `Modèle_${idx + 1}_${suffix}`);
    }
    usedNames.add(safeName);

    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });

  // Téléchargement
  const dateSlug = new Date().toISOString().slice(0, 10);
  const fileName = `Performances_${aircraftReg}_${dateSlug}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}

export default exportPerformanceModelsToExcel;
