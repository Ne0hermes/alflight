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
  const warnings = [];
  let parsedSheets = 0;

  for (const sheetName of wb.SheetNames) {
    if (sheetName === 'INDEX') continue;
    parsedSheets++;
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

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

  return { models, sheets: parsedSheets, warnings };
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
