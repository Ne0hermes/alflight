// src/utils/__tests__/performanceExcelRoundTrip.test.js
//
// Aller-retour Excel des modèles de performance (19/08/2026).
//
// Défaut prouvé sur pièce (Performances_F-GBTU_2026-08-19.xlsx) : l'export
// n'écrivait par courbe QUE Graph ID / noms / rôle / X / Y — aucun axe,
// aucun chaînage linkedTo/cascadeOrder, aucun familyAxisVariable, aucun
// vent. Le ré-import fabriquait des graphes squelettes ET les marquait
// valides : le moteur de cascade échouait ensuite (« n'a pas d'axes
// configurés », « Entrée(s) de panneau manquante(s) ») — 4/4 opérations de
// F-GBTU incalculables depuis le ré-import de juin. Un tableau EST ses
// lignes ; un abaque est une STRUCTURE + des courbes.
//
// Ces tests verrouillent la réparation :
//   1. export → import avec feuille _STRUCTURE = modèle STRICTEMENT
//      équivalent hors points fittés (recalculables) ;
//   2. vieux fichier SANS _STRUCTURE + modèle existant sur l'avion =
//      structure préservée, points mis à jour (jamais de squelette à la
//      place d'un graphe structuré) ;
//   3. ni structure ni existant = squelette marqué needsReview, isValid
//      false — plus aucun isValid:true fabriqué.

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildPerformanceWorkbook, STRUCTURE_SHEET_NAME } from '../performanceExcelExport';
import {
  importPerformanceModelsFromExcel,
  STRUCTURE_MISSING_MESSAGE,
  modelStructureIsComplete
} from '../performanceExcelImport';

const clone = (v) => JSON.parse(JSON.stringify(v));

// Modèle synthétique COMPLET : famille (graphe 1) + suivi de pente (graphe 2)
// + vent (graphe 3, primaire), chaînés en cascade — le strict reflet d'un
// set d'abaques réel type F-GBTU. Points triés par X croissant (l'import
// retrie par X : garder l'ordre ici rend la comparaison stricte possible).
const makeSyntheticModel = () => ({
  id: 'model_takeoff_ftest',
  name: 'Décollage 50ft',
  type: 'abaque',
  classification: 'takeoff',
  classificationValue: 'takeoff_distance_50ft',
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-15T08:30:00.000Z',
  data: {
    graphs: [
      {
        id: 'g1',
        name: 'Température / Altitude',
        role: 'intermediate',
        cascadeOrder: 1,
        axes: {
          xAxis: { min: -20, max: 40, step: 10, title: 'oat', unit: '°C' },
          yAxis: { min: 0, max: 800, step: 100, title: 'distance', unit: 'm' }
        },
        familyAxisVariable: 'pressure_altitude',
        interpolationMode: 'family',
        linkedTo: ['g2'],
        curves: [
          {
            id: 'c1', name: '0 ft', color: '#e53935', familyValue: 0,
            points: [{ x: -20, y: 220 }, { x: 0, y: 260.5 }, { x: 20, y: 310 }, { x: 40, y: 380 }]
          },
          {
            id: 'c2', name: '4000 ft', color: '#43a047', familyValue: 4000,
            points: [{ x: -20, y: 300 }, { x: 0, y: 355 }, { x: 20, y: 425 }, { x: 40, y: 512 }],
            // fitted = dérivé des points : NE DOIT PAS survivre au round-trip
            // (recalculé à la demande) — c'est la seule perte tolérée.
            fitted: { points: [{ x: -20, y: 300.1 }, { x: 40, y: 511.8 }], rmse: 0.3, method: 'pchip' }
          }
        ]
      },
      {
        id: 'g2',
        name: 'Masse',
        role: 'intermediate',
        cascadeOrder: 2,
        axes: {
          xAxis: { min: 700, max: 1150, step: 50, title: 'mass', unit: 'kg', reversed: true },
          yAxis: { min: 0, max: 800, step: 100, title: 'distance', unit: 'm' }
        },
        interpolationMode: 'slope-follow',
        linkedFrom: ['g1'],
        linkedTo: ['g3'],
        curves: [
          { id: 'c3', name: 'guide basse', color: '#1e88e5', entryY: 250, points: [{ x: 700, y: 180 }, { x: 900, y: 240 }, { x: 1150, y: 330 }] },
          { id: 'c4', name: 'guide haute', color: '#8e24aa', points: [{ x: 700, y: 420 }, { x: 900, y: 505 }, { x: 1150, y: 640 }] }
        ]
      },
      {
        id: 'g3',
        name: 'Vent',
        role: 'primary',
        operationId: 'takeoff_distance_50ft',
        outputKind: 'distance',
        outputUnit: 'm',
        axes: {
          xAxis: { min: 0, max: 30, step: 5, title: 'wind_component', unit: 'kt' },
          yAxis: { min: 0, max: 800, step: 100, title: 'distance', unit: 'm' }
        },
        isWindRelated: true,
        interpolationMode: 'slope-follow',
        linkedFrom: ['g2'],
        curves: [
          { id: 'c5', name: 'Vent de face', color: '#00897b', windDirection: 'headwind', points: [{ x: 0, y: 400 }, { x: 15, y: 330 }, { x: 30, y: 275 }] },
          { id: 'c6', name: 'Vent arrière', color: '#f4511e', windDirection: 'tailwind', points: [{ x: 0, y: 400 }, { x: 5, y: 460 }, { x: 10, y: 530 }] }
        ]
      }
    ],
    metadata: {
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-15T08:30:00.000Z',
      systemType: 'takeoff_distance_50ft',
      systemName: 'Distance de décollage 50 ft',
      referenceCases: [
        {
          id: 'ref1', label: 'Exemple POH p.5-9', inputValue: 15,
          parameters: { g1: 2000, g2: 1050, g3: 10 },
          windDirection: 'headwind', expected: 505, tolerancePct: 5
        }
      ]
    }
  }
});

// Workbook → « File » minimal (l'import ne consomme que arrayBuffer()) :
// permet de rejouer l'aller-retout complet écriture xlsx incluse, sous node.
const wbToFile = (wb) => {
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return { arrayBuffer: async () => out };
};

// Simule un VIEUX fichier (exports antérieurs au 19/08/2026) : mêmes feuilles
// lisibles, mais pas de feuille technique _STRUCTURE.
const stripStructureSheet = (wb) => {
  wb.SheetNames = wb.SheetNames.filter((n) => n !== STRUCTURE_SHEET_NAME);
  delete wb.Sheets[STRUCTURE_SHEET_NAME];
  delete wb.Workbook; // flags Hidden alignés par index — plus valides après retrait
  return wb;
};

// L'équivalence se juge hors champs volatils (updatedAt régénéré) et hors
// fitted (dérivé recalculable, sciemment non transporté).
const expectedGraphsWithoutFitted = (model) => {
  const graphs = clone(model.data.graphs);
  graphs.forEach((g) => (g.curves || []).forEach((c) => { delete c.fitted; }));
  return graphs;
};

describe('aller-retour Excel — cas a : feuille _STRUCTURE présente', () => {
  it('rend un modèle strictement équivalent hors points fittés', async () => {
    const original = makeSyntheticModel();
    const wb = buildPerformanceWorkbook([original], 'F-TEST');

    // La feuille technique existe et est masquée ; les feuilles lisibles restent.
    expect(wb.SheetNames).toContain(STRUCTURE_SHEET_NAME);
    const hiddenFlags = wb.Workbook.Sheets.find((s) => s.name === STRUCTURE_SHEET_NAME);
    expect(hiddenFlags?.Hidden).toBe(1);
    expect(wb.Workbook.Sheets.find((s) => s.name === 'INDEX')?.Hidden).toBe(0);

    const { models, warnings } = await importPerformanceModelsFromExcel(wbToFile(wb));
    expect(models).toHaveLength(1);
    const m = models[0];

    // Identité et métadonnées éditables
    expect(m.id).toBe(original.id);
    expect(m.name).toBe(original.name);
    expect(m.type).toBe(original.type);
    expect(m.classification).toBe(original.classification);
    expect(m.classificationValue).toBe(original.classificationValue);
    expect(m.createdAt).toBe(original.createdAt);

    // STRUCTURE + POINTS strictement équivalents (fitted exclu, recalculable)
    expect(m.data.graphs).toEqual(expectedGraphsWithoutFitted(original));
    expect(m.data.metadata).toEqual(original.data.metadata);

    // Verdict honnête : structure complète → valide, rien à revoir
    expect(m.validation).toEqual({ isValid: true, errors: [], needsReview: false });
    expect(m._structureSource).toBe('excel');
    expect(modelStructureIsComplete(m)).toBe(true);

    // Aucun avertissement de structure sur un round-trip propre
    expect(warnings.filter((w) => w.includes(STRUCTURE_MISSING_MESSAGE))).toHaveLength(0);
  });

  it('conserve une courbe dont le pilote a supprimé toutes les lignes (vidée, jamais détruite)', async () => {
    const original = makeSyntheticModel();
    const wb = buildPerformanceWorkbook([original], 'F-TEST');
    // Supprime les lignes de la courbe c4 dans la feuille lisible : on
    // réécrit la feuille du modèle sans les rows c4.
    const sheetName = wb.SheetNames.find((n) => n.startsWith('Décollage'));
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' });
    const kept = rows.filter((r) => String(r[4] ?? '') !== 'c4');
    wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(kept);

    const { models, warnings } = await importPerformanceModelsFromExcel(wbToFile(wb));
    const g2 = models[0].data.graphs.find((g) => g.id === 'g2');
    const c4 = g2.curves.find((c) => c.id === 'c4');
    // La courbe et ses attributs de structure survivent, points vidés + signalés
    expect(c4).toBeDefined();
    expect(c4.color).toBe('#8e24aa');
    expect(c4.points).toEqual([]);
    expect(warnings.some((w) => w.includes('c4') || w.includes('guide haute'))).toBe(true);
  });
});

describe('aller-retour Excel — cas b : vieux fichier sans _STRUCTURE, modèle existant sur l\'avion', () => {
  it('préserve la structure existante et ne met à jour que les points appariés', async () => {
    const existing = makeSyntheticModel();

    // Le pilote a modifié des points dans un VIEUX fichier Excel
    const edited = clone(existing);
    edited.data.graphs[0].curves[0].points = [
      { x: -20, y: 225 }, { x: 0, y: 266 }, { x: 20, y: 318 }, { x: 40, y: 391 }
    ];
    const wb = stripStructureSheet(buildPerformanceWorkbook([edited], 'F-TEST'));

    const { models } = await importPerformanceModelsFromExcel(wbToFile(wb), {
      existingModels: [existing]
    });
    expect(models).toHaveLength(1);
    const m = models[0];

    // JAMAIS de squelette à la place d'un graphe structuré : axes, chaînage,
    // famille et vent proviennent du modèle existant de l'avion.
    expect(m.id).toBe(existing.id);
    const g1 = m.data.graphs.find((g) => g.id === 'g1');
    expect(g1.axes).toEqual(existing.data.graphs[0].axes);
    expect(g1.familyAxisVariable).toBe('pressure_altitude');
    expect(g1.linkedTo).toEqual(['g2']);
    const g3 = m.data.graphs.find((g) => g.id === 'g3');
    expect(g3.isWindRelated).toBe(true);
    expect(g3.curves.find((c) => c.id === 'c5').windDirection).toBe('headwind');

    // Les points édités dans Excel ont bien remplacé les anciens
    expect(g1.curves.find((c) => c.id === 'c1').points).toEqual(edited.data.graphs[0].curves[0].points);
    // La courbe fittée de c2 est invalidée (points re-livrés par le fichier)
    expect(g1.curves.find((c) => c.id === 'c2').fitted).toBeUndefined();

    // Structure complète préservée → verdict valide
    expect(m.validation).toEqual({ isValid: true, errors: [], needsReview: false });
    expect(m._structureSource).toBe('aircraft');
  });

  it('apparie par operationId quand l\'ID interne du fichier ne correspond plus', async () => {
    const existing = makeSyntheticModel();
    const edited = clone(existing);
    edited.id = 'model_regenere_ailleurs'; // id divergent (fichier retouché/regénéré)
    edited.data.graphs[2].curves[0].points = [{ x: 0, y: 410 }, { x: 15, y: 338 }, { x: 30, y: 281 }];
    const wb = stripStructureSheet(buildPerformanceWorkbook([edited], 'F-TEST'));

    const { models } = await importPerformanceModelsFromExcel(wbToFile(wb), {
      existingModels: [existing]
    });
    const m = models[0];
    // Fusion sur l'existant via operationId du graphe primaire → on MET À
    // JOUR le modèle de l'avion (id conservé), pas de doublon squelette.
    expect(m.id).toBe(existing.id);
    expect(m.data.graphs.find((g) => g.id === 'g3').curves.find((c) => c.id === 'c5').points)
      .toEqual(edited.data.graphs[2].curves[0].points);
    expect(m.validation.isValid).toBe(true);
  });
});

describe('aller-retour Excel — cas c : ni _STRUCTURE ni modèle existant', () => {
  it('importe un squelette marqué needsReview, sans isValid fabriqué', async () => {
    const original = makeSyntheticModel();
    const wb = stripStructureSheet(buildPerformanceWorkbook([original], 'F-TEST'));

    const { models, warnings } = await importPerformanceModelsFromExcel(wbToFile(wb), {
      existingModels: [] // avion vierge : rien pour réparer la structure
    });
    expect(models).toHaveLength(1);
    const m = models[0];

    // Les points survivent…
    expect(m.data.graphs.find((g) => g.id === 'g1').curves.find((c) => c.id === 'c1').points)
      .toEqual(original.data.graphs[0].curves[0].points);
    // …mais la structure est perdue et le modèle le DIT :
    expect(m.data.graphs.find((g) => g.id === 'g1').axes).toBeUndefined();
    expect(m.validation.isValid).toBe(false);
    expect(m.validation.needsReview).toBe(true);
    expect(m.validation.errors).toContain(STRUCTURE_MISSING_MESSAGE);
    expect(modelStructureIsComplete(m)).toBe(false);
    // Avertissement explicite à l'écran (repris dans le résumé de Step4)
    expect(warnings.some((w) => w.includes(STRUCTURE_MISSING_MESSAGE))).toBe(true);
  });
});
