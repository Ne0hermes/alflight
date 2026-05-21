// src/utils/performanceExcelImport.js
//
// Lit un .xlsx exporté par performanceExcelExport.js et reconstruit la liste
// `performanceModels` qu'on peut injecter dans le wizard.
//
// Tolérant aux modifications par le pilote :
//  - Ajout / suppression de lignes de points OK
//  - Réordonnancement OK
//  - Modification des valeurs X / Y OK
//  - Modification des métadonnées OK (sauf ID interne — c'est la clé)
//
// Renvoie un diff lisible pour aperçu avant écrasement.

import * as XLSX from 'xlsx';

/**
 * Parse un .xlsx exporté et reconstruit les modèles.
 *
 * @param {File} file  Fichier .xlsx sélectionné par le pilote
 * @returns {Promise<{models: Array, sheets: number, warnings: string[]}>}
 */
export async function importPerformanceModelsFromExcel(file) {
  if (!file) throw new Error('Aucun fichier fourni.');
  const arrayBuf = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuf, { type: 'array' });

  const models = [];
  const tables = [];
  const warnings = [];
  let parsedSheets = 0;

  for (const sheetName of wb.SheetNames) {
    if (sheetName === 'INDEX' || sheetName === 'DEBUG_RAW') continue;
    parsedSheets++;
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

    // Détecte le type de feuille via le premier marker trouvé dans les 10 premières lignes
    const firstMarkers = rows.slice(0, 10).map(r => (r[0] !== undefined ? String(r[0]).trim() : ''));
    const isTablesSheet = firstMarkers.includes('--- TABLEAUX EXTRAITS ---') || firstMarkers.includes('--- TABLEAUX ---');

    if (isTablesSheet) {
      const sheetTables = parseTablesSheet(rows, sheetName, warnings);
      tables.push(...sheetTables);
      continue;
    }

    // Parser métadonnées (clé en col A, valeur en col B)
    const meta = {};
    let dataHeaderRowIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || [];
      const first = r[0] !== undefined ? String(r[0]).trim() : '';
      if (first === '--- DONNÉES ---' || first === '--- DONNEES ---') {
        // La ligne suivante est l'en-tête, les données commencent après
        dataHeaderRowIdx = i + 1;
        break;
      }
      if (first && first.startsWith('---')) continue;
      if (first && r[1] !== undefined && r[1] !== '') {
        meta[first] = r[1];
      }
    }

    if (dataHeaderRowIdx < 0) {
      warnings.push(`Feuille « ${sheetName} » : pas de bloc DONNÉES trouvé — ignorée.`);
      continue;
    }

    const headerRow = rows[dataHeaderRowIdx] || [];
    // Trouver les index des colonnes attendues (souplesse si l'ordre est modifié)
    const colIdx = {
      gId: headerRow.indexOf('Graph ID'),
      gName: headerRow.indexOf('Graph Name'),
      gRole: headerRow.indexOf('Graph Role'),
      opId: headerRow.indexOf('Operation ID'),
      cId: headerRow.indexOf('Curve ID'),
      cName: headerRow.indexOf('Curve Name'),
      cValue: headerRow.indexOf('Curve Value'),
      x: headerRow.indexOf('X'),
      y: headerRow.indexOf('Y')
    };
    if (colIdx.gId < 0 || colIdx.x < 0 || colIdx.y < 0) {
      warnings.push(`Feuille « ${sheetName} » : colonnes obligatoires absentes (Graph ID, X, Y).`);
      continue;
    }

    const graphMap = new Map();
    for (let i = dataHeaderRowIdx + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const gId = r[colIdx.gId] !== undefined ? String(r[colIdx.gId]) : '';
      if (!gId) continue;

      if (!graphMap.has(gId)) {
        graphMap.set(gId, {
          id: gId,
          name: r[colIdx.gName] !== undefined ? String(r[colIdx.gName]) : '',
          role: r[colIdx.gRole] !== undefined ? String(r[colIdx.gRole]) : 'primary',
          operationId: r[colIdx.opId] !== undefined ? String(r[colIdx.opId]) : '',
          curves: []
        });
      }
      const graph = graphMap.get(gId);
      const cId = r[colIdx.cId] !== undefined ? String(r[colIdx.cId]) : '';
      if (!cId) continue;

      let curve = graph.curves.find((c) => c.id === cId);
      if (!curve) {
        const rawValue = r[colIdx.cValue];
        curve = {
          id: cId,
          name: r[colIdx.cName] !== undefined ? String(r[colIdx.cName]) : '',
          value: rawValue !== '' && rawValue !== undefined ? rawValue : undefined,
          points: []
        };
        graph.curves.push(curve);
      }

      const xRaw = r[colIdx.x];
      const yRaw = r[colIdx.y];
      const x = Number(xRaw);
      const y = Number(yRaw);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        curve.points.push({ x, y });
      }
    }

    // Trier les points par X croissant (utile pour les abaques)
    graphMap.forEach((g) => {
      g.curves.forEach((c) => {
        c.points.sort((a, b) => a.x - b.x);
      });
    });

    models.push({
      id: meta['ID interne'] || `model_${Date.now()}_${parsedSheets}`,
      name: meta['Nom'] || sheetName,
      type: meta['Type'] || 'abaque',
      classification: meta['Classification'] || '',
      classificationValue: meta['Valeur classification'] ?? '',
      createdAt: meta['Créé le'] || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: {
        graphs: Array.from(graphMap.values()),
        metadata: {
          systemType: meta['System Type'],
          sourcePage: meta['Page source MANEX']
        }
      },
      _reimportedFromExcel: true
    });
  }

  return { models, tables, sheets: parsedSheets, warnings };
}

/**
 * Parse une feuille de classification de tableaux (format Tab_<classification>).
 * Structure :
 *   --- TABLEAUX EXTRAITS ---
 *   Classification | <cls>
 *   Nombre de tableaux | <N>
 *   (vide)
 *   ▼ Tableau 1 : <table_name>
 *   Page MANEX | <n>
 *   Operation ID | <id>
 *   Output Unit | <u>
 *   Condition: xxx | <v>
 *   (vide)
 *   <col1> | <col2> | ... <colN>     ← ligne d'en-tête de données
 *   <val1> | <val2> | ... <valN>     ← rows de données
 *   ...
 *   (vide)
 *   ▼ Tableau 2 : ...
 */
function parseTablesSheet(rows, sheetName, warnings) {
  const result = [];
  let classification = sheetName.startsWith('Tab_')
    ? sheetName.slice(4)
    : 'non-classified';

  let current = null;
  let columns = null;
  let mode = 'header'; // 'header' | 'table-meta' | 'table-header' | 'table-data'

  const pushIfValid = () => {
    if (current && current.data.length > 0) {
      result.push(current);
    } else if (current) {
      warnings.push(`Tableau « ${current.table_name} » : 0 ligne — ignoré.`);
    }
  };

  const isRowEmpty = (r) => !r || r.filter((c) => c !== undefined && c !== null && c !== '').length === 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const first = row[0] !== undefined ? String(row[0]).trim() : '';

    if (first === '--- TABLEAUX EXTRAITS ---' || first === '--- TABLEAUX ---') {
      continue;
    }
    if (first === 'Classification' && row[1]) {
      classification = String(row[1]).trim();
      continue;
    }
    if (first === 'Nombre de tableaux') continue;

    // Nouveau tableau ?
    if (first.startsWith('▼')) {
      pushIfValid();
      const nameMatch = first.match(/▼\s*Tableau\s+\d+\s*:\s*(.+)/);
      current = {
        classification,
        table_name: nameMatch ? nameMatch[1].trim() : first.replace(/^▼\s*/, ''),
        data: [],
        validation: { errors: [], isValid: true },
        _reimportedFromExcel: true
      };
      columns = null;
      mode = 'table-meta';
      continue;
    }

    if (!current) continue;

    // Métadonnées du tableau courant
    if (mode === 'table-meta') {
      if (first === 'Page MANEX' && row[1] !== '') {
        current.pageNumber = isNaN(Number(row[1])) ? row[1] : Number(row[1]);
        continue;
      }
      if (first === 'Operation ID' && row[1] !== '') {
        current.operationId = String(row[1]).trim();
        continue;
      }
      if (first === 'Output Unit' && row[1] !== '') {
        current.outputUnit = String(row[1]).trim();
        continue;
      }
      if (first.startsWith('Condition:') && row[1] !== '') {
        if (!current.conditions) current.conditions = {};
        const key = first.replace('Condition:', '').trim();
        current.conditions[key] = row[1];
        continue;
      }
      if (isRowEmpty(row)) {
        // Bascule en attente d'en-tête de colonnes
        mode = 'table-header';
        continue;
      }
      // Ligne non vide hors métadonnées connues → probablement l'en-tête de colonnes
      const nonEmpty = row.filter((c) => c !== undefined && c !== null && c !== '');
      if (nonEmpty.length >= 2) {
        columns = nonEmpty.map((c) => String(c).trim());
        mode = 'table-data';
        continue;
      }
    }

    // En attente d'en-tête de colonnes
    if (mode === 'table-header' && !isRowEmpty(row)) {
      const nonEmpty = row.filter((c) => c !== undefined && c !== null && c !== '');
      columns = nonEmpty.map((c) => String(c).trim());
      mode = 'table-data';
      continue;
    }

    // Données du tableau
    if (mode === 'table-data' && columns) {
      if (isRowEmpty(row)) {
        // Fin des données du tableau courant
        mode = 'table-meta'; // attendre éventuel autre tableau (▼)
        continue;
      }
      const dataRow = {};
      columns.forEach((col, idx) => {
        let v = row[idx];
        if (v === '' || v === undefined || v === null) {
          dataRow[col] = '';
        } else if (typeof v === 'number') {
          dataRow[col] = v;
        } else if (typeof v === 'string' && !isNaN(Number(v)) && v.trim() !== '') {
          dataRow[col] = Number(v);
        } else {
          dataRow[col] = v;
        }
      });
      current.data.push(dataRow);
    }
  }

  // Ne pas oublier le dernier tableau
  pushIfValid();

  if (result.length === 0) {
    warnings.push(`Feuille « ${sheetName} » : aucun tableau valide trouvé.`);
  }

  return result;
}

/**
 * Calcule un diff lisible entre 2 listes de modèles (ancien vs réimporté).
 * Renvoie un résumé textuel pour aperçu avant validation.
 */
export function diffPerformanceModels(oldModels, newModels) {
  const oldById = new Map((oldModels || []).map((m) => [m.id, m]));
  const newById = new Map((newModels || []).map((m) => [m.id, m]));

  const added = [];
  const removed = [];
  const modified = [];

  newById.forEach((m, id) => {
    if (!oldById.has(id)) {
      added.push(m.name || id);
    } else {
      const o = oldById.get(id);
      // Compter les points
      const countPoints = (mod) => {
        let n = 0;
        (mod.data?.graphs || []).forEach((g) => {
          (g.curves || []).forEach((c) => { n += (c.points || []).length; });
        });
        return n;
      };
      const oldN = countPoints(o);
      const newN = countPoints(m);
      if (oldN !== newN) {
        modified.push(`${m.name || id} : ${oldN} → ${newN} points`);
      }
    }
  });

  oldById.forEach((m, id) => {
    if (!newById.has(id)) {
      removed.push(m.name || id);
    }
  });

  return { added, removed, modified };
}

export default importPerformanceModelsFromExcel;
