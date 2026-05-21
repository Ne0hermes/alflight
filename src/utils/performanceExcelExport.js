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
 * @param {Array} models  Liste de data.performanceModels (peut être vide
 *                        si seuls des tables sont fournis)
 * @param {string} aircraftReg  Immatriculation (utilisée dans le nom du fichier)
 * @param {object} options
 * @param {Array} options.tables  Liste de data.advancedPerformance.tables
 *                                à exporter (groupés par classification).
 * @returns {string} Nom du fichier généré
 */
export function exportPerformanceModelsToExcel(models, aircraftReg = 'UNKNOWN', options = {}) {
  const safeModels = Array.isArray(models) ? models : [];
  const safeTables = Array.isArray(options?.tables) ? options.tables : [];

  if (safeModels.length === 0 && safeTables.length === 0) {
    throw new Error('Aucune donnée de performance à exporter.');
  }

  const wb = XLSX.utils.book_new();

  // ─── Feuille INDEX : récapitulatif ─────────────────────────────────────
  const indexRows = [
    ['ALFlight — Export performances'],
    ['Aéronef', aircraftReg],
    ['Date export', new Date().toISOString()],
    ['Nombre de modèles abaque', safeModels.length],
    ['Nombre de tableaux', safeTables.length],
    [],
    ['Pour modifier : édite les valeurs dans chaque feuille.'],
    ['NE PAS modifier les colonnes ID — elles servent de clés.'],
    ['Les lignes peuvent être ajoutées/supprimées librement.'],
    [],
    ['ID', 'Nom', 'Type', 'Classification', 'Nb graphs', 'Nb courbes', 'Nb points']
  ];

  safeModels.forEach((m) => {
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

  // ─── Une feuille par tableau extrait du MANEX (advancedPerformance.tables) ─
  // Format différent des abaques : grilles 2D (rows × columns).
  // Groupage par classification pour la lisibilité.
  const tablesByClassification = {};
  safeTables.forEach(t => {
    const cls = t.classification || 'non-classified';
    if (!tablesByClassification[cls]) tablesByClassification[cls] = [];
    tablesByClassification[cls].push(t);
  });

  Object.entries(tablesByClassification).forEach(([classification, tables]) => {
    const rows = [];
    rows.push(['--- TABLEAUX EXTRAITS ---']);
    rows.push(['Classification', classification]);
    rows.push(['Nombre de tableaux', tables.length]);
    rows.push([]);

    tables.forEach((t, idx) => {
      rows.push([`▼ Tableau ${idx + 1} : ${t.table_name || t.title || '(sans nom)'}`]);
      if (t.pageNumber) rows.push(['Page MANEX', t.pageNumber]);
      if (t.operationId) rows.push(['Operation ID', t.operationId]);
      if (t.conditions && typeof t.conditions === 'object') {
        Object.entries(t.conditions).forEach(([k, v]) => {
          rows.push([`Condition: ${k}`, typeof v === 'object' ? JSON.stringify(v) : v]);
        });
      }
      rows.push([]);

      const dataRows = Array.isArray(t.data) ? t.data : [];
      if (dataRows.length > 0 && typeof dataRows[0] === 'object' && dataRows[0] !== null) {
        const columns = Object.keys(dataRows[0]);
        rows.push(columns);
        dataRows.forEach(row => {
          rows.push(columns.map(c => row[c] ?? ''));
        });
      } else if (dataRows.length > 0) {
        rows.push(['Données brutes']);
        dataRows.forEach(r => rows.push([typeof r === 'object' ? JSON.stringify(r) : r]));
      } else {
        rows.push(['(aucune donnée)']);
      }
      rows.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 32 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
    let safeName = sanitizeSheetName(`Tab_${classification}`, `Tableaux_${classification}`);
    let suffix = 1;
    while (usedNames.has(safeName)) {
      safeName = sanitizeSheetName(`Tab_${classification}_${++suffix}`, `Tab_${classification}_${suffix}`);
    }
    usedNames.add(safeName);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });

  safeModels.forEach((m, idx) => {
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
