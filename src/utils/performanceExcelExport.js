// src/utils/performanceExcelExport.js
//
// Exporte les modèles de performance d'un avion vers un fichier Excel (.xlsx).
//
// Format produit :
//   - Feuille « INDEX » : récapitulatif (1 ligne par modèle)
//   - Une feuille par modèle de performance avec :
//       * Bloc métadonnées en haut (nom, type, classification…)
//       * Bloc données : 1 ligne par point (graph, curve, X, Y)
//   - Feuille technique « _STRUCTURE » (masquée) : JSON complet de la
//     structure des abaques, SANS les points ni les courbes fittées.
//
// Ce format est ROUND-TRIPPABLE avec performanceExcelImport.js : le pilote
// peut modifier le fichier dans Excel/LibreOffice puis le réimporter.
//
// ⚠️ HISTORIQUE (2026-08-19, dossier F-GBTU) : jusqu'ici l'export n'écrivait
// par courbe QUE Graph ID / noms / rôle / X / Y. Un abaque n'est pas un
// tableau : c'est une STRUCTURE (axes min/max/unit/title, chaînage
// linkedTo/linkedFrom/cascadeOrder, familyAxisVariable, vent
// isWindRelated/windDirection, interpolationMode) + des courbes. Le ré-import
// reconstruisait donc des graphes squelettes et le moteur de cascade échouait
// (« n'a pas d'axes configurés », « Entrée(s) de panneau manquante(s) ») :
// les 4 opérations de F-GBTU étaient incalculables après un aller-retour.
// D'où la feuille _STRUCTURE : les POINTS restent dans les feuilles lisibles
// (c'est ce que le pilote édite), la STRUCTURE transite en JSON intact.

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
 * Produit un nom de feuille unique parmi `usedNames`.
 *
 * 🔧 FIX BOUCLE INFINIE : auparavant on faisait
 *   safeName = sanitizeSheetName(`${base}_${suffix}`)
 * mais le slice(0,30) tronquait le suffixe → si deux bases tronquaient
 * vers la même valeur, on tournait à l'infini (CPU 100%, navigateur freeze).
 *
 * Nouvelle stratégie : on RÉSERVE explicitement la place du suffixe à la fin.
 */
const uniqueSheetName = (baseName, usedNames, fallback = 'Sheet') => {
  // Tentative 1 : nom direct
  let candidate = sanitizeSheetName(baseName, fallback);
  if (!usedNames.has(candidate)) return candidate;

  // Sinon on tronque le base name pour réserver "_NN" en fin
  const safeBase = String(baseName || fallback).replace(/[\\/?*[\]:]/g, '_').trim();
  for (let n = 2; n <= 999; n++) {
    const suffix = `_${n}`;
    const truncated = safeBase.slice(0, 30 - suffix.length);
    candidate = (truncated + suffix).slice(0, 30);
    if (!usedNames.has(candidate)) return candidate;
  }
  // Garde-fou ultime : random pour ne JAMAIS boucler
  return (fallback.slice(0, 23) + '_' + Math.random().toString(36).slice(2, 8)).slice(0, 30);
};

// ─── Feuille technique _STRUCTURE ─────────────────────────────────────────
// Nom partagé avec performanceExcelImport.js (qui l'importe d'ici) : une
// seule source de vérité pour éviter une divergence silencieuse.
export const STRUCTURE_SHEET_NAME = '_STRUCTURE';
// Version du format de la feuille : à incrémenter si le schéma JSON change,
// pour que l'import puisse router les migrations futures.
export const STRUCTURE_FORMAT_VERSION = 1;
// Excel limite une cellule à 32767 caractères : on chunke le JSON bien en
// dessous pour garder une marge (et ne JAMAIS tronquer — un JSON tronqué
// serait pire que pas de structure du tout).
const STRUCTURE_CHUNK_SIZE = 30000;

// Clone JSON-safe : les modèles de performance sont du JSON pur (persistés
// tels quels), donc pas besoin de structuredClone (indispo vieux environnements).
const deepClone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/**
 * Découpe une chaîne en chunks ≤ size SANS couper une paire de substitution
 * UTF-16 (émoji dans un nom de courbe → une moitié de surrogate isolée dans
 * une cellule serait remplacée par U+FFFD à l'écriture xlsx, corrompant le
 * JSON à la reconstitution).
 */
const chunkString = (s, size = STRUCTURE_CHUNK_SIZE) => {
  const chunks = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + size, s.length);
    if (end < s.length) {
      const c = s.charCodeAt(end - 1);
      if (c >= 0xd800 && c <= 0xdbff) end -= 1; // high surrogate en fin → recule
    }
    chunks.push(s.slice(i, end));
    i = end;
  }
  return chunks.length ? chunks : [''];
};

/**
 * Construit le payload de structure d'UN modèle : le modèle COMPLET sans les
 * données volumineuses/reconstructibles :
 *   - `curve.points` retirés (ils vivent dans la feuille lisible — c'est ce
 *     que le pilote édite dans Excel)
 *   - `curve.fitted` retirés (dérivés des points, recalculés à la demande)
 *   - image de l'atelier retirée si data:/blob: (peut peser des Mo — hors
 *     gabarit d'une cellule Excel ; le cadrage x/y/width/height est conservé
 *     pour ré-import d'une image ultérieure)
 * Tout le reste (axes, rôles, cascadeOrder, linkedTo/linkedFrom,
 * familyAxisVariable, familyValue/windDirection par courbe, interpolationMode,
 * metadata dont referenceCases) est copié TEL QUEL — copie intégrale par
 * défaut pour que les champs futurs survivent sans retoucher l'export.
 */
export function buildModelStructurePayload(model) {
  const m = deepClone(model) || {};
  const stripCurve = (c) => {
    if (!c || typeof c !== 'object') return c;
    const { points, fitted, ...rest } = c;
    return rest;
  };
  if (m.data && typeof m.data === 'object') {
    if (Array.isArray(m.data.graphs)) {
      m.data.graphs = m.data.graphs.map((g) => {
        if (!g || typeof g !== 'object') return g;
        return { ...g, curves: (g.curves || []).map(stripCurve) };
      });
    }
    // Format legacy (AbacCurvesJSON compat) : data.curves à plat.
    if (Array.isArray(m.data.curves)) {
      m.data.curves = m.data.curves.map(stripCurve);
    }
    const img = m.data.metadata?.workshop?.image;
    if (img && typeof img.url === 'string' && /^(data:|blob:)/.test(img.url)) {
      m.data.metadata.workshop = {
        ...m.data.metadata.workshop,
        image: null,
        // Trace explicite : l'atelier saura pourquoi l'image manque au ré-import.
        imageStrippedOnExport: true
      };
    }
  }
  return { version: STRUCTURE_FORMAT_VERSION, model: m };
}

/**
 * Ajoute la feuille _STRUCTURE au workbook : 1 bloc de lignes par modèle,
 * JSON chunké sur la colonne E. La feuille est ensuite MASQUÉE (voir
 * buildPerformanceWorkbook) mais garde un en-tête explicatif au cas où le
 * pilote l'affiche dans Excel.
 */
function appendStructureSheet(wb, models) {
  const rows = [
    ['--- STRUCTURE TECHNIQUE — NE PAS MODIFIER ---'],
    ['Cette feuille contient la structure des abaques (axes, chaînage de cascade, vent, familles de courbes).'],
    ['Elle est relue telle quelle au ré-import pour reconstruire les graphes : la modifier casse la fusion.'],
    ['Les points de courbes se modifient dans les feuilles lisibles, PAS ici.'],
    ['Version format', STRUCTURE_FORMAT_VERSION],
    [],
    ['Model ID', 'Model Name', 'Part', 'Total Parts', 'JSON']
  ];
  models.forEach((m) => {
    let json;
    try {
      json = JSON.stringify(buildModelStructurePayload(m));
    } catch (err) {
      // Un modèle non sérialisable ne doit pas faire échouer tout l'export :
      // il retombera au ré-import sur la fusion avec le modèle existant (cas b).
      console.warn(`⚠️ [ExcelExport] Structure du modèle "${m?.name || m?.id}" non sérialisable — ignorée:`, err);
      return;
    }
    const chunks = chunkString(json);
    chunks.forEach((chunk, i) => {
      rows.push([m.id || '', m.name || '', i + 1, chunks.length, chunk]);
    });
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 6 }, { wch: 10 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws, STRUCTURE_SHEET_NAME);
}

/**
 * Construit le workbook complet (INDEX, INFO, tableaux, modèles, _STRUCTURE)
 * SANS déclencher de téléchargement — séparé de exportPerformanceModelsToExcel
 * pour être testable sous node (vitest environnement 'node' : pas de
 * document/Blob) et rejouable dans les tests d'aller-retour.
 *
 * @param {Array} models  Liste de data.performanceModels (peut être vide
 *                        si seuls des tables sont fournis)
 * @param {string} aircraftReg  Immatriculation (feuille INDEX)
 * @param {object} options
 * @param {Array} options.tables  Liste de data.advancedPerformance.tables
 *                                à exporter (groupés par classification).
 * @returns {object} Workbook SheetJS prêt à écrire
 */
export function buildPerformanceWorkbook(models, aircraftReg = 'UNKNOWN', options = {}) {
  const safeModels = Array.isArray(models) ? models : [];
  const safeTables = Array.isArray(options?.tables) ? options.tables : [];

  if (safeModels.length === 0 && safeTables.length === 0) {
    throw new Error('Aucune donnée de performance à exporter.');
  }

  // ─── Audit upfront du volume pour détecter les pathologies ──────────────
  // Si un tableau a > 5000 rows ou des objets > 50 KB chacun, on tronque
  // pour éviter de freezer le navigateur. L'export reste utilisable.
  const MAX_ROWS_PER_TABLE = 5000;
  const MAX_POINTS_PER_CURVE = 2000;
  const audit = { tablesTotal: 0, rowsTotal: 0, biggestTable: 0, modelsTotal: 0, pointsTotal: 0, biggestCurve: 0, warnings: [] };
  safeTables.forEach((t, idx) => {
    audit.tablesTotal++;
    const n = Array.isArray(t?.data) ? t.data.length : 0;
    audit.rowsTotal += n;
    if (n > audit.biggestTable) audit.biggestTable = n;
    if (n > MAX_ROWS_PER_TABLE) {
      audit.warnings.push(`Tableau ${idx + 1} : ${n} rows → tronqué à ${MAX_ROWS_PER_TABLE}`);
    }
  });
  safeModels.forEach((m, idx) => {
    audit.modelsTotal++;
    (m.data?.graphs || []).forEach((g) => {
      (g.curves || []).forEach((c) => {
        const n = (c.points || []).length;
        audit.pointsTotal += n;
        if (n > audit.biggestCurve) audit.biggestCurve = n;
        if (n > MAX_POINTS_PER_CURVE) {
          audit.warnings.push(`Modèle "${m.name || idx}" courbe "${c.name || c.id}" : ${n} points → tronqué à ${MAX_POINTS_PER_CURVE}`);
        }
      });
    });
  });
  console.log(`📊 [ExcelExport] Audit tableaux : ${audit.tablesTotal} tab, ${audit.rowsTotal} rows total, max=${audit.biggestTable}`);
  console.log(`📊 [ExcelExport] Audit modèles  : ${audit.modelsTotal} modèles, ${audit.pointsTotal} points total, max courbe=${audit.biggestCurve}`);
  if (audit.warnings.length) console.warn('⚠️ [ExcelExport]', audit.warnings);

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
  // INFO et _STRUCTURE sont réservés : un modèle homonyme aurait fait planter
  // book_append_sheet (noms de feuilles uniques exigés par Excel).
  const usedNames = new Set(['INDEX', 'INFO', STRUCTURE_SHEET_NAME]);

  // ─── Une feuille par tableau extrait du MANEX (advancedPerformance.tables) ─
  // Format différent des abaques : grilles 2D (rows × columns).
  // Groupage par classification pour la lisibilité.
  const tablesByClassification = {};
  safeTables.forEach(t => {
    const cls = t.classification || 'non-classified';
    if (!tablesByClassification[cls]) tablesByClassification[cls] = [];
    tablesByClassification[cls].push(t);
  });

  console.time('[ExcelExport] tables');
  Object.entries(tablesByClassification).forEach(([classification, tables]) => {
    console.time(`[ExcelExport] cls=${classification}`);
    const rows = [];
    rows.push(['--- TABLEAUX EXTRAITS ---']);
    rows.push(['Classification', classification]);
    rows.push(['Nombre de tableaux', tables.length]);
    rows.push([]);

    tables.forEach((t, idx) => {
      rows.push([`▼ Tableau ${idx + 1} : ${safeCell(t.table_name || t.title || '(sans nom)')}`]);
      if (t.pageNumber) rows.push(['Page manuel de vol', t.pageNumber]);
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
        // 🚧 Cap de sécurité : pas plus de MAX_ROWS_PER_TABLE rows par tableau
        const originalLen = t.data.length;
        dataRows = originalLen > MAX_ROWS_PER_TABLE ? t.data.slice(0, MAX_ROWS_PER_TABLE) : t.data;
        if (originalLen > MAX_ROWS_PER_TABLE) {
          rows.push([`⚠️ Tronqué : ${originalLen} rows source → ${MAX_ROWS_PER_TABLE} exportées.`]);
        }
        if (typeof dataRows[0] === 'object' && dataRows[0] !== null) {
          // Récupère TOUTES les colonnes vues dans les 1000 premières rows
          // (au-delà, les colonnes additionnelles sont rares et le coût O(N*M)
          // peut devenir bloquant si une table a beaucoup de keys différentes).
          const allCols = new Set();
          const sampleSize = Math.min(dataRows.length, 1000);
          for (let i = 0; i < sampleSize; i++) {
            const r = dataRows[i];
            if (r && typeof r === 'object') {
              for (const k of Object.keys(r)) allCols.add(k);
            }
          }
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
    const safeName = uniqueSheetName(`Tab_${classification}`, usedNames, `Tableaux_${classification}`);
    usedNames.add(safeName);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
    console.timeEnd(`[ExcelExport] cls=${classification}`);
  });
  console.timeEnd('[ExcelExport] tables');

  console.time('[ExcelExport] models');
  safeModels.forEach((m, idx) => {
    console.time(`[ExcelExport] model #${idx + 1} ${m.name || ''}`);
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
      rows.push(['Page source manuel de vol', m.data.metadata.sourcePage]);
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
        const allPoints = c.points || [];
        // 🚧 Cap points par courbe pour éviter freeze sur abaques aberrants
        const points = allPoints.length > MAX_POINTS_PER_CURVE
          ? allPoints.slice(0, MAX_POINTS_PER_CURVE)
          : allPoints;
        if (allPoints.length > MAX_POINTS_PER_CURVE) {
          rows.push([`⚠️ Courbe ${c.name || c.id} : ${allPoints.length} points → tronqué à ${MAX_POINTS_PER_CURVE}`]);
        }
        points.forEach((p) => {
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

    // Sheet name unique (Excel n'accepte pas 2 feuilles homonymes) — via
    // helper anti-boucle-infinie qui réserve la place du suffixe.
    const safeName = uniqueSheetName(m.name || `Modèle_${idx + 1}`, usedNames, `Modèle_${idx + 1}`);
    usedNames.add(safeName);

    XLSX.utils.book_append_sheet(wb, ws, safeName);
    console.timeEnd(`[ExcelExport] model #${idx + 1} ${m.name || ''}`);
  });
  console.timeEnd('[ExcelExport] models');

  // ─── Feuille technique _STRUCTURE (fix aller-retour destructeur) ────────
  // Écrite en DERNIER (elle référence tous les modèles exportés) puis masquée :
  // le pilote ne doit ni la voir ni la toucher — les points s'éditent dans
  // les feuilles lisibles ci-dessus.
  if (safeModels.length > 0) {
    appendStructureSheet(wb, safeModels);
  }
  // Masquage : SheetJS lit Workbook.Sheets[i].Hidden (aligné sur SheetNames).
  // On pose le flag pour TOUTES les feuilles afin que l'alignement par index
  // soit sans ambiguïté. INDEX reste visible → Excel a toujours ≥ 1 feuille
  // visible (exigence du format, sinon fichier refusé à l'ouverture).
  wb.Workbook = wb.Workbook || {};
  wb.Workbook.Sheets = wb.SheetNames.map((n) => ({
    name: n,
    Hidden: n === STRUCTURE_SHEET_NAME ? 1 : 0
  }));

  return wb;
}

/**
 * Exporte la liste des modèles de performance d'un avion vers un .xlsx.
 * Déclenche automatiquement le téléchargement côté navigateur.
 * (Construction du workbook déléguée à buildPerformanceWorkbook — testable.)
 *
 * @returns {string} Nom du fichier généré
 */
export function exportPerformanceModelsToExcel(models, aircraftReg = 'UNKNOWN', options = {}) {
  const t0 = performance.now();
  const wb = buildPerformanceWorkbook(models, aircraftReg, options);

  // Téléchargement : on passe par Blob pour éviter d'utiliser XLSX.writeFile
  // qui peut être plus long et bloquant. Le navigateur s'occupe de l'écriture
  // disque en tâche de fond.
  const dateSlug = new Date().toISOString().slice(0, 10);
  const fileName = `Performances_${aircraftReg}_${dateSlug}.xlsx`;
  try {
    console.time('[ExcelExport] XLSX.write');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    console.timeEnd('[ExcelExport] XLSX.write');

    console.time('[ExcelExport] Blob+download');
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
    console.timeEnd('[ExcelExport] Blob+download');
    console.log(`✅ [ExcelExport] Terminé en ${Math.round(performance.now() - t0)}ms — ${fileName}`);
  } catch (err) {
    console.error('[ExcelExport] Erreur écriture xlsx:', err);
    throw err;
  }
  return fileName;
}

export default exportPerformanceModelsToExcel;
