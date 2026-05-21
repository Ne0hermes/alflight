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

// Limite des cellules Excel (32767 max selon spec, on garde une marge).
const MAX_CELL_CHARS = 8000;
const safeCell = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  const s = typeof v === 'string' ? v : (() => {
    try { return JSON.stringify(v); } catch { return String(v); }
  })();
  return s.length > MAX_CELL_CHARS ? s.slice(0, MAX_CELL_CHARS) + '…[truncated]' : s;
};

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

  // ─── Feuille DEBUG (allégée) : juste les clés/tailles, pas les dumps JSON ─
  // L'ancienne version dumpait JSON.stringify(t) pour chaque tableau, ce qui
  // saturait le CPU et faisait freezer le navigateur sur 10+ gros tableaux.
  // Désormais : juste un résumé. Pour un dump complet, exporter via
  // l'option { debug: true } depuis l'appelant si nécessaire.
  const debugRows = [
    ['ALFlight — Résumé export'],
    ['Modèles abaques', safeModels.length],
    ['Tableaux', safeTables.length],
    [],
    ['#', 'Nom', 'Type / Classification', 'Clés disponibles']
  ];
  safeModels.forEach((m, idx) => {
    debugRows.push([
      idx + 1,
      safeCell(m.name),
      safeCell(m.type),
      safeCell(Object.keys(m || {}).join(', '))
    ]);
  });
  safeTables.forEach((t, idx) => {
    debugRows.push([
      `T${idx + 1}`,
      safeCell(t.table_name || t.title),
      safeCell(t.classification),
      safeCell(Object.keys(t || {}).join(', '))
    ]);
  });
  const wsDebug = XLSX.utils.aoa_to_sheet(debugRows);
  wsDebug['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 20 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsDebug, 'INFO');

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
      rows.push([`▼ Tableau ${idx + 1} : ${safeCell(t.table_name || t.title || '(sans nom)')}`]);
      if (t.pageNumber) rows.push(['Page MANEX', t.pageNumber]);
      if (t.operationId) rows.push(['Operation ID', safeCell(t.operationId)]);
      if (t.outputUnit) rows.push(['Output Unit', safeCell(t.outputUnit)]);
      if (t.conditions && typeof t.conditions === 'object') {
        Object.entries(t.conditions).forEach(([k, v]) => {
          rows.push([`Condition: ${k}`, safeCell(v)]);
        });
      } else if (typeof t.conditions === 'string') {
        rows.push(['Conditions', safeCell(t.conditions)]);
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
          rows.push(columns.map(c => safeCell(row?.[c])));
        });
      } else if (dataRows.length > 0) {
        // Fallback : dump JSON brut (chaque cellule capée)
        rows.push(['Données (format inconnu, JSON brut)']);
        dataRows.forEach(r => rows.push([safeCell(r)]));
      } else {
        // VRAIMENT vide → on indique uniquement les clés disponibles, sans
        // re-stringifier tout l'objet (qui pouvait être énorme et freezer
        // l'export pour 10+ tableaux).
        rows.push(['(aucune donnée structurée trouvée)']);
        rows.push(['Clés disponibles', safeCell(Object.keys(t || {}).join(', '))]);
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

  // Téléchargement : on passe par Blob pour éviter d'utiliser XLSX.writeFile
  // qui peut être plus long et bloquant. Le navigateur s'occupe de l'écriture
  // disque en tâche de fond.
  const dateSlug = new Date().toISOString().slice(0, 10);
  const fileName = `Performances_${aircraftReg}_${dateSlug}.xlsx`;
  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Libère le blob après un petit délai pour que le téléchargement parte.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('[ExcelExport] Erreur écriture xlsx:', err);
    throw err;
  }
  return fileName;
}

export default exportPerformanceModelsToExcel;
