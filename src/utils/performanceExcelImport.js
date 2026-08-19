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
// ⚠️ HISTORIQUE (2026-08-19, dossier F-GBTU) : jusqu'ici le ré-import
// reconstruisait les graphes UNIQUEMENT depuis les colonnes lisibles
// (Graph ID / noms / rôle / X / Y) → des graphes SQUELETTES sans axes,
// sans chaînage linkedTo/cascadeOrder, sans familyAxisVariable ni vent.
// Le moteur de cascade échouait ensuite (« n'a pas d'axes configurés »,
// « Entrée(s) de panneau manquante(s) ») : les 4 opérations de F-GBTU
// étaient incalculables après le ré-import de juin. Un tableau EST ses
// lignes ; un abaque est une STRUCTURE + des courbes — et l'Excel lisible
// ne transporte que les courbes.
//
// D'où la FUSION à 3 étages (du plus riche au plus pauvre) :
//   a. feuille _STRUCTURE présente → structure depuis le JSON, points depuis
//      les feuilles lisibles (rapprochés par Graph ID + Curve ID, repli par
//      nom si l'id manque) ;
//   b. pas de _STRUCTURE (vieux fichiers) MAIS un modèle de même id (ou même
//      operationId) existe déjà sur l'avion → sa structure est PRÉSERVÉE et
//      seuls les points des courbes appariées sont mis à jour. On ne remplace
//      JAMAIS un graphe structuré par un squelette ;
//   c. ni structure ni modèle existant → import minimal (squelette) marqué
//      validation.isValid=false + needsReview=true, avec avertissement
//      explicite — plus AUCUN isValid:true fabriqué.
//
// Renvoie un diff lisible pour aperçu avant écrasement.

import * as XLSX from 'xlsx';
import { STRUCTURE_SHEET_NAME } from './performanceExcelExport';

// Message unique (affiché à l'écran via warnings + posé dans validation.errors)
// pour le cas c : pas de structure disponible nulle part.
export const STRUCTURE_MISSING_MESSAGE =
  "structure d'abaque absente du fichier — axes et chaînage à reconstruire dans l'atelier";

// Les modèles de performance sont du JSON pur (persistés tels quels) :
// clone JSON suffisant, pas besoin de structuredClone.
const deepClone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/**
 * Un modèle a une structure « complète » quand CHAQUE graphe porte des axes
 * exploitables par le moteur de cascade (bornes finies X et Y). C'est le
 * critère minimal qui séparait les modèles calculables des squelettes de
 * F-GBTU (« n'a pas d'axes configurés »).
 */
export function modelStructureIsComplete(model) {
  const graphs = model?.data?.graphs || [];
  if (!graphs.length) return false;
  return graphs.every((g) => {
    const ax = g?.axes;
    return !!(
      ax && ax.xAxis && ax.yAxis &&
      Number.isFinite(Number(ax.xAxis.min)) && Number.isFinite(Number(ax.xAxis.max)) &&
      Number.isFinite(Number(ax.yAxis.min)) && Number.isFinite(Number(ax.yAxis.max))
    );
  });
}

/**
 * Verdict HONNÊTE posé sur chaque modèle ré-importé : true UNIQUEMENT si la
 * fusion a préservé une structure complète. (Remplace l'ancien isValid:true
 * posé en dur, qui faisait passer des squelettes pour des modèles valides.)
 */
function buildModelValidation(model) {
  if (modelStructureIsComplete(model)) {
    return { isValid: true, errors: [], needsReview: false };
  }
  return { isValid: false, errors: [STRUCTURE_MISSING_MESSAGE], needsReview: true };
}

/** Recherche par id (prioritaire) puis par nom — repli si l'id manque. */
const findByIdThenName = (list, ref) => {
  if (!Array.isArray(list) || !ref) return undefined;
  const refId = ref.id !== undefined && ref.id !== null && ref.id !== '' ? String(ref.id) : '';
  if (refId) {
    const byId = list.find((x) => x && String(x.id) === refId);
    if (byId) return byId;
  }
  const refName = (ref.name || '').trim();
  if (!refName) return undefined;
  return list.find((x) => x && (x.name || '').trim() === refName);
};

/**
 * Cas a — fusionne la structure (JSON de _STRUCTURE) avec les points lus
 * dans la feuille lisible. La structure fait foi pour TOUT sauf :
 *   - les points (feuille lisible = ce que le pilote a édité)
 *   - les métadonnées éditables du bloc haut de feuille (nom, type,
 *     classification) — le pilote a le droit de renommer dans Excel.
 * Les `fitted` ne sont pas transportés (dérivés des points, recalculés à la
 * demande) : rien à invalider ici.
 */
function mergeStructureWithPoints(structureModel, parsedGraphs, meta, sheetName, warnings) {
  const model = deepClone(structureModel);
  applyEditableSheetMeta(model, meta, sheetName);

  const allParsedCurves = [];
  const usedParsedGraphIds = new Set();

  (model.data.graphs || []).forEach((g) => {
    const pg = findByIdThenName(parsedGraphs, g);
    if (!pg) {
      // Le pilote a supprimé toutes les lignes de ce graphe : on GARDE le
      // graphe (structure non destructrice) mais ses courbes se vident.
      (g.curves || []).forEach((c) => { c.points = []; });
      warnings.push(`Modèle « ${model.name} » : graphe « ${g.name || g.id} » sans aucune ligne dans le fichier — points vidés, structure conservée.`);
      return;
    }
    usedParsedGraphIds.add(pg.id);
    const usedParsedCurveIds = new Set();
    (g.curves || []).forEach((c) => {
      const pc = findByIdThenName(pg.curves, c);
      if (pc) {
        usedParsedCurveIds.add(pc.id);
        c.points = pc.points;
        // Curve Value est visible/éditable dans Excel : on la reprend si fournie.
        if (pc.value !== undefined) c.value = pc.value;
        allParsedCurves.push(pc);
      } else {
        c.points = [];
        warnings.push(`Modèle « ${model.name} » : courbe « ${c.name || c.id} » sans points dans le fichier — conservée vide.`);
      }
    });
    // Courbes AJOUTÉES par le pilote dans Excel (id inconnu de la structure) :
    // on les accueille en courbes minimales plutôt que de perdre son travail.
    (pg.curves || []).filter((pc) => !usedParsedCurveIds.has(pc.id)).forEach((pc) => {
      g.curves = g.curves || [];
      g.curves.push(deepClone(pc));
      warnings.push(`Modèle « ${model.name} » : courbe « ${pc.name || pc.id} » ajoutée dans Excel — intégrée sans attributs de structure (famille/vent à compléter dans l'atelier).`);
    });
  });

  // Graphes ajoutés dans Excel, absents de la structure : accueillis en
  // squelettes explicitement signalés.
  parsedGraphs.filter((pg) => !usedParsedGraphIds.has(pg.id)).forEach((pg) => {
    model.data.graphs = model.data.graphs || [];
    model.data.graphs.push(deepClone(pg));
    warnings.push(`Modèle « ${model.name} » : graphe « ${pg.name || pg.id} » ajouté dans Excel sans structure — axes et chaînage à configurer dans l'atelier.`);
  });

  // Miroir legacy (AbacCurvesJSON compat) : si le modèle porte aussi des
  // courbes à plat, on y réinjecte les mêmes points pour ne pas laisser un
  // doublon vidé derrière nous.
  if (Array.isArray(model.data.curves)) {
    model.data.curves.forEach((lc) => {
      const pc = findByIdThenName(allParsedCurves, lc);
      if (pc) lc.points = deepClone(pc.points);
      else lc.points = lc.points || [];
    });
  }

  model.updatedAt = new Date().toISOString();
  model._reimportedFromExcel = true;
  model._structureSource = 'excel'; // traçabilité : structure venue du fichier
  model.validation = buildModelValidation(model);
  if (!model.validation.isValid) {
    warnings.push(`Modèle « ${model.name} » : structure incomplète après fusion — axes à vérifier dans l'atelier.`);
  }
  return model;
}

/**
 * Cas b — pas de _STRUCTURE (vieux fichier) mais l'avion porte déjà ce
 * modèle : on PRÉSERVE sa structure existante et on ne met à jour QUE les
 * points des courbes appariées (Graph ID + Curve ID, repli par nom).
 * Les courbes non appariées gardent leurs points actuels (jamais vidées :
 * un vieux fichier partiel ne doit pas amputer un modèle sain).
 */
function mergeExistingWithPoints(existingModel, parsedGraphs, meta, sheetName, warnings) {
  const model = deepClone(existingModel);
  applyEditableSheetMeta(model, meta, sheetName);
  // L'id de l'avion fait foi (apparié éventuellement par operationId) : on
  // garde model.id = existant pour METTRE À JOUR, pas dupliquer.

  (model.data?.graphs || []).forEach((g) => {
    const pg = findByIdThenName(parsedGraphs, g);
    if (!pg) return; // graphe absent du fichier → intouché
    (g.curves || []).forEach((c) => {
      const pc = findByIdThenName(pg.curves, c);
      if (!pc) return; // courbe absente du fichier → points actuels conservés
      c.points = pc.points;
      if (pc.value !== undefined) c.value = pc.value;
      // Les points ont changé : la courbe fittée existante est obsolète.
      delete c.fitted;
    });
  });

  model.updatedAt = new Date().toISOString();
  model._reimportedFromExcel = true;
  model._structureSource = 'aircraft'; // structure préservée depuis l'avion
  model.validation = buildModelValidation(model);
  return model;
}

/**
 * Cas c — ni structure dans le fichier, ni modèle existant : import minimal
 * (squelette), marqué HONNÊTEMENT comme à revoir. C'est l'ancien comportement,
 * moins le mensonge : plus de validation.isValid=true fabriqué.
 */
function buildSkeletonModel(parsedGraphs, meta, sheetName, parsedSheets) {
  const model = {
    id: meta['ID interne'] ? String(meta['ID interne']) : `model_${Date.now()}_${parsedSheets}`,
    name: meta['Nom'] ? String(meta['Nom']) : sheetName,
    type: meta['Type'] ? String(meta['Type']) : 'abaque',
    classification: meta['Classification'] !== undefined ? meta['Classification'] : '',
    classificationValue: meta['Valeur classification'] ?? '',
    createdAt: meta['Créé le'] || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data: {
      graphs: parsedGraphs,
      metadata: {
        systemType: meta['System Type'],
        // Nouveau libellé « manuel de vol » ; on accepte aussi l'ancien
        // libellé « MANEX » pour ré-importer les fichiers Excel existants.
        sourcePage: meta['Page source manuel de vol'] ?? meta['Page source MANEX']
      }
    },
    _reimportedFromExcel: true,
    _structureSource: null
  };
  model.validation = buildModelValidation(model); // squelette → toujours à revoir
  return model;
}

/**
 * Métadonnées ÉDITABLES du bloc haut de feuille : le pilote a le droit de les
 * modifier dans Excel, elles priment donc sur la structure/l'existant.
 * (L'ID interne, lui, reste la clé d'appariement — jamais écrasé ici.)
 */
function applyEditableSheetMeta(model, meta, sheetName) {
  model.name = meta['Nom'] ? String(meta['Nom']) : (model.name || sheetName);
  model.type = meta['Type'] ? String(meta['Type']) : (model.type || 'abaque');
  if (meta['Classification'] !== undefined) model.classification = meta['Classification'];
  if (meta['Valeur classification'] !== undefined) model.classificationValue = meta['Valeur classification'];
  if (!model.createdAt && meta['Créé le']) model.createdAt = meta['Créé le'];
}

/**
 * Cas b — retrouve le modèle existant correspondant à une feuille sans
 * structure : par id d'abord, sinon par operationId porté par les graphes
 * (le graphe primaire d'un modèle porte l'opération canonique).
 */
function findExistingModelForSkeleton(existingModels, modelId, parsedGraphs, warnings, sheetName) {
  if (!Array.isArray(existingModels) || existingModels.length === 0) return null;
  if (modelId) {
    const byId = existingModels.find((m) => m && String(m.id) === String(modelId));
    if (byId) return byId;
  }
  const opIds = new Set(parsedGraphs.map((g) => g.operationId).filter(Boolean));
  if (!opIds.size) return null;
  const matches = existingModels.filter((m) =>
    (m?.data?.graphs || []).some((g) => g?.operationId && opIds.has(g.operationId))
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    // Ambigu : deux modèles de l'avion portent la même opération. On ne
    // devine pas — mieux vaut un squelette signalé qu'une fusion sur le
    // mauvais modèle.
    warnings.push(`Feuille « ${sheetName} » : plusieurs modèles existants portent la même opération — appariement ambigu, structure existante non réutilisée.`);
  }
  return null;
}

/**
 * Parse la feuille technique _STRUCTURE : JSON chunké (colonne E) regroupé
 * par Model ID, reconstitué puis parsé. Un modèle dont le JSON est illisible
 * est simplement ignoré (repli automatique sur le cas b ou c) — l'import ne
 * doit jamais échouer à cause de la feuille technique.
 */
function parseStructureSheet(wb, warnings) {
  const index = { present: false, byId: new Map(), byName: new Map() };
  const ws = wb.Sheets[STRUCTURE_SHEET_NAME];
  if (!ws) return index;
  index.present = true;

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (String((rows[i] || [])[0]).trim() === 'Model ID') { headerIdx = i; break; }
  }
  if (headerIdx < 0) {
    warnings.push('Feuille _STRUCTURE illisible (en-tête absent) — structure ignorée.');
    return index;
  }

  // Regroupe les fragments par modèle (id prioritaire, repli nom).
  const acc = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const id = r[0] !== undefined && r[0] !== '' ? String(r[0]) : '';
    const name = r[1] !== undefined ? String(r[1]) : '';
    if (!id && !name) continue;
    const part = Number(r[2]);
    const total = Number(r[3]);
    const chunk = r[4] !== undefined ? String(r[4]) : '';
    const key = id || `name:${name}`;
    if (!acc.has(key)) {
      acc.set(key, { id, name, total: Number.isFinite(total) && total > 0 ? total : 0, parts: new Map() });
    }
    const entry = acc.get(key);
    entry.parts.set(Number.isFinite(part) && part > 0 ? part : entry.parts.size + 1, chunk);
  }

  acc.forEach((entry) => {
    const partNums = Array.from(entry.parts.keys()).sort((a, b) => a - b);
    if (entry.total && partNums.length !== entry.total) {
      warnings.push(`_STRUCTURE : modèle « ${entry.name || entry.id} » — ${partNums.length}/${entry.total} fragment(s) JSON, structure ignorée (repli sur le modèle existant de l'avion s'il est fourni).`);
      return;
    }
    const json = partNums.map((p) => entry.parts.get(p)).join('');
    try {
      const payload = JSON.parse(json);
      // Payload v1 = { version, model } ; on accepte aussi un modèle nu par
      // robustesse (fichier retouché à la main).
      const model = payload && typeof payload === 'object' && payload.model ? payload.model : payload;
      if (!model || typeof model !== 'object' || !model.data) {
        throw new Error('payload sans data');
      }
      if (model.id) index.byId.set(String(model.id), model);
      if (model.name) index.byName.set(String(model.name), model);
    } catch (err) {
      warnings.push(`_STRUCTURE : modèle « ${entry.name || entry.id} » — JSON invalide (${err.message}), structure ignorée.`);
    }
  });

  return index;
}

/**
 * Parse un .xlsx exporté et reconstruit les modèles.
 *
 * @param {File} file  Fichier .xlsx sélectionné par le pilote (tout objet
 *                     exposant arrayBuffer() convient — testable sous node)
 * @param {object} options
 * @param {Array}  options.existingModels  Modèles de performance ACTUELS de
 *   l'avion. Indispensable au cas b : un vieux fichier sans _STRUCTURE ne
 *   doit pas remplacer un modèle structuré par un squelette.
 * @returns {Promise<{models: Array, tables: Array, sheets: number, warnings: string[]}>}
 */
export async function importPerformanceModelsFromExcel(file, options = {}) {
  if (!file) throw new Error('Aucun fichier fourni.');
  const existingModels = Array.isArray(options.existingModels) ? options.existingModels : [];
  const arrayBuf = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuf, { type: 'array' });

  const models = [];
  const tables = [];
  const warnings = [];
  let parsedSheets = 0;

  // La feuille technique se lit AVANT la boucle : chaque feuille modèle a
  // besoin de savoir si sa structure est disponible.
  const structureIndex = parseStructureSheet(wb, warnings);

  for (const sheetName of wb.SheetNames) {
    // INFO et _STRUCTURE sont des feuilles techniques : ni modèles ni
    // tableaux (auparavant INFO générait un warning « pas de bloc DONNÉES »
    // à chaque import — bruit inutile).
    if (sheetName === 'INDEX' || sheetName === 'DEBUG_RAW' || sheetName === 'INFO' || sheetName === STRUCTURE_SHEET_NAME) continue;
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

    const parsedGraphs = Array.from(graphMap.values());
    const modelId = meta['ID interne'] ? String(meta['ID interne']) : '';
    const modelName = meta['Nom'] ? String(meta['Nom']) : sheetName;

    // ─── Fusion à 3 étages (voir en-tête du fichier) ─────────────────────
    const structureModel =
      (modelId && structureIndex.byId.get(modelId)) ||
      structureIndex.byName.get(modelName) ||
      null;

    if (structureModel) {
      // Cas a — structure depuis le fichier, points depuis la feuille lisible.
      models.push(mergeStructureWithPoints(structureModel, parsedGraphs, meta, sheetName, warnings));
    } else {
      const existing = findExistingModelForSkeleton(existingModels, modelId, parsedGraphs, warnings, sheetName);
      if (existing) {
        // Cas b — structure préservée depuis l'avion, points mis à jour.
        models.push(mergeExistingWithPoints(existing, parsedGraphs, meta, sheetName, warnings));
      } else {
        // Cas c — squelette assumé, signalé à l'écran.
        models.push(buildSkeletonModel(parsedGraphs, meta, sheetName, parsedSheets));
        warnings.push(`Modèle « ${modelName} » : ${STRUCTURE_MISSING_MESSAGE}.`);
      }
    }
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
        // Un tableau EST ses lignes : l'aller-retour Excel transporte tout
        // son contenu (contrairement aux abaques dont la structure transite
        // par _STRUCTURE). pushIfValid garantit data.length > 0 avant de
        // publier ce tableau → isValid:true est ici FONDÉ, pas fabriqué.
        validation: { errors: [], isValid: true, needsReview: false },
        _reimportedFromExcel: true
      };
      columns = null;
      mode = 'table-meta';
      continue;
    }

    if (!current) continue;

    // Métadonnées du tableau courant
    if (mode === 'table-meta') {
      if ((first === 'Page manuel de vol' || first === 'Page MANEX') && row[1] !== '') {
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
