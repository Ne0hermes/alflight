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

  // ─── Feuille DEBUG : dump JSON brut de tous les inputs ───────────────
  // Inclut tous les tableaux et modèles tels qu'ils sont en mémoire au
  // moment de l'export. Permet de diagnostiquer la structure réelle des
  // données quand un export semble vide.
  const debugRows = [
    ['ALFlight — DEBUG export performances'],
    ['Si l\'export te paraît vide, regarde ici : tu vois le JSON brut de'],
    ['chaque tableau / modèle au moment de l\'export. Partage le contenu'],
    ['de cette feuille pour qu\'on identifie la vraie structure des données.'],
    [],
    ['─── MODÈLES ABAQUES (performanceModels) ───'],
    ['Nombre', safeModels.length],
    []
  ];
  safeModels.forEach((m, idx) => {
    debugRows.push([`Modèle #${idx + 1}`, JSON.stringify(m).slice(0, 32000)]);
  });
  debugRows.push([], ['─── TABLEAUX (advancedPerformance.tables) ───'], ['Nombre', safeTables.length], []);
  safeTables.forEach((t, idx) => {
    debugRows.push([`Tableau #${idx + 1}`, JSON.stringify(t).slice(0, 32000)]);
  });
  const wsDebug = XLSX.utils.aoa_to_sheet(debugRows);
  wsDebug['!cols'] = [{ wch: 25 }, { wch: 200 }];
  XLSX.utils.book_append_sheet(wb, wsDebug, 'DEBUG_RAW');

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
      console.log(`📊 [ExcelExport] Tableau ${idx + 1} structure:`, {
        keys: Object.keys(t),
        table_name: t.table_name,
        operationId: t.operationId,
        outputUnit: t.outputUnit,
        hasData: !!t.data,
        dataIsArray: Array.isArray(t.data),
        dataLength: Array.isArray(t.data) ? t.data.length : 'N/A',
        firstRow: Array.isArray(t.data) && t.data[0] ? t.data[0] : null,
        hasHeaders: !!t.headers,
        hasRows: !!t.rows,
        hasConditions: !!t.conditions
      });

      rows.push([`▼ Tableau ${idx + 1} : ${t.table_name || t.title || '(sans nom)'}`]);
      if (t.pageNumber) rows.push(['Page MANEX', t.pageNumber]);
      if (t.operationId) rows.push(['Operation ID', t.operationId]);
      if (t.outputUnit) rows.push(['Output Unit', t.outputUnit]);
      if (t.conditions && typeof t.conditions === 'object') {
        Object.entries(t.conditions).forEach(([k, v]) => {
          rows.push([`Condition: ${k}`, typeof v === 'object' ? JSON.stringify(v) : v]);
        });
      } else if (typeof t.conditions === 'string') {
        rows.push(['Conditions', t.conditions]);
      }
      rows.push([]);

      // ─── Stratégies multiples pour extraire les rows ──────────────────
      // L'IA peut retourner les données sous plusieurs formats selon la
      // version du prompt et le post-traitement appliqué :
      //   1. t.data = [{col1: v, col2: v, value: v}, ...]   ← prompt actuel
      //   2. t.headers = [...], t.rows = [[v1, v2], ...]    ← format ancien
      //   3. t.data = "json string"                          ← edge case
      let dataRows = [];
      let columns = [];

      if (Array.isArray(t.data) && t.data.length > 0) {
        // Cas 1 : array d'objets (format standard)
        dataRows = t.data;
        if (typeof dataRows[0] === 'object' && dataRows[0] !== null) {
          // Récupère TOUTES les colonnes vues dans le set de rows (pas que la 1ère)
          const allCols = new Set();
          dataRows.forEach(r => {
            if (r && typeof r === 'object') Object.keys(r).forEach(k => allCols.add(k));
          });
          columns = Array.from(allCols);
        }
      } else if (Array.isArray(t.headers) && Array.isArray(t.rows)) {
        // Cas 2 : format headers + rows séparés
        columns = t.headers.map(h => String(h));
        dataRows = t.rows.map(row => {
          if (Array.isArray(row)) {
            const obj = {};
            t.headers.forEach((h, i) => { obj[h] = row[i]; });
            return obj;
          }
          return row;
        });
      } else if (typeof t.data === 'string') {
        // Cas 3 : data stringifié, tente un JSON.parse
        try {
          const parsed = JSON.parse(t.data);
          if (Array.isArray(parsed)) {
            dataRows = parsed;
            if (parsed[0] && typeof parsed[0] === 'object') {
              columns = Object.keys(parsed[0]);
            }
          }
        } catch (e) {
          rows.push(['Données brutes (string non parsée)', t.data]);
        }
      }

      if (columns.length > 0 && dataRows.length > 0) {
        rows.push(columns);
        dataRows.forEach(row => {
          rows.push(columns.map(c => {
            const v = row[c];
            if (v === null || v === undefined) return '';
            if (typeof v === 'object') return JSON.stringify(v);
            return v;
          }));
        });
      } else if (dataRows.length > 0) {
        // Fallback : dump JSON brut
        rows.push(['Données (format inconnu, JSON brut)']);
        dataRows.forEach(r => rows.push([typeof r === 'object' ? JSON.stringify(r) : String(r)]));
      } else {
        // VRAIMENT vide → on dump l'objet entier pour debug
        rows.push(['(aucune donnée structurée trouvée)']);
        rows.push(['Objet brut JSON :', JSON.stringify(t, null, 2)]);
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
